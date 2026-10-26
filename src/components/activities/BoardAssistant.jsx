import React, { useLayoutEffect, useRef, useState } from 'react';

// The assistant walks to the board, draws the photo from the satchel, pins it and steps back.
// Positions are measured from the evidence note being pinned, so the paw meets the card
// wherever the slot is. With `cinematic`, the pin cuts to a paw close-up before landing.

// Where things sit inside the 1117 × 1408 pose artwork, as fractions of the box.
const PAW = { left: { x: .18, y: .096 }, right: { x: .82, y: .096 } };
const SATCHEL = { x: .69, y: .55 };
const REACH = .904; // box height from the feet to the raised paw

const TIMING = {
  normal: { walk: 900, lift: 320, reach: 380, press: 150, hold: 260, settle: 160, back: 760 },
  short: { walk: 450, lift: 200, reach: 260, press: 120, hold: 160, settle: 120, back: 380 },
};

const ease = 'cubic-bezier(.2,.8,.2,1)';

function walkFrames(from, to, steps) {
  return Array.from({ length: steps * 2 + 1 }, (_, index) => {
    const t = index / (steps * 2);
    const eased = 1 - (1 - t) ** 2;
    const dx = from.dx + (to.dx - from.dx) * eased;
    const dy = from.dy + (to.dy - from.dy) * eased;
    const scale = from.scale + (to.scale - from.scale) * eased;
    const bob = index % 2 ? -1.1 : 0;
    const tilt = index % 2 ? (index % 4 === 1 ? -.8 : .8) : 0;
    return { transform: `translateX(-50%) translate(${dx}px, ${dy}px) translateY(${bob}%) scale(${scale}) rotate(${tilt}deg)` };
  });
}

const pose = ({ dx, dy, scale }, extra = '') => `translateX(-50%) translate(${dx}px, ${dy}px) scale(${scale})${extra}`;

function dustBurst(host, x, y) {
  for (let index = 0; index < 9; index += 1) {
    const mote = document.createElement('i');
    mote.className = 'pear-pin-dust';
    mote.style.left = `${x}px`;
    mote.style.top = `${y}px`;
    host.appendChild(mote);
    const angle = (Math.PI * 2 * index) / 9 + Math.random() * .5;
    const distance = 18 + Math.random() * 26;
    mote.animate([
      { opacity: .9, transform: 'translate(-50%, -50%) scale(1)' },
      { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance + 14}px)) scale(.4)` },
    ], { duration: 700, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => mote.remove();
  }
}

function shake(element, power) {
  if (!element) return;
  element.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${-3 * power}px, ${4 * power}px)` },
    { transform: `translate(${3 * power}px, ${-2 * power}px)` },
    { transform: `translate(${-1 * power}px, ${1 * power}px)` },
    { transform: 'translate(0, 0)' },
  ], { duration: 360, easing: 'ease-out', composite: 'add' });
}

export default function BoardAssistant({ pinningId, pinningSide = 'left', pinningPhoto, cinematic = false, short = false, onLanded, onDone }) {
  const assistantRef = useRef(null);
  const idleRef = useRef(null);
  const actionRef = useRef(null);
  const heldRef = useRef(null);
  const insertRef = useRef(null);
  const insertPawRef = useRef(null);
  const insertPawImageRef = useRef(null);
  const insertFlashRef = useRef(null);
  const callbacks = useRef({ onLanded, onDone });
  callbacks.current = { onLanded, onDone };
  const [beat, setBeat] = useState('idle');

  useLayoutEffect(() => {
    if (!pinningId) {
      setBeat('idle');
      return undefined;
    }
    const assistant = assistantRef.current;
    const host = assistant?.offsetParent;
    const note = host?.querySelector(`[data-evidence-id="${CSS.escape(pinningId)}"]`);
    let cancelled = false;
    let landed = false;
    let done = false;
    const running = [];
    const land = () => { if (!landed) { landed = true; callbacks.current.onLanded?.(pinningId); } };
    const finish = () => { if (!done) { done = true; land(); callbacks.current.onDone?.(pinningId); } };
    const play = (element, frames, options) => {
      const animation = element.animate(frames, { fill: 'forwards', easing: ease, ...options });
      running.push(animation);
      return animation.finished;
    };
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    if (!assistant || !host || !note || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return undefined;
    }

    const t = TIMING[short ? 'short' : 'normal'];
    const hostRect = host.getBoundingClientRect();
    const box = assistant.getBoundingClientRect();
    const card = note.getBoundingClientRect();
    const paw = PAW[pinningSide] || PAW.left;
    const target = { x: card.left + card.width / 2 - hostRect.left, y: card.top + card.height * .06 - hostRect.top };
    const feet = box.bottom - hostRect.top;
    const centerX = box.left + box.width / 2 - hostRect.left;
    const scale = Math.min(1.35, Math.max(.55, (feet - target.y) / (box.height * REACH)));
    const reach = {
      scale,
      dx: target.x - centerX - scale * (paw.x - .5) * box.width,
      dy: Math.min(0, target.y - (feet - scale * box.height * REACH)),
    };
    const rest = { dx: 0, dy: 0, scale: 1 };
    const heldWidth = card.width * .86;
    const held = heldRef.current;
    held.style.width = `${heldWidth}px`;
    const heldAt = (x, y) => ({ left: `${x - heldWidth / 2}px`, top: `${y}px` });
    const satchel = {
      x: centerX + reach.dx + reach.scale * (SATCHEL.x - .5) * box.width,
      y: feet + reach.dy - reach.scale * box.height * (1 - SATCHEL.y),
    };

    (async () => {
      setBeat('walk');
      await play(assistant, walkFrames(rest, reach, short ? 3 : 5), { duration: t.walk, easing: 'linear' });
      if (cancelled) return;

      setBeat('lift');
      Object.assign(held.style, heldAt(satchel.x, satchel.y));
      await play(held, [
        { opacity: 0, transform: 'translateY(30%) scale(.5) rotate(10deg)' },
        { opacity: 1, transform: 'translateY(-40%) scale(.8) rotate(4deg)' },
      ], { duration: t.lift });
      if (cancelled) return;

      setBeat('reach');
      play(idleRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, delay: 100 });
      play(actionRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 140, delay: 100 });
      play(assistant, [{ transform: pose(reach) }, { transform: pose(reach, ' translateY(-1.2%) scale(1.015)') }], { duration: t.reach });
      const from = heldAt(satchel.x, satchel.y);
      const to = heldAt(target.x, target.y);
      await play(held, [
        { ...from, transform: 'translateY(-40%) scale(.8) rotate(4deg)' },
        { left: `${(parseFloat(from.left) + parseFloat(to.left)) / 2 - heldWidth * .5}px`, top: `${Math.min(parseFloat(from.top), parseFloat(to.top)) - card.height * .2}px`, transform: 'scale(.95) rotate(-3deg)', offset: .55 },
        { ...to, transform: `scale(1) rotate(${pinningSide === 'left' ? -5 : 5}deg)` },
      ], { duration: t.reach, easing: 'cubic-bezier(.3,.7,.2,1)' });
      if (cancelled) return;

      if (cinematic && insertRef.current) {
        setBeat('insert');
        const insert = insertRef.current;
        await play(insert, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
        await play(insertPawRef.current, [
          { transform: 'translate(-34%, 48%) rotate(-12deg)' },
          { transform: 'translate(-3%, 3%) rotate(-1deg)', offset: .82 },
          { transform: 'translate(0, 0) rotate(0deg)' },
        ], { duration: 640, easing: 'cubic-bezier(.16,1,.3,1)' });
        await wait(140);
        await play(insertPawRef.current, [{ transform: 'translate(0, 0) scale(1)' }, { transform: 'translate(.4%, .6%) scale(.985)' }], { duration: 90, easing: 'cubic-bezier(.7,0,1,.5)' });
        if (cancelled) return;
        insert.classList.add('is-pinned');
        shake(insert, 2.4);
        play(insertFlashRef.current, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: 600 });
        await wait(520);
        // Only the paw leaves; the photo stays pinned to the cork.
        await play(insertPawImageRef.current, [{ transform: 'translate(0, 0)', opacity: 1 }, { transform: 'translate(-22%, 30%) rotate(-8deg)', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' });
        await wait(180);
        await play(insert, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
        insert.classList.remove('is-pinned');
        if (cancelled) return;
      }

      setBeat('pin');
      await play(assistant, [{ transform: pose(reach, ' translateY(-1.2%) scale(1.015)') }, { transform: pose(reach, ' translateY(-.4%) scale(1.03)') }], { duration: t.press, easing: 'cubic-bezier(.6,0,.9,.4)' });
      if (cancelled) return;
      held.getAnimations().forEach((animation) => animation.cancel());
      held.style.opacity = 0;
      land();
      shake(note.closest('.pear-evidence-wall'), 1);
      dustBurst(host, target.x, target.y);
      await wait(t.hold);
      if (cancelled) return;

      setBeat('return');
      play(actionRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: t.settle });
      play(idleRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: t.settle });
      await wait(t.settle + 80);
      await play(assistant, walkFrames(reach, rest, short ? 2 : 3), { duration: t.back, easing: 'linear' });
      if (cancelled) return;
      running.forEach((animation) => animation.cancel());
      setBeat('idle');
      finish();
    })();

    return () => {
      cancelled = true;
      running.forEach((animation) => animation.cancel());
      if (held) held.style.opacity = '';
      finish();
    };
  }, [pinningId]);

  const pinning = Boolean(pinningId);
  return <>
    <div ref={assistantRef} className={`pear-board-assistant ${pinning ? `is-pinning is-${pinningSide}` : ''}`} data-beat={beat} aria-hidden="true">
      <img ref={idleRef} className="pear-board-assistant-idle" src="/pear-play/assistant-idle.webp" alt="" />
      <div ref={actionRef} className="pear-board-assistant-action"><img src={`/pear-play/assistant-pin-${pinningSide === 'right' ? 'right' : 'left'}.webp`} alt="" /></div>
    </div>
    {pinning && pinningPhoto ? <img ref={heldRef} className="pear-board-assistant-held-photo" src={pinningPhoto} alt="" aria-hidden="true" /> : <span ref={heldRef} hidden />}
    {pinning && cinematic ? <div ref={insertRef} className="pear-pin-insert" aria-hidden="true">
      <div className="pear-pin-insert-cork" />
      <div ref={insertPawRef} className="pear-pin-insert-paw"><img ref={insertPawImageRef} src="/pear-play/assistant-paw-pin-original.webp" alt="" /><div className="pear-pin-insert-card"><img src={pinningPhoto} alt="" /></div><i className="pear-pin-insert-pin" /></div>
      <div className="pear-pin-insert-vignette" />
      <div ref={insertFlashRef} className="pear-pin-insert-flash" />
    </div> : null}
  </>;
}
