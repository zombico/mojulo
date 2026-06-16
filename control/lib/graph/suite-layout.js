/**
 * suite-layout — the building-scale planner for connected CSS-3D interiors.
 *
 * Given a linear chain of volumes (rooms + connector hallways) with per-volume
 * size, ceiling height, furniture, and lighting, it lays them out along one axis
 * (centred on a shared corridor line), derives the doorway openings where a room
 * meets a hall, and carries each volume's vexar light + tint + baked lamps. The
 * output feeds scene-css3d's buildRoomShellFaces (shells with omitted walls +
 * doorways) and extractRoomSceneFaces (furniture, shell off) into one emit.
 *
 * This is the mandala-position rule lifted to the SUITE level: instead of placing
 * stickers on one surface's (u,v) budget, it places whole volumes on a 1-D axis
 * budget and snaps doorways to the shared wall — same "allocate, then lock" shape.
 */

import { makeLight } from './polygonizer/vexar.js';
import { buildRoomShellFaces, extractRoomSceneFaces, emitPreserve3dScene, bakeSceneDiffusion, contactShadowDecals } from './scene-css3d.js';

const FT = 0.3048;

function resolveLamps(vol, xRange, yRange, z1) {
  const xc = (xRange[0] + xRange[1]) / 2, yc = (yRange[0] + yRange[1]) / 2;
  const lamps = Array.isArray(vol.lamps) ? vol.lamps.slice() : [];
  if (vol.ceilingLamp) {
    const cl = vol.ceilingLamp;
    lamps.push({ pos: cl.pos || [xc, yc, z1 * (cl.height ?? 0.92)], color: cl.color || [1, 0.86, 0.62], intensity: cl.intensity ?? 0.9, k: cl.k ?? 0.05 });
  }
  // potlights: a rows×cols grid of recessed ceiling DOWNLIGHTS, inset from the walls.
  // Each is just a baked point-lamp near the ceiling — they DON'T cast shadows or
  // bounce, and they only light THIS volume's faces (scoped per-volume, no relay).
  if (vol.potlights) {
    const p = vol.potlights;
    const rows = p.rows ?? 2, cols = p.cols ?? 2, inset = p.inset ?? 0.24;
    const [x0, x1] = xRange, [y0, y1] = yRange, z = z1 * (p.height ?? 0.97);
    const frac = (i, n) => (n <= 1 ? 0.5 : inset + i * (1 - 2 * inset) / (n - 1));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        lamps.push({ pos: [x0 + frac(c, cols) * (x1 - x0), y0 + frac(r, rows) * (y1 - y0), z], color: p.color || [1, 0.94, 0.82], intensity: p.intensity ?? 1.0, k: p.k ?? 0.1 });
      }
    }
  }
  return lamps;
}

// Resolve a volume's diffusion light SOURCES (the traced/baked ray emitters) to
// world positions. `at:[fx,fy]` is a fraction of the footprint, `height` a fraction
// of the ceiling; `pos` overrides. `ceilingSource` is the single-centre convenience.
function resolveSources(vol, xRange, yRange, z1) {
  const out = [];
  const place = (s) => {
    const at = s.at || [0.5, 0.5];
    const pos = s.pos || [xRange[0] + at[0] * (xRange[1] - xRange[0]), yRange[0] + at[1] * (yRange[1] - yRange[0]), z1 * (s.height ?? 0.965)];
    out.push({ ...s, pos });
  };
  if (vol.ceilingSource) place({ at: [0.5, 0.5], ...vol.ceilingSource });
  if (Array.isArray(vol.sources)) vol.sources.forEach(place);
  return out;
}

/**
 * Lay out a suite. spec: { start, roomWidth, hallWidth, doorFt, ceilingFt,
 * entryOpen, cameraHint, volumes:[{ id, kind:'room'|'hall', width?, depth?,
 * heightFt?, items?, vexar?{direction,ambient,diffuse}, tint?, lamps?, ceilingLamp? }] }.
 * Volumes are stacked along +y, centred on x = roomWidth/2; a hall's end walls are
 * opened and the adjoining room walls get a doorway snapped to the shared opening.
 */
export function planSuite(spec = {}) {
  const { volumes = [], start = 0, roomWidth = 5, hallWidth = 1.6, doorFt = 7, ceilingFt = 12, entryOpen = true, cameraHint = null } = spec;
  const centerX = roomWidth / 2;
  let cursor = start;
  const placed = volumes.map((v) => {
    const isHall = v.kind === 'hall';
    const width = v.width ?? (isHall ? hallWidth : roomWidth);
    const depth = v.depth ?? (isHall ? 3 : roomWidth);
    const z1 = (v.heightFt ?? ceilingFt) * FT;
    const xRange = [centerX - width / 2, centerX + width / 2];
    const yRange = [cursor, cursor + depth];
    cursor += depth;
    return { ...v, isHall, width, depth, xRange, yRange, zRange: [0, z1] };
  });

  // doorways / open ends between consecutive volumes
  const omit = placed.map(() => []);
  const doors = placed.map(() => []);
  const doorOn = (vol, wall, idx) => {
    const A = placed[idx];
    const [x0, x1] = vol.xRange;
    doors[idx].push({ wall, u0: (A._ox0 - x0) / (x1 - x0), u1: (A._ox1 - x0) / (x1 - x0), v0: 0, v1: Math.min(1, (doorFt * FT) / vol.zRange[1]) });
  };
  for (let i = 0; i < placed.length - 1; i += 1) {
    const A = placed[i], B = placed[i + 1];
    const ox0 = Math.max(A.xRange[0], B.xRange[0]), ox1 = Math.min(A.xRange[1], B.xRange[1]);
    A._ox0 = B._ox0 = ox0; A._ox1 = B._ox1 = ox1;
    if (A.isHall) omit[i].push('yMax'); else doorOn(A, 'yMax', i);
    if (B.isHall) omit[i + 1].push('yMin'); else doorOn(B, 'yMin', i + 1);
  }
  if (entryOpen && placed.length) omit[0].push('yMin');

  const resolved = placed.map((v, i) => {
    const xc = (v.xRange[0] + v.xRange[1]) / 2, yc = (v.yRange[0] + v.yRange[1]) / 2;
    const lamps = resolveLamps(v, v.xRange, v.yRange, v.zRange[1]);
    const sources = resolveSources(v, v.xRange, v.yRange, v.zRange[1]);
    const light = v.light || makeLight(v.vexar || {});
    const tint = v.tint || [1, 1, 1];
    const roomBasis = { worldExtent: { width: v.width, depth: v.depth, height: v.zRange[1] }, xRange: v.xRange, yRange: v.yRange, zRange: v.zRange, cameraHint: cameraHint || [xc, yc, 1.55] };
    return {
      id: v.id, kind: v.kind, xRange: v.xRange, yRange: v.yRange, zRange: v.zRange,
      light, lamps, tint, sources, items: v.items || [], roomBasis,
      shell: { xRange: v.xRange, yRange: v.yRange, zRange: v.zRange, omit: omit[i], doorways: doors[i], light, lamps, tint },
    };
  });
  return {
    volumes: resolved,
    sources: resolved.flatMap((v) => v.sources),          // suite-wide source list for the 3D diffusion bake
    diffusion: spec.diffusion || null,                    // { gain?, reflectivity? } — enables the traced light pass
    bounds: { xRange: [Math.min(...placed.map((p) => p.xRange[0])), Math.max(...placed.map((p) => p.xRange[1]))], yRange: [start, cursor], zRange: [0, Math.max(...placed.map((p) => p.zRange[1]))] },
  };
}

/**
 * Resolve a suite plan into the full face list (shells + furniture, per volume).
 * When the plan declares light `sources`, the suite-wide 3D ray diffusion is baked
 * over ALL faces at once (so light is occluded by walls, bounces, and spills
 * through doorways between volumes), then each visible source's emissive ceiling
 * fixture is added.
 */
export function buildSuiteFaces(plan) {
  let faces = [];
  const footprints = [];
  for (const v of plan.volumes) {
    faces.push(...buildRoomShellFaces(v.shell));
    if (v.items.length) {
      // deferDiffusion: furniture is baked once, suite-wide, below (cross-room spill)
      const r = extractRoomSceneFaces({ elements: v.items, roomBasis: v.roomBasis, light: v.light, lamps: v.lamps, tint: v.tint, includeShell: false, deferDiffusion: true });
      faces.push(...r.faces);
      footprints.push(...r.contactFootprints);
    }
  }
  const diff = plan.diffusion || {};
  if ((plan.sources || []).length) faces = bakeSceneDiffusion(faces, plan.sources, diff);
  if (diff.contact ?? diff.shadows ?? false) faces.push(...contactShadowDecals(footprints, { strength: diff.contactStrength ?? 0.5 }));
  return faces;
}

/** Plan + build + emit a connected suite as one self-contained preserve-3d page. */
export function renderSuiteToHtml(spec, { cameras = [], viewBox = { width: 1200, height: 760 }, unitScale = 36, title = 'mojulo suite' } = {}) {
  const faces = buildSuiteFaces(planSuite(spec));
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title });
}
