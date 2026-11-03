// equipment/shields — laws 2's shields past the flat board (laws 1's round, heater and kite are items.js shield()):
//
//   outline        round · heater · kite (laws 1's), and scutum (a tall rectangle, rounded) · tower (taller, square) ·
//                  oval · buckler (a small round)
//   curve          flat · barrel (bent about the upright: the face wraps the arm, its edges back) · dish (a dome:
//                  round outlines only); `bend` 0–1 how deep. Each outline has its own: a scutum and a tower barrel, a
//                  buckler a dish, an oval a shallow barrel, the rest flat
//   construction   board (one slab) · planks (boards side by side, their seams, two iron bands, nails) · panels (the
//                  face framed into panels by riveted straps)
//
// The board is lofted through its sections (a loft along the upright, each station the face's arc at that height,
// the outline's width there), or turned (a dish is a lathe about the face's normal); the rim, the seams and the straps
// ride the face; the boss sits on it. The frame is the shield's: its face in xz, the front toward −y, its grip behind
// on +y. A laws-2 shield naming none of a new outline, a curve or a construction is drawn as laws 1 draws it.
import { r3, P, A, push, mat } from './shapes.js';
import * as dmath from '../../util/dmath.js';

/** a colour toward black by k (0 … 1) */
const shade = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('');

export const SHIELD_OUTLINES = Object.freeze(['scutum', 'tower', 'oval', 'buckler']);
export const SHIELD_CURVES = Object.freeze(['flat', 'barrel', 'dish']);
export const SHIELD_CONSTRUCTIONS = Object.freeze(['board', 'planks', 'panels']);
/** each new outline's size (cm: width, height) and its own curve and bend */
const OUTLINE = Object.freeze({
  scutum: { W: 66, H: 104, curve: 'barrel', bend: 0.6, corner: 0.16 },
  tower: { W: 58, H: 122, curve: 'barrel', bend: 0.35, corner: 0.05 },
  oval: { W: 58, H: 88, curve: 'barrel', bend: 0.35 },
  buckler: { W: 34, H: 34, curve: 'dish', bend: 0.7 },
  round: { W: 76, H: 76, curve: 'flat', bend: 0.45 },
  heater: { W: 57.6, H: 72, curve: 'flat', bend: 0.45 },
  kite: { W: 41.8, H: 72, curve: 'flat', bend: 0.45 },
});

/** Whether a laws-2 shield's words ask for this builder (a new outline, a curve, a construction). */
export const drawsShield2 = (lang) => SHIELD_OUTLINES.includes(lang.outline) || lang.curve !== undefined || lang.construction !== undefined || lang.bend !== undefined;

/** the outline's half-width at height z (0 … H), cm */
function halfWidth(kind, z, { W, H, corner = 0 }) {
  const u = Math.max(0, Math.min(1, z / H));
  if (kind === 'oval' || kind === 'round' || kind === 'buckler') return (W / 2) * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
  if (kind === 'heater' || kind === 'kite') {
    const sh = kind === 'kite' ? 0.72 : 0.55;
    return u < sh ? (W / 2) * dmath.pow(dmath.sin((Math.PI / 2) * (u / sh)), kind === 'kite' ? 0.9 : 0.65) : (W / 2) * (kind === 'kite' ? 1 - 0.18 * (u - sh) / (1 - sh) : 1);
  }
  // scutum, tower: a rectangle, its corners rounded by `corner` of the width
  const rc = corner * W, d = Math.min(z, H - z);
  if (d >= rc) return W / 2;
  const e = rc - d; return W / 2 - rc + Math.sqrt(Math.max(0, rc * rc - e * e));
}

/** Build a laws-2 shield → { sockets, trace, length }. `lang` the item's resolved words; roles the card's. */
export function buildShield2(m, { d, law, roles, lang, minF, focalGrow }) {
  const kind = lang.outline ?? 'heater', O = OUTLINE[kind] ?? OUTLINE.heater;
  const curve = lang.curve ?? O.curve, bend = lang.bend ?? O.bend, cons = lang.construction ?? 'board';
  const W = O.W, H = O.H, th = 1.8 * law.hilt ** 0.5 * (kind === 'buckler' ? 0.8 : 1), rimT = Math.max(minF / 2, (kind === 'buckler' ? 0.7 : 0.9) * law.rim);
  const board = mat(roles.board), fit = mat(roles.fittings), acc = mat(roles.accent);
  // a seam is the board's own colour in shadow (a painted board's darker), never a role of its own
  const dark = mat(['matte', Array.isArray(roles.board) ? shade(roles.board[1], 0.42) : '#2a2420']);
  const z0 = rimT, zc = z0 + H / 2, R = W / 2;
  // the face's depth at a point (−y forward): a barrel's sag across x, a dish's over the radius from the centre
  const s = bend * (curve === 'dish' ? 0.32 * R : 0.24 * R);
  const sphere = curve === 'dish' ? (R * R + s * s) / (2 * s) : 0;
  const front = (x, z) => {
    if (curve === 'barrel') return -s * (1 - (x / R) ** 2);
    if (curve === 'dish') { const r2 = x * x + (z - zc) ** 2; return -(Math.sqrt(Math.max(0, sphere * sphere - r2)) - (sphere - s)); }
    return 0;
  };
  const trace = { variants: { outline: kind, curve, bend: r3(bend), construction: cons } };
  if (curve === 'dish') {
    // a dome turned about the face's normal: its back flat at y = th, its front a spherical cap s deep
    const n = 10, prof = [{ t: 0, radius: r3(R) }];
    for (let i = 0; i <= n; i++) { const h = (s * i) / n, t = (th + h) / (th + s); prof.push({ t: r3(t), radius: r3(Math.sqrt(Math.max(0, sphere * sphere - (sphere - s + h) ** 2)) * (i === n ? 0 : 1)) }); }
    push(m, 'lathes', { group: 'board', axisFrom: P(0, th, zc), axisTo: P(0, -s, zc), profile: prof.filter((p, i, a) => i === 0 || p.t > a[i - 1].t), samples: 48, ...board });
  } else {
    // a loft up the shield: each station the face's arc at that height, its back the same arc th behind
    const N = 12, stations = [], nz = 26;
    for (let j = 0; j <= nz; j++) {
      const t = j / nz, z = z0 + t * H, w = Math.max(0.4, halfWidth(kind, t * H, O)), pts = [];
      for (let i = 0; i <= N; i++) { const x = -w + (2 * w * i) / N; pts.push([r3(x), r3(front(x, z))]); }
      for (let i = N; i >= 0; i--) { const x = -w + (2 * w * i) / N; pts.push([r3(x), r3(front(x, z) + th)]); }
      stations.push({ t: r3(t), profile: pts });   // the front left to right, the back right to left: counter-clockwise in (x, y)
    }
    push(m, 'lofts', { group: 'board', axisFrom: [0, 0, z0], axisTo: [0, 0, z0 + H], stations, interp: 'linear', ...board });
  }
  // the rim: round the outline, on the face
  const rimPts = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) { const z = z0 + (H * i) / steps, x = halfWidth(kind, (H * i) / steps, O); rimPts.push([x, z]); }
  const outline = [...rimPts, ...rimPts.slice(1, -1).reverse().map(([x, z]) => [-x, z])];
  push(m, 'sweeps', { group: 'rim', path: [...outline, outline[0]].map(([x, z]) => A(x, front(x, z) + th * 0.35, z)), radius: r3(rimT), sides: 8, ...fit });
  // the construction (law 5: detail in tiers): planks' seams, bands and nails; panels' straps and rivets
  const onFace = (x, z, lift = 0) => [x, front(x, z) - lift, z];
  const across = (z, lift, role, r) => { const w = halfWidth(kind, z - z0, O) * 0.97, path = []; for (let i = 0; i <= 16; i++) { const x = -w + (2 * w * i) / 16; path.push(A(...onFace(x, z, lift))); } push(m, 'sweeps', { group: 'device', path, radius: r3(r), sides: 6, ...role }); return w; };
  const upright = (x, lift, role, r) => { const path = []; for (let i = 0; i <= 20; i++) { const z = z0 + (H * i) / 20; if (Math.abs(x) <= halfWidth(kind, z - z0, O) * 0.97) path.push(A(...onFace(x, z, lift))); } if (path.length >= 2) push(m, 'sweeps', { group: 'device', path, radius: r3(r), sides: 6, ...role }); };
  const stud = (x, z, r) => push(m, 'lathes', { group: 'device', axisFrom: P(x, front(x, z) + 0.2, z), axisTo: P(x, front(x, z) - r * 1.1, z), profile: [{ t: 0, radius: r3(r) }, { t: 0.6, radius: r3(r * 0.9) }, { t: 1, radius: r3(r * 0.35) }], ...acc });
  if (cons === 'planks') {
    const n = Math.max(3, Math.round(W / (9 * law.pitch ** 0.5)));
    for (let k = 1; k < n; k++) upright(-R + (W * k) / n, 0.02, dark, Math.max(minF / 2, 0.22));
    for (const f of kind === 'buckler' ? [0.5] : [0.24, 0.76]) { const z = z0 + H * f, w = across(z, 0.25, fit, Math.max(minF / 2, 0.7 * law.rim ** 0.5)); const p = Math.max(4, 7 * law.pitch ** 0.5); for (let x = -w + p / 2; x < w; x += p) stud(x, z, 0.8); }
  } else if (cons === 'panels') {
    const rows = kind === 'tower' ? 3 : kind === 'buckler' ? 1 : 2, strap = Math.max(minF / 2, 0.85 * law.rim ** 0.5);
    for (let r = 1; r <= rows; r++) across(z0 + (H * r) / (rows + 1), 0.25, fit, strap);
    upright(0, 0.25, fit, strap);
    for (let r = 0; r <= rows + 1; r++) { const z = z0 + (H * r) / (rows + 1); const w = halfWidth(kind, z - z0, O) * 0.8; for (const x of [-w, -w / 2, 0, w / 2, w]) if (r > 0 && r < rows + 1) stud(x, z, 1.1); }
  }
  // the boss on the face's centre (a round shield, a buckler, a scutum's umbo; any shield whose focus asks)
  const cz = kind === 'heater' || kind === 'kite' ? z0 + H * 0.6 : zc, bossR = R * (kind === 'buckler' ? 0.32 : 0.17) * focalGrow ** 0.6;
  if (['round', 'buckler', 'scutum', 'oval'].includes(kind) || d.focus !== 'none') {
    const y = front(0, cz);
    push(m, 'lathes', { group: 'boss', axisFrom: P(0, y + th * 0.5, cz), axisTo: P(0, y - bossR * 0.75, cz), profile: [{ t: 0, radius: r3(bossR) }, { t: 0.45, radius: r3(bossR * 0.88) }, { t: 1, radius: 0 }], samples: 40, ...fit });
    trace.focal = { at: 'boss', grow: r3(focalGrow) };
  }
  const back = front(0, cz) + th;
  const sockets = { grip: { origin: A(0, back + 4, cz), axis: [1, 0, 0], length: kind === 'buckler' ? 10 : 12 }, focal: { origin: A(0, front(0, cz) - bossR * 0.75, cz) } };
  return { sockets, trace, length: H + 2 * rimT };
}
