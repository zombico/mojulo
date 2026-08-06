import { safeJson } from '../emit-util.js';

// In-page script: the STAR-SURFACE channel (star-surface-view). A self-luminous UV-sphere whose
// per-vertex colour is a BLACKBODY map (Planck locus, Kelvin → RGB) of a live TEMPERATURE field:
//   T(vertex, t) = Tbase + granulation(Worley cells, boiling) + spots(cool patches in active bands)
// then dimmed by LIMB DARKENING — a view-dependent term (needs the camera direction, unlike every
// other mesh channel). Material is MeshBasicMaterial (unlit): a star emits its own light, so there is
// no shaded terminator; the sphere reads as 3-D purely from limb darkening, which is physically why a
// real disc looks solid. Differential rotation shears the field (equator faster than poles). The
// colour physics is honest (temperature → true hue); the granulation is a phenomenological cell model,
// not magnetoconvection. Only emitted with `starSurfaces`.
export function starSurfaceChannelScript(starSurfaces) {
  return `
const STARSURFACES = ${safeJson(starSurfaces)};
// Planck blackbody locus (Tanner-Helland approximation), Kelvin → linear-ish sRGB in [0,1].
function _bbColor(T) {
  const t = Math.max(1000, Math.min(40000, T)) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [Math.max(0, Math.min(255, r)) / 255, Math.max(0, Math.min(255, g)) / 255, Math.max(0, Math.min(255, b)) / 255];
}
const _hash3 = (i, j, k) => { let n = (i * 374761393 + j * 668265263 + k * 1274126177) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
const _sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
const _starRigs = STARSURFACES.map((st) => {
  const rig = __uvSphereRig(st.radius, st.nlat, st.nlon);   // shared UV-sphere (self-luminous material)
  const mesh = new THREE.Mesh(rig.geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(mesh);
  const limbNorm = st.limb[0] + st.limb[1] + st.limb[2];   // I(μ=1) — normalise disc centre to ~1
  return { st, N: rig.N, pos: rig.pos, nrm: rig.nor, col: rig.col, geo: rig.geo, limbNorm };
});
stepStarSurfaces = (ms) => {
  const t = ms / 1000;
  const cpx = camera.position.x, cpy = camera.position.y, cpz = camera.position.z;
  for (const r of _starRigs) {
    const st = r.st, spots = st.spots || [], boil = st.granBoil, freq = st.granFreq;
    // artistic tint (declared): a final presentational multiply. Physical photospheres are near-white,
    // but people picture the Sun yellow, so the sun scenario carries a warm-gold tint; the other stars
    // keep it neutral and stay true to Planck. Chromaticity honest, this one grade owned up to.
    const tint = st.tint || [1, 1, 1];
    // pre-rotate each spot's centre by its own latitude-dependent differential-rotation angle.
    const scen = spots.map((sp) => {
      const ang = st.omegaEq * (1 - st.diffRot * sp.c[2] * sp.c[2]) * t, ca = Math.cos(ang), sa = Math.sin(ang);
      return { x: sp.c[0] * ca - sp.c[1] * sa, y: sp.c[0] * sa + sp.c[1] * ca, z: sp.c[2], cosUmbra: sp.cosUmbra, cosPenu: sp.cosPenu, dTumbra: sp.dTumbra, dTpenu: sp.dTpenu };
    });
    for (let vi = 0; vi < r.N; vi++) {
      const o = 3 * vi, nx = r.nrm[o], ny = r.nrm[o + 1], nz = r.nrm[o + 2];
      // differential rotation: sample the granulation field in a frame spun by φ(lat) (equator faster).
      const phi = st.omegaEq * (1 - st.diffRot * nz * nz) * t, cp = Math.cos(-phi), sp = Math.sin(-phi);
      const sx = (nx * cp - ny * sp) * freq, sy = (nx * sp + ny * cp) * freq, sz = nz * freq;
      // Worley F1/F2 over the 27 neighbouring lattice cells — animated feature points ⇒ boiling cells.
      const xi = Math.floor(sx), yi = Math.floor(sy), zi = Math.floor(sz);
      let f1 = 9, f2 = 9;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
        const cx = xi + di, cy = yi + dj, cz = zi + dk;
        const fx = cx + 0.5 + 0.42 * Math.sin(6.2831853 * (_hash3(cx, cy, cz) + boil * t));
        const fy = cy + 0.5 + 0.42 * Math.sin(6.2831853 * (_hash3(cx + 11, cy, cz) + boil * t));
        const fz = cz + 0.5 + 0.42 * Math.sin(6.2831853 * (_hash3(cx, cy + 17, cz) + boil * t));
        const dx = fx - sx, dy = fy - sy, dz = fz - sz, dd = dx * dx + dy * dy + dz * dz;
        if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
      }
      const edge = Math.sqrt(f2) - Math.sqrt(f1);            // small at cell boundaries (the dark lanes)
      const gran = st.granAmp * (_sstep(0, st.laneW, edge) - st.granBias);
      // spots: cool patches (umbra core + penumbra ring) wherever the vertex falls inside one.
      let spotDT = 0;
      for (let s = 0; s < scen.length; s++) {
        const sc = scen[s], d = nx * sc.x + ny * sc.y + nz * sc.z;
        if (d > sc.cosUmbra) spotDT += sc.dTumbra;
        else if (d > sc.cosPenu) spotDT += sc.dTpenu * _sstep(sc.cosPenu, sc.cosUmbra, d);
      }
      const T = st.Tbase + gran + spotDT;
      const rgb = _bbColor(T);
      // Stefan–Boltzmann luminance: a patch emits ∝ T⁴, normalised to the star's own base temperature —
      // THIS is why a cooler sunspot looks dark, not just oranger (colour alone misses it). Capped so a
      // hot granule doesn't blow out. Chromaticity from Planck, brightness from T⁴ — both honest.
      const lum = Math.min(1.7, Math.pow(T / st.Tbase, 4));
      // limb darkening: dim toward the disc edge by I(μ)/I(1), μ = cos(normal, view).
      const vx = cpx - r.pos[o], vy = cpy - r.pos[o + 1], vz = cpz - r.pos[o + 2], vl = Math.hypot(vx, vy, vz) || 1;
      let mu = (nx * vx + ny * vy + nz * vz) / vl; if (mu < 0) mu = 0;
      const L = Math.max(0, (st.limb[0] + st.limb[1] * mu + st.limb[2] * mu * mu) / r.limbNorm) * st.brightness * lum;
      r.col[o] = rgb[0] * L * tint[0]; r.col[o + 1] = rgb[1] * L * tint[1]; r.col[o + 2] = rgb[2] * L * tint[2];
    }
    r.geo.attributes.color.needsUpdate = true;
  }
};`;
}
