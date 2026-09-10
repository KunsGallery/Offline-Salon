import React, { useEffect, useMemo, useRef, useState } from 'react';
import SalonAvatar from '../participants/SalonAvatar';
import { realtime } from '../../lib/realtime';
import {
  formatDateRange,
  formatMonthTags,
  ORIGIN_LABELS,
  resolveExhibitionReferences,
  selectionReferenceMeta,
  summarizeExhibitionSelections,
} from '../../lib/exhibitionCatalog';

const GRAPE_POSITIONS = [
  [34, 18], [50, 18], [66, 18],
  [20, 36], [40, 36], [60, 36], [80, 36],
  [36, 56], [64, 56],
  [50, 77],
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
  return selection.referenceId || `${normalize(selection.title)}::${normalize(selection.venue)}`;
}

export function aggregateExhibitions(participants, references = []) {
  const groups = new Map();
  participants.forEach((participant) => grapeSelectionList(participant).forEach((selection) => {
    const key = normalizedKey(selection);
    const meta = selectionReferenceMeta(selection, references);
    const current = groups.get(key) || {
      key,
      title: selection.title,
      venue: selection.venue,
      photoUrl: selection.photoUrl,
      count: 0,
      ratings: [],
      people: new Set(),
      updatedAt: '',
      meta,
    };
    current.people.add(participant.participantId);
    current.count = current.people.size;
    current.ratings.push(selection.rating);
    if (!current.updatedAt || new Date(selection.updatedAt || 0) > new Date(current.updatedAt)) {
      current.title = selection.title;
      current.venue = selection.venue;
      current.photoUrl = selection.photoUrl;
      current.updatedAt = selection.updatedAt;
      current.meta = meta;
    }
    groups.set(key, current);
  }));
  return [...groups.values()]
    .map((group) => ({ ...group, average: group.ratings.reduce((sum, value) => sum + Number(value || 0), 0) / group.ratings.length }))
    .sort((a, b) => b.count - a.count || b.average - a.average);
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

const emptyDraft = {
  id: '',
  title: '',
  venue: '',
  referenceId: '',
  region: '',
  district: '',
  area: '',
  monthTags: [],
  artistOrigin: 'mixed',
  categoryTags: [],
  sourceUrl: '',
  rating: 7,
  status: 'expecting',
  source: 'participant',
  photoFile: null,
  photoUrl: '',
};

function referenceDraft(reference) {
  return {
    title: reference.title,
    venue: reference.venue || '',
    referenceId: reference.id,
    region: reference.region || '',
    district: reference.district || '',
    area: reference.area || '',
    monthTags: reference.monthTags || [],
    artistOrigin: reference.artistOrigin || 'mixed',
    categoryTags: reference.categoryTags || [],
    sourceUrl: reference.sourceUrl || '',
    source: 'reference',
  };
}

function useReferenceFilters(references) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [month, setMonth] = useState('all');
  const [origin, setOrigin] = useState('all');
  const regions = useMemo(() => [...new Set(references.map((item) => item.region).filter(Boolean))], [references]);
  const months = useMemo(() => [...new Set(references.flatMap((item) => item.monthTags || []))].sort((a, b) => a - b), [references]);
  const filtered = useMemo(() => references.filter((reference) => {
    const text = `${reference.title} ${reference.venue} ${reference.region} ${reference.categoryTags?.join(' ')}`.toLocaleLowerCase('ko-KR');
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase('ko-KR')))
      && (region === 'all' || reference.region === region)
      && (month === 'all' || reference.monthTags?.includes(Number(month)))
      && (origin === 'all' || reference.artistOrigin === origin);
  }), [month, origin, query, references, region]);
  return { query, setQuery, region, setRegion, month, setMonth, origin, setOrigin, regions, months, filtered };
}

function ReferencePicker({ references, disabled, onPick, onDirect }) {
  const { query, setQuery, region, setRegion, month, setMonth, origin, setOrigin, regions, months, filtered } = useReferenceFilters(references);
  return <section className="grape-reference-board">
    <header><div><strong>참고 전시에서 고르기</strong><span>원하는 전시를 누르면 이름과 분류가 자동으로 채워져요. 사진은 내가 직접 고릅니다.</span></div><button type="button" disabled={disabled} onClick={onDirect}>직접 입력</button></header>
    <div className="grape-reference-filters">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="전시명·장소 검색" />
      <select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">전체 지역</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">전체 월</option>{months.map((item) => <option key={item} value={item}>{item}월</option>)}</select>
      <select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="all">국내/국외 전체</option>{Object.entries(ORIGIN_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>
    <div className="grape-reference-list">{filtered.slice(0, 12).map((reference) => <button type="button" disabled={disabled} key={reference.id} onClick={() => onPick(reference)}><strong>{reference.title}</strong><span>{reference.venue} · {reference.region} · {formatMonthTags(reference.monthTags)}</span><small>{ORIGIN_LABELS[reference.artistOrigin]} · {reference.categoryTags?.slice(0, 3).join(' · ')}</small></button>)}</div>
  </section>;
}

export function ExhibitionGrapeParticipantView({ session, participant, onSaveSelection }) {
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const references = useMemo(() => resolveExhibitionReferences(session), [session]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const recordedRef = useRef(null);
  const selections = grapeSelectionList(participant);
  const metric = GRAPE_STATUSES.find((item) => item.id === draft.status)?.metric || '기대감';

  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const openNew = (prefill = {}) => {
    setDraft({ ...emptyDraft, ...prefill });
    setPreview('');
    setMessage('');
    setEditing(true);
    window.setTimeout(() => document.querySelector('.grape-entry-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const openExisting = (id) => {
    const selection = participant?.grapeSelections?.[id];
    if (!selection) return;
    setDraft({ ...emptyDraft, ...selection });
    setPreview(selection.photoUrl);
    setMessage('');
    setEditing(true);
  };
  const choosePhoto = (event) => {
    const photoFile = event.target.files?.[0];
    if (!photoFile) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(photoFile));
    setDraft((current) => ({ ...current, photoFile }));
    setMessage('');
    event.target.value = '';
  };
  const save = async () => {
    if (!draft.title.trim()) { setMessage('전시 이름을 적어 주세요.'); return; }
    if (!draft.photoFile && !draft.photoUrl) { setMessage('전시에서 찍은 사진을 선택해 주세요.'); return; }
    setSaving(true);
    setMessage('');
    try {
      await onSaveSelection(draft);
      setEditing(false);
      setDraft(emptyDraft);
      setPreview('');
      setMessage(`“${draft.title.trim()}”가 내 포도에 열렸어요.`);
      window.setTimeout(() => recordedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } catch (error) { setMessage(error?.message || '전시를 저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  };
  const closeEditor = () => { setEditing(false); setDraft(emptyDraft); setPreview(''); setMessage(''); };

  return <main className="grape-participant-view">
    <header className="grape-participant-header"><div><h1>{participant?.nickname || '나'}의<br />전시 포도</h1><p>서울의 전시 리스트를 참고하거나, 내가 본 전시를 직접 등록해요.</p></div><strong><span>{selections.length}</span> / {GRAPE_POSITIONS.length}</strong></header>
    <section className="grape-builder-stage"><GrapeBunch participant={participant} onSelect={openExisting} /><p>{selections.length ? '포도알을 누르면 사진과 느낌을 다시 기록할 수 있어요.' : '아직 포도알이 비어 있어요. 첫 전시 사진으로 시작해 보세요.'}</p><button className="grape-add-primary" type="button" disabled={selections.length >= GRAPE_POSITIONS.length} onClick={() => openNew()}>＋ 직접 전시 추가</button></section>
    <ReferencePicker references={references} disabled={selections.length >= GRAPE_POSITIONS.length} onPick={(reference) => openNew(referenceDraft(reference))} onDirect={() => openNew()} />
    {message ? <p className="grape-inline-message" role="status">{message}</p> : null}
    {editing ? <section className="grape-entry-editor">
      <header><div><p className="eyebrow">NEW GRAPE</p><h2>{draft.id ? '포도알 다시 기록하기' : '내 전시 한 알 만들기'}</h2>{draft.referenceId ? <span className="grape-reference-badge">{draft.region} · {ORIGIN_LABELS[draft.artistOrigin]} · {formatMonthTags(draft.monthTags)}</span> : null}</div><button type="button" onClick={closeEditor} aria-label="전시 등록 닫기">닫기</button></header>
      <div className={`grape-photo-picker ${preview ? 'has-photo' : ''}`}>{preview ? <img src={preview} alt="선택한 전시 사진 미리보기" /> : <div><strong>전시에서 찍은 사진</strong><span>포스터뿐 아니라 공간, 작품, 티켓 사진도 좋아요.</span></div>}<div><button type="button" onClick={() => galleryInput.current?.click()}>갤러리에서 선택</button><button type="button" onClick={() => cameraInput.current?.click()}>지금 촬영</button></div><input ref={galleryInput} type="file" accept="image/*" onChange={choosePhoto} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choosePhoto} /></div>
      <label className="grape-entry-field"><span>전시 이름 <b>필수</b></span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, referenceId: '' })} placeholder="예: 마르크 샤갈 특별전" /></label>
      <label className="grape-entry-field"><span>장소 <small>선택</small></span><input value={draft.venue} onChange={(event) => setDraft({ ...draft, venue: event.target.value })} placeholder="예: 예술의전당 한가람미술관" /></label>
      <div className="grape-status-options">{GRAPE_STATUSES.map((item) => <button type="button" className={draft.status === item.id ? 'active' : ''} aria-pressed={draft.status === item.id} key={item.id} onClick={() => setDraft({ ...draft, status: item.id })}>{item.label}</button>)}</div>
      <label className="grape-rating-range"><span><b>{metric}</b><strong style={{ '--rating-color': ratingColor(draft.rating) }}>{draft.rating}</strong></span><input type="range" min="1" max="10" step="1" value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: Number(event.target.value) })} /><i><small>1</small><small>마음이 움직인 만큼</small><small>10</small></i></label>
      <button className="grape-save-button" type="button" disabled={saving} onClick={save}>{saving ? '사진을 안전하게 저장하는 중…' : draft.id ? '포도알 수정하기' : '내 포도에 한 알 추가'}</button>
    </section> : null}
    {selections.length ? <section ref={recordedRef} className="grape-catalog" aria-label="이미 기록된 전시">
      <header><div><h2>이미 기록된 전시</h2><span>{selections.length}개의 전시가 내 포도에 담겨 있어요.</span></div><span>포도알을 눌러 수정</span></header>
      <div>{selections.map((selection) => <button type="button" key={selection.id} onClick={() => openExisting(selection.id)}><img src={selection.photoUrl} alt="" /><span><strong>{selection.title}</strong><small>{selection.venue || '장소 미입력'} · {selection.rating}/10</small></span></button>)}</div>
    </section> : null}
  </main>;
}

function FlipNumber({ value }) { return <span className="exhibition-flip-number" aria-label={`${value}명`}><i key={value}>{String(value).padStart(2, '0')}</i></span>; }

function StatBars({ title, items = [], limit = 5 }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <article className="grape-insight-card"><h3>{title}</h3>{items.slice(0, limit).map((item) => <div key={item.id}><span>{item.label}</span><i style={{ '--bar': `${Math.max(8, (item.count / max) * 100)}%` }} /><b>{item.count}</b></div>)}</article>;
}

export function ExhibitionGrapeHostView({ session, participants = [] }) {
  const references = useMemo(() => resolveExhibitionReferences(session), [session]);
  const view = session.stage?.view || 'live';
  const activeParticipants = participants.filter((participant) => grapeSelectionList(participant).length);
  const selectedParticipant = participants.find((item) => item.participantId === session.stage?.participantId) || [...activeParticipants].sort((a, b) => grapeSelectionList(b).length - grapeSelectionList(a).length)[0];
  const exhibitions = aggregateExhibitions(participants, references);
  const insights = summarizeExhibitionSelections(participants, references);
  if (view === 'person') return <main className="grape-host grape-host-person"><header><div><h1>{selectedParticipant?.nickname || '참여자'}의 전시 포도</h1><p>한 사람이 직접 찍고 고른 전시의 기억을 함께 들여다봅니다.</p></div><span>{grapeSelectionList(selectedParticipant).length} EXHIBITIONS</span></header><section><GrapeBunch participant={selectedParticipant} emptySlots={false} /><aside>{grapeSelectionList(selectedParticipant).map((selection) => { const meta = selectionReferenceMeta(selection, references); return <article key={selection.id}><img src={selection.photoUrl} alt="" /><div><strong>{selection.title}</strong><span>{selection.venue ? `${selection.venue} · ` : ''}{meta.region} · {GRAPE_STATUSES.find((item) => item.id === selection.status)?.label} · {selection.rating}/10</span></div></article>; })}</aside></section></main>;
  if (view === 'collective') return <main className="grape-host grape-host-collective"><header><h1>오늘 열린 전시 포도밭</h1><p>{activeParticipants.length}명의 사진과 취향이 한 줄기에서 함께 자라고 있습니다.</p></header>{activeParticipants.length ? <div className="collective-vine"><i /><i />{activeParticipants.map((participant, index) => <article key={participant.participantId} style={{ '--vine-index': index }}><GrapeBunch participant={participant} compact emptySlots={false} /><strong>{participant.nickname || '익명'}</strong><span>{grapeSelectionList(participant).length}알</span></article>)}</div> : <HostEmptyState />}</main>;
  return <main className="grape-host grape-host-live"><header><div><h1>지금, 마음이 향하는 전시</h1><p>참여자가 전시와 사진을 등록할 때마다 지역·월·작가 분류가 함께 쌓입니다.</p></div><span>{activeParticipants.length} PEOPLE · {insights.total} GRAPES</span></header>{exhibitions.length ? <><section className="grape-insight-grid"><StatBars title="지역별 선호" items={insights.region} /><StatBars title="월별 관심" items={insights.month} /><StatBars title="국내/국외 작가" items={insights.origin} /></section><section>{exhibitions.map((exhibition) => <article key={exhibition.key}><div><img src={exhibition.photoUrl} alt={`${exhibition.title} 사진`} /><FlipNumber value={exhibition.count} /></div><h2>{exhibition.title}</h2><p>{exhibition.venue || `${exhibition.count}명의 포도에 열렸습니다.`}</p><small>{exhibition.meta.region} · {formatMonthTags(exhibition.meta.monthTags)} · 평균 {exhibition.average.toFixed(1)}</small></article>)}</section></> : <HostEmptyState />}</main>;
}

function HostEmptyState() { return <section className="grape-host-empty"><div><LeafMark /><span>01</span></div><h2>첫 번째 전시를 기다리고 있어요</h2><p>참여자가 휴대폰에서 전시와 사진을 등록하면 이 화면에 바로 열립니다.</p></section>; }

export function ExhibitionGrapeRemotePanel({ session, participants = [], busy = false, run }) {
  const references = useMemo(() => resolveExhibitionReferences(session), [session]);
  const activeParticipants = participants.filter((participant) => grapeSelectionList(participant).length);
  const insights = summarizeExhibitionSelections(participants, references);
  const show = (view, participantId = null) => run(() => realtimeStage(session, view, participantId));
  return <section className="remote-assets grape-remote-panel"><div><p className="eyebrow">SEPTEMBER ACTIVITY</p><h2>전시 포도 화면</h2><p>참여자가 참고 리스트 또는 직접 입력으로 전시를 등록합니다.</p></div><div className="grape-remote-main"><button type="button" disabled={busy} onClick={() => show('live')}>실시간 전시 카운터</button><button type="button" disabled={busy || !activeParticipants.length} onClick={() => show('collective')}>전체 포도밭</button></div><div className="grape-remote-insights"><strong>현재 선택 {insights.total}개</strong><span>지역 1위 {insights.region[0]?.label || '대기 중'} · 월 1위 {insights.month[0]?.label || '대기 중'} · 분류 1위 {insights.origin[0]?.label || '대기 중'}</span></div><div className="grape-remote-people">{activeParticipants.map((participant) => <button type="button" disabled={busy} key={participant.participantId} onClick={() => show('person', participant.participantId)}><SalonAvatar avatar={participant.avatar} compact /><span><strong>{participant.nickname || '익명'}</strong><small>{grapeSelectionList(participant).length}개의 전시</small></span></button>)}</div></section>;
}

function realtimeStage(session, view, participantId) { return realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'exhibition-grape', view, participantId, page: 1, blackout: false }, status: 'live' }); }
