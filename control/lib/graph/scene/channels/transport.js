import { safeJson } from '../emit-util.js';

// In-page script: the TRANSPORT channel (parallel-transport-view). HOLONOMY made visible — an arrow
// carried around a closed loop on a surface. Static (great in a frozen still): the loop line, a FAN of
// faded breadcrumb arrows (the carried vector sampled around the trip, green→red), and the bright green
// START vs red RETURNED arrow at the start point whose angular gap IS the holonomy. Animated: a
// traveller dot + a bright accent arrow sweeping the loop. A HUD shows the holonomy, the enclosed solid
// angle, and the Gauss–Bonnet check. The transport physics is precomputed in the builder; this just plays
// the arrays. Only emitted with `transports`.
export function transportChannelScript(transports) {
  return `
const TRANSPORTS = ${safeJson(transports)};
function _arrow(dir, at, len, color) { const a = new THREE.ArrowHelper(new THREE.Vector3(dir[0], dir[1], dir[2]), new THREE.Vector3(at[0], at[1], at[2]), len, color, len * 0.30, len * 0.18); a.renderOrder = 3; scene.add(a); return a; }
const _trRigs = TRANSPORTS.map((tr) => {
  const lg = new THREE.BufferGeometry().setFromPoints(tr.loop.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: tr.loopColor || 0x7fd0ff })));
  // faded breadcrumb fan — the carried vector left at stations around the loop (the rotation reads as a fan).
  for (const b of tr.breadcrumbs) { const a = _arrow(b.dir, b.at, tr.arrowLen * 0.82, b.color); a.line.material.transparent = a.cone.material.transparent = true; a.line.material.opacity = a.cone.material.opacity = 0.4; }
  // the green START arrow and the red RETURNED arrow, both at the start point: their gap is the holonomy.
  _arrow(tr.startDir, tr.startAt, tr.arrowLen, tr.startColor || 0x66e0a0);
  _arrow(tr.endDir, tr.startAt, tr.arrowLen, tr.endColor || 0xff5a5a);
  // the animated traveller + the bright carried arrow.
  const dot = new THREE.Mesh(new THREE.SphereGeometry(tr.dotR || 0.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(dot);
  const arrow = _arrow(tr.startDir, tr.startAt, tr.arrowLen, tr.accent || 0xffd24a);
  const hud = document.createElement('div'); hud.className = 'moj-readout'; wrap.appendChild(hud);
  const gb = Math.abs(Math.abs(tr.holonomyDeg) - Math.abs(tr.predictedDeg)) < 1.0;
  hud.innerHTML = '<b>' + tr.title + '</b>'
    + '<span class="v">holonomy: ' + tr.holonomyDeg.toFixed(1) + '°</span>'
    + '<span>enclosed: ' + tr.solidAngleSr.toFixed(2) + ' sr  (' + tr.predictedDeg.toFixed(1) + '°)</span>'
    + '<span>Gauss–Bonnet: holonomy = ∫∫K dA ' + (gb ? '✓' : '≈') + '</span>'
    + tr.lines.map((l) => '<span style="opacity:.8">' + l + '</span>').join('');
  return { tr, dot, arrow };
});
stepTransports = (ms) => {
  for (const r of _trRigs) {
    const tr = r.tr, N = tr.loop.length, u = ((ms / 1000) / tr.period % 1 + 1) % 1;
    const f = u * (N - 1), i = Math.floor(f), a = f - i, j = Math.min(N - 1, i + 1);
    const p0 = tr.loop[i], p1 = tr.loop[j], d0 = tr.vectors[i], d1 = tr.vectors[j];
    const px = p0[0] + (p1[0] - p0[0]) * a, py = p0[1] + (p1[1] - p0[1]) * a, pz = p0[2] + (p1[2] - p0[2]) * a;
    let dx = d0[0] + (d1[0] - d0[0]) * a, dy = d0[1] + (d1[1] - d0[1]) * a, dz = d0[2] + (d1[2] - d0[2]) * a;
    const dm = Math.hypot(dx, dy, dz) || 1; dx /= dm; dy /= dm; dz /= dm;
    r.dot.position.set(px, py, pz);
    r.arrow.position.set(px, py, pz); r.arrow.setDirection(new THREE.Vector3(dx, dy, dz));
  }
};`;
}
