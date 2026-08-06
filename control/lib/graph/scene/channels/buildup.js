import { safeJson } from '../emit-util.js';

// In-page script: the BUILDUP channel. A point cloud revealed PROGRESSIVELY over time — single
// particles accumulating into the double-slit interference pattern. The positions are pre-sorted into
// (pseudo-random) arrival order in the builder, so a growing draw-range reveals scattered dots that
// slowly resolve into fringes; a small counter shows the running hit total. Loops. Only with `buildups`.
export function buildupChannelScript(buildups) {
  return `
const BUILDUPS = ${safeJson(buildups)};
const _buRigs = BUILDUPS.map((bu) => {
  const N = (bu.positions.length / 3) | 0;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bu.positions), 3));
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: bu.color || 0xbfe6ff, size: bu.size || 0.8, sizeAttenuation: true, transparent: true, opacity: 0.96, depthWrite: false }));
  pts.renderOrder = 4; scene.add(pts);
  return { bu, geo, N };
});
let _buHud = null;
if (_buRigs.length) { _buHud = document.createElement('div'); _buHud.className = 'moj-readout'; _buHud.style.left = 'auto'; _buHud.style.right = '8px'; wrap.appendChild(_buHud); }
stepBuildups = (ms) => {
  const sec = ms / 1000;
  for (const r of _buRigs) {
    const period = r.bu.period || 14, k = Math.min(r.N, Math.floor(((sec % period) / period) * r.N));
    r.geo.setDrawRange(0, k);
    if (_buHud && r === _buRigs[0]) _buHud.innerHTML = '<b>' + k + ' / ' + r.N + ' particles</b>';
  }
};`;
}
