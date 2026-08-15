// Authored outward normals for GLB export (export-normals.plan.md) — the mirror-normal bake fix.
//
// The decisive claim: a mojulo lathe (the bulk of suit geometry) carries a TRUE outward normal
// from construction (away from its axis), that normal survives the assembler's mirror (A = R·F),
// and it is written as the GLB NORMAL attribute — so a Blender GI bake never guesses "outward"
// from winding. The failure this catches: a mirror-built part whose corners flip but whose normal
// does not → half the suit bakes black. These tests exercise §1 (born), §2 (mirror), §3 (emit)
// without needing Blender, plus the char-safety guard (no authored normal ⇒ no NORMAL accessor).

import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';

// A short cylinder lathe on the +Z axis through the origin (radius 0.5, sparse for speed).
const CYL = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 2 },
  profile: [{ t: 0, radius: 0.5 }, { t: 1, radius: 0.5 }],
  crossSections: 3,
  samples: 12,
  tint: '#c0c0c0',
};

// ── GLB parse harness (same shape as scene-gltf.rig.test.js) ──────────────────
function parseGlb(buf) {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binOff = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binOff);
  const bin = buf.slice(binOff + 8, binOff + 8 + binLen);
  return { json, bin };
}
function accessorData(json, bin, idx) {
  const acc = json.accessors[idx];
  const view = json.bufferViews[acc.bufferView];
  const Ctor = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[acc.componentType];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const byteLen = acc.count * comps * Ctor.BYTES_PER_ELEMENT;
  const copy = new Uint8Array(byteLen);
  copy.set(bin.slice(start, start + byteLen));
  return new Ctor(copy.buffer);
}
// Every primitive that declares a NORMAL, as { position, normal } vertex-aligned arrays.
function primsWithNormals(glb) {
  const out = [];
  for (const mesh of glb.json.meshes || []) {
    for (const p of mesh.primitives || []) {
      if (p.attributes.NORMAL == null) continue;
      out.push({
        position: accessorData(glb.json, glb.bin, p.attributes.POSITION),
        normal: accessorData(glb.json, glb.bin, p.attributes.NORMAL),
      });
    }
  }
  return out;
}
function anyNormalAttr(glb) {
  return (glb.json.meshes || []).some((m) => (m.primitives || []).some((p) => p.attributes.NORMAL != null));
}

// Fraction of WALL vertices (those whose NORMAL is radial about the Z axis — i.e. not a cap,
// whose normal is axial) whose normal points OUTWARD (positive radial dot with the position).
// Gating on the normal's radiality — not the position's — cleanly excludes cap rings, which sit
// at real radius but carry an axial normal.
function outwardShare(prims) {
  let wall = 0;
  let outward = 0;
  for (const { position, normal } of prims) {
    for (let i = 0; i < position.length; i += 3) {
      const nx = normal[i], ny = normal[i + 1];
      const nrad = Math.hypot(nx, ny);
      if (nrad < 0.5) continue;                          // axial (cap) normal — not a wall
      const px = position[i], py = position[i + 1];
      const prad = Math.hypot(px, py);
      if (prad < 1e-3) continue;                         // degenerate (on-axis) vertex
      wall += 1;
      if ((nx * px + ny * py) / (nrad * prad) > 0) outward += 1;
    }
  }
  return wall ? outward / wall : 0;
}

describe('§1 — the lathe generator authors a true outward normal', () => {
  it('every wall/cap face carries a unit normal pointing away from the axis', () => {
    const faces = latheToFaces(CYL, { caps: true });
    expect(faces.length).toBeGreaterThan(0);
    let checked = 0;
    for (const f of faces) {
      expect(Array.isArray(f.outNormal)).toBe(true);
      const [nx, ny, nz] = f.outNormal;
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);  // unit
      // WALL faces (radial normal, |nz| small) must point radially outward from the axis.
      const cx = f.corners.reduce((s, c) => s + c[0], 0) / f.corners.length;
      const cy = f.corners.reduce((s, c) => s + c[1], 0) / f.corners.length;
      if (Math.hypot(nx, ny) > 0.5) {
        expect((nx * cx + ny * cy)).toBeGreaterThan(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('§2+§3 — the normal survives the mirror and is written to the GLB', () => {
  it('a PLAIN lathe exports outward normals (baseline: §1+§3)', () => {
    const faces = lowerAssemblerFaces({ items: [{ source: { lathes: [CYL] } }] });
    const glb = parseGlb(facesToGlb({ faces }).bytes);
    const prims = primsWithNormals(glb);
    expect(prims.length).toBeGreaterThan(0);
    // NORMAL count matches POSITION count on every primitive
    for (const { position, normal } of prims) expect(normal.length).toBe(position.length);
    expect(outwardShare(prims)).toBeGreaterThan(0.99);
  });

  it('a MIRRORED lathe (flip:x) ALSO exports outward normals — the mirror-normal fix', () => {
    // Without §2 (transforming the authored normal by A=R·F), the flipped part keeps its
    // un-reflected normal while its corners reflect → normals point INWARD on the mirrored
    // side and this share collapses. That is exactly the black-bake failure.
    const faces = lowerAssemblerFaces({ items: [{ source: { lathes: [CYL] }, flip: 'x' }] });
    const glb = parseGlb(facesToGlb({ faces }).bytes);
    const prims = primsWithNormals(glb);
    expect(prims.length).toBeGreaterThan(0);
    expect(outwardShare(prims)).toBeGreaterThan(0.99);
  });
});

// P2: the extrude generator (263 of the mk2's monomers — chest/arm panels) authors outward
// normals too. A rectangular prism on the Z axis has radial side-wall normals, so the same
// outward-share test isolates the mirror fix on flat panels.
const BOX = {
  profile: { rect: { w: 2, h: 1.4 } },
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 3 },
  tint: '#b7b7c0',
};

describe('P2 §extrude — flat panels author + carry outward normals through the mirror', () => {
  it('a PLAIN extrude prism exports outward side-wall normals', () => {
    const faces = lowerAssemblerFaces({ items: [{ source: { extrudes: [BOX] } }] });
    const glb = parseGlb(facesToGlb({ faces }).bytes);
    const prims = primsWithNormals(glb);
    expect(prims.length).toBeGreaterThan(0);
    expect(outwardShare(prims)).toBeGreaterThan(0.99);
  });

  it('a MIRRORED extrude prism (flip:x) ALSO exports outward normals — the panel bake fix', () => {
    const faces = lowerAssemblerFaces({ items: [{ source: { extrudes: [BOX] }, flip: 'x' }] });
    const glb = parseGlb(facesToGlb({ faces }).bytes);
    const prims = primsWithNormals(glb);
    expect(prims.length).toBeGreaterThan(0);
    expect(outwardShare(prims)).toBeGreaterThan(0.99);
  });
});

describe('char-safety — no authored normal ⇒ no NORMAL attribute', () => {
  it('a plain quad with no .normal produces a GLB with zero NORMAL accessors', () => {
    const quad = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#808080', doubleSided: true };
    const glb = parseGlb(facesToGlb({ faces: [quad] }).bytes);
    expect(anyNormalAttr(glb)).toBe(false);
  });
});
