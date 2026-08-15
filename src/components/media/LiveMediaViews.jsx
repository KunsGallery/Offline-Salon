import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdfDocumentOptions, pdfjs } from '../../lib/pdf';
import { clampPdfZoom, PDF_ZOOM_PRESETS } from '../../lib/pdfView';
import { safeJoin } from '../../lib/format';
import { buildResultGallery } from '../../lib/resultGallery';
import SalonAvatar from '../participants/SalonAvatar';

export function PdfPageCanvas({ url, pageNumber, fitMode = 'fit', zoom = 1, compact = false }) {
  const hostRef = useRef(null);
  const firstCanvasRef = useRef(null);
  const secondCanvasRef = useRef(null);
  const activeCanvasRef = useRef(-1);
  const previousPageRef = useRef(pageNumber);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [status, setStatus] = useState('loading');
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [activeCanvas, setActiveCanvas] = useState(-1);
  const [direction, setDirection] = useState('forward');
  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    setPdfDocument(null);
    setStatus('loading');
    setActiveCanvas(-1);
    activeCanvasRef.current = -1;
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
      const nextCanvasIndex = activeCanvasRef.current === 0 ? 1 : 0;
      const canvas = nextCanvasIndex === 0 ? firstCanvasRef.current : secondCanvasRef.current;
      const base = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(40, host.clientWidth - (compact ? 2 : 16));
      const availableHeight = Math.max(40, host.clientHeight - (compact ? 2 : 16));
      const fitted = fitMode === 'width' ? availableWidth / base.width : Math.min(availableWidth / base.width, availableHeight / base.height);
      const scale = Math.max(0.1, fitted * clampPdfZoom(zoom));
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({ canvas, viewport, background: 'rgba(0,0,0,0)', transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0] });
      return renderTask.promise.then(() => nextCanvasIndex);
    }).then((nextCanvasIndex) => {
      if (!active || nextCanvasIndex === null) return;
      setDirection(pageNumber >= previousPageRef.current ? 'forward' : 'backward');
      previousPageRef.current = pageNumber;
      activeCanvasRef.current = nextCanvasIndex;
      setActiveCanvas(nextCanvasIndex);
      setStatus('ready');
    }).catch((error) => { if (active && error?.name !== 'RenderingCancelledException') setStatus('error'); });
    return () => { active = false; renderTask?.cancel(); };
  }, [compact, fitMode, layoutVersion, pageNumber, pdfDocument, zoom]);
  return <div className={`salon-pdf-canvas ${status} ${compact ? 'compact' : ''}`} data-direction={direction} ref={hostRef}>{status === 'loading' && activeCanvas < 0 && !compact ? <p>페이지 준비 중…</p> : null}{status === 'error' && !compact ? <p>PDF 페이지를 표시하지 못했습니다.</p> : null}<canvas className={activeCanvas === 0 ? 'active' : ''} ref={firstCanvasRef} /><canvas className={activeCanvas === 1 ? 'active' : ''} ref={secondCanvasRef} /></div>;
}

export function PdfZoomSelect({ value = 1, onChange, className = '' }) {
  const normalized = clampPdfZoom(value);
  const presets = PDF_ZOOM_PRESETS.includes(normalized) ? PDF_ZOOM_PRESETS : [...PDF_ZOOM_PRESETS, normalized].sort((a, b) => a - b);
  return <label className={`pdf-zoom-select ${className}`.trim()}><span>배율</span><select aria-label="PDF 확대 배율" value={normalized} onChange={(event) => onChange(Number(event.target.value))}>{presets.map((preset) => <option key={preset} value={preset}>{Math.round(preset * 100)}%</option>)}</select></label>;
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

export function ImageHostView({ session, image }) {
  if (!image) return <main className="salon-image-stage missing"><h1>이미지를 준비하고 있습니다.</h1></main>;
  return <main className="salon-image-stage"><header><p className="eyebrow">OFFLINE SALON · IMAGE</p><span>{session.title}</span></header><figure><img src={image.imageUrl} alt={image.displayTitle || '세션 이미지'} />{image.displayTitle ? <figcaption>{image.displayTitle}</figcaption> : null}</figure></main>;
}

export function ImageParticipantView({ image }) {
  return <main className="media-participant image-companion"><p className="eyebrow">NOW ON SCREEN</p><h1>{image?.displayTitle || '이미지를 함께 보고 있어요.'}</h1><p>휴대폰은 잠시 내려두고 앞 화면의 이미지에 집중해 주세요.</p>{image?.imageUrl ? <img src={image.imageUrl} alt={image.displayTitle || '현재 이미지'} /> : null}</main>;
}

export function ArtworkHostView({ session, artwork, responses }) {
  const phase = session.stage?.phase || 'collect';
  const sorted = useMemo(() => [...responses].sort((a, b) => (b.likes || 0) - (a.likes || 0)), [responses]);
  if (!artwork) return <main className="artwork-host-stage missing"><h1>작품을 준비하고 있습니다.</h1></main>;
  if (phase === 'collect') return <main className="artwork-host-stage collecting"><header><p className="eyebrow">ARTWORK TITLE LAB</p><span>제목 수집 중 · {responses.length}</span></header><div className="artwork-focus"><img src={artwork.imageUrl} alt="제목을 추측할 작품" /></div><div className="mystery-labels">{responses.slice(0, 14).map((response) => <i key={response.id}><b /><b /><b /></i>)}</div><footer>앞 화면의 작품을 보고 모바일에서 나만의 제목을 지어보세요.</footer></main>;
  const reveal = session.stage?.reveal || {};
  return <main className={`artwork-host-stage trophies ${phase === 'reveal' ? 'revealed' : ''}`}><header><p className="eyebrow">{phase === 'reveal' ? 'SELECTED TITLE' : 'TITLE VOTE'}</p><span>{responses.length} TITLES</span></header><div className="artwork-mini"><img src={artwork.imageUrl} alt="작품" />{phase === 'reveal' ? <div><strong>{artwork.adoptedTitle || reveal.title || '채택 제목을 기다리고 있습니다.'}</strong><span>{artwork.adoptedTitle ? '참여자들이 함께 만든 작품명' : reveal.artist || '작가 미정'}</span></div> : null}</div><section className="title-trophy-board">{sorted.map((response, index) => { const likes = Number(response.likes || 0); const adopted = artwork.adoptedResponseId === response.id; return <article key={response.id} style={{ '--title-scale': Math.min(1.32, 1 + likes * 0.055), '--gold': adopted ? 1 : Math.min(1, likes / 6) }} className={`${index === 0 && likes ? 'winner' : ''} ${adopted ? 'adopted' : ''}`}><span>{adopted ? '✓' : index === 0 && likes ? '★' : '◇'}</span><h2>{safeJoin(response.value)}</h2><b>{adopted ? '채택' : `♥ ${likes}`}</b></article>; })}</section></main>;
}

export function ResultGalleryHostView({ session, questions = [], responses = [], participants = [] }) {
  const { galleryQuestions, participantResults, mediaItems, resultCount } = buildResultGallery(session, questions, responses, participants);
  const galleryRef = useRef(null);
  const scrollPosition = Math.max(1, Number(session.stage?.page || 1));
  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    const top = Math.min(gallery.scrollHeight - gallery.clientHeight, (scrollPosition - 1) * gallery.clientHeight * 0.72);
    gallery.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [scrollPosition, participantResults.length, mediaItems.length]);
  const isLegacyArtworkGallery = galleryQuestions.length === 0 && mediaItems.some((item) => item.adoptedTitle);
  if (isLegacyArtworkGallery) return <main className="artwork-gallery-stage"><header><h1>서로의 시선이 머문 자리</h1></header><section className="artwork-gallery-grid" ref={galleryRef}>{mediaItems.map((artwork, index) => <figure className={artwork.adoptedTitle ? '' : 'pending'} key={artwork.id}><div><img src={artwork.imageUrl} alt={artwork.adoptedTitle || `작품 ${index + 1}`} /><span>{String(index + 1).padStart(2, '0')}</span></div><figcaption><h2>{artwork.adoptedTitle || '제목 채택 대기'}</h2><p>{artwork.adoptedTitle ? '참여자들이 함께 지은 제목' : '이 작품의 최종 제목을 선택해 주세요.'}</p></figcaption></figure>)}</section></main>;
  const hasResults = participantResults.length || mediaItems.length;
  return <main className="result-gallery-stage"><header><div><p className="eyebrow">OFFLINE SALON · COLLECTIVE ARCHIVE</p><h1>우리가 함께 만든 결과</h1></div><span>{participantResults.length} PEOPLE · {resultCount} RESULTS</span></header>{hasResults ? <section className="result-gallery-scroll" ref={galleryRef}>{participantResults.length ? <section className="participant-result-grid" aria-label="참여자별 결과">{participantResults.map((group, index) => <article className="participant-result-card" key={group.participantId || `${group.nickname}:${index}`}><header><SalonAvatar avatar={group.avatar} compact /><div><span>{String(index + 1).padStart(2, '0')}</span><h2>{group.nickname}</h2></div>{group.likesEnabled ? <b>♥ {group.likes}</b> : null}</header><div>{group.results.map((result) => <article className="participant-result-entry" key={result.id}><span>{result.questionTitle}</span><p>{result.displayValue}</p>{result.likesEnabled ? <b>♥ {result.likes || 0}</b> : null}</article>)}</div></article>)}</section> : null}{mediaItems.length ? <section className="result-media-section"><header><span>SESSION MATERIALS</span><h2>함께 본 이미지</h2></header><div className="result-media-grid">{mediaItems.map((item, index) => <figure key={item.id}><div><img src={item.imageUrl} alt={item.displayTitle} /><span>{String(index + 1).padStart(2, '0')}</span></div><figcaption>{item.displayTitle}</figcaption></figure>)}</div></section> : null}</section> : <section className="result-gallery-empty"><h2>아직 모인 결과가 없습니다.</h2><p>질문에서 ‘결과 갤러리에 포함’을 켜고 참여 결과를 받아보세요.</p></section>}</main>;
}

export function ResultGalleryParticipantView({ session, questions = [], responses = [], participants = [], participantId = '', onLike = null, likingResponseId = null }) {
  const { galleryQuestions, participantResults, mediaItems, resultCount } = buildResultGallery(session, questions, responses, participants);
  const isLegacyArtworkGallery = galleryQuestions.length === 0 && mediaItems.some((item) => item.adoptedTitle);
  if (isLegacyArtworkGallery) return <main className="media-participant mobile-gallery"><h1>우리의 작은 전시가 완성됐어요.</h1><p>앞 화면에서 작품과 새로 지어진 제목을 함께 감상해 주세요.</p><div>{mediaItems.map((artwork, index) => <figure key={artwork.id}><img src={artwork.imageUrl} alt={artwork.adoptedTitle || `작품 ${index + 1}`} /><figcaption>{artwork.adoptedTitle || '제목 채택 대기'}</figcaption></figure>)}</div></main>;
  return <main className="media-participant mobile-result-gallery"><header><p className="eyebrow">OUR RESULTS</p><h1>오늘 우리가<br />함께 만든 것들</h1><p>{participantResults.length}명의 결과 {resultCount}개를 한곳에 모았습니다.</p></header><div className="mobile-result-groups">{participantResults.map((group) => <section className={group.participantId === participantId ? 'mine' : ''} key={group.participantId || group.nickname}><header><SalonAvatar avatar={group.avatar} compact /><div><h2>{group.nickname}</h2><span>{group.results.length}개의 결과</span></div></header>{group.results.map((result) => { const liked = Boolean(result.likedBy?.[participantId]); const canLike = result.likesEnabled && result.participantId !== participantId && onLike; return <article key={result.id}><span>{result.questionTitle}</span><p>{result.displayValue}</p>{result.likesEnabled ? <button type="button" className={liked ? 'liked' : ''} disabled={!canLike || likingResponseId === result.id} onClick={() => canLike && onLike(result)}>{result.participantId === participantId ? '내 결과' : `${liked ? '♥' : '♡'} ${result.likes || 0}`}</button> : null}</article>; })}</section>)}</div>{mediaItems.length ? <section className="mobile-result-media"><h2>함께 본 이미지</h2><div>{mediaItems.map((item) => <figure key={item.id}><img src={item.imageUrl} alt={item.displayTitle} /><figcaption>{item.displayTitle}</figcaption></figure>)}</div></section> : null}</main>;
}

export const ArtworkGalleryHostView = ResultGalleryHostView;
export const ArtworkGalleryParticipantView = ResultGalleryParticipantView;

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
