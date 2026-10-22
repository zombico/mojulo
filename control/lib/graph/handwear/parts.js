/**
 * HANDWEAR PARTS — the body-agnostic pieces handwear is made of, each laid on a SURFACE (a part's stations, slots and
 * bind: the glove's leather, or the bare hand's skin) a body's hand adapter hands over (adapters/).
 *
 *   standOff(P, thick, { keep, tuck }) a part's rings stood off its skin by `thick` (each point out from its ring's
 *                                  middle), its first `keep` rings (a digit cut at a joint: its end closed inside the
 *                                  finger); `tuck` its first ring left on the skin (the palm's at the wrist, under the
 *                                  forearm's skin where no cuff covers it)
 *   mittenShell(cloud, frame, opts)  a MITTEN SHELL: one closed padded form round a cloud of spheres (the palm's surface,
 *                                  the digits' bones in their grip), sliced along the hand and read out from each
 *                                  slice's middle, its front rounding off where the spheres end (a boxing glove's fist)
 *   bindAmong(piece, surfaces)      a piece's bind from the nearest point of several surfaces (its own weights, by point,
 *                                  by ring or its part's bone): a mitten's front bending with the fingers inside it
 *
 * Pure and deterministic.
 */
import { mean, unitv } from '../footwear/parts.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';

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

/** a MITTEN SHELL round `cloud` ([{ p, r }], spheres), each sphere grown by `pad`: in the hand's `frame` ({ o the wrist,
 * A along the hand, D toward its back, V toward the side its ring order runs first }), `slices` rings from the wrist on
 * past the farthest sphere, each the union of the spheres' discs in its plane read along rays from the discs' middle
 * (`n` round), eased round and along so the padding reads soft; its front closes where the discs shrink to nothing */
export function mittenShell(cloud, { o, A, D, V }, { pad, slices = 18, n = 24, from = -0.004 } = {}) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const S = cloud.map(({ p, r }) => { const d = p.map((x, q) => x - o[q]); return { a: dot(d, A), v: dot(d, V), w: dot(d, D), R: r + pad }; });
  const x1 = Math.max(...S.map((c) => c.a + c.R)), x0 = Math.max(from, Math.min(...S.map((c) => c.a)));
  // (slices closer toward the front, where it turns)
  const xs = Array.from({ length: slices }, (_, k) => x0 + (x1 - x0) * 0.985 * Math.sin((Math.PI / 2) * (k / (slices - 1))));
  const rings = xs.map((x) => {
    const discs = S.filter((c) => Math.abs(c.a - x) < c.R).map((c) => ({ v: c.v, w: c.w, r: Math.sqrt(c.R * c.R - (c.a - x) ** 2) }));
    const tot = discs.reduce((t, c) => t + c.r * c.r, 0) || 1, cv = discs.reduce((t, c) => t + c.v * c.r * c.r, 0) / tot, cw = discs.reduce((t, c) => t + c.w * c.r * c.r, 0) / tot;
    const rad = Array.from({ length: n }, (_, j) => {
      const th = (2 * Math.PI * j) / n, dw = Math.cos(th), dv = Math.sin(th);
      let best = 0;
      for (const c of discs) { const qv = c.v - cv, qw = c.w - cw, along = qv * dv + qw * dw, perp2 = qv * qv + qw * qw - along * along, disc = c.r * c.r - perp2; if (disc >= 0) best = Math.max(best, along + Math.sqrt(disc)); }
      return best;
    });
    // (a ray between two discs finds none: its neighbours' reach)
    for (let j = 0; j < n; j++) if (!rad[j]) rad[j] = Math.max(rad[(j + 1) % n], rad[(j + n - 1) % n]);
    return { x, cv, cw, rad };
  });
  // (eased round each ring, then along: the padding soft, no knuckle's bump)
  for (const g of rings) for (let it = 0; it < 2; it++) g.rad = g.rad.map((r, j) => (2 * r + g.rad[(j + 1) % n] + g.rad[(j + n - 1) % n]) / 4);
  const ease = rings.map((g, k) => { if (k === 0 || k === rings.length - 1) return g; const P = rings[k - 1], N = rings[k + 1];
    return { ...g, cv: (2 * g.cv + P.cv + N.cv) / 4, cw: (2 * g.cw + P.cw + N.cw) / 4, rad: g.rad.map((r, j) => Math.max(r, (2 * r + P.rad[j] + N.rad[j]) / 4)) }; });
  const names = ringSlots(n), at = (x, v, w) => o.map((q, i) => r6(q + A[i] * x + V[i] * v + D[i] * w));
  const stations = ease.map((g, k) => ({ id: `st${k}`, u: k, points: Object.fromEntries(names.map((nm, j) => { const th = (2 * Math.PI * j) / n; return [nm, at(g.x, g.cv + Math.sin(th) * g.rad[j], g.cw + Math.cos(th) * g.rad[j])]; })) }));
  const f = ease[0], l = ease[ease.length - 1];
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: at(f.x - 0.003, f.cv, f.cw), tip: at(x1, l.cv, l.cw) } };
}

/** a piece's bind from the nearest point among `surfaces` (parts with a bind): each of its points (and its caps) takes
 * that point's weights (its own, its ring's, or its part's bone whole) */
export function bindAmong(piece, surfaces) {
  const src = surfaces.flatMap((P) => P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? P.bind.blend?.[st.id] ?? { [P.bind.bone]: 1 }])));
  const nearest = (q) => { let best = src[0], d0 = Infinity; for (const s of src) { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; if (d < d0) { d0 = d; best = s; } } return best[1]; };
  const bone = surfaces[0].bind.bone, blend = {};
  for (const st of piece.stations) for (const [sl, q] of Object.entries(st.points)) blend[`${st.id}.${sl}`] = nearest(q);
  for (const [k, q] of Object.entries(piece.caps)) blend[k] = nearest(q);
  return { bone, blend };
}
