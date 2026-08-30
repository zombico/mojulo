// forge_motion re-forge door (edit-3d-recipes.plan.md Phase 3): the stored
// recipe.json is a legal INPUT — pass recipe_ref to re-render a shot, or read
// recipe.json, edit it, and pass it as recipe. Same in-memory isolation as
// motion.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { forgeMotionHandler } from './motion.js';

let outDir;

// Same self-contained manji-tree terrain subject as motion.test.js.
const SUBJECT = {
  kind: 'manji-tree',
  dimensions: '3d',
  physics: { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1 },
  showSlotMarkers: false,
  camera: {
    worldFraming: { cameraPosition: [0, -12, 4], lookAt: [0, 0, 2], horizontalFov: 46 },
    viewBox: { width: 480, height: 400 },
  },
  roomBasis: { xRange: [-8, 8], yRange: [-8, 8], worldExtent: { width: 16, depth: 16, height: 10 } },
  tree: {
    id: 'world',
    spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 0.01 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [],
    children: [],
  },
  waveFields: [
    {
      corners: [
        { x: -8, y: 8, z: 0 },
        { x: 8, y: 8, z: 0 },
        { x: 8, y: -8, z: 0 },
        { x: -8, y: -8, z: 0 },
      ],
      displacement: { x: 0, y: 0, z: 1 },
      samples: { u: 10, v: 10 },
      waves: [{ amplitude: 2.2, cycles: { u: 1.5, v: 1.5 }, phase: 0.4 }],
      style: { stroke: '#8a744a', width: 0.5 },
    },
  ],
};

beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-motion-reforge-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});

afterAll(async () => {
  await fs.rm(outDir, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
});

async function forgeOnce() {
  const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });
  return forgeMotionHandler({
    title: 'spin the terrain',
    subject: { sketch_ref: sketch.ref },
    shot: { motion: 'turntable', frames: 5, fps: 10 },
    export: 'svg',
  });
}

describe('forge_motion re-forge', () => {
  it('recipe_ref re-renders a stored shot deterministically as a new motion ref', async () => {
    const first = await forgeOnce();
    const second = await forgeMotionHandler({ recipe_ref: first.motion_ref, export: 'svg' });
    expect(second.ok).toBe(true);
    expect(second.motion_ref).not.toBe(first.motion_ref);

    const r1 = JSON.parse(await fs.readFile(path.join(outDir, first.motion_ref, 'recipe.json'), 'utf8'));
    const r2 = JSON.parse(await fs.readFile(path.join(outDir, second.motion_ref, 'recipe.json'), 'utf8'));
    expect(r2.title).toBe(r1.title);                 // title defaulted from the recipe
    expect(r2.subject).toEqual(r1.subject);
    expect(r2.shot.motion).toBe(r1.shot.motion);
    expect(r2.shot.frames).toBe(r1.shot.frames);
    expect(r2.shot.fps).toBe(r1.shot.fps);
  });

  it('an EDITED recipe re-forges with the edit applied (the iterate loop)', async () => {
    const first = await forgeOnce();
    const recipe = JSON.parse(await fs.readFile(path.join(outDir, first.motion_ref, 'recipe.json'), 'utf8'));
    recipe.shot.frames = 7;
    const second = await forgeMotionHandler({ title: 'spin, longer', recipe, export: 'svg' });
    expect(second.ok).toBe(true);
    const motionSvg = await fs.readFile(path.join(outDir, second.motion_ref, 'motion.svg'), 'utf8');
    expect((motionSvg.match(/class="moj-frame"/g) || []).length).toBe(7);
  });

  it('refuses recipe + subject/shot together, and a recipe_ref with no recipe.json', async () => {
    const first = await forgeOnce();
    await expect(forgeMotionHandler({
      recipe_ref: first.motion_ref,
      subject: { sketch_ref: 'whatever' },
    })).rejects.toThrow(/not both/);
    await expect(forgeMotionHandler({ recipe_ref: 'mo_nonexistent' }))
      .rejects.toThrow(/no readable recipe\.json/);
  });
});
