/**
 * OUT-DUNES — a trail's land laid in wind-blown dunes (`trail.ground.dunes`, era/out-ground.js): the shape real dunes
 * take, not a noise's. The wind piles sand up a long gentle windward slope to a crest, over which it avalanches down a
 * steep slip face at sand's angle of repose; so a dune is asymmetric across the wind: its back rising slowly and rounding
 * to its brink, its face falling from it at that angle (so a taller dune's face is longer) and easing out at its foot. The crests run across the wind, sinuous;
 * where the sand is plenty they are long TRANSVERSE ridges, where it thins they break into crescents (BARCHANS), their
 * horns trailing downwind (a patch's edge travels farther than its heart). The walk keeps a firm floor through them: the
 * dunes ease down to nothing toward the trail, so its corridor is an inter-dune street and the walk's grade law holds.
 *
 *   DUNES                 the dials' defaults (below)
 *   readDunes(spec, at)   true | { height?, spacing?, wind?, repose?, supply?, sinuous? } → the dunes, every word checked
 *   duneField(D, seed)    → { h(x, y) → metres of sand over the land, share(x, y) → 0..1 how much dune stands there (the
 *                           sand's cover), crest(x, y) → 0..1 near a crest, wind: [x, y] the way the wind blows }
 *   duneMap(site, cell?)  → the dunes as the form render reads them (scene/channels/form-land.js): { wind, origin, cell,
 *                           size, px } a map over the site, `cell` m a texel (1), RGBA bytes base64: red how much dune
 *                           stands there (its sand's strength, the street none), green near a crest
 *
 * Pure: hashed value noise (era/dirt.js), the same dials and seed the same dunes.
 */
import { vnoise } from './dirt.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const D2R = Math.PI / 180;

/**
 * The dials: `height` m, a dune's crest over its trough at full supply; `spacing` m, crest to crest; `wind` degrees, the
 * way the wind blows (0 along +x, 90 along +y, the trail's way); `repose` degrees, the slip face's angle (dry sand's
 * angle of repose, 32: the face as long as a dune's height needs at it, the rest its back); `supply` 0..1, how much sand
 * (1 long ridges everywhere, low crescents in patches on bare ground); `sinuous` 0..1, how far a crest wanders off straight.
 */
export const DUNES = Object.freeze({ height: 2.8, spacing: 26, wind: 0, repose: 32, supply: 0.75, sinuous: 0.35 });
/** A slip face's share of a dune, at most and at least (a low dune's face is short, a tall close one's never its whole). */
export const LEE_SHARE = Object.freeze([0.06, 0.45]);
/** Where the walk's corridor holds the dunes down (m past the trail's edge: none at the first, whole at the second). */
export const DUNE_WALK = Object.freeze([1.5, 8]);

export function readDunes(spec, at = 'trail.ground.dunes') {
  if (spec === undefined || spec === false || spec === null) return null;
  if (spec === true) return { ...DUNES };
  if (!isObj(spec)) throw new Error(`stage: ${at} is true or { ${Object.keys(DUNES).join(', ')} } (every one optional)`);
  for (const k of Object.keys(spec)) if (!(k in DUNES)) throw new Error(`stage: ${at}.${k} is not a dune setting (settings: ${Object.keys(DUNES).join(', ')})`);
  const num = (k, lo, hi, words) => { if (spec[k] !== undefined && (typeof spec[k] !== 'number' || !(spec[k] >= lo && spec[k] <= hi))) throw new Error(`stage: ${at}.${k} is ${words}`); };
  num('height', 0.3, 12, 'metres a crest stands over its trough, 0.3 to 12');
  num('spacing', 8, 120, 'metres crest to crest, 8 to 120');
  num('wind', -360, 360, 'degrees, the way the wind blows (0 along the land\'s x, 90 along the trail)');
  num('repose', 15, 34, 'the slip face\'s angle in degrees, 15 to 34 (dry sand rests at 32)');
  num('supply', 0, 1, 'how much sand, 0 (crescents on bare ground) to 1 (long ridges everywhere)');
  num('sinuous', 0, 1, 'how far a crest wanders off straight, 0 to 1');
  return { ...DUNES, ...spec };
}

/** A dune's profile across the wind at t (0 a trough, `a` its crest, 1 the next trough), 0..1 of its height: its back
 *  rising and rounding to the brink (flat at the crest on the windward side), its face falling straight from it (the
 *  sand at rest, `LEE_STEEP` × its mean fall) and easing out over its last 0.3 into the trough, never steeper than the
 *  face. */
export function duneProfile(t, a) {
  if (t < a) { const s = t / a; return 1 - Math.pow(1 - s, 1.8); }
  const s = (t - a) / (1 - a);
  return s <= 0.7 ? 1 - LEE_STEEP * s : (LEE_STEEP / 0.6) * (1 - s) * (1 - s);
}
/** The face's fall over its mean (the toe's ease takes the rest): a straight face to 0.7 of the slip face, a quadratic
 *  toe meeting it at its slope. */
export const LEE_STEEP = 1 / 0.85;

export function duneField(D, seed = 1) {
  const S = seed | 0, w = D.wind * D2R, ux = Math.cos(w), uy = Math.sin(w), L = D.spacing;
  const at = (x, y) => {
    const u = x * ux + y * uy, v = -x * uy + y * ux;
    // the sand's supply in patches (≈ 3 dunes across): full where it is plenty, thinning to bare ground between
    const sup = vnoise(x / (L * 2.6), y / (L * 2.6), S + 7101), m = smooth(1 - D.supply - 0.3, 1 - D.supply + 0.3, sup);
    // a crest's wander across the wind, slow along it; a thinning patch's edge pushed downwind (the crescent's horns)
    const wander = D.sinuous * L * (2 * vnoise(v / (L * 1.7), u / (L * 5), S + 7103) - 1), horns = 0.4 * L * (1 - m) * (1 - m);
    const ph = (u - wander - horns) / L, t = ph - Math.floor(ph);
    // each dune's own height a little different, by which dune it is and where along its crest
    const vary = 0.75 + 0.5 * vnoise(Math.floor(ph) * 3.1, v / (L * 1.3), S + 7105), H = D.height * m * vary;
    // (its slip face at the angle of repose: as long as its height needs, the rest its back)
    const a = 1 - Math.max(LEE_SHARE[0], Math.min(LEE_SHARE[1], (LEE_STEEP * H) / Math.tan(D.repose * D2R) / L)), p = duneProfile(t, a);
    return { h: H * p, share: m * Math.min(1, p * 4 + 0.35), crest: m * smooth(0.85, 1, p) };
  };
  return { h: (x, y) => at(x, y).h, share: (x, y) => at(x, y).share, crest: (x, y) => at(x, y).crest, wind: [ux, uy] };
}

export function duneMap(site, cell = 1) {
  const g = site.grid, D = site.dunes, x0 = g.x0, y0 = g.y0, nx = Math.ceil((g.x0 + (g.nx - 1) * g.dx - x0) / cell) + 1, ny = Math.ceil((g.y0 + (g.ny - 1) * g.dx - y0) / cell) + 1;
  const px = new Uint8Array(nx * ny * 4), b = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell, o = (j * nx + i) * 4;
    px[o] = b((D.sand(x, y) + 0.3) / 0.7); px[o + 1] = b(D.crest(x, y)); px[o + 3] = 255;
  }
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return { wind: D.wind.map(r4), origin: [r4(x0), r4(y0)], cell, size: [nx, ny], px: Buffer.from(px).toString('base64') };
}
