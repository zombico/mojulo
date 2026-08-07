import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';
import { facesToGlb } from './scene-gltf.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

// renderer-ladder P4 — instanced repeats: geometry stored once, stamped N times.

const tree = () => [
  { corners: [[-0.1, -0.1, 0], [0.1, -0.1, 0], [0.1, 0.1, 2], [-0.1, 0.1, 2]], fill: '#6b4a2f' }, // trunk card
  { corners: [[-0.8, 0, 1.4], [0.8, 0, 1.4], [0.8, 0, 3.2], [-0.8, 0, 3.2]], fill: '#2f6b3a', doubleSided: true }, // canopy card
];
const grid = (n, pitch) => Array.from({ length: n }, (_, i) => ({ pos: [(i % 10) * pitch, Math.floor(i / 10) * pitch, 0], rotZ: (i % 7) * 0.9, scale: 0.8 + (i % 5) * 0.1 }));
const floor = () => ({ corners: [[-5, -5, 0], [40, -5, 0], [40, 40, 0], [-5, 40, 0]], fill: '#31404f', doubleSided: true });

describe('emitThreeWorld — instanced repeats', () => {
  it('lowers repeats to an InstancedMesh block with the full transform set', () => {
    const html = emitThreeWorld({ faces: [floor()], repeats: [{ template: tree(), transforms: grid(50, 3), group: 'trees' }] });
    expect(html).toContain('THREE.InstancedMesh');
    expect(html).toContain('"trees"');
    const m = html.match(/const REPEATS = (\[.*?\]);\n/s);
    expect(m).toBeTruthy();
    const packed = JSON.parse(m[1]);
    expect(packed).toHaveLength(1);
    expect(packed[0].t).toHaveLength(50);          // 50 transforms…
    expect(packed[0].pos.length).toBeLessThan(2000); // …one small template
  });

  it('instancing beats expansion on payload size at scale', () => {
    const transforms = grid(500, 2);
    const instanced = emitThreeWorld({ faces: [floor()], repeats: [{ template: tree(), transforms }] });
    // the same forest, expanded: every tree's faces transformed into world space
    const expandedFaces = [floor()];
    for (const t of transforms) {
      const c = Math.cos(t.rotZ), s = Math.sin(t.rotZ), k = t.scale;
      for (const f of tree()) {
        expandedFaces.push({ ...f, corners: f.corners.map(([x, y, z]) => [t.pos[0] + k * (x * c - y * s), t.pos[1] + k * (x * s + y * c), t.pos[2] + k * z]) });
      }
    }
    const expanded = emitThreeWorld({ faces: expandedFaces });
    expect(instanced.length).toBeLessThan(expanded.length * 0.5);   // at least 2× smaller
  });

  it('skips malformed entries and keeps empty repeats byte-identical to none', () => {
    const base = emitThreeWorld({ faces: [floor()] });
    const withEmpty = emitThreeWorld({ faces: [floor()], repeats: [{ template: [], transforms: [] }, null] });
    expect(withEmpty).toBe(base);
    expect(withEmpty).toContain('const REPEATS = []');
  });

  it('widens the fallback camera framing to cover far instances', () => {
    const near = emitThreeWorld({ faces: [floor()] });
    const far = emitThreeWorld({ faces: [floor()], repeats: [{ template: tree(), transforms: [{ pos: [400, 400, 0] }] }] });
    const cam = (html) => JSON.parse(html.match(/const CAMS = (\[.*?\]);\n/s)[1])[0];
    expect(Math.abs(cam(far).pos[0])).toBeGreaterThan(Math.abs(cam(near).pos[0]) * 5);
  });
});

describe('facesToGlb — instanced repeats', () => {
  it('stores the template mesh once and stamps N nodes with TRS', () => {
    const out = facesToGlb({ faces: [floor()], repeats: [{ template: tree(), transforms: grid(50, 3), group: 'trees' }] });
    expect(out.nodeCount).toBeGreaterThanOrEqual(51);   // static + 50 instances
    // byte size ≈ one template, not 50: an expanded 50-tree glb would carry 50× the geometry
    const one = facesToGlb({ faces: [floor()], repeats: [{ template: tree(), transforms: [{ pos: [0, 0, 0] }] }] });
    expect(out.byteLength).toBeLessThan(one.byteLength + 50 * 200); // ~a node's worth per extra instance
  });

  it('exports a repeats-only payload (no loose faces)', () => {
    const out = facesToGlb({ repeats: [{ template: tree(), transforms: grid(10, 3) }] });
    expect(out).toBeTruthy();
    expect(out.nodeCount).toBe(10);
  });
});

describe('world-scene — generic opt-in repeats channel', () => {
  const sketch = (manifest) => ({ manifest, title: 'test' });

  it('passes manifest.repeats onto the payload', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'controllable',
      faces: [floor()],
      entities: [{ id: 'cam', rule: { type: 'glide' }, body: { type: 'none' } }],
      repeats: [{ template: tree(), transforms: grid(5, 4) }],
    }));
    expect(out.payload.repeats).toHaveLength(1);
    expect(out.payload.repeats[0].transforms).toHaveLength(5);
  });

  it('leaves the payload untouched without repeats', async () => {
    const out = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(out.payload.repeats).toBeUndefined();
  });
});
