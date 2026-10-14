/**
 * The outputs lane reads DISK, because exports have no ledger — five different
 * writers just write. So the test builds real folders and asserts the scan can
 * never disagree with what the operator would find in them.
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';

const ROOT = mkdtempSync(path.join(os.tmpdir(), 'render-bay-scan-'));
process.env.MOJULO_OUTCOMES_DIR = path.join(ROOT, 'outcomes');
process.env.MOJULO_EXPORTS_DIR = path.join(ROOT, 'exports');

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanArtifactExports, scanBeatsExports, scanOutcomeTree } from './outputs-scan.js';
import { tallyOutputKinds } from './lanes.js';

async function write(dir, name, bytes = 8) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.alloc(bytes));
}

const outcomes = (...p) => path.join(ROOT, 'outcomes', ...p);
const exports_ = (...p) => path.join(ROOT, 'exports', ...p);

beforeAll(async () => {
  await write(outcomes('sk_city'), 'model.glb', 100);
  await write(outcomes('sk_city'), 'recipe.json', 10);
  await write(outcomes('sk_city'), 'README.md', 5);
  await write(outcomes('sk_page'), 'render-key-0-1.png', 20);
  await write(outcomes('sk_page'), 'render-key-1-1.png', 20);
  await fs.mkdir(outcomes('sk_empty'), { recursive: true });
  await write(outcomes('cook_abc123'), 'index.html', 50);

  await write(exports_(), 'groove.wav', 400);
  await write(exports_(), 'groove.mid', 4);
  await write(exports_(), 'sfx.coin-up.wav', 30);
  await write(exports_(), 'sfx.laser-pew.wav', 30);
});

describe('scanArtifactExports', () => {
  it('leaves cook folders alone — they have a table and an inbox of their own', async () => {
    const { rows } = await scanArtifactExports();
    expect(rows.map((r) => r.ref)).not.toContain('cook_abc123');
  });

  it('skips a folder with no files rather than listing an empty row', async () => {
    const { rows } = await scanArtifactExports();
    expect(rows.map((r) => r.ref)).not.toContain('sk_empty');
  });

  it('sums the folder and sorts provenance sidecars last', async () => {
    const { rows } = await scanArtifactExports();
    const city = rows.find((r) => r.ref === 'sk_city');
    expect(city.bytes).toBe(115);
    expect(city.files.map((f) => f.name)).toEqual(['model.glb', 'README.md', 'recipe.json']);
    expect(city.url).toBe('/outcomes/sk_city/');
  });

  it('chips the folder by what is actually in it', async () => {
    const { rows } = await scanArtifactExports();
    const page = rows.find((r) => r.ref === 'sk_page');
    expect(tallyOutputKinds(page.files)).toEqual([{ kind: 'render', count: 2 }]);
  });

  it('reports the true total beside a capped page', async () => {
    // The Library's phase-3 lesson: a count that is really a cap is worse than
    // no count at all.
    const capped = await scanArtifactExports({ limit: 1 });
    expect(capped.rows).toHaveLength(1);
    expect(capped.total).toBe(2);
  });

  it('reads an absent outcomes directory as an empty lane, not an error', async () => {
    const prev = process.env.MOJULO_OUTCOMES_DIR;
    process.env.MOJULO_OUTCOMES_DIR = path.join(ROOT, 'nope');
    try {
      expect(await scanArtifactExports()).toEqual({ rows: [], total: 0 });
    } finally {
      process.env.MOJULO_OUTCOMES_DIR = prev;
    }
  });
});

describe('scanBeatsExports', () => {
  it('groups every render back onto the ref that minted it', async () => {
    // One groove with two cues is one row of files, not four unrelated rows.
    const { rows, total } = await scanBeatsExports();
    expect(total).toBe(2);
    const sfx = rows.find((r) => r.ref === 'sfx');
    expect(sfx.files.map((f) => f.name)).toEqual(['sfx.coin-up.wav', 'sfx.laser-pew.wav']);
    const groove = rows.find((r) => r.ref === 'groove');
    expect(groove.bytes).toBe(404);
    expect(tallyOutputKinds(groove.files)).toEqual([
      { kind: 'audio', count: 1 },
      { kind: 'score', count: 1 },
    ]);
  });

  it('reads an absent exports directory as an empty lane', async () => {
    const prev = process.env.MOJULO_EXPORTS_DIR;
    process.env.MOJULO_EXPORTS_DIR = path.join(ROOT, 'nope');
    try {
      expect(await scanBeatsExports()).toEqual({ rows: [], total: 0 });
    } finally {
      process.env.MOJULO_EXPORTS_DIR = prev;
    }
  });
});

describe('scanOutcomeTree — the whole folder, by its subfolders', () => {
  // its own root, so the lane's folder counts above are untouched
  const TREE = mkdtempSync(path.join(os.tmpdir(), 'render-bay-tree-'));
  const at = (...p) => path.join(TREE, ...p);
  let before;
  beforeAll(async () => {
    before = process.env.MOJULO_OUTCOMES_DIR;
    process.env.MOJULO_OUTCOMES_DIR = TREE;
    // an export that writes into subfolders: a building's sheets and schedules, a game's page and Godot pack
    await write(at('sk_house'), 'model.ifc', 70);
    await write(at('sk_house'), '.DS_Store', 6);
    await write(at('sk_house', 'sheets'), 'A-101.svg', 30);
    await write(at('sk_house', 'sheets'), 'A-201.svg', 30);
    await write(at('sk_house', 'schedules'), 'doors.csv', 9);
    await write(at('sk_house', 'schedules'), 'doors.json', 9);
    await write(at('sk_game'), 'game.html', 40);
    await write(at('sk_game', 'godot', 'kernel'), 'arcade.gd', 12);
  });
  afterAll(() => { process.env.MOJULO_OUTCOMES_DIR = before; });

  it('lists every file down the folders, grouped by the folder it sits in at the top, its own files first', async () => {
    const t = await scanOutcomeTree('sk_house');
    expect(t.url).toBe('/outcomes/sk_house/');
    expect(t.groups.map((g) => g.dir)).toEqual(['', 'schedules', 'sheets']);
    expect(t.groups.find((g) => g.dir === 'sheets').files.map((f) => f.path)).toEqual(['sheets/A-101.svg', 'sheets/A-201.svg']);
    // a sidecar is a receipt, not an output
    expect(t.groups.find((g) => g.dir === 'schedules').files.map((f) => f.path)).toEqual(['schedules/doors.csv']);
    expect(t.total).toBe(4);
    expect(t.bytes).toBe(70 + 30 + 30 + 9);
  });

  it('marks a page, reads nested folders, and is empty for a folder that is not there', async () => {
    const g = await scanOutcomeTree('sk_game');
    expect(g.groups[0].files[0]).toMatchObject({ path: 'game.html', page: true });
    expect(g.groups.find((x) => x.dir === 'godot').files[0]).toMatchObject({ path: 'godot/kernel/arcade.gd', page: false });
    expect(await scanOutcomeTree('sk_none')).toMatchObject({ total: 0, url: null, groups: [] });
  });
});

