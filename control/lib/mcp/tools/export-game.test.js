// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as create-game.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
// Force the geometry hoist on toy-sized worlds so the dedup path is exercised (prod: 256KB).
process.env.MOJULO_EXPORT_GEOMETRY_HOIST_MIN = '64';

import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportGameHandler } from '@/lib/mcp/tools/export-game';

// Redirect the outcomes base so the export lands in a disposable dir.
const OUT = mkdtempSync(path.join(tmpdir(), 'export-game-test-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  closeDb();
});

beforeEach(() => {
  // in-memory DB persists across tests in the file; unique refs per test instead
});

describe('export_game — input gates', () => {
  it('refuses a missing ref', async () => {
    await expect(exportGameHandler({ ref: 'sk_nope' })).rejects.toThrow(/No sketch exists/);
  });

  it('refuses a non-game sketch with a teaching pointer', async () => {
    SketchRepository.create({ title: 'a diagram', manifest: { kind: 'flow', nodes: [] }, ref: 'sk_eg_diagram' });
    await expect(exportGameHandler({ ref: 'sk_eg_diagram' })).rejects.toThrow(/not a game[\s\S]*export_model/);
  });
});

describe('export_game — pixelizer branch', () => {
  it('writes a self-contained game.html + sovereign recipe + provenance README', async () => {
    const manifest = { kind: 'game', engine: 'pixelizer', reducer: 'brickster', title: 'Brickster', music: true, menu: { tagline: 't' } };
    SketchRepository.create({ title: 'Brickster', manifest, ref: 'sk_eg_brick' });

    const result = await exportGameHandler({ ref: 'sk_eg_brick' });
    expect(result.ok).toBe(true);
    expect(result.engine).toBe('pixelizer');
    expect(result.preview_url).toBe('/outcomes/sk_eg_brick/game.html');
    expect(result.files.map((f) => f.file).sort()).toEqual(['README.md', 'game.html', 'recipe/game.json']);

    const dir = result.dir;
    const html = readFileSync(path.join(dir, 'game.html'), 'utf8');
    // standalone: no absolute API/vendor srcs, no external fetch targets
    // (an https:// string in a comment or xmlns is fine — src/href/fetch are what load)
    expect(html).not.toMatch(/src="\/(api|vendor)/);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/fetch\(\s*['"`]https?:/);

    const recipe = JSON.parse(readFileSync(path.join(dir, 'recipe/game.json'), 'utf8'));
    expect(recipe).toEqual(manifest);

    const readme = readFileSync(path.join(dir, 'README.md'), 'utf8');
    expect(readme).toContain('sk_eg_brick');
    expect(readme).toMatch(/manifest sha256\/16: `[0-9a-f]{16}`/);
    expect(readme).toContain('How to re-mint');
  });

  it('is deterministic — same row exports byte-identical game.html', async () => {
    const first = readFileSync(path.join(OUT, 'sk_eg_brick', 'game.html'));
    await exportGameHandler({ ref: 'sk_eg_brick' });
    const second = readFileSync(path.join(OUT, 'sk_eg_brick', 'game.html'));
    expect(second.equals(first)).toBe(true);
  });
});

describe('export_game — world/level games', () => {
  it('mapRef levels: ships the map recipe once and hoists shared geometry into one file', async () => {
    const floor = [
      { corners: [[-50, -50, 0], [50, -50, 0], [50, 50, 0], [-50, 50, 0]], fill: '#565' },
      { corners: [[-50, -50, 0], [-50, -50, 20], [-50, 50, 20], [-50, 50, 0]], fill: '#343' },
    ];
    const hero = (speed) => ({
      id: 'hero', transform: { pos: [0, 0, 0] },
      rule: { type: 'walk', speed }, body: { type: 'mesh', shape: 'box', size: [4, 4, 8], color: '#fa0' },
    });
    SketchRepository.create({ title: 'eg map', ref: 'sk_eg_map', manifest: { kind: 'controllable', faces: floor, entities: [hero(10)] } });
    for (const [ref, speed] of [['sk_eg_lv_a', 10], ['sk_eg_lv_b', 20]]) {
      SketchRepository.create({
        title: ref, ref,
        manifest: { kind: 'controllable', mapRef: 'sk_eg_map', entities: [hero(speed)],
          game: { levelRef: ref, produces: { results: ['success'], events: [] } } },
      });
    }
    SketchRepository.create({
      title: 'Toy Duo', ref: 'sk_eg_duo',
      manifest: { kind: 'game', title: 'Toy Duo',
        store: { slices: [{ name: 'career', kind: 'progression' }] },
        levels: [{ ref: 'sk_eg_lv_a', title: 'A' }, { ref: 'sk_eg_lv_b', title: 'B' }] },
    });

    const result = await exportGameHandler({ ref: 'sk_eg_duo' });
    expect(result.ok).toBe(true);
    const names = result.files.map((f) => f.file);
    // sovereignty: the shared map recipe ships ONCE beside the two light level recipes
    expect(names).toContain('recipe/sk_eg_map.json');
    expect(names.filter((f) => f === 'recipe/sk_eg_map.json')).toHaveLength(1);
    expect(names).toContain('recipe/sk_eg_lv_a.json');
    const mapRecipe = JSON.parse(readFileSync(path.join(result.dir, 'recipe/sk_eg_map.json'), 'utf8'));
    expect(mapRecipe.faces).toHaveLength(2);
    // geometry bank: both level pages bake identical GROUPS → exactly one shared groups file
    const groups = names.filter((f) => /^assets\/geometry\/groups-[0-9a-f]{8}\.json$/.test(f));
    expect(groups).toHaveLength(1);
    expect(result.geometry_bank.files).toBe(1);
    for (const lv of ['sk_eg_lv_a', 'sk_eg_lv_b']) {
      const page = readFileSync(path.join(result.dir, `levels/${lv}.html`), 'utf8');
      expect(page).toContain(`const GROUPS = await (await fetch("../${groups[0]}")).json()`);
    }
    // the hoisted file is plain JSON and carries the packed terrain mesh
    const bank = JSON.parse(readFileSync(path.join(result.dir, groups[0]), 'utf8'));
    expect(Array.isArray(bank)).toBe(true);
    expect(bank[0].pos.length).toBeGreaterThan(0);   // packed vertex buffer
  });

  it('surfaces resolveGame teaching errors for a game pointing at a missing level', async () => {
    SketchRepository.create({
      title: 'Broken',
      manifest: {
        kind: 'game',
        title: 'Broken',
        store: { slices: [{ name: 'flags', kind: 'flags' }] },
        levels: [{ ref: 'sk_eg_missing_level' }],
      },
      ref: 'sk_eg_broken',
    });
    await expect(exportGameHandler({ ref: 'sk_eg_broken' })).rejects.toThrow(/no sketch with that ref/);
    // nothing half-written for the failed export
    expect(existsSync(path.join(OUT, 'sk_eg_broken', 'game.html'))).toBe(false);
  });
});
