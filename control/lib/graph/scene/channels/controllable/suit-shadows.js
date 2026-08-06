import { safeJson } from '../../emit-util.js';

// SUIT CONTACT SHADOWS (mobile-suit ground maps): a soft radial blob decal under every
// rig-figure suit, seated each frame by a down-probe (the walk probe's sibling — entity bodies
// excluded, decoration meshes skip themselves via raycast no-ops). The blob rides ground height,
// tilts to the local face normal (ramps, mesa lips), and shrinks + fades with altitude — the
// landing tell for jumps, boost hover, and the sky drop-in. Stylized on purpose: the dynamic twin
// of shadowDecalScript's static pool, NOT a shadow map — the vexar identity stays baked-unlit.
// Interpolated into the controllable channel ONLY when the world opts in (`shadows` manifest
// setting); absent, every controllable world's emitted bytes are untouched (the char-net holds).
//
// DIRECTIONAL KEY (arena-atmosphere worlds): when cfg carries a `key` ({ dir, rot, stretch } —
// derived from the payload's baked light at the emit call site), the blob becomes an oriented
// ellipse anchored at the feet and elongated along the light's ground cast (stretch ≈ 1/tan of
// the sun elevation), and an airborne body's shadow SLIDES away downlight by altitude·stretch —
// the long-shadow tell that ties the actors into the keyed stage. Mesh-body entities (target
// spheres, props) join the pass under a key; without one the template interpolates the original
// suits-only strings, so every existing shadow world's emitted bytes are untouched.
export function suitShadowBlock(cfg) {
  return `
// --- suit contact shadows (opt-in world 'shadows') ---
const __SH = ${safeJson(cfg)};
const __shTex = (() => {
  // denser core than the static decal gradient: most of the pool's inner half holds near-full
  // alpha, then a soft skirt — under a suit the CENTER is hidden by the body from most angles,
  // so the visible mid-ring must still carry the read.
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.75, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
  return new THREE.CanvasTexture(cv);
})();
const __shGeo = new THREE.PlaneGeometry(2, 2);
const __shRay = new THREE.Raycaster();
const __suitShadows = {};
window.__mojShadows = __suitShadows;   // introspection surface (spikes/debug), like __mojCtrl
function __shadowFor(id) {
  let s = __suitShadows[id];
  if (s) return s;
  // depthTest OFF is load-bearing on ROLLING terrain: a flat decal buries in the relief and the
  // depth test rejects every fragment (the fBm canyon swings ~5u inside one blob footprint, and
  // conforming a grid would cost a full-mesh raycast per vertex per frame). Untested, the disc
  // composites as a bounded screen-space wash — feet inside the pool darken like contact
  // occlusion, and the radial falloff keeps the wash subtle where it crosses standing geometry.
  // BUT on a FLAT floor with standing WALLS that same untested wash shows THROUGH the walls (nothing
  // occludes it). So depthTest turns ON when the world opts into occlusion — a directional key
  // (arena-atmosphere) or an explicit occlude:true in the shadows config (flat-floor + walls maps
  // like the smoke test): the blob sits at zc+0.4 above the flat floor so nothing buries it, and a
  // wall in front now correctly hides the shadow behind it.
  const mat = new THREE.MeshBasicMaterial({ map: __shTex, color: new THREE.Color(__SH.color[0] / 255, __SH.color[1] / 255, __SH.color[2] / 255),
    transparent: true, opacity: 0, depthWrite: false, depthTest: ${cfg.key || cfg.occlude ? 'true' : 'false'}, side: THREE.DoubleSide });
  const m = new THREE.Mesh(__shGeo, mat);
  m.raycast = function () {};   // never footing, never a pick (E8)
  m.frustumCulled = false; m.renderOrder = 0.5; m.visible = false;   // over the floor, under additive glow
  scene.add(m);
  s = { m }; __suitShadows[id] = s;
  return s;
}
function __shProbe(own, x, y, from) {   // nearest non-entity surface straight below (x, y, from)
  __shRay.set(new THREE.Vector3(x, y, from), new THREE.Vector3(0, 0, -1));
  __shRay.camera = camera;   // sprite-safe traverse (see __ground's E8 note)
  for (const h of __shRay.intersectObjects(scene.children, true)) {
    if (!h.object.isMesh) continue;
    let o = h.object; while (o) { if (own.includes(o)) break; o = o.parent; }
    if (!o) return h.point.z;
  }
  return null;
}
function __updateSuitShadows() {
  for (const id in __suitShadows) if (!__bodies[id]) __suitShadows[id].m.visible = false;   // despawned seat → blob off
  const own = __bodySet();
  for (const e of __world.entities) {
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig;
    ${cfg.key
    ? `if (!rf && !(e.body && e.body.type === 'mesh' && e.body.hittable)) continue;   // under a key: suits + hittable mesh props`
    : `if (!rf) continue;   // blobs are a SUIT dressing — rig-figure bodies only`}
    if (e.gone) { const gs = __suitShadows[e.id]; if (gs) gs.m.visible = false; continue; }   // vanished wreck casts no blob
    const s = __shadowFor(e.id), p = e.transform.pos;
    const zc = __shProbe(own, p[0], p[1], p[2] + 2);   // one probe: seat height + the altitude fade
    const k = zc == null ? 0 : 1 - Math.max(0, p[2] - zc) / __SH.fade;
    if (k <= 0) { s.m.visible = false; continue; }   // airborne beyond the fade (or over void) → no blob
    ${cfg.key ? `const rb = rf ? __SH.r : Math.max(4, (e.body.radius || __SH.r) * 0.9);
    const r = rb * (0.62 + 0.38 * k);   // contact = full pool; high = tight faint disc
    const off = Math.min((p[2] - zc > 0 ? p[2] - zc : 0) * __SH.key.stretch, __SH.fade);   // airborne: the shadow slides downlight
    const L = r * (1 + __SH.key.stretch * 0.35);   // the low-sun ellipse, anchored at the feet (stylized-short, not 1/tan-physical)
    s.m.position.set(p[0] + __SH.key.dir[0] * ((L - r) * 0.5 + off), p[1] + __SH.key.dir[1] * ((L - r) * 0.5 + off), zc + 0.4);
    s.m.rotation.z = __SH.key.rot;
    s.m.scale.set(L, r, 1);` : `s.m.position.set(p[0], p[1], zc + 0.4);
    const r = __SH.r * (0.62 + 0.38 * k);   // contact = full pool; high = tight faint disc
    s.m.scale.set(r, r, 1);`}
    s.m.material.opacity = __SH.alpha * k;
    s.m.visible = true;
  }
}${cfg.key ? `
__updateSuitShadows();   // seat frame-0: frame()-driven captures never step, and the live view keys before the first tick` : ''}`;
}
