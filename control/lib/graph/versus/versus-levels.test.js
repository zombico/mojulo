import { describe, it, expect } from 'vitest';
import { fightLevel, readFightLevel, greyboxPreset, GREYBOX_PRESETS, FIGHT_LEVELS } from './versus-levels.js';
import { arenaManifest } from './versus-arena.js';
import { laneOf, lanePoint } from './versus-lane.js';
import { versusArenaData } from './versus-page.js';
import { assembleGreyboxScene, GREYBOX_SUN } from '../level/greybox-scene.js';

// a block's footprint test: is the plan point inside the block (turned about its own centre)?
const inside = (b, [x, y]) => {
  const t = (-b.turn * Math.PI) / 180, dx = x - b.at[0], dy = y - b.at[1];
  const u = dx * Math.cos(t) - dy * Math.sin(t), v = dx * Math.sin(t) + dy * Math.cos(t);
  return Math.abs(u) <= b.size[0] / 2 + 1e-6 && Math.abs(v) <= b.size[1] / 2 + 1e-6;
};
// one case per procedure, picked from the presets: the lane turned off the level's centre, and the lane walled behind
// its camera (a `back`)
const TURNED = Object.keys(GREYBOX_PRESETS).find((k) => GREYBOX_PRESETS[k].lane.heading !== 0 && GREYBOX_PRESETS[k].lane.at.some((v) => v !== 0));
const WALLED = Object.keys(GREYBOX_PRESETS).find((k) => GREYBOX_PRESETS[k].lane.back !== undefined);
// and a preset that frames the fight near (the training ground's view)
const NEAR = Object.keys(GREYBOX_PRESETS).find((k) => GREYBOX_PRESETS[k].view === 'near');

describe('versus levels: the fight laid on any kind of level by its lane', () => {
  it('a stage level is the arena as it was, its recipe arenaManifest\'s byte for byte, its lane its old plane', () => {
    const words = { kit: 'gothic-nave', width: 16, crowd: { rows: 2 } };
    const roster = [{ id: 'kata', archetype: 'all-rounder' }];
    expect(JSON.stringify(fightLevel({ kind: 'stage', ...words }, { roster, title: 'T' }))).toBe(JSON.stringify(arenaManifest({ ...words, title: 'T', roster })));
    const { lane } = FIGHT_LEVELS.stage.build(words);
    expect(lane).toEqual(laneOf(arenaManifest(words).versus));
    expect(lane.heading).toBe(0);
  });

  it('a greybox level\'s lane stands on its floor, wall to wall, with the camera\'s side open', () => {
    for (const id of [TURNED, WALLED, NEAR]) {
      const P = greyboxPreset(id), floors = P.blocks.filter((b) => b.tone === 'floor' || b.at[2] + b.size[2] === P.lane.floor);
      // (both walls and the centre over a block whose top is the lane's floor)
      for (const s of [-P.lane.half, 0, P.lane.half]) {
        const at = lanePoint(P.lane, s);
        expect(floors.some((b) => inside(b, at) && Math.abs(b.at[2] + b.size[2] - P.lane.floor) < 1e-6)).toBe(true);
      }
      // (the camera's side: nothing stands up off the floor in the room before the lane, as far as its back or 4 m)
      const reach = P.lane.back ?? 4;
      for (let s = -P.lane.half; s <= P.lane.half; s += 1) for (let n = 0.6; n < reach - 0.3; n += 0.5) {
        const at = lanePoint(P.lane, s, -n);
        expect(P.blocks.some((b) => b.at[2] + b.size[2] > P.lane.floor + 0.3 && b.at[2] < P.lane.floor + 2 && inside(b, at))).toBe(false);
      }
    }
    expect(TURNED).toBeDefined();
    expect(WALLED).toBeDefined();
  });

  it('a lane moved by its words carries the preset\'s blocks with it', () => {
    const A = greyboxPreset(TURNED), B = greyboxPreset(TURNED, { at: [A.lane.at[0] + 5, A.lane.at[1]] });
    expect(B.blocks.map((b) => b.at[0] - 5)).toEqual(A.blocks.map((b) => expect.closeTo(b.at[0], 3)));
    expect(B.blocks.map((b) => b.at[1])).toEqual(A.blocks.map((b) => b.at[1]));
  });

  it('a greybox fight level is a world the fight channel fights on: the lane carried, its walls and floor the lane\'s', () => {
    const m = fightLevel({ kind: 'greybox', preset: TURNED }, { title: 'G' });
    expect(m.kind).toBe('greybox');
    expect(assembleGreyboxScene(m).faces.length).toBeGreaterThan(0);
    const v = versusArenaData(m.versus);
    expect(v.lane).toEqual(GREYBOX_PRESETS[TURNED].lane);
    expect(v.half).toBe(v.lane.half);
    expect(v.floor).toBe(v.lane.floor);
    // (a stored arena's data is as it was: no lane, its plane, walls and floor)
    expect(versusArenaData({ plane: 6, half: 7, floor: 0.75 })).not.toHaveProperty('lane');
  });

  it('a level\'s view rides to the fight: its preset\'s, or its own word; the genre\'s framing says nothing', () => {
    expect(NEAR).toBeDefined();
    expect(versusArenaData(fightLevel({ kind: 'greybox', preset: NEAR }).versus).view).toBe('near');
    expect(fightLevel({ kind: 'greybox', preset: NEAR, view: 'genre' }).versus).not.toHaveProperty('view');
    expect(versusArenaData(fightLevel({ kind: 'greybox', preset: TURNED, view: 'near' }).versus).view).toBe('near');
    expect(versusArenaData(fightLevel({ kind: 'greybox', preset: TURNED }).versus)).not.toHaveProperty('view');
    expect(() => readFightLevel({ kind: 'greybox', preset: NEAR, view: 'wide' })).toThrow(/view is genre \| near/);
    // (its ruling stands proud of what it rules by millimetres: nothing a fighter stands on rises off the lane's floor)
    const P = greyboxPreset(NEAR), lines = P.blocks.filter((b) => b.at[2] === P.lane.floor && b.size[2] < 0.02);
    expect(lines.length).toBeGreaterThan(10);
    // (and a wall stands at each of the lane's ends, past the sim's by a body's width, where its fighters stop)
    for (const k of [-1, 1]) expect(P.blocks.some((b) => b.size[2] >= 2 && inside(b, lanePoint(P.lane, k * (P.lane.half + 0.6))))).toBe(true);
    expect(P.blocks.some((b) => b.size[2] >= 2 && inside(b, lanePoint(P.lane, P.lane.half)))).toBe(false);
  });

  it('a fight\'s register rides every level it is laid on, a greybox\'s with the sun it is shaded by; none adds nothing', () => {
    const grey = fightLevel({ kind: 'greybox', preset: TURNED }, { register: 'anime' });
    expect(versusArenaData(grey.versus)).toMatchObject({ register: 'anime', sun: [...GREYBOX_SUN] });
    const stage = fightLevel({ kind: 'stage', kit: 'gothic-nave' }, { register: 'western' });
    expect(stage.versus.register).toBe('western');
    expect(versusArenaData(stage.versus)).not.toHaveProperty('sun');
    const { register: _r, ...plain } = stage.versus;
    expect(plain).toEqual(arenaManifest({ kit: 'gothic-nave' }).versus);
    expect(fightLevel({ kind: 'greybox', preset: TURNED }).versus).not.toHaveProperty('register');
    expect(() => fightLevel({ kind: 'greybox', preset: TURNED }, { register: 'noir' })).toThrow(/register is anime \| western/);
  });

  it('a greybox of its own blocks names its lane; a level is refused by the word that is wrong', () => {
    const own = fightLevel({ kind: 'greybox', blocks: [{ at: [0, 0, -0.3], size: [20, 12, 0.3] }], lane: { at: [0, 0], half: 6 } });
    expect(own.versus.lane).toMatchObject({ at: [0, 0], heading: 0, half: 6, floor: 0 });
    expect(() => readFightLevel({ kind: 'cave' })).toThrow(/kind is one of/);
    expect(() => readFightLevel({ kind: 'greybox', kit: 'gothic-nave' })).toThrow(/kit is not a greybox level's word/);
    expect(() => fightLevel({ kind: 'greybox' })).toThrow(/preset/);
    expect(() => fightLevel({ kind: 'greybox', preset: 'flat', blocks: [] })).toThrow(/not both/);
    expect(() => fightLevel({ kind: 'greybox', blocks: [{ at: [0, 0, 0], size: [9, 9, 1] }] })).toThrow(/names its lane/);
    expect(() => readFightLevel({ kind: 'stage', kit: 'nowhere' })).toThrow(/kit/);
  });
});
