import { describe, it, expect } from 'vitest';
import { streetOf, stepStreet, readWaves, STAGE_PAUSE } from './brawl-crowd.js';
import { brawlHash } from './brawl-core.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// A BOSS'S STAGES: the boss fight in acts. Each stage begins as its health falls to a share of what it came in with: it
// fights as that stage says from there, it is untouchable a moment, the street is told, and its call comes in.
const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, boss: true }] }, 'belt');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const boss = { ...solveFighter({ id: 'king', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'King' };
const stages = [{ cpu: 'novice' }, { at: 0.6, cpu: 'veteran', name: 'Enraged' }, { at: 0.25, plays: ['strong', 'run'], name: 'Last stand' }];
const waves = (over = {}) => [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'knife', n: 2, stage: 1 }, { type: 'heavy', n: 1, stage: 2 }], boss: { recipe: boss, stages, ...over } }];
const street = (w = waves()) => streetOf({ belt, players: [{ recipe }], waves: w });
// (walk on; `hurt` lowers the boss's health to a share of what it came in with, as blows would)
function play(st, frames, hurt = () => null) {
  const ev = [];
  for (let f = 0; f < frames; f++) {
    const b = st.s.bodies.find((p) => st.mind.bosses[p.id]), to = hurt(f, st);
    if (to !== null && b && !b.gone) b.hp = Math.round(st.mind.bosses[b.id].hpMax * to);
    st = stepStreet(st, [{ x: 1 }]);
    ev.push(...st.s.events.map((e) => ({ ...e, f })));
  }
  return { st, ev };
}

describe('a boss\'s stages', () => {
  it('are read: two to five, the first as it comes in, each after it at a lower share of its health', () => {
    const W = readWaves(waves(), belt)[0];
    expect(W.boss.stages.map((s) => s.at)).toEqual([1, 0.6, 0.25]);
    expect(W.crowd.map((c) => c.stage)).toEqual([undefined, 1, 2]);
    // (unsaid, the stages share its health evenly)
    expect(readWaves(waves({ stages: [{}, {}, {}, {}] }), belt)[0].boss.stages.map((s) => s.at)).toEqual([1, 0.75, 0.5, 0.25]);
    expect(() => readWaves(waves({ stages: [{}] }), belt)).toThrow(/two to five stages/);
    expect(() => readWaves(waves({ stages: [{}, { at: 0.5 }, { at: 0.7 }] }), belt)).toThrow(/each after it lower/);
    expect(() => readWaves(waves({ stages: [{}, { cpu: 'godlike' }] }), belt)).toThrow(/cpu is one of/);
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'thug', n: 1, stage: 1 }] }], readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, gate: true }] }, 'b'))).toThrow(/a boss's wave only/);
  });

  it('comes in at its first stage; the bodies a later stage calls wait offstage', () => {
    const { st, ev } = play(street(), 500);
    const B = st.s.bodies.find((p) => st.mind.bosses[p.id]);
    expect(ev.some((e) => e.t === 'boss')).toBe(true);
    expect(st.mind.bosses[B.id]).toMatchObject({ stage: 0, cpu: 'novice' });
    expect(ev.some((e) => e.t === 'bossStage')).toBe(false);
    // (the thug it came with is on the street; the knives and the heavy are not yet)
    const called = Object.keys(st.mind.calls).map(Number);
    expect(called).toHaveLength(3);
    expect(called.every((id) => st.s.bodies[id].gone)).toBe(true);
  });

  it('its health down to a stage\'s share, the stage begins: how it fights, a moment untouchable, the street told, its call in', () => {
    const { st, ev } = play(street(), 900, (f) => (f === 500 ? 0.55 : null));
    const B = st.s.bodies.find((p) => st.mind.bosses[p.id]), told = ev.filter((e) => e.t === 'bossStage');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ k: 2, of: 3, name: 'Enraged' });
    expect(st.mind.bosses[B.id]).toMatchObject({ stage: 1, cpu: 'veteran' });
    const after = play(street(), 501 + 1, (f) => (f === 500 ? 0.55 : null)).st;
    expect(after.s.bodies.find((p) => after.mind.bosses[p.id]).inv).toBeGreaterThan(STAGE_PAUSE - 5);
    // (the two knives it calls at that stage have come in; the heavy still waits for the last)
    const calls = st.mind.calls, knives = Object.keys(calls).filter((id) => calls[id] === 1).map(Number), heavy = Object.keys(calls).filter((id) => calls[id] === 2).map(Number);
    expect(knives.some((id) => !st.s.bodies[id].gone)).toBe(true);
    expect(heavy.every((id) => st.s.bodies[id].gone)).toBe(true);
  });

  it('a blow that takes it past two stages at once begins the last; what a stage does not say is the stage before it', () => {
    const { st, ev } = play(street(), 700, (f) => (f === 500 ? 0.1 : null));
    const B = st.s.bodies.find((p) => st.mind.bosses[p.id]);
    expect(ev.filter((e) => e.t === 'bossStage').map((e) => e.k)).toEqual([3]);
    expect(st.mind.bosses[B.id]).toMatchObject({ stage: 2, cpu: 'veteran', plays: ['strong', 'run'] });
  });

  it('fallen, its wave flees and the stage is clear, whoever it never called; a boss with no stages is as it was', () => {
    const { ev } = play(street(), 900, (f) => (f === 500 ? 0 : null));
    const end = play(street(), 520, (f) => (f === 500 ? 0.0001 : null)).st;
    const B = end.s.bodies.find((p) => end.mind.bosses[p.id]);
    B.hp = 0; B.ko = 1; B.st = 'ko';
    const done = stepStreet(end, [{}]);
    expect(done.s.events.some((e) => e.t === 'stageClear')).toBe(true);
    expect(done.mind.wave).toBe(1);
    expect(ev.length).toBeGreaterThan(0);
    const plain = () => { let s = streetOf({ belt, players: [{ recipe }], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }], boss: { recipe: boss } }] }); for (let f = 0; f < 300; f++) s = stepStreet(s, [{ x: 1 }]); return s; };
    expect(plain().mind.calls).toBeUndefined();
    expect(plain().mind.bosses[1].stages).toBeUndefined();
    expect(brawlHash(plain().s)).toBe(brawlHash(plain().s));
  });
});
