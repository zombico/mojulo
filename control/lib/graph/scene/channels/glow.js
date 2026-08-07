import { safeJson } from '../emit-util.js';

// In-page script: build one shared radial-gradient sprite texture, then drop an additive
// camera-facing THREE.Sprite at each emitter. depthWrite:false so halos blend over the
// baked mesh without z-fighting; AdditiveBlending so overlapping lamps accumulate light.
export function glowSpriteScript(sprites, opacity) {
  return `
// --- object-glow sprites (emitThreeWorld glow option) ---
const GLOW = ${safeJson(sprites)};
const glowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
  return new THREE.CanvasTexture(cv);
})();
for (const e of GLOW) {
  const mat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(e.color[0], e.color[1], e.color[2]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: ${opacity} });
  const sp = new THREE.Sprite(mat);
  sp.position.set(e.pos[0], e.pos[1], e.pos[2]);
  sp.scale.set(e.size, e.size, 1);
  scene.add(sp);
}`;
}
