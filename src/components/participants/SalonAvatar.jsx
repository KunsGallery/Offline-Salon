import React from 'react';
import { AVATAR_COLORS, AVATAR_PROPS, AVATAR_SPECIES, AVATAR_VARIANTS, normalizeAvatar } from '../../lib/avatar';

export { AVATAR_COLORS, AVATAR_SHAPES, AVATAR_EXPRESSIONS, DEFAULT_AVATAR, AVATAR_SPECIES, AVATAR_VARIANTS } from '../../lib/avatar';

export function resolveAvatar(avatar) {
  const resolved = normalizeAvatar(avatar);
  if (resolved.version === 3) return resolved;
  return { ...resolved, ...AVATAR_COLORS.find((item) => item.id === resolved.color) };
}

function spriteStyle(index, compact = false) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const crop = compact ? 250 : 362;
  const inset = compact ? 56 : 0;
  return {
    width: `${(1448 / crop) * 100}%`,
    left: `${-((column * 362 + inset) / crop) * 100}%`,
    top: `${-((row * 362 + (compact ? 12 : 0)) / crop) * 100}%`,
  };
}

export function AvatarPropArt({ id }) {
  const prop = AVATAR_PROPS.find((item) => item.id === id);
  if (!prop || prop.index === undefined) return null;
  return <span className="avatar-prop-art" aria-hidden="true"><img src="/avatars/props.webp" alt="" style={spriteStyle(prop.index)} /></span>;
}

function ZodiacAvatar({ avatar, label, compact }) {
  const speciesIndex = AVATAR_SPECIES.findIndex((item) => item.id === avatar.species);
  const species = AVATAR_SPECIES[speciesIndex];
  const variant = AVATAR_VARIANTS.find((item) => item.id === avatar.variant);
  const index = (speciesIndex % 6) * 2 + (avatar.variant === 'female' ? 1 : 0);
  const sheet = speciesIndex < 6 ? '01' : '02';
  const propNames = [avatar.baseProp, avatar.eventProp].filter((id) => id && id !== 'none')
    .map((id) => AVATAR_PROPS.find((item) => item.id === id)?.label).filter(Boolean);
  const description = `${label ? `${label}, ` : ''}${species.label} ${variant.label} 캐릭터${propNames.length ? `, ${propNames.join('와 ')}` : ''}`;
  return <span className={`salon-avatar illustrated ${compact ? 'compact' : ''}`} role="img" aria-label={description}>
    <span className="avatar-art-window"><img src={`/avatars/zodiac-${sheet}.webp`} alt="" aria-hidden="true" style={spriteStyle(index, compact)} /></span>
    {avatar.baseProp !== 'none' ? <span className="avatar-equipped-prop is-base"><AvatarPropArt id={avatar.baseProp} /></span> : null}
    {avatar.eventProp !== 'none' ? <span className="avatar-equipped-prop is-event"><AvatarPropArt id={avatar.eventProp} /></span> : null}
    {label ? <b aria-hidden="true">{label}</b> : null}
  </span>;
}

function AvatarAccessory({ type }) {
  if (type === 'glasses') return <g className="avatar-accessory-glasses"><circle cx="39" cy="29" r="6" /><circle cx="53" cy="29" r="6" /><path d="M45 28h2M33 28l-5-2M59 28l5-2" /></g>;
  if (type === 'beret') return <g className="avatar-accessory-hat"><ellipse cx="44" cy="11" rx="24" ry="9" /><path d="M30 9c-2-9 5-14 17-14 10 0 18 5 18 14" /><circle cx="47" cy="-5" r="2" /></g>;
  if (type === 'detective-hat') return <g className="avatar-accessory-hat"><path d="M23 10c1-12 10-18 23-18s22 6 23 18l-7 4H30Z" /><path d="M21 13c8-5 42-5 50 0l-8 5H29Z" /><path d="M46-7v17" /></g>;
  if (type === 'scarf') return <g className="avatar-accessory-scarf"><path d="M28 57c12 8 24 8 36 0l-4 10c-11 7-20 7-29 0Z" /><path d="M52 63l8 22-9-4-4-16" /></g>;
  if (type === 'flower') return <g className="avatar-accessory-flower"><circle cx="68" cy="16" r="5" /><circle cx="77" cy="16" r="5" /><circle cx="72.5" cy="9" r="5" /><circle cx="72.5" cy="23" r="5" /><circle className="avatar-flower-center" cx="72.5" cy="16" r="4" /></g>;
  if (type === 'magnifier') return <g className="avatar-accessory-tool"><circle cx="75" cy="61" r="11" /><path d="m67 69-13 17" /></g>;
  if (type === 'notebook') return <g className="avatar-accessory-notebook"><rect x="60" y="69" width="19" height="24" rx="2" /><path d="M64 75h11M64 80h9M64 85h8" /></g>;
  if (type === 'grape') return <g className="avatar-accessory-grape"><circle cx="68" cy="69" r="5" /><circle cx="77" cy="69" r="5" /><circle cx="72" cy="77" r="5" /><path d="m72 65 4-5" /></g>;
  return null;
}

export default function SalonAvatar({ avatar, label = '', compact = false }) {
  const resolved = resolveAvatar(avatar);
  if (resolved.version === 3) return <ZodiacAvatar avatar={resolved} label={label} compact={compact} />;
  const head = resolved.shape === 'arch'
    ? <path d="M22 43V28C22 14.7 32.7 4 46 4s24 10.7 24 24v15H22Z" />
    : resolved.shape === 'diamond'
      ? <path d="m46 3 27 24-27 24-27-24L46 3Z" />
      : resolved.shape === 'oval'
        ? <ellipse cx="46" cy="28" rx="21" ry="29" />
        : resolved.shape === 'square'
          ? <rect x="21" y="3" width="50" height="49" rx="13" />
          : <circle cx="46" cy="28" r="25" />;
  const mouth = resolved.expression === 'curious'
    ? <circle className="avatar-mouth" cx="46" cy="37" r="2.3" />
    : resolved.expression === 'calm'
      ? <path className="avatar-smile" d="M42 37h8" />
      : resolved.expression === 'bright'
        ? <path className="avatar-smile" d="M38 35c3 8 13 8 16 0" />
        : <path className="avatar-smile" d="M41 36c3 3 7 3 10 0" />;

  return (
    <span className={`salon-avatar ${compact ? 'compact' : ''}`} style={{ '--avatar-main': resolved.value, '--avatar-accent': resolved.accent }} role="img" aria-label={label ? `${label} 캐릭터` : '참여자 캐릭터'}>
      <svg viewBox="0 -10 92 122" aria-hidden="true" focusable="false">
        <ellipse className="avatar-ground" cx="46" cy="104" rx="31" ry="6" />
        <g className="avatar-body-shape"><path d="M14 105V83c0-19 14.3-32 32-32s32 13 32 32v22H14Z" /><path className="avatar-collar" d="m30 57 16 17 16-17" /><circle className="avatar-coat-button" cx="46" cy="87" r="2" /></g>
        <g className="avatar-head-shape">{head}<circle className="avatar-face" cx="46" cy="30" r="18" /><circle className="avatar-eye" cx="40" cy="29" r="1.7" /><circle className="avatar-eye" cx="52" cy="29" r="1.7" />{mouth}</g>
        <AvatarAccessory type={resolved.accessory} />
      </svg>
    {label ? <b aria-hidden="true">{label}</b> : null}
    </span>
  );
}
