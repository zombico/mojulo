/**
 * THE STAND — the bowl's section (stadium/bowl.js) swept along a straight instead of round a ring: a racing circuit's
 * grandstand built from the same parts as a stadium's, so a venue beside a track reads as one. From the front: a wall of
 * boards, raked tiers two rows a step with aisles, the crowd a mosaic on the treads (never figures), a concourse with a
 * band of glass boxes under an upper tier, a parapet, the back wall in a facade card between pilasters, a canopy
 * cantilevered from the back over the upper rows with its truss and rafters, a screen on the rim facing the track; both
 * ends closed by the section itself.
 *
 *   STAND_CLASSES       a class's stand (circuit, kart, rally), fitted to the arena plan's stand zone (arena-plan.js
 *                       ARENA: its depth less the set-back from the zone's front, where the catch fence stands)
 *   readStands(v, cls) → null (the set piece's block: absent or 'block') | the stand's words, the class's under them:
 *                       'bowl', or { rows?: [lower, upper?] (3..20 each), roof?: none | canopy, facade?: none | glass |
 *                       brick | metal, crowd?: 0..1, screens?: 0 | 1, livery?: a stadium livery }; throws, teaching
 *   standFaces(S, { from, to, out, z, colours, seed }) → { faces, box: { lo, hi, size }, top, depth, eye, roofZ,
 *                       height, length }
 *     from, to   the stand's front on the ground, along the track; out the unit direction away from it; z the pad
 *     colours    the livery's tints: seat, boards, glass, roof, accent, screen, wall; crowd the shirts
 *   paintStand(faces, K) → World faces in the track's kit (track-kit.js): the concrete and the steel the kit's
 *                       materials on its pole, the seats, the crowd and the boards tints lit as paint, the screen alight,
 *                       the back wall its facade card
 *
 * Each face carries what paints it, as a set piece's do (set-pieces.js): a `group` and a `value` for the kit, or a
 * `tint`, a `glow` (the screen), or a facade `card` (the back wall), and its `normal` wound to the side it is seen from
 * (the track's side, the street's, the roof's from below), so the hour's relight (roads/race-mood.js) reads it.
 *
 * Pure and seeded; the same words are the same stand.
 */
import { buildFacadeCard } from '../architecture/facade-card.js';
import { litFactor } from '../polygonizer/vexar.js';
import { paintPiece } from '../roads/set-pieces.js';
import { LIGHT } from '../roads/road-faces.js';
import { STADIUM_LIVERIES, STADIUM_CROWD } from './stadium-words.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const normalOf = (c) => unit(cross(sub(c[1], c[0]), sub(c[c.length - 1], c[0])));
const scaleHex = (h, k) => `#${[1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('')}`;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function dice(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A class's stand, fitted to its zone: a circuit's two tiers under a canopy behind glass, a kart track's one covered
 *  tier, a rally's open bank; `back` the set-back from the zone's front (the catch fence's room). */
export const STAND_CLASSES = Object.freeze({
  circuit: Object.freeze({ rows: [8, 5], rise: 0.42, roof: 'canopy', facade: 'glass', crowd: 0.75, screens: 1, livery: 'club', seg: 3.5, back: 2 }),
  kart: Object.freeze({ rows: [6], rise: 0.4, roof: 'canopy', facade: 'none', crowd: 0.6, screens: 0, livery: 'meadow', seg: 3, back: 1 }),
  rally: Object.freeze({ rows: [8], rise: 0.4, roof: 'none', facade: 'none', crowd: 0.65, screens: 0, livery: 'town', seg: 3.5, back: 2 }),
});
const ROOFS = ['none', 'canopy'], FACADES = ['none', 'glass', 'brick', 'metal'], WORDS = ['rows', 'roof', 'facade', 'crowd', 'screens', 'livery'];
const LIVERY_IDS = Object.keys(STADIUM_LIVERIES);

/** The `stands` word, checked; null keeps the set piece's block. */
export function readStands(v, cls = 'circuit') {
  if (v === undefined || v === null || v === false || v === 'block') return null;
  const base = STAND_CLASSES[cls] ?? STAND_CLASSES.circuit, fail = (m) => { throw new Error(`trackscape: stands ${m}`); };
  if (v === true || v === 'bowl') return { ...base };
  if (!isObj(v)) fail(`is 'block' (the set piece), 'bowl' (the stadium's section, the class's) or { ${WORDS.join('?, ')}? }`);
  for (const k of Object.keys(v)) if (!WORDS.includes(k)) fail(`has no '${k}' (${WORDS.join(', ')})`);
  if (v.rows !== undefined && !(Array.isArray(v.rows) && v.rows.length >= 1 && v.rows.length <= 2 && v.rows.every((n) => Number.isInteger(n) && n >= 3 && n <= 20))) fail('rows is [lower] or [lower, upper], each 3 to 20 (an upper tier stands over a concourse of glass boxes)');
  if (v.roof !== undefined && !ROOFS.includes(v.roof)) fail(`roof is ${ROOFS.join(' or ')}`);
  if (v.facade !== undefined && !FACADES.includes(v.facade)) fail(`facade is ${FACADES.join(', ')}`);
  if (v.crowd !== undefined && !(typeof v.crowd === 'number' && v.crowd >= 0 && v.crowd <= 1)) fail('crowd is 0 to 1 (the share of seats taken)');
  if (v.screens !== undefined && v.screens !== 0 && v.screens !== 1) fail('screens is 0 or 1 (a video board on the rim, facing the track)');
  if (v.livery !== undefined && !LIVERY_IDS.includes(v.livery)) fail(`livery is one of ${LIVERY_IDS.join(', ')}`);
  return { ...base, ...v };
}

/** The livery's tints as a stand wears them, the crowd's shirts beside them. */
export const standColours = (S) => ({ ...STADIUM_LIVERIES[S.livery] ?? STADIUM_LIVERIES.club, crowd: STADIUM_CROWD });

/** The stand's faces along its front from `from` to `to`, rising away from the track along `out`, on a pad at `z`. */
export function standFaces(S, { from, to, out, z = 0, colours = standColours(S), seed = 1 }) {
  const C = colours, roll = dice(seed * 7919 + 31), faces = [];
  const t = unit([to[0] - from[0], to[1] - from[1], 0]), n = unit([out[0], out[1], 0]), L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const segs = Math.max(2, Math.round(L / S.seg)), U = (k) => (L * k) / segs;
  const P = (o, u, zz) => [r3(from[0] + t[0] * u + n[0] * o), r3(from[1] + t[1] * u + n[1] * o), r3(z + zz)];
  // a face wound to the side it is seen from: 'in' (up and toward the track), 'out' (up and toward the street), 'up',
  // 'under' (a roof seen from the stands), or a direction
  const WANT = { in: [-n[0], -n[1], 0.5], out: [n[0], n[1], 0.5], up: [0, 0, 1], under: [-n[0] * 0.3, -n[1] * 0.3, -1] };
  const quad = (corners, paint, side = 'in') => {
    const want = Array.isArray(side) ? side : WANT[side];
    let nn = normalOf(corners);
    if (dot(nn, want) < 0) { corners = [...corners].reverse(); nn = nn.map((v) => -v); }
    faces.push({ corners, normal: nn.map(r3), ...paint });
    return nn;
  };
  // a quad between two lines of the section (o0, z0) → (o1, z1) over segment k, split into `m` pieces along it
  const band = (k, o0, z0, o1, z1, paintOf, m = 1, side = 'in') => {
    for (let j = 0; j < m; j++) {
      const u0 = U(k + j / m), u1 = U(k + (j + 1) / m);
      quad([P(o0, u0, z0), P(o0, u1, z0), P(o1, u1, z1), P(o1, u0, z1)], typeof paintOf === 'function' ? paintOf(j) : paintOf, side);
    }
  };
  const each = (fn) => { for (let k = 0; k < segs; k++) fn(k); };
  const concrete = (v = 0.6) => ({ group: 'tech:body', value: v }), steel = (v = 0.55) => ({ group: 'tech:frame', value: v }), tint = (h) => ({ tint: h });
  const profile = [];   // the section, [o0, o1, z] steps: what closes each end

  // the front: a wall of hoardings, the advertisers' colour and the accent in turn
  const wallH = 1.1;
  each((k) => band(k, 0, 0, 0, wallH, tint(k % 2 ? C.boards : C.accent)));
  profile.push([0, 0.3, wallH]);
  // the tiers: each step two rows, a riser and a tread (the crowd's mosaic on it); aisles every few segments
  const tiers = S.rows.map((rows, i) => ({ rows, tread: 0.82, rise: r3(i === 0 ? S.rise : Math.min(0.7, S.rise + 0.12)) }));
  const seatOf = () => tint(roll() < S.crowd ? C.crowd[Math.floor(roll() * C.crowd.length)] : C.seat);
  let o = 0, zz = wallH, top = zz, eye = zz;
  tiers.forEach((tier, ti) => {
    if (ti > 0) {
      // the concourse between the tiers, then a band of glass boxes under the upper tier's front and its lip
      each((k) => { band(k, o, zz, o + 2.4, zz, concrete(0.7), 1, 'up'); band(k, o + 2.4, zz, o + 2.4, zz + 3.2, tint(C.glass)); });
      profile.push([o, o + 2.4, zz]);
      o += 2.4; zz += 3.2;
      each((k) => band(k, o, zz, o + 0.6, zz, tint(C.accent), 1, 'up'));
      profile.push([o, o + 0.6, zz]);
      o += 0.6;
    }
    for (let r = 0; r < tier.rows; r += 2) {
      const step = Math.min(2, tier.rows - r), d = tier.tread * step, h = tier.rise * step;
      each((k) => {
        const aisle = ti === 0 && k % 6 === 3 && r < tier.rows * 0.6;
        band(k, o, zz, o, zz + h, aisle ? concrete(0.45) : tint(scaleHex(C.seat, 0.62)));
        band(k, o, zz + h, o + d, zz + h, aisle ? concrete(0.7) : seatOf, aisle ? 1 : 3, 'up');
      });
      profile.push([o, o + d, zz + h]);
      o += d; zz += h;
      if (ti === tiers.length - 1 && r <= tier.rows / 2) eye = zz + 1.2;
    }
    top = zz;
  });
  // the back: a parapet at the top, and the back wall down to the pad carrying its facade between pilasters
  const outer = o + 1.2, wallTop = top + 1.2;
  each((k) => { band(k, o, top, o, wallTop, concrete(0.75)); band(k, o, wallTop, outer, wallTop, concrete(0.6), 1, 'up'); });
  profile.push([o, outer, wallTop]);
  const card = S.facade === 'none' ? null : buildFacadeCard(S.facade === 'brick' ? { material: 'brick', glass: C.glass, rhythm: 'punched' } : S.facade === 'metal' ? { material: 'metal', metal: { metal: 'aluminium', finish: 'brushed' }, rhythm: 'banded' } : { material: 'glass', glass: C.glass, frame: C.wall, rhythm: 'curtain', glassVar: 1 }, Math.max(2, Math.round(wallTop / 4.2)), Math.max(1, Math.round(L / segs / 3.5)));
  each((k) => {
    const a = P(outer, U(k), 0), b = P(outer, U(k + 1), 0);
    quad([a, b, [b[0], b[1], r3(z + wallTop)], [a[0], a[1], r3(z + wallTop)]], card ? { tint: C.wall, card } : concrete(0.55), 'out');
    if (k % 4 === 0) {
      // a pilaster: a rib standing proud of the wall, up past its top
      const u0 = U(k), u1 = u0 + 0.6, hT = wallTop + 1.4;
      quad([P(outer + 1.1, u0, 0), P(outer + 1.1, u1, 0), P(outer + 1.1, u1, hT), P(outer + 1.1, u0, hT)], steel(), 'out');
      quad([P(outer, u0, 0), P(outer + 1.1, u0, 0), P(outer + 1.1, u0, hT), P(outer, u0, hT)], steel(), [-t[0], -t[1], 0]);
      quad([P(outer, u1, 0), P(outer + 1.1, u1, 0), P(outer + 1.1, u1, hT), P(outer, u1, hT)], steel(), [t[0], t[1], 0]);
      quad([P(outer, u0, hT), P(outer + 1.1, u0, hT), P(outer + 1.1, u1, hT), P(outer, u1, hT)], steel(), 'up');
    }
  });
  // the ends: the section closing the stand at both, from the pad up each step
  for (const [u, side] of [[0, [-t[0], -t[1], 0]], [L, [t[0], t[1], 0]]]) for (const [o0, o1, h] of profile) quad([P(o0, u, 0), P(o1, u, 0), P(o1, u, h), P(o0, u, h)], concrete(0.55), side);

  // the roof: a cantilever from the back wall in over the upper rows, its edge a truss, rafters along its fall
  const roofZ = top + 4.5, inner = outer * 0.45;
  let height = wallTop + 1.4;
  if (S.roof === 'canopy') {
    each((k) => {
      band(k, outer + 0.5, roofZ, inner, roofZ - 1.6, tint(C.roof), 1, 'up');
      band(k, outer + 0.5, roofZ - 0.2, inner, roofZ - 1.8, tint(scaleHex(C.roof, 0.86)), 1, 'under');
      band(k, inner, roofZ - 1.6, inner, roofZ - 2.6, steel(0.6));                // the truss's face
      band(k, inner, roofZ - 2.6, inner + 1.4, roofZ - 2.4, steel(0.4), 1, 'under');
      band(k, outer, wallTop, outer + 0.5, roofZ, concrete(0.5), 1, 'out');        // louvres up to the roof
      if (k % 4 === 2) {
        const u0 = U(k), u1 = u0 + 0.5;
        quad([P(outer + 0.5, u0, roofZ + 0.05), P(inner, u0, roofZ - 1.55), P(inner, u1, roofZ - 0.95), P(outer + 0.5, u1, roofZ + 0.95)], steel(0.6), 'out');
      }
    });
    // (its two ends: the canopy's edge, a slab's thickness)
    for (const [u, side] of [[0, [-t[0], -t[1], 0]], [L, [t[0], t[1], 0]]]) quad([P(outer + 0.5, u, roofZ - 0.2), P(inner, u, roofZ - 1.8), P(inner, u, roofZ - 1.6), P(outer + 0.5, u, roofZ)], steel(0.6), side);
    height = roofZ + 1;
  }
  // the screen: a video board on the rim at the middle, facing the track, on two legs
  if (S.screens) {
    const rimZ = S.roof === 'canopy' ? roofZ + 0.6 : wallTop + 0.6, W = Math.min(24, Math.max(8, L * 0.3)), Hs = W * 0.4, mid = L / 2, back = outer - 1;
    const pt = (u, h, d = 0) => P(back - d, mid + u, rimZ + h);
    for (const u of [-W * 0.3, W * 0.3]) quad([pt(u - 0.4, -rimZ), pt(u + 0.4, -rimZ), pt(u + 0.4, 1.5), pt(u - 0.4, 1.5)], steel(0.45), 'in');
    quad([pt(-W / 2 - 0.6, 1.2), pt(W / 2 + 0.6, 1.2), pt(W / 2 + 0.6, Hs + 2.4), pt(-W / 2 - 0.6, Hs + 2.4)], tint('#16191e'), 'in');
    quad([pt(-W / 2 - 0.6, 1.2), pt(W / 2 + 0.6, 1.2), pt(W / 2 + 0.6, Hs + 2.4), pt(-W / 2 - 0.6, Hs + 2.4)], tint('#16191e'), 'out');
    quad([pt(-W / 2, 1.8, 0.08), pt(W / 2, 1.8, 0.08), pt(W / 2, 1.8 + Hs * 0.7, 0.08), pt(-W / 2, 1.8 + Hs * 0.7, 0.08)], { fill: C.screen, glow: true }, 'in');
    quad([pt(-W / 2, 1.8 + Hs * 0.74, 0.08), pt(W / 2, 1.8 + Hs * 0.74, 0.08), pt(W / 2, 1.8 + Hs, 0.08), pt(-W / 2, 1.8 + Hs, 0.08)], { fill: C.accent, glow: true }, 'in');
    height = Math.max(height, rimZ + Hs + 2.4);
  }
  const all = faces.flatMap((f) => f.corners), lo = [0, 1, 2].map((i) => r3(Math.min(...all.map((p) => p[i])))), hi = [0, 1, 2].map((i) => r3(Math.max(...all.map((p) => p[i]))));
  return { faces, box: { lo, hi, size: hi.map((v, i) => r3(v - lo[i])) }, top: r3(top), depth: r3(outer + 1.1), eye: r3(eye), roofZ: S.roof === 'canopy' ? r3(roofZ) : null, height: r3(height), length: r3(L) };
}

/** The stand's faces in the track's kit: the screen alight, the back wall its facade card, the rest on the kit's pole. */
export function paintStand(faces, K) {
  const out = [], rest = [];
  for (const f of faces) {
    if (f.glow) out.push({ corners: f.corners, fill: f.fill, glow: true });
    else if (f.card) { const p = K.tint(f.tint, f.corners, f.normal); out.push({ ...p, card: f.card, lit: r3(litFactor(f.normal, LIGHT)) }); }
    else rest.push(f);
  }
  return [...paintPiece(rest, K), ...out];
}
