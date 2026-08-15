import React, { useEffect, useMemo, useState } from 'react';
import SalonAvatar from '../participants/SalonAvatar';
import { realtime } from '../../lib/realtime';

const GRAPE_POSITIONS = [
  [50, 9], [36, 18], [64, 18], [25, 30], [50, 31], [75, 30], [17, 43], [39, 44], [61, 44], [83, 43],
  [28, 57], [50, 58], [72, 57], [38, 70], [62, 70], [50, 83], [42, 94], [58, 94],
];

export const GRAPE_STATUSES = [
  { id: 'want', label: '보고 싶어요', metric: '기대감' },
  { id: 'expecting', label: '기대 중이에요', metric: '기대감' },
  { id: 'seen', label: '보고 왔어요', metric: '만족도' },
];

export function exhibitionCatalog(session) {
  return [...(session?.artworks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function grapeSelectionList(participant, catalog) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  return Object.values(participant?.grapeSelections || {})
    .filter((selection) => byId.has(selection.exhibitionId))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((selection) => ({ ...selection, exhibition: byId.get(selection.exhibitionId) }));
}

function ratingColor(rating) {
  const value = Math.min(10, Math.max(1, Number(rating || 1)));
  return `hsl(${248 + (value - 1) * 9} 58% ${62 - value * 1.2}%)`;
}

function LeafMark({ compact = false }) {
  return <svg className={compact ? 'grape-leaf compact' : 'grape-leaf'} viewBox="0 0 180 120" aria-hidden="true"><path d="M87 108C45 102 20 72 9 39c25 8 43 3 61-24 10 19 20 28 34 31 14-12 31-17 57-14-10 35-35 65-74 76Z" /><path d="M89 101c-3-35 11-59 37-78M87 101C72 72 51 54 24 45" /></svg>;
}

function StemMark() {
  return <svg className="grape-stem" viewBox="0 0 150 120" aria-hidden="true"><path d="M76 112C69 75 75 42 107 8" /><path d="M77 69C54 50 34 41 8 43" /></svg>;
}

function GrapeBunch({ participant, catalog, compact = false, emptySlots = true, onSelect = null }) {
  const selections = grapeSelectionList(participant, catalog).slice(0, GRAPE_POSITIONS.length);
  const slots = emptySlots ? GRAPE_POSITIONS : GRAPE_POSITIONS.slice(0, selections.length);
  return <div className={`exhibition-grape-bunch ${compact ? 'compact' : ''}`} aria-label={`${participant?.nickname || '참여자'}의 전시 포도`}>
    <StemMark /><LeafMark compact={compact} />
    {slots.map(([x, y], index) => {
      const selection = selections[index];
      return <button
        type="button"
        className={`exhibition-grape ${selection ? 'filled' : 'empty'}`}
        key={selection?.exhibitionId || `empty-${index}`}
        style={{ '--grape-x': `${x}%`, '--grape-y': `${y}%`, '--grape-layer': GRAPE_POSITIONS.length - index + 2, '--grape-color': ratingColor(selection?.rating), '--grape-delay': `${index * 45}ms` }}
        onClick={() => selection && onSelect?.(selection.exhibitionId)}
        disabled={!selection || !onSelect}
        aria-label={selection ? `${selection.exhibition.displayTitle || '전시'} ${selection.rating}점` : '비어 있는 포도알'}
      >
        {selection ? <><img src={selection.exhibition.imageUrl} alt="" /><span>{selection.rating}</span></> : <i />}
      </button>;
    })}
  </div>;
}

function NfcMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M9 7v10M12 9.5v5M15 7v10M18 4v16" /></svg>;
}

function decodeNfcExhibition(event) {
  for (const record of event.message?.records || []) {
    try {
      const value = new TextDecoder(record.encoding || 'utf-8').decode(record.data);
      const url = new URL(value, window.location.href);
      const exhibitionId = url.searchParams.get('exhibition');
      if (exhibitionId) return exhibitionId;
    } catch {
      // Ignore records that are not URL/text payloads.
    }
  }
  return '';
}

export function ExhibitionGrapeParticipantView({ session, participant, requestedExhibitionId = '', onSaveSelection }) {
  const catalog = useMemo(() => exhibitionCatalog(session), [session]);
  const [activeId, setActiveId] = useState('');
  const [rating, setRating] = useState(7);
  const [status, setStatus] = useState('expecting');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const activeExhibition = catalog.find((item) => item.id === activeId) || null;
  const selectionCount = grapeSelectionList(participant, catalog).length;
  const metric = GRAPE_STATUSES.find((item) => item.id === status)?.metric || '기대감';

  const openExhibition = (exhibitionId) => {
    const exhibition = catalog.find((item) => item.id === exhibitionId);
    if (!exhibition) { setMessage('이 카드에 연결된 전시를 찾지 못했습니다.'); return; }
    const previous = participant?.grapeSelections?.[exhibitionId];
    setActiveId(exhibitionId);
    setRating(previous?.rating || 7);
    setStatus(previous?.status || 'expecting');
    setMessage('');
  };

  useEffect(() => { if (requestedExhibitionId) openExhibition(requestedExhibitionId); }, [requestedExhibitionId, catalog.length]);

  const save = async () => {
    if (!activeExhibition) return;
    setSaving(true); setMessage('');
    try {
      await onSaveSelection(activeExhibition.id, { rating, status });
      setMessage(`“${activeExhibition.displayTitle || '전시'}”가 포도알로 열렸어요.`);
      setActiveId('');
    } catch (error) {
      setMessage(error?.message || '전시를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally { setSaving(false); }
  };

  const startNfc = async () => {
    if (!('NDEFReader' in window)) { setMessage('이 기기에서는 카드 태그 시 열리는 링크 방식으로 참여할 수 있어요.'); return; }
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (event) => {
        const exhibitionId = decodeNfcExhibition(event);
        if (exhibitionId) openExhibition(exhibitionId);
        else setMessage('Offline Salon 전시 카드가 아닙니다.');
      };
      reader.onreadingerror = () => setMessage('카드를 읽지 못했습니다. 휴대폰 뒷면에 다시 가까이 대주세요.');
      setScanning(true);
      setMessage('준비됐어요. 다음 전시 카드를 휴대폰 뒷면에 대주세요.');
    } catch (error) { setMessage(error?.name === 'NotAllowedError' ? 'NFC 사용 권한을 허용해 주세요.' : 'NFC를 시작하지 못했습니다. 카드 링크로 다시 시도해 주세요.'); }
  };

  return <main className="grape-participant-view">
    <header className="grape-participant-header"><div><h1>{participant?.nickname || '나'}의<br />전시 포도</h1><p>보고 싶거나 마음에 남은 전시를 한 알씩 채워보세요.</p></div><strong><span>{selectionCount}</span> / {Math.min(catalog.length, GRAPE_POSITIONS.length)}</strong></header>
    <section className="grape-builder-stage"><GrapeBunch participant={participant} catalog={catalog} onSelect={openExhibition} /><p>{selectionCount ? '포스터를 누르면 느낌을 다시 기록할 수 있어요.' : '아직 열린 포도알이 없어요. 아래에서 전시를 고르거나 NFC 카드를 태그하세요.'}</p></section>
    <section className="grape-nfc-strip"><NfcMark /><div><strong>{scanning ? 'NFC 연속 스캔 중' : '전시 카드 태그'}</strong><span>{scanning ? '카드를 바꿔가며 계속 태그할 수 있어요.' : '아이폰은 카드를 태그하면 이 페이지로 바로 돌아옵니다.'}</span></div>{'NDEFReader' in window ? <button type="button" onClick={startNfc}>{scanning ? '스캔 중' : '연속 스캔'}</button> : null}</section>
    {message ? <p className="grape-inline-message" role="status">{message}</p> : null}
    {activeExhibition ? <section className="grape-rating-editor">
      <header><img src={activeExhibition.imageUrl} alt={`${activeExhibition.displayTitle || '전시'} 포스터`} /><div><h2>{activeExhibition.displayTitle || '이름 없는 전시'}</h2><p>이 전시는 어떤 상태인가요?</p></div><button type="button" onClick={() => setActiveId('')} aria-label="전시 기록 닫기">닫기</button></header>
      <div className="grape-status-options">{GRAPE_STATUSES.map((item) => <button type="button" className={status === item.id ? 'active' : ''} aria-pressed={status === item.id} key={item.id} onClick={() => setStatus(item.id)}>{item.label}</button>)}</div>
      <label className="grape-rating-range"><span><b>{metric}</b><strong style={{ '--rating-color': ratingColor(rating) }}>{rating}</strong></span><input type="range" min="1" max="10" step="1" value={rating} onChange={(event) => setRating(Number(event.target.value))} /><i><small>1</small><small>마음이 움직인 만큼</small><small>10</small></i></label>
      <button className="grape-save-button" type="button" disabled={saving} onClick={save}>{saving ? '포도알을 채우는 중…' : '내 포도에 한 알 추가'}</button>
    </section> : <section className="grape-catalog"><header><h2>전시 목록에서 고르기</h2><span>{catalog.length} EXHIBITIONS</span></header><div>{catalog.map((item) => { const selected = participant?.grapeSelections?.[item.id]; return <button type="button" key={item.id} onClick={() => openExhibition(item.id)}><img src={item.imageUrl} alt="" /><span><strong>{item.displayTitle || '이름 없는 전시'}</strong><small>{selected ? `${selected.rating}점 · 수정하기` : '포도알로 등록'}</small></span></button>; })}</div></section>}
  </main>;
}

function FlipNumber({ value }) {
  return <span className="exhibition-flip-number" aria-label={`${value}명`}><i key={value}>{String(value).padStart(2, '0')}</i></span>;
}

export function ExhibitionGrapeHostView({ session, participants = [] }) {
  const catalog = exhibitionCatalog(session);
  const view = session.stage?.view || 'live';
  const selectedParticipant = participants.find((item) => item.participantId === session.stage?.participantId) || [...participants].sort((a, b) => grapeSelectionList(b, catalog).length - grapeSelectionList(a, catalog).length)[0];
  const counts = Object.fromEntries(catalog.map((item) => [item.id, participants.filter((participant) => participant.grapeSelections?.[item.id]).length]));
  const activeParticipants = participants.filter((participant) => grapeSelectionList(participant, catalog).length);

  if (view === 'person') return <main className="grape-host grape-host-person"><header><div><h1>{selectedParticipant?.nickname || '참여자'}의 전시 포도</h1><p>한 사람의 8월과 9월 전시 취향을 함께 들여다봅니다.</p></div><span>{grapeSelectionList(selectedParticipant, catalog).length} EXHIBITIONS</span></header><section><GrapeBunch participant={selectedParticipant} catalog={catalog} emptySlots={false} /><aside>{grapeSelectionList(selectedParticipant, catalog).map((selection) => <article key={selection.exhibitionId}><img src={selection.exhibition.imageUrl} alt="" /><div><strong>{selection.exhibition.displayTitle || '이름 없는 전시'}</strong><span>{GRAPE_STATUSES.find((item) => item.id === selection.status)?.label} · {selection.rating}/10</span></div></article>)}</aside></section></main>;

  if (view === 'collective') return <main className="grape-host grape-host-collective"><header><h1>오늘 열린 전시 포도밭</h1><p>{activeParticipants.length}명의 취향이 한 줄기에서 함께 자라고 있습니다.</p></header><div className="collective-vine"><i /><i />{activeParticipants.map((participant, index) => <article key={participant.participantId} style={{ '--vine-index': index }}><GrapeBunch participant={participant} catalog={catalog} compact emptySlots={false} /><strong>{participant.nickname || '익명'}</strong><span>{grapeSelectionList(participant, catalog).length}알</span></article>)}</div></main>;

  return <main className="grape-host grape-host-live"><header><div><h1>지금, 마음이 향하는 전시</h1><p>NFC 카드가 닿을 때마다 전시 포스터 옆의 숫자가 넘어갑니다.</p></div><span>{activeParticipants.length} PEOPLE · {Object.values(counts).reduce((sum, count) => sum + count, 0)} GRAPES</span></header><section>{catalog.map((exhibition) => <article key={exhibition.id}><div><img src={exhibition.imageUrl} alt={`${exhibition.displayTitle || '전시'} 포스터`} /><FlipNumber value={counts[exhibition.id] || 0} /></div><h2>{exhibition.displayTitle || '이름 없는 전시'}</h2><p>{counts[exhibition.id] ? `${counts[exhibition.id]}명의 포도에 열렸습니다.` : '첫 번째 태그를 기다리고 있습니다.'}</p></article>)}</section></main>;
}

export function ExhibitionGrapeRemotePanel({ session, participants = [], busy = false, run }) {
  const catalog = exhibitionCatalog(session);
  const activeParticipants = participants.filter((participant) => grapeSelectionList(participant, catalog).length);
  const show = (view, participantId = null) => run(() => realtimeStage(session, view, participantId));
  return <section className="remote-assets grape-remote-panel"><div><p className="eyebrow">SEPTEMBER ACTIVITY</p><h2>전시 포도 화면</h2></div><div className="grape-remote-main"><button type="button" disabled={busy} onClick={() => show('live')}>실시간 전시 카운터</button><button type="button" disabled={busy || !activeParticipants.length} onClick={() => show('collective')}>전체 포도밭</button></div><div className="grape-remote-people">{activeParticipants.map((participant) => <button type="button" disabled={busy} key={participant.participantId} onClick={() => show('person', participant.participantId)}><SalonAvatar avatar={participant.avatar} compact /><span><strong>{participant.nickname || '익명'}</strong><small>{grapeSelectionList(participant, catalog).length}개의 전시</small></span></button>)}</div></section>;
}

function realtimeStage(session, view, participantId) {
  return realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'exhibition-grape', view, participantId, page: 1, blackout: false }, status: 'live' });
}
