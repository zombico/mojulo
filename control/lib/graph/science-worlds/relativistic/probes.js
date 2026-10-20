/**
 * The light world's conformance probes: what the shader must compute, computed in JS (geodesic.js `traceRay`, the
 * drawn scheme) for the same inputs. Value probes are rays from the model's observer across the field of view: a
 * captured ray must be captured, an escaped one must leave in the same direction, a ray meeting the disk must meet
 * it at the same radius with the same g. Rays too near a boundary for float32 to settle (the shadow's edge, the
 * disk's rims) are left out. The image probe is the shadow itself, seen face-on against a lit sky with the disk off:
 * its radius on the frame against Synge's angle.
 */

import { traceRay, shadowAngle, B_CRIT } from './geodesic.js';
import { lightShader } from './light-shader.js';
import { shaderPayload } from '../shader.js';
import { darkDiskRadius } from '../conformance.js';
import { normalizeRelativistic } from './solve.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((c) => c / l); };

/** The probes for a light-world manifest, and the two payloads they run on (the page itself, and the shadow's). */
export function lightProbes(manifest, { size = { width: 320, height: 240 } } = {}) {
  const { model: m } = normalizeRelativistic({ model: manifest.model });
  if (m.system !== 'light') throw new Error('science-worlds: conformance probes are for a light world');
  const disk = m.disk ?? { inner: 0, outer: 0 };
  const D = m.distance, eye = [D * Math.sin(m.inclination), 0, D * Math.cos(m.inclination)];
  const f = unit(eye.map((c) => -c)), r = unit(cross(f, [0, 0, 1])), u = cross(r, f);
  const span = Math.atan(Math.max(1.2 * disk.outer, 6) / D);
  const values = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) {
    const a = span * (i / 4 - 1), b = span * (j / 3 - 1);
    const rd = unit([0, 1, 2].map((k) => f[k] + Math.tan(a) * r[k] + Math.tan(b) * u[k]));
    const t = traceRay(eye, rd, { inner: disk.inner, outer: disk.outer });
    // the ray's impact parameter in coordinates: near the shadow's edge float32 may decide differently
    const bImp = Math.hypot(...cross(eye, rd)) / Math.sqrt(1 - 1 / D);
    if (Math.abs(bImp - B_CRIT) < 0.08 || t.fate === 'unfinished') continue;
    const id = `ray:${i},${j}`;
    if (t.hits.length) {
      const h = t.hits[0];
      if (h.r - disk.inner < 0.08 || disk.outer - h.r < 0.08) continue;
      values.push({ id: `${id}:disk`, a: [...eye, 1], b: [...rd, 0], expect: [1, h.r, h.g], tol: 5e-3 });
    } else if (t.fate === 'captured') values.push({ id: `${id}:captured`, a: [...eye, 0], b: [...rd, 0], expect: [1], tol: 0.5 });
    else values.push({ id: `${id}:escaped`, a: [...eye, 0], b: [...rd, 0], expect: [0, ...t.dir], tol: 3e-3 });
  }
  const page = shaderPayload({ shader: lightShader({ inner: disk.inner, outer: disk.outer }), points: [[-D, -D, -D], [D, D, D]], science: probeScience, title: 'light conformance' });
  // the shadow, face-on, the sky lit and the disk off
  const vfov = 30, faceOn = [0.0001, 0, D];
  const expect = (Math.tan(shadowAngle(D)) / Math.tan((vfov * Math.PI) / 360)) * (size.height / 2);
  const shadow = shaderPayload({ shader: lightShader({ sky: 'plain' }), points: [[-D, -D, -D], [D, D, D]], science: probeScience, title: 'shadow conformance' });
  const images = [{ id: 'shadow', camera: { pos: faceOn, target: [0, 0, 0], vfov }, measure: (fr) => darkDiskRadius(fr), expect, tol: 1.5 }];
  return { page: { payload: page, probes: { values, images: [] } }, shadow: { payload: shadow, probes: { values: [], images } }, size };
}

const probeScience = { t: [0, 1], period: 2, hold: 1, titleHtml: 'conformance', titleText: 'conformance', noClock: true, barWidth: 200, labelWidth: 100, rows: [], labels: [], honesty: { sections: [] } };
