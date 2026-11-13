import { describe, it, expect } from 'vitest';
import { touchLayout, touchScript } from './touch.js';
import { controllableChannelScript } from './index.js';
import { DEVICES } from '../../../controls/devices.js';
import { SCHEMES } from '../../../controls/schemes.js';

const hero = (rule) => [{ id: 'hero', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }];

describe('touch: a virtual pad laid out for the pilot and its camera, never for a genre', () => {
  it('reads the layout off the rule and the camera', () => {
    expect(touchLayout(hero({ type: 'platform', jumpSpeed: 6 }), { rule: 'follow' })).toEqual({ look: false, lane: false, jump: true, fire: false, lift: false });
    expect(touchLayout(hero({ type: 'platform', move: 'lane' }), { rule: 'side' }).lane).toBe(true);
    expect(touchLayout(hero({ type: 'walk' }), { rule: 'eye', mouseLook: true })).toMatchObject({ look: true, jump: false });
    expect(touchLayout(hero({ type: 'fly' }), { rule: 'follow' })).toMatchObject({ look: true, lift: true, jump: false });
    expect(touchLayout([...hero({ type: 'platform' }), { id: 'gun', weapon: { kind: 'ray' } }], { rule: 'follow' }).fire).toBe(true);
    expect(touchLayout([], null)).toEqual({ look: false, lane: false, jump: false, fire: false, lift: false });
  });

  it('its buttons sit at the pad\'s own positions, so the pilot scheme\'s gamepad bindings read them', () => {
    const bound = (id) => SCHEMES.pilot.actions.find((a) => a.id === id).bind.gamepad;
    expect(bound('jump')).toContain('south');
    expect(bound('kneel')).toContain('east');
    expect(bound('interact')).toContain('west');
    expect(bound('fire')).toContain('rt');
    const B = DEVICES.gamepad.buttons, s = touchScript({ look: true, lane: false, jump: true, fire: true, lift: false });
    expect(s).toContain(`__tButton('jump', ${B.south},`);
    expect(s).toContain(`__tButton('fire', ${B.rt},`);
    expect(s).toContain(`__tButton('use', ${B.west},`);
    expect(DEVICES.touch).toMatchObject({ driver: 'touch-virtual-pad', drives: 'gamepad' });
  });

  it('only a game made for a screen draws it: absent, the channel is as it was', () => {
    const ents = hero({ type: 'platform', jumpSpeed: 6 }), cam = { rule: 'follow', target: 'hero' };
    const plain = controllableChannelScript(ents, cam, {});
    const touch = controllableChannelScript(ents, cam, {}, { touch: true });
    expect(plain).not.toContain('__touchPad');
    expect(touch).toContain('function __touchPad()');
    expect(touch).toContain('const __virt = g === __tp;');
    expect(controllableChannelScript(ents, cam, {}, { touch: false })).toBe(plain);
  });

  it('says what the thumbs do: the legend\'s line while it shows, the pause sheet\'s rows; hidden while a menu holds the world', () => {
    const s = touchScript({ look: true, lane: false, jump: true, fire: false, lift: false });
    expect(s).toContain("const __tHint = __tRowsOf().filter((r) => r[0] !== 'use')");
    expect(s).toContain("el.dataset.keys = el.textContent; el.textContent = __tHint;");
    expect(s).toContain('const show = __tOn && !window.__mojMenuOpen;');
    expect(s).toContain("host.style.setProperty('--thumb', pad ? '196px' : '0px');");
    // a runner's layout: the whole screen a swipe, nothing at the foot to lift over
    expect(touchLayout([], null, { runner: true })).toMatchObject({ swipe: true, jump: false });
    expect(touchScript({ swipe: true })).toContain('function swipeOf(dx, dy, ms, opts)');
    expect(touchScript({ look: false })).not.toContain('function swipeOf');
    const ents = hero({ type: 'platform', jumpSpeed: 6 }), cam = { rule: 'follow', target: 'hero' };
    expect(controllableChannelScript(ents, cam, {}, { touch: true })).toContain('if (__touchOn()) return __touchRows();');
    expect(controllableChannelScript(ents, cam, {})).not.toContain('__touchRows');
  });

  it('an obstacle course in the hand: the hero runs by itself, a swipe is a whole track over, a tap jumps; no stick, no button', () => {
    const course = { lanes: [-2, 0, 2], accel: 7 };
    const L = touchLayout(hero({ type: 'platform', jumpSpeed: 8 }), { rule: 'follow' }, { course });
    expect(L).toEqual({ look: false, lane: false, jump: false, fire: false, lift: false, swipe: true, course });
    const s = touchScript(L);
    expect(() => new Function('__world', 'wrap', `let __lookDX = 0, __lookDY = 0, __MOUSELOOK = false; ${s.replace(/requestAnimationFrame\(/g, '(() => 0)(').replace(/document\./g, 'DOC.').replace(/location\.search/g, "''").replace(/window\./g, 'WIN.')}`)).not.toThrow();
    // it runs by itself (the stick forward), steers to the track a swipe named, and holds the jump through the leap
    expect(s).toContain('__tAxes[1] = -1;');
    expect(s).toContain("if (g === 'left') __tStep(-1); else if (g === 'right') __tStep(1); else if (g === 'up') __tLeap();");
    expect(s).toContain("=== 'tap') __tLeap();");
    expect(s).toContain('const slide = (vx * Math.abs(vx)) / (2 * (__tC.accel || 7))');
    expect(s).toContain("[['swipe ← →', 'change track'], ['tap, or swipe ↑', 'jump'], ['it runs', 'by itself']]");
    expect(s).toContain("if (__TL.swipe) __tRing.style.display = 'none';");
    // (a runner's swipes, and a stick, carry none of the course's code; the channel hands the course on only with a screen)
    expect(touchScript({ swipe: true })).not.toContain('__tLane');
    expect(touchScript({ look: false, jump: true })).not.toContain('__tLane');
    const ents = hero({ type: 'platform', jumpSpeed: 8 }), cam = { rule: 'follow', target: 'hero' };
    expect(controllableChannelScript(ents, cam, {}, { touch: true, courseTouch: course })).toContain('const __tC = __TL.course;');
    expect(controllableChannelScript(ents, cam, {}, { courseTouch: course })).toBe(controllableChannelScript(ents, cam, {}));
  });
});

