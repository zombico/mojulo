process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { forgeMotionHandler } from '@/lib/mcp/tools/motion';
import { GET } from './route.js';

let outDir;

const SUBJECT = {
  kind: 'manji-tree',
  dimensions: '3d',
  physics: { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1 },
  showSlotMarkers: false,
  camera: { worldFraming: { cameraPosition: [0, -12, 4], lookAt: [0, 0, 2], horizontalFov: 46 }, viewBox: { width: 360, height: 300 } },
  roomBasis: { xRange: [-8, 8], yRange: [-8, 8], worldExtent: { width: 16, depth: 16, height: 10 } },
  tree: { id: 'world', spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 0.01 } }, anchor: { x: 0, y: 0, z: 0 }, slots: [], children: [] },
  waveFields: [{ corners: [{ x: -8, y: 8, z: 0 }, { x: 8, y: 8, z: 0 }, { x: 8, y: -8, z: 0 }, { x: -8, y: -8, z: 0 }], displacement: { x: 0, y: 0, z: 1 }, samples: { u: 8, v: 8 }, waves: [{ amplitude: 2, cycles: { u: 1.5, v: 1.5 }, phase: 0.4 }], style: { stroke: '#8a744a', width: 0.5 } }],
};

const req = (q) => new Request(`http://localhost/api/motion${q ? `?q=${encodeURIComponent(q)}` : ''}`);

beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-motion-gallery-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});
afterAll(async () => { await fs.rm(outDir, { recursive: true, force: true }); });
beforeEach(() => { closeDb(); });

describe('GET /api/motion', () => {
  it('returns empty when no motions exist', async () => {
    const res = await GET(req());
    const data = await res.json();
    expect(data.motions).toEqual([]);
    expect(data.projects).toEqual([]);
  });

  it('lists motions and groups two shots under one Motion Project', async () => {
    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });
    const a = await forgeMotionHandler({ title: 'spin', subject: { sketch_ref: sketch.ref }, shot: { motion: 'turntable', frames: 5 }, export: 'both' });
    const b = await forgeMotionHandler({ title: 'push', subject: { sketch_ref: sketch.ref }, shot: { motion: 'push_in', frames: 5 }, export: 'svg', tag_ref: a.tag_ref });

    const res = await GET(req());
    const data = await res.json();

    expect(data.motions).toHaveLength(2);
    // both shots filed under the one project tag
    expect(data.projects).toHaveLength(1);
    const project = data.projects[0];
    expect(project.tagRef).toBe(a.tag_ref);
    expect(project.motions.map((m) => m.motionRef).sort()).toEqual([a.motion_ref, b.motion_ref].sort());

    // row shape the gallery renders
    const spin = data.motions.find((m) => m.motionRef === a.motion_ref);
    expect(spin.motion).toBe('turntable');
    expect(spin.frames).toBe(5);
    expect(spin.svgUrl).toBe(`/outcomes/${a.motion_ref}/motion.svg`);
    expect(spin.gifUrl).toBe(`/outcomes/${a.motion_ref}/motion.gif`); // export both
    expect(spin.project.tagRef).toBe(a.tag_ref);

    // export: 'svg' → no gif url
    const push = data.motions.find((m) => m.motionRef === b.motion_ref);
    expect(push.gifUrl).toBeNull();
    expect(push.svgUrl).toBe(`/outcomes/${b.motion_ref}/motion.svg`);
  });

  it('filters by query (title / motion / project)', async () => {
    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });
    await forgeMotionHandler({ title: 'alpha turntable', subject: { sketch_ref: sketch.ref }, shot: { motion: 'turntable', frames: 4 }, export: 'svg' });
    await forgeMotionHandler({ title: 'beta flythrough', subject: { sketch_ref: sketch.ref }, shot: { motion: 'flythrough', frames: 4, params: { keyframes: [{ pos: [10, 8, 5], lookAt: [0, 0, 2], fov: 50 }, { pos: [-8, 6, 4], lookAt: [0, -2, 2], fov: 54 }] } }, export: 'svg' });

    const res = await GET(req('flythrough'));
    const data = await res.json();
    expect(data.motions).toHaveLength(1);
    expect(data.motions[0].title).toBe('beta flythrough');
  });
});

describe('motion gallery page module', () => {
  it('compiles (JSX) and exports a component', async () => {
    const mod = await import('@/app/maker/motion/page.jsx');
    expect(typeof mod.default).toBe('function');
  });
});
