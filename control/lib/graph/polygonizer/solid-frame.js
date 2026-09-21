/**
 * solid-frame — the frames a lathe and a prism stand in, shared by the OpenSCAD transpiler
 * (scene-scad.js) and the exact field kernel (field-exact.js). Pure, no imports: this module
 * must stay safe for any bundle, because field-faces reaches it from the client-facing side.
 */

const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
const cross3 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit3 = (a) => { const l = len3(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
export { sub3, len3, cross3, unit3 };

const EPS = 1e-9;
/** Fixed-precision, exponent-free, no negative zero — the transpiler's scalar (kept here so the meridian dedup matches it). */
export function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const r = Math.abs(n) < EPS ? 0 : n;
  let s = r.toFixed(6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

export function axisBasis(d) {
  const ref = Math.abs(d.z) > 0.999 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const u = unit3(cross3(ref, d));
  return [u, cross3(d, u), d];
}

export function perpBasisZ(d) {
  if (Math.abs(d.z) > 0.999) return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }];
  const u = unit3(cross3({ x: 0, y: 0, z: 1 }, d));
  return [u, unit3(cross3(d, u))];
}

export function latheMeridian(profile, L) {
  const prof = [...profile]
    .filter((q) => q && Number.isFinite(q.t) && Number.isFinite(q.radius))
    .sort((a, b) => a.t - b.t);
  if (prof[0].t > 0) prof.unshift({ t: 0, radius: prof[0].radius });
  if (prof[prof.length - 1].t < 1) prof.push({ t: 1, radius: prof[prof.length - 1].radius });
  const pts = prof.map((q) => [Math.max(0, q.radius), q.t * L]);
  pts.push([0, L], [0, 0]);
  // drop consecutive duplicates (a profile that already closes on the axis)
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || num(last[0]) !== num(p[0]) || num(last[1]) !== num(p[1])) out.push(p);
  }
  while (out.length > 3 && num(out[0][0]) === num(out[out.length - 1][0]) && num(out[0][1]) === num(out[out.length - 1][1])) out.pop();
  return out;
}
