import React, { useEffect, useMemo, useState } from 'react';

export default function QuestionAnswerForm({
  question,
  onSubmit,
  initialValue = '',
  submitLabel = '제출',
  busyLabel = '저장 중...',
  onCancel = null,
  cancelLabel = '취소',
}) {
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

  const type = question?.type || 'text';
  const isChoice = (type === 'poll' || type === 'ranking') && options.length > 0;
  const canSubmit = String(value || '').trim().length > 0;

  return (
    <form className="client-panel stack answer-form" onSubmit={submit}>
      <div className="stack gap-xs">
        <p className="eyebrow">{type}</p>
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
          <span>{type === 'wordcloud' ? '짧은 단어' : '답변'}</span>
          <textarea
            className="textarea large"
            rows={type === 'wordcloud' ? 3 : 6}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={type === 'wordcloud' ? '한 단어 또는 짧은 문장' : '답변을 입력해 주세요'}
          />
        </label>
      )}

      <div className="row wrap gap-sm">
        <button
          className="client-primary-button answer-submit-button"
          type="submit"
          disabled={busy || !canSubmit}
        >
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel ? (
          <button className="client-secondary-button" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
