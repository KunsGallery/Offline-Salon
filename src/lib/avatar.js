export const AVATAR_COLORS = [
  { id: 'berry', label: '베리', value: '#B95F78', accent: '#F1C1AE' },
  { id: 'cobalt', label: '코발트', value: '#315EAA', accent: '#A8D4E8' },
  { id: 'moss', label: '모스', value: '#627A45', accent: '#D6D88B' },
  { id: 'amber', label: '앰버', value: '#C27732', accent: '#F1D28E' },
  { id: 'violet', label: '바이올렛', value: '#72589B', accent: '#D3BDE5' },
  { id: 'coral', label: '코럴', value: '#C46458', accent: '#F5D6B7' },
  { id: 'teal', label: '틸', value: '#287E83', accent: '#C5E6D8' },
  { id: 'ink', label: '잉크', value: '#3C4552', accent: '#E4D8CB' },
];

export const AVATAR_SHAPES = [
  { id: 'round', label: '동그라미' },
  { id: 'arch', label: '아치' },
  { id: 'diamond', label: '다이아몬드' },
  { id: 'oval', label: '타원' },
  { id: 'square', label: '네모' },
];

export const AVATAR_EXPRESSIONS = [
  { id: 'smile', label: '미소' },
  { id: 'curious', label: '호기심' },
  { id: 'calm', label: '차분함' },
  { id: 'bright', label: '활짝' },
];

const COMMON_ACCESSORIES = [
  { id: 'none', label: '없음' },
  { id: 'glasses', label: '안경' },
  { id: 'beret', label: '베레모' },
  { id: 'scarf', label: '스카프' },
  { id: 'flower', label: '꽃' },
];

const MODULE_ACCESSORIES = {
  'pear-play': [
    { id: 'detective-hat', label: '탐정 모자' },
    { id: 'magnifier', label: '돋보기' },
    { id: 'notebook', label: '수첩' },
  ],
  'exhibition-grape': [{ id: 'grape', label: '포도 배지' }],
};

const ALL_ACCESSORIES = [...COMMON_ACCESSORIES, ...Object.values(MODULE_ACCESSORIES).flat()];

export const DEFAULT_AVATAR = { version: 2, shape: 'round', color: 'cobalt', expression: 'smile', accessory: 'none' };

export function getAvatarAccessories(session) {
  const moduleIds = Array.isArray(session?.enabledModules) ? session.enabledModules : [];
  return [...COMMON_ACCESSORIES, ...moduleIds.flatMap((id) => MODULE_ACCESSORIES[id] || [])];
}

export function normalizeAvatar(value) {
  const avatar = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    version: 2,
    shape: AVATAR_SHAPES.some((item) => item.id === avatar.shape) ? avatar.shape : DEFAULT_AVATAR.shape,
    color: AVATAR_COLORS.some((item) => item.id === avatar.color) ? avatar.color : DEFAULT_AVATAR.color,
    expression: AVATAR_EXPRESSIONS.some((item) => item.id === avatar.expression) ? avatar.expression : DEFAULT_AVATAR.expression,
    accessory: ALL_ACCESSORIES.some((item) => item.id === avatar.accessory) ? avatar.accessory : DEFAULT_AVATAR.accessory,
  };
}

export function avatarForSession(value, session) {
  const avatar = normalizeAvatar(value);
  return getAvatarAccessories(session).some((item) => item.id === avatar.accessory)
    ? avatar
    : { ...avatar, accessory: 'none' };
}

export function randomAvatar(session) {
  const pick = (items) => items[Math.floor(Math.random() * items.length)].id;
  return {
    version: 2,
    shape: pick(AVATAR_SHAPES),
    color: pick(AVATAR_COLORS),
    expression: pick(AVATAR_EXPRESSIONS),
    accessory: pick(getAvatarAccessories(session)),
  };
}
