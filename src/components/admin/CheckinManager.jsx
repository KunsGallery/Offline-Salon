import React, { useMemo, useState } from 'react';
import QRJoinCard from '../host/QRJoinCard';
import { checkinSummary, createCheckinToken, sortCheckinApplications } from '../../lib/checkin';
import { formatDateTime } from '../../lib/format';
import { realtime } from '../../lib/realtime';

const emptyForm = { name: '', email: '', phoneLast4: '', ticketType: '일반', checkinToken: '', notes: '' };

export default function CheckinManager({ session }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const applications = useMemo(() => sortCheckinApplications(session.checkinApplications || []), [session.checkinApplications]);
  const summary = checkinSummary(applications);
  const checkinUrl = `${window.location.origin}/checkin/${encodeURIComponent(session.id)}`;
  const filtered = applications.filter((item) => {
    const text = `${item.name} ${item.email} ${item.phoneLast4} ${item.ticketType} ${item.checkinToken} ${item.joinShortCode} ${item.joinSalonTitle}`.toLocaleLowerCase('ko-KR');
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase('ko-KR')))
      && (filter === 'all' || (filter === 'checked' ? item.checkedIn : filter === 'waiting' ? !item.checkedIn && item.status !== 'cancelled' : item.status === filter));
  });

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusyId('form');
    try {
      const token = form.checkinToken.trim() || createCheckinToken(form.name);
      await Promise.resolve(realtime.upsertCheckinApplication(session.id, { ...form, id: editingId || undefined, checkinToken: token, status: 'approved' }));
      setForm(emptyForm);
      setEditingId('');
      setMessage(editingId ? '신청자 정보를 수정했습니다.' : '신청자를 추가했습니다.');
    } catch (reason) {
      setMessage(reason?.message || '신청자 저장에 실패했습니다.');
    } finally {
      setBusyId('');
    }
  };
  const edit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name || '', email: item.email || '', phoneLast4: item.phoneLast4 || '', ticketType: item.ticketType || '일반', checkinToken: item.checkinToken || '', notes: item.notes || '' });
  };
  const checkIn = async (item) => {
    setBusyId(item.id);
    try {
      await Promise.resolve(realtime.checkInApplication(session.id, item.checkinToken || item.id, 'admin-manual'));
      setMessage(`${item.name}님을 수동 체크인했습니다.`);
    } finally {
      setBusyId('');
    }
  };
  const undo = async (item) => {
    if (!window.confirm(`${item.name}님의 출석을 취소할까요?`)) return;
    setBusyId(item.id);
    try {
      await Promise.resolve(realtime.undoCheckInApplication(session.id, item.id));
      setMessage(`${item.name}님의 출석을 취소했습니다.`);
    } finally {
      setBusyId('');
    }
  };
  const remove = async (item) => {
    if (!window.confirm(`${item.name}님을 신청자 명단에서 삭제할까요?`)) return;
    setBusyId(item.id);
    try {
      await Promise.resolve(realtime.deleteCheckinApplication(session.id, item.id));
      setMessage('신청자를 삭제했습니다.');
    } finally {
      setBusyId('');
    }
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('복사했습니다.');
    } catch {
      window.prompt('아래 값을 복사하세요.', value);
    }
  };

  return <section className="checkin-manager">
    <div className="checkin-admin-top">
      <section className="panel checkin-admin-summary">
        <div><span>신청</span><strong>{summary.registered}</strong></div>
        <div><span>입장</span><strong>{summary.checkedIn}</strong></div>
        <div><span>대기</span><strong>{summary.waiting}</strong></div>
        <div><span>취소</span><strong>{summary.cancelled}</strong></div>
      </section>
      <section className="panel checkin-admin-qr">
        <div><h2>입장 체크 URL</h2><p className="muted">스태프 기기에서 이 QR을 열고, Join에서 발급된 개인 QR을 스캔하세요. 처음 인식된 참가자는 이 세션 명단에 자동 등록됩니다.</p><button className="btn" type="button" onClick={() => copy(checkinUrl)}>체크인 링크 복사</button></div>
        <QRJoinCard url={checkinUrl} title="스태프 체크인 화면" />
      </section>
    </div>
    <section className="panel checkin-join-guide">
      <div>
        <h2>Join QR 자동 등록</h2>
        <p className="muted">`join.unframe.kr` 신청·승인 시스템은 그대로 두고, 이 화면에서는 개인 QR의 토큰을 확인해 이름과 행사 정보를 가져온 뒤 Salon 출석 명단으로 관리합니다.</p>
      </div>
      <ol>
        <li><strong>1</strong><span>참가자가 Join 개인 QR을 보여줍니다.</span></li>
        <li><strong>2</strong><span>스태프가 체크인 화면에서 QR을 스캔합니다.</span></li>
        <li><strong>3</strong><span>Salon에 참가자가 자동 등록되고 입장 완료로 표시됩니다.</span></li>
      </ol>
    </section>
    <section className="panel checkin-admin-workspace">
      <form className="checkin-applicant-form" onSubmit={save}>
        <h2>{editingId ? '신청자 수정' : '현장 예외 직접 추가'}</h2>
        <input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="이름" />
        <input className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="이메일" />
        <div className="form-grid two"><input className="input" value={form.phoneLast4} onChange={(event) => setForm({ ...form, phoneLast4: event.target.value.slice(0, 4) })} placeholder="휴대폰 뒤 4자리" /><input className="input" value={form.ticketType} onChange={(event) => setForm({ ...form, ticketType: event.target.value })} placeholder="티켓 구분" /></div>
        <input className="input" value={form.checkinToken} onChange={(event) => setForm({ ...form, checkinToken: event.target.value })} placeholder="수동 체크인 토큰 · 비우면 자동 생성" />
        <textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="메모" />
        <div className="row gap-sm"><button className="btn primary" disabled={busyId === 'form'}>{busyId === 'form' ? '저장 중…' : editingId ? '수정 저장' : '신청자 추가'}</button>{editingId ? <button className="btn" type="button" onClick={() => { setEditingId(''); setForm(emptyForm); }}>취소</button> : null}</div>
        {message ? <p className="tiny muted">{message}</p> : null}
      </form>
      <div className="checkin-applicant-list">
        <header><div><h2>Salon 출석 명단</h2><p className="muted">Join QR로 자동 등록된 참가자와 현장 수동 추가 참가자를 함께 관리합니다.</p></div><div><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·코드·행사명 검색" /><select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">전체</option><option value="waiting">미입장</option><option value="checked">입장</option><option value="cancelled">취소</option></select></div></header>
        {filtered.length ? <div>{filtered.map((item) => {
          const isJoin = item.source === 'join' || item.joinTokenHash;
          const code = isJoin ? `Join ${item.joinShortCode || item.joinTokenHash?.slice(0, 6)?.toUpperCase()}` : item.checkinToken;
          return <article className={`${item.checkedIn ? 'checked' : ''} ${isJoin ? 'from-join' : ''}`} key={item.id}><div><strong>{item.name}</strong><span>{isJoin ? `${item.joinSalonTitle || item.ticketType} · ${item.joinEventDateTime || 'Join QR'} · ${item.joinVenueName || '장소 미정'}` : `${item.ticketType} · ${item.email || '이메일 없음'} · ${item.phoneLast4 || '번호 없음'}`}</span><code>{code || '수동 참가자'}</code>{item.checkedIn ? <small>입장 {formatDateTime(item.checkedInAt)}</small> : null}</div><div>{!isJoin && item.checkinToken ? <button type="button" onClick={() => copy(item.checkinToken)}>토큰 복사</button> : null}<button type="button" onClick={() => edit(item)}>수정</button>{item.checkedIn ? <button type="button" onClick={() => undo(item)} disabled={busyId === item.id}>출석 취소</button> : <button type="button" onClick={() => checkIn(item)} disabled={busyId === item.id}>수동 출석</button>}<button type="button" onClick={() => remove(item)} disabled={busyId === item.id}>삭제</button></div></article>;
        })}</div> : <p className="checkin-empty">아직 등록된 참가자가 없습니다. Join 개인 QR을 처음 스캔하면 여기에 자동으로 쌓입니다.</p>}
      </div>
    </section>
  </section>;
}
