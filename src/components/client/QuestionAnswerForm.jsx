import React, { useEffect, useMemo, useState } from 'react';

export default function QuestionAnswerForm({ question, onSubmit, initialValue = '' }) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => question?.options || [], [question]);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue, question?.id]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(value);
    } finally {
      setBusy(false);
    }
  };

  if (!question) return null;

  const isChoice = question.type === 'poll' || question.type === 'ranking';

  return (
    <form className="client-panel stack" onSubmit={submit}>
      <div className="stack gap-xs">
        <p className="eyebrow">{question.type}</p>
        <h1>{question.title}</h1>
        {question.description ? <p className="muted">{question.description}</p> : null}
      </div>

      {isChoice ? (
        <div className="choice-list">
          {options.map((option) => (
            <label key={option} className={`choice-card ${value === option ? 'selected' : ''}`}>
              <input type="radio" name="answer" checked={value === option} onChange={() => setValue(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <label className="field">
          <span>{question.type === 'wordcloud' ? '짧은 단어' : '답변'}</span>
          <textarea
            className="textarea large"
            rows={question.type === 'wordcloud' ? 3 : 6}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={question.type === 'wordcloud' ? '한 단어 또는 짧은 문장' : '답변을 입력해 주세요'}
          />
        </label>
      )}

      <button
        className="btn primary large-btn"
        type="submit"
        disabled={busy || (!isChoice && !String(value).trim()) || (isChoice && !String(value).trim())}
      >
        {busy ? '제출 중...' : '답변 제출'}
      </button>
    </form>
  );
}
