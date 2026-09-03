process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-test-atlas-'));

import { describe, it, expect } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { skinPolygomerHandler } from './sketches.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { encodePng } from '@/lib/graph/landscape/surface-textures';

// skin_polygomer mode:'atlas' end to end (skin-over-mesh.plan.md phase 2b):
// PLAN → PAINT (solid-colour PNGs stand in for the worker) → the audit +
// bind → the figure world WEARS the atlas → the inpaint loop raises coverage.

const solidPng = ([r, g, b], size = 128) => {
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) { rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; }
  return encodePng(rgb, size, size);
};
const asView = (view, color) => ({
  image_base64: solidPng(color).toString('base64'),
  camera: { pos: view.pos, target: view.target, vfov: view.vfov },
  label: view.label,
});

describe('skin_polygomer mode:atlas — the wrap loop tool seam', () => {
  it('PLAN: returns a deterministic view deck + island count for a bare figure', async () => {
    SketchRepository.create({ ref: 'sk_atlas_fig', title: 'atlas figure', manifest: { kind: 'figure' } });
    const plan = await skinPolygomerHandler({ ref: 'sk_atlas_fig', mode: 'atlas' });
    expect(plan.mode).toBe('atlas');
    expect(plan.islands).toBeGreaterThan(4);
    expect(plan.viewPlan.map((v) => v.label)).toEqual(['front', 'back', 'left', 'right', 'three-quarter-high']);
    expect(plan.submit).toContain('mode: "atlas"');
  });

  it('PAINT + BIND + WEAR: views reproject, the audit reports, the world wears the page', async () => {
    const plan = await skinPolygomerHandler({ ref: 'sk_atlas_fig', mode: 'atlas' });
    const bound = await skinPolygomerHandler({
      ref: 'sk_atlas_fig',
      mode: 'atlas',
      page: 256,
      views: plan.viewPlan.map((v, i) => asView(v, [200 - i * 20, 40 + i * 30, 60])),
    });
    expect(bound.ok).toBe(true);
    expect(bound.n).toBe(1);
    expect(existsSync(bound.path)).toBe(true);
    expect(bound.coverage).toBeGreaterThan(0.4);

    // the manifest carries the binding
    const sketch = SketchRepository.getByRef('sk_atlas_fig');
    expect(sketch.manifest.skin.atlas).toEqual({ n: 1, page: 256, gutter: 8 });

    // the resolved world WEARS it: remapped faces + the page as a data URL
    const { payload } = await resolveWorldScene(sketch);
    const skinned = payload.faces.filter((f) => f.texture === 'skin-atlas');
    expect(skinned.length).toBeGreaterThan(0);
    expect(payload.textures['skin-atlas']).toMatch(/^data:image\/png;base64,/);
    // atlas-space uvs stay inside the page
    for (const f of skinned.slice(0, 40)) for (const [u, v] of f.uv) {
      expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('LOOP: a starved single-view round reports holes + ready inpaint cameras; more views raise coverage', async () => {
    SketchRepository.create({ ref: 'sk_atlas_loop', title: 'loop figure', manifest: { kind: 'figure' } });
    const plan = await skinPolygomerHandler({ ref: 'sk_atlas_loop', mode: 'atlas' });
    const one = await skinPolygomerHandler({
      ref: 'sk_atlas_loop', mode: 'atlas', page: 256,
      views: [asView(plan.viewPlan[0], [220, 40, 40])],
    });
    expect(one.holes.length).toBeGreaterThan(0);
    expect(one.inpaintViews.length).toBe(one.holes.length);
    for (const v of one.inpaintViews) {
      expect(v.label).toMatch(/^inpaint:/);
      expect(v.pos.every(Number.isFinite)).toBe(true);
    }
    const two = await skinPolygomerHandler({
      ref: 'sk_atlas_loop', mode: 'atlas', page: 256,
      views: [
        ...plan.viewPlan.map((v) => asView(v, [220, 40, 40])),
        ...one.inpaintViews.slice(0, 6).map((v) => asView(v, [220, 40, 40])),
      ],
    });
    expect(two.n).toBe(2);                                  // append-only slots
    expect(two.coverage).toBeGreaterThan(one.coverage);     // the loop converges
  });

  it('degrades cleanly: binding gone from disk → the world drops the dangling atlas tags', async () => {
    const sketch = SketchRepository.getByRef('sk_atlas_fig');
    rmSync(path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_atlas_fig'), { recursive: true, force: true });
    const { payload } = await resolveWorldScene(sketch);
    expect(payload.faces.some((f) => f.texture === 'skin-atlas')).toBe(false);
    expect(payload.textures?.['skin-atlas']).toBeUndefined();
  });

  it('kind animal: the same loop runs on a quadruped and the world wears the page', async () => {
    SketchRepository.create({ ref: 'sk_atlas_dog', title: 'atlas dog', manifest: { kind: 'animal', archetype: 'canine' } });
    const plan = await skinPolygomerHandler({ ref: 'sk_atlas_dog', mode: 'atlas' });
    expect(plan.islands).toBeGreaterThan(4);
    const bound = await skinPolygomerHandler({
      ref: 'sk_atlas_dog', mode: 'atlas', page: 256,
      views: plan.viewPlan.map((v) => asView(v, [140, 90, 50])),
    });
    expect(bound.ok).toBe(true);
    expect(bound.coverage).toBeGreaterThan(0.3);
    expect(bound.seam_continuity.overall).toBeLessThan(bound.seam_continuity.threshold);   // solid paint: seam invisible
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_atlas_dog'));
    expect(payload.faces.some((f) => f.texture === 'skin-atlas')).toBe(true);
    expect(payload.textures['skin-atlas']).toMatch(/^data:image\/png/);
  });

  it('teaches: atlas mode on a non-figure names the screen-space fallback', async () => {
    SketchRepository.create({ ref: 'sk_atlas_bench', title: 'bench', manifest: { kind: 'workbench', lathes: [] } });
    await expect(skinPolygomerHandler({ ref: 'sk_atlas_bench', mode: 'atlas' }))
      .rejects.toThrow(/screen-space projection mode/);
  });
});
