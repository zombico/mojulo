/**
 * skin-atlas (skin-over-mesh.plan.md phase 2): the deterministic half of the
 * wrap loop — cuts, registration, audit — proven on synthetic views (a solid
 * red "painting" from the front, blue from the back) over a unit box body, so
 * the reprojection logic is pinned without any worker in the loop.
 */
import { describe, expect, it } from 'vitest';

import {
  atlasFaces,
  atlasLayout,
  auditAtlasCoverage,
  auditSeamContinuity,
  paintAtlas,
  projectorFromCamera,
  remapFacesToAtlas,
  viewDepthBuffer,
} from './skin-atlas.js';
import { figureRigSamples } from './figure-render.js';

const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

// A 2×2 vertical quad facing -y (front) at y=0, and its back twin facing +y at y=1,
// each its own island — the minimal two-sided "body".
const FRONT = { corners: [[-1, 0, 0], [1, 0, 0], [1, 0, 2], [-1, 0, 2]], fill: '#888888', texture: 't', uv: UV, island: 'front' };
const BACK = { corners: [[1, 1, 0], [-1, 1, 0], [-1, 1, 2], [1, 1, 2]], fill: '#888888', texture: 't', uv: UV, island: 'back' };
const BODY = [FRONT, BACK];

const flat = (rgb) => [rgb[0], rgb[1], rgb[2]];
const solidRaster = ([r, g, b], w = 64, h = 64) => {
  const data = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { data[i * 3] = r; data[i * 3 + 1] = g; data[i * 3 + 2] = b; }
  return { data, width: w, height: h, channels: 3 };
};

const frontView = () => ({
  projector: projectorFromCamera({ pos: [0, -6, 1], target: [0, 0, 1], vfov: 45, width: 96, height: 96 }),
  raster: solidRaster([200, 30, 30]),
});
const backView = () => ({
  projector: projectorFromCamera({ pos: [0, 7, 1], target: [0, 0, 1], vfov: 45, width: 96, height: 96 }),
  raster: solidRaster([30, 30, 200]),
});

describe('atlasLayout — the deterministic cuts', () => {
  it('packs islands in build order into a square grid with gutters', () => {
    const layout = atlasLayout(BODY, { page: 512, gutter: 8 });
    expect(Object.keys(layout.islands)).toEqual(['front', 'back']);
    expect(layout.cols).toBe(2);
    const a = layout.islands.front, b = layout.islands.back;
    expect(a.x).toBeCloseTo(8 / 512);
    expect(b.x).toBeGreaterThan(a.x + a.w);            // disjoint rects — the gutter holds
    expect(a.w).toBeCloseTo(0.5 - 2 * (8 / 512));
  });

  it('is a pure function of the face list (same input → same layout)', () => {
    expect(atlasLayout(BODY)).toEqual(atlasLayout(BODY.map((f) => ({ ...f }))));
  });

  it('a real figure yields one island per flesh stack, all disjoint', () => {
    const { restFaces } = figureRigSamples({ skin: { texture: 't' } });
    const layout = atlasLayout(restFaces);
    const rects = Object.values(layout.islands);
    expect(rects.length).toBeGreaterThan(4);           // torso + limbs at least
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('throws a teaching error when no face opted into a skin', () => {
    expect(() => atlasLayout([{ corners: FRONT.corners, fill: '#888888' }])).toThrow(/phase-1 skin\/wrap/);
  });
});

describe('remapFacesToAtlas — binding through the existing texture channel', () => {
  it('offsets each island uv into its rect and points at the atlas key', () => {
    const layout = atlasLayout(BODY, { page: 512, gutter: 0 });
    const remapped = remapFacesToAtlas(BODY, layout, { texture: 'skin-atlas' });
    const front = remapped[0];
    expect(front.texture).toBe('skin-atlas');
    expect(front.uv[0]).toEqual([0, 0]);
    expect(front.uv[2][0]).toBeCloseTo(0.5);           // island spans its half page
    expect('island' in front).toBe(false);
    expect('textureLit' in front).toBe(false);         // painted page carries its own light
  });

  it('passes non-participating faces through untouched', () => {
    const plain = { corners: FRONT.corners, fill: '#123456' };
    const layout = atlasLayout(BODY);
    expect(remapFacesToAtlas([plain, ...BODY], layout)[0]).toBe(plain);
  });
});

describe('projector + depth buffer', () => {
  it('projects a point ahead of the camera into the frame, and rejects behind', () => {
    const p = projectorFromCamera({ pos: [0, -6, 1], target: [0, 0, 1], vfov: 45, width: 96, height: 96 });
    const hit = p.project([0, 0, 1]);
    expect(hit[0]).toBeCloseTo(48);
    expect(hit[1]).toBeCloseTo(48);
    expect(hit[2]).toBeCloseTo(6);
    expect(p.project([0, -12, 1])).toBeNull();
  });

  it('the depth buffer keeps the NEAR face where two overlap', () => {
    const p = projectorFromCamera({ pos: [0, -6, 1], target: [0, 0, 1], vfov: 45, width: 96, height: 96 });
    const zbuf = viewDepthBuffer(BODY, p);
    const i = 48 * 96 + 48;                            // frame center: front at y=0 (z=6), back at y=1 (z=7)
    expect(zbuf[i]).toBeCloseTo(6, 1);
  });
});

describe('paintAtlas + auditAtlasCoverage — the reprojection and the gate', () => {
  it('front view paints the front island red; the occluded back island stays a hole', () => {
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const painted = paintAtlas(BODY, layout, [frontView()], { size: 64 });
    const audit = auditAtlasCoverage(BODY, layout, painted);
    expect(audit.islands.front.coverage).toBeGreaterThan(0.95);
    expect(audit.islands.back.coverage).toBe(0);       // facing away AND occluded
    expect(audit.holes).toEqual(['back']);
    // the painted texels are the front view's red
    const r = layout.islands.front;
    const ti = ((Math.floor((r.y + r.h / 2) * 64)) * 64 + Math.floor((r.x + r.w / 2) * 64)) * 3;
    expect(flat(painted.rgb.subarray(ti, ti + 3))).toEqual([200, 30, 30]);
  });

  it('adding the back view closes the hole — loop-until-dry converges', () => {
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const painted = paintAtlas(BODY, layout, [frontView(), backView()], { size: 64 });
    const audit = auditAtlasCoverage(BODY, layout, painted);
    expect(audit.coverage).toBeGreaterThan(0.95);
    expect(audit.holes).toEqual([]);
    // back island carries the BACK view's blue — no front-colour wraparound
    const r = layout.islands.back;
    const ti = ((Math.floor((r.y + r.h / 2) * 64)) * 64 + Math.floor((r.x + r.w / 2) * 64)) * 3;
    expect(flat(painted.rgb.subarray(ti, ti + 3))).toEqual([30, 30, 200]);
  });

  it('an occluder OUTSIDE the skinned body masks it (scene-aware depth)', () => {
    // a big wall between camera and body: nothing paints, everything is a hole
    const wall = { corners: [[-4, -3, -1], [4, -3, -1], [4, -3, 4], [-4, -3, 4]], fill: '#222222' };
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const painted = paintAtlas(BODY, layout, [frontView()], { size: 64, occluders: [wall, ...BODY] });
    const audit = auditAtlasCoverage(BODY, layout, painted);
    expect(audit.coverage).toBe(0);
    expect(audit.holes.sort()).toEqual(['back', 'front']);
  });

  it('is deterministic — same inputs, byte-identical page', () => {
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const a = paintAtlas(BODY, layout, [frontView(), backView()], { size: 64 });
    const b = paintAtlas(BODY, layout, [frontView(), backView()], { size: 64 });
    expect(Buffer.compare(a.rgb, b.rgb)).toBe(0);
  });

  it('atlasFaces filters to the participating set', () => {
    expect(atlasFaces([FRONT, { corners: FRONT.corners, fill: '#888888' }]).length).toBe(1);
  });
});

describe('auditSeamContinuity — the advisory seam gate', () => {
  it('a single-view paint agrees with itself across the seam (delta ≈ 0)', () => {
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const painted = paintAtlas(BODY, layout, [frontView(), backView()], { size: 64 });
    const seams = auditSeamContinuity(BODY, layout, painted);
    expect(seams.overall).toBeLessThan(1);            // solid-colour views: seam invisible
    expect(seams.flagged).toEqual([]);
  });

  it('a disagreeing seam is flagged — and only advisory', () => {
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const painted = paintAtlas(BODY, layout, [frontView(), backView()], { size: 64 });
    // vandalize the front island's left seam column: paint it opposite
    const r = layout.islands.front;
    const x0 = Math.floor(r.x * 64);
    for (let ty = Math.floor(r.y * 64); ty < Math.ceil((r.y + r.h) * 64); ty++) {
      const i = (ty * 64 + x0) * 3;
      painted.rgb[i] = 0; painted.rgb[i + 1] = 255; painted.rgb[i + 2] = 0;
    }
    const seams = auditSeamContinuity(BODY, layout, painted);
    expect(seams.flagged).toEqual(['front']);
    expect(seams.islands.front.seamDelta).toBeGreaterThan(seams.threshold);
    expect(seams.islands.back.flagged).toBe(false);
  });

  it('unpainted islands report zero rows, never flag', () => {
    const layout = atlasLayout(BODY, { page: 64, gutter: 0 });
    const painted = paintAtlas(BODY, layout, [frontView()], { size: 64 });   // back is a hole
    const seams = auditSeamContinuity(BODY, layout, painted);
    expect(seams.islands.back.rows).toBe(0);
    expect(seams.islands.back.flagged).toBe(false);
  });
});
