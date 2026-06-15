import React from 'react';
import { safeJoin } from '../../lib/format';

export default function SubmittedScreen({ question, response, onEdit }) {
  return (
    <section className="client-panel stack center">
      <p className="eyebrow">SUBMITTED</p>
      <h1>답변이 제출되었습니다.</h1>
      <p className="muted">{question?.title}</p>
      <p className="muted">다음 질문을 기다려주세요.</p>
      <div className="submitted-card">
        <strong>내 응답</strong>
        <p>{safeJoin(response?.value)}</p>
      </div>
      {onEdit ? (
        <button className="client-primary-button" onClick={onEdit}>
          수정하기
        </button>
      ) : null}
    </section>
  );
}
