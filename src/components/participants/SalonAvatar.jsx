import React from 'react';

export const AVATAR_COLORS = [
  { id: 'berry', label: '베리', value: '#B95F78', accent: '#F1C1AE' },
  { id: 'cobalt', label: '코발트', value: '#315EAA', accent: '#A8D4E8' },
  { id: 'moss', label: '모스', value: '#627A45', accent: '#D6D88B' },
  { id: 'amber', label: '앰버', value: '#C27732', accent: '#F1D28E' },
  { id: 'violet', label: '바이올렛', value: '#72589B', accent: '#D3BDE5' },
];

export const AVATAR_SHAPES = [
  { id: 'round', label: '동그라미' },
  { id: 'arch', label: '아치' },
  { id: 'diamond', label: '다이아몬드' },
];

export const DEFAULT_AVATAR = { shape: 'round', color: 'cobalt' };

export function resolveAvatar(avatar = DEFAULT_AVATAR) {
  const palette = AVATAR_COLORS.find((item) => item.id === avatar?.color) || AVATAR_COLORS[1];
  return { shape: avatar?.shape || DEFAULT_AVATAR.shape, ...palette };
}

export default function SalonAvatar({ avatar, label = '', compact = false }) {
  const resolved = resolveAvatar(avatar);
  const head = resolved.shape === 'arch'
    ? <path d="M22 43V28C22 14.7 32.7 4 46 4s24 10.7 24 24v15H22Z" />
    : resolved.shape === 'diamond'
      ? <path d="m46 3 27 24-27 24-27-24L46 3Z" />
      : <circle cx="46" cy="28" r="25" />;

  return (
    <span className={`salon-avatar ${compact ? 'compact' : ''}`} style={{ '--avatar-main': resolved.value, '--avatar-accent': resolved.accent }} aria-label={label || '참여자 캐릭터'}>
      <svg viewBox="0 0 92 112" role="img" aria-hidden="true">
        <ellipse className="avatar-ground" cx="46" cy="104" rx="31" ry="6" />
        <g className="avatar-body-shape"><path d="M14 105V83c0-19 14.3-32 32-32s32 13 32 32v22H14Z" /><path className="avatar-collar" d="m30 57 16 17 16-17" /></g>
        <g className="avatar-head-shape">{head}<circle className="avatar-face" cx="46" cy="30" r="18" /><circle className="avatar-eye" cx="40" cy="29" r="1.7" /><circle className="avatar-eye" cx="52" cy="29" r="1.7" /><path className="avatar-smile" d="M41 36c3 3 7 3 10 0" /></g>
      </svg>
      {label ? <b>{label}</b> : null}
    </span>
  );
}
