import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { useSession } from '../hooks/useSession';
import { getCurrentUser } from '../lib/auth';
import { checkinSummary, parseCheckinPayload, sortCheckinApplications } from '../lib/checkin';
import { formatDateTime } from '../lib/format';
import { realtime } from '../lib/realtime';
import { sessionThemeStyle } from '../lib/colorPalette';

function resultCopy(result) {
  if (!result) return { tone: 'idle', title: 'QR을 스캔해 주세요', body: 'join.unframe.kr에서 발급된 개인 QR 또는 체크인 토큰을 읽습니다.' };
  if (result.status === 'checked-in') return { tone: 'success', title: `${result.application.name}님 입장 완료`, body: result.imported ? `${result.application.joinSalonTitle || 'Join QR'}에서 확인해 Salon 출석 명단에 자동 등록했습니다.` : `${result.application.ticketType || '일반'} · 지금 체크인되었습니다.` };
  if (result.status === 'already') return { tone: 'already', title: `${result.application.name}님은 이미 입장했어요`, body: result.application.checkedInAt ? `${formatDateTime(result.application.checkedInAt)}에 체크인되었습니다.` : '이미 체크인된 신청자입니다.' };
  if (result.status === 'cancelled') return { tone: 'error', title: '취소된 신청입니다', body: `${result.application.name}님의 신청 상태를 어드민에서 확인해 주세요.` };
  return { tone: 'error', title: 'QR을 확인하지 못했습니다', body: result.message || (result.payload?.raw ? `읽은 값: ${result.payload.raw}` : 'Join 개인 QR 또는 수동 명단 토큰을 확인해 주세요.') };
}

export default function CheckinPage() {
  const { sessionId } = useParams();
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastCodeRef = useRef('');
  const { session, loading, error } = useSession(sessionId);
  const [manualValue, setManualValue] = useState('');
  const [scannerState, setScannerState] = useState('idle');
  const [scannerMessage, setScannerMessage] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const applications = useMemo(() => sortCheckinApplications(session?.checkinApplications || []), [session?.checkinApplications]);
  const summary = checkinSummary(applications);
  const recent = applications.filter((item) => item.checkedIn).slice(0, 6);

  useEffect(() => () => {
    window.cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const checkin = async (value) => {
    const raw = String(value || '').trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      const user = getCurrentUser();
      const next = await Promise.resolve(realtime.checkInApplication(sessionId, raw, user?.email || user?.uid || 'admin'));
      setResult(next);
      if (next.ok && next.status === 'checked-in') setManualValue('');
    } catch (reason) {
      setResult({ ok: false, status: 'error', payload: { raw }, message: reason?.message || '체크인에 실패했습니다.' });
    } finally {
      setBusy(false);
      window.setTimeout(() => { lastCodeRef.current = ''; }, 1800);
    }
  };

  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) {
      setScannerState('manual');
      setScannerMessage('이 브라우저는 QR 자동 인식을 지원하지 않습니다. 아래 입력칸에 QR 값을 붙여넣어 주세요.');
      return;
    }
    try {
      setScannerState('starting');
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScannerState('scanning');
      setScannerMessage('카메라 중앙에 개인 QR을 맞춰 주세요.');
      const tick = async () => {
        if (!videoRef.current || scannerState === 'stopped') return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          const rawValue = codes[0]?.rawValue || '';
          if (rawValue && rawValue !== lastCodeRef.current) {
            lastCodeRef.current = rawValue;
            checkin(rawValue);
          }
        } catch {
          // Detection can fail on a transient video frame.
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    } catch (reason) {
      setScannerState('manual');
      setScannerMessage(reason?.name === 'NotAllowedError' ? '카메라 권한이 필요합니다. 권한을 허용하거나 수동 입력을 사용해 주세요.' : '카메라를 시작하지 못했습니다. 수동 입력을 사용해 주세요.');
    }
  };

  const stopCamera = () => {
    window.cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerState('idle');
    setScannerMessage('');
  };

  if (loading && session === undefined) return <main className="checkin-shell"><section className="checkin-panel"><RealtimeStatusBanner loading /></section></main>;
  if (error || !session) return <main className="checkin-shell"><section className="checkin-panel"><RealtimeStatusBanner error={error} /><h1>체크인 세션을 찾을 수 없습니다.</h1><p>{sessionId}</p></section></main>;

  const copy = resultCopy(result);
  const parsed = parseCheckinPayload(manualValue);

  return <main className="checkin-shell" style={sessionThemeStyle(session)}>
    <section className="checkin-hero">
      <div><span>UNFRAME SALON CHECK-IN</span><h1>{session.title}</h1><p>Join에서 발급된 개인 QR을 Salon 출석 명단으로 연결하는 입장 확인 전용 화면입니다.</p></div>
      <aside><strong>{summary.checkedIn}</strong><span>/ {summary.registered} 입장</span><i style={{ '--checkin-progress': summary.registered ? summary.checkedIn / summary.registered : 0 }} /></aside>
    </section>
    <section className="checkin-grid">
      <div className="checkin-scanner-card">
        <div className={`checkin-camera ${scannerState}`}>
          <video ref={videoRef} muted playsInline />
          <div><strong>{scannerState === 'scanning' ? '스캔 중' : 'QR 스캐너'}</strong><span>{scannerMessage || '카메라를 시작하거나 Join 개인 QR URL을 수동으로 입력하세요.'}</span></div>
        </div>
        <div className="checkin-actions"><button type="button" onClick={startCamera} disabled={scannerState === 'starting' || scannerState === 'scanning'}>{scannerState === 'starting' ? '카메라 준비 중…' : '카메라 스캔 시작'}</button><button type="button" onClick={stopCamera} disabled={scannerState !== 'scanning'}>카메라 끄기</button></div>
        <form className="checkin-manual" onSubmit={(event) => { event.preventDefault(); checkin(manualValue); }}>
          <label><span>수동 체크인</span><input value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="QR URL, applicationId, token" /></label>
          <small>{parsed.token || parsed.applicationId ? `인식 후보: ${parsed.applicationId || parsed.token}` : 'Join 패스 링크나 체크인 QR 값을 붙여넣어도 됩니다.'}</small>
          <button type="submit" disabled={busy || !manualValue.trim()}>{busy ? '확인 중…' : '체크인 처리'}</button>
        </form>
      </div>
      <aside className={`checkin-result ${copy.tone}`} aria-live="polite">
        <span>{copy.tone === 'success' ? 'WELCOME' : copy.tone === 'already' ? 'ALREADY IN' : copy.tone === 'error' ? 'CHECK NEEDED' : 'READY'}</span>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </aside>
      <section className="checkin-recent">
        <header><h2>최근 입장</h2><span>{summary.waiting}명 대기</span></header>
        {recent.length ? <ol>{recent.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.ticketType} · {item.checkedInAt ? formatDateTime(item.checkedInAt) : '방금'}</span></li>)}</ol> : <p>아직 입장 처리된 신청자가 없습니다.</p>}
      </section>
    </section>
  </main>;
}
