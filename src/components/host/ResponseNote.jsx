import React from 'react';
import { formatCompactTime, safeJoin } from '../../lib/format';
import LikeBurst from './LikeBurst';

export default function ResponseNote({
  response,
  participantId,
  onLike = null,
  burstCount = 0,
  emphasis = false,
  busy = false,
}) {
  const likeCount = response?.likes ?? Object.keys(response?.likedBy || {}).length;
  const likedByMe = Boolean(response?.likedBy?.[participantId]);
  const isMine = response?.participantId === participantId;
  const canLike = Boolean(onLike) && !isMine;

  return (
    <article className={`response-note ${emphasis ? 'emphasis' : ''} ${isMine ? 'mine' : ''}`}>
      {burstCount > 0 ? <LikeBurst count={burstCount} /> : null}
      <header className="response-note-meta">
        <div className="stack gap-xs">
          <strong>{response?.nickname || '익명'}</strong>
          <span className="tiny muted">{formatCompactTime(response?.createdAt)}</span>
        </div>
        <span className="badge like-badge">{likeCount} likes</span>
      </header>
      <p className="response-note-body">{safeJoin(response?.value)}</p>
      <footer className="response-note-actions">
        {canLike ? (
          <button
            type="button"
            className={`like-button ${likedByMe ? 'active' : ''}`}
            onClick={() => onLike(response)}
            disabled={busy}
          >
            <span>{busy ? '…' : likedByMe ? '♥' : '♡'}</span>
            <span>{likeCount}</span>
          </button>
        ) : (
          <span className="tiny muted">{isMine ? '내 답변' : '공개 메모'}</span>
        )}
      </footer>
    </article>
  );
}
