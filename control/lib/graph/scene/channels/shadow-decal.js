import { safeJson } from '../emit-util.js';

// In-page script: lay each shadow decal as a flat dark radial quad just above the floor.
// depthWrite:false + a small z-lift avoid z-fighting the floor; normal-blended dark colour
// with a radial alpha texture darkens the ground (the World twin of the CSS dark `bg` pool).
export function shadowDecalScript(decals) {
  return `
// --- shadow decals (cast / contact) ---
const SHADOWS = ${safeJson(decals)};
const shadowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
  return new THREE.CanvasTexture(cv);
})();
for (const d of SHADOWS) {
  const q = d.quad, Z = 0.03;
  const pos = new Float32Array([
    q[0][0], q[0][1], q[0][2] + Z, q[1][0], q[1][1], q[1][2] + Z, q[2][0], q[2][1], q[2][2] + Z,
    q[0][0], q[0][1], q[0][2] + Z, q[2][0], q[2][1], q[2][2] + Z, q[3][0], q[3][1], q[3][2] + Z]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshBasicMaterial({ map: shadowTex, color: new THREE.Color(d.color[0] / 255, d.color[1] / 255, d.color[2] / 255),
    transparent: true, opacity: d.alpha, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 0.5; // over the floor, under additive glow
  scene.add(m);
}`;
}
