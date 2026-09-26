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

export const AVATAR_SPECIES = [
  { id: 'rat', label: '쥐', interest: '기록 수집가' },
  { id: 'ox', label: '소', interest: '책 제본가' },
  { id: 'tiger', label: '호랑이', interest: '극장 손님' },
  { id: 'rabbit', label: '토끼', interest: '식물 산책가' },
  { id: 'dragon', label: '용', interest: '지도 수집가' },
  { id: 'snake', label: '뱀', interest: '향기 수집가' },
  { id: 'horse', label: '말', interest: '도시 산책가' },
  { id: 'sheep', label: '양', interest: '직물 수집가' },
  { id: 'monkey', label: '원숭이', interest: '발명 애호가' },
  { id: 'rooster', label: '닭', interest: '신문 애호가' },
  { id: 'dog', label: '개', interest: '편지 수집가' },
  { id: 'pig', label: '돼지', interest: '차 애호가' },
];

export const AVATAR_VARIANTS = [
  { id: 'male', label: '남성형' },
  { id: 'female', label: '여성형' },
];

export const AVATAR_PROPS = [
  { id: 'none', label: '없음', scope: 'common' },
  { id: 'glasses', label: '둥근 안경', scope: 'common', index: 0 },
  { id: 'pocket-watch', label: '회중시계', scope: 'common', index: 1 },
  { id: 'leather-book', label: '가죽 책', scope: 'common', index: 2 },
  { id: 'pressed-flower', label: '압화', scope: 'common', index: 3 },
  { id: 'magnifier', label: '돋보기', scope: 'pear-play', index: 4 },
  { id: 'notebook', label: '단서 수첩', scope: 'pear-play', index: 5 },
  { id: 'evidence-envelope', label: '사건 봉투', scope: 'pear-play', index: 6 },
  { id: 'folded-map', label: '런던 지도', scope: 'pear-play', index: 7 },
  { id: 'compass', label: '나침반', scope: 'pear-play', index: 8 },
  { id: 'box-camera', label: '상자 카메라', scope: 'pear-play', index: 9 },
  { id: 'wax-seal', label: '밀랍 도장', scope: 'pear-play', index: 10 },
  { id: 'grape', label: '포도 브로치', scope: 'exhibition-grape', index: 11 },
];

const LEGACY_DEFAULT_AVATAR = { version: 2, shape: 'round', color: 'cobalt', expression: 'smile', accessory: 'none' };
export const DEFAULT_AVATAR = { version: 3, species: 'rat', variant: 'male', baseProp: 'none', moduleProps: {}, eventProp: 'none' };

export function getAvatarModule(session) {
  return (Array.isArray(session?.enabledModules) ? session.enabledModules : [])
    .find((moduleId) => AVATAR_PROPS.some((prop) => prop.scope === moduleId)) || null;
}

export function getAvatarProps(scope = 'common') {
  return AVATAR_PROPS.filter((prop) => prop.scope === scope);
}

export function getAvatarAccessories(session) {
  const moduleIds = Array.isArray(session?.enabledModules) ? session.enabledModules : [];
  return [...COMMON_ACCESSORIES, ...moduleIds.flatMap((id) => MODULE_ACCESSORIES[id] || [])];
}

export function normalizeAvatar(value) {
  const avatar = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (avatar.version === 3 || avatar.species) {
    const moduleProps = {};
    for (const moduleId of Object.keys(MODULE_ACCESSORIES)) {
      const selected = avatar.moduleProps?.[moduleId];
      if (selected === 'none' || getAvatarProps(moduleId).some((prop) => prop.id === selected)) moduleProps[moduleId] = selected;
    }
    return {
      version: 3,
      species: AVATAR_SPECIES.some((item) => item.id === avatar.species) ? avatar.species : DEFAULT_AVATAR.species,
      variant: AVATAR_VARIANTS.some((item) => item.id === avatar.variant) ? avatar.variant : DEFAULT_AVATAR.variant,
      baseProp: getAvatarProps().some((prop) => prop.id === avatar.baseProp) ? avatar.baseProp : 'none',
      moduleProps,
      eventProp: AVATAR_PROPS.some((prop) => prop.id === avatar.eventProp) ? avatar.eventProp : 'none',
    };
  }
  if (!Object.keys(avatar).length) return { ...DEFAULT_AVATAR, moduleProps: {} };
  return {
    version: 2,
    shape: AVATAR_SHAPES.some((item) => item.id === avatar.shape) ? avatar.shape : LEGACY_DEFAULT_AVATAR.shape,
    color: AVATAR_COLORS.some((item) => item.id === avatar.color) ? avatar.color : LEGACY_DEFAULT_AVATAR.color,
    expression: AVATAR_EXPRESSIONS.some((item) => item.id === avatar.expression) ? avatar.expression : LEGACY_DEFAULT_AVATAR.expression,
    accessory: ALL_ACCESSORIES.some((item) => item.id === avatar.accessory) ? avatar.accessory : LEGACY_DEFAULT_AVATAR.accessory,
  };
}

export function avatarForSession(value, session) {
  const avatar = normalizeAvatar(value);
  if (avatar.version === 3) {
    const moduleId = getAvatarModule(session);
    return { ...avatar, eventProp: moduleId ? avatar.moduleProps[moduleId] || 'none' : 'none' };
  }
  return getAvatarAccessories(session).some((item) => item.id === avatar.accessory)
    ? avatar
    : { ...avatar, accessory: 'none' };
}

export function randomAvatar(session) {
  const pick = (items) => items[Math.floor(Math.random() * items.length)].id;
  const moduleId = getAvatarModule(session);
  const baseProp = pick(getAvatarProps());
  const eventProp = moduleId ? pick([{ id: 'none' }, ...getAvatarProps(moduleId)]) : 'none';
  return { version: 3, species: pick(AVATAR_SPECIES), variant: pick(AVATAR_VARIANTS), baseProp, moduleProps: moduleId ? { [moduleId]: eventProp } : {}, eventProp };
}
