import { safeJson } from '../emit-util.js';

// In-page script: the TRACER channel. Each tracer is a glowing additive sprite that advances along
// its `path` (a polyline) once per `period` seconds, looping — e.g. an electron tracing an orbital's
// wave-path. A short fading trail of dimmer sprites follows. Driven off setAnimationLoop's clock (no
// Date.now). Only emitted when the caller passes a non-empty `tracers`.
export function tracerChannelScript(tracers) {
  return `
const TRACERS = ${safeJson(tracers)};
function tracerTex(rgb) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(' + rgb.join(',') + ',0.95)');
  g.addColorStop(0.6, 'rgba(' + rgb.join(',') + ',0.35)'); g.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill(); return new THREE.CanvasTexture(cv);
}
const tracerRigs = TRACERS.map((tr) => {
  const rgb = tr.color || [120, 200, 255];
  const tex = tracerTex(rgb);
  const trail = Math.max(0, Math.floor(tr.trail ?? 14));
  // decorative glow — opt out of raycasts (ground probes and picks alike; see __ground's E8 note).
  const mk = (op, sz) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); s.raycast = () => {}; s.scale.set(sz, sz, 1); s.renderOrder = 3; scene.add(s); return s; };
  const head = mk(1, tr.size || 1.2);
  const trailSprites = Array.from({ length: trail }, (_, i) => mk(0.5 * (1 - i / (trail + 1)), (tr.size || 1.2) * (1 - 0.5 * i / (trail + 1))));
  return { path: tr.path, segments: tr.segments || null, period: Math.max(1, tr.period || 10), lag: (tr.trailLag ?? 0.006), head, trailSprites };
});
function tracerAt(path, u) {
  const uu = ((u % 1) + 1) % 1; const f = uu * (path.length - 1); const i = Math.floor(f), a = f - i;
  const p0 = path[i], p1 = path[Math.min(i + 1, path.length - 1)];
  return [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
}

// Orbital FOCUS (Current/All): when a tracer carries path \`segments\` (index range → render-group),
// only the group the tracer is CURRENTLY in is shown; a HUD toggle flips to showing all at once.
const _orbGroups = Object.keys(meshes).filter((n) => n.indexOf('orb:') === 0);
const _baseAlpha = {}; for (const g of _orbGroups) _baseAlpha[g] = meshes[g].material.opacity;
const _hasSeg = tracerRigs.some((r) => r.segments);
const FOCUS_ALPHA = 0.85;
let focusMode = true, _curGroup = null;
if (_hasSeg) {
  const fb = document.createElement('button');
  const lab = () => { fb.textContent = 'orbital: ' + (focusMode ? 'current' : 'all'); fb.classList.toggle('on', focusMode); };
  fb.onclick = () => { focusMode = !focusMode; lab(); };
  lab(); hud.appendChild(fb);
}
function _groupAt(rig, u) {
  const idx = (((u % 1) + 1) % 1) * (rig.path.length - 1);
  for (const s of rig.segments) if (idx >= s.start && idx < s.end) return s.group;
  return rig.segments[rig.segments.length - 1].group;
}

stepTracers = (t) => {
  const sec = t / 1000;
  for (const rig of tracerRigs) {
    const u = sec / rig.period;
    const h = tracerAt(rig.path, u); rig.head.position.set(h[0], h[1], h[2]);
    rig.trailSprites.forEach((sp, i) => { const p = tracerAt(rig.path, u - rig.lag * (i + 1)); sp.position.set(p[0], p[1], p[2]); });
    if (rig.segments) _curGroup = _groupAt(rig, u);
  }
  if (_hasSeg) for (const g of _orbGroups) {
    const m = meshes[g]; if (!m) continue;
    const target = focusMode ? (g === _curGroup ? FOCUS_ALPHA : 0) : _baseAlpha[g];
    m.material.opacity += (target - m.material.opacity) * 0.12;
    m.visible = (typeof wireframeOn !== 'undefined' && wireframeOn) ? m.visible : (m.material.opacity > 0.012);
  }
};`;
}
