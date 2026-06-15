import React from 'react';
import { realtime } from '../../lib/realtime';

export default function QuestionList({ session, questions, activeQuestionId, onSelectQuestion }) {
  const confirmDelete = (question) => {
    const ok = window.confirm(`질문 "${question.title}"을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
    if (ok) {
      realtime.deleteQuestion(session.id, question.id);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>질문 목록</h2>
          <p className="muted">순서를 바꾸고, 현재 활성 질문을 지정할 수 있습니다.</p>
        </div>
      </div>

      <div className="stack">
        {questions.length === 0 ? (
          <div className="empty-state">
            <h3>질문이 없습니다.</h3>
            <p className="muted">오른쪽에서 첫 질문을 추가해 보세요.</p>
          </div>
        ) : (
          questions.map((question, index) => (
            <article className={`question-card ${activeQuestionId === question.id ? 'active' : ''}`} key={question.id}>
              <div className="row between gap-md">
                <div className="stack gap-xs">
                  <div className="row wrap gap-sm align-center">
                    <h3>{question.title}</h3>
                    <span className="badge">{question.type}</span>
                  </div>
                  <p className="muted tiny">{question.description || '설명 없음'}</p>
                </div>
                <div className="row wrap gap-sm">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => realtime.moveQuestion(session.id, question.id, -1)}
                    disabled={index === 0}
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => realtime.moveQuestion(session.id, question.id, 1)}
                    disabled={index === questions.length - 1}
                  >
                    아래로
                  </button>
                  <button
                    type="button"
                    className={`btn ${activeQuestionId === question.id ? 'primary' : ''}`}
                    onClick={() => realtime.activateQuestion(session.id, question.id)}
                  >
                    활성화
                  </button>
                  <button type="button" className="btn" onClick={() => onSelectQuestion(question)}>
                    수정
                  </button>
                  <button type="button" className="btn danger" onClick={() => confirmDelete(question)}>
                    삭제
                  </button>
                </div>
              </div>
              {question.options?.length > 0 ? <p className="tiny muted">옵션: {question.options.join(' · ')}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
