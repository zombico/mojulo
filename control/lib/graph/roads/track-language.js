/**
 * A TRACK'S DESIGN LANGUAGE — what a track is made of and how its parts are shaped, said once, so the way, its edge,
 * its kerb, its rail and the posts the rail stands on are one family and not a road, a wall and a toy from three
 * places. A language is a card: a small family of MATERIALS (what it is, how it finishes, its colour) and the PARTS
 * drawn in them, each with a profile (the section swept along the track). The track (track.js) draws its parts from
 * the card it is given (`language`); with none it draws its class's template as it always has.
 *
 *   material  { of, finish, hex }   of: what it is (plastic, fondant, steel …); finish: gloss | satin | matte
 *   parts     way    { material } | { from: 'kit' } (the look's own asphalt, its wear and its repairs)
 *                    a way of its own material may be laid in BANDS (`bands: { every, material }`: its second tone by
 *                    turns, so the way is seen to move) and carry a centre DASH (`dash: { every, len, w, material }`)
 *                    and CHEVRONS (`chevrons: { before: [m…], w, len, t, materials }`): arrows on the way before a
 *                    corner, pointing into it, laid on the OUTSIDE half (where the corner is come at from)
 *             bunting { min, every, h, sag, flags, drop, pole, materials }: a line of pennants on tall poles along a
 *                    straight of `min` metres or more, down ONE side (the side by turns, straight to straight)
 *             tree   { profile: 'lollipop', blossom?: { share, materials } }: the land's trees built as the track is
 *                    (a stout trunk, a crown of balls set off-centre), a share of them in blossom
 *             pieces { blocks?: { <set piece>: <its stand-in> }, paint?: { <surface group>: <material> } }: the
 *                    trackside pieces (set-pieces.js) made as the track is: a block stood in for another (with the
 *                    same params, sized in its slot alike), and every surface group in the family's materials
 *             city   { sidewalk, margin, paving, crossing, zebra, lamps, facades, heights, split?, tunnel?, blocks, kit }: a street
 *                    circuit's town (street-frontage.js): fronts down each straight's sides in the facades' colours by
 *                    turns, tall toward the middle; the sidewalks paved, lamps and signals, zebras across the way
 *             mine   { galleries, bore, rock, timber, lantern, sets, gems, line, carts, board, yard }: a mine the track runs
 *                    through (mine.js): galleries bored under a hill of the rock, timber sets, lanterns, glowing gems, a
 *                    cart line and its carts, a yard with a headframe
 *             verge  { material?, mown: { every, lift } }: the run-off mown in stripes across the way (the look's own grass, a
 *                    stripe lighter by `lift`), so the sides are seen to move too
 *             edge   { profile: 'bead', w, h, material } | { from: 'kit' } (a painted line)
 *             kerb   { profile: 'pillow', h, materials: [a, b] } | { from: 'kit' } (flat paint), on the corners
 *             rail   { profile: 'tube', r, z, material, tell?: [a, b], post } | { profile: 'w-beam', material, post }
 *                    tell: the two materials the rail wears in stripes round the OUTSIDE of a corner, so a corner is
 *                    told by the rail before the kerb is reached
 *             post   { profile: 'round' | 'i', r, every, material, cap?: { r, material } } (inside `rail`)
 *
 * A language may say its SKY (`sky: { zenith, horizon, sun?, puffs? }`): the track's own day, and `puffs`, clouds built
 * as the track is (rounded chunks, `puffFaces`), where the drawing is the chunky one.
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
      icing: { of: 'fondant', finish: 'matte', hex: '#8d88bb' },
      cream: { of: 'plastic', finish: 'gloss', hex: '#fff3e2' },
      berry: { of: 'plastic', finish: 'gloss', hex: '#ff4f86' },
      sky: { of: 'plastic', finish: 'gloss', hex: '#35b4ff' },
      lemon: { of: 'plastic', finish: 'gloss', hex: '#ffd03a' },
    }),
    parts: Object.freeze({
      way: { material: 'fondant', bands: { every: 8, material: 'icing' }, dash: { every: 8, len: 3, w: 0.28, material: 'cream' },
        chevrons: { before: [12, 26, 40], w: 3.1, len: 8, t: 2.2, materials: ['berry', 'cream'] } },
      verge: { mown: { every: 4, lift: 1.1 } },
      bunting: { min: 34, every: 16, h: 4.6, sag: 0.9, flags: 9, drop: 0.85, pole: { r: 0.11, material: 'cream', cap: { r: 0.26, material: 'lemon' } }, materials: ['berry', 'lemon', 'sky', 'cream'] },
      tree: { profile: 'lollipop', blossom: { share: 0.16, materials: ['berry', 'lemon'] } },
      pieces: {
        blocks: { arch: 'hoop-arch', 'marker-board': 'lolly-board', 'castle-tower': 'candy-tower', castle: 'candy-castle', bumper: 'candy-bumper' },
        paint: { 'tech:body': 'cream', 'tech:skin': 'cream', 'str:plaster': 'cream', 'tech:frame': 'cream', 'tech:trim': 'berry', 'tech:glass': 'sky', 'tech:cable': 'sky', 'tech:light': 'lemon', 'str:accent': 'lemon', 'str:stone': 'cream' },
      },
      edge: { profile: 'bead', w: 0.34, h: 0.08, material: 'cream' },
      kerb: { profile: 'pillow', h: 0.17, materials: ['berry', 'cream'] },
      rail: { profile: 'tube', r: 0.33, z: 0.6, material: 'sky', tell: ['berry', 'cream'],
        post: { profile: 'round', r: 0.24, every: 4, material: 'cream', cap: { r: 0.4, material: 'lemon' } } },
    }),
    sky: Object.freeze({ zenith: [52, 128, 232], horizon: [198, 234, 255], sun: { u: 0.3, h: 0.5 }, puffs: { count: 28, hex: '#ffffff', alt: [45, 140], size: [20, 46] } }),
  }),
  'candy-city': Object.freeze({
    reads: 'a toy town\'s streets closed for a race: the candy track laid between rows of toy shops, flats and towers in the family\'s colours, sugar-pink sidewalks, lollipop lamps, signals of three balls, zebras across the way',
    suits: Object.freeze(['kart']),
    materials: Object.freeze({
      fondant: { of: 'fondant', finish: 'matte', hex: '#7f7aae' },
      icing: { of: 'fondant', finish: 'matte', hex: '#8d88bb' },
      sugar: { of: 'fondant', finish: 'matte', hex: '#f1d9e2' },
      cream: { of: 'plastic', finish: 'gloss', hex: '#fff3e2' },
      berry: { of: 'plastic', finish: 'gloss', hex: '#ff4f86' },
      sky: { of: 'plastic', finish: 'gloss', hex: '#35b4ff' },
      lemon: { of: 'plastic', finish: 'gloss', hex: '#ffd03a' },
    }),
    parts: Object.freeze({
      way: { material: 'fondant', bands: { every: 8, material: 'icing' }, dash: { every: 8, len: 3, w: 0.28, material: 'cream' },
        chevrons: { before: [12, 26, 40], w: 3.1, len: 8, t: 2.2, materials: ['berry', 'cream'] } },
      edge: { profile: 'bead', w: 0.34, h: 0.08, material: 'cream' },
      kerb: { profile: 'pillow', h: 0.17, materials: ['berry', 'cream'] },
      rail: { profile: 'tube', r: 0.33, z: 0.6, material: 'sky', tell: ['berry', 'cream'],
        post: { profile: 'round', r: 0.24, every: 4, material: 'cream', cap: { r: 0.4, material: 'lemon' } } },
      bunting: { min: 34, every: 16, h: 4.6, sag: 0.9, flags: 9, drop: 0.85, pole: { r: 0.11, material: 'cream', cap: { r: 0.26, material: 'lemon' } }, materials: ['berry', 'lemon', 'sky', 'cream'] },
      tree: { profile: 'lollipop', blossom: { share: 0.16, materials: ['berry', 'lemon'] } },
      pieces: {
        blocks: { arch: 'hoop-arch', 'marker-board': 'lolly-board', 'castle-tower': 'candy-tower', castle: 'candy-castle', bumper: 'candy-bumper', 'tower-block': 'toy-tower' },
        paint: { 'tech:body': 'cream', 'tech:skin': 'cream', 'str:plaster': 'cream', 'tech:frame': 'cream', 'tech:trim': 'berry', 'tech:glass': 'sky', 'tech:cable': 'sky', 'tech:light': 'lemon', 'str:accent': 'lemon', 'str:stone': 'cream' },
      },
      city: { sidewalk: 4, margin: 14, paving: 'sugar', crossing: 'cream', zebra: 5, lamps: 22, facades: ['cream', 'icing', 'lemon', 'sky', 'berry'],
        heights: { core: 34, edge: 7, flat: 10, tower: 27 }, split: { cut: 30, surface: 'cobbles', cobbles: ['sugar', 'icing'], pads: { at: [0.1, 0.55], len: 5, seconds: 1.6, material: 'lemon', arrows: 'berry' } }, tunnel: { length: 26, block: 'toy-tunnel' }, blocks: { shop: 'toy-shop', flat: 'toy-flat', tower: 'toy-tower' }, kit: { lamp: 'candy-lamp', signal: 'toy-signal' } },
    }),
    sky: Object.freeze({ zenith: [52, 128, 232], horizon: [198, 234, 255], sun: { u: 0.3, h: 0.5 }, puffs: { count: 28, hex: '#ffffff', alt: [45, 140], size: [20, 46] } }),
  }),
  'candy-mine': Object.freeze({
    reads: 'a gem mine inside a chocolate mountain: the candy track run round one great cavern of cocoa rock and through its galleries under biscuit timber, lanterns warm in the dark, berry and lemon gems glowing on its walls and floor, carts heaped with them on a narrow-gauge line, a shaft of day over the headframe',
    suits: Object.freeze(['kart']),
    materials: Object.freeze({
      fondant: { of: 'fondant', finish: 'matte', hex: '#7f7aae' },
      icing: { of: 'fondant', finish: 'matte', hex: '#8d88bb' },
      cocoa: { of: 'rock', finish: 'matte', hex: '#7a4f4a' },
      biscuit: { of: 'timber', finish: 'matte', hex: '#e2a35e' },
      cream: { of: 'plastic', finish: 'gloss', hex: '#fff3e2' },
      berry: { of: 'plastic', finish: 'gloss', hex: '#ff4f86' },
      lemon: { of: 'plastic', finish: 'gloss', hex: '#ffd03a' },
    }),
    parts: Object.freeze({
      way: { material: 'fondant', bands: { every: 8, material: 'icing' }, dash: { every: 8, len: 3, w: 0.28, material: 'cream' },
        chevrons: { before: [12, 26, 40], w: 3.1, len: 8, t: 2.2, materials: ['berry', 'cream'] } },
      verge: { material: 'cocoa', mown: { every: 4, lift: 1.22 } },
      bunting: { min: 34, every: 16, h: 4.6, sag: 0.9, flags: 9, drop: 0.85, pole: { r: 0.11, material: 'biscuit', cap: { r: 0.26, material: 'lemon' } }, materials: ['berry', 'lemon', 'cream'] },
      tree: { profile: 'lollipop', blossom: { share: 0.16, materials: ['berry', 'lemon'] } },
      pieces: {
        blocks: { arch: 'hoop-arch', 'marker-board': 'lolly-board', 'castle-tower': 'candy-tower', castle: 'candy-castle', bumper: 'candy-bumper' },
        paint: { 'tech:body': 'cream', 'tech:skin': 'cream', 'str:plaster': 'cream', 'tech:frame': 'biscuit', 'tech:trim': 'berry', 'tech:glass': 'lemon', 'tech:cable': 'cocoa', 'tech:light': 'lemon', 'str:accent': 'lemon', 'str:stone': 'cocoa' },
      },
      edge: { profile: 'bead', w: 0.34, h: 0.08, material: 'cream' },
      kerb: { profile: 'pillow', h: 0.17, materials: ['berry', 'cream'] },
      rail: { profile: 'tube', r: 0.33, z: 0.6, material: 'biscuit', tell: ['berry', 'cream'],
        post: { profile: 'round', r: 0.24, every: 4, material: 'biscuit', cap: { r: 0.4, material: 'lemon' } } },
      mine: { galleries: [{ share: 0.24, least: 40, most: 180 }, { share: 0.1, least: 26, most: 60 }], clearStart: 45, apart: 40, dark: 0.22, depth: 9,
        bore: { ledge: 2.4, flank: 10, spring: 3.6, crown: 7.4, cover: 4.5, lump: 0.7, round: 4, step: 2, peak: 0.45, frost: 0, lean: 9, boulders: 9 },
        rock: 'cocoa', floor: 'biscuit', timber: 'biscuit', lantern: 'lemon', sets: { every: 8, r: 0.3 }, lanterns: { off: 5.5, drop: 0.9, r: 0.42, gain: 1.4 },
        gems: { share: 0.85, colours: ['berry', 'lemon', 'cream'], glow: 0.6, size: 1.7 }, line: { gauge: 0.9, rail: 'cream' }, carts: { inside: 2, body: 'berry', rim: 'cream' },
        board: { w: 6, h: 1.4, material: 'lemon', edge: 'berry' }, yard: { back: 16, off: 12, r: 14, headframe: 13, wheel: 2.2, wheelMaterial: 'berry' },
        cavern: { margin: 38, wall: 16, crown: 40, segs: 64, rings: 9, lump: 2.6, floor: 'biscuit', skylight: { r: 11, strength: 3.2 }, dark: 0.2,
          stalactites: 70, stalagmites: 44, posts: { every: 18, h: 5.4, arm: 3.2, gain: 2.2 }, crystals: { count: 34, size: 2.4, glow: 1.8 }, haze: '#2b1a1c' } },
    }),
    sky: Object.freeze({ zenith: [52, 128, 232], horizon: [198, 234, 255], sun: { u: 0.3, h: 0.5 } }),
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

// a ball of `seg` sides, flattened by `squash`, each face looking out of it
function ballFaces(c, r, M, part, { seg = 8, squash = 1 } = {}) {
  const out = [], F = [-0.8, -0.35, 0.15, 0.6, 0.92];
  const ring = (f) => Array.from({ length: seg }, (_, k) => { const t = (k / seg) * 2 * Math.PI, q = Math.cos(Math.asin(f)); return [c[0] + r * q * Math.cos(t), c[1] + r * q * Math.sin(t), c[2] + r * f * squash]; });
  const L = F.map(ring), top = [c[0], c[1], c[2] + r * squash], bot = [c[0], c[1], c[2] - r * squash];
  for (let i = 0; i < L.length - 1; i++) for (let k = 0; k < seg; k++) { const q = [L[i][k], L[i][(k + 1) % seg], L[i + 1][(k + 1) % seg], L[i + 1][k]]; out.push(facing(q, sub(mean(q), c), M, part)); }
  for (let k = 0; k < seg; k++) { const a = [L[L.length - 1][k], L[L.length - 1][(k + 1) % seg], top], b = [L[0][(k + 1) % seg], L[0][k], bot]; out.push(facing(a, sub(mean(a), c), M, part), facing(b, sub(mean(b), c), M, part)); }
  return out;
}
// a round pole standing on `base`, `h` high, and the ball on its head
function poleFaces(base, Q, h, M, C, part) {
  const out = [], n = 7, ring = (z) => Array.from({ length: n }, (_, k) => { const t = (k / n) * 2 * Math.PI; return [base[0] + Q.r * Math.cos(t), base[1] + Q.r * Math.sin(t), base[2] + z]; }), lo = ring(-0.2), hi = ring(h);
  for (let k = 0; k < n; k++) { const q = [lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k]]; out.push(facing(q, sub(mean(q), [base[0], base[1], mean(q)[2]]), M, part)); }
  if (C) out.push(...ballFaces([base[0], base[1], base[2] + h + Q.cap.r * 0.6], Q.cap.r, C, 'cap', { seg: 8 }));
  return out;
}

/**
 * A BOOST PAD on the way: a glossy plate `len` long and `w` wide, its middle at `s`, with three arrows on it pointing
 * on (the way's own direction). `point(s, off, dz)`: the way's frame. → raw faces.
 */
export function padFaces(card, { point, s, len, w, materials }) {
  const P0 = matOf(card, materials[0]), A = matOf(card, materials[1]), out = [], h = w / 2, N = 4;
  for (let i = 0; i < N; i++) {
    const a = s - len / 2 + (len * i) / N, b = s - len / 2 + (len * (i + 1)) / N;
    out.push({ corners: [point(a, -h, 0.05), point(a, h, 0.05), point(b, h, 0.05), point(b, -h, 0.05)], hex: P0.hex, normal: [0, 0, 1], gloss: FINISHES[P0.finish] ?? 0, part: 'pad' });
  }
  for (let k = 0; k < 3; k++) {
    const tip = s - len / 2 + len * (0.3 + 0.27 * k), back = tip - len * 0.22, t = 0.32;
    for (const sd of [1, -1]) out.push({ corners: [point(back, sd * h * 0.7, 0.07), point(back + t, sd * h * 0.7, 0.07), point(tip + t, 0, 0.07), point(tip, 0, 0.07)].map((p) => p), hex: A.hex, normal: [0, 0, 1], gloss: FINISHES[A.finish] ?? 0, part: 'pad' });
  }
  return out;
}

/**
 * One CHEVRON on the way: an arrow lying across it, pointing to `d` (+1 left, −1 right), its middle at `s` metres along
 * and `c` metres off the line. `point(s, off, dz)`: the track's frame along the line. → { corners, hex }[] (flat paint).
 */
export function chevronFaces(card, { point, s, c, d, index = 0 }) {
  const V = card.parts.way.chevrons, M = matOf(card, V.materials[index % V.materials.length]), z = 0.03, h = V.w / 2, L = V.len / 2;
  const tail = c - d * h, tip = c + d * h;
  // each arm in pieces, so it lies on a way that banks and bends under it
  const out = [], N = 4, lerp = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  for (const [a0, a1] of [[s - L, s - L + V.t], [s + L - V.t, s + L]]) for (let i = 0; i < N; i++) {
    const A = [lerp([a0, tail], [s - V.t / 2, tip], i / N), lerp([a1, tail], [s + V.t / 2, tip], i / N)], B = [lerp([a0, tail], [s - V.t / 2, tip], (i + 1) / N), lerp([a1, tail], [s + V.t / 2, tip], (i + 1) / N)];
    out.push({ corners: [point(A[0][0], A[0][1], z), point(A[1][0], A[1][1], z), point(B[1][0], B[1][1], z), point(B[0][0], B[0][1], z)], hex: M.hex });
  }
  return out;
}

/**
 * BUNTING along one side of a straight from `s0` to `s1`: poles every `every` metres, `off` metres off the line, a
 * sagging line of pennants between each pair, their colours by turns. → raw faces.
 */
export function buntingFaces(card, { point, s0, s1, off }) {
  const B = card.parts.bunting, out = [], P0 = matOf(card, B.pole.material), C0 = B.pole.cap ? matOf(card, B.pole.cap.material) : null;
  const n = Math.floor((s1 - s0 - 8) / B.every);
  if (n < 1) return out;
  const lead = (s1 - s0 - n * B.every) / 2;
  let flag = 0;
  for (let j = 0; j <= n; j++) {
    const s = s0 + lead + j * B.every;
    out.push(...poleFaces(point(s, off, 0), B.pole, B.h, P0, C0, 'pole'));
    if (j === n) break;
    const at = (u) => point(s + u * B.every, off, B.h - B.sag * 4 * u * (1 - u));
    for (let k = 0; k < B.flags; k++, flag++) {
      const u0 = (k + 0.12) / B.flags, u1 = (k + 0.88) / B.flags, a = at(u0), b = at(u1), m = at((u0 + u1) / 2), M = matOf(card, B.materials[flag % B.materials.length]);
      // a pennant hangs in the plane of its line: it looks across the way
      const along = sub(b, a), across = [-along[1], along[0], 0];
      out.push(facing([a, b, [m[0], m[1], m[2] - B.drop]], across, M, 'bunting'));
    }
  }
  return out;
}

/**
 * A TREE as the track is built: a stout trunk and a crown of balls, the lobes set off-centre (no two alike, none
 * symmetric). `leaf`: the land's greens (three hexes, dark to light), `bark` its trunk's; a share in blossom wears
 * the language's own colours, paled. → raw faces.
 */
export function treeFaces(card, { at, h, rnd, leaf, bark }) {
  const T = card.parts.tree, out = [], r = h * (0.27 + 0.07 * rnd()), top = h * 0.42;
  const pale = (hex) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.72 + 255 * 0.28).toString(16).padStart(2, '0')).join('')}`;
  const bloom = T.blossom && rnd() < T.blossom.share ? pale(matOf(card, T.blossom.materials[Math.floor(rnd() * T.blossom.materials.length)]).hex) : null;
  const tone = (i) => ({ hex: bloom ?? leaf[i], finish: 'matte' });
  out.push(...poleFaces(at, { r: h * 0.055 }, top + r * 0.3, { hex: bark, finish: 'matte' }, null, 'trunk'));
  const c = [at[0], at[1], at[2] + top + r * 0.75];
  out.push(...ballFaces(c, r, tone(1), 'crown', { squash: 0.9 }));
  const lobes = 1 + Math.floor(rnd() * 2.4), t0 = rnd() * 2 * Math.PI;
  for (let i = 0; i < lobes; i++) {
    const t = t0 + i * (1.9 + rnd() * 0.9), rr = r * (0.58 + 0.24 * rnd()), d = r * (0.62 + 0.2 * rnd());
    out.push(...ballFaces([c[0] + d * Math.cos(t), c[1] + d * Math.sin(t), c[2] - r * (0.15 + 0.3 * rnd()) + (i === 1 ? r * 0.5 : 0)], rr, tone(i === 0 ? 2 : 0), 'crown', { squash: 0.9 }));
  }
  return out;
}

/**
 * The sky's PUFFS: clouds as rounded chunks, each a few flattened balls in a row, standing in a ring round `centre`
 * between `reach` and three times it, at the card's heights and sizes. `rnd`: the track's seeded dice.
 */
export function puffFaces(card, { centre, reach, rnd }) {
  const S = card.sky?.puffs, out = [];
  if (!S) return out;
  const M = { hex: S.hex, finish: 'matte' }, SEG = 8, RINGS = [-0.35, 0.15, 0.6, 0.92];
  const ball = (c, r) => {
    const ring = (f) => Array.from({ length: SEG }, (_, k) => { const t = (k / SEG) * 2 * Math.PI, q = Math.asin(f); return [c[0] + r * Math.cos(q) * Math.cos(t), c[1] + r * Math.cos(q) * Math.sin(t), c[2] + r * f * (f < 0 ? 0.5 : 0.8)]; });
    const L = RINGS.map(ring), top = [c[0], c[1], c[2] + r * 0.8];
    for (let i = 0; i < L.length - 1; i++) for (let k = 0; k < SEG; k++) { const q = [L[i][k], L[i][(k + 1) % SEG], L[i + 1][(k + 1) % SEG], L[i + 1][k]]; out.push(facing(q, sub(mean(q), c), M, 'puff')); }
    for (let k = 0; k < SEG; k++) { const q = [L[L.length - 1][k], L[L.length - 1][(k + 1) % SEG], top]; out.push(facing(q, sub(mean(q), c), M, 'puff')); }
    out.push(facing(L[0].slice().reverse(), [0, 0, -1], M, 'puff'));
  };
  for (let i = 0; i < S.count; i++) {
    const t = ((i + rnd() * 0.7) / S.count) * 2 * Math.PI, d = reach * (1 + 2 * rnd()), size = S.size[0] + (S.size[1] - S.size[0]) * rnd(), alt = S.alt[0] + (S.alt[1] - S.alt[0]) * rnd() + d * 0.12;
    const c = [centre[0] + d * Math.cos(t), centre[1] + d * Math.sin(t), centre[2] + alt], along = [-Math.sin(t), Math.cos(t)], n = 3 + Math.floor(rnd() * 3);
    for (let b = 0; b < n; b++) { const u = (b - (n - 1) / 2) * size * 0.62, r = size * (0.5 + 0.28 * Math.sin((Math.PI * (b + 0.5)) / n) + 0.08 * rnd()); ball([c[0] + along[0] * u, c[1] + along[1] * u, c[2] + (r - size * 0.5) * 0.3], r); }
  }
  return out;
}

const lightness = (hex) => rgbToOklab(hexToRgb(hex))[0];
export function languageLaws(card, { cls = null, drawn = null } = {}) {
  const laws = [], say = (law, detail) => laws.push({ law, detail });
  const M = card.materials ?? {}, parts = card.parts ?? {}, ids = Object.keys(M), R = parts.rail;
  if (typeof card.reads !== 'string' || card.reads.trim().length < 20) say('premise', 'the language does not say what the track is made of');
  if (ids.length > FAMILY_MAX) say('family', `${ids.length} materials (at most ${FAMILY_MAX}): a family is small`);
  const C = parts.city, MN = parts.mine;
  const named = [parts.way?.material, parts.way?.bands?.material, parts.way?.dash?.material, ...(parts.way?.chevrons?.materials ?? []), ...(parts.bunting?.materials ?? []), parts.bunting?.pole?.material, parts.bunting?.pole?.cap?.material, ...(parts.tree?.blossom?.materials ?? []), ...Object.values(parts.pieces?.paint ?? {}), ...(C ? [C.paving, C.crossing, ...C.facades, ...(C.split?.pads ? [C.split.pads.material, C.split.pads.arrows] : []), ...(C.split?.cobbles ?? [])] : []), ...(MN ? [MN.rock, MN.frost, MN.floor, MN.cavern?.floor, parts.verge?.material, MN.timber, MN.lantern, MN.line?.rail, MN.board?.material, MN.board?.edge, MN.carts?.body, MN.carts?.rim, MN.yard?.wheelMaterial, ...(MN.gems?.colours ?? [])] : []), parts.edge?.material, ...(parts.kerb?.materials ?? []), R?.material, ...(R?.tell ?? []), R?.post?.material, R?.post?.cap?.material].filter((x) => x !== undefined);
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
