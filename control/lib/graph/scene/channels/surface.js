import { safeJson } from '../emit-util.js';

// In-page script: the SURFACE channel. The other channels move discrete things (sprites, bodies,
// arrows); a surface DEFORMS a continuous mesh over time — an animated ocean. It builds a grid
// BufferGeometry once, then every frame recomputes position + normal + colour from a Gerstner
// "waveform sequence" (a sum of moving wave trains): P.z = Σ A·sin θ, with the Gerstner horizontal
// pull P.xy += Σ Q·A·D·cos θ that sharpens crests, plus analytic normals so the surface is LIT.
// Unlike the basic-material world meshes, the ocean uses a MeshStandardMaterial + a sun light (added
// here), so existing scenes are unaffected (basic materials ignore the light). Buoys ride the surface
// (sampling the same displacement → the circular orbital water motion). Only emitted with `surfaces`.
export function surfaceChannelScript(surfaces) {
  return `
const SURFACES = ${safeJson(surfaces)};
function _gerstner(waves, x0, y0, t) {
  let px = x0, py = y0, pz = 0, nx = 0, ny = 0, nz = 1;
  for (let q = 0; q < waves.length; q++) {
    const w = waves[q], ph = w.k * (w.dx * x0 + w.dy * y0) - w.om * t + w.ph, c = Math.cos(ph), s = Math.sin(ph);
    px += w.Q * w.A * w.dx * c; py += w.Q * w.A * w.dy * c; pz += w.A * s;
    nx += -w.dx * w.k * w.A * c; ny += -w.dy * w.k * w.A * c; nz += -w.Q * w.k * w.A * s;
  }
  return [px, py, pz, nx, ny, nz];
}
// wavefield mode (double-slit ripple tank): an incoming plane wave for y < barrierY, then a SUM of
// circular waves from point sources (the slits) beyond it — vertical displacement (linear waves, no
// Gerstner pull) with analytic-gradient normals. Their overlap IS the interference pattern.
function _wavefield(sf, x0, y0, t) {
  const k = sf.k, om = sf.om, A = sf.A;
  let h = 0, gx = 0, gy = 0;
  if (y0 < (sf.barrierY || 0)) {
    const ph = k * y0 - om * t; h = A * Math.sin(ph); gy = A * k * Math.cos(ph);
  } else {
    for (let i = 0; i < sf.sources.length; i++) {
      const dx = x0 - sf.sources[i][0], dy = y0 - sf.sources[i][1], r = Math.hypot(dx, dy) || 1e-4;
      const env = 1 / Math.sqrt(Math.max(1, r * (sf.decay || 0.04))), ph = k * r - om * t, c = A * env * k * Math.cos(ph);
      h += A * env * Math.sin(ph); gx += c * dx / r; gy += c * dy / r;
    }
  }
  return [x0, y0, h, -gx, -gy, 1];
}
// gravity-wave mode (gravity-wave-view): a spacetime MEMBRANE under a compact-binary inspiral. The
// height is the quadrupole GW STRAIN — a static central well (curvature) plus a rotating two-armed
// (cos 2ψ) ripple radiated outward at the wave speed (retarded time t − r/v). The chirp (frequency
// rising to merger, then ringdown) lives in _gwphase — the exact twin of gwState() in gravity-wave-view.js.
function _gwphase(g, t) {
  let tau = (t % g.tLoop) / g.tLoop; if (tau < 0) tau += 1;
  const tm = g.tauMerge, a = g.aChirp;
  if (tau < tm) {
    const u = Math.max(1e-4, 1 - a * tau), fr = Math.pow(u, -0.375);
    return { tau: tau, fr: fr, phi: g.phiCoef * (1 - Math.pow(u, 0.625)), sep: g.sep0 * Math.pow(u, 0.25), amp: g.amp0 * Math.pow(fr, 0.66667) * Math.min(1, tau / 0.06), merged: false };
  }
  const um = Math.max(1e-4, 1 - a * tm), frm = Math.pow(um, -0.375), k = (tau - tm) / (1 - tm);
  return { tau: tau, fr: frm, phi: g.phiCoef * (1 - Math.pow(um, 0.625)) + g.ringRate * frm * (tau - tm), sep: g.sep0 * Math.pow(um, 0.25) * Math.max(0, 1 - k), amp: g.amp0 * Math.pow(frm, 0.66667) * Math.exp(-(tau - tm) / g.tauRing), merged: true };
}
function _gwstrain(g, x0, y0, t) {
  const r = Math.hypot(x0, y0), st = _gwphase(g, t - r / g.vWave), fall = g.r0 / (g.r0 + r);
  return -g.well * fall + st.amp * fall * Math.cos(2 * Math.atan2(y0, x0) - 2 * st.phi);
}
const _l3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const _surfRigs = SURFACES.map((sf) => {
  const nx = sf.grid.nx, ny = sf.grid.ny, w = sf.grid.w, d = sf.grid.d, N = nx * ny;
  const base = new Float32Array(N * 2); { let b = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { base[b++] = (i / (nx - 1) - 0.5) * w; base[b++] = (j / (ny - 1) - 0.5) * d; } }
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const index = []; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1; index.push(a, c, b, b, c, e); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide }));
  scene.add(mesh);
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.2); sun.position.set(sf.sun[0], sf.sun[1], sf.sun[2]); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x3a5a7a, 0.7));
  const floats = (sf.floaters || []).map((fl) => { const m = new THREE.Mesh(new THREE.SphereGeometry(fl.r || 1.2, 18, 12), new THREE.MeshStandardMaterial({ color: fl.color || 0xff5a4a, roughness: 0.5 })); scene.add(m); return { fl, m }; });
  // gravity-wave mode: the inspiralling binary (two bodies) + the merged remnant, carried in-script so
  // they stay locked to the strain phase; a small HUD shows the chirping GW frequency + state.
  let gwr = null;
  if (sf.gw) {
    const g = sf.gw;
    const mkBody = (rad, color) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 22, 16), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 1 })); scene.add(m); return m; };
    const rem = mkBody(Math.cbrt(g.r1 * g.r1 * g.r1 + g.r2 * g.r2 * g.r2), g.cRemnant); rem.material.opacity = 0;
    const hud = document.createElement('div'); hud.className = 'moj-readout'; wrap.appendChild(hud);
    gwr = { g: g, m1: mkBody(g.r1, g.c1), m2: mkBody(g.r2, g.c2), rem: rem, hud: hud };
  }
  return { sf, nx, ny, N, base, pos, nor, col, geo, floats, gwr };
});
stepSurfaces = (ms) => {
  const t = ms / 1000;
  for (const r of _surfRigs) {
    const sf = r.sf, amax = sf.amax || 1, deep = sf.deep, surf = sf.surf, crest = sf.crest;
    if (sf.gw) {
      const g = sf.gw, nxx = r.nx, nyy = r.ny;
      // pass 1: strain heights.
      for (let v = 0; v < r.N; v++) { const x0 = r.base[2 * v], y0 = r.base[2 * v + 1], o = 3 * v; r.pos[o] = x0; r.pos[o + 1] = y0; r.pos[o + 2] = _gwstrain(g, x0, y0, t); }
      // pass 2: normals (central differences on the height grid) + height colour.
      const dx = sf.grid.w / (nxx - 1), dy = sf.grid.d / (nyy - 1);
      for (let j = 0; j < nyy; j++) for (let i = 0; i < nxx; i++) {
        const v = j * nxx + i, o = 3 * v;
        const zl = r.pos[3 * (j * nxx + (i > 0 ? i - 1 : i)) + 2], zr = r.pos[3 * (j * nxx + (i < nxx - 1 ? i + 1 : i)) + 2];
        const zd = r.pos[3 * ((j > 0 ? j - 1 : j) * nxx + i) + 2], zu = r.pos[3 * ((j < nyy - 1 ? j + 1 : j) * nxx + i) + 2];
        const gx = (zr - zl) / (2 * dx), gy = (zu - zd) / (2 * dy), inv = 1 / (Math.hypot(gx, gy, 1) || 1);
        r.nor[o] = -gx * inv; r.nor[o + 1] = -gy * inv; r.nor[o + 2] = inv;
        // diverging strain colour: peel the static well off (ripple = z + well·fall), normalise by the
        // LOCAL falloff envelope so the arms stay vivid edge-to-edge (not drowned by 1/r), a contrast
        // curve, then cool-trough ↔ navy-rest ↔ bright-crest; the central well stays a touch dimmer.
        const x0 = r.base[2 * v], y0 = r.base[2 * v + 1], rr = Math.hypot(x0, y0), fall = g.r0 / (g.r0 + rr);
        let s = (r.pos[o + 2] + g.well * fall) / (amax * Math.max(0.18, fall));
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        const sc = (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.7), cc = sc >= 0 ? _l3(surf, crest, sc) : _l3(surf, deep, -sc), dim = 1 - 0.4 * fall;
        r.col[o] = cc[0] * dim; r.col[o + 1] = cc[1] * dim; r.col[o + 2] = cc[2] * dim;
      }
      r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
      if (r.gwr) {
        const st = _gwphase(g, t), hx = Math.cos(st.phi), hy = Math.sin(st.phi);
        const p1x = hx * st.sep * g.frac1, p1y = hy * st.sep * g.frac1, p2x = -hx * st.sep * g.frac2, p2y = -hy * st.sep * g.frac2;
        const fIn = Math.min(1, st.tau / 0.06);
        r.gwr.m1.position.set(p1x, p1y, _gwstrain(g, p1x, p1y, t) + g.r1 * 0.6); r.gwr.m1.material.opacity = st.merged ? 0 : fIn;
        r.gwr.m2.position.set(p2x, p2y, _gwstrain(g, p2x, p2y, t) + g.r2 * 0.6); r.gwr.m2.material.opacity = st.merged ? 0 : fIn;
        const remOp = st.merged ? Math.exp(-(st.tau - g.tauMerge) / g.tauRing) : 0;
        r.gwr.rem.position.set(0, 0, _gwstrain(g, 0, 0, t) + g.r1 * 0.6); r.gwr.rem.material.opacity = Math.max(0, Math.min(1, remOp));
        const state = !st.merged ? 'inspiral' : (remOp > 0.15 ? 'ringdown' : 'merger');
        r.gwr.hud.innerHTML = '<b>gravitational waves</b><span>f<sub>GW</sub> ' + (g.fGwHz * st.fr).toFixed(g.fGwHz < 5 ? 2 : 0) + ' Hz</span><span>M<sub>chirp</sub> ' + g.chirpMassMsun + ' M☉</span><span class="v">' + state + '</span>';
      }
      continue;
    }
    for (let v = 0; v < r.N; v++) {
      const x0 = r.base[2 * v], y0 = r.base[2 * v + 1];
      const g = sf.sources ? _wavefield(sf, x0, y0, t) : _gerstner(sf.waves, x0, y0, t), inv = 1 / (Math.hypot(g[3], g[4], g[5]) || 1), o = 3 * v;
      r.pos[o] = g[0]; r.pos[o + 1] = g[1]; r.pos[o + 2] = g[2];
      r.nor[o] = g[3] * inv; r.nor[o + 1] = g[4] * inv; r.nor[o + 2] = g[5] * inv;
      const hf = Math.max(0, Math.min(1, 0.5 + g[2] / (2 * amax)));
      let cc = _l3(deep, surf, hf);
      const foam = Math.max(0, Math.min(1, (g[2] / amax - 0.5) / 0.5));
      cc = _l3(cc, crest, foam * 0.85);
      r.col[o] = cc[0]; r.col[o + 1] = cc[1]; r.col[o + 2] = cc[2];
    }
    r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
    for (const fo of r.floats) { const g = _gerstner(sf.waves, fo.fl.x, fo.fl.y, t); fo.m.position.set(g[0], g[1], g[2] + (fo.fl.r || 1.2) * 0.55); }
  }
};`;
}
