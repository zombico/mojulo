import { b64 } from '../emit-util.js';

// In-page script: THE HOT FACES, a page's emitters past white (a world's finish with its bloom, channels/frame-pass.js).
// The bake draws a lit window, a sign or a lamp's face at its paint, at most white; under the bloom each face that says
// it emits (`emissive` with `emissiveStrength`, what the lit export already reads, or `glow`, the fixture the glow
// sprites stand on) is drawn once more, added over itself in the frame's headroom, so the bloom draws its light from
// the face itself. One mesh a page, a hair off its faces toward the eye (a polygon offset), in no pick and no walk.
// Absent the bloom, or a page with no such face ⇒ NOT emitted.

/** How far past its paint a hot face is drawn (linear light, times its strength: the frame is display-encoded, so 1.5 is
 *  about 1.2 past the curve), and the most a strength counts for. */
export const HOT_FACES = Object.freeze({ gain: 1.5, most: 3 });

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexRgb = (h) => { let s = h.slice(1); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255); };

/** The emitters among `faces`: → { positions: Float32Array (triangles), colors: Float32Array (linear, past white), n } */
export function collectHotFaces(faces = []) {
  const pos = [], col = [];
  let n = 0;
  for (const f of faces) {
    if (!f || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    const em = Array.isArray(f.emissive) && f.emissive.length === 3 && Number.isFinite(f.emissiveStrength) && f.emissiveStrength > 0
      ? { rgb: f.emissive, k: Math.min(HOT_FACES.most, f.emissiveStrength) }
      : f.glow && typeof f.fill === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(f.fill) ? { rgb: hexRgb(f.fill), k: 1 } : null;
    if (!em) continue;
    const c = em.rgb.map((v) => lin(Math.min(1, Math.max(0, v))) * em.k * HOT_FACES.gain);
    for (let i = 1; i + 1 < f.corners.length; i++) for (const p of [f.corners[0], f.corners[i], f.corners[i + 1]]) { pos.push(p[0], p[1], p[2]); col.push(c[0], c[1], c[2]); }
    n++;
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), n };
}

export function hotFacesScript(hot) {
  if (!hot || !hot.n) return '';
  return `
// --- hot faces: the page's emitters drawn past white, for the bloom (channels/hot-faces.js) ---
(function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(decodeF32(${JSON.stringify(b64(hot.positions))}), 3));
  g.setAttribute('color', new THREE.BufferAttribute(decodeF32(${JSON.stringify(b64(hot.colors))}), 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.renderOrder = 3; m.raycast = function () {}; m.userData.hot = ${hot.n};
  scene.add(m); window.__mojHot = m;
})();`;
}
