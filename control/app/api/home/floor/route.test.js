process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { STRIP_SHELVES } from '@/lib/graph/sketch/library-zones';
import { GET } from './route.js';

let outDir;
beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-floor-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});
afterAll(async () => { await fs.rm(outDir, { recursive: true, force: true }); });
beforeEach(() => { closeDb(); getDb(); });

function seed() {
  SketchRepository.create({ ref: 'sk_arena', title: 'Arena 1', manifest: { kind: 'controllable', faces: [], giBake: { adapter: 'inline-faces' }, game: { id: 'g' } } });
  SketchRepository.create({ ref: 'sk_arena2', title: 'Arena 2', manifest: { kind: 'controllable', faces: [] } });
  SketchRepository.create({ ref: 'sk_bench', title: 'Bracket', manifest: { kind: 'workbench', audio: { bed: 'hum' } } });
  SketchRepository.create({ ref: 'sk_poly', title: 'Vajra', manifest: { kind: 'manji-tree', dimensions: '3d', lathes: [{}] } });
  SketchRepository.create({ ref: 'sk_fig', title: 'Wizard — cape', manifest: { kind: 'figure' } });
  SketchRepository.create({ ref: 'sk_sheet', title: 'Wizard — sheet', manifest: { kind: 'character-sheet' } });
  SketchRepository.create({ ref: 'sk_still', title: 'Still', manifest: { kind: 'css3d-turntable' } });
  SketchRepository.create({ ref: 'sk_flow', title: 'Flow', manifest: { nodes: [], edges: [], viewBox: { width: 10, height: 10 } } });
}

describe('GET /api/home/floor', () => {
  it('draws every strip from light faces: badges and renderMode, never a manifest', async () => {
    seed();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.strips).sort()).toEqual([...STRIP_SHELVES].sort());
    for (const faces of Object.values(body.strips)) {
      for (const face of faces) {
        expect(face).not.toHaveProperty('manifest');
        expect(face).not.toHaveProperty('siblings');
        expect(face).not.toHaveProperty('facts');
        expect(typeof face.renderMode).toBe('string');
        expect(Object.keys(face.badges).sort()).toEqual(['audio', 'game', 'gi', 'painted']);
      }
    }
    // Arena 1 and Arena 2 fold into one face wearing the newer one's badges.
    const scenes = body.strips.scenes;
    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({ ref: 'sk_arena2', stack: 2, renderMode: 'world', badges: { gi: false, game: false, audio: false, painted: false } });
    const models = body.strips.models;
    expect(models.find((f) => f.ref === 'sk_bench').badges.audio).toBe(true);
    // The polygomer's render mode is settled from its recipe server-side.
    expect(models.find((f) => f.ref === 'sk_poly').renderMode).toBe('world');
    // Characters fold by name into a cast entry with a kit.
    expect(body.strips.characters).toHaveLength(1);
    expect(body.strips.characters[0].kit).toEqual({ figure: 1, 'character-sheet': 1 });
    expect(body.counts).toEqual({ scenes: 2, models: 2, characters: 2, images: 1, diagrams: 1 });
    expect(body.recent).toHaveLength(3);
    for (const face of body.recent) expect(face).not.toHaveProperty('manifest');
  });
});
