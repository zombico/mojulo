// In-page script: WHAT A WATCHER SEES, drawn — the cone of a body whose rule says `sightShown` (a guard a sneak gets
// past: worlds/controllable/mind.js perceive, its `sightRange`, its `sightCone` half-angle, its facing), laid on the
// floor as a fan. Emitted only into a page whose world has such a rule, so every other page keeps every byte.
// `sightShown: 'radar'` says the sight is the radar's to draw (gameworld/radar.js: the watcher's mark carries its fan on
// the game's HUD): no fan is laid on the ground, and only the sighting is said here.
//
//   the fan     from the watcher's feet along its facing, its half-angle and its range the rule's own, over the ground
//               where the PILOT, as it stands now, would be seen. Sight is eye to eye, a line in height too: a box as
//               tall as the watcher's eye ends a ray; a lower one that stands over the pilot's eye hides the ground
//               behind it, out to where the line clears its top, and the fan takes up again beyond. So the fan has a
//               hole behind low cover, and the hole grows as the pilot crouches and again as it lies down
//   its colour  calm while it sees no one; hot from the frame it sees the pilot and for a moment after; amber while it
//               is alerted and does not see it (worlds/controllable/alert.js: it searches where it lost the pilot, or
//               comes to where it was called), its fan the alerted one, wider and longer
//   seen        a fresh sighting (the mind's own count, `sightings`) says so on the screen, with how many there have been
// It reads the world and draws; it changes nothing the simulation reads.
export function sightScript() {
  return `
// ── WHAT A WATCHER SEES ──
const __SV = { counts: {}, fans: {}, n: 40, seen: 0, at: -1e9, hits: [], sp: [0, 0, 0, 0] };
const __svEl = document.createElement('div');
__svEl.style.cssText = 'position:fixed;left:50%;top:14%;transform:translateX(-50%);display:none;z-index:7;pointer-events:none;font:700 26px/1 ui-monospace,monospace;letter-spacing:.14em;color:#ff5a4a;text-shadow:0 2px 0 rgba(0,0,0,.5)';
document.body.appendChild(__svEl);
// where along a ray from (x, y) a body whose eye is \`pe\` over the floor is SEEN by an eye \`E\` over it, out to \`far\`:
// up to two spans [a0, b0, a1, b1]. Sight is eye to eye (mind.js), so it is a line in height too: a box as tall as the
// watcher's eye ends it; a lower one that stands over the body's eye hides the ground behind it, out to where the line
// from eye to eye clears its far top edge (tout × (E − pe) / (E − h)), and the body is seen again beyond. A body that
// crouches or lies down lowers \`pe\`, and the hidden ground behind low cover grows.
function __svSpans(x, y, dx, dy, E, pe, feet, far, out) {
  const C = __world.colliders, H = __SV.hits; H.length = 0;
  if (C) for (const b of C) {
    const h = b.max[2] - feet; if (h <= pe || b.min[2] - feet > Math.max(E, pe)) continue;
    let tin = -Infinity, tout = Infinity, miss = false;
    for (let k = 0; k < 2; k++) {
      const o = k ? y : x, d = k ? dy : dx;
      if (Math.abs(d) < 1e-9) { if (o < b.min[k] || o > b.max[k]) { miss = true; break; } continue; }
      const a = (b.min[k] - o) / d, c = (b.max[k] - o) / d;
      tin = Math.max(tin, Math.min(a, c)); tout = Math.min(tout, Math.max(a, c));
    }
    if (!miss && tout >= Math.max(tin, 0) && tin < far) H.push([Math.max(0, tin), tout, h]);
  }
  H.sort((p, q) => p[0] - q[0]);
  let cur = 0, n = 0; out[0] = out[1] = out[2] = out[3] = 0;
  for (const [tin, tout, h] of H) {
    if (cur >= far || n >= 2) break;
    if (tin > cur) { out[n * 2] = cur; out[n * 2 + 1] = tin; n++; }
    cur = h >= E ? Infinity : Math.max(cur, (tout * (E - pe)) / (E - h));
  }
  if (cur < far && n < 2) { out[n * 2] = cur; out[n * 2 + 1] = far; n++; }
  if (n < 2) { out[2] = out[3] = out[1]; }
  return out;
}
(function __svFrame() {
  requestAnimationFrame(__svFrame);
  const now = __world.time || 0; let fresh = 0;
  for (const e of __world.entities) {
    const r = e.rule; if (!r || !r.sightShown) continue;
    // (a watcher whose sight is the radar's, sightShown 'radar': no fan on the ground; a fresh sighting is still said)
    if (r.sightShown === 'radar') { const c0 = __SV.counts[e.id] ?? (__SV.counts[e.id] = e.sightings || 0); if ((e.sightings || 0) > c0) { fresh += (e.sightings || 0) - c0; __SV.counts[e.id] = e.sightings || 0; } continue; }
    let F = __SV.fans[e.id];
    if (!F) {
      // (the near span a fan from the feet; the span seen again beyond low cover a strip, two points a ray)
      const g = new THREE.BufferGeometry(), n = __SV.n;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 2 + 2 * (n + 1)) * 3), 3));
      const idx = [], s0 = n + 2; for (let k = 1; k <= n; k++) idx.push(0, k, k + 1);
      for (let k = 0; k < n; k++) { const a = s0 + 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x6fd08c, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.frustumCulled = false; m.renderOrder = 2; m.raycast = () => {};
      scene.add(m); F = __SV.fans[e.id] = { m, count: e.sightings || 0 };
    }
    const gone = e.downed || e.gone || e.dormant;
    F.m.visible = !gone; if (gone) continue;
    const t = e.transform, eyeOff = r.eye || 0, feet = t.pos[2] - eyeOff, E = (r.collideHeight != null ? r.collideHeight : 1.7) * 0.75;
    // (the body it is drawn for is the pilot as it stands now: standing, crouched or lying, its eye is that much lower)
    const pl = __world.byId && __world.pilotId ? __world.byId[__world.pilotId] : null, pe = pl && pl !== e && pl.rule ? (pl.rule.collideHeight != null ? pl.rule.collideHeight : 1.7) * 0.75 : E;
    const far = r.sightRange ?? 14, half = r.sightCone ?? 0.6, P = F.m.geometry.attributes.position, n = __SV.n, z = feet + 0.04, s0 = n + 2;
    P.setXYZ(0, t.pos[0], t.pos[1], z);
    for (let k = 0; k <= n; k++) {
      const a = t.heading - half + (2 * half * k) / n, dx = Math.cos(a), dy = Math.sin(a), S = __svSpans(t.pos[0], t.pos[1], dx, dy, E, pe, feet, far, __SV.sp);
      P.setXYZ(k + 1, t.pos[0] + dx * S[1], t.pos[1] + dy * S[1], z);
      P.setXYZ(s0 + 2 * k, t.pos[0] + dx * S[2], t.pos[1] + dy * S[2], z); P.setXYZ(s0 + 2 * k + 1, t.pos[0] + dx * S[3], t.pos[1] + dy * S[3], z);
    }
    P.needsUpdate = true;
    const hot = e.lastSeen && now - e.lastSeen.t < 0.6, look = !hot && e.alert && e.alert.level !== 'calm';
    F.m.material.color.setHex(hot ? 0xff5a4a : look ? 0xf2b33d : 0x6fd08c); F.m.material.opacity = hot ? 0.42 : look ? 0.34 : 0.28;
    if ((e.sightings || 0) > F.count) { fresh += (e.sightings || 0) - F.count; F.count = e.sightings || 0; }
  }
  // (a garrison with an alarm says its state itself, alarm-view.js: no SEEN here)
  if (__world.alarm) fresh = 0;
  if (fresh) { __SV.seen += fresh; __SV.at = now; __svEl.textContent = 'SEEN' + (__SV.seen > 1 ? ' ×' + __SV.seen : ''); __svEl.style.display = 'block'; window.__mojSeen = __SV.seen; }
  else if (__svEl.style.display !== 'none' && now - __SV.at > 1.6) __svEl.style.display = 'none';
})();
`;
}
