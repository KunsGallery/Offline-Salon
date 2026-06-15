import React from 'react';

export default function WaitingScreen({ title, message = '잠시 후 질문이 시작됩니다.' }) {
  return (
    <section className="client-panel stack center">
      <p className="eyebrow">WAITING</p>
      <h1>{title || '대기 중입니다'}</h1>
      <p className="muted">{message}</p>
    </section>
  );
}
