import React, { useState } from 'react';
import SalonAvatar, { AvatarPropArt } from '../participants/SalonAvatar';
import { AVATAR_COLORS, AVATAR_SHAPES, AVATAR_EXPRESSIONS, AVATAR_SPECIES, AVATAR_VARIANTS, avatarForSession, getAvatarAccessories, getAvatarModule, getAvatarProps, randomAvatar } from '../../lib/avatar';

export default function JoinForm({ session, onJoin, onCancel, loading, allowNickname = true, initialNickname = '', initialAvatar, editing = false, error = '' }) {
  const [nickname, setNickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState(() => avatarForSession(initialAvatar, session));
  const [builderTab, setBuilderTab] = useState('look');
  const canJoin = allowNickname ? Boolean(nickname.trim()) : true;
  const accessories = getAvatarAccessories(session);
  const moduleId = getAvatarModule(session);
  const isLegacy = avatar.version === 2;
  const currentSpecies = AVATAR_SPECIES.find((item) => item.id === avatar.species);

  const chooseEventProp = (id) => setAvatar((current) => ({
    ...current,
    moduleProps: { ...current.moduleProps, [moduleId]: id },
    eventProp: id,
  }));

  const submit = (event) => {
    event.preventDefault();
    onJoin(allowNickname ? nickname.trim() || '익명' : '익명', avatarForSession(avatar, session));
  };

  return (
    <form className="client-panel stack join-form" onSubmit={submit}>
      <div className="stack gap-sm">
        <div className="join-form-heading"><h1>{editing ? '내 캐릭터 수정' : session?.title || '세션에 참여합니다'}</h1>{editing && onCancel ? <button type="button" onClick={onCancel}>취소</button> : null}</div>
        <p className="muted">{editing ? '바꾼 모습은 앞 화면에도 바로 반영됩니다.' : '닉네임과 캐릭터를 만들고 테이블에 함께 앉아주세요.'}</p>
      </div>

      {allowNickname ? (
        <label className="field">
          <span>닉네임</span>
          <input
            className="input large"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="관객 이름"
            autoComplete="nickname"
            maxLength={16}
          />
        </label>
      ) : (
        <p className="muted">이 세션은 닉네임 없이 참여할 수 있습니다.</p>
      )}

      <fieldset className="avatar-builder">
        <legend>내 캐릭터</legend>
        <div className={`avatar-builder-preview ${isLegacy ? 'is-legacy' : ''}`}><SalonAvatar avatar={avatar} label={nickname.trim() || '나'} />{!isLegacy ? <p>{currentSpecies?.label} · {currentSpecies?.interest}</p> : null}</div>
        <div className="avatar-builder-heading"><strong>{isLegacy ? '기존 캐릭터' : '살롱의 손님'}</strong><button type="button" onClick={() => setAvatar(randomAvatar(session))}>{isLegacy ? '동물 캐릭터로 바꾸기' : '무작위로 만들기'}</button></div>
        <div className="avatar-builder-tabs" role="group" aria-label="캐릭터 꾸미기"><button type="button" aria-pressed={builderTab === 'look'} className={builderTab === 'look' ? 'active' : ''} onClick={() => setBuilderTab('look')}>기본 모습</button><button type="button" aria-pressed={builderTab === 'accessory'} className={builderTab === 'accessory' ? 'active' : ''} onClick={() => setBuilderTab('accessory')}>소품 꾸미기</button></div>
        {isLegacy ? builderTab === 'look' ? <>
          <div className="avatar-option-group" role="group" aria-label="캐릭터 모양"><span>모양</span><div className="avatar-choice-row">{AVATAR_SHAPES.map((shape) => <button type="button" aria-pressed={avatar.shape === shape.id} className={avatar.shape === shape.id ? 'active' : ''} key={shape.id} onClick={() => setAvatar((current) => ({ ...current, shape: shape.id }))}>{shape.label}</button>)}</div></div>
          <div className="avatar-option-group" role="group" aria-label="캐릭터 색상"><span>색상</span><div className="avatar-color-row">{AVATAR_COLORS.map((color) => <button type="button" aria-pressed={avatar.color === color.id} className={avatar.color === color.id ? 'active' : ''} key={color.id} onClick={() => setAvatar((current) => ({ ...current, color: color.id }))} aria-label={color.label} title={color.label} style={{ '--swatch': color.value }} />)}</div></div>
          <div className="avatar-option-group" role="group" aria-label="캐릭터 표정"><span>표정</span><div className="avatar-expression-row">{AVATAR_EXPRESSIONS.map((expression) => <button type="button" aria-pressed={avatar.expression === expression.id} className={avatar.expression === expression.id ? 'active' : ''} key={expression.id} onClick={() => setAvatar((current) => ({ ...current, expression: expression.id }))}>{expression.label}</button>)}</div></div>
        </> : <div className="avatar-option-group" role="group" aria-label="캐릭터 소품"><span>소품</span><div className="avatar-accessory-row">{accessories.map((accessory) => <button type="button" aria-pressed={avatar.accessory === accessory.id} className={avatar.accessory === accessory.id ? 'active' : ''} key={accessory.id} onClick={() => setAvatar((current) => ({ ...current, accessory: accessory.id }))}>{accessory.label}</button>)}</div></div>
          : builderTab === 'look' ? <>
            <div className="avatar-option-group" role="group" aria-label="동물 선택"><span>동물</span><div className="avatar-species-grid">{AVATAR_SPECIES.map((species) => <button type="button" aria-label={`${species.label} · ${species.interest}`} aria-pressed={avatar.species === species.id} className={avatar.species === species.id ? 'active' : ''} key={species.id} onClick={() => setAvatar((current) => ({ ...current, species: species.id }))}><SalonAvatar avatar={{ ...avatar, species: species.id, baseProp: 'none', eventProp: 'none' }} compact /><span>{species.label}</span></button>)}</div></div>
            <div className="avatar-option-group" role="group" aria-label="캐릭터 스타일"><span>스타일</span><div className="avatar-variant-row">{AVATAR_VARIANTS.map((variant) => <button type="button" aria-pressed={avatar.variant === variant.id} className={avatar.variant === variant.id ? 'active' : ''} key={variant.id} onClick={() => setAvatar((current) => ({ ...current, variant: variant.id }))}>{variant.label}</button>)}</div></div>
          </> : <>
            <div className="avatar-option-group" role="group" aria-label="기본 소품"><span>기본 소품</span><div className="avatar-prop-grid">{getAvatarProps().map((prop) => <button type="button" aria-pressed={avatar.baseProp === prop.id} className={avatar.baseProp === prop.id ? 'active' : ''} key={prop.id} onClick={() => setAvatar((current) => ({ ...current, baseProp: prop.id }))}>{prop.id === 'none' ? <span className="avatar-prop-none" aria-hidden="true" /> : <AvatarPropArt id={prop.id} />}<span>{prop.label}</span></button>)}</div></div>
            {moduleId ? <div className="avatar-option-group" role="group" aria-label="이번 모임 소품"><span>이번 모임 소품</span><div className="avatar-prop-grid">{[{ id: 'none', label: '없음' }, ...getAvatarProps(moduleId)].map((prop) => <button type="button" aria-pressed={avatar.eventProp === prop.id} className={avatar.eventProp === prop.id ? 'active' : ''} key={prop.id} onClick={() => chooseEventProp(prop.id)}>{prop.id === 'none' ? <span className="avatar-prop-none" aria-hidden="true" /> : <AvatarPropArt id={prop.id} />}<span>{prop.label}</span></button>)}</div></div> : null}
          </>}
      </fieldset>

      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <div className="join-action-bar"><button className="client-primary-button join-submit-button" type="submit" disabled={loading || !canJoin}>
        {loading ? '저장 중…' : editing ? '변경 저장' : '이 캐릭터로 입장'}
      </button></div>
    </form>
  );
}
