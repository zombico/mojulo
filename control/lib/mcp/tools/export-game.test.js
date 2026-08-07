// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as create-game.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

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
