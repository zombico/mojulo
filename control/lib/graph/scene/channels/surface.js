import { safeJson } from '../emit-util.js';

// In-page script: the SURFACE channel. The other channels move discrete things (sprites, bodies,
// arrows); a surface DEFORMS a continuous mesh over time — an animated ocean. It builds a grid
// BufferGeometry once, then every frame recomputes position + normal + colour from a Gerstner
// "waveform sequence" (a sum of moving wave trains): P.z = Σ A·sin θ, with the Gerstner horizontal
// pull P.xy += Σ Q·A·D·cos θ that sharpens crests, plus analytic normals so the surface is LIT.
// Unlike the basic-material world meshes, the ocean uses a MeshStandardMaterial + a sun light (added
// here), so existing scenes are unaffected (basic materials ignore the light). Buoys ride the surface
// (sampling the same displacement → the circular orbital water motion). Only emitted with `surfaces`.
// A surface may also carry a `shore` descriptor (beach-view): the wave height + slope taper to zero as
// the bed rises to the waterline (shoaling), shallows lighten, and a foam swash line laps up the sand.
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
  // optional grid CENTRE offset — the sheet is centred at origin by default, but a surface can be placed
  // anywhere (cx, cy) so the water composes next to other geometry (e.g. a sea at a city's waterfront).
  const cx = sf.grid.cx || 0, cy = sf.grid.cy || 0;
  const base = new Float32Array(N * 2); { let b = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { base[b++] = (i / (nx - 1) - 0.5) * w + cx; base[b++] = (j / (ny - 1) - 0.5) * d + cy; } }
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3);
  // RIVER mode precompute (done ONCE): project every grid vertex onto the winding centreline → its
  // lateral distance to the water, its along-stream arc length, and the water-surface level there
  // (which descends downstream). Per frame only the ripple/streak phase scrolls, so this stays cheap.
  let riv = null;
  if (sf.river) {
    const P = sf.river.pts, cum = [0];
    for (let i = 1; i < P.length; i++) cum[i] = cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const lvl = new Float32Array(N), arc = new Float32Array(N), lat = new Float32Array(N);
    for (let v = 0; v < N; v++) {
      const x0 = base[2 * v], y0 = base[2 * v + 1];
      let best = 1e9, bs = 0, bl = 0;
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-6;
        let tt = ((x0 - a[0]) * dx + (y0 - a[1]) * dy) / L2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        const px = a[0] + dx * tt, py = a[1] + dy * tt, dd = Math.hypot(x0 - px, y0 - py);
        if (dd < best) { best = dd; bs = cum[i - 1] + Math.sqrt(L2) * tt; bl = a[2] + (b[2] - a[2]) * tt; }
      }
      lat[v] = best; arc[v] = bs; lvl[v] = bl;
    }
    riv = { lvl, arc, lat, cum, total: cum[cum.length - 1], pts: P };
  }
  // SPOUT precompute (once): a falling SHEET of water bent onto an arc (a spillway veil, a weir
  // nappe). The grid's u runs across the sheet, v runs down the arc (uniform in arc length); each
  // vertex stores its 3D base position on the arc, the sheet normal in the y–z plane (ripples
  // displace along it), and its arc length (ripples + streaks phase-advect along it, like river).
  let spt = null;
  if (sf.spout) {
    const SP = sf.spout, P = SP.path, cum = [0];
    for (let i = 1; i < P.length; i++) cum[i] = cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const total = cum[cum.length - 1] || 1;
    const bx = new Float32Array(N), by = new Float32Array(N), bz = new Float32Array(N);
    const nny = new Float32Array(N), nnz = new Float32Array(N), arc = new Float32Array(N), uu = new Float32Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = j * nx + i, u = nx > 1 ? i / (nx - 1) : 0, s = (ny > 1 ? j / (ny - 1) : 0) * total;
      let seg = 1; while (seg < cum.length - 1 && cum[seg] < s) seg++;
      const a = P[seg - 1], b = P[seg], L = (cum[seg] - cum[seg - 1]) || 1, tt = (s - cum[seg - 1]) / L;
      const ty = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;                    // arc tangent (y–z)
      bx[v] = SP.x0 + u * (SP.x1 - SP.x0);
      by[v] = a[0] + (b[0] - a[0]) * tt; bz[v] = a[1] + (b[1] - a[1]) * tt;
      const sgn = SP.flip ? -1 : 1;                                            // outward sheet normal (the −y, open-air side)
      nny[v] = tz * sgn; nnz[v] = -ty * sgn;
      arc[v] = s; uu[v] = u;
    }
    spt = { bx, by, bz, ny: nny, nz: nnz, arc, u: uu, total };
  }
  const index = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
    // river: drop cells fully outside the banks so the water mesh IS the winding ribbon (no dry apron).
    if (riv && Math.min(riv.lat[a], riv.lat[b], riv.lat[c], riv.lat[e]) >= sf.river.bank) continue;
    index.push(a, c, b, b, c, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  const _mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  // opt-in emissive glow (a molten/lava surface lights itself, no sun needed): sf.emissive = [r,g,b] 0..1.
  if (sf.emissive) { _mat.emissive = new THREE.Color(sf.emissive[0], sf.emissive[1], sf.emissive[2]); _mat.emissiveIntensity = sf.emissiveIntensity != null ? sf.emissiveIntensity : 0.7; }
  const mesh = new THREE.Mesh(geo, _mat);
  scene.add(mesh);
  // a beach (sf.shore) or river (sf.river) is daylit: a stronger, warmer sun so the moving water catches
  // light/shade and a brighter sky ambient. The open ocean keeps its moody deep-sea key.
  const _day = sf.shore || sf.river;
  // noLights: a scene with MANY surfaces (a spillway's per-gate spouts) adds its lights once —
  // extra sheets opt out so ambient light doesn't stack additively per surface.
  if (!sf.noLights) {
    const sun = new THREE.DirectionalLight(_day ? 0xfff4e0 : 0xfff1d8, _day ? 2.1 : 1.2); sun.position.set(sf.sun[0], sf.sun[1], sf.sun[2]); scene.add(sun);
    scene.add(new THREE.AmbientLight(_day ? 0x8fc7dd : 0x3a5a7a, _day ? 0.5 : 0.7));
  }
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
  return { sf, nx, ny, N, base, pos, nor, col, geo, floats, gwr, riv, spt };
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
    if (sf.spout) {
      // a falling SHEET (spillway veil): ripples ride DOWN the arc along the sheet normal, streak
      // bands slide down with it and stretch as the fall speeds up, and the foot froths white —
      // the river-mode treatment bent onto a vertical fall. deep = the lip tint, surf = the body,
      // crest = foam. Streak identity is a per-strip hash of u, seeded, so the veil is deterministic.
      const SP = sf.spout, sp = r.spt, k = (Math.PI * 2) / (SP.lam || 4), om = k * (SP.speed || 9);
      const strips = SP.strips || 6, accel = SP.accel == null ? 1.6 : SP.accel, seed = SP.seed || 1;
      const hashU = (su) => { const x = Math.sin(su * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
      for (let v = 0; v < r.N; v++) {
        const o = 3 * v, s = sp.arc[v], u = sp.u[v], vFrac = s / sp.total;
        const su = Math.floor(u * strips) / strips, hu = hashU(su);
        const ph = k * s - om * (1 + accel * vFrac) * t + hu * 6.2832;
        const rip = (SP.amp || 0.15) * (Math.sin(ph) + 0.35 * Math.sin(2.3 * ph + 1.7 + 4 * u));
        r.pos[o] = sp.bx[v]; r.pos[o + 1] = sp.by[v] + sp.ny[v] * rip; r.pos[o + 2] = sp.bz[v] + sp.nz[v] * rip;
        r.nor[o] = 0; r.nor[o + 1] = sp.ny[v]; r.nor[o + 2] = sp.nz[v];
        let cc = _l3(deep, surf, Math.pow(vFrac, 0.8));                     // brightens as it falls
        const streak = 0.5 + 0.5 * Math.sin(ph);
        cc = _l3(cc, crest, Math.pow(streak, 3) * (0.25 + 0.3 * hu));       // sliding white bands
        if (vFrac > 0.72) cc = _l3(cc, crest, (vFrac - 0.72) / 0.28 * 0.85); // the plunge froths
        r.col[o] = cc[0]; r.col[o + 1] = cc[1]; r.col[o + 2] = cc[2];
      }
      r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
      continue;
    }
    if (sf.river) {
      // a winding RIVER flowing one way: the surface sits at the (downstream-descending) water level,
      // carries ripples that travel DOWNSTREAM along the arc, tapers to the banks, and scrolls bright
      // flow streaks + drifts leaves downstream — every cue points the same way, so the current reads.
      const R = sf.river, nxx = r.nx, nyy = r.ny, k = (Math.PI * 2) / (R.lam || 10), om = k * (R.flow || 7), rv = r.riv;
      const _edge = (dl) => dl < R.half ? 1 : Math.max(0, 1 - (dl - R.half) / (R.bank - R.half));
      // pass 1: heights.
      for (let v = 0; v < r.N; v++) {
        const x0 = r.base[2 * v], y0 = r.base[2 * v + 1], o = 3 * v; r.pos[o] = x0; r.pos[o + 1] = y0;
        if (rv.lat[v] >= R.bank) { r.pos[o + 2] = rv.lvl[v] - 40; continue; }   // dry (culled) → sink out of sight
        const ph = k * rv.arc[v] - om * t, rip = R.amp * (Math.sin(ph) + 0.4 * Math.sin(2.7 * ph + 1.3));
        r.pos[o + 2] = rv.lvl[v] + _edge(rv.lat[v]) * rip;
      }
      // pass 2: normals (central differences) + colour (downstream flow streaks + bank foam).
      const dxg = sf.grid.w / (nxx - 1), dyg = sf.grid.d / (nyy - 1);
      for (let j = 0; j < nyy; j++) for (let i = 0; i < nxx; i++) {
        const v = j * nxx + i, o = 3 * v;
        if (rv.lat[v] >= R.bank) { r.nor[o] = 0; r.nor[o + 1] = 0; r.nor[o + 2] = 1; continue; }
        const zl = r.pos[3 * (j * nxx + (i > 0 ? i - 1 : i)) + 2], zr = r.pos[3 * (j * nxx + (i < nxx - 1 ? i + 1 : i)) + 2];
        const zd = r.pos[3 * ((j > 0 ? j - 1 : j) * nxx + i) + 2], zu = r.pos[3 * ((j < nyy - 1 ? j + 1 : j) * nxx + i) + 2];
        const gx = (zr - zl) / (2 * dxg), gy = (zu - zd) / (2 * dyg), inv = 1 / (Math.hypot(gx, gy, 1) || 1);
        r.nor[o] = -gx * inv; r.nor[o + 1] = -gy * inv; r.nor[o + 2] = inv;
        const edge = _edge(rv.lat[v]), s = rv.arc[v];
        const hf = Math.max(0, Math.min(1, 0.5 + (r.pos[o + 2] - rv.lvl[v]) / (2 * R.amp + 1e-3)));
        let cc = _l3(deep, surf, hf);
        const streak = 0.5 + 0.5 * Math.sin(0.32 * s - om * 0.55 * t);   // bright bands sliding downstream
        cc = _l3(cc, crest, Math.pow(streak, 3) * 0.32);
        cc = _l3(cc, crest, (1 - edge) * 0.55);                          // foam where the water thins on the banks
        r.col[o] = cc[0]; r.col[o + 1] = cc[1]; r.col[o + 2] = cc[2];
      }
      r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
      // drifting leaves: floaters advected downstream (arc grows with time), riding the local level.
      for (const fo of r.floats) {
        const a = (((t * (fo.fl.driftSpeed || R.flow || 7) + (fo.fl.drift || 0) * rv.total) % rv.total) + rv.total) % rv.total;
        let i = 1; while (i < rv.cum.length - 1 && rv.cum[i] < a) i++;
        const A = rv.pts[i - 1], B = rv.pts[i], seg = (rv.cum[i] - rv.cum[i - 1]) || 1, tt = (a - rv.cum[i - 1]) / seg;
        const x = A[0] + (B[0] - A[0]) * tt, y = A[1] + (B[1] - A[1]) * tt, lv = A[2] + (B[2] - A[2]) * tt;
        fo.m.position.set(x, y, lv + R.amp * 0.4 * Math.sin(k * a - om * t) + (fo.fl.r || 0.5) * 0.5);
      }
      continue;
    }
    const S = sf.shore || null;
    // swash line: the foam edge runs UP the beach toward edgeY (0.5±0.5·sin) and retreats — the lapping.
    const swashEdge = S ? S.edgeY - S.swashRange * (0.5 - 0.5 * Math.sin(S.omSwash * t)) : 0;
    // SOLID masks (spillway/dam): footprint rects of world geometry the sheet must not pass through.
    // A vertex inside any rect sinks out of sight (the river mode's dry-bank trick) — the skirt this
    // leaves at the boundary hides inside the solid itself. grid.cz lifts the whole sheet, so water
    // can stand HIGH behind a wall (a reservoir at head) while a second sheet sits low in front.
    const _cz = sf.grid.cz || 0, _masks = sf.masks || null;
    for (let v = 0; v < r.N; v++) {
      const x0 = r.base[2 * v], y0 = r.base[2 * v + 1];
      const g = sf.sources ? _wavefield(sf, x0, y0, t) : _gerstner(sf.waves, x0, y0, t);
      // SHORE shoaling: taper wave height + slope to zero as the bed rises to the waterline, so the sea
      // flattens into the sand instead of clipping through it. sh runs 1 offshore to 0 at the waterline.
      let sh = 1;
      if (S) { sh = Math.max(0, Math.min(1, (S.edgeY - y0) / S.surfW)); const tp = sh * sh * (3 - 2 * sh); g[2] = g[2] * tp - (1 - tp) * (S.sink || 0); g[3] *= tp; g[4] *= tp; }
      const hw = g[2];   // wave height before the lift — the colour ramp reads THIS, not the offset z
      g[2] += _cz;
      if (_masks) for (let mi = 0; mi < _masks.length; mi++) { const M = _masks[mi]; if (x0 >= M[0] && x0 <= M[1] && y0 >= M[2] && y0 <= M[3]) { g[2] -= 40; break; } }
      const inv = 1 / (Math.hypot(g[3], g[4], g[5]) || 1), o = 3 * v;
      r.pos[o] = g[0]; r.pos[o + 1] = g[1]; r.pos[o + 2] = g[2];
      r.nor[o] = g[3] * inv; r.nor[o + 1] = g[4] * inv; r.nor[o + 2] = g[5] * inv;
      const hf = Math.max(0, Math.min(1, 0.5 + hw / (2 * amax)));
      let cc = _l3(deep, surf, hf);
      const foam = Math.max(0, Math.min(1, (hw / amax - 0.5) / 0.5));
      cc = _l3(cc, crest, foam * 0.85);
      if (S) {
        // shallows lighten toward the beach; whitecaps ride the crest tops so the travelling ripples
        // read; then a bright foam band glows where the swash currently laps the sand.
        if (S.shallow) cc = _l3(cc, S.shallow, (1 - sh) * 0.7);
        const caps = Math.max(0, (hw / amax - 0.04)) * 2.1;
        cc = _l3(cc, crest, Math.min(0.8, caps));
        // a persistent breaker line where the waves trip over the bar at the waterline, plus the moving
        // swash foam that runs up the sand and back — together they read as water lapping the shore.
        const breaker = Math.exp(-Math.pow((y0 - S.edgeY) / (S.foamW * 0.7), 2)) * 0.55;
        const fb = Math.exp(-Math.pow((y0 - swashEdge) / S.foamW, 2));
        cc = _l3(cc, crest, Math.min(1, Math.max(breaker, fb)));
      }
      r.col[o] = cc[0]; r.col[o + 1] = cc[1]; r.col[o + 2] = cc[2];
    }
    r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
    for (const fo of r.floats) {
      const g = _gerstner(sf.waves, fo.fl.x, fo.fl.y, t);
      let z = g[2];   // a buoy rides the SAME shore-tapered surface, so it sits right in deep water or shallows.
      if (S) { const fsh = Math.max(0, Math.min(1, (S.edgeY - fo.fl.y) / S.surfW)), tp = fsh * fsh * (3 - 2 * fsh); z = z * tp - (1 - tp) * (S.sink || 0); }
      fo.m.position.set(g[0], g[1], z + (fo.fl.r || 1.2) * 0.55);
    }
  }
};`;
}
