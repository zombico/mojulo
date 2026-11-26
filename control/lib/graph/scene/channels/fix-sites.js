import { safeJson } from '../emit-util.js';

// THE FIX SITES (a played district's infra requests, game/request-mechanics.js `request`): what is seen and worked where
// a request is fixed, in the engine at the real place, by the player on foot. Kept simple, each its own little game:
//   POTHOLE   a crater in the road, two cones by it: hold F to shovel in the asphalt (it fills as it is held), then tap
//             F to tamp it (it settles a tap at a time); done, a fresh black patch and the cones gone
//   FENCE     panels lying fallen along a lot's edge: hold F to lift one (it rises as it is held), then tap F to nail it;
//             done, upright
//   PARK      heaps of litter on the lawn: hold F to pick it up (the heap shrinks), then tap F to tie off the bag; done,
//             a planter where it was
//   A RING    on the ground at each spot still to do while the request is taken
//   A LINE    on the screen: at a spot with the material, what to hold or how many taps are left and a bar; without it,
//             what to bring and from where (a work order from City Hall first)
// The page says each spot done (`request:fix:<id>:<k>`); the bus keeps what is fixed. Emitted only where a level has a
// request; none ⇒ not one byte.
//
//   fixSitesOf(manifest) → { requests: [{ id, job, spots: [{ at, N? }], vars: { took, picked, done, fixed: [var] },
//                          hold: { verb, secs }, tap: { verb, n }, words: { name, material, where } }] } | null
//   fixSitesScript(spec) → the page's script; `window.__mojFixSites` its probe

const r3 = (v) => Math.round(v * 1000) / 1000;
/** The reach (m) a spot is worked within, and the key. */
export const FIX = Object.freeze({ reach: 2.2, key: 'f', label: 'F' });

export function fixSitesOf(manifest) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [];
  const requests = M.filter((m) => m && m.kind === 'request' && Array.isArray(m.spots) && m.fix).map((m) => ({
    id: m.id, job: m.job ?? 'pothole', spots: m.spots.map((q) => ({ at: q.at.map(r3), ...(Array.isArray(q.N) ? { N: q.N.map(r3) } : {}) })),
    vars: { took: m.after ? `flag-${m.after}` : null, picked: `flag-picked-${m.id}`, done: `flag-done-${m.id}`, fixed: m.spots.map((_, k) => `flag-fixed-${m.id}-${k + 1}`) },
    hold: { verb: m.fix.hold.verb, secs: m.fix.hold.secs }, tap: { verb: m.fix.tap.verb, n: m.fix.tap.n },
    words: { name: m.name ?? 'it', material: m.material?.name ?? 'the material', where: m.where ?? '' },
  }));
  return requests.length ? { requests } : null;
}

export function fixSitesScript(spec) {
  return `
// --- the fix sites: a pothole, a fence, a park's litter, each worked in place with F held then tapped (channels/fix-sites.js) ---
(function () {
  const FS = ${safeJson(spec)}, FIX = ${JSON.stringify(FIX)};
  const MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
  function box(w, d, h, hex, o) {
    const g = new THREE.BoxGeometry(w, d, h), c = new THREE.Color(hex), col = [];
    for (let f = 0; f < 6; f++) { const k = f === 4 ? 1 : f === 5 ? 0.5 : f < 2 ? 0.78 : 0.86; for (let v = 0; v < 4; v++) col.push(c.r * k, c.g * k, c.b * k); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, MAT); m.position.set(o[0], o[1], o[2]); m.raycast = function () {}; return m;
  }
  function disc(r, h, hex, o) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), new THREE.MeshBasicMaterial({ color: hex })); m.rotation.x = Math.PI / 2; m.position.set(o[0], o[1], o[2]); m.raycast = function () {}; return m; }
  function cone(o) { const g = new THREE.Group(); g.add(box(0.36, 0.36, 0.04, '#222', [0, 0, 0.02])); const c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 10), new THREE.MeshBasicMaterial({ color: '#ff7a1a' })); c.rotation.x = Math.PI / 2; c.position.z = 0.3; c.raycast = function () {}; g.add(c); g.add(box(0.2, 0.2, 0.06, '#f4f4f4', [0, 0, 0.33])); g.position.set(o[0], o[1], o[2]); return g; }
  const ringGeo = new THREE.RingGeometry(0.95, 1.15, 28), ringMat = new THREE.MeshBasicMaterial({ color: '#f2c75c', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const sites = [];
  FS.requests.forEach(function (R) {
    R.spots.forEach(function (q, k) {
      const g = new THREE.Group(); g.position.set(q.at[0], q.at[1], q.at[2]); scene.add(g);
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.set(q.at[0], q.at[1], q.at[2] + 0.04); ring.raycast = function () {}; ring.visible = false; scene.add(ring);
      const S = { R, q, k, g, ring, was: -1, prog: 0, taps: 0, phase: 'hold', parts: {} };
      if (R.job === 'pothole') {
        S.parts.hole = disc(0.95, 0.05, '#17181a', [0, 0, 0.02]); g.add(S.parts.hole);
        [[0.5, 0.3], [-0.4, -0.45], [0.2, -0.6]].forEach(function (b, j) { const m = box(0.18, 0.14, 0.08, '#5b5955', [b[0], b[1], 0.04]); m.rotation.z = j; g.add(m); (S.parts.rubble = S.parts.rubble || []).push(m); });
        S.parts.fill = disc(0.98, 0.06, '#0d0e10', [0, 0, 0.05]); S.parts.fill.scale.set(0.01, 1, 0.01); g.add(S.parts.fill);
        S.parts.cones = [cone([1.6, 0.4, 0]), cone([-1.6, -0.4, 0])]; S.parts.cones.forEach(function (c) { g.add(c); });
      } else if (R.job === 'fence') {
        // (a panel: two posts and three rails across the spot, along the edge; its pivot at its foot, fallen outward)
        const N = q.N || [0, -1], t = [-N[1], N[0]], pivot = new THREE.Group(); pivot.rotation.z = Math.atan2(t[1], t[0]); g.add(pivot);
        const panel = new THREE.Group(); pivot.add(panel);
        for (const s of [-1.2, 1.2]) panel.add(box(0.12, 0.12, 1.6, '#7a5a3a', [s, 0, 0.8]));
        for (const z of [0.4, 0.9, 1.4]) panel.add(box(2.5, 0.06, 0.12, '#9b7b55', [0, 0, z]));
        S.parts.panel = panel; S.fall = -1.45;
        panel.rotation.x = S.fall;
      } else {
        // (a heap of litter: scraps, a bottle, a crisp packet; tidied, a planter)
        const heap = new THREE.Group(); g.add(heap);
        heap.add(box(1.4, 1.0, 0.05, '#4a4236', [0, 0, 0.03]));
        [[0.4, 0.2, '#d8d4c8'], [-0.5, -0.2, '#b33a2e'], [0.1, -0.35, '#c9c2b0'], [-0.2, 0.35, '#2a6fb8'], [0.45, -0.3, '#7a5a3a']].forEach(function (b, j) { const m = box(0.26, 0.18, 0.12, b[2], [b[0], b[1], 0.08]); m.rotation.z = j * 1.3; heap.add(m); });
        S.parts.heap = heap;
        const pot = new THREE.Group(); pot.add(box(0.7, 0.7, 0.5, '#8a6a50', [0, 0, 0.25])); pot.add(box(0.6, 0.6, 0.1, '#3f6e2a', [0, 0, 0.52])); [[0.15, 0.1, '#e85a8a'], [-0.15, -0.1, '#f2d24b'], [0.1, -0.18, '#e85a8a']].forEach(function (b) { pot.add(box(0.12, 0.12, 0.12, b[2], [b[0], b[1], 0.62])); });
        pot.visible = false; g.add(pot); S.parts.pot = pot;
      }
      sites.push(S);
    });
  });
  // a spot drawn as far along as it is (0 broken … 1 fixed)
  function show(S, u) {
    const P = S.parts;
    if (S.R.job === 'pothole') { const f = Math.max(0.01, u); P.fill.scale.set(f, 1, f); P.hole.visible = u < 1; (P.rubble || []).forEach(function (m) { m.visible = u < 0.5; }); P.cones.forEach(function (c) { c.visible = u < 1; }); }
    else if (S.R.job === 'fence') P.panel.rotation.x = S.fall * (1 - u);
    else { P.heap.scale.setScalar(Math.max(0.01, 1 - u)); P.heap.visible = u < 1; P.pot.visible = u >= 1; }
  }
  sites.forEach(function (S) { show(S, 0); });
  const press = (t) => (window.__mojBus && window.__mojBus.press ? window.__mojBus.press(t) : typeof __inputQueue !== 'undefined' && __inputQueue.push({ type: t }));
  let held = false, tapped = 0;
  addEventListener('keydown', function (ev) { if (ev.key.toLowerCase() !== FIX.key || window.__mojMenuOpen || window.__mojManaOpen) return; if (!ev.repeat) tapped++; held = true; });
  addEventListener('keyup', function (ev) { if (ev.key.toLowerCase() === FIX.key) held = false; });
  addEventListener('blur', function () { held = false; });
  const line = document.createElement('div');
  line.style.cssText = 'position:absolute;left:50%;bottom:calc(16% + 48px);transform:translateX(-50%);pointer-events:none;z-index:13;color:#fbf6e9;font:600 15px/1.3 system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.9);text-align:center;display:none';
  (typeof wrap !== 'undefined' && wrap ? wrap : document.body).appendChild(line);
  const bar = (u) => '<span style="display:inline-block;width:120px;height:7px;margin:0 8px;border-radius:4px;background:rgba(255,255,255,.25);vertical-align:middle"><span style="display:block;height:100%;width:' + Math.round(Math.min(1, u) * 100) + '%;border-radius:4px;background:#f2c75c"></span></span>';
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  let shown = '', lastT = 0;
  (function tick() {
    requestAnimationFrame(tick);
    const C = window.__mojCtrl && window.__mojCtrl.world, B = window.__mojBus && window.__mojBus.state; if (!C || !B) return;
    const V = B.vars, t = performance.now() / 1000, dt = Math.min(0.1, lastT ? t - lastT : 0), pilot = C.byId[C.pilotId]; lastT = t;
    const on = (v) => !!v && Number(V[v]) >= 1, onFoot = pilot && !pilot.mount;
    let h = '', at = null;
    for (const S of sites) {
      const R = S.R, fixed = on(R.vars.fixed[S.k]), live = (!R.vars.took || on(R.vars.took)) && !on(R.vars.done);
      if (fixed && S.was !== 1) { show(S, 1); S.phase = 'done'; }
      if (!fixed && S.was === 1) { show(S, 0); S.phase = 'hold'; S.prog = 0; S.taps = 0; }
      S.was = fixed ? 1 : 0;
      S.ring.visible = live && !fixed;
      if (!live || fixed || !onFoot) continue;
      const d = Math.hypot(pilot.transform.pos[0] - S.q.at[0], pilot.transform.pos[1] - S.q.at[1]);
      if (d <= FIX.reach && (!at || d < at.d)) at = { S, d };
    }
    if (at) {
      const S = at.S, R = S.R;
      if (!on(R.vars.picked)) { h = cap(R.words.name) + ': bring a ' + R.words.material + ' from the works yard (a work order from City Hall first)'; tapped = 0; }
      else if (S.phase === 'hold') {
        if (held) S.prog += dt;
        const u = Math.min(1, S.prog / R.hold.secs); show(S, u * 0.6);
        h = cap(R.words.name) + ': hold <b>' + FIX.label + '</b> to ' + R.hold.verb + bar(u);
        if (u >= 1) { S.phase = 'tap'; S.taps = 0; tapped = 0; }
      } else if (S.phase === 'tap') {
        S.taps += tapped; tapped = 0;
        const u = Math.min(1, S.taps / R.tap.n); show(S, 0.6 + 0.4 * u);
        h = cap(R.words.name) + ': tap <b>' + FIX.label + '</b> to ' + R.tap.verb + ' ' + Math.min(S.taps, R.tap.n) + ' / ' + R.tap.n + bar(u);
        if (S.taps >= R.tap.n) { S.phase = 'sent'; press('request:fix:' + R.id + ':' + (S.k + 1)); }
      }
    } else tapped = 0;
    if (h !== shown) { shown = h; line.innerHTML = h; line.style.display = h ? 'block' : 'none'; }
    window.__mojFixSites = { sites: sites.map(function (S) { return { id: S.R.id, k: S.k, phase: S.phase, prog: Math.round(S.prog * 100) / 100, taps: S.taps, fixed: S.was === 1 }; }), line: shown.replace(/<[^>]+>/g, '') };
  })();
})();
`;
}
