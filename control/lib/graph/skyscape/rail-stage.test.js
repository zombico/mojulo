// THE RAIL STAGE (skyscape/rail-stage.js): a stage laid down a path through an airspace. On a planet a canyon's floor
// skimmed at least a floor over its ground, the box narrower than the floor; in space a field of rocks, none on the way's
// line; each with waves posted ahead of their marks, hazards that leave a way past, and a boss at the path's end. The
// same map and seed, the same stage; what it cannot lay is refused, teaching.
import { describe, expect, it } from 'vitest';

import { planRailStage, railPathFrame, RAIL } from './rail-stage.js';
import { airspaceOf, validateAirspace } from './airspace.js';
import { airspaceEnds } from '../gameworld/levels.js';
import { flightGoalMechanics, flightGoalCast } from '../gameworld/flight-goal.js';
import { composeMechanics } from '../game/mechanics.js';

const CANYON = { kind: 'airspace', map: { form: 'canyon', craft: 'multirole' }, rail: { speed: 120, waves: 3 }, seed: 4 };
const VOID = { kind: 'airspace', map: { craft: 'fighter', field: 6000 }, space: { asteroids: 'field' }, rail: { speed: 60 }, seed: 4 };
const stageOf = (m) => { const { map, field } = airspaceOf(m); return { S: planRailStage(map, field, { seed: m.seed, ...m.rail }), map, field }; };

describe('the rail stage', () => {
  it('a canyon: the way skims its floor, at least the floor over the ground all along', () => {
    const { S, field } = stageOf(CANYON);
    expect(S.laws.every((l) => l.ok), JSON.stringify(S.laws)).toBe(true);
    for (let s = 0; s <= S.length; s += 50) { const q = railPathFrame(S.path, s).p; expect(q[2] - field.groundAt(q[0], q[1])).toBeGreaterThanOrEqual(RAIL.floor - 1e-6); }
    expect(S.rule).toMatchObject({ type: 'rail', speed: 120, floor: RAIL.floor, box: RAIL.box });
    expect(S.seconds).toBeGreaterThanOrEqual(RAIL.minS);
    // pillars in the way, standing from the ground up past the box
    expect(S.hazards.length).toBeGreaterThan(2);
    for (const h of S.hazards) expect(h.size[2]).toBeGreaterThan(RAIL.box.hz);
    // down a gorge: the way on its line, walls over it on both sides (the law says so)
    expect(field.gorge).toBeTruthy();
    for (const q of S.path) expect(Math.abs(q[1] - field.gorge.line(q[0]))).toBeLessThan(1e-6 + 0.01);
    expect(S.laws.find((l) => l.law === 'walled')?.ok).toBe(true);
  });

  it('a ground with no gorge (`gorge: false`) lays the canyon open: no gorge, no walled law', () => {
    const { S, field } = stageOf({ ...CANYON, ground: { gorge: false } });
    expect(field.gorge).toBeUndefined();
    expect(S.laws.some((l) => l.law === 'walled')).toBe(false);
  });

  it('space: the way through the rocks, none on its line; rocks let in as its hazards; no floor', () => {
    const { S, field } = stageOf(VOID);
    expect(S.laws.every((l) => l.ok), JSON.stringify(S.laws)).toBe(true);
    for (let s = 0; s <= S.length; s += 20) { const q = railPathFrame(S.path, s).p; expect(field.hitAt(q[0], q[1], q[2], 4)).toBe(false); }
    expect(field.asteroids.length).toBeGreaterThan(10);
    expect(S.rule.floor).toBeUndefined();
    expect(S.hazards.every((h) => !h.size)).toBe(true);
  });

  it('waves posted ahead of their marks, every fighter named once; the boss at the path\'s end; the same seed the same stage', () => {
    const { S } = stageOf(CANYON);
    expect(S.waves.length).toBe(3);
    const ids = S.foes.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(S.waves.flatMap((w) => w.foes)).toEqual(ids);
    for (let w = 1; w < S.waves.length; w++) expect(S.waves[w].along).toBeGreaterThan(S.waves[w - 1].along);
    expect(S.boss.parts.map((p) => p.id)).toEqual(['boss-core', 'boss-gun-1', 'boss-gun-2']);
    expect(JSON.stringify(stageOf(CANYON).S)).toBe(JSON.stringify(S));
  });

  it('a stage designed whole (`plan`): its waves at their marks in their formations, its hazards, its boss\'s guns and armour, its score', () => {
    const plan = { waves: [{ at: 0.2, count: 2, formation: 'line' }, { at: 0.45, count: 5, formation: 'vee' }, { at: 0.7, count: 4, formation: 'swarm' }],
      hazards: 0, boss: { guns: 4, armour: 'heavy' }, score: { fighter: 100, gun: 250, core: 1000, medals: [2000, 1500, 900] } };
    const { S } = stageOf({ ...CANYON, rail: { speed: 120, plan } });
    expect(validateAirspace({ ...CANYON, rail: { speed: 120, plan } })).toEqual([]);
    expect(S.waves.map((w) => w.foes.length)).toEqual([2, 5, 4]);
    // (each wave's mark its share of the way; no hazards when the plan says none)
    S.waves.forEach((w, i) => expect(w.along).toBeCloseTo(plan.waves[i].at * S.length, 0));
    expect(S.hazards).toEqual([]);
    // (a vee trails back from its leader: its wings posted further ahead than its point)
    const vee = S.foes.filter((f) => f.wave === 1).map((f) => f.station.lead);
    expect(vee[0]).toBeGreaterThan(vee[2]);
    expect(S.boss.parts.map((p) => p.id)).toEqual(['boss-core', 'boss-gun-1', 'boss-gun-2', 'boss-gun-3', 'boss-gun-4']);
    expect(S.boss.parts[0].hp).toBe(Math.round(RAIL.bossHp.core * RAIL.heavy));
    expect(S.score).toEqual(plan.score);
    expect(JSON.stringify(stageOf({ ...CANYON, rail: { speed: 120, plan } }).S)).toBe(JSON.stringify(S));
    // (scored: every fighter, gun and core down its points, the medal read off the score as the boss goes down)
    const M = flightGoalMechanics({ kind: 'stage' }, airspaceEnds({ ...CANYON, rail: { speed: 120, plan } }));
    expect(M.find((m) => m.kind === 'score').points.map((p) => p.by)).toEqual([100, 250, 1000]);
    expect(M.find((m) => m.kind === 'grade').criteria[0]).toMatchObject({ var: 'score', best: 'high', gold: 2000, silver: 1500, bronze: 900 });
    // (they compose: the score kept once, for the result, beside the medal)
    expect(() => composeMechanics(M)).not.toThrow();
    // (a stage without a plan is scored as before: not at all)
    expect(flightGoalMechanics({ kind: 'stage' }, airspaceEnds(CANYON)).some((m) => m.kind === 'score')).toBe(false);
    expect(validateAirspace({ ...CANYON, rail: { plan: { waves: [{ at: 0.5, count: 9 }] } } }).join(' ')).toMatch(/plan\.waves/);
  });

  it('stands a design\'s ground units beside the way, never on its line; casts them and its fighters as figures, each scored', () => {
    const plan = { waves: [{ at: 0.3, count: 2, formation: 'vee', craft: 'twinPanel' }], ground: [{ kind: 'turret', count: 2, at: 0.2 }, { kind: 'walker', count: 3, at: 0.5 }], hazards: 0,
      score: { fighter: 100, gun: 250, core: 1000, ground: { turret: 150, walker: 150 }, medals: [1500, 1000, 500] } };
    const M = { ...CANYON, rail: { speed: 120, plan } }, { S, field } = stageOf(M);
    expect(validateAirspace(M)).toEqual([]);
    expect(S.units.map((u) => u.id)).toEqual(['turret-1', 'turret-2', 'walker-1', 'walker-2', 'walker-3']);
    for (const u of S.units) {
      expect(Math.abs(u.at[1] - field.gorge.line(u.at[0]))).toBeGreaterThan(RAIL.box.hx * RAIL.unitAcross[0] - 1);
      expect(u.at[2]).toBeCloseTo(field.groundAt(u.at[0], u.at[1]), 0);
    }
    // (alternate sides of the way)
    const side = (u) => Math.sign(u.at[1] - field.gorge.line(u.at[0]));
    expect(side(S.units[0])).not.toBe(side(S.units[1]));
    const ends = airspaceEnds(M), X = flightGoalCast({ kind: 'stage' }, ends);
    expect(X.figures['craft-twinPanel']).toEqual({ craft: { archetype: 'twinPanel', flying: true, gear: 'up' } });
    expect(X.figures['unit-walker']).toEqual({ unit: { kind: 'walker' } });
    expect(X.entities.filter((e) => /^foe-/.test(e.id)).every((e) => e.body.type === 'figure-rig' && e.body.figure === 'craft-twinPanel')).toBe(true);
    expect(X.entities.find((e) => e.id === 'turret-1')).toMatchObject({ team: 'foes', rule: { type: 'ai', speed: 0 }, body: { figure: 'unit-turret', hittable: true } });
    const pts = flightGoalMechanics({ kind: 'stage' }, ends).find((m) => m.kind === 'score').points;
    expect(pts.filter((p) => /^(turret|walker)-/.test(p.match.entity)).map((p) => [p.match.entity, p.by])).toEqual([['turret-*', 150], ['walker-*', 150]]);
    expect(validateAirspace({ ...CANYON, rail: { plan: { ground: [{ kind: 'mech', count: 1, at: 0.4 }] } } }).join(' ')).toMatch(/plan\.ground/);
  });

  it('refuses a stage it cannot lay, teaching', () => {
    expect(validateAirspace({ kind: 'airspace', map: { form: 'island' }, rail: true }).join(' ')).toMatch(/a ground stage runs down a canyon/);
    expect(validateAirspace({ kind: 'airspace', map: { form: 'canyon' }, rail: { lanes: 3 } }).join(' ')).toMatch(/rail is true or \{ speed\?, waves\?, per\?, plan\? \}/);
    expect(validateAirspace({ kind: 'airspace', map: { form: 'canyon' }, rail: true, course: true }).join(' ')).toMatch(/a rail stage has its path, not a course/);
    expect(() => stageOf({ ...CANYON, rail: { speed: 400 } })).toThrow(/under the 70 s a stage needs/);
  });
});
