import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdfjs } from '../../lib/pdf';
import { safeJoin } from '../../lib/format';

export function PdfPageCanvas({ url, pageNumber, fitMode = 'fit', zoom = 1, compact = false }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [status, setStatus] = useState('loading');
  const [layoutVersion, setLayoutVersion] = useState(0);
  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    const task = pdfjs.getDocument(url);
    task.promise.then((document) => { if (active) { setStatus('loading'); setPdfDocument(document); } }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; task.destroy(); };
  }, [url]);
  useEffect(() => {
    if (!hostRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setLayoutVersion((value) => value + 1));
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdfDocument) return undefined;
    let active = true;
    let renderTask;
    pdfDocument.getPage(pageNumber).then((page) => {
      if (!active) return null;
      setStatus('loading');
      const host = hostRef.current;
      const canvas = canvasRef.current;
      const base = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(40, host.clientWidth - (compact ? 2 : 16));
      const availableHeight = Math.max(40, host.clientHeight - (compact ? 2 : 16));
      const fitted = fitMode === 'width' ? availableWidth / base.width : Math.min(availableWidth / base.width, availableHeight / base.height);
      const scale = Math.max(0.1, fitted * Math.min(2, Math.max(0.6, Number(zoom || 1))));
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({ canvas, viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0] });
      return renderTask.promise;
    }).then(() => { if (active) setStatus('ready'); }).catch((error) => { if (active && error?.name !== 'RenderingCancelledException') setStatus('error'); });
    return () => { active = false; renderTask?.cancel(); };
  }, [compact, fitMode, layoutVersion, pageNumber, pdfDocument, zoom]);
  return <div className={`salon-pdf-canvas ${status} ${compact ? 'compact' : ''}`} ref={hostRef}>{status === 'loading' && !compact ? <p>페이지 준비 중…</p> : null}{status === 'error' && !compact ? <p>PDF 페이지를 표시하지 못했습니다.</p> : null}<canvas ref={canvasRef} /></div>;
}

export function PdfHostView({ session, deck }) {
  const page = Math.max(1, Number(session.stage?.page || 1));
  if (!deck) return <main className="salon-pdf-stage missing"><h1>발표 자료를 준비하고 있습니다.</h1></main>;
  if (session.stage?.blackout) return <main className="salon-blackout"><p>화면이 잠시 쉬고 있습니다.</p></main>;
  return <main className="salon-pdf-stage"><header><div><p className="eyebrow">OFFLINE SALON · PRESENTING</p><h1>{deck.title}</h1></div><span>{session.title}</span></header><PdfPageCanvas url={deck.fileUrl} pageNumber={page} fitMode={session.stage?.fitMode} zoom={session.stage?.zoom} /><footer><b>{String(page).padStart(2, '0')} / {String(deck.pageCount).padStart(2, '0')}</b><i><span style={{ width: `${(page / deck.pageCount) * 100}%` }} /></i><span>PDF PRESENTATION</span></footer></main>;
}

export function PdfParticipantView({ deck, page }) {
  return <main className="media-participant pdf-companion"><div className="media-participant-icon">▣</div><p className="eyebrow">NOW PRESENTING</p><h1>{deck?.title || '발표가 진행 중입니다.'}</h1><p>진행자가 앞 화면에서 자료를 설명하고 있어요.<br />화면을 함께 바라봐 주세요.</p>{deck ? <div className="companion-card"><img src={deck.thumbnailUrl} alt="발표 자료 표지" /><strong>{page}<small> / {deck.pageCount} PAGE</small></strong></div> : null}</main>;
}

export function ArtworkHostView({ session, artwork, responses }) {
  const phase = session.stage?.phase || 'collect';
  const sorted = useMemo(() => [...responses].sort((a, b) => (b.likes || 0) - (a.likes || 0)), [responses]);
  if (!artwork) return <main className="artwork-host-stage missing"><h1>작품을 준비하고 있습니다.</h1></main>;
  if (phase === 'collect') return <main className="artwork-host-stage collecting"><header><p className="eyebrow">ARTWORK TITLE LAB</p><span>제목 수집 중 · {responses.length}</span></header><div className="artwork-focus"><img src={artwork.imageUrl} alt="제목을 추측할 작품" /></div><div className="mystery-labels">{responses.slice(0, 14).map((response) => <i key={response.id}><b /><b /><b /></i>)}</div><footer>앞 화면의 작품을 보고 모바일에서 나만의 제목을 지어보세요.</footer></main>;
  const reveal = session.stage?.reveal || {};
  return <main className={`artwork-host-stage trophies ${phase === 'reveal' ? 'revealed' : ''}`}><header><p className="eyebrow">{phase === 'reveal' ? 'ARTWORK REVEAL' : 'TITLE VOTE'}</p><span>{responses.length} TITLES</span></header><div className="artwork-mini"><img src={artwork.imageUrl} alt="작품" />{phase === 'reveal' ? <div><strong>{reveal.title || '제목 미정'}</strong><span>{reveal.artist || '작가 미정'}</span></div> : null}</div><section className="title-trophy-board">{sorted.map((response, index) => { const likes = Number(response.likes || 0); return <article key={response.id} style={{ '--title-scale': Math.min(1.32, 1 + likes * 0.055), '--gold': Math.min(1, likes / 6) }} className={index === 0 && likes ? 'winner' : ''}><span>{index === 0 && likes ? '★' : '◇'}</span><h2>{safeJoin(response.value)}</h2><b>♥ {likes}</b></article>; })}</section></main>;
}

export function ArtworkParticipantView({ artwork, phase, responses, myResponse, onSubmit, onLike, participantId }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => { event.preventDefault(); if (!text.trim()) return; setBusy(true); try { await onSubmit(text.trim()); setText(''); } catch (reason) { setError(reason.message); } finally { setBusy(false); } };
  if (!artwork) return <main className="media-participant"><h1>다음 작품을 준비하고 있어요.</h1></main>;
  if (phase === 'collect') return <main className="media-participant artwork-companion"><p className="eyebrow">LOOK · IMAGINE · NAME IT</p><h1>이 작품에 제목을<br />붙인다면?</h1><img className="participant-artwork" src={artwork.imageUrl} alt="제목을 붙일 작품" />{myResponse ? <div className="submitted-title"><span>✓ 제출 완료</span><h2>“{safeJoin(myResponse.value)}”</h2><p>진행자가 투표를 열면 다른 제목들을 볼 수 있어요.</p></div> : <form onSubmit={submit}><label>나만의 작품명<input value={text} onChange={(event) => setText(event.target.value)} maxLength={60} placeholder="예: 파란 오후의 대화" /></label>{error ? <p className="error-text">{error}</p> : null}<button className="client-primary-button" disabled={busy || !text.trim()}>{busy ? '제출 중…' : '이 제목으로 제출'}</button></form>}</main>;
  const sorted = [...responses].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  return <main className="media-participant artwork-voting"><p className="eyebrow">{phase === 'reveal' ? 'ARTWORK REVEAL' : 'VOTE FOR A TITLE'}</p><h1>{phase === 'reveal' ? '작품 정보가 공개되었습니다.' : '마음에 드는 제목을 골라보세요.'}</h1>{phase === 'reveal' ? <p>앞 화면에서 실제 작품 정보를 확인해 주세요.</p> : null}<div className="mobile-title-list">{sorted.map((response) => <button key={response.id} disabled={phase !== 'vote' || response.participantId === participantId} onClick={() => onLike(response)}><span>{safeJoin(response.value)}</span><b>♥ {response.likes || 0}</b></button>)}</div></main>;
}
