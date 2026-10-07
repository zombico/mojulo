// THE FISH MAKER — one species-free generator for every fish body: BONY (teleost: a fusiform loft, a smooth fish
// head of its own, thin flat fins) and CARTILAGINOUS (chondrichthyan: sharks and rays on the squamate-style skull
// rows, sickle fins, a heterocercal or whip tail). `fish(params)` returns fauna params (pose 'swim', `family` set)
// that buildFauna accepts once merged over that family's table (mergeParams(FAMILIES[p.family], p)).
// The two original generators, `fishMaker` (bony) and `cartilageFish` (cartilage), are exported unchanged, so the
// species written against them build byte-identically.
//
// fish(params) — every field optional; missing ones come from the skeleton's DEFAULTS (a generic salmon-proportioned
// bony fish / a generic great-white-proportioned shark). Object fields merge ONE level over the default's.
//   skeleton   'bony' (default) | 'cartilage'
//   name       string, e.g. 'a moray eel'
//   length     total length in metres, snout → tail tip (0.01 … 40). Sets `scale` from the authored size (exact for
//              bony; approximate for cartilage — check with fauna-fit --targets length). Or pass `scale` directly.
//   pattern    { back, belly, from = 0.72 }: countershading colours (hex) and where the belly starts (0 top … 1 bottom
//              of the ring). Bony: adds the back band + belly markings unless `markings` given.
// BONY (authored ~0.75 m long, +y the head, body centre at height Z = 0.5 m, units metres before `scale`):
//   body       [[y, halfWidth, halfDepth], …] tail (peduncle) → front, ≥ 2 rows, y ascending; half sizes 0.001 … 0.5
//   head       { scale 0.2…1, len 0.03…0.4 m, taper [p, q], kx 0.5…1.5, snout −1…1 (tip height in half-depths),
//                eye { at 0…1 of len back from snout, h 0…1, r 0.05…0.5 half-depths, pupil }, mouth 'terminal' |
//                'upturned' | 'small' | 'pointed', gill 0…1 | false, rows }
//   caudal     { kind 'forked' | 'lunate' | 'rounded' | 'flowing', from (y m), len m, spread m, w m }
//   dorsal, dorsal2, adipose, anal   [[y, height m], …] front → back (null/omitted = none). A CONTINUOUS dorsal
//              (eel) is just one long run of rows.
//   sails      { name: [[y, z, halfWidth], …] } free midline lobes;  pectoral / pelvic { y, len, w: [root, tip], up?,
//              drop? } (omit = none);  Z, colors, markings, headPalette, craniumBandGroups, markDensity: passed through
// CARTILAGE (authored at great-white size ~4.5 m, centre height C = 1 m): profile [[y, halfW, halfH], …] tail → front;
//   head 'conical' | 'hammer' (+ cephalofoil { span, chord, y }) | 'disc' (+ lobes { root, length }); snout { len, w,
//   scale, kx, kz, tip }; neck { from, to, rA, rB }; dorsal / dorsal2 / anal { at, base, height, sweep, thick, bury };
//   caudal { upper { span, angle°, chord, thick }, lower { ratio, angle, chord } } | null + whip { length, r };
//   pectoral { root [x,y,dz], span, sweep, drop, chord, tipChord } | { wing: rows }; pelvic; gills 0…7; eye { at, t };
//   mouth { front, corner, gape 1|2, recess }; eyeR, eyeAt, mouthColor — see cartilageFish below.

// ── BONY ────────────────────────────────────────────────────────────────────────────────────────────────────────
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

// ── CARTILAGINOUS ───────────────────────────────────────────────────────────────────────────────────────────────
const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the skull rows (the squamate / crocodilian rows): reshaped per species by flat() + muzzleW / muzzleLen
const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];
export const CARTILAGE_SKIN = {
  browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
  browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
  sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
  cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
  cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
};

/** A FIN: a thin flat closed loft from root to tip on the midline. `pts` are [x, y, z, [half-thickness, half-chord]];
 * the chord lies in the plane holding the loft's axis and +y. */
export const fin = (name, pts, tipCap, opts = {}) => ({ name, kind: 'loft', slots: 'ring12', group: opts.group || 'Coat', mirror: 'plane',
  stations: pts.map(([x, y, z, r]) => ({ at: [x, y, z], r })), caps: { back: opts.back || [pts[0][0], pts[0][1], pts[0][2] - (opts.sink ?? 0.05)], tip: tipCap } });

/** A MIDLINE FIN from size + sweep (the fish-maker vocabulary shared in spirit with teleost.js): a root chord `base`
 * centred at y `at`, rooted `bury` inside the body at z `root`, rising `height` (dir +1 up, −1 down) with its apex
 * `sweep` behind the root centre; `thick` the root half-thickness. Tall triangle with a concave trailing edge. */
export function midlineFin(name, { at, root, base, height, sweep = 0.6 * height, thick = 0.04, dir = 1, group }) {
  const p = (f, c, t) => [0, at - sweep * f, root + dir * height * f, [thick * t, base * c]];
  return fin(name, [p(0, 0.5, 1), p(0.45, 0.28, 0.7), p(0.85, 0.1, 0.45)], [0, at - sweep, root + dir * height], { sink: dir * 0.05, group });
}
/** A CAUDAL LOBE: from the peduncle [y, z] out `span` metres at `angle` degrees above (dir +1) / below (−1) the
 * body axis, root half-chord `chord` tapering to a point (a lunate sickle). */
export function caudalLobe(name, [py, pz], { span, angle, chord, thick = 0.05, dir = 1 }) {
  const a = (angle * Math.PI) / 180, P = (f, c, t) => [0, py - span * f * Math.cos(a), pz + dir * (0.04 + span * f * Math.sin(a)), [thick * t, chord * c]];
  return fin(name, [P(0, 1, 1), P(0.3, 0.8, 0.7), P(0.62, 0.45, 0.45)], P(0.8, 0, 0).slice(0, 3).map((v, i) => (i === 0 ? 0 : v + (i === 1 ? -span * 0.2 * Math.cos(a) : dir * span * 0.2 * Math.sin(a)))),
    { back: [0, py + 0.07, pz - dir * 0.04] });
}

/** HEAD ANATOMY from fractions of head length (see `eye` / `mouth` in cartilageFish): the skull rows' y as build.js
 * places them (rows from the muzzle row on pulled toward it by `snout.len`), the eye's station address, the lower jaw
 * cut back to the mouth's arc and the crescent as skull band groups (faces per band: 0–2 the back, 3 cheek–jowl,
 * 4 jowl–lip, 5 lip–palate = the underside). */
function headAnatomy(o, sn) {
  if (!o.eye && !o.mouth) return {};
  const Lm = sn.len ?? 1, y0 = SKULL[3][1], fwd = (y) => (y <= y0 ? y : y0 + (y - y0) * Lm), back = (y) => (y <= y0 ? y : y0 + (y - y0) / Lm);
  const ys = SKULL.map(([, y]) => fwd(y)), tipY = fwd(sn.tip ?? 0.26), L = tipY - ys[0], yAt = (f) => tipY - f * L;
  const sAt = (y) => { for (let i = 1; i < ys.length; i++) if (y <= ys[i]) return i - 1 + (y - ys[i - 1]) / (ys[i] - ys[i - 1]); return ys.length - 1; };
  const r3 = (v) => Math.round(v * 1000) / 1000, out = {};
  const eyeF = o.eye?.at ?? 0.45;
  if (o.eye) out.eyeAt = [r3(sAt(yAt(eyeF))), o.eye.t ?? 2.2];
  if (o.mouth) {
    const m = o.mouth, yF = yAt(m.front), yC = yAt(eyeF + (m.corner ?? 0)), band = (y) => Math.min(ys.length - 2, Math.floor(sAt(y)));
    const bF = band(yF), bC = band(yC), side = m.gape === 2 ? [3, 4] : [4];
    out.bands = {};
    for (let b = bC; b <= bF; b++) {
      const g = [b < 3 ? 'Skull' : 'Snout', b < 3 ? 'Skull' : 'Snout', b < 3 ? 'Skull' : 'Snout', 'Cheek', 'Jowl', 'Palate'];
      if (b === bC) for (const k of side) g[k] = 'Mouth';
      if (b > bC || b === bF) { g[5] = 'Mouth'; if (b > bC) g[4] = 'Cheek'; }   // ahead of the corner: the flank stays back-coloured
      out.bands[`${SKULL[b][0]}-${SKULL[b + 1][0]}`] = g;
    }
    // the overhanging snout ahead of the arc: its flank takes the back colour down to the underside (no lip line)
    for (let b = bF + 1; b < ys.length - 1; b++) out.bands[`${SKULL[b][0]}-${SKULL[b + 1][0]}`] = ['Snout', 'Snout', 'Snout', 'Cheek', 'Cheek', 'Jowl'];
    // the lower jaw: out to the arc's back edge (the band holding the corner), lifted `recess` under the skull
    const cut = back(ys[bC + 1]), up = m.recess ?? 0, lift = (s) => ({ gum: s.gum + up, gumR: [s.gumR[0], s.gumR[1] + up], jaw: [s.jaw[0] * 0.92, s.jaw[1] + up], bottom: s.bottom + up });
    // (all five rows kept, their stations pulled back so the last lands on the arc: the head's web needs them)
    const y0j = JAW[0][1], k = (cut - y0j) / (JAW.at(-1)[1] - y0j);
    out.jaw = JAW.map(([i, y, sl]) => [i, r3(y0j + (y - y0j) * k), lift(sl)]);
    const end = JAW.at(-1)[2];
    out.jawTip = [0, r3(cut + 0.012), r3(end.gum + up + 0.004)];
  }
  return out;
}

/**
 * THE CARTILAGINOUS-FISH MAKER (species-free): every number of a shark or ray from a handful of size / shape knobs, in
 * metres at the authored size (the species' `scale` then fits its published length). Returns the parameters build.js
 * reads (joints, torso, legs = paired fins, extraSegments = midline fins and tail, head rows, markings).
 *   C          centre-line height of the swim pose
 *   profile    trunk stations [y, half-width, half-height], tail end first (a torpedo, or a flat disc for a ray)
 *   head       'conical' (a pointed snout) | 'hammer' (+ `cephalofoil: { span, chord }`) | 'disc' (a ray's flat head
 *              with `lobes`: cephalic lobes { length })
 *   snout      { len, w, scale } → muzzleLen, muzzleW, headScale; `neck` { from, to, rA, rB } the gill region
 *   dorsal     midlineFin knobs ({ at, base, height, sweep }); `dorsal2`, `anal` the same (null to omit)
 *   caudal     { upper: { span, angle, chord }, lower: { …, or a `ratio` of the upper } } (null: a ray's `whip` instead)
 *   whip       { length, r } a thin whip tail
 *   pectoral   { root: [x, y, dz], span, sweep, drop, chord, tipChord } (a shark's sickle) or `wing`: [[x, y, dz, [thick, half-chord]], …]
 *              rows out to the tip (a ray: huge pectorals as a disc); `pelvic` the small sickle form
 *   gills      count of painted slits (0 for none: a ray's are underneath)
 *   pattern    { back, belly, from } countershading colours (+ `extra` colours)
 *   eye        { at, t } (opt-in) the eye's place as a FRACTION OF HEAD LENGTH back from the snout tip (`at`; the head
 *              runs tip → the skull's back row), `t` its height around the ring (2 = the brow slot, 3 = the cheek)
 *   mouth      (opt-in) an UNDERSLUNG crescent: `front` the midline of the arc as a fraction of head length back from the
 *              tip (so the snout OVERHANGS it by that much), `corner` how far behind the eye the corners sit (a fraction
 *              of head length; 0 = directly below the eye), `gape` 1 | 2 skull faces the corner climbs up the side (a
 *              wider gape), `recess` metres the lower jaw sits up under the skull. The lower jaw ends at the arc, the
 *              crescent is painted on the skull's underside (group Mouth, `mouthColor`); no `mouth` keeps a terminal
 *              jaw out to the tip (a ray).
 */
export function cartilageFish(o) {
  const C = o.C ?? 1.0, prof = o.profile, top = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [a, , ha] = prof[i - 1], [b, , hb] = prof[i]; return ha + (hb - ha) * (y - a) / (b - a); } return prof.at(-1)[2]; };
  const joints = { neckBase: [0, o.neck.from, C], neckTop: [0, o.neck.to, C - 0.02] }, legs = [], extra = [];
  const pec = o.pectoral;
  if (pec.wing) { let prev = 'wing0'; joints.wing0 = [pec.wing[0][0], pec.wing[0][1], C + pec.wing[0][2]];
    pec.wing.slice(1).forEach(([x, y, dz, r], i) => { const j = `wing${i + 1}`; joints[j] = [x, y, C + dz];
      legs.push([`wing${i}R`, prev, j, pec.wing[i][3], r, 'Coat', [i ? 0.05 : 0.3, i === pec.wing.length - 2 ? 0.3 : 0.05]]); prev = j; }); }
  else { const [x, y, dz] = pec.root; joints.pecRoot = [x, y, C + dz]; joints.pecTip = [x + pec.span, y - pec.sweep, C + dz - pec.drop];
    legs.push(['pectoralR', 'pecRoot', 'pecTip', [0.05, pec.chord], [0.025, pec.tipChord], 'Coat', [0.2, 0.2]]); }
  if (o.pelvic) { const p = o.pelvic, [x, y, dz] = p.root; joints.pelRoot = [x, y, C + dz]; joints.pelTip = [x + p.span, y - p.sweep, C + dz - p.drop];
    legs.push(['pelvicR', 'pelRoot', 'pelTip', [0.03, p.chord], [0.015, p.chord / 3], 'Coat', [0.2, 0.2]]); }
  if (o.head === 'hammer') { const { span, chord, y, dz = -0.02 } = o.cephalofoil;   // two flat blades out of the snout, the eyes at the tips
    // a level axis has no ring side (station-loft ringPoints): each blade droops a little in z
    Object.assign(joints, { cephRoot: [0.05, y, C + dz], cephMid: [span * 0.55, y - 0.04, C + dz - 0.025], cephTip: [span, y - 0.11, C + dz - 0.05], eyeTip: [span + 0.06, y - 0.13, C + dz - 0.06] });
    legs.push(['cephInR', 'cephRoot', 'cephMid', [0.06, chord], [0.05, chord * 0.76], 'Coat', [0.3, 0.1]], ['cephOutR', 'cephMid', 'cephTip', [0.05, chord * 0.76], [0.035, chord * 0.4], 'Coat', [0.1, 0.1]],
      ['hhEyeR', 'cephTip', 'eyeTip', 0.03, 0.025, 'Gill', [0.1, 0.2]]); }
  if (o.lobes) { const { root: [x, y, dz], length } = o.lobes; joints.lobeRoot = [x, y, C + dz]; joints.lobeTip = [x + 0.02, y + length, C + dz - 0.04];
    legs.push(['lobeR', 'lobeRoot', 'lobeTip', [0.07, 0.025], [0.045, 0.015], 'Coat', [0.2, 0.2]]); }
  for (const [nm, f, dir] of [['dorsal', o.dorsal, 1], ['dorsal2', o.dorsal2, 1], ['anal', o.anal, -1]]) if (f) extra.push(midlineFin(nm, { root: C + dir * (top(f.at) - (f.bury ?? 0.1)), dir, ...f }));
  const ped = [prof[0][0] + 0.03, C];
  if (o.caudal) { const up = o.caudal.upper, lo = { ...up, ...o.caudal.lower, span: up.span * (o.caudal.lower.ratio ?? 1) };
    extra.push(caudalLobe('caudalUp', ped, { ...up, dir: 1 }), caudalLobe('caudalLow', ped, { ...lo, dir: -1, thick: (lo.thick ?? 0.05) * 0.9 })); }
  if (o.whip) { const y0 = prof[0][0], L = o.whip.length, r = o.whip.r ?? 0.04;
    extra.push(fin('tailWhip', [[0, y0, C, [r, r]], [0, y0 - L * 0.4, C, [r / 2, r / 2]], [0, y0 - L * 0.9, C, [r / 5, r / 5]]], [0, y0 - L, C], { back: [0, y0 + 0.05, C] })); }
  const pat = o.pattern || {}, marks = [{ on: 'torso', kind: 'belly', group: 'Belly', from: pat.from ?? 0.6 }, { on: 'neck', kind: 'belly', group: 'Belly', from: (pat.from ?? 0.6) + 0.02 }];
  if (o.gills) marks.push({ on: 'neck', kind: 'stripes', group: 'Gill', color: '#2c3034', count: o.gills, width: 0.3, run: [0.0, 0.75], t: [0.35, 0.62] });
  else marks.push({ on: 'neck', kind: 'band', group: 'Gill', color: '#2c3034', run: [0, 0], t: [0, 0] });   // the eye-tip colour group, no slits
  const sn = o.snout, back = pat.back || '#6f7880', belly = pat.belly || '#eceae4';
  const head = headAnatomy(o, sn);
  return {
    joints, legs, extraSegments: extra, levelLegs: false,
    torso: prof.map(([y, w, h]) => ({ at: [0, y, C], r: [w, h] })),
    torsoCaps: { back: [0, prof[0][0] - 0.1, C], tip: [0, prof.at(-1)[0] + 0.1, C] },
    neckRA: o.neck.rA, neckRB: o.neck.rB, neckRMid: o.neck.rA.map((v, i) => (v + o.neck.rB[i]) / 2 + 0.01),
    craniumRows: flat(SKULL, sn.kx ?? 1, sn.kz ?? 0.95), jawRows: flatJaw(head.jaw || JAW, sn.kx ?? 1, sn.kz ?? 0.95),
    craniumCaps: { back: [0, -0.18, 0.0], tip: [0, sn.tip ?? 0.26, -0.02] }, jawCaps: { back: [0, -0.1, -0.05], tip: head.jawTip || [0, 0.215, -0.045] },
    headScale: sn.scale, muzzleLen: sn.len, muzzleW: sn.w, eyeR: o.eyeR ?? 0.03, eyeAt: head.eyeAt || o.eyeAt || [2.6, 2.2],
    ...(head.bands ? { craniumBandGroups: head.bands } : {}),
    colors: { coat: back, sock: back, brow: back, tip: back, hoof: back, ash: belly, ashAlt: belly, belly, ...(pat.extra || {}) },
    headPalette: { Cheek: back, ...(o.head === 'disc' ? { Jowl: back } : {}), ...(head.bands ? { Mouth: o.mouthColor || '#1c1f22' } : {}) },
    markDensity: { torso: 2, neck: o.gills ? 10 : 2 }, markings: marks,
  };
}

// ── THE UNIFIED DOOR ────────────────────────────────────────────────────────────────────────────────────────────
export const FISH_DEFAULTS = {
  bony: {
    Z: 0.5,
    body: [[-0.30, 0.011, 0.022], [-0.24, 0.017, 0.032], [-0.14, 0.034, 0.057], [-0.02, 0.047, 0.077], [0.10, 0.05, 0.078], [0.19, 0.036, 0.056]],
    head: { scale: 0.42, len: 0.14, taper: [1.6, 0.65], snout: -0.05, eye: { at: 0.33, h: 0.5, r: 0.2 }, mouth: 'terminal' },
    caudal: { kind: 'forked', from: -0.29, len: 0.13, spread: 0.08, w: 0.034 },
    dorsal: [[0.045, 0.01], [0.03, 0.07], [0.0, 0.06], [-0.03, 0.035], [-0.055, 0.012]],
    anal: [[-0.12, 0.008], [-0.135, 0.05], [-0.16, 0.035], [-0.19, 0.01]],
    pectoral: { y: 0.13, len: 0.09, w: [0.014, 0.026] }, pelvic: { y: -0.04, len: 0.065, w: [0.01, 0.016] },
    pattern: { back: '#4f5f6a', belly: '#eef1f2', from: 0.72 },
  },
  cartilage: {
    profile: [[-1.65, 0.15, 0.13], [-1.20, 0.25, 0.30], [-0.50, 0.40, 0.50], [0.20, 0.45, 0.55], [0.85, 0.40, 0.46], [1.20, 0.33, 0.36]],
    head: 'conical', snout: { len: 1.0, w: 1.15, scale: 2.7 }, neck: { from: 1.05, to: 1.55, rA: [0.36, 0.40], rB: [0.27, 0.27] },
    dorsal: { at: 0.45, base: 0.84, height: 0.72, sweep: 0.52, thick: 0.05 },
    dorsal2: { at: -1.25, base: 0.14, height: 0.16, sweep: 0.11, thick: 0.02 }, anal: { at: -1.30, base: 0.14, height: 0.15, sweep: 0.11, thick: 0.02 },
    caudal: { upper: { span: 1.32, angle: 53, chord: 0.20, thick: 0.06 }, lower: { ratio: 0.76, angle: 54, chord: 0.18 } },
    pectoral: { root: [0.30, 0.80, -0.30], span: 0.85, sweep: 0.60, drop: 0.40, chord: 0.34, tipChord: 0.09 },
    pelvic: { root: [0.16, -0.95, -0.25], span: 0.20, sweep: 0.27, drop: 0.13, chord: 0.12 },
    gills: 5, pattern: { back: '#6f7880', belly: '#eceae4', from: 0.6 },
    eye: { at: 0.40, t: 2.2 }, mouth: { front: 0.30, corner: 0.04, gape: 1, recess: 0.005 },
  },
};
const COMMON = ['skeleton', 'name', 'length', 'scale', 'pattern'];
export const FISH_KEYS = {
  bony: [...COMMON, 'Z', 'body', 'head', 'caudal', 'dorsal', 'dorsal2', 'adipose', 'anal', 'sails', 'pectoral', 'pelvic', 'colors', 'markings', 'headPalette', 'craniumBandGroups', 'markDensity'],
  cartilage: [...COMMON, 'C', 'profile', 'head', 'cephalofoil', 'lobes', 'snout', 'neck', 'dorsal', 'dorsal2', 'anal', 'caudal', 'whip', 'pectoral', 'pelvic', 'gills', 'eye', 'mouth', 'eyeR', 'eyeAt', 'mouthColor'],
};
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const rows3 = (v) => Array.isArray(v) && v.length >= 2 && v.every((r) => Array.isArray(r) && r.length === 3 && r.every(num));

/** Validate fish params; throws an Error naming the field and what it takes. */
export function validateFish(p = {}) {
  if (!isObj(p)) throw new Error('fish params must be an object');
  const sk = p.skeleton ?? 'bony';
  if (!FISH_KEYS[sk]) throw new Error(`fish: \`skeleton\` must be 'bony' or 'cartilage' (got ${JSON.stringify(sk)})`);
  const bad = Object.keys(p).filter((k) => !FISH_KEYS[sk].includes(k));
  if (bad.length) throw new Error(`fish (${sk}): unknown param(s) ${bad.join(', ')} — takes ${FISH_KEYS[sk].join(', ')}`);
  if (p.length !== undefined && (!num(p.length) || p.length < 0.01 || p.length > 40)) throw new Error('fish: `length` is the total length in metres, 0.01 … 40');
  if (p.scale !== undefined && (!num(p.scale) || p.scale <= 0)) throw new Error('fish: `scale` must be a positive number');
  if (p.pattern !== undefined && !isObj(p.pattern)) throw new Error('fish: `pattern` is { back: hex, belly: hex, from: 0…1 }');
  if (sk === 'bony') {
    if (p.body !== undefined && (!rows3(p.body) || p.body.some((r, i) => i && r[0] <= p.body[i - 1][0]) || p.body.some(([, w, h]) => w <= 0 || h <= 0)))
      throw new Error('fish (bony): `body` is [[y, halfWidth, halfDepth], …] tail → front, ≥ 2 rows, y ascending, half sizes > 0 (metres at the ~0.75 m authored size)');
    const H = p.head;
    if (H !== undefined && !isObj(H)) throw new Error('fish (bony): `head` is { scale, len, taper, kx, snout, eye, mouth, gill }');
    if (H?.mouth !== undefined && !['terminal', 'upturned', 'small', 'pointed'].includes(H.mouth)) throw new Error(`fish (bony): head.mouth must be terminal | upturned | small | pointed (got ${JSON.stringify(H.mouth)})`);
    if (p.caudal !== undefined && (!isObj(p.caudal) || (p.caudal.kind && !['forked', 'lunate', 'rounded', 'flowing'].includes(p.caudal.kind)))) throw new Error('fish (bony): `caudal` is { kind: forked | lunate | rounded | flowing, from, len, spread, w }');
    for (const k of ['dorsal', 'dorsal2', 'adipose', 'anal']) if (p[k] != null && !(Array.isArray(p[k]) && p[k].length >= 2 && p[k].every((r) => Array.isArray(r) && r.length === 2 && r.every(num))))
      throw new Error(`fish (bony): \`${k}\` is [[y, height], …] front → back (≥ 2 rows), or null for none`);
    for (const k of ['pectoral', 'pelvic']) if (p[k] != null && !(isObj(p[k]) && num(p[k].y) && num(p[k].len) && Array.isArray(p[k].w) && p[k].w.length === 2))
      throw new Error(`fish (bony): \`${k}\` is { y, len, w: [root, tip] } (metres), or null for none`);
  } else {
    if (p.profile !== undefined && !rows3(p.profile)) throw new Error('fish (cartilage): `profile` is [[y, halfWidth, halfHeight], …] tail → front, ≥ 2 rows');
    if (p.head !== undefined && !['conical', 'hammer', 'disc'].includes(p.head)) throw new Error("fish (cartilage): `head` is 'conical' | 'hammer' | 'disc'");
    if (p.head === 'hammer' && !p.cephalofoil) throw new Error('fish (cartilage): a hammer head needs `cephalofoil: { span, chord, y }`');
    if (p.caudal === null && !p.whip) throw new Error('fish (cartilage): `caudal: null` needs a `whip: { length, r }` tail');
  }
  return sk;
}

const merge1 = (base, over) => { const o = { ...base }; for (const [k, v] of Object.entries(over)) o[k] = isObj(v) && isObj(base[k]) ? { ...base[k], ...v } : v; return o; };

/** THE FISH: params (see the header) → fauna params with `family` 'teleost' | 'chondrichthyan', pose 'swim'. */
export function fish(params = {}) {
  const sk = validateFish(params);
  const { skeleton, length, pattern, ...rest } = params;
  const P = merge1(FISH_DEFAULTS[sk], rest), pat = pattern ? { ...P.pattern, ...pattern } : P.pattern;
  if (sk === 'bony') {
    delete P.pattern;
    if (length !== undefined) { const B = P.body, C = P.caudal || {}, front = B.at(-1)[0] + (P.head?.len ?? 0.14), back = (C.from ?? B[0][0] + 0.01) - (C.len ?? 0.14); P.scale = length / (front - back); }
    if (!P.markings && pat) P.markings = [{ on: ['torso', 'neck'], kind: 'band', group: 'Back', t: [0, 1 - (pat.from ?? 0.72) + 0.02], color: pat.back }, { on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: pat.from ?? 0.72 }];
    if (pat) { P.colors = { coat: pat.back, sock: pat.back, ash: pat.back, ashAlt: pat.back, brow: pat.back, tip: pat.back, belly: pat.belly, gill: pat.back, ...(P.colors || {}) };
      P.headPalette = { Skull: pat.back, Snout: pat.back, Brow: pat.back, Lids: pat.back, Jowl: pat.belly, Jaw: pat.belly, ...(P.headPalette || {}) }; }
    return fishMaker(P);
  }
  P.pattern = pat;
  const out = { family: 'chondrichthyan', pose: 'swim', ...(P.name ? { name: P.name } : {}), scale: P.scale ?? 1, ...cartilageFish(P) };
  if (length !== undefined) { const pr = P.profile, front = P.neck.to + (P.snout.tip ?? 0.26) * P.snout.scale, back = P.caudal ? pr[0][0] - 0.8 * P.caudal.upper.span * Math.cos(P.caudal.upper.angle * Math.PI / 180) : pr[0][0] - (P.whip?.length ?? 0);
    out.scale = length / (front - back); }
  return out;
}
