import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminHome from '../pages/AdminHome';
import AdminSession from '../pages/AdminSession';
import HostDisplay from '../pages/HostDisplay';
import LoginPage from '../pages/LoginPage';
import ParticipantApp from '../pages/ParticipantApp';
import ProtectedRoute from '../components/ProtectedRoute';

export function AppRouter() {
  return (
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
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
