import React from 'react';

const palette = ['#004AAD', '#AAD004', '#F59E0B', '#A855F7', '#14B8A6', '#E11D48'];

function getInitials(nickname, fallback = '?') {
  const source = String(nickname || fallback).trim();
  const first = source.charAt(0);
  return first ? first.toUpperCase() : '?';
}

export default function ParticipantAvatar({ participant = null, nickname = '', participantId = '', index = 0, style = {} }) {
  const tint = palette[index % palette.length];
  const resolvedNickname = String(nickname || participant?.nickname || '').trim() || '익명';
  const resolvedId = participantId || participant?.participantId || '';
  const initials = getInitials(resolvedNickname, resolvedId);

  return (
    <div className="participant-avatar" style={{ '--avatar-tint': tint, ...style }}>
      <div className="avatar-head">{initials}</div>
      <div className="avatar-body" />
      <span className="avatar-name">{resolvedNickname}</span>
    </div>
  );
}
