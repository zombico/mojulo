import { describe, it, expect } from 'vitest';
import { streetOf, stepStreet, readWaves, CROWD_TYPES, STAGE_PAUSE } from './brawl-crowd.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';
import { powerRecipe } from './brawl-powers.js';

// THE FOE SHELF'S IDIOMS ON THE STREET (docs/foes.md): a summoner and its summons, a pair, a boss defeated into its next
// form. Each is a word on a wave, read by the street's mind; a street that says none plays as it did.
const gated = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, gate: true }] }, 'belt');
const bossed = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, boss: true }] }, 'belt');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const fighter = (id, archetype, name, power) => { const r = { ...solveFighter({ id, archetype }).recipe, archetype, name }; return power ? powerRecipe(r, power) : r; };
// (walk on into the screen; `act` touches the street before each frame, as blows would)
function play(st, frames, act = () => {}) {
  const ev = [];
  for (let f = 0; f < frames; f++) { act(f, st); st = stepStreet(st, [{ x: 1 }]); ev.push(...st.s.events.map((e) => ({ ...e, f }))); }
  return { st, ev };
}
const fell = (p) => { p.hp = 0; p.ko = 1; p.st = 'ko'; };

describe('a summoner and its summons', () => {
  const caster = (summons) => streetOf({ belt: gated, players: [{ recipe }], waves: [{ screen: 1, crowd: [{ type: 'caster', n: 1, summons }] }] });
  it('is read: who it calls (never a summoner), how many at once, how often, bound unless said', () => {
    expect(readWaves([{ screen: 1, crowd: [{ type: 'caster', n: 1, summons: { type: 'drone' } }] }], gated)[0].crowd[0].summons).toEqual({ type: 'drone', n: 2, every: 240, bound: true });
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'caster', n: 1, summons: { type: 'caster' } }] }], gated)).toThrow(/does not call a summoner/);
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'caster', n: 1, summons: { type: 'drone', n: 9 } }] }], gated)).toThrow(/at once/);
    expect(CROWD_TYPES.caster.hangs).toBe(true);
  });
  it('calls them in a few at a time while it stands, never more than its number at once', () => {
    const { st, ev } = play(caster({ type: 'drone', n: 2, every: 60 }), 900);
    const calls = ev.filter((e) => e.t === 'summon');
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const S = Object.values(st.mind.summons)[0];
    expect(S.out.filter((id) => !st.s.bodies[id].ko).length).toBeLessThanOrEqual(2);
    // (it keeps back while one of its summons stands: no token of its own)
    const id = Number(Object.keys(st.mind.summons)[0]);
    expect(Object.values(st.mind.tok).flat()).not.toContain(id);
  });
  it('fallen, those it called are cut down if bound, and those it never called stay uncalled; unbound, they fight on', () => {
    for (const bound of [true, false]) {
      let { st } = play(caster({ type: 'drone', n: 2, every: 60, bound }), 600);
      const id = Number(Object.keys(st.mind.summons)[0]), out = st.mind.summons[id].out.filter((k) => !st.s.bodies[k].ko);
      expect(out.length, `bound ${bound}`).toBeGreaterThan(0);
      fell(st.s.bodies[id]);
      const r = play(st, 2);
      st = r.st;
      const standing = out.filter((k) => !st.s.bodies[k].ko);
      if (bound) { expect(standing).toEqual([]); expect(r.ev.filter((e) => e.t === 'cut').length).toBe(out.length); }
      else expect(standing.length).toBe(out.length);
      expect(st.mind.summons[id].pool).toEqual([]);
    }
  });
  it('a street with no summoner carries none of it', () => {
    const plain = streetOf({ belt: gated, players: [{ recipe }], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 2 }] }] });
    expect(plain.mind.summons).toBeUndefined();
  });
});

describe('a pair', () => {
  const pair = (down) => streetOf({ belt: bossed, players: [{ recipe }], waves: [{ screen: 1, crowd: [], boss: { recipe: fighter('a', 'grappler', 'Left'), pair: { recipe: fighter('b', 'rushdown', 'Right'), ...(down ? { down } : {}) } } }] });
  it('stands two bosses as one encounter, each the other\'s, each its own bar', () => {
    const st = pair(), ids = Object.keys(st.mind.bosses).map(Number);
    expect(ids).toHaveLength(2);
    expect(st.mind.bosses[ids[0]].pair).toBe(ids[1]);
    expect(st.mind.bosses[ids[1]].pair).toBe(ids[0]);
  });
  it('one down, the other enrages; the stage is clear only when both are', () => {
    let { st } = play(pair(), 400);
    const [a, b] = Object.keys(st.mind.bosses).map(Number);
    fell(st.s.bodies[a]);
    const r = play(st, 3);
    st = r.st;
    expect(r.ev.some((e) => e.t === 'enrage' && e.p === b)).toBe(true);
    expect(st.mind.bosses[b].cpu).toBe('ace');
    expect(st.s.bodies[b].inv).toBeGreaterThan(0);
    expect(r.ev.some((e) => e.t === 'stageClear')).toBe(false);
    fell(st.s.bodies[b]);
    expect(play(st, 3).ev.some((e) => e.t === 'stageClear')).toBe(true);
    // (`down: 'none'`: the other fights on as it was)
    let q = play(pair('none'), 400).st;
    const [c, d] = Object.keys(q.mind.bosses).map(Number);
    fell(q.s.bodies[c]);
    q = play(q, 3).st;
    expect(q.mind.bosses[d].enraged).toBeUndefined();
  });
});

describe('a boss defeated into its next form', () => {
  const armour = fighter('suit', 'grappler', 'The Juggernaut', 'might'), pilot = fighter('pilot', 'rushdown', 'Out of the suit', 'frenzy');
  const street = () => streetOf({ belt: bossed, players: [{ recipe }], waves: [{ screen: 1, crowd: [], boss: { recipe: armour, stages: [{}, { at: 0.5, name: 'The suit breaks', form: pilot }] } }] });
  it('is read: a stage\'s form is a fighter, never its first stage\'s', () => {
    expect(() => readWaves([{ screen: 1, crowd: [], boss: { recipe: armour, stages: [{ form: pilot }, {}] } }], bossed)).toThrow(/form/);
  });
  it('as the stage begins it fights as its next form: that fighter\'s moves and power, its health carried on', () => {
    let { st } = play(street(), 300);
    const id = Number(Object.keys(st.mind.bosses)[0]), before = st.s.bodies[id].fi;
    const r = play(st, 4, (f, S) => { if (f === 0) S.s.bodies[id].hp = Math.round(S.mind.bosses[id].hpMax * 0.4); });
    st = r.st;
    const B = st.s.bodies[id];
    expect(r.ev.some((e) => e.t === 'becomes' && e.name === 'Out of the suit')).toBe(true);
    expect(B.fi).not.toBe(before);
    expect(st.ctx.fighters[B.fi].moves['special.neutral.M']).toBeTruthy();
    expect(B.hp).toBeGreaterThan(0);
    expect(B.inv).toBeGreaterThan(0);
    expect(STAGE_PAUSE).toBeGreaterThan(0);
  });
});

describe('a henchman with a power', () => {
  it('fires its power as a special; its fighter carries it', () => {
    const st = streetOf({ belt: gated, players: [{ recipe }], waves: [{ screen: 1, crowd: [{ type: 'blaster', n: 1 }] }] });
    const F = st.ctx.fighters[st.s.bodies.find((p) => st.mind.type[p.id] === 'blaster').fi];
    expect(F.moves['special.neutral.M']).toBeTruthy();
  });
});
