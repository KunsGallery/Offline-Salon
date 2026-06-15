/**
 * @typedef {'draft' | 'live' | 'ended'} SessionStatus
 * @typedef {'wordcloud' | 'poll' | 'ranking' | 'text'} QuestionType
 *
 * @typedef {Object} SessionBranding
 * @property {string} primaryColor
 * @property {string|null} logoUrl
 * @property {'dark' | 'light'} backgroundMode
 *
 * @typedef {Object} InteractiveQuestion
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {QuestionType} type
 * @property {string[]} options
 * @property {number} order
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} InteractiveResponse
 * @property {string} id
 * @property {string} questionId
 * @property {string} participantId
 * @property {string|null} nickname
 * @property {string|string[]} value
 * @property {boolean} hidden
 * @property {string} createdAt
 *
 * @typedef {Object} InteractiveParticipant
 * @property {string} participantId
 * @property {string|null} nickname
 * @property {string} joinedAt
 * @property {string} lastSeenAt
 *
 * @typedef {Object} InteractiveSession
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {SessionStatus} status
 * @property {string|null} currentQuestionId
 * @property {boolean} showResults
 * @property {boolean} allowNickname
 * @property {boolean} allowMultipleSubmissions
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {SessionBranding} branding
 * @property {InteractiveQuestion[]} questions
 * @property {InteractiveResponse[]} responses
 * @property {Record<string, InteractiveParticipant>} participants
 */

export {};
