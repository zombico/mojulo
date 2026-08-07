/**
 * figure-animal-flesh — ONE flesh model, shared across every animal archetype.
 *
 * Not a per-animal sculpt. Flesh is a generic wrap of the armature GRAPH that every
 * archetype already emits (nodes + radii + chains, figure-animal.js): each bone is a
 * rounded tube, each joint a sphere, each chain its own swept tube — all overlapping
 * into one body the renderer depth-sorts. Round cones (not vajras) mean joints do NOT
 * pinch (the vajra's anti-flesh screw), so the body reads as muscle/skin, not beads.
 *
 * Driven only by the graph, so it works identically for a rodent, a sauropod, a
 * theropod, or a bird. Tuning is a small SHARED knob set (FLESH_DEFAULT):
 *   flesh     — global girth inflation (lean ↔ fat / volumize)
 *   thorax    — chest barrel: radius multiplier on the neckHub→navel bone (ribcage)
 *   belly     — abdomen barrel: radius multiplier on the navel→pelvisHub bone (gut)
 *   bellyDrop — how far the abdomen hangs below the spine line
 *   bulge     — mid-bone fullness on ALL bones (muscle between joints)
 *   jointFill — joint-sphere scale (how much limbs meld into the body)
 *   taper     — extra thinning at the extremities (paws / muzzle / wingtip)
 * layered ON TOP of the per-region `girth*` already baked into the radii map.
 *
 * The trunk's mass lives in the torso, not the spine joints, so thorax/belly default
 * ABOVE 1 — a deep-chested, big-bellied baseline that matches real creatures.
 *
 * Output is render parts `{polylines, stroke}` — the same shape the study's vajra
 * reads use — so the existing world-mesh mesher lights it unchanged. (A future
 * upgrade: weld with the exported `smin` field for true concave joint fillets;
 * this overlap-union is the cheap, in-idiom v1.)
 */
import { normalize3, sub3, cross3, FIGURE_EDGES } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp3 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);

export const FLESH_DEFAULT = {
  flesh: 1.2,        // global girth inflation over the armature radii
  thorax: 1.9,       // chest barrel — radius × on the neckHub→navel bone (deep ribcage)
  belly: 2.1,        // abdomen barrel — radius × on the navel→pelvisHub bone (gut)
  bellyDrop: 0.30,   // the abdomen hangs below the spine (× mid radius)
  rump: 1.9,         // hindquarter mass — radius × on the hip girdle + pelvis/hip joints,
                     //   sized to match the belly so the topline hugs belly→rump (no saddle)
  bulge: 0.30,       // mid-bone fullness on ALL bones (muscle between joints)
  jointFill: 1.15,   // joint-sphere scale → limbs meld into the body
  taper: 0.45,       // extremity thinning (leaf nodes: wrist/ankle/headTop/wingtip)
  N: 14, M: 22,      // rings per bone, points per ring
  stroke: '#c8836a',
};

// A cross-section frame ⟂ to a bone axis (stable seed; sphere-symmetric so the seam
// orientation is cosmetic).
function frame(axis) {
  let up = { x: 0, y: 0, z: 1 };
  let side = cross3(up, axis);
  if (vlen(side) < 1e-6) { up = { x: 1, y: 0, z: 0 }; side = cross3(up, axis); }
  side = normalize3(side);
  return { side, vert: normalize3(cross3(axis, side)) };
}

// A rounded tube swept a→b, radius lerped ra→rb with a mid-span `bulge`. `drop`
// sags the tube below its axis (the abdomen hangs), peaking at mid-span.
function boneTube(a, b, ra, rb, c, { drop = 0 } = {}) {
  const ab = sub3(b, a);
  if (vlen(ab) < 1e-6) return null;
  const axis = normalize3(ab), { side, vert } = frame(axis);
  const rings = [];
  for (let i = 0; i < c.N; i++) {
    const t = i / (c.N - 1), env = Math.sin(Math.PI * t);
    const r = (ra + (rb - ra) * t) * (1 + c.bulge * env);
    let center = lerp3(a, b, t);
    if (drop) center = { x: center.x, y: center.y, z: center.z - drop * r * env };
    const poly = [];
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2;
      poly.push(add(center, add(mul(side, r * Math.cos(ang)), mul(vert, r * Math.sin(ang)))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

// A sphere at a joint (world-z slices; orientation cosmetic for a sphere).
function sphereStack(center, r, c) {
  const N = 10, rings = [];
  for (let i = 0; i < N; i++) {
    const v = Math.PI * (i / (N - 1) - 0.5), cz = center.z + r * Math.sin(v), rr = r * Math.cos(v);
    const poly = [];
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2;
      poly.push({ x: center.x + rr * Math.cos(ang), y: center.y + rr * Math.sin(ang), z: cz });
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

// The bones: every FIGURE_EDGE triple [p,c,d] is two bones p–c and c–d.
const BODY_BONES = FIGURE_EDGES.flatMap(({ tri: [p, c, d] }) => [[p, c], [c, d]]);
// Leaf (extremity) nodes — thinned by `taper`.
const LEAF = new Set(['wristL', 'wristR', 'ankleL', 'ankleR', 'headTop']);
// The two torso bones carry the trunk's mass (chest vs gut), not the spine joints.
const boneKey = (a, b) => [a, b].sort().join('|');
const THORAX_BONE = boneKey('neckHub', 'navel');
const BELLY_BONE = boneKey('navel', 'pelvisHub');
// The hip girdle — the rump/haunch mass that should flow continuously off the belly.
const HIP_BONES = new Set([boneKey('hipL', 'pelvisHub'), boneKey('pelvisHub', 'hipR')]);
// The cranium bone — omitted when a proto-skull provides the head (figure-animal-skull).
const SKULL_BONE = boneKey('headTop', 'headBase');

/**
 * Flesh an animal body (bones + joints) as overlapping render parts. Chains
 * (tail/neck) bring their own tube rings, so pass those separately to the renderer.
 * @param {Object<string,{x,y,z}>} nodes  armature node positions
 * @param {Object<string,number>} radii   per-node radii (quadrupedRadii)
 * @param {object} [cfg]  shared flesh knobs (FLESH_DEFAULT)
 * @returns {{polylines:{x,y,z}[][], stroke:string}[]}
 */
export function animalBodyFlesh(nodes, radii, cfg = {}) {
  const c = { ...FLESH_DEFAULT, ...cfg };
  const rOf = (k) => radii[k] * c.flesh * (LEAF.has(k) ? c.taper : 1);
  const parts = [];
  for (const [a, b] of BODY_BONES) {
    if (!nodes[a] || !nodes[b]) continue;
    const k = boneKey(a, b);
    if (c.skull && k === SKULL_BONE) continue;   // the proto-skull provides the cranium
    // the trunk's mass lives in the torso: thorax (chest), belly (gut), and rump
    // (hindquarter) barrels — the belly sagging below the spine, the rump sized to
    // match the belly so the topline hugs from gut over haunch. Other bones use base.
    const mult = k === THORAX_BONE ? c.thorax : k === BELLY_BONE ? c.belly : HIP_BONES.has(k) ? c.rump : 1;
    const drop = k === BELLY_BONE ? c.bellyDrop : 0;
    const t = boneTube(nodes[a], nodes[b], rOf(a) * mult, rOf(b) * mult, c, { drop });
    if (t) parts.push(t);
  }
  // The navel (waist) sphere scales with the torso volume so the chest and gut
  // barrels bridge into one continuous trunk instead of two pinched lobes (a slight
  // tuck remains — realistic for most quadrupeds).
  const navelFill = 1 + ((c.thorax + c.belly) / 2 - 1) * 0.5;
  const NODE_FILL = { navel: navelFill, pelvisHub: c.rump, hipL: c.rump, hipR: c.rump };
  for (const k of Object.keys(radii)) {
    if (!nodes[k]) continue;
    if (c.skull && k === 'headTop') continue;    // skull replaces the cranium ball
    const fill = c.jointFill * (NODE_FILL[k] || 1);
    parts.push(sphereStack(nodes[k], rOf(k) * fill, c));
  }
  return parts;
}
