/**
 * THE TRACK'S MATERIALS IN A KIT'S TERMS — a track drawn in its world's look (era/style: a kit's ramps and its pole),
 * not in the roadway's own fixed tiles. A kit has no asphalt: the track's materials are DERIVED from what it has, so a
 * road sits in its land the way its stone and soil do — each material's ramp is the kit's own ramp of its kind (its
 * hue, its cool shadow) taken to the material's values:
 *
 *   asphalt   the rock ramp, almost grey, dark (the aggregate a lit chip, the binder a stop down)   painter: packed
 *   rubber    asphalt a stop and a half down: the racing line laid dark where the tyres brake and turn
 *   patch     asphalt a stop up: a repair
 *   concrete  the rock ramp, pale and nearly grey                                                    painter: plaster
 *   steel     the rock ramp, cool and bright (Armco, a catch fence's posts)                          painter: metal
 *   tyre      near black (a tyre wall)                                                               painter: packed
 *   gravel    rock and soil mixed, pale (a trap)                                                     painter: scree
 *   earth     the soil ramp                                                                          painter: dirt
 *   grass     the grass ramp                                                                         painter: dirt
 *   rock      the rock ramp (a steep slope, a crag: the surrounds)                                   painter: stone
 *   snow      the rock ramp, nearly white (high ground)                                              painter: plaster
 *   crop      the grass and soil ramps mixed, a stop paler (a field round a farm)                    painter: dirt
 *   water     the sky ramp, deep (a lake: drawn flat)                                                painter: plaster
 *   paints    flat, never tiled (pole.js: paint is a mark): kerb red from the kit's paint ramp, white from its light,
 *             the chequer, the lip in its accent
 *
 * Drawn by the kit's POLE (era/style/pole.js), every surface a tile of its material (era/isekai-tiles.js materialBlocks):
 *   material   the tile in its centred window, multiplied by the baked light (texel × light)
 *   banded     the tile in the window of the face's light band (a stop up lit, a stop down in shade), drawn as it is
 *
 *   trackKit(kit) → { id, pole, ramps, paints, surface(name, corners, uv), paint(name, corners, extra?),
 *                     wall(name, corners, inside), flat(name, stop), piece(group paint, corners, value, normal, mark),
 *                     tint(hex, corners, normal?) }
 *     kit: a kit's id (a written kit, or a look already registered), or { id } or a look in words { look, base?, seed? }
 *     composed here (gameworld/tunnel-land.js composeLook: the same words, the same look, in any process); with
 *     `pole: 'voxel'`, the VOXEL look (voxel-look.js): a battle racer's flat colour under the isekai light, set pieces
 *     in cubes, no tiles; with `pole: 'shaded'`, the SHADED look (shaded-look.js): the sixth generation's polygons lit
 *     per corner under a sky, a bounce and a hard high sun, saturated, no tiles
 *
 * Tiles are PNGs resolved by key (`track:<painter>:<stops>`, landscape/surface-textures.js). Pure, deterministic.
 */
import { swatchesOf, madeRamp, accentOf } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';
import { materialBlocks } from '../era/isekai-tiles.js';
import { registerTextureResolver } from '../landscape/surface-textures.js';
import { LIGHT } from './road-faces.js';
import { composeLook } from '../gameworld/tunnel-land.js';
import { lookOf } from '../era/style/looks.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { sunDir } from '../era/sun.js';
import { VOXEL_LIGHT } from './voxel-look.js';
import { SHADED_LIGHT } from './shaded-look.js';

/** Each material: its painter, the kit ramp it is drawn from, the values of its five stops (luma 0–255), how much of the
 *  ramp's colour it keeps, and `grain`: tiles per the caller's uv unit (asphalt's aggregate is fine, a tile a metre). */
export const TRACK_MATERIALS = Object.freeze({
  asphalt:  { painter: 'packed', from: ['rock'], lumas: [34, 50, 70, 96, 128], keep: 0.14, grain: 2.5 },
  rubber:   { painter: 'packed', from: ['rock'], lumas: [26, 38, 52, 72, 96], keep: 0.1, grain: 2.5 },
  patch:    { painter: 'packed', from: ['rock'], lumas: [52, 70, 92, 118, 148], keep: 0.14, grain: 2.5 },
  concrete: { painter: 'plaster', from: ['rock'], lumas: [104, 138, 168, 196, 222], keep: 0.18 },
  steel:    { painter: 'metal', from: ['rock'], lumas: [78, 116, 154, 190, 222], keep: 0.3 },
  tyre:     { painter: 'packed', from: ['rock'], lumas: [14, 22, 30, 42, 58], keep: 0.08 },
  gravel:   { painter: 'scree', from: ['rock', 'soil'], lumas: [96, 136, 170, 198, 222], keep: 0.45 },
  earth:    { painter: 'dirt', from: ['soil'], lumas: null, keep: 1 },
  grass:    { painter: 'dirt', from: ['grass'], lumas: null, keep: 1 },
  rock:     { painter: 'stone', from: ['rock'], lumas: null, keep: 1 },
  crop:     { painter: 'dirt', from: ['grass', 'soil'], lumas: [92, 120, 148, 172, 196], keep: 0.9 },
  water:    { painter: 'plaster', from: ['sky'], lumas: [44, 62, 84, 108, 136], keep: 0.8 },
  snow:     { painter: 'plaster', from: ['rock'], lumas: [188, 208, 224, 238, 250], keep: 0.08 },
});
export const TRACK_PAINTS = Object.freeze(['kerbRed', 'kerbWhite', 'line', 'check', 'lip']);
/** The painters of the kit's own ramps a set piece is made of. */
const PIECE_PAINTERS = Object.freeze({ stone: 'stone', bark: 'grain', foliage: 'leaf' });

const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex = (c) => `#${c.map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** A ramp (darkest to lightest) resampled to `n` stops. */
export function resample(ramp, n = 5) {
  return Array.from({ length: n }, (_, i) => {
    const u = (i / (n - 1)) * (ramp.length - 1), a = Math.floor(u), b = Math.min(ramp.length - 1, a + 1), t = u - a;
    return ramp[a].map((v, k) => v + (ramp[b][k] - v) * t);
  });
}
// the ramp taken to the material's values: its colour kept by `keep` (the rest grey), each stop scaled to its luma
const toned = (ramp, lumas, keep) => ramp.map((c, i) => {
  const L = luma(c), g = c.map((v) => L + (v - L) * keep), Lg = Math.max(1, luma(g)), want = lumas ? lumas[i] : L;
  return g.map((v) => clamp((v * want) / Lg));
});
const mix = (a, b) => a.map((c, i) => c.map((v, k) => (v + b[i][k]) / 2));

// the tiles: `track:<painter>:<seed>:<five stops as hex>`, painted by the kit's material painters
registerTextureResolver('track:', (key) => {
  const [, painter, seed, stops] = key.split(':');
  return materialBlocks(painter, stops.split('-').map((h) => hexRgb(`#${h}`)), seed).url;
});

// the light on a face: the roadway's own (road-faces.js LIGHT), white — on the material pole the texel is the colour
const lam = (n) => LIGHT.ambient + LIGHT.diffuse * Math.max(0, n[0] * LIGHT.toLight[0] + n[1] * LIGHT.toLight[1] + n[2] * LIGHT.toLight[2]);
function normalOf(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
}
// a face turned up: its corners and its normal (reversed if it faced down)
const facingUp = (c) => { const n = normalOf(c); return n[2] < 0 ? { c: c.slice().reverse(), n: n.map((v) => -v) } : { c, n }; };
const outward = (c, n, inside) => { const m = c.reduce((s, p) => [s[0] + p[0] / c.length, s[1] + p[1] / c.length], [0, 0]); return n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) < 0; };
const CEL = 0.55;   // the band's edge on the light (a face under it is in shade)

/** The kit's track materials and the drawers that lay them. */
export function trackKit(kit) {
  const kitId = kit && typeof kit === 'object' ? kit.id ?? composeLook(kit.look, { ...(kit.base ? { base: kit.base } : {}), ...(Number.isInteger(kit.seed) ? { seed: kit.seed } : {}) }).id : kit;
  const sw = swatchesOf(kitId);
  if (!sw) throw new Error(`roadway: unknown kit '${kitId}' (a kit's id, or a look in words: { look: '…' })`);
  // the pole: the look's own (banded, material), or the voxel look when the kit asks for it ({ …, pole: 'voxel' })
  const pole = kit && typeof kit === 'object' && (kit.pole === 'voxel' || kit.pole === 'shaded') ? kit.pole : poleOf(kitId), land = sw.land ?? {};
  const card = lookOf(kitId)?.card ?? ISEKAI_STYLES[kitId] ?? null, light = { ...VOXEL_LIGHT, ...(card?.light ?? {}), cel: card?.cel ?? VOXEL_LIGHT.cel };
  const rampOf = (name) => resample(land[name] ?? (name === 'soil' ? land.rock : name === 'sky' ? [[40, 100, 170], [120, 170, 220]] : land.grass) ?? [[90, 90, 90], [200, 200, 200]]);
  const ramps = {};
  for (const [m, M] of Object.entries(TRACK_MATERIALS)) {
    const base = M.from.length > 1 ? mix(rampOf(M.from[0]), rampOf(M.from[1])) : rampOf(M.from[0]);
    ramps[m] = toned(base, M.lumas, M.keep);
  }
  // the paints: kerb red from the kit's paint ramp (its stop nearest a kerb's value), white from its lightest neutral
  const paintRamp = (() => { try { return madeRamp(kitId, 'paint'); } catch { return null; } })() ?? [[150, 40, 40], [200, 60, 50]];
  const red = paintRamp.reduce((b, c) => (Math.abs(luma(c) - 80) < Math.abs(luma(b) - 80) ? c : b));
  const pale = toned([rampOf('rock')[4]], [236], 0.12)[0];
  const accent = (() => { try { return accentOf(kitId); } catch { return null; } })() ?? [226, 182, 42];
  const paints = { kerbRed: hex(red), kerbWhite: hex(pale), line: hex(pale), check: hex(ramps.tyre[1]), lip: hex(accent) };
  const keyOf = (m, stops) => `track:${TRACK_MATERIALS[m]?.painter ?? PIECE_PAINTERS[m]}:${m}:${stops.map((c) => hex(c).slice(1)).join('-')}`;
  // the kit's own ramps a set piece is also made of (set-pieces.js): its stone, bark, foliage and paint
  const madeOr = (name, fallback) => { try { return resample(madeRamp(kitId, name)); } catch { return fallback; } };
  const own = { stone: madeOr('stone', rampOf('rock')), bark: land.bark ? resample(land.bark) : ramps.earth, foliage: land.foliage ? resample(land.foliage) : ramps.grass, paint: resample(paintRamp.length > 1 ? paintRamp : [paintRamp[0], paintRamp[0]]) };
  // a window of five stops round stop i (the ends repeated)
  const windowAt = (stops, i) => [-2, -1, 0, 1, 2].map((d) => stops[Math.max(0, Math.min(stops.length - 1, i + d))]);
  const shadeOf = (n) => { const g = clamp(255 * Math.min(1, lam(n))); return hex([g, g, g]); };
  // a tiled surface: on the material pole the centred window × the light; banded, the band's window as it is
  // the voxel pole's light: the isekai light, flat colour (a lit face the key's, a shaded one the fill's and bounce)
  const sun = sunDir(light.key.elevation, light.key.azimuth), keyC = hexRgb(light.key.color).map((v) => v / 255), amb = hexRgb(light.ambient).map((v) => (v / 255) * light.fill);
  const isekaiLit = (rgb, n, vary = 1) => {
    const l = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]), lit = l >= light.cel, down = Math.max(0, 0.5 - 0.5 * n[2]);
    return hex(rgb.map((v, k) => v * (amb[k] + (lit ? keyC[k] * light.sunGain * Math.max(l, 0.55) : 0) + light.bounce[k] * light.bounceGain * down) * vary));
  };
  const varyAt = (c) => { const m = c.reduce((a, p) => [a[0] + p[0] / c.length, a[1] + p[1] / c.length], [0, 0]), i = Math.floor(m[0]), j = Math.floor(m[1]); let h = Math.imul((i * 73856093) ^ (j * 19349663), 1274126177); h = ((h ^ (h >>> 16)) >>> 0) % 3; return 1 + 0.04 * (h - 1); };
  // the shaded pole's light (shaded-look.js): the sky from above, the bounce from below, the high warm sun; saturated
  const SL = SHADED_LIGHT, sL = sunDir(SL.key.elevation, SL.key.azimuth), sKey = hexRgb(SL.key.color).map((v) => v / 255), sSky = hexRgb(SL.sky).map((v) => v / 255), sGrd = hexRgb(SL.ground).map((v) => v / 255);
  const sixthLit = (rgb, n) => {
    const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], c = rgb.map((v) => l + (v - l) * SL.saturate), up = (n[2] + 1) / 2, lam = Math.max(0, n[0] * sL[0] + n[1] * sL[1] + n[2] * sL[2]);
    return hex(c.map((v, k) => v * Math.max(SL.shadeFloor * sSky[k] * 0.9 + 0.1, (sSky[k] * up + sGrd[k] * (1 - up)) * SL.fill + sKey[k] * SL.sunGain * lam)));
  };
  const tiled = (m, corners, uv0, n) => {
    if (pole === 'voxel') return { corners, fill: isekaiLit(ramps[m][2], n, varyAt(corners)) };
    if (pole === 'shaded') return { corners, fill: sixthLit(ramps[m][2], n) };
    const R = ramps[m], g = TRACK_MATERIALS[m].grain ?? 1, uv = g === 1 ? uv0 : uv0.map(([u, v]) => [u * g, v * g]);
    if (pole === 'material') return { corners, fill: shadeOf(n), texture: keyOf(m, R), textureLit: true, uv };
    const isLit = lam(n) >= CEL, stops = windowAt(R, isLit ? 3 : 1);
    return { corners, fill: hex(stops[2]), texture: keyOf(m, stops), uv };
  };
  return {
    id: kitId, pole, ramps, paints, light,
    /** A set piece group's colours at a value (0–1 channels), banded the isekai way (a band is a choice of stop, not a
     *  darkening): lit, its stop warmed a touch by the key; a top, half a stop up; shade, a stop down, cooled toward the
     *  ambient. What the voxel look fills a cube with. */
    colourOf(G, value, mark = false) {
      const i = Math.max(0, Math.min(4, Math.round(value * 4) - (mark ? 1 : 0)));
      const R = (G.flat === 'paint' ? own.paint : G.flat === 'rubber' ? ramps.rubber : G.flat === 'light' ? [hexRgb(paints.line)] : G.flat === 'accent' ? [accent] : ramps[G.material] ?? own[G.material]).map((c) => c.map((v) => v / 255));
      const at = (k) => R[Math.max(0, Math.min(R.length - 1, k))], warm = keyC.map((v) => 0.85 + 0.15 * v), cool = hexRgb(light.ambient).map((v) => v / 255);
      const lit = at(i).map((v, k) => v * warm[k]), up = at(i + 1);
      return { lit, top: lit.map((v, k) => v + (up[k] - v) * 0.35), shade: at(i - 1).map((v, k) => v * 0.92 + (cool[k] - v) * 0.22) };
    },
    /** A face of a material, facing up (ground, road, a barrier's top). */
    surface(m, corners, uv) { const { c, n } = facingUp(corners); return tiled(m, c, c === corners ? uv : uv.slice().reverse(), n); },
    /** A set piece's face (set-pieces.js): its group's material (tiled on the pole) or flat colour (glass, paint, a
     *  lamp, the accent), its value the stop, lit by its own normal; turned to wind with that normal. A mark in the
     *  tile (`mark`) is flat, a stop under its value. */
    piece(G, corners, value, normal, mark = false) {
      const wn = normalOf(corners), c = normal && wn[0] * normal[0] + wn[1] * normal[1] + wn[2] * normal[2] < 0 ? corners.slice().reverse() : corners;
      const n = normal ?? wn, i = Math.max(0, Math.min(4, Math.round(value * 4) - (mark ? 1 : 0))), L = lam(n), isLit = L >= CEL;
      if (pole === 'shaded') return { corners: c, fill: sixthLit(this.colourOf(G, value, mark).lit.map((v) => v * 255), n) };
      if (pole === 'voxel') { const V = this.colourOf(G, value, mark), l = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]); return { corners: c, fill: hex((l >= light.cel ? (n[2] > 0.7 ? V.top : V.lit) : V.shade).map((v) => v * 255)) }; }
      if (G.flat || mark) {
        const R = G.flat === 'paint' ? own.paint : G.flat === 'rubber' ? ramps.rubber : G.flat === 'light' ? [hexRgb(paints.line)] : G.flat === 'accent' ? [accent] : ramps[G.material] ?? own[G.material];
        const col = R.length === 1 ? R[0] : R[Math.max(0, Math.min(R.length - 1, i - (pole === 'banded' && !isLit ? 1 : 0)))];
        const k = G.flat === 'light' || G.flat === 'accent' ? 1 : pole === 'material' ? Math.min(1, L) : 1;
        return { corners: c, fill: hex(col.map((v) => v * k)) };
      }
      const R = ramps[G.material] ?? own[G.material], ax = Math.abs(n[2]) > 0.7 ? [0, 1] : Math.abs(n[0]) > Math.abs(n[1]) ? [1, 2] : [0, 2];
      const uv = c.map((p) => [p[ax[0]] / 2, p[ax[1]] / 2]);
      if (pole === 'material') return { corners: c, fill: shadeOf(n), texture: keyOf(G.material, windowAt(R, i)), textureLit: true, uv };
      const stops = windowAt(R, i + (isLit ? 0 : -1));
      return { corners: c, fill: hex(stops[2]), texture: keyOf(G.material, stops), uv };
    },
    /** A stop of a material's ramp, as a fill (an underside, a far thing). */
    flat(m, i = 2) { return hex(ramps[m][Math.max(0, Math.min(4, i))]); },
    /** A flat paint (a kerb, a line), lit as any face; never tiled. */
    paint(name, corners, extra = {}) {
      const { c, n } = facingUp(corners), rgb = hexRgb(paints[name]);
      if (pole === 'voxel') return { corners: c, fill: isekaiLit(rgb, n), ...extra };
      if (pole === 'shaded') return { corners: c, fill: sixthLit(rgb, n), ...extra };
      const k = pole === 'material' ? Math.min(1, lam(n)) : lam(n) >= CEL ? 1 : 0.72;
      return { corners: c, fill: hex(rgb.map((v) => v * k)), ...extra };
    },
    /** A flat colour of the caller's own (a stand's seats, its crowd, a board), lit as a paint by the face's normal
     *  (`normal`, else its winding) and turned to wind with it; never tiled. */
    tint(h, corners, normal = null) {
      const wn = normalOf(corners), c = normal && wn[0] * normal[0] + wn[1] * normal[1] + wn[2] * normal[2] < 0 ? corners.slice().reverse() : corners;
      const n = normal ?? wn, rgb = hexRgb(h);
      if (pole === 'voxel') return { corners: c, fill: isekaiLit(rgb, n) };
      if (pole === 'shaded') return { corners: c, fill: sixthLit(rgb, n) };
      const k = pole === 'material' ? Math.min(1, lam(n)) : lam(n) >= CEL ? 1 : 0.72;
      return { corners: c, fill: hex(rgb.map((v) => v * k)) };
    },
    /** A wall of a material, turned away from `inside` (a barrier's face, an edge down to the ground). */
    wall(m, corners, inside) {
      let n = normalOf(corners), c = corners;
      if (outward(corners, n, inside)) { c = corners.slice().reverse(); n = n.map((v) => -v); }
      const u = (p) => Math.hypot(p[0] - c[0][0], p[1] - c[0][1]) / 2.5;
      return tiled(m, c, c.map((p) => [u(p), (p[2] - c[0][2]) / 2.5]), n);
    },
  };
}
