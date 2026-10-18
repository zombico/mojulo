// THE ROBLOX PLACE (roblox-project.js, roblox-pack.js, roblox-gate.js): the frame it turns a recipe into, the greybox a
// Humanoid stands on, the data the kernel decodes byte for byte, a deterministic project, and (with Rojo and Lune) the
// gate that builds the place and plays a composed level from the place's own kernel and data, equal to the web.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STUDS, toStuds, floorSlabs, greyboxModel, luaString, levelData, emitRobloxGame } from './roblox-project.js';
import { writeRobloxPlace } from './roblox-pack.js';
import { robloxGate } from './roblox-gate.js';
import { LEVELS, levelPayload } from './level-conformance.js';
import { extractEngineScore, extractBus } from './engine-score.js';

const quad = (x0, y0, x1, y1, z) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });
const ROJO = process.env.MOJULO_ROJO, LUNE = process.env.MOJULO_LUNE;

describe('the frame', () => {
  it('z-up metres to y-up studs by a proper rotation: east stays X, north is -Z, up is Y', () => {
    expect(toStuds([1, 0, 0])).toEqual([+(STUDS).toFixed(4), 0, 0]);
    expect(toStuds([0, 1, 0])[2]).toBeCloseTo(-STUDS, 3);
    expect(toStuds([0, 0, 1])[1]).toBeCloseTo(STUDS, 3);
  });
});

describe('the greybox', () => {
  it('rasters the upward faces into one slab per flat run, and a step into a second; a wall and a ceiling\'s side add nothing', () => {
    const wall = { corners: [[0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3]] };
    const slabs = floorSlabs([quad(0, 0, 4, 2, 0), quad(4, 0, 6, 2, 0.5), wall]);
    expect(slabs).toEqual([
      { min: [0, 0, -0.2], max: [4, 2, 0] },
      { min: [4, 0, 0.3], max: [6, 2, 0.5] },
    ]);
    // a face smaller than a cell still stands in its centroid's cell; the recipe's units scale by metersPerUnit
    expect(floorSlabs([{ corners: [[1.1, 1.1, 0], [1.2, 1.1, 0], [1.1, 1.2, 0]] }])).toHaveLength(1);
    expect(floorSlabs([quad(0, 0, 2, 1, 0)], { mpu: 2 })).toEqual([{ min: [0, 0, -0.2], max: [4, 2, 0] }]);
  });

  it('stands each collider as an anchored Part, its size swapped into Roblox\'s axes', () => {
    const { model, floors, walls } = greyboxModel({ faces: [quad(0, 0, 1, 1, 0)], colliders: [{ min: [0, 0, 0], max: [1, 2, 3], of: 'wall:a' }] });
    expect([floors, walls]).toEqual([1, 1]);
    const w = model.Children.find((c) => c.Name === 'wall-0-wall:a');
    expect(w.Properties.Anchored).toBe(true);
    expect(w.Properties.Size.map((v) => +(v / STUDS).toFixed(3))).toEqual([1, 3, 2]);
    expect(w.Properties.CFrame.CFrame.position.map((v) => +(v / STUDS).toFixed(3))).toEqual([0.5, 1.5, -1]);
  });
});

describe('the data', () => {
  it('holds any text in a long string whose closer never occurs in it', () => {
    expect(luaString('{"a":1}')).toBe('[[{"a":1}]]');
    expect(luaString('x]]y]=]z')).toBe('[==[x]]y]=]z]==]');
    expect(luaString('\nlead')).toBe('[[\n\nlead]]');
  });

  it('reads the pilot, the camera, the HUD and the other bodies in recipe units', () => {
    const d = levelData({ ref: 'r', metersPerUnit: 2, pilot: { id: 'hero', pos: [1, 2, 0] }, camera: { rule: 'follow' }, hud: [{ kind: 'legend', text: 'go' }], entities: [{ id: 'lamp', translation: [4, 6, 2] }] });
    expect(d).toEqual({ ref: 'r', title: 'r', metersPerUnit: 2, pilot: { id: 'hero', pos: [1, 2, 0] }, camera: { rule: 'follow' }, hud: [{ kind: 'legend', text: 'go' }], entities: [{ id: 'lamp', pos: [2, 3, 1] }] });
  });
});

// one composed level as the pack would carry it, from the level corpus's own spec
function composedGame() {
  const spec = LEVELS.find((l) => l.id === 'level-exit');
  const payload = levelPayload(spec);
  const score = extractEngineScore({ ref: 'lv', manifest: {} }, payload, { engine: 'roblox' });
  const level = { ref: 'lv', title: 'the exit', gate: null, data: levelData(score), bus: extractBus(payload), contract: payload.game, greybox: greyboxModel({ faces: payload.faces, colliders: score.colliders || [] }) };
  const manifest = { kind: 'game', title: 'test', levels: [{ ref: 'lv', title: 'the exit' }], store: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] } };
  return { payload, emitted: emitRobloxGame({ ref: 'g', title: 'test', manifest, levels: [level], portability: { flags: [] }, remint: 'remint' }) };
}

describe('the project', () => {
  it('is the same bytes from the same rows, and maps the kernel, the scripts and the data into the place', () => {
    const a = composedGame().emitted, b = composedGame().emitted;
    expect(a).toEqual(b);
    const tree = JSON.parse(a.files.find((f) => f.file === 'default.project.json').text).tree;
    expect(tree.ReplicatedStorage.MojuloKernel.$path).toBe('src/kernel');
    expect(tree.ServerStorage.Mojulo.$path).toBe('src/data');
    expect(a.files.map((f) => f.file)).toEqual(['default.project.json', 'src/data/manifest.luau', 'src/data/Levels/lv/data.luau', 'src/data/Levels/lv/Greybox.model.json', 'README.md']);
  });
});

describe('the place gate (MOJULO_ROJO, MOJULO_LUNE)', () => {
  it.skipIf(!ROJO || !LUNE)('builds the place, finds its tree whole, and plays the level from the place equal to the web; a script that does not compile is caught', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-roblox-place-'));
    try {
      const { payload, emitted } = composedGame();
      await writeRobloxPlace({ outDir: dir, emitted });
      const gate = robloxGate({ dir, ref: 'g', payloads: { lv: payload }, rojo: ROJO, lune: LUNE });
      expect(gate.problems).toEqual([]);
      expect(gate.kernel).toEqual({ equal: true, differs: [] });
      expect(gate.levels).toEqual([expect.objectContaining({ ref: 'lv', equal: true, outcome: 'success' })]);
      const server = path.join(dir, 'src/server/MojuloServer.server.luau');
      writeFileSync(server, `${readFileSync(server, 'utf8')}\nlocal function (\n`);
      expect(robloxGate({ dir, ref: 'g', payloads: { lv: payload }, rojo: ROJO, lune: LUNE }).problems.join('\n')).toMatch(/server does not compile/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
