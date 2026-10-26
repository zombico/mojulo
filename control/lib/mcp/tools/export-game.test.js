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

  it('an era is the pages\': an unknown one teaches, an engine pack refuses one', async () => {
    await expect(exportGameHandler({ ref: 'sk_nope', era: 'gen-9' })).rejects.toThrow(/not an era \(gen-6, gen-7\)/);
    await expect(exportGameHandler({ ref: 'sk_nope', era: 'gen-7', target: 'godot' })).rejects.toThrow(/era is read by the web and desktop pages; a godot pack/);
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
    // a drop-folder host (muse) cannot carry the folder; its note names the recipe/ this export wrote, not a recipe.json
    const muse = await exportGameHandler({ ref: 'sk_eg_duo' }, { host: 'muse' });
    expect(muse.handoff.next).toMatch(/so the folder sk_eg_duo would not surface there/);
    expect(muse.handoff.caveats).toEqual([expect.stringMatching(/cannot carry a folder, and no courier page carries it: .*hand over its recipe \(recipe\/ in the folder re-mints it/)]);
    expect(muse.handoff.caveats.join()).not.toMatch(/recipe\.json|bundle/);
  });

  it('the same game in another era: its pages drawn in it, the surfaces drawn as paint named, the recipes as they were', async () => {
    const g7 = await exportGameHandler({ ref: 'sk_eg_duo', era: 'gen-7' });
    expect(g7.era).toBe('gen-7');
    expect(Object.keys(g7.era_marks.approximated)).toEqual(expect.arrayContaining(['faces', 'shadows']));
    expect(g7.era_marks.approximated.faces).toMatch(/drawn as paint/);
    // the level's page takes the form render's light: the hour's map beside the hero's actor shadows
    const level = readFileSync(path.join(g7.dir, 'levels/sk_eg_lv_a.html'), 'utf8');
    expect(level).toMatch(/"hour":true/);
    expect(JSON.parse(readFileSync(path.join(g7.dir, 'recipe/sk_eg_lv_a.json'), 'utf8'))).toEqual(SketchRepository.getByRef('sk_eg_lv_a').manifest);
    // the game's own era, asked nothing: no era in the answer
    const g6 = await exportGameHandler({ ref: 'sk_eg_duo' });
    expect(g6.era).toBeUndefined();
    expect(g6.era_marks).toBeUndefined();
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

// the desktop tests never launch a real Electron: the finder is injected (absent unless a test says so)
const NO_ELECTRON = { smoke: { find: () => null } };

describe("export_game — target 'desktop'", () => {
  it('writes the web folder plus the three files that make it an Electron app, the same bytes each time', async () => {
    const floor = [{ corners: [[-50, -50, 0], [50, -50, 0], [50, 50, 0], [-50, 50, 0]], fill: '#565' }];
    SketchRepository.create({
      title: 'desk level', ref: 'sk_eg_desk_lv',
      manifest: { kind: 'controllable', faces: floor,
        entities: [{ id: 'hero', transform: { pos: [0, 0, 0] }, rule: { type: 'walk', speed: 10 }, body: { type: 'mesh', shape: 'box', size: [4, 4, 8], color: '#fa0' } }],
        game: { levelRef: 'sk_eg_desk_lv', produces: { results: ['success'], events: [] } } },
    });
    SketchRepository.create({
      title: 'Desk Run', ref: 'sk_eg_desk',
      manifest: { kind: 'game', title: 'Desk Run', store: { slices: [{ name: 'flags', kind: 'flags' }] }, levels: [{ ref: 'sk_eg_desk_lv', title: 'One' }] },
    });

    const result = await exportGameHandler({ ref: 'sk_eg_desk', target: 'desktop', cdn: true }, {}, NO_ELECTRON);
    expect(result.ok).toBe(true);
    expect(result.target).toBe('desktop');
    const names = result.files.map((f) => f.file);
    expect(names).toEqual(expect.arrayContaining(['game.html', 'levels/sk_eg_desk_lv.html', 'package.json', 'main.js', '.gitignore', 'README.md']));
    // a desktop app is offline: `cdn: true` is refused with a note, three.js stays inlined
    expect(result.cdn_note).toMatch(/desktop app inlines three\.js/);
    expect(readFileSync(path.join(result.dir, 'levels/sk_eg_desk_lv.html'), 'utf8')).not.toMatch(/cdn\.jsdelivr/);

    const pkg = JSON.parse(readFileSync(path.join(result.dir, 'package.json'), 'utf8'));
    expect(pkg).toMatchObject({ name: 'desk-run-sk-eg-desk', productName: 'Desk Run', main: 'main.js', private: true });
    expect(pkg.devDependencies.electron).toBe(result.desktop.electron);
    expect(pkg.scripts.start).toBe('electron .');
    const readme = readFileSync(path.join(result.dir, 'README.md'), 'utf8');
    expect(readme).toContain('## Play it as a desktop app');
    expect(readme.indexOf('## Play it as a desktop app')).toBeLessThan(readme.indexOf('## How to re-mint'));

    const before = Object.fromEntries(['package.json', 'main.js', '.gitignore', 'README.md', 'game.html']
      .map((f) => [f, readFileSync(path.join(result.dir, f))]));
    await exportGameHandler({ ref: 'sk_eg_desk', target: 'desktop' }, {}, NO_ELECTRON);
    for (const [f, bytes] of Object.entries(before)) expect(readFileSync(path.join(result.dir, f)).equals(bytes), f).toBe(true);
  });

  it('a pixelizer game becomes an app the same way; its web export writes none of the desktop files', async () => {
    const manifest = { kind: 'game', engine: 'pixelizer', reducer: 'brickster', title: 'Brick Desk', music: true, menu: { tagline: 't' } };
    SketchRepository.create({ title: 'Brick Desk', manifest, ref: 'sk_eg_brick_desk' });
    const web = await exportGameHandler({ ref: 'sk_eg_brick_desk' });
    expect(web.files.map((f) => f.file).sort()).toEqual(['README.md', 'game.html', 'recipe/game.json']);
    expect(web.desktop).toBeUndefined();
    expect(readFileSync(path.join(web.dir, 'README.md'), 'utf8')).not.toContain('desktop app');
    const desk = await exportGameHandler({ ref: 'sk_eg_brick_desk', target: 'desktop' }, {}, NO_ELECTRON);
    expect(desk.files.map((f) => f.file).sort()).toEqual(['.gitignore', 'README.md', 'game.html', 'main.js', 'package.json', 'recipe/game.json']);
    expect(desk.desktop.gate).toMatch(/export-desktop\.mjs --ref sk_eg_brick_desk/);
  });

  it('no Electron on this host: the smoke is skipped and the answer says so; the export still succeeds', async () => {
    SketchRepository.create({ title: 'Smoke Off', manifest: { kind: 'game', engine: 'pixelizer', reducer: 'brickster', title: 'Smoke Off' }, ref: 'sk_eg_smoke_off' });
    let ran = false;
    const desk = await exportGameHandler({ ref: 'sk_eg_smoke_off', target: 'desktop' }, {}, { smoke: { find: () => null, run: async () => { ran = true; return { ran: true }; } } });
    expect(desk.ok).toBe(true);
    expect(ran).toBe(false);
    expect(desk.desktop.smoke).toEqual({ ran: false, skipped: expect.stringMatching(/no Electron on this host.*the smoke did not run/) });
    // the CLI runs its own gate, so it asks for none
    const cli = await exportGameHandler({ ref: 'sk_eg_smoke_off', target: 'desktop' }, {}, { smoke: false });
    expect(cli.desktop.smoke).toBeUndefined();
  });

  it('Electron found: the same smoke runs over the shell and the first level, bounded, and its report is answered', async () => {
    const floor = [{ corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], fill: '#565' }];
    SketchRepository.create({ title: 'smoke level', ref: 'sk_eg_smoke_lv', manifest: { kind: 'controllable', faces: floor, game: { levelRef: 'sk_eg_smoke_lv', produces: { results: ['success'], events: [] } } } });
    SketchRepository.create({ title: 'Smoke On', ref: 'sk_eg_smoke_on', manifest: { kind: 'game', title: 'Smoke On', store: { slices: [{ name: 'flags', kind: 'flags' }] }, levels: [{ ref: 'sk_eg_smoke_lv' }] } });
    const seen = {};
    const find = (host, opts) => { seen.findDir = opts.dir; return '/fake/electron'; };
    const run = async (arg) => { Object.assign(seen, arg); return { ran: true, exit: 1, ok: false, electron: '33.0.0', pages: [{ page: 'game.html', loaded: true, failed: [], errors: [] }, { page: 'levels/sk_eg_smoke_lv.html', loaded: true, failed: [], errors: ['boom'] }], missing: [] }; };
    const desk = await exportGameHandler({ ref: 'sk_eg_smoke_on', target: 'desktop' }, {}, { smoke: { find, run } });
    expect(seen.findDir).toBe(desk.dir);
    expect(seen).toMatchObject({ dir: desk.dir, electron: '/fake/electron', pages: ['game.html', 'levels/sk_eg_smoke_lv.html'], timeoutMs: 75_000, env: { MOJULO_SMOKE_TIMEOUT_MS: '60000' } });
    // advisory: a failed smoke is reported, the export is not failed
    expect(desk.ok).toBe(true);
    expect(desk.desktop.smoke).toMatchObject({ ran: true, ok: false, exit: 1, electron: '/fake/electron', pages: [{ page: 'game.html' }, { page: 'levels/sk_eg_smoke_lv.html', errors: ['boom'] }], ms: expect.any(Number), eyes_gate: expect.stringMatching(/^not run/) });
    // Electron found but it would not start: skipped, with its reason
    const broken = await exportGameHandler({ ref: 'sk_eg_smoke_on', target: 'desktop' }, {}, { smoke: { find, run: async () => ({ ran: false, skipped: 'Electron did not start: ENOENT' }) } });
    expect(broken.desktop.smoke).toEqual({ ran: false, skipped: 'Electron did not start: ENOENT', electron: '/fake/electron' });
  });
});
