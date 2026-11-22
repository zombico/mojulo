import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { manaHudScript } from '../mana-hud.js';
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
  it('a level whose HUD is mana-ui\'s: the layer draws nothing, the HUD carries the pad, a touch on a pad presses its control', () => {
    const L = { look: true, lane: false, jump: true, fire: true, lift: false }, own = touchScript(L), mana = touchScript(L, { view: 'mana' });
    // the same pad, no drawing of its own; a swipe layout has nothing to hand over
    expect(own).toContain("__tRing.className = 'ring'");
    for (const drawn of ['.ring', '.nub', "className = 'b'", 'createElement(\'style\')']) expect(mana).not.toContain(drawn);
    expect(mana).toContain('mojulo touch pad (STANDARD GAMEPAD)');
    expect(touchScript({ swipe: true }, { view: 'mana' })).toBe(touchScript({ swipe: true }));
    // the HUD's spec gains the pad only for a level made for a screen
    const hud = { spec: { hud: { use: 'hud', children: [] } }, theme: 'greybox' };
    expect(manaHudScript(hud)).not.toContain('"use":"touchpad"');
    expect(manaHudScript(hud, { touch: true })).toContain('"use":"touchpad"');
    // played in a DOM: the view's pads stand in the HUD's place, and the layer reads them
    const dom = new JSDOM('<!doctype html><body><div id="wrap"><div id="moj-mana-hud"><span class="mana-stick"></span><span class="mana-pad" data-control="south">jump</span><span class="mana-pad" data-control="rt">fire</span></div></div></body>', { runScripts: 'outside-only', url: 'http://localhost/level.html?touch=1', pretendToBeVisual: true });
    const w = dom.window;
    w.eval(`var wrap = document.getElementById('wrap'), __MOUSELOOK = false, __lookDX = 0, __lookDY = 0; ${mana}; window.__t = { pad: __touchPad, frame: __tFrame };`);
    w.__t.frame();
    const T = w.__mojTouch, pad = () => w.__t.pad(), ev = (type, id) => new w.MouseEvent(type, { bubbles: true, cancelable: true });
    const fire = (el, type, id) => { const e = ev(type); Object.defineProperty(e, 'pointerId', { value: id }); el.dispatchEvent(e); };
    expect(T.view()).toMatchObject({ on: true, lane: false, held: null, down: [] });
    expect(T.view().buttons.map((b) => b.label)).toEqual(['jump', 'fire']);
    const [jump, shoot] = w.document.querySelectorAll('.mana-pad');
    fire(shoot, 'pointerdown', 7);
    expect(pad().buttons[7].pressed).toBe(true);
    expect(T.view().down).toEqual(['rt']);
    fire(jump, 'pointerdown', 8);
    expect(T.view().down).toEqual(['south', 'rt']);
    fire(w, 'pointerup', 7);
    expect(pad().buttons[7].pressed).toBe(false);
    expect(pad().buttons[0].pressed).toBe(true);
    // use is drawn only while the figure stands where it is used
    w.__mojReach = true;
    expect(T.view().buttons.map((b) => b.label)).toEqual(['jump', 'fire', 'use']);
    // a menu holds the world: the pad is off and every control let go
    w.__mojMenuOpen = true; w.__t.frame();
    expect(T.view().on).toBe(false);
    expect(pad().buttons[0].pressed).toBe(false);
    w.close();
  });
});


describe('touch: an operative\'s pads', () => {
  const op = [{ pilotable: true, rule: { type: 'platform', aimView: {}, dive: { jump: false } } }];
  it('its south pad crouches and its north dives, as its scheme binds them; any other pilot keeps its jump', () => {
    const L = touchLayout(op, { mouseLook: true });
    expect(L.stance).toBe(true);
    expect(touchLayout([{ pilotable: true, rule: { type: 'platform' } }], null)).not.toHaveProperty('stance');
    const page = touchScript(L), mana = touchScript(L, { view: 'mana' });
    expect(page).toContain("__tButton('crouch', 0,");
    expect(page).toContain("__tButton('dive', 3,");
    expect(mana).toContain("{ label: 'crouch', control: 'south' }, { label: 'dive', control: 'north' }");
    const B = (id) => SCHEMES.operative.actions.find((a) => a.id === id).bind.gamepad;
    expect(B('crouch')).toContain('south');
    expect(B('jump')).toEqual(['north']);
  });
});
