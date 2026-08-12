export function questionModePatch(session, activeQuestion = null) {
  const currentQuestionId = session?.currentQuestionId || null;
  const currentQuestion = activeQuestion?.id === currentQuestionId
    ? activeQuestion
    : (session?.questions || []).find((question) => question.id === currentQuestionId);
  const isArtworkActivityQuestion = Boolean(session?.stage?.questionId)
    && String(session.stage.questionId) === String(currentQuestionId);
  const shouldClearQuestion = currentQuestion?.internal === true || isArtworkActivityQuestion;

  return {
    currentQuestionId: shouldClearQuestion ? null : currentQuestionId,
    stage: { mode: shouldClearQuestion || !currentQuestionId ? 'lobby' : 'questions', page: 1, blackout: false },
  };
}
