/**
 * THE HUBCAP DISC — a car's wheel seen to turn. A car's wheels are baked into its body's trim (geotown/cars.js carModel), so
 * the page cannot turn them; and a wheel turning reads as nothing unless something on it is not round. So on each wheel
 * of a car the page moves (the one driven, channels/cab-pool.js; the traffic, channels/flow.js) a thin disc stands just
 * outside its face, a rim of spokes, light and dark by turns, turned about the axle as the wheel would turn: by the
 * ground covered over the wheel's radius.
 *
 *   HUB_DISC          { spokes, rim (of the wheel's radius), out (m off its face), light, dark, cap }
 *   hubDiscSource()   → the page's `__hubDisc(r)`: the disc's geometry for a wheel of radius r (its plane the wheel's,
 *                       facing +x, a side's own is mirrored), made once a radius; `__hubSpin(m, hub, angle)`: a disc's
 *                       matrix on its car (`m` the car's) at its hub, turned `angle` about the axle
 *
 * Car frame: +y its nose, +x its right, z up; a hub `{ at, r, side }` its outer face's centre (carModel `hubs`).
 */
export const HUB_DISC = Object.freeze({ spokes: 5, rim: 0.74, out: 0.012, light: '#c3c7cb', dark: '#2b2e33', cap: '#8d9298' });

export function hubDiscSource() {
  const D = HUB_DISC, hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  return `
// --- the hubcap discs: a wheel seen to turn (channels/hub-disc.js) ---
const __HUBD = ${JSON.stringify({ n: D.spokes * 2, rim: D.rim, out: D.out, light: hex(D.light), dark: hex(D.dark), cap: hex(D.cap) })};
const __hubGeos = new Map();
function __hubDisc(r) {
  const key = Math.round(r * 1000);
  if (__hubGeos.has(key)) return __hubGeos.get(key);
  const P = [], C = [], R = r * __HUBD.rim, n = __HUBD.n, put = (y, z, c) => { P.push(0, y, z); C.push(c[0], c[1], c[2]); };
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, c = i % 2 ? __HUBD.dark : __HUBD.light;
    put(0, 0, c); put(Math.cos(a0) * R, Math.sin(a0) * R, c); put(Math.cos(a1) * R, Math.sin(a1) * R, c);
  }
  // (and a small cap over the middle, a touch off the spokes)
  for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2, rc = R * 0.22; P.push(0.004, 0, 0, 0.004, Math.cos(a0) * rc, Math.sin(a0) * rc, 0.004, Math.cos(a1) * rc, Math.sin(a1) * rc); for (let k = 0; k < 3; k++) C.push(__HUBD.cap[0], __HUBD.cap[1], __HUBD.cap[2]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  __hubGeos.set(key, g);
  return g;
}
const __hubMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const __hubT = new THREE.Matrix4(), __hubR = new THREE.Matrix4(), __hubS = new THREE.Matrix4();
// (a disc's matrix on its car: the car's, then its hub just off the wheel's face, its side's mirror, turned about the axle)
function __hubSpin(m, hub, angle, out) {
  __hubT.makeTranslation(hub.at[0] + hub.side * __HUBD.out, hub.at[1], hub.at[2]);
  __hubS.makeScale(hub.side, 1, 1);
  __hubR.makeRotationX(-angle);
  return out.copy(m).multiply(__hubT).multiply(__hubS).multiply(__hubR);
}
`;
}
