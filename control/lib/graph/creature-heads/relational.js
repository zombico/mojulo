/**
 * THE RELATIONAL CREATURE HEAD: a beast's head built the seventh generation's way, as the realistic hero's head is
 * (polygonizer/head-relational.js): every point placed by a RELATION, a ratio of the skull's own measures, the masses
 * VAJRAS (round cones from bead to bead, polygonizer/vajra.js sdRoundCone) strung between those points, and the skin
 * their SOFT UNION (the two nearest melted together, so a fillet fills where masses meet and a lone one keeps its true
 * distance; never a sum over all of them, which swells wherever several overlap),
 * the orbits and the mouth's line carved, the eyes' globes set in. It replaces, for the tiered body, the library heads
 * the creature biped wore (creature-heads/index.js: a skull of seven rows of seven slots, flat-shaded at its facets).
 *
 * Frame: the relational head's: +x the head's right, +y the face, +z up; the origin under the ear canal at the jaw's
 * floor (the menton's height). Units: V, the head's height (the crown to the jaw's floor behind the chin): the field is
 * in STAND units (HEAD_V at a 1.8 m figure), so it sits where the hero's head would.
 *
 * THE RELATIONS (in V; `CREATURE_RELATIONS`, a preset per skull in `CREATURE_HEADS`):
 *   the vault     craniumLength (the vault's length, brow to back), cephalic (its breadth to its length), crown (how far
 *                 the crown rises over the brow's line), brow (the ridge over the eyes)
 *   the stop      stop (the drop from the forehead to the muzzle's top)
 *   the muzzle    muzzle (its length from the stop to the nose's tip), muzzleWidth and muzzleDepth (its breadth and its
 *                 height at its root), taper (its tip's share of its root's), muzzleDrop (how far the tip's top falls
 *                 below the root's), nosePad (the rhinarium's size), whisker (the pads either side of the nose)
 *   the mouth     mouthLine (its height), gape (how far back its corner runs, a share of the muzzle), jawDepth (the
 *                 mandible's height under it), chin (the chin's set back from the nose's tip)
 *   the cheeks    cheekWidth (the zygomatic arch's breadth, a share of the vault's), cheekFull (the arch's mass)
 *   the eyes      eyeSize (the globe's radius), eyeSet (0 to the side … 1 straight ahead), eyeHeight, pupil ('round' |
 *                 'slit'), iris (the cosine about the gaze inside which the globe is iris: a cat's fills its eye, 0.1)
 *   the ears      earSize (the ear's height), earWidth (its base, a share of its height), earSet (0 on the side … 1 on
 *                 the top), earTilt (degrees out from the vertical), earPoint (0 round … 1 pointed)
 *
 *   relationalCreatureHead({ preset, relations, globes, ears }) → { field, bounds, points, paint(p), relations, vajras,
 *     globes, earFields }: `globes: false` leaves the eyes' globes out of the field (their sockets kept) and `ears: false`
 *     the ears, each then a part of its own (./worn.js); `globes` [{ side, centre, gaze, field, paint }] and `earFields`
 *     [{ side, field }] either way; `points` names what the one skin and the bind read (eyeR, eyeL, prn, alR, alL, sto,
 *     chR, gn, goR, condyleR, porionR, crown: the mouth's front and corner as seated on the skin)
 *   CREATURE_HEADS, CREATURE_RELATIONS, CREATURE_RELATION_NAMES
 * Pure, deterministic.
 */
import { sdRoundCone } from '../polygonizer/vajra.js';
import { HEAD_V } from '../polygonizer/head-relational.js';

/** the canon every preset moves: a general mammal's skull */
export const CREATURE_RELATIONS = Object.freeze({
  craniumLength: 0.95, cephalic: 0.7, crown: 0.06, brow: 0.07,
  stop: 0.1,
  muzzle: 0.7, muzzleWidth: 0.42, muzzleDepth: 0.42, taper: 0.62, muzzleDrop: 0.1, nosePad: 0.075, whisker: 0.4,
  mouthLine: 0.3, gape: 0.62, jawDepth: 0.2, chin: 0.12,
  cheekWidth: 0.92, cheekFull: 0.11,
  eyeSize: 0.085, eyeSet: 0.6, eyeHeight: 0.6, pupil: 'round', iris: 0.45,
  earSize: 0.5, earWidth: 0.55, earSet: 0.75, earTilt: 18, earPoint: 0.8,
});
export const CREATURE_RELATION_NAMES = Object.freeze(Object.keys(CREATURE_RELATIONS));

/** each skull a preset over the canon (first readings, the operator's eyes the gate) */
export const CREATURE_HEADS = Object.freeze({
  // the wolf: a long, deep, tapering muzzle off a clear stop, the eyes set obliquely, tall pointed ears high on the vault
  wolf: Object.freeze({ craniumLength: 1.0, cephalic: 0.64, muzzle: 0.82, muzzleWidth: 0.4, muzzleDepth: 0.44, taper: 0.6, muzzleDrop: 0.12, stop: 0.13,
    nosePad: 0.072, whisker: 0.25, gape: 0.6, jawDepth: 0.21, chin: 0.13, cheekWidth: 0.86, eyeSize: 0.08, eyeSet: 0.55, iris: 0.3, earSize: 0.6, earWidth: 0.5, earSet: 0.78, earTilt: 14, earPoint: 1 }),
  // the cat: a round vault, a short broad muzzle under a shallow stop, full whisker pads, wide cheeks, big forward eyes
  // with slit pupils, broad ears set to the top's sides
  felid: Object.freeze({ craniumLength: 0.88, cephalic: 0.9, crown: 0.09, muzzle: 0.2, muzzleWidth: 0.46, muzzleDepth: 0.3, taper: 0.8, muzzleDrop: 0.06, stop: 0.06,
    nosePad: 0.045, whisker: 0.95, mouthLine: 0.28, gape: 0.7, jawDepth: 0.16, chin: 0.06, cheekWidth: 1.02, cheekFull: 0.14,
    eyeSize: 0.125, eyeSet: 0.86, eyeHeight: 0.58, pupil: 'slit', iris: 0.1, earSize: 0.48, earWidth: 0.72, earSet: 0.62, earTilt: 24, earPoint: 0.65 }),
});

const v3 = (x, y, z) => ({ x, y, z });
const lerp = (a, b, t) => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const deg = (d) => (d * Math.PI) / 180;

/** the points the relations place (V) */
export function creaturePoints(R) {
  const L = R.craniumLength, halfW = (R.cephalic * L) / 2;
  const g = v3(0, 0.32 * L, 0.74), op = v3(0, -0.62 * L, 0.6), crown = v3(0, -0.12 * L, 0.74 + 0.26 + R.crown * 0);
  const n = v3(0, g.y + 0.05, g.z - R.stop);   // the stop: the muzzle's root under the brow
  const zM = R.mouthLine, root = v3(0, n.y + 0.02, (n.z + zM) / 2), depth0 = R.muzzleDepth, depth1 = depth0 * R.taper;
  const prn = v3(0, n.y + R.muzzle, n.z - R.muzzleDrop - (depth0 - depth1) * 0.5);   // the nose's tip, at the muzzle's top front
  const tip = v3(0, prn.y - R.nosePad * 0.6, (prn.z + zM) / 2);                      // the muzzle's front, centred
  const ch = v3(0, n.y + R.muzzle * (1 - R.gape), zM);                              // the mouth's corner (x below)
  const gn = v3(0, prn.y - R.chin, zM - R.jawDepth * 0.55);                         // the chin
  const go = v3(halfW * 0.72, -0.02, 0.1);                                          // the jaw's angle
  const zyX = halfW * R.cheekWidth, eyeX = halfW * (0.95 - 0.55 * R.eyeSet), eyeY = g.y - 0.04 + 0.06 * R.eyeSet;
  const eye = v3(eyeX, eyeY, R.eyeHeight);
  const earBase = v3(halfW * (1 - 0.55 * R.earSet), -0.08 * L, 0.74 + 0.2 * R.earSet);
  const tilt = deg(R.earTilt), earTip = v3(earBase.x + Math.sin(tilt) * R.earSize, earBase.y - 0.12 * R.earSize, earBase.z + Math.cos(tilt) * R.earSize);
  return { g, op, crown, n, root, prn, tip, ch, gn, go, eye, earBase, earTip, halfW, zyX, depth0, depth1, zM };
}

/** the vajras: { name, a, c, b, r: [ra, rc, rb], side? } (V), a right side's mirrored */
function creatureVajras(R, P) {
  const W = [], add = (name, a, c, b, r, side = false) => { W.push({ name, a, c, b, r }); if (side) W.push({ name: `${name}L`, a: v3(-a.x, a.y, a.z), c: v3(-c.x, c.y, c.z), b: v3(-b.x, b.y, b.z), r }); };
  const { g, op, n, prn, tip, ch, gn, go, eye, earBase, earTip, halfW, zyX, depth0, depth1, zM } = P;
  // THE VAULT: back to brow along the midline, its breadth the temples either side
  const rV = 0.3;
  add('vault', v3(0, op.y + 0.2, 0.58), v3(0, -0.1, 0.72 + R.crown * 0.5), v3(0, g.y - 0.12, 0.66), [0.24, rV, 0.24]);
  add('temple', v3(Math.max(0, halfW - 0.2), -0.32, 0.6), v3(Math.max(0, halfW - 0.22), -0.08, 0.66), v3(Math.max(0, halfW - 0.25), g.y - 0.14, 0.62), [0.18, 0.2, 0.15], true);
  add('brow', v3(0.02, g.y - 0.04, g.z - 0.04), v3(eye.x * 0.6, g.y - 0.05, g.z - 0.02), v3(eye.x + 0.06, g.y - 0.1, g.z - 0.06), [R.brow, R.brow * 1.1, R.brow * 0.7], true);
  // THE CHEEKS: the zygomatic arch from under the eye back to the ear
  add('arch', v3(zyX * 0.62, eye.y - 0.05, eye.z - 0.16), v3(zyX * 0.82, -0.04, eye.z - 0.2), v3(zyX * 0.7, -0.24, eye.z - 0.16), [R.cheekFull * 1.1, R.cheekFull * 1.4, R.cheekFull * 1.1], true);
  // THE UPPER MUZZLE: the maxilla and the upper lip, its underside the mouth's line, its top the muzzle's line from the
  // stop falling to the nose; two chains either side of the midline, so its breadth is its own and not its depth
  const top0 = n.z, top1 = prn.z, ru0 = Math.max(0.04, (top0 - zM) / 2), ru1 = Math.max(0.03, (top1 - zM) / 2);
  const w0 = R.muzzleWidth / 2, w1 = w0 * R.taper, off0 = Math.max(0.01, w0 - ru0), off1 = Math.max(0.005, w1 - ru1);
  const y0 = n.y - 0.06, y1 = prn.y - ru1;   // (the front bead set back by its radius: its face on the nose's tip)
  add('muzzle', v3(off0, y0, zM + ru0), v3((off0 + off1) / 2, (y0 + y1) / 2, zM + (ru0 + ru1) / 2), v3(off1, y1, zM + ru1), [ru0, (ru0 + ru1) / 2, ru1], true);
  add('bridge', v3(0, n.y - 0.02, n.z - 0.05), v3(0, (n.y + prn.y) / 2, (n.z + prn.z) / 2 - 0.05), v3(0, prn.y - 0.08, prn.z - 0.05), [0.07, 0.06, 0.05]);
  // THE NOSE'S PAD at the muzzle's front and top: a rhinarium, standing a little proud of the face under it
  const noseC = v3(0, prn.y - R.nosePad * 0.75, top1 - R.nosePad * 0.45);
  add('nose', v3(0, noseC.y - R.nosePad * 0.3, noseC.z + R.nosePad * 0.15), noseC, v3(0, noseC.y, noseC.z - R.nosePad * 0.3), [R.nosePad * 0.8, R.nosePad, R.nosePad * 0.8]);
  W.at(-1).blend = 0.03;
  // THE WHISKER PADS: the upper lip's masses either side under the nose, their foot on the mouth's line
  const pad = R.whisker * 0.1;
  if (pad > 0.005) { add('whisker', v3(pad * 0.95, prn.y - pad * 0.55, zM + pad * 0.85), v3(pad * 1.15, prn.y - pad * 1.1, zM + pad * 0.85), v3(Math.max(pad * 1.3, w1 * 0.8), prn.y - pad * 2.2, zM + pad * 0.8), [pad, pad, pad * 0.85], true);
    W.at(-1).blend = W.at(-2).blend = 0.07; }
  // THE LOWER JAW: the mandible either side from its angle to the chin, its top on the mouth's line, narrower than the
  // muzzle and its chin set back; the throat's floor between
  const rJ = R.jawDepth / 2, chinY = prn.y - R.chin;
  add('jaw', v3(go.x * 0.85, go.y - 0.02, go.z + rJ), v3(Math.max(0.03, w0 * 0.72), ch.y, zM - rJ), v3(0.04, chinY - rJ * 0.8, zM - rJ * 0.95), [rJ * 1.2, rJ, rJ * 0.8], true);
  if (pad > 0.005) { add('chinPad', v3(0, chinY - rJ * 1.2, zM - rJ * 0.9), v3(0, chinY - rJ * 0.9, zM - rJ), v3(0, chinY - rJ * 0.7, zM - rJ * 1.1), [pad * 0.55, pad * 0.6, pad * 0.5]); W.at(-1).blend = 0.06; }
  add('throat', v3(0, -0.2, 0.22), v3(0, (ch.y - 0.2) / 2, zM - rJ * 1.1), v3(0, ch.y, zM - rJ * 1.05), [0.2, 0.15, rJ * 0.95]);
  // (the mouth's line, for its groove: the corners at the jaw's breadth under the eye, the front where the lips meet)
  P.mouth = { corner: v3(w0 * 0.92, ch.y, zM + 0.005), front: v3(0, y1 + ru1 * 0.15, zM + 0.004) };
  P.noseC = noseC;
  // THE EARS: a blade, a cone from its base across the vault to its tip squashed through its own facing (./relational.js
  // relationalCreatureHead builds it in the ear's frame); here its beads and radii
  const ew = R.earSize * R.earWidth, tipR = 0.012 + 0.06 * (1 - R.earPoint);
  W.push({ name: 'earR', ear: true, a: earBase, c: lerp(earBase, earTip, 0.45), b: earTip, r: [ew / 2, ew * 0.36, tipR] });
  W.push({ name: 'earL', ear: true, a: v3(-earBase.x, earBase.y, earBase.z), c: lerp(v3(-earBase.x, earBase.y, earBase.z), v3(-earTip.x, earTip.y, earTip.z), 0.45), b: v3(-earTip.x, earTip.y, earTip.z), r: [ew / 2, ew * 0.36, tipR] });
  // THE NECK'S ROOT: under the vault's back, so the head is seated as the hero's is
  add('nape', v3(0, op.y + 0.28, 0.32), v3(0, op.y + 0.3, 0.18), v3(0, op.y + 0.32, 0.04), [0.22, 0.22, 0.22]);
  return W;
}

/** the skin's blend (V): how broadly the masses melt into one another where they meet */
const SKIN_BLEND = 0.16;
/** the lids' rim: the socket's edge rounded over this share of the globe's radius */
const LID_ROUND = 0.45;
/** an ear's thinness: its cone squashed this many times through its facing */
const EAR_FLAT = 3;

export function relationalCreatureHead({ preset = 'wolf', relations = {}, globes: withGlobes = true, ears: withEars = true } = {}) {
  const R = { ...CREATURE_RELATIONS, ...(CREATURE_HEADS[preset] ?? {}), ...relations };
  const P = creaturePoints(R), W = creatureVajras(R, P), sc = HEAD_V;
  const S = (p) => v3(p.x * sc, p.y * sc, p.z * sc);
  const bondOf = (w) => { const a = S(w.a), c = S(w.c), b = S(w.b), [ra, rc, rb] = w.r.map((r) => r * sc);
    if (!w.ear) return (p) => Math.min(sdRoundCone(p, a, c, ra, rc), sdRoundCone(p, c, b, rc, rb));
    // (an ear's frame: its axis base → tip, its facing forward and out from the head; a point's offset along the facing
    // stretched EAR_FLAT times, so the round cone is a blade as thin as its radius over EAR_FLAT)
    const ax = [b.x - a.x, b.y - a.y, b.z - a.z], al = Math.hypot(...ax), u = ax.map((q) => q / al), side = Math.sign(a.x) || 1;
    const f0 = [0.35 * side, 1, 0], fd = f0[0] * u[0] + f0[1] * u[1] + f0[2] * u[2], f = f0.map((q, i) => q - fd * u[i]), fl = Math.hypot(...f), F = f.map((q) => q / fl);
    return (p) => { const o = [p.x - a.x, p.y - a.y, p.z - a.z], t = o[0] * F[0] + o[1] * F[1] + o[2] * F[2], q = { x: p.x + F[0] * t * (EAR_FLAT - 1), y: p.y + F[1] * t * (EAR_FLAT - 1), z: p.z + F[2] * t * (EAR_FLAT - 1) };
      return Math.min(sdRoundCone(q, a, c, ra, rc), sdRoundCone(q, c, b, rc, rb)); }; };
  const bonds = W.map(bondOf);
  // the skin before the eyes: the masses' soft union
  // (the three nearest masses melted together by a polynomial smooth-min, nearest first: a fillet BLEND wide where masses
  // meet, swelling at most a quarter of it at each; a sum over every mass, −k log Σ e^(−d/k), swelled the muzzle a seventh
  // of the head forward where eight overlap and drowned its features; the two nearest alone at a narrow blend left
  // creases between them)
  // (two layers, so the field is continuous: the body's masses melted among themselves at the wide blend, three nearest at
  // a time; then each FEATURE, a mass with a blend of its own (the nose, the whisker pads, the chin), joined to that at its
  // own narrow one so no fillet swallows it; a blend picked per nearest pair jumped where the pair changed, and cracked)
  const kb = SKIN_BLEND * sc, sminK = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const skinOf = (idx) => { const body = idx.filter((i) => W[i].blend === undefined), feats = idx.filter((i) => W[i].blend !== undefined);
    return (p) => { let m1 = Infinity, m2 = Infinity, m3 = Infinity;
      for (const i of body) { const d = bonds[i](p); if (d < m1) { m3 = m2; m2 = m1; m1 = d; } else if (d < m2) { m3 = m2; m2 = d; } else if (d < m3) m3 = d; }
      let d = sminK(sminK(m1, m2, kb), m3, kb);
      for (const i of feats) d = sminK(d, bonds[i](p), W[i].blend * sc);
      return d; }; };
  const all = W.map((_, i) => i).filter((i) => withEars || !W[i].ear);
  // THE NOSE'S PAD SEATED: marched forward from inside the muzzle (without it) to the muzzle's face, its centre set back
  // half its radius, so it stands proud as a rhinarium does instead of lying buried in the muzzle's front
  const ni = W.findIndex((w) => w.name === 'nose');
  if (ni >= 0) { const N = W[ni], under = skinOf(all.filter((i) => i !== ni)); let c = S(N.c);
    for (let i = 0; i < 400 && under(c) < 0; i++) c = { ...c, y: c.y + 0.002 * sc };
    const dy = (c.y / sc - N.r[1] * 0.5) - N.c.y, mv = (q) => v3(q.x, q.y + dy, q.z);
    W[ni] = { ...N, a: mv(N.a), c: mv(N.c), b: mv(N.b) }; bonds[ni] = bondOf(W[ni]); }
  const skin = skinOf(all);
  // the eyes: each globe SEATED on the skin (marched out along its gaze from the orbit to where the skin crosses, set in
  // by most of its radius), in a socket carved a little larger, its gaze turned out from the face by its set
  const eyes = ['R', 'L'].map((s) => { const e0 = S(s === 'R' ? P.eye : v3(-P.eye.x, P.eye.y, P.eye.z)), out = deg(70 * (1 - R.eyeSet)) * (s === 'R' ? 1 : -1), r = R.eyeSize * sc;
    const gz = [Math.sin(out), Math.cos(out), 0.05], gl = Math.hypot(...gz), g = gz.map((q) => q / gl);
    let c = { ...e0 }; for (let i = 0; i < 200 && skin(c) < 0; i++) c = { x: c.x + g[0] * r * 0.05, y: c.y + g[1] * r * 0.05, z: c.z + g[2] * r * 0.05 };
    return { c: { x: c.x - g[0] * r * 0.82, y: c.y - g[1] * r * 0.82, z: c.z - g[2] * r * 0.82 }, r, gaze: g }; });
  // the mouth's line: a thin groove from corner to corner round the muzzle's front
  // the mouth's line SEATED on the skin: points from the corner round to the front, each marched out from inside along
  // its own facing (sideways at the corner, turning forward at the front) to where the skin crosses and set in by a third
  // of the groove's radius, so the groove runs along the surface instead of cutting a chord under it
  const GR = [0.016, 0.011], NM = 8;
  const seat = (q, dir, r) => { const back = 0.25; let c = S(v3(q.x - dir[0] * back, q.y - dir[1] * back, q.z)); const st = 0.003 * sc;
    for (let i = 0; i < 600 && skin(c) < 0; i++) c = { x: c.x + dir[0] * st, y: c.y + dir[1] * st, z: c.z };
    return { x: c.x - dir[0] * r * 0.35 * sc, y: c.y - dir[1] * r * 0.35 * sc, z: c.z }; };
  const half = Array.from({ length: NM + 1 }, (_, i) => { const t = i / NM, q = lerp(P.mouth.corner, P.mouth.front, t), a = (t * t * Math.PI) / 2, dir = [Math.cos(a), Math.sin(a)], r = GR[0] + (GR[1] - GR[0]) * t;
    return { c: seat(v3(q.x * (1 - t), q.y, q.z), dir, r), r: r * sc }; });
  const mouth = [...half, ...half.slice(0, -1).reverse().map((m) => ({ ...m, c: { ...m.c, x: -m.c.x } }))];
  const field = (p) => {
    let d = skin(p);
    // the socket, hugging its globe as lids do; its rim rounded over LID_ROUND of the globe's radius, so the lid's edge is a
    // fold a net resolves, not a crease it saws
    for (const E of eyes) { const s = -(Math.hypot(p.x - E.c.x, p.y - E.c.y, p.z - E.c.z) - E.r * 1.06), kk = LID_ROUND * E.r, h = Math.max(kk - Math.abs(d - s), 0) / kk; d = Math.max(d, s) + h * h * kk * 0.25; }
    let groove = Infinity; for (let i = 0; i + 1 < mouth.length; i++) groove = Math.min(groove, sdRoundCone(p, mouth[i].c, mouth[i + 1].c, mouth[i].r, mouth[i + 1].r));
    d = Math.max(d, -groove);
    if (withGlobes) for (const E of eyes) d = Math.min(d, Math.hypot(p.x - E.c.x, p.y - E.c.y, p.z - E.c.z) - E.r);   // the globe
    return d;
  };
  // the globe's paint: its iris and pupil about its gaze; a slit pupil narrow across, tall up and down
  const paint = (p) => {
    for (const E of eyes) {
      const v = [p.x - E.c.x, p.y - E.c.y, p.z - E.c.z], l = Math.hypot(...v); if (l > E.r * 1.06) continue;
      const g = E.gaze, gl = Math.hypot(...g), cos = (v[0] * g[0] + v[1] * g[1] + v[2] * g[2]) / (l * gl);
      if (cos < R.iris) return 'sclera';
      const side = [g[1], -g[0], 0], across = Math.abs((v[0] * side[0] + v[1] * side[1]) / (l * Math.hypot(...side))), up = Math.abs(v[2] / l);
      // (a slit a lens: widest across its middle, closing to a point up and down)
      if (R.pupil === 'slit' ? up < 0.62 && across < 0.1 * (1 - (up / 0.62) ** 2) : cos > 0.9) return 'pupil';
      return 'iris';
    }
    // (the nose's pad: where its own bead is the skin, its front half)
    const nb = W.find((w) => w.name === 'nose'), nc = S(nb.c);
    if (p.y > nc.y - nb.r[1] * 0.1 * sc && Math.hypot(p.x - nc.x, p.y - nc.y, p.z - nc.z) < nb.r[1] * 1.1 * sc) return 'nose';
    return null;
  };
  // each globe its own field and paint (the one skin nets it as a part: polygonizer/hero-one-skin.js globePart)
  const globeList = eyes.map((E, i) => ({ side: i ? 'L' : 'R', centre: E.c, gaze: v3(...E.gaze), field: (p) => Math.hypot(p.x - E.c.x, p.y - E.c.y, p.z - E.c.z) - E.r, paint }));
  const earFields = W.map((w, i) => (w.ear ? { side: w.name.at(-1), field: bonds[i] } : null)).filter(Boolean);
  // the points the one skin and the bind read: the eyes, the nose's tip and its pad's sides, the mouth's front and corner
  // as seated, the chin, the jaw's angle and its hinge (the condyle, over the angle at the mouth's height, under the arch),
  // the ear canal and the crown (STAND units, as the rest)
  const nb = W.find((w) => w.name === 'nose'), nc = S(nb.c), padX = nb.r[1] * 0.8 * sc;
  const named = { eyeR: eyes[0].c, eyeL: eyes[1].c, alR: v3(nc.x + padX, nc.y, nc.z), alL: v3(nc.x - padX, nc.y, nc.z), sto: half[NM].c, chR: half[0].c,
    goR: S(P.go), condyleR: S(v3(P.go.x * 0.92, P.go.y - 0.08, P.zM + 0.06)), porionR: S(v3(P.halfW * 0.9, -0.12 * R.craniumLength, 0.46)), crown: S(v3(0, -0.12 * R.craniumLength, 0.72 + R.crown * 0.5 + 0.3)) };
  const xs = W.flatMap((w) => [w.a.x, w.b.x, w.c.x].map((x) => Math.abs(x) + Math.max(...w.r))), ys = W.flatMap((w) => [w.a.y, w.b.y, w.c.y]), zs = W.flatMap((w) => [w.a.z, w.b.z, w.c.z]);
  const pad = 0.12, X = Math.max(...xs) + pad;
  const bounds = { min: v3(-X * sc, (Math.min(...ys) - 0.35) * sc, (Math.min(...zs) - 0.3) * sc), max: v3(X * sc, (Math.max(...ys) + pad) * sc, (Math.max(...zs) + pad) * sc) };
  return { field, bounds, points: { ...Object.fromEntries(Object.entries(P).filter(([, v]) => v && typeof v === 'object' && 'x' in v).map(([kk, v]) => [kk, S(v)])), ...named }, paint, relations: R, vajras: W, globes: globeList, earFields };
}
