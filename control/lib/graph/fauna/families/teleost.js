// TELEOST — the bony fishes. The family's tables are an ATLANTIC SALMON: a fusiform, laterally compressed body held
// level and SUSPENDED in water (pose 'swim': no legs, nothing on the ground; fauna-fit --pose swim), a conical head
// with the eyes on the sides and a terminal mouth, and every fin a THIN FLAT CLOSED part attached into the body:
// a dorsal fin, a small adipose fin, an anal fin (midline lofts on a stable +z ring frame, thin across x), a FORKED
// caudal fin (two midline lobes raking up and down off the peduncle) and paired pectoral and pelvic fins (flat
// segments, thin vertically). Tables are authored in metres at salmon size, body centre at z = 0.5.
// Builder features used: legs: [], ears: false, nose: false, tail: null, extra loft / segment `up`, markings.
// Worked species: salmon, clownfish, goldfish, angelfish.

const T = 0.004;   // a fin's half-thickness (m, before scale): thin and flat, but a closed solid
/** A MIDLINE FIN: a loft on a stable +z ring frame (thin across x), from rows [y, zBase, height] — each ring centred
 * half its height above (`dir` 1) or below (-1) zBase, with `bury` of it sunk into the body so it stays attached.
 * The fin's outline is the run of heights: tall at the leading edge, trailing off behind for a raked fin. */
export function midFin(name, rows, { dir = 1, bury = 0.012, t = T, group = 'Tip' } = {}) {
  const st = rows.map(([y, z, h]) => ({ at: [0, y, z + dir * (h / 2 - bury)], r: [t, h / 2 + bury] }));
  const a = st[0].at, b = st[st.length - 1].at;
  return { name, kind: 'loft', slots: 'ring12', group, mirror: 'plane', up: true, stations: st,
    caps: { back: [0, a[1] + 0.006, a[2]], tip: [0, b[1] - 0.006, b[2]] } };
}
/** A LOBE: a midline loft along any path [[y, z, halfWidth], …] (thin across x) — a caudal lobe, a sail fin. */
export function lobe(name, rows, { t = T, group = 'Tip' } = {}) {
  const st = rows.map(([y, z, w]) => ({ at: [0, y, z], r: [t, w] }));
  const dir = (i, j) => { const dy = st[i].at[1] - st[j].at[1], dz = st[i].at[2] - st[j].at[2], L = Math.hypot(dy, dz) || 1; return [0, dy / L, dz / L]; };
  const end = (i, j) => st[i].at.map((x, c) => x + dir(i, j)[c] * 0.006), n = st.length;
  return { name, kind: 'loft', slots: 'ring12', group, mirror: 'plane', up: true, stations: st, caps: { back: end(0, 1), tip: end(n - 1, n - 2) } };
}
/** A PAIRED FIN: a flat segment from a root joint to a tip joint, thin along `up` (default +z: lying flat). */
export const pairFin = (name, from, to, wA, wB, { t = T, up = [0, 0, 1], group = 'Tip' } = {}) =>
  ({ name, kind: 'segment', from, to, rA: [wA, t], rB: [wB, t * 0.7], slots: 'ring12', over: [0.2, 0.3], group, mirror: 'name', up });

/** THE FISH HEAD: the body loft carried on to the snout as smooth skull rows (no orbit, no brow, no neck), built from
 * the body's front ring, in the head's own frame (nape on neckTop, `s` metres per head unit). Fields of `H`:
 *   len     the head's length past the body's front row (m) — the snout tip sits at yF + len
 *   taper   [p, q]: the profile F(v) = (1 − v^p)^q over v = 0 (front row) → 1 (snout); a smaller p is more conical
 *   kx      the head's width against the body's front ring; snout (−1 … 1): the tip's height in body half-depths
 *   eye     { at: fraction of `len` behind the snout, h: 0 (side midline) … 1 (top), r: radius in body half-depths }
 *   mouth   'terminal' | 'upturned' (the lower jaw rising to the tip, a kype) | 'small' | 'pointed'
 *   rows    the skull rows' v (default 9 rows, the first two v < −0.15 inside the trunk); add rows for a face band
 *   gill    the operculum edge: fraction of `len` behind the snout (a thin curved ridge; false = none) */
function fishHead(H, { yF, wF, hF, Z, s, k, lerp }) {
  const len = H.len ?? 0.14, [tp, tq] = H.taper ?? [1.8, 0.6], kx = H.kx ?? 0.95, zs = (H.snout ?? -0.1) * hF;
  const E = { at: 0.36, h: 0.35, r: 0.2, ...(H.eye || {}) }, mouth = H.mouth ?? 'terminal';
  const M = { terminal: { gape: 0.62, up: 0, jut: 0 }, upturned: { gape: 0.58, up: 0.14, jut: 0.03 }, small: { gape: 0.84, up: 0.03, jut: 0 }, pointed: { gape: 0.8, up: 0.08, jut: 0.02 } }[mouth];
  if (!M) throw new Error(`fishMaker: mouth '${mouth}' is not terminal / upturned / small / pointed`);
  const F = (v) => (v <= 0 ? 1 : v >= 1 ? 0 : (1 - v ** tp) ** tq);
  const hp = (y, z) => [(y - (yF + 0.01)) / s, z / s];   // world (y, z above the axis) → head frame (y, z)
  const ring = (v) => { const y = yF + v * len, f = F(v), fi = v < -0.15 ? 0.45 : 1.01, w = (v <= 0 ? lerp(y, 1) * fi : wF * 1.01 * kx * f ** 0.9), h0 = (v <= 0 ? lerp(y, 2) : hF) * fi;
    const top = v <= 0 ? h0 : zs + (h0 - zs) * f, bot = v <= 0 ? -h0 : zs - (h0 + zs) * f; return { y, w, top, bot, c: (top + bot) / 2, hh: (top - bot) / 2, e: v <= 0 ? 1 : 0.8 }; };
  const xAt = (R, z) => R.w * Math.sqrt(Math.max(0, 1 - ((z - R.c) / R.hh) ** 2)) ** R.e;   // the trunk's ellipse inside it, flat-sided past it
  const mz = (v) => zs + M.up * hF * Math.max(0, (v - M.gape) / (1 - M.gape)) - M.up * hF * 0.5, ov = 0.06 * hF;
  const V = H.rows ?? [-0.4, -0.22, -0.04, 0.15, 0.35, 0.52, 0.68, 0.82, 0.93];   // v of each skull row; the first two sit small inside the trunk
  const ANG = [0, 30, 60, 90, 120, 150, 180].map((d) => d * Math.PI / 180);
  const xz = (x, z, y) => { const [, zh] = hp(y, z); return [x / s, zh]; };
  const craniumRows = V.map((v, i) => { const R = ring(v), cut = v >= M.gape, lo = cut ? Math.max(R.bot, mz(v) - ov) : R.bot, c = (R.top + lo) / 2, hh = (R.top - lo) / 2;
    const P = ANG.map((a) => { const z = c + hh * Math.cos(a); return xz(Math.max(xAt(R, z), a > 0 && a < Math.PI ? 0.08 * R.w : 0), z, R.y); });
    return [`st${i}`, hp(R.y, 0)[0], P[0][1], ...P.slice(1, 6), P[6][1]]; });
  const tipY = yF + len, tipZ = zs + ov * 0.5;
  // the lower jaw: from just behind the gape (buried) to the snout, its top on the mouth line, its keel the fish's chin
  const JV = [M.gape - 0.1, ...V.filter((v) => v >= M.gape)];
  while (JV.length < 3) JV.splice(1, 0, (JV[0] + JV[1]) / 2);   // the head format's cheek web wants three jaw rows
  const jawRows = JV.map((v, i) => { const R = ring(v), m = mz(v), sh = i ? 1 : 0.75, b = R.bot * (i ? 1 : 0.9);
    const zj = (m + b) / 2;
    return [`st${i}`, hp(R.y, 0)[0], { gum: hp(0, m + ov * 0.6)[1], gumR: xz(xAt(R, m) * 0.97 * sh, m + ov * 0.2, R.y), jaw: xz(xAt(R, zj) * 0.97 * sh, zj, R.y), bottom: hp(0, b)[1] }]; });
  const jawTip = yF + len * (1 + M.jut);
  // addresses on the skull: station = a float row index from a fraction of len behind the snout; slot t from height
  const st = (back) => { const y = yF + len * (1 - back); for (let i = 1; i < V.length; i++) { const y1 = yF + V[i] * len; if (y <= y1) { const y0 = yF + V[i - 1] * len; return i - 1 + (y - y0) / (y1 - y0); } } return V.length - 1; };
  const eyeS = st(E.at), eyeT = 3 - 3 * E.h, hk = s * k;
  // THE EYE: a flat disc (iris) with a proud pupil disc, set into the side — no orbit, no lid, no brow (the head
  // format's own eye region is kept, tiny, inside the trunk). All three details are short sweeps given in the head's
  // frame (space 'head'), pinned at the nearest skull address.
  const H3 = (x, y, z) => [x / s, ...hp(y, z)];
  const Re = E.r * hF, Ry = yF + len * (1 - E.at), RE = ring(1 - E.at), ze = RE.c + E.h * RE.hh, xe = xAt(RE, ze);
  const disc = (name, r, d0, d1, group) => ({ kind: 'sweep', name, at: [eyeS, eyeT], space: 'head', spine: [H3(xe + d0 * Re, Ry, ze), H3(xe + d1 * Re, Ry, ze)], radii: [r * k, r * k], m: 12, squash: [1, 1], group });
  const eye = [disc('eyeIris', Re, -0.3, 0.42, 'Iris'), disc('eyePupil', Re * (E.pupil ?? 0.58), -0.1, 0.52, 'Pupil')];
  // THE MOUTH: a thin dark lip line along the gape, from its corner to the snout tip
  const lv = [M.gape, (M.gape + 0.97) / 2, 0.97], lr = 0.0035 * (hF / 0.078);
  const lips = [{ kind: 'sweep', name: 'lip', at: [st(1 - (M.gape + 0.97) / 2), 5], space: 'head', group: 'Mouth', m: 6, squash: [1, 1],
    spine: lv.map((v) => { const R = ring(v), m = mz(v); return H3(Math.max(xAt(R, m), 0.12 * R.w) + lr * 0.2, R.y, m); }), radii: [0.7, 0.8, 0.5].map((r) => r * lr * k) }];
  // THE GILL COVER: the operculum's edge, a thin ridge bowed back (a ')' facing the tail) across the cheek
  const gb = H.gill ?? 0.82, gr = 0.0018 * (hF / 0.078);
  const gill = H.gill === false ? [] : [{ kind: 'sweep', name: 'gill', at: [st(gb), 3], space: 'head', group: 'Gill', m: 6, squash: [1, 1],
    spine: [[0.6, 0.72], [-0.3, 0.45], [-0.7, 0], [-0.3, -0.45], [0.6, -0.72]].map(([a, b]) => { const y = yF + len * (1 - gb) + a * len * 0.08, R = ring((y - yF) / len), z = R.c + b * R.hh;
      return H3(xAt(R, z) + gr * 0.1, y, z); }), radii: [0.5, 0.9, 1, 0.9, 0.5].map((r) => r * gr * k) }];
  return {
    craniumRows, jawRows, muzzleFrom: 4, muzzleLen: 1, muzzleW: 1, headScale: s, nape: [0, 0, 0], headRelative: true, relBrow: true,
    craniumCaps: { back: [0, hp(yF + V[0] * len - 0.01, 0)[0], 0], tip: [0, hp(tipY, 0)[0], hp(0, tipZ)[1]] },
    jawCaps: { back: [0, hp(yF + (M.gape - 0.1) * len - 0.008, 0)[0], hp(0, (mz(M.gape) + ring(M.gape).bot) / 2)[1]], tip: [0, hp(jawTip, 0)[0], hp(0, mz(1) - ov * 0.3)[1]] },
    eyeAt: [0.5, 0], eyeR: 0.0004 / hk, orbit: { reach: [0.0002, 0.0002, 0.0002].map((x) => x / s), tuck: 0, bulk: [0, 0], thickness: 0.0002 / s }, orbitFallback: true,
    // the face strips the head format requires, laid where the body hides them (the skull rows inside the trunk)
    browStrip: [[0.1, 0.8], [0.3, 0.8], [0.5, 0.8], [0.7, 0.8], [0.9, 0.8]], foldStrip: [[0.1, 2.2], [0.3, 2.2], [0.5, 2.2], [0.7, 2.2], [0.9, 2.2]],
    nostrilAt: [0.5, 1.5], webCranium: [0.5, 2.5, 0.9], skinControls: { browRaise: { amp: 0.0001, map: [['st1.brow', 0.1, [0, 0, 1]]] } },
    headOrnaments: [...eye, ...lips, ...gill],
  };
}

/** THE FISH MAKER: one compact, species-free description → the species params the fauna builder takes (torso,
 * neck, joints, head shape, every fin as a thin flat closed part, colours, markings). Units: metres BEFORE `scale`
 * (author every fish at ~0.75 m, snout ≈ +0.33, tail tip ≈ −0.43; `scale` = published length ÷ that), +y the head,
 * the body centred at height `Z` (suspended: pose 'swim'). Fields:
 *   body      [[y, halfWidth, halfDepth], …] back (peduncle) → front; level, centred on Z. Fin bases follow it.
 *   head      { scale, len, taper, kx, snout, eye: { at, h, r }, mouth, gill } — the fish's own head (see fishHead)
 *   caudal    { kind: 'forked' | 'lunate' | 'rounded' | 'flowing', len, spread (tip height off the axis), w (lobe half
 *             width), from (y; default the first body row) }
 *   dorsal    [[y, height], …] front → back (a raked fin: tall in front); `dorsal2`, `adipose`, `anal` alike (anal hangs)
 *   sails     { dorsal: [[y, z, w], …], anal: … }: free lobes for fins that sweep far past the body (angelfish)
 *   pectoral  { y, len, w: [root, tip], up?, drop? }   pelvic { y, len, w, up?, drop? } — paired, flat
 *   colors, markings, headPalette, craniumBandGroups, markDensity, name, scale — passed through */
export function fishMaker(F) {
  const Z = F.Z ?? 0.5, B = F.body, H = F.head || {};
  const lerp = (y, k) => { if (y <= B[0][0]) return B[0][k]; for (let i = 1; i < B.length; i++) if (y <= B[i][0]) { const f = (y - B[i - 1][0]) / (B[i][0] - B[i - 1][0]); return B[i - 1][k] + (B[i][k] - B[i - 1][k]) * f; } return B[B.length - 1][k]; };
  const top = (y) => Z + lerp(y, 2) * 0.97, bot = (y) => Z - lerp(y, 2) * 0.97;
  const yB = B[0][0], yF = B[B.length - 1][0], [, wF, hF] = B[B.length - 1];
  const fin = (y, len, w, dropK, sideK, depthK) => [[sideK * lerp(y, 1), y, Z - depthK * lerp(y, 2)], [sideK * lerp(y, 1) + len * 0.45, y - len * 0.85, Z - depthK * lerp(y, 2) - len * dropK]];
  const pec = F.pectoral, pel = F.pelvic;
  const [pr, pt] = pec ? fin(pec.y, pec.len, pec.w, pec.drop ?? 0.35, 0.8, 0.45) : [];
  const [vr, vt] = pel ? fin(pel.y, pel.len, pel.w, pel.drop ?? 0.3, 0.55, 0.85) : [];
  const C = { kind: 'forked', len: 0.14, spread: 0.1, w: 0.03, ...(F.caudal || {}) }, c0 = C.from ?? yB + 0.01, L = C.len, S = C.spread, W = C.w;
  const lobes = (sg) => [[c0, Z + sg * 0.005, W * 0.6], [c0 - L * 0.3, Z + sg * S * 0.3, W], [c0 - L * 0.65, Z + sg * S * 0.68, W * 0.8], [c0 - L, Z + sg * S, W * 0.25]];
  const caudal = C.kind === 'rounded'
    ? [lobe('caudalUp', lobes(1).map(([y, z, w], i) => [y, Z + (z - Z) * 0.8, w * (i === 3 ? 2 : 1.2)])), lobe('caudalMid', [[c0, Z, W * 0.7], [c0 - L * 0.4, Z, W * 1.4], [c0 - L * 0.85, Z, W * 1.4], [c0 - L, Z, W * 0.6]]),
      lobe('caudalDn', lobes(-1).map(([y, z, w], i) => [y, Z + (z - Z) * 0.8, w * (i === 3 ? 2 : 1.2)]))]
    : C.kind === 'lunate' ? [lobe('caudalUp', lobes(1).map(([y, z, w], i) => [y + (i ? L * 0.3 * i / 3 : 0), z, w * 0.7])), lobe('caudalDn', lobes(-1).map(([y, z, w], i) => [y + (i ? L * 0.3 * i / 3 : 0), z, w * 0.7]))]
      : [lobe('caudalUp', lobes(1)), lobe('caudalDn', lobes(-1))];   // forked, flowing (a long forked tail: give it len / w)
  const mid = (name, rows, dir) => rows && midFin(name, rows.map(([y, h]) => [y, dir > 0 ? top(y) : bot(y), h]), { dir });
  const fins = [
    mid('dorsal', F.dorsal, 1), mid('dorsal2', F.dorsal2, 1), mid('adipose', F.adipose, 1), mid('anal', F.anal, -1),
    ...Object.entries(F.sails || {}).map(([n, rows]) => lobe(n, rows.map(([y, z, w]) => [y, Z + z, w]))),
    ...caudal,
    ...(pec ? [pairFin('pectoralR', 'pecRoot', 'pecTip', pec.w[0], pec.w[1], pec.up ? { up: pec.up } : {})] : []),
    ...(pel ? [pairFin('pelvicR', 'pelRoot', 'pelTip', pel.w[0], pel.w[1], pel.up ? { up: pel.up } : {})] : []),
  ].filter(Boolean);
  return {
    family: 'teleost', pose: 'swim', ...(F.name ? { name: F.name } : {}), scale: F.scale ?? 1,
    joints: { neckBase: [0, yF - 0.05, Z], neckTop: [0, yF + 0.01, Z], ...(pec ? { pecRoot: pr, pecTip: pt } : {}), ...(pel ? { pelRoot: vr, pelTip: vt } : {}) },
    torso: B.map(([y, w, h]) => ({ at: [0, y, Z], r: [w, h] })),
    torsoCaps: { back: [0, yB - 0.015, Z], tip: [0, yF + 0.025, Z] },
    neckRA: [wF * 0.85, hF * 0.85], neckRB: [wF * 0.8, hF * 0.8], neckRMid: [wF * 0.85, hF * 0.85],
    ...fishHead(H, { yF, wF, hF, Z, s: H.scale ?? 0.42, k: F.scale ?? 1, lerp }),
    extraSegments: fins,
    ...Object.fromEntries(['colors', 'markings', 'craniumBandGroups', 'markDensity'].filter((k) => F[k]).map((k) => [k, F[k]])),
    headPalette: { Palate: F.colors?.belly ?? '#eef1f2', Gill: F.colors?.gill ?? '#7d8a91', Mouth: '#2a2426', ...(F.headPalette || {}) },
  };
}

// ── the species, each one call to the maker (salmon also seeds the family tables) ──
// ATLANTIC SALMON (Salmo salar). Thesis: a FUSIFORM, laterally compressed torpedo, deepest a third back, a slim
// caudal peduncle · conical head, terminal mouth, eyes on the sides · a FORKED caudal fin, one dorsal fin mid-back
// plus the small ADIPOSE fin before the tail (the salmonid tell), anal fin below, low pectorals and mid-belly pelvics
// · silver flanks, dark blue-grey back, white belly · ~0.75 m total length (Wikipedia: adults typically 71–76 cm).
const SALMON = fishMaker({
  name: 'an Atlantic salmon', Z: 0.5,
  body: [[-0.30, 0.011, 0.022], [-0.24, 0.017, 0.032], [-0.14, 0.034, 0.057], [-0.02, 0.047, 0.077], [0.10, 0.05, 0.078], [0.19, 0.036, 0.056]],
  head: { scale: 0.42, len: 0.14, taper: [1.6, 0.65], snout: -0.05, eye: { at: 0.33, h: 0.5, r: 0.2 }, mouth: 'upturned' },
  caudal: { kind: 'forked', from: -0.29, len: 0.13, spread: 0.08, w: 0.034 },
  dorsal: [[0.045, 0.01], [0.03, 0.07], [0.0, 0.06], [-0.03, 0.035], [-0.055, 0.012]],
  adipose: [[-0.165, 0.006], [-0.18, 0.03], [-0.2, 0.01]],
  anal: [[-0.12, 0.008], [-0.135, 0.05], [-0.16, 0.035], [-0.19, 0.01]],
  pectoral: { y: 0.13, len: 0.09, w: [0.014, 0.026] }, pelvic: { y: -0.04, len: 0.065, w: [0.01, 0.016] },
  markings: [
    { on: ['torso', 'neck'], kind: 'band', group: 'Back', t: [0, 0.3], color: '#3f5563' },
    { on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: 0.72 },
  ],
  headPalette: { Skull: '#3f5563', Snout: '#3f5563', Brow: '#3f5563', Lids: '#b9c3c8', Jowl: '#eef1f2', Jaw: '#eef1f2' },
});

export const family = {
  ...SALMON, family: 'teleost', pose: 'swim', name: undefined, markings: undefined, headPalette: undefined,
  colors: {
    coat: '#b9c3c8', sock: '#b9c3c8', ash: '#d6dde0', ashAlt: '#c8d0d4', brow: '#4a5862', iris: '#c9b04a',
    ink: '#0d1114', sclera: '#1c2226', nose: '#4a5862', teeth: '#e4ddc8', mouth: '#9a7c7c', tip: '#4a5862',
    hoof: '#4a5862', belly: '#eef1f2',
  },
  tail: null, tip: null, legs: [], levelLegs: false,
  pupil: 'round', irisAngle: 40,
  noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: [], headTiles: [], bodyTiles: [],
};
for (const k of Object.keys(family)) if (family[k] === undefined) delete family[k];

export const species = {
  salmon: SALMON,
  // CLOWNFISH (Amphiprion ocellaris). Thesis: a short, DEEP oval body (depth ~⅓ of length), a thick peduncle · a
  // blunt rounded head, big eye · ROUNDED fins: a long dorsal (low spiny front, taller rounded soft rear), a rounded
  // fan caudal, rounded anal, big rounded pectorals · ORANGE with THREE WHITE BARS (behind the eye, mid-body, at the
  // tail base) · ~0.11 m total length (Wikipedia, Amphiprion ocellaris: up to 11 cm).
  clownfish: fishMaker({
    name: 'a clownfish', Z: 1, scale: 0.143,
    body: [[-0.27, 0.03, 0.05], [-0.2, 0.04, 0.075], [-0.1, 0.058, 0.115], [0.0, 0.065, 0.13], [0.1, 0.062, 0.122], [0.18, 0.05, 0.095]],
    head: { scale: 0.6, len: 0.16, taper: [2.4, 0.5], snout: -0.15, eye: { at: 0.36, h: 0.4, r: 0.3 }, mouth: 'small', rows: [-0.4, -0.22, -0.04, 0.06, 0.15, 0.3, 0.37, 0.52, 0.68, 0.82, 0.93] },
    caudal: { kind: 'rounded', from: -0.26, len: 0.12, spread: 0.08, w: 0.032 },
    dorsal: [[0.12, 0.01], [0.09, 0.05], [0.0, 0.045], [-0.06, 0.08], [-0.13, 0.085], [-0.19, 0.05], [-0.22, 0.01]],
    anal: [[-0.08, 0.01], [-0.11, 0.07], [-0.16, 0.075], [-0.21, 0.04], [-0.23, 0.008]],
    pectoral: { y: 0.11, len: 0.1, w: [0.02, 0.04], up: [0.4, 0, 1] }, pelvic: { y: 0.04, len: 0.08, w: [0.015, 0.025] },
    markDensity: { torso: 5 },
    // three white bars, each edged in black (the bars on the trunk; the head bar on the skull bands behind the eye),
    // and every fin's outer margin black
    markings: [
      { on: 'torso', kind: 'band', group: 'Band', run: [0.06, 0.16], color: '#f6f5ef' },
      { on: 'torso', kind: 'band', group: 'Band', run: [0.5, 0.68] },
      { on: ['neck'], kind: 'band', group: 'Band' }, { on: 'torso', kind: 'band', group: 'Band', run: [0.93, 1] },
      ...[[0.045, 0.06], [0.16, 0.175], [0.485, 0.5], [0.68, 0.695], [0.915, 0.93]].map((run) => ({ on: 'torso', kind: 'band', group: 'Edge', run, color: '#151313' })),
      { on: ['caudalUp', 'caudalMid', 'caudalDn'], kind: 'band', group: 'Edge', run: [0.72, 1] },
      { on: ['dorsal', 'anal'], kind: 'band', group: 'Edge', t: [0, 0.12] }, { on: ['dorsal', 'anal'], kind: 'band', group: 'Edge', t: [0.88, 1] },
      { on: ['pectoral', 'pelvic'], kind: 'band', group: 'Edge', run: [0.75, 1] },
    ],
    craniumBandGroups: Object.fromEntries([['st2-st3', 'Band'], ['st3-st4', 'Band'], ['st4-st5', 'Band'], ['st5-st6', 'Edge']].map(([b, g]) => [b, Array(6).fill(g)])),
    colors: { gill: '#b8560e', coat: '#e8701c', sock: '#e8701c', ash: '#e8701c', ashAlt: '#e07018', belly: '#ec7c28', tip: '#e06a18', brow: '#e8701c', iris: '#e8a020', sclera: '#141414' },
    headPalette: { Band: '#f6f5ef', Edge: '#151313', Jaw: '#e8701c', Jowl: '#e8701c' },
  }),
  // COMMON GOLDFISH (Carassius auratus). Thesis: a DEEP, short, humped carp body (depth ~40% of standard length), a
  // short blunt head with a small terminal mouth and no barbels · one tall dorsal fin, a LONG FLOWING, deeply forked
  // caudal (~⅓ of total length), paired pelvics and a small anal · solid orange-gold · ~0.20 m total (Wikipedia:
  // goldfish commonly 10–20 cm; FishBase common length 20 cm).
  goldfish: fishMaker({
    name: 'a goldfish', Z: 1, scale: 0.225,
    body: [[-0.25, 0.03, 0.045], [-0.18, 0.045, 0.075], [-0.08, 0.065, 0.115], [0.02, 0.07, 0.125], [0.1, 0.066, 0.12], [0.17, 0.052, 0.092]],
    head: { scale: 0.52, len: 0.14, taper: [2.2, 0.55], snout: -0.1, eye: { at: 0.4, h: 0.42, r: 0.26 }, mouth: 'small' },
    caudal: { kind: 'flowing', from: -0.24, len: 0.34, spread: 0.12, w: 0.06 },
    dorsal: [[0.06, 0.01], [0.04, 0.11], [-0.02, 0.09], [-0.1, 0.06], [-0.16, 0.02]],
    anal: [[-0.11, 0.01], [-0.13, 0.06], [-0.17, 0.04], [-0.2, 0.01]],
    pectoral: { y: 0.1, len: 0.1, w: [0.018, 0.035] }, pelvic: { y: -0.02, len: 0.1, w: [0.015, 0.03] },
    colors: { gill: '#c8680e', coat: '#f08a1c', sock: '#f08a1c', ash: '#f39a30', ashAlt: '#ee9228', belly: '#f6b050', tip: '#f2962c', brow: '#f08a1c', iris: '#d8a030', sclera: '#141414' },
    markings: [{ on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: 0.75 }],
    headPalette: { Jaw: '#f39a30', Jowl: '#f39a30' },
  }),
  // FRESHWATER ANGELFISH (Pterophyllum scalare). Thesis: a tall, very LATERALLY COMPRESSED round-to-triangular DISC
  // body · EXTREMELY tall, swept-back sail dorsal and anal fins trailing into points (the fish taller than long),
  // long thread-like pelvic fins below, a fan caudal with trailing tips · silver with BLACK VERTICAL BARS (one through
  // the eye) · ~0.15 m long, ~0.20 m tall (Wikipedia: up to 15 cm long and 20 cm tall).
  angelfish: fishMaker({
    name: 'an angelfish', Z: 1, scale: 0.25,
    body: [[-0.23, 0.02, 0.04], [-0.17, 0.03, 0.1], [-0.08, 0.04, 0.17], [0.0, 0.042, 0.19], [0.07, 0.04, 0.16], [0.14, 0.032, 0.09]],
    head: { scale: 0.4, len: 0.11, taper: [1.4, 0.7], snout: 0.0, eye: { at: 0.45, h: 0.35, r: 0.26 }, mouth: 'pointed', gill: 0.72 },
    caudal: { kind: 'lunate', from: -0.22, len: 0.16, spread: 0.11, w: 0.045 },
    sails: {
      dorsal: [[0.05, 0.16, 0.035], [-0.02, 0.27, 0.085], [-0.09, 0.38, 0.075], [-0.18, 0.47, 0.045], [-0.3, 0.53, 0.01]],
      anal: [[0.0, -0.16, 0.035], [-0.06, -0.27, 0.085], [-0.12, -0.38, 0.075], [-0.2, -0.47, 0.045], [-0.31, -0.53, 0.01]],
    },
    pectoral: { y: 0.06, len: 0.08, w: [0.012, 0.022], up: [0.4, 0, 1] },
    pelvic: { y: 0.05, len: 0.3, w: [0.008, 0.003], up: [1, 0, 0], drop: 1.6 },
    markDensity: { torso: 3 },
    markings: [
      { on: 'torso', kind: 'band', group: 'Bar', run: [0.08, 0.17], color: '#22211f' },
      { on: 'torso', kind: 'band', group: 'Bar', run: [0.42, 0.52] },
      { on: 'torso', kind: 'band', group: 'Bar', run: [0.8, 0.88] },
    ],
    craniumBandGroups: { 'st5-st6': ['Bar', 'Bar', 'Bar', 'Bar', 'Bar', 'Bar'] },   // the bar through the eye
    colors: { gill: '#8e928a', coat: '#c9ccc4', sock: '#c9ccc4', ash: '#d8dad2', ashAlt: '#cfd1c9', belly: '#dfe0d8', tip: '#b8bcb4', brow: '#c9ccc4', iris: '#c43a2a', sclera: '#141414' },
    headPalette: { Bar: '#22211f' },
  }),
};
