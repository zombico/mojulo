/**
 * DRESS-OUTLINE — the DRESSED OUTLINE read: the principles a silhouette is judged by (docs/garment-principles.md), as
 * measures of the compiled figure against the bare figure under it, with a starting band per register.
 *
 * dress-silhouette.js reads the authored hero's copy garments ring for ring; the realistic body's garments merge and
 * renumber their rings, so this reads the MESH: each face's part (the body's own, or what it wears) sliced at heights,
 * each part's slice an interval across x (the front outline) and across y (the side's), the intervals' union a width.
 *
 *   outlineMeasures(mesh, recipe) → {
 *     S, at: { <landmark>: { z, f, W, B, e, WD, BD } },   the landmarks (shoulder deltoid to deltoid, chest, waist, hip,
 *                                                          crotch, midThigh, knee, calf, ankle, wrist, hem): the dressed
 *                                                          and bare front widths (the trunk's and the legs' together; the
 *                                                          shoulder with the upper arms; a wrist or an ankle the right
 *                                                          limb's), the ease share e = W / B − 1, the side depths
 *     ratios, bareRatios, shift                            shoulder : waist : hip : hem, dressed, bare, and the move
 *     family, bareFamily                                   the silhouette family by the bands' rules
 *     fit: { top, bottom }                                 each half's mean ease and its class
 *     returns, returnGap                                   where loose cloth comes back to the body (the waist, a wrist,
 *                                                          an ankle: the least standoff each side in each region, ≤ 25 mm)
 *     rho                                                  the mass above the waist over below, against the bare's
 *     divisions: [{ z, f, kind, dL }]                      garments' lower edges and the belts, with the value step
 *                                                          across each (CIELAB L*, off the palette at the front)
 *     dominant, legLine, hems: [{ z, on, pos }]            the strongest division; the leg's unbroken run; a hem on a
 *                                                          limb and its place on the limb's bare profile
 *     flair: { pieces, of, bodyLine }                      the garments reaching furthest where e > 0.25 down the trunk,
 *                                                          an arm and a leg; the share of those samples at e ≤ 0.10
 *   }
 *   with `{ profile: true }` also `profile`: { ground, top, rows: [{ z, dressed, bare }] every 5 mm, each the x runs of the
 *     front outline (the arms too: the picture's, not the measures'), landmarks }, for a picture of the read
 *   outlineCritic(m, style, { sex }) → { style, family, bareFamily, reads: [{ id, value, band, in }], advice: [line] }
 *                                                          style 'western' or 'anime' (OUTLINE_BANDS; the canon's
 *                                                          word, as hero-style-critic.js's: not the hero's `register`)
 *
 * Advice, never a refusal (docs/bicycles.md). A machine gate: the numbers say what the outline does; whether it is
 * striking is the eyes gate's. Pure: a function of the mesh and the recipe.
 */

/** The bands per style (docs/garment-principles.md): starting points, tuned at the eyes gate */
export const OUTLINE_BANDS = Object.freeze({
  western: Object.freeze({ waist: { male: [0.8, 0.87], female: [0.72, 0.8], boxy: 0.92 }, returns: 2, division: [[0.33, 0.42], [0.6, 0.7]], halves: [0.46, 0.56], legLine: 0.55, divisions: 3, flair: null, bodyLine: null }),
  anime: Object.freeze({ waist: { male: [0.7, 0.8], female: [0.62, 0.75], boxy: 0.92 }, returns: 3, division: [[0.28, 0.38], [0.7, 0.85]], halves: [0.46, 0.56], legLine: 0.6, divisions: 4, flair: [1, 3], bodyLine: 0.6 }),
});
/** the fit classes by ease share (the published minimum wearing ease for `fitted`) */
export const FIT_CLASSES = Object.freeze([['skin', 0.02], ['fitted', 0.11], ['semi', 0.2], ['loose', 0.35], ['oversized', Infinity]]);
const fitClass = (e) => FIT_CLASSES.find(([, hi]) => e <= hi)[0];

const BODY = /^(torso|pelvis|neck|upperArm|foreArm|hand|thumb|index|middle|ring|little|thigh|shank|foot|toes)[RL]?$/;
const HEAD = /^(cranium|jaw|eye|iris|pupil|lid|brow|ear|nostril|upperLip|mouth|hair|face|visage|nose)/;
const ARM = /^(upperArm|foreArm|hand|thumb|index|middle|ring|little|elbowFold)/, UPPER_ARM = /^(upperArm|elbowFold)/, LEG = /^(thigh|shank|foot|toes|kneeFold|hipFold)/;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/** a hex colour's CIELAB lightness */
function lightness(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const lin = (c) => { const v = parseInt(hex.slice(c, c + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const Y = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (24389 / 27) * Y;
}

/** The measures (see the head of this file). */
export function outlineMeasures(mesh, recipe, { profile = false } = {}) {
  const V = mesh.vertices, F = mesh.faces, parts = recipe.parts, J = recipe.rig?.joints ?? {}, at = (k) => J[k]?.at ?? J[k];
  const partOf = (fi) => mesh.provenance[F[fi][0]].part;
  const boneOf = (p) => { const b = parts[p]?.bind; return typeof b === 'string' ? b : b?.bone ?? p; };
  // each face's part: whether it is the body's, its limb (by its bone), and its colour's lightness
  const info = new Map();
  for (const p of new Set(mesh.provenance.map((x) => x.part))) {
    const P = parts[p], bone = boneOf(p);
    if (!P || P.layer !== 1 || HEAD.test(p)) continue;
    info.set(p, { body: BODY.test(p), limb: ARM.test(bone) ? (UPPER_ARM.test(bone) ? 'upperArm' : 'arm') : LEG.test(bone) ? 'leg' : 'trunk', L: lightness(recipe.palette?.[P.group]) });
  }
  const tris = F.map((t, fi) => ({ fi, part: partOf(fi), t })).filter((x) => info.has(x.part));
  // (each face's height span, so a slice reads only the faces it crosses)
  const span = tris.map(({ t }) => { const z = t.map((v) => V[v][2]); return [Math.min(...z), Math.max(...z)]; });
  const BIN = 0.01, bins = new Map();
  span.forEach(([lo, hi], i) => { for (let k = Math.floor(lo / BIN); k <= Math.floor(hi / BIN); k++) { let l = bins.get(k); if (!l) bins.set(k, (l = [])); l.push(i); } });
  /** the slice at height z: per part, its x and y intervals (and its front-most point near the middle) */
  const slice = (z, keep) => {
    const by = new Map();
    for (const i of bins.get(Math.floor(z / BIN)) ?? []) {
      const { t, part } = tris[i];
      if (span[i][0] > z || span[i][1] < z || !keep(info.get(part), part)) continue;
      for (let k = 0; k < 3; k++) {
        const a = V[t[k]], b = V[t[(k + 1) % 3]]; if ((a[2] - z) * (b[2] - z) > 0 || a[2] === b[2]) continue;
        const s = (z - a[2]) / (b[2] - a[2]), x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
        let g = by.get(part); if (!g) by.set(part, (g = { x0: x, x1: x, y0: y, y1: y, front: -Infinity }));
        g.x0 = Math.min(g.x0, x); g.x1 = Math.max(g.x1, x); g.y0 = Math.min(g.y0, y); g.y1 = Math.max(g.y1, y); if (Math.abs(x) < 0.03 && y > g.front) g.front = y;
      }
    }
    return by;
  };
  const union = (iv) => { const s = iv.filter((a) => a[1] > a[0]).sort((a, b) => a[0] - b[0]); let L = 0, lo = -Infinity, hi = -Infinity, ext = [Infinity, -Infinity]; const runs = [];
    for (const [a, b] of s) { ext = [Math.min(ext[0], a), Math.max(ext[1], b)]; if (a > hi) { if (hi > lo) { L += hi - lo; runs.push([lo, hi]); } lo = a; hi = b; } else hi = Math.max(hi, b); } if (hi > lo) { L += hi - lo; runs.push([lo, hi]); }
    return { L, W: ext[1] > ext[0] ? ext[1] - ext[0] : 0, runs }; };
  /** front width and side depth at z, of the faces `keep` admits (dressed: every part; bare: the body's) */
  const width = (z, keep) => { const s = [...slice(z, keep).values()]; return { W: union(s.map((g) => [g.x0, g.x1])).W, D: union(s.map((g) => [g.y0, g.y1])).W, L: union(s.map((g) => [g.x0, g.x1])).L }; };
  const dressed = (lim) => (I) => lim.includes(I.limb), bare = (lim) => (I) => I.body && lim.includes(I.limb);
  const side = (lim, sgn) => (I, part) => lim.includes(I.limb) && /R$/.test(part) === (sgn > 0);

  // the landmarks' heights, off the rig and the bare body
  const zs = Object.values(parts).filter((P) => P.layer === 1).flatMap((P) => P.stations.flatMap((st) => Object.values(st.points).map((p) => p[2])));
  const ground = Math.min(...zs), top = at('headTop')?.[2] ?? Math.max(...zs), S = top - ground;
  const zSh = at('shoulderR')[2], zHip = at('hipR')[2], zKnee = at('kneeR')[2], zAnk = at('ankleR')[2], zNav = at('navel')?.[2] ?? (zSh + zHip) / 2, zWr = at('wristR')?.[2];
  const pel = parts.pelvis, zCr = pel ? Math.min(...pel.stations[0] ? Object.values(pel.stations[0].points).map((p) => p[2]) : [zHip - 0.08]) : zHip - 0.08;
  // (the calf's widest: the bare right shank's widest between the knee and the ankle)
  let zCalf = (zKnee + zAnk) / 2, best = 0;
  for (let z = zKnee - 0.03; z > zAnk + 0.05; z -= 0.01) { const w = width(z, (I, p) => I.body && side(['leg'], 1)(I, p)).W; if (w > best) { best = w; zCalf = z; } }
  const TRUNK = ['trunk', 'leg'], WITH_ARMS = ['trunk', 'leg', 'upperArm'];
  // (the outer trunk garment's hem: the lowest edge of what the trunk wears; else the legs' garments')
  const worn = [...info.entries()].filter(([, I]) => !I.body), lowOf = (p) => Math.min(...parts[p].stations.flatMap((st) => Object.values(st.points).map((q) => q[2])));
  // (a garment's pieces share the name before the underscore: the trousers' seat and legs, the jacket's body and sleeves)
  const gid = (p) => p.split('_')[0].replace(/(Sole|Strap\d*|Buckle\d*|Cuff|Sash|Knot|Tail[RL]?|Lapel|Flap)$/, '').replace(/^adorn\..*/, 'adorn'), pieces = worn.filter(([p]) => parts[p].garment), legged = new Set(pieces.filter(([, I]) => I.limb === 'leg').map(([p]) => gid(p)));
  const trunkWear = pieces.filter(([p, I]) => I.limb === 'trunk' && !legged.has(gid(p)) && lowOf(p) < zHip).map(([p]) => lowOf(p)), legWear = pieces.filter(([, I]) => I.limb === 'leg').map(([p]) => lowOf(p));
  const zHem = trunkWear.length ? Math.min(...trunkWear) + 0.01 : legWear.length ? Math.max(Math.min(...legWear) + 0.01, zAnk) : zCr;
  const LM = { shoulder: [zSh - 0.04, WITH_ARMS], chest: [zNav + 0.6 * (zSh - zNav), TRUNK], waist: [zNav, TRUNK], hip: [zHip, TRUNK], crotch: [zCr - 0.01, TRUNK], midThigh: [(zHip + zKnee) / 2, TRUNK], knee: [zKnee, TRUNK], calf: [zCalf, TRUNK], ankle: [zAnk + 0.03, ['leg']], hem: [zHem, TRUNK] };
  const at_ = {};
  for (const [k, [z, lim]] of Object.entries(LM)) {
    const keepD = k === 'ankle' ? side(lim, 1) : dressed(lim), keepB = k === 'ankle' ? (I, p) => I.body && side(lim, 1)(I, p) : bare(lim);
    const d = width(z, keepD), b = width(z, keepB);
    at_[k] = { z: r3(z), f: r3((top - z) / S), W: r3(d.W), B: r3(b.W), e: b.W > 0 ? r3(d.W / b.W - 1) : null, WD: r3(d.D), BD: r3(b.D) };
  }
  if (zWr !== undefined) { const d = width(zWr, side(['arm', 'upperArm'], 1)), b = width(zWr, (I, p) => I.body && side(['arm', 'upperArm'], 1)(I, p)); at_.wrist = { z: r3(zWr), f: r3((top - zWr) / S), W: r3(d.W), B: r3(b.W), e: b.W > 0 ? r3(d.W / b.W - 1) : null }; }
  const ratio = (k) => ({ waistOverShoulder: at_.waist[k] / at_.shoulder[k], waistOverHip: at_.waist[k] / at_.hip[k], hipOverShoulder: at_.hip[k] / at_.shoulder[k], hemOverShoulder: at_.hem[k] / at_.shoulder[k], waistOverChest: at_.waist[k] / at_.chest[k] });
  const R = ratio('W'), RB = ratio('B'), round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v)]));

  // mass above and below the waist: the dressed outline's area (union lengths) over the bare's
  let up = 0, dn = 0, upB = 0, dnB = 0;
  for (let z = ground + 0.005; z < zSh + 0.02; z += 0.01) { const d = width(z, dressed(WITH_ARMS)).L, b = width(z, bare(WITH_ARMS)).L; if (z > zNav) { up += d; upB += b; } else { dn += d; dnB += b; } }
  const rho = upB > 0 && dn > 0 && dnB > 0 ? (up / dn) / (upB / dnB) : null;

  // the divisions: each worn part's lower edge in the trunk and the legs, and each belt's middle, with the value step at
  // the front across it (the front-most face near the middle 2 cm above and below)
  const frontL = (z) => { let y = -Infinity, L = null; for (const [p, g] of slice(z, (I) => TRUNK.includes(I.limb))) if (g.front > y) { y = g.front; L = info.get(p).L; } return L; };
  // (an edge divides only where its piece spans the body's width, half of it at least, and the same garment does not go
  // on below it: a sash's tails, a pauldron's rim and the trousers' seat over their own legs are not divisions)
  const divisions = [];
  for (const [p, I] of worn) {
    if (!TRUNK.includes(I.limb)) continue;
    const P = parts[p], z = lowOf(p), belt = P.group === 'Sash' && P.stations.length === 2;
    if (!P.garment && !belt) continue;
    const zc = belt ? (z + Math.max(...P.stations.flatMap((st) => Object.values(st.points).map((q) => q[2])))) / 2 : z;
    if (zc < zAnk + 0.02 || divisions.some((d) => Math.abs(d.z - zc) < 0.02)) continue;
    const zIn = belt ? zc : z + 0.012, own = [...slice(zIn, (J, q) => q === p || (gid(q) === gid(p) && J.limb === I.limb)).values()], all = width(zIn, dressed(TRUNK)).W;
    if (!own.length || own.reduce((m, g) => Math.max(m, g.x1 - g.x0), 0) < 0.5 * all) continue;
    if (!belt && [...slice(z - 0.015, (J, q) => J && !J.body && parts[q].garment).keys()].some((q) => gid(q) === gid(p) && q !== p)) continue;
    const a = frontL(zc + 0.02), b = frontL(zc - 0.02);
    divisions.push({ z: r3(zc), f: r3((top - zc) / S), kind: belt ? 'belt' : 'hem', dL: a !== null && b !== null ? r3(Math.abs(a - b)) : null });
  }
  divisions.sort((a, b) => b.z - a.z);
  const dominant = divisions.reduce((m, d) => (!m || (d.dL ?? 0) > (m.dL ?? 0) || (d.dL === m.dL && d.kind === 'hem' && m.kind !== 'hem') ? d : m), null);
  // the leg line: up from the ground to the first division over mid-thigh that steps the value or the width
  const firstAbove = [...divisions].reverse().find((d) => d.z > LM.midThigh[0] && ((d.dL ?? 0) >= 20 || Math.abs(width(d.z + 0.015, dressed(TRUNK)).W / Math.max(1e-6, width(d.z - 0.015, dressed(TRUNK)).W) - 1) >= 0.1));
  const legLine = r3(((firstAbove?.z ?? zSh) - ground) / S);
  // a hem on a leg between the crotch and the ankle: its place on the leg's bare profile there (0 its narrowest, 1 its widest)
  // (a hem just under the knee, or at it, lands where the leg narrows below the kneecap: by the principle, a good landing)
  const hems = [...new Set(pieces.filter(([, I]) => TRUNK.includes(I.limb)).map(([p]) => r3(lowOf(p))))].filter((z) => z > zAnk + 0.04 && z < zCr - 0.01).map((z) => {
    if (z > zKnee - 0.05 && z < zKnee + 0.03) return { z: r3(z), on: 'knee', pos: 0 };
    // (the shank's profile below the knee, the knee itself not counted: a hem just under the knee slims)
    const [lo, hi, on] = z > zKnee ? [zKnee, zCr, 'thigh'] : [zAnk + 0.02, zKnee - 0.04, 'shank'], prof = [];
    const legB = (I, p) => I.body && side(['leg'], 1)(I, p);
    for (let h = lo; h <= hi; h += 0.01) prof.push(width(h, legB).W);
    const w = width(z, legB).W, mn = Math.min(...prof), mx = Math.max(...prof);
    return { z: r3(z), on, pos: mx > mn ? r3(Math.max(0, Math.min(1, (w - mn) / (mx - mn)))) : null };
  });
  // the flair: runs of e > 0.25 down the trunk (shoulder to hem), the right arm (shoulder to wrist) and the right leg
  // (crotch to ankle), and the share of the samples at e ≤ 0.10
  // (each loose sample names the garment reaching furthest there: the pieces are the garments, not the runs)
  const loud = new Map(), sample = (z0, z1, keepD, keepB) => { const out = []; for (let z = z0; z > z1; z -= 0.02) { const b = width(z, keepB).W; if (b <= 0.01) continue;
    const e = width(z, keepD).W / b - 1; out.push(e);
    if (e > 0.25) { let far = null, x = -Infinity; for (const [q, g] of slice(z, keepD)) if (!info.get(q).body && Math.max(Math.abs(g.x0), Math.abs(g.x1)) > x) { x = Math.max(Math.abs(g.x0), Math.abs(g.x1)); far = q; } if (far) loud.set(gid(far), (loud.get(gid(far)) ?? 0) + 1); } } return out; };
  const trunkE = sample(zSh - 0.06, Math.max(zHem, zCr), dressed(TRUNK), bare(TRUNK));
  const armE = zWr !== undefined ? sample(zSh - 0.08, zWr, side(['arm', 'upperArm'], 1), (I, p) => I.body && side(['arm', 'upperArm'], 1)(I, p)) : [];
  const legE = sample(zCr - 0.03, zAnk + 0.02, side(['leg'], 1), (I, p) => I.body && side(['leg'], 1)(I, p));
  const all = [...trunkE, ...armE, ...legE];
  // (a garment is a flair piece where it is the furthest over 4 cm at least: a buckle's corner is not)
  const flaring = [...loud].filter(([, n]) => n >= 2).map(([g]) => g).sort();
  const flair = { pieces: flaring.length, of: flaring, bodyLine: all.length ? r3(all.filter((e) => e <= 0.1).length / all.length) : null };
  const mean = (xs) => { const v = xs.filter((x) => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const top_ = mean([at_.chest.e, at_.waist.e]), bot = mean([at_.hip.e, at_.midThigh.e, at_.knee.e]);
  // the RETURN points: where the cloth comes back to the body, the least standoff each side in each region (the waist
  // between the hip and the navel, the wrist over the forearm's lowest fifth, the ankle up from the ground to over it)
  const least = (z0, z1, keepD, keepB) => { let m = Infinity; for (let z = z0; z > z1; z -= 0.01) { const b = width(z, keepB).W; if (b > 0.01) m = Math.min(m, (width(z, keepD).W - b) / 2); } return m; };
  const elbowZ = at('elbowR')?.[2] ?? zSh - 0.3, armK = side(['arm', 'upperArm'], 1), armB = (I, p) => I.body && armK(I, p), legK = side(['leg'], 1), legB = (I, p) => I.body && legK(I, p);
  const ret = { waist: least(zNav + 0.05, zHip + 0.04, dressed(TRUNK), bare(TRUNK)), wrist: zWr !== undefined ? least(zWr + 0.2 * (elbowZ - zWr), zWr - 0.01, armK, armB) : Infinity, ankle: least(zAnk + 0.08, ground + 0.02, legK, legB) };
  // (by the cloth's standoff each side, within 25 mm, not by ease share: a belt over a jacket over trousers is three
  // layers, which a narrow waist's share counts as loose)
  const returns = Object.entries(ret).filter(([, g]) => g <= 0.025).map(([k]) => k);
  return { S: r3(S), at: at_, ratios: round(R), bareRatios: round(RB), shift: round(Object.fromEntries(Object.keys(R).map((k) => [k, R[k] - RB[k]]))),
    family: familyOf(R, at_, 'W'), bareFamily: familyOf(RB, at_, 'B'), fit: { top: { e: r3(top_), class: fitClass(top_ ?? 0) }, bottom: { e: r3(bot), class: fitClass(bot ?? 0) } },
    ...(profile ? { profile: (() => { const rows = []; for (let z = ground + 0.0025; z < top; z += 0.005) { const d = union([...slice(z, () => true).values()].map((g) => [g.x0, g.x1])).runs, b = union([...slice(z, (I) => I.body).values()].map((g) => [g.x0, g.x1])).runs; if (d.length || b.length) rows.push({ z: r3(z), dressed: d.map((x) => x.map(r3)), bare: b.map((x) => x.map(r3)) }); } return { ground: r3(ground), top: r3(top), rows, landmarks: Object.fromEntries(Object.entries(at_).map(([k, v]) => [k, v.z])) }; })() } : {}),
    returns, returnGap: Object.fromEntries(Object.entries(ret).map(([k, g]) => [k, r3(g)])), rho: r3(rho), divisions, dominant, legLine, hems, flair };
}

/** the silhouette family by its outline's ratios (docs/garment-principles.md), the first rule that holds. The cut-offs
 * are the research's, re-centred on this body as it is read: the shoulder deltoid to deltoid with the arms hanging in the
 * A pose (wider against the hip than a fashion figure's), so a bare athletic woman reads X and a bare man V; calibrated
 * on cards, stylisms and the loose words across both casts and two physiques */
function familyOf(R, at, k) {
  const hipSh = R.hipOverShoulder, shHip = 1 / hipSh, hemSh = R.hemOverShoulder, hemHip = at.hem[k] / at.hip[k], waistMax = at.waist[k] / Math.max(at.shoulder[k], at.hip[k]), hipWaist = at.hip[k] / at.waist[k];
  if (at.waist[k] >= Math.max(at.shoulder[k], at.hip[k]) && at.hem[k] / at.waist[k] <= 0.9) return 'O';
  if (R.waistOverShoulder <= 0.8 && R.waistOverHip <= 0.8 && hipSh >= 0.8) return 'X';
  if (hemHip >= 1.15 && hemSh >= 0.9) return waistMax >= 0.85 && hemSh >= 1.1 ? 'trapeze' : 'A';
  if (shHip >= 1.3 && hipWaist >= 0.92 && hipWaist <= 1.08) return 'T';
  if (shHip >= 1.2 && at.hem[k] <= at.hip[k]) return 'V';
  if (waistMax >= 0.85 && hipSh >= 0.75 && hemSh >= 0.75 && hemSh <= 1.1) return 'H';
  return hipSh >= 1.1 ? 'triangle' : 'between';
}

/** The read against a style's bands: each measure in band or out, an advice line for each out (see the head) */
export function outlineCritic(m, style = 'western', { sex = 'male' } = {}) {
  const B = OUTLINE_BANDS[style]; if (!B) throw new Error(`dress-outline: style is ${Object.keys(OUTLINE_BANDS).join(' or ')}`);
  const reads = [], advice = [], read = (id, value, band, ok, line) => { reads.push({ id, value, band, in: ok }); if (!ok && line) advice.push(line); };
  const loose = (c) => c === 'loose' || c === 'oversized';
  // waist suppression (tailored or fitted vs boxy): read only where the waist is marked at all
  const ws = m.ratios.waistOverChest, wb = B.waist[sex] ?? B.waist.male;
  read('waist', ws, wb, ws <= wb[1] || ws >= B.waist.boxy, `waist over chest ${ws}: neither cut in (≤ ${wb[1]}) nor boxy (≥ ${B.waist.boxy}): mark the waist (a belt, a cinch, a dart) or let the cloth fall straight`);
  // both halves loose: the outline must return to the body
  if (loose(m.fit.top.class) && loose(m.fit.bottom.class)) {
    const n = m.returns.length, ok = n >= B.returns && m.returns.includes('waist');
    read('returns', m.returns, `≥ ${B.returns}, the waist one`, ok, `loose above and below with ${n ? m.returns.join(', ') : 'nothing'} returning to the body: gather it at the waist${B.returns > 2 ? ', the cuffs or the ankles' : ' and one more (a cuff, an ankle)'} or it reads as a sack`);
  }
  // the dominant division: on thirds, never halves
  if (m.dominant) {
    const f = m.dominant.f, onThirds = B.division.some(([a, b]) => f >= a && f <= b), halves = f >= B.halves[0] && f <= B.halves[1];
    read('division', f, B.division, !halves, halves ? `the strongest division (a ${m.dominant.kind}) at ${f} of the height down cuts the figure in half: move it up to the waist (≤ ${B.division[0][1]}) or down past mid-thigh (≥ ${B.division[1][0]})` : null);
    if (!halves && !onThirds) reads[reads.length - 1].note = 'off the thirds, not at halves';
  }
  read('legLine', m.legLine, `≥ ${B.legLine}`, m.legLine >= B.legLine, `the leg reads ${m.legLine} of the height: raise the first division over the thigh or carry one value from the waist to the shoe`);
  read('divisions', m.divisions.length, `≤ ${B.divisions}`, m.divisions.length <= B.divisions, `${m.divisions.length} hard divisions: drop or match the value of one (a belt the trousers' value, a hem that a layer covers)`);
  for (const h of m.hems) if (h.pos !== null) read(`hem@${h.on}`, h.pos, '≤ 0.35 good, ≥ 0.8 warn', h.pos < 0.8, `a hem on the ${h.on} at its widest (${h.pos}): move it below the ${h.on === 'shank' ? 'calf' : 'thigh'}'s widest or to a narrow point`);
  if (B.flair) read('flair', m.flair.pieces, B.flair, m.flair.pieces >= B.flair[0] && m.flair.pieces <= B.flair[1], m.flair.pieces > B.flair[1] ? `${m.flair.pieces} exaggerated pieces: keep one to three, the rest close to the body` : 'no exaggerated piece: give the silhouette one (a sleeve, a trouser leg, a coat skirt, a sash)');
  const escape = loose(m.fit.top.class) && loose(m.fit.bottom.class) && m.returns.length >= B.returns && m.returns.includes('waist');
  if (B.bodyLine && !escape) read('bodyLine', m.flair.bodyLine, `≥ ${B.bodyLine}`, m.flair.bodyLine >= B.bodyLine, `only ${m.flair.bodyLine} of the body's length lies close: keep the body line under the flair`);
  return { style, family: m.family, bareFamily: m.bareFamily, reads, advice };
}
