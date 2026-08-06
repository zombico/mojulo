import { safeJson } from '../emit-util.js';

// In-page script: the FIELD channel. Where the mover translates one solid body, a field renders a
// LATTICE of vector arrows over space, updated per frame from an analytic field — the electromagnetism
// channel (field-view). Two modes off one sample shape: `animate:true` oscillates each arrow by
// sin(phase0 − ω·t) (a travelling E⊥B plane wave, with an optional moving sine curve through the arrow
// tips), and `animate:false` orients static needles along a frozen B (iron filings). Static field
// lines (dipole curves, B loops, coil windings) draw once as faint THREE.Lines, and an optional static
// readout (λ / f / c, etc.) reuses .moj-readout. Reuses the ArrowHelper + Line + readout idioms; no
// glow. Only emitted when the caller passes a non-empty `fields`.
export function fieldChannelScript(fields) {
  return `
const FIELDS = ${safeJson(fields)};
const fieldRigs = FIELDS.map((fd) => {
  const sets = (fd.sets || []).map((st) => {
    const col = st.color || 0xffffff;
    const arrows = st.samples.map((s) => {
      const a = new THREE.ArrowHelper(new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize(),
        new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]), Math.max(0.01, s.amp), s.color != null ? s.color : col, Math.max(0.01, s.amp) * 0.34, Math.max(0.01, s.amp) * 0.22);
      a.renderOrder = 3; scene.add(a); return a;
    });
    let curve = null;
    if (st.curve) { const g = new THREE.BufferGeometry().setFromPoints(st.samples.map(() => new THREE.Vector3())); curve = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col })); scene.add(curve); }
    return { st, arrows, curve };
  });
  (fd.lines || []).forEach((ln) => {
    const g = new THREE.BufferGeometry().setFromPoints(ln.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: ln.color || 0x6688cc, transparent: true, opacity: ln.opacity != null ? ln.opacity : 0.7 })));
  });
  if (Array.isArray(fd.readout) && fd.readout.length) {
    const ro = document.createElement('div'); ro.className = 'moj-readout';
    ro.innerHTML = fd.readout.map((s, k) => k === 0 ? '<b>' + s + '</b>' : '<span>' + s + '</span>').join('');
    wrap.appendChild(ro);
  }
  return { fd, sets, _init: false };
});
const _fdv = new THREE.Vector3();
function _stepField(rig, t) {
  const fd = rig.fd;
  for (const so of rig.sets) {
    const tips = so.curve ? [] : null;
    so.arrows.forEach((ar, i) => {
      const s = so.st.samples[i];
      let L = s.amp, sgn = 1;
      if (fd.animate) { const v = Math.sin((s.phase0 || 0) - (fd.omega || 0) * t / 1000); sgn = v >= 0 ? 1 : -1; L = Math.max(0.01, s.amp * Math.abs(v)); }
      ar.setDirection(_fdv.set(s.dir[0] * sgn, s.dir[1] * sgn, s.dir[2] * sgn).normalize());
      ar.setLength(L, L * 0.34, L * 0.22);
      if (tips) tips.push(new THREE.Vector3(s.pos[0] + s.dir[0] * sgn * L, s.pos[1] + s.dir[1] * sgn * L, s.pos[2] + s.dir[2] * sgn * L));
    });
    if (so.curve && tips) so.curve.geometry.setFromPoints(tips);
  }
}
stepFields = (t) => { for (const rig of fieldRigs) { if (rig.fd.animate || !rig._init) { _stepField(rig, t); rig._init = true; } } };`;
}
