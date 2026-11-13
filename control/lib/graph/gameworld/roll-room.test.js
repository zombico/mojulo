import { describe, expect, it } from 'vitest';
import { rollRoom, rollRoomLevel, rollRoomMeasured, coverForms, YARD, FORMS } from './roll-room.js';
import { practiceFor, practiceRoomOf, rollMeasured, PRACTICE_ROOMS } from './practice.js';
import { feelRule } from './feel/lower.js';
import { POLES } from './feel/cards.js';
import { readRoll, pickupsOf, rollWays } from '../game/roll.js';
import { rollAudit } from '../game/roll-audit.js';
import { rollOf } from '../game/level-sim.js';
import { gameChannelScript } from '../scene/channels/game.js';

// THE ROLL ROOM: a game's roll tried before its levels, on its own hero and feel. Two templates, chosen from the shelf
// by what they are: one whose hero jumps again in the air, one on its feet (the first of each).
const poles = Object.keys(POLES);
const AIR = poles.find((p) => feelRule(p).airJumps >= 1), FOOT = poles.find((p) => !feelRule(p).airJumps && feelRule(p).jumpSpeed < 4);
const world = (feel, extra = {}) => ({ id: 'g', name: 'Game', feel, roll: true, ...extra });

describe('the door', () => {
  it('a world whose levels roll has the roll room; one that does not, has none', () => {
    expect(practiceFor(world(FOOT)).rooms).toContain('roll');
    expect(practiceFor({ id: 'g', feel: FOOT }).rooms).not.toContain('roll');
    expect(practiceFor(world(FOOT, { roll: false })).rooms).not.toContain('roll');
    expect(PRACTICE_ROOMS.roll.name).toBe('The roll room');
    expect(practiceRoomOf(world(FOOT), 'roll').manifest.kind).toBe('controllable');
    expect(() => practiceRoomOf({ id: 'g', feel: FOOT }, 'roll')).toThrow(/has no roll room/);
    expect(rollMeasured({ id: 'g', feel: FOOT })).toBeNull();
  });
});

describe('the room', () => {
  const R = rollRoom(world(FOOT));
  it('is a level that rolls, written as any level writes it: blocks by id, pickups by id, a roll over them', () => {
    const M = R.manifest, read = readRoll(M.roll, { blocks: M.blocks, pickups: pickupsOf(M.game.mechanics) });
    expect(R.ways).toBe(rollWays(read));
    expect(R.ways).toBeGreaterThan(1000);
    expect(read.cover.flatMap((g) => g.of).sort()).toEqual(YARD.blocks.map((b) => b.id).sort());
    expect(read.items[0].of).toHaveLength(YARD.pickups.length);
    expect(read.start).toHaveLength(3);
    expect(R.yard.map(([, ids]) => ids.length)).toEqual([3, 2, 4, 5, 3]);
  });

  it('its hero is a stand-in on the world\'s feel, with a body; the run\'s own where made', () => {
    const hero = R.manifest.entities[0];
    expect(R.hero).toBe('stand-in');
    expect(hero.rule).toMatchObject({ type: 'platform', move: 'camera', speed: feelRule(FOOT).speed });
    expect(hero.rule.collideRadius).toBeGreaterThan(0);
    expect(hero.transform.pos).toEqual(YARD.roll.start[0].pos);
    const own = rollRoom(world(FOOT), { refs: { hero: 'g-hero' } });
    expect(own.hero).toBe('own');
    expect(own.manifest.figures.hero.heroRef).toBe('g-hero');
  });

  it('the yard as Node plays it rolls as the room\'s recipe says', () => {
    const L = rollRoomLevel(world(FOOT)), M = R.manifest, read = readRoll(M.roll, { blocks: M.blocks, pickups: pickupsOf(M.game.mechanics) });
    expect(L.roll.cover).toEqual(read.cover);
    expect(L.roll.items).toEqual(read.items);
    expect(Object.keys(L.roll.things).sort()).toEqual(YARD.blocks.map((b) => b.id).sort());
    expect(rollOf(L.roll, 7)).toEqual(rollOf(read, 7));
  });
});

describe('the measures', () => {
  it('no roll of the yard shuts it: every law holds over a sample, on a hero that walks and one that leaps', () => {
    for (const feel of [FOOT, AIR]) {
      const A = rollAudit(rollRoomLevel(world(feel)), { seeds: 16, plays: 1, seconds: 60 });
      expect(A.laws.filter((l) => !l.holds), feel).toEqual([]);
      expect(A.distinct).toBeGreaterThan(8);
    }
  });

  it('what is cover depends on who runs at it: a hero on its feet is stopped by a wall its leaping kin goes over', () => {
    const foot = coverForms(world(FOOT)), air = coverForms(world(AIR));
    expect(foot.map((f) => f.form)).toEqual(FORMS.map((f) => f.form));
    const stops = (list, form) => list.find((f) => f.form === form).stops;
    expect(stops(foot, 'a wall')).toBe(true);
    expect(stops(air, 'a wall')).toBe(false);
    // a form that stops a hero stops it at every greater height
    for (const list of [foot, air]) { const first = list.findIndex((f) => f.stops); if (first >= 0) expect(list.slice(first).every((f) => f.stops)).toBe(true); }
  });

  it('the room\'s readout: the seeds walked, the laws lost, the forms that stop this hero; kept by its feel', () => {
    const M = rollRoomMeasured(world(FOOT));
    expect(M).toMatchObject({ seeds: 24, ways: rollRoom(world(FOOT)).ways, lost: [] });
    expect(M.forms.stops).toContain('a wall');
    expect([...M.forms.stops, ...M.forms.passed].sort()).toEqual(FORMS.map((f) => f.form).sort());
    expect(rollRoomMeasured(world(FOOT, { name: 'Another' }))).toBe(M);
    expect(rollMeasured(world(FOOT))).toBe(M);
    expect(rollRoomMeasured(world(AIR))).not.toBe(M);
  });
});

describe('a rolled level opened alone', () => {
  it('takes its seed from the page\'s own ?seed=; a level with no roll starts on 1, its channel as it was', () => {
    const game = { levelRef: 'l', produces: { events: [] } };
    expect(gameChannelScript(game, { shownOnStart: true })).toContain("new URLSearchParams(location.search).get('seed')");
    expect(gameChannelScript(game)).not.toContain('__aloneSeed');
    expect(gameChannelScript(game)).toContain('|| {}, 1); }');
  });
});
