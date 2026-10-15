export function preparedPearCase(session) {
  const id = session?.stage?.pearPreparedCaseId;
  const item = (session?.pearPreparedCases || []).find((entry) => entry.id === id);
  if (!item || item.pearPairing?.status !== 'ready' || !item.pearPairing.finalArtwork?.imageUrl) return null;
  return { ...item, participantId: item.id, nickname: item.title || '사전 준비 사진', isPrepared: true };
}

export function preparedPearStatus(item) {
  const pairing = item.pearPairing;
  return pairing?.status === 'ready' && pairing.finalArtwork?.imageUrl ? '조사 완료' : pairing?.status === 'investigating' ? '조사 진행 중 · 다시 조사 가능' : pairing?.status === 'error' ? '조사 실패 · 다시 시도 가능' : '조사 대기';
}
