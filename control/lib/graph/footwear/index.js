/**
 * FOOTWEAR — a solver library: footwear composed from body-agnostic PARTS (parts.js) by a SPEC (presets.js names the
 * words), worn on a body through its FOOT ADAPTER (adapters/), so any character tool's feet take the same shoes.
 *
 * A FOOT ADAPTER is a body's foot as footwear reads it:
 *   sides                       ['R', 'L']
 *   seg(kind, S)                the part named for `kind` ('foot' | 'toes' | 'shank') on side `S` (null if the body has none)
 *   joints(S)                   { ankle, toeBase, toeTip }, the rig's (the toe base splits the sole so it bends)
 *   bare(name)                  the skin's part: what a sandal is worn on
 *   upper(F, { id, group })     the body's own way to lay leather over its foot at the spec's height → parts named
 *                               `<id>_<segment>`
 *   u(kind, share)              the station `u` a share along a segment names on this body
 *
 *   wearFootwear(adapter, spec, { id, group }) → { parts, tones }: layer-1 parts named `<id>_<segment>` (the upper),
 *   `<id>Sole_<segment>`, `<id>Strap<k>_<segment>`, `<id>Buckle<k>_<segment>`, each carried by its segment's bind;
 *   `tones` the colours of the groups it adds (`Sole`, `Strap`, `Brass`) for a palette that names none.
 *
 * Pure and deterministic.
 */
import { soleSlab, strapBand, buckleOn, bindNearest, pointsOf, unitv } from './parts.js';
import { FOOTWEAR, FOOTWEAR_TONES } from './presets.js';

export { FOOTWEAR, FOOTWEAR_TONES };

/** a word or a spec of one's own → the spec */
export const footwearSpec = (spec) => ({ ...(typeof spec === 'string' ? FOOTWEAR[spec] : spec) });

/** The footwear on a body (see the head of this file). */
export function wearFootwear(A, spec = 'boots', { id = 'boots', group = 'Shoes' } = {}) {
  const F = footwearSpec(spec), bare = F.upper === false;
  // (no upper, a sandal: the sole and the straps on the bare foot, the skin's own parts)
  const parts = bare ? {} : A.upper(F, { id, group });
  const on = (seg) => (seg ? (bare ? A.bare(seg) : parts[`${id}_${seg}`]) : undefined);
  for (const S of A.sides) {
    const fn = A.seg('foot', S), tn = A.seg('toes', S), foot = on(fn), toes = on(tn);
    if (!foot) continue;
    // THE SOLE: each segment's footprint behind or in front of the toe base (a few millimetres over it), grown by the welt
    const { toeBase: tb, toeTip: tt } = A.joints(S), fwd = tb && tt ? unitv([tt[0] - tb[0], tt[1] - tb[1], 0]) : [0, 1, 0];
    const ahead = (p) => (tb ? (p[0] - tb[0]) * fwd[0] + (p[1] - tb[1]) * fwd[1] : 0);
    const floor = Math.min(...[foot, toes].filter(Boolean).flatMap(pointsOf).map((p) => p[2]));
    for (const [seg, P, keep] of [[fn, foot, (p) => ahead(p) < 0.004], [tn, toes, (p) => ahead(p) > -0.004]]) {
      if (!P) continue;
      const print = pointsOf(P).filter((p) => p[2] < floor + Math.max(0.015, (F.sole ?? 0.008) + 0.008) && keep(p));
      const sole = soleSlab(print, { floor, thick: F.sole ?? 0.008, welt: F.welt ?? 0.003 });
      if (sole) parts[`${id}Sole_${seg}`] = { ...sole, group: 'Sole', bind: bindNearest(sole, P) };
    }
    // THE STRAPS, and a buckle on each one's outer side
    (F.straps ?? []).forEach((st, k) => {
      const seg = A.seg(st.on, S), P = on(seg); if (!P) return;
      const band = strapBand(P, A.u(st.on, st.at), { lift: st.lift ?? 0.0025, width: st.width ?? 0.015 }); if (!band) return;
      parts[`${id}Strap${k}_${seg}`] = { ...band, group: 'Strap' };
      if (F.buckle) { const b = buckleOn(band, S === 'R' ? 1 : -1); parts[`${id}Buckle${k}_${seg}`] = { ...b, group: 'Brass', bind: bindNearest(b, P) }; }
    });
  }
  return { parts, tones: FOOTWEAR_TONES };
}
