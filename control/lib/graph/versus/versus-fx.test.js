// The fight's effects: what happens told apart at a glance (each event its card, a blow's weight its size), the elements
// a fighter's limbs carry (read on its recipe, drawn only: the sim never reads them), the spark's moment (system
// 'spark'), and the arena drawing them in the round under a register.
import { describe, it, expect } from 'vitest';
import { fxCard, fxBolt, readElement, FX_CARDS, FX_ELEMENTS, FX_SKINS } from './versus-fx.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';
import { newVersus, stepVersus, versusHash } from './versus-core.js';
import { runVersus } from './versus-match.js';
import { BTN } from './versus-input.js';
import { FIGHT_REGISTERS } from './versus-levels.js';

const Z = { x: 0, y: 0, b: 0 };
const base = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const K = compileFighter(base);
const blow = (t, w, limb = 'fist', extra = {}) => ({ t, p: 0, at: [100, 1200], w, limb, kind: 'normal', ...extra });

describe('versus fx: the cards', () => {
  it('each thing that happens has its own card, told apart by its parts and its colour', () => {
    const cards = ['hit', 'counter', 'block', 'parry', 'clash', 'crush', 'spark', 'ko'].map((t) => fxCard(blow(t, 1)));
    expect(cards.every(Boolean)).toBe(true);
    const sig = (c) => JSON.stringify([Object.keys(c).filter((k) => typeof c[k] === 'object' && k !== 'at').sort(), c.tint, !!c.dark]);
    expect(new Set(cards.map(sig)).size).toBe(cards.length);
    // (a block is a shield, never a burst; a spark is dark, held, and turns the picture negative)
    expect(fxCard(blow('block', 1))).toMatchObject({ arc: expect.any(Object) });
    expect(fxCard(blow('block', 1)).core).toBeUndefined();
    expect(fxCard(blow('spark', 2))).toMatchObject({ dark: true, hold: 'stop', frame: { kind: 'invert' }, bolts: expect.any(Object) });
    // (events that draw nothing here, and a blow that sparked, drawn by its spark alone)
    expect(fxCard({ t: 'round', n: 1 })).toBeNull();
    expect(fxCard(blow('hit', 1, 'fist', { spark: 1 }))).toBeNull();
    expect(fxCard({ t: 'hit', p: 0 })).toBeNull();
  });

  it('a heavier blow is bigger, brighter and longer: the weight reads', () => {
    const [L, M, H, S] = [0, 1, 2, 3].map((w) => fxCard(blow('hit', w)));
    for (const [a, b] of [[L, M], [M, H], [H, S]]) {
      expect(b.core.size).toBeGreaterThan(a.core.size);
      expect(b.light.power).toBeGreaterThan(a.light.power);
      expect(b.rays.n).toBeGreaterThanOrEqual(a.rays.n);
      expect(b.core.life).toBeGreaterThanOrEqual(a.core.life);
    }
  });

  it('every register draws the same library its own way', () => {
    expect(Object.keys(FX_SKINS).sort()).toEqual([...FIGHT_REGISTERS].sort());
    expect(FX_SKINS.anime.bands).toBeGreaterThan(0);
    expect(FX_SKINS.western.bands).toBe(0);
  });

  it('a jagged current runs end to end, the same for the same seed', () => {
    const a = fxBolt(7, [0, 0], [1, 0], 8, 0.2), b = fxBolt(7, [0, 0], [1, 0], 8, 0.2), c = fxBolt(8, [0, 0], [1, 0], 8, 0.2);
    expect(a).toHaveLength(9);
    expect(a[0]).toEqual([0, 0]);
    expect(a[8][0]).toBeCloseTo(1, 9);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(Math.max(...a.map((q) => Math.abs(q[1])))).toBeLessThanOrEqual(0.2);
  });
});

describe('versus fx: the elements', () => {
  it('an element is read on the recipe and carried by the compiled fighter, drawn only: the fight is the same fight', () => {
    expect(readElement('fire')).toEqual({ kind: 'fire', on: 'fists' });
    expect(readElement({ kind: 'lightning', on: 'feet' })).toEqual({ kind: 'lightning', on: 'feet' });
    expect(() => readElement('plasma')).toThrow(/kind is one of/);
    expect(() => readElement({ kind: 'fire', on: 'tail' })).toThrow(/on is one of/);
    const lit = compileFighter({ ...base, element: 'fire' });
    expect(lit.element).toEqual({ kind: 'fire', on: 'fists' });
    expect(K.element).toBeUndefined();
    const fight = (F) => runVersus({ fighters: [F, K], seed: 4, maxFrames: 900 }).hash;
    expect(fight(lit)).toBe(fight(K));
    expect(solveFighter({ id: 'x', archetype: 'rushdown', element: 'lightning' }).recipe.element).toBe('lightning');
  });

  it('a blow struck with the limb an element rides coats the one struck in the element; any other limb, as a blow', () => {
    const plain = fxCard(blow('hit', 1, 'fist'));
    for (const kind of Object.keys(FX_ELEMENTS)) {
      const on = fxCard(blow('hit', 1, 'fist'), { kind, on: 'fists' });
      expect(on).toMatchObject({ element: kind, tint: FX_ELEMENTS[kind].rim, coat: { color: FX_ELEMENTS[kind].rim } });
      expect(on.coat.k).toBeGreaterThan(plain.coat.k);
      expect(!!on.coat.dark).toBe(!!FX_ELEMENTS[kind].dark);
      expect(fxCard(blow('hit', 1, 'foot'), { kind, on: 'fists' }).element).toBeUndefined();
    }
    // (a block is still a block, whatever struck it)
    expect(fxCard(blow('block', 1, 'fist'), { kind: 'fire', on: 'fists' }).element).toBeUndefined();
  });
});

describe('versus fx: what the sim says of a blow, and the spark', () => {
  const fight = (d, fighters, rules) => {
    const ctx = { fighters };
    let s = newVersus(ctx, { rules: { intro: 1, ...(rules ?? {}) } });
    s = stepVersus(s, [Z, Z], ctx);
    s.p[0].x = -Math.round(d / 2); s.p[1].x = Math.round(d / 2);
    return { ctx, s };
  };
  const run = (s, ctx, n, fn) => { const ev = []; for (let k = 0; k < n; k++) { s = stepVersus(s, fn(k, s), ctx); ev.push(...s.events); } return { s, ev }; };

  it('a blow says where it landed, how heavy, what struck and its kind', () => {
    for (let d = 600; d <= 1200; d += 50) {
      const { ctx, s } = fight(d, [K, K]);
      const r = run(s, ctx, 30, (k) => [{ ...Z, b: k === 0 ? BTN.H : 0 }, Z]);
      const hit = r.ev.find((e) => e.t === 'hit');
      if (!hit) continue;
      expect(hit).toMatchObject({ w: 2, kind: 'normal', limb: expect.stringMatching(/fist|foot|knee|elbow/) });
      // (on the defender: between the two, at a body's height)
      expect(hit.at[0]).toBeGreaterThan(-d / 2);
      expect(hit.at[0]).toBeLessThan(d / 2 + 300);
      expect(hit.at[1]).toBeGreaterThan(200);
      return;
    }
    throw new Error('the heavy never landed');
  });

  it('a counter hit struck on its first active frame is a spark under the system, and only under it', () => {
    // (the defender starts a slow move; the jab is timed to land on its own first active frame inside that startup)
    const slow = 'stand.H', jab = K.moves['stand.L'];
    const tryAt = (rules) => {
      for (let d = 500; d <= 1100; d += 25) for (let lead = 0; lead <= 4; lead++) {
        const { ctx, s } = fight(d, [K, K], rules);
        const r = run(s, ctx, 40, (k) => [{ ...Z, b: k === lead ? BTN.L : 0 }, { ...Z, b: k === 0 ? BTN.H : 0 }]);
        const c = r.ev.find((e) => (e.t === 'counter' || e.t === 'spark') && e.p === 0);
        if (c) return r.ev;
      }
      return null;
    };
    const on = tryAt({ systems: ['spark'] }), off = tryAt();
    expect(on && off).toBeTruthy();
    const spark = on.find((e) => e.t === 'spark');
    expect(spark).toMatchObject({ p: 0, at: expect.any(Array) });
    expect(on.find((e) => e.t === 'counter' && e.p === 0)).toMatchObject({ spark: 1 });
    expect(off.some((e) => e.t === 'spark')).toBe(false);
    // (half again a jab's damage, not a counter's fifth)
    expect(spark.dmg).toBeGreaterThan(Math.floor((jab.damage * 6) / 5));
    expect(K.moves[slow].startup).toBeGreaterThan(jab.startup);
  });

  it('absent, the spark system changes nothing', () => {
    expect(runVersus({ fighters: [K, K], seed: 9, maxFrames: 1200, rules: { systems: [] } }).hash).toBe(runVersus({ fighters: [K, K], seed: 9, maxFrames: 1200 }).hash);
    expect(typeof versusHash).toBe('function');
  });
});

describe('versus fx: in the arena', () => {
  it('the arena block carries the effects and draws them only under a register', async () => {
    const { versusArenaData } = await import('./versus-page.js');
    const { versusChannelScript } = await import('../scene/channels/versus.js');
    const js = versusChannelScript(versusArenaData({ roster: [{ id: 'a', archetype: 'zoner' }], register: 'anime' }));
    expect(js).toContain('function makeFightFx(');
    expect(js).toContain('const FX = RIG ? makeFightFx(');
    expect(js).toContain('logdepthbuf_vertex');
    // (the figure is coated, a fresnel rim on its own surface, not drawn over)
    expect(js).toContain('function bodyCoat()');
    expect(js).toContain('totalEmissiveRadiance += uElCol');
    // (and every blow that lands coats the one it lands on, round where it landed or whole)
    for (const t of ['hit', 'counter', 'block', 'spark', 'ko']) expect(FX_CARDS[t].coat, t).toBeDefined();
    expect(FX_CARDS.spark.coat.dark).toBe(true);
    expect(FX_CARDS.spark.hold).toBe('stop');
  });
});
