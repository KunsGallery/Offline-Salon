import React, { useEffect, useMemo, useState } from 'react';
import { buildBranding, extractPalette, sessionThemeStyle } from '../../lib/colorPalette';
import { createId } from '../../lib/ids';
import { getMediaStorageStatus, removeMedia, uploadMedia } from '../../lib/media';
import { inspectPdf } from '../../lib/pdf';
import { questionModePatch } from '../../lib/stage';
import { realtime } from '../../lib/realtime';
import { useArtworkSecrets } from '../../hooks/useArtworkSecrets';
import { PdfPageCanvas, PdfZoomSelect } from '../media/LiveMediaViews';
import { hasSessionModule } from '../../lib/sessionModules';
import { buildExhibitionNfcUrl, exhibitionNfcUrlBytes } from '../../lib/exhibitionNfc';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const emptyArtworkForm = { title: '', artist: '', description: '' };

function messageOf(reason) {
  return reason?.message || '요청을 처리하지 못했습니다.';
}

function moveId(items, id, direction) {
  const ids = items.map((item) => item.id);
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

function StorageStatus() {
  const [status, setStatus] = useState({ state: 'checking', label: 'R2 연결 확인 중…' });
  const check = async () => {
    setStatus({ state: 'checking', label: 'R2 연결 확인 중…' });
    try {
      const result = await getMediaStorageStatus();
      setStatus({ state: 'ready', label: result.provider === 'local-preview' ? '로컬 미리보기 저장소' : 'Cloudflare R2 연결됨' });
    } catch (reason) {
      setStatus({ state: 'error', label: messageOf(reason) });
    }
  };
  useEffect(() => { check(); }, []);
  return <div className={`storage-status ${status.state}`}><i /> <span>{status.label}</span>{status.state === 'error' ? <button type="button" onClick={check}>다시 확인</button> : null}</div>;
}

function PosterThemeEditor({ session }) {
  const [selection, setSelection] = useState(null);
  const [preview, setPreview] = useState(session.branding?.posterUrl || '');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setPreview(session.branding?.posterUrl || ''), [session.branding?.posterUrl]);
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const choose = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const palette = await extractPalette(file);
      const nextPreview = URL.createObjectURL(file);
      setSelection({ file, palette, theme: buildBranding(palette) });
      setPreview(nextPreview);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const save = async () => {
    if (!selection) return;
    setBusy(true); setError(''); setProgress(1);
    let uploaded = null;
    try {
      const id = createId('poster');
      const extension = selection.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      uploaded = await uploadMedia(session.id, 'poster', id, selection.file, `poster.${extension}`, { onProgress: setProgress });
      const previous = session.branding?.posterStoragePath;
      await realtime.updateSession(session.id, { branding: { ...session.branding, ...selection.theme, posterUrl: uploaded.url, posterStoragePath: uploaded.path } });
      if (previous && previous !== uploaded.path) await removeMedia(previous).catch(() => undefined);
      setSelection(null);
    } catch (reason) {
      await removeMedia(uploaded?.path).catch(() => undefined);
      setError(messageOf(reason));
    } finally {
      setBusy(false); setProgress(0);
    }
  };

  const palette = selection?.palette || session.branding?.palette || [session.branding?.primaryColor, session.branding?.secondaryColor, session.branding?.tertiaryColor].filter(Boolean);
  const previewStyle = sessionThemeStyle({ branding: { ...session.branding, ...(selection?.theme || {}) } });
  return <section className="media-editor-grid">
    <div className="stack gap-lg">
      <label className={`media-dropzone poster-zone ${preview ? 'has-preview' : ''}`}>
        {preview ? <img src={preview} alt="모임 포스터" /> : <><strong>포스터 선택</strong><span>JPG, PNG, WEBP · 12MB 미만</span></>}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={busy} />
      </label>
      <div className="palette-row"><span>대표 색상</span><div>{palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div></div>
      {progress ? <progress className="upload-progress" value={progress} max="100" /> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn primary" type="button" onClick={save} disabled={!selection || busy}>{busy ? progress ? `R2 업로드 ${progress}%` : '색상 분석 중…' : '포스터와 테마 적용'}</button>
    </div>
    <aside className="theme-live-preview" style={previewStyle}>
      <p className="eyebrow">THEME PREVIEW</p><h3>{session.title}</h3><p>추출된 색상이 버튼·배경·강조선에 이렇게 적용됩니다.</p>
      <div><button type="button">PRIMARY</button><span /><span /><span /></div>
    </aside>
  </section>;
}

function ArtworkStudio({ session, activeQuestion }) {
  const { secrets, error: secretError } = useArtworkSecrets(session.id);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState(emptyArtworkForm);
  const [editingId, setEditingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const artworks = useMemo(() => (session.artworks || []).map((item) => ({ ...item, ...(secrets[item.id] || {}) })), [secrets, session.artworks]);
  const activeId = session.stage?.mode === 'image' || session.stage?.mode === 'artwork' ? session.stage.artworkId : null;
  const legacyArtworkActive = session.stage?.mode === 'artwork';

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const choose = (event) => {
    const next = event.target.files?.[0] || null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(next ? URL.createObjectURL(next) : ''); setError('');
  };
  const resetForm = (formElement) => {
    setFile(null); setPreview(''); setForm(emptyArtworkForm); setEditingId(null); formElement?.reset();
  };
  const edit = (artwork) => {
    setEditingId(artwork.id); setForm({ title: artwork.displayTitle || artwork.title || '', artist: artwork.artist || '', description: artwork.description || '' }); setPreview(artwork.imageUrl); setFile(null);
  };
  const save = async (event) => {
    event.preventDefault();
    if (!editingId && !file) return;
    const formElement = event.currentTarget;
    setBusy(true); setError(''); setProgress(file ? 1 : 0);
    let uploaded = null;
    try {
      if (file && (!IMAGE_TYPES.includes(file.type) || file.size >= 12 * 1024 * 1024)) throw new Error('12MB 미만 JPG, PNG, WEBP 이미지만 등록할 수 있습니다.');
      const id = editingId || createId('artwork');
      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        uploaded = await uploadMedia(session.id, 'artworks', id, file, `original.${extension}`, { cacheControl: 'public,max-age=31536000,immutable', onProgress: setProgress });
      }
      if (editingId) {
        const previous = artworks.find((item) => item.id === editingId);
        await realtime.updateArtwork(session.id, editingId, { ...(uploaded ? { imageUrl: uploaded.url, storagePath: uploaded.path } : {}), displayTitle: form.title }, form);
        if (uploaded && previous?.storagePath && previous.storagePath !== uploaded.path) await removeMedia(previous.storagePath).catch(() => undefined);
      } else {
        await realtime.createArtwork(session.id, { id, imageUrl: uploaded.url, storagePath: uploaded.path, displayTitle: form.title, order: artworks.length }, form);
      }
      resetForm(formElement);
    } catch (reason) {
      await removeMedia(uploaded?.path).catch(() => undefined);
      setError(messageOf(reason));
    } finally { setBusy(false); setProgress(0); }
  };
  const start = async (artwork) => {
    setBusy(true); setError('');
    try {
      await Promise.resolve(realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'image', artworkId: artwork.id, page: 1, blackout: false }, showResults: false, status: 'live' }));
    } catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  };
  const setPhase = (phase) => {
    const secret = secrets[activeId] || {};
    return realtime.updateSession(session.id, { stage: { ...session.stage, phase, reveal: phase === 'reveal' ? { title: secret.title || '', artist: secret.artist || '', description: secret.description || '' } : null }, showResults: phase !== 'collect' });
  };
  const remove = async (artwork) => {
    if (!window.confirm(`“${artwork.displayTitle || artwork.title || '이 이미지'}”을 삭제할까요?`)) return;
    if (activeId === artwork.id) await realtime.updateSession(session.id, questionModePatch(session, activeQuestion));
    await realtime.deleteArtwork(session.id, artwork.id);
    const shared = artworks.some((item) => item.id !== artwork.id && item.storagePath === artwork.storagePath);
    if (!shared) await removeMedia(artwork.storagePath).catch(() => undefined);
  };
  const duplicate = async (artwork) => {
    const id = createId('artwork');
    const displayTitle = `${artwork.displayTitle || artwork.title || '이미지'} 복사본`;
    await realtime.createArtwork(session.id, { id, imageUrl: artwork.imageUrl, storagePath: artwork.storagePath, displayTitle, order: artworks.length }, { title: displayTitle, artist: artwork.artist || '', description: artwork.description || '' });
  };
  const reorder = (artwork, direction) => realtime.reorderArtworks(session.id, moveId(artworks, artwork.id, direction));
  const importFromSession = async () => {
    const sourceId = window.prompt('작품을 가져올 세션 ID를 입력하세요.');
    if (!sourceId?.trim() || sourceId.trim() === session.id) return;
    setBusy(true); setError(''); setProgress(1);
    const uploadedPaths = [];
    const importedIds = [];
    try {
      const library = await Promise.resolve(realtime.getSessionAssetLibrary(sourceId.trim()));
      if (!library.artworks.length) throw new Error('해당 세션에 가져올 작품이 없습니다.');
      if (!window.confirm(`${library.artworks.length}개 작품을 이 세션으로 복사할까요?`)) return;
      for (let index = 0; index < library.artworks.length; index += 1) {
        const source = library.artworks[index];
        const response = await fetch(source.imageUrl);
        if (!response.ok) throw new Error(`“${source.title || '작품'}” 이미지를 불러오지 못했습니다.`);
        const blob = await response.blob();
        const id = createId('artwork');
        const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const uploaded = await uploadMedia(session.id, 'artworks', id, blob, `original.${extension}`, { cacheControl: 'public,max-age=31536000,immutable', onProgress: (value) => setProgress(Math.round(((index + value / 100) / library.artworks.length) * 100)) });
        uploadedPaths.push(uploaded.path);
        await realtime.createArtwork(session.id, { id, imageUrl: uploaded.url, storagePath: uploaded.path, displayTitle: source.displayTitle || source.title || '', order: artworks.length + index }, { title: source.title || source.displayTitle || '', artist: source.artist || '', description: source.description || '' });
        importedIds.push(id);
      }
    } catch (reason) {
      await Promise.all(importedIds.map((id) => Promise.resolve(realtime.deleteArtwork(session.id, id)).catch(() => undefined)));
      await Promise.all(uploadedPaths.map((path) => removeMedia(path).catch(() => undefined)));
      setError(messageOf(reason));
    } finally { setBusy(false); setProgress(0); }
  };

  return <section className="stack gap-lg">
    {activeId ? <div className="active-media-controls"><strong>{legacyArtworkActive ? '지난 모임 작품 활동' : '현재 이미지 표시 중'}</strong>{legacyArtworkActive ? <><button className="btn" onClick={() => setPhase('collect')}>제목 받기</button><button className="btn primary" onClick={() => setPhase('vote')}>투표</button><button className="btn" onClick={() => setPhase('reveal')}>원제 참고</button></> : null}<button className="btn danger" onClick={() => realtime.updateSession(session.id, questionModePatch(session, activeQuestion))}>종료</button></div> : null}
    <div className="asset-library-toolbar"><div><strong>갤러리 이미지</strong><span>화면 표시와 결과 갤러리에 사용할 이미지를 관리합니다.</span></div><button className="btn" type="button" disabled={busy} onClick={importFromSession}>다른 세션에서 가져오기</button></div>
    <div className="asset-grid">{artworks.map((artwork, index) => <article className={`asset-card ${activeId === artwork.id ? 'active' : ''}`} key={artwork.id}>
      <img src={artwork.imageUrl} alt={artwork.displayTitle || artwork.title || '세션 이미지'} /><div><strong>{artwork.displayTitle || artwork.title || '이름 없는 이미지'}</strong><span>{artwork.description || artwork.artist || '설명 없음'}</span>
      <div className="asset-order"><button disabled={index === 0} onClick={() => reorder(artwork, -1)}>←</button><button disabled={index === artworks.length - 1} onClick={() => reorder(artwork, 1)}>→</button><button onClick={() => edit(artwork)}>수정</button><button onClick={() => duplicate(artwork)}>복제</button></div>
      <div className="row gap-sm"><button className="btn primary" onClick={() => start(artwork)} disabled={busy}>화면에 띄우기</button><button className="btn danger" onClick={() => remove(artwork)}>삭제</button></div></div>
    </article>)}</div>
    <form className="media-upload-form" onSubmit={save}>
      <label className={`media-dropzone ${preview ? 'has-preview' : ''}`}>{preview ? <img src={preview} alt="이미지 미리보기" /> : <><strong>갤러리 이미지 선택</strong><span>12MB 미만</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} /></label>
      <div className="stack gap-sm"><h3>{editingId ? '이미지 정보 수정' : '새 이미지 등록'}</h3><input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="이미지 이름 (필수)" /><input className="input" value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} placeholder="작성자·출처 (선택)" /><textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="이미지 설명" />{progress ? <progress className="upload-progress" value={progress} max="100" /> : null}{error || secretError ? <p className="error-text">{error || messageOf(secretError)}</p> : null}<div className="row gap-sm"><button className="btn primary" disabled={(!editingId && !file) || busy}>{busy ? progress ? `R2 업로드 ${progress}%` : '저장 중…' : editingId ? '수정 저장' : '이미지 등록'}</button>{editingId ? <button className="btn" type="button" onClick={(clickEvent) => resetForm(clickEvent.currentTarget.closest('form'))}>취소</button> : null}</div></div>
    </form>
  </section>;
}

function ExhibitionNfcStudio({ session }) {
  const [form, setForm] = useState({ title: '', venue: '' });
  const [editingId, setEditingId] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [error, setError] = useState('');
  const entries = session.exhibitionNfcEntries || [];
  const previewUrl = buildExhibitionNfcUrl(session.id, form, window.location.origin);
  const byteLength = exhibitionNfcUrlBytes(previewUrl);
  const genericUrl = buildExhibitionNfcUrl(session.id, {}, window.location.origin);

  const copy = async (value, id) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id); setError('');
      window.setTimeout(() => setCopiedId(''), 1600);
    } catch {
      window.prompt('아래 주소를 복사하세요.', value);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setError('전시 이름을 입력해 주세요.'); return; }
    const now = new Date().toISOString();
    const id = editingId || createId('nfc-exhibition');
    const previous = entries.find((entry) => entry.id === id);
    const nextEntry = { id, title, venue: form.venue.trim(), createdAt: previous?.createdAt || now, updatedAt: now };
    const nextEntries = editingId ? entries.map((entry) => entry.id === id ? nextEntry : entry) : [...entries, nextEntry];
    await realtime.updateSession(session.id, { exhibitionNfcEntries: nextEntries });
    setForm({ title: '', venue: '' }); setEditingId(''); setError('');
  };
  const edit = (entry) => { setForm({ title: entry.title, venue: entry.venue || '' }); setEditingId(entry.id); setError(''); };
  const remove = async (entry) => {
    if (!window.confirm(`“${entry.title}” NFC 정보를 삭제할까요? 이미 기록한 카드는 계속 작동합니다.`)) return;
    await realtime.updateSession(session.id, { exhibitionNfcEntries: entries.filter((item) => item.id !== entry.id) });
    if (editingId === entry.id) { setEditingId(''); setForm({ title: '', venue: '' }); }
  };

  return <section className="exhibition-nfc-studio">
    <header><div><h3>전시 정보를 카드 주소로 만들기</h3><p>전시명과 장소만 카드에 연결합니다. 태그한 참여자는 자기 휴대폰에서 사진과 만족도를 추가합니다.</p></div><button className="btn" type="button" onClick={() => copy(genericUrl, 'generic')}>{copiedId === 'generic' ? '복사됨' : '빈 등록 카드 주소'}</button></header>
    <div className="exhibition-nfc-workspace">
      <form onSubmit={save}><label className="field"><span>전시 이름</span><input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 마르크 샤갈 특별전" /></label><label className="field"><span>전시장·장소 <small>선택</small></span><input className="input" value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} placeholder="예: 예술의전당 한가람미술관" /></label><div className="nfc-url-preview"><span>카드에 기록할 URL</span><code>{previewUrl}</code><small className={byteLength > 140 ? 'warning' : ''}>약 {byteLength} bytes · {byteLength > 140 ? 'NTAG215 이상 권장' : 'NTAG213에도 기록 가능할 가능성이 높음'}</small></div>{error ? <p className="error-text">{error}</p> : null}<div className="row gap-sm"><button className="btn primary">{editingId ? '전시 정보 수정' : '전시 NFC 추가'}</button><button className="btn" type="button" disabled={!form.title.trim()} onClick={() => copy(previewUrl, 'preview')}>{copiedId === 'preview' ? '복사됨' : '주소 미리 복사'}</button>{editingId ? <button className="btn ghost" type="button" onClick={() => { setEditingId(''); setForm({ title: '', venue: '' }); }}>취소</button> : null}</div></form>
      <details className="nfc-writing-guide" open><summary>NFC 카드 기록 방법</summary><ol><li>휴대폰에 NFC 쓰기 앱을 설치합니다.</li><li><b>Write → Add a record → URL/URI</b>를 선택합니다.</li><li>생성된 주소만 붙여넣고 <b>Write</b>를 누른 뒤 카드에 휴대폰을 댑니다.</li><li>앱을 닫고 카드를 다시 태그해 전시명이 채워지는지 확인합니다.</li></ol><p>한글 주소는 길어질 수 있으므로 행사 카드에는 NTAG215 또는 NTAG216을 권장합니다. 카드를 읽기 전용으로 잠그는 기능은 전체 테스트가 끝난 뒤에만 사용하세요.</p></details>
    </div>
    <div className="exhibition-nfc-list">{entries.length ? entries.map((entry) => { const url = buildExhibitionNfcUrl(session.id, entry, window.location.origin); return <article key={entry.id}><div><strong>{entry.title}</strong><span>{entry.venue || '장소 미입력'}</span><code>{url}</code></div><div><button type="button" onClick={() => copy(url, entry.id)}>{copiedId === entry.id ? '복사됨' : 'URL 복사'}</button><button type="button" onClick={() => edit(entry)}>수정</button><button type="button" onClick={() => remove(entry)}>삭제</button></div></article>; }) : <div className="nfc-empty-state"><h4>아직 준비한 전시 카드가 없습니다.</h4><p>첫 전시명을 입력하면 카드에 기록할 주소가 만들어집니다. 전시 정보를 미리 넣지 않은 공용 카드는 위의 ‘빈 등록 카드 주소’를 사용하세요.</p></div>}</div>
  </section>;
}

function PdfStudio({ session, activeQuestion }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decks = session.decks || [];
  const activeDeck = decks.find((deck) => session.stage?.mode === 'pdf' && deck.id === session.stage.deckId);
  const page = Math.max(1, Number(session.stage?.page || 1));
  const upload = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setBusy(true); setError(''); setProgress(1);
    let pdf = null; let cover = null;
    try {
      const details = await inspectPdf(file);
      const id = createId('deck');
      pdf = await uploadMedia(session.id, 'decks', id, file, 'presentation.pdf', { contentType: 'application/pdf', onProgress: (value) => setProgress(Math.round(value * 0.86)) });
      cover = await uploadMedia(session.id, 'decks', id, details.thumbnail, 'thumbnail.jpg', { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000,immutable', onProgress: (value) => setProgress(86 + Math.round(value * 0.14)) });
      await realtime.createDeck(session.id, { id, title: title.trim() || file.name.replace(/\.pdf$/i, ''), fileUrl: pdf.url, filePath: pdf.path, thumbnailUrl: cover.url, thumbnailPath: cover.path, pageCount: details.pageCount, linksByPage: details.linksByPage, order: decks.length });
      setFile(null); setTitle(''); form.reset();
    } catch (reason) {
      await Promise.all([removeMedia(pdf?.path).catch(() => undefined), removeMedia(cover?.path).catch(() => undefined)]);
      setError(messageOf(reason));
    } finally { setBusy(false); setProgress(0); }
  };
  const remove = async (deck) => {
    if (!window.confirm(`“${deck.title}” PDF를 삭제할까요?`)) return;
    if (activeDeck?.id === deck.id) await realtime.updateSession(session.id, questionModePatch(session, activeQuestion));
    await realtime.deleteDeck(session.id, deck.id);
    await Promise.all([removeMedia(deck.filePath).catch(() => undefined), removeMedia(deck.thumbnailPath).catch(() => undefined)]);
  };
  const reorder = (deck, direction) => realtime.reorderDecks(session.id, moveId(decks, deck.id, direction));
  const rename = async (deck) => {
    const next = window.prompt('발표 자료명', deck.title);
    if (next?.trim()) await realtime.updateDeck(session.id, deck.id, { title: next.trim() });
  };
  const setPage = (nextPage) => activeDeck && realtime.updateSession(session.id, { stage: { ...session.stage, page: Math.min(activeDeck.pageCount, Math.max(1, nextPage)) } });
  const setView = (patch) => activeDeck && realtime.updateSession(session.id, { stage: { ...session.stage, ...patch } });
  const nearbyPages = activeDeck ? Array.from({ length: Math.min(5, activeDeck.pageCount) }, (_, offset) => Math.min(activeDeck.pageCount, Math.max(1, page - 2) + offset)).filter((value, index, list) => list.indexOf(value) === index) : [];
  return <section className="stack gap-lg">
    {activeDeck ? <div className="pdf-admin-console"><div><strong>{activeDeck.title}</strong><span>{page} / {activeDeck.pageCount}</span></div><div className="row gap-sm"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← 이전</button><input aria-label="PDF 페이지" type="number" min="1" max={activeDeck.pageCount} value={page} onChange={(event) => setPage(Number(event.target.value))} /><button className="btn primary" disabled={page >= activeDeck.pageCount} onClick={() => setPage(page + 1)}>다음 →</button></div><div className="pdf-studio-view-controls"><button className={`btn ${session.stage?.fitMode !== 'width' ? 'primary' : ''}`} onClick={() => setView({ fitMode: 'fit' })}>화면 맞춤</button><button className={`btn ${session.stage?.fitMode === 'width' ? 'primary' : ''}`} onClick={() => setView({ fitMode: 'width' })}>너비 맞춤</button><PdfZoomSelect value={session.stage?.zoom} onChange={(nextZoom) => setView({ zoom: nextZoom })} /></div><div className="pdf-page-strip">{nearbyPages.map((number) => <button className={number === page ? 'active' : ''} key={number} onClick={() => setPage(number)}><PdfPageCanvas url={activeDeck.fileUrl} pageNumber={number} compact /><span>{number}</span></button>)}</div></div> : null}
    <div className="asset-grid">{decks.map((deck, index) => <article className={`asset-card ${activeDeck?.id === deck.id ? 'active' : ''}`} key={deck.id}><img src={deck.thumbnailUrl} alt={`${deck.title} 표지`} /><div><strong>{deck.title}</strong><span>{deck.pageCount} pages · 링크 {Object.values(deck.linksByPage || {}).flat().length}개</span><div className="asset-order"><button disabled={index === 0} onClick={() => reorder(deck, -1)}>←</button><button disabled={index === decks.length - 1} onClick={() => reorder(deck, 1)}>→</button><button onClick={() => rename(deck)}>이름 수정</button></div><div className="row gap-sm"><button className="btn primary" onClick={() => realtime.updateSession(session.id, { stage: { mode: 'pdf', deckId: deck.id, page: 1, fitMode: 'fit', zoom: 1, blackout: false }, status: 'live' })}>발표 시작</button><button className="btn danger" onClick={() => remove(deck)}>삭제</button></div></div></article>)}</div>
    <form className="media-upload-form" onSubmit={upload}><label className="media-dropzone"><strong>{file?.name || 'PDF 선택'}</strong><span>50MB 미만 · 링크 자동 인식</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const next = event.target.files?.[0] || null; setFile(next); setTitle(next?.name.replace(/\.pdf$/i, '') || ''); setError(''); }} /></label><div className="stack gap-sm"><h3>새 PDF 등록</h3><input className="input" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="발표 자료명" />{progress ? <progress className="upload-progress" value={progress} max="100" /> : null}{error ? <p className="error-text">{error}</p> : null}<button className="btn primary" disabled={!file || busy}>{busy ? `분석·업로드 ${progress}%` : 'PDF 등록'}</button></div></form>
  </section>;
}

export default function SessionMediaStudio({ session, questions = [] }) {
  const [tab, setTab] = useState('poster');
  const grapeEnabled = hasSessionModule(session, 'exhibition-grape');
  const activeQuestion = questions.find((question) => question.id === session.currentQuestionId) || null;
  useEffect(() => { if (grapeEnabled && tab === 'artworks') setTab('nfc'); if (!grapeEnabled && tab === 'nfc') setTab('artworks'); }, [grapeEnabled, tab]);
  return <section className="panel session-media-manager"><header className="media-manager-header"><div><p className="eyebrow">{grapeEnabled ? 'EXHIBITION GRAPE MODULE' : 'OFFLINE SALON CORE'}</p><h2>세션 준비실</h2><p className="muted">{grapeEnabled ? '포스터 테마, 전시 NFC 카드와 PDF 발표를 준비합니다.' : '포스터, 갤러리 이미지, PDF와 참여 활동을 준비합니다.'}</p></div><StorageStatus /></header><nav className="media-tabs" aria-label="세션 자료"><button className={tab === 'poster' ? 'active' : ''} onClick={() => setTab('poster')}>포스터·테마</button>{grapeEnabled ? <button className={tab === 'nfc' ? 'active' : ''} onClick={() => setTab('nfc')}>전시 NFC <b>{session.exhibitionNfcEntries?.length || 0}</b></button> : <button className={tab === 'artworks' ? 'active' : ''} onClick={() => setTab('artworks')}>갤러리 이미지 <b>{session.artworks?.length || 0}</b></button>}<button className={tab === 'pdf' ? 'active' : ''} onClick={() => setTab('pdf')}>PDF <b>{session.decks?.length || 0}</b></button></nav><div className="media-tab-content">{tab === 'poster' ? <PosterThemeEditor session={session} /> : tab === 'nfc' ? <ExhibitionNfcStudio session={session} /> : tab === 'artworks' ? <ArtworkStudio session={session} activeQuestion={activeQuestion} /> : <PdfStudio session={session} activeQuestion={activeQuestion} />}</div></section>;
}
