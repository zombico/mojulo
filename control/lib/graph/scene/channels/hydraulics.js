import { safeJson } from '../emit-util.js';
import { vayoPoints } from '../../rupa/vayo.js';

// In-page script: THE HYDRAULICS' MIST (materials/hydraulics.js): where a circuit's water lands, motes carried by the
// air round that spot. The air was solved when the world was resolved (rupa/vayo.js vayoEnvelope: the faces it meets,
// the wind), so here each mote's place is a formula of the clock (vayoPoints, born again through its life): no state,
// the same frame at the same time, a few dozen points a landing. The falls themselves are the jets' (channels/jet.js).
// Absent ⇒ NOT emitted. `window.__mojWater` is the probe: { mists, points, report }.

/** A mote as the page draws it: its colour, how much of it shows, and its size against the spray's own. */
export const WATER_MIST = Object.freeze({ color: 0xe6eef2, opacity: 0.2, size: 1.6 });

export function hydraulicsScript({ mists = [], report = null } = {}) {
  if (!mists.length) return '';
  return `
// --- hydraulics: the mist where a circuit's water lands, on the air solved for it (channels/hydraulics.js) ---
(function () {
  const WW = ${safeJson({ mists, report })}, vayo = ${vayoPoints.toString()};
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const M = WW.mists.map((m) => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(m.spray.count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, color: ${WATER_MIST.color}, size: m.spray.size * ${WATER_MIST.size}, sizeAttenuation: true, transparent: true, opacity: ${WATER_MIST.opacity}, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false; pts.renderOrder = 6; pts.raycast = function () {}; scene.add(pts);
    return { m, pos, pts };
  });
  const probe = window.__mojWater = { mists: M.length, points: M.reduce((a, x) => a + x.m.spray.count, 0), report: WW.report, at: null };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    const t = probe.at != null ? probe.at : (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
    for (const x of M) {
      const P = vayo(x.m.spray, x.m.env, t, true);
      for (let i = 0; i < x.m.spray.count; i++) { const p = P[i]; if (p) { x.pos[3 * i] = p.p[0]; x.pos[3 * i + 1] = p.p[1]; x.pos[3 * i + 2] = p.p[2]; } }
      x.pts.geometry.attributes.position.needsUpdate = true;
    }
  };
})();`;
}
