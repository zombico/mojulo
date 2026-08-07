import { safeJson } from '../emit-util.js';

// Deform channel (opt-in, additive): apply a time-varying LINEAR map to a named face group, about a
// pivot, by writing the group mesh's matrix each frame. Where movers do rigid TRS (rotate + translate +
// axis-aligned scale), this does the GENERAL linear map a TRS can't reach — SHEAR, off-axis/anisotropic
// stretch, and rank-deficient collapse. The baked-flat lighting (MeshBasicMaterial, unlit) is what makes
// this cheap: deforming vertices can't break normals there are none. Two modes:
//   • morph — interpolate identity → `to` over `period` (mover-style play/hold/loop). The linear-map
//     reveal (transform-view): watch space flow into A; eigen-directions slide straight out.
//   • wave — M(t) = I + Σ ampᵢ·sin(2π t/periodᵢ + phaseᵢ)·basisᵢ. A superposition of oscillating
//     strains: a single `basis` is the 1-term case (a breathing +/× ring); two terms in quadrature
//     (plus·cos + cross·sin) make the rotating quadrupole an inspiral actually emits (the ring's
//     ellipse ROTATES — test masses trace circles).
// Each entry: { group, mode?:'morph'|'wave', to?, basis?|terms?, amp?, phase?, period?, hold?, loop?, pivot? }.
//   terms: [{ basis, amp?, period?, phase? }, …]   (superposed; `basis`+`amp`+… is shorthand for one term)
// `to`/`basis` accept a 2×2 (auto-embedded, z untouched) or a 3×3. Only emitted with non-empty `deforms`.
export function deformChannelScript(deforms) {
  return `
const DEFORMS = ${safeJson(deforms)};
const _ID3 = [[1,0,0],[0,1,0],[0,0,1]];
function _to3(M){ // 2×2 → 3×3 (z identity), or pass a 3×3 through
  if (M.length === 2) return [[M[0][0],M[0][1],0],[M[1][0],M[1][1],0],[0,0,1]];
  return [[M[0][0],M[0][1],M[0][2]],[M[1][0],M[1][1],M[1][2]],[M[2][0],M[2][1],M[2][2]]];
}
const _lerp3 = (A,B,u) => A.map((row,r) => row.map((v,c) => v + (B[r][c]-v)*u));
const _addScaled = (A,B,s) => A.map((row,r) => row.map((v,c) => v + B[r][c]*s));
function _deformU(d, sec){
  if (d.loop) return ((sec/(d.period||4)) % 1 + 1) % 1;
  const cycle = (d.period||4) + (d.hold||0), ph = sec % cycle;
  return ph < (d.period||4) ? ph/(d.period||4) : 1;
}
// affine 4×4 that applies linear L about pivot p:  v' = L·(v − p) + p = L·v + (p − L·p).
const _mat4 = new THREE.Matrix4();
function _applyLinear(mesh, L, p){
  const a=L[0][0],b=L[0][1],c=L[0][2], d=L[1][0],e=L[1][1],f=L[1][2], g=L[2][0],h=L[2][1],k=L[2][2];
  const px=p[0],py=p[1],pz=p[2];
  const tx = px-(a*px+b*py+c*pz), ty = py-(d*px+e*py+f*pz), tz = pz-(g*px+h*py+k*pz);
  _mat4.set(a,b,c,tx, d,e,f,ty, g,h,k,tz, 0,0,0,1);
  mesh.matrix.copy(_mat4);
  mesh.matrixWorldNeedsUpdate = true;   // matrixAutoUpdate is off → flag matrixWorld for recompute, else the render ignores it
}
const _deformRigs = DEFORMS.map((d) => {
  const mesh = meshes[d.group] || null;
  if (mesh) { mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; } // deformed bounds outgrow the sphere
  const raw = (Array.isArray(d.terms) && d.terms.length) ? d.terms : (d.basis ? [{ basis:d.basis, amp:d.amp, period:d.period, phase:d.phase }] : []);
  const terms = raw.map((tm) => ({ basis:_to3(tm.basis), amp:(tm.amp!=null?tm.amp:1), period:(tm.period||4), phase:(tm.phase||0) }));
  return { d, mesh, to: d.to ? _to3(d.to) : null, terms, pivot: d.pivot || [0,0,0] };
}).filter((r) => r.mesh);
stepDeforms = (t) => {
  const sec = t / 1000;   // the per-frame clock arrives in ms (matching every other channel)
  for (const r of _deformRigs){
    let L;
    if (r.d.mode === 'wave' && r.terms.length){
      L = [[1,0,0],[0,1,0],[0,0,1]];
      for (const tm of r.terms) L = _addScaled(L, tm.basis, tm.amp * Math.sin((2*Math.PI*sec)/tm.period + tm.phase));
    } else if (r.to) L = _lerp3(_ID3, r.to, _deformU(r.d, sec));
    else continue;
    _applyLinear(r.mesh, L, r.pivot);
  }
};`;
}
