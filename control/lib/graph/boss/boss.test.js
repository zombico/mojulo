import { describe, it, expect } from 'vitest';
import { PATTERNS, PATTERN_IDS, readPattern, layPattern, hazardHit } from './patterns.js';
import { patternLaws, hazardReads, BODY } from './laws.js';
import { BOSSES, BOSS_IDS, readBoss, moveOf, mindPhases, bossLaws } from './bosses.js';
import { VEHICLES, VEHICLE_IDS, readVehicle, partHit, vehicleLaws, outOfOrder, nextInOrder, turnPast } from './vehicles.js';
import { ATTACK_LOOKS, ATTACK_POSES, POSE_REST, WING_BEATS, WING_FLAP, readAttackLook, lookOfMove, windClips, flapWind } from './looks.js';

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

describe('a side view\'s patterns', () => {
  // (a body on a lane, as a castle's hero is: a run, a reaction, no dive, a jump to 2.24 m under a gravity of 20)
  const SIDE = { speed: 5.5, reaction: 0.6, dive: { dist: 0, dur: 0, iframes: 0 }, lane: true, jump: { height: 2.24, gravity: 20 } };
  const reads = (id, body = SIDE) => { const P = readPattern(id); return hazardReads(layPattern(P, [0, 0], [P.reach, 0], 0)[0], body); };
  const sides = PATTERN_IDS.filter((id) => PATTERNS[id].hazards.some((h) => h.rise != null));

  it('a hazard that says how high it reaches is jumped by a lane\'s body, and every side pattern holds its laws', () => {
    expect(sides.some((id) => reads(id).shares.over > 0)).toBe(true);
    // (the side patterns, each laid down the lane: told, escaped along it or over, survivable, opened after)
    for (const id of [...sides, 'cleave', 'toss', 'lances', 'venom']) expect(patternLaws(id, SIDE).filter((l) => !l.holds).map((l) => `${id}:${l.law}`)).toEqual([]);
  });

  it('a thing that rolls harms only where it is as it passes, never where it was: jumped as it rolls under', () => {
    const id = PATTERN_IDS.find((k) => PATTERNS[k].hazards.some((h) => h.shape === 'roll')), P = readPattern(id);
    const [h] = layPattern(P, [0, 0], [P.reach, 0], 0), at = (x) => h.t0 + ((x - h.a[0]) / (h.b[0] - h.a[0])) * (h.t1 - h.t0);
    // (at 6 m down the lane: hit as it is there, not before it comes nor after it has passed)
    expect(hazardHit(h, 6, 0, at(6))).toBe(true);
    expect(hazardHit(h, 6, 0, at(6) - 0.3)).toBe(false);
    expect(hazardHit(h, 6, 0, at(6) + 0.3)).toBe(false);
    // (on the lane, a jump clears it where it passes quick enough, and behind the one who rolled it is out)
    const R = hazardReads(h, SIDE);
    expect(R.shares.over).toBeGreaterThan(0); expect(R.shares.none).toBe(0);
    expect(() => readPattern({ ...P, hazards: [{ ...P.hazards[0], step: 1 }] })).toThrow(/not a roll's word/);
  });

  it('a flight is a path off the floor and down again by its opening, its hazards landing as it comes down', () => {
    const flying = PATTERN_IDS.filter((id) => PATTERNS[id].flies);
    expect(flying.length).toBeGreaterThan(0);
    for (const id of flying) {
      const P = PATTERNS[id], F = P.flies, land = Math.min(...P.hazards.map((h) => h.at));
      expect(F[0]).toEqual([0, 0, 0]); expect(F[F.length - 1][2]).toBe(0);
      // (aloft through its tell, then low over the floor as the first hazard lands)
      expect(Math.max(...F.filter((q) => q[0] < land).map((q) => q[2]))).toBeGreaterThanOrEqual(2);
      expect(patternLaws(id, SIDE).filter((l) => !l.holds)).toEqual([]);
    }
    const P = PATTERNS[flying[0]];
    expect(() => readPattern({ ...P, flies: [[0, 0, 1], [1, 0, 0]] })).toThrow(/starts where it stands/);
    expect(() => readPattern({ ...P, flies: [[0, 0, 0], [1, 2, 3]] })).toThrow(/ends on its floor/);
    expect(() => readPattern({ ...P, flies: [[0, 0, 0], [0, 1, 0]] })).toThrow(/forward in time/);
    expect(() => readPattern({ ...P, flies: [[0, 0, 0]] })).toThrow(/path/);
    // (a move's later start waits its whole flight with it)
    const row = { ...BOSSES[BOSS_IDS[0]], moves: { up: { pattern: flying[0], says: 'flies', tune: { at: 0.5 } } }, phases: [{ moves: { up: 1 }, tempo: 2 }] };
    expect(moveOf(row, 'up').flies.slice(1).map((q) => q[0])).toEqual(P.flies.slice(1).map((q) => q[0] + 0.5));
  });

  it('on a lane there is no stepping aside: without its jump a body is caught by a front it cannot outrun', () => {
    const id = sides.find((x) => reads(x, { ...SIDE, jump: undefined }).shares.none > 0);
    expect(id).toBeDefined();
    expect(lawsOf(patternLaws(id, { ...SIDE, jump: undefined })).escapable).toBe(false);
    // (and a hazard as high as anything stands is never jumped)
    expect(reads('cleave').shares.over).toBe(0);
    // (on open ground the same front is left sideways)
    expect(readPattern(id).hazards.length).toBeGreaterThan(0);
    expect(lawsOf(patternLaws('cleave')).escapable).toBe(true);
  });
});

describe('attack looks', () => {
  it('a look is told and then lands: each draws a pattern of the shelf, a move wearing its pattern\'s or its own thing', () => {
    for (const id of Object.keys(ATTACK_LOOKS)) expect(PATTERNS[id]).toBeDefined();
    const id = Object.keys(ATTACK_LOOKS).find((k) => ATTACK_LOOKS[k].tell.falling);
    expect(lookOfMove({ id: 'm', pattern: id })).toEqual({ tell: { ...ATTACK_LOOKS[id].tell }, hit: ATTACK_LOOKS[id].hit });
    expect(lookOfMove({ id: 'm', pattern: id, look: { tell: { falling: 'bell' } } }).tell.falling).toBe('bell');
    // (a move whose pattern has no look wears none; a look of a word the shelf lacks is refused)
    expect(lookOfMove({ id: 'm', pattern: PATTERN_IDS.find((k) => !ATTACK_LOOKS[k]) })).toBe(null);
    expect(() => readAttackLook({ tell: { smoke: true }, hit: 'crescent' })).toThrow(/tell/);
    expect(() => readAttackLook({ tell: { glint: 'tail' }, hit: 'crescent' })).toThrow(/glint/);
    expect(() => readAttackLook({ tell: {}, hit: 'boom' })).toThrow(/hit/);
  });
});

describe('attack poses', () => {
  it('a person\'s body winds up and strikes: two two-key clips a posed pattern, rest to wound, wound to struck', () => {
    const id = Object.keys(ATTACK_POSES)[0], C = windClips([id, id, 'no-such-pattern']);
    expect(Object.keys(C)).toEqual([`wind_${id}`, `strike_${id}`]);
    expect(C[`wind_${id}`]).toEqual([POSE_REST, ATTACK_POSES[id].wound]);
    expect(C[`strike_${id}`]).toEqual([ATTACK_POSES[id].wound, ATTACK_POSES[id].struck]);
    // (every attack with a look has a body to go with it)
    for (const k of Object.keys(ATTACK_LOOKS)) expect(ATTACK_POSES[k]).toBeDefined();
  });
  it('a winged body\'s wings beat through the wind-up, up and down and settled at the wound, and down through the strike', () => {
    const id = Object.keys(ATTACK_POSES).find((k) => WING_BEATS[k] && WING_BEATS[k].wound < 0), C = windClips([id], { wings: ['wingR', 'wingL'] });
    const W = C[`wind_${id}`], S = C[`strike_${id}`];
    expect(W).toHaveLength(6);
    expect(W[0]).toEqual(POSE_REST);
    expect(W.slice(1).map((k) => k.wingR)).toEqual([WING_FLAP.up, WING_FLAP.down, WING_FLAP.up, WING_FLAP.down, WING_BEATS[id].wound]);
    expect(W.slice(1).every((k) => k.wingL === k.wingR && k.crouch === ATTACK_POSES[id].wound.crouch)).toBe(true);
    expect(S.map((k) => k.wingR)).toEqual([WING_BEATS[id].wound, WING_BEATS[id].struck]);
    // (the page plays the six through the tell and the strike's two through the blow; every posed pattern has its beat)
    expect(flapWind([id])[id]).toEqual({ wind: [`wind_${id}`, 0, 5 / 6], strike: [`strike_${id}`, 0, 0.5] });
    for (const k of Object.keys(ATTACK_POSES)) expect(WING_BEATS[k]).toBeDefined();
    // (without wings the two two-key clips, as before)
    expect(windClips([id])[`wind_${id}`]).toHaveLength(2);
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
    const one = { ...B, moves: { only: B.moves[Object.keys(B.moves)[0]] }, phases: [{ moves: { only: 1 }, tempo: 2 }], counters: undefined, looks: undefined };
    expect(lawsOf(bossLaws(one))['its-own']).toBe(false);
    expect(lawsOf(bossLaws({ ...B, phases: [B.phases[0], { ...B.phases[1], tempo: 9 }] })).rising).toBe(false);
    expect(() => readBoss({ ...B, moves: { x: { pattern: 'kamehameha', says: '' } } })).toThrow(/pattern is one of/);
  });
});

describe('a human boss\'s counter', () => {
  // (a boss with a part counter bared by a move that vents, from the shelf)
  const id = Object.keys(BOSSES).find((k) => (BOSSES[k].counters || []).some((c) => c.when === 'vent'));
  const B = BOSSES[id], C = B.counters.find((c) => c.when === 'vent'), vent = Object.keys(B.moves).find((m) => B.moves[m].vent);

  it('is reachable: the move that bares it comes in every phase, its opening long enough for its hits', () => {
    expect(lawsOf(bossLaws(id))[`counter-${C.id}`]).toBe(true);
  });

  it('is advised where a phase never bares it, and refused where nothing vents or its numbers are off', () => {
    const k = B.phases.length - 1, without = { ...B, phases: B.phases.map((p, i) => (i === k ? { ...p, moves: Object.fromEntries(Object.entries(p.moves).filter(([m]) => m !== vent)) } : p)) };
    expect(lawsOf(bossLaws(without))[`counter-${C.id}`]).toBe(false);
    const quiet = { ...B, moves: Object.fromEntries(Object.entries(B.moves).map(([m, x]) => [m, { ...x, vent: undefined }])) };
    expect(() => readBoss(quiet)).toThrow(/a move of its must vent/);
    expect(() => readBoss({ ...B, counters: [{ ...C, from: 'above' }] })).toThrow(/from is one of/);
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

describe('a boss of parts in an ORDER and states that are their TURNS (the hydra)', () => {
  // (the row picked in code: the vehicle whose parts fall in an order)
  const id = VEHICLE_IDS.find((k) => Object.values(VEHICLES[k].parts).some((p) => p.order != null)), V = VEHICLES[id];
  const ordered = Object.keys(V.parts).filter((q) => V.parts[q].order != null).sort((a, b) => V.parts[a].order - V.parts[b].order);
  const turnOf = (q) => Object.keys(V.states).find((s) => V.states[s].head === q);
  it('is won by blows: each part in its turn, a retort for the wrong one; every move told and escapable', () => {
    for (const l of vehicleLaws(id, { arms: ['blow'] })) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
    expect(vehicleLaws(id, { arms: ['mine'] }).find((l) => l.law === 'order-reached').holds).toBe(false);
  });
  it('a part is struck in its turn and its opening, in its order; ahead of it, wrong', () => {
    const [first, second] = ordered;
    expect(partHit(V, second, 'blow', turnOf(second), {})).toMatchObject({ wrong: true, counts: false });
    expect(partHit(V, second, 'blow', turnOf(second), { [first]: true })).toMatchObject({ counts: true });
    expect(partHit(V, first, 'blow', turnOf(first), {}, { open: false })).toBeNull();
    expect(partHit(V, first, 'blow', turnOf(second), {})).toBeNull();
    expect(outOfOrder(V, first, {})).toBe(false);
    expect(nextInOrder(V, { [first]: true })).toBe(second);
    expect(nextInOrder(V, Object.fromEntries(ordered.map((q) => [q, true])))).toBeNull();
  });
  it('a broken part\'s turn is passed over; the turn order is not the order it is won in', () => {
    const turns = Object.keys(V.states).filter((s) => V.states[s].head), [a, b, c] = turns;
    expect(turnPast(V, b, { [V.states[b].head]: true })).toBe(c);
    expect(turnPast(V, a, {})).toBe(a);
    expect(turns.map((s) => V.states[s].head)).not.toEqual(ordered);
  });
  it('refuses an order with a gap, a turn of no part, a retort that is not a move', () => {
    const P = JSON.parse(JSON.stringify(V.parts)); P[ordered[0]].order = 9;
    expect(() => readVehicle({ ...V, parts: P })).toThrow(/orders are 1/);
    expect(() => readVehicle({ ...V, states: { ...V.states, x: { head: 'nope', moves: {} } } })).toThrow(/head: a part/);
    expect(() => readVehicle({ ...V, retort: 'nope' })).toThrow(/retort/);
  });
});

