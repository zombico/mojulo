process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { GET } from './route.js';

let outDir;
beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-sketches-list-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});
afterAll(async () => { await fs.rm(outDir, { recursive: true, force: true }); });
beforeEach(() => { closeDb(); getDb(); });

const req = (q = '') => new Request(`http://localhost/api/sketches${q}`);

function seed() {
  SketchRepository.create({
    ref: 'sk_arena', title: 'Snow valley arena',
    manifest: {
      kind: 'controllable', seed: 11,
      faces: Array.from({ length: 300 }, (_, i) => ({ corners: [{ x: i, y: 0, z: 0 }, { x: i, y: 1, z: 0 }, { x: i, y: 1, z: 1 }] })),
      giBake: { adapter: 'generated-mesh', bakedAt: 5 }, audio: { bed: 'wind' },
    },
  });
  SketchRepository.create({ ref: 'sk_city', title: 'City 1', manifest: { kind: 'fractal-city', seed: 2 } });
  SketchRepository.create({ ref: 'sk_flow', title: 'Flow', manifest: { nodes: [], edges: [], viewBox: { width: 10, height: 10 } } });
  SketchRepository.create({ ref: 'sk_voice', title: 'Register', manifest: { kind: 'voice-register', bank: 'jp-female' } });
  SketchRepository.create({ ref: 'sk_turn', title: 'Still', manifest: { kind: 'css3d-turntable' } });
  SketchFolderRepository.create({ name: 'Scenes' });
  // An association: a plan pointing at the arena.
  getDb().prepare(
    `INSERT INTO plans (plan_ref, title, goal_md, sketch_ref) VALUES ('pl_1', 'Arena plan', 'g', 'sk_arena')`,
  ).run();
}

describe('GET /api/sketches — summaries', () => {
  it('ships the world shelf without a single manifest, with the facts the shelves read', async () => {
    seed();
    const res = await GET(req('?bucket=world'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sketches.map((s) => s.ref).sort()).toEqual(['sk_arena', 'sk_city']);
    expect(body.folders).toHaveLength(1);
    for (const s of body.sketches) {
      expect(s).not.toHaveProperty('manifest');
      expect(typeof s.hasBoundRender).toBe('boolean');
      expect(s).toMatchObject({ bucket: 'world', renderMode: 'world' });
    }
    const arena = body.sketches.find((s) => s.ref === 'sk_arena');
    expect(arena).toMatchObject({
      title: 'Snow valley arena', kind: 'controllable', bucketOverride: null, folderRef: null,
      facts: { seed: 11, giBake: true, giAdapter: 'generated-mesh', game: false, audio: true },
      associations: [{ kind: 'plan', count: 1 }],
    });
    expect(typeof arena.createdAt).toBe('number');
    // The body is a small fraction of the recipes it lists.
    const stored = getDb().prepare("SELECT SUM(length(manifest_json)) AS b FROM sketches WHERE bucket_derived = 'world'").get().b;
    const text = JSON.stringify(body);
    expect(Buffer.byteLength(text)).toBeLessThan(stored / 10);
  });

  it('keeps the manifest on diagram-mode rows and on the voice shelf', async () => {
    seed();
    const diagram = await (await GET(req('?bucket=diagram'))).json();
    expect(diagram.sketches.map((s) => s.ref)).toEqual(['sk_flow']);
    expect(diagram.sketches[0].manifest).toEqual({ nodes: [], edges: [], viewBox: { width: 10, height: 10 } });
    expect(diagram.sketches[0].renderMode).toBe('diagram');

    const voice = await (await GET(req('?bucket=voice'))).json();
    expect(voice.sketches[0].manifest).toMatchObject({ bank: 'jp-female' });
  });

  it('the unscoped (recent) read is summaries too, and an unknown bucket means unscoped', async () => {
    seed();
    const all = await (await GET(req())).json();
    expect(all.sketches).toHaveLength(5);
    expect(all.sketches.filter((s) => s.manifest).map((s) => s.ref).sort()).toEqual(['sk_flow', 'sk_voice']);
    const still = all.sketches.find((s) => s.ref === 'sk_turn');
    expect(still).toMatchObject({ bucket: 'illustration', renderMode: 'scene', kind: 'css3d-turntable' });
    const bogus = await (await GET(req('?bucket=nonsense'))).json();
    expect(bogus.sketches).toHaveLength(5);
  });
});
