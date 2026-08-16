export const SESSION_MODULES = [
  {
    id: 'exhibition-grape',
    title: '전시 포도',
    description: '참여자가 전시 사진과 감상을 포도알로 만들고 함께 모아봅니다.',
  },
];

export function normalizeSessionModules(value) {
  if (!Array.isArray(value)) return [];
  const known = new Set(SESSION_MODULES.map((module) => module.id));
  return [...new Set(value.filter((id) => known.has(id)))];
}

export function hasSessionModule(session, moduleId) {
  return normalizeSessionModules(session?.enabledModules).includes(moduleId);
}
