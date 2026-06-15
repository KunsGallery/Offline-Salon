import React from 'react';
import { formatCompactTime, safeJoin } from '../../lib/format';
import LikeBurst from './LikeBurst';

export default function ResponseNote({
  response,
  participantId,
  nickname,
  onLike = null,
  burstCount = 0,
  emphasis = false,
  highlighted = false,
  popular = false,
  busy = false,
}) {
  const likeCount = response?.likes ?? Object.keys(response?.likedBy || {}).length;
  const likedByMe = Boolean(response?.likedBy?.[participantId]);
  const isMine = response?.participantId === participantId;
  const canLike = Boolean(onLike) && !isMine;
  const displayNickname = String(nickname || response?.nickname || '').trim() || '익명';

  return (
    <article
      className={[
        'response-note',
        emphasis ? 'emphasis' : '',
        isMine ? 'mine' : '',
        highlighted ? 'is-liked-now' : '',
        popular ? 'popular' : '',
      ].join(' ')}
    >
      {burstCount > 0 ? <LikeBurst count={burstCount} /> : null}
      <header className="response-note-meta">
        <div className="stack gap-xs">
          <strong>{displayNickname}</strong>
          <span className="tiny muted">{formatCompactTime(response?.createdAt)}</span>
        </div>
        <span className="badge like-badge">{likeCount} likes</span>
      </header>
      <p className="response-note-body">{safeJoin(response?.value)}</p>
      <footer className="response-note-actions">
        {canLike ? (
          <button
            type="button"
            className={`response-like-button ${likedByMe ? 'is-liked' : ''}`}
            aria-pressed={likedByMe}
            onClick={() => onLike(response)}
            disabled={busy}
          >
            <span>{busy ? '…' : likedByMe ? '♥' : '♡'}</span>
            <span>좋아요 {likeCount}</span>
          </button>
        ) : (
          <span className="tiny muted">{isMine ? '내 답변' : '공개 메모'}</span>
        )}
      </footer>
    </article>
  );
}
