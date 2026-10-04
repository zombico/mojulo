/** hero-core-measures.js — the hero's MIDSECTION, measured: what the design loop's critic reads to judge the pelvis.
 *
 * `coreMeasures(plan, mesh)` takes plane sections of the compiled figure at rest (the torso, the structured core's pelvis
 * and the thighs; the arms and the dress are not the body) every centimetre from the torso's hem down to the knee:
 *   waist_m      across the hem
 *   hip_m        across the widest section above the crotch
 *   waistToHip   waist_m / hip_m
 *   hipPeak      where the widest section sits, in lumbar runs (the pelvis hub to the navel) over the hip joints: the
 *                trochanter band is about −0.4 … +0.15; at the hem it is about +0.6
 *   seat_m       how far the seat stands out behind the lower back at the hem (the midline's back)
 *   frontDrop_m  how far the midline front falls from the hem to the crotch (sections solid through the midline)
 *   pouch_m      the largest rise of that front on its way down (a bulge below the belly; 0 is none)
 *   shelf_m      the largest change in width from one centimetre to the next (a step at the hem or the knee)
 *   legs         'converge' when the knee sits inside the hip joint, 'splay' when outside
 * `coreAdvice(m, body)` reads them against CORE_BANDS for the 'female' or 'male' body: one line per measure out of band,
 * naming what moves it. Advice, never a refusal (docs/bicycles.md). Pure: a function of the plan and the mesh. */

const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const BODY = /^(torso|pelvis|thigh[RL])$/;

/** The midsection's measures, or null without a mesh or the joints to place them. */
export function coreMeasures(plan, mesh) {
  const J = plan?.rig?.joints, at = (k) => J?.[k]?.at ?? J?.[k];
  const hub = at('pelvisHub'), navel = at('navel'), hip = at('hip$S') ?? at('hipR'), knee = at('knee$S') ?? at('kneeR');
  if (!mesh || !hub || !navel || !hip || !knee) return null;
  const zp = hub[2], L = navel[2] - zp, zHem = zp + 0.63 * L, zCrotch = zp - 0.4 * L;
  const V = mesh.vertices, tris = mesh.faces.filter((f) => BODY.test(mesh.provenance[f[0]].part));
  const section = (z) => {
    const ps = [];
    for (const f of tris) for (let i = 1; i + 1 < f.length; i++) {
      const t = [V[f[0]], V[f[i]], V[f[i + 1]]];
      for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; if ((a[2] - z) * (b[2] - z) > 0 || a[2] === b[2]) continue; const u = (z - a[2]) / (b[2] - a[2]); ps.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]); }
    }
    if (!ps.length) return null;
    const mid = ps.filter((p) => Math.abs(p[0]) < 0.012);
    return { z, half: Math.max(...ps.map((p) => Math.abs(p[0]))), front: mid.length ? Math.max(...mid.map((p) => p[1])) : null, back: mid.length ? Math.min(...mid.map((p) => p[1])) : null };
  };
  const S = []; for (let z = zHem - 0.005; z > knee[2] + 0.05; z -= 0.01) { const s = section(z); if (s) S.push(s); }
  if (S.length < 3) return null;
  // the hip is the widest section ABOVE the crotch (below it a splayed leg can be wider still: that is `legs`)
  const peak = S.filter((s) => s.z > zCrotch).reduce((a, b) => (b.half > a.half ? b : a)), hem = S[0];
  // the front and back only where the section is solid through the midline (a groove between two thigh lofts there
  // would catch part of a surface and fake a dip)
  const fronts = S.filter((s) => s.z > zCrotch && s.front !== null && s.front - s.back > 0.08);
  let pouch = 0, low = Infinity; for (const s of fronts) { low = Math.min(low, s.front); pouch = Math.max(pouch, s.front - low); }
  const backs = fronts.map((s) => s.back);
  return {
    waist_m: r3(2 * hem.half), hip_m: r3(2 * peak.half), waistToHip: r3(hem.half / peak.half),
    hipPeak: r3((peak.z - zp) / L),
    seat_m: backs.length && hem.back !== null ? r3(hem.back - Math.min(...backs)) : null,
    frontDrop_m: fronts.length > 1 ? r3(fronts[0].front - fronts.at(-1).front) : null,
    pouch_m: r3(pouch),
    shelf_m: r3(Math.max(...S.slice(1).map((s, i) => Math.abs(s.half - S[i].half)))),
    legs: Math.abs(knee[0]) < Math.abs(hip[0]) ? 'converge' : 'splay',
  };
}

/** The bands per body: [low, high] (null: no bound on that side). The female's hip peaks at the trochanter, a waist
 * clearly narrower than it, a seat and a front that falls away; the male's hip is straight. */
export const CORE_BANDS = Object.freeze({
  female: Object.freeze({ waistToHip: [0.66, 0.84], hipPeak: [-0.45, -0.1], seat_m: [0.015, 0.05], frontDrop_m: [0.035, null], pouch_m: [null, 0.004], shelf_m: [null, 0.012] }),
  male: Object.freeze({ waistToHip: [0.88, 1.06], hipPeak: [null, null], seat_m: [0.01, 0.045], frontDrop_m: [0.02, null], pouch_m: [null, 0.004], shelf_m: [null, 0.012] }),
});
const WHY = {
  waistToHip: (v, [lo, hi]) => (v < lo ? `the waist is narrow for the hips (waist to hip ${v} under ${lo}): /hero/tune { waist: up } or { hips: down }` : `the waist is as wide as the hips (waist to hip ${v} over ${hi}): /hero/tune { waist: down } or { hips: up }`),
  hipPeak: (v) => `the hip is widest at ${v} lumbar runs from the hip joints (${v > -0.1 ? 'at the joint or above it' : 'low'}), not at the trochanter: core 'structured' builds the hip to peak there`,
  seat_m: (v, [lo, hi]) => (v < lo ? `the seat is flat (${v} m behind the lower back, under ${lo}): core 'structured' builds it` : `the seat stands far out (${v} m behind the lower back, over ${hi})`),
  frontDrop_m: (v, [lo]) => `the front below the waist barely falls to the crotch (${v} m, under ${lo}): core 'structured' recedes it`,
  pouch_m: (v, [, hi]) => `the front bulges below the belly (a pouch of ${v} m, over ${hi}): core 'structured' recedes it to the crotch`,
  shelf_m: (v, [, hi]) => `the outline steps (${v} m in a centimetre, over ${hi}): a shelf at the hem or the knee; core 'structured' runs it as one curve`,
};

/** One advice line per measure out of its band, and one when the legs splay. */
export function coreAdvice(m, body) {
  if (!m) return [];
  const B = CORE_BANDS[body === 'female' ? 'female' : 'male'], out = [];
  for (const [k, [lo, hi]] of Object.entries(B)) { const v = m[k]; if (v === null || v === undefined) continue; if ((lo !== null && v < lo) || (hi !== null && v > hi)) out.push(`core: ${WHY[k](v, [lo, hi])}`); }
  if (m.legs === 'splay') out.push("core: the knees stand wider than the hip joints (the thighs splay and the crotch opens as a V): core 'structured' converges the legs");
  return out;
}
