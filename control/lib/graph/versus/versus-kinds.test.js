import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, readRules } from './versus-core.js';
import { solveFighter } from './versus-solver.js';
import { SYSTEMS, LIMB_POINTS } from './versus-library.js';
import { FIGHT_KINDS, FIGHT_KIND_IDS, kindRules, kindReport, kindRecipe } from './versus-kinds.js';

// MOJULO FIGHTER AS A HOST: the kinds of fighting game as words over versus's systems, and the systems a kind lacked
const Z = { x: 0, y: 0, b: 0 };
const K = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe);
function fight(d, systems) {
  const ctx = { fighters: [K, K] };
  let s = newVersus(ctx, { rules: { intro: 1, ...(systems ? { systems } : {}) } });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2); s.p[1].x = Math.round(d / 2);
  return { ctx, s };
}
function run(s, ctx, n, fn) {
  const events = [], trace = [];
  for (let k = 0; k < n; k++) { s = stepVersus(s, [fn(k, s), Z], ctx); for (const e of s.events) events.push([k, e]); trace.push({ mv: s.p[0].mv, st: s.p[0].st, x: s.p[0].x, y: s.p[0].y }); }
  return { s, events, trace };
}

describe('the kinds', () => {
  it('every kind switches on only systems versus runs, and says what it lacks', () => {
    for (const id of FIGHT_KIND_IDS) {
      const R = kindRules(id);
      for (const w of R.systems ?? []) expect(SYSTEMS[w], `${id} ${w}`).toBeTruthy();
      expect(Array.isArray(kindReport(id).lacks)).toBe(true);
    }
    expect(kindReport('anime-air')).toMatchObject({ kind: 'anime-air', after: 'Guilty Gear', look: 'cel', flavor: 'action' });
    expect(() => kindRules('kombat')).toThrow(/kind is one of street, anime-air, iron, tag, platform/);
  });
  it('a game\'s own rules lie over its kind: systems added, a dial it sets wins; readRules takes the kind', () => {
    expect(kindRules('anime-air', { systems: ['parry'], guardMax: 500 })).toEqual({ guardMax: 500, systems: [...FIGHT_KINDS['anime-air'].systems, 'parry'] });
    expect(kindRules('street')).toEqual({});
    expect(readRules({ kind: 'anime-air', timer: 60 })).toEqual({ timer: 60, systems: [...FIGHT_KINDS['anime-air'].systems] });
    expect(readRules({ kind: 'platform' })).toEqual({ airActions: 2, systems: ['airjump'] });
  });
});

describe('the gatling', () => {
  // a light that connects, then a medium pressed after the hit: a cancel is the light becoming the medium with no
  // neutral frame between
  const chain = (systems) => {
    const { ctx, s } = fight(700, systems);
    let hitAt = null;
    const { trace } = run(s, ctx, 60, (k, st) => {
      if (hitAt === null && st.events.some((e) => e.t === 'hit' || e.t === 'block')) hitAt = k;
      return { x: 0, y: 0, b: k === 0 ? 1 : hitAt !== null && k === hitAt + 1 ? 2 : 0 };
    });
    return trace.some((t, i) => i > 0 && trace[i - 1].mv === 'stand.L' && t.mv === 'stand.M');
  };
  it('on, a connected light cancels into the medium; off, it plays out first', () => {
    expect(chain(['gatling'])).toBe(true);
    expect(chain(null)).toBe(false);
  });
});

describe('the air actions', () => {
  const peak = (tr) => Math.max(...tr.map((t) => t.y));
  it('the air jump: up again, a fresh press, rises again, once a jump by default; off, nothing', () => {
    const jumps = (systems) => { const { ctx, s } = fight(2400, systems); return run(s, ctx, 90, (k) => ({ x: 0, y: k < 3 || (k >= 16 && k < 19) || (k >= 26 && k < 29) ? 1 : 0, b: 0 })); };
    const on = jumps(['airjump']), off = jumps(null);
    expect(on.events.filter(([, e]) => e.t === 'airjump')).toHaveLength(1);
    expect(off.events.filter(([, e]) => e.t === 'airjump')).toHaveLength(0);
    expect(peak(on.trace)).toBeGreaterThan(peak(off.trace));
    expect('aa' in off.s.p[0]).toBe(false);   // absent, no field
  });
  it('the air dash: forward twice in the air flies level, its distance covered', () => {
    const { ctx, s } = fight(3000, ['airdash']);
    const pad = (k) => ({ x: k >= 14 && k < 16 ? 1 : k >= 18 && k < 20 ? 1 : 0, y: k < 3 ? 1 : 0, b: 0 });
    const { events, trace } = run(s, ctx, 60, pad);
    const at = events.find(([, e]) => e.t === 'airdash');
    expect(at).toBeTruthy();
    const k = at[0], R = s.rules;
    expect(trace[k + 4].y).toBe(trace[k].y);   // level
    expect(trace[k + R.airDashFrames].x - trace[k].x).toBeGreaterThan(R.airDashDist * 0.8);
  });
});

describe('the reset (the Roman cancel)', () => {
  const tryReset = (systems, meter) => {
    const { ctx, s } = fight(2400, systems);
    s.p[0].meter = meter;
    return run(s, ctx, 12, (k) => ({ x: 0, y: 0, b: k === 0 ? 4 : k === 3 ? 7 : 0 }));
  };
  it('L + M + H in a move, with the meter, ends it at once and pays; without the meter or the system, the move plays on', () => {
    const on = tryReset(['reset'], 1000), at = on.events.find(([, e]) => e.t === 'reset');
    expect(at).toBeTruthy();
    expect(on.trace[at[0]]).toMatchObject({ mv: null, st: 'stand' });
    expect(on.s.p[0].meter).toBeLessThanOrEqual(500);
    for (const [systems, meter] of [[['reset'], 100], [null, 1000]]) {
      const r = tryReset(systems, meter);
      expect(r.events.some(([, e]) => e.t === 'reset')).toBe(false);
      expect(r.trace[4].mv).toBe('stand.H');
    }
  });
});

describe('iron: the four limbs, strings, the bound, the sidestep', () => {
  const ironK = compileFighter(kindRecipe(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe, kindRules('iron')));
  const duel = (d, systems, fighters = [ironK, ironK]) => {
    const ctx = { fighters };
    let s = newVersus(ctx, { rules: { intro: 1, systems } });
    s = stepVersus(s, [Z, Z], ctx);
    s.p[0].x = -Math.round(d / 2); s.p[1].x = Math.round(d / 2);
    return { ctx, s };
  };
  it('a button a limb: the limbs scheme on both players; L, M, H and S start the lead hand, the rear hand, the lead leg and the rear leg', () => {
    for (const [n, slot] of [[1, 'stand.1'], [2, 'stand.2'], [4, 'stand.3'], [8, 'stand.4']]) {
      const { ctx, s } = duel(2400, ['limbs']);
      expect(s.p.map((p) => p.scheme)).toEqual(['limbs', 'limbs']);
      const r = run(s, ctx, 3, (k) => ({ x: 0, y: 0, b: k === 0 ? n : 0 }));
      expect(r.trace.find((t) => t.mv)?.mv).toBe(slot);
    }
    const pts = [1, 2, 3, 4].map((n) => ironK.moves[`stand.${n}`].limb);
    [1, 2, 3, 4].forEach((n, i) => expect(LIMB_POINTS[n]).toContain(pts[i]));
  });
  it('a string follows on in its order even on a whiff; out of order, or without the system, it does not', () => {
    const follow = (systems, a, b) => {
      const { ctx, s } = duel(2800, systems);
      const r = run(s, ctx, 30, (k, st) => ({ x: 0, y: 0, b: k === 0 ? a : st.p[0].mv === `stand.${a === 1 ? 1 : 2}` && st.p[0].mf === ironK.moves[`stand.${a === 1 ? 1 : 2}`].startup ? b : 0 }));
      return r.trace.some((t, i) => i > 0 && r.trace[i - 1].mv === `stand.${a === 1 ? 1 : 2}` && t.mv === `stand.${b === 2 ? 2 : 1}`);
    };
    expect(follow(['limbs', 'strings'], 1, 2)).toBe(true);    // 1, 2
    expect(follow(['limbs', 'strings'], 2, 1)).toBe(false);   // 2, 1 is no string
    expect(follow(['limbs'], 1, 2)).toBe(false);              // whiffed, and no strings
  });
  it('the bound: a heavy blow on a juggled body pops it back up once a combo; without it a normal does not juggle', () => {
    const juggle = (systems) => {
      const { ctx, s } = duel(500, systems);
      Object.assign(s.p[1], { st: 'fall', y: 500, vy: 60, vx: 0, jug: 1, combo: 1 });
      return run(s, ctx, 20, (k) => ({ x: 0, y: 0, b: k === 0 ? 8 : 0 }));
    };
    const on = juggle(['limbs', 'bound']), off = juggle(['limbs']);
    const at = on.events.find(([, e]) => e.t === 'bound');
    expect(at).toBeTruthy();
    expect(on.events.filter(([, e]) => e.t === 'bound')).toHaveLength(1);
    expect(off.events.some(([, e]) => e.t === 'hit' || e.t === 'bound')).toBe(false);
  });
  it('the sidestep: a tap of up steps aside, strikes passing through; held, it is a jump', () => {
    const tap = (frames, systems = ['sidestep']) => { const { ctx, s } = duel(2400, systems); return run(s, ctx, 12, (k) => ({ x: 0, y: k < frames ? 1 : 0, b: 0 })); };
    const t = tap(2), held = tap(8), off = tap(2, null);
    expect(t.events.some(([, e]) => e.t === 'sidestep')).toBe(true);
    expect(t.trace.some((x) => x.st === 'side')).toBe(true);
    expect(held.trace.some((x) => x.st === 'side')).toBe(false); expect(held.trace.some((x) => x.st === 'air')).toBe(true);
    expect(off.trace.some((x) => x.st === 'side')).toBe(false);
    // a jab into the sidestep passes through
    const jabbed = (up) => { const { ctx, s } = duel(700, ['sidestep']); let st = s; const ev = []; for (let k = 0; k < 14; k++) { st = stepVersus(st, [{ x: 0, y: k < up ? 1 : 0, b: 0 }, { x: 0, y: 0, b: k === 2 ? 1 : 0 }], ctx); ev.push(...st.events); } return ev.some((e) => e.t === 'hit' || e.t === 'counter'); };
    expect(jabbed(0)).toBe(true);    // standing, the jab lands
    expect(jabbed(2)).toBe(false);   // stepped aside, it passes through
  });
});
