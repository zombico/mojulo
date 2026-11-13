import { describe, expect, it } from 'vitest';
import { paceOf, courseOf, playCourse, courseAudit, courseOfLevel, readObstacles, EXIT_HALF, PRIMITIVES, LANES, REACT, REST } from './roll-course.js';
import { runSteps, readGameworld } from './index.js';
import { rollReports } from '@/lib/mcp/tools/create-game';
import { rollRoom, rollRoomMeasured, layoutOf } from './roll-room.js';
import { feelRule } from './feel/lower.js';
import { POLES } from './feel/cards.js';
import { readRoll, rollWays } from '../game/roll.js';
import { rollOf } from '../game/level-sim.js';
import { rhythmFaults } from '../era/wall-rhythm.js';
import { viewBands, cameraAt } from './course-view.js';
import { readScreen, screenPayload } from '../game/screen.js';
import { MEADOWMARK_HERO } from './examples.js';

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
    // (and what the theme's things add to an ask's length: a wagon is met all along it, and the rest is still the rest)
    expect(C.gap).toBeCloseTo(C.pace.top * (C.need + REST) + (C.lens['posts-left'] - PRIMITIVES['posts-left'].len), 1);
    const plain = courseOf({ feel: MOMENTUM }, { dress: 'rail-yard' });
    expect(plain.gap).toBeCloseTo(plain.pace.top * (plain.need + REST), 1);
    expect(C.sight).toBe(Math.ceil(C.pace.top * (C.need + REACT)));
    for (let k = 1; k < C.slots.length; k++) expect(C.slots[k].y - C.slots[k - 1].y).toBeCloseTo(C.gap, 1);
    expect(C.exit[1]).toBeGreaterThan(C.slots.at(-1).y);
  });

  it('its slots are one line of a pattern: of each slot\'s things exactly one stands; the level\'s roll reads it', () => {
    const read = readRoll(C.roll, { blocks: C.blocks }), [line] = read.pattern;
    expect(read.pattern).toHaveLength(1);
    expect(line.slots).toHaveLength(C.slots.length);
    for (const ids of line.slots) expect(ids).toHaveLength(C.prims.length);
    expect(new Set(Object.values(line.kinds))).toEqual(new Set(['over', 'round']));
    expect(C.ways).toBe(rollWays(read));
    expect(C.ways).toBeLessThan(C.prims.length ** C.slots.length);   // pacing takes most of the unpaced lines away
    const R = rollOf(read, 5);
    expect(R.stand).toHaveLength(C.slots.length);
    // a set of posts leaves an outer lane open: its wall lies over the other two
    const posts = C.blocks.find((b) => b.id === 's1-posts-left');
    expect(posts.at[0] - posts.size[0] / 2).toBeGreaterThan(LANES[0] + 0.5);
  });

  it('the line is paced: never three asks of a kind running, never a pair repeated, never the same posts twice', () => {
    const read = readRoll(C.roll, { blocks: C.blocks });
    for (let seed = 1; seed <= 120; seed++) {
      const stands = new Set(rollOf(read, seed).stand), asks = C.slots.map((s) => s.of[Object.keys(s.of).find((id) => stands.has(id))]);
      const kinds = asks.map((a) => (PRIMITIVES[a].ask === 'jump' ? 'J' : 'S')).join('');
      expect(rhythmFaults(kinds), `seed ${seed}: ${kinds}`).toEqual([]);
      expect(asks.some((a, k) => k > 0 && PRIMITIVES[a].ask === 'steer' && a === asks[k - 1]), `seed ${seed}`).toBe(false);
    }
  });

  it('it opens on the wide windows and tightens: hurdles weigh most at its start, blocks at its end', () => {
    const read = readRoll(C.roll, { blocks: C.blocks }), n = C.slots.length, count = { first: { hurdle: 0, block: 0 }, last: { hurdle: 0, block: 0 } };
    for (let seed = 1; seed <= 400; seed++) {
      const stands = new Set(rollOf(read, seed).stand), at = (k) => C.slots[k].of[Object.keys(C.slots[k].of).find((id) => stands.has(id))];
      for (const [where, k] of [['first', 0], ['last', n - 1]]) if (count[where][at(k)] !== undefined) count[where][at(k)]++;
    }
    expect(count.first.hurdle).toBeGreaterThan(2 * count.first.block);
    expect(count.last.block).toBeGreaterThan(count.last.hurdle);
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
      expect(A.laws.map((l) => l.law)).toEqual(['fair', 'finishes', 'paced', 'apart']);
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
    expect(R.manifest.game.mechanics).toEqual([{ kind: 'reach-exit', at: R.course.exit, half: [...EXIT_HALF] }]);
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
    expect(() => readObstacles({ dress: 'neon' })).toThrow(/dress is one of last-train, rail-yard, greybox/);
    expect(() => readGameworld(world(true, { walk: { nodes: { path: { trail: {} } } } }))).toThrow(/an obstacle course is the lane alone/);
    expect(() => readGameworld(world('fast'))).toThrow(/obstacles is true or \{ slots\?, rest\?, dress\? \}/);
  });

  it('a run lays it: the lane for the world\'s hero, its things as the level\'s blocks, a roll over them, the exit at its end', () => {
    const M = made({ slots: 6 }), C = courseOf({ feel: MOMENTUM }, { slots: 6 });
    expect(M.blocks.map((b) => b.id)).toEqual(C.blocks.map((b) => b.id));
    expect(M.roll).toEqual(C.roll);
    expect(M.obstacles).toMatchObject({ gap: C.gap, sight: C.sight, react: REACT });
    expect(M.game.mechanics.find((m) => m.kind === 'reach-exit').at).toEqual(C.exit);
    // (the exit catches the whole lane, kerb to kerb: a run ends in whichever lane its last ask left the hero)
    expect(M.game.mechanics.find((m) => m.kind === 'reach-exit')).toMatchObject({ half: [...EXIT_HALF] });
    expect(EXIT_HALF[0]).toBeGreaterThan(Math.max(...LANES) + 1);
    expect(M.entities[0].rule).toMatchObject({ type: 'platform', speed: feelRule(MOMENTUM).speed });
    expect(M.entities[0].transform.heading).toBeCloseTo(Math.PI / 2);
  });

  it('its camera frames the thirds on the game\'s own screen, wide or upright; with no hero it is run from the eye, and says so', () => {
    const step = (extra) => runSteps({ ...world({ slots: 6 }), ...extra }, { ref: 'gw' }).find((s) => s.key.startsWith('level-')), order = (extra) => step(extra).order;
    for (const screen of ['screen', 'phone']) {
      const M = order({ characters: MEADOWMARK_HERO.characters, screen }).manifest, P = screenPayload(readScreen(M.screen));
      expect(M.camera).toMatchObject({ rule: 'follow', target: 'hero', standOff: 0 });
      // (steered across its lanes in the camera's frame, the camera held behind the lane: never eased round behind the hero)
      expect(M.camera.steer).toBe('orbit');
      // (nothing is said over the bottom band: the character's)
      expect(M.events.hud.filter((h) => h.slot === 'bottom' && h.ttl)).toEqual([]);
      // (and no text legend: the course's HUD says what to do, on mana-ui, in the dress's theme, laid for the screen)
      expect(M.events.hud.filter((h) => h.ttl)).toEqual([]);
      expect(M.manaHud.spec.hud.use).toBe('hud');
      expect(M.manaHud.theme.distance === 'hand').toBe(screen === 'phone');
      expect(M.entities[0].rule.move).toBe('camera');
      const B = viewBands(cameraAt(M.camera, P.v0 ?? undefined), { react: M.obstacles.reactAt, aspect: P.aspect });
      expect(B.laws.filter((l) => !l.holds)).toEqual([]);
      expect(M.obstacles.camera).toMatchObject({ dist: M.camera.dist, height: M.camera.height });
    }
    const bare = step({});
    expect(bare.order.manifest.camera.dist).toBeLessThan(1);
    expect(bare.laws.find((l) => l.law === 'followed')).toMatchObject({ holds: false, says: expect.stringMatching(/names no hero/) });
    expect(step({ characters: MEADOWMARK_HERO.characters }).laws ?? []).toEqual([]);
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
    expect(R[0].laws.map((l) => l.law)).toEqual(['fair', 'finishes', 'paced', 'apart']);
    expect(R[0].gate).toMatch(/^machine: .*reaction bot.*eyes gate$/);
  });
});
