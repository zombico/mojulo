import { describe, it, expect } from 'vitest';
import { streetOf, stepStreet, readWaves, GUN_BOSS, GUN_BOSS_PLAYS } from './brawl-crowd.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';
import { GUN_MUZZLE } from './brawl-guns.js';

// A RUN & GUN'S BOSS: a gunner that keeps its range and fires in a pattern, each step one of the three things a street's
// fire teaches: a volley at the chest (duck), one at the knee (jump), a grenade (move off the spot). It never closes.
const belt = readBelt({ at: [0, 0], heading: 0, depth: [-1.25, 1.25], angle: 'classic', screens: [{ length: 14 }, { length: 16, boss: true }] }, 'belt');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const king = { ...solveFighter({ id: 'king', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'King' };
const waves = (boss = {}) => [{ screen: 1, crowd: [], boss: { recipe: king, gun: true, ...boss } }];
const street = (boss) => streetOf({ belt, players: [{ recipe }], waves: waves(boss), range: { guns: ['rifle'], grenades: 0 } });
// (the player walks on to the boss's screen, then stands; what the boss fired is read from the sim's events and rounds)
function watch(st, frames) {
  const rounds = [], lobs = [];
  let near = Infinity;
  for (let f = 0; f < frames; f++) {
    const B = st.s.bodies.find((p) => st.mind.bosses[p.id]);
    st = stepStreet(st, [B && !B.gone ? {} : { x: 1 }]);
    const b = st.s.bodies.find((p) => st.mind.bosses[p.id]), me = st.s.bodies[0];
    if (b && !b.gone && b.st !== 'enter') near = Math.min(near, Math.abs(b.x - me.x));
    for (const t of st.s.shots) if (t.side === 'crowd' && !rounds.some((r) => r.id === t.id) && !lobs.includes(t.id)) { if (t.lob) lobs.push(t.id); else rounds.push({ id: t.id, f, low: t.y < GUN_MUZZLE[1] * 0.8 }); }
  }
  return { st, rounds, lobs, near };
}

describe('a run & gun\'s boss', () => {
  it('is read: its gun, its pattern of high, low and lob, its volley and its beat; a stage may say its own', () => {
    expect(Object.keys(GUN_BOSS_PLAYS)).toEqual(['high', 'low', 'lob']);
    const B = readWaves(waves({ plays: ['high', 'low'], volley: 2, beat: 60 }), belt)[0].boss;
    expect(B).toMatchObject({ plays: ['high', 'low'], volley: 2, beat: 60 });
    expect(B.gun).toBeTruthy();
    // (unsaid: the one volley at the chest, at its own beat)
    expect(readWaves(waves(), belt)[0].boss).toMatchObject({ plays: [...GUN_BOSS.plays] });
    expect(readWaves(waves({ stages: [{}, { plays: ['low', 'lob'], beat: 40 }] }), belt)[0].boss.stages[1]).toMatchObject({ plays: ['low', 'lob'], beat: 40 });
    expect(() => readWaves(waves({ plays: ['strong'] }), belt)).toThrow(/high|low|lob/);
    expect(() => readWaves(waves({ volley: 9 }), belt)).toThrow(/volley/);
    expect(() => readWaves(waves({ beat: 5 }), belt)).toThrow(/beat/);
  });

  it('keeps its range and fires its pattern in order: chest rounds, then knee rounds', () => {
    const W = watch(street({ plays: ['high', 'low'], beat: 40 }), 1500);
    expect(W.rounds.length).toBeGreaterThan(3);
    // (it never closes to strike)
    expect(W.near).toBeGreaterThan(2000);
    expect(W.rounds.slice(0, 4).map((r) => r.low)).toEqual([false, true, false, true]);
    expect(W.lobs).toEqual([]);
  }, 60_000);

  it('a lob in its pattern is a grenade in the air; a volley of two is two rounds', () => {
    const W = watch(street({ plays: ['lob', 'high'], volley: 2, beat: 40 }), 1500);
    expect(W.lobs.length).toBeGreaterThan(0);
    const [a, b] = W.rounds;
    expect(b.f - a.f).toBeLessThan(40);
    expect([a.low, b.low]).toEqual([false, false]);
  }, 60_000);

  it('a boss with no gun fights as it did: it closes', () => {
    const st = streetOf({ belt, players: [{ recipe }], waves: [{ screen: 1, crowd: [], boss: { recipe: king } }], range: { guns: ['rifle'], grenades: 0 } });
    const W = watch(st, 1500);
    expect(W.near).toBeLessThan(1500);
    expect(W.rounds).toEqual([]);
  }, 60_000);

  it('plays the same twice', () => {
    const a = watch(street({ plays: ['high', 'low', 'lob'] }), 1200), b = watch(street({ plays: ['high', 'low', 'lob'] }), 1200);
    expect(a.rounds.length).toBeGreaterThan(0);
    expect(b.rounds).toEqual(a.rounds);
  }, 60_000);
});
