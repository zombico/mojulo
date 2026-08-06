import { safeJson } from '../emit-util.js';

// In-page script: crease "ink" decals — the soft contact-shadow feather, the WebGL twin of the
// CSS-3D gradient band. Unlike the radial shadow blob this is a DIRECTIONAL linear gradient
// (opaque at the crease edge → transparent across the band), so a wall/ground valley reads as a
// soft feather hugging the edge. Quad corner order is [crease0, crease1, outer1, outer0]; the UV
// puts texture-v=0 (opaque) on the crease pair. polygonOffset + depthWrite:false keep the near-
// coplanar band off the surface it sits on (the z-fight fix, for this pass).
export function inkDecalScript(inks) {
  return `
// --- ink (crease feather) decals ---
const INKS = ${safeJson(inks)};
const inkTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.38, 'rgba(255,255,255,0.38)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(cv); t.flipY = false; return t;
})();
for (const d of INKS) {
  const q = d.quad;
  const pos = new Float32Array([
    q[0][0], q[0][1], q[0][2], q[1][0], q[1][1], q[1][2], q[2][0], q[2][1], q[2][2],
    q[0][0], q[0][1], q[0][2], q[2][0], q[2][1], q[2][2], q[3][0], q[3][1], q[3][2]]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshBasicMaterial({ map: inkTex, color: new THREE.Color(d.color[0] / 255, d.color[1] / 255, d.color[2] / 255),
    transparent: true, opacity: d.alpha, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 0.55;
  scene.add(m);
}`;
}
