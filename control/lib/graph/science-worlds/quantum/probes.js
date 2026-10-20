/**
 * The quantum world's conformance probes: what a shader-drawn quantum page must compute, computed in JS for the same
 * inputs (conformance.js runs them in Chrome).
 *
 *   volume  ψ of each orbital at twelve points of its own sampled cloud (where the density is), against atom.js
 *           `radial · realY`, the exact function, within a thousandth of the orbital's brightest |ψ|.
 *   plane   the sheet's brightness at forty points of the plane at moments through the run, against the solver's
 *           frames looked up the same way (plane-shader.js `sheetValue`); and the wall, either side of every slit's
 *           edges and of its faces, against the model's (plane.js `inWall`).
 */

import { planQuantumWorld, assembleQuantumScene } from './world.js';
import { radial, realY } from './atom.js';
import { sheetValue } from './plane-shader.js';
import { inWall, slitCentres, SHEET_FRAMES } from './plane.js';

/** The probes for an atom world drawn as a volume, on the page itself. */
export function volumeProbes(manifest, { size = { width: 320, height: 240 }, perOrbital = 12 } = {}) {
  const plan = planQuantumWorld(manifest);
  if (!plan.shader || plan.solved.system !== 'atom') throw new Error("science-worlds: volume probes are for an atom world with dress.render: 'volume'");
  const values = [];
  plan.solved.run.clouds.forEach((c, i) => {
    const peak = plan.shader.constants[i].peak, stride = Math.max(1, Math.floor(c.points.length / perOrbital));
    for (let k = 0; k < perOrbital && k * stride < c.points.length; k++) {
      const p = c.points[k * stride], r = Math.hypot(...p);
      const th = r > 0 ? Math.acos(Math.max(-1, Math.min(1, p[2] / r))) : 0, ph = Math.atan2(p[1], p[0]);
      values.push({ id: `${c.name}:${k}`, a: [...p, i], expect: [radial(c.n, c.l, r) * realY(c.l, c.m, th, ph)], tol: 1e-3 * peak });
    }
  });
  return { page: { payload: assembleQuantumScene(manifest, { plan }), probes: { values, images: [] } }, size };
}

/** The probes for a plane world, on the page itself. */
export function planeProbes(manifest, { size = { width: 320, height: 240 }, points = 40 } = {}) {
  const plan = planQuantumWorld(manifest);
  if (plan.solved.system !== 'plane') throw new Error('science-worlds: plane probes are for a plane world');
  const { model, run } = plan.solved, w = model.wall, tex = plan.shader.texture, s = plan.scale / 1e9, dx = run.g.dx;
  const half = (model.L / 2) * s;
  // a fixed spread of points and moments (a low-discrepancy walk: no dice here, the probes are the same every run)
  const values = [];
  for (let i = 0; i < points; i++) {
    const u = (0.5 + i * 0.6180339887) % 1, v = (0.5 + i * 0.7548776662) % 1, f = ((i * 0.5698402910) % 1) * (SHEET_FRAMES - 1);
    const x = (2 * u - 1) * half, y = (2 * v - 1) * half;
    values.push({ id: `sheet:${i}`, a: [u, v, f, 0], b: [x, y, 0, 0], expect: [sheetValue(tex, u, v, f), w && inWall(w, x / s, y / s, dx) ? 1 : 0], tol: 1e-5 });
  }
  if (w) {
    const edges = slitCentres(w).flatMap((c) => [c - w.width / 2, c + w.width / 2]);
    const wall = (x, y) => (inWall(w, x, y, dx) ? 1 : 0);
    edges.forEach((e, k) => {
      for (const side of [-0.3, 0.3]) {
        const y = e + side * dx;
        values.push({ id: `edge:${k}${side < 0 ? '-' : '+'}`, a: [0.5, 0.5, 0, 0], b: [w.at * s, y * s, 0, 0], expect: [sheetValue(tex, 0.5, 0.5, 0), wall(w.at, y)], tol: 1e-5 });
      }
    });
    const behind = slitCentres(w)[0] - w.width / 2 - 2 * dx;   // a stretch of wall below the first slit
    for (const side of [-1, 1]) for (const inside of [true, false]) {
      const x = w.at + side * (w.thickness / 2 + (inside ? -0.3 : 0.3) * dx);
      values.push({ id: `face:${side < 0 ? 'front' : 'back'}${inside ? ':in' : ':out'}`, a: [0.5, 0.5, 0, 0], b: [x * s, behind * s, 0, 0], expect: [sheetValue(tex, 0.5, 0.5, 0), wall(x, behind)], tol: 1e-5 });
    }
  }
  return { page: { payload: assembleQuantumScene(manifest, { plan }), probes: { values, images: [] } }, size };
}
