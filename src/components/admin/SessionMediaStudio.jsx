import React, { useEffect, useState } from 'react';
import { buildBranding, extractPalette } from '../../lib/colorPalette';
import { createId } from '../../lib/ids';
import { uploadMedia, removeMedia } from '../../lib/media';
import { inspectPdf } from '../../lib/pdf';
import { realtime } from '../../lib/realtime';

function PosterThemeEditor({ session }) {
  const [selection, setSelection] = useState(null);
  const [preview, setPreview] = useState(session.branding?.posterUrl || '');
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
      setSelection({ file, palette, theme: buildBranding(palette) });
      setPreview(URL.createObjectURL(file));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const save = async () => {
    if (!selection) return;
    setBusy(true);
    setError('');
    let uploaded = null;
    try {
      const id = createId('poster');
      const extension = selection.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      uploaded = await uploadMedia(session.id, 'poster', id, selection.file, `poster.${extension}`);
      const previous = session.branding?.posterStoragePath;
      await realtime.updateSession(session.id, {
        branding: {
          ...session.branding,
          ...selection.theme,
          posterUrl: uploaded.url,
          posterStoragePath: uploaded.path,
        },
      });
      await removeMedia(previous);
      setSelection(null);
    } catch (reason) {
      await removeMedia(uploaded?.path);
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const palette = selection?.palette || session.branding?.palette || [session.branding?.primaryColor, session.branding?.secondaryColor, session.branding?.tertiaryColor].filter(Boolean);
  return (
    <section className="panel media-panel">
      <div className="panel-header"><div><p className="eyebrow">POSTER THEME</p><h2>포스터 자동 컬러</h2><p className="muted">포스터에서 대표색 3개를 찾아 세션 전체에 적용합니다.</p></div></div>
      <label className={`media-dropzone poster-zone ${preview ? 'has-preview' : ''}`}>
        {preview ? <img src={preview} alt="모임 포스터" /> : <><strong>포스터 선택</strong><span>JPG, PNG, WEBP · 12MB 미만</span></>}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={busy} />
      </label>
      <div className="palette-row"><span>추출 색상</span><div>{palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div></div>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn primary" type="button" onClick={save} disabled={!selection || busy}>{busy ? '분석·저장 중…' : '새 포스터와 테마 적용'}</button>
    </section>
  );
}

function ArtworkStudio({ session }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState({ title: '', artist: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeId = session.stage?.mode === 'artwork' ? session.stage.artworkId : null;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const choose = (event) => {
    const next = event.target.files?.[0] || null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : '');
  };
  const add = async (event) => {
    event.preventDefault();
    const uploadForm = event.currentTarget;
    if (!file) return;
    setBusy(true);
    setError('');
    let uploaded = null;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size >= 12 * 1024 * 1024) throw new Error('12MB 미만 JPG, PNG, WEBP 이미지만 등록할 수 있습니다.');
      const id = createId('artwork');
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      uploaded = await uploadMedia(session.id, 'artworks', id, file, `original.${extension}`, { cacheControl: 'public,max-age=31536000,immutable' });
      await realtime.updateSession(session.id, { artworks: [...(session.artworks || []), { id, imageUrl: uploaded.url, storagePath: uploaded.path, ...form, order: Date.now() }] });
      setFile(null); setPreview(''); setForm({ title: '', artist: '', description: '' }); uploadForm.reset();
    } catch (reason) { await removeMedia(uploaded?.path); setError(reason.message); } finally { setBusy(false); }
  };
  const start = async (artwork) => {
    setBusy(true);
    try {
      const runId = createId('run');
      const question = await Promise.resolve(realtime.createQuestion(session.id, { title: '이 작품에 제목을 붙인다면?', description: '정답은 잠시 잊고 떠오르는 제목을 적어보세요.', type: 'artwork-title', artworkId: artwork.id, runId, internal: true }));
      await Promise.resolve(realtime.activateQuestion(session.id, question.id));
      await Promise.resolve(realtime.updateSession(session.id, { stage: { mode: 'artwork', artworkId: artwork.id, phase: 'collect', runId, questionId: question.id, page: 1 }, showResults: false, status: 'live' }));
    } finally { setBusy(false); }
  };
  const remove = async (artwork) => {
    if (!window.confirm(`“${artwork.title || '이 작품'}”을 삭제할까요?`)) return;
    if (activeId === artwork.id) await realtime.updateSession(session.id, { stage: { mode: 'questions', page: 1 } });
    await realtime.updateSession(session.id, { artworks: (session.artworks || []).filter((item) => item.id !== artwork.id) });
    await removeMedia(artwork.storagePath);
  };
  const setPhase = (phase) => realtime.updateSession(session.id, { stage: { ...session.stage, phase }, showResults: phase !== 'collect' });
  return (
    <section className="panel media-panel wide-media-panel">
      <div className="panel-header"><div><p className="eyebrow">ARTWORK TITLE LAB</p><h2>작품 제목 활동</h2><p className="muted">작품을 띄우고 제목 수집·투표·정보 공개를 진행합니다.</p></div>{activeId ? <div className="row wrap gap-sm"><button className="btn" onClick={() => setPhase('collect')}>제목 받기</button><button className="btn" onClick={() => setPhase('vote')}>투표</button><button className="btn" onClick={() => setPhase('reveal')}>정답 공개</button><button className="btn danger" onClick={() => realtime.updateSession(session.id, { stage: { mode: 'questions', page: 1 } })}>종료</button></div> : null}</div>
      <div className="asset-grid">{(session.artworks || []).map((artwork) => <article className={`asset-card ${activeId === artwork.id ? 'active' : ''}`} key={artwork.id}><img src={artwork.imageUrl} alt={artwork.title || '작품'} /><div><strong>{artwork.title || '제목 미정'}</strong><span>{artwork.artist || '작가 미정'}</span><div className="row gap-sm"><button className="btn primary" onClick={() => start(artwork)} disabled={busy}>화면에 띄우기</button><button className="btn danger" onClick={() => remove(artwork)}>삭제</button></div></div></article>)}</div>
      <form className="media-upload-form" onSubmit={add}>
        <label className={`media-dropzone ${preview ? 'has-preview' : ''}`}>{preview ? <img src={preview} alt="작품 미리보기" /> : <><strong>작품 이미지 선택</strong><span>12MB 미만</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} /></label>
        <div className="stack gap-sm"><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="실제 작품명" /><input className="input" value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} placeholder="작가명" /><textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="작품 설명" />{error ? <p className="error-text">{error}</p> : null}<button className="btn primary" disabled={!file || busy}>{busy ? '등록 중…' : '작품 등록'}</button></div>
      </form>
    </section>
  );
}

function PdfStudio({ session }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeDeck = (session.decks || []).find((deck) => session.stage?.mode === 'pdf' && deck.id === session.stage.deckId);
  const upload = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setBusy(true); setError('');
    let pdf = null;
    let cover = null;
    try {
      const { pageCount, thumbnail } = await inspectPdf(file);
      const id = createId('deck');
      pdf = await uploadMedia(session.id, 'decks', id, file, 'presentation.pdf', { contentType: 'application/pdf' });
      cover = await uploadMedia(session.id, 'decks', id, thumbnail, 'thumbnail.jpg', { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000,immutable' });
      const deck = { id, title: title.trim() || file.name.replace(/\.pdf$/i, ''), fileUrl: pdf.url, filePath: pdf.path, thumbnailUrl: cover.url, thumbnailPath: cover.path, pageCount, order: Date.now() };
      await realtime.updateSession(session.id, { decks: [...(session.decks || []), deck] });
      setFile(null); setTitle(''); form.reset();
    } catch (reason) { await Promise.all([removeMedia(pdf?.path), removeMedia(cover?.path)]); setError(reason.message); } finally { setBusy(false); }
  };
  const remove = async (deck) => {
    if (!window.confirm(`“${deck.title}” PDF를 삭제할까요?`)) return;
    if (activeDeck?.id === deck.id) await realtime.updateSession(session.id, { stage: { mode: 'questions', page: 1 } });
    await realtime.updateSession(session.id, { decks: (session.decks || []).filter((item) => item.id !== deck.id) });
    await Promise.all([removeMedia(deck.filePath), removeMedia(deck.thumbnailPath)]);
  };
  const page = Math.max(1, Number(session.stage?.page || 1));
  return (
    <section className="panel media-panel wide-media-panel">
      <div className="panel-header"><div><p className="eyebrow">PDF PRESENTATION</p><h2>PDF 발표 자료</h2><p className="muted">업로드 후 Host 화면과 모바일 리모컨에서 바로 발표합니다.</p></div>{activeDeck ? <div className="row gap-sm align-center"><button className="btn" disabled={page <= 1} onClick={() => realtime.updateSession(session.id, { stage: { ...session.stage, page: page - 1 } })}>← 이전</button><span className="badge">{page} / {activeDeck.pageCount}</span><button className="btn primary" disabled={page >= activeDeck.pageCount} onClick={() => realtime.updateSession(session.id, { stage: { ...session.stage, page: page + 1 } })}>다음 →</button></div> : null}</div>
      <div className="asset-grid">{(session.decks || []).map((deck) => <article className={`asset-card ${activeDeck?.id === deck.id ? 'active' : ''}`} key={deck.id}><img src={deck.thumbnailUrl} alt={`${deck.title} 표지`} /><div><strong>{deck.title}</strong><span>{deck.pageCount} pages</span><div className="row gap-sm"><button className="btn primary" onClick={() => realtime.updateSession(session.id, { stage: { mode: 'pdf', deckId: deck.id, page: 1 }, status: 'live' })}>발표 시작</button><button className="btn danger" onClick={() => remove(deck)}>삭제</button></div></div></article>)}</div>
      <form className="media-upload-form" onSubmit={upload}><label className="media-dropzone"><strong>{file?.name || 'PDF 선택'}</strong><span>50MB 미만</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => { const next = event.target.files?.[0] || null; setFile(next); setTitle(next?.name.replace(/\.pdf$/i, '') || ''); }} /></label><div className="stack gap-sm"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="발표 자료명" />{error ? <p className="error-text">{error}</p> : null}<button className="btn primary" disabled={!file || busy}>{busy ? '분석·업로드 중…' : 'PDF 등록'}</button></div></form>
    </section>
  );
}

export default function SessionMediaStudio({ session }) {
  return <section className="session-media-studio"><PosterThemeEditor session={session} /><ArtworkStudio session={session} /><PdfStudio session={session} /></section>;
}
