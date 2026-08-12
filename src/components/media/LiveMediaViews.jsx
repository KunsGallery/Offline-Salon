import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdfDocumentOptions, pdfjs } from '../../lib/pdf';
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
    setPdfDocument(null);
    setStatus('loading');
    const task = pdfjs.getDocument(pdfDocumentOptions({
      url,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
    }));
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
  return <main className="media-participant pdf-companion">
    <div className="pdf-companion-mark" aria-hidden="true"><span>▣</span><i /></div>
    <header className="pdf-companion-copy">
      <p className="eyebrow">NOW PRESENTING</p>
      <h1>{deck?.title || '발표가 진행 중입니다.'}</h1>
      <p>진행자가 앞 화면에서 자료를 설명하고 있어요. 휴대폰은 잠시 내려두고 화면을 함께 바라봐 주세요.</p>
    </header>
    {deck ? <section className="pdf-companion-card">
      <div className="pdf-companion-cover"><img src={deck.thumbnailUrl} alt="발표 자료 표지" /><span>LIVE</span></div>
      <div className="pdf-companion-page"><span>CURRENT PAGE</span><strong>{page}</strong><small>OF {deck.pageCount}</small></div>
    </section> : null}
    <footer className="pdf-companion-footer"><i /><span>앞 화면과 실시간으로 연결되어 있습니다.</span><i /></footer>
  </main>;
}

export function ArtworkHostView({ session, artwork, responses }) {
  const phase = session.stage?.phase || 'collect';
  const sorted = useMemo(() => [...responses].sort((a, b) => (b.likes || 0) - (a.likes || 0)), [responses]);
  if (!artwork) return <main className="artwork-host-stage missing"><h1>작품을 준비하고 있습니다.</h1></main>;
  if (phase === 'collect') return <main className="artwork-host-stage collecting"><header><p className="eyebrow">ARTWORK TITLE LAB</p><span>제목 수집 중 · {responses.length}</span></header><div className="artwork-focus"><img src={artwork.imageUrl} alt="제목을 추측할 작품" /></div><div className="mystery-labels">{responses.slice(0, 14).map((response) => <i key={response.id}><b /><b /><b /></i>)}</div><footer>앞 화면의 작품을 보고 모바일에서 나만의 제목을 지어보세요.</footer></main>;
  const reveal = session.stage?.reveal || {};
  return <main className={`artwork-host-stage trophies ${phase === 'reveal' ? 'revealed' : ''}`}><header><p className="eyebrow">{phase === 'reveal' ? 'SELECTED TITLE' : 'TITLE VOTE'}</p><span>{responses.length} TITLES</span></header><div className="artwork-mini"><img src={artwork.imageUrl} alt="작품" />{phase === 'reveal' ? <div><strong>{artwork.adoptedTitle || reveal.title || '채택 제목을 기다리고 있습니다.'}</strong><span>{artwork.adoptedTitle ? '참여자들이 함께 만든 작품명' : reveal.artist || '작가 미정'}</span></div> : null}</div><section className="title-trophy-board">{sorted.map((response, index) => { const likes = Number(response.likes || 0); const adopted = artwork.adoptedResponseId === response.id; return <article key={response.id} style={{ '--title-scale': Math.min(1.32, 1 + likes * 0.055), '--gold': adopted ? 1 : Math.min(1, likes / 6) }} className={`${index === 0 && likes ? 'winner' : ''} ${adopted ? 'adopted' : ''}`}><span>{adopted ? '✓' : index === 0 && likes ? '★' : '◇'}</span><h2>{safeJoin(response.value)}</h2><b>{adopted ? '채택' : `♥ ${likes}`}</b></article>; })}</section></main>;
}

export function ArtworkGalleryHostView({ session }) {
  const artworks = session.artworks || [];
  return <main className="artwork-gallery-stage"><header><div><h1>우리가 이름 붙인 작품들</h1><p>오늘 이 자리에서 발견된 시선과 언어를 한곳에 모았습니다.</p></div><strong>{artworks.filter((item) => item.adoptedTitle).length}<span> / {artworks.length}</span></strong></header>{artworks.length ? <section className="artwork-gallery-grid">{artworks.map((artwork, index) => <figure className={artwork.adoptedTitle ? '' : 'pending'} key={artwork.id}><div><img src={artwork.imageUrl} alt={artwork.adoptedTitle || `작품 ${index + 1}`} /><span>{String(index + 1).padStart(2, '0')}</span></div><figcaption><h2>{artwork.adoptedTitle || '제목 채택 대기'}</h2><p>{artwork.adoptedTitle ? '참여자들이 함께 지은 제목' : '이 작품의 최종 제목을 선택해 주세요.'}</p></figcaption></figure>)}</section> : <section className="artwork-gallery-empty"><h2>등록된 작품이 없습니다.</h2><p>작품을 등록하고 제목 활동을 시작해 주세요.</p></section>}</main>;
}

export function ArtworkGalleryParticipantView({ session }) {
  const artworks = session.artworks || [];
  return <main className="media-participant mobile-gallery"><h1>우리의 작은 전시가 완성됐어요.</h1><p>앞 화면에서 작품과 새로 지어진 제목을 함께 감상해 주세요.</p><div>{artworks.map((artwork, index) => <figure key={artwork.id}><img src={artwork.imageUrl} alt={artwork.adoptedTitle || `작품 ${index + 1}`} /><figcaption>{artwork.adoptedTitle || '제목 채택 대기'}</figcaption></figure>)}</div></main>;
}

export function ArtworkParticipantView({ artwork, phase, responses, myResponse, onSubmit, onLike, participantId }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => { event.preventDefault(); if (!text.trim()) return; setBusy(true); try { await onSubmit(text.trim()); setText(''); } catch (reason) { setError(reason.message); } finally { setBusy(false); } };
  if (!artwork) return <main className="media-participant"><h1>다음 작품을 준비하고 있어요.</h1></main>;
  if (phase === 'collect') return <main className="media-participant artwork-companion"><p className="eyebrow">LOOK · IMAGINE · NAME IT</p><h1>이 작품에 제목을<br />붙인다면?</h1><img className="participant-artwork" src={artwork.imageUrl} alt="제목을 붙일 작품" />{myResponse ? <div className="submitted-title"><span>✓ 제출 완료</span><h2>“{safeJoin(myResponse.value)}”</h2><p>진행자가 투표를 열면 다른 제목들을 볼 수 있어요.</p></div> : <form onSubmit={submit}><label>나만의 작품명<input value={text} onChange={(event) => setText(event.target.value)} maxLength={60} placeholder="예: 파란 오후의 대화" /></label>{error ? <p className="error-text">{error}</p> : null}<button className="client-primary-button" disabled={busy || !text.trim()}>{busy ? '제출 중…' : '이 제목으로 제출'}</button></form>}</main>;
  const sorted = [...responses].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  return <main className="media-participant artwork-voting"><p className="eyebrow">{phase === 'reveal' ? 'SELECTED TITLE' : 'VOTE FOR A TITLE'}</p><h1>{phase === 'reveal' ? artwork.adoptedTitle ? `“${artwork.adoptedTitle}”` : '진행자가 제목을 고르고 있어요.' : '마음에 드는 제목을 골라보세요.'}</h1>{phase === 'reveal' ? <p>{artwork.adoptedTitle ? '이 작품의 새로운 이름으로 채택되었습니다.' : '잠시 후 채택된 제목이 앞 화면에 공개됩니다.'}</p> : <p className="vote-guide">내가 낸 제목에는 투표할 수 없어요. 다른 참여자의 제목을 골라주세요.</p>}<div className="mobile-title-list">{sorted.map((response) => { const isOwn = response.participantId === participantId; const adopted = artwork.adoptedResponseId === response.id; return <button className={`${isOwn ? 'own-title' : ''} ${adopted ? 'adopted-title' : ''}`} key={response.id} disabled={phase !== 'vote' || isOwn} onClick={() => onLike(response)}><span>{safeJoin(response.value)}{isOwn ? <small>내 제목 · 본인 투표 불가</small> : null}{adopted ? <small>최종 채택</small> : null}</span><b>{adopted ? '✓' : `♥ ${response.likes || 0}`}</b></button>; })}</div></main>;
}
