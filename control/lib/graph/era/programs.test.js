// programs — a game building's plan from its use. The laws: every use, on every seed, lays rooms the stage builds,
// every room joined by a doorway to the way in, the way in on an outside wall, its goal there and reached by the
// level; the heights speak the civilization's language (a tall use promoted); the recipe can drop, resize and add
// rooms; a stage without a program is untouched; and a cube recommends its world's buildings without placing any.

import { describe, it, expect } from 'vitest';
import { PROGRAMS, PROGRAM_IDS, planProgram, withProgram } from './programs.js';
import { planStage, assembleStageScene } from './stage.js';
import { readGeocube, cubeBuildings, GEOCUBE_BUILDINGS, GEOCUBE_PRESETS } from './geocube.js';
import { stageLevel, withBuildingLevel } from '../structure/level.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KITS = ['gothic-stone', 'catacomb', 'research-lab'];

describe('every use lays a building the stage builds and the level plays', () => {
  for (const use of PROGRAM_IDS) {
    it(`${use}: joined, a way in, its goal reached, on ten seeds`, () => {
      for (const seed of SEEDS) {
        const kit = KITS[seed % KITS.length];
        const P = planProgram({ use, seed }, kit);
        expect(() => planStage({ kit, rooms: P.rooms, links: P.links }), `${use} s${seed}`).not.toThrow();
        // joined: a tree of doorways from the entry reaches every room
        const seen = new Set([P.entry]);
        for (let grew = true; grew;) { grew = false; for (const l of P.links) for (const [a, b] of [[l.from, l.to], [l.to, l.from]]) if (seen.has(a) && !seen.has(b)) { seen.add(b); grew = true; } }
        expect(seen.size, `${use} s${seed}`).toBe(P.rooms.length);
        expect(P.rooms[0].id).toBe(P.entry);
        expect(P.findings.filter((f) => ['no-way-in', 'unseated', 'orphan'].includes(f.id)), `${use} s${seed}`).toEqual([]);
        expect(P.goal, `${use} s${seed}`).toBe(PROGRAMS[use].goal);
        const L = stageLevel({ kit, rooms: P.rooms, links: P.links }, { goal: P.goal });
        expect(L.error, `${use} s${seed}`).toBeUndefined();
        expect(L.goal.room).toBe(P.goal);
      }
    });
  }

  it('the same program lays the same building; another seed, another', () => {
    expect(planProgram({ use: 'tavern', seed: 4 })).toEqual(planProgram({ use: 'tavern', seed: 4 }));
    expect(planProgram({ use: 'tavern', seed: 4 }).rooms).not.toEqual(planProgram({ use: 'tavern', seed: 5 }).rooms);
  });

  it('an unknown use or setting, or an open-ground kit, is refused, saying what is', () => {
    expect(() => planProgram({ use: 'casino' })).toThrow(/tavern/);
    expect(() => planProgram({ use: 'tavern', floors: 2 })).toThrow(/not a setting/);
    expect(() => planProgram({ use: 'tavern' }, 'isekai-meadow')).toThrow(/open ground/);
  });
});

describe('the civilization speaks the heights', () => {
  it("a room stands at the language's storey, lifted for a game; a tall use's main room promoted", () => {
    const tiered = planProgram({ use: 'keep', seed: 2, civilization: 'tiered' }), shell = planProgram({ use: 'keep', seed: 2, civilization: 'shell' });
    const h = (P, id) => P.rooms.find((r) => r.id === id).h;
    expect(tiered.language).toMatchObject({ id: 'tiered', storeyH: 3.1, entry: 'arch' });
    expect(h(tiered, 'solar')).toBe(4);          // 3.1 × 1.3, to the half metre
    expect(h(shell, 'solar')).toBe(3.5);         // 2.8 × 1.3
    expect(h(tiered, 'hall')).toBeGreaterThan(2.5 * h(tiered, 'solar'));   // the hall's storey, as a town hall's
  });
  it("the kit's own language when no civilization is named", () => {
    expect(planProgram({ use: 'lab' }, 'research-lab').language.id).toBe('shell');
    expect(planProgram({ use: 'crypt' }, 'gothic-stone').language.id).toBe('tiered');
  });
});

describe('the recipe solutions the building', () => {
  it('drops, resizes and adds rooms, and says what it dropped', () => {
    const P = planProgram({ use: 'tavern', seed: 3, rooms: { snug: { drop: true }, taproom: { w: 12, d: 8 } }, add: [{ id: 'yard', of: 'kitchen', w: 6, d: 5 }] });
    expect(P.rooms.map((r) => r.id)).not.toContain('snug');
    expect(P.rooms.find((r) => r.id === 'taproom')).toMatchObject({ w: 12, d: 8 });
    expect(P.rooms.map((r) => r.id)).toContain('yard');
    expect(P.links).toContainEqual({ from: 'kitchen', to: 'yard' });
    expect(P.findings).toContainEqual(expect.objectContaining({ id: 'dropped', room: 'snug' }));
  });
  it('a room whose parent was dropped is said, not seated', () => {
    const P = planProgram({ use: 'tavern', seed: 3, rooms: { kitchen: { drop: true } } });
    expect(P.rooms.map((r) => r.id)).not.toContain('cellar');
    expect(P.findings.map((f) => f.id)).toContain('orphan');
  });
});

describe('on a stage', () => {
  it("lowers to the stage's rooms and links, the level's goal the program's; the recipe's own rooms win", () => {
    const m = withProgram({ kind: 'stage', kit: 'gothic-stone', program: { use: 'crypt', seed: 2 }, level: {} });
    expect(m.program).toBeUndefined();
    expect(m.rooms.length).toBeGreaterThan(3);
    expect(m.level.goal).toBe('tomb');
    const own = [{ id: 'a', x: 0, y: 0, w: 6, d: 6, h: 4 }];
    expect(withProgram({ kind: 'stage', kit: 'gothic-stone', program: { use: 'crypt' }, rooms: own }).rooms).toBe(own);
  });
  it('the payload says the program; a stage without one carries no such key', () => {
    const p = assembleStageScene({ kind: 'stage', kit: 'gothic-stone', program: { use: 'shop', seed: 1 }, dress: false }, { unshaded: true });
    expect(p.program).toMatchObject({ use: 'shop', entry: 'shopfloor', goal: 'store', language: { id: 'tiered' } });
    expect(p.rooms.map((r) => r.id)).toEqual(p.program.rooms);
    const plain = assembleStageScene({ kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 6, d: 6, h: 4 }], dress: false }, { unshaded: true });
    expect('program' in plain).toBe(false);
  });
  it('a program stage is a level: the walker in the way in, the goal its goal room', () => {
    const m = { kind: 'stage', kit: 'gothic-stone', program: { use: 'tavern', seed: 2 }, level: {} };
    const lowered = withBuildingLevel(m, 'lv_tavern');
    const P = planProgram({ use: 'tavern', seed: 2 }, 'gothic-stone'), cellar = P.rooms.find((r) => r.id === 'cellar');
    const [x, y] = lowered.game.mechanics[0].at;
    expect(x > cellar.x && x < cellar.x + cellar.w && y > cellar.y && y < cellar.y + cellar.d).toBe(true);
  });
});

describe('the cube recommends its buildings', () => {
  it('every preset recommends uses that are programs, in an anchor that is a language', () => {
    for (const id of Object.keys(GEOCUBE_PRESETS)) {
      const B = cubeBuildings(readGeocube(id));
      expect(B, id).toBeTruthy();
      for (const u of B.uses) expect(PROGRAM_IDS, `${id} ${u.use}`).toContain(u.use);
      expect(() => planProgram({ use: B.uses[0].use, civilization: B.anchor })).not.toThrow();
    }
  });
  it("a preset's own document is unchanged (the seeds sit beside it), and a variant reads its preset's", () => {
    expect('buildings' in readGeocube('gothic-night')).toBe(false);
    expect(cubeBuildings(readGeocube({ from: 'gothic-night', title: 'Colder' }))).toBe(GEOCUBE_BUILDINGS['gothic-night']);
  });
  it("a program on a cube is laid in the cube's bones, speaks its builders' anchor, and says a use it does not recommend", () => {
    const m = withProgram({ kind: 'stage', geocube: 'jungle-haze', program: { use: 'lab' } });
    expect(m._program.language.id).toBe('timber-hall');
    expect(m._program.findings).toEqual([]);
    expect(withProgram({ kind: 'stage', geocube: 'jungle-haze', program: { use: 'crypt' } })._program.findings.map((f) => f.id)).toContain('off-cube');
  });
  it('a cube document may carry its own seeds, checked', () => {
    const own = { from: 'island-noon', buildings: { anchor: 'shell', uses: [{ use: 'shop', enter: 'walk' }] } };
    expect(cubeBuildings(readGeocube(own)).anchor).toBe('shell');
    expect(() => readGeocube({ from: 'island-noon', buildings: { uses: [{ use: 'shop', enter: 'fly' }] } })).toThrow(/enter/);
  });
});
