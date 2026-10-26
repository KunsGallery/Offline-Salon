import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

// Each screen loads on demand so participant phones skip admin, remote and check-in code.
const AdminHome = lazy(() => import('../pages/AdminHome'));
const AdminSession = lazy(() => import('../pages/AdminSession'));
const CheckinPage = lazy(() => import('../pages/CheckinPage'));
const HostDisplay = lazy(() => import('../pages/HostDisplay'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const ParticipantApp = lazy(() => import('../pages/ParticipantApp'));
const RemoteControl = lazy(() => import('../pages/RemoteControl'));

function RouteLoading() {
  return (
    <main className="page-shell" aria-busy="true">
      <section className="panel stack gap-sm">
        <h1>화면을 불러오는 중입니다.</h1>
      </section>
    </main>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoading />}>
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/:sessionId"
        element={
          <ProtectedRoute>
            <AdminSession />
          </ProtectedRoute>
        }
      />
      <Route path="/host/:sessionId" element={<HostDisplay />} />
      <Route path="/client/:sessionId" element={<ParticipantApp />} />
      <Route path="/remote/:sessionId" element={<ProtectedRoute><RemoteControl /></ProtectedRoute>} />
      <Route path="/checkin/:sessionId" element={<ProtectedRoute><CheckinPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
    </Suspense>
  );
}
