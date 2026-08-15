// interchange.plan.md I4 — export_model provenance parity with export_game: the written
// model lands in the sketch's outcome folder (data/outcomes/<ref>/model.<format>) beside
// recipe.json (the sovereign manifest) and a short README (refs, manifest sha256/16,
// re-mint + import notes). The GLB itself carries the level semantics (cameras, entity
// nodes, moj: scene extras) end-to-end through the tool path.

// Isolate to in-memory SQLite + a scratch outcomes dir — must run before any
// import that pulls in db/index.js (same pattern as bind-mesh-render.test.js).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-i4-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { glbToFaces } from '@/lib/graph/scene/scene-gltf-read.js';
import { exportModelHandler } from './sketches.js';

function parseGlbJson(buf) {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}

// A controllable layer riding an object-study kind: entities + colliders + walk spawn +
// game contract, exactly what a level manifest carries (no rig bake — fast, deterministic).
const LEVEL = {
  kind: 'css3d-turntable',
  shape: 'dodecahedron',
  color: '#7a5fad',
  surface: 'vexar',
  walk: { spawn: [2, -3, 1] },
  entities: [
    { id: 'hero', transform: { pos: [4, 0, 0], heading: 0.5 }, rule: { type: 'platform' }, body: {} },
    { id: 'sentry', transform: { pos: [-4, 2, 0] }, rule: { type: 'clock' }, body: {} },
  ],
  colliders: [{ min: [-1, -1, 0], max: [1, 1, 4] }],
  game: {
    levelRef: 'lv-study',
    produces: { results: ['success'], events: [{ type: 'grant', slice: 'wins' }] },
  },
};

describe('I4 export_model — provenance parity with export_game', () => {
  it('writes model.glb + recipe.json + README.md into the outcome folder', async () => {
    SketchRepository.create({ ref: 'sk_i4_level', title: 'study level', manifest: LEVEL });
    const res = await exportModelHandler({ ref: 'sk_i4_level' });
    expect(res.ok).toBe(true);
    expect(res.path).toBe(path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_i4_level', 'model.glb'));
    expect(res.dir).toBe(path.dirname(res.path));
    expect(res.download_url).toBe('/outcomes/sk_i4_level/model.glb');
    expect(existsSync(res.path)).toBe(true);
    expect(existsSync(path.join(res.dir, 'recipe.json'))).toBe(true);
    expect(existsSync(path.join(res.dir, 'README.md'))).toBe(true);
    // the level semantics rode the tool path
    expect(res.cameras).toBeGreaterThanOrEqual(1);
    expect(res.entity_nodes).toBe(2);
  });

  it('recipe.json IS the stored manifest (export_game pattern), README carries the hash + import notes', async () => {
    const stored = SketchRepository.getByRef('sk_i4_level');
    const dir = path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_i4_level');
    const recipe = JSON.parse(readFileSync(path.join(dir, 'recipe.json'), 'utf8'));
    expect(recipe).toEqual(stored.manifest);
    const hash = createHash('sha256').update(JSON.stringify(stored.manifest)).digest('hex').slice(0, 16);
    const readme = readFileSync(path.join(dir, 'README.md'), 'utf8');
    expect(readme).toContain(`\`${hash}\``);
    expect(readme).toContain('`sk_i4_level`');
    expect(readme).toContain('z-up');           // axis convention
    expect(readme).toContain('1 second per cycle'); // clip timing
    expect(readme).toContain('`moj:`');         // extras namespace
    expect(readme).toContain('re-mint');
  });

  it('the written GLB carries cameras, entity nodes, and moj: scene extras', async () => {
    const bytes = readFileSync(path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_i4_level', 'model.glb'));
    const json = parseGlbJson(bytes);
    expect(json.cameras?.length).toBeGreaterThanOrEqual(1);
    expect(json.cameras[0].type).toBe('perspective');
    expect(json.cameras[0].perspective.yfov).toBeGreaterThan(0);
    const hero = json.nodes.find((n) => n.name === 'entity:hero');
    expect(hero.extras).toEqual({ 'moj:entity': 'hero', 'moj:rule': 'platform' });
    expect(hero.translation).toEqual([4, 0, 0]);
    expect(json.nodes.find((n) => n.name === 'entity:sentry')).toBeDefined();
    const ex = json.scenes[0].extras;
    expect(ex['moj:spawn']).toEqual([2, -3, 1]);
    expect(ex['moj:colliders']).toEqual([{ min: [-1, -1, 0], max: [1, 1, 4] }]);
    expect(ex['moj:game']).toEqual({ levelRef: 'lv-study', results: ['success'], events: ['grant→wins'] });
    // and the I3 reader still decodes the enriched file (geometry only, no throw)
    expect(glbToFaces(bytes).length).toBeGreaterThan(0);
  });

  it('re-export overwrites in place (model.glb behavior — no append-only slots for the snapshot)', async () => {
    const first = readFileSync(path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_i4_level', 'model.glb'));
    const res = await exportModelHandler({ ref: 'sk_i4_level' });
    expect(res.path.endsWith(path.join('sk_i4_level', 'model.glb'))).toBe(true);
    const second = readFileSync(res.path);
    expect(second.equals(first)).toBe(true); // deterministic re-mint, same slot
  });

  it('write:false touches nothing on disk', async () => {
    SketchRepository.create({ ref: 'sk_i4_dry', title: 'dry', manifest: { kind: 'css3d-turntable', shape: 'cube', color: '#446688' } });
    const res = await exportModelHandler({ ref: 'sk_i4_dry', write: false });
    expect(res.ok).toBe(true);
    expect(res.path).toBeUndefined();
    expect(existsSync(path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_i4_dry'))).toBe(false);
  });

  it('stl exports gain the same provenance pair beside model.stl', async () => {
    const res = await exportModelHandler({ ref: 'sk_i4_dry', format: 'stl' });
    expect(res.ok).toBe(true);
    expect(res.path.endsWith(path.join('sk_i4_dry', 'model.stl'))).toBe(true);
    const dir = path.dirname(res.path);
    expect(existsSync(path.join(dir, 'recipe.json'))).toBe(true);
    const readme = readFileSync(path.join(dir, 'README.md'), 'utf8');
    expect(readme).toContain('format: stl');
  });
});
