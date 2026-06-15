import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminStatusBar from '../components/admin/AdminStatusBar';
import SessionList from '../components/admin/SessionList';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { useSessions } from '../hooks/useSessions';

export default function AdminHome() {
  const { sessions, loading, error } = useSessions();
  const navigate = useNavigate();

  return (
    <main className="page-shell">
      <div className="stack gap-lg">
        <AdminStatusBar />
        <RealtimeStatusBanner loading={loading} error={error} compact />
        <SessionList sessions={sessions} onOpen={(sessionId) => navigate(`/admin/${sessionId}`)} />
      </div>
    </main>
  );
}
