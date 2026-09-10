import React, { useEffect, useMemo, useState } from 'react';
import { realtime } from '../../lib/realtime';
import { SESSION_MODULES } from '../../lib/sessionModules';

export default function SessionEditor({ session }) {
  const [draft, setDraft] = useState({
    title: '',
    salonDate: '',
    description: '',
    groupChatUrl: '',
  });
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!session) return;
    setDraft({
      title: session.title || '',
      salonDate: session.salonDate || '',
      description: session.description || '',
      groupChatUrl: session.groupChatUrl || '',
    });
    setSaveState('idle');
    setSaveError('');
  }, [session?.id, session?.title, session?.salonDate, session?.description, session?.groupChatUrl]);

  const trimmedDraft = useMemo(() => ({
    title: draft.title.trim() || '새 세션',
    salonDate: draft.salonDate,
    description: draft.description.trim() || '실시간 인터랙티브 세션',
    groupChatUrl: draft.groupChatUrl.trim(),
  }), [draft]);
  const hasDraftChanges = Boolean(session) && (
    trimmedDraft.title !== (session.title || '')
    || trimmedDraft.salonDate !== (session.salonDate || '')
    || trimmedDraft.description !== (session.description || '')
    || trimmedDraft.groupChatUrl !== (session.groupChatUrl || '')
  );

  if (!session) return null;

  const patch = (next) => realtime.updateSession(session.id, next);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveState('idle');
    setSaveError('');
  };

  const saveDetails = async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      await Promise.resolve(patch(trimmedDraft));
      setSaveState('saved');
    } catch (reason) {
      setSaveState('error');
      setSaveError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const toggleModule = (moduleId, enabled) => {
    const enabledModules = enabled
      ? [...new Set([...(session.enabledModules || []), moduleId])]
      : (session.enabledModules || []).filter((id) => id !== moduleId);
    const stage = !enabled && session.stage?.mode === moduleId ? { mode: 'lobby', page: 1, blackout: false } : session.stage;
    return patch({ enabledModules, ...(stage !== session.stage ? { currentQuestionId: null, stage } : {}) });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>세션 설정</h2>
          <p className="muted">상태, 표시 옵션, 브랜드 색상을 조정합니다.</p>
        </div>
      </div>

      <div className="form-grid">
        <fieldset className="session-module-picker form-grid-wide"><legend>선택 활동 모듈</legend><p>Core 기능은 항상 유지됩니다. 이 세션에서 사용할 활동만 켜세요.</p>{SESSION_MODULES.map((module) => <label key={module.id}><input type="checkbox" checked={(session.enabledModules || []).includes(module.id)} onChange={(event) => toggleModule(module.id, event.target.checked)} /><span><strong>{module.title}</strong><small>{module.description}</small></span></label>)}</fieldset>
        <label className="field">
          <span>제목</span>
          <input className="input" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
        </label>
        <label className="field">
          <span>살롱 날짜</span>
          <input
            className="input"
            type="date"
            value={draft.salonDate}
            onChange={(event) => updateDraft('salonDate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>설명</span>
          <textarea
            className="textarea"
            rows="3"
            value={draft.description}
            onChange={(event) => updateDraft('description', event.target.value)}
          />
        </label>
        <label className="field">
          <span>단톡 URL</span>
          <input
            className="input"
            type="url"
            value={draft.groupChatUrl}
            onChange={(event) => updateDraft('groupChatUrl', event.target.value)}
            placeholder="https://open.kakao.com/..."
          />
        </label>
        <div className="field">
          <span>기본 정보 저장</span>
          <div className="row wrap gap-sm align-center">
            <button className="btn primary" type="button" disabled={!hasDraftChanges || saveState === 'saving'} onClick={saveDetails}>
              {saveState === 'saving' ? '저장 중...' : '저장'}
            </button>
            {saveState === 'saved' ? <p className="tiny muted">저장되었습니다.</p> : null}
            {saveState === 'error' ? <p className="tiny error-text">저장 실패: {saveError}</p> : null}
          </div>
        </div>
        <div className="field">
          <span>테마 색상 3개</span>
          <div className="theme-color-inputs">
            {[['primaryColor', '#004AAD', '주조색'], ['secondaryColor', '#AAD004', '보조색'], ['tertiaryColor', '#41D8FF', '강조색']].map(([key, fallback, label]) => <label key={key} title={label}><input type="color" value={session.branding?.[key] || fallback} onChange={(event) => realtime.updateSession(session.id, { branding: { ...session.branding, [key]: event.target.value, palette: [key === 'primaryColor' ? event.target.value : session.branding?.primaryColor || '#004AAD', key === 'secondaryColor' ? event.target.value : session.branding?.secondaryColor || '#AAD004', key === 'tertiaryColor' ? event.target.value : session.branding?.tertiaryColor || '#41D8FF'] } })} /><small>{label}</small></label>)}
          </div>
        </div>

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
