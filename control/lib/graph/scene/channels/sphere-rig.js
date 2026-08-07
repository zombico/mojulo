// Shared UV-sphere rig for the scalar-field sphere channels (heat-sphere + star-surface). Builds the
// indexed BufferGeometry ONCE — position + normal + colour attributes — and hands back the typed arrays
// so each channel writes per-vertex colour every frame. This is the ONLY thing the two channels share:
// their field maths, materials and lighting stay their own (Stage 6 of star-surface-view.plan.md — the
// merged-channel guess was wrong; the genuine duplicate was just this geometry build). Emitted once when
// either channel is present. `normal.z` doubles as cos θ, so the heat channel needs no separate array.
export function sphereRigPreamble() {
  return `
function __uvSphereRig(radius, nlat, nlon) {
  const rows = nlat + 1, cols = nlon + 1, N = rows * cols;
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let v = 0;
  for (let i = 0; i < rows; i++) {
    const th = Math.PI * (i / nlat), ct = Math.cos(th), sth = Math.sin(th);
    for (let j = 0; j < cols; j++) {
      const ph = 2 * Math.PI * (j / nlon), o = 3 * v, x = sth * Math.cos(ph), y = sth * Math.sin(ph), z = ct;
      pos[o] = radius * x; pos[o + 1] = radius * y; pos[o + 2] = radius * z;   // z-up: poles on the z axis
      nor[o] = x; nor[o + 1] = y; nor[o + 2] = z; v++;
    }
  }
  const index = [];
  for (let i = 0; i < nlat; i++) for (let j = 0; j < nlon; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; index.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  return { N, pos, nor, col, geo };
}`;
}
