/**
 * The conformance gate's own check: a small shader page whose model is a sphere of radius R and a field K / r², with
 * its probes. Faithful, every probe agrees with JS; with `fudge` (a hand-typed factor in the GLSL, the twin a shader
 * must never carry) the gate must disagree. Used by the e2e tier and `scripts/science-conformance.mjs --selftest`.
 */

import { shaderPage, shaderPayload } from './shader.js';
import { darkDiskRadius } from './conformance.js';

const R = 1.5, K = 2;

export function selftestCase({ fudge = 1, width = 320, height = 240 } = {}) {
  const f = fudge === 1 ? '' : `${fudge.toFixed(3)} * `;
  const glsl = `
vec4 sciValue(vec4 a, vec4 b) { float r = length(a.xyz); return vec4(r - ${f}uR, uK / (r * r), 0.0, 0.0); }
vec4 sciImage(vec3 ro, vec3 rd) {
  float bq = dot(ro, rd), rr = ${f}uR, h = bq * bq - dot(ro, ro) + rr * rr;
  if (h > 0.0 && -bq - sqrt(h) > 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  return vec4(0.55, 0.6, 0.7, 1.0);
}`;
  const science = { t: [0, 1], period: 2, hold: 1, titleHtml: 'conformance self-test', titleText: 'conformance self-test', noClock: true, barWidth: 200, labelWidth: 100, rows: [], labels: [], honesty: { sections: [] } };
  const payload = shaderPayload({ shader: shaderPage({ glsl, uniforms: { uR: R, uK: K } }), points: [[-3, -3, -3], [3, 3, 3]], science, title: 'conformance self-test' });
  const values = [[1, 0, 0], [0, 2, 0], [0.3, -0.4, 2.5]].map((p, i) => {
    const r = Math.hypot(...p);
    return { id: `field:${i}`, a: [...p, 1], expect: [r - R, K / (r * r)], tol: 1e-5 };
  });
  // a sphere seen face-on from d: a disk of angular radius asin(R/d), tan of it over tan(vfov/2) of half the height
  const d = 8, vfov = 40;
  const expect = (Math.tan(Math.asin(R / d)) / Math.tan((vfov * Math.PI) / 360)) * (height / 2);
  const images = [{ id: 'disk', camera: { pos: [d, 0, 0], target: [0, 0, 0], vfov }, measure: (fr) => darkDiskRadius(fr), expect, tol: 1.5 }];
  return { payload, probes: { values, images }, size: { width, height } };
}
