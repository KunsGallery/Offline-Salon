import React, { useEffect, useMemo, useRef, useState } from 'react';
import SalonAvatar from '../participants/SalonAvatar';
import { realtime } from '../../lib/realtime';
import { prepareParticipantPhoto } from '../../lib/participantPhoto';

const DETECTIVE_CINEMATIC_STEPS = {
  observing: ['사진 관찰', '먼저 이 사진의 단서를 살펴보겠습니다.', '색과 형태, 장면의 분위기를 읽고 있어요.'],
  searching: ['작품 탐색', '이 장면과 닮은 작품을 찾고 있습니다.', '탐정 P가 작품 기록을 검색하고 있어요.'],
  verifying: ['결과 정리', '찾아본 작품 기록을 정리하고 있습니다.', '작품과 사진의 연결을 확인한 뒤 보여드릴게요.'],
};

const EVIDENCE_SLOTS = [
  { x: -5, y: 28, rotate: -4 },
  { x: 80, y: 28, rotate: 3 },
  { x: -20, y: 3, rotate: 2 },
  { x: 95, y: 3, rotate: -3 },
  { x: -20, y: 53, rotate: -2 },
  { x: 95, y: 53, rotate: 4 },
  { x: -5, y: 78, rotate: 3 },
  { x: 80, y: 78, rotate: -2 },
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

function EnvelopeScene({ preview, status = 'idle', progress = null }) {
  const accepted = status === 'accepted';
  return <section className={`pear-envelope-scene ${accepted ? 'is-accepted' : ''}`} aria-live="polite">
    <div className="pear-envelope-visual">
      {accepted ? <img src="/pear-play/envelope-close-original.webp" alt="Rienzi 탐정사무소 편지 봉투" /> : <>
        <img className="pear-envelope-back-layer" src="/pear-play/envelope-open-original.webp" alt="Rienzi 탐정사무소 편지 봉투" />
        {!preview ? <div className="pear-envelope-logo" aria-hidden="true"><strong>UNFRAME</strong><span>PEAR PLAY · PRIVATE CASE</span></div> : null}
        {preview ? <div className="pear-envelope-photo"><img src={preview} alt="봉투에 넣을 사건 사진" /><span>CASE PHOTO</span></div> : null}
        {preview ? <img className="pear-envelope-front-layer" src="/pear-play/envelope-open-original.webp" alt="" aria-hidden="true" /> : null}
      </>}
    </div>
    <div className="pear-envelope-copy">
      <span className="pear-case-label">{accepted ? 'CASE FILE ACCEPTED' : status === 'uploading' ? 'SEALING EVIDENCE' : 'THE RIENZI AGENCY'}</span>
      <h2>{accepted ? '사진이 사건 파일로 접수되었습니다.' : status === 'uploading' ? '봉인을 확인하는 중입니다.' : preview ? '이 장면을 사건 봉투에 넣을까요?' : '당신의 일상을 사건으로 보내주세요.'}</h2>
      <p>{accepted ? '조수가 조사실의 사건 보드에 자료를 등록했습니다.' : status === 'uploading' ? '사진을 안전하게 사건 보관함으로 보내고 있습니다.' : '사진 한 장이면 충분합니다. 사소한 장면일수록 단서가 많습니다.'}</p>
      {status === 'uploading' ? <div className="pear-upload-progress" role="status" aria-live="polite"><span>{progress === null ? '사진을 준비하고 있어요' : progress < 100 ? `사진 전송 중 ${progress}%` : '전송 완료 · 사건 파일에 기록 중'}</span><div className={`pear-upload-progress-track ${progress === null ? 'is-indeterminate' : ''}`} role="progressbar" aria-label="사진 업로드 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === null ? undefined : progress}><i style={progress === null ? undefined : { transform: `scaleX(${progress / 100})` }} /></div><small>이 화면을 닫지 말고 잠시 기다려 주세요.</small></div> : null}
    </div>
  </section>;
}

function InvestigationScreen({ preview, title = '토끼 탐정이 사진을 접수했습니다.', investigationStep, investigationClue }) {
  const [label, line, detail] = DETECTIVE_CINEMATIC_STEPS[investigationStep] || DETECTIVE_CINEMATIC_STEPS.observing;
  return <section className="pear-investigation-mobile" aria-live="polite"><img className="pear-investigation-detective" src="/pear-play/detective-p-envelope.webp" alt="사건 봉투를 들고 살펴보는 탐정 P" /><span className="pear-case-label">{label}</span><h1>{title}</h1>{preview ? <img className="pear-investigation-photo" src={preview} alt="조사 중인 사진" /> : null}<p>{line}<br />{investigationStep === 'verifying' && investigationClue ? `발견한 단서: ${investigationClue}` : detail}</p></section>;
}

function PearPlayResultView({ participant, pairing, isShared = false }) {
  return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">CASE SOLVED</span><h1>토끼 탐정이<br />한 작품을 찾았어요.</h1><p>정답이라기보다, 사진을 다시 바라보는 하나의 연결입니다.</p></div><SalonAvatar avatar={participant?.avatar} compact /></header><section className="pear-result-pair"><figure><img src={pairing.photoUrl} alt="조사된 사진" /><figcaption>{isShared ? 'LIVE CASE' : 'YOUR FRAME'}</figcaption></figure><strong>×</strong><PairArtwork pairing={pairing} /></section><section className="pear-what-we-saw"><header><span>WHAT WE SAW</span><h2>토끼 탐정이 발견한 단서</h2></header><div className="pear-evidence-grid"><EvidenceBlock title="OBJECT" values={pairing.analysis?.objects} /><EvidenceBlock title="COLOR" values={pairing.analysis?.colors} /><EvidenceBlock title="COMPOSITION" values={pairing.analysis?.composition} /><EvidenceBlock title="MOOD" values={[pairing.analysis?.mood]} /><EvidenceBlock title="CONTEXT" values={pairing.analysis?.context} /><EvidenceBlock title="CONCEPT" values={pairing.analysis?.concept} /></div></section><section className="pear-connection"><span>WHY THIS PAIR?</span><p>{pairing.connection || '두 이미지 사이의 연결을 정리하고 있어요.'}</p><strong>{pairing.statement}</strong><div>{tags(pairing.keywords)}</div></section></main>;
}

function SharedPearPlayView({ participant, pairing, phase, investigationStep, investigationClue, isMine }) {
  if (phase === 'investigating') return <main className="pear-participant-view pear-shared-case"><InvestigationScreen preview={pairing.photoUrl} title={`${participant.nickname || '참여자'}의 사진을 조사 중이에요.`} investigationStep={investigationStep} investigationClue={investigationClue} /></main>;
  return <main className="pear-participant-view pear-shared-case"><header className="pear-participant-header"><div><span className="pear-case-label">LIVE CASE · {phase === 'found' ? 'ARTWORK FOUND' : 'PHOTO SELECTED'}</span><h1>{isMine ? '내 사진이' : `${participant.nickname || '참여자'}의 사진이`}<br />조사실에 도착했어요.</h1><p>{phase === 'found' ? '탐정 P가 작품 후보를 찾았습니다. 곧 모두의 화면에서 결과를 확인합니다.' : '호스트가 고른 장면을 함께 바라보며 사건의 단서를 모으고 있습니다.'}</p></div><SalonAvatar avatar={participant.avatar} compact /></header><section className="pear-shared-evidence"><figure><img src={pairing.photoUrl} alt={`${participant.nickname || '참여자'}의 사건 사진`} /><figcaption>CASE FILE · {participant.nickname || 'ANONYMOUS'}</figcaption></figure><div><span className="pear-case-label">THE RIENZI AGENCY</span><h2>{phase === 'found' ? '작품의 흔적을 찾았습니다.' : '사진이 선택되었습니다.'}</h2><p>관리자가 다음 사건을 열면 이 화면도 함께 업데이트됩니다.</p></div></section></main>;
}

export function PearPlayParticipantView({ session, participants = [], participant, onSubmit, onEditAvatar }) {
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState('');
  const receiptTimer = useRef(null);
  const pairing = participant?.pearPairing;
  const stage = session?.stage || {};
  const selectedParticipant = participants.find((item) => item.participantId === stage.pearParticipantId) || null;
  const selectedPairing = selectedParticipant?.pearPairing;
  const hasSharedCase = stage.mode === 'pear-play' && stage.pearView === 'case' && Boolean(selectedPairing?.photoUrl);
  const waitingForHost = pairing?.photoUrl && pairing.status !== 'ready';

  useEffect(() => () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    if (receiptTimer.current) window.clearTimeout(receiptTimer.current);
  }, [preview]);

  const choosePhoto = (event) => {
    if (pairing?.photoUrl || busy) return;
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setError('');
    event.target.value = '';
  };

  const submit = async () => {
    if (pairing?.photoUrl) { setError('이미 접수된 사진은 변경할 수 없습니다.'); return; }
    if (!file) { setError('사건으로 조사할 사진 한 장을 골라 주세요.'); return; }
    setBusy(true);
    setUploadProgress(null);
    setError('');
    try {
      const prepared = await prepareParticipantPhoto(file);
      await onSubmit(prepared, setUploadProgress);
      setReceipt(true);
      receiptTimer.current = window.setTimeout(() => {
        if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
        setReceipt(false);
        setFile(null);
        setPreview('');
      }, 2200);
    } catch (reason) {
      setError(reason?.message || '사진을 접수하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <main className="pear-participant-view"><EnvelopeScene preview={preview} status="uploading" progress={uploadProgress} /></main>;

  if (receipt) return <main className="pear-participant-view"><EnvelopeScene preview={preview} status="accepted" /></main>;

  if (hasSharedCase) {
    if (selectedPairing.status === 'ready' && ['found', 'revealed', 'connection'].includes(stage.pearPhase)) return <PearPlayResultView participant={selectedParticipant} pairing={selectedPairing} isShared={selectedParticipant.participantId !== participant?.participantId} />;
    return <SharedPearPlayView participant={selectedParticipant} pairing={selectedPairing} phase={stage.pearPhase || 'photo'} investigationStep={stage.pearInvestigationStep} investigationClue={stage.pearInvestigationClue} isMine={selectedParticipant.participantId === participant?.participantId} />;
  }

  if (waitingForHost) return <main className="pear-participant-view"><section className="pear-participant-waiting"><div className="pear-detective-mark">R</div><span className="pear-case-label">PHOTO RECEIVED</span><h1>사진이 사건 보관함에<br />도착했어요.</h1><p>호스트가 한 장면을 고르면 토끼 탐정이 추리를 시작합니다.</p><div className="pear-waiting-photo"><img src={pairing.photoUrl} alt="접수된 사진" /></div><small>접수된 사진은 변경할 수 없습니다. 앞 화면에서 사건이 열릴 때 함께 조사해 주세요.</small>{onEditAvatar ? <button className="pear-avatar-edit-button" type="button" onClick={onEditAvatar}><SalonAvatar avatar={participant.avatar} compact /><span>내 캐릭터 수정</span></button> : null}</section></main>;

  if (pairing?.photoUrl) return <PearPlayResultView participant={participant} pairing={pairing} />;

  return <main className="pear-participant-view"><header className="pear-participant-header"><div><span className="pear-case-label">PEAR PLAY · PRIVATE CASE</span><h1>평범한 사진에<br />사건을 열어보세요.</h1><p>최근 좋아했거나 이상하게 마음에 남은 사진 한 장을 접수해 주세요.</p></div>{onEditAvatar ? <button className="pear-avatar-edit-button" type="button" onClick={onEditAvatar}><SalonAvatar avatar={participant.avatar} compact /><span>내 캐릭터 수정</span></button> : <strong>221B<br />RIENZI AGENCY</strong>}</header><section className="pear-upload-panel"><EnvelopeScene preview={preview} /><div className="pear-upload-actions"><button type="button" onClick={() => galleryInput.current?.click()}>갤러리에서 선택</button><button type="button" onClick={() => cameraInput.current?.click()}>지금 촬영</button></div><input ref={galleryInput} type="file" accept="image/*" onChange={choosePhoto} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choosePhoto} /><p className="pear-upload-note">사진은 호스트의 사건 보드에 도착한 뒤, 선택된 장면만 Detective P가 조사합니다. 접수 후에는 변경할 수 없습니다.</p><button className="pear-submit-button" type="button" disabled={!file} onClick={submit}>사진 접수하기</button>{error ? <p className="pear-error" role="alert">{error}</p> : null}</section></main>;
}

function phaseLabel(phase) {
  return {
    photo: 'PHOTO SELECTED',
    investigating: 'RABBIT DETECTIVE INVESTIGATING',
    found: 'ARTWORK FOUND · ON SCREEN',
    revealed: 'ARTWORK REVEALED',
    connection: 'WHY THIS PAIR?',
  }[phase] || 'PHOTO SELECTED';
}

function HostInvestigationView({ current, pairing, investigationStep, investigationClue }) {
  const [label, line, detail] = DETECTIVE_CINEMATIC_STEPS[investigationStep] || DETECTIVE_CINEMATIC_STEPS.observing;
  return <section className="pear-host-investigation-cinematic" aria-live="polite"><div className="pear-investigation-evidence"><div className="pear-selected-photo"><img src={pairing.photoUrl} alt={`${current.nickname || '익명'}이 접수한 사건 사진`} /></div></div><div className="pear-investigation-subtitles" key={`${pairing.photoUrl}:${investigationStep}`}><p>{label}</p><h2>{line}</h2><span>{investigationStep === 'verifying' && investigationClue ? `사진에서 발견한 단서: ${investigationClue}` : detail}</span></div></section>;
}

function HostFoundView({ pairing }) {
  const artwork = pairing?.finalArtwork;
  if (!artwork?.imageUrl) return <div className="pear-host-found"><span className="pear-case-label">ARTWORK FOUND</span><h2>작품을 찾았습니다.</h2><p>검증된 작품 이미지를 준비하고 있어요.</p></div>;
  const metadata = [artwork.artist, artwork.year].filter(Boolean).join(' · ');
  return <section className="pear-host-found-cinematic" aria-live="polite"><div className="pear-found-pair" aria-label="접수 사진과 찾은 작품 비교"><figure><div className="pear-found-image"><div className="pear-found-sheet"><img src={pairing.photoUrl} alt="참여자가 접수한 사진" /></div></div><figcaption>접수 사진</figcaption></figure><figure><div className="pear-found-image"><div className="pear-found-sheet"><img src={artwork.imageUrl} alt={`${artwork.artist || '작가 미상'}의 ${artwork.title || '작품'}`} /></div></div><figcaption>찾은 작품</figcaption></figure></div><div className="pear-investigation-subtitles pear-artwork-found-copy"><p>ARTWORK FOUND</p><h2>{artwork.title || '검증된 작품을 찾았습니다.'}</h2><span>{metadata || '작품 정보를 확인하고 있어요.'}</span></div></section>;
}

function BoardAssistant({ pinningId, pinningSide, pinningPhoto, pinningSlot }) {
  const scale = ({ 3: 1.3, 28: 1, 53: .84, 78: .6 })[pinningSlot?.y] || 1;
  const baseX = pinningSide === 'left' ? -5 : 80;
  const shift = (pinningSide === 'left' ? -4.2 + (scale - 1) * 11.3 : 15.4 - (scale - 1) * 10.6) + ((pinningSlot?.x ?? baseX) - baseX) * .49;
  return <div className={`pear-board-assistant ${pinningId ? `is-pinning is-${pinningSide}` : ''}`} key={pinningId || 'idle'} style={{ '--assistant-scale': scale, '--assistant-step': `${shift}vw` }} aria-hidden="true">
    <img className="pear-board-assistant-idle" src="/pear-play/assistant-idle.webp" alt="" />
    {pinningId ? <div className="pear-board-assistant-action"><img src={`/pear-play/assistant-pin-${pinningSide}.webp`} alt="" />{pinningPhoto ? <img className="pear-board-assistant-held-photo" src={pinningPhoto} alt="" /> : null}</div> : null}
  </div>;
}

function EvidenceWall({ participants = [], currentId = '', pinnedIds, pinningId }) {
  const visible = participants.filter((participant) => pinnedIds.has(participant.participantId) || pinningId === participant.participantId);
  if (!visible.length) return participants.length ? <div className="pear-evidence-wall" aria-label="참여자 사건 사진 보드" /> : <div className="pear-evidence-wall pear-evidence-wall-empty"><span>WAITING FOR EVIDENCE</span><p>첫 번째 사건 사진을 기다리는 중입니다.</p></div>;
  return <div className="pear-evidence-wall" aria-label="참여자 사건 사진 보드">
    {participants.map((participant, index) => {
      const slot = EVIDENCE_SLOTS[index % EVIDENCE_SLOTS.length];
      const active = participant.participantId === currentId;
      const evidenceId = participant.participantId || `evidence-${index}`;
      if (!visible.includes(participant)) return null;
      return <article className={`pear-evidence-note ${active ? 'is-active' : ''} ${pinningId === evidenceId ? 'is-pinning' : 'is-pinned'}`} key={evidenceId} style={{ '--evidence-x': `${slot.x}%`, '--evidence-y': `${slot.y}%`, '--evidence-rotate': `${slot.rotate}deg` }}>
        <div className="pear-evidence-content">
          <span className="pear-evidence-pin" aria-hidden="true" />
          {participant.pearPairing.finalArtwork?.imageUrl ? <div className="pear-evidence-pair"><img src={participant.pearPairing.photoUrl} alt={`${participant.nickname || '익명'}의 사건 사진`} /><img src={participant.pearPairing.finalArtwork.imageUrl} alt={`${participant.pearPairing.finalArtwork.title || '찾은 작품'}`} /></div> : <img className="pear-evidence-photo" src={participant.pearPairing.photoUrl} alt={`${participant.nickname || '익명'}의 사건 사진`} />}
          <footer><b>CASE {String(index + 1).padStart(2, '0')}</b><span>{participant.nickname || '익명'}</span></footer>
        </div>
      </article>;
    })}
  </div>;
}

function HostPairBoardView({ current, pairing, phase }) {
  const artwork = pairing.finalArtwork;
  const showConnection = phase === 'connection';
  const photoClues = [...(Array.isArray(pairing.analysis?.objects) ? pairing.analysis.objects : []),
    ...(Array.isArray(pairing.analysis?.colors) ? pairing.analysis.colors : [])].filter(Boolean).slice(0, 2);
  const artClues = (Array.isArray(pairing.keywords) ? pairing.keywords : []).filter(Boolean).slice(0, 2);

  return <section className={`pear-host-pair-board ${showConnection ? 'is-connecting' : ''}`} aria-label="접수 사진과 찾은 작품">
    <div className="pear-board-pair">
      <figure className="pear-board-photo"><div className="pear-board-image"><img src={pairing.photoUrl} alt={`${current.nickname || '참가자'}의 접수 사진`} /></div><figcaption><span>접수 사진</span><strong>{current.nickname || '익명'}</strong></figcaption></figure>
      <figure className="pear-board-artwork"><div className="pear-board-image">{artwork?.imageUrl ? <img src={artwork.imageUrl} alt={`${artwork.artist || '작가 미상'}의 ${artwork.title || '작품'}`} /> : <span>작품 이미지를 확인하고 있어요.</span>}</div><figcaption><span>찾은 작품</span><strong>{artwork?.title || '작품 정보 확인 중'}</strong><small>{[artwork?.artist, artwork?.year].filter(Boolean).join(' · ')}</small>{artwork?.dimensions || artwork?.materials ? <small>{[artwork.dimensions, artwork.materials].filter(Boolean).join(' · ')}</small> : null}</figcaption></figure>
    </div>
    {showConnection ? <div className="pear-board-map" aria-live="polite">
      <div className="pear-board-map-nodes">
        <div className="pear-board-map-thread" aria-hidden="true" />
        <div className="pear-board-map-clue"><span>사진의 단서</span><p>{photoClues.length ? photoClues.join(' · ') : '사진 속 장면과 분위기'}</p></div>
        <div className="pear-board-map-center"><span>발견한 연결</span><strong>{pairing.statement || '두 장면을 잇는 하나의 시선'}</strong></div>
        <div className="pear-board-map-clue"><span>작품의 단서</span><p>{artClues.length ? artClues.join(' · ') : artwork?.title || '찾은 작품'}</p></div>
      </div>
      <p className="pear-board-map-explanation"><span>연결 이유</span>{pairing.connection || '두 장면의 연결을 정리하고 있어요.'}</p>
    </div> : null}
  </section>;
}

function HostCaseState({ current, pairing, phase, showArtwork, investigationStep, investigationClue }) {
  if (showArtwork) return <HostPairBoardView current={current} pairing={pairing} phase={phase} />;
  if (phase === 'investigating') return <HostInvestigationView current={current} pairing={pairing} investigationStep={investigationStep} investigationClue={investigationClue} />;
  if (phase === 'found') return <HostFoundView pairing={pairing} />;
  return <section className="pear-host-state pear-host-state-photo"><span className="pear-case-label">SELECTED EVIDENCE</span><div className="pear-selected-photo"><img src={pairing.photoUrl} alt={`${current.nickname || '익명'}이 접수한 사건 사진`} /></div><div className="pear-selected-identity"><SalonAvatar avatar={current.avatar} label={current.nickname || '익명'} compact /></div><p>리모컨에서 추리를 시작하면 이 장면을 Detective P가 조사합니다.</p></section>;
}

export function PearPlayHostView({ session, participants = [], participantsLoading = false }) {
  const submitted = participants.filter((participant) => participant.pearPairing?.photoUrl);
  const submittedIds = submitted.map((participant) => participant.participantId).filter(Boolean);
  const submittedKey = submittedIds.join('|');
  const seenSessionId = useRef(session.id);
  const seenIds = useRef(participantsLoading ? null : new Set(submittedIds));
  const [pinnedIds, setPinnedIds] = useState(() => new Set(participantsLoading ? [] : submittedIds));
  const [pinQueue, setPinQueue] = useState([]);
  const [pinningId, setPinningId] = useState(null);

  useEffect(() => {
    if (participantsLoading) return;
    if (seenSessionId.current !== session.id) {
      seenSessionId.current = session.id;
      seenIds.current = new Set(submittedIds);
      setPinnedIds(new Set(submittedIds));
      setPinQueue([]);
      setPinningId(null);
      return;
    }
    if (!seenIds.current) {
      seenIds.current = new Set(submittedIds);
      setPinnedIds(new Set(submittedIds));
      return;
    }
    const arrivals = submittedIds.filter((id) => !seenIds.current.has(id));
    arrivals.forEach((id) => seenIds.current.add(id));
    if (arrivals.length) setPinQueue((queue) => [...queue, ...arrivals]);
  }, [participantsLoading, session.id, submittedKey]);

  useEffect(() => {
    if (pinningId || !pinQueue.length) return;
    setPinningId(pinQueue[0]);
    setPinQueue((queue) => queue.slice(1));
  }, [pinQueue, pinningId]);

  useEffect(() => {
    if (!pinningId) return undefined;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1700;
    const timer = window.setTimeout(() => {
      setPinnedIds((ids) => new Set(ids).add(pinningId));
      setPinningId(null);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [pinningId]);

  const pinningIndex = submitted.findIndex((participant) => participant.participantId === pinningId);
  const pinningSlot = EVIDENCE_SLOTS[pinningIndex % EVIDENCE_SLOTS.length];
  const pinningSide = pinningSlot?.x < 40 ? 'left' : 'right';
  const pinningPhoto = submitted[pinningIndex]?.pearPairing?.photoUrl;
  const view = session.stage?.pearView || 'case';
  const wallMode = view === 'wall' || view === 'board';
  const current = submitted.find((participant) => participant.participantId === session.stage?.pearParticipantId) || submitted[0];
  const pairing = current?.pearPairing;
  if (!current || !pairing) return <main className="pear-host pear-host-empty"><div className="pear-host-vignette" aria-hidden="true" /><EvidenceWall participants={submitted} pinnedIds={pinnedIds} pinningId={pinningId} /><BoardAssistant pinningId={pinningId} pinningSide={pinningSide} pinningPhoto={pinningPhoto} pinningSlot={pinningSlot} /><div className="pear-empty-copy"><span className="pear-case-label">THE RIENZI AGENCY · INTAKE</span><h1>다음 사건을<br />기다리고 있어요.</h1><p>참여자가 사진을 제출하면 조수가 사건 보드에 등록합니다.</p></div></main>;
  const phase = session.stage?.pearPhase || 'photo';
  const showArtwork = phase === 'revealed' || phase === 'connection';
  const detectiveBoardMode = !wallMode && ['photo', 'investigating', 'found', 'revealed', 'connection'].includes(phase);
  const sceneKey = wallMode ? 'wall' : `${phase}:${current.participantId}`;
  return <main className={`pear-host ${wallMode ? 'pear-host-wall' : detectiveBoardMode ? 'pear-host-selected' : `pear-host-case phase-${phase}`}`}><div className="pear-host-vignette" aria-hidden="true" /><div className="pear-scene-transition" key={sceneKey} aria-hidden="true" /><header><div><span className="pear-case-label">THE RIENZI AGENCY · {wallMode ? 'EVIDENCE WALL' : phaseLabel(phase)}</span><h1>{wallMode ? 'EVIDENCE WALL' : `${current.nickname || '익명'}의 사건`}</h1><p>{wallMode ? '접수된 사진이 사건 보드에 고정되어 있습니다.' : '조수가 현장 사진을 사건 보드에 정리했습니다.'}</p></div><strong>{wallMode ? `${submitted.length} CASES` : `CASE ${String(submitted.findIndex((participant) => participant.participantId === current.participantId) + 1).padStart(2, '0')}`}</strong></header><div className={`pear-evidence-wall-layer ${detectiveBoardMode ? 'is-hidden' : ''}`}><EvidenceWall participants={submitted} currentId={wallMode ? '' : current.participantId} pinnedIds={pinnedIds} pinningId={pinningId} /></div>{wallMode ? <BoardAssistant pinningId={pinningId} pinningSide={pinningSide} pinningPhoto={pinningPhoto} pinningSlot={pinningSlot} /> : null}{!wallMode ? <HostCaseState current={current} pairing={pairing} phase={phase} showArtwork={showArtwork} investigationStep={session.stage?.pearInvestigationStep} investigationClue={session.stage?.pearInvestigationClue} /> : null}</main>;
}

export function PearPlayRemotePanel({ session, participants = [], participantsLoading = false, participantsError = null, busy = false, run, onStartInvestigation }) {
  const submitted = useMemo(() => participants.filter((participant) => participant.pearPairing?.photoUrl), [participants]);
  const stage = session.stage || {};
  const updateStage = (patch) => realtime.updateSession(session.id, { currentQuestionId: null, stage: { ...stage, mode: 'pear-play', blackout: false, ...patch }, status: 'live' });
  const current = submitted.find((participant) => participant.participantId === stage.pearParticipantId) || submitted[0];
  const currentReady = current?.pearPairing?.status === 'ready';
  const caseOnScreen = stage.mode === 'pear-play' && stage.pearView !== 'wall' && stage.pearView !== 'board' && stage.pearParticipantId === current?.participantId;
  const phase = caseOnScreen ? stage.pearPhase || 'photo' : 'photo';
  const choose = (participant) => run(() => updateStage({ pearParticipantId: participant.participantId, pearView: 'case', pearPhase: 'photo' }), `${participant.nickname || '익명'}의 사진을 표시했습니다.`);
  const showPhoto = () => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'photo' }), '현장 사진을 표시했습니다.');
  const showArtwork = () => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'revealed' }), '찾은 작품을 공개했습니다.');
  const showConnection = () => run(() => updateStage({ pearParticipantId: current.participantId, pearView: 'case', pearPhase: 'connection' }), '사진과 작품의 연결 이유를 표시했습니다.');
  const showWall = () => run(() => updateStage({ pearView: 'wall', pearPhase: 'photo' }), '전체 코르크 보드를 표시했습니다.');
  const currentStatus = !caseOnScreen ? '관객 화면에서 선택 전' : phase === 'investigating' ? '추리 진행 중' : phase === 'found' ? '작품 발견 · 공개 대기' : phase === 'revealed' ? '찾은 작품 공개 중' : phase === 'connection' ? '연결 이유 표시 중' : '현장 사진 공개 중';

  return <section className="remote-assets pear-remote-panel" aria-label="PEAR PLAY 진행">
    <div className="pear-remote-heading"><div><h2>PEAR PLAY 진행</h2><span>{submitted.length}건 접수</span></div><button type="button" onClick={() => window.open(`${window.location.origin}/client/${encodeURIComponent(session.id)}`, '_blank', 'noopener,noreferrer')}>참가자 화면 보기</button></div>
    {current ? <div className="pear-current-case">
      <img className="pear-current-photo" src={current.pearPairing.photoUrl} alt={`${current.nickname || '익명'}의 접수 사진`} />
      <div className="pear-current-details"><span>현재 선택한 사진</span><strong>{current.nickname || '익명'}</strong><small>{currentStatus}</small></div>
      <SalonAvatar avatar={current.avatar} compact />
    </div> : null}
    {current ? <div className="pear-next-step">
      {stage.pearView === 'wall' || stage.pearView === 'board' || !caseOnScreen ? <button className="pear-primary-action" type="button" disabled={busy} onClick={showPhoto}>현장 사진 공개</button>
        : phase === 'investigating' ? <button className="pear-primary-action" type="button" disabled>탐정 P가 추리 중…</button>
          : phase === 'revealed' ? <button className="pear-primary-action" type="button" disabled={busy} onClick={showConnection}>연결 이유 보기</button>
            : phase === 'connection' ? <button className="pear-primary-action" type="button" disabled={busy} onClick={showWall}>전체 코르크 보드 보기</button>
              : currentReady ? <button className="pear-primary-action" type="button" disabled={busy} onClick={showArtwork}>찾은 작품 공개</button>
                : <button className="pear-primary-action" type="button" disabled={busy} onClick={() => run(() => onStartInvestigation(current), '작품 분석이 완료되었습니다.', '탐정 P가 사진과 작품을 조사 중…')}>{current.pearPairing.status === 'error' ? '추리 다시 시작' : '탐정 P의 추리 시작'}</button>}
      {caseOnScreen && phase !== 'photo' && phase !== 'investigating' ? <button className="pear-secondary-action" type="button" disabled={busy} onClick={showPhoto}>현장 사진 다시 보기</button> : null}
      {stage.pearView !== 'wall' && submitted.length > 1 ? <button className="pear-secondary-action" type="button" disabled={busy} onClick={showWall}>전체 코르크 보드</button> : null}
    </div> : null}
    <div className="pear-list-heading" id="pear-participant-list"><h3>접수된 사진</h3><span>{submitted.length}건</span></div>
    {participantsError ? <p className="pear-remote-empty is-error" role="alert">접수 목록을 불러올 수 없습니다. 상단의 다시 연결을 눌러 주세요.</p>
      : participantsLoading ? <p className="pear-remote-empty" role="status">접수 목록 확인 중…</p>
        : submitted.length ? <div className="pear-remote-people">{submitted.map((participant) => <button type="button" className={caseOnScreen && participant.participantId === current.participantId ? 'active' : ''} disabled={busy} key={participant.participantId} onClick={() => choose(participant)}><img className="pear-list-photo" src={participant.pearPairing.photoUrl} alt="" /><span><strong>{participant.nickname || '익명'}</strong><small>{participant.pearPairing.status === 'ready' ? '작품 분석 완료' : participant.pearPairing.status === 'error' ? '추리 실패 · 다시 시도 가능' : '사진 접수 완료'}</small></span><SalonAvatar avatar={participant.avatar} compact /></button>)}</div>
          : <p className="pear-remote-empty">아직 접수된 사진이 없습니다. 참가자가 업로드하면 이곳에 나타납니다.</p>}
  </section>;
}
