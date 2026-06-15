import React, { useEffect, useState } from 'react';
import { realtime } from '../../lib/realtime';

const DEFAULT_QUESTION = {
  title: '',
  description: '',
  type: 'text',
  optionsText: '',
};

export default function QuestionEditor({ session, question }) {
  const isEditing = Boolean(question);
  const [draft, setDraft] = useState(DEFAULT_QUESTION);

  useEffect(() => {
    setDraft(
      question
        ? {
            title: question.title || '',
            description: question.description || '',
            type: question.type || 'text',
            optionsText: (question.options || []).join('\n'),
          }
        : DEFAULT_QUESTION,
    );
  }, [question]);

  const canUseOptions = draft.type === 'poll' || draft.type === 'ranking';

  const submit = async (event) => {
    event.preventDefault();
    const options = canUseOptions
      ? draft.optionsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (isEditing) {
      await Promise.resolve(
        realtime.updateQuestion(session.id, question.id, {
          title: draft.title.trim() || '새 질문',
          description: draft.description.trim(),
          type: draft.type,
          options,
        }),
      );
    } else {
      await Promise.resolve(
        realtime.createQuestion(session.id, {
          title: draft.title.trim() || '새 질문',
          description: draft.description.trim(),
          type: draft.type,
          options,
        }),
      );
      setDraft(DEFAULT_QUESTION);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{isEditing ? '질문 수정' : '질문 추가'}</h2>
          <p className="muted">wordcloud, poll, ranking, text 타입을 지원합니다.</p>
        </div>
      </div>

      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>질문 제목</span>
          <input
            className="input"
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="질문을 입력하세요"
          />
        </label>
        <label className="field">
          <span>설명</span>
          <textarea
            className="textarea"
            rows="3"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="참여자에게 보여줄 안내"
          />
        </label>
        <label className="field">
          <span>질문 타입</span>
          <select
            className="select"
            value={draft.type}
            onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
          >
            <option value="wordcloud">wordcloud</option>
            <option value="poll">poll</option>
            <option value="ranking">ranking</option>
            <option value="text">text</option>
          </select>
        </label>

        {canUseOptions ? (
          <label className="field">
            <span>선택지</span>
            <textarea
              className="textarea"
              rows="5"
              value={draft.optionsText}
              onChange={(event) => setDraft((current) => ({ ...current, optionsText: event.target.value }))}
              placeholder="한 줄에 하나씩 입력"
            />
          </label>
        ) : (
          <p className="muted tiny">wordcloud/text 타입은 선택지가 필요하지 않습니다.</p>
        )}

        <button className="btn primary" type="submit">
          {isEditing ? '질문 저장' : '질문 추가'}
        </button>
      </form>
    </section>
  );
}
