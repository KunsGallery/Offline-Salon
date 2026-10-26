import React, { useEffect, useMemo, useRef, useState } from 'react';

// Detective P narrates the investigation as film subtitles. Lines come from three sources:
// the quick first look at the photo (notes), the real web searches the model runs (queries),
// and scripted lines that fill any silence. Each line is said once, in order of arrival.

const STAGE_LABEL = { observing: '관찰', searching: '탐색', verifying: '검증' };

const QUERY_REMARKS = [
  '첫 번째 단서로 기록을 뒤져 봅니다.',
  '범위를 좁혀 보죠.',
  '이쪽이 더 가깝습니다.',
];

const FILLERS = {
  observing: [
    '서두르지 않겠습니다. 빛이 어디서 들어오는지부터 보죠.',
    '이 장면엔 말하지 않은 이야기가 하나 숨어 있어요.',
    '가장자리까지 천천히 훑어보겠습니다.',
  ],
  searching: [
    '닮은 시선을 가진 그림을 기록 보관소에서 찾고 있습니다.',
    '한 장, 또 한 장… 닮은 건 많지만 같은 마음은 드물죠.',
    '조금만 더요. 거의 다 왔습니다.',
  ],
  verifying: [
    '작가와 연도를 기록과 맞춰 보는 중입니다.',
    '확인이 끝나면 바로 보여드릴게요.',
  ],
};

export function buildDetectiveLines({ nickname = '', notes = [], queries = [], step = 'observing' }) {
  const lines = [{ key: 'open', stage: '관찰', text: nickname ? `흠… ${nickname}님의 사건 사진이군요.` : '흠… 오늘의 사건 사진이군요.' }];
  notes.forEach((note, index) => lines.push({ key: `note-${index}`, stage: '관찰', text: note.text, note }));
  queries.forEach((query, index) => {
    lines.push({ key: `query-${index}`, stage: '탐색', text: `검색 · ${query}`, search: true });
    if (QUERY_REMARKS[index]) lines.push({ key: `remark-${index}`, stage: '탐색', text: QUERY_REMARKS[index] });
  });
  if (step === 'verifying') lines.push({ key: 'verify', stage: '검증', text: '후보가 좁혀졌습니다. 출처를 맞춰 보겠습니다.' });
  return lines;
}

function holdFor(text) {
  const length = [...String(text || '')].length;
  return Math.min(5600, Math.max(3000, 1800 + length * 90)) + length * 38;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Returns the line on screen now plus every note already said (for clue chips).
export function useDetectiveCaption(lines, step) {
  const played = useRef(new Set());
  const fillerCount = useRef(0);
  const [current, setCurrent] = useState(null);
  const [saidNotes, setSaidNotes] = useState([]);
  const linesRef = useRef(lines);
  const stepRef = useRef(step);
  linesRef.current = lines;
  stepRef.current = step;

  const advance = () => {
    const next = linesRef.current.find((line) => !played.current.has(line.key));
    if (next) {
      played.current.add(next.key);
      if (next.note) setSaidNotes((notes) => [...notes, next.note]);
      setCurrent(next);
      return;
    }
    const pool = FILLERS[stepRef.current] || FILLERS.searching;
    const index = fillerCount.current;
    fillerCount.current += 1;
    setCurrent({ key: `filler-${index}`, stage: STAGE_LABEL[stepRef.current] || '탐색', text: pool[index % pool.length] });
  };

  const started = useRef(false);
  useEffect(() => {
    if (!current) {
      // Guarded so StrictMode's repeated effect run does not skip the opening line.
      if (!started.current) {
        started.current = true;
        advance();
      }
      return undefined;
    }
    const timer = window.setTimeout(advance, holdFor(current.text));
    return () => window.clearTimeout(timer);
  }, [current?.key]);

  // A filler gives way as soon as real narration arrives.
  const hasUnplayed = lines.some((line) => !played.current.has(line.key));
  useEffect(() => {
    if (current?.key.startsWith('filler-') && hasUnplayed) {
      const timer = window.setTimeout(advance, 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [current?.key, hasUnplayed]);

  return { line: current, saidNotes };
}

export function TypedLine({ text, className = '' }) {
  const characters = useMemo(() => [...String(text || '')], [text]);
  const [count, setCount] = useState(() => (prefersReducedMotion() ? characters.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(characters.length);
      return undefined;
    }
    setCount(0);
    const timer = window.setInterval(() => setCount((value) => {
      if (value >= characters.length) {
        window.clearInterval(timer);
        return value;
      }
      return value + 1;
    }), 38);
    return () => window.clearInterval(timer);
  }, [characters]);
  const done = count >= characters.length;
  return <span className={`detective-typed ${className}`} aria-label={text}>
    <span aria-hidden="true">{characters.slice(0, count).join('')}{done ? null : <i className="detective-typed-cursor" />}</span>
  </span>;
}

// The closing observation sums up the whole photo and sits at the centre (50, 50); it gets
// no lens or slip so it does not cover the clues already pinned.
const isSummary = (note) => Number(note?.x) === 50 && Number(note?.y) === 50;

export function DetectiveLens({ photoUrl, note }) {
  if (!note || isSummary(note)) return null;
  const x = Math.min(95, Math.max(5, Number(note.x) || 50));
  const y = Math.min(95, Math.max(5, Number(note.y) || 50));
  return <span className="detective-lens" style={{ left: `${x}%`, top: `${y}%`, backgroundImage: `url("${photoUrl}")`, backgroundPosition: `${x}% ${y}%` }} aria-hidden="true" />;
}

export function DetectiveClueChips({ notes }) {
  return notes.filter((note) => note.clue && !isSummary(note)).map((note, index) => {
    const left = Number(note.x) < 50;
    return <span key={`${note.clue}-${index}`} className={`detective-clue ${left ? 'is-left' : 'is-right'}`} style={{ top: `${Math.min(88, Math.max(6, Number(note.y) || 50))}%`, '--clue-tilt': `${index % 2 ? 3 : -3}deg` }}>{note.clue}</span>;
  });
}
