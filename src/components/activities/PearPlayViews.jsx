import React, { useEffect, useMemo, useRef, useState } from 'react';
import SalonAvatar from '../participants/SalonAvatar';
import { realtime } from '../../lib/realtime';
import { prepareParticipantPhoto } from '../../lib/participantPhoto';

const INVESTIGATION_LINES = [
  '사건 접수. 평범한 사진처럼 보이는군요.',
  '현장을 살피고 있습니다. 사진 속 단서를 모으는 중입니다.',
  '색과 배열 사이의 반복을 확인하고 있습니다.',
  '잠깐. 처음 가설을 다시 의심해보죠.',
  '실제 작품 후보를 비교하고 있습니다.',
  '작품의 존재와 출처를 확인하고 있습니다.',
];

const RABBIT_STEPS = [
  ['01', 'SCENE', '사진 속 장면의 구조를 읽는 중'],
  ['02', 'CLUES', '색, 사물, 시선의 방향을 모으는 중'],
  ['03', 'SEARCH', '비슷한 작품과 작가의 기록을 찾는 중'],
  ['04', 'VERIFY', '작품의 출처와 정보를 대조하는 중'],
];

const EVIDENCE_SLOTS = [
  { x: 5, y: 8, rotate: -4 },
  { x: 31, y: 4, rotate: 3 },
  { x: 61, y: 8, rotate: -2 },
  { x: 12, y: 43, rotate: 2 },
  { x: 42, y: 39, rotate: -3 },
  { x: 71, y: 43, rotate: 4 },
  { x: 24, y: 72, rotate: -2 },
  { x: 55, y: 70, rotate: 3 },
];

function tags(values = []) {
  return values.filter(Boolean).map((value, index) => <span key={`${value}-${index}`}>{value}</span>);
}

function EvidenceBlock({ title, values }) {
  return <section className="pear-evidence-block"><h3>{title}</h3><div>{tags(values)}</div></section>;
}

function ArtworkCaption({ artwork, compact = false }) {
  if (!artwork) return null;
  return <div className={`pear-artwork-caption ${compact ? 'compact' : ''}`}>
    <span>VERIFIED ARTWORK</span>
    <h3>{artwork.title || '작품명 확인 중'}</h3>
    <p>{artwork.artist || '작가 확인 중'}</p>
    <dl>
      {artwork.year ? <div><dt>연도</dt><dd>{artwork.year}</dd></div> : null}
      {artwork.dimensions ? <div><dt>크기</dt><dd>{artwork.dimensions}</dd></div> : null}
      {artwork.materials ? <div><dt>재료</dt><dd>{artwork.materials}</dd></div> : null}
    </dl>
    {artwork.sourceUrl ? <a href={artwork.sourceUrl} target="_blank" rel="noreferrer">{artwork.sourceName || '작품 출처 열기'} ↗</a> : null}
  </div>;
}

function PairArtwork({ pairing, compact = false }) {
  const artwork = pairing?.finalArtwork;
  if (!artwork) return <div className="pear-artwork-missing">검증된 작품 이미지를 준비하고 있어요.</div>;
  return <article className={`pear-pair-artwork ${compact ? 'compact' : ''}`}>
    {artwork.imageUrl ? <img src={artwork.imageUrl} alt={`${artwork.artist}의 ${artwork.title}`} /> : <div className="pear-artwork-missing">작품 이미지 없음</div>}
    <ArtworkCaption artwork={artwork} compact={compact} />
  </article>;
}

function EnvelopeScene({ preview, status = 'idle' }) {
  const accepted = status === 'accepted';
  return <section className={`pear-envelope-scene ${accepted ? 'is-accepted' : ''}`} aria-live="polite">
    <div className="pear-envelope-visual">
      <img src={accepted ? '/pear-play/envelope-close-original.webp' : '/pear-play/envelope-open-original.webp'} alt="Rienzi 탐정사무소 편지 봉투" />
      {!accepted && preview ? <div className="pear-envelope-photo"><img src={preview} alt="봉투에 넣을 사건 사진" /><span>CASE PHOTO</span></div> : null}
      {!accepted && !preview ? <div className="pear-envelope-logo" aria-hidden="true"><strong>UNFRAME</strong><span>PEAR PLAY · PRIVATE CASE</span></div> : null}
    </div>
    <div className="pear-envelope-copy">
      <span className="pear-case-label">{accepted ? 'CASE FILE ACCEPTED' : status === 'uploading' ? 'SEALING EVIDENCE' : 'THE RIENZI AGENCY'}</span>
      <h2>{accepted ? '사진이 사건 파일로 접수되었습니다.' : status === 'uploading' ? '봉인을 확인하는 중입니다.' : preview ? '이 장면을 사건 봉투에 넣을까요?' : '당신의 일상을 사건으로 보내주세요.'}</h2>
      <p>{accepted ? '조수가 조사실의 사건 보드에 자료를 등록했습니다.' : status === 'uploading' ? '사진을 안전하게 사건 보관함으로 보내고 있습니다.' : '사진 한 장이면 충분합니다. 사소한 장면일수록 단서가 많습니다.'}</p>
    </div>
  </section>;
}

function InvestigationScreen({ preview, title = '토끼 탐정이 사진을 접수했습니다.' }) {
  const [lineIndex, setLineIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setLineIndex((current) => (current + 1) % INVESTIGATION_LINES.length), 1800);
    return () => window.clearInterval(timer);
  }, []);
  return <section className="pear-investigation-mobile"><div className="pear-detective-mark">R</div><span className="pear-case-label">RABBIT DETECTIVE</span><h1>{title}</h1>{preview ? <img src={preview} alt="조사 중인 사진" /> : null}<p>{INVESTIGATION_LINES[lineIndex]}</p><div className="pear-investigation-progress"><i style={{ '--pear-progress': `${Math.min(94, 18 + lineIndex * 14)}%` }} /></div></section>;
}

export function PearPlayParticipantView({ participant, onSubmit }) {
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState('');
  const receiptTimer = useRef(null);
  const [editing, setEditing] = useState(!participant?.pearPairing?.photoUrl);
  const pairing = participant?.pearPairing;
  const waitingForHost = pairing && ['uploaded', 'analyzing'].includes(pairing.status) && !editing;

  useEffect(() => () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    if (receiptTimer.current) window.clearTimeout(receiptTimer.current);
  }, [preview]);

  const choosePhoto = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setError('');
    event.target.value = '';
  };

  const submit = async () => {
    if (!file) { setError('사건으로 조사할 사진 한 장을 골라 주세요.'); return; }
    setBusy(true);
    setError('');
    try {
      const prepared = await prepareParticipantPhoto(file);
      await onSubmit(prepared);
      setReceipt(true);
      receiptTimer.current = window.setTimeout(() => {
        if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
        setReceipt(false);
        setEditing(false);
        setFile(null);
        setPreview('');
      }, 2200);
    } catch (reason) {
      setError(reason?.message || '사진을 접수하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <main className="pear-participant-view"><EnvelopeScene preview={preview} status="uploading" /></main>;

  if (receipt) return <main className="pear-participant-view"><EnvelopeScene preview={preview} status="accepted" /></main>;

  if (waitingForHost) return <main className="pear-participant-view"><section className="pear-participant-waiting"><div className="pear-detective-mark">R</div><span className="pear-case-label">PHOTO RECEIVED</span><h1>사진이 사건 보관함에<br />도착했어요.</h1><p>호스트가 한 장면을 고르면 토끼 탐정이 추리를 시작합니다.</p><div className="pear-waiting-photo"><img src={pairing.photoUrl} alt="접수된 사진" /></div><small>잠시 후 앞 화면에서 당신의 장면이 열릴 수 있어요.</small></section></main>;

  if (pairing?.status === 'ready' && !editing) return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">CASE SOLVED</span><h1>토끼 탐정이<br />한 작품을 찾았어요.</h1><p>정답이라기보다, 사진을 다시 바라보는 하나의 연결입니다.</p></div><SalonAvatar avatar={participant?.avatar} compact /></header><section className="pear-result-pair"><figure><img src={pairing.photoUrl} alt="내가 선택한 사진" /><figcaption>YOUR FRAME</figcaption></figure><strong>×</strong><PairArtwork pairing={pairing} /></section><section className="pear-what-we-saw"><header><span>WHAT WE SAW</span><h2>토끼 탐정이 발견한 단서</h2></header><div className="pear-evidence-grid"><EvidenceBlock title="OBJECT" values={pairing.analysis?.objects} /><EvidenceBlock title="COLOR" values={pairing.analysis?.colors} /><EvidenceBlock title="COMPOSITION" values={pairing.analysis?.composition} /><EvidenceBlock title="MOOD" values={[pairing.analysis?.mood]} /><EvidenceBlock title="CONTEXT" values={pairing.analysis?.context} /><EvidenceBlock title="CONCEPT" values={pairing.analysis?.concept} /></div></section><section className="pear-connection"><span>WHY THIS PAIR?</span><p>{pairing.connection || '두 이미지 사이의 연결을 정리하고 있어요.'}</p><strong>{pairing.statement}</strong><div>{tags(pairing.keywords)}</div></section><button className="pear-secondary-button" type="button" onClick={() => setEditing(true)}>다른 사진 조사하기</button></main>;

  return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">PEAR PLAY · PRIVATE CASE</span><h1>평범한 사진에<br />사건을 열어보세요.</h1><p>최근 좋아했거나 이상하게 마음에 남은 사진 한 장을 접수해 주세요.</p></div><strong>221B<br />RIENZI AGENCY</strong></header><section className="pear-upload-panel"><EnvelopeScene preview={preview} /><div className="pear-upload-actions"><button type="button" onClick={() => galleryInput.current?.click()}>갤러리에서 선택</button><button type="button" onClick={() => cameraInput.current?.click()}>지금 촬영</button></div><input ref={galleryInput} type="file" accept="image/*" onChange={choosePhoto} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choosePhoto} /><p className="pear-upload-note">사진은 호스트의 사건 보드에 도착한 뒤, 선택된 장면만 Detective P가 조사합니다.</p><button className="pear-submit-button" type="button" disabled={!file} onClick={submit}>{pairing ? '새 사진 접수하기' : '사진 접수하기'}</button>{error ? <p className="pear-error" role="alert">{error}</p> : null}</section></main>;
}

function phaseLabel(phase) {
  return {
    photo: 'PHOTO SELECTED',
    investigating: 'RABBIT DETECTIVE INVESTIGATING',
    found: 'ARTWORK FOUND · READY TO REVEAL',
    revealed: 'ARTWORK REVEALED',
    connection: 'WHY THIS PAIR?',
  }[phase] || 'PHOTO SELECTED';
}

function HostInvestigationView() {
  return <div className="pear-host-investigation"><div className="pear-detective-mark">R</div><span className="pear-case-label">RABBIT DETECTIVE AT WORK</span><h2>사진 속 단서에서<br />작품의 흔적을 찾는 중</h2><ol>{RABBIT_STEPS.map(([number, label, description]) => <li key={label}><b>{number}</b><div><strong>{label}</strong><span>{description}</span></div></li>)}</ol></div>;
}

function HostFoundView({ pairing }) {
  return <div className="pear-host-found"><span className="pear-case-label">ARTWORK FOUND</span><h2>작품을 찾았습니다.</h2><p>리모컨에서 공개하기를 누르면 이 작품이 모두의 화면에 나타납니다.</p><div>{tags(pairing?.keywords)}</div></div>;
}

function EvidenceWall({ participants = [], currentId = '' }) {
  if (!participants.length) return <div className="pear-evidence-wall pear-evidence-wall-empty"><span>WAITING FOR EVIDENCE</span><p>첫 번째 사건 사진을 기다리는 중입니다.</p></div>;
  return <div className="pear-evidence-wall" aria-label="참여자 사건 사진 보드">
    {participants.map((participant, index) => {
      const slot = EVIDENCE_SLOTS[index % EVIDENCE_SLOTS.length];
      const active = participant.participantId === currentId;
      return <article className={`pear-evidence-note ${active ? 'is-active' : ''}`} key={`${participant.participantId || 'evidence'}-${index}`} style={{ '--evidence-x': `${slot.x}%`, '--evidence-y': `${slot.y}%`, '--evidence-rotate': `${slot.rotate}deg`, '--evidence-delay': `${index * 0.42}s` }}>
        <span className="pear-evidence-pin" aria-hidden="true" />
        <img src={participant.pearPairing.photoUrl} alt={`${participant.nickname || '익명'}의 사건 사진`} />
        <footer><b>CASE {String(index + 1).padStart(2, '0')}</b><span>{participant.nickname || '익명'}</span></footer>
      </article>;
    })}
  </div>;
}

function HostCaseState({ current, pairing, phase, showArtwork }) {
  if (showArtwork) return <section className="pear-host-reveal-stage"><div className="pear-reveal-image"><img src={pairing.finalArtwork?.imageUrl} alt={`${pairing.finalArtwork?.artist}의 ${pairing.finalArtwork?.title}`} /></div><ArtworkCaption artwork={pairing.finalArtwork} /><div className="pear-reveal-connection"><span>{phase === 'connection' ? 'WHY THIS PAIR?' : 'THE PAIR'}</span><p>{pairing.connection}</p>{phase === 'connection' ? <strong>{pairing.statement}</strong> : null}</div></section>;
  if (phase === 'investigating') return <section className="pear-host-state pear-host-state-investigating"><HostInvestigationView /></section>;
  if (phase === 'found') return <section className="pear-host-state pear-host-state-found"><HostFoundView pairing={pairing} /></section>;
  return <section className="pear-host-state pear-host-state-photo"><span className="pear-case-label">CASE FILE RECEIVED</span><p>조수가 사진을 보드에 꽂았습니다. 리모컨에서 추리를 시작하세요.</p></section>;
}

export function PearPlayHostView({ session, participants = [] }) {
  const completed = participants.filter((participant) => participant.pearPairing?.status === 'ready');
  const submitted = participants.filter((participant) => participant.pearPairing?.photoUrl);
  const view = session.stage?.pearView || 'case';
  if (view === 'board') return <main className="pear-host pear-host-board"><div className="pear-host-vignette" aria-hidden="true" /><header><div><span className="pear-case-label">THE RIENZI AGENCY · ARCHIVE</span><h1>CASE BOARD</h1><p>해결된 사건과 사진의 연결을 기록합니다.</p></div><strong>{completed.length} CASES</strong></header>{completed.length ? <section className="pear-case-board">{completed.map((participant, index) => <article key={participant.participantId}><header><SalonAvatar avatar={participant.avatar} compact /><div><span>CASE {String(index + 1).padStart(2, '0')}</span><h2>{participant.nickname || '익명'}</h2></div></header><div className="pear-board-pair"><img src={participant.pearPairing.photoUrl} alt="" /><b>×</b>{participant.pearPairing.finalArtwork?.imageUrl ? <img src={participant.pearPairing.finalArtwork.imageUrl} alt="" /> : <div />}</div><strong>{participant.pearPairing.finalArtwork?.title || 'Pair 확인 중'}</strong><p>{participant.pearPairing.keywords?.join(' · ')}</p></article>)}</section> : <div className="pear-host-empty"><strong>CASE BOARD</strong><p>아직 해결된 사건이 없습니다.</p></div>}</main>;
  const current = submitted.find((participant) => participant.participantId === session.stage?.pearParticipantId) || submitted[0];
  const pairing = current?.pearPairing;
  if (!current || !pairing) return <main className="pear-host pear-host-empty"><div className="pear-host-vignette" aria-hidden="true" /><EvidenceWall participants={submitted} /><div className="pear-empty-copy"><span className="pear-case-label">THE RIENZI AGENCY · INTAKE</span><h1>다음 사건을<br />기다리고 있어요.</h1><p>참여자가 사진을 제출하면 조수가 사건 보드에 등록합니다.</p></div></main>;
  const phase = session.stage?.pearPhase || 'photo';
  const showArtwork = phase === 'revealed' || phase === 'connection';
  return <main className={`pear-host pear-host-case phase-${phase}`}><div className="pear-host-vignette" aria-hidden="true" /><header><div><span className="pear-case-label">THE RIENZI AGENCY · {phaseLabel(phase)}</span><h1>{current.nickname || '익명'}의 사건</h1><p>조수가 현장 사진을 사건 보드에 정리했습니다.</p></div><strong>CASE {String(submitted.findIndex((participant) => participant.participantId === current.participantId) + 1).padStart(2, '0')}</strong></header><EvidenceWall participants={submitted} currentId={current.participantId} /><HostCaseState current={current} pairing={pairing} phase={phase} showArtwork={showArtwork} /></main>;
}

export function PearPlayRemotePanel({ session, participants = [], busy = false, run, onStartInvestigation }) {
  const submitted = useMemo(() => participants.filter((participant) => participant.pearPairing?.photoUrl), [participants]);
  const stage = session.stage || {};
  const updateStage = (patch) => realtime.updateSession(session.id, { currentQuestionId: null, stage: { ...stage, mode: 'pear-play', blackout: false, ...patch }, status: 'live' });
  const current = submitted.find((participant) => participant.participantId === stage.pearParticipantId) || submitted[0];
  const currentReady = current?.pearPairing?.status === 'ready';
  const choose = (participant) => run(() => updateStage({ pearParticipantId: participant.participantId, pearView: 'case', pearPhase: 'photo' }));
  const openParticipantPage = () => {
    window.open(`${window.location.origin}/client/${encodeURIComponent(session.id)}`, '_blank', 'noopener,noreferrer');
    run(() => updateStage({ pearParticipantId: current?.participantId || null, pearView: 'case', pearPhase: 'photo' }));
  };
  return <section className="remote-assets pear-remote-panel"><div className="pear-remote-heading"><span className="pear-case-label">THE RIENZI AGENCY · FIELD DESK</span><h2>사건 파일을 관리합니다.</h2><p>접수된 사진을 선택하고, 조수의 기록을 바탕으로 추리를 진행하세요.</p></div><div className="pear-remote-main"><button type="button" disabled={busy} onClick={openParticipantPage}>새 사건 접수 열기</button><button type="button" disabled={busy || !current} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'photo' }))}>현장 사진 공개</button><button type="button" disabled={busy || !current || currentReady} onClick={() => run(() => onStartInvestigation(current))}>추리 시작</button>{currentReady && stage.pearPhase === 'found' ? <button type="button" disabled={busy} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'revealed' }))}>작품 공개</button> : null}<button type="button" disabled={busy || !currentReady} onClick={() => run(() => updateStage({ pearView: 'board', pearPhase: 'revealed' }))}>사건 보드</button></div>{current ? <div className="pear-remote-phase"><strong>현재 파일 · {current.nickname || '익명'}</strong><span>{phaseLabel(stage.pearPhase || 'photo')}</span><div>{currentReady && stage.pearPhase === 'found' ? <button type="button" className="active" disabled={busy} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'revealed' }))}>작품 공개</button> : null}{stage.pearPhase === 'revealed' ? <button type="button" disabled={busy} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'connection' }))}>연결 이유</button> : null}</div></div> : null}<div className="pear-remote-people">{submitted.map((participant) => <button type="button" className={participant.participantId === current?.participantId ? 'active' : ''} disabled={busy} key={participant.participantId} onClick={() => choose(participant)}><SalonAvatar avatar={participant.avatar} compact /><span><strong>{participant.nickname || '익명'}</strong><small>{participant.pearPairing.status === 'ready' ? '작품 분석 완료' : participant.pearPairing.status === 'error' ? '추리 실패 · 다시 시도' : '사진 접수 완료'}</small></span></button>)}</div>{!submitted.length ? <p className="pear-remote-empty">아직 접수된 사진이 없습니다. 참가자가 사진을 보내면 사건 파일이 이곳에 나타납니다.</p> : null}</section>;
}
