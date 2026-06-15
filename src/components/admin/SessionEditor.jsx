import React from 'react';
import { realtime } from '../../lib/realtime';

export default function SessionEditor({ session }) {
  if (!session) return null;

  const patch = (next) => realtime.updateSession(session.id, next);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>세션 설정</h2>
          <p className="muted">상태, 표시 옵션, 브랜드 색상을 조정합니다.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>제목</span>
          <input className="input" value={session.title} onChange={(event) => patch({ title: event.target.value })} />
        </label>
        <label className="field">
          <span>설명</span>
          <textarea
            className="textarea"
            rows="3"
            value={session.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
        <label className="field">
          <span>브랜드 색상</span>
          <input
            className="input"
            type="color"
            value={session.branding?.primaryColor || '#004AAD'}
            onChange={(event) =>
              realtime.updateSession(session.id, {
                branding: { ...session.branding, primaryColor: event.target.value },
              })
            }
          />
        </label>

        <label className="field">
          <span>배경 모드</span>
          <select
            className="select"
            value={session.branding?.backgroundMode || 'dark'}
            onChange={(event) =>
              realtime.updateSession(session.id, {
                branding: { ...session.branding, backgroundMode: event.target.value },
              })
            }
          >
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </label>

        <label className="field">
          <span>로고 URL</span>
          <input
            className="input"
            value={session.branding?.logoUrl || ''}
            onChange={(event) =>
              realtime.updateSession(session.id, {
                branding: { ...session.branding, logoUrl: event.target.value || null },
              })
            }
            placeholder="https://..."
          />
        </label>

        <div className="field">
          <span>세션 상태</span>
          <div className="row wrap gap-sm">
            {['draft', 'live', 'ended'].map((status) => (
              <button
                key={status}
                className={`btn ${session.status === status ? 'primary' : ''}`}
                type="button"
                onClick={() => realtime.setSessionStatus(session.id, status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={session.showResults}
            onChange={(event) => patch({ showResults: event.target.checked })}
          />
          <span>결과 공개</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={session.allowNickname}
            onChange={(event) => patch({ allowNickname: event.target.checked })}
          />
          <span>닉네임 허용</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={session.allowMultipleSubmissions}
            onChange={(event) => patch({ allowMultipleSubmissions: event.target.checked })}
          />
          <span>중복 제출 허용</span>
        </label>
      </div>
    </section>
  );
}
