import React from 'react';
import { mode } from '../lib/realtime';

export default function RealtimeStatusBanner({ loading = false, error = null, compact = false }) {
  const isFirestore = mode === 'firestore';
  const stateLabel = error ? 'Error' : isFirestore ? (loading ? 'Syncing' : 'Connected') : 'Local Mode';
  const stateClass = error ? 'error' : isFirestore ? (loading ? 'syncing' : 'connected') : 'local';

  if (!isFirestore && !error && compact) {
    return null;
  }

  return (
    <section className={`realtime-status ${stateClass}`} aria-live="polite">
      <div className="row between gap-sm align-center">
        <div className="stack gap-xs">
          <p className="eyebrow">Realtime</p>
          <strong>{isFirestore ? 'Firestore Mode' : 'Local Mode'}</strong>
        </div>
        <span className={`badge realtime-badge ${stateClass}`}>{stateLabel}</span>
      </div>
      {error ? (
        <div className="stack gap-xs">
          <p className="muted tiny">
            데이터 연결에 문제가 있습니다. Firestore 설정 또는 네트워크 상태를 확인해주세요.
          </p>
          <p className="tiny muted mono-line">{error.message || String(error)}</p>
        </div>
      ) : isFirestore && loading ? (
        <p className="muted tiny">Firestore 연결 상태를 확인하는 중입니다.</p>
      ) : isFirestore ? (
        <p className="muted tiny">Firestore 실시간 동기화가 활성화되어 있습니다.</p>
      ) : null}
    </section>
  );
}
