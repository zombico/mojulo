import { describe, expect, it } from 'vitest';
import { paceOf, courseOf, playCourse, courseAudit, courseOfLevel, readObstacles, PRIMITIVES, LANES, REACT, REST } from './roll-course.js';
import { runSteps, readGameworld } from './index.js';
import { rollReports } from '@/lib/mcp/tools/create-game';
import { rollRoom, rollRoomMeasured, layoutOf } from './roll-room.js';
import { feelRule } from './feel/lower.js';
import { POLES } from './feel/cards.js';
import { readRoll, rollWays } from '../game/roll.js';
import { rollOf } from '../game/level-sim.js';

// THE ROLLED COURSE: a momentum hero's obstacle course, sized by time and rolled by a seed, played by the reaction bot.
// Two heroes, chosen from the shelf by what they are: the first on the pinball base, the first on its feet that cannot
// jump a block.
const poles = Object.keys(POLES);
const MOMENTUM = poles.find((p) => POLES[p].base === 'pinball'), FOOT = poles.find((p) => !feelRule(p).airJumps && feelRule(p).jumpSpeed < 4);

describe('the hero\'s pace, measured', () => {
  const P = paceOf(MOMENTUM);
  it('its top speed, each jump\'s window in seconds, a lane change steered as a player learns to', () => {
    expect(P.top).toBeCloseTo(feelRule(MOMENTUM).speed, 0);
    for (const id of ['hurdle', 'block']) {
      const L = P.lead[id];
      expect(L.late).toBeLessThan(L.mid);
      expect(L.mid).toBeLessThan(L.early);
      expect(L.frames).toBeGreaterThanOrEqual(8);       // a window a player can meet
    }
    // the longer, higher thing has the tighter window
    expect(P.lead.block.frames).toBeLessThan(P.lead.hurdle.frames);
    // two lanes take longer than one, and less than twice as long (the push is kept)
    expect(P.laneTime[2]).toBeGreaterThan(P.laneTime[1]);
    expect(P.laneTime[2]).toBeLessThan(2 * P.laneTime[1]);
    expect(paceOf(MOMENTUM)).toBe(P);
  });

  it('a jump a hero cannot make is no ask of its course', () => {
    expect(paceOf(FOOT).lead.block).toBeNull();
    expect(courseOf({ feel: FOOT }).prims).toEqual(['hurdle', 'posts-left', 'posts-right']);
    expect(courseOf({ feel: MOMENTUM }).prims).toEqual(Object.keys(PRIMITIVES));
  });
});

describe('the course, laid', () => {
  const C = courseOf({ feel: MOMENTUM });
  it('a slot every (the neediest ask + a rest) of its top speed; the sight it asks, the need and a reaction', () => {
    expect(C.need).toBeCloseTo(Math.max(C.pace.laneTime[2], C.pace.lead.hurdle.early, C.pace.lead.block.early), 2);
    expect(C.gap).toBeCloseTo(C.pace.top * (C.need + REST), 1);
    expect(C.sight).toBe(Math.ceil(C.pace.top * (C.need + REACT)));
    for (let k = 1; k < C.slots.length; k++) expect(C.slots[k].y - C.slots[k - 1].y).toBeCloseTo(C.gap, 1);
    expect(C.exit[1]).toBeGreaterThan(C.slots.at(-1).y);
  });

  it('each slot is one group of a roll: of its things, exactly one stands; the level\'s roll reads it', () => {
    const read = readRoll(C.roll, { blocks: C.blocks });
    expect(read.cover).toHaveLength(C.slots.length);
    for (const g of read.cover) { expect(g.stand).toEqual([1, 1]); expect(g.of).toHaveLength(C.prims.length); }
    expect(C.ways).toBe(rollWays(read));
    expect(C.ways).toBe(C.prims.length ** C.slots.length);
    const R = rollOf({ cover: read.cover }, 5);
    expect(R.stand).toHaveLength(C.slots.length);
    // a set of posts leaves an outer lane open: its wall lies over the other two
    const posts = C.blocks.find((b) => b.id === 's1-posts-left');
    expect(posts.at[0] - posts.length / 2).toBeGreaterThan(LANES[0] + 0.5);
  });
});

describe('the reaction bot', () => {
  const C = courseOf({ feel: MOMENTUM });
  it('with the sight the course asks and its reaction, it runs a seed clean; the same seed plays the same', () => {
    const A = playCourse(C, { seed: 3 });
    expect(A).toMatchObject({ finished: true, clean: true, hits: [] });
    expect(playCourse(C, { seed: 3 })).toEqual(A);
    expect(A.asks).toHaveLength(C.slots.length);
  });

  it('what it lacks is what a player lacks: seeing too little, it hits; seeing far, its reaction no longer matters', () => {
    expect(playCourse(C, { seed: 3, sight: Math.round(C.sight / 3) }).hits.length).toBeGreaterThan(0);
    const far = { seed: 3, sight: 4 * C.sight };
    const quick = playCourse(C, { ...far, react: 0.15 }), slow = playCourse(C, { ...far, react: 0.8 });
    expect(quick.clean && slow.clean).toBe(true);
    expect(Math.abs(quick.seconds - slow.seconds)).toBeLessThan(0.5);
  });
});

describe('the audit', () => {
  it('a course laid by its hero\'s own pace is fair on every sampled seed, for a hero of momentum and one on its feet', () => {
    for (const feel of [MOMENTUM, FOOT]) {
      const A = courseAudit(courseOf({ feel }), { seeds: 6 });
      expect(A.laws.map((l) => l.law)).toEqual(['fair', 'finishes', 'apart']);
      expect(A.laws.filter((l) => !l.holds), feel).toEqual([]);
    }
  });

  it('a course laid too tight is found unfair, by seed, and said; nothing is refused', () => {
    // (no rest, and less: a slot before the neediest ask can be met)
    const A = courseAudit(courseOf({ feel: MOMENTUM }, { rest: -0.7 }), { seeds: 6 });
    expect(A.ok).toBe(false);
    expect(A.laws.find((l) => l.law === 'fair')).toMatchObject({ holds: false, says: expect.stringMatching(/hits something on \d of 6 seeds \(seed /) });
  });
});

describe('the roll room of a hero that runs on momentum', () => {
  it('is the course; any other hero\'s is the yard', () => {
    expect(layoutOf({ feel: MOMENTUM })).toBe('course');
    expect(layoutOf({ feel: FOOT })).toBe('yard');
    expect(layoutOf({})).toBe('yard');
    const R = rollRoom({ id: 'g', feel: MOMENTUM, roll: true });
    expect(R.layout).toBe('course');
    expect(R.manifest.blocks).toHaveLength(R.course.slots.length * R.course.prims.length);
    expect(R.manifest.game.mechanics).toEqual([{ kind: 'reach-exit', at: R.course.exit, radius: 3 }]);
    expect(() => readRoll(R.manifest.roll, { blocks: R.manifest.blocks })).not.toThrow();
    expect(rollRoom({ id: 'g', feel: FOOT, roll: true }).layout).toBe('yard');
  });

  it('its measures are the bot\'s audit and what the course was sized by', () => {
    const M = rollRoomMeasured({ id: 'g', feel: MOMENTUM, roll: true });
    expect(M).toMatchObject({ layout: 'course', seeds: 12, lost: [] });
    expect(M.course).toMatchObject({ react: REACT, rest: REST, asks: Object.keys(PRIMITIVES) });
    expect(M.course.sight).toBe(courseOf({ feel: MOMENTUM }).sight);
    expect(M.forms).toBeUndefined();
    expect(rollRoomMeasured({ id: 'g', feel: FOOT, roll: true }).layout).toBe('yard');
  });
});

describe('a level that is an obstacle course (a world level\'s `obstacles`)', () => {
  const world = (obstacles, extra = {}) => ({ id: 'dash', name: 'Dash', feel: MOMENTUM, levels: { one: { name: 'The Lane', obstacles, ...extra } }, start: 'one' });
  const made = (obstacles) => runSteps(world(obstacles), { ref: 'gw' }).find((s) => s.key.startsWith('level-')).order.manifest;

  it('the word, read: true, or how many slots and how long a rest; alone on its level; the malformed refused', () => {
    expect(readObstacles(true)).toEqual({ slots: 10, rest: REST });
    expect(readObstacles({ slots: 6 })).toEqual({ slots: 6, rest: REST });
    expect(() => readObstacles({ slots: 2 })).toThrow(/4 to 40/);
    expect(() => readObstacles({ rest: 9 })).toThrow(/0\.2 to 3/);
    expect(() => readObstacles({ lanes: 5 })).toThrow(/not a course's setting \(slots, rest, dress\)/);
    expect(readObstacles({ dress: 'greybox' })).toEqual({ slots: 10, rest: REST, dress: 'greybox' });
    expect(() => readObstacles({ dress: 'neon' })).toThrow(/dress is one of rail-yard, greybox/);
    expect(() => readGameworld(world(true, { walk: { nodes: { path: { trail: {} } } } }))).toThrow(/an obstacle course is the lane alone/);
    expect(() => readGameworld(world('fast'))).toThrow(/obstacles is true or \{ slots\?, rest\?, dress\? \}/);
  });

  it('a run lays it: the lane for the world\'s hero, its things as the level\'s blocks, a roll over them, the exit at its end', () => {
    const M = made({ slots: 6 }), C = courseOf({ feel: MOMENTUM }, { slots: 6 });
    expect(M.blocks.map((b) => b.id)).toEqual(C.blocks.map((b) => b.id));
    expect(M.roll).toEqual(C.roll);
    expect(M.obstacles).toMatchObject({ gap: C.gap, sight: C.sight, react: REACT });
    expect(M.game.mechanics.find((m) => m.kind === 'reach-exit').at).toEqual(C.exit);
    expect(M.entities[0].rule).toMatchObject({ type: 'platform', speed: feelRule(MOMENTUM).speed });
    expect(M.entities[0].transform.heading).toBeCloseTo(Math.PI / 2);
  });

  it('the made level, read back, is the course it was laid as, and the bot plays it fair', async () => {
    const M = made({ slots: 6 }), back = courseOfLevel(M), laid = courseOf({ feel: MOMENTUM }, { slots: 6 });
    expect(back.slots).toEqual(laid.slots);
    expect(back.pace.top).toBeCloseTo(laid.pace.top, 1);
    expect(courseOfLevel({ entities: M.entities })).toBeNull();
    // create_game's readout: a course is played by the bot (its things are jumped, never walked round)
    const R = await rollReports(['lane'], { payloadOf: async () => null, courseOf: async () => back, seeds: 6 });
    expect(R).toHaveLength(1);
    expect(R[0]).toMatchObject({ ref: 'lane', seeds: 6, ok: true, course: { gap: laid.gap, sight: laid.sight, react: REACT } });
    expect(R[0].laws.map((l) => l.law)).toEqual(['fair', 'finishes', 'apart']);
    expect(R[0].gate).toMatch(/^machine: .*reaction bot.*eyes gate$/);
  });
});
