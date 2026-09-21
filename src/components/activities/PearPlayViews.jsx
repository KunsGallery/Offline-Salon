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

function tags(values = []) {
  return values.filter(Boolean).map((value) => <span key={value}>{value}</span>);
}

function EvidenceBlock({ title, values }) {
  return <section className="pear-evidence-block"><h3>{title}</h3><div>{tags(values)}</div></section>;
}

function PairArtwork({ pairing, compact = false }) {
  const artwork = pairing?.finalArtwork;
  if (!artwork) return <div className="pear-artwork-missing">검증된 작품 이미지를 준비하고 있어요.</div>;
  return <article className={`pear-pair-artwork ${compact ? 'compact' : ''}`}>
    {artwork.imageUrl ? <img src={artwork.imageUrl} alt={`${artwork.artist}의 ${artwork.title}`} /> : <div className="pear-artwork-missing">작품 이미지 없음</div>}
    <div><span>YOUR PAIR</span><h3>{artwork.title || '작품명 확인 중'}</h3><p>{artwork.artist || '작가 확인 중'}{artwork.year ? ` · ${artwork.year}` : ''}</p>{artwork.sourceUrl ? <a href={artwork.sourceUrl} target="_blank" rel="noreferrer">{artwork.sourceName || '작품 출처 열기'} ↗</a> : null}</div>
  </article>;
}

export function PearPlayParticipantView({ session, participant, onSubmit }) {
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(!participant?.pearPairing?.photoUrl);
  const [lineIndex, setLineIndex] = useState(0);
  const pairing = participant?.pearPairing;

  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!busy) return undefined;
    const timer = window.setInterval(() => setLineIndex((current) => (current + 1) % INVESTIGATION_LINES.length), 1800);
    return () => window.clearInterval(timer);
  }, [busy]);

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
      setError(reason?.message || '사진 분석을 시작하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <main className="pear-participant-view"><section className="pear-investigation-mobile"><div className="pear-detective-mark">P</div><span className="pear-case-label">CASE OPENED</span><h1>Detective P가<br />조사 중입니다.</h1>{preview ? <img src={preview} alt="조사 중인 사진" /> : null}<p>{INVESTIGATION_LINES[lineIndex]}</p><div className="pear-investigation-progress"><i style={{ '--pear-progress': `${Math.min(94, 18 + lineIndex * 14)}%` }} /></div></section></main>;

  if (pairing?.status === 'ready' && !editing) return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">CASE SOLVED</span><h1>당신의 사진과<br />한 작품이 만났어요.</h1><p>정답이라기보다, 사진을 다시 바라보는 하나의 연결입니다.</p></div><SalonAvatar avatar={participant?.avatar} compact /></header><section className="pear-result-pair"><figure><img src={pairing.photoUrl} alt="내가 선택한 사진" /><figcaption>YOUR FRAME</figcaption></figure><strong>×</strong><PairArtwork pairing={pairing} /></section><section className="pear-what-we-saw"><header><span>WHAT WE SAW</span><h2>Detective P가 발견한 단서</h2></header><div className="pear-evidence-grid"><EvidenceBlock title="OBJECT" values={pairing.analysis?.objects} /><EvidenceBlock title="COLOR" values={pairing.analysis?.colors} /><EvidenceBlock title="COMPOSITION" values={pairing.analysis?.composition} /><EvidenceBlock title="MOOD" values={[pairing.analysis?.mood]} /><EvidenceBlock title="CONTEXT" values={pairing.analysis?.context} /><EvidenceBlock title="CONCEPT" values={pairing.analysis?.concept} /></div></section><section className="pear-connection"><span>WHY THIS PAIR?</span><p>{pairing.connection || '두 이미지 사이의 연결을 정리하고 있어요.'}</p><strong>{pairing.statement}</strong><div>{tags(pairing.keywords)}</div></section><button className="pear-secondary-button" type="button" onClick={() => setEditing(true)}>다른 사진 조사하기</button></main>;

  return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">PEAR PLAY</span><h1>평범한 사진에<br />사건을 열어보세요.</h1><p>최근 좋아했거나 이상하게 마음에 남은 사진 한 장을 골라 주세요.</p></div><strong>ONE PHOTO<br />ONE PAIR</strong></header><section className="pear-upload-panel"><div className={`pear-upload-preview ${preview ? 'has-photo' : ''}`}>{preview ? <img src={preview} alt="선택한 사진 미리보기" /> : <><div className="pear-detective-mark">P</div><strong>사진 한 장을 선택하세요.</strong><span>음식, 친구, 풍경, 방, 게임 화면 무엇이든 좋아요.</span></>}</div><div className="pear-upload-actions"><button type="button" onClick={() => galleryInput.current?.click()}>갤러리에서 선택</button><button type="button" onClick={() => cameraInput.current?.click()}>지금 촬영</button></div><input ref={galleryInput} type="file" accept="image/*" onChange={choosePhoto} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choosePhoto} /><p className="pear-upload-note">사진 속 사물, 색, 분위기와 맥락을 단서로 실제 미술 작품을 찾아볼게요.</p><button className="pear-submit-button" type="button" disabled={!file} onClick={submit}>{pairing ? '새 사건 조사하기' : '사건 수사 시작'}</button>{error ? <p className="pear-error" role="alert">{error}</p> : null}</section></main>;
}

function phaseLabel(phase) {
  return { opened: 'CASE OPENED', inspection: 'SCENE INSPECTION', candidates: 'COMPARING SUSPECTS', deduction: 'FINAL DEDUCTION', solved: 'CASE SOLVED', connection: 'WHY THIS PAIR?' }[phase] || 'CASE OPENED';
}

export function PearPlayHostView({ session, participants = [] }) {
  const ready = participants.filter((participant) => participant.pearPairing?.status === 'ready');
  const view = session.stage?.pearView || 'case';
  if (view === 'board') return <main className="pear-host pear-host-board"><header><div><span className="pear-case-label">CASE BOARD</span><h1>일상에서 발견한<br />우리의 Pair</h1></div><strong>{ready.length} CASES</strong></header>{ready.length ? <section className="pear-case-board">{ready.map((participant, index) => <article key={participant.participantId}><header><SalonAvatar avatar={participant.avatar} compact /><div><span>CASE {String(index + 1).padStart(2, '0')}</span><h2>{participant.nickname || '익명'}</h2></div></header><div className="pear-board-pair"><img src={participant.pearPairing.photoUrl} alt="" /><b>×</b>{participant.pearPairing.finalArtwork?.imageUrl ? <img src={participant.pearPairing.finalArtwork.imageUrl} alt="" /> : <div />}</div><strong>{participant.pearPairing.finalArtwork?.title || 'Pair 확인 중'}</strong><p>{participant.pearPairing.keywords?.join(' · ')}</p></article>)}</section> : <div className="pear-host-empty"><strong>CASE BOARD</strong><p>아직 해결된 사건이 없습니다.</p></div>}</main>;
  const current = participants.find((participant) => participant.participantId === session.stage?.pearParticipantId) || ready[0];
  const pairing = current?.pearPairing;
  if (!current || !pairing) return <main className="pear-host pear-host-empty"><div><span className="pear-case-label">PEAR PLAY</span><h1>다음 사건을<br />기다리고 있어요.</h1><p>참여자가 사진을 제출하면 Remote에서 사건을 시작할 수 있습니다.</p></div></main>;
  const phase = session.stage?.pearPhase || 'opened';
  return <main className={`pear-host pear-host-case phase-${phase}`}><header><div><span className="pear-case-label">{phaseLabel(phase)}</span><h1>{current.nickname || '익명'}의 사건</h1><p>일상의 한 장면과 실제 작품 사이의 연결을 살펴봅니다.</p></div><strong>CASE {String(ready.findIndex((participant) => participant.participantId === current.participantId) + 1).padStart(2, '0')}</strong></header><section className="pear-host-stage"><div className="pear-host-photo"><img src={pairing.photoUrl} alt="참여자가 제출한 사진" /><span>YOUR FRAME</span></div>{phase === 'inspection' ? <div className="pear-host-evidence"><h2>현장에서 찾은 단서</h2><div>{tags([...(pairing.analysis?.objects || []), ...(pairing.analysis?.colors || [])])}</div><p>{pairing.analysis?.mood}</p></div> : null}{phase === 'candidates' ? <div className="pear-candidates"><h2>비슷한 작품들을 비교하고 있습니다.</h2>{pairing.candidates.map((candidate) => <article className={candidate.rejected ? 'rejected' : ''} key={candidate.id}><div>{candidate.imageUrl ? <img src={candidate.imageUrl} alt="" /> : <span />}</div><section><strong>{candidate.artist}</strong><h3>{candidate.title}</h3><p>{candidate.reason}</p>{candidate.rejected ? <b>REJECTED</b> : null}</section></article>)}</div> : null}{['deduction', 'solved', 'connection'].includes(phase) ? <div className="pear-host-solved"><PairArtwork pairing={pairing} />{phase !== 'solved' ? <div className="pear-connection"><span>{phase === 'connection' ? 'WHY THIS PAIR?' : 'FINAL DEDUCTION'}</span><p>{pairing.connection}</p>{phase === 'connection' ? <strong>{pairing.statement}</strong> : null}</div> : null}</div> : null}</section></main>;
}

export function PearPlayRemotePanel({ session, participants = [], busy = false, run }) {
  const ready = useMemo(() => participants.filter((participant) => participant.pearPairing?.status === 'ready'), [participants]);
  const stage = session.stage || {};
  const setStage = (patch) => run(() => realtime.updateSession(session.id, { currentQuestionId: null, stage: { ...stage, mode: 'pear-play', blackout: false, ...patch }, status: 'live' }));
  const current = ready.find((participant) => participant.participantId === stage.pearParticipantId) || ready[0];
  return <section className="remote-assets pear-remote-panel"><div><span className="pear-case-label">PEAR PLAY</span><h2>Detective P 사건 진행</h2><p>참여자가 제출한 사진을 사건처럼 열고, 단계별로 앞 화면에 공개합니다.</p></div><div className="pear-remote-main"><button type="button" disabled={busy || !current} onClick={() => setStage({ pearParticipantId: current?.participantId || null, pearView: 'case', pearPhase: 'opened' })}>사건 열기</button><button type="button" disabled={busy || !ready.length} onClick={() => setStage({ pearView: 'board', pearPhase: 'solved' })}>CASE BOARD</button></div>{current ? <div className="pear-remote-phase"><strong>{current.nickname || '익명'} · {phaseLabel(stage.pearPhase || 'opened')}</strong><div>{['opened', 'inspection', 'candidates', 'deduction', 'solved', 'connection'].map((phase) => <button type="button" className={stage.pearPhase === phase ? 'active' : ''} disabled={busy} key={phase} onClick={() => setStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: phase })}>{phaseLabel(phase)}</button>)}</div></div> : null}<div className="pear-remote-people">{ready.map((participant) => <button type="button" className={participant.participantId === current?.participantId ? 'active' : ''} disabled={busy} key={participant.participantId} onClick={() => setStage({ pearParticipantId: participant.participantId, pearView: 'case', pearPhase: 'opened' })}><SalonAvatar avatar={participant.avatar} compact /><span><strong>{participant.nickname || '익명'}</strong><small>{participant.pearPairing.finalArtwork?.title || 'Pair 준비 완료'}</small></span></button>)}</div>{!ready.length ? <p className="pear-remote-empty">아직 해결된 Pair가 없습니다. 참여자 사진 제출을 기다리는 중입니다.</p> : null}</section>;
}
