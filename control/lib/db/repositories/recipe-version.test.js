// The mojulo version that wrote each recipe (3.0.1): minted on create, revised on a recipe edit only,
// carried by every revision row, and null (never guessed) on a row written before 3.1.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { BeatsRevisionRepository } from '@/lib/db/repositories/beats';
import { getServerVersion } from '@/lib/server-version';
import { recipeVersions } from '@/lib/mcp/tools/sketch-model-export';

const VERSION = getServerVersion();
const manifest = (seed) => ({ kind: 'workbench', seed, parts: [] });

let dir;
beforeAll(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-recipe-version-')); });
afterAll(async () => { closeDb(); await fs.rm(dir, { recursive: true, force: true }); });
let n = 0;
beforeEach(() => {
  closeDb();
  process.env.SQLITE_PATH = path.join(dir, `case-${n++}.db`);
  getDb();
});

describe('recipe versions', () => {
  it('a mint records the version that minted it, and no revision yet', () => {
    const s = SketchRepository.create({ ref: 'sk_a', title: 'A', manifest: manifest(1) });
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(s.mintedVersion).toBe(VERSION);
    expect(s.revisedVersion).toBe(null);
  });

  it('a recipe edit records the revising version; a retitle or a folder move does not', () => {
    SketchRepository.create({ ref: 'sk_b', title: 'B', manifest: manifest(1) });
    getDb().prepare("UPDATE sketches SET minted_version = '3.0.0' WHERE ref = 'sk_b'").run();
    expect(SketchRepository.update({ ref: 'sk_b', title: 'B renamed' }).revisedVersion).toBe(null);
    expect(SketchRepository.update({ ref: 'sk_b', folderRef: null }).revisedVersion).toBe(null);
    const edited = SketchRepository.update({ ref: 'sk_b', manifest: manifest(2) });
    expect(edited.mintedVersion).toBe('3.0.0');
    expect(edited.revisedVersion).toBe(VERSION);
  });

  it('an archived revision carries the version that wrote the manifest it archives', () => {
    SketchRepository.create({ ref: 'sk_c', title: 'C', manifest: manifest(1) });
    getDb().prepare("UPDATE sketches SET minted_version = '3.0.0' WHERE ref = 'sk_c'").run();
    expect(SketchRevisionRepository.append({ ref: 'sk_c', manifest: manifest(1) }).version).toBe('3.0.0');
    SketchRepository.update({ ref: 'sk_c', manifest: manifest(2) });
    expect(SketchRevisionRepository.append({ ref: 'sk_c', manifest: manifest(2) }).version).toBe(VERSION);
  });

  it('a beats revision carries the version that wrote it', () => {
    const rev = BeatsRevisionRepository.append({ ref: 'sk_beat', manifest: { kind: 'beats-pattern' } });
    expect(rev.version).toBe(VERSION);
  });

  it('a row written before 3.0.1 reads null, not a guess', () => {
    SketchRepository.create({ ref: 'sk_old', title: 'Old', manifest: manifest(1) });
    getDb().prepare("UPDATE sketches SET minted_version = NULL WHERE ref = 'sk_old'").run();
    const old = SketchRepository.getByRef('sk_old');
    expect(old.mintedVersion).toBe(null);
    expect(recipeVersions(old)).toEqual({ minted: null, revised: null, rendered: VERSION });
  });
});
