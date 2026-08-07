/**
 * floorplan-building-assets — the real ITEMS that fill the building floor's massing
 * boxes, authored with the workbench assembler (monomer primitives: lathe / extrude /
 * sweep) and sized parametrically to a target box { x, y, z, w, d, h } in FEET (the
 * building world's unit, z up).
 *
 * Each builder returns a workbench MANIFEST FRAGMENT ({ lathes?, extrudes?, sweeps? })
 * already in world coordinates, so fragments compose by concatenation. `assetFaces`
 * bakes a fragment to the shared { corners, fill, doubleSided } face list (via
 * workbench.js's lowerObjectFaces) ready to merge into a floor scene — the same bridge
 * room-assets.js uses for couches/chairs.
 *
 * Built one item at a time, verified in the workbench studio (floorplan-building-assets
 * .spike.gen.test.js) before being wired into the fit-out in floorplan-building.js.
 *
 * Plan: floorplan-building.plan.md (§ items / workbench fit-out).
 */

import { workbenchAssetFaces } from '../worlds/workbench.js';
import { buildLeg, buildSlab } from '../architecture/room-parts.js';
import { shadeHex } from './vexar.js';

// ── composition helpers ───────────────────────────────────────────────────────
/** Concatenate workbench manifest fragments into one { lathes, extrudes, sweeps }. */
export function mergeManifests(...frags) {
  const out = { lathes: [], extrudes: [], sweeps: [] };
  for (const f of frags) {
    if (!f) continue;
    if (f.lathes) out.lathes.push(...f.lathes);
    if (f.extrudes) out.extrudes.push(...f.extrudes);
    if (f.sweeps) out.sweeps.push(...f.sweeps);
  }
  return out;
}

/** Bake a fragment (or merged fragments) to world faces, lit by the host scene's key. */
export function assetFaces(frag, { light, translate, scale } = {}) {
  return workbenchAssetFaces(frag, { light, translate, scale });
}

/** A closed circular sweep path (footrails, rings) in the z=cz plane. */
function ringPath(cx, cy, cz, r, seg = 24) {
  const p = [];
  for (let i = 0; i <= seg; i += 1) { const a = (i / seg) * Math.PI * 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz]); }
  return p;
}

const TINTS = {
  wood: '#8a6a44', woodDark: '#6f5234', seat: '#4a3f30', metal: '#33302a', steel: '#2b2824',
  body: '#5a4a38', topWood: '#6f5740', shelf: '#7c5e3c', kick: '#1d1a16',
  bottleA: '#3a5a3a', bottleB: '#5a3a3a', bottleC: '#39456a', bottleD: '#6a5a2a',
};

// Stone finishes — the LOBBY register (a concierge floor reads as STONE, not wood):
// a pale polished marble for tops/slabs, a darker veined marble for plinths/bases.
export const MARBLE = {
  light: '#d9d6cf',   // pale polished marble (transaction tops, bench slabs)
  warm: '#e2ddd1',    // warm cream marble (variation)
  dark: '#3b3e45',    // dark veined marble (plinths, bases)
  green: '#3c4f48',   // verde marble accent (planters)
};

// ── CAFÉ ITEMS ────────────────────────────────────────────────────────────────
/** A round bistro table: a pedestal column on a weighted disc base under a round top. */
export function buildCafeTable({ x = 0, y = 0, z = 0, w = 2.6, d = 2.6, h = 2.4, top = TINTS.wood, metal = TINTS.metal } = {}) {
  const R = Math.min(w, d) / 2 * 0.94;
  const topThk = 0.12, baseH = 0.16;
  return {
    lathes: [
      { axisFrom: { x, y, z: z + h - topThk }, axisTo: { x, y, z: z + h }, profile: [{ t: 0, radius: R }, { t: 1, radius: R }], samples: 28, crossSections: 2, tint: top },                  // round top
      { axisFrom: { x, y, z: z + baseH }, axisTo: { x, y, z: z + h - topThk }, profile: [{ t: 0, radius: 0.14 }, { t: 1, radius: 0.1 }], samples: 12, crossSections: 2, tint: metal },        // pedestal
      { axisFrom: { x, y, z }, axisTo: { x, y, z: z + baseH }, profile: [{ t: 0, radius: R * 0.55 }, { t: 0.5, radius: R * 0.5 }, { t: 1, radius: 0.18 }], samples: 18, crossSections: 3, tint: metal }, // base disc
    ],
  };
}

/** A bentwood café chair: four turned legs, a rounded seat, a back rail. `back` is the
 *  side the backrest sits on ('-y'|'+y'|'-x'|'+x'), so a chair faces a table from any side. */
export function buildCafeChair({ x = 0, y = 0, z = 0, w = 1.5, d = 1.5, h = 2.9, wood = TINTS.woodDark, seatH = 1.5, back = '-y' } = {}) {
  const sx = w / 2 - 0.14, sy = d / 2 - 0.14, legR = 0.06;
  const leg = (lx, ly) => buildLeg({ foot: [x + lx, y + ly, z], top: [x + lx, y + ly, z + seatH], footRadius: legR * 0.85, topRadius: legR, tint: wood });
  const ext = [buildSlab({ x, y, z0: z + seatH, z1: z + seatH + 0.12, w: w - 0.08, d: d - 0.08, r: 0.1, tint: wood })];   // seat
  if (back === '+y' || back === '-y') {
    const by = back === '+y' ? y + d / 2 - 0.12 : y - d / 2 + 0.12;
    ext.push(buildSlab({ x, y: by, z0: z + seatH + 0.12, z1: z + h, w: w - 0.2, d: 0.1, r: 0.05, tint: wood }));
  } else {
    const bx = back === '+x' ? x + w / 2 - 0.12 : x - w / 2 + 0.12;
    ext.push(buildSlab({ x: bx, y, z0: z + seatH + 0.12, z1: z + h, w: 0.1, d: d - 0.2, r: 0.05, tint: wood }));
  }
  return { lathes: [leg(-sx, -sy), leg(sx, -sy), leg(-sx, sy), leg(sx, sy)], extrudes: ext };
}

/** A FIXED WALL BANQUETTE: an upholstered bench (base + seat cushion) with a tall back
 *  cushion against the wall. `along` is the run axis ('x'|'y'); `wallSide` is the side the
 *  back sits against ('+y'|'-y'|'+x'|'-x'), so it lines any wall — typically under windows. */
export function buildBanquette({ x = 0, y = 0, z = 0, w = 8, d = 1.9, h = 3.3, along = 'x', wallSide = '+y', seatH = 1.5, base = '#5a4636', cushion = '#7d4a40', backTint = '#864f44' } = {}) {
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w;          // world x-extent, y-extent
  const ext = [
    buildSlab({ x, y, z0: z, z1: z + seatH, w: W, d: D, r: 0.05, tint: base }),                       // bench base
    buildSlab({ x, y, z0: z + seatH, z1: z + seatH + 0.26, w: W - 0.1, d: D - 0.1, r: 0.12, tint: cushion }), // seat cushion
  ];
  const bt = 0.42;                                      // back cushion thickness
  if (wallSide === '+y') ext.push(buildSlab({ x, y: y + D / 2 - bt / 2, z0: z + seatH, z1: z + h, w: W, d: bt, r: 0.1, tint: backTint }));
  else if (wallSide === '-y') ext.push(buildSlab({ x, y: y - D / 2 + bt / 2, z0: z + seatH, z1: z + h, w: W, d: bt, r: 0.1, tint: backTint }));
  else if (wallSide === '+x') ext.push(buildSlab({ x: x + W / 2 - bt / 2, y, z0: z + seatH, z1: z + h, w: bt, d: D, r: 0.1, tint: backTint }));
  else ext.push(buildSlab({ x: x - W / 2 + bt / 2, y, z0: z + seatH, z1: z + h, w: bt, d: D, r: 0.1, tint: backTint }));
  return { extrudes: ext };
}

/** A bar stool: round seat on four splayed metal legs with a footrest ring. */
export function buildBarStool({ x = 0, y = 0, z = 0, w = 1.3, d = 1.3, h = 2.5, seat = TINTS.seat, metal = TINTS.steel } = {}) {
  const R = Math.min(w, d) / 2 * 0.82, legR = 0.05, splay = R * 0.95, seatH = h;
  const leg = (ax, ay) => buildLeg({ foot: [x + ax * splay, y + ay * splay, z], top: [x + ax * 0.18, y + ay * 0.18, z + seatH - 0.1], footRadius: legR * 0.8, topRadius: legR, tint: metal });
  return {
    lathes: [
      leg(-1, -1), leg(1, -1), leg(-1, 1), leg(1, 1),
      { axisFrom: { x, y, z: z + seatH - 0.13 }, axisTo: { x, y, z: z + seatH }, profile: [{ t: 0, radius: R * 0.9 }, { t: 0.6, radius: R }, { t: 1, radius: R }], samples: 18, crossSections: 3, tint: seat },
    ],
    sweeps: [{ path: ringPath(x, y, z + 0.85, R * 0.98), radius: 0.035, tint: metal, caps: false }],
  };
}

/** A bar/order counter (the "die"): a millwork cabinet with a recessed toe kick and an
 *  overhanging countertop. `along` is the world axis the LENGTH (`w`) runs on ('x' or 'y'),
 *  so the same builder serves a back-wall bar and a side-wall order counter. `rail` adds a
 *  brass footrail on the public face (a bar, not an order counter). */
export function buildBarCounter({ x = 0, y = 0, z = 0, w = 10, d = 1.8, h = 3.7, along = 'x', rail = true, body = TINTS.body, top = TINTS.topWood, metal = '#7a6a40' } = {}) {
  const topThk = 0.14, kickH = 0.3;
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w;          // world x-extent, y-extent
  const extrudes = [
    buildSlab({ x, y, z0: z + kickH, z1: z + h - topThk, w: W, d: D, r: 0.04, tint: body }),               // cabinet body
    buildSlab({ x, y, z0: z, z1: z + kickH, w: W - 0.25, d: D - 0.25, tint: TINTS.kick }),                  // recessed toe kick
    buildSlab({ x, y, z0: z + h - topThk, z1: z + h, w: W + 0.3, d: D + 0.3, r: 0.05, tint: top }),         // countertop overhang
  ];
  const sweeps = [];
  if (rail) {
    const z0 = z + 0.55;
    sweeps.push(horiz
      ? { path: [[x - W / 2 + 0.3, y - D / 2 - 0.25, z0], [x + W / 2 - 0.3, y - D / 2 - 0.25, z0]], radius: 0.045, tint: metal, caps: true }
      : { path: [[x - W / 2 - 0.25, y - D / 2 + 0.3, z0], [x - W / 2 - 0.25, y + D / 2 - 0.3, z0]], radius: 0.045, tint: metal, caps: true });
  }
  return { extrudes, sweeps };
}

/** A back bar: an OPEN display case (back panel + sides + top against the wall, open to
 *  the room on −y) with cantilevered shelves and a deterministic row of bottles. The box's
 *  +y edge backs the wall; the −y face is open so the bottles read from the floor. */
export function buildBackBar({ x = 0, y = 0, z = 0, w = 10, d = 1.2, h = 5, carcass = TINTS.topWood, shelf = TINTS.shelf } = {}) {
  const yBack = y + d / 2, panel = 0.2;
  const extrudes = [
    buildSlab({ x, y: yBack - panel / 2, z0: z, z1: z + h, w, d: panel, tint: carcass }),                 // back panel (against wall)
    buildSlab({ x: x - w / 2 + 0.1, y, z0: z, z1: z + h, w: 0.2, d, tint: carcass }),                      // left side
    buildSlab({ x: x + w / 2 - 0.1, y, z0: z, z1: z + h, w: 0.2, d, tint: carcass }),                      // right side
    buildSlab({ x, y, z0: z + h - 0.16, z1: z + h, w, d, tint: carcass }),                                 // top cap
  ];
  const lathes = [];
  const shelves = [z + 1.4, z + 2.7, z + 4.0];
  const bt = [TINTS.bottleA, TINTS.bottleB, TINTS.bottleC, TINTS.bottleD];
  const sy = y - 0.06;                                                                                     // shelf/bottle line toward the open front
  for (let si = 0; si < shelves.length; si += 1) {
    const sz = shelves[si];
    extrudes.push(buildSlab({ x, y: sy, z0: sz, z1: sz + 0.08, w: w - 0.3, d: d - 0.25, tint: shelf }));   // shelf board
    for (let bx = x - w / 2 + 0.7; bx < x + w / 2 - 0.5; bx += 0.95) {                                     // bottles
      const bh = 0.55 + Math.abs(Math.sin(bx * 3.1 + si)) * 0.55;
      lathes.push({
        axisFrom: { x: bx, y: sy, z: sz + 0.08 }, axisTo: { x: bx, y: sy, z: sz + 0.08 + bh },
        profile: [{ t: 0, radius: 0.085 }, { t: 0.68, radius: 0.085 }, { t: 0.8, radius: 0.04 }, { t: 1, radius: 0.04 }],
        samples: 8, crossSections: 3, tint: bt[Math.floor(Math.abs(bx * 2 + si)) % bt.length],
      });
    }
  }
  return { extrudes, lathes };
}

// ── lighting + soft furnishings + washroom fixtures ───────────────────────────
/** A ceiling PENDANT light: a cord dropping from the ceiling to a shade with a warm bulb.
 *  Hangs below a `shell:ceiling` plane so the cutaway fade reveals it from above. */
export function buildPendantLight({ x = 0, y = 0, ceilingZ = 12, drop = 3.6, shadeR = 0.75, cord = '#241f1b', shade = '#322d28', bulb = '#ffe6a8' } = {}) {
  const shadeTop = ceilingZ - drop, shadeBot = shadeTop - 0.55;
  return {
    sweeps: [{ path: [[x, y, ceilingZ], [x, y, shadeTop + 0.55]], radius: 0.035, tint: cord, caps: true }],
    lathes: [
      { axisFrom: { x, y, z: shadeBot }, axisTo: { x, y, z: shadeTop + 0.55 }, profile: [{ t: 0, radius: shadeR }, { t: 0.78, radius: shadeR * 0.42 }, { t: 1, radius: 0.09 }], samples: 20, crossSections: 3, tint: shade },
      { axisFrom: { x, y, z: shadeBot - 0.28 }, axisTo: { x, y, z: shadeBot + 0.12 }, profile: [{ t: 0, radius: 0.12 }, { t: 0.5, radius: 0.19 }, { t: 1, radius: 0.12 }], samples: 12, crossSections: 4, tint: bulb },
    ],
  };
}

/**
 * A draped window CURTAIN — the svgile-row garment move applied to a WALL-as-figure.
 *
 * svgile-row (figure-garments.js) tailors cloth onto a body ROW BY ROW: each horizontal
 * band is a measured cross-section, offset off the form, and consecutive rows are lofted
 * into a ruled cloth surface — gathered at the heading, relaxed toward the hem. A flat
 * wall is just the degenerate figure: each row is a straight span along the wall tangent,
 * and the cloth is offset off the wall plane by a fold field `faceSign·(sin across × amp)`
 * whose amplitude GATHERS at the top (the curtain heading) and RELAXES toward the hem.
 * Lofting the rows gives continuous folded cloth (not flat slabs), so per-quad normals
 * catch the light on each fold crest.
 *
 * Returns BAKED faces (pre-shaded with `light`) — a free-form surface, not a monomer — so
 * the caller pushes them directly rather than through `assetFaces`.
 *
 * `mode:'tieback'` re-tailors the SAME rows into an open, tied-back drape — two panels
 * gathered to the window's edges, each row an HOURGLASS (full at the heading, pinched at the
 * tie height with deepened folds, flared at the hem), leaving the centre open so the window
 * shows. Same row-loft, different width-per-row — exactly what svgile-row's per-row measure
 * is for.
 *
 * @param a { x, y, span, bottom, top, along:'x'|'y', faceSign:±1 (room side off the wall),
 *           light, tint, folds, foldDepth, rows, gather, mode:'closed'|'tieback' }
 */
function curtainNormal(p, q, r) {
  const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
}
function loftGrid(grid, tint, light) {
  const faces = [];
  for (let j = 0; j < grid.length - 1; j += 1) {
    const M = Math.min(grid[j].length, grid[j + 1].length) - 1;
    for (let i = 0; i < M; i += 1) {
      const p00 = grid[j][i], p10 = grid[j][i + 1], p11 = grid[j + 1][i + 1], p01 = grid[j + 1][i];
      faces.push({ corners: [p00, p10, p11, p01], fill: shadeHex(tint, curtainNormal(p00, p10, p01), light), doubleSided: true });
    }
  }
  return faces;
}

export function buildCurtain({ x = 0, y = 0, span = 5, bottom = 0, top = 9, along = 'x', faceSign = -1, light, tint = '#7a3b3b', folds = 7, foldDepth = 0.36, rows = 10, gather = 0.4, mode = 'closed' } = {}) {
  const horiz = along === 'x';
  const N = Math.max(2, rows), M = Math.max(8, folds * 3);
  const pt = (a, off, z) => (horiz ? [x + a, y + off, z] : [x + off, y + a, z]);

  if (mode === 'tieback') {
    // each panel: an HOURGLASS gathered to the window edge — wide heading, pinched tie
    // (deep folds), flared hem; the open centre lets the window read.
    const tieT = 0.44, topW = span * 0.34, tieW = span * 0.13, hemW = span * 0.42;
    const widthAt = (t) => (t <= tieT ? topW + (tieW - topW) * (t / tieT) : tieW + (hemW - tieW) * ((t - tieT) / (1 - tieT)));
    const ampAt = (t) => foldDepth * (0.55 + 1.0 * Math.exp(-((t - tieT) ** 2) / 0.022));   // folds deepen at the tie
    const panel = (edge, dir) => {
      const grid = [];
      for (let j = 0; j < N; j += 1) {
        const t = j / (N - 1), z = top - t * (top - bottom), w = Math.max(0.3, widthAt(t)), amp = ampAt(t);
        const row = [];
        for (let i = 0; i <= M; i += 1) {
          const u = i / M, a = edge + dir * u * w;
          const wave = Math.sin(u * folds * Math.PI * 2) * 0.5 + 0.5;
          row.push(pt(a, faceSign * (0.03 + amp * wave), z));
        }
        grid.push(row);
      }
      return loftGrid(grid, tint, light);
    };
    return [...panel(-span / 2, +1), ...panel(span / 2, -1)];
  }

  // closed: a full-width drape, gathered at the heading, relaxing toward the hem.
  const ampAt = (t) => foldDepth * (gather + (1 - gather) * (t ** 0.85));
  const spanAt = (t) => span * (1 + 0.05 * t);
  const grid = [];
  for (let j = 0; j < N; j += 1) {
    const t = j / (N - 1), z = top - t * (top - bottom), amp = ampAt(t), ws = spanAt(t);
    const row = [];
    for (let i = 0; i <= M; i += 1) {
      const u = i / M, a = -ws / 2 + u * ws;
      const wave = Math.sin(u * folds * Math.PI * 2) * 0.5 + 0.5;
      row.push(pt(a, faceSign * (0.03 + amp * wave), z));
    }
    grid.push(row);
  }
  return loftGrid(grid, tint, light);
}

/** A framed WALL ART / mirror panel flat against a wall. `along` = wall-tangent axis;
 *  `face` = the direction it looks into the room ('-y'|'+y'|'-x'|'+x'). */
export function buildWallArt({ x = 0, y = 0, z = 5.5, w = 2.6, h = 1.9, along = 'x', face = '-y', frame = '#2f2519', art = '#6b7a8a' } = {}) {
  const horiz = along === 'x';
  const fd = 0.14, proud = 0.05;
  const dir = (face === '-y' || face === '-x') ? -1 : 1;
  const ext = [];
  if (horiz) {
    ext.push(buildSlab({ x, y, z0: z - h / 2, z1: z + h / 2, w, d: fd, r: 0.02, tint: frame }));
    ext.push(buildSlab({ x, y: y + dir * proud, z0: z - h / 2 + 0.2, z1: z + h / 2 - 0.2, w: w - 0.35, d: fd * 0.6, r: 0.01, tint: art }));
  } else {
    ext.push(buildSlab({ x, y, z0: z - h / 2, z1: z + h / 2, w: fd, d: w, r: 0.02, tint: frame }));
    ext.push(buildSlab({ x: x + dir * proud, y, z0: z - h / 2 + 0.2, z1: z + h / 2 - 0.2, w: fd * 0.6, d: w - 0.35, r: 0.01, tint: art }));
  }
  return { extrudes: ext };
}

/** A washroom TOILET: a bowl (lathe) with a cistern box against the `wall` side. */
export function buildToilet({ x = 0, y = 0, z = 0, wall = '+y', tint = '#e7eaec' } = {}) {
  const tankD = 0.5;
  const tank = wall === '+y' ? buildSlab({ x, y: y + 0.65, z0: z, z1: z + 2.5, w: 1.3, d: tankD, r: 0.08, tint })
    : wall === '-y' ? buildSlab({ x, y: y - 0.65, z0: z, z1: z + 2.5, w: 1.3, d: tankD, r: 0.08, tint })
      : wall === '+x' ? buildSlab({ x: x + 0.65, y, z0: z, z1: z + 2.5, w: tankD, d: 1.3, r: 0.08, tint })
        : buildSlab({ x: x - 0.65, y, z0: z, z1: z + 2.5, w: tankD, d: 1.3, r: 0.08, tint });
  return {
    extrudes: [tank],
    lathes: [{ axisFrom: { x, y, z }, axisTo: { x, y, z: z + 1.3 }, profile: [{ t: 0, radius: 0.42 }, { t: 0.45, radius: 0.58 }, { t: 0.85, radius: 0.68 }, { t: 1, radius: 0.6 }], samples: 16, crossSections: 4, tint }],
  };
}

/** A washroom VANITY: a counter cabinet with inset basins. `along` = run axis. */
export function buildVanity({ x = 0, y = 0, z = 0, w = 6, d = 2, h = 2.7, along = 'x', counter = '#6a6f73', basin = '#eef1f3' } = {}) {
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w;
  const ext = [buildSlab({ x, y, z0: z, z1: z + h, w: W, d: D, r: 0.05, tint: counter })];
  const lathes = [];
  const n = Math.max(1, Math.floor(w / 3));
  for (let i = 0; i < n; i += 1) {
    const posA = -w / 2 + (i + 0.5) * (w / n);
    const bx = horiz ? x + posA : x, by = horiz ? y : y + posA;
    lathes.push({ axisFrom: { x: bx, y: by, z: z + h - 0.18 }, axisTo: { x: bx, y: by, z: z + h + 0.04 }, profile: [{ t: 0, radius: 0.42 }, { t: 0.6, radius: 0.52 }, { t: 1, radius: 0.46 }], samples: 14, crossSections: 3, tint: basin });
  }
  return { extrudes: ext, lathes };
}

/** A platform BED: a low frame base, a mattress/duvet slab, a headboard standing at one
 *  end, and two pillows. `along` is the bed's LONG (foot-to-head) axis; `head` (`'+'|'-'`)
 *  is which end of that axis the headboard + pillows sit at. A residential fit-out anchor
 *  (sized in feet), sibling to the lobby sofa/bench. */
export function buildBed({ x = 0, y = 0, z = 0, len = 6.6, wide = 4.7, h = 1.5, along = 'x', head = '+', frame = '#6f6152', duvet = '#8f99a6', pillow = '#eee7db' } = {}) {
  const isx = along === 'x', s = head === '-' ? -1 : 1;
  // put a slab given offsets ALONG the long axis + ACROSS it (centre-relative), sized (la × lc)
  const put = (offA, offC, z0, z1, la, lc, r, tint) => buildSlab({
    x: x + (isx ? offA : offC), y: y + (isx ? offC : offA),
    z0, z1, w: isx ? la : lc, d: isx ? lc : la, r, tint,
  });
  const ext = [
    put(0, 0, z, z + h * 0.42, len, wide, 0.12, frame),                              // platform base
    put(-s * 0.2, 0, z + h * 0.42, z + h * 0.86, len * 0.92, wide * 0.92, 0.22, duvet), // mattress/duvet
    put(s * (len / 2 - 0.15), 0, z, z + h * 1.55, 0.3, wide, 0.05, frame),           // headboard
  ];
  for (const o of [-1, 1]) ext.push(put(s * (len / 2 - 1), o * wide * 0.24, z + h * 0.86, z + h * 1.08, 1.3, wide * 0.4, 0.18, pillow));   // pillows
  return { extrudes: ext };
}

// ── LOBBY items — the concierge floor read: a stone reception desk, lounge seating
// (freestanding sofa + backless marble bench), and tall houseplants. Stone-finished,
// never wood — a lobby is a polished-marble register. Each is sized to its box in feet.
const LOBBY_TINTS = {
  deskBody: '#39414c', deskKick: '#1d2128', sofaBody: '#454b54', sofaCushion: '#6d727b',
  sofaArm: '#3c424b', pot: '#cdbfa6', soil: '#241d15', trunk: '#5a4632', leaf: '#3f5a3c',
};

/** A CONCIERGE / reception DESK: a millwork body on a recessed kick under a polished
 *  MARBLE transaction top, with a raised marble ledge on the public face. `along` is the
 *  run axis; `face` is the side the public approaches from (the ledge faces them, staff
 *  stand on the opposite side). The lobby's anchor piece. */
export function buildConciergeDesk({ x = 0, y = 0, z = 0, w = 11, d = 3, h = 3.2, along = 'x', face = '-y', body = LOBBY_TINTS.deskBody, kick = LOBBY_TINTS.deskKick, top = MARBLE.light, ledge = MARBLE.dark } = {}) {
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w, topThk = 0.16, kickH = 0.3;
  const ext = [
    buildSlab({ x, y, z0: z + kickH, z1: z + h - topThk, w: W, d: D, r: 0.05, tint: body }),          // cabinet body
    buildSlab({ x, y, z0: z, z1: z + kickH, w: W - 0.3, d: D - 0.3, tint: kick }),                     // recessed toe kick
    buildSlab({ x, y, z0: z + h - topThk, z1: z + h, w: W + 0.4, d: D + 0.4, r: 0.06, tint: top }),    // marble work top
  ];
  // raised transaction ledge proud of the public face, a little higher than the work top
  const sgnY = face === '-y' ? -1 : face === '+y' ? 1 : 0;
  const sgnX = face === '-x' ? -1 : face === '+x' ? 1 : 0;
  const lx = x + sgnX * (W / 2 - 0.1), ly = y + sgnY * (D / 2 - 0.1);
  ext.push(buildSlab({
    x: lx, y: ly, z0: z + h, z1: z + h + 0.55,
    w: sgnX ? 0.55 : W + 0.4, d: sgnY ? 0.55 : D + 0.4, r: 0.06, tint: ledge,
  }));
  return { extrudes: ext };
}

/** A freestanding LOUNGE SOFA: an upholstered plinth base, seat cushions, a back cushion on
 *  the `back` side, and two arms on the run-axis ends. `along` is the run axis; `back` is the
 *  side the backrest sits against (occupant faces the opposite way). Waiting-area seating. */
export function buildLobbySofa({ x = 0, y = 0, z = 0, w = 7, d = 3, h = 2.7, along = 'x', back = '+y', seatH = 1.4, body = LOBBY_TINTS.sofaBody, cushion = LOBBY_TINTS.sofaCushion, arm = LOBBY_TINTS.sofaArm } = {}) {
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w;                 // world x-extent, y-extent
  const armW = 0.55, bt = 0.6;                                // arm width, back thickness
  const ext = [buildSlab({ x, y, z0: z, z1: z + seatH * 0.62, w: W, d: D, r: 0.1, tint: body })];   // plinth base
  // back cushion against `back`, seat cushions filling in front of it, arms on the ends
  const backY = back === '+y' ? y + D / 2 - bt / 2 : y - D / 2 + bt / 2;
  const backX = back === '+x' ? x + W / 2 - bt / 2 : x - W / 2 + bt / 2;
  if (back === '+y' || back === '-y') {
    ext.push(buildSlab({ x, y: backY, z0: z + seatH * 0.62, z1: z + h, w: W - 2 * armW, d: bt, r: 0.12, tint: cushion }));   // back
    const seatY = back === '+y' ? y - bt / 2 : y + bt / 2;
    ext.push(buildSlab({ x, y: seatY, z0: z + seatH * 0.62, z1: z + seatH + 0.22, w: W - 2 * armW, d: D - bt, r: 0.14, tint: cushion }));   // seat cushion
    for (const s of [-1, 1]) ext.push(buildSlab({ x: x + s * (W / 2 - armW / 2), y, z0: z + seatH * 0.62, z1: z + seatH + 0.5, w: armW, d: D, r: 0.1, tint: arm }));   // arms
  } else {
    ext.push(buildSlab({ x: backX, y, z0: z + seatH * 0.62, z1: z + h, w: bt, d: D - 2 * armW, r: 0.12, tint: cushion }));
    const seatX = back === '+x' ? x - bt / 2 : x + bt / 2;
    ext.push(buildSlab({ x: seatX, y, z0: z + seatH * 0.62, z1: z + seatH + 0.22, w: W - bt, d: D - 2 * armW, r: 0.14, tint: cushion }));
    for (const s of [-1, 1]) ext.push(buildSlab({ x, y: y + s * (D / 2 - armW / 2), z0: z + seatH * 0.62, z1: z + seatH + 0.5, w: D, d: armW, r: 0.1, tint: arm }));
  }
  return { extrudes: ext };
}

/** A backless LOBBY BENCH: a polished MARBLE seat slab on a narrower dark-marble plinth.
 *  `along` is the run axis. Stone variation of the lounge — pairs with the sofas. */
export function buildLobbyBench({ x = 0, y = 0, z = 0, w = 5, d = 1.8, h = 1.5, along = 'x', top = MARBLE.light, base = MARBLE.dark } = {}) {
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w, slabThk = 0.22;
  return {
    extrudes: [
      buildSlab({ x, y, z0: z, z1: z + h - slabThk, w: W * 0.6, d: D * 0.6, r: 0.03, tint: base }),       // plinth
      buildSlab({ x, y, z0: z + h - slabThk, z1: z + h, w: W, d: D, r: 0.04, tint: top }),                // marble seat slab
    ],
  };
}

/** A tall HOUSEPLANT: a tapered planter (urn), soil cap, a short trunk, and a few rounded
 *  foliage masses — a lobby ficus. `h` is the overall height, `spread` the canopy width.
 *  `pot` defaults ceramic; pass MARBLE.* for a stone planter variation. */
export function buildHousePlant({ x = 0, y = 0, z = 0, h = 6, spread = 2.6, pot = LOBBY_TINTS.pot, soil = LOBBY_TINTS.soil, trunk = LOBBY_TINTS.trunk, leaf = LOBBY_TINTS.leaf } = {}) {
  const potH = h * 0.3, potR = spread * 0.34;
  const lathes = [
    { axisFrom: { x, y, z }, axisTo: { x, y, z: z + potH }, profile: [{ t: 0, radius: potR * 0.66 }, { t: 0.12, radius: potR * 0.78 }, { t: 0.85, radius: potR }, { t: 1, radius: potR * 0.95 }], samples: 22, crossSections: 4, tint: pot },   // urn
    { axisFrom: { x, y, z: z + potH - 0.06 }, axisTo: { x, y, z: z + potH + 0.05 }, profile: [{ t: 0, radius: potR * 0.9 }, { t: 1, radius: potR * 0.9 }], samples: 18, crossSections: 2, tint: soil },   // soil cap
    { axisFrom: { x, y, z: z + potH }, axisTo: { x, y, z: z + h * 0.5 }, profile: [{ t: 0, radius: 0.13 }, { t: 1, radius: 0.08 }], samples: 8, crossSections: 2, tint: trunk },   // trunk
  ];
  // foliage: overlapping spheroids forming a rounded canopy
  const masses = [[0, 0, h * 0.78, spread * 0.5], [spread * 0.24, spread * 0.06, h * 0.62, spread * 0.36], [-spread * 0.2, -spread * 0.14, h * 0.66, spread * 0.34], [spread * 0.05, -spread * 0.22, h * 0.7, spread * 0.3]];
  for (const [dx, dy, cz, r] of masses) {
    lathes.push({ axisFrom: { x: x + dx, y: y + dy, z: z + cz - r }, axisTo: { x: x + dx, y: y + dy, z: z + cz + r }, profile: [{ t: 0, radius: 0.06 }, { t: 0.5, radius: r }, { t: 1, radius: 0.06 }], samples: 16, crossSections: 5, tint: leaf });
  }
  return { lathes };
}

// ── FENG-SHUI lobby items — the pieces that turn an open plate into an auspicious
// entrance: a round bright-hall FEATURE TABLE, a tiered WATER FOUNTAIN (wealth + flow), a
// round FLOOR MEDALLION (the ming-tang anchor), and a freestanding ENTRY SCREEN (deflects
// qi at the threshold). Round, water, and stone — the five-element balance against the
// metal lifts and wood plants.

/** A tiered round WATER FOUNTAIN: a wide lower basin with a water surface, a pedestal, and a
 *  smaller upper bowl spilling into it. Stone-finished, the water a pale reflective disc.
 *  Belongs near the entrance — moving water draws qi inward. */
export function buildFountain({ x = 0, y = 0, z = 0, r = 2.8, h = 4.2, basin = MARBLE.dark, rim = MARBLE.light, water = '#5f93ad' } = {}) {
  const lowerH = h * 0.42, pedH = h * 0.3;
  return {
    lathes: [
      { axisFrom: { x, y, z }, axisTo: { x, y, z: z + lowerH }, profile: [{ t: 0, radius: r * 0.62 }, { t: 0.32, radius: r }, { t: 0.86, radius: r }, { t: 1, radius: r * 0.9 }], samples: 30, crossSections: 4, tint: basin },     // lower basin
      { axisFrom: { x, y, z: z + lowerH - 0.2 }, axisTo: { x, y, z: z + lowerH - 0.1 }, profile: [{ t: 0, radius: r * 0.84 }, { t: 1, radius: r * 0.84 }], samples: 26, crossSections: 2, tint: water },                                  // lower water
      { axisFrom: { x, y, z: z + lowerH }, axisTo: { x, y, z: z + lowerH + pedH }, profile: [{ t: 0, radius: r * 0.34 }, { t: 1, radius: r * 0.2 }], samples: 18, crossSections: 2, tint: rim },                                          // pedestal
      { axisFrom: { x, y, z: z + lowerH + pedH }, axisTo: { x, y, z: z + h }, profile: [{ t: 0, radius: r * 0.18 }, { t: 0.5, radius: r * 0.5 }, { t: 1, radius: r * 0.46 }], samples: 24, crossSections: 3, tint: rim },                  // upper bowl
      { axisFrom: { x, y, z: z + h - 0.12 }, axisTo: { x, y, z: z + h - 0.04 }, profile: [{ t: 0, radius: r * 0.4 }, { t: 1, radius: r * 0.4 }], samples: 20, crossSections: 2, tint: water },                                            // upper water
    ],
  };
}

/** A round bright-hall FEATURE TABLE: a marble top on a pedestal + base disc, crowned with a
 *  vase of blooms. The classic lobby centrepiece — round shape = smooth circulating qi. */
export function buildFeatureTable({ x = 0, y = 0, z = 0, r = 2.3, h = 2.6, top = MARBLE.light, base = MARBLE.dark, vase = '#7e8a93', bloom = '#c2718b', leaf = '#43603f' } = {}) {
  const topThk = 0.16, baseH = 0.22;
  const lathes = [
    { axisFrom: { x, y, z: z + h - topThk }, axisTo: { x, y, z: z + h }, profile: [{ t: 0, radius: r }, { t: 1, radius: r }], samples: 32, crossSections: 2, tint: top },                                        // round marble top
    { axisFrom: { x, y, z: z + baseH }, axisTo: { x, y, z: z + h - topThk }, profile: [{ t: 0, radius: r * 0.22 }, { t: 1, radius: r * 0.16 }], samples: 18, crossSections: 2, tint: base },                     // pedestal
    { axisFrom: { x, y, z }, axisTo: { x, y, z: z + baseH }, profile: [{ t: 0, radius: r * 0.56 }, { t: 1, radius: r * 0.3 }], samples: 22, crossSections: 2, tint: base },                                      // base disc
    { axisFrom: { x, y, z: z + h }, axisTo: { x, y, z: z + h + 0.95 }, profile: [{ t: 0, radius: 0.2 }, { t: 0.24, radius: 0.34 }, { t: 0.7, radius: 0.22 }, { t: 1, radius: 0.32 }], samples: 18, crossSections: 4, tint: vase },   // vase
  ];
  const blooms = [[0, 0, h + 1.35, 0.42], [0.3, 0.12, h + 1.18, 0.3], [-0.24, 0.2, h + 1.24, 0.28], [0.12, -0.28, h + 1.14, 0.27], [-0.18, -0.22, h + 1.1, 0.24]];
  for (let i = 0; i < blooms.length; i += 1) {
    const [dx, dy, cz, br] = blooms[i];
    lathes.push({ axisFrom: { x: x + dx, y: y + dy, z: z + cz - br }, axisTo: { x: x + dx, y: y + dy, z: z + cz + br }, profile: [{ t: 0, radius: 0.05 }, { t: 0.5, radius: br }, { t: 1, radius: 0.05 }], samples: 12, crossSections: 4, tint: i % 2 ? leaf : bloom });
  }
  return { lathes };
}

/** A round inlaid FLOOR MEDALLION: a flush contrasting-marble disc with an outer ring — the
 *  ming-tang focal anchor of the bright hall. Nearly flat, so it never obstructs flow. */
export function buildFloorMedallion({ x = 0, y = 0, z = 0, r = 6, field = MARBLE.warm, ring = MARBLE.dark } = {}) {
  return {
    lathes: [
      { axisFrom: { x, y, z: z + 0.005 }, axisTo: { x, y, z: z + 0.02 }, profile: [{ t: 0, radius: r }, { t: 1, radius: r }], samples: 44, crossSections: 2, tint: ring },          // outer ring
      { axisFrom: { x, y, z: z + 0.02 }, axisTo: { x, y, z: z + 0.035 }, profile: [{ t: 0, radius: r * 0.8 }, { t: 1, radius: r * 0.8 }], samples: 44, crossSections: 2, tint: field },  // inner field
    ],
  };
}

/** A freestanding decorative ENTRY SCREEN: a stone-framed panel on two feet with a contrasting
 *  inset motif — the threshold piece that gives the entrance a buffer (deflecting rushing qi)
 *  without blocking circulation. `along` is the run axis; it backs nothing (stands free). */
export function buildEntryScreen({ x = 0, y = 0, z = 0, w = 6, h = 6.5, along = 'x', frame = MARBLE.dark, panel = '#6f5d45', inset = MARBLE.warm } = {}) {
  const horiz = along === 'x';
  const th = 0.45, m = Math.min(w, h) * 0.34;
  const ext = [
    buildSlab({ x, y, z0: z + 0.32, z1: z + h, w: horiz ? w : th, d: horiz ? th : w, r: 0.1, tint: frame }),                                   // frame slab
    buildSlab({ x, y, z0: z + 0.9, z1: z + h - 0.7, w: horiz ? w - 0.7 : th + 0.06, d: horiz ? th + 0.06 : w - 0.7, r: 0.05, tint: panel }),    // inset panel
    buildSlab({ x, y, z0: z + h * 0.42, z1: z + h * 0.42 + m, w: horiz ? m : th + 0.12, d: horiz ? th + 0.12 : m, r: 0.16, tint: inset }),      // motif
  ];
  for (const s of [-1, 1]) ext.push(buildSlab({                                                                                                // feet
    x: horiz ? x + s * (w / 2 - 0.5) : x, y: horiz ? y : y + s * (w / 2 - 0.5),
    z0: z, z1: z + 0.32, w: horiz ? 1.3 : 1.1, d: horiz ? 1.1 : 1.3, r: 0.06, tint: frame,
  }));
  return { extrudes: ext };
}

/** A modern GLASS + CONCRETE street ENTRANCE for the south facade (faces −y, outside). A
 *  concrete portal (jambs + header) frames a pair of framed-glass doors with a centre seam and
 *  pull bars, a glass transom above, and a cantilevered concrete CANOPY projecting outside. `w`
 *  is the structural width (clear opening ≈ w − 2·jamb); sized to the building's entry. */
export function buildGlassEntrance({ x = 0, y = 0, z = 0, w = 9, h = 9.5, wallT = 0.8, glass = '#9fb6c2', frame = '#33373b', concrete = '#b4b1a8', canopy = '#9d9a92', handle = '#c9ccce' } = {}) {
  const jamb = 0.55, doorH = h * 0.72, ext = [];
  const portalD = wallT + 0.5;
  for (const s of [-1, 1]) ext.push(buildSlab({ x: x + s * (w / 2 - jamb / 2), y, z0: z, z1: z + h, w: jamb, d: portalD, r: 0.03, tint: concrete }));   // concrete jambs
  ext.push(buildSlab({ x, y, z0: z + h, z1: z + h + 1.1, w: w + 0.6, d: portalD, r: 0.03, tint: concrete }));                                          // concrete header
  const clearW = w - 2 * jamb;
  ext.push(buildSlab({ x, y, z0: z + doorH + 0.12, z1: z + h - 0.12, w: clearW, d: 0.14, r: 0.01, tint: glass }));                                    // glass transom
  ext.push(buildSlab({ x, y, z0: z + doorH, z1: z + doorH + 0.14, w: clearW + 0.1, d: 0.22, tint: frame }));                                          // transom mullion
  const leafW = clearW / 2 - 0.06;
  for (const s of [-1, 1]) {
    const lc = s * (clearW / 4 + 0.02);
    ext.push(buildSlab({ x: x + lc, y, z0: z + 0.04, z1: z + doorH, w: leafW + 0.08, d: 0.1, tint: frame }));            // door leaf metal frame (backer)
    ext.push(buildSlab({ x: x + lc, y, z0: z + 0.12, z1: z + doorH - 0.08, w: leafW - 0.12, d: 0.2, r: 0.01, tint: glass }));   // glass infill (proud both faces)
    ext.push(buildSlab({ x: x + lc - s * (leafW / 2 - 0.18), y, z0: z + 2.6, z1: z + 4.6, w: 0.1, d: 0.34, r: 0.02, tint: handle }));   // vertical pull bar
  }
  ext.push(buildSlab({ x, y, z0: z + 0.1, z1: z + doorH - 0.06, w: 0.12, d: 0.26, tint: frame }));                       // centre meeting stile (doors part here)
  ext.push(buildSlab({ x, y: y - (portalD / 2 + 1.9), z0: z + h + 1.1, z1: z + h + 1.55, w: w + 3.2, d: 4.0, r: 0.05, tint: canopy }));   // cantilevered canopy (outside)
  ext.push(buildSlab({ x, y: y - 0.6, z0: z, z1: z + 0.14, w: clearW + 1.0, d: 1.6, r: 0.02, tint: concrete }));         // entrance threshold step
  return { extrudes: ext };
}

// ── OFFICE items — the workstation read: desk + monitor, swivel task chair, conference
// table. The task chair (5-star base + gas column + seat + back) is what makes an open
// floor read as an OFFICE the fastest, so it gets the most articulated silhouette.
const OFFICE_TINTS = { desk: '#b9a98e', deskLeg: '#565a61', screen: '#1b1f25', chair: '#3b4350', chairBase: '#272b32', confTop: '#7c6a4d' };

/** A workstation desk: worktop on two panel-gable legs, with a flat-panel MONITOR + stand
 *  on top (the monitor is the fast "this is a desk" cue). `screenFace` is the side the
 *  screen (and the seated worker) face. */
export function buildOfficeDesk({ x = 0, y = 0, z = 0, w = 4.6, d = 2.4, h = 2.45, top = OFFICE_TINTS.desk, leg = OFFICE_TINTS.deskLeg, screen = OFFICE_TINTS.screen, screenFace = '-y' } = {}) {
  const topThk = 0.12;
  const extrudes = [buildSlab({ x, y, z0: z + h - topThk, z1: z + h, w, d, r: 0.05, tint: top })];        // worktop
  for (const sx of [-(w / 2 - 0.16), (w / 2 - 0.16)]) extrudes.push(buildSlab({ x: x + sx, y, z0: z, z1: z + h - topThk, w: 0.14, d: d - 0.5, r: 0.03, tint: leg }));  // panel gables
  extrudes.push(buildSlab({ x, y, z0: z + 0.3, z1: z + h - topThk - 0.4, w: w - 0.8, d: 0.08, tint: leg }));   // modesty panel
  // monitor: a thin upright screen on a short stand, set toward the FAR edge facing the worker
  const sgn = screenFace === '-y' ? 1 : screenFace === '+y' ? -1 : 0;
  const sgx = screenFace === '-x' ? 1 : screenFace === '+x' ? -1 : 0;
  const mx = x + sgx * (w / 2 - 0.6), my = y + sgn * (d / 2 - 0.5);
  const horizScreen = sgn !== 0;
  extrudes.push(buildSlab({ x: mx, y: my, z0: z + h, z1: z + h + 1.2, w: horizScreen ? 1.8 : 0.08, d: horizScreen ? 0.08 : 1.8, r: 0.02, tint: screen }));   // panel
  extrudes.push(buildSlab({ x: mx, y: my, z0: z + h, z1: z + h + 0.42, w: 0.16, d: 0.16, tint: leg }));        // stand
  return { extrudes };
}

/** A CONNECTED BENCH DESK — one long shared worktop on panel legs, the open-plan "bench
 *  desking" read (vs. separate workstations). `double` runs people on both long sides with a
 *  centre privacy spine; monitors are dropped per seat, facing out. Chairs are placed by the
 *  fit-out along the long sides. `along` orients the run ('x' default). */
export function buildOfficeBench({ x = 0, y = 0, z = 0, w = 14, d = 4.8, h = 2.45, seats = 4, double = true, along = 'x', top = OFFICE_TINTS.desk, leg = OFFICE_TINTS.deskLeg, screen = OFFICE_TINTS.screen, spine = '#9aa2aa' } = {}) {
  const horiz = along === 'x';
  const L = horiz ? w : d, D = horiz ? d : w, topThk = 0.12;
  const at = (a, perp) => (horiz ? [x + a, y + perp] : [x + perp, y + a]);
  const extrudes = [buildSlab({ x, y, z0: z + h - topThk, z1: z + h, w: L, d: D, r: 0.05, tint: top })];   // long shared worktop
  const nLeg = Math.max(2, Math.round(L / 6) + 1);
  for (let i = 0; i < nLeg; i += 1) {
    const [lx, ly] = at(-L / 2 + 0.4 + i * ((L - 0.8) / (nLeg - 1)), 0);
    extrudes.push(buildSlab({ x: lx, y: ly, z0: z, z1: z + h - topThk, w: horiz ? 0.14 : D - 0.6, d: horiz ? D - 0.6 : 0.14, r: 0.03, tint: leg }));
  }
  if (double) { const [sx, sy] = at(0, 0); extrudes.push(buildSlab({ x: sx, y: sy, z0: z + h, z1: z + h + 0.95, w: horiz ? L : 0.08, d: horiz ? 0.08 : L, r: 0.02, tint: spine })); }   // centre privacy spine
  const sides = double ? [1, -1] : [1];
  const pitch = L / seats;
  for (const s of sides) {
    for (let i = 0; i < seats; i += 1) {
      const [mx, my] = at(-L / 2 + (i + 0.5) * pitch, s * (double ? 0.32 : D / 2 - 0.5));
      extrudes.push(buildSlab({ x: mx, y: my, z0: z + h, z1: z + h + 1.05, w: horiz ? 1.5 : 0.07, d: horiz ? 0.07 : 1.5, r: 0.02, tint: screen }));   // monitor
      extrudes.push(buildSlab({ x: mx, y: my, z0: z + h, z1: z + h + 0.38, w: 0.14, d: 0.14, tint: leg }));                                            // stand
    }
  }
  return { extrudes };
}

/** A swivel TASK CHAIR — splayed 5-star base disc, gas column, padded seat, contoured back.
 *  `back` is the side the backrest sits on (so the occupant faces the opposite way), matching
 *  buildCafeChair. The defining "office" silhouette. */
export function buildOfficeChair({ x = 0, y = 0, z = 0, h = 2.95, seatH = 1.55, tint = OFFICE_TINTS.chair, base = OFFICE_TINTS.chairBase, back = '-y' } = {}) {
  const lathes = [
    { axisFrom: { x, y, z: z + 0.02 }, axisTo: { x, y, z: z + 0.16 }, profile: [{ t: 0, radius: 0.92 }, { t: 0.7, radius: 0.7 }, { t: 1, radius: 0.34 }], samples: 20, crossSections: 3, tint: base },  // splayed star base
    { axisFrom: { x, y, z: z + 0.16 }, axisTo: { x, y, z: z + seatH - 0.16 }, profile: [{ t: 0, radius: 0.12 }, { t: 1, radius: 0.1 }], samples: 12, crossSections: 2, tint: base },                       // gas column
  ];
  const extrudes = [buildSlab({ x, y, z0: z + seatH - 0.16, z1: z + seatH, w: 1.55, d: 1.55, r: 0.22, tint })];   // seat pad
  if (back === '+y' || back === '-y') {
    const by = back === '+y' ? y + 0.68 : y - 0.68;
    extrudes.push(buildSlab({ x, y: by, z0: z + seatH, z1: z + h, w: 1.5, d: 0.16, r: 0.13, tint }));            // backrest
  } else {
    const bx = back === '+x' ? x + 0.68 : x - 0.68;
    extrudes.push(buildSlab({ x: bx, y, z0: z + seatH, z1: z + h, w: 0.16, d: 1.5, r: 0.13, tint }));
  }
  return { lathes, extrudes };
}

/** A boardroom CONFERENCE TABLE — an oblong worktop on two drum pedestals. Surround with
 *  buildOfficeChair. `along` orients the long axis ('x' default). */
export function buildConferenceTable({ x = 0, y = 0, z = 0, w = 11, d = 3.4, h = 2.45, along = 'x', top = OFFICE_TINTS.confTop, leg = OFFICE_TINTS.deskLeg } = {}) {
  const horiz = along === 'x';
  const W = horiz ? w : d, D = horiz ? d : w, topThk = 0.14;
  const extrudes = [buildSlab({ x, y, z0: z + h - topThk, z1: z + h, w: W, d: D, r: 0.2, tint: top })];      // oblong top
  const lathes = [];
  const half = (horiz ? W : D) * 0.28;
  for (const s of [-half, half]) {
    const px = horiz ? x + s : x, py = horiz ? y : y + s;
    lathes.push({ axisFrom: { x: px, y: py, z: z + 0.12 }, axisTo: { x: px, y: py, z: z + h - topThk }, profile: [{ t: 0, radius: 0.34 }, { t: 1, radius: 0.3 }], samples: 14, crossSections: 2, tint: leg });   // column
    lathes.push({ axisFrom: { x: px, y: py, z }, axisTo: { x: px, y: py, z: z + 0.12 }, profile: [{ t: 0, radius: 0.85 }, { t: 1, radius: 0.5 }], samples: 16, crossSections: 2, tint: leg });                    // foot disc
  }
  return { extrudes, lathes };
}

/** An ELEVATOR BANK — a flush metal face wall with `cabs` pairs of sliding doors (a centre
 *  seam reads them as elevators), an indicator light over each, and a call panel to the side.
 *  `facing` is the side the doors open toward (into the lobby). Backs a wall. */
export function buildElevatorBank({ x = 0, y = 0, z = 0, w = 8, h = 7.2, cabs = 2, facing = '+y', frame = '#7e858d', door = '#c2cdd4', indicator = '#ffd24a', panel = '#2b2f35', jamb = '#474d52' } = {}) {
  const horiz = facing === '+y' || facing === '-y';
  const sign = (facing === '+y' || facing === '+x') ? 1 : -1;     // direction the doors face (proud of the wall)
  const D = 0.4;
  const at = (a, perp) => (horiz ? [x + a, y + perp] : [x + perp, y + a]);
  const extrudes = [];
  // a strip along the run axis at proud `perp` (perp is the magnitude; sign aims it at the lobby)
  const strip = (c, perp, half, z0, z1, tint, thin = 0.06) => {
    const [sx, sy] = at(c, sign * perp);
    extrudes.push(buildSlab({ x: sx, y: sy, z0, z1, w: horiz ? half * 2 : thin, d: horiz ? thin : half * 2, r: 0.01, tint }));
  };
  const [bx, by] = at(0, 0);
  extrudes.push(buildSlab({ x: bx, y: by, z0: z, z1: z + h + 0.8, w: horiz ? w : D, d: horiz ? D : w, r: 0.02, tint: frame }));   // bank face wall
  const cabW = w / cabs, leafW = cabW * 0.40, seamGap = 0.06;
  for (let i = 0; i < cabs; i += 1) {
    const c = -w / 2 + (i + 0.5) * cabW;
    strip(c, D / 2 + 0.02, cabW * 0.46, z + 0.05, z + h, panel, 0.04);                    // dark recess → jamb outline around + between the leaves
    strip(c - (leafW / 2 + seamGap), D / 2 + 0.09, leafW / 2, z + 0.12, z + h - 0.06, door, 0.05);   // left leaf
    strip(c + (leafW / 2 + seamGap), D / 2 + 0.09, leafW / 2, z + 0.12, z + h - 0.06, door, 0.05);   // right leaf
    strip(c, D / 2 + 0.13, 0.03, z + 0.12, z + h - 0.06, panel, 0.05);                    // crisp centre seam (the doors part here, sideways)
    strip(c, D / 2 + 0.06, cabW * 0.46, z + h - 0.07, z + h, jamb, 0.07);                 // header lintel
    strip(c, D / 2 + 0.06, cabW * 0.46, z + 0.05, z + 0.13, jamb, 0.07);                  // sill
    const [ix, iy] = at(c, sign * (D / 2 + 0.05));
    extrudes.push(buildSlab({ x: ix, y: iy, z0: z + h + 0.2, z1: z + h + 0.52, w: horiz ? 0.7 : 0.06, d: horiz ? 0.06 : 0.7, tint: indicator }));   // floor indicator
  }
  const [px, py] = at(w / 2 + 0.45, sign * (D / 2 + 0.05));
  extrudes.push(buildSlab({ x: px, y: py, z0: z + 3.0, z1: z + 4.2, w: horiz ? 0.3 : 0.06, d: horiz ? 0.06 : 0.3, tint: panel }));   // call panel
  return { extrudes };
}

// ── the registry — the items wired into the cafe fit-out ──────────────────────
export const CAFE_ITEMS = {
  table: buildCafeTable,
  chair: buildCafeChair,
  stool: buildBarStool,
  barCounter: buildBarCounter,
  backBar: buildBackBar,
};

export const OFFICE_ITEMS = {
  desk: buildOfficeDesk,
  bench: buildOfficeBench,
  chair: buildOfficeChair,
  conferenceTable: buildConferenceTable,
  elevatorBank: buildElevatorBank,
};

export const LOBBY_ITEMS = {
  conciergeDesk: buildConciergeDesk,
  sofa: buildLobbySofa,
  bench: buildLobbyBench,
  plant: buildHousePlant,
  art: buildWallArt,
  fountain: buildFountain,
  featureTable: buildFeatureTable,
  medallion: buildFloorMedallion,
  screen: buildEntryScreen,
  entrance: buildGlassEntrance,
};
