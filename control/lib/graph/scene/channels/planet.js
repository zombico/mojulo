import { safeJson } from '../emit-util.js';

// In-page script: the PLANET channel (orbit-view orrery bodies). A lit UV-sphere per body, so a planet
// reads as a real 3-D world with a day/night terminator instead of a lathe "onion". Each mesh registers
// into the shared `meshes` map under its group name, and the channel is emitted BEFORE the mover channel
// so an orbit mover binds and translates it exactly like the old face body did. Geometry is built at the
// ORIGIN (the body mover carries base = [0,0,0]); a slow axial spin about the sphere's own polar axis
// (z, the orbital normal) runs each frame. Per-vertex colour is texture-free and procedural — base tint ×
// (latitude banding + a hashed value-noise mottle) — so every body is a distinct world with no external
// assets. A `star` body is self-luminous (MeshBasicMaterial) and drops a point light at its centre plus
// an ambient fill: the sun lighting the system from the focus. Reuses __uvSphereRig. Only with `planets`.
export function planetChannelScript(planets) {
  return `
const PLANETS = ${safeJson(planets)};
const _plHash = (i, j, k) => { let n = (i * 374761393 + j * 668265263 + k * 1274126177) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
const _plHasStar = PLANETS.some((p) => p.star);   // a star lights the scene from its focus; else a studio rig
const _planetRigs = PLANETS.map((pl) => {
  const rig = __uvSphereRig(pl.radius, pl.nlat || 30, pl.nlon || 40);   // shared UV-sphere, built at the origin
  const base = pl.tint || [0.6, 0.6, 0.6], bands = pl.bands != null ? pl.bands : 0.5;
  for (let vi = 0; vi < rig.N; vi++) {
    const o = 3 * vi, nx = rig.nor[o], ny = rig.nor[o + 1], nz = rig.nor[o + 2];
    // latitude banding (nz = cos θ) + a cheap hashed value-noise mottle sampled on the unit sphere.
    const band = 1 + bands * Math.sin((pl.seed || 0) + nz * (pl.freq || 6));
    const noise = _plHash(Math.floor((nx + 1) * 6), Math.floor((ny + 1) * 6), Math.floor((nz + 1) * 6));
    const shade = 0.7 + 0.3 * (band * 0.5) + (noise - 0.5) * (pl.mottle != null ? pl.mottle : 0.18);
    rig.col[o] = Math.min(1, base[0] * shade); rig.col[o + 1] = Math.min(1, base[1] * shade); rig.col[o + 2] = Math.min(1, base[2] * shade);
  }
  rig.geo.attributes.color.needsUpdate = true;
  const opacity = pl.opacity != null ? pl.opacity : 1, translucent = opacity < 1;
  const matOpts = { vertexColors: true, transparent: translucent, opacity, depthWrite: !translucent, side: translucent ? THREE.DoubleSide : THREE.FrontSide };
  const mat = pl.star
    ? new THREE.MeshBasicMaterial(matOpts)                                        // self-luminous star
    : new THREE.MeshStandardMaterial({ ...matOpts, roughness: pl.rough != null ? pl.rough : 0.85, metalness: 0.03 });
  const mesh = new THREE.Mesh(rig.geo, mat);
  const c = pl.center || [0, 0, 0];
  mesh.position.set(c[0], c[1], c[2]);           // static placement; a mover (base [0,0,0]) overrides per frame
  if (translucent) mesh.renderOrder = 1;         // translucent shells (cell envelope) draw after opaque bodies
  mesh.userData.g = pl.group;                    // group name → pick lookup (PICK_META)
  scene.add(mesh);
  meshes[pl.group] = mesh;                        // <-- the mover channel (emitted after) binds this by group name
  solids.push(mesh);                             // pickable + wireframe toggle; a no-pick shell is hit then skipped (pass-through)
  if (pl.star) { const sun = new THREE.PointLight(0xfff2d8, 2.6, 0, 0); sun.position.set(c[0], c[1], c[2]); scene.add(sun); }
  return { mesh, spin: pl.spin || 0 };
});
if (_planetRigs.length) {
  if (_plHasStar) { scene.add(new THREE.AmbientLight(0x24304a, 0.6)); }
  else { const _pd = new THREE.DirectionalLight(0xffffff, 1.05); _pd.position.set(0.5, -0.8, 1.0); scene.add(_pd); scene.add(new THREE.AmbientLight(0x8894a8, 0.85)); }
}
stepPlanets = (ms) => {
  const t = ms / 1000;
  for (const r of _planetRigs) { if (r.spin) r.mesh.rotation.z = t * r.spin; }
};`;
}
