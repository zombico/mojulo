// THE ACTION LEVEL PLANS, every one: laid on a world, each of its fights stands in its room by the room's laws (tasks.js
// layTasks: nothing left out but a cover piece before a doorway, every law held), and its building assembles in its kit
// and cube with its rooms' light (era/stage.js), a storey's rooms on their own storey.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages } from './levels.js';
import { layTasks } from './tasks.js';
import { UNDEAD_CAST } from './action-first-level.js';
import { ACTION_LEVELS, ACTION_LEVEL_IDS, levelPlan } from './action-levels.js';
import { assembleStageScene } from '../era/stage.js';

const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const H = MEADOWMARK_HERO.characters.hero;
const worldOf = (P) => readGameworld(Object.fromEntries(Object.entries({ ...MEADOWMARK_HERO, id: 'plan-test', feel: 'fallen-angel', arsenal: 'auto', foes: { ...UNDEAD_CAST }, fights: P.fights,
  levels: { lv: P.level }, start: undefined, links: undefined, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items: [BLADE] } } } }).filter(([, v]) => v !== undefined)));

describe('every action level plan', () => {
  for (const id of ACTION_LEVEL_IDS) it(`${id}: its fights stand in their rooms by the laws, and it assembles lit`, () => {
    const G = worldOf(levelPlan(id)), stage = gameStages(G).find((s) => s.level === 'lv'), L = layTasks(G, 'lv', stage);
    expect(L.findings.filter((f) => !/left out before a doorway/.test(f)), id).toEqual([]);
    expect(L.laid.map((t) => [t.room, t.kind]), id).toEqual(ACTION_LEVELS[id].fights);
    for (const t of L.laid) for (const l of t.laws) if (l) expect(l.ok, `${id}/${t.room} ${l.law ?? l.id}`).not.toBe(false);
    const X = assembleStageScene(stage.manifest, { formLit: true });
    expect(X.faces.length, id).toBeGreaterThan(1000); expect(X.lights.length, id).toBeGreaterThan(0);
  }, 240_000);
});
