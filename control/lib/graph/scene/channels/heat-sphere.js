import { safeJson } from '../emit-util.js';

// In-page script: the HEAT-SPHERE channel (heat-sphere-view). A UV-sphere mesh built ONCE, whose
// per-vertex COLOUR is recomputed every frame from an exact solution of the heat equation on the
// sphere: T(θ,t) = Σₗ aₗ·Pₗ(cosθ)·e^(−l(l+1)κt). The Legendre coefficients aₗ are baked (a projection
// of the scenario's initial temperature profile); the mode DECAYS e^(−l(l+1)κt) are recomputed once
// per frame (they depend only on t, not on the vertex), so each vertex only runs the cheap Legendre
// recurrence × coeff × decay. Time sweeps 0→tSpan (a sharp pole-to-pole split diffusing to uniform),
// holds, then resets. Colour is a diverging cold→neutral→hot map, so hue IS temperature. Uses a
// MeshStandardMaterial + a soft sun so the ball reads as a 3-D solid; existing basic-material world
// meshes ignore the added light. Only emitted with `heatSpheres`.

export function heatSphereChannelScript(heatSpheres) {
  return `
const HEATSPHERES = ${safeJson(heatSpheres)};
const _hsL3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const _hsRigs = HEATSPHERES.map((hs) => {
  const rig = __uvSphereRig(hs.radius, hs.nlat, hs.nlon);   // shared UV-sphere; normal.z IS cos θ
  const mesh = new THREE.Mesh(rig.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 }));
  scene.add(mesh);
  const sun = new THREE.DirectionalLight(0xffffff, 1.05); sun.position.set(hs.sun[0], hs.sun[1], hs.sun[2]); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8894a8, 0.85));
  return { hs, N: rig.N, nor: rig.nor, col: rig.col, geo: rig.geo, decay: new Float64Array(hs.coeffs.length) };
});
stepHeatSpheres = (ms) => {
  for (const r of _hsRigs) {
    const hs = r.hs, coeffs = hs.coeffs, L = coeffs.length - 1;
    // loop time → diffusion time. Sweep 0→tSpan over (1−holdFrac) of the loop, then HOLD near-uniform.
    let p = (ms % hs.loopMs) / hs.loopMs; if (p < 0) p += 1;
    const active = Math.min(1, p / (1 - hs.holdFrac));
    const tDiff = hs.tSpan * Math.pow(active, 1.35);   // linger a touch on the crisp initial split
    // per-frame mode decays e^(−l(l+1)κ t) — computed once, shared by every vertex.
    for (let l = 0; l <= L; l++) r.decay[l] = coeffs[l] * Math.exp(-l * (l + 1) * hs.kappa * tDiff);
    const cold = hs.cold, mid = hs.mid, hot = hs.hot;
    for (let vi = 0; vi < r.N; vi++) {
      const o = 3 * vi, x = r.nor[o + 2];   // cos θ = the vertex normal's z-component
      // T = Σ decay[l]·Pₗ(x), Legendre recurrence l·Pₗ = (2l−1)x·Pₗ₋₁ − (l−1)·Pₗ₋₂.
      let pm2 = 1, pm1 = x, T = r.decay[0] * pm2 + (L >= 1 ? r.decay[1] * pm1 : 0);
      for (let l = 2; l <= L; l++) {
        const pl = ((2 * l - 1) * x * pm1 - (l - 1) * pm2) / l;
        T += r.decay[l] * pl; pm2 = pm1; pm1 = pl;
      }
      T = T < -1 ? -1 : T > 1 ? 1 : T;
      const s = (T + 1) / 2, cc = s < 0.5 ? _hsL3(cold, mid, s * 2) : _hsL3(mid, hot, (s - 0.5) * 2);
      r.col[o] = cc[0] / 255; r.col[o + 1] = cc[1] / 255; r.col[o + 2] = cc[2] / 255;
    }
    r.geo.attributes.color.needsUpdate = true;
  }
};`;
}
