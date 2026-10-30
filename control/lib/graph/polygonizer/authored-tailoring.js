/**
 * AUTHORED TAILORING — a tailored jacket's front and shape (tailored-front.js, the realistic body's: its V, lapels and
 * collar, its edge over the other front, the quarters cut away, its buttons; structured shoulders, a suppressed or a
 * straight waist; a tie; a waistcoat's V and armholes) on the GAME BODY, the authored and the tiered hero, where the
 * jacket was worn plain. Run from the kit hook (authored-kit.js) after the belts, before the jacket's construction.
 *
 *   DENSE        the tailor cuts and shapes cloth point by point, round rings 48 to 64 points round and a centimetre or two
 *                apart; the game body's are ring12, a few centimetres apart. So each tailored jacket's pieces on the trunk
 *                are densified IN PLACE (`densePiece`): each half-ring resampled front to back to `AROUND` points round
 *                (round the ring's centre, never on its chords),
 *                rings put in between every `STEP`. The pieces keep their names and their own stations' ids (the dials
 *                and what was placed on them find them); a ring put in takes its two neighbours' dial blends, its points
 *                their four neighbours' weights, its bands their trims, its addresses (`slotT`) theirs
 *   the VIEW     the pieces read as one tube (`oneTube`, the tail's rings below the body's), the shirt's too, densified
 *                for reading
 *   NO COLLAR    a lapelled jacket on the game body is its lapels alone (`collars: false`: no collar round the back of
 *                the neck), its stand collar taken off; the shirt's collar under it (stood on its neckline over the
 *                jacket at the back: authored-jacket.js standCollar) all its own white
 *   the V        read at each point's own height (the game body's rings tilt at the neckline) and its edge a seam of
 *                the cloth, `SEAM` slots a side (`atHeight`, `seam`: cutV's)
 *
 *   authoredTailoring(recipe, cloth, tailoring, { beltZones, belts }) → { parts, removed }   the pieces made and
 *       reshaped, by name; `removed` the garments taken off (each dropped from the dials too). What the jacket is worn
 *       over, the skin, the shirt and the belts, is read densified round and along (`dense`)
 * Pure and deterministic.
 */
import { tailorFronts } from './tailored-front.js';
import { oneTube } from './body-relational-tailor.js';
import { ringSlots } from './body-relational-resample.js';

/** a densified ring's points round, and the most a ring is apart from the next along a densified piece (m) */
export const AROUND = 48, STEP = 0.015;
/** the slots a side a tailored jacket's V is spread over, its edge a seam of the cloth (cutV's `seam`) */
export const SEAM = 8;
/** a jacket's pieces on the game body's trunk, top to bottom, and its stand collar */
const PIECES = (G) => [`${G}_torso`, `${G}Tail_pelvis`], COLLAR = (G) => `${G}Collar_neck`, SHIRT = ['top_torso', 'topTail_pelvis'], SHIRT_COLLAR = 'topCollar_neck';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const middle = (st) => mean(Object.values(st.points));
const lerp3 = (a, b, t) => [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** weights mixed bilinearly (`ws` [[w, share]]), held to four bones and summing to one */
function mixAll(ws) {
  const w = {};
  for (const [W, s] of ws) for (const [k, v] of Object.entries(W)) w[k] = (w[k] ?? 0) + v * s;
  const top = Object.entries(w).filter(([, v]) => v > 1e-9).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4), sum = top.reduce((t, [, v]) => t + v, 0) || 1;
  const out = Object.fromEntries(top.map(([k, v]) => [k, r6(v / sum)])), e = Object.entries(out), d = r6(1 - e.reduce((t, [, v]) => t + v, 0));
  if (e.length && d) out[e[0][0]] = r6(e[0][1] + d);
  return out;
}
/** a polyline resampled to `m` points by arc length: each [point, segment, share along it] */
function along(pts, m) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1]));
  const T = L[L.length - 1] || 1e-9;
  return Array.from({ length: m }, (_, k) => { const s = (T * k) / (m - 1); let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = Math.max(0, Math.min(1, (s - L[i - 1]) / Math.max(1e-12, L[i] - L[i - 1]))); return [lerp3(pts[i - 1], pts[i], f), i - 1, f]; });
}

/**
 * A ring piece DENSIFIED (see the head of this file): `P` named `name`, its slots resampled to `around` round and rings
 * put in every `step` along it; `dials` (the recipe's, in place: each that names the piece takes the rings put in, blended
 * as their neighbours). → the piece
 */
export function densePiece(P, name, { around = AROUND, step = STEP, dials = {} } = {}) {
  const n = P.slots.length, h = n / 2, H = around / 2, slots = ringSlots(around);
  if (n >= around) return P;
  const own = { [P.bind?.bone]: 1 }, blend = P.bind?.blend ?? {};
  const W = (st, k) => blend[`${st}.${P.slots[k % n]}`] ?? blend[st] ?? own;
  const walkR = Array.from({ length: h + 1 }, (_, k) => k), walkL = [0, ...Array.from({ length: h }, (_, k) => (n - 1 - k + n) % n)];
  // (each new slot's place on the old ring: the two old slots it lies between and its share between them, the same on every
  // ring, read off the middle one)
  const mid = P.stations[Math.floor(P.stations.length / 2)];
  const placeOf = (walk) => along(walk.map((k) => mid.points[P.slots[k]]), H + 1).map(([, i, f]) => [walk[i], walk[Math.min(walk.length - 1, i + 1)], f]);
  const PR = placeOf(walkR), PL = placeOf(walkL), place = slots.map((_, j) => (j <= H ? PR[j] : PL[around - j]));
  // (a new point ROUND the ring's centre between its two old ones, its angle and its distance mixed: a straight chord
  // between ring12's points runs 5 mm inside the round on a trunk, into whatever the cloth was fitted over)
  const ring = (st) => { const c = middle(st); return Object.fromEntries(slots.map((sl, j) => {
    const [a, b, f] = place[j], p = st.points[P.slots[a]], q = st.points[P.slots[b]], ra = Math.hypot(p[0] - c[0], p[1] - c[1]), rb = Math.hypot(q[0] - c[0], q[1] - c[1]);
    const ta = Math.atan2(p[1] - c[1], p[0] - c[0]); let dt = Math.atan2(q[1] - c[1], q[0] - c[0]) - ta; if (dt > Math.PI) dt -= 2 * Math.PI; if (dt < -Math.PI) dt += 2 * Math.PI;
    const t = ta + dt * f, r = ra + (rb - ra) * f;
    return [sl, [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, p[2] + (q[2] - p[2]) * f].map(r6)];
  })); };
  const stations = [], nb = {}, bands = {};
  const weigh = (id, A, B, t) => { for (const [j, sl] of slots.entries()) { const [a, b, f] = place[j]; nb[`${id}.${sl}`] = mixAll([[W(A, a), (1 - t) * (1 - f)], [W(A, b), (1 - t) * f], [W(B, a), t * (1 - f)], [W(B, b), t * f]]); } };
  for (let i = 0; i < P.stations.length; i++) {
    const A = P.stations[i], RA = ring(A);
    stations.push({ id: A.id, u: A.u, points: RA }); weigh(A.id, A.id, A.id, 0);
    const B = P.stations[i + 1]; if (!B) continue;
    const RB = ring(B), m = Math.max(0, Math.ceil(dist(middle(A), middle(B)) / step) - 1), G = P.bandGroups?.[`${A.id}-${B.id}`];
    let prev = A.id;
    for (let k = 1; k <= m + 1; k++) {
      const t = k / (m + 1), id = k <= m ? `${A.id}_${B.id}_q${k}` : B.id;
      if (k <= m) {
        stations.push({ id, u: r6((A.u ?? i) + ((B.u ?? i + 1) - (A.u ?? i)) * t), points: Object.fromEntries(slots.map((sl) => [sl, lerp3(RA[sl], RB[sl], t).map(r6)])) });
        weigh(id, A.id, B.id, t);
        for (const d of Object.values(dials)) if (d.parts?.includes(name) && d.blend && (d.blend[A.id] || d.blend[B.id]) && d.blend[id] === undefined) d.blend[id] = r6((d.blend[A.id] ?? 0) * (1 - t) + (d.blend[B.id] ?? 0) * t);
      }
      // (each band between the rings the trims of the old band it lies in, read round by its place)
      if (G) bands[`${prev}-${id}`] = Array.from({ length: H }, (_, j) => G[Math.min(h - 1, place[j][0] <= h ? place[j][0] : n - place[j][0])]);
      prev = id;
    }
  }
  nb.back = blend.back ?? W(P.stations[0].id, 0); nb.tip = blend.tip ?? W(P.stations[P.stations.length - 1].id, 0);
  const slotT = P.slotT ? Object.fromEntries(slots.slice(0, H + 1).map((sl, j) => { const [a, b, f] = place[j], ta = P.slotT[P.slots[a]] ?? a, tb = P.slotT[P.slots[b]] ?? b; return [sl, r6(ta + (tb - ta) * f)]; })) : null;
  const { bandGroups: _b, slotT: _t, ...rest } = P;
  return { ...rest, slots, stations, ...(slotT ? { slotT } : {}), ...(Object.keys(bands).length ? { bandGroups: bands } : {}), bind: { ...(P.bind || {}), blend: nb } };
}

/** pieces read as one tube: the lower's rings, then the upper's (oneTube), densified for reading */
function viewOf(Ps) {
  const [lo, hi] = [...Ps].sort((a, b) => Math.min(...a.stations.map((st) => middle(st)[2])) - Math.min(...b.stations.map((st) => middle(st)[2])));
  const T = hi ? oneTube(lo, hi) : lo;
  return T.slots.length >= AROUND ? T : densePiece(T, null);
}

/** The tailoring on the game body (see the head of this file). `cloth` the recipe's garments by name. */
const READ = new WeakMap();
/** a part as the tailor reads its points (densified round and along, never changed), once */
export const denseRead = (P) => { if (!P?.stations || (P.layer !== undefined && P.layer !== 1)) return P; if (!READ.has(P)) READ.set(P, densePiece(P, null)); return READ.get(P); };

export function authoredTailoring(recipe, cloth, tailoring, { beltZones = [], belts = [] } = {}) {
  const parts = {}, removed = [];
  const jackets = Object.entries(tailoring || {}).filter(([k, T]) => k !== 'tie' && k !== 'jacket' && T && (k === 'vest' || T.lapel || T.shoulder || T.waist)).map(([G]) => G);
  if (!jackets.length && !tailoring?.tie) return { parts, removed };
  // DENSE: each tailored jacket's pieces on the trunk, in place
  for (const G of jackets) for (const k of PIECES(G)) if (cloth[k]) parts[k] = densePiece(cloth[k], k, { dials: recipe.dials });
  // (a lapelled jacket carries no collar on the game body: its lapels alone, over the shirt's collar)
  for (const G of jackets) if (tailoring[G]?.lapel && tailoring[G].lapel !== 'none' && cloth[COLLAR(G)]) removed.push(COLLAR(G));
  // (the SHIRT'S COLLAR under a tailored jacket all the shirt collar's own white: the trim the outfit spends on a collar's
  // edge is the suit's colour, and on a shirt collar beside the jacket it read as a second, blue collar)
  if (jackets.length && cloth[SHIRT_COLLAR]?.bandGroups) {
    const C = cloth[SHIRT_COLLAR], own = C.group ?? 'Collar';
    parts[SHIRT_COLLAR] = { ...C, bandGroups: Object.fromEntries(Object.entries(C.bandGroups).map(([b, G]) => [b, G.map(() => own)])) };
  }
  const work = { ...cloth, ...parts, ...belts };
  for (const k of removed) delete work[k];
  const before = new Set(Object.keys(work));
  const shoulders = ['R', 'L'].map((S) => recipe.parts[`upperArm${S}`]).filter(Boolean).map((P) => middle(P.stations[0])[2]);
  tailorFronts(work, recipe, tailoring, {
    beltZones, beltPts: belts.map(denseRead).flatMap((P) => P.stations.flatMap((st) => Object.values(st.points))), shoulderZ: shoulders.length ? Math.max(...shoulders) : null,
    jacketOf: (G) => PIECES(G).filter((k) => work[k]), shirtOf: () => SHIRT.filter((k) => work[k]), view: viewOf, read: denseRead, collars: false, atHeight: true, seam: SEAM,
  });
  // (what it made, and the jacket's pieces it reshaped)
  for (const [k, P] of Object.entries(work)) if (!before.has(k) || parts[k]) parts[k] = P;
  return { parts, removed };
}
