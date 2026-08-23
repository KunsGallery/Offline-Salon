export const MONTH_LABELS = {
  5: '5월',
  6: '6월',
  7: '7월',
  8: '8월',
  9: '9월',
  10: '10월',
  11: '11월',
};

export const ORIGIN_LABELS = {
  domestic: '국내 작가',
  international: '국외 작가',
  mixed: '국내·국외 혼합',
};

export const SEOUL_EXHIBITION_REFERENCES = [
  {
    id: 'leeum-inside-other-spaces',
    title: '다른 공간 안으로: 여성 작가들의 공감각적 환경 1956-1976',
    venue: '리움미술관',
    district: '용산구',
    area: '한남동',
    region: '한남·용산',
    startDate: '2026-05-05',
    endDate: '2026-11-29',
    artistOrigin: 'mixed',
    categoryTags: ['설치', '여성작가', '몰입형', '동시대'],
    sourceUrl: 'https://www.leeumhoam.org/leeum/exhibition/93',
  },
  {
    id: 'leeum-koo-jeong-a-usmos',
    title: '구정아: 우스모스',
    venue: '리움미술관 M2',
    district: '용산구',
    area: '한남동',
    region: '한남·용산',
    startDate: '2026-09-05',
    endDate: '2026-12-27',
    artistOrigin: 'domestic',
    categoryTags: ['설치', '동시대', '몰입형'],
    sourceUrl: 'https://www.leeumhoam.org/leeum/exhibition/94',
  },
  {
    id: 'mmca-korea-artist-prize-2026',
    title: '올해의 작가상 2026',
    venue: '국립현대미술관 서울',
    district: '종로구',
    area: '소격동',
    region: '삼청·종로',
    startDate: '2026-07-24',
    endDate: '2026-12-06',
    artistOrigin: 'domestic',
    categoryTags: ['동시대', '작가상', '복합매체'],
    sourceUrl: 'https://www.mmca.go.kr/eng/exhibitions/futureProgressList.do',
  },
  {
    id: 'mmca-christine-sun-kim',
    title: 'MMCA × LG OLED Series 2026: Christine Sun Kim',
    venue: '국립현대미술관 서울',
    district: '종로구',
    area: '소격동',
    region: '삼청·종로',
    startDate: '2026-07-31',
    endDate: '2026-11-29',
    artistOrigin: 'international',
    categoryTags: ['미디어', '동시대', '사운드', '접근성'],
    sourceUrl: 'https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do?exhFlag=2&exhId=202601060002028',
  },
  {
    id: 'mmca-do-ho-suh',
    title: '서도호',
    venue: '국립현대미술관 서울',
    district: '종로구',
    area: '소격동',
    region: '삼청·종로',
    startDate: '2026-08-27',
    endDate: '2027-02-09',
    artistOrigin: 'domestic',
    categoryTags: ['설치', '건축', '기억', '동시대'],
    sourceUrl: 'https://www.mmca.go.kr/eng/exhibitions/futureProgressList.do',
  },
  {
    id: 'mmca-not-conceptual-art',
    title: '이것은 개념미술이 (아니)다',
    venue: '국립현대미술관 서울',
    district: '종로구',
    area: '소격동',
    region: '삼청·종로',
    startDate: '2026-06-19',
    endDate: '2026-10-11',
    artistOrigin: 'mixed',
    categoryTags: ['개념미술', '아카이브', '동시대'],
    sourceUrl: 'https://www.mmca.go.kr/eng/exhibitions/futureProgressList.do',
  },
  {
    id: 'sema-yoo-youngkuk',
    title: '유영국: 산은 내 안에 있다',
    venue: '서울시립미술관 서소문본관',
    district: '중구',
    area: '서소문',
    region: '중구·시청',
    startDate: '2026-05-19',
    endDate: '2026-10-25',
    artistOrigin: 'domestic',
    categoryTags: ['회화', '한국근현대', '추상'],
    sourceUrl: 'https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1529410',
  },
  {
    id: 'sema-cho-sook-jin',
    title: '조숙진: 지나가는 자리',
    venue: '서울시립 남서울미술관',
    district: '관악구',
    area: '남현동',
    region: '관악·남서울',
    startDate: '2026-07-29',
    endDate: '2026-11-15',
    artistOrigin: 'domestic',
    categoryTags: ['설치', '조각', '동시대'],
    sourceUrl: 'https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1556711',
  },
  {
    id: 'sema-kwon-byung-jun',
    title: '권병준: 내 마음속에 너는',
    venue: '서울시립 북서울미술관',
    district: '노원구',
    area: '중계동',
    region: '북서울',
    startDate: '2026-06-11',
    endDate: '2027-05-16',
    artistOrigin: 'domestic',
    categoryTags: ['사운드', '미디어', '동시대'],
    sourceUrl: 'https://sema.seoul.go.kr/kr/whatson/exhibition/list',
  },
  {
    id: 'sema-title-match-human-error',
    title: '오인환 vs. 장서영: 휴먼 에러',
    venue: '서울시립 북서울미술관',
    district: '노원구',
    area: '중계동',
    region: '북서울',
    startDate: '2026-08-13',
    endDate: '2026-10-25',
    artistOrigin: 'domestic',
    categoryTags: ['동시대', '타이틀매치', '복합매체'],
    sourceUrl: 'https://news.seoul.go.kr/culture/archives/533635',
  },
  {
    id: 'sema-kim-heechoen-moles',
    title: '김희천: 두더지들',
    venue: '서울시립미술관',
    district: '중구',
    area: '서소문',
    region: '중구·시청',
    startDate: '2026-08-20',
    endDate: '2026-11-08',
    artistOrigin: 'domestic',
    categoryTags: ['영상', '동시대', '미디어'],
    sourceUrl: 'https://news.seoul.go.kr/culture/archives/533635',
  },
  {
    id: 'pompidou-cubists',
    title: '큐비스트: 시각의 혁신가들',
    venue: '퐁피두센터 한화 서울',
    district: '영등포구',
    area: '여의도',
    region: '여의도',
    startDate: '2026-06-04',
    endDate: '2026-10-04',
    artistOrigin: 'international',
    categoryTags: ['근대미술', '큐비즘', '해외미술'],
    sourceUrl: 'https://www.centrepompidou-hanwha.kr/exhibition/detail?seq=96&status=INACTIVE',
  },
  {
    id: 'lotte-lee-kang-so',
    title: '이강소: 일어나고 사라지는',
    venue: '롯데뮤지엄',
    district: '송파구',
    area: '잠실',
    region: '잠실·송파',
    startDate: '2026-08-21',
    endDate: '2026-11-01',
    artistOrigin: 'domestic',
    categoryTags: ['회화', '조각', '한국현대'],
    sourceUrl: 'https://www.lottemuseum.com/ko',
  },
  {
    id: 'gallery-hyundai-kim-bohie',
    title: 'Kim Bohie: TOWARDS: There Was Light',
    venue: '갤러리현대',
    district: '종로구',
    area: '삼청동',
    region: '삼청·종로',
    startDate: '2026-08-26',
    endDate: '2026-10-18',
    artistOrigin: 'domestic',
    categoryTags: ['회화', '갤러리', '동시대'],
    sourceUrl: 'https://www.galleryhyundai.com/exhibition/view/12',
  },
  {
    id: 'gallery-hyundai-christine-sun-kim',
    title: 'Christine Sun Kim: Moon Mind',
    venue: '갤러리현대',
    district: '종로구',
    area: '삼청동',
    region: '삼청·종로',
    startDate: '2026-08-26',
    endDate: '2026-10-18',
    artistOrigin: 'international',
    categoryTags: ['드로잉', '사운드', '갤러리'],
    sourceUrl: 'https://www.galleryhyundai.com/exhibition/view/11',
  },
  {
    id: 'artsonje-kim-muyeong-pig',
    title: '김무영: Pig',
    venue: '아트선재센터',
    district: '종로구',
    area: '소격동',
    region: '삼청·종로',
    startDate: '2026-08-28',
    endDate: '2026-10-04',
    artistOrigin: 'domestic',
    categoryTags: ['동시대', '영상', '설치'],
    sourceUrl: 'https://artsonje.org/exhibition/muyeong-kim-pig-kr/',
  },
  {
    id: 'nmok-chusa-kim-jeong-hui',
    title: '추사 김정희와 그의 동반자',
    venue: '국립중앙박물관',
    district: '용산구',
    area: '이촌동',
    region: '한남·용산',
    startDate: '2026-08-11',
    endDate: '2026-11-22',
    artistOrigin: 'domestic',
    categoryTags: ['서예', '고미술', '역사'],
    sourceUrl: 'https://www.museum.go.kr/MUSEUM/contents/M0202020000.do?exhiSpThemId=3672087&listType=list&menuId=upcomming&schM=view',
  },
  {
    id: 'nmok-islamic-art-light',
    title: '이슬람 미술, 찬란한 빛의 여정',
    venue: '국립중앙박물관',
    district: '용산구',
    area: '이촌동',
    region: '한남·용산',
    startDate: '2025-11-22',
    endDate: '2026-10-11',
    artistOrigin: 'international',
    categoryTags: ['고미술', '해외미술', '공예'],
    sourceUrl: 'https://www.museum.go.kr/MUSEUM/contents/M0701040000.do?arcId=23234&catCustomType=post&schM=view',
  },
  {
    id: 'seoul-sculpture-festival-2026',
    title: '서울조각페스티벌 2026',
    venue: '서울 주요 야외 전시장',
    district: '서울 전역',
    area: '도심·공공공간',
    region: '서울 전역',
    startDate: '2026-08-29',
    endDate: '2026-11-30',
    artistOrigin: 'mixed',
    categoryTags: ['조각', '공공미술', '야외전시'],
    sourceUrl: 'https://news.seoul.go.kr/culture/archives/533635',
  },
];

function clampReferenceMonth(month) {
  const value = Number(month);
  return value >= 5 && value <= 11 ? value : null;
}

export function monthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit) {
    const month = clampReferenceMonth(cursor.getMonth() + 1);
    if (month && !months.includes(month)) months.push(month);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function normalizeExhibitionReference(reference, index = 0) {
  if (!reference) return null;
  const startDate = reference.startDate || '';
  const endDate = reference.endDate || '';
  const monthTags = Array.isArray(reference.monthTags) && reference.monthTags.length
    ? reference.monthTags.map(clampReferenceMonth).filter(Boolean)
    : monthsBetween(startDate, endDate);
  const title = String(reference.title || '').trim();
  if (!title) return null;
  return {
    id: String(reference.id || `custom-exhibition-${index + 1}`).trim(),
    title,
    venue: String(reference.venue || '').trim(),
    district: String(reference.district || '').trim(),
    area: String(reference.area || '').trim(),
    region: String(reference.region || reference.regionGroup || '직접 등록').trim(),
    startDate,
    endDate,
    monthTags,
    artistOrigin: ORIGIN_LABELS[reference.artistOrigin] ? reference.artistOrigin : 'mixed',
    categoryTags: Array.isArray(reference.categoryTags) ? reference.categoryTags.map(String).filter(Boolean) : [],
    sourceUrl: String(reference.sourceUrl || '').trim(),
    createdAt: reference.createdAt || null,
    updatedAt: reference.updatedAt || null,
    custom: reference.custom === true,
  };
}

export function normalizeSessionExhibitionReferences(value) {
  return Array.isArray(value) ? value.map(normalizeExhibitionReference).filter(Boolean) : [];
}

export function resolveExhibitionReferences(session) {
  const defaults = SEOUL_EXHIBITION_REFERENCES.map(normalizeExhibitionReference).filter(Boolean);
  const custom = normalizeSessionExhibitionReferences(session?.exhibitionReferences);
  const byId = new Map(defaults.map((reference) => [reference.id, reference]));
  custom.forEach((reference) => byId.set(reference.id, { ...byId.get(reference.id), ...reference, custom: true }));
  return [...byId.values()];
}

export function findReference(references, id) {
  if (!id) return null;
  return (references || []).find((reference) => reference.id === id) || null;
}

export function formatMonthTags(monthTags = []) {
  const tags = monthTags.map((month) => MONTH_LABELS[month]).filter(Boolean);
  if (!tags.length) return '월 정보 없음';
  if (tags.length <= 2) return tags.join('·');
  return `${tags[0]}–${tags[tags.length - 1]}`;
}

export function formatDateRange(reference) {
  const start = reference?.startDate?.slice(5).replace('-', '.') || '';
  const end = reference?.endDate?.slice(5).replace('-', '.') || '';
  return start && end ? `${start}–${end}` : start || end || '기간 미정';
}

export function selectionReferenceMeta(selection, references = []) {
  const reference = findReference(references, selection?.referenceId);
  return {
    reference,
    region: selection?.region || reference?.region || '직접 등록',
    district: selection?.district || reference?.district || '',
    area: selection?.area || reference?.area || '',
    monthTags: Array.isArray(selection?.monthTags) && selection.monthTags.length ? selection.monthTags : reference?.monthTags || [],
    artistOrigin: selection?.artistOrigin || reference?.artistOrigin || 'mixed',
    categoryTags: Array.isArray(selection?.categoryTags) && selection.categoryTags.length ? selection.categoryTags : reference?.categoryTags || [],
  };
}

export function summarizeExhibitionSelections(participants = [], references = []) {
  const selections = participants.flatMap((participant) =>
    Object.values(participant?.grapeSelections || {})
      .filter((selection) => selection?.title && selection?.photoUrl)
      .map((selection) => ({ ...selection, participantId: participant.participantId, nickname: participant.nickname })),
  );
  const groups = {
    region: new Map(),
    month: new Map(),
    origin: new Map(),
    category: new Map(),
  };
  const bump = (map, key, label, selection) => {
    const id = key || 'unknown';
    const current = map.get(id) || { id, label: label || id, count: 0, ratings: [] };
    current.count += 1;
    current.ratings.push(Number(selection.rating || 0));
    map.set(id, current);
  };
  selections.forEach((selection) => {
    const meta = selectionReferenceMeta(selection, references);
    bump(groups.region, meta.region, meta.region, selection);
    (meta.monthTags.length ? meta.monthTags : ['unknown']).forEach((month) => bump(groups.month, month, MONTH_LABELS[month] || '월 정보 없음', selection));
    bump(groups.origin, meta.artistOrigin, ORIGIN_LABELS[meta.artistOrigin] || '분류 미정', selection);
    (meta.categoryTags.length ? meta.categoryTags : ['직접 등록']).forEach((tag) => bump(groups.category, tag, tag, selection));
  });
  const finish = (map) => [...map.values()]
    .map((item) => ({ ...item, average: item.ratings.length ? item.ratings.reduce((sum, value) => sum + value, 0) / item.ratings.length : 0 }))
    .sort((a, b) => b.count - a.count || b.average - a.average || String(a.label).localeCompare(String(b.label), 'ko-KR'));
  return {
    total: selections.length,
    participantCount: new Set(selections.map((selection) => selection.participantId)).size,
    region: finish(groups.region),
    month: finish(groups.month),
    origin: finish(groups.origin),
    category: finish(groups.category),
  };
}
