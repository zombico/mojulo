/**
 * One rule for open ground (stage.js isGroundKit): a level's land, a trail and a climb are drawn on a kit whose shell
 * has a style card for ground (nature, jungle, isekai, and a composed look). A room kit (the nave, the plaza, the lab, or
 * a shell-less one: the crypt's stone, the catacomb) is a building's. The old check asked only "has a shell": the nave
 * passed, a dungeon became a trail, and a gameworld level on it crashed every readout ("Cannot read properties of
 * undefined (reading 'undefined')", a test agent's run, 9 times).
 */
import { describe, expect, it } from 'vitest';
import { STAGE_KITS, GROUND_SHELLS, GROUND_KITS, isGroundKit, roomKitDoor } from './stage.js';
import { readGameworld } from '../gameworld/world.js';
import { quickWorld } from '../gameworld/quick.js';

describe('open ground, one rule', () => {
  it('a kit is ground by its shell; every room kit, shell or none, is not', () => {
    for (const [id, K] of Object.entries(STAGE_KITS)) expect(isGroundKit(id), id).toBe(GROUND_SHELLS.includes(K.shell));
    expect(GROUND_KITS).toEqual(Object.keys(STAGE_KITS).filter((k) => GROUND_SHELLS.includes(STAGE_KITS[k].shell)));
    for (const room of ['gothic-nave', 'island-plaza', 'research-lab', 'gothic-stone', 'catacomb']) expect(isGroundKit(room), room).toBe(false);
    expect(isGroundKit('delfino-plaza')).toBe(false);   // an alias of a room kit
    expect(isGroundKit('no-such-kit')).toBe(false);
  });

  it('a gameworld level on a room kit is refused with the door that builds it, not a crash', () => {
    const world = {
      id: 'relics', seed: 3, mode: 'autonomous', style: { kit: 'isekai-meadow' },
      levels: { forest: { walk: { nodes: { a: { trail: true } } } }, castle: { style: { kit: 'gothic-nave' }, walk: { nodes: { b: { trail: true } } } } },
    };
    expect(() => readGameworld(world)).toThrow(/levels\.castle\.style\.kit 'gothic-nave' is a room kit, not open ground.*building: \{ use: 'crypt', kit: 'gothic-nave' \}/);
    expect(() => readGameworld({ ...world, levels: { forest: world.levels.forest } })).not.toThrow();
  });

  it('a quick game on a room kit is refused the same way, pointing to quick.building', () => {
    expect(() => quickWorld({ id: 'q', quick: { goal: 'reach' }, style: { kit: 'gothic-nave' } })).toThrow(/room kit, not open ground.*quick\.building: \{ use: 'crypt', kit: 'gothic-nave' \}/);
    expect(() => quickWorld({ id: 'q', quick: { goal: 'reach' }, style: { kit: 'isekai-sakura' } })).not.toThrow();
    expect(roomKitDoor('catacomb')).toMatch(/kit: 'catacomb'/);
  });
});
