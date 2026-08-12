import React from 'react';

export default function WaitingScreen({ title, message = '앞 화면에서 함께 도착한 사람들을 만나보세요.' }) {
  return (
    <section className="client-panel stack center">
      <h1>{title || '테이블에 자리가 마련됐어요.'}</h1>
      <p className="muted">{message}</p>
    </section>
  );
}
