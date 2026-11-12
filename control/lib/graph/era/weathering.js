/**
 * WEATHERING — how far the causes have worked on a room's surfaces, one scale for all of them: a separate axis from its
 * debris (era/skandart.js `skandart`: how much of what came off still lies there). A room can stand weathered and swept,
 * or weathered and heaped, or fresh with a fall in it; a `condition` word (era/condition.js) sets both, and a recipe
 * turns either on its own.
 *
 * The scale is `amount` 0…1: 0 fresh, WEATHERING.authored (0.5) the kit as drawn, 1 as far as it goes. Each CAUSE is a
 * weight on it (0…1, all 1 by default), so the one scale is told by its causes, each where it acts:
 *
 *   damp    water rising from the floor: the low wall's coat lost (a render's `loss`), the damp band and moss at the
 *           walls' feet, fungus and creep in the corners
 *   water   water from above: streaks down from the cornice, the upper wall's coat lost
 *   fire    flame: soot over every lamp and torch
 *   time    years: the dirt's age, the blends' reach, the stone's worn joints and chipped arrises, cracks in the floor
 *
 *   readWeathering(m)          → null | { amount, causes: { damp, water, fire, time } }
 *   withWeathering(m, kit)     → the recipe with the dials the causes set filled where the recipe set none (`grime`,
 *                                `dirt`, `cracks`, `growth`), and `_weathering`: what was asked and what it set (its
 *                                render walls' coat loss among it)
 *   weatherKit(kit, W)         → the kit with its render walls' coat at what `_weathering` set (its tint and laying kept)
 * A recipe's own `grime`, `dirt`, `cracks`, `growth` or wall `tiles` stand over what the scale would set. Pure.
 */
import { generatedSpecOf } from '../landscape/surface-textures.js';
import { tileFamilyOf } from './tile-specs.js';

export const WEATHER_CAUSES = Object.freeze(['damp', 'water', 'fire', 'time']);
/** The scale's numbers: where the kit as drawn stands on it, and the most each surface dial reaches. */
export const WEATHERING = Object.freeze({
  authored: 0.5,
  // a render's coat lost at the wall's foot (damp) and over the string course (water), at the scale's top
  coat: Object.freeze({ low: 0.95, high: 0.7 }),
  // the floor's cracks and the corners' growth, at the scale's top (interceptors.js: 0…1)
  cracks: 0.7, growth: 0.55,
});

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const num = (v, at) => { if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error(`stage: ${at} is a number from 0 (fresh) to 1 (as weathered as it goes)`); return v; };

/** A recipe's `weathering`: a number 0…1, or { amount?, damp?, water?, fire?, time? }. */
export function readWeathering(m) {
  const v = m.weathering;
  if (v === undefined || v === null || v === false) return null;
  const all = Object.fromEntries(WEATHER_CAUSES.map((c) => [c, 1]));
  if (typeof v === 'number') return { amount: num(v, 'weathering'), causes: all };
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`stage: weathering is 0…1, or { amount, ${WEATHER_CAUSES.join(', ')} } (each cause 0…1)`);
  for (const k of Object.keys(v)) if (k !== 'amount' && !WEATHER_CAUSES.includes(k)) throw new Error(`stage: weathering.${k} is not a cause of it (${WEATHER_CAUSES.join(', ')}), nor its amount`);
  const causes = Object.fromEntries(WEATHER_CAUSES.map((c) => [c, v[c] === undefined ? 1 : num(v[c], `weathering.${c}`)]));
  return { amount: v.amount === undefined ? WEATHERING.authored : num(v.amount, 'weathering.amount'), causes };
}

/** A render wall's coat lost to `loss` (its family regenerated, its every other setting kept); other walls as they are. */
function coatAt(tile, loss) {
  const S = tile?.family ? generatedSpecOf(`${tile.family}-a`) : null;
  if (!S || S.gen !== 'dressed' || S.cfg.cut !== 'render' || !Number.isFinite(S.cfg.loss)) return null;
  const { metres, ...p } = S.cfg;
  return { gen: 'dressed', ...p, scale: metres, loss: r5(Math.min(0.98, loss)) };
}

/**
 * The recipe with the scale's dials filled where it set none. The scale reaches each surface by its cause, relative to
 * the kit as drawn (at WEATHERING.authored every dial is the kit's own): the grime by time, the baked dirt cause by
 * cause, a render wall's coat by damp low and water high, the floor's cracks by time, the corners' growth by damp.
 */
export function withWeathering(m, kit) {
  const W = readWeathering(m);
  if (!W) return m;
  const { weathering: _w, ...out } = m, set = {}, a = W.amount, C = W.causes, k = a / WEATHERING.authored;
  // the grime (stage.js withGrime: the blends' reach, the stone's wear) by time
  if (m.grime === undefined) { out.grime = r5(Math.min(1, a * C.time)); set.grime = out.grime; }
  // the baked dirt, cause by cause (dirt.js: each its default at the kit as drawn, scaled)
  if (m.dirt === undefined) {
    out.dirt = { age: r5(Math.min(1, 0.5 * k * C.time)), damp: r5(Math.min(1, 0.5 * k * C.damp)), soot: r5(Math.min(1, 0.5 * k * C.fire)) };
    set.dirt = out.dirt;
  }
  // a render wall's coat, lost low where damp rises and high where water runs down (the kit's own loss at the middle)
  if (m.tiles?.wall === undefined && m.tiles?.wallUpper === undefined && kit?.tiles) {
    const lowS = kit.tiles.wall?.family ? generatedSpecOf(`${kit.tiles.wall.family}-a`) : null, hiS = kit.tiles.wallUpper?.family ? generatedSpecOf(`${kit.tiles.wallUpper.family}-a`) : null;
    const lose = (base, most, w) => (a <= WEATHERING.authored ? base * (a / WEATHERING.authored) * w + base * (1 - w) : base + (most - base) * ((a - WEATHERING.authored) / (1 - WEATHERING.authored)) * w);
    const low = lowS?.cfg?.loss !== undefined ? coatAt(kit.tiles.wall, lose(lowS.cfg.loss, WEATHERING.coat.low, C.damp)) : null;
    const high = hiS?.cfg?.loss !== undefined ? coatAt(kit.tiles.wallUpper, lose(hiS.cfg.loss, WEATHERING.coat.high, C.water)) : null;
    if (low || high) set.coat = { ...(low ? { low: low.loss } : {}), ...(high ? { high: high.loss } : {}) };
  }
  // the floor's cracks by time, the corners' growth (fungus, creep) by damp (interceptors.js), past the kit as drawn
  const over = Math.max(0, (a - WEATHERING.authored) / (1 - WEATHERING.authored));
  if (m.cracks === undefined && over > 0 && C.time > 0) { out.cracks = r5(WEATHERING.cracks * over * C.time); set.cracks = out.cracks; }
  if (m.growth === undefined && over > 0 && C.damp > 0) { out.growth = { fungus: r5(WEATHERING.growth * over * C.damp), creep: r5(WEATHERING.growth * 0.6 * over * C.damp) }; set.growth = out.growth; }
  return { ...out, _weathering: { amount: a, causes: C, set } };
}

/** The kit with its render walls' coat at what weathering set (`W` a recipe's `_weathering`): each wall's family
 *  regenerated at its new loss, every other setting, its tint and its laying kept. A kit without a coat is as it was. */
export function weatherKit(kit, W) {
  const C = W?.set?.coat;
  if (!C || !kit?.tiles) return kit;
  const tiles = { ...kit.tiles };
  for (const [part, at] of [['wall', 'low'], ['wallUpper', 'high']]) {
    if (C[at] === undefined || !tiles[part]) continue;
    const spec = coatAt(tiles[part], C[at]);
    if (spec) tiles[part] = { ...tiles[part], family: tileFamilyOf(spec, `weathering: tiles.${part}`) };
  }
  return { ...kit, tiles };
}
