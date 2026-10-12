/**
 * anime-nose — the anime face's NOSE DIALS (`nose: { profile, width }`, the painterly look's): the face's midline drawn
 * to a target side profile and the nose built as a wedge on it.
 *
 *   profile  0 the CAT edge: a deep stop, a long straight bridge to a sharp tip, the underside cut back level, one
 *            receding slope with the mouth a notch on it, a chin corner; 1 the ZELDA-like edge: a shallow stop, a small
 *            distinct nose with a soft tip, the lips a little forward, a rounder chin. Between, point by point.
 *   width    0 a POINTER: the nose a thin ridge, its underside a sliver; 1 a TRAPEZOID underside, narrow at the tip and
 *            wide at the face (painted dark: face-paint.js `noseUnder`).
 *
 * The edges are in nose-to-chin units from the nose tip (u back, v down), read off the operator's references (the ink
 * construction and the girl over the cat) and the Zelda still, agreed on the cat-read sketches before any code.
 *
 * noseDial(surface0, dials, { widthAt }) measures the face's own midline (the studio surface at u = 0, unpitched,
 * output coordinates: Y up, Z back) and returns:
 *   apply([x, Y, Z], u, y)  the point moved toward the target: d = target Z − the midline's Z at that row, carried
 *                           across the face by a lateral weight — NARROW where the target comes forward inside the nose
 *                           (the wedge: a flat top as wide as the width dial, sides falling off), WIDE where it recedes
 *                           (so the cheeks recede with the slope and never stand in front of it in profile)
 *   rows, cols              lattice rows (param y) and columns (param u) the shapes need (the stop, the tip, the
 *                           underside, the chin; the wedge's edges)
 *   under                   the underside as a quad in output (x, Y): the painter's `noseUnder` layer
 *   box                     the underside's box, for the painted faces that look down
 */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** the two edges, the same count of points (forehead → stop → bridge → tip → underside → subnasal → lip → mouth → lower
 * lip → chin front → chin corner); [u, v] in nose-to-chin units from the tip */
export const NOSE_EDGES = Object.freeze({
  cat: Object.freeze([[0.26, -1.4], [0.28, -0.9], [0.32, -0.5], [0.22, -0.32], [0.11, -0.16], [0, 0], [0.14, 0.05], [0.3, 0.1], [0.32, 0.2], [0.38, 0.36], [0.44, 0.5], [0.5, 0.64], [0.56, 0.8], [0.6, 0.94], [0.62, 1.0]]),
  zelda: Object.freeze([[0.2, -1.4], [0.18, -0.9], [0.17, -0.5], [0.14, -0.32], [0.08, -0.16], [0, -0.02], [0.03, 0.05], [0.12, 0.1], [0.17, 0.15], [0.16, 0.3], [0.23, 0.43], [0.22, 0.56], [0.27, 0.74], [0.35, 0.92], [0.45, 1.0]]),
});
const STOP = 2, TIP = 5, SUB = 7;   // the edges' indices: the stop, the tip, the subnasal
export const NOSE_DEFAULTS = Object.freeze({ profile: 0.5, width: 0.5 });

/** Error lines for a nose dials object. */
export function noseDialErrors(n, at = 'nose') {
  if (n === undefined || n === null) return [];
  if (typeof n !== 'object' || Array.isArray(n)) return [`${at}: { profile?, width? }, each 0..1 (profile 0 the cat edge, 1 the Zelda-like; width 0 a pointer, 1 a trapezoid underside)`];
  const errs = [];
  for (const k of Object.keys(n)) if (!['profile', 'width'].includes(k)) errs.push(`${at}.${k}: not a nose dial (profile, width)`);
  for (const k of ['profile', 'width']) if (n[k] !== undefined && !(Number.isFinite(n[k]) && n[k] >= 0 && n[k] <= 1)) errs.push(`${at}.${k}: a number in 0..1`);
  return errs;
}

export function noseDial(surface0, dials = {}, { widthAt, pitch = 0, ear = null, anchorAt = null }) {
  const profile = dials.profile ?? NOSE_DEFAULTS.profile, width = dials.width ?? NOSE_DEFAULTS.width;
  // the face's own midline, param y → [Y, Z]
  const N = 440, y0 = -1.02, y1 = 1.19, mid = [];
  for (let i = 0; i <= N; i++) { const y = y0 + (y1 - y0) * i / N, p = surface0(0, y); mid.push([y, p[1], p[2]]); }
  const zMid = (y) => { const t = (y - y0) / (y1 - y0) * N, i = Math.min(N - 1, Math.max(0, Math.floor(t))), f = t - i; return lerp(mid[i][2], mid[i + 1][2], f); };
  // the ANCHOR (the nose tip and the chin's bottom) is the studio face's, nose on (`anchorAt`), where the targets were
  // drawn; the midline the dials move from is the face they move (its own nose off)
  const ref = anchorAt ? mid.map(([y]) => { const p = anchorAt(0, y); return [y, p[1], p[2]]; }) : mid;
  const tipRow = ref.filter(([y]) => y > -0.5 && y < 0.05).reduce((a, b) => (b[2] < a[2] ? b : a));
  const [, Ytip, Ztip] = tipRow, Ybot = ref[0][1], NC = Ytip - Ybot;
  /** param y at an output Y on the midline (nearest) */
  const yAt = (Y) => mid.reduce((a, b) => (Math.abs(b[1] - Y) < Math.abs(a[1] - Y) ? b : a))[0];
  // the target, output (Y, Z) from the top down
  const E = NOSE_EDGES.cat.map((p, i) => [lerp(p[0], NOSE_EDGES.zelda[i][0], profile), lerp(p[1], NOSE_EDGES.zelda[i][1], profile)]);
  // (the edges are drawn on the head as it is carried, pitched forward by `pitch`; the surface is built upright, so each
  // offset from the tip is turned back by the pitch before it is placed)
  const c = Math.cos(pitch), sn = Math.sin(pitch);
  const T = E.map(([u, v]) => { const dY = -v * NC, dZ = u * NC; return [Ytip + c * dY + sn * dZ, Ztip - sn * dY + c * dZ]; });
  // (below its last point the line holds that point's depth: the pitch lifts the target's bottom a little above the
  // head's, and the rows between must not step back to the studio's chin)
  const onLine = (L, Y) => { if (Y < L.at(-1)[0]) return L.at(-1)[1]; for (let i = 0; i + 1 < L.length; i++) { const [Ya, Za] = L[i], [Yb, Zb] = L[i + 1]; if (Y <= Ya && Y >= Yb) return Ya === Yb ? Za : lerp(Za, Zb, (Ya - Y) / (Ya - Yb)); } return null; };
  // the target in two: the FACE LINE (the profile with the nose taken out: straight from the stop to the subnasal),
  // carried wide across the face, and the NOSE (the target over the face line), carried narrow in its wedge
  const F = T.filter((_, i) => i <= STOP || i >= SUB);
  const zTarget = (Y) => onLine(T, Y), zFace = (Y) => onLine(F, Y);
  const vStop = E[STOP][1], vSub = E[SUB][1], vTop = E[0][1];
  // the wedge: its flat top's half-width at the stop, the tip and the face (the underside's back), its sides' fall
  const wStop = lerp(0.02, 0.05, width) * NC, wTip = lerp(0.004, 0.05, width) * NC, wBack = lerp(0.03, 0.14, width) * NC, side = 0.12 * NC;
  const half = (v) => (v <= 0 ? lerp(wStop, wTip, clamp01((v - vStop) / (0 - vStop))) : lerp(wTip, wBack, clamp01(v / vSub)));
  // the wide weight: the brow's across the forehead; below the nose across the whole lower face, so a receding slope
  // takes the cheeks with it and none stands in front of it in profile
  const wide = (x, v) => 1 - (v < vStop ? smooth(0.3 * NC, 0.8 * NC, Math.abs(x)) : smooth(0.5 * NC, 1.2 * NC, Math.abs(x)));
  const narrow = (x, v) => clamp01((half(v) + side - Math.abs(x)) / side);
  function apply(p, u, y, back = false) {
    const [x, Y, Z] = p, zt = zTarget(Y), zf = zFace(Y); if (zt === null || zf === null) return p;
    const v = (Ytip - Y) / NC, fade = smooth(vTop - 0.25, vTop, v);   // faded in under the forehead's top
    // the face line, wide, faded to nothing at the side seam where the face's shell meets the back's (the studio's own
    // terms fade the same) — but for the chin's lowest rows, where the line goes back past the seam itself: there both
    // shells move together, the same at the seam, so the chin's corner can stand behind the studio's
    const low = 1 - smooth(y0 + 0.04, y0 + 0.14, y), seam = back ? low : low + (1 - low) * (1 - smooth(0.7, 1, Math.abs(u)));
    const dFace = (zf - zMid(y)) * fade * wide(x, v) * seam;
    if (back) return dFace ? [x, Y, Z + dFace] : p;
    const dNose = Math.min(0, zt - zf) * narrow(x, v);
    return [x, Y, Z + dFace + dNose];
  }
  // the lattice's extra rows and columns, in the surface's params
  const rows = [vTop - 0.1, vStop - 0.08, vStop, -0.32, -0.16, -0.06, 0, 0.03, 0.06, vSub * 0.7, vSub, vSub + 0.05, 0.3, 0.5, 0.7, 0.86, 0.94, 0.98].map((v) => yAt(Ytip - v * NC));
  const W = widthAt(tipRow[0]) || 1;
  const cols = [wTip, wTip + side * 0.5, wTip + side, wBack, wBack + side * 0.5, wBack + side].flatMap((x) => [x / W, -x / W]).filter((u) => Math.abs(u) < 0.98);
  const Ysub = Ytip - vSub * NC;
  // the JAW (both shells, the same move on each, so their seam stays shut). The head's underside runs flat from the chin
  // back at the chin's height (a narrow keel, its bottom ring closed by one strip from the chin to its back); the jaw line
  // is a FLOOR under it, a plane rising at the dial's angle back from the chin's front-bottom: a point under it comes up
  // onto it (a soft max, tight), a point over it stays. The floor goes through the chin's front-bottom itself, so the
  // keel's closing strip lies in it and nothing creases at the chin; the rows it gathers keep their order front to back.
  // It fades out behind the keel's end, inside the neck, before the nape. In profile, against the shaded neck, the floor
  // is the jaw line.
  // `ear`: { Y: the lobe's height, zFront, zBack }; absent, no jaw.
  const jawDeg = lerp(32, 24, profile), tj = Math.tan(jawDeg * Math.PI / 180 + pitch), soft = 0.012;
  // (the floor rises to the keel's back end, the closing strip's far corner, so the strip lies in it; behind, it holds
  // that height, under the studio's own jaw corner, and fades)
  const Zchin = apply(surface0(0, y0), 0, y0)[2], Zkeel = apply(surface0(0, y0, true), 0, y0, true)[2], zEnd = Math.max(ear ? ear.zBack : 0, Zkeel + 0.03);
  function jaw(p) {
    if (!ear) return p;
    const [x, Y, Z] = p, w = 1 - smooth(zEnd, zEnd + 0.15, Z);
    if (!w || Z <= Zchin) return p;
    const fl = Math.min(Ybot + (Math.min(Z, Zkeel) - Zchin) * tj, ear.Y);
    if (Y > fl + 4 * soft) return p;
    return [x, Y + w * ((Y + fl + Math.sqrt((Y - fl) ** 2 + soft * soft)) / 2 - Y), Z];
  }
  return {
    apply, jaw, rows, cols, NC, tip: [Ytip, Ztip],
    // how much a point of the face (output x, Y) is the nose's wedge: its shading keeps its own normal by this much
    // (the face's capsule proxy smooths everything else; station-loft-shade.js reads the part's `paint.noseKeep`)
    keep: ([x, Y]) => { const v = (Ytip - Y) / NC; return smooth(vStop - 0.08, vStop, v) * (1 - smooth(vSub, vSub + 0.05, v)) * narrow(x, v); },
    under: [[-wTip, Ytip], [wTip, Ytip], [wBack, Ysub], [-wBack, Ysub]],
    box: { yTop: Ytip + 0.02 * NC, yBot: Ysub - 0.02 * NC, half: wBack + side },
    width,
  };
}
