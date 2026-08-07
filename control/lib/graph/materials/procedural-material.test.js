process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import {
  resolveFaceMaterials, stampMaterial, weatherRigParts, MATERIAL_PRESETS, MATERIAL_KINDS,
} from '@/lib/graph/materials/procedural-material';
import { mintControllableWorld } from '@/lib/mcp/tools/scene-controllable';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

const quad = (extra = {}) => ({
  corners: [[-10, 0, 0], [10, 0, 0], [10, 0, 20], [-10, 0, 20]],
  fill: '#8f96a0', doubleSided: true, ...extra,
});

describe('procedural-material resolveFaceMaterials', () => {
  it('leaves a face list with no material untouched (same reference)', () => {
    const faces = [quad(), quad()];
    expect(resolveFaceMaterials(faces)).toBe(faces);
  });

  it('tessellates a material face into grid² vertex-coloured faces', () => {
    const g = MATERIAL_PRESETS['brushed-steel'].grid;
    const out = resolveFaceMaterials([quad({ material: 'brushed-steel' })]);
    expect(out.length).toBe(g * g);
    for (const f of out) {
      expect(Array.isArray(f.cornerFills)).toBe(true);
      expect(f.cornerFills).toHaveLength(4);
      for (const h of f.cornerFills) expect(h).toMatch(/^#[0-9a-f]{6}$/);
      expect(f.doubleSided).toBe(true);       // carried over
    }
  });

  it('is deterministic (seeded) — same faces in, byte-identical colours out', () => {
    const a = resolveFaceMaterials([quad({ material: 'weathered-hull' })]);
    const b = resolveFaceMaterials([quad({ material: 'weathered-hull' })]);
    expect(a.map((f) => f.cornerFills)).toEqual(b.map((f) => f.cornerFills));
  });

  it('carries the specular channel through tessellation', () => {
    const out = resolveFaceMaterials([quad({ material: 'brushed-steel', spec: [0.6, 18] })]);
    expect(out.every((f) => Array.isArray(f.spec) && f.spec[0] === 0.6)).toBe(true);
  });

  it('honours object materials: grid, tint, and wear overrides', () => {
    const plain = resolveFaceMaterials([quad({ material: { kind: 'brushed-steel', grid: 2 } })]);
    expect(plain.length).toBe(4);
    // a tint override changes the base colour → different output than the default grey
    const tinted = resolveFaceMaterials([quad({ material: { kind: 'gradient-plate', tint: '#c8a03c' } })]);
    expect(tinted[0].cornerFills[0]).not.toBe(plain[0].cornerFills[0]);
    // weathering darkens/tints vs a clean gradient of the same base
    const clean = resolveFaceMaterials([quad({ material: { kind: 'gradient-plate' } })]);
    const worn = resolveFaceMaterials([quad({ material: { kind: 'weathered-heavy' } })]);
    expect(worn.map((f) => f.cornerFills)).not.toEqual(clean.map((f) => f.cornerFills));
  });

  it('caps grid at MAX_GRID (runaway guard)', () => {
    const out = resolveFaceMaterials([quad({ material: { kind: 'brushed-steel', grid: 999 } })]);
    expect(out.length).toBe(8 * 8);   // MAX_GRID
  });

  it('exposes a preset registry', () => {
    expect(MATERIAL_KINDS).toContain('weathered-hull');
    expect(MATERIAL_KINDS).toContain('brushed-steel');
  });

  it('stampMaterial tags every face', () => {
    const stamped = stampMaterial([quad(), quad()], 'brushed-hull');
    expect(stamped.every((f) => f.material === 'brushed-hull')).toBe(true);
  });
});

describe('weatherRigParts (per-vertex rig weathering)', () => {
  // a fake baked part: 200 vertices spread over z 0..10, all painted the same base blue
  const b64f32 = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64');
  const b64u8 = (a) => Buffer.from(Uint8Array.from(a).buffer).toString('base64');
  const makePart = () => {
    const pos = [], col = [];
    for (let i = 0; i < 200; i++) { pos.push((i % 13) - 6, (i % 7) - 3, (i / 200) * 10); col.push(60, 74, 100); }
    return { pos: b64f32(pos), col: b64u8(col) };
  };

  it('modulates the colour buffer, preserves length, and is deterministic', () => {
    const a = makePart(), b = makePart();
    weatherRigParts([a], { seed: 7, amt: 1.5 });
    weatherRigParts([b], { seed: 7, amt: 1.5 });
    expect(a.col).toBe(b.col);                    // deterministic
    expect(a.col).not.toBe(makePart().col);       // colours actually changed
    expect(Buffer.from(a.col, 'base64').length).toBe(600);   // 200 verts × 3 preserved
  });

  it('weathers low vertices more than high ones (gravity bias)', () => {
    const part = makePart();
    weatherRigParts([part], { seed: 7, amt: 1.6, zmin: 0, zmax: 10 });
    const col = Buffer.from(part.col, 'base64');
    // vertex 0 sits at z≈0 (low), vertex 199 at z≈10 (high); low should drift further from the base blue
    const base = [60, 74, 100];
    const dist = (i) => Math.abs(col[3 * i] - base[0]) + Math.abs(col[3 * i + 1] - base[1]) + Math.abs(col[3 * i + 2] - base[2]);
    expect(dist(0)).toBeGreaterThanOrEqual(dist(199));
  });

  it('leaves parts without pos/col untouched', () => {
    const parts = [{ foo: 1 }, null];
    expect(() => weatherRigParts(parts, {})).not.toThrow();
  });

  it('brushed-only (cloud>0, amt:0) varies brightness but PRESERVES the blue hue (no rust)', () => {
    const part = makePart();   // base blue [60,74,100]
    weatherRigParts([part], { seed: 7, cloud: 0.45, amt: 0, zmin: 0, zmax: 10 });
    const col = Buffer.from(part.col, 'base64');
    let changed = 0, rMean = 0, bMean = 0, n = col.length / 3;
    for (let i = 0; i < n; i++) {
      if (col[3 * i] !== 60 || col[3 * i + 1] !== 74 || col[3 * i + 2] !== 100) changed++;
      rMean += col[3 * i]; bMean += col[3 * i + 2];
    }
    rMean /= n; bMean /= n;
    expect(changed).toBeGreaterThan(0);          // brightness actually varies
    expect(bMean).toBeGreaterThan(rMean + 20);   // blue still dominates red → hue preserved, no rust shift
  });
});

describe('procedural-material through the world render path', () => {
  beforeEach(() => { closeDb(); });
  const drone = { id: 'd', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } };

  it('resolves a material-tagged world face into vertex-coloured geometry (mint → resolveWorldScene → emit)', async () => {
    const out = mintControllableWorld({
      title: 'material world', entities: [drone],
      faces: [quad({ material: 'weathered-hull' })],
    });
    const { payload } = await resolveWorldScene({ ref: out.ref, manifest: out.recipe });
    const g = MATERIAL_PRESETS['weathered-hull'].grid;
    const materialFaces = payload.faces.filter((f) => Array.isArray(f.cornerFills));
    expect(materialFaces.length).toBe(g * g);          // the tagged face was tessellated
    const html = emitThreeWorld(payload);
    expect(html).toContain('const GROUPS =');           // renders as a mesh world
  });
});
