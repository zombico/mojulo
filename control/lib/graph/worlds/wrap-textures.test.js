import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveWrapTextures, resolveAssemblerWrapTextures } from './world-kinds.js';
import { collectWrapSources, lowerObjectFaces } from './workbench.js';
import { collectAssemblerWrapSources, lowerAssemblerFaces } from './workbench-assembler.js';

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

// The carton print (soda-product-shot, 2026-09-08): an extrude keys `xwrap_<i>`, and an
// assembler scopes every frozen part's keys per item so a can and a carton keep their labels.
const carton = (wrap) => ({
  profile: { rect: { w: 4, h: 6 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 }, wrap,
});

describe('extrude wrap sources + assembler scoping', () => {
  it('collectWrapSources lists extrude wraps as xwrap_<i>, after the lathes', () => {
    const m = { kind: 'workbench', lathes: [lathe({ source: { outcomeRef: 'a' } })], extrudes: [carton(), carton({ source: { outcomeRef: 'b' } })] };
    expect(collectWrapSources(m)).toEqual([{ key: 'wrap_0', source: { outcomeRef: 'a' } }, { key: 'xwrap_1', source: { outcomeRef: 'b' } }]);
  });

  it('lowerObjectFaces tags a wrapped extrude\'s walls with its key', () => {
    const faces = lowerObjectFaces({ extrudes: [carton({ source: { outcomeRef: 'b' } })] });
    expect(faces.filter((f) => f.texture === 'xwrap_0').length).toBe(4);
  });

  it('an assembler scopes keys per item on both the faces and the sources', () => {
    const m = { kind: 'assembler', items: [
      { source: { lathes: [lathe({ source: { outcomeRef: 'sk_skin' } })] }, on: 'ground' },
      { source: { extrudes: [carton({ source: { outcomeRef: 'sk_skin', target: 'detail' } })] }, at: [10, 0, 0], on: 'ground' },
    ] };
    expect(collectAssemblerWrapSources(m)).toEqual([
      { key: 'p0:wrap_0', source: { outcomeRef: 'sk_skin' } },
      { key: 'p1:xwrap_0', source: { outcomeRef: 'sk_skin', target: 'detail' } },
    ]);
    const faces = lowerAssemblerFaces(m);
    const keys = new Set(faces.map((f) => f.texture).filter(Boolean));
    expect([...keys].sort()).toEqual(['p0:wrap_0', 'p1:xwrap_0']);
  });
});

describe('resolveAssemblerWrapTextures', () => {
  let base; let prevDir;
  beforeAll(() => {
    base = mkdtempSync(path.join(tmpdir(), 'wrap-outcomes-asm-'));
    prevDir = process.env.MOJULO_OUTCOMES_DIR;
    process.env.MOJULO_OUTCOMES_DIR = base;
    const dir = path.join(base, 'sk_skin'); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'render-page-1.png'), Buffer.from('can'));
    writeFileSync(path.join(dir, 'render-detail-1.png'), Buffer.from('carton'));
  });
  afterAll(() => {
    if (prevDir === undefined) delete process.env.MOJULO_OUTCOMES_DIR; else process.env.MOJULO_OUTCOMES_DIR = prevDir;
    rmSync(base, { recursive: true, force: true });
  });

  it('resolves each frozen part\'s label under its scoped key; no wraps → {}', async () => {
    const m = { kind: 'assembler', items: [
      { source: { lathes: [lathe({ source: { outcomeRef: 'sk_skin' } })] }, on: 'ground' },
      { source: { extrudes: [carton({ source: { outcomeRef: 'sk_skin', target: 'detail' } })] }, on: 'ground' },
    ] };
    const tex = await resolveAssemblerWrapTextures(m);
    expect(tex).toEqual({
      'p0:wrap_0': `data:image/png;base64,${Buffer.from('can').toString('base64')}`,
      'p1:xwrap_0': `data:image/png;base64,${Buffer.from('carton').toString('base64')}`,
    });
    expect(await resolveAssemblerWrapTextures({ kind: 'assembler', items: [{ source: { extrudes: [carton()] }, on: 'ground' }] })).toEqual({});
  });
});
