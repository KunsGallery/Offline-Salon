import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { useSession } from '../hooks/useSession';
import { getCurrentUser } from '../lib/auth';
import { checkinSummary, createCheckinApplicationFromJoinPass, findCheckinApplication, parseCheckinPayload, sortCheckinApplications } from '../lib/checkin';
import { formatDateTime } from '../lib/format';
import { lookupJoinSalonPass } from '../lib/joinPass';
import { confirmJoinCheckin } from '../lib/joinCheckin';
import { realtime } from '../lib/realtime';
import { sessionThemeStyle } from '../lib/colorPalette';

function resultCopy(result) {
  if (!result) return { tone: 'idle', title: 'QR을 스캔해 주세요', body: 'join.unframe.kr에서 발급된 개인 QR 또는 체크인 토큰을 읽습니다.' };
  if (result.status === 'checked-in') return { tone: 'success', title: `${result.application.name}님 입장 완료`, body: result.joinResult?.notificationStatus === 'pending' ? '입장은 완료되었습니다. 환영 알림톡을 발송하고 있어요.' : result.joinResult?.notificationStatus === 'failed' ? '입장은 완료되었습니다. 환영 알림톡 발송에 실패했습니다.' : result.imported ? `${result.application.joinSalonTitle || 'Join QR'}에서 확인해 Salon 출석 명단에 자동 등록했습니다.` : `${result.application.ticketType || '일반'} · 지금 체크인되었습니다.` };
  if (result.status === 'already') return { tone: 'already', title: `${result.application.name}님은 이미 입장했어요`, body: result.joinResult?.notificationStatus === 'pending' ? '입장은 확인되었고 환영 알림톡을 발송하고 있어요.' : result.application.checkedInAt ? `${formatDateTime(result.application.checkedInAt)}에 체크인되었습니다.` : '이미 체크인된 신청자입니다.' };
  if (result.status === 'cancelled') return { tone: 'error', title: '취소된 신청입니다', body: `${result.application.name}님의 신청 상태를 어드민에서 확인해 주세요.` };
  return { tone: 'error', title: 'QR을 확인하지 못했습니다', body: result.message || 'Join 개인 QR 또는 수동 명단 토큰을 확인해 주세요.' };
}

function createAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return AudioContext ? new AudioContext() : null;
}

const audioOutputNodes = new WeakMap();

function checkinAudioOutput(audioContext) {
  if (audioOutputNodes.has(audioContext)) return audioOutputNodes.get(audioContext);
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-14, audioContext.currentTime);
  compressor.knee.setValueAtTime(18, audioContext.currentTime);
  compressor.ratio.setValueAtTime(10, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.002, audioContext.currentTime);
  compressor.release.setValueAtTime(0.16, audioContext.currentTime);
  compressor.connect(audioContext.destination);
  audioOutputNodes.set(audioContext, compressor);
  return compressor;
}

function playTone(audioContext, frequency, start, duration, gain = 0.24, type = 'triangle') {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  envelope.gain.setValueAtTime(gain * 0.88, start + Math.max(0.012, duration * 0.42));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(checkinAudioOutput(audioContext));
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

async function playCheckinSound(audioContext, status) {
  if (!audioContext) return;
  if (audioContext.state === 'suspended') await audioContext.resume();
  const now = audioContext.currentTime + 0.01;
  if (status === 'checked-in') {
    playTone(audioContext, 523.25, now, 0.11, 0.34, 'square');
    playTone(audioContext, 783.99, now + 0.1, 0.13, 0.32, 'triangle');
    playTone(audioContext, 1174.66, now + 0.21, 0.2, 0.24, 'sine');
    return;
  }
  if (status === 'already') {
    playTone(audioContext, 587.33, now, 0.12, 0.26, 'triangle');
    playTone(audioContext, 440, now + 0.1, 0.19, 0.22, 'triangle');
    return;
  }
  playTone(audioContext, 220, now, 0.2, 0.3, 'sawtooth');
  playTone(audioContext, 164.81, now + 0.15, 0.24, 0.24, 'triangle');
}

function CheckinCelebration() {
  const colors = ['#b7ff38', '#42e8ff', '#fff8de', '#ff7a5f', '#ffd84a'];
  return <div className="checkin-celebration" aria-hidden="true">
    {Array.from({ length: 26 }).map((_, index) => (
      <span
        key={index}
        style={{
          '--angle': `${(index * 137.5) % 360}deg`,
          '--distance': `${72 + (index % 7) * 16}px`,
          '--delay': `${(index % 6) * 18}ms`,
          '--particle-color': colors[index % colors.length],
          '--particle-size': `${6 + (index % 4) * 2}px`,
        }}
      />
    ))}
  </div>;
}

const cameraFacingLabels = {
  environment: '후면카메라',
  user: '전면카메라',
};

export default function CheckinPage() {
  const { sessionId } = useParams();
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastCodeRef = useRef('');
  const audioContextRef = useRef(null);
  const { session, loading, error } = useSession(sessionId);
  const [manualValue, setManualValue] = useState('');
  const [scannerState, setScannerState] = useState('idle');
  const [scannerMessage, setScannerMessage] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [cameraFacing, setCameraFacing] = useState(() => {
    if (typeof window === 'undefined') return 'environment';
    return window.localStorage.getItem('offline-salon:checkin-camera-facing') || 'environment';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('offline-salon:checkin-sound') !== 'off';
  });
  const applications = useMemo(() => sortCheckinApplications(session?.checkinApplications || []), [session?.checkinApplications]);
  const summary = checkinSummary(applications);
  const recent = applications.filter((item) => item.checkedIn).slice(0, 6);

  useEffect(() => () => {
    window.cancelAnimationFrame(rafRef.current);
    zxingControlsRef.current?.stop?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close?.();
  }, []);

  const prepareAudio = async (force = false) => {
    if ((!soundEnabled && !force) || typeof window === 'undefined') return null;
    if (!audioContextRef.current) audioContextRef.current = createAudioContext();
    if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem('offline-salon:checkin-sound', next ? 'on' : 'off');
    if (next) {
      const audioContext = await prepareAudio(true);
      await playCheckinSound(audioContext, 'checked-in');
    }
  };

  const checkin = async (value) => {
    const raw = String(value || '').trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      const audioContext = await prepareAudio();
      const payload = parseCheckinPayload(raw);
      let next;
      if (payload.isJoinPayload || payload.token?.length >= 32) {
        if (!session.joinSalonId) throw new Error('이 세션에 Join 살롱 ID가 설정되지 않았습니다. 어드민 세션 설정에서 저장해 주세요.');
        const [passLookup, checkinConfirmation] = await Promise.allSettled([
          lookupJoinSalonPass(raw),
          confirmJoinCheckin({ salonId: session.joinSalonId, qrPayload: raw }),
        ]);
        if (checkinConfirmation.status === 'rejected') throw checkinConfirmation.reason;
        const joinResult = checkinConfirmation.value;
        const joinPass = passLookup.status === 'fulfilled'
          ? passLookup.value
          : {
            applicantDisplayName: joinResult.participant?.name || '참가자',
            participantId: joinResult.participant?.id || '',
            salonTitle: session.title,
            eventDateTime: session.salonDate || '',
            venueName: '',
            tokenHash: '',
            joinCheckedInAt: joinResult.checkedInAt || null,
          };
        const existing = findCheckinApplication(session.checkinApplications || [], {
          joinTokenHash: joinPass.tokenHash,
          joinParticipantId: joinResult.participant?.id || joinPass.participantId,
        });
        const imported = createCheckinApplicationFromJoinPass({
          ...joinPass,
          joinParticipantId: joinResult.participant?.id || joinPass.participantId || '',
          joinCheckinStatus: joinResult.status,
          joinNotificationStatus: joinResult.notificationStatus || '',
          joinNotificationError: joinResult.notificationError || joinResult.welcomeNotificationError || '',
          joinCheckedInAt: joinResult.checkedInAt || joinPass.joinCheckedInAt,
        });
        if (!imported) throw new Error('Join 참가자 정보를 만들지 못했습니다.');
        const now = joinResult.checkedInAt || new Date().toISOString();
        const application = await Promise.resolve(realtime.upsertCheckinApplication(sessionId, {
          ...imported,
          ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
          checkedIn: true,
          checkedInAt: now,
          checkedInBy: getCurrentUser()?.email || getCurrentUser()?.uid || 'join-confirmed',
        }));
        next = { ok: true, status: joinResult.duplicate ? 'already' : 'checked-in', application, imported: !existing, joinPass, joinResult };
      } else {
        const user = getCurrentUser();
        next = await Promise.resolve(realtime.checkInApplication(sessionId, raw, user?.email || user?.uid || 'admin'));
      }
      setResult(next);
      if (next.status === 'checked-in') setCelebrationKey((value) => value + 1);
      await playCheckinSound(audioContext, next.status);
      if (next.ok && next.status === 'checked-in') setManualValue('');
    } catch (reason) {
      const failed = { ok: false, status: 'error', payload: { raw }, message: reason?.message || '체크인에 실패했습니다.' };
      setResult(failed);
      await playCheckinSound(audioContextRef.current, failed.status);
    } finally {
      setBusy(false);
      window.setTimeout(() => { lastCodeRef.current = ''; }, 1800);
    }
  };

  const startCamera = async (preferredFacing = cameraFacing) => {
    try {
      await prepareAudio();
      setScannerState('starting');
      stopCamera();
      setScannerState('scanning');
      setScannerMessage(`${cameraFacingLabels[preferredFacing] || '카메라'}로 스캔합니다. 개인 QR을 화면 중앙에 맞춰 주세요.`);
      const videoConstraints = { facingMode: { ideal: preferredFacing } };
      if (!('BarcodeDetector' in window)) {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: videoConstraints, audio: false },
          videoRef.current,
          (scanResult) => {
            const rawValue = scanResult?.getText?.() || '';
            if (rawValue && rawValue !== lastCodeRef.current) {
              lastCodeRef.current = rawValue;
              checkin(rawValue);
            }
          },
        );
        zxingControlsRef.current = controls;
        setScannerMessage(`${cameraFacingLabels[preferredFacing] || '카메라'} · 보조 스캐너로 QR을 읽고 있습니다. QR을 화면 중앙에 맞춰 주세요.`);
        return;
      }
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
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
      setScannerMessage(reason?.name === 'NotAllowedError' ? '카메라 권한이 필요합니다. 권한을 허용하거나 수동 입력을 사용해 주세요.' : `카메라 스캔을 시작하지 못했습니다. 수동 입력을 사용해 주세요.${reason?.message ? ` (${reason.message})` : ''}`);
    }
  };

  const switchCamera = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    window.localStorage.setItem('offline-salon:checkin-camera-facing', nextFacing);
    if (scannerState === 'scanning' || scannerState === 'starting') {
      await startCamera(nextFacing);
    } else {
      setScannerMessage(`${cameraFacingLabels[nextFacing]}로 설정했습니다. 카메라 스캔 시작을 누르면 적용됩니다.`);
    }
  };

  const stopCamera = () => {
    window.cancelAnimationFrame(rafRef.current);
    zxingControlsRef.current?.stop?.();
    zxingControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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
        <div className="checkin-actions"><button type="button" onClick={() => startCamera()} disabled={scannerState === 'starting' || scannerState === 'scanning'}>{scannerState === 'starting' ? '카메라 준비 중…' : `${cameraFacingLabels[cameraFacing]} 스캔 시작`}</button><button className="checkin-secondary-action" type="button" onClick={switchCamera} disabled={scannerState === 'starting'}>{cameraFacing === 'environment' ? '전면으로 전환' : '후면으로 전환'}</button><button className="checkin-secondary-action" type="button" onClick={stopCamera} disabled={scannerState !== 'scanning'}>카메라 끄기</button><button className="checkin-sound-toggle" type="button" onClick={toggleSound}>{soundEnabled ? '효과음 켜짐' : '효과음 꺼짐'}</button></div>
        <form className="checkin-manual" onSubmit={(event) => { event.preventDefault(); checkin(manualValue); }}>
          <label><span>수동 체크인</span><input value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="QR URL, applicationId, token" /></label>
          <small>{parsed.token || parsed.applicationId ? (parsed.isJoinPayload ? 'Join QR 값을 인식했습니다. 서버 검증을 진행할 수 있습니다.' : '체크인 값을 인식했습니다.') : 'Join 패스 링크나 체크인 QR 값을 붙여넣어도 됩니다.'}</small>
          <button type="submit" disabled={busy || !manualValue.trim()}>{busy ? '확인 중…' : '체크인 처리'}</button>
        </form>
      </div>
      <aside className={`checkin-result ${copy.tone}`} aria-live="polite">
        {copy.tone === 'success' && celebrationKey ? <CheckinCelebration key={celebrationKey} /> : null}
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
