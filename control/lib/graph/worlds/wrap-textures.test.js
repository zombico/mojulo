import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveWrapTextures } from './world-kinds.js';

/**
 * The image-worker → wrap seam: a lathe wrap whose source is `{ outcomeRef }`
 * resolves the latest bound image-outcome render PNG (render-store.js) into a
 * PNG data URL — the texture map emitThreeWorld and the .glb exporter consume.
 */

const lathe = (wrap) => ({
  axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 },
  profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }],
  wrap,
});

describe('resolveWrapTextures — outcomeRef sources', () => {
  let base;
  let prevDir;

  beforeAll(() => {
    base = mkdtempSync(path.join(tmpdir(), 'wrap-outcomes-'));
    prevDir = process.env.MOJULO_OUTCOMES_DIR;
    process.env.MOJULO_OUTCOMES_DIR = base;
    const dir = path.join(base, 'sk_skin');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'render-page-1.png'), Buffer.from('stale'));
    writeFileSync(path.join(dir, 'render-page-2.png'), Buffer.from('latest-label'));
    writeFileSync(path.join(dir, 'render-detail-1.png'), Buffer.from('detail'));
  });

  afterAll(() => {
    if (prevDir === undefined) delete process.env.MOJULO_OUTCOMES_DIR;
    else process.env.MOJULO_OUTCOMES_DIR = prevDir;
    rmSync(base, { recursive: true, force: true });
  });

  it('resolves the LATEST bound render for the default target (page) as a PNG data URL', async () => {
    const textures = await resolveWrapTextures({ kind: 'workbench', lathes: [lathe({ source: { outcomeRef: 'sk_skin' } })] });
    expect(textures.wrap_0).toBe(`data:image/png;base64,${Buffer.from('latest-label').toString('base64')}`);
  });

  it('honours an explicit target', async () => {
    const textures = await resolveWrapTextures({ kind: 'workbench', lathes: [lathe({ source: { outcomeRef: 'sk_skin', target: 'detail' } })] });
    expect(textures.wrap_0).toBe(`data:image/png;base64,${Buffer.from('detail').toString('base64')}`);
  });

  it('skips silently when the ref has no bound renders, the target is unbound, or the ref is malformed', async () => {
    for (const source of [
      { outcomeRef: 'sk_nothing_here' },
      { outcomeRef: 'sk_skin', target: 'unbound' },
      { outcomeRef: '../escape' },
    ]) {
      const textures = await resolveWrapTextures({ kind: 'workbench', lathes: [lathe({ source })] });
      expect(textures).toEqual({});
    }
  });
});
