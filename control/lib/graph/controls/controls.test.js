import { describe, expect, it } from 'vitest';

import { buildControlsKernel } from './controls-kernel.js';
import { DEVICES, DEVICE_IDS } from './devices.js';
import { SCHEMES, SCHEME_IDS } from './schemes.js';

const K = buildControlsKernel();
const D = DEVICES;
const keys = (...codes) => (c) => codes.includes(c);
const ctl = (vals) => (c) => vals[c] || 0;

describe('devices', () => {
  it('every family names its standard, and a driver or null (declared, waiting for one)', () => {
    for (const id of DEVICE_IDS) {
      expect(typeof D[id].standard, id).toBe('string');
      expect(D[id].driver === null || typeof D[id].driver === 'string', id).toBe(true);
    }
  });

  it('the gamepad follows the W3C standard mapping by position, and xr the xr-standard mapping', () => {
    expect(D.gamepad.buttons).toMatchObject({ south: 0, east: 1, west: 2, north: 3, rb: 5, rt: 7, start: 9, up: 12, home: 16 });
    expect(D.gamepad.axes).toEqual({ leftX: 0, leftY: 1, rightX: 2, rightY: 3 });
    expect(D.xr.buttons).toMatchObject({ trigger: 0, squeeze: 1, touchpad: 2, thumbstick: 3 });
    expect(D.xr.axes).toMatchObject({ touchpadX: 0, touchpadY: 1, thumbstickX: 2, thumbstickY: 3 });
    expect(D.sim.usages).toMatchObject({ steering: 0xC8, accelerator: 0xC4, brake: 0xC5, clutch: 0xC6, throttle: 0xBB, rudder: 0xBA });
  });

  it('is plain data', () => {
    expect(JSON.parse(JSON.stringify(D))).toEqual(D);
  });
});

describe('schemes', () => {
  it.each(SCHEME_IDS)('%s: ids unique, contexts declared, every binding a real control, legend rows name real actions', (id) => {
    const s = SCHEMES[id];
    const ids = s.actions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of s.actions) {
      expect(a.in.length, a.id).toBeGreaterThan(0);
      for (const c of a.in) expect(s.contexts, a.id).toContain(c);
      for (const [fam, cs] of Object.entries(a.bind)) {
        expect(DEVICE_IDS, `${a.id} binds an unknown family`).toContain(fam);
        expect(cs.length, a.id).toBeLessThanOrEqual(2);
        for (const c of cs) expect(K.valid(D, fam, c), `${a.id}: ${fam} ${c}`).toBe(true);
      }
    }
    for (const [fam, rows] of Object.entries(s.legend)) {
      expect(DEVICE_IDS).toContain(fam);
      for (const row of rows) {
        for (const k of ['ids', 'quad', 'all', 'range']) for (const ref of row[k] || []) expect(ids, JSON.stringify(row)).toContain(ref);
        if (row.chord) expect(ids).toContain(row.chord);
      }
    }
  });

  it.each(SCHEME_IDS)('%s: no control means two things in one context, on any device', (id) => {
    expect(K.conflicts(SCHEMES[id], K.resolve(SCHEMES[id], D))).toEqual([]);
  });

  // a pad player can do what a keyboard player can in the pilot scheme: every action has a pad binding but the few a
  // pad says another way (the left stick strafes under mouselook, the RB chord selects a weapon, kneel descends a glide)
  it('pilot: every action but those a pad says another way has a pad binding', () => {
    const OTHERWISE = ['strafeLeft', 'strafeRight', 'descend', 'weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5'];
    expect(SCHEMES.pilot.actions.filter((a) => !a.bind.gamepad?.length && !OTHERWISE.includes(a.id)).map((a) => a.id)).toEqual([]);
  });

  it('is plain data (the page embeds it as JSON)', () => {
    expect(JSON.parse(JSON.stringify(SCHEMES))).toEqual(SCHEMES);
  });
});

describe('controls kernel', () => {
  const B = K.resolve(SCHEMES.pilot, D);

  it('runs from its own source (the page copy is the same code)', () => {
    const copy = new Function(`return (${buildControlsKernel.toString()})()`)();
    const ctx = { armed: true, active: { gamepad: true } };
    expect(copy.legend(SCHEMES.pilot, copy.resolve(SCHEMES.pilot, D), D, ctx)).toEqual(K.legend(SCHEMES.pilot, B, D, ctx));
  });

  it('reads held keys, either side of a modifier, and axes slot by slot', () => {
    expect(K.held(B, 'jump', 'keyboard', keys('Space'))).toBe(true);
    expect(K.held(B, 'tackle', 'keyboard', keys('ShiftRight'))).toBe(true);
    expect(K.axis(B, 'moveForward', 'moveBack', 'keyboard', keys('KeyW'))).toBe(1);
    expect(K.axis(B, 'moveForward', 'moveBack', 'keyboard', keys('ArrowDown'))).toBe(-1);
    // W with ↓: the WASD slot speaks first, as the old `ax(W,S) || ax(↑,↓)` did
    expect(K.axis(B, 'moveForward', 'moveBack', 'keyboard', keys('KeyW', 'ArrowDown'))).toBe(1);
    expect(K.axis(B, 'moveForward', 'moveBack', 'keyboard', keys('KeyW', 'KeyS'))).toBe(0);
  });

  it('reads analog controls as values: half axes, triggers, pedals, a VR thumbstick', () => {
    expect(K.value(B, 'moveForward', 'gamepad', ctl({ leftY: -0.6 }))).toBeCloseTo(0.6);
    expect(K.value(B, 'moveBack', 'gamepad', ctl({ leftY: -0.6 }))).toBe(0);
    expect(K.axis(B, 'turnRight', 'turnLeft', 'gamepad', ctl({ leftX: -0.25 }))).toBeCloseTo(-0.25);
    expect(K.value(B, 'fire', 'gamepad', ctl({ rt: 0.4 }))).toBeCloseTo(0.4);
    expect(K.held(B, 'fire', 'gamepad', ctl({ rt: 0.4 }))).toBe(false);
    expect(K.axis(B, 'moveForward', 'moveBack', 'sim', ctl({ accelerator: 0.8, brake: 0.3 }))).toBeCloseTo(0.5);
    expect(K.axis(B, 'turnRight', 'turnLeft', 'sim', ctl({ steering: 0.5 }))).toBeCloseTo(0.5);
    expect(K.value(B, 'moveForward', 'xr', ctl({ 'left.thumbstickY': -1 }))).toBe(1);
    expect(K.held(B, 'fire', 'xr', ctl({ 'right.trigger': 1 }))).toBe(true);
  });

  it('a held chord button quiets the controls it chords', () => {
    expect(K.held(B, 'tackle', 'gamepad', ctl({ north: 1 }))).toBe(true);
    expect(K.held(B, 'tackle', 'gamepad', ctl({ north: 1 }), D.gamepad.faces)).toBe(false);
    expect(K.held(B, 'kneel', 'gamepad', ctl({ lb: 1 }), D.gamepad.faces)).toBe(true);   // LB is no face button
  });

  it('the reference gamepad driver reads a standard-mapping Gamepad by name', () => {
    const g = { axes: [0, -0.5, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0, value: i === 7 ? 0.3 : (i === 0 ? 1 : 0) })) };
    const read = K.gamepadRead(g, D);
    expect([read('south'), read('rt'), read('leftY'), read('nope')]).toEqual([1, 0.3, -0.5, 0]);
    expect(K.held(B, 'jump', 'gamepad', read)).toBe(true);
  });

  it('maps a press to its action', () => {
    const F = K.resolve(SCHEMES['falling-block'], D);
    expect(K.actionOf(F, 'keyboard', 'KeyX')).toBe('cw');
    expect(K.actionOf(F, 'keyboard', 'ControlLeft')).toBe('ccw');
    expect(K.actionOf(F, 'keyboard', 'KeyQ')).toBe(null);
    expect(K.actionOf(F, 'gamepad', 'east')).toBe('cw');
    expect(K.codeMap(F)).toMatchObject({ ArrowUp: 'cw', KeyX: 'cw', ControlRight: 'ccw', ShiftLeft: 'hold', Space: 'hardDrop' });
    expect(K.is(B, 'fire', 'mouse', 'left')).toBe(true);
  });

  it('binds confirm and cancel as roles: where the layout\'s players expect them', () => {
    const M = (layout) => K.resolve(SCHEMES.menu, D, null, { layout });
    expect([M('xbox').bind.gamepad.accept, M('xbox').bind.gamepad.back]).toEqual([['south'], ['east']]);
    expect([M('playstation').bind.gamepad.accept, M('playstation').bind.gamepad.back]).toEqual([['south'], ['east']]);
    expect([M('nintendo').bind.gamepad.accept, M('nintendo').bind.gamepad.back]).toEqual([['east'], ['south']]);
    // each prints its layout's word for the same button: A to accept everywhere but PlayStation
    const legend = (layout) => K.legend(SCHEMES.menu, M(layout), D, { active: { gamepad: true }, layout }).pop();
    expect([legend('xbox'), legend('playstation'), legend('nintendo')].map((r) => r[0])).toEqual(['A / B', '✕ / ◯', 'A / B']);
    for (const layout of ['xbox', 'playstation', 'nintendo']) {
      for (const id of SCHEME_IDS) expect(K.conflicts(SCHEMES[id], K.resolve(SCHEMES[id], D, null, { layout })), `${id} on ${layout}`).toEqual([]);
    }
  });

  it('reads a pad\'s layout off its id', () => {
    expect([
      'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
      'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)',
      'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)',
      'Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)',
      '8BitDo SN30 Pro (STANDARD GAMEPAD)',
    ].map(K.padLayout)).toEqual(['xbox', 'playstation', 'playstation', 'nintendo', 'nintendo', 'xbox']);
  });

  it('takes overrides per family and drops what is not a control of that family', () => {
    const R = K.resolve(SCHEMES.pilot, D, {
      keyboard: { jump: ['KeyK', 7, 'Key K', 'KeyJ', 'KeyL'] },
      gamepad: { fire: ['rb', 'trigger', 'leftY'] },
      xr: { jump: ['trigger', 'right.trigger'] },
      mouse: { fire: ['right'] },
    });
    expect(R.bind.keyboard.jump).toEqual(['KeyK', 'KeyJ']);
    expect(R.bind.gamepad.fire).toEqual(['rb', 'leftY']);   // a full axis is a control too (a trigger-like stick)
    expect(R.bind.xr.jump).toEqual(['right.trigger']);       // a two-handed family needs the hand
    expect(R.bind.mouse.fire).toEqual(['right']);
    expect(R.bind.keyboard.moveForward).toEqual(['KeyW', 'ArrowUp']);
  });

  it('finds the conflict a remap makes, per family', () => {
    const R = K.resolve(SCHEMES.pilot, D, { keyboard: { boost: ['KeyR'] }, gamepad: { swapSuit: ['south'] } });
    expect(K.conflicts(SCHEMES.pilot, R)).toEqual([
      { family: 'keyboard', context: 'ground', control: 'KeyR', actions: ['boost', 'cycleWeapon'] },
      { family: 'keyboard', context: 'space', control: 'KeyR', actions: ['boost', 'cycleWeapon'] },
      ...['ground', 'space', 'glide', 'vehicle'].map((context) => ({ family: 'gamepad', context, control: 'south', actions: ['jump', 'swapSuit'] })),
    ]);
  });

  it('labels every family, in the pad’s own layout', () => {
    expect(['KeyW', 'Digit3', 'ArrowLeft', 'Space', 'ShiftLeft', 'Escape', 'F7'].map((c) => K.label(D, 'keyboard', c))).toEqual(['W', '3', '←', 'Space', 'Shift', 'Esc', 'F7']);
    expect(['south', 'rb', 'up', 'leftY-'].map((c) => K.label(D, 'gamepad', c))).toEqual(['A', 'RB', 'D-pad ↑', 'left stick ↑']);
    expect(['south', 'rb'].map((c) => K.label(D, 'gamepad', c, 'playstation'))).toEqual(['✕', 'R1']);
    expect(['south', 'east'].map((c) => K.label(D, 'gamepad', c, 'nintendo'))).toEqual(['B', 'A']);
    expect(['right.trigger', 'left.squeeze', 'left.thumbstickY-', 'left.primary'].map((c) => K.label(D, 'xr', c))).toEqual(['right trigger', 'left grip', 'left thumbstick ↑', 'X']);
    expect(['accelerator', 'steering-', 'hatUp'].map((c) => K.label(D, 'sim', c))).toEqual(['accelerator', 'wheel ←', 'hat ↑']);
    expect(K.label(D, 'mouse', 'middle')).toBe('middle mouse');
    expect(K.capture('keyboard', 'ShiftRight')).toBe('Shift');
  });
});

describe('the pilot legend', () => {
  const B = K.resolve(SCHEMES.pilot, D);
  const rows = (ctx) => K.legend(SCHEMES.pilot, B, D, ctx);

  it('reads the same as the hand-written legend it replaced, on foot and armed', () => {
    expect(rows({ armed: true, suits: true, ai: true, follow: true })).toEqual([
      ['W A S D / arrows', 'move & turn'],
      ['mouse drag', 'look / aim'],
      ['E / Q', 'strafe'],
      ['Space', 'jump'],
      ['F (hold)', 'boost thrusters'],
      ['left mouse', 'fire'],
      ['R · 1–5', 'cycle · select weapon'],
      ['T', 'switch suit'],
      ['G', 'AI attack on / off'],
      ['V', 'reverse view'],
    ]);
  });

  it('in space, with a mouselook camera', () => {
    expect(rows({ space: true, mouselook: true }).slice(0, 5)).toEqual([
      ['W A S D / arrows', 'thrust & turn'],
      ['mouse · click to capture', 'look / aim'],
      ['E / Q', 'strafe'],
      ['Space / X', 'ascend / descend'],
      ['F (hold)', 'boost thrusters'],
    ]);
  });

  it('teaches kneel, tackle and lock when the world has them', () => {
    const r = rows({ kneel: true, tackle: true, lock: true });
    expect(r).toContainEqual(['X (hold)', 'kneel']);
    expect(r).toContainEqual(['Shift', 'tackle']);
    expect(r).toContainEqual(['C / middle mouse', 'target lock']);
  });

  it('adds a family’s rows once that device has spoken', () => {
    expect(rows({ armed: true, active: { gamepad: true } }).slice(-8)).toEqual([
      ['🎮 left stick', 'move'],
      ['right stick', 'look / aim'],
      ['RT / LT', 'fire / boost (tap-tap: dodge)'],
      ['RB', 'tap: next weapon · hold: selector'],
      ['RB + X / Y', 'main weapon / main melee'],
      ['A · Y', 'jump · tackle'],
      ['D-pad ↑ · select', 'switch suit · AI toggle'],
      ['start', 'pause'],
    ]);
    expect(rows({ armed: true, active: { gamepad: true }, layout: 'playstation' })).toContainEqual(['R1 + □ / △', 'main weapon / main melee']);
    expect(rows({ active: { gamepad: true }, vehicle: true })).toContainEqual(['RT / LT', 'throttle / brake']);
    expect(rows({ armed: true, active: { xr: true } }).slice(-5)).toEqual([
      ['left thumbstick', 'move'],
      ['right thumbstick ↔', 'turn'],
      ['A · B', 'jump · kneel'],
      ['right trigger', 'fire'],
      ['right grip', 'next weapon'],
    ]);
    expect(rows({ vehicle: true, active: { sim: true } }).slice(-2)).toEqual([['accelerator / brake', 'throttle / brake'], ['wheel ↔', 'steer']]);
  });

  it('relabels a remapped control', () => {
    const R = K.resolve(SCHEMES.pilot, D, { keyboard: { moveForward: ['KeyI'], moveBack: ['KeyK'], turnLeft: ['KeyJ'], turnRight: ['KeyL'], boost: ['ShiftLeft'] }, gamepad: { jump: ['east'], kneel: ['south'] } });
    const r = K.legend(SCHEMES.pilot, R, D, { active: { gamepad: true } });
    expect(r[0]).toEqual(['I J K L', 'move & turn']);
    expect(r).toContainEqual(['Shift (hold)', 'boost thrusters']);
    expect(r).toContainEqual(['B · Y', 'jump · tackle']);
  });

  it('the falling-block legend', () => {
    const F = K.resolve(SCHEMES['falling-block'], D);
    expect(K.legend(SCHEMES['falling-block'], F, D, {})).toEqual([
      ['← / →', 'move'], ['↓', 'soft drop'], ['Space', 'hard drop'], ['Z / Ctrl / ↑ / X', 'rotate'], ['C', 'hold'], ['Enter', 'restart'],
    ]);
  });
});
