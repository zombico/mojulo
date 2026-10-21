/**
 * THE CITY DRESSED — a gritty cube's city (its `paint.geocube` at grit from GRIT_PIXELS) painted from relief, as its
 * island's rock and its town's walls are: the wall a facade's windows are cut through (a card's shirt in the punched,
 * pier and banded rhythms) a lime render broken to the stone under it, ashlar, or a weathered coat; its sidewalks and
 * plazas in worn slabs. A curtain wall's glass and mullions, the windows themselves and the roads are as they were.
 *
 *   cityDressOf(P, unit)          → { walls: { <rhythm>: dress }, ground: { <group>: dress } } or null (a quiet cube)
 *   dressCity(faces, P, unit)     → { faces, textures } the faces dressed (a card carries its wall's `dress` for the
 *                                   realizer, architecture/facade-card.js; a sidewalk's laid here), and the tiles they use
 *
 * Each `dress` is { keys: [a, b], metres, unit }: matte-paint/detail.js lays it world-locked, in metres, on the city's
 * units. Absent grit, the city is as it was, byte for byte.
 */
import { detailKey, layDetail } from '../../matte-paint/detail.js';
import { normalizeTileSpec } from '../../era/tile-specs.js';
import { GRIT_PIXELS } from '../../matte-paint/fabric.js';
import { surfaceTexture } from '../../landscape/surface-textures.js';

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const entry = (spec, metres, unit) => { const { seed = 1, ...params } = normalizeTileSpec(spec, 'city dress').params; return { keys: [0, 1].map((v) => detailKey(params, seed, metres, v)), metres, unit }; };

/** A gritty cube's city dress, in the cube's stone and trim (a city's frames lean to its trim: city/plan/look.js). */
export function cityDressOf(P, unit) {
  const cube = P?.cube, g = cube?.grit;
  if (g === undefined || g < GRIT_PIXELS) return null;
  const stone = rgbOf(cube.colour.stone), mortar = stone.map((v) => Math.round(v * 0.68)), coat = rgbOf(cube.colour.trim), wear = { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 };
  const loss = Math.round(Math.min(1, 0.1 + 0.6 * g) * 100) / 100;
  const flags = entry({ gen: 'dressed', face: 'floor', stone: rgbOf(cube.colour.floor), mortar, rows: 3, cols: 3, tool: 'none', ...wear, seed: 61 }, 1.8, unit);
  return {
    walls: {
      punched: entry({ gen: 'dressed', cut: 'render', stone, mortar, render: coat, rows: 6, cols: 2, ...wear, loss, seed: 67 }, 3, unit),
      pier: entry({ gen: 'dressed', stone, mortar, rows: 5, cols: 2, tool: g >= 0.85 ? 'pitched' : 'tooled', ...wear, seed: 71 }, 2.4, unit),
      // (a banded facade's floors a coat that has weathered rather than fallen: little of it lost)
      banded: entry({ gen: 'dressed', cut: 'render', stone, mortar, render: coat, rows: 6, cols: 2, ...wear, loss: Math.round(loss * 30) / 100, seed: 73 }, 3, unit),
    },
    ground: { 'city:walk': flags, 'city:plaza': flags },
  };
}

/** The city's faces under a gritty cube's dress, and the tiles they use (a card's facets are realized on the page). */
export function dressCity(faces, P, unit) {
  const D = cityDressOf(P, unit);
  if (!D) return null;
  const used = new Set(), at = (f) => { const c = f.corners[0]; return Math.floor(Math.abs(c[0] * 0.37 + c[1] * 0.61 + c[2] * 0.13)) % 2; };
  const out = faces.map((f) => {
    if (f.card && D.walls[f.card.rhythm] && f.card.material !== 'metal') { const E = D.walls[f.card.rhythm]; E.keys.forEach((k) => used.add(k)); return { ...f, card: { ...f.card, dress: E } }; }
    const E = D.ground[f.group];
    if (E && f.corners) { const d = layDetail(f, { key: E.keys[at(f)], metres: E.metres, unit, as: 'floor' }); if (d.texture) used.add(d.texture); return d; }
    return f;
  });
  return { faces: out, textures: Object.fromEntries([...used].sort().map((k) => [k, surfaceTexture(k)])) };
}
