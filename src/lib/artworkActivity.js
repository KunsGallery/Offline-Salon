export function findArtworkActivityQuestion(session, artwork) {
  const questions = (session?.questions || []).filter((question) => question.type === 'artwork-title' && question.artworkId === artwork?.id);
  if (artwork?.adoptedQuestionId) {
    const adoptedQuestion = questions.find((question) => question.id === artwork.adoptedQuestionId);
    if (adoptedQuestion) return adoptedQuestion;
  }
  return [...questions].sort((a, b) => (b.order ?? 0) - (a.order ?? 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

export function artworkReveal(artwork, secret = {}) {
  return {
    title: artwork?.adoptedTitle || secret.title || '',
    artist: secret.artist || '',
    description: secret.description || '',
  };
}
