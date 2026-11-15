// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { TEMPLATE_LOADOUTS } from '@/lib/graph/gameworld/loadout.js';
import { POLES } from '@/lib/graph/gameworld/feel/cards.js';
import { MISSION_BUILDINGS } from '@/lib/graph/mission/brief.js';

// A MISSION through the rail (the e2e tier: it makes a whole game through the real doors). A world with a firing range
// is shown its first mission and proposed it as a level; written, a run makes its foes' figure, the level and the game,
// the game's shell on mana-ui in the mission's look, and the readout carries the mission's proof: its tasks in order on
// the bus, the level won headless.

// (a template whose loadout is guns alone)
const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const world = (levels) => ({ id: 'ops', name: 'Ops', seed: 3, mode: 'autonomous', style: { kit: 'trail-valley' }, feel: SHOOTER, start: Object.keys(levels)[0], levels });

beforeEach(() => { closeDb(); process.env.MOJULO_RUN_BUDGET_MS = '0'; });

describe('design_game: a mission', () => {
  it('is proposed, with its patch, to a world with a firing range and no mission level', async () => {
    const out = await designGameHandler({ ref: 'ops', title: 'Ops', world: world({ walked: { walk: { nodes: { path: { trail: true } } } } }) });
    expect(Object.keys(out.practice.rooms)).toEqual(expect.arrayContaining(['range', 'mission']));
    const step = out.next.find((n) => n.step === 'mission');
    expect(step.patch).toEqual([{ op: 'set', path: '/levels/mission-1', value: { name: 'First mission', mission: true } }]);
    // (or inside a building, the core building its kit's band picks, a row of a closed table, drawn by the form render)
    expect(step.building.patch).toEqual([{ op: 'set', path: '/levels/mission-1', value: { name: 'First mission', building: { use: step.building.use, fight: true }, mission: true } }]);
    expect(Object.values(MISSION_BUILDINGS).map((r) => r.use)).toContain(step.building.use);
    expect(step.card).toBe('gameworld-mission');
    expect(step.url).toMatch(/book=practice&room=mission/);
  }, 120000);

  it('written, a run makes it and proves it: the level, its foes\' figure, the game on mana-ui', async () => {
    await designGameHandler({ ref: 'ops', title: 'Ops', world: world({ 'mission-1': { name: 'First contact', mission: true } }) });
    const out = await designGameHandler({ ref: 'ops', run: true });
    expect(out.next.some((n) => n.step === 'mission')).toBe(false);
    expect(out.ran.filter((r) => r.action === 'make').map((r) => r.key)).toEqual(expect.arrayContaining(['foe-gunner', 'level-mission-1-0', 'game']));
    const [P] = out.mission_proof.levels;
    expect(out.mission_proof.gate).toBe('machine');
    expect(P).toMatchObject({ level: 'mission-1', proved: true, won: true });
    expect(P.play).toMatch(/^gunner: won/);
    const level = SketchRepository.getByRef('ops-level-mission-1-0').manifest, game = SketchRepository.getByRef('ops-game').manifest;
    expect(level.kind).toBe('controllable');
    expect(level.mission.tasks.map((t) => t.kind)).toEqual(['take', 'clear', 'clear', 'hold', 'reach']);
    expect(level.game.mechanics[0].kind).toBe('objectives');
    expect(game.ui.theme.name).toBe('Field Brief');
    expect(game.levels[0].title).toBe('First contact');
  }, 400000);
});
