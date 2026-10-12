// Isolate to an in-memory SQLite before any import that pulls db/index.js (export-game.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { composeWorld } from './compose-world.js';
import { mintGame } from './create-game.js';
import { exportGameHandler } from './export-game.js';
import { mintEdifice } from './edifice.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const OUT = mkdtempSync(path.join(tmpdir(), 'export-city-game-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;
afterAll(() => { rmSync(OUT, { recursive: true, force: true }); closeDb(); });

// A city's map game ships as a folder like any other: a page per segment and per inside, the city's plan once.
describe('export_game on a city map game', () => {
  it('writes every level, the city recipe beside the light segment recipes, and the links in the shell', async () => {
    const r = composeWorld({ base: 'city', seed: 6, title: 'Downtown', overrides: { plan: { grammar: 'paris', board: { cols: 8, rows: 6 }, segments: { levels: true, enter: { walk: 1, door: 1 } } } } });
    const g = await mintGame({ ...r.game.create_game, allowUnaudited: true });
    expect(g.ok).toBe(true);
    const out = await exportGameHandler({ ref: g.ref });
    expect(out.ok).toBe(true);
    const names = out.files.map((f) => f.file);
    for (const ref of [...r.game.levels, ...r.game.interiors.map((x) => x.ref)]) expect(names).toContain(`levels/${ref}.html`);
    // the city plan ships once, and a segment's recipe is a ref to it, not the city again
    expect(names.filter((f) => f === `recipe/${r.ref}.json`)).toHaveLength(1);
    const seg = JSON.parse(readFileSync(path.join(out.dir, `recipe/${r.game.levels[0]}.json`), 'utf8'));
    expect(seg).toMatchObject({ kind: 'city', city: r.ref });
    expect(seg.spine).toBeUndefined();
    // a segment page carries its game: its exits and its door
    const page = readFileSync(path.join(out.dir, `levels/${r.game.levels[0]}.html`), 'utf8');
    expect(page).toMatch(/reach-exit/);
    const shell = readFileSync(path.join(out.dir, 'game.html'), 'utf8');
    for (const lk of r.game.create_game.links) expect(shell).toContain(lk.from.door);
  }, 120000);
  it('a landmark of your own: an edifice minted, stood on a site by ref, drawn in the world, refused when it is not one, shipped with the game', async () => {
    mintEdifice({ title: 'Museum', ref: 'sk_lm_museum', entrance: 'hall', seed: 2, masses: [{ id: 'hall', footprint: { w: 160, d: 90 }, floors: 4, at: [0, 0], facade: { material: 'concrete', rhythm: 'pier', glass: '#5f7d8c', frame: '#e8e0d0' }, roof: 'modern-shed', interior: { kernel: 'open' } }] });
    const plan = { grammar: 'paris', board: { cols: 8, rows: 6 }, sites: [{ at: 'F2:G3', use: 'landmark', from: 'sk_lm_museum' }], segments: { levels: true, enter: { walk: 1, door: 0 } } };
    expect(() => composeWorld({ base: 'city', seed: 6, overrides: { plan: { ...plan, sites: [{ at: 'F2', use: 'landmark', from: 'sk_nothing' }] } } })).toThrow(/no sketch with that ref/);
    const r = composeWorld({ base: 'city', seed: 6, title: 'Museum quarter', overrides: { plan } });
    expect(r.ok).toBe(true);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref));
    expect(payload.faces.some((f) => f.inset === 'sk_lm_museum')).toBe(true);
    const g = await mintGame({ ...r.game.create_game, allowUnaudited: true });
    const out = await exportGameHandler({ ref: g.ref });
    expect(out.files.map((f) => f.file)).toContain('recipe/sk_lm_museum.json');
  }, 120000);
});
