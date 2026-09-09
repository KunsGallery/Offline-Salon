export function formatDateTime(value) {
  if (!value) return '방금 전';
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(value) {
  if (!value) return '미설정';
  return new Date(`${value}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

export function formatCompactTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function safeJoin(value) {
  if (Array.isArray(value)) return value.join(' | ');
  if (value == null) return '';
  return String(value);
}
