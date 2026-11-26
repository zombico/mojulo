import { safeJson } from '../emit-util.js';
import { JOB_MOTION } from './job-motion.js';

// THE JOBS' PILES AND STOPS (a played town's or district's driving jobs held at, game/errand-mechanics.js `shift`: a
// garbage truck's round, `collect`; a bus's route, `route`): what is seen and pressed where the work is done, kept simple.
//   STOPS     at each of a route's stops a bus-stop sign and its people waiting (`riders`), there while its flag is down.
//             Made (the flag rises) on the bus that made it: those waiting walk to its door and board, and those who
//             boarded at the stop before get off at the door and walk away; laid again (the round begun again), they wait.
//   LAWNS     a mow's cells of long grass on its park's own lawn, tufts on each (one instanced mesh a job); cut (its flag
//             up) the tufts drop to stubble over a stripe, light or dark by the way the mower went; grown back, long.
//   SHEDS     a mow's groundskeeper's shed beside the park's path, open to it, its mower kept inside; a sign by its door.
//   PILES     at each pile a heap of bags at the kerb, there while its flag (`flag-stop-<id>-<k>`) is down; taken, it
//             pops away; laid again, it is back.
//   THE KEY   held (F) while driving: its going down and coming up said to the bus (`shift:hold:<id>`, `shift:let:<id>`),
//             which counts the hold and takes the pile on.
//   A LINE    on the screen while the job is on the clock: a collect's load of what the truck holds, full where to take
//             it; a route's next stop and who is aboard; at a pile or the next stop, the key to hold and how far it has gone.
//   UNLOADED  the round paid (`errand:done:<id>`) on the truck that did it: its tailgate swung up (`e.tipAt`, which
//             channels/cab-pool.js `gate` swings; the timing channels/job-motion.js).
// Bags are a few shaded boxes in the city's own way (its light in their colours). Emitted only when the level has such a
// job; none ⇒ not one byte.
//
//   jobStopsOf(manifest) → { jobs: [{ id, mode, cabs, done, piles: [{ at, v, riders?, N? }], vars: { in, at, prog, load,
//                          on, full, next }, load?, ticks, key, vehicle, where? }] } | null
//   jobStopsScript(spec) → the page's script; `window.__mojJobStops` its probe

const r3 = (v) => Math.round(v * 1000) / 1000;
const at3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2] ?? 0)];
/** The key a pile is held at, as a keyboard says it. */
export const JOB_KEY = Object.freeze({ key: 'f', label: 'F' });

/** What a level's collecting jobs show, or null. */
export function jobStopsOf(manifest) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [];
  const jobs = M.filter((m) => m && m.kind === 'shift' && (m.mode === 'collect' || m.mode === 'route' || m.mode === 'sweep' || m.mode === 'mow') && Array.isArray(m.stops) && Array.isArray(m.cabs)).map((m) => ({
    id: m.id, mode: m.mode, cabs: m.cabs.slice(), done: `errand:done:${m.id}`,
    piles: m.stops.map((q, k) => ({ at: at3(q.at), v: `flag-stop-${m.id}-${k + 1}`, ...(m.mode === 'route' ? { riders: q.riders ?? 1, N: Array.isArray(q.N) ? q.N.map(r3) : [0, 1] } : {}), ...(m.mode === 'mow' ? { half: Array.isArray(q.half) ? q.half.map(r3) : [2, 2] } : {}) })),
    vars: { in: `in-${m.id}`, at: `at-${m.id}`, prog: `prog-${m.id}`, load: `load-${m.id}`, on: `flag-on-${m.id}`, full: `flag-full-${m.id}`, next: `next-${m.id}` },
    ...(m.mode === 'collect' ? { load: m.load, where: m.unload ? 'the dump' : `the ${m.yard ?? 'depot'}` } : {}),
    // (a mow's round: how many cells pay, its clock's var and whether it runs)
    ...(m.mode === 'mow' ? { goal: Math.max(1, Math.min(m.stops.length, Math.ceil(m.stops.length * (Number.isFinite(m.goal) && m.goal > 0 && m.goal <= 1 ? m.goal : 0.85)))), clock: `left-${m.id}`, live: `live-${m.id}` } : {}), ticks: Math.max(1, Math.round((Number.isFinite(m.hold) && m.hold > 0 ? m.hold : 1.5) / 0.1)), key: JOB_KEY.label, vehicle: m.vehicle ?? 'truck',
  }));
  // (a mow's shed at its park: its round a minigame, started at the door, minigame-channel.js; a shed and its sign here)
  const sheds = M.filter((m) => m && m.kind === 'shift' && m.mode === 'mow' && m.shed && Array.isArray(m.shed.at)).map((m) => ({ id: m.id, at: at3(m.shed.at), heading: r3(m.shed.heading ?? 0), half: (m.shed.half ?? [1.4, 1.1]).map(r3) }));
  return jobs.length || sheds.length ? { jobs, ...(sheds.length ? { sheds } : {}) } : null;
}

export function jobStopsScript(spec) {
  return `
// --- the jobs' piles: bags at the kerb, held at with a key, the load said, the tailgate up as it is emptied (channels/job-stops.js) ---
(function () {
  const JS = ${safeJson(spec)}, JM = ${JSON.stringify(JOB_MOTION)}, KEY = ${JSON.stringify(JOB_KEY.key)};
  const MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
  // (a box shaded as the city's are, its light in its colours: top full, sides less, under least)
  function box(w, d, h, hex, o) {
    const g = new THREE.BoxGeometry(w, d, h), c = new THREE.Color(hex), col = [];
    for (let f = 0; f < 6; f++) { const k = f === 4 ? 1 : f === 5 ? 0.5 : f < 2 ? 0.78 : 0.86; for (let v = 0; v < 4; v++) col.push(c.r * k, c.g * k, c.b * k); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, MAT); m.position.set(o[0], o[1], o[2]); m.raycast = function () {}; return m;
  }
  // a heap of bags: a few, black and green, leaning together
  const piles = [], stops = [];
  // a person: legs, a body, arms, a head; their foot at their origin, their front +y
  const SHIRTS = ['#a8452f', '#3b6ea5', '#7a8c3a', '#c9a227', '#6b4c8a', '#3a7a72'], SKIN = ['#e0b896', '#a8734f', '#6e4a33', '#c99a74'];
  function person(i) {
    const g = new THREE.Group(), shirt = SHIRTS[i % SHIRTS.length], skin = SKIN[(i * 7) % SKIN.length];
    for (const s of [-1, 1]) g.add(box(0.14, 0.16, 0.82, '#2d3138', [s * 0.1, 0, 0.41]));
    g.add(box(0.42, 0.24, 0.62, shirt, [0, 0, 1.13]));
    for (const s of [-1, 1]) g.add(box(0.1, 0.12, 0.58, shirt, [s * 0.27, 0, 1.12]));
    g.add(box(0.22, 0.24, 0.26, skin, [0, 0, 1.6]));
    scene.add(g); return g;
  }
  // a bus stop's sign: a post and its plate
  function sign(at) { scene.add(box(0.08, 0.08, 2.6, '#5c6166', [at[0], at[1], at[2] + 1.3])); scene.add(box(0.5, 0.06, 0.5, '#2a6fb8', [at[0], at[1], at[2] + 2.45])); }
  JS.jobs.filter(function (J) { return J.mode === 'route'; }).forEach(function (J) {
    J.piles.forEach(function (q, k) {
      // (its people along the walk beside the sign, a stride apart, facing the street)
      const n = Math.hypot(q.N[0], q.N[1]) || 1, N = [q.N[0] / n, q.N[1] / n], A = [-N[1], N[0]], post = [q.at[0] + A[0] * 1.4, q.at[1] + A[1] * 1.4, q.at[2]];
      sign(post);
      const folk = []; for (let j = 0; j < q.riders; j++) { const p = person(k * 3 + j + J.id.length); const o = (j - (q.riders - 1) / 2) * 0.9 - 0.6; p.position.set(q.at[0] + A[0] * o - N[0] * 0.5, q.at[1] + A[1] * o - N[1] * 0.5, q.at[2]); p.rotation.z = Math.atan2(N[1], N[0]) - Math.PI / 2; folk.push({ p, home: p.position.clone(), face: p.rotation.z }); }
      stops.push({ J, q, k, N, folk, was: 0, off: [], state: 'wait' });
    });
  });
  // a heap of litter on the road: a dirty smear and a few scraps
  JS.jobs.filter(function (J) { return J.mode === 'sweep'; }).forEach(function (J) {
    J.piles.forEach(function (q, k) {
      const g = new THREE.Group(); g.position.set(q.at[0], q.at[1], q.at[2]);
      g.add(box(2.2, 1.4, 0.04, '#4a4236', [0, 0, 0.03]));
      [[0.5, 0.2, '#c9c2b0'], [-0.6, -0.3, '#7a5a3a'], [0.1, -0.4, '#b33a2e'], [-0.2, 0.45, '#d8d4c8']].forEach(function (b, j) { const m = box(0.3, 0.2, 0.12, b[2], [b[0], b[1], 0.08]); m.rotation.z = k + j; g.add(m); });
      scene.add(g); piles.push({ J, q, g, was: 0, t0: null });
    });
  });
  // a groundskeeper's shed: green plank walls on three sides, open to the path (its mower kept inside), a dark pitched
  // roof over it, a sign on a post by its door
  (JS.sheds || []).forEach(function (H) {
    const g = new THREE.Group(); g.position.set(H.at[0], H.at[1], H.at[2]); g.rotation.z = H.heading - Math.PI / 2;
    const w = 2 * H.half[0], d = 2 * H.half[1], t = 0.1, wall = '#3f6b3a';
    g.add(box(w, t, 2.2, wall, [0, -d / 2 + t / 2, 1.1]));
    for (const s of [-1, 1]) g.add(box(t, d, 2.2, wall, [s * (w / 2 - t / 2), 0, 1.1]));
    g.add(box(w, t, 0.35, wall, [0, d / 2 - t / 2, 2.03]));
    g.add(box(w - 2 * t, d - t, 0.04, '#6a6258', [0, -t / 2, 0.02]));
    for (const s of [-1, 1]) { const r = box(w + 0.3, d / 2 + 0.35, 0.1, '#3a3a40', [0, s * d / 4, 2.48]); r.rotation.x = s * 0.5; g.add(r); }
    g.add(box(0.08, 0.08, 1.6, '#5c6166', [w / 2 + 0.5, d / 2 + 0.4, 0.8]));
    g.add(box(0.7, 0.06, 0.45, '#2f7a3a', [w / 2 + 0.5, d / 2 + 0.4, 1.6]));
    scene.add(g);
  });
  // the long grass of a mow: on each cell a few rows of tufts, jittered by their own numbers; cut, they drop to stubble
  // over a stripe, light or dark by the way the mower was going (as a mown lawn reads)
  const lawns = [], TUFT = 5, lawnO = new THREE.Object3D(), lawnC = new THREE.Color();
  let lawnMesh = null;
  JS.jobs.filter(function (J) { return J.mode === 'mow'; }).forEach(function (J) {
    const n = J.piles.length * TUFT * TUFT, geo = new THREE.ConeGeometry(0.2, 0.5, 5); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.25);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), n);
    mesh.raycast = function () {}; mesh.frustumCulled = false;
    const jit = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
    J.piles.forEach(function (q, k) {
      const hx = q.half[0], hy = q.half[1], tufts = [];
      for (let i = 0; i < TUFT; i++) for (let j = 0; j < TUFT; j++) {
        const id = (k * TUFT + i) * TUFT + j;
        tufts.push({ id, x: q.at[0] - hx + ((i + 0.2 + 0.6 * jit(id, 1)) * 2 * hx) / TUFT, y: q.at[1] - hy + ((j + 0.2 + 0.6 * jit(id, 2)) * 2 * hy) / TUFT, z: q.at[2], s: 0.8 + 0.5 * jit(id, 3), r: jit(id, 4) * 6.28 });
        lawnC.set(jit(id, 5) < 0.5 ? '#4f7f2e' : '#5d8c35'); lawnC.multiplyScalar(0.85 + 0.25 * jit(id, 6)); mesh.setColorAt(id, lawnC);
      }
      const stripe = box(2 * hx - 0.1, 2 * hy - 0.1, 0.03, '#86b25a', [q.at[0], q.at[1], q.at[2] + 0.05]); stripe.visible = false; scene.add(stripe);
      lawns.push({ J, q, tufts, stripe, was: -1 });
    });
    lawnMesh = mesh; scene.add(mesh);
  });
  const LIGHT = new THREE.Color('#8cc55a'), DARK = new THREE.Color('#6a9f42');
  const lay = (x, h) => { for (const u of x.tufts) { lawnO.position.set(u.x, u.y, u.z); lawnO.rotation.set(0, 0, u.r); lawnO.scale.set(u.s, u.s, u.s * h); lawnO.updateMatrix(); lawnMesh.setMatrixAt(u.id, lawnO.matrix); } lawnMesh.instanceMatrix.needsUpdate = true; };
  JS.jobs.filter(function (J) { return J.mode === 'collect'; }).forEach(function (J) {
    J.piles.forEach(function (q, k) {
      const g = new THREE.Group(); g.position.set(q.at[0], q.at[1], q.at[2]);
      [[0, 0, 0.5, 0.45, 0.5, '#1f2124'], [0.45, 0.15, 0.42, 0.4, 0.42, '#2a3a2a'], [-0.35, 0.2, 0.46, 0.42, 0.44, '#1f2124'], [0.1, -0.35, 0.4, 0.38, 0.38, '#26282c']].forEach(function (b, j) {
        const m = box(b[2], b[3], b[4], b[5], [b[0], b[1], b[4] / 2]); m.rotation.z = (k * 1.7 + j) % 3 - 1; g.add(m);
      });
      scene.add(g); piles.push({ J, q, g, was: 0, t0: null });
    });
  });
  // the key: its going down and coming up said to the bus, for every collecting job (held, not repeated)
  const press = (t) => (window.__mojBus && window.__mojBus.press ? window.__mojBus.press(t) : typeof __inputQueue !== 'undefined' && __inputQueue.push({ type: t }));
  let held = false;
  addEventListener('keydown', function (ev) { if (ev.key.toLowerCase() !== KEY || ev.repeat || held || window.__mojMenuOpen || window.__mojManaOpen) return; held = true; for (const J of JS.jobs) press('shift:hold:' + J.id); });
  addEventListener('keyup', function (ev) { if (ev.key.toLowerCase() !== KEY || !held) return; held = false; for (const J of JS.jobs) press('shift:let:' + J.id); });
  addEventListener('blur', function () { if (held) { held = false; for (const J of JS.jobs) press('shift:let:' + J.id); } });
  // the line on the screen, over the HUD's foot and the reach prompt's pill (interact-channel.js, 64px up)
  const line = document.createElement('div');
  line.style.cssText = 'position:absolute;left:50%;bottom:calc(16% + 48px);transform:translateX(-50%);pointer-events:none;z-index:13;color:#fbf6e9;font:600 15px/1.3 system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.9);text-align:center;display:none';
  (typeof wrap !== 'undefined' && wrap ? wrap : document.body).appendChild(line);
  let shown = '', logN = -1;
  const tips = {}, ways = {};
  (function tick() {
    requestAnimationFrame(tick);
    const C = window.__mojCtrl && window.__mojCtrl.world, B = window.__mojBus && window.__mojBus.state; if (!C || !B) return;
    const V = B.vars, t = performance.now() / 1000, pilot = C.byId[C.pilotId];
    // a pile taken pops away; laid again, it is back
    for (const x of piles) {
      const on = Number(V[x.q.v]) >= 1;
      if (on && !x.was) x.t0 = t;
      if (!on && x.was) { x.t0 = null; x.g.visible = true; x.g.scale.setScalar(1); }
      x.was = on ? 1 : 0;
      if (x.t0 != null) { const k = Math.min(1, (t - x.t0) / 0.35); x.g.scale.setScalar(1 - k); x.g.position.z = x.q.at[2] + Math.sin(k * Math.PI) * 0.6; if (k >= 1) { x.g.visible = false; x.t0 = null; } }
    }
    // a cell cut: its tufts to stubble, its stripe down the way the mower went; grown back, long again
    for (const x of lawns) {
      const on = Number(V[x.q.v]) >= 1 ? 1 : 0;
      if (on === x.was) continue;
      if (on && pilot) { const c = Math.cos(pilot.transform.heading), sn = Math.sin(pilot.transform.heading); x.stripe.material = x.stripe.material.clone(); x.stripe.material.color.copy((Math.abs(c) >= Math.abs(sn) ? c : sn) >= 0 ? LIGHT : DARK); }
      lay(x, on ? 0.12 : 1); x.stripe.visible = !!on; x.was = on;
    }
    // a stop made on the bus that made it: those waiting walk to its door and board; those from the stop before get off
    // and walk away; the round begun again, they wait again
    const door = (e) => { const a = e.transform.heading - Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), st = (e.mount && e.mount.stand) || [-1.6, 0.25], p = e.transform.pos; return [p[0] + st[0] * c - st[1] * sn, p[1] + st[0] * sn + st[1] * c, p[2]]; };
    const walkTo = (p, to, dt) => { const dx = to[0] - p.position.x, dy = to[1] - p.position.y, d = Math.hypot(dx, dy), st = Math.min(d, 1.6 * dt); if (d > 0.01) { p.position.x += (dx / d) * st; p.position.y += (dy / d) * st; p.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; } p.position.z = to[2] + Math.abs(Math.sin(t * 9)) * 0.04; return d; };
    const dt = Math.min(0.1, t - (window.__mojJobT || t)); window.__mojJobT = t;
    // (what the bus said since the last frame, every event kept: a stop made, a round paid; a stop's flag set and laid
    // again in one tick, the last of a standing route's, is seen here and not in its var)
    const log = B.log || [];
    if (logN < 0 || log.length < logN) logN = logN < 0 ? log.length : 0;
    for (let i = logN; i < log.length; i++) {
      const ty = log[i] && log[i].type; if (!ty) continue;
      for (const x of stops) if (ty === 'flag:' + x.q.v.slice(5)) x.made = true;
      for (const J of JS.jobs) if (ty === J.done && pilot && J.cabs.indexOf(pilot.id) >= 0) { if (J.mode === 'collect') pilot.tipAt = t; else ways[J.id] = t + 5; tips[J.id] = (tips[J.id] || 0) + 1; }
    }
    logN = log.length;
    for (const x of stops) {
      const on = !!x.made; x.made = false;
      if (on && pilot && x.J.cabs.indexOf(pilot.id) >= 0) {
        x.bus = pilot; x.state = 'board';
        // (those who boarded at the stop before get off here)
        const before = stops.find((y) => y.J === x.J && y.k === x.k - 1);
        if (before) { const d = door(pilot); x.off = before.folk.map(function (f, j) { const p = person(before.k * 3 + j + x.J.id.length); p.position.set(d[0], d[1], d[2]); return { p, to: [d[0] + x.N[0] * 6 + (j - 1) * 1.2, d[1] + x.N[1] * 6, d[2]], t0: t }; }); }
      }
      // (the round paid and begun again: a few seconds on, every stop's people waiting again)
      if (ways[x.J.id] != null && t >= ways[x.J.id] && x.state !== 'wait') { x.state = 'wait'; for (const f of x.folk) { f.p.visible = true; f.p.position.copy(f.home); f.p.rotation.z = f.face; } }
      if (x.state === 'board') {
        const d = door(x.bus); let left = 0;
        for (const f of x.folk) { if (!f.p.visible) continue; left++; if (walkTo(f.p, d, dt) < 0.4) f.p.visible = false; }
        if (!left) x.state = 'aboard';
      }
      for (let i = x.off.length - 1; i >= 0; i--) { const o = x.off[i]; if (walkTo(o.p, o.to, dt) < 0.3 || t - o.t0 > 8) { scene.remove(o.p); x.off.splice(i, 1); } }
    }
    for (const id in ways) if (t >= ways[id]) delete ways[id];
    // the line: on the clock and in the truck, what it holds; at a pile, the key and the hold
    let h = '';
    for (const J of JS.jobs) {
      if (!(V[J.vars.on] >= 1) || !(V[J.vars.in] >= 1)) continue;
      const load = Number(V[J.vars.load]) || 0, prog = Number(V[J.vars.prog]) || 0, at = Number(V[J.vars.at]) || 0;
      const bar = (u) => '<span style="display:inline-block;width:120px;height:7px;margin:0 8px;border-radius:4px;background:rgba(255,255,255,.25);vertical-align:middle"><span style="display:block;height:100%;width:' + Math.round(Math.min(1, u) * 100) + '%;border-radius:4px;background:#f2c75c"></span></span>';
      const held = at >= 1 ? ' · hold <b>' + J.key + '</b>' + bar(prog / J.ticks) : '';
      if (J.mode === 'sweep') h = 'Swept ' + J.piles.filter((q) => Number(V[q.v]) >= 1).length + ' / ' + J.piles.length;
      else if (J.mode === 'mow') {
        // (the round: how much of the lawn is cut, toward its goal, and the time left)
        if (!(V[J.live] >= 1)) continue;
        const cut = J.piles.filter((q) => Number(V[q.v]) >= 1).length, sec = Math.max(0, Number(V[J.clock]) || 0);
        h = 'Mown ' + Math.floor((100 * cut) / J.piles.length) + '%' + bar(cut / J.goal) + 'goal ' + Math.round((100 * J.goal) / J.piles.length) + '% · ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      }
      else if (J.mode === 'route') {
        // (the next stop, and who rode from the last one made)
        const next = Math.min(J.piles.length, Number(V[J.vars.next]) || 1), made = J.piles.filter((q) => Number(V[q.v]) >= 1), aboard = made.length ? made[made.length - 1].riders : 0;
        h = 'Stop ' + next + ' / ' + J.piles.length + ' · riders ' + aboard + (at >= 1 ? ' · hold <b>' + J.key + '</b> to open the doors' + bar(prog / J.ticks) : '');
      } else h = 'Load ' + load + ' / ' + J.load + (load >= J.load ? ' · full: take it to ' + J.where : held);
    }
    if (h !== shown) { shown = h; line.innerHTML = h; line.style.display = h ? 'block' : 'none'; }
    window.__mojJobStops = { mown: lawns.filter((x) => x.was === 1).length, lawn: lawns.length, piles: piles.filter((x) => x.g.visible).length, of: piles.length, stops: stops.map((x) => x.state), waiting: stops.reduce((a, x) => a + x.folk.filter((f) => f.p.visible).length, 0), off: stops.reduce((a, x) => a + x.off.length, 0), held: held, line: shown.replace(/<[^>]+>/g, ''), tipped: tips, motion: JM.tip.s };
  })();
})();
`;
}
