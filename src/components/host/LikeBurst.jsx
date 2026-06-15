import React from 'react';

export default function LikeBurst({ count = 1 }) {
  const particleChars = ['♥', '✦', '✧', '•', '♡', '✦', '♥', '✧', '•', '♡', '✦', '♥'];
  const particles = particleChars.slice(0, Math.max(8, Math.min(12, count + 6)));

  return (
    <div className="like-burst" aria-hidden="true">
      {particles.map((particle, index) => {
        const angle = (Math.PI * 2 * index) / particles.length - Math.PI / 2;
        const radius = 22 + (index % 4) * 10 + count * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * (radius + (index % 2) * 6);
        const delay = index * 34;
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
