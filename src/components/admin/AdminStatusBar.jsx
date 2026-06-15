import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mode } from '../../lib/realtime';
import { useAuth } from '../../hooks/useAuth';

export default function AdminStatusBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isFirestore = mode === 'firestore';
  const identity = user?.email || user?.displayName || '로그인 안 됨';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <section className="admin-status-bar panel">
      <div className="row between gap-sm align-center">
        <div className="stack gap-xs">
          <p className="eyebrow">ADMIN ACCESS</p>
          <strong>{isFirestore ? `Firestore Mode · 로그인됨: ${identity}` : 'Local Mode'}</strong>
        </div>
        <div className="row wrap gap-sm align-center">
          <span className={`badge ${isFirestore ? 'status-live' : ''}`}>{isFirestore ? 'Connected' : 'Local Mode'}</span>
          {user?.email ? <span className="badge">{user.email}</span> : null}
          {user ? (
            <button className="btn ghost" type="button" onClick={handleLogout}>
              로그아웃
            </button>
          ) : null}
        </div>
      </div>
      {isFirestore && !user ? <p className="muted tiny">관리자 계정으로 로그인한 상태에서만 수정 작업을 수행할 수 있습니다.</p> : null}
    </section>
  );
}
