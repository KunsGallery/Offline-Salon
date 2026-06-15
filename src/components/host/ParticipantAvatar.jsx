import React from 'react';

const palette = ['#004AAD', '#AAD004', '#F59E0B', '#A855F7', '#14B8A6', '#E11D48'];

function getInitials(participant) {
  const source = participant?.nickname || participant?.participantId || '?';
  const first = String(source).trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

export default function ParticipantAvatar({ participant, index = 0, style = {} }) {
  const tint = palette[index % palette.length];
  const initials = getInitials(participant);

  return (
    <div className="participant-avatar" style={{ '--avatar-tint': tint, ...style }}>
      <div className="avatar-head">{initials}</div>
      <div className="avatar-body" />
      <span className="avatar-name">{participant?.nickname || '익명'}</span>
    </div>
  );
}
