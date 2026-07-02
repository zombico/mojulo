/**
 * subway-building — the subway as a stacked BUILDING VIEW.
 *
 * Migrates the single-hall subway-station diorama into a multi-level building:
 * each level is its own sketched plate, stacked over a shared VERTICAL-CIRCULATION
 * void. New-sibling, shared-stacking path: it REUSES the building view's stacking
 * primitives (houseMeru, the slab-void idea, the straight stair flight) but keeps
 * subway-specific level geometry — the commercial floorplan-building is untouched.
 *
 * Level 0 (platform) is today's planSubwayStation hall, COMPOSED not forked: we
 * call it and lift its faces by baseZ (zero edits to subway-station.js). Level 1
 * (mezzanine) is a new concourse plate: a slab capping the hall with a void over
 * the island, fare gates, wayfinding, and a street mouth.
 *
 * PATHS ("feng shui"): the circulation is laid out by a FLOW ADAPTER over
 * movement-flow.js — the train→platform→climb→concourse→fare-line→street desire
 * lines, with the street mouth offset off the descent axis so qi can't shoot
 * straight from the street down onto the tracks (the `axial-through-shot` fault).
 * `assessSubwayFlow` reports in movement-flow's shared fault vocabulary.
 *
 * ELEMENTS: an up/down ESCALATOR pair (buildEscalator — the new primitive the
 * codebase lacked), a real straight STAIR (buildStairFlight), and a glass ELEVATOR
 * shaft spanning both levels, all discharging onto the concourse.
 */

import { makeLight, shadeHex } from '../polygonizer/vexar.js';
import { houseMeru, buildStairFlight, STAIR_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { onAxis, desireLine, segBlocksRect } from '../worlds/movement-flow.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { applyAtmosphere, platformLightSources, concourseLightSources } from './subway-atmosphere.js';
import { concourseAssetFaces, buildTicketMachine, buildBench, buildWasteBin, buildInfoKiosk, buildSignTotem, buildPoster, buildWallMap } from './subway-concourse-assets.js';
import { planSubwayStation, SUBWAY_LINES } from './subway-station.js';
import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// Hall envelope — mirrors the local HALL in subway-station.js. Re-declared here
// (the source doesn't export it); a later pass shares it via a subway-dims module so
// the two can't drift. The mezzanine caps this footprint; the void sits over the island.
const HALL = { x0: 1, x1: 19, y0: 0, y1: 46, zFloor: -1.1, zPlat: 0, zCeil: 5.0 };
const ISLAND = { x0: 6, x1: 14 };                 // the island platform x-span
const MEZZ_DEFAULTS = { height: 4.5, gates: 5, slab: 0.6 };
// circulation void over the island, toward the (omitted) near wall so it reads.
const VOID = { x0: ISLAND.x0, x1: ISLAND.x1, y0: 6, y1: 20 };

const LINE_BANDS = { blue: '#2f6fb0', red: '#c0392b', green: '#2e8b57', orange: '#d97a2b' };

const TINT = {
  slab: '#8a8d92', slabSoffit: '#6c6f74', wall: '#c4cacb', wallTile: '#dcd9d0', ceiling: '#787c82', marbleFloor: '#d8dadc',
  railing: '#9aa0a7',
  gateCab: '#3f4750', gatePaddle: '#9fb0b8', gateLamp: '#39d98a', fareRail: '#8893a0',
  escTruss: '#565c63', escBalustrade: '#b3bbc2', escRail: '#23272c',
  escTread: '#8d9298', escRiser: '#4b5057',
  escUp: '#39d98a', escDown: '#e0a13a',
  treadTint: '#9aa0a6', riserTint: '#6b7178',
  evGlass: '#9fb6c4', evCab: '#5d6b73', evDoor: '#cfe0e8', evRoof: '#4a535b',
  pylon: '#2b3036', signTo: '#1c5fa8',
};

// ── face helpers (vexar-shaded, mirroring floorplan-building's box) ────────────
function boxFaces(x0, x1, y0, y1, z0, z1, tint, light, { top = true, bottom = false } = {}) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return [];
  const f = [];
  const q = (corners, normal) => f.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true });
  q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  q([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  q([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  if (top) q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  if (bottom) q([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]);
  return f;
}
function panelFace(x0, x1, y0, y1, z, tint, light, normal = [0, 0, 1]) {
  return { corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: shadeHex(tint, normal, light), doubleSided: true };
}
function quadFace(corners, tint, light, normal) {
  return { corners, fill: shadeHex(tint, normal, light), doubleSided: true };
}
// a wall quad CLAD in tile: corner0→1 is the horizontal run (uSpan), corner1→2 the height
// (vSpan). WebGL multiplies the tile texel by the lit `fill`; the CSS path keeps `fill`.
function tiledWall(corners, tint, light, normal, uSpan, vSpan, texKey, ts = 0.9) {
  return {
    corners, fill: shadeHex(tint, normal, light), texture: texKey, textureLit: true,
    uv: [[0, 0], [uSpan / ts, 0], [uSpan / ts, vSpan / ts], [0, vSpan / ts]], doubleSided: true,
  };
}
function litFace(corners, fill, glow) { return { corners, fill, doubleSided: true, ...(glow ? { glow } : {}) }; }
// a soft CONTACT shadow decal (World renders it with the radial shadow texture → soft blob).
function contactShadowFace(cx, cy, hw, hd, z, alpha) {
  return { corners: [[cx - hw, cy - hd, z], [cx + hw, cy - hd, z], [cx + hw, cy + hd, z], [cx - hw, cy + hd, z]], bg: `rgba(0,0,0,${alpha})`, doubleSided: true, decal: 'shadow', shadowAlpha: alpha };
}
const lerp = (a, b, t) => a + (b - a) * t;

/** Translate a face list up by dz (compose a level into the stack at its baseZ). */
function liftFaces(faces, dz) {
  if (!dz) return faces;
  return faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + dz]) }));
}

/**
 * Punch the circulation VOID through the platform's own ceiling (the lone full-hall
 * quad at z=zCeil), so the mezzanine void opens all the way down to the platform
 * rather than onto the tunnel roof. Composed-face surgery: the matched ceiling quad
 * is replaced by four border strips (same fill) framing the hole; every other face
 * passes through untouched. The stair/escalators/elevator penetrate the opening.
 */
function punchCeiling(faces, hole, z) {
  const out = [];
  for (const f of faces) {
    const isCeil = f.corners.length === 4 && f.corners.every((c) => Math.abs(c[2] - z) < 1e-6);
    if (!isCeil) { out.push(f); continue; }
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (hole.x0 <= x0 || hole.x1 >= x1 || hole.y0 <= y0 || hole.y1 >= y1) { out.push(f); continue; }
    const strip = (ax0, ax1, ay0, ay1) => {
      if (ax1 - ax0 < 1e-3 || ay1 - ay0 < 1e-3) return;
      out.push({ ...f, corners: [[ax0, ay0, z], [ax1, ay0, z], [ax1, ay1, z], [ax0, ay1, z]] });
    };
    strip(x0, x1, y0, hole.y0); strip(x0, x1, hole.y1, y1);
    strip(x0, hole.x0, hole.y0, hole.y1); strip(hole.x1, x1, hole.y0, hole.y1);
  }
  return out;
}

// ── THE FLOW ADAPTER ("feng shui") — paths over movement-flow.js ───────────────
/**
 * Lay out the circulation by the desire lines a rider walks, not by magic numbers.
 * The subway's graph: tunnel mouths (trains arrive, far +y end) → the platform
 * SPINE down the island → the FOOT of the climb (over the void) → up to the
 * concourse → the FARE LINE (paid/unpaid boundary) → the STREET mouth.
 *
 * Feng-shui rules, made concrete in movement-flow's vocabulary:
 *  - descentAxis = the island centerline; the street mouth is OFFSET off it so the
 *    sightline can't shoot straight from the street down onto the live tracks
 *    (`axial-through-shot`). The fare line sits across the concourse as the
 *    commanded boundary; the bright concourse ("明堂") sits between gates and street.
 *  - the climb cluster discharges onto the NORTH concourse strip (one open void
 *    edge), so riders step off toward the gates, never back across the well.
 */
function planSubwayFlow({ mezzZ }) {
  const cx = (ISLAND.x0 + ISLAND.x1) / 2;            // descent axis (island centerline)
  // climb cluster — four lanes across the void, all discharging onto the north (y1) edge.
  const yTop = VOID.y1;                               // mezz arrival edge (north concourse)
  // Four NON-OVERLAPPING lanes across the void (x 6..14), west→east with clear gaps.
  // NB: buildStairFlight(direction:'+y') lays its width along perp = −x, so the stair
  // grows LEFT from its anchor — anchor it at the lane's RIGHT edge (anchorX = x1).
  const climb = {
    elevator: { x0: 6.25, x1: 7.75, y0: VOID.y1 - 2.6, y1: VOID.y1 - 0.5 },
    escUp: { x0: 8.0, x1: 9.5, yBot: 9.0, yTop, dir: 'up' },
    escDown: { x0: 9.7, x1: 11.2, yBot: 9.0, yTop, dir: 'down' },
    stair: { x0: 11.6, x1: 13.5, anchorX: 13.5, anchorY: 11.5, dir: '+y' },
  };
  const footY = 10.5;                                 // where the climb meets the platform
  const fareLine = { y: 30, x0: 9.7, x1: 16.5, lanes: 5 };   // the passable (turnstile + gate) span
  // STREET mouth — offset EAST of the descent axis (cx) so no straight shot down.
  const street = { x: cx + 5, y: HALL.y1, edge: 'N', width: 6 };
  const desireLines = {
    platformSpine: desireLine({ x: cx, y: HALL.y1 - 1 }, { x: cx, y: footY }),
    concourse: desireLine({ x: cx, y: VOID.y1 }, { x: (fareLine.x0 + fareLine.x1) / 2, y: fareLine.y }),
    toStreet: desireLine({ x: (fareLine.x0 + fareLine.x1) / 2, y: fareLine.y }, { x: street.x, y: street.y }),
  };
  return { cx, footY, climb, fareLine, street, desireLines, mezzZ };
}

/**
 * Diagnose the laid-out paths in movement-flow's shared vocabulary. Best-effort and
 * advisory (the room chapter's policy): flow biases a layout, it never gates it.
 * @returns { ok:[], necessary:[], preferential:[], impairment:boolean }
 */
export function assessSubwayFlow(flow) {
  const ok = [], necessary = [], preferential = [];
  // 1. axial-through-shot: is the street mouth collinear with the descent axis? A
  //    straight shot street→void→tracks is the classic "poison arrow". Offset clears it.
  if (onAxis(flow.street.x, flow.cx, 2)) necessary.push('axial-through-shot: street mouth on the descent axis — shift it off-axis');
  else ok.push('axial-through-shot cleared: street mouth offset off the descent axis');
  // 2. desire-line-blockage: a platform column standing in the spine the rider walks.
  const columns = [6.7, 13.3].flatMap((x) => Array.from({ length: 9 }, (_, i) => ({ x: x - 0.5, y: 4 + i * 5 - 0.5, w: 1, h: 1 })));
  const blocked = columns.some((c) => segBlocksRect(flow.desireLines.platformSpine, c, 0.4));
  if (blocked) preferential.push('desire-line-blockage: a column stands in the platform spine');
  else ok.push('platform spine clear of columns');
  // 3. entry-choke: fare-gate open width vs the concourse it feeds.
  const gateOpen = (flow.fareLine.x1 - flow.fareLine.x0);
  if (gateOpen < 4) preferential.push('entry-choke: fare line narrower than the concourse approach');
  else ok.push('fare line gives an ample paid/unpaid throat');
  return { ok, necessary, preferential, impairment: necessary.length > 0 };
}

// ── THE ESCALATOR KERNEL (new primitive) ──────────────────────────────────────
/**
 * One escalator: an inclined truss (deck + soffit + sides) climbing +y from
 * (yBot,zBot) to (yTop,zTop), cleated to read as moving steps, with a balustrade +
 * a moving-handrail band each side and a coloured nosing (green = up, amber = down).
 * Sibling to buildStairFlight; the codebase's first escalator.
 */
export function buildEscalator({ x0, x1, yBot, yTop, zBot, zTop, dir = 'up', light, balustrade = 'solid' }) {
  const faces = [];
  const d = 0.7;                                       // truss depth below the deck
  const nose = dir === 'up' ? TINT.escUp : TINT.escDown;
  // deck + soffit + sides + end caps (the truss solid)
  faces.push(quadFace([[x0, yBot, zBot], [x1, yBot, zBot], [x1, yTop, zTop], [x0, yTop, zTop]], TINT.escTruss, light, [0, -0.5, 0.87]));
  faces.push(quadFace([[x0, yBot, zBot - d], [x1, yBot, zBot - d], [x1, yTop, zTop - d], [x0, yTop, zTop - d]], TINT.escTruss, light, [0, 0.5, -0.87]));
  faces.push(quadFace([[x0, yBot, zBot - d], [x0, yTop, zTop - d], [x0, yTop, zTop], [x0, yBot, zBot]], TINT.escTruss, light, [-1, 0, 0]));
  faces.push(quadFace([[x1, yBot, zBot - d], [x1, yTop, zTop - d], [x1, yTop, zTop], [x1, yBot, zBot]], TINT.escTruss, light, [1, 0, 0]));
  faces.push(quadFace([[x0, yBot, zBot - d], [x1, yBot, zBot - d], [x1, yBot, zBot], [x0, yBot, zBot]], TINT.escTruss, light, [0, -1, 0]));
  faces.push(quadFace([[x0, yTop, zTop - d], [x1, yTop, zTop - d], [x1, yTop, zTop], [x0, yTop, zTop]], TINT.escTruss, light, [0, 1, 0]));
  // STEPS — a real sawtooth: horizontal TREAD + vertical RISER + a nosing-tinted lead edge, so the
  // steps read as steps from any angle (not flat stripes on the deck). Valleys sit on the deck line.
  const nStep = Math.max(8, Math.round((zTop - zBot) / 0.42));
  const dy = (yTop - yBot) / nStep, dz = (zTop - zBot) / nStep;
  for (let i = 0; i < nStep; i += 1) {
    const y0 = yBot + i * dy, y1 = y0 + dy, zLo = zBot + i * dz, zHi = zLo + dz;
    faces.push(quadFace([[x0, y0, zHi], [x1, y0, zHi], [x1, y1, zHi], [x0, y1, zHi]], TINT.escTread, light, [0, 0, 1]));         // tread
    faces.push(quadFace([[x0, y0, zLo], [x1, y0, zLo], [x1, y0, zHi], [x0, y0, zHi]], TINT.escRiser, light, [0, -1, 0]));        // riser
    faces.push(litFace([[x0, y0, zHi + 0.015], [x1, y0, zHi + 0.015], [x1, y0 + 0.13, zHi + 0.015], [x0, y0 + 0.13, zHi + 0.015]], shadeHex(nose, [0, 0, 1], light)));  // nosing
  }
  // balustrades (solid metal, or optional GLASS) + a moving-handrail band each side
  const balH = 1.0;
  for (const xs of [x0, x1]) {
    const nx = xs === x0 ? -1 : 1;
    if (balustrade === 'glass') {
      faces.push({ corners: [[xs, yBot, zBot], [xs, yTop, zTop], [xs, yTop, zTop + balH], [xs, yBot, zBot + balH]], fill: 'rgba(205,228,235,0.16)', normal: [nx, 0, 0], doubleSided: true, water: true });
    } else {
      faces.push(quadFace([[xs, yBot, zBot], [xs, yTop, zTop], [xs, yTop, zTop + balH], [xs, yBot, zBot + balH]], TINT.escBalustrade, light, [nx, 0, 0]));
    }
    faces.push(quadFace([[xs, yBot, zBot + balH], [xs, yTop, zTop + balH], [xs + nx * 0.14, yTop, zTop + balH], [xs + nx * 0.14, yBot, zBot + balH]], TINT.escRail, light, [0, 0, 1]));
  }
  return faces;
}

/** A glass elevator shaft spanning both levels, with a cab + doors facing the concourse. */
function buildElevator({ x0, x1, y0, y1, zLo, zHi, light }) {
  const faces = [];
  // glazed shaft walls — translucent (water pass), so the cab reads through the glass
  for (const [ax0, ax1, ay0, ay1] of [[x0, x0, y0, y1], [x1, x1, y0, y1], [x0, x1, y1, y1]]) {
    faces.push({ corners: [[ax0, ay0, zLo], [ax1, ay1, zLo], [ax1, ay1, zHi], [ax0, ay0, zHi]], fill: 'rgba(182,210,230,0.4)', water: true, doubleSided: true });
  }
  for (const f of boxFaces(x0 + 0.12, x1 - 0.12, y0 + 0.12, y1 - 0.12, zLo + 0.04, zLo + 2.4, TINT.evCab, light)) faces.push(f);
  for (const f of boxFaces(x0, x1, y0 - 0.12, y0, zHi, zHi + 0.4, TINT.evRoof, light)) faces.push(f);   // hoistway head
  // landing doors (lighter panels) facing the concourse (−y) at each level
  for (const z of [zLo, zHi]) faces.push(quadFace([[x0 + 0.2, y0 - 0.02, z + 0.05], [x1 - 0.2, y0 - 0.02, z + 0.05], [x1 - 0.2, y0 - 0.02, z + 2.2], [x0 + 0.2, y0 - 0.02, z + 2.2]], TINT.evDoor, light, [0, -1, 0]));
  return faces;
}

/**
 * The FARE BARRIER — a continuous paid/unpaid line spanning the whole concourse
 * (fp.x0 → fp.x1) so the path to the stairs is FULLY GATED: the only ways through are
 * the turnstile lanes (waist paddles) and one wide accessible gate (a swing arm).
 * Everything else is fixed waist-high railing; the operator booth sits on the line.
 * @returns { faces, boothCenterX } — where the operator booth should straddle the line.
 */
function buildFareBarrier({ fp, y, z, band, light, turnstiles = 5 }) {
  const faces = [];
  const railH = 1.0, railD = 0.2, postW = 0.42, laneW = 0.6, postD = 0.7;
  const n = Math.max(3, Math.min(8, turnstiles | 0));
  const bankW = (n + 1) * postW + n * laneW;
  const bankX1 = Math.min(fp.x1 - 2.4, 16.5), bankX0 = bankX1 - bankW;     // turnstile bank, center-east
  const gateW = 1.3, gateX1 = bankX0, gateX0 = gateX1 - gateW;             // accessible gate, just west of the bank
  const boothCenterX = gateX0 - 1.7;                                       // booth sits on the west railing
  const railing = (x0, x1) => { for (const f of boxFaces(x0, x1, y - railD / 2, y + railD / 2, z, z + railH, TINT.fareRail, light)) faces.push(f); };
  const lamp = (x0, x1) => faces.push(litFace([[x0 + 0.05, y - postD / 2, z + 1.0], [x1 - 0.05, y - postD / 2, z + 1.0], [x1 - 0.05, y - postD / 2, z + 1.04], [x0 + 0.05, y - postD / 2, z + 1.04]], TINT.gateLamp, '0 0 8px 2px rgba(57,217,138,0.5)'));

  // fixed railings: west wall → accessible gate, and turnstile bank → east wall
  railing(fp.x0, gateX0);
  railing(bankX1, fp.x1);
  // accessible gate: a cabinet post + an angled swing arm spanning the lane
  for (const f of boxFaces(gateX0, gateX0 + 0.16, y - 0.35, y + 0.35, z, z + 1.0, TINT.gateCab, light)) faces.push(f);
  lamp(gateX0, gateX0 + 0.16);
  faces.push(quadFace([[gateX0 + 0.16, y, z + 0.45], [gateX0 + 1.25, y - 0.38, z + 0.45], [gateX0 + 1.25, y - 0.38, z + 0.92], [gateX0 + 0.16, y, z + 0.92]], TINT.gatePaddle, light, [0, 1, 0]));
  // turnstile bank: a cabinet post between each lane, a waist paddle across each lane
  let x = bankX0;
  for (let i = 0; i < n; i += 1) {
    for (const f of boxFaces(x, x + postW, y - postD / 2, y + postD / 2, z, z + 1.0, TINT.gateCab, light)) faces.push(f);
    lamp(x, x + postW);
    const lx0 = x + postW, lx1 = lx0 + laneW;
    for (const f of boxFaces(lx0 + 0.05, lx1 - 0.05, y - 0.1, y + 0.1, z + 0.55, z + 0.78, TINT.gatePaddle, light)) faces.push(f);
    x = lx1;
  }
  for (const f of boxFaces(x, x + postW, y - postD / 2, y + postD / 2, z, z + 1.0, TINT.gateCab, light)) faces.push(f);  // closing post
  lamp(x, x + postW);
  return { faces, boothCenterX };
}

// ── LEVEL 1: mezzanine / concourse plate ──────────────────────────────────────
function buildMezzanineLevel({ baseZ, height, flow, line, light, forWorld, roof = false }) {
  const faces = [];
  const fp = { x0: HALL.x0, x1: HALL.x1, y0: HALL.y0, y1: HALL.y1 };
  const slabTop = baseZ, ceilZ = baseZ + height;
  const band = LINE_BANDS[line] || LINE_BANDS.blue;

  // slab (with the void over the island) — marble walking surface
  for (const f of slabWithHole(fp, VOID, slabTop, MEZZ_DEFAULTS.slab, TINT.marbleFloor, TINT.slabSoffit, light, 'marble-carrara', 3)) faces.push(f);

  // perimeter walls — far (x1) wall + the far-end (y1) wall SPLIT around the street
  // mouth. Near (x0) wall omitted (forWorld) so the cutaway opens toward the camera.
  const wallH = ceilZ - slabTop, WTEX = 'tile-subway';   // brick-bond subway tile (≠ the square pillar tile)
  faces.push(tiledWall([[fp.x1, fp.y0, slabTop], [fp.x1, fp.y1, slabTop], [fp.x1, fp.y1, ceilZ], [fp.x1, fp.y0, ceilZ]], TINT.wallTile, light, [-1, 0, 0], fp.y1 - fp.y0, wallH, WTEX));
  const sx0 = flow.street.x - flow.street.width / 2, sx1 = flow.street.x + flow.street.width / 2;
  for (const [wx0, wx1] of [[fp.x0, sx0], [sx1, fp.x1]]) {
    if (wx1 - wx0 < 0.1) continue;
    faces.push(tiledWall([[wx0, fp.y1, slabTop], [wx1, fp.y1, slabTop], [wx1, fp.y1, ceilZ], [wx0, fp.y1, ceilZ]], TINT.wallTile, light, [0, -1, 0], wx1 - wx0, wallH, WTEX));
  }
  if (!forWorld) faces.push(tiledWall([[fp.x0, fp.y0, slabTop], [fp.x0, fp.y1, slabTop], [fp.x0, fp.y1, ceilZ], [fp.x0, fp.y0, ceilZ]], TINT.wallTile, light, [1, 0, 0], fp.y1 - fp.y0, wallH, WTEX));
  if (roof) faces.push(panelFace(fp.x0, fp.x1, fp.y0, fp.y1, ceilZ, TINT.ceiling, light, [0, 0, -1]));

  // station-name frieze band high on the far (x1) wall
  faces.push(litFace([[fp.x1 - 0.02, fp.y0 + 4, ceilZ - 1.4], [fp.x1 - 0.02, fp.y1 - 4, ceilZ - 1.4], [fp.x1 - 0.02, fp.y1 - 4, ceilZ - 0.6], [fp.x1 - 0.02, fp.y0 + 4, ceilZ - 0.6]], band));

  // void railing — open on the NORTH edge (y1) where the climb discharges onto the
  // concourse; railed on the other three edges.
  const rh = 0.95, rt = 0.16;
  for (const f of boxFaces(VOID.x0 - rt, VOID.x1 + rt, VOID.y0 - rt, VOID.y0, slabTop, slabTop + rh, TINT.railing, light)) faces.push(f);
  for (const f of boxFaces(VOID.x0 - rt, VOID.x0, VOID.y0, VOID.y1, slabTop, slabTop + rh, TINT.railing, light)) faces.push(f);
  for (const f of boxFaces(VOID.x1, VOID.x1 + rt, VOID.y0, VOID.y1, slabTop, slabTop + rh, TINT.railing, light)) faces.push(f);

  // FARE BARRIER — full-width paid/unpaid line so the path to the stairs is fully
  // gated; only the turnstiles + accessible gate pass through. The operator booth
  // straddles the line on the returned spot.
  const barrier = buildFareBarrier({ fp, y: flow.fareLine.y, z: slabTop, band, light, turnstiles: flow.fareLine.lanes });
  for (const f of barrier.faces) faces.push(f);

  // WAYFINDING pylon at the void head (concourse side), with ↑street / ↓trains panels
  const px = flow.cx, py = VOID.y1 + 1.2;
  for (const f of boxFaces(px - 0.12, px + 0.12, py - 0.12, py + 0.12, slabTop, slabTop + 3.0, TINT.pylon, light)) faces.push(f);
  faces.push(litFace([[px - 1.3, py - 0.02, slabTop + 2.2], [px + 1.3, py - 0.02, slabTop + 2.2], [px + 1.3, py - 0.02, slabTop + 2.95], [px - 1.3, py - 0.02, slabTop + 2.95]], TINT.signTo, '0 0 8px 1px rgba(40,120,210,0.4)'));
  faces.push(litFace([[px - 1.3, py + 0.02, slabTop + 2.2], [px + 1.3, py + 0.02, slabTop + 2.2], [px + 1.3, py + 0.02, slabTop + 2.95], [px - 1.3, py + 0.02, slabTop + 2.95]], band));

  // STRUCTURED DOODADS — workbench-built props, placed by flow.
  const cx = flow.cx, fareY = flow.fareLine.y, z = slabTop;
  const doodads = [
    // OPERATOR BOOTH — straddles the fare line, agent window facing the unpaid concourse
    { build: buildInfoKiosk, x: barrier.boothCenterX, y: fareY, z, facing: 'N', w: 2.5, d: 1.7, line: band },
    // TICKET-MACHINE bank against the east wall on the UNPAID side, facing the concourse
    ...[0, 1, 2, 3, 4].map((i) => ({ build: buildTicketMachine, x: fp.x1 - 0.6, y: 33 + i * 1.25, z, facing: 'W', line: band })),
    // benches on the paid side, sitters facing the gates
    { build: buildBench, x: cx - 2.6, y: 24.5, z, facing: 'N', len: 1.8 },
    { build: buildBench, x: cx + 2.6, y: 24.5, z, facing: 'N', len: 1.8 },
    // bins — more of them, by the gates / map / street
    { build: buildWasteBin, x: 7.6, y: 26, z },
    { build: buildWasteBin, x: 12.6, y: 41, z },
    { build: buildWasteBin, x: 16.4, y: 25.5, z },
    { build: buildWasteBin, x: 6.0, y: 33, z },
    { build: buildWasteBin, x: 16.2, y: 44, z },
    // WALL FURNISHINGS on the east wall (paid map riders read before descending) + posters
    { build: buildWallMap, x: fp.x1 - 0.12, y: 23.5, z: z + 1.3, facing: 'W', w: 2.6, h: 1.9, line: band },
    { build: buildPoster, x: fp.x1 - 0.12, y: 40, z: z + 1.7, facing: 'W', w: 1.0, h: 1.5, tint: '#b8452f' },
    { build: buildPoster, x: fp.x1 - 0.12, y: 43, z: z + 1.7, facing: 'W', w: 1.0, h: 1.5, tint: '#3f7d52' },
    // posters on the north end wall (unpaid, beside the street mouth)
    { build: buildPoster, x: 5, y: fp.y1 - 0.12, z: z + 1.7, facing: 'S', w: 1.1, h: 1.6, tint: '#c8772b' },
    { build: buildPoster, x: 9, y: fp.y1 - 0.12, z: z + 1.7, facing: 'S', w: 1.1, h: 1.6, tint: band },
    // wayfinding totems at the decision points (void head → exit, street → trains)
    { build: buildSignTotem, x: cx + 3, y: VOID.y1 + 2.4, z, facing: 'N', line: band },
    { build: buildSignTotem, x: flow.street.x - 2, y: fp.y1 - 3.5, z, facing: 'S', line: band },
  ];
  for (const f of concourseAssetFaces(doodads, light)) faces.push(f);

  // soft CONTACT shadows grounding the floor-standing doodads on the marble (the bar-world
  // look). Wall-mounted props (map/posters) have no floor contact → omitted. Expanded
  // half-extents per build type; the World draws each as a soft radial blob.
  const FOOT = new Map([[buildInfoKiosk, [1.7, 1.2, 0.32]], [buildTicketMachine, [0.5, 0.42, 0.3]], [buildBench, [1.2, 0.4, 0.3]], [buildWasteBin, [0.38, 0.38, 0.28]], [buildSignTotem, [0.2, 0.2, 0.24]]]);
  for (const d of doodads) { const f = FOOT.get(d.build); if (f) faces.push(contactShadowFace(d.x, d.y, f[0], f[1], slabTop + 0.02, f[2])); }

  return { faces, fp, slabTop, ceilZ };
}

// ── the mezzanine slab: footprint minus the void, as four border strips. The walking
//    surface opts into a tiled MARBLE texture (floorTex) with a world-XY repeat uv. ──
function slabWithHole(fp, hole, z, th, tint, soffit, light, floorTex, ts = 3) {
  const faces = [];
  const strips = [
    [fp.x0, fp.x1, fp.y0, hole.y0], [fp.x0, fp.x1, hole.y1, fp.y1],
    [fp.x0, hole.x0, hole.y0, hole.y1], [hole.x1, fp.x1, hole.y0, hole.y1],
  ];
  for (const [x0, x1, y0, y1] of strips) {
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3) continue;
    const top = panelFace(x0, x1, y0, y1, z, tint, light, [0, 0, 1]);
    if (floorTex) { top.texture = floorTex; top.textureLit = true; top.uv = [[x0 / ts, y0 / ts], [x1 / ts, y0 / ts], [x1 / ts, y1 / ts], [x0 / ts, y1 / ts]]; }
    faces.push(top);
    faces.push(panelFace(x0, x1, y0, y1, z - th, soffit, light, [0, 0, -1]));
  }
  faces.push(quadFace([[hole.x0, hole.y0, z - th], [hole.x1, hole.y0, z - th], [hole.x1, hole.y0, z], [hole.x0, hole.y0, z]], soffit, light, [0, -1, 0]));
  faces.push(quadFace([[hole.x0, hole.y1, z - th], [hole.x1, hole.y1, z - th], [hole.x1, hole.y1, z], [hole.x0, hole.y1, z]], soffit, light, [0, 1, 0]));
  faces.push(quadFace([[hole.x0, hole.y0, z - th], [hole.x0, hole.y1, z - th], [hole.x0, hole.y1, z], [hole.x0, hole.y0, z]], soffit, light, [-1, 0, 0]));
  faces.push(quadFace([[hole.x1, hole.y0, z - th], [hole.x1, hole.y1, z - th], [hole.x1, hole.y1, z], [hole.x1, hole.y0, z]], soffit, light, [1, 0, 0]));
  return faces;
}

// ── vertical circulation through the void (platform z=0 → mezzanine baseZ) ─────
function buildCirculation({ platformZ, mezzZ, flow, light }) {
  const faces = [];
  const c = flow.climb;
  // ESCALATORS — an up/down pair
  for (const f of buildEscalator({ ...c.escUp, zBot: platformZ, zTop: mezzZ, light })) faces.push(f);
  for (const f of buildEscalator({ ...c.escDown, zBot: platformZ, zTop: mezzZ, light })) faces.push(f);
  // STAIR — a real straight flight climbing +y onto the concourse edge
  const stair = buildStairFlight({
    anchor: [c.stair.anchorX, c.stair.anchorY], direction: c.stair.dir,
    width: c.stair.x1 - c.stair.x0, going: STAIR_DEFAULTS.going, riser: STAIR_DEFAULTS.riser,
    baseZ: platformZ, totalRise: mezzZ - platformZ, treadTint: TINT.treadTint, riserTint: TINT.riserTint, light,
    maxRun: (VOID.y1 - c.stair.anchorY) * 0.96,
  });
  for (const f of stair.faces) faces.push(f);
  // ELEVATOR — glass shaft spanning both levels
  for (const f of buildElevator({ ...c.elevator, zLo: platformZ, zHi: mezzZ, light })) faces.push(f);
  return { faces, stair };
}

// ── THE STACK ─────────────────────────────────────────────────────────────────
/**
 * Stack the subway into a 2-level building over one shared circulation void.
 * @param recipe { seed, line, density, cars, mezzanine:{gates,height,roof} }
 * @returns { meru, levels, circulation, flow, assessment, faces, footprint, voidRect, stats }
 */
export function stackSubway(recipe = {}, { forWorld = false } = {}) {
  const light = makeLight({ direction: [0.22, 0.34, -0.9], ambient: 0.6, diffuse: 0.42 });
  const mezz = { ...MEZZ_DEFAULTS, ...(recipe.mezzanine || {}) };
  const line = recipe.line && LINE_BANDS[recipe.line] ? recipe.line : 'blue';

  const meru = houseMeru({ groundZ: HALL.zPlat });
  const resolved = meru.resolveStack([
    { index: 0, height: HALL.zCeil - HALL.zPlat },
    { index: 1, height: mezz.height },
  ]);
  const platformZ = resolved[0].floorZ, mezzZ = resolved[1].floorZ;

  // PATHS — lay out the circulation by the desire lines, then diagnose them.
  const flow = planSubwayFlow({ mezzZ });
  flow.fareLine.lanes = mezz.gates;
  const assessment = assessSubwayFlow(flow);

  // LEVEL 0 — today's hall, composed; void punched through its ceiling, lifted by baseZ.
  // exclude platform columns inside the void so none pokes through the circulation.
  const station = planSubwayStation({ ...recipe, line, columnExclude: VOID }, { forWorld });
  const platformFaces = liftFaces(punchCeiling(station.faces, VOID, HALL.zCeil), platformZ);

  // LEVEL 1 — mezzanine concourse plate.
  const mezzanine = buildMezzanineLevel({ baseZ: mezzZ, height: mezz.height, flow, line, light, forWorld, roof: mezz.roof });

  // circulation bridges the two levels (climbs in the lower volume).
  const circulation = buildCirculation({ platformZ, mezzZ, flow, light });

  const levels = [
    { index: 0, kind: 'platform', baseZ: platformZ, height: HALL.zCeil - HALL.zPlat, faces: platformFaces },
    { index: 1, kind: 'mezzanine', baseZ: mezzZ, height: mezz.height, faces: mezzanine.faces },
  ];
  const faces = [...platformFaces, ...mezzanine.faces, ...circulation.faces];
  const footprint = { x0: HALL.x0, x1: HALL.x1, y0: HALL.y0, y1: HALL.y1 };
  return {
    meru, levels, circulation, flow, assessment, faces, footprint, voidRect: VOID,
    stats: {
      faces: faces.length, levels: levels.length, mezzZ, line,
      gates: Math.max(2, Math.min(8, (mezz.gates | 0) || MEZZ_DEFAULTS.gates)),
      escalators: 2, elevators: 1,
      flow: { impairment: assessment.impairment, faults: [...assessment.necessary, ...assessment.preferential] },
      station: station.stats,
    },
  };
}

// ── view / emit — mirror floorplan-building's assemblers ───────────────────────
function subwayBuildingCameras(fp, zMin, zMax) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zMax - zMin);
  return [
    { name: 'cutaway', worldFraming: { cameraPosition: [fp.x0 - 0.8 * w, fp.y0 - 0.25 * d, zMax + 0.5 * span], lookAt: [cx, cy * 0.55, (zMin + zMax) / 2], horizontalFov: 70 } },
    { name: 'aerial', worldFraming: { cameraPosition: [cx - 0.12 * w, fp.y0 - 0.85 * d, zMax + 1.0 * span], lookAt: [cx, cy, (zMin + zMax) / 2], horizontalFov: 60 } },
  ];
}

/**
 * The traversable-World payload. `opts.explode` (feet) lifts the mezzanine (and the
 * circulation it shares) so both levels read at once, mirroring the building's view.
 */
export function assembleSubwayBuildingScene(recipe = {}, opts = {}) {
  if (recipe.layout === 'interchange') return assembleSubwayInterchangeScene(recipe, opts);
  const stack = stackSubway(recipe, { forWorld: true });
  const gap = opts.explode || 0;
  let faces = stack.faces;
  if (gap) {
    faces = [];
    for (const lvl of stack.levels) for (const f of liftFaces(lvl.faces, lvl.index * gap)) faces.push(f);
    for (const f of stack.circulation.faces) faces.push(f);
  }
  const fp = stack.footprint;
  // OPT-IN atmospheric (traced-diffusion) relight: dark base + ceiling-fixture light pools +
  // cast shadows, baked per level. Applies to the flush stack (skipped under explode).
  const atmosphere = recipe.atmosphere ?? opts.atmosphere;
  if (atmosphere && !gap) {
    const mezzZ = stack.stats.mezzZ, ceilZ = stack.levels[1].baseZ + stack.levels[1].height;
    faces = applyAtmosphere(faces, [
      { floorZ: HALL.zPlat, zMax: mezzZ - 0.5, sources: platformLightSources({ zCeil: HALL.zCeil, yEnd: HALL.y1 }) },
      { floorZ: mezzZ, zMin: mezzZ - 0.5, sources: concourseLightSources({ mezzZ, ceilZ }) },
    ], typeof atmosphere === 'object' ? atmosphere : {});
  }
  let zMin = Infinity, zMax = -Infinity;
  for (const f of faces) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
  const viewBox = recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1200, height: 840 };
  const cameras = (opts.cameras || subwayBuildingCameras(fp, zMin, zMax)).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  return {
    faces, cameras, viewBox,
    title: recipe.title || 'mojulo subway',
    bg: recipe.bg || (atmosphere ? '#06060a' : '#0c0e12'),
    textures: collectFaceTextures(faces),   // tiled pillars + marble floor → multiply-lit in /world
    walk: opts.walk === false ? false : { eye: HALL.zPlat + 5.4, spawn: [(fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2] },
    subway: stack,
  };
}

// ── INTERCHANGE — two perpendicular platforms on two levels (Bloor-Yonge / St George) ──────────
/**
 * Punch a rectangular hole through ALL horizontal faces at height z that overlap it (unlike
 * punchCeiling, which only holes one full-hall quad). Each overlapping floor quad is clipped into
 * up to four border strips — so a multi-piece platform floor gets a real, walk-through opening.
 */
function punchFloorFaces(faces, hole, z, tol = 0.15) {
  const out = [];
  for (const f of faces) {
    const flat = f.corners.length === 4 && f.corners.every((c) => Math.abs(c[2] - f.corners[0][2]) < 1e-4);
    const fz = flat ? f.corners[0][2] : null;   // the face's OWN height (floor finishes sit a few mm proud)
    if (fz === null || Math.abs(fz - z) > tol) { out.push(f); continue; }
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (hole.x1 <= x0 || hole.x0 >= x1 || hole.y1 <= y0 || hole.y0 >= y1) { out.push(f); continue; }   // no overlap
    const hx0 = Math.max(x0, hole.x0), hx1 = Math.min(x1, hole.x1), hy0 = Math.max(y0, hole.y0), hy1 = Math.min(y1, hole.y1);
    const strip = (ax0, ax1, ay0, ay1) => {
      if (ax1 - ax0 < 1e-3 || ay1 - ay0 < 1e-3) return;
      out.push({ ...f, texture: undefined, uv: undefined, corners: [[ax0, ay0, fz], [ax1, ay0, fz], [ax1, ay1, fz], [ax0, ay1, fz]] });
    };
    strip(x0, x1, y0, hy0); strip(x0, x1, hy1, y1); strip(x0, hx0, hy0, hy1); strip(hx1, x1, hy0, hy1);
  }
  return out;
}

/** Glass balustrade around a stairwell opening at floor level z, OPEN on `openEdge` ('N'|'S'|'E'|'W'). */
function railOpening(hole, z, openEdge) {
  const out = [];
  const top = z + 1.05, G = 'rgba(205,228,235,0.16)', RAIL = '#8f959c';
  const panel = (ax, ay, bx, by, nrm) => out.push({ corners: [[ax, ay, z], [bx, by, z], [bx, by, top], [ax, ay, top]], fill: G, normal: nrm, doubleSided: true, water: true });
  const bar = (x0, x1, y0, y1) => out.push({ corners: [[x0, y0, top], [x1, y0, top], [x1, y1, top], [x0, y1, top]], fill: RAIL, normal: [0, 0, 1], doubleSided: true });
  if (openEdge !== 'W') { panel(hole.x0, hole.y0, hole.x0, hole.y1, [-1, 0, 0]); bar(hole.x0 - 0.07, hole.x0 + 0.07, hole.y0, hole.y1); }
  if (openEdge !== 'E') { panel(hole.x1, hole.y0, hole.x1, hole.y1, [1, 0, 0]); bar(hole.x1 - 0.07, hole.x1 + 0.07, hole.y0, hole.y1); }
  if (openEdge !== 'S') { panel(hole.x0, hole.y0, hole.x1, hole.y0, [0, -1, 0]); bar(hole.x0, hole.x1, hole.y0 - 0.07, hole.y0 + 0.07); }
  if (openEdge !== 'N') { panel(hole.x0, hole.y1, hole.x1, hole.y1, [0, 1, 0]); bar(hole.x0, hole.x1, hole.y1 - 0.07, hole.y1 + 0.07); }
  return out;
}

/** Rotate faces +90° about the vertical axis through (cx,cy): the N-S hall becomes an E-W hall. */
function rotateFacesZ90(faces, cx, cy) {
  const r = (p) => [cx + (p[1] - cy), cy - (p[0] - cx), p[2]];
  return faces.map((f) => ({
    ...f,
    corners: f.corners.map(r),
    ...(Array.isArray(f.normal) ? { normal: [f.normal[1], -f.normal[0], f.normal[2]] } : {}),
  }));
}

/**
 * An escalator that climbs along the X axis (built from the shared +y kernel, then rotated), so it
 * runs ALONG the E-W platform's long axis and riders step off onto the platform — not the tracks.
 * Climbs from xBot→xTop (either direction) at y=yMid, over the given width.
 */
function escalatorX({ xBot, xTop, yMid, width, zBot, zTop, dir = 'up', light, balustrade }) {
  const s = Math.sign(xTop - xBot) || 1;
  const local = buildEscalator({ x0: -width / 2, x1: width / 2, yBot: 0, yTop: Math.abs(xTop - xBot), zBot, zTop, dir, light, balustrade });
  return local.map((f) => ({
    ...f,
    corners: f.corners.map((p) => [xBot + s * p[1], yMid - p[0], p[2]]),
    ...(Array.isArray(f.normal) ? { normal: [s * f.normal[1], -f.normal[0], f.normal[2]] } : {}),
  }));
}

/**
 * Feng-shui / traversability check for the interchange transfer — is the crossing actually walkable?
 * Reports in movement-flow's shared fault vocabulary (like assessSubwayFlow): can you ride between
 * the two lines, does the bank land on the platform (not the tracks), does it discharge into platform
 * depth (not toward the live track — the poison-arrow rule), and can through-traffic still pass.
 */
export function assessInterchangeFlow(g) {
  const ok = [], necessary = [], preferential = [];
  const { escXBot, escXTop, escYmids, escZTop, island, upIsland, upTracks } = g;
  const run = escXTop - escXBot;
  // 1. CROSS-PLATFORM TRANSFER — both escalator ends on walkable platform (the whole point)
  const bottomOnLower = escXBot >= island.x0 - 0.01 && escXBot <= island.x1 + 0.01;
  const topOnUpper = escXTop >= upIsland.x0 && escXTop <= upIsland.x1 && escYmids.every((y) => y >= upIsland.y0 && y <= upIsland.y1);
  (bottomOnLower && topOnUpper ? ok : necessary).push(bottomOnLower && topOnUpper
    ? 'cross-platform transfer: the escalator bank links the lower N-S platform to the upper E-W platform — you can ride between the two lines'
    : 'cross-platform transfer BROKEN: an escalator end sits off a walkable platform');
  // 2. LANDING clear of the track troughs
  const onTrack = upTracks.some((t) => escYmids.some((y) => y > t.y0 && y < t.y1));
  (!onTrack ? ok : necessary).push(!onTrack
    ? 'landing clear of tracks: the bank lands on the island, not in a track trough'
    : 'landing fouls a track: an escalator top lands in a track zone');
  // 3. DISCHARGE not aimed at the near platform edge / track (the poison-arrow rule)
  const hugsWest = escXBot - island.x0 < 1.2;
  (!hugsWest ? ok : preferential).push(!hugsWest
    ? 'discharge has platform depth ahead of it, not the track edge'
    : 'discharge hugs the west edge — the down bank sets riders down hard against the track side; nudge it east (feng-shui: never discharge toward the live track)');
  // 4. THROUGH-TRAFFIC can pass the bank — a clear lane WEST of the foot, or walk-under on the east
  const clearX = escXBot + (2.6 / escZTop) * run;   // where the raised soffit clears head height (~2u)
  const laneEast = island.x1 - clearX, laneWest = escXBot - island.x0;
  const lane = Math.max(laneWest, laneEast);
  (lane > 1.5 ? ok : preferential).push(lane > 1.5
    ? `platform spine passable: north-south through-traffic uses the ~${lane.toFixed(1)}u clear lane beside the bank`
    : 'platform spine pinched: no clear lane past the bank');
  return { ok, necessary, preferential, traversable: necessary.length === 0, impairment: necessary.length * 10 + preferential.length * 3 };
}

/**
 * A perpendicular INTERCHANGE: the standard N-S platform on the lower level, a second station
 * ROTATED 90° into an E-W platform stacked above it, a crossing void punched through the lower
 * ceiling AND the upper floor where the lines cross, and an escalator pair bridging the two
 * platforms. Two lines, two trains, crossing at right angles — Toronto's Bloor-Yonge / St George.
 *
 * @returns {{ faces, footprint, dz, cross, lineA, lineB, assessment, stats }}
 */
export function planSubwayInterchange(recipe = {}, { forWorld = false } = {}) {
  const light = makeLight({ direction: [0.22, 0.34, -0.9], ambient: 0.6, diffuse: 0.42 });
  const lineA = recipe.line && LINE_BANDS[recipe.line] ? recipe.line : 'green';
  const lineB = recipe.lineB && LINE_BANDS[recipe.lineB] ? recipe.lineB : (lineA === 'orange' ? 'blue' : 'orange');
  const cx = (HALL.x0 + HALL.x1) / 2, cy = (HALL.y0 + HALL.y1) / 2;   // hall centre (10, 23)
  const dz = HALL.zCeil + 3.5;                                        // wider gap → the escalators land cleanly, with room
  const zTop = dz + HALL.zPlat;

  // A clean, PARALLEL up/down escalator bank climbs along the upper island's LONG (x) axis: riders
  // land ON the platform (never the tracks), the two run side-by-side (no scissor), and they share
  // ONE stairwell opening + landing. The platform stays solid east of x=20 so you walk right onto it.
  // the bank's FOOT lands at x=10 — dead-centre of the lower island (x6–14) AND of the upper platform's
  // span (x−13…33) — so the down-stairs discharge squarely into the middle, not at the west edge.
  const uHole = { x0: 10, x1: 23.5, y0: cy - 3, y1: cy + 3 };         // stairwell opening in the upper floor
  const lHole = { x0: 10, x1: 18.9, y0: cy - 3, y1: cy + 3 };         // matching lower-ceiling opening
  const lowerClear = { x0: 7, x1: 23, y0: cy - 5, y1: cy + 5 };       // crossing zone kept clear of furniture (world)
  const upperClearLocal = { x0: 5, x1: 15, y0: 20, y1: 40 };          // same zone in the upper station's own frame
  const crossLocal = { x0: 5, x1: 15, y0: 18, y1: 40 };             // upper columns to skip

  // LOWER — N-S platform; punch its ceiling under the bank so the escalators read from below
  const lower = planSubwayStation({ ...recipe, line: lineA, columnExclude: lHole, furnishExclude: lowerClear }, { forWorld });
  const lowerFaces = punchCeiling(lower.faces, lHole, HALL.zCeil);

  // UPPER — a second station rotated 90° into an E-W platform, lifted; the stairwell hole clipped
  // through its (multi-piece) floor with punchFloorFaces.
  const upper = planSubwayStation({ ...recipe, seed: (recipe.seed ?? 1) + 7, line: lineB, columnExclude: crossLocal, furnishExclude: upperClearLocal }, { forWorld });
  let upperFaces = liftFaces(rotateFacesZ90(upper.faces, cx, cy), dz);
  upperFaces = punchFloorFaces(upperFaces, uHole, zTop);

  // ESCALATORS — a parallel UP/DOWN bank, both +x, landing together on the platform at x=20
  const escFaces = [
    ...escalatorX({ xBot: 10, xTop: 23.5, yMid: cy - 1.6, width: 2.4, zBot: HALL.zPlat, zTop, dir: 'up', light, balustrade: 'glass' }),
    ...escalatorX({ xBot: 10, xTop: 23.5, yMid: cy + 1.6, width: 2.4, zBot: HALL.zPlat, zTop, dir: 'down', light, balustrade: 'glass' }),
  ];
  // glass balustrade rings the opening, OPEN on the east landing edge so you walk onto the bank there
  const railFaces = railOpening(uHole, zTop, 'E');
  const cross = { x0: 4, x1: 21, y0: cy - 5, y1: cy + 5 };

  const faces = [...lowerFaces, ...upperFaces, ...escFaces, ...railFaces];
  const footprint = { x0: cx - (HALL.y1 - cy), x1: cx + (HALL.y1 - cy), y0: HALL.y0, y1: HALL.y1 };   // spans the E-W hall
  const assessment = assessInterchangeFlow({
    escXBot: 10, escXTop: 23.5, escYmids: [cy - 1.6, cy + 1.6], escZTop: zTop,
    island: { x0: ISLAND.x0, x1: ISLAND.x1 },                      // lower island x6–14
    upIsland: { x0: cx - (HALL.y1 - cy), x1: cx + (HALL.y1 - cy), y0: cy - 4, y1: cy + 4 },   // upper island y19–27
    upTracks: [{ y0: cy - 9, y1: cy - 4 }, { y0: cy + 4, y1: cy + 9 }],   // upper tracks y14–19, y27–32
  });
  return { faces, footprint, dz, cross, lineA, lineB, assessment, stats: { faces: faces.length, layout: 'interchange', lineA, lineB, escalators: 2, flow: assessment.impairment } };
}

/** The traversable-World payload for the perpendicular interchange. */
export function assembleSubwayInterchangeScene(recipe = {}, opts = {}) {
  const plan = planSubwayInterchange(recipe, { forWorld: true });
  const faces = plan.faces, fp = plan.footprint;
  let zMin = Infinity, zMax = -Infinity;
  for (const f of faces) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
  const viewBox = recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1300, height: 900 };
  const cameras = (opts.cameras || subwayBuildingCameras(fp, zMin, zMax)).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  return {
    faces, cameras, viewBox,
    title: recipe.title || 'mojulo subway interchange',
    bg: recipe.bg || '#0c0e12',
    textures: collectFaceTextures(faces),
    walk: opts.walk === false ? false : { eye: HALL.zPlat + 5.4, spawn: [(fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2] },
    interchange: plan,
  };
}

/** Render the stacked subway as a navigable three.js World. */
export function renderSubwayBuildingToThreeWorld(recipe = {}, opts = {}) {
  return emitThreeWorld(assembleSubwayBuildingScene(recipe, opts));
}

/** Render the stacked subway as a self-contained CSS-3D (preserve-3d) scene. */
export function renderSubwayBuildingToHtml(recipe = {}, opts = {}) {
  const { faces, cameras, viewBox, title, bg } = assembleSubwayBuildingScene(recipe, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale: opts.unitScale || 14, title, bg });
}

export { SUBWAY_LINES, HALL as SUBWAY_HALL, VOID as SUBWAY_VOID, buildFareBarrier };
