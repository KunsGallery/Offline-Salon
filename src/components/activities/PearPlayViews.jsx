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
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(!participant?.pearPairing?.photoUrl);
  const pairing = participant?.pearPairing;
  const waitingForHost = pairing && ['uploaded', 'analyzing'].includes(pairing.status) && !editing;

  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

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
      setEditing(false);
      setFile(null);
      setPreview('');
    } catch (reason) {
      setError(reason?.message || '사진을 접수하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <main className="pear-participant-view"><InvestigationScreen preview={preview} title="사진을 사건 보관함에 넣는 중입니다." /></main>;

  if (waitingForHost) return <main className="pear-participant-view"><section className="pear-participant-waiting"><div className="pear-detective-mark">R</div><span className="pear-case-label">PHOTO RECEIVED</span><h1>사진이 사건 보관함에<br />도착했어요.</h1><p>호스트가 한 장면을 고르면 토끼 탐정이 추리를 시작합니다.</p><div className="pear-waiting-photo"><img src={pairing.photoUrl} alt="접수된 사진" /></div><small>잠시 후 앞 화면에서 당신의 장면이 열릴 수 있어요.</small></section></main>;

  if (pairing?.status === 'ready' && !editing) return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">CASE SOLVED</span><h1>토끼 탐정이<br />한 작품을 찾았어요.</h1><p>정답이라기보다, 사진을 다시 바라보는 하나의 연결입니다.</p></div><SalonAvatar avatar={participant?.avatar} compact /></header><section className="pear-result-pair"><figure><img src={pairing.photoUrl} alt="내가 선택한 사진" /><figcaption>YOUR FRAME</figcaption></figure><strong>×</strong><PairArtwork pairing={pairing} /></section><section className="pear-what-we-saw"><header><span>WHAT WE SAW</span><h2>토끼 탐정이 발견한 단서</h2></header><div className="pear-evidence-grid"><EvidenceBlock title="OBJECT" values={pairing.analysis?.objects} /><EvidenceBlock title="COLOR" values={pairing.analysis?.colors} /><EvidenceBlock title="COMPOSITION" values={pairing.analysis?.composition} /><EvidenceBlock title="MOOD" values={[pairing.analysis?.mood]} /><EvidenceBlock title="CONTEXT" values={pairing.analysis?.context} /><EvidenceBlock title="CONCEPT" values={pairing.analysis?.concept} /></div></section><section className="pear-connection"><span>WHY THIS PAIR?</span><p>{pairing.connection || '두 이미지 사이의 연결을 정리하고 있어요.'}</p><strong>{pairing.statement}</strong><div>{tags(pairing.keywords)}</div></section><button className="pear-secondary-button" type="button" onClick={() => setEditing(true)}>다른 사진 조사하기</button></main>;

  return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">PEAR PLAY</span><h1>평범한 사진에<br />사건을 열어보세요.</h1><p>최근 좋아했거나 이상하게 마음에 남은 사진 한 장을 접수해 주세요.</p></div><strong>ONE PHOTO<br />ONE PAIR</strong></header><section className="pear-upload-panel"><div className={`pear-upload-preview ${preview ? 'has-photo' : ''}`}>{preview ? <img src={preview} alt="선택한 사진 미리보기" /> : <><div className="pear-detective-mark">R</div><strong>사진 한 장을 선택하세요.</strong><span>음식, 친구, 풍경, 방, 게임 화면 무엇이든 좋아요.</span></>}</div><div className="pear-upload-actions"><button type="button" onClick={() => galleryInput.current?.click()}>갤러리에서 선택</button><button type="button" onClick={() => cameraInput.current?.click()}>지금 촬영</button></div><input ref={galleryInput} type="file" accept="image/*" onChange={choosePhoto} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choosePhoto} /><p className="pear-upload-note">사진 속 장면은 먼저 호스트의 사건 보관함에 모이고, 선택된 사진만 토끼 탐정이 조사합니다.</p><button className="pear-submit-button" type="button" disabled={!file} onClick={submit}>{pairing ? '새 사진 접수하기' : '사진 접수하기'}</button>{error ? <p className="pear-error" role="alert">{error}</p> : null}</section></main>;
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

export function PearPlayHostView({ session, participants = [] }) {
  const completed = participants.filter((participant) => participant.pearPairing?.status === 'ready');
  const submitted = participants.filter((participant) => participant.pearPairing?.photoUrl);
  const view = session.stage?.pearView || 'case';
  if (view === 'board') return <main className="pear-host pear-host-board"><header><div><span className="pear-case-label">CASE BOARD</span><h1>일상에서 발견한<br />우리의 Pair</h1></div><strong>{completed.length} CASES</strong></header>{completed.length ? <section className="pear-case-board">{completed.map((participant, index) => <article key={participant.participantId}><header><SalonAvatar avatar={participant.avatar} compact /><div><span>CASE {String(index + 1).padStart(2, '0')}</span><h2>{participant.nickname || '익명'}</h2></div></header><div className="pear-board-pair"><img src={participant.pearPairing.photoUrl} alt="" /><b>×</b>{participant.pearPairing.finalArtwork?.imageUrl ? <img src={participant.pearPairing.finalArtwork.imageUrl} alt="" /> : <div />}</div><strong>{participant.pearPairing.finalArtwork?.title || 'Pair 확인 중'}</strong><p>{participant.pearPairing.keywords?.join(' · ')}</p></article>)}</section> : <div className="pear-host-empty"><strong>CASE BOARD</strong><p>아직 해결된 사건이 없습니다.</p></div>}</main>;
  const current = submitted.find((participant) => participant.participantId === session.stage?.pearParticipantId) || submitted[0];
  const pairing = current?.pearPairing;
  if (!current || !pairing) return <main className="pear-host pear-host-empty"><div><span className="pear-case-label">PEAR PLAY</span><h1>다음 사건을<br />기다리고 있어요.</h1><p>참여자가 사진을 제출하면 리모컨에서 사건을 열 수 있습니다.</p></div></main>;
  const phase = session.stage?.pearPhase || 'photo';
  const showArtwork = phase === 'revealed' || phase === 'connection';
  return <main className={`pear-host pear-host-case phase-${phase}`}><header><div><span className="pear-case-label">{phaseLabel(phase)}</span><h1>{current.nickname || '익명'}의 사건</h1><p>호스트가 고른 한 장면과 실제 작품 사이의 연결을 살펴봅니다.</p></div><strong>CASE {String(submitted.findIndex((participant) => participant.participantId === current.participantId) + 1).padStart(2, '0')}</strong></header><section className={`pear-host-stage ${showArtwork ? 'is-revealed' : ''}`}><div className="pear-host-photo"><img src={pairing.photoUrl} alt="참여자가 제출한 사진" /><span>YOUR FRAME</span></div>{phase === 'investigating' ? <HostInvestigationView /> : null}{phase === 'found' ? <HostFoundView pairing={pairing} /> : null}{showArtwork ? <div className="pear-host-reveal"><div className="pear-reveal-image"><img src={pairing.finalArtwork?.imageUrl} alt={`${pairing.finalArtwork?.artist}의 ${pairing.finalArtwork?.title}`} /></div><ArtworkCaption artwork={pairing.finalArtwork} /><div className="pear-reveal-connection"><span>{phase === 'connection' ? 'WHY THIS PAIR?' : 'THE PAIR'}</span><p>{pairing.connection}</p>{phase === 'connection' ? <strong>{pairing.statement}</strong> : null}</div></div> : null}</section></main>;
}

export function PearPlayRemotePanel({ session, participants = [], busy = false, run, onStartInvestigation }) {
  const submitted = useMemo(() => participants.filter((participant) => participant.pearPairing?.photoUrl), [participants]);
  const stage = session.stage || {};
  const updateStage = (patch) => realtime.updateSession(session.id, { currentQuestionId: null, stage: { ...stage, mode: 'pear-play', blackout: false, ...patch }, status: 'live' });
  const current = submitted.find((participant) => participant.participantId === stage.pearParticipantId) || submitted[0];
  const currentReady = current?.pearPairing?.status === 'ready';
  const choose = (participant) => run(() => updateStage({ pearParticipantId: participant.participantId, pearView: 'case', pearPhase: 'photo' }));
  return <section className="remote-assets pear-remote-panel"><div><span className="pear-case-label">PEAR PLAY</span><h2>토끼 탐정 사건 진행</h2><p>참가자 사진을 먼저 고른 뒤, 추리와 작품 공개를 차례로 진행합니다.</p></div><div className="pear-remote-main"><button type="button" disabled={busy || !current} onClick={() => run(() => updateStage({ pearParticipantId: current?.participantId || null, pearView: 'case', pearPhase: 'photo' }))}>사진 공개</button><button type="button" disabled={busy || !current || currentReady} onClick={() => run(() => onStartInvestigation(current))}>토끼 탐정의 추리 시작</button>{currentReady && stage.pearPhase === 'found' ? <button type="button" disabled={busy} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'revealed' }))}>작품 공개하기</button> : null}<button type="button" disabled={busy || !currentReady} onClick={() => run(() => updateStage({ pearView: 'board', pearPhase: 'revealed' }))}>CASE BOARD</button></div>{current ? <div className="pear-remote-phase"><strong>{current.nickname || '익명'} · {phaseLabel(stage.pearPhase || 'photo')}</strong><div>{currentReady && stage.pearPhase === 'found' ? <button type="button" className="active" disabled={busy} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'revealed' }))}>공개하기</button> : null}{stage.pearPhase === 'revealed' ? <button type="button" disabled={busy} onClick={() => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'connection' }))}>연결 이유 공개</button> : null}</div></div> : null}<div className="pear-remote-people">{submitted.map((participant) => <button type="button" className={participant.participantId === current?.participantId ? 'active' : ''} disabled={busy} key={participant.participantId} onClick={() => choose(participant)}><SalonAvatar avatar={participant.avatar} compact /><span><strong>{participant.nickname || '익명'}</strong><small>{participant.pearPairing.status === 'ready' ? '작품 분석 완료' : participant.pearPairing.status === 'error' ? '추리 실패 · 다시 시도' : '사진 접수 완료'}</small></span></button>)}</div>{!submitted.length ? <p className="pear-remote-empty">아직 접수된 사진이 없습니다. 참가자의 사진 제출을 기다리는 중입니다.</p> : null}</section>;
}
