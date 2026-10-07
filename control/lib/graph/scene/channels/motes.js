import { safeJson } from '../emit-util.js';

// In-page script: DUST in the air (a room stage's atmosphere: era/stage.js). Motes scattered through the rooms' boxes,
// each lit by how near it hangs to a light (the torches' pools hold the bright ones; the dark between keeps a faint
// few), drifting slowly on their own small loops: still air underground, never a wind. Additive points, no depth
// write. Placement is a hash of the mote's index (the same page every load); the clock is window.__mojClock when a
// capture pins it.
// Absent `motes` ⇒ NOT emitted.
// `cfg`: { count, boxes: [[x0, y0, z0, x1, y1, z1], …], lights: [[x, y, z, radius], …], color: [r, g, b], size, drift }
export function motesScript(cfg) {
  return `
// --- motes: dust hanging in the air, lit where the light is ---
(function () {
  const M = ${safeJson(cfg)}, n = M.count | 0;
  if (!n || !M.boxes.length) return;
  const hh = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vol = M.boxes.map((b) => (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2])), tot = vol.reduce((a, v) => a + v, 0);
  const base = new Float32Array(n * 3), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    let r = hh(i, 1) * tot, k = 0; while (k < vol.length - 1 && r > vol[k]) { r -= vol[k]; k++; }
    const b = M.boxes[k];
    base[i * 3] = b[0] + hh(i, 2) * (b[3] - b[0]); base[i * 3 + 1] = b[1] + hh(i, 3) * (b[4] - b[1]); base[i * 3 + 2] = b[2] + hh(i, 4) * (b[5] - b[2]);
    let lit = 0.12;
    for (const L of M.lights) { const d = Math.hypot(base[i * 3] - L[0], base[i * 3 + 1] - L[1], base[i * 3 + 2] - L[2]), f = Math.max(0, 1 - d / L[3]); lit += f * f; }
    lit = Math.min(1, lit);
    for (let c = 0; c < 3; c++) col[i * 3 + c] = M.color[c] * lit;
    ph[i * 2] = hh(i, 5) * 6.283; ph[i * 2 + 1] = 0.5 + hh(i, 6);
  }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // a soft round speck (a point is a square without one)
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: M.size, map: new THREE.CanvasTexture(cv), sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  (function tick() {
    const t = clock(), a = M.drift;
    for (let i = 0; i < n; i++) {
      const p = ph[i * 2], s = ph[i * 2 + 1] * 0.12;
      pos[i * 3] = base[i * 3] + a * Math.sin(t * s + p); pos[i * 3 + 1] = base[i * 3 + 1] + a * Math.cos(t * s * 0.8 + p * 1.7);
      pos[i * 3 + 2] = base[i * 3 + 2] + a * 0.6 * Math.sin(t * s * 0.6 + p * 2.3);
    }
    g.attributes.position.needsUpdate = true;
    requestAnimationFrame(tick);
  })();
})();
`;
}
