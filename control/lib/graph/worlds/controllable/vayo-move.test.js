import { describe, it, expect } from 'vitest';
import { composeLive, composeControllable, EMISSION, emissionSource } from './compose.js';
import { blockMatter } from '../../rupa/matter.js';
import { readVayo, resolveVayo, vayoWords, vayoLaw, VAYO_ELEMENTS } from '../../rupa/vayo-move.js';
import { TRAVERSAL_MOVES } from '../../gameworld/actions.js';
import { feelVayo, feelCard, lowerFeel } from '../../gameworld/feel/lower.js';
import { POLES } from '../../gameworld/feel/cards.js';

const CW = composeLive();
const G = { ground: () => 0 };
const hero = (vayo, extra = {}) => ({ id: 'h', pilotable: true, transform: { pos: [0, 0, 1], heading: 0 }, rule: { type: 'platform', eye: 1, speed: 6, ...(vayo ? { vayo } : {}), ...extra } });
const world = (vayo, extra = {}, spec = {}) => CW.createWorld({ entities: [hero(vayo, extra)], pilot: 'h', ...spec });
const steps = (w, input, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) CW.stepWorld(w, input, dt, G); return w; };
// a dash from rest: [seconds it lasted, metres it went]
const dash = (vayo, fps = 60, spec = {}, extra = {}) => {
  const w = world(vayo, extra, spec), h = w.byId.h, dt = 1 / fps;
  steps(w, {}, fps / 6, dt);
  const x0 = h.transform.pos[0];
  steps(w, { vayo: 1 }, 1, dt);
  let n = 1, peak = 0;
  while (h.vayoDash && n < 2000) { peak = Math.max(peak, h.vayoDash.v); steps(w, {}, 1, dt); n++; }
  return { t: n / fps, dx: h.transform.pos[0] - x0, peak, w, h };
};

describe('the vayo law: a push against the air, a curve in closed form', () => {
  it('its push and its release match a fine numeric integration', () => {
    const p = 100, k = 0.5, n = 200000, T = 0.4, dt = T / n;
    let v = 0, x = 0;
    for (let i = 0; i < n; i++) { v += (p - k * v * v) * dt; x += v * dt; }
    const [v1, x1] = vayoLaw.push(0, p, k, T);
    expect(Math.abs(v1 - v) / v).toBeLessThan(1e-3); expect(Math.abs(x1 - x) / x).toBeLessThan(1e-3);
    let u = 20, y = 0;
    for (let i = 0; i < n; i++) { u -= k * u * u * dt; y += u * dt; }
    const [u1, y1] = vayoLaw.coast(20, k, T);
    expect(Math.abs(u1 - u) / u).toBeLessThan(1e-3); expect(Math.abs(y1 - y) / y).toBeLessThan(1e-3);
  });

  it('it is a curve, never a line: it eases toward its top speed and never passes it', () => {
    const p = 100, k = 0.5, vt = Math.sqrt(p / k), sp = [0.05, 0.1, 0.2, 0.4].map((t) => vayoLaw.push(0, p, k, t)[0]);
    for (let i = 1; i < sp.length; i++) { expect(sp[i]).toBeGreaterThan(sp[i - 1]); expect(sp[i] - sp[i - 1]).toBeLessThan(sp[0]); }
    expect(sp[3]).toBeLessThan(vt);
    expect(vayoLaw.push(2 * vt, p, k, 0.1)[0]).toBeLessThan(2 * vt);   // from above it bleeds down to it
    expect(vayoLaw.brake(10, p, k, 10)).toEqual([0, expect.any(Number)]);   // braked, it stops
  });

  it('a dash covers the same ground at 30, 60 and 144 frames a second', () => {
    for (const element of [undefined, 'earth']) {
      const at = [30, 60, 144].map((fps) => dash({ element, dash: true }, fps).dx);
      expect(Math.abs(at[0] - at[1])).toBeLessThan(1e-6); expect(Math.abs(at[2] - at[1])).toBeLessThan(1e-6);
    }
  });

  it('a dash reaches its peak in its rise and carries about its carry', () => {
    const d = dash({ dash: { speed: 20, rise: 0.1, carry: 4 } });
    expect(d.peak).toBeGreaterThan(19.5); expect(d.peak).toBeLessThanOrEqual(20 + 1e-6);
    expect(d.dx).toBeGreaterThan(4); expect(d.dx).toBeLessThan(4 + 20 * 0.1);
  });
});

describe('a hero\'s vayo: elements, power and the cap', () => {
  it('each element is its own shape: wind carries far, earth stops hard, lightning snaps', () => {
    const wind = dash({ element: 'wind', dash: true }), earth = dash({ element: 'earth', dash: true }), bolt = dash({ element: 'lightning', dash: true });
    expect(wind.dx).toBeGreaterThan(2 * earth.dx);
    expect(earth.t).toBeLessThan(wind.t);
    expect(bolt.peak).toBeGreaterThan(wind.peak);
    expect(resolveVayo({ element: 'lightning', dash: true }).dash.rise).toBeLessThan(resolveVayo({ element: 'wind', dash: true }).dash.rise);
  });

  it('power sets the fiction (×√power), the cap the play', () => {
    const human = resolveVayo({ dash: true }), heroic = resolveVayo({ dash: true, power: 'heroic' }), sup = resolveVayo({ dash: true, power: 'super' });
    expect(heroic.dash.fiction / human.dash.fiction).toBeCloseTo(Math.sqrt(10), 6);
    expect(sup.dash.fiction).toBeCloseTo(12 * Math.sqrt(1000), 6);
    expect(sup.dash.play).toBe(40); expect(sup.dash.over).toBeGreaterThan(0.85);
    expect(dash({ dash: true, power: 'super' }).peak).toBeLessThanOrEqual(40 + 1e-6);
    expect(resolveVayo({ dash: true, power: 'super', cap: 25 }).dash.play).toBe(25);
    // the world's tier, for a hero that names none
    expect(dash({ dash: true }, 60, { rupa: { power: 1e3 } }).h.vayoR.power).toBe(1e3);
  });

  it('no speed passes through a wall: the sweep stops it at the face', () => {
    const d = dash({ dash: true, power: 'super' }, 60, { colliders: [{ min: [3, -5, 0], max: [3.1, 5, 4] }] });
    expect(d.h.transform.pos[0]).toBeLessThan(3);
    expect(d.h.transform.pos[0]).toBeGreaterThan(2.5);
  });

  it('a world built in its own units moves in them (the rule\'s metre)', () => {
    const m = dash({ dash: true }), u = dash({ dash: true }, 60, {}, { metre: 2, speed: 12 });
    expect(u.dx / m.dx).toBeCloseTo(2, 3);
  });

  it('its invincible frames are a window it names, never implied', () => {
    const w = world({ dash: { iframes: { frames: [0, 6] } } }), h = w.byId.h;
    steps(w, {}, 10); steps(w, { vayo: 1 }, 1);
    expect(h.invincible).toBe(true);
    steps(w, {}, 8);
    expect(h.invincible).toBe(false);
    const plain = world({ dash: true }); steps(plain, {}, 10); steps(plain, { vayo: 1 }, 1);
    expect(plain.byId.h.invincible).toBeFalsy();
  });

  it('a dash spends the meter and waits out its cooldown', () => {
    const w = world({ dash: { cost: 0.6, cooldown: 1 } }), h = w.byId.h;
    steps(w, {}, 10); steps(w, { vayo: 1 }, 1);
    expect(h.vayoMeter).toBeCloseTo(0.4, 6);
    while (h.vayoDash) steps(w, {}, 1);
    steps(w, { vayo: 1 }, 1);
    expect(h.vayoDash).toBeNull();   // the cooldown, and too little meter
  });
});

describe('the flight: rise, hover and fly at will', () => {
  it('takes off, climbs, hovers when let go, cruises, and lands when it comes down', () => {
    const w = world({ flight: true }), h = w.byId.h;
    steps(w, {}, 10);
    steps(w, { vayo: 1 }, 1); steps(w, {}, 1);
    expect(h.vayoFly).toBeTruthy();
    steps(w, { jumpHeld: 1 }, 60);
    const z1 = h.transform.pos[2];
    expect(z1).toBeGreaterThan(5);
    steps(w, {}, 60);
    const z2 = h.transform.pos[2]; steps(w, {}, 60);
    expect(Math.abs(h.transform.pos[2] - z2)).toBeLessThan(1e-3);   // a hover holds
    steps(w, { forward: 1 }, 180);
    expect(h.vayo.speed).toBeCloseTo(10, 1);   // its cruise
    steps(w, { kneel: 1 }, 240);
    expect(h.vayoFly).toBeNull(); expect(h.grounded).toBe(true);
  });

  it('the key lets go in the air: gravity takes it', () => {
    const w = world({ flight: true }), h = w.byId.h;
    steps(w, {}, 10); steps(w, { vayo: 1 }, 1); steps(w, { jumpHeld: 1 }, 40);
    steps(w, {}, 2); steps(w, { vayo: 1 }, 1);
    expect(h.vayoFly).toBeNull();
    const z = h.transform.pos[2]; steps(w, {}, 20);
    expect(h.transform.pos[2]).toBeLessThan(z);
  });
});

// a jump, then the vayo jump near its top: [the climb from where the vayo jump fired, the world]
const airJump = (vayo, fps = 60, extra = {}) => {
  const w = world(vayo, extra), h = w.byId.h, dt = 1 / fps;
  steps(w, {}, fps / 6, dt);
  steps(w, { jump: 1, jumpHeld: 1 }, 1, dt); steps(w, { jumpHeld: 1 }, Math.round(fps * 0.3), dt);
  const z0 = h.transform.pos[2]; let top = z0;
  steps(w, { jump: 1, jumpHeld: 1 }, 1, dt);
  for (let k = 0; k < fps * 2; k++) { steps(w, {}, 1, dt); top = Math.max(top, h.transform.pos[2]); }
  return { gain: top - z0, w, h };
};

describe('the vayo jump: an air jump on the hero\'s own air', () => {
  it('climbs its height from wherever it fires, at any frame rate, and a release does not cut it', () => {
    for (const fps of [30, 60, 144]) { const g = airJump({ jump: { height: 3 } }, fps).gain; expect(g).toBeGreaterThan(3 * 0.97); expect(g).toBeLessThan(3 * 1.03); }
    // (the jump key let go at once: still the whole height)
    expect(airJump({ jump: true }).gain).toBeGreaterThan(2.2 * 0.97);
  });

  it('the physical air jump fires first; the vayo jump after it', () => {
    const both = world({ jump: true }, { airJumps: 1 }), h = both.byId.h;
    steps(both, {}, 10); steps(both, { jump: 1, jumpHeld: 1 }, 1); steps(both, { jumpHeld: 1 }, 15);
    steps(both, { jump: 1, jumpHeld: 1 }, 1);
    expect(h.airJumpsUsed).toBe(1); expect(h.vayoJumps || 0).toBe(0);
    steps(both, { jumpHeld: 1 }, 15); steps(both, { jump: 1, jumpHeld: 1 }, 1);
    expect(h.vayoJumps).toBe(1);
  });

  it('its count, again on the ground; its element its rise; its tier its height, held to the cap', () => {
    const w = world({ jump: { count: 2 } }), h = w.byId.h;
    steps(w, {}, 10); steps(w, { jump: 1, jumpHeld: 1 }, 1);
    for (let i = 0; i < 3; i++) { steps(w, { jumpHeld: 1 }, 15); steps(w, { jump: 1, jumpHeld: 1 }, 1); }
    expect(h.vayoJumps).toBe(2);
    steps(w, {}, 400); expect(h.grounded).toBe(true); expect(h.vayoJumps).toBe(0);
    expect(h.launchedBy).toBeFalsy();   // landed: the next ground jump is the legs' again, cut by a release
    expect(resolveVayo({ element: 'earth', jump: true }).jump.rise).toBeLessThan(resolveVayo({ element: 'wind', jump: true }).jump.rise);
    const sup = resolveVayo({ jump: true, power: 'super' }).jump;
    expect(sup.play).toBe(40); expect(sup.fiction).toBeGreaterThan(40);
  });
});

describe('the vayo air dash: a dash only in the air', () => {
  // in the air (a jump, a moment on), V pressed for n steps
  const up = (vayo, extra = {}) => { const w = world(vayo, extra), h = w.byId.h; steps(w, {}, 10); steps(w, { jump: 1, jumpHeld: 1 }, 1); steps(w, { jumpHeld: 1 }, 12); return { w, h }; };

  it('V in the air dashes its count, again only after the ground; on the ground it does nothing', () => {
    const { w, h } = up({ airDash: true });
    const x0 = h.transform.pos[0];
    steps(w, { vayo: 1 }, 1);
    expect(h.vayoDash && h.vayoDash.move).toBe('airDash'); expect(h.vayo.kind).toBe('airDash');
    steps(w, {}, 3);
    const z = h.transform.pos[2]; steps(w, {}, 1);
    expect(h.vayoDash.left > 0 || Math.abs(h.transform.pos[2] - z) < 1e-9).toBe(true);   // its air bears it while it pushes
    while (h.vayoDash) steps(w, {}, 1);
    expect(h.transform.pos[0] - x0).toBeGreaterThan(2);
    steps(w, { vayo: 1 }, 1);
    expect(h.vayoDash).toBeFalsy();   // its count spent until the ground
    steps(w, {}, 200); expect(h.grounded).toBe(true);
    steps(w, { vayo: 1 }, 1); expect(h.vayoDash).toBeFalsy();   // not on the ground
    steps(w, {}, 2); steps(w, { jump: 1, jumpHeld: 1 }, 1); steps(w, { jumpHeld: 1 }, 10); steps(w, { vayo: 1 }, 1);
    expect(h.vayoDash && h.vayoDash.move).toBe('airDash');
  });

  it('a hero with an air dash and a flight: a tap dashes, held it carries on as flight at its speed', () => {
    const tap = up({ airDash: true, flight: true });
    steps(tap.w, { vayo: 1 }, 1); steps(tap.w, {}, 30);
    expect(tap.h.vayoFly).toBeFalsy();
    const held = up({ airDash: true, flight: true });
    steps(held.w, { vayo: 1 }, 20);
    expect(held.h.vayoFly).toBeTruthy(); expect(Math.hypot(...held.h.vayoFly.vh)).toBeGreaterThan(5);
    steps(held.w, {}, 1); steps(held.w, { vayo: 1 }, 1);   // its count spent: V in flight lets go
    expect(held.h.vayoFly).toBeFalsy();
  });

  it('it takes its element\'s dash shape, and is granted and tuned as the others are', () => {
    expect(resolveVayo({ element: 'wind', airDash: true }).airDash.carry).toBeGreaterThan(resolveVayo({ element: 'earth', airDash: true }).airDash.carry);
    expect(TRAVERSAL_MOVES['vayo-air-dash'].rule({}, { element: 'wind' }).vayo).toEqual({ element: 'wind', airDash: true });
    expect(readVayo({ airDash: { count: 2, speed: 14 } })).toBeTruthy();
    expect(() => readVayo({ airDash: { count: 0 } })).toThrow(/count/);
    const card = Object.keys(POLES).map((k) => feelCard({ pole: k })).find((c) => c.dash && c.dash.air);
    if (card) { const t = feelVayo(card).airDash; expect(t.count).toBeGreaterThanOrEqual(1); expect(readVayo({ airDash: t })).toBeTruthy(); }
  });
});

describe('a special ability beside the physical moves', () => {
  it('the physical moves keep their keys: a double tap of boost dodges, V does not', () => {
    const w = world({ dash: true }, { dodge: true, dodgeBoostCost: 0 }), h = w.byId.h;
    steps(w, {}, 10);
    steps(w, { boost: 1 }, 1); steps(w, {}, 2); steps(w, { boost: 1 }, 1);
    expect(h.dodgeT).not.toBeNull(); expect(h.vayoDash).toBeFalsy();
  });

  it('a world without it carries no byte of it, and the engine\'s own pipeline has none of it', () => {
    expect(emissionSource({})).not.toContain('vayo-wake');
    expect(emissionSource({ vayoMove: true })).toContain('vayo-wake');
    expect(composeControllable(EMISSION).platformPhaseOrder().dash).not.toContain('vayo');
    // a hero without one steps byte for byte as the engine without the builder
    const a = world(null);
    for (let i = 0; i < 30; i++) CW.stepWorld(a, { forward: 1, vayo: 1 }, 1 / 60, G);
    const plain = composeControllable(EMISSION);
    const b2 = plain.createWorld({ entities: [hero(null)], pilot: 'h' });
    for (let i = 0; i < 30; i++) plain.stepWorld(b2, { forward: 1, vayo: 1 }, 1 / 60, G);
    expect(JSON.stringify(a.byId.h)).toBe(JSON.stringify(b2.byId.h));
  });

  it('its wake on the world\'s fires: a super\'s dash past a burning crate puts it out, a human\'s fans it', () => {
    const run = (power) => {
      const min = [3, 1, 0], max = [3.4, 1.4, 0.4];
      const w = CW.createWorld({ entities: [hero({ dash: { speed: 12, carry: 8 }, power })], pilot: 'h', breakables: [{ id: 'c', min, max, hp: 1, ...blockMatter({ min, max }, 'pine') }], rupa: {}, vayoAir: true });
      const c = w.breakables[0]; CW.heatBlock(w, 'c', c.rupa.heatCap * 400); steps(w, {}, 2);
      const base = c.rupa.burnRate; steps(w, { vayo: 1 }, 1); steps(w, {}, 40);
      return { out: w.rupa.hits.some((x) => x.how === 'blowout'), fanned: c.rupa.air && c.rupa.air.fan > 1, base };
    };
    expect(run('super').out).toBe(true);
    const human = run('human');
    expect(human.out).toBe(false); expect(human.fanned).toBe(true);
  });
});

describe('read, granted and tuned', () => {
  it('it is read with teaching messages', () => {
    expect(() => readVayo({})).toThrow(/names no move/);
    expect(() => readVayo({ element: 'shadow', dash: true })).toThrow(/element/);
    expect(() => readVayo({ dash: { iframes: [3, 1] } })).toThrow(/iframes/);
    expect(() => readVayo({ dash: { pressure: 3 } })).toThrow(/together/);
    expect(readVayo({ element: VAYO_ELEMENTS[0], flight: { climb: 4 } })).toBeTruthy();
    expect(vayoWords({ element: 'wind', dash: true, power: 'super' })).toMatch(/held to 40/);
  });

  it('a power grants a vayo move in its element, tuned by the game\'s feel, the hero\'s own numbers last', () => {
    const tune = { dash: { speed: 18, rise: 0.05, carry: 2 } };
    const g = TRAVERSAL_MOVES['vayo-dash'].rule({ speed: 6 }, { element: 'fire', tune });
    expect(g.vayo).toEqual({ element: 'fire', dash: tune.dash });
    const own = TRAVERSAL_MOVES['vayo-dash'].rule({ vayo: { element: 'earth', dash: { speed: 9 } } }, { element: 'fire', tune });
    expect(own.vayo.element).toBe('earth'); expect(own.vayo.dash).toEqual({ ...tune.dash, speed: 9 });
    expect(TRAVERSAL_MOVES['vayo-flight'].rule({}, { element: 'shadow' }).vayo).toEqual({ flight: true });
    expect(TRAVERSAL_MOVES['vayo-jump'].rule({ vayo: { dash: true } }, {}).vayo).toEqual({ dash: true, jump: true });
    expect(readVayo(g.vayo)).toBeTruthy();
  });

  it('a feel card\'s dash and jetpack tune a vayo move, and a hero without one lowers as it did', () => {
    const withDash = Object.keys(POLES).map((k) => feelCard({ pole: k })).find((c) => c.dash && c.dash.speed > 0 && c.dash.frames > 0);
    const t = feelVayo(withDash);
    expect(t.dash.speed).toBe(withDash.dash.speed);
    expect(readVayo({ dash: t.dash })).toBeTruthy();
    expect(feelVayo({})).toBeNull();
    const withAir = Object.keys(POLES).map((k) => feelCard({ pole: k })).find((c) => c.air && c.air.jumps >= 1);
    if (withAir) { const j = feelVayo(withAir).jump; expect(j.count).toBe(Math.round(withAir.air.jumps)); expect(readVayo({ jump: j })).toBeTruthy(); }
    expect(lowerFeel(withDash).rule.vayo).toBeUndefined();
  });
});
