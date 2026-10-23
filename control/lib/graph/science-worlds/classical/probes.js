/**
 * The classical world's conformance probes: a field drawn by a shader (dress.field 'volume' or 'shells') against
 * field.js. E and V at points through the drawn region, at moments through the run, the charges where the movers
 * have them at that moment (field-shader.js `chargesAt`, the same clock and interpolation); points within a tenth of
 * the region of a charge are left out, where float32 cannot settle a 1/r² field.
 */

import { planClassicalWorld, assembleClassicalScene } from './world.js';
import { fieldSources } from './field.js';
import { chargesAt } from './field-shader.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** The probes for a classical world whose field is drawn by a shader, on the page itself. */
export function fieldProbes(manifest, { size = { width: 320, height: 240 }, points = 48 } = {}) {
  const plan = planClassicalWorld(manifest);
  if (!plan.shader) throw new Error("science-worlds: field probes are for a classical world with dress.field 'volume' or 'shells'");
  const src = fieldSources(plan.solved.model), u = plan.shader.layer.customUniforms, s = u.uS;
  const values = [];
  for (let i = 0; values.length < points && i < 8 * points; i++) {
    // a fixed spread of points in the region and moments in the run (a low-discrepancy walk: no dice)
    const a = [(i * 0.6180339887) % 1, (i * 0.7548776662) % 1, (i * 0.5698402910) % 1].map((x) => 2 * x - 1);
    if (len(a) > 1) continue;
    const p = u.uCentre.map((c, k) => c + 0.9 * u.uR * a[k]), t = ((i * 0.4142135624) % 1) * (u.uPeriod + u.uHold);
    const cs = chargesAt(plan.shader.texture, t, u.uPeriod, u.uHold);
    if (cs.some((c) => len(sub(p, c.x)) < 0.1 * u.uR)) continue;
    const E = u.uE0.slice();
    let V = -(u.uE0[0] * p[0] + u.uE0[1] * p[1] + u.uE0[2] * p[2]) / s;
    for (const c of cs) {
      const d = sub(p, c.x).map((x) => x / s), r = len(d);
      for (let k = 0; k < 3; k++) E[k] += (c.kq * d[k]) / (r * r * r);
      V += c.kq / r;
    }
    const want = [...E.map((x) => x * u.uEScale), V / u.uVref];
    values.push({ id: `field:${i}`, a: [...p, t], expect: want, tol: 2e-4 * Math.max(1, ...want.map(Math.abs)) });
  }
  if (!src.charges.length) throw new Error('science-worlds: field probes need charges');
  return { page: { payload: assembleClassicalScene(manifest, { plan }), probes: { values, images: [] } }, size };
}
