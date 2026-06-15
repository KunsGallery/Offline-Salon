import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { mode } from '../lib/realtime';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { user, loading, error } = useAuth();

  if (mode === 'local') {
    return children;
  }

  if (loading) {
    return (
      <main className="page-shell">
        <section className="panel stack gap-sm">
          <p className="eyebrow">ADMIN ACCESS</p>
          <h1>로그인 상태를 확인하는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (error || !user) {
    return <Navigate to="/login" replace state={{ from: location, authError: error?.message || null }} />;
  }

  return children;
}
