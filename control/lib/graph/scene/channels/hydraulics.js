import { safeJson } from '../emit-util.js';
import { vayoPoints } from '../../rupa/vayo.js';

// In-page script: THE HYDRAULICS' MIST (materials/hydraulics.js): where a circuit's water lands, motes carried by the
// air round that spot. The air was solved when the world was resolved (rupa/vayo.js vayoEnvelope: the faces it meets,
// the wind), so here each mote's place is a formula of the clock (vayoPoints, born again through its life): no state,
// the same frame at the same time, a few dozen points a landing. The falls themselves are the jets' (channels/jet.js).
// Where the water strikes water the page draws the impact (below): rings, foam and thrown drops.
// Absent ⇒ NOT emitted. `window.__mojWater` is the probe: { mists, points, impacts, drops, report }.

/** A mote as the page draws it: its colour, how much of it shows, and its size against the spray's own. */
export const WATER_MIST = Object.freeze({ color: 0xe6eef2, opacity: 0.2, size: 1.6 });

/** THE IMPACT, where a circuit's water strikes water: rings run out from where it lands and die away, a line of foam
 *  stands on it, and drops are thrown up and fall back. All of it is a formula of the clock.
 *    wave    the rings' length (m) and speed (m/s: short gravity waves on a pool), and how far they carry (m)
 *    foam    the foam line's half width (m); under a lip's sheets it stands where they land, not between them
 *    amp     the rings' strength: at rest and a second's metre of speed, held under `most`
 *    crown   the share of the landing's own head (v² / 2g) a drop is thrown back up to, held under `high` (m)
 *    drops   the drops a landing throws: the least, a litre a second's, the most */
export const WATER_IMPACT = Object.freeze({ wave: Object.freeze({ length: 0.22, speed: 0.55, carry: 0.7 }), foam: 0.04, amp: Object.freeze({ rest: 0.1, per: 0.045, most: 0.45 }),
  crown: 0.12, high: 0.7, drops: Object.freeze({ least: 8, per: 6, most: 48 }) });
/** A landing's drops as the page throws them: how many, and how high (m). */
export function impactDrops(im) {
  const D = WATER_IMPACT.drops;
  return { n: Math.round(Math.min(D.most, Math.max(D.least, D.least + D.per * im.flow * (im.ring > 0 ? 1 : 0.4)))), high: Math.min(WATER_IMPACT.high, (WATER_IMPACT.crown * im.speed * im.speed) / (2 * 9.81)) };
}

export function hydraulicsScript({ mists = [], impacts = [], report = null } = {}) {
  if (!mists.length && !impacts.length) return '';
  const I = impacts.map((im) => ({ ...im, ...impactDrops(im), amp: Math.round(Math.min(WATER_IMPACT.amp.most, WATER_IMPACT.amp.rest + WATER_IMPACT.amp.per * im.speed) * 1e3) / 1e3 }));
  const Wv = WATER_IMPACT.wave, fx = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  return `
// --- hydraulics: the mist where a circuit's water lands, on the air solved for it (channels/hydraulics.js) ---
(function () {
  const WW = ${safeJson({ mists, impacts: I, report })}, vayo = ${vayoPoints.toString()};
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const M = WW.mists.map((m) => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(m.spray.count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, color: ${WATER_MIST.color}, size: m.spray.size * ${WATER_MIST.size}, sizeAttenuation: true, transparent: true, opacity: ${WATER_MIST.opacity}, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false; pts.renderOrder = 31; pts.raycast = function () {}; scene.add(pts);
    return { m, pos, pts };
  });
  // the impacts: on the struck water a disc of rings running out from where the water lands, and the drops it throws
  const hs = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233 + 4.1) * 43758.5453; return x - Math.floor(x); };
  const IM = WW.impacts.map((im) => {
    const U = { uT: { value: 0 }, uR: { value: im.ring }, uMax: { value: im.reach }, uAmp: { value: im.amp }, uLips: { value: im.lips || 0 } };
    const disc = new THREE.Mesh(new THREE.CircleGeometry(im.reach, 48), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      // (the page's depth is logarithmic: a shader of its own must write it the same way, or it fails every depth test)
      vertexShader: '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec2 vP;\\nvoid main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\\n#include <logdepthbuf_vertex>\\n}',
      fragmentShader: '#include <logdepthbuf_pars_fragment>\\nuniform float uT, uR, uMax, uAmp, uLips;\\nvarying vec2 vP;\\nvoid main() {\\n#include <logdepthbuf_fragment>\\n  float r = length( vP ), d = abs( r - uR );\\n'
        + '  float w = sin( 6.2832 * ( d - ${fx(Wv.speed)} * uT ) / ${fx(Wv.length)} ), crest = smoothstep( 0.55, 1.0, w ) * exp( - d / ${fx(Wv.carry)} );\\n'
        + '  float th = atan( vP.y, vP.x ), under = uLips > 0.5 ? smoothstep( 0.3, 0.7, 0.5 - 0.5 * cos( uLips * th ) ) : 1.0;\\n'
        + '  float foam = exp( - ( d * d ) / ${fx(WATER_IMPACT.foam * WATER_IMPACT.foam)} ) * under * ( 0.55 + 0.45 * sin( th * 41.0 + uT * 11.0 ) * sin( th * 17.0 - uT * 7.0 ) );\\n'
        + '  float a = uAmp * ( crest * ( 0.6 + 0.4 * under ) + 0.8 * foam ) * ( 1.0 - smoothstep( uMax - 0.12, uMax, r ) );\\n  gl_FragColor = vec4( vec3( 0.92, 0.96, 1.0 ) * a, a ); }' }));
    disc.position.set(im.at[0], im.at[1], im.at[2] + 0.006); disc.renderOrder = 30; disc.raycast = function () {}; scene.add(disc);
    const pos = new Float32Array(im.n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const drops = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, color: 0xf2f8fc, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    drops.frustumCulled = false; drops.renderOrder = 31; drops.raycast = function () {}; scene.add(drops);
    return { im, U, pos, drops };
  });
  // a drop: thrown from where the water lands, up to a share of the landing's own head and out a little, and falling
  // back; born again through its flight
  const dropAt = (im, i, t, out) => {
    const up = Math.sqrt(2 * 9.81 * im.high) * (0.45 + 0.55 * hs(i, 1)), life = (2 * up) / 9.81, tau = ((t / life + hs(i, 2)) % 1) * life;
    const a = 6.2832 * hs(i, 3), r0 = im.ring > 0 ? im.ring + 0.06 * (hs(i, 4) - 0.5) : 0.05 * hs(i, 4), vo = up * 0.35 * (hs(i, 5) - 0.35), r = r0 + vo * tau;
    out[3 * i] = im.at[0] + Math.cos(a) * r; out[3 * i + 1] = im.at[1] + Math.sin(a) * r; out[3 * i + 2] = im.at[2] + up * tau - 4.905 * tau * tau;
  };
  const probe = window.__mojWater = { mists: M.length, points: M.reduce((a, x) => a + x.m.spray.count, 0), impacts: IM.length, drops: IM.reduce((a, x) => a + x.im.n, 0), report: WW.report, at: null };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    const t = probe.at != null ? probe.at : (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
    for (const x of M) {
      const P = vayo(x.m.spray, x.m.env, t, true);
      for (let i = 0; i < x.m.spray.count; i++) { const p = P[i]; if (p) { x.pos[3 * i] = p.p[0]; x.pos[3 * i + 1] = p.p[1]; x.pos[3 * i + 2] = p.p[2]; } }
      x.pts.geometry.attributes.position.needsUpdate = true;
    }
    for (const x of IM) { x.U.uT.value = t; for (let i = 0; i < x.im.n; i++) dropAt(x.im, i, t, x.pos); x.drops.geometry.attributes.position.needsUpdate = true; }
  };
})();`;
}
