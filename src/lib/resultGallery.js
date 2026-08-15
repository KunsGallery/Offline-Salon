import { safeJoin } from './format';

export function buildResultGallery(session, questions = [], responses = [], participants = []) {
  const galleryQuestions = questions.filter((question) => question.includeInGallery === true && question.internal !== true);
  const questionById = new Map(galleryQuestions.map((question) => [question.id, question]));
  const participantById = new Map(participants.map((participant) => [participant.participantId, participant]));
  const groups = new Map();

  responses
    .filter((response) => response.hidden !== true && questionById.has(response.questionId))
    .forEach((response) => {
      const participant = participantById.get(response.participantId);
      const key = response.participantId || `anonymous:${response.nickname || response.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          participantId: response.participantId || '',
          nickname: response.nickname || participant?.nickname || '익명 참여자',
          avatar: participant?.avatar || null,
          results: [],
          likes: 0,
        });
      }
      const question = questionById.get(response.questionId);
      const group = groups.get(key);
      const likesEnabled = question.likesEnabled === true;
      const likes = likesEnabled ? Number(response.likes || 0) : 0;
      group.likes += likes;
      group.results.push({
        ...response,
        displayValue: safeJoin(response.value),
        questionTitle: question.title,
        likesEnabled,
      });
    });

  const participantResults = [...groups.values()]
    .map((group) => ({ ...group, likesEnabled: group.results.some((result) => result.likesEnabled), results: group.results.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) }))
    .sort((a, b) => b.likes - a.likes || a.nickname.localeCompare(b.nickname, 'ko'));

  const mediaItems = (session?.artworks || []).map((item, index) => ({
    ...item,
    displayTitle: item.displayTitle || item.adoptedTitle || `모임 자료 ${index + 1}`,
  }));

  return {
    galleryQuestions,
    participantResults,
    mediaItems,
    resultCount: participantResults.reduce((sum, group) => sum + group.results.length, 0),
  };
}
