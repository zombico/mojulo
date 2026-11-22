import { describe, it, expect } from 'vitest';
import { PATTERNS, PATTERN_IDS, readPattern, layPattern, hazardHit } from './patterns.js';
import { patternLaws, hazardReads, BODY } from './laws.js';
import { BOSSES, BOSS_IDS, readBoss, moveOf, mindPhases, bossLaws } from './bosses.js';
import { VEHICLES, VEHICLE_IDS, readVehicle, partHit, vehicleLaws } from './vehicles.js';

// BOSS FIGHTS (lib/graph/boss/): attack patterns as timelines held to the laws a body needs of them, human bosses as
// gimmicks over those patterns in phases, vehicle bosses as parts and states won by mechanics.

const lawsOf = (L) => Object.fromEntries(L.map((l) => [l.law, l.holds]));

describe('attack patterns', () => {
  it('each is laid down the aim: a hazard lands only in its time, where its shape is', () => {
    const P = PATTERNS.charge, [h] = layPattern(P, [0, 0], [0, 10], 5);
    expect(h.t0).toBe(5 + P.hazards[0].at);
    expect(hazardHit(h, 0, 6, h.t0 + 0.1)).toBe(true);
    expect(hazardHit(h, 4, 6, h.t0 + 0.1)).toBe(false);
    expect(hazardHit(h, 0, 6, h.t0 - 0.1)).toBe(false);
    // (a sweep's beam turns through its time: one side at its start, the other at its end)
    const [s] = layPattern(PATTERNS.sweep, [0, 0], [10, 0], 0), r = 5, at = (a) => [r * Math.cos(a), r * Math.sin(a)];
    expect(hazardHit(s, ...at(s.a0), s.t0 + 0.01)).toBe(true);
    expect(hazardHit(s, ...at(s.a1), s.t0 + 0.01)).toBe(false);
    expect(hazardHit(s, ...at(s.a1), s.t1 - 0.01)).toBe(true);
  });

  it('a pattern on the shelf is told, escapable, survivable and opened after (the whole shelf: boss.deep.test.js)', () => {
    // (one of each kind of escape: a pattern of many landings, one that sweeps)
    for (const id of [PATTERN_IDS.find((k) => PATTERNS[k].hazards.length > 1), PATTERN_IDS.find((k) => PATTERNS[k].hazards[0].shape === 'sweep')]) expect(lawsOf(patternLaws(id)), id).toEqual({ told: true, escapable: true, survivable: true, opening: true });
  });

  it('a pattern breaks its laws when it lands too soon, too wide, too hard or with no opening', () => {
    const P = PATTERNS.charge, H = P.hazards[0];
    expect(lawsOf(patternLaws({ ...P, hazards: [{ ...H, at: 0.3 }] })).told).toBe(false);
    expect(lawsOf(patternLaws({ ...P, hazards: [{ ...H, width: 40, at: 0.7, for: 3 }], open: { at: 4, for: 2 } })).escapable).toBe(false);
    expect(lawsOf(patternLaws({ ...P, hazards: [{ ...H, harm: 0.8 }] })).survivable).toBe(false);
    expect(lawsOf(patternLaws({ ...P, open: { at: 0.5, for: 2 } })).opening).toBe(false);
    expect(() => readPattern({ ...P, hazards: [{ ...H, shape: 'spiral' }] })).toThrow(/shape is one of/);
  });

  it('a low hazard is passed under, a cover hazard is the arena\'s to shelter, and a quick front is dived through', () => {
    // (a fan too wide to leave and too long to dive through: under it, or behind cover)
    const wide = { shape: 'cone', half: 1.5, reach: 30, at: 0.7, for: 2, harm: 0.2 };
    const [low] = layPattern({ ...PATTERNS.scythe, hazards: [{ ...wide, low: true }] }, [0, 0], [6, 0], 0);
    const [cov] = layPattern({ ...PATTERNS.scythe, hazards: [{ ...wide, cover: true }] }, [0, 0], [6, 0], 0);
    expect(hazardReads(low).shares.under).toBeGreaterThan(0);
    expect(hazardReads(cov).shares.cover).toBeGreaterThan(0);
    const [ring] = layPattern(PATTERNS.ring, [0, 0], [5, 0], 0);
    expect(hazardReads(ring, { ...BODY, speed: 1 }).shares.through).toBeGreaterThan(0.5);
  });
});

describe('human bosses', () => {
  const id = BOSS_IDS[0], B = BOSSES[id];
  it('a boss is a gimmick: moves of its own over the shelf\'s patterns, said in its words, in phases that quicken', () => {
    expect(bossLaws(id).filter((l) => !l.holds)).toEqual([]);
    const m = Object.keys(B.moves)[0], M = moveOf(B, m);
    expect(M.tell.says).toBe(B.moves[m].says);
    expect(M.hazards.length).toBe(PATTERNS[B.moves[m].pattern].hazards.length);
  });

  it('its mind crosses its phases after the first, each at its threshold in its temper', () => {
    const P = mindPhases(id);
    expect(P.map((p) => p.below)).toEqual(B.phases.slice(1).map((p) => p.below));
    expect(P.every((p) => p.shift > 0)).toBe(true);
  });

  it('a boss of one move, or a phase that waits longer, is advised; a move off the shelf is refused', () => {
    const one = { ...B, moves: { only: B.moves[Object.keys(B.moves)[0]] }, phases: [{ moves: { only: 1 }, tempo: 2 }] };
    expect(lawsOf(bossLaws(one))['its-own']).toBe(false);
    expect(lawsOf(bossLaws({ ...B, phases: [B.phases[0], { ...B.phases[1], tempo: 9 }] })).rising).toBe(false);
    expect(() => readBoss({ ...B, moves: { x: { pattern: 'kamehameha', says: '' } } })).toThrow(/pattern is one of/);
  });
});

describe('vehicle bosses', () => {
  it('one won by mines is winnable by its mechanics, its moves hold, every state attacks', () => {
    const id = VEHICLE_IDS.find((k) => Object.values(VEHICLES[k].parts).some((p) => p.takes.includes('mine')));
    expect(vehicleLaws(id).filter((l) => !l.holds)).toEqual([]);
  });

  it('a part hit counts only for what it takes, once what is in front of it is gone, in the state it shows in', () => {
    const W = VEHICLES.walker;
    expect(partHit(W, 'plate-left', 'round', 'walking')).toBeNull();
    expect(partHit(W, 'plate-left', 'explosive', 'walking')).toMatchObject({ counts: true });
    expect(partHit(W, 'knee-left', 'round', 'walking')).toBeNull();
    expect(partHit(W, 'knee-left', 'round', 'walking', { 'plate-left': true })).toMatchObject({ counts: true });
    expect(partHit(W, 'cockpit', 'round', 'walking')).toBeNull();
    expect(partHit(W, 'cockpit', 'round', 'kneeling')).toMatchObject({ weak: true, mult: 1 });
  });

  it('a vehicle is not won without its mechanics: no tank without mines, no walker without a launcher', () => {
    const won = (id, arms) => vehicleLaws(id, { arms }).find((l) => l.law === 'winnable').holds;
    expect(won('tank', ['round', 'explosive'])).toBe(false);
    expect(won('walker', ['round'])).toBe(false);
    expect(won('gunship', ['round'])).toBe(false);
    expect(won('tank', ['round', 'explosive', 'mine'])).toBe(true);
    expect(lawsOf(vehicleLaws('tank', { mines: 1 }))['mines-enough']).toBe(false);
    expect(() => readVehicle({ ...VEHICLES.tank, states: { ...VEHICLES.tank.states, driving: { moves: {}, to: { flying: { after: 1 } } } } })).toThrow(/is not a state/);
  });
});
