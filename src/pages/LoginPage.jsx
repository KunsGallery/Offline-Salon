import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mode } from '../lib/realtime';
import { useAuth } from '../hooks/useAuth';

function getReturnPath(location) {
  return location.state?.from?.pathname || '/admin';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, error, loginWithGoogle } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isLocalMode = mode === 'local';
  const returnPath = getReturnPath(location);

  useEffect(() => {
    if (user && mode === 'firestore') {
      navigate(returnPath, { replace: true });
    }
  }, [navigate, returnPath, user]);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await loginWithGoogle();
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLocalMode) {
    return (
      <main className="page-shell login-shell">
        <section className="panel login-card stack gap-lg">
          <div className="stack gap-sm">
            <p className="eyebrow">UNFRAME Live Admin</p>
            <h1>관리자 로그인</h1>
            <p className="muted">이 화면은 세션 운영자 전용입니다.</p>
            <p className="muted">Local mode에서는 로그인 없이 관리자 화면에 접근할 수 있습니다.</p>
          </div>
          <button className="btn primary large-btn" type="button" onClick={() => navigate('/admin', { replace: true })}>
            관리자 화면으로 이동
          </button>
        </section>
      </main>
    );
  }

  const displayError = submitError || error?.message || location.state?.authError || '';

  return (
    <main className="page-shell login-shell">
      <section className="panel login-card stack gap-lg">
        <div className="stack gap-sm">
          <p className="eyebrow">UNFRAME Live Admin</p>
          <h1>관리자 로그인</h1>
          <p className="muted">Google 계정으로 로그인해 세션을 운영합니다.</p>
        </div>

        {loading ? <p className="muted">로그인 상태를 확인하는 중입니다.</p> : null}

        {displayError ? (
          <p className="error-text">
            로그인에 실패했습니다. Firebase Authentication 설정과 승인된 도메인을 확인해주세요.
            <br />
            <span className="tiny muted mono-line">{displayError}</span>
          </p>
        ) : null}

        <button className="btn primary large-btn" type="button" onClick={handleGoogleLogin} disabled={submitting || loading}>
          {submitting ? '로그인 중...' : 'Google로 로그인'}
        </button>
      </section>
    </main>
  );
}
