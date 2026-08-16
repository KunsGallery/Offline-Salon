import React, { useEffect, useRef, useState } from 'react';
import SalonAvatar from '../participants/SalonAvatar';
import { realtime } from '../../lib/realtime';
import { buildExhibitionNfcUrl } from '../../lib/exhibitionNfc';

const GRAPE_POSITIONS = [
  [50, 9], [36, 18], [64, 18], [25, 30], [50, 31], [75, 30], [17, 43], [39, 44], [61, 44], [83, 43],
  [28, 57], [50, 58], [72, 57], [38, 70], [62, 70], [50, 83], [42, 94], [58, 94],
];

export const GRAPE_STATUSES = [
  { id: 'want', label: '보고 싶어요', metric: '기대감' },
  { id: 'expecting', label: '기대 중이에요', metric: '기대감' },
  { id: 'seen', label: '보고 왔어요', metric: '만족도' },
];

export function grapeSelectionList(participant) {
  return Object.values(participant?.grapeSelections || {})
    .filter((selection) => selection?.title && selection?.photoUrl)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function normalizedKey(selection) {
  const normalize = (value) => String(value || '').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ');
  return `${normalize(selection.title)}::${normalize(selection.venue)}`;
}

export function aggregateExhibitions(participants) {
  const groups = new Map();
  participants.forEach((participant) => grapeSelectionList(participant).forEach((selection) => {
    const key = normalizedKey(selection);
    const current = groups.get(key) || { key, title: selection.title, venue: selection.venue, photoUrl: selection.photoUrl, count: 0, ratings: [], people: new Set(), updatedAt: '' };
    current.people.add(participant.participantId);
    current.count = current.people.size;
    current.ratings.push(selection.rating);
    if (!current.updatedAt || new Date(selection.updatedAt || 0) > new Date(current.updatedAt)) {
      current.title = selection.title; current.venue = selection.venue; current.photoUrl = selection.photoUrl; current.updatedAt = selection.updatedAt;
    }
    groups.set(key, current);
  }));
  return [...groups.values()].map((group) => ({ ...group, average: group.ratings.reduce((sum, value) => sum + Number(value || 0), 0) / group.ratings.length })).sort((a, b) => b.count - a.count || b.average - a.average);
}

function ratingColor(rating) {
  const value = Math.min(10, Math.max(1, Number(rating || 1)));
  return `hsl(${248 + (value - 1) * 9} 58% ${62 - value * 1.2}%)`;
}

function LeafMark({ compact = false }) {
  return <svg className={compact ? 'grape-leaf compact' : 'grape-leaf'} viewBox="0 0 180 120" aria-hidden="true"><path d="M87 108C45 102 20 72 9 39c25 8 43 3 61-24 10 19 20 28 34 31 14-12 31-17 57-14-10 35-35 65-74 76Z" /><path d="M89 101c-3-35 11-59 37-78M87 101C72 72 51 54 24 45" /></svg>;
}

function StemMark() { return <svg className="grape-stem" viewBox="0 0 150 120" aria-hidden="true"><path d="M76 112C69 75 75 42 107 8" /><path d="M77 69C54 50 34 41 8 43" /></svg>; }

function GrapeBunch({ participant, compact = false, emptySlots = true, onSelect = null }) {
  const selections = grapeSelectionList(participant).slice(0, GRAPE_POSITIONS.length);
  const slots = emptySlots ? GRAPE_POSITIONS : GRAPE_POSITIONS.slice(0, selections.length);
  return <div className={`exhibition-grape-bunch ${compact ? 'compact' : ''}`} aria-label={`${participant?.nickname || '참여자'}의 전시 포도`}>
    <StemMark /><LeafMark compact={compact} />
    {slots.map(([x, y], index) => {
      const selection = selections[index];
      return <button type="button" className={`exhibition-grape ${selection ? 'filled' : 'empty'}`} key={selection?.id || `empty-${index}`} style={{ '--grape-x': `${x}%`, '--grape-y': `${y}%`, '--grape-layer': GRAPE_POSITIONS.length - index + 2, '--grape-color': ratingColor(selection?.rating), '--grape-delay': `${index * 45}ms` }} onClick={() => selection && onSelect?.(selection.id)} disabled={!selection || !onSelect} aria-label={selection ? `${selection.title} ${selection.rating}점` : '비어 있는 포도알'}>
        {selection ? <><img src={selection.photoUrl} alt="" /><span>{selection.rating}</span></> : <i />}
      </button>;
    })}
  </div>;
}

function NfcMark() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M9 7v10M12 9.5v5M15 7v10M18 4v16" /></svg>; }

function decodeNfcEntry(event, entries = []) {
  for (const record of event.message?.records || []) {
    try {
      const value = new TextDecoder(record.encoding || 'utf-8').decode(record.data);
      const url = new URL(value, window.location.href);
      const entryId = url.searchParams.get('n') || '';
      const entry = entries.find((item) => item.id === entryId);
      if (entry) return { title: entry.title, venue: entry.venue || '', source: 'nfc' };
      if (entryId) return { title: '', venue: '', source: 'nfc', missing: true };
      if (url.searchParams.get('add') === '1' || url.searchParams.get('title')) return { title: url.searchParams.get('title') || '', venue: url.searchParams.get('venue') || '', source: 'nfc' };
    } catch { /* Ignore records that are not Offline Salon URLs. */ }
  }
  return null;
}

const emptyDraft = { id: '', title: '', venue: '', rating: 7, status: 'expecting', source: 'participant', photoFile: null, photoUrl: '' };

export function ExhibitionGrapeParticipantView({ session, participant, entryRequest = {}, onSaveSelection }) {
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const selections = grapeSelectionList(participant);
  const metric = GRAPE_STATUSES.find((item) => item.id === draft.status)?.metric || '기대감';
  const focusedNfcEntry = editing && draft.source === 'nfc' && !draft.id;

  const openNew = (prefill = {}) => {
    setDraft({ ...emptyDraft, title: prefill.title || '', venue: prefill.venue || '', source: prefill.source || 'participant' });
    setPreview(''); setMessage(''); setEditing(true);
  };
  const openExisting = (id) => {
    const selection = participant?.grapeSelections?.[id];
    if (!selection) return;
    setDraft({ ...emptyDraft, ...selection }); setPreview(selection.photoUrl); setMessage(''); setEditing(true);
  };
  useEffect(() => {
    if (!entryRequest.open) return;
    openNew(entryRequest);
    if (entryRequest.missing) setMessage('이 카드에 연결된 전시 정보를 찾지 못했습니다. 전시 이름을 직접 입력해 주세요.');
  }, [entryRequest.open, entryRequest.missing, entryRequest.title, entryRequest.venue]);
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const choosePhoto = (event) => {
    const photoFile = event.target.files?.[0];
    if (!photoFile) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(photoFile)); setDraft((current) => ({ ...current, photoFile })); setMessage(''); event.target.value = '';
  };
  const save = async () => {
    if (!draft.title.trim()) { setMessage('전시 이름을 적어 주세요.'); return; }
    if (!draft.photoFile && !draft.photoUrl) { setMessage('전시에서 찍은 사진을 선택해 주세요.'); return; }
    setSaving(true); setMessage('');
    try {
      await onSaveSelection(draft);
      setEditing(false); setDraft(emptyDraft); setPreview(''); setMessage(`“${draft.title.trim()}”가 내 포도에 열렸어요.`);
    } catch (error) { setMessage(error?.message || '전시를 저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  };
  const startNfc = async () => {
    if (!('NDEFReader' in window)) { setMessage('카드를 휴대폰에 태그하면 등록 화면이 자동으로 열려요.'); return; }
    try {
      const reader = new window.NDEFReader(); await reader.scan();
      reader.onreading = (event) => {
        const entry = decodeNfcEntry(event, session?.exhibitionNfcEntries || []);
        if (!entry) { setMessage('Offline Salon 전시 카드가 아닙니다.'); return; }
        openNew(entry);
        if (entry.missing) setMessage('이 카드에 연결된 전시 정보를 찾지 못했습니다. 전시 이름을 직접 입력해 주세요.');
      };
      reader.onreadingerror = () => setMessage('카드를 읽지 못했습니다. 휴대폰 뒷면에 다시 가까이 대주세요.');
      setScanning(true); setMessage('준비됐어요. 전시 카드를 휴대폰 뒷면에 대주세요.');
    } catch (error) { setMessage(error?.name === 'NotAllowedError' ? 'NFC 사용 권한을 허용해 주세요.' : 'NFC를 시작하지 못했습니다. 카드 링크로 다시 시도해 주세요.'); }
  };

  return <main className={`grape-participant-view ${focusedNfcEntry ? 'nfc-entry-focus' : ''}`}>
    {focusedNfcEntry ? <section className="grape-nfc-confirmation" aria-live="polite"><NfcMark /><div><strong>전시 카드를 인식했어요</strong><p>{entryRequest.missing ? '연결된 전시 정보가 없어 직접 입력이 필요합니다.' : <><b>“{draft.title}”</b> 정보를 불러왔습니다.<br />이제 내 사진을 골라 포도알을 완성해 주세요.</>}</p></div></section> : <>
      <header className="grape-participant-header"><div><h1>{participant?.nickname || '나'}의<br />전시 포도</h1><p>내가 찍은 사진으로 보고 싶은 전시와 다녀온 전시를 기록해요.</p></div><strong><span>{selections.length}</span> / {GRAPE_POSITIONS.length}</strong></header>
      <section className="grape-builder-stage"><GrapeBunch participant={participant} onSelect={openExisting} /><p>{selections.length ? '포도알을 누르면 사진과 느낌을 다시 기록할 수 있어요.' : '아직 포도알이 비어 있어요. 첫 전시 사진으로 시작해 보세요.'}</p><button className="grape-add-primary" type="button" disabled={selections.length >= GRAPE_POSITIONS.length} onClick={() => openNew()}>＋ 사진으로 전시 추가</button></section>
      <section className="grape-nfc-strip"><NfcMark /><div><strong>{scanning ? 'NFC 스캔 중' : '전시 카드가 있다면'}</strong><span>태그하면 전시 이름이 채워진 등록 화면이 열려요. 사진은 내가 고릅니다.</span></div>{'NDEFReader' in window ? <button type="button" onClick={startNfc}>{scanning ? '스캔 중' : '스캔'}</button> : null}</section>
    </>}
    {message ? <p className="grape-inline-message" role="status">{message}</p> : null}
    {editing ? <section className="grape-entry-editor">
      <header><div><p className="eyebrow">NEW GRAPE</p><h2>{draft.id ? '포도알 다시 기록하기' : focusedNfcEntry ? '사진과 느낌을 더해 주세요' : '내 전시 한 알 만들기'}</h2></div><button type="button" onClick={() => setEditing(false)} aria-label="전시 등록 닫기">{focusedNfcEntry ? '돌아가기' : '닫기'}</button></header>
      <div className={`grape-photo-picker ${preview ? 'has-photo' : ''}`}>{preview ? <img src={preview} alt="선택한 전시 사진 미리보기" /> : <div><strong>전시에서 찍은 사진</strong><span>포스터뿐 아니라 공간, 작품, 티켓 사진도 좋아요.</span></div>}<div><button type="button" onClick={() => galleryInput.current?.click()}>갤러리에서 선택</button><button type="button" onClick={() => cameraInput.current?.click()}>지금 촬영</button></div><input ref={galleryInput} type="file" accept="image/*" onChange={choosePhoto} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choosePhoto} /></div>
      <label className="grape-entry-field"><span>전시 이름 <b>필수</b></span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="예: 마르크 샤갈 특별전" /></label>
      <label className="grape-entry-field"><span>장소 <small>선택</small></span><input value={draft.venue} onChange={(event) => setDraft({ ...draft, venue: event.target.value })} placeholder="예: 예술의전당 한가람미술관" /></label>
      <div className="grape-status-options">{GRAPE_STATUSES.map((item) => <button type="button" className={draft.status === item.id ? 'active' : ''} aria-pressed={draft.status === item.id} key={item.id} onClick={() => setDraft({ ...draft, status: item.id })}>{item.label}</button>)}</div>
      <label className="grape-rating-range"><span><b>{metric}</b><strong style={{ '--rating-color': ratingColor(draft.rating) }}>{draft.rating}</strong></span><input type="range" min="1" max="10" step="1" value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: Number(event.target.value) })} /><i><small>1</small><small>마음이 움직인 만큼</small><small>10</small></i></label>
      <button className="grape-save-button" type="button" disabled={saving} onClick={save}>{saving ? '사진을 안전하게 저장하는 중…' : draft.id ? '포도알 수정하기' : '내 포도에 한 알 추가'}</button>
    </section> : null}
  </main>;
}

function FlipNumber({ value }) { return <span className="exhibition-flip-number" aria-label={`${value}명`}><i key={value}>{String(value).padStart(2, '0')}</i></span>; }

export function ExhibitionGrapeHostView({ session, participants = [] }) {
  const view = session.stage?.view || 'live';
  const activeParticipants = participants.filter((participant) => grapeSelectionList(participant).length);
  const selectedParticipant = participants.find((item) => item.participantId === session.stage?.participantId) || [...activeParticipants].sort((a, b) => grapeSelectionList(b).length - grapeSelectionList(a).length)[0];
  const exhibitions = aggregateExhibitions(participants);
  if (view === 'person') return <main className="grape-host grape-host-person"><header><div><h1>{selectedParticipant?.nickname || '참여자'}의 전시 포도</h1><p>한 사람이 직접 찍고 고른 전시의 기억을 함께 들여다봅니다.</p></div><span>{grapeSelectionList(selectedParticipant).length} EXHIBITIONS</span></header><section><GrapeBunch participant={selectedParticipant} emptySlots={false} /><aside>{grapeSelectionList(selectedParticipant).map((selection) => <article key={selection.id}><img src={selection.photoUrl} alt="" /><div><strong>{selection.title}</strong><span>{selection.venue ? `${selection.venue} · ` : ''}{GRAPE_STATUSES.find((item) => item.id === selection.status)?.label} · {selection.rating}/10</span></div></article>)}</aside></section></main>;
  if (view === 'collective') return <main className="grape-host grape-host-collective"><header><h1>오늘 열린 전시 포도밭</h1><p>{activeParticipants.length}명의 사진과 취향이 한 줄기에서 함께 자라고 있습니다.</p></header>{activeParticipants.length ? <div className="collective-vine"><i /><i />{activeParticipants.map((participant, index) => <article key={participant.participantId} style={{ '--vine-index': index }}><GrapeBunch participant={participant} compact emptySlots={false} /><strong>{participant.nickname || '익명'}</strong><span>{grapeSelectionList(participant).length}알</span></article>)}</div> : <HostEmptyState />}</main>;
  return <main className="grape-host grape-host-live"><header><div><h1>지금, 마음이 향하는 전시</h1><p>참여자가 사진과 전시를 등록할 때마다 새로운 카드가 열립니다.</p></div><span>{activeParticipants.length} PEOPLE · {activeParticipants.reduce((sum, person) => sum + grapeSelectionList(person).length, 0)} GRAPES</span></header>{exhibitions.length ? <section>{exhibitions.map((exhibition) => <article key={exhibition.key}><div><img src={exhibition.photoUrl} alt={`${exhibition.title} 사진`} /><FlipNumber value={exhibition.count} /></div><h2>{exhibition.title}</h2><p>{exhibition.venue || `${exhibition.count}명의 포도에 열렸습니다.`}</p></article>)}</section> : <HostEmptyState />}</main>;
}

function HostEmptyState() { return <section className="grape-host-empty"><div><LeafMark /><span>01</span></div><h2>첫 번째 전시를 기다리고 있어요</h2><p>참여자가 휴대폰에서 사진과 전시 이름을 등록하면 이 화면에 바로 열립니다.</p></section>; }

export function ExhibitionGrapeRemotePanel({ session, participants = [], busy = false, run }) {
  const activeParticipants = participants.filter((participant) => grapeSelectionList(participant).length);
  const show = (view, participantId = null) => run(() => realtimeStage(session, view, participantId));
  const addUrl = typeof window === 'undefined' ? '' : buildExhibitionNfcUrl(session.id, {}, window.location.origin);
  const copyUrl = async () => { try { await navigator.clipboard.writeText(addUrl); } catch { window.prompt('이 주소를 복사해 NFC 카드에 기록하세요.', addUrl); } };
  return <section className="remote-assets grape-remote-panel"><div><p className="eyebrow">SEPTEMBER ACTIVITY</p><h2>전시 포도 화면</h2><p>참여자가 직접 사진과 정보를 등록합니다.</p></div><div className="grape-remote-main"><button type="button" disabled={busy} onClick={() => show('live')}>실시간 전시 카운터</button><button type="button" disabled={busy || !activeParticipants.length} onClick={() => show('collective')}>전체 포도밭</button></div><button className="grape-nfc-copy" type="button" onClick={copyUrl}><NfcMark /><span><strong>공용 NFC 주소 복사</strong><small>태그하면 빈 전시 등록 화면이 열립니다.</small></span></button><div className="grape-remote-people">{activeParticipants.map((participant) => <button type="button" disabled={busy} key={participant.participantId} onClick={() => show('person', participant.participantId)}><SalonAvatar avatar={participant.avatar} compact /><span><strong>{participant.nickname || '익명'}</strong><small>{grapeSelectionList(participant).length}개의 전시</small></span></button>)}</div></section>;
}

function realtimeStage(session, view, participantId) { return realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'exhibition-grape', view, participantId, page: 1, blackout: false }, status: 'live' }); }
