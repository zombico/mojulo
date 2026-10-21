/**
 * HANDWEAR PARTS — the body-agnostic pieces handwear is made of, each laid on a SURFACE (a part's stations, slots and
 * bind: the glove's leather, or the bare hand's skin) a body's hand adapter hands over (adapters/).
 *
 *   standOff(P, thick, { keep, tuck }) a part's rings stood off its skin by `thick` (each point out from its ring's
 *                                  middle), its first `keep` rings (a digit cut at a joint: its end closed inside the
 *                                  finger); `tuck` its first ring left on the skin (the palm's at the wrist, under the
 *                                  forearm's skin where no cuff covers it)
 *
 * Pure and deterministic.
 */
import { mean, unitv } from '../footwear/parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the part `P` stood off by `thick`: its first `keep` rings, each point carried out from its ring's middle; a kept tip
 * cap carried on along the digit, a cut end closed a third of its ring's radius on (inside the finger, so it reads open) */
export function standOff(P, thick, { keep = P.stations.length, tuck = false, group } = {}) {
  const sts = P.stations.slice(0, Math.max(2, keep)), whole = sts.length === P.stations.length;
  const stations = sts.map((st, k) => { const c = mean(Object.values(st.points)), off = tuck && k === 0 ? 0 : thick;
    return { ...st, points: Object.fromEntries(P.slots.map((sl) => { const p = st.points[sl], d = unitv(p.map((x, q) => x - c[q])); return [sl, p.map((x, q) => r6(x + d[q] * off))]; })) }; });
  const e = stations.length - 1, cE = mean(Object.values(sts[e].points)), cB = mean(Object.values(sts[e - 1].points)), along = unitv(cE.map((x, q) => x - cB[q]));
  const r = P.slots.reduce((a, sl) => a + Math.hypot(...sts[e].points[sl].map((x, q) => x - cE[q])), 0) / P.slots.length;
  const tip = whole && P.caps?.tip ? P.caps.tip.map((x, q) => r6(x + along[q] * thick)) : cE.map((x, q) => r6(x + along[q] * r / 3));
  const ids = new Set(stations.map((s) => s.id)), blend = Object.fromEntries(Object.entries(P.bind?.blend || {}).filter(([k]) => ['back', 'tip'].includes(k) || ids.has(k.split('.')[0])));
  return { layer: 1, closure: 'closed', garment: true, slots: P.slots, stations, caps: { back: P.caps.back, tip }, ...(group ? { group } : {}), bind: { ...P.bind, blend } };
}
