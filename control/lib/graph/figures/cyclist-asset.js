/**
 * cyclist-asset — the fractal-city "cyclist" vehicle: a workbench bicycle carrying a
 * posed, clothed protoform, baked ONCE into the shared `{corners,fill}` face currency
 * and cheaply transformed per placement.
 *
 * Unlike the swept/fuselage vehicle nets, the cyclist is a COMPOSITE of two existing
 * face producers — `workbenchAssetFaces` (the bike, in cm) and `renderFigureWorldFrames`
 * (the rider, figure-render units) — so it is authored as a baked asset, not a net.
 * The expensive figure mesh runs a single time per process (memoized); each city
 * instance is just a scale + heading-rotation + translate of the cached corners.
 *
 * Coordinates: authored in cm, z up, +x = forward (toward the front wheel), y the thin
 * lateral axis, centred on the wheelbase, wheel-contact at z=0 — so a heading rotation
 * about z spins it in place and it sits on the ground. The fractal-city world is z-up
 * with x/y the ground plane (ground tiles are {x,y,w,d,z}), so cm→units + rotate + place.
 *
 * Provenance / studies: lite-template/integration/0624/spike-output/cyclist/.
 */
import { workbenchAssetFaces } from '../worlds/workbench.js';
import { buildPosedFigure } from '../polygonizer/figure-render.js';
import { GARMENTS } from '../polygonizer/figure-garments.js';
import { makeLight, shadeHex, dot3, sub3, centroid } from '../polygonizer/vexar.js';

const TAU = Math.PI * 2;
const RED = '#c0392b', STEEL = '#9aa3b0', DARK = '#3a3a3a';

// cm → fractal-city units. The car convention is ~1.7 units for a ~450cm car
// (≈265 cm/unit); 1/265 puts the 172cm bike at ~0.65 units (≈0.38× a car). Tune here.
const UNIT_PER_CM = 1 / 265;

// figure-world → cm placement of the rider on the saddle (calibrated in the spike).
const FS = 66, FX = -3, FZ = 27;

// The full protoform mesh is ~50k faces — fine for a hero study, untenable for a
// REPEATED city ant (a car is ~362). So the rider is RE-MESHED at low density from
// its own structured ring-stacks: still the real posed, dressed protoform geometry,
// just coarse — invisible quality loss at ~40px, ~140× cheaper. These match the
// figure-render world transform (PROTO_SCALE/S) so the FS/FX/FZ seating still holds.
const PROTO_SCALE = 12, S = 1.95;
const FIG_LIGHT = makeLight({ direction: [0.42, -0.5, -0.76], ambient: 0.40, diffuse: 0.76 }); // == figure-render LIGHT
const FIG_MAX_RINGS = 5, FIG_MAX_SAMPLES = 7;
const SKIN = '#c8836a', TIGHTS = '#23262e';
// Ant "clothing" = a per-region TINT on the bare protoform (no garment stacks): the
// jersey colour on the upper body, tights on hips+legs, skin on head/hands/forearms/feet.
const SKIN_IDS = ['headEgg', 'faceMask', 'neck', 'forearm', 'hand', 'foot'];
const TIGHTS_IDS = ['leg', 'glute', 'diaper', 'groin', 'hipCap'];
const tintFor = (id) => SKIN_IDS.some((s) => id.startsWith(s)) ? SKIN : TIGHTS_IDS.some((s) => id.startsWith(s)) ? TIGHTS : RED;
const newell = (pts) => {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
};
const stride = (n, max) => Math.max(1, Math.floor(n / max));

// ── the bike (workbench polygomer, cm) ──────────────────────────────────────────
function spokedWheel(cx, { R = 33, Z = 34, spokes = 8 } = {}) {
  const ring = (rad, n) => Array.from({ length: n + 1 }, (_, i) => { const a = TAU * i / n; return [cx + rad * Math.cos(a), 0, Z + rad * Math.sin(a)]; });
  const sw = [
    { path: ring(R, 22), radius: 2.3, sides: 6, caps: false, tint: '#1b1b1b' },     // tire
    { path: ring(R - 2.6, 22), radius: 1.0, sides: 5, caps: false, tint: STEEL },   // rim
  ];
  for (let k = 0; k < spokes; k++) {
    const a = TAU * k / spokes;
    sw.push({ path: [[cx, 0, Z], [cx + (R - 3) * Math.cos(a), 0, Z + (R - 3) * Math.sin(a)]], radius: 0.32, sides: 4, caps: false, tint: '#c2c7cf' });
  }
  return {
    lathe: { axisFrom: { x: cx, y: -3, z: Z }, axisTo: { x: cx, y: 3, z: Z }, profile: [{ t: 0, radius: 3.2 }, { t: 1, radius: 3.2 }], tint: STEEL, samples: 8 },
    sweeps: sw,
  };
}

function bikeManifest() {
  const wRear = spokedWheel(-52), wFront = spokedWheel(52);
  const tube = (path, radius, tint) => ({ path, radius, tint, sides: 6 });
  return {
    lathes: [
      wRear.lathe, wFront.lathe,
      { axisFrom: { x: 0, y: -1.2, z: 27 }, axisTo: { x: 0, y: 1.2, z: 27 }, profile: [{ t: 0, radius: 9 }, { t: 1, radius: 9 }], tint: '#555', samples: 14 }, // chainring
    ],
    sweeps: [
      ...wRear.sweeps, ...wFront.sweeps,
      tube([[0, 0, 27], [-10, 0, 90]], 1.7, RED),             // seat tube
      tube([[0, 0, 27], [42, 0, 62]], 1.7, RED),             // down tube
      tube([[-10, 0, 88], [41, 0, 63]], 1.6, RED),           // top tube
      tube([[41, 0, 63], [52, 0, 34]], 1.3, STEEL),          // fork
      tube([[0, 0, 27], [-52, 0, 34]], 1.2, STEEL),          // chain stay
      tube([[-10, 0, 88], [-52, 0, 34]], 1.2, STEEL),        // seat stay
      tube([[41, 0, 63], [41, 0, 99]], 1.3, DARK),           // stem riser
      tube([[41, 0, 99], [31, 0, 99]], 1.5, DARK),           // handlebar grip
      tube([[0, 0, 27], [7, 0, 15]], 1.1, DARK),             // near crank → fwd pedal
      tube([[0, 0, 27], [-7, 0, 39]], 1.1, '#2c2c2c'),       // far crank → back pedal
      tube([[7, 0, 24], [-52, 0, 32]], 0.5, '#1a1a1a'),      // chain
    ],
    extrudes: [
      { profile: { rect: { w: 26, h: 7, r: 3 } }, axisFrom: { x: -10, y: 0, z: 90 }, axisTo: { x: -10, y: 0, z: 93 }, tint: '#1a1a1a' }, // saddle
      { profile: { rect: { w: 9, h: 4, r: 1 } }, axisFrom: { x: 7, y: 0, z: 14 }, axisTo: { x: 7, y: 0, z: 14.5 }, tint: '#222' },       // fwd pedal
      { profile: { rect: { w: 9, h: 4, r: 1 } }, axisFrom: { x: -7, y: 0, z: 39 }, axisTo: { x: -7, y: 0, z: 39.5 }, tint: '#222' },     // back pedal
    ],
  };
}

// ── the rider (figure primitive) ────────────────────────────────────────────────
export const CYCLIST_POSE = {
  spine: { sagittal: 0.5 },
  shL: { pitch: 58, yaw: 5 }, shR: { pitch: 58, yaw: 5 },
  elbowL: 22, elbowR: 22,
  wristL: { flex: 12 }, wristR: { flex: 12 }, fingersL: 70, fingersR: 70,
  hipL: { pitch: 102 }, hipR: { pitch: 95 },
  kneeL: 82, kneeR: 118, ankleL: 8, ankleR: 0,
  head: { pitch: -14 },
};

// CYCLING KIT (svgile-row): the hips/seat get the `pelvis` golden-ratio basin
// (fully-interior hip girdle, no waist terminator to fray), each leg the `hug`
// shell — so hips + legs are fully covered. Thin base-hug layers in the kit colours
// back the standoff pieces, so a deep-fold gap shows fabric not skin.
const CYCLIST_KIT_KEY = 'cyclistKit';
export const CYCLIST_KIT = {
  id: 'cyclistKit', color: { cloth: '#23262e', under: '#15171c' },
  pieces: [
    { coverage: ['torso'], fit: 'hug', thickness: 0.035, cloth: RED },                     // jersey base
    { coverage: ['hips', 'seat', 'legs'], fit: 'hug', thickness: 0.035, cloth: '#23262e' }, // tights base
    { fit: 'pelvis', clearance: 0.12, cloth: '#23262e' },                                  // hip basin
    { coverage: ['legL'], fit: 'hug', thickness: 0.10, cloth: '#23262e', taperEnds: { leg: 'tail' } },
    { coverage: ['legR'], fit: 'hug', thickness: 0.10, cloth: '#23262e', taperEnds: { leg: 'tail' } },
    { coverage: ['torso'], fit: 'hull', clearance: 0.24, cloth: RED },                     // jersey
    { coverage: ['upperArms'], fit: 'hug', thickness: 0.09, cloth: RED },
  ],
};

// Re-mesh the posed, dressed protoform at LOW density from its ring-stacks (the LOD
// proxy). Outer cloth + flesh only (drop the thin :under: shells), each stack sub-
// sampled to ≤ FIG_MAX_RINGS × FIG_MAX_SAMPLES quads, vexar-lit. Coords match the
// figure-render world transform so FS/FX/FZ seat it identically to the hero render.
function lowPolyFigureFaces() {
  const stacks = buildPosedFigure(CYCLIST_POSE, {}, null);   // BARE protoform; clothing is a per-region tint
  let minZ = Infinity;
  for (const st of stacks) for (const rg of st.rings) for (const q of rg.polyline) { const z = q.z / PROTO_SCALE; if (z < minZ) minZ = z; }
  const V = (q) => [(q.x / PROTO_SCALE) * S, (q.y / PROTO_SCALE) * S, ((q.z / PROTO_SCALE) - minZ) * S + 0.02];
  const faces = [];
  for (const st of stacks) {
    const rings = st.rings; if (rings.length < 2) continue;
    const rs = stride(rings.length - 1, FIG_MAX_RINGS);
    const idx = [];
    for (let i = 0; i < rings.length; i += rs) idx.push(i);
    if (idx[idx.length - 1] !== rings.length - 1) idx.push(rings.length - 1);
    for (let k = 0; k < idx.length - 1; k++) {
      const ra = rings[idx[k]], rb = rings[idx[k + 1]];
      const a = ra.polyline, b = rb.polyline, m = Math.min(a.length, b.length); if (m < 2) continue;
      const ss = stride(m - 1, FIG_MAX_SAMPLES);
      const c0 = ra.center, c1 = rb.center;
      const cw = V({ x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2, z: (c0.z + c1.z) / 2 });
      for (let j = 0; j + 1 < m; j += ss) {
        const j2 = Math.min(j + ss, m - 1); if (j2 === j) continue;
        const wpts = [V(a[j]), V(a[j2]), V(b[j2]), V(b[j])];
        let n = newell(wpts); const cen = centroid(wpts);
        if (dot3(n, sub3(cen, cw)) < 0) n = [-n[0], -n[1], -n[2]];
        faces.push({ corners: wpts, fill: shadeHex(tintFor(st.id), n, FIG_LIGHT) });
      }
    }
  }
  return faces;
}

// ── bake (memoized) ─────────────────────────────────────────────────────────────
let _bakedCm = null;

/** Compose bike + rider into one cm-space face list (z up, +x forward), centred on
 *  the wheelbase, ground at z=0. Memoized — the figure mesh runs once per process. */
export function bakeCyclistCm() {
  if (_bakedCm) return _bakedCm;
  if (!GARMENTS[CYCLIST_KIT_KEY]) GARMENTS[CYCLIST_KIT_KEY] = CYCLIST_KIT;   // register the tailored kit

  const bikeFaces = workbenchAssetFaces(bikeManifest(), { scale: 1 });        // cm
  const figFaces = lowPolyFigureFaces();                                      // figure-render units, faces +y

  // rotate the figure -90° about z (front +y → +x), scale to cm, seat on the saddle.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, minZ = Infinity;
  for (const f of figFaces) for (const [x, y, z] of f.corners) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const fcx = (minX + maxX) / 2, fcy = (minY + maxY) / 2;
  const seat = figFaces.map((f) => ({
    fill: f.fill,
    corners: f.corners.map(([x, y, z]) => [(y - fcy) * FS + FX, -(x - fcx) * FS, (z - minZ) * FS + FZ]),
  }));

  _bakedCm = [...bikeFaces, ...seat];
  return _bakedCm;
}

/** Heading (radians about z) for an axis/dir travel pose. +x is the asset's forward. */
function headingFor(axis, dir) {
  if (axis === 'y') return dir >= 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir >= 0 ? 0 : Math.PI;
}

/**
 * Build a cyclist instance as fractal-city faces: the baked cm asset scaled to city
 * units, rotated to face its travel direction, and placed at (cx,cy) on the ground.
 * @returns {Array<{corners:number[][], fill:string, doubleSided:boolean}>}
 */
export function cyclistFaces({ cx = 0, cy = 0, axis = 'x', dir = 1, heading, scale = 1 } = {}) {
  const baked = bakeCyclistCm();
  const u = UNIT_PER_CM * scale;
  const th = Number.isFinite(heading) ? heading : headingFor(axis, dir);
  const ct = Math.cos(th), st = Math.sin(th);
  return baked.map((f) => ({
    fill: f.fill,
    doubleSided: true,
    corners: f.corners.map(([x, y, z]) => {
      const px = x * u, py = y * u;                         // cm → units (z stays up)
      return [cx + px * ct - py * st, cy + px * st + py * ct, z * u];
    }),
  }));
}
