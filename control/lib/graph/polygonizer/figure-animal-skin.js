/**
 * figure-animal-skin — the WELDED single-skin upgrade (v2 of the flesh model).
 *
 * The overlap-union flesh (figure-animal-flesh.js) draws each bone/joint/skull as a
 * separate part that the renderer depth-sorts — fast, but the parts intersect with
 * hard seams. This wraps the WHOLE figure (skull, legs, body) in ONE coherent skin:
 *
 *   1. assemble a global signed-distance FIELD — every bone a round cone, every joint
 *      a sphere, the torso masses + skull as more cones/spheres — smooth-unioned
 *      (`smin`) so junctions get CONCAVE fillets (limbs melt into the body), and
 *   2. surface it by marching each axis's cross-sections out to the iso-surface, so
 *      every ring sits on the one global surface → a single welded skin.
 *
 * Reuses the substrate's `sdRoundCone` + `smin` (vajra.js). Heavier than the overlap
 * model (ray-marches the field), so it's the "hero" path; the cheap overlap model
 * stays for lineups/iteration. Same knob set as the flesh, plus `blend` (fillet
 * softness) and march resolution. Returns render parts `{polylines, stroke}` in
 * STAND space. Chains (tail/neck) join as their own tubes (their roots are in the
 * field, so the body blends to them at the attachment).
 */
import { smin, sdRoundCone } from './vajra.js';
import { normalize3, sub3, cross3, FIGURE_EDGES } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp3 = (a, b, t) => add(a, mul(sub3(b, a), t));
const mid = (a, b) => lerp3(a, b, 0.5);
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const sdSphere = (p, c, r) => vlen(sub3(p, c)) - r;

export const SKIN_DEFAULT = {
  flesh: 1.2, thorax: 1.9, belly: 2.1, bellyDrop: 0.30, rump: 1.9, jointFill: 1.15, taper: 0.45,
  rumpCap: 0.9, // short rearward cap axis so the skin closes over the haunch/tail root
  // SPINE BRIDGE — the thorax (neckHub→navel) and belly (navel→pelvisHub) tubes are marched
  // independently, each ring perpendicular to its OWN axis. Where they meet at the navel they
  // are angled (back-arch / belly-drop), so on the convex dorsal side each tube's rings fall
  // away from the corner and leave a NOTCH (the "dorsal seam at the navel"). The SDF field is
  // smooth there — so a third axis marched ACROSS the junction through the same field lays
  // continuous rings over the kink and closes the cleft. `spineBridge` = how far it reaches
  // into each tube from the navel (0 = off).
  spineBridge: 0.5,
  // NECK BRIDGE — the same seam at the NAPE: a neck CHAIN roots at neckHub and projects away,
  // but the thorax tube ends at neckHub perpendicular to its OWN axis, so the dorsal wedge
  // between the back of the neck and the shoulders is left open. When a chain roots at neckHub,
  // march a span from inside the thorax across the corner to an early neck center, through the
  // smooth field, closing the nape. Off by default (only chain-necked builds want it).
  neckBridge: 0,
  // KNEE BRIDGE — the spine seam on the LEG: the thigh (hip→knee) and shank (knee→ankle) tubes
  // each march perpendicular to their own axis, so a sharply bent knee leaves a notch on the
  // outside of the bend. A span marched across the joint through the field wraps it. `kneeBridge`
  // = how far it reaches into each segment from the knee (0 = off).
  kneeBridge: 0,
  // HAUNCH — the quadruped "ham": a big BACK-SWEPT mass that buries the upper femur and merges
  // the rump into the thigh. The protoform-inherited hind limb is a THIN human leg off a compact
  // pelvis, so without this the rump cap + leg tube read as two masses ("secondary rear"). The
  // mass sits over the upper femur, biased REARWARD so it sweeps back and fuses with the rump.
  haunch: 1.1,      // haunch radius ÷ (hip rump radius); 0 = off. SMALL fill over the upper femur —
                    //   sized so the BACK OF THE LEG is the silhouette terminator, no bulge behind it
  haunchAt: 0.3,    // where along hip→knee the haunch centers (0 = hip, 1 = knee)
  haunchBack: 0.2,  // rearward bias (× haunch radius) — minimal; the haunch does NOT sweep past the leg back
  haunchRise: 0.1,  // upward bias (× haunch radius) → slight tuck up toward the loin
  blend: 0.05,    // smin width (STAND) — joint fillet softness
  bound: 0.22,    // max march radius (STAND) — caps the through-body blowup at junctions
  N: 18, M: 26,   // rings per axis, points per ring (skin resolution)
  stroke: '#c8836a',
};

const boneKey = (a, b) => [a, b].sort().join('|');
const BODY_BONES = FIGURE_EDGES.flatMap(({ tri: [p, c, d] }) => [[p, c], [c, d]]);
const THORAX = boneKey('neckHub', 'navel'), BELLY = boneKey('navel', 'pelvisHub'), SKULLB = boneKey('headTop', 'headBase');
const HIP = new Set([boneKey('hipL', 'pelvisHub'), boneKey('pelvisHub', 'hipR')]);
const LEAF = new Set(['wristL', 'wristR', 'ankleL', 'ankleR', 'headTop']);
// The girdle cross-connectors run laterally THROUGH the body; marching their
// cross-sections balloons (the ray stays inside across the whole torso). Keep them
// in the FIELD (they carry shoulder/hip width) but don't surface along them — the
// spine + limb axes already wrap that volume.
const GIRDLE = new Set([boneKey('shoulderL', 'neckHub'), boneKey('neckHub', 'shoulderR'), boneKey('hipL', 'pelvisHub'), boneKey('pelvisHub', 'hipR')]);

function frameOf(t) {
  let up = { x: 0, y: 0, z: 1 }, side = cross3(up, t);
  if (vlen(side) < 1e-6) { up = { x: 1, y: 0, z: 0 }; side = cross3(up, t); }
  side = normalize3(side);
  return { side, up: normalize3(cross3(t, side)) };
}

// The skull as a few field primitives (cranium sphere + muzzle/jaw/beak cones).
function skullPrims(skull, w0) {
  const { anchor, cfg } = skull, dir = normalize3(skull.dir), { up } = frameOf(dir);
  const L = cfg.length, w = cfg.width, tip = add(anchor, mul(dir, L)), prims = [];
  prims.push({ c: add(anchor, add(mul(dir, L * 0.18), mul(up, w * 0.15 * cfg.dome))), r: w });            // cranium
  prims.push({ a: add(anchor, mul(dir, L * 0.30)), b: add(tip, mul(up, -w * cfg.muzzleDrop)), ra: w * 0.62, rb: w * cfg.snout });   // muzzle
  if (cfg.jaw > 0) {                                                                                       // lower jaw
    const drop = mul(up, -(w * (0.5 + 0.5 * cfg.jaw)));
    prims.push({ a: add(add(anchor, mul(dir, L * 0.18)), drop), b: add(add(tip, mul(dir, -L * 0.06)), drop), ra: w * 0.42 * cfg.jaw, rb: w * Math.max(cfg.snout * 0.7, 0.18) });
  }
  if (cfg.beak > 0) prims.push({ a: tip, b: add(tip, add(mul(dir, L * cfg.beak), mul(up, -w * cfg.beak * 0.5))), ra: w * cfg.snout, rb: w * 0.07 });   // beak
  return prims;
}

// Head-scale march params for the welded skull.
const SKULL_SKIN = { blend: 0.02, N: 18, M: 24 };

/**
 * WELDED skull — cranium + muzzle + lower jaw (+ beak) fused into ONE marched head skin, so
 * the jaw is WRAPPED into the lower face (with the mouth as a crease) instead of a loose
 * hanging tube. The jaw is raised to OVERLAP the muzzle (so the down-march reads continuous
 * muzzle→jaw) and a cheek cone fuses the hinge to the cranium. Returns ONE ring-stack part,
 * rings ordered cranium→nose, so the existing facePaint s-split colours it unchanged. Trades
 * protoSkull's superellipse boxiness for a rounder muzzle — the price of a single welded head.
 */
export function weldedSkull(skull, stroke = '#c8836a', cfg = {}) {
  const c = { ...SKULL_SKIN, ...cfg };
  const dir = normalize3(skull.dir), { up } = frameOf(dir), side = normalize3(cross3(dir, up));
  const s = skull.cfg, L = s.length, w = s.width, anchor = skull.anchor, tip = add(anchor, mul(dir, L));
  const prims = [];
  prims.push({ c: add(anchor, add(mul(dir, L * 0.18), mul(up, w * 0.15 * (s.dome || 1)))), r: w });          // cranium
  const noseTip = add(tip, mul(up, -(s.muzzleDrop || 0) * L));
  prims.push({ a: add(anchor, mul(dir, L * 0.34)), b: noseTip, ra: w * 0.66, rb: w * (s.snout || 0.4) });    // upper muzzle
  if (s.jaw > 0) {                                                                                            // lower jaw — RAISED to overlap → fuses
    const drop = w * (0.42 + 0.32 * s.jaw);
    const jb = add(add(anchor, mul(dir, L * 0.20)), mul(up, -drop));
    const jt = add(add(tip, mul(dir, -L * 0.05)), mul(up, -drop * 0.7));
    prims.push({ a: jb, b: jt, ra: w * 0.5, rb: w * Math.max(s.snout * 0.7, 0.2) });
    prims.push({ a: add(add(anchor, mul(dir, L * 0.22)), mul(up, -w * 0.1)), b: jb, ra: w * 0.74, rb: w * 0.5 });   // cheek → fuse the hinge
  }
  if (s.beak > 0) prims.push({ a: tip, b: add(tip, add(mul(dir, L * s.beak), mul(up, -w * s.beak * 0.5))), ra: w * s.snout, rb: w * 0.07 });
  // WHISKER PADS — two blunt masses flanking the FRONT of the muzzle → a WIDE, SQUARED snout
  // (the cat pad: broad box front with the nose between the lobes), vs the default narrow round
  // cone. Opt-in via `s.pad`; they widen the front opening so the cap closes over a broad front.
  if (s.pad > 0) {
    const padCtr = add(add(anchor, mul(dir, L * 0.9)), mul(up, -w * 0.14));
    const padOut = w * (0.42 + 0.5 * s.pad), padR = w * (0.42 + 0.5 * s.pad);
    prims.push({ c: add(padCtr, mul(side, padOut)), r: padR });
    prims.push({ c: add(padCtr, mul(side, -padOut)), r: padR });
  }
  // NASAL BRIDGE — a raised ridge up the top-centre from the brow (between the eyes) to the nose,
  // so the bridge reads prominent (the felid dorsal ridge). Opt-in via `s.bridge`.
  if (s.bridge > 0) {
    const bRoot = add(add(anchor, mul(dir, L * 0.44)), mul(up, w * 0.5 * (s.dome || 1)));   // brow, high + back
    const bNose = add(noseTip, mul(up, w * 0.3));                                            // nose top
    prims.push({ a: bRoot, b: bNose, ra: w * 0.36 * s.bridge, rb: w * 0.24 * s.bridge });
  }
  const field = makeField(prims, c.blend);
  const bound = Math.max(0.13, w * 3.4);
  const a = add(anchor, mul(dir, -L * 0.06)), b = add(anchor, mul(dir, L * (s.beak > 0 ? 1 + s.beak : 1.0)));
  const part = marchAxis(field, a, b, { ...c, bound, stroke });
  // FRONT CAP — marchAxis emits an OPEN tube (rings ⟂ the muzzle axis, no end faces). A long
  // muzzle hides its front opening, but a SHORT (cat) muzzle leaves it gaping, so the face reads
  // hollow / shows its pale interior from the front + ¾. Close the frontmost ring with a rounded
  // cap fan (front ring → forward apex, hemispherical profile) so the head is a solid closed
  // surface. Follows whatever outline the muzzle+jaw opening has, so it caps every family's head.
  if (part && part.polylines.length) {
    const front = part.polylines[part.polylines.length - 1], n = front.length || 1;
    const ctr = front.reduce((m, q) => add(m, q), { x: 0, y: 0, z: 0 });
    ctr.x /= n; ctr.y /= n; ctr.z /= n;
    const rad = front.reduce((m, q) => m + vlen(sub3(q, ctr)), 0) / n;   // mean opening radius → cap depth
    const fwd = mul(normalize3(sub3(b, a)), rad * (s.capDepth ?? 1));    // <1 = flatter, SHORTER, squarer front
    const K = 4;
    for (let k = 1; k <= K; k++) {
      const u = k / K, shrink = Math.cos(u * Math.PI / 2), push = Math.sin(u * Math.PI / 2);
      part.polylines.push(front.map((q) => add(add(ctr, mul(sub3(q, ctr), shrink)), mul(fwd, push))));
    }
  }
  return [part];
}

// Assemble the global field primitives + the axes to surface along.
function buildField(nodes, radii, chains, skull, c, headBridge) {
  const rOf = (k) => radii[k] * c.flesh * (LEAF.has(k) ? c.taper : 1);
  const prims = [], axes = [], patches = [];
  for (const [a, b] of BODY_BONES) {
    if (!nodes[a] || !nodes[b]) continue;
    const k = boneKey(a, b);
    if (k === SKULLB) continue;                       // skull provides the cranium
    const mult = k === THORAX ? c.thorax : k === BELLY ? c.belly : HIP.has(k) ? c.rump : 1;
    const seg = { a: nodes[a], b: nodes[b], ra: rOf(a) * mult, rb: rOf(b) * mult };
    prims.push(seg);
    if (!GIRDLE.has(k)) axes.push(seg);               // surface long axes only; girdles stay in the field
  }
  // SPINE BRIDGE — a span across the navel kink, marched through the smooth field, so the
  // dorsal corner where the thorax + belly tubes diverge is wrapped by continuous rings.
  if (c.spineBridge > 0 && nodes.neckHub && nodes.navel && nodes.pelvisHub) {
    const f = Math.min(0.95, c.spineBridge);
    axes.push({ a: lerp3(nodes.neckHub, nodes.navel, 1 - f), b: lerp3(nodes.navel, nodes.pelvisHub, f) });
  }
  // NECK BRIDGE — close the nape wedge for a chain-necked build (see SKIN_DEFAULT.neckBridge).
  if (c.neckBridge > 0 && nodes.neckHub && nodes.navel) {
    const f = Math.min(0.6, c.neckBridge);
    for (const ch of chains) {
      const cs = ch.centers;
      if (!cs || cs.length < 3 || vlen(sub3(cs[0], nodes.neckHub)) > 0.05) continue;   // only the neck chain (rooted at neckHub)
      const into = lerp3(nodes.neckHub, nodes.navel, f * 0.5);                          // a little way down the thorax
      const upNeck = cs[Math.max(2, Math.round((cs.length - 1) * f))];                  // an early neck center
      axes.push({ a: into, b: upNeck });
    }
  }
  // KNEE BRIDGE — close the outside-of-the-bend notch at each hind knee (see SKIN_DEFAULT.kneeBridge).
  if (c.kneeBridge > 0) {
    const f = Math.min(0.7, c.kneeBridge);
    for (const s of ['L', 'R']) {
      const hip = nodes['hip' + s], knee = nodes['knee' + s], ankle = nodes['ankle' + s];
      if (!hip || !knee || !ankle) continue;
      axes.push({ a: lerp3(hip, knee, 1 - f), b: lerp3(knee, ankle, f) });
    }
  }
  const navelFill = 1 + ((c.thorax + c.belly) / 2 - 1) * 0.5;
  const NF = { navel: navelFill, pelvisHub: c.rump, hipL: c.rump, hipR: c.rump };
  for (const k of Object.keys(radii)) {
    if (!nodes[k] || k === 'headTop') continue;
    prims.push({ c: nodes[k], r: rOf(k) * c.jointFill * (NF[k] || 1) });
  }
  // The belly axis ends at pelvisHub, and the lateral hip girdles stay unsurfaced
  // to avoid through-body ballooning. Add a short spine-continuation cap so the
  // rump has its own longitudinal skin patch around the tail root.
  if (nodes.navel && nodes.pelvisHub && c.rumpCap > 0) {
    const rumpR = rOf('pelvisHub') * c.rump;
    const rear = normalize3(sub3(nodes.pelvisHub, nodes.navel));
    const cap = add(nodes.pelvisHub, mul(rear, rumpR * c.rumpCap));
    const seg = { a: nodes.pelvisHub, b: cap, ra: rumpR, rb: rumpR * 0.22 };
    prims.push(seg);
    axes.push(seg);
    patches.push({ c: cap, r: rumpR * 0.62 });
  }
  // HAUNCH ("ham") per hind side — a big back-swept mass burying the upper femur and fusing
  // with the rump, so the hindquarter reads as ONE muscle (not rump-blob + thin-leg). In the
  // field so the femur axis + rump cap surface it as a continuous, rearward-swept thigh.
  if (c.haunch > 0) {
    const rear = (nodes.navel && nodes.pelvisHub) ? normalize3(sub3(nodes.pelvisHub, nodes.navel)) : { x: 0, y: -1, z: 0 };
    for (const s of ['L', 'R']) {
      const hip = nodes['hip' + s], knee = nodes['knee' + s];
      if (!hip || !knee) continue;
      const hamR = rOf('hip' + s) * c.rump * c.haunch;
      const center = add(add(lerp3(hip, knee, c.haunchAt), mul(rear, hamR * c.haunchBack)), { x: 0, y: 0, z: hamR * c.haunchRise });
      prims.push({ c: center, r: hamR });
    }
  }
  // HEAD BRIDGE — the welded skin covers neck+body but NOT the head (protoSkull draws that),
  // so the neck tube used to end at headBase while the cranium sat forward → a DETACHED muzzle
  // (gap at the throat). Drop the cranium into the field + surface a throat cone from the neck
  // base up to it, so the neck skin sweeps INTO the head and meets the protoSkull (which overlays
  // the detailed head on top). Field-only head fill; the visible head is still protoSkull.
  if (headBridge && nodes.neckHub) {
    const d = normalize3(headBridge.dir);
    const cran = add(headBridge.anchor, mul(d, headBridge.length * 0.18));   // matches protoSkull's cranium center
    const cranR = headBridge.width;
    prims.push({ c: cran, r: cranR });                                       // cranium mass in the field
    const seg = { a: nodes.neckHub, b: cran, ra: rOf('neckHub') * c.thorax * 0.9, rb: cranR * 0.85 };
    prims.push(seg);
    axes.push(seg);                                                          // surface the throat → cranium bridge
  }
  // a dropped belly mass (the gut hangs below the spine)
  prims.push({ c: add(mid(nodes.navel, nodes.pelvisHub), { x: 0, y: 0, z: -c.bellyDrop * rOf('navel') * c.belly }), r: rOf('navel') * c.belly });
  for (const ch of chains) for (const s of ch.spheres) prims.push({ c: s.pos, r: s.r });   // chain volume / root blend
  if (skull) {
    prims.push(...skullPrims(skull));
    const dir = normalize3(skull.dir);
    axes.push({ a: skull.anchor, b: add(skull.anchor, mul(dir, skull.cfg.length)) });      // surface the head too
  }
  return { prims, axes, patches };
}

function makeField(prims, k) {
  return (p) => {
    let d = Infinity, first = true;
    for (const pr of prims) {
      const dd = pr.r !== undefined ? sdSphere(p, pr.c, pr.r) : sdRoundCone(p, pr.a, pr.b, pr.ra, pr.rb);
      d = first ? dd : smin(d, dd, k); first = false;
    }
    return d;
  };
}

// March outward from `o` along `dir` to the first iso-surface crossing (≤ bound).
function marchRadius(field, o, dir, bound) {
  const at = (s) => field(add(o, mul(dir, s)));
  const coarse = 48, step = bound / coarse;
  let lo = 0, hi = bound, found = false;
  for (let i = 1; i <= coarse; i++) { const s = i * step; if (at(s) > 0) { lo = (i - 1) * step; hi = s; found = true; break; } }
  if (!found) return bound;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (at(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

function marchAxis(field, a, b, c) {
  const t = sub3(b, a);
  if (vlen(t) < 1e-6) return null;
  const T = normalize3(t), { side, up } = frameOf(T), rings = [];
  for (let i = 0; i < c.N; i++) {
    const center = lerp3(a, b, i / (c.N - 1)), poly = [];
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2, dir = add(mul(side, Math.cos(ang)), mul(up, Math.sin(ang)));
      poly.push(add(center, mul(dir, marchRadius(field, center, dir, c.bound))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

function spherePatch(center, r, c) {
  const N = 8, rings = [];
  for (let i = 0; i < N; i++) {
    const v = Math.PI * (i / (N - 1) - 0.5), z = center.z + r * Math.sin(v), rr = r * Math.cos(v);
    const poly = [];
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2;
      poly.push({ x: center.x + rr * Math.cos(ang), y: center.y + rr * Math.sin(ang), z });
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

/**
 * Wrap the whole figure (skull + legs + body) in one welded skin. Chains pass in
 * for field blending at their roots; render them as their own tubes alongside.
 * @returns {{polylines:{x,y,z}[][], stroke:string}[]}  STAND-space skin parts
 */
export function animalSkin(nodes, radii, chains = [], skull = null, cfg = {}, headBridge = null) {
  const c = { ...SKIN_DEFAULT, ...cfg };
  const { prims, axes, patches } = buildField(nodes, radii, chains, skull, c, headBridge);
  const field = makeField(prims, c.blend);
  return [
    ...axes.map((seg) => marchAxis(field, seg.a, seg.b, c)).filter(Boolean),
    ...patches.map((p) => spherePatch(p.c, p.r, c)),
  ];
}
