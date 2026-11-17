/**
 * A TRACK'S DESIGN LANGUAGE — what a track is made of and how its parts are shaped, said once, so the way, its edge,
 * its kerb, its rail and the posts the rail stands on are one family and not a road, a wall and a toy from three
 * places. A language is a card: a small family of MATERIALS (what it is, how it finishes, its colour) and the PARTS
 * drawn in them, each with a profile (the section swept along the track). The track (track.js) draws its parts from
 * the card it is given (`language`); with none it draws its class's template as it always has.
 *
 *   material  { of, finish, hex }   of: what it is (plastic, fondant, steel …); finish: gloss | satin | matte
 *   parts     way    { material } | { from: 'kit' } (the look's own asphalt, its wear and its repairs)
 *             edge   { profile: 'bead', w, h, material } | { from: 'kit' } (a painted line)
 *             kerb   { profile: 'pillow', h, materials: [a, b] } | { from: 'kit' } (flat paint), on the corners
 *             rail   { profile: 'tube', r, z, material, tell?: [a, b], post } | { profile: 'w-beam', material, post }
 *                    tell: the two materials the rail wears in stripes round the OUTSIDE of a corner, so a corner is
 *                    told by the rail before the kerb is reached
 *             post   { profile: 'round' | 'i', r, every, material, cap?: { r, material } } (inside `rail`)
 *
 * A language suits a tuning (`suits`: the design classes, classes.js). The first two: `candy`, a kart track of moulded
 * plastic, and `grand-prix`, a circuit's steel and paint. A new one is a card.
 *
 *   TRACK_LANGUAGES, LANGUAGE_OF_CLASS
 *   readLanguage(v) → the card (by id, or written out) with its id, or null for none; throws on an unknown id
 *   sweep / railFaces / postFaces / kerbFaces / edgeFaces → raw faces { corners, hex, normal, gloss, part }: no light
 *     in them (the track lights them in its drawing: chunky-look.js, or the kit's own)
 *   languageLaws(card, { cls?, drawn? }) → [{ law, detail }] the laws it loses (advice, never a refusal):
 *     premise     it says in a sentence what the track is made of
 *     family      the family is small (FAMILY_MAX), and every part names a material in it
 *     one-metal   the rail and its post are of one kind of stuff (a rail of steel on posts of plastic is two tracks)
 *     finish      its hard parts keep to two finishes at most
 *     kerb-read   the kerb's two colours part from each other, and the kerb from the way, by lightness
 *     tell        a rail's tell is not the rail's own colour
 *     suits       the class it is laid on is one it suits
 *     drawn       every colour the track drew for its parts is the family's (`drawn`: the hexes drawn)
 *
 * Pure: data and geometry, no dice.
 */
import { hexToRgb, rgbToOklab } from '../color-theorist/oklab.js';

export const FAMILY_MAX = 7;
export const FINISHES = Object.freeze({ gloss: 0.55, satin: 0.18, matte: 0 });

export const TRACK_LANGUAGES = Object.freeze({
  candy: Object.freeze({
    reads: 'a toy track of moulded plastic: a soft pale way with a cream bead at each edge, fat striped pillows on the corners, one glossy tube rail on round cream posts with a yellow ball on each',
    suits: Object.freeze(['kart']),
    materials: Object.freeze({
      fondant: { of: 'fondant', finish: 'matte', hex: '#7f7aae' },
      cream: { of: 'plastic', finish: 'gloss', hex: '#fff3e2' },
      berry: { of: 'plastic', finish: 'gloss', hex: '#ff4f86' },
      sky: { of: 'plastic', finish: 'gloss', hex: '#35b4ff' },
      lemon: { of: 'plastic', finish: 'gloss', hex: '#ffd03a' },
    }),
    parts: Object.freeze({
      way: { material: 'fondant' },
      edge: { profile: 'bead', w: 0.34, h: 0.08, material: 'cream' },
      kerb: { profile: 'pillow', h: 0.17, materials: ['berry', 'cream'] },
      rail: { profile: 'tube', r: 0.33, z: 0.6, material: 'sky', tell: ['berry', 'cream'],
        post: { profile: 'round', r: 0.24, every: 4, material: 'cream', cap: { r: 0.4, material: 'lemon' } } },
    }),
  }),
  'grand-prix': Object.freeze({
    reads: 'a circuit of asphalt, paint and galvanised steel: the look\'s own road and its flat painted kerbs, a W-beam guardrail on steel posts',
    suits: Object.freeze(['circuit']),
    materials: Object.freeze({
      steel: { of: 'steel', finish: 'satin', hex: '#b3b9bd' },
      post: { of: 'steel', finish: 'matte', hex: '#8b9296' },
    }),
    parts: Object.freeze({
      way: { from: 'kit' }, edge: { from: 'kit' }, kerb: { from: 'kit' },
      rail: { profile: 'w-beam', material: 'steel', post: { profile: 'i', r: 0.07, every: 4, material: 'post' } },
    }),
  }),
});
export const LANGUAGE_OF_CLASS = Object.freeze({ kart: 'candy', circuit: 'grand-prix' });

export function readLanguage(v) {
  if (v === undefined || v === null || v === false) return null;
  if (typeof v === 'string') {
    if (!Object.hasOwn(TRACK_LANGUAGES, v)) throw new Error(`roadway: unknown language '${v}' (${Object.keys(TRACK_LANGUAGES).join(', ')}, or a card written out)`);
    return { id: v, ...TRACK_LANGUAGES[v] };
  }
  if (typeof v !== 'object' || !v.materials || !v.parts) throw new Error('roadway: a language is an id or a card { reads, suits, materials, parts }');
  return { id: v.id ?? 'written', ...v };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
}
const mean = (ps) => ps.reduce((s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length], [0, 0, 0]);
// a face with its true normal turned to `hint` (a direction it must face)
function facing(corners, hint, M, part) {
  let n = newell(corners);
  if (dot(n, hint) < 0) n = n.map((v) => -v);
  return { corners, hex: M.hex, normal: n, gloss: FINISHES[M.finish] ?? 0, part };
}
const matOf = (card, id) => { const M = card.materials[id]; if (!M) throw new Error(`roadway: language '${card.id}' names no material '${id}'`); return M; };

/**
 * A section swept from one station to the next. `ring(st)` → the section's points there (world); closed: its last
 * point joins its first; `away`: for an open section, the direction its faces look (a closed one looks out of itself).
 */
export function sweep(ringA, ringB, M, part, { closed = true, away = null } = {}) {
  const out = [], n = ringA.length, c = mean([...ringA, ...ringB]);
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const q = [ringA[k], ringA[(k + 1) % n], ringB[(k + 1) % n], ringB[k]];
    out.push(facing(q, away ?? sub(mean(q), c), M, part));
  }
  return out;
}

const W_BEAM = [[0, 0.3], [-0.085, 0.37], [-0.085, 0.45], [0, 0.52], [-0.085, 0.59], [-0.085, 0.67], [0, 0.74], [0.03, 0.74], [0.03, 0.3]];
const TUBE_SIDES = 10;
/** The rail's section at a station: its points, `at` metres off the line on `side` (P: the track's frame). */
function railRing(R, P, st, side, at) {
  if (R.profile === 'tube') return Array.from({ length: TUBE_SIDES }, (_, k) => { const t = (k / TUBE_SIDES) * 2 * Math.PI; return P(st, side * (at + R.r * Math.cos(t)), R.z + R.r * Math.sin(t)); });
  if (R.profile === 'w-beam') return W_BEAM.map(([d, z]) => P(st, side * (at + d), z));
  throw new Error(`roadway: a rail's profile is tube or w-beam (got '${R.profile}')`);
}
/** One stretch of the rail between two stations. `tell`: the stripe's index when this stretch is round the outside of
 *  a corner (the rail wears its tell there), else null. */
export function railFaces(card, { P, A, B, side, at, tell = null }) {
  const R = card.parts.rail, M = matOf(card, tell !== null && R.tell ? R.tell[tell % 2] : R.material);
  return sweep(railRing(R, P, A, side, at), railRing(R, P, B, side, at), M, 'rail');
}
/** A post under the rail at a station, and its cap. */
export function postFaces(card, { P, st, side, at }) {
  const R = card.parts.rail, Q = R.post, out = [];
  if (!Q) return out;
  const M = matOf(card, Q.material), round = Q.profile === 'round', n = round ? 10 : 4, top = R.profile === 'tube' ? R.z : 0.72;
  const off = R.profile === 'w-beam' ? at + 0.03 + Q.r : at, base = P(st, side * off, 0);
  const ring = (r, z, turn = 0) => Array.from({ length: n }, (_, k) => { const t = ((k + turn) / n) * 2 * Math.PI; return [base[0] + r * Math.cos(t), base[1] + r * Math.sin(t), base[2] + z]; });
  const turn = round ? 0 : 0.5, lo = ring(Q.r, -0.15, turn), hi = ring(Q.r, top, turn);
  for (let k = 0; k < n; k++) { const q = [lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k]]; out.push(facing(q, sub(mean(q), [base[0], base[1], mean(q)[2]]), M, 'post')); }
  if (!Q.cap) { out.push(facing(hi, [0, 0, 1], M, 'post')); return out; }
  // the cap: a ball over the rail, three rings and a crown
  const C = matOf(card, Q.cap.material), cz = top + (R.r ?? 0) + Q.cap.r * 0.55, centre = [base[0], base[1], base[2] + cz];
  const lat = [-0.7, -0.15, 0.4, 0.95].map((f) => ring(Q.cap.r * Math.cos(f), cz + Q.cap.r * Math.sin(f)));
  for (let i = 0; i < lat.length - 1; i++) for (let k = 0; k < n; k++) { const q = [lat[i][k], lat[i][(k + 1) % n], lat[i + 1][(k + 1) % n], lat[i + 1][k]]; out.push(facing(q, sub(mean(q), centre), C, 'cap')); }
  const crown = [base[0], base[1], base[2] + cz + Q.cap.r], last = lat[lat.length - 1];
  for (let k = 0; k < n; k++) { const q = [last[k], last[(k + 1) % n], crown]; out.push(facing(q, sub(mean(q), centre), C, 'cap')); }
  out.push(facing(lat[0].slice().reverse(), [0, 0, -1], C, 'cap'));
  return out;
}
// a pillow: a rounded rise from `from` to `to` (offsets off the line), `h` high in its middle
const pillow = (P, st, side, from, to, h, n = 5) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return P(st, side * (from + (to - from) * t), 0.012 + h * Math.pow(Math.sin(Math.PI * t), 0.6)); });
/** One stretch of the corner's kerb, in the stripe `stripe` (its two materials by turns). */
export function kerbFaces(card, { P, A, B, side, from, to, stripe }) {
  const K = card.parts.kerb, M = matOf(card, K.materials[stripe % 2]);
  return sweep(pillow(P, A, side, from, to, K.h), pillow(P, B, side, from, to, K.h), M, 'kerb', { closed: false, away: [0, 0, 1] });
}
/** One stretch of the way's edge bead, its outer side at `to`. */
export function edgeFaces(card, { P, A, B, side, to }) {
  const E = card.parts.edge, M = matOf(card, E.material);
  return sweep(pillow(P, A, side, to - E.w, to, E.h, 4), pillow(P, B, side, to - E.w, to, E.h, 4), M, 'edge', { closed: false, away: [0, 0, 1] });
}

const lightness = (hex) => rgbToOklab(hexToRgb(hex))[0];
export function languageLaws(card, { cls = null, drawn = null } = {}) {
  const laws = [], say = (law, detail) => laws.push({ law, detail });
  const M = card.materials ?? {}, parts = card.parts ?? {}, ids = Object.keys(M), R = parts.rail;
  if (typeof card.reads !== 'string' || card.reads.trim().length < 20) say('premise', 'the language does not say what the track is made of');
  if (ids.length > FAMILY_MAX) say('family', `${ids.length} materials (at most ${FAMILY_MAX}): a family is small`);
  const named = [parts.way?.material, parts.edge?.material, ...(parts.kerb?.materials ?? []), R?.material, ...(R?.tell ?? []), R?.post?.material, R?.post?.cap?.material].filter((x) => x !== undefined);
  for (const id of new Set(named)) if (!M[id]) say('family', `a part names '${id}', which the family does not hold`);
  for (const id of ids) if (!named.includes(id)) say('family', `'${id}' is in the family and no part wears it`);
  if (R && R.post && M[R.material] && M[R.post.material] && M[R.material].of !== M[R.post.material].of) say('one-metal', `the rail is ${M[R.material].of} and its post ${M[R.post.material].of}`);
  const hard = new Set(ids.filter((id) => named.includes(id) && id !== parts.way?.material).map((id) => M[id].finish));
  if (hard.size > 2) say('finish', `${hard.size} finishes on its hard parts (${[...hard].join(', ')}): two at most`);
  const K = parts.kerb?.materials;
  if (K && M[K[0]] && M[K[1]]) {
    const a = lightness(M[K[0]].hex), b = lightness(M[K[1]].hex), way = M[parts.way?.material] ? lightness(M[parts.way.material].hex) : null;
    if (Math.abs(a - b) < 0.18) say('kerb-read', `the kerb's two colours are ${Math.abs(a - b).toFixed(2)} apart in lightness (0.18)`);
    if (way !== null && Math.min(Math.abs(a - way), Math.abs(b - way)) < 0.04) say('kerb-read', 'one of the kerb\'s colours is the way\'s lightness: the kerb is lost on it');
  }
  if (R?.tell && R.tell.includes(R.material)) say('tell', 'the rail\'s tell wears the rail\'s own colour: a corner is not told');
  if (cls && Array.isArray(card.suits) && !card.suits.includes(cls)) say('suits', `'${card.id}' suits ${card.suits.join(', ')}; this is a ${cls}`);
  if (drawn) { const own = new Set(ids.map((id) => M[id].hex.toLowerCase())); const odd = [...new Set(drawn)].filter((h) => !own.has(h.toLowerCase())); if (odd.length) say('drawn', `${odd.length} colour(s) drawn that the family does not hold (${odd.slice(0, 3).join(', ')})`); }
  return laws;
}
