/**
 * BODY-RELATIONAL FOOTWEAR — a composable footwear primitive on the realistic body: an UPPER (leather close over the
 * foot and its toes, a field garment: body-relational-garment.js) cut at a HEIGHT, and ADORNMENTS worn on it.
 *
 *   upper    false: none, a SANDAL (the sole and the straps on the bare foot, the skin's own parts)
 *   height   'boot': the upper carried up the shank as a shaft (`shaft`, a share of the shank from the ankle), the foot's
 *            top rings tucked under it round the ankle (the foot's skin runs on inside the shank's, so its leather does
 *            inside the shaft's); 'shoe': the upper only from the `collar` (a share of the foot from the ankle) down
 *   sole     a slab under each segment of the foot (the foot's behind the toe base, the toes' in front of it, so it bends
 *            with them), its outline the upper's footprint grown by the `welt`, `sole` thick, from the upper's floor up
 *   straps   [{ on: 'foot' | 'shank', at, width? }]: a band round the upper at `at` (the segment's stations' `u`), `width`
 *            (m, 15 mm) wide, lifted off it
 *   buckle   a small block on each strap's outer side
 *
 *   footwear(recipe, R, build, map, spec, { id }) → { parts, tones }: layer-1 parts named `<id>_<segment>` (the upper),
 *   `<id>Sole_<segment>`, `<id>Strap<k>_<segment>`, `<id>Buckle<k>_<segment>`, each carried by its segment's bind; and
 *   `tones`, the colours of the groups it adds (`Sole`, `Strap`, `Brass`) for a palette that names none
 *   FOOTWEAR      the words: `boots`, `shoes`, `sandals`
 *
 * The construction is the tailor's (body-relational-tailor.js); this file the footwear's choice of it. Pure and
 * deterministic.
 */
import { fieldGarment } from './body-relational-garment.js';
import { soleSlab, strapBand, buckleOn, bindNearest } from './body-relational-tailor.js';

/** the words: a spec each (any key may be given in a spec of one's own) */
export const FOOTWEAR = Object.freeze({
  boots: Object.freeze({ height: 'boot', shaft: 0.3, sole: 0.009, welt: 0.003, straps: [{ on: 'foot', at: 1.25 }, { on: 'shank', at: 1.8 }], buckle: true }),
  shoes: Object.freeze({ height: 'shoe', collar: 0.3, sole: 0.007, welt: 0.002, straps: [{ on: 'foot', at: 1.25 }], buckle: true }),
  sandals: Object.freeze({ upper: false, sole: 0.01, welt: 0.004, straps: [{ on: 'foot', at: 1.35, width: 0.02 }, { on: 'foot', at: 0.2, width: 0.012 }], buckle: true }),
});
/** the upper's leather: close, over the foot's forms (the operator's choice of the close boot) */
const UPPER = { ease: 0.004, looser: 1.2, reach: 0.02, taut: false, span: 0.04, along: 2, soft: true };
/** the colours of the groups footwear adds, for a palette that names none */
export const FOOTWEAR_TONES = Object.freeze({ Sole: '#2a2420', Strap: '#4b3324', Brass: '#a8843f' });

const unitv = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));

/** The footwear (see the head of this file). */
export function footwear(recipe, R, build, map, spec = 'boots', { id = 'boots', group = 'Shoes' } = {}) {
  const F = { ...(typeof spec === 'string' ? FOOTWEAR[spec] : spec) }, boot = F.height === 'boot', bare = F.upper === false;
  const window = boot ? { shank: [2 - 2 * (F.shaft ?? 0.3), 2] } : { foot: [F.collar ?? 0.3, 2] };
  // (no upper, a sandal: the sole and the straps on the bare foot, the skin's own parts)
  const parts = bare ? {} : fieldGarment(recipe, R, build, map, { id, covers: null, on: boot ? ['foot', 'toes', 'shank'] : ['foot', 'toes'], window, ...UPPER, group }).parts;
  const on = (seg) => (bare ? recipe.parts[seg] : parts[`${id}_${seg}`]);
  const J = recipe.rig?.joints ?? {}, at = (k) => J[k]?.at ?? J[k];
  for (const S of ['R', 'L']) {
    const foot = on(`foot${S}`), toes = on(`toes${S}`);
    if (!foot) continue;
    // THE SOLE: each segment's footprint behind or in front of the toe base (a few millimetres over it), grown by the welt
    const tb = at(`toeBase${S}`), tt = at(`toeTip${S}`), fwd = tb && tt ? unitv([tt[0] - tb[0], tt[1] - tb[1], 0]) : [0, 1, 0];
    const ahead = (p) => (tb ? (p[0] - tb[0]) * fwd[0] + (p[1] - tb[1]) * fwd[1] : 0);
    const floor = Math.min(...[foot, toes].filter(Boolean).flatMap(pointsOf).map((p) => p[2]));
    for (const [seg, P, keep] of [[`foot${S}`, foot, (p) => ahead(p) < 0.004], [`toes${S}`, toes, (p) => ahead(p) > -0.004]]) {
      if (!P) continue;
      const print = pointsOf(P).filter((p) => p[2] < floor + Math.max(0.015, (F.sole ?? 0.008) + 0.008) && keep(p));
      const sole = soleSlab(print, { floor, thick: F.sole ?? 0.008, welt: F.welt ?? 0.003 });
      if (sole) parts[`${id}Sole_${seg}`] = { ...sole, group: 'Sole', bind: bindNearest(sole, P) };
    }
    // THE STRAPS, and a buckle on each one's outer side
    (F.straps ?? []).forEach((st, k) => {
      const P = on(`${st.on}${S}`); if (!P) return;
      const band = strapBand(P, st.at, { lift: st.lift ?? 0.0025, width: st.width ?? 0.015 }); if (!band) return;
      parts[`${id}Strap${k}_${st.on}${S}`] = { ...band, group: 'Strap' };
      if (F.buckle) { const b = buckleOn(band, S === 'R' ? 1 : -1); parts[`${id}Buckle${k}_${st.on}${S}`] = { ...b, group: 'Brass', bind: bindNearest(b, P) }; }
    });
  }
  return { parts, tones: FOOTWEAR_TONES };
}




