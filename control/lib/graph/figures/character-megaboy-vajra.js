/**
 * character-megaboy-vajra — mega-boy as a FIGURE-VAJRA (the wave-form ring primitive), not the
 * stacked-cylinder warp of character-mega-boy.js. Same vajra substrate as docs/figure-vajra.md:
 * figureVajraSpecs over the landmark nodes, sampled by sampleVajra into the lightbulb-prong ring-form
 * (fat bead + thin neck, smooth-unioned, ball-in-socket at the limb roots). mega-boy is reached by a
 * RE-GIRTHED radii map (the documented `radii` override) — broad shoulders, thick biceps + thighs, a
 * big helmet head — plus a lengthened forearm, ear-pods, and a skin face.
 *
 * Lifted (and pose-parametrized) from figure-megaboy-vajra.spike.gen.test.js so the world/control
 * spikes can bake it as figure-frames. Returns `{corners, fill}` faces — the renderer's frame shape.
 * Figure units (~1 unit tall, head at z≈0.885); the world spike normalizes to a human ~1.8.
 */

import { articulate, figureVajraSpecs, FIGURE_RADII } from '../polygonizer/figure-vajra.js';
import { sampleVajra } from '../polygonizer/vajra.js';

// ── vec helpers on {x,y,z} ──
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a) => Math.hypot(a.x, a.y, a.z) || 1;
const norm = (a) => mul(a, 1 / len(a));

// MEGA-BOY re-girth: multipliers/radii on the canonical FIGURE_RADII so the proportions move
// without touching the armature (the documented figure-vajra `radii` override).
export const MEGABOY_RADII = {
  ...FIGURE_RADII,
  headTop: 0.082,    // big helmet dome (was 0.046)
  headBase: 0.052,   // fuller skull base
  neckHub: 0.068,    // filled upper torso, bridges up to the shoulder girdle (was 0.040)
  navel: 0.098,      // broad filled chest/belly — torso spans out toward the shoulders (was 0.052)
  pelvisHub: 0.050,  // hips unchanged — core fill tapers back to the original waist here
  shoulderL: 0.032, shoulderR: 0.032,   // shoulder tucked well under the biceps (was 0.052 → 0.038 → 0.032)
  elbowL: 0.032, elbowR: 0.032,         // arms 20% narrower — proportionate, no torso overlap (was 0.040)
  wristL: 0.024, wristR: 0.024,         // arms 20% narrower (was 0.030)
  hipL: 0.027, hipR: 0.027,             // hip tucked well under the thigh (was 0.044 → 0.032 → 0.027)
  kneeL: 0.046, kneeR: 0.046,           // THICK thighs (was 0.024)
  ankleL: 0.032, ankleR: 0.032,
};

const TINT = { suit: [47, 127, 214], helmet: [44, 110, 200], skin: [243, 201, 160], trim: [206, 224, 240] };

// sphere as a latitude/longitude ring-stack (ear-pods + the skin face).
const sphereStack = (c, r, { N = 12, M = 24 } = {}) => {
  const rings = [];
  for (let i = 0; i < N; i++) {
    const v = Math.PI * (i / (N - 1) - 0.5), cz = c.z + r * Math.sin(v), rr = r * Math.cos(v);
    const poly = [];
    for (let j = 0; j <= M; j++) { const a = (j / M) * Math.PI * 2; poly.push({ x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a), z: cz }); }
    rings.push({ center: { x: c.x, y: c.y, z: cz }, polyline: poly });
  }
  return rings;
};

// build the mega-boy figure-vajra as tagged ring-stacks from a pose (dof). dof === {} → neutral stand.
function buildMegaBoyVajraStacks(dof = {}) {
  const P = articulate(dof);
  // lengthen the forearm a bit: drop the wrist further from the elbow along the bone.
  for (const s of ['L', 'R']) {
    const el = P['elbow' + s], wr = P['wrist' + s];
    P['wrist' + s] = add(el, mul(sub(wr, el), 1.22));
  }
  const stacks = [];
  const specs = figureVajraSpecs(P, MEGABOY_RADII);
  specs.forEach((sp, i) => {
    const { rings } = sampleVajra({
      proximal: sp.proximal, center: sp.center, distal: sp.distal,
      beads: { proximal: { radius: sp.rProximal }, center: { radius: sp.rCenter }, distal: { radius: sp.rDistal } },
      blend: sp.blend, crossSections: 28, samples: 36,
    });
    stacks.push({ id: 'edge' + i, rings, tint: i === 0 ? TINT.helmet : TINT.suit });
  });
  // helmet detail: ear-pods at the temples + a skin face poking off the front of the head, tracking
  // the head node so they re-pose with a turned head (head ring-form is the first edge → headTop node).
  const headC = { x: P.headTop.x, y: P.headTop.y, z: P.headTop.z };
  for (const s of [-1, 1]) stacks.push({ id: 'ear' + s, rings: sphereStack({ x: headC.x + s * 0.072, y: headC.y, z: headC.z - 0.004 }, 0.022), tint: TINT.trim });
  stacks.push({ id: 'face', rings: sphereStack({ x: headC.x, y: headC.y + 0.052, z: headC.z - 0.020 }, 0.044), tint: TINT.skin });
  return stacks;
}

// ── mesh ring-stacks → soft-lit quad faces (baked diffuse, camera-independent — matches the figure
// path's unlit MeshBasicMaterial + vertexColors). ──
const LIGHT = norm({ x: 0.35, y: 0.62, z: 0.70 });
function facesFromStacks(stacks) {
  const faces = [];
  for (const st of stacks) {
    const [br, bg, bb] = st.tint;
    for (let i = 0; i < st.rings.length - 1; i++) {
      const a = st.rings[i].polyline, b = st.rings[i + 1].polyline, m = Math.min(a.length, b.length);
      for (let j = 0; j < m - 1; j++) {
        const p0 = a[j], p1 = a[j + 1], p2 = b[j + 1], p3 = b[j];
        const n = norm(cross(sub(p1, p0), sub(p3, p0)));
        const g = 0.40 + 0.60 * Math.max(0, dot(n, LIGHT));
        faces.push({ corners: [p0, p1, p2, p3].map((q) => [q.x, q.y, q.z]), fill: `rgb(${Math.round(br * g)},${Math.round(bg * g)},${Math.round(bb * g)})` });
      }
    }
  }
  return faces;
}

/** Build the mega-boy-vajra figure for a pose as `{corners, fill}` faces (a render frame). */
export function buildMegaBoyVajraFaces(dof = {}) {
  return facesFromStacks(buildMegaBoyVajraStacks(dof));
}
