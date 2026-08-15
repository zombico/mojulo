// interchange.plan.md I2 — export eligibility widening: `figure`, `carved-solid`, and
// `css3d-turntable` gain WORLD_KINDS rows, so resolveWorldScene (the SAME check
// export_model uses) yields a payload and facesToGlb serializes it. The figure payload
// additionally carries its packed rig on `figures` so the I1 `clips` path exports an
// ANIMATED GLB (with the static `body` depiction dropped via the rig's `embodies` tag).

import { describe, expect, it } from 'vitest';

import { resolveWorldScene, WALK_KINDS } from './world-scene.js';
import { facesToGlb } from '../scene/scene-gltf.js';

// Parse a GLB Buffer back into { json, bin } (same harness as scene-gltf.rig.test.js).
function parseGlb(buf) {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2);
  expect(buf.readUInt32LE(8)).toBe(buf.length);
  const jsonLen = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binChunkOffset = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binChunkOffset);
  expect(buf.readUInt32LE(binChunkOffset + 4)).toBe(0x004e4942); // 'BIN\0'
  return { json, bin: buf.slice(binChunkOffset + 8, binChunkOffset + 8 + binLen) };
}

const sketch = (manifest) => ({ manifest, title: null });

// mint-shaped manifests — exactly what create_figure / create_carved_solid /
// create_solid_turntable persist (kind + dials, nothing baked).
const FIGURE = {
  kind: 'figure',
  pose: { shR: { yaw: -40, pitch: -10 }, elbowR: 60, spine: { lateral: 0.2 } },
  proto: { sex: 'female' },
  garment: 'tee',
  motion: 'walk',
  title: 'walking figure',
};
// a path shape with a HOLE (a square ring) — font-independent carved fixture.
const RING_PATH = 'M0 0 L10 0 L10 10 L0 10 Z M3 3 L7 3 L7 7 L3 7 Z';
const CARVED_PATH = { kind: 'carved-solid', shape: { path: RING_PATH }, style: { depth: 0.3, bevel: 0.04, bevelSteps: 3 }, material: 'steel' };
const TURNTABLE = { kind: 'css3d-turntable', shape: 'dodecahedron', color: '#7a5fad', surface: 'vexar' };

describe('I2 export eligibility — the export_model check accepts the widened kinds', () => {
  it('figure / carved-solid / css3d-turntable resolve non-null payloads with faces + cameras', async () => {
    for (const m of [FIGURE, CARVED_PATH, TURNTABLE]) {
      const { payload, kind } = await resolveWorldScene(sketch(m));
      expect(payload, `'${m.kind}' payload`).toBeTruthy();
      expect(kind).toBe(m.kind);
      expect(Array.isArray(payload.faces) && payload.faces.length, `'${m.kind}' faces`).toBeTruthy();
      expect(payload.cameras?.[0]?.worldFraming?.cameraPosition).toHaveLength(3);
      expect(facesToGlb(payload, { generator: 'test' }), `'${m.kind}' glb`).toBeTruthy();
    }
  });

  it('the widened kinds are object studies, not walk worlds (WALK_KINDS untouched)', () => {
    expect(WALK_KINDS.has('figure')).toBe(false);
    expect(WALK_KINDS.has('carved-solid')).toBe(false);
    expect(WALK_KINDS.has('css3d-turntable')).toBe(false);
  });

  it('resolves are deterministic (same manifest twice → identical face lists)', async () => {
    const a = await resolveWorldScene(sketch(CARVED_PATH));
    const b = await resolveWorldScene(sketch(CARVED_PATH));
    expect(JSON.stringify(a.payload.faces)).toBe(JSON.stringify(b.payload.faces));
  });
});

describe('I2 figure — static faces + packed rig + animated GLB', () => {
  it('the payload carries the posed mesh and the rig, and clips exports an animated GLB', async () => {
    const { payload } = await resolveWorldScene(sketch(FIGURE));
    // the static depiction: posed lit faces in the `body` group
    expect(payload.faces.every((f) => f.group === 'body' && Array.isArray(f.corners) && typeof f.fill === 'string')).toBe(true);
    // the rig: packed bones/parts/clips, tagged as embodying the static group
    const rig = payload.figures?.figure;
    expect(rig?.rig).toBe(true);
    expect(rig.bones.length).toBeGreaterThanOrEqual(8);
    expect(rig.parts.filter(Boolean).length).toBeGreaterThan(0);
    expect(Object.keys(rig.clips)).toEqual(['forward']);
    expect(rig.embodies).toBe('body');

    // static export: figure mesh present, no animations key
    const stat = facesToGlb(payload, { generator: 'test' });
    expect(stat).toBeTruthy();
    expect(stat.animationCount).toBeUndefined();
    const statJson = parseGlb(stat.bytes).json;
    expect(statJson.nodes.some((n) => n.name === 'body')).toBe(true);
    expect(statJson.animations).toBeUndefined();

    // animated export (I1 clips): one animation, rig part nodes, and the static
    // `body` ghost DROPPED (rig.embodies)
    const anim = facesToGlb(payload, { generator: 'test', clips: ['forward'] });
    expect(anim.animationCount).toBe(1);
    expect(anim.animatedFigures).toEqual(['figure']);
    const { json } = parseGlb(anim.bytes);
    expect(json.nodes.some((n) => n.name === 'body')).toBe(false);
    const wrap = json.nodes.find((n) => n.name === 'figure');
    expect(wrap.children.length).toBe(rig.parts.filter(Boolean).length);
    const a = json.animations.find((x) => x.name === 'figure:forward');
    expect(a.channels.length).toBe(wrap.children.length * 2); // rotation + translation per boned part
    for (const s of a.samplers) expect(s.interpolation).toBe('LINEAR');
  });

  it('the static export is byte-identical with the rig present vs stripped (char safety)', async () => {
    const { payload } = await resolveWorldScene(sketch(FIGURE));
    const withRig = facesToGlb(payload, { generator: 'test' });
    const { figures, ...bare } = payload;
    const without = facesToGlb(bare, { generator: 'test' });
    expect(withRig.bytes.equals(without.bytes)).toBe(true);
  });

  it('a figure with no stored motion still resolves (default gait clip) and exports static', async () => {
    const { pose, proto } = FIGURE;
    const { payload } = await resolveWorldScene(sketch({ kind: 'figure', pose, proto }));
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.figures.figure.clips.forward.k).toBeGreaterThan(0);
    expect(facesToGlb(payload, { generator: 'test' })).toBeTruthy();
  });
});

describe('I2 carved-solid — caps with holes tessellate into a closed solid', () => {
  it('a holed path extrudes with front/back caps present and edge-manifold walls', async () => {
    const { payload } = await resolveWorldScene(sketch(CARVED_PATH));
    const faces = payload.faces;
    // cap triangles ride as PADDED quads ([a,b,c,c] — padTrianglesForWorld's convention);
    // walls are true quads.
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const capTris = faces.filter((f) => f.corners.length === 4 && same(f.corners[2], f.corners[3]));
    const quads = faces.filter((f) => f.corners.length === 4 && !same(f.corners[2], f.corners[3]));
    expect(capTris.length).toBeGreaterThan(0); // tessellated caps (front + back)
    expect(quads.length).toBeGreaterThan(0);   // bevel + side walls
    // both caps survived: the RING_PATH square-with-hole needs ≥ 8 tris per cap
    // (front cap is bevel-inset, back cap full) — 16 minimum across both.
    expect(capTris.length).toBeGreaterThanOrEqual(16);
    // cap area conservation: total cap triangle area > 0 on both extrusion planes
    const area3 = ([a, b, c]) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const x = u[1] * v[2] - u[2] * v[1], y = u[2] * v[0] - u[0] * v[2], z = u[0] * v[1] - u[1] * v[0];
      return Math.hypot(x, y, z) / 2;
    };
    expect(capTris.reduce((s, f) => s + area3(f.corners), 0)).toBeGreaterThan(0);
    // manifold-ish: wall quad strips close over each ring band, the GLB serializes +
    // parses. The exporter now DROPS the degenerate half of every padded cap quad (GLB
    // weld/degenerate-drop hygiene), so the tally is 2 tris per true quad + 1 per cap.
    const out = facesToGlb(payload, { generator: 'test' });
    const { json } = parseGlb(out.bytes);
    expect(json.nodes.some((n) => n.name === 'carved')).toBe(true);
    expect(out.triangleCount).toBe(quads.length * 2 + capTris.length);
    expect(out.triangleCount).toBeGreaterThan(20);
    expect(out.triangleCount).toBeLessThan(20000);
  });

  it('a text wordmark with holes (BO) exports when a system font is available', async () => {
    let payload = null;
    try {
      ({ payload } = await resolveWorldScene(sketch({ kind: 'carved-solid', shape: { text: 'BO' }, material: 'gold' })));
    } catch (err) {
      // no usable system font on this host — the path-shape net above still covers caps
      expect(String(err.message)).toMatch(/font/i);
      return;
    }
    expect(payload.faces.length).toBeGreaterThan(50);
    const out = facesToGlb(payload, { generator: 'test' });
    expect(out).toBeTruthy();
    // B carries 2 holes + O carries 1 → the front cap alone needs > 3 bridged loops'
    // worth of triangles; sanity-bound the total.
    expect(out.triangleCount).toBeGreaterThan(100);
    expect(out.triangleCount).toBeLessThan(60000);
  });

  it('the carved fills match the SVG palette family (steel greys, not the default hex)', async () => {
    const { payload } = await resolveWorldScene(sketch(CARVED_PATH));
    // every fill is a #rrggbb; the lit steel faces must not all be one flat colour
    expect(payload.faces.every((f) => /^#[0-9a-f]{6}$/i.test(f.fill))).toBe(true);
    expect(new Set(payload.faces.map((f) => f.fill)).size).toBeGreaterThan(3);
  });
});

describe('I2 css3d-turntable — the free rider', () => {
  it('a convex solid resolves to shaded faces and a parseable GLB', async () => {
    const { payload } = await resolveWorldScene(sketch(TURNTABLE));
    // 12 pentagons, each lowered to a quad + a padded triangle for the quad mesher
    expect(payload.faces).toHaveLength(24);
    expect(new Set(payload.faces.map((f) => f.fill)).size).toBeGreaterThan(3); // vexar-shaded, not flat
    const out = facesToGlb(payload, { generator: 'test' });
    const { json } = parseGlb(out.bytes);
    expect(json.nodes.some((n) => n.name === 'dodecahedron')).toBe(true);
    // 2 tris per true quad; a padded triangle's degenerate half is now dropped (GLB hygiene).
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const padded = payload.faces.filter((f) => same(f.corners[2], f.corners[3])).length;
    expect(out.triangleCount).toBe((payload.faces.length - padded) * 2 + padded);
  });
});
