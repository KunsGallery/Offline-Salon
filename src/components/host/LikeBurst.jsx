import React from 'react';

export default function LikeBurst({ count = 1 }) {
  const particleChars = ['♥', '✦', '•', '♡', '✧', '♥', '•', '✦'];
  const particles = particleChars.slice(0, Math.max(6, Math.min(10, count + 5)));

  return (
    <div className="like-burst" aria-hidden="true">
      {particles.map((particle, index) => {
        const angle = (Math.PI * 2 * index) / particles.length - Math.PI / 2;
        const x = Math.cos(angle) * (28 + (index % 3) * 8);
        const y = Math.sin(angle) * (28 + (index % 2) * 10);
        const delay = index * 50;
        return (
          <span
            key={index}
            className={`like-burst-particle particle-${index}`}
            style={{
              '--burst-delay': `${delay}ms`,
              '--burst-x': `${x}px`,
              '--burst-y': `${y}px`,
            }}
          >
            {particle}
          </span>
        );
      })}
    </div>
  );
}
