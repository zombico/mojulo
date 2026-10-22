/**
 * THE CITY DRESSED — a gen-7 cube's city (its `paint.geocube`, era/cube-generation.js) painted from relief, as its
 * island's rock and its town's walls are, in the class of materials its builders had: a city is MODERN by default
 * (machine-made and cement-bound: wire-cut brick or stucco where windows are punched through a wall, sawn stone or
 * precast panels between piers, precast or board-formed concrete in bands, a concrete sidewalk scored into slabs, each
 * in its material's own colour leant to the cube's), an old one ANCIENT (`paint.materials`; hand-worked and lime-bound:
 * a lime render broken to its stone, tooled ashlar, a weathered coat, worn flags, a road of setts, in the cube's
 * colours). A curtain wall's glass and mullions and the windows themselves are as they were.
 *
 *   MATERIAL_CLASSES              'ancient', 'modern'
 *   cityDressOf(P, unit)          → { class, walls: { <rhythm>: [dress…] }, ground: { <group>: dress } } or null; in
 *                                   a paint's `style` (era/arch-style.js) its words for its rhythms and its ground over
 *                                   its class's, a quiet cube's city taking their colours without the relief
 *   dressCity(faces, P, unit)     → { faces, textures } the faces dressed (a card carries its wall's `dress` for the
 *                                   realizer, architecture/facade-card.js; a sidewalk's laid here), and the tiles they use
 *
 * Each `dress` is { keys: [a, b], metres, unit, colour? }: matte-paint/detail.js lays it world-locked, in metres, on the
 * city's units (a colour alone leans the wall's frame or the ground, a glass word leaves the building as the city drew
 * it). Absent grit and a style, the city is as it was, byte for byte.
 */
import { detailKey, layDetail } from '../../matte-paint/detail.js';
import { normalizeTileSpec } from '../../era/tile-specs.js';
import { cubeTexture } from '../../era/cube-generation.js';
import { surfaceTexture } from '../../landscape/surface-textures.js';
import { MATERIAL_WORDS, materialContext, wordTile } from '../../era/arch-style.js';

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => hexOf(rgbOf(a).map((v, k) => v + (rgbOf(b)[k] - v) * t));
const entry = (spec, metres, unit, colour) => { const { seed = 1, ...params } = normalizeTileSpec(spec, 'city dress').params; return { keys: [0, 1].map((v) => detailKey(params, seed, metres, v)), metres, unit, ...(colour ? { colour } : {}) }; };
export const MATERIAL_CLASSES = Object.freeze(['ancient', 'modern']);
// the MODERN materials' own colours (a brick is red, concrete grey): a wall in one leans to it, the cube's tint kept a third
const MODERN_COLOUR = Object.freeze({ brick: '#9c5440', stucco: null, sawn: null, precast: '#c9c3b5', concrete: '#a9a7a1', pavement: '#b8b5ae', asphalt: '#3f3e3c' });
const CUBE_SHARE = 0.35;

/**
 * A gen-7 cube's city dress, in its class: ANCIENT (hand-worked, lime-bound: render over stone, tooled ashlar, flags)
 * or MODERN (machine-made, cement-bound: wire-cut brick, stucco, sawn stone, precast panels, board-formed concrete, a
 * concrete sidewalk), a city's by default (its paint's `materials`). Each rhythm offers one or two; a building takes
 * one by its own dice. → { class, walls: { <rhythm>: [dress…] }, ground: { <group>: dress } } or null.
 */
export function cityDressOf(P, unit) {
  const textured = P?.cube ? cubeTexture(P.cube) !== null : false;
  if (!P?.style) return textured ? classDress(P, unit, P.materials ?? 'modern') : null;
  // a style: its class's dress (on a gen-7 cube), its words over it
  const S = P.style, cls = P.materials ?? S.class, D = textured ? classDress(P, unit, cls) : { class: cls, walls: {}, ground: {} }, X = materialContext(P.cube);
  const wordOf = (w, surface, i) => {
    const T = textured ? wordTile(w, X, WORD_SEEDS[surface] + 3 * i) : null, c = S.palette[surface] ?? MATERIAL_WORDS[w].colour, colour = c ? mixHex(c, P.cube.colour.stone, CUBE_SHARE) : null;
    return T ? entry(T.spec, T.metres, unit, colour) : { ...(colour ? { colour } : {}) };
  };
  for (const r of ['punched', 'pier', 'banded', 'grid']) {
    const w = S.materials[r], c = S.palette[r];
    if (w) D.walls[r] = (Array.isArray(w) ? w : [w]).map((x, i) => wordOf(x, r, i));
    else if (c) D.walls[r] = (D.walls[r] ?? [{}]).map((e) => ({ ...e, colour: mixHex(c, P.cube.colour.stone, CUBE_SHARE) }));
  }
  for (const [surface, groups] of [['road', ['city:road']], ['walk', ['city:walk', 'city:plaza']]]) {
    const w = S.materials[surface], c = S.palette[surface];
    const E = w ? wordOf(w, surface, 0) : c ? { ...(D.ground[groups[0]] ?? {}), colour: mixHex(c, P.cube.colour.stone, CUBE_SHARE) } : null;
    if (E) for (const k of groups) D.ground[k] = E;
  }
  return D;
}
// the seeds a style's words are painted at, by surface
const WORD_SEEDS = { punched: 101, pier: 111, banded: 121, grid: 131, walk: 141, road: 151 };

// a class's own dress on a gen-7 cube
function classDress(P, unit, cls) {
  const cube = P.cube, g = cubeTexture(cube);
  const stone = rgbOf(cube.colour.stone), mortar = stone.map((v) => Math.round(v * 0.68)), coat = rgbOf(cube.colour.trim);
  const wear = { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 }, loss = Math.round(Math.min(1, 0.1 + 0.6 * g) * 100) / 100;
  if (cls === 'ancient') {
    const flags = entry({ gen: 'dressed', face: 'floor', stone: rgbOf(cube.colour.floor), mortar, rows: 3, cols: 3, tool: 'none', ...wear, seed: 61 }, 1.8, unit);
    const setts = entry({ gen: 'dressed', cut: 'setts', face: 'floor', stone: rgbOf(cube.colour.stone), mortar: rgbOf(cube.colour.floor), rows: 10, cols: 8, vary: 24, ...wear, seed: 63 }, 1.2, unit);
    return { class: cls, walls: {
      punched: [entry({ gen: 'dressed', cut: 'render', stone, mortar, render: coat, rows: 6, cols: 2, ...wear, loss, seed: 67 }, 3, unit)],
      pier: [entry({ gen: 'dressed', stone, mortar, rows: 5, cols: 2, tool: g >= 0.85 ? 'pitched' : 'tooled', ...wear, seed: 71 }, 2.4, unit)],
      // (a banded facade's floors a coat that has weathered rather than fallen: little of it lost)
      banded: [entry({ gen: 'dressed', cut: 'render', stone, mortar, render: coat, rows: 6, cols: 2, ...wear, loss: Math.round(loss * 30) / 100, seed: 73 }, 3, unit)],
    }, ground: { 'city:walk': flags, 'city:plaza': flags, 'city:road': setts } };
  }
  // the modern class: machine-made, so worn by the weather (streaks, stains, a bloom) and never by loss; its spalls none
  const tint = (name) => (MODERN_COLOUR[name] ? mixHex(MODERN_COLOUR[name], cube.colour.stone, CUBE_SHARE) : null), mw = { grit: g, spall: 0, pit: Math.round(10 * g) / 100 };
  const brick = entry({ gen: 'dressed', cut: 'brick', stone: [158, 82, 62], mortar: [176, 170, 160], rows: 16, cols: 5, vary: 14, ...mw, seed: 81 }, 1.2, unit, tint('brick'));
  const stucco = entry({ gen: 'dressed', cut: 'stucco', stone, mortar, render: coat, ...mw, seed: 83 }, 3, unit);
  const sawn = entry({ gen: 'dressed', stone, mortar, rows: 4, cols: 2, tool: 'none', joint: 0.005, recess: 0.002, chamfer: 0.003, pillow: 0.0005, vary: 10, ...mw, seed: 85 }, 2.4, unit);
  const precast = entry({ gen: 'dressed', cut: 'precast', stone: [204, 198, 186], mortar, cols: 2, rows: 1, vary: 8, ...mw, seed: 87 }, 3, unit, tint('precast'));
  const concrete = entry({ gen: 'dressed', cut: 'concrete', stone: [168, 166, 160], mortar, cols: 2, rows: 1, vary: 10, ...mw, seed: 89 }, 2.4, unit, tint('concrete'));
  const walk = entry({ gen: 'dressed', cut: 'pavement', face: 'floor', stone: [176, 174, 168], mortar, cols: 2, vary: 8, ...mw, seed: 91 }, 3, unit, tint('pavement'));
  const road = entry({ gen: 'dressed', cut: 'asphalt', face: 'floor', stone: [70, 70, 72], mortar, vary: 8, ...mw, seed: 93 }, 4, unit, tint('asphalt'));
  return { class: cls, walls: { punched: [brick, stucco], pier: [sawn, precast], banded: [precast, concrete] }, ground: { 'city:walk': walk, 'city:plaza': walk, 'city:road': road } };
}

// a building's own dice: its card's signature (its frame and body, floors and bays: a card's id is its kind's, shared),
// so a building's walls are one material and its neighbours their own
const pickOf = (f, n) => { const C = f.card, s = [C.frameHex, C.bodyHex, C.floors, C.bays].join('|'); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h % n; };

/** The city's faces under a gen-7 cube's dress, and the tiles they use (a card's facets are realized on the page). */
export function dressCity(faces, P, unit) {
  const D = cityDressOf(P, unit);
  if (!D) return null;
  const used = new Set(), at = (f) => { const c = f.corners[0]; return Math.floor(Math.abs(c[0] * 0.37 + c[1] * 0.61 + c[2] * 0.13)) % 2; };
  const out = faces.map((f) => {
    if (f.card && D.walls[f.card.rhythm] && f.card.material !== 'metal') {
      const L = D.walls[f.card.rhythm], E = L[pickOf(f, L.length)];
      // (a word with no tile and no colour, glass: the building as the city drew it)
      if (!E.keys && !E.colour) return f;
      E.keys?.forEach((k) => used.add(k));
      const { colour, ...dress } = E;
      return { ...f, card: { ...f.card, ...(colour ? { frameHex: mixHex(f.card.frameHex, colour, 1 - CUBE_SHARE) } : {}), ...(E.keys ? { dress } : {}) } };
    }
    const E = D.ground[f.group];
    if (E && f.corners) {
      const g = E.colour ? { ...f, fill: mixHex(f.fill, E.colour, 1 - CUBE_SHARE), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((c) => mixHex(c, E.colour, 1 - CUBE_SHARE)) } : {}) } : f;
      if (!E.keys) return g;
      const d = layDetail(g, { key: E.keys[at(f)], metres: E.metres, unit, as: 'floor' });
      if (d.texture) used.add(d.texture);
      return d.texture ? d : f;
    }
    return f;
  });
  return { faces: out, textures: Object.fromEntries([...used].sort().map((k) => [k, surfaceTexture(k)])) };
}
