export function formatDateTime(value) {
  if (!value) return '방금 전';
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
