import React, { useRef, useState } from 'react';
import { realtime } from '../../lib/realtime';
import { createId } from '../../lib/ids';
import { uploadMedia, removeMedia } from '../../lib/media';
import { prepareParticipantPhoto } from '../../lib/participantPhoto';
import { requestPearPairing } from '../../lib/pearPlay';
import { preparedPearStatus } from '../../lib/pearPrepared';

export default function PreparedPearCases({ session }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const items = session.pearPreparedCases || [];

  const investigate = async (item) => {
    const photo = item.pearPairing;
    try {
      await realtime.upsertPreparedPearCase(session.id, { ...item, pearPairing: { ...photo, status: 'investigating', error: '' } });
      setMessage(`${item.title} · 작품을 찾고 있습니다.`);
      const result = await requestPearPairing({ sessionId: session.id, participantId: item.id, photoUrl: photo.photoUrl,
        onProgress: ({ phase }) => setMessage(`${item.title} · ${phase === 'verifying' ? '연결 이유를 정리하고 있습니다.' : '작품을 찾고 있습니다.'}`),
      });
      if (!result.finalArtwork?.imageUrl) throw new Error('작품 이미지를 확인하지 못했습니다. 다시 조사해 주세요.');
      await realtime.upsertPreparedPearCase(session.id, { ...item, pearPairing: { ...result, status: 'ready', photoUrl: photo.photoUrl, photoPath: photo.photoPath || null } });
    } catch (reason) {
      await realtime.upsertPreparedPearCase(session.id, { ...item, pearPairing: { ...photo, status: 'error', error: reason.message || '조사에 실패했습니다.' } });
      throw reason;
    }
  };

  const run = async (action) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('준비 중…');
    try { await action(); setMessage('저장했습니다.'); }
    catch (reason) { setError(reason.message || '사전 조사에 실패했습니다. 다시 시도해 주세요.'); setMessage(''); }
    finally { setBusy(false); }
  };

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (items.length + files.length > 24) { setError('사전 조사 사진은 세션당 24장까지 등록할 수 있습니다.'); return; }
    await run(async () => {
      const failures = [];
      for (const file of files) {
        let uploaded;
        let saved = false;
        try {
          setMessage(`${file.name} · 사진 준비 중…`);
          const photo = await prepareParticipantPhoto(file);
          const id = createId('pear_case');
          uploaded = await uploadMedia(session.id, 'artworks', id, photo, 'prepared-photo.jpg', { onProgress: (progress) => setMessage(`${file.name} · 전송 중 ${progress}%`) });
          const item = await realtime.upsertPreparedPearCase(session.id, { id, title: file.name.replace(/\.[^.]+$/, ''), pearPairing: { photoUrl: uploaded.url, photoPath: uploaded.path || null, status: 'uploaded' } });
          saved = true;
          await investigate(item);
        } catch (reason) {
          if (uploaded && !saved) await removeMedia(uploaded.path).catch(() => {});
          failures.push(`${file.name}: ${reason.message}`);
        }
      }
      if (failures.length) throw new Error(failures.join(' / '));
    });
  };

  const remove = (item) => {
    if (!window.confirm(`“${item.title}” 사전 조사 사진과 결과를 삭제할까요?`)) return;
    void run(async () => {
      await realtime.deletePreparedPearCase(session.id, item.id);
      await removeMedia(item.pearPairing?.photoPath);
    });
  };

  return <section className="panel prepared-pear-admin" aria-label="PEAR PLAY 사전 조사">
    <div className="panel-header"><h2>역추리 사전 조사</h2><button className="btn primary" type="button" disabled={busy || items.length >= 24} onClick={() => inputRef.current?.click()}>사진 등록 및 사전 조사</button></div>
    <input ref={inputRef} className="prepared-pear-file" aria-label="사전 조사 사진" type="file" accept="image/*" multiple disabled={busy} onChange={upload} />
    {message ? <p role="status">{message}</p> : null}{error ? <p className="pear-error" role="alert">{error}</p> : null}
    <div className="prepared-pear-list">{items.map((item, index) => <article className="prepared-pear-item" key={item.id}>
      <div className="prepared-pear-images"><figure><img src={item.pearPairing?.photoUrl} alt="원본 사진" /><figcaption>원본 사진</figcaption></figure>{item.pearPairing?.finalArtwork?.imageUrl ? <figure><img src={item.pearPairing.finalArtwork.imageUrl} alt="사전 조사 작품" /><figcaption>찾은 작품</figcaption></figure> : null}</div>
      <div className="prepared-pear-details"><h3>사건 {index + 1} · {item.title}</h3><p>{preparedPearStatus(item)}</p>{item.pearPairing?.finalArtwork ? <p>{item.pearPairing.finalArtwork.title} · {item.pearPairing.finalArtwork.artist}</p> : null}{item.pearPairing?.error ? <p role="alert">{item.pearPairing.error}</p> : null}</div>
      <div className="prepared-pear-actions"><button className="btn" type="button" disabled={busy} onClick={() => run(() => investigate(item))}>{item.pearPairing?.status === 'ready' ? '다시 조사' : '작품 조사'}</button><button className="btn" type="button" disabled={busy} onClick={() => remove(item)}>삭제</button></div>
    </article>)}</div>
    {!items.length ? <p className="muted">등록된 사전 조사 사진이 없습니다.</p> : null}
  </section>;
}
