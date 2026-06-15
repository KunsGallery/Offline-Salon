import React from 'react';

export default function LikeBurst({ count = 1 }) {
  const particles = Array.from({ length: Math.max(2, Math.min(6, count + 1)) }, (_, index) => index);

  return (
    <div className="like-burst" aria-hidden="true">
      {particles.map((index) => {
        const angle = (Math.PI * 2 * index) / particles.length - Math.PI / 2;
        const x = Math.cos(angle) * 34;
        const y = Math.sin(angle) * 34;

        return (
          <span
            key={index}
            className="like-burst-particle"
            style={{
              '--burst-delay': `${index * 80}ms`,
              '--burst-x': `${x}px`,
              '--burst-y': `${y}px`,
            }}
          >
            ♥
          </span>
        );
      })}
    </div>
  );
}
