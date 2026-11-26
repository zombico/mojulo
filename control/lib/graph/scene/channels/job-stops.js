import { safeJson } from '../emit-util.js';
import { JOB_MOTION, jobEnv } from './job-motion.js';

// THE JOBS' STOPS (a played town's or district's jobs, gameworld/city-guide.js; their mechanics game/errand-mechanics.js):
// what happens in the world where a job is done, played as the bus says it happened, so a stop is seen and not only told.
//   BINS      a driving job's round (a `shift`): at each stop a wheelie bin and a few bags at the kerb. As the stop is made
//             (its flag `flag-stop-<id>-<k>` rises) the bin is rolled to the back of the truck, rides its LIFTER up and is
//             tipped in, shaken and set down and rolled back (the lifter's moment set on the truck, `e.liftAt`, which
//             channels/cab-pool.js `gate` swings), the bags tossed into its hopper; a standing round's stops filled again
//             as it is paid (the flag falls). As the round is paid (`errand:done:<id>`), the tailgate swings up and lets
//             the load out (`e.tipAt`). A truck that does not move its parts: the bin tips at the kerb.
//   FARES     a passenger (a trade whose item is a person: passenger, rider, fare) waits at its pick-up; picked up (the
//             bag's count rises) they walk to the car's door and get in; dropped (it falls) they get out at the door and
//             walk off, and another waits at the pick-up.
//   PARCELS   a one-off's goods handed in (`errand:done:<id>`): a parcel arcs from the hero to the door and is taken.
// Each prop is a few shaded boxes in the city's own way (its light baked into its colours, no material lit). The
// timings: channels/job-motion.js. Emitted only when the level has one of them; none ⇒ not one byte.
//
//   jobStopsOf(manifest) → { bins?: [{ id, cabs, done, stops: [{ at, v }] }], fares?: [{ at, held, seed }],
//                          parcels?: [{ at, on }] } | null
//   jobStopsScript(spec) → the page's script; `window.__mojJobStops` its probe

const PERSON = /^(passenger|rider|fare|client|customer|patient)s?$/;
const r3 = (v) => Math.round(v * 1000) / 1000;
const at3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2] ?? 0)];

/** What a level's jobs show at their stops, or null. */
export function jobStopsOf(manifest) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [];
  const bins = M.filter((m) => m && m.kind === 'shift' && Array.isArray(m.stops) && Array.isArray(m.cabs)).map((m) => ({ id: m.id, cabs: m.cabs.slice(), done: `errand:done:${m.id}`, stops: m.stops.map((q, k) => ({ at: at3(q.at), v: `flag-stop-${m.id}-${k + 1}` })) }));
  const fares = M.filter((m) => m && m.kind === 'trade' && PERSON.test(String(m.item)) && Array.isArray(m.at)).map((m, i) => ({ at: at3(m.at), held: `held:bag:${m.item}`, seed: i }));
  const parcels = M.filter((m) => m && m.kind === 'deliver' && Array.isArray(m.at) && !(m.wants ?? []).some((w) => PERSON.test(String(w.item)))).map((m) => ({ at: at3(m.at), on: `errand:done:${m.id ?? 'errand'}` }));
  if (!bins.length && !fares.length && !parcels.length) return null;
  return { ...(bins.length ? { bins } : {}), ...(fares.length ? { fares } : {}), ...(parcels.length ? { parcels } : {}) };
}

export function jobStopsScript(spec) {
  return `
// --- the jobs' stops: bins tipped into the truck, a passenger in and out, a parcel handed over (channels/job-stops.js) ---
(function () {
  const JS = ${safeJson(spec)}, JM = ${JSON.stringify(JOB_MOTION)};
  ${jobEnv.toString()}
  // (a box shaded as the city's are, its light in its colours: top full, sides less, under least)
  function box(w, d, h, hex, o) {
    const g = new THREE.BoxGeometry(w, d, h), c = new THREE.Color(hex), col = [];
    // (a box's faces in three's order: +x, -x, +y, -y, +z, -z; four corners each)
    for (let f = 0; f < 6; f++) { const k = f === 4 ? 1 : f === 5 ? 0.5 : f < 2 ? 0.78 : 0.86; for (let v = 0; v < 4; v++) col.push(c.r * k, c.g * k, c.b * k); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, MAT); if (o) m.position.set(o[0], o[1], o[2]); m.raycast = function () {}; return m;
  }
  const MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
  const now = () => performance.now() / 1000, lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t), clamp = (t) => Math.max(0, Math.min(1, t));
  const W = () => (window.__mojCtrl && window.__mojCtrl.world) || null;
  // a wheelie bin: its body, its lid on a hinge at its back, its wheels at its back; its foot at its origin, its front -y
  function wheelie(hex) {
    const g = new THREE.Group();
    g.add(box(0.58, 0.7, 0.92, hex, [0, 0, 0.5]));
    const lid = new THREE.Group(); lid.position.set(0, 0.36, 0.97); lid.add(box(0.62, 0.76, 0.06, hex, [0, -0.36, 0.02])); g.add(lid);
    for (const s of [-1, 1]) g.add(box(0.06, 0.18, 0.18, '#1d1f21', [s * 0.25, 0.3, 0.09]));
    g.userData.lid = lid; scene.add(g); return g;
  }
  const BIN_HEX = ['#2f5a3a', '#2c4f74', '#5a5d60'];
  // (where a bin rides the lifter, in the lifter's frame: its foot under the comb, its back to the truck)
  const RIDE = [0, -0.68, -0.86];
  const bins = [];
  (JS.bins || []).forEach(function (S, si) {
    S.stops.forEach(function (q, k) {
      const b = wheelie(BIN_HEX[(si + k) % BIN_HEX.length]); b.position.set(q.at[0] + 0.9, q.at[1], q.at[2]);
      const bags = [0, 1].map(function (j) { const m = box(0.42, 0.36, 0.44, '#24262a', [q.at[0] - 0.4 - j * 0.5, q.at[1] + 0.15 * j, q.at[2] + 0.22]); scene.add(m); return { m, home: m.position.clone() }; });
      bins.push({ S, q, b, home: b.position.clone(), bags, was: 0, t0: null, cab: null, on: null });
    });
  });
  const tipped = {};
  // a passenger: legs, a body, arms, a head; their foot at their origin
  function person(i) {
    const g = new THREE.Group(), shirt = ['#a8452f', '#3b6ea5', '#7a8c3a', '#c9a227', '#6b4c8a'][i % 5], skin = ['#e0b896', '#a8734f', '#6e4a33'][i % 3];
    for (const s of [-1, 1]) g.add(box(0.14, 0.16, 0.82, '#2d3138', [s * 0.1, 0, 0.41]));
    g.add(box(0.42, 0.24, 0.62, shirt, [0, 0, 1.13]));
    for (const s of [-1, 1]) g.add(box(0.1, 0.12, 0.58, shirt, [s * 0.27, 0, 1.12]));
    g.add(box(0.22, 0.24, 0.26, skin, [0, 0, 1.6]));
    g.traverse(function (o) { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; } });
    scene.add(g); return g;
  }
  const fade = (g, a) => g.traverse(function (o) { if (o.material) o.material.opacity = a; });
  const fares = (JS.fares || []).map(function (F) { const p = person(F.seed); p.position.set(F.at[0], F.at[1], F.at[2]); return { F, p, state: 'wait', was: 0, t0: 0, to: null, from: null }; });
  const parcels = [];
  // (a door of the car: the cab's own 'stand', its driver's side, turned with it)
  function door(e) {
    const a = e.transform.heading - Math.PI / 2, c = Math.cos(a), s = Math.sin(a), st = (e.mount && e.mount.stand) || [-1.4, 0.25], p = e.transform.pos;
    return [p[0] + st[0] * c - st[1] * s, p[1] + st[0] * s + st[1] * c, p[2]];
  }
  const v3 = new THREE.Vector3();
  let logN = -1;
  (function tick() {
    requestAnimationFrame(tick);
    const w = W(), B = window.__mojBus && window.__mojBus.state; if (!w || !B) return;
    const V = B.vars, t = now(), pilot = w.byId[w.pilotId];
    // what the bus said since the last frame: a round paid (the tailgate up), a parcel handed in
    const log = B.log || [];
    if (logN < 0 || log.length < logN) logN = logN < 0 ? log.length : 0;
    for (let i = logN; i < log.length; i++) {
      const ty = log[i] && log[i].type; if (!ty) continue;
      for (const S of JS.bins || []) if (ty === S.done && pilot && S.cabs.indexOf(pilot.id) >= 0) { pilot.tipAt = t; tipped[S.id] = (tipped[S.id] || 0) + 1; }
      for (const P of JS.parcels || []) if (ty === P.on && pilot) { const m = box(0.42, 0.32, 0.3, '#b98a55', null); const f = pilot.transform.pos; m.position.set(f[0], f[1], f[2] + 1.2); scene.add(m); parcels.push({ m, from: [f[0], f[1], f[2] + 1.2], to: [P.at[0], P.at[1], P.at[2] + 0.6], t0: t }); }
    }
    logN = log.length;
    // THE BINS: a stop made starts its bin's moment on the truck that made it
    for (const x of bins) {
      const on = Number(V[x.q.v]) >= 1;
      if (on && !x.was && pilot && x.S.cabs.indexOf(pilot.id) >= 0) { x.t0 = t; x.cab = pilot; pilot.liftAt = t; x.parts = window.__mojCabParts ? window.__mojCabParts(pilot.id) : null; }
      // (a standing round's stops filled again as it is paid: the bags back at the kerb)
      if (!on && x.was) for (const g of x.bags) { g.m.visible = true; g.m.position.copy(g.home); }
      x.was = on ? 1 : 0;
      if (x.t0 == null) continue;
      const u = (t - x.t0) / JM.lift.s, L = JM.lift, b = x.b, lift = x.parts && x.parts.lift;
      // the bags: tossed into the hopper as the truck pulls up, one after the other
      x.bags.forEach(function (g, j) {
        const k = clamp((u - j * 0.06) / 0.18); if (!g.m.visible) return;
        const to = lift ? lift.localToWorld(v3.set(0, 0.6, 0.9)).clone() : g.home.clone().setZ(g.home.z + 1.5);
        g.m.position.set(lerp(g.home.x, to.x, k), lerp(g.home.y, to.y, k), lerp(g.home.z, to.z, k) + Math.sin(k * Math.PI) * 1.4);
        g.m.rotation.x = k * 4; if (k >= 1) g.m.visible = false;
      });
      if (!lift) {
        // (a truck that does not move its parts: the bin tipped where it stands, its lid open)
        const e = jobEnv(u, L.up, L.down); b.rotation.x = -1.6 * e; b.userData.lid.rotation.x = 1.4 * e;
        if (u >= 1) { b.rotation.x = 0; b.userData.lid.rotation.x = 0; x.t0 = null; }
        continue;
      }
      if (u < L.up[0]) {
        // rolled from its kerb to the lifter's comb, turned to the truck's back
        if (b.parent !== scene) scene.attach(b);
        const k = ease(clamp(u / L.up[0])), to = lift.localToWorld(v3.set(RIDE[0], RIDE[1], RIDE[2])).clone(), hd = x.cab.transform.heading - Math.PI / 2;
        b.position.set(lerp(x.home.x, to.x, k), lerp(x.home.y, to.y, k), lerp(x.home.z, to.z, k)); b.rotation.set(0, 0, lerp(0, hd, k)); b.rotation.x = -L.roll * Math.sin(k * Math.PI);
      } else if (u < L.down[1]) {
        // on the lifter: up the tailgate and over, its lid falling open as it turns
        if (b.parent !== lift) { lift.add(b); b.position.set(RIDE[0], RIDE[1], RIDE[2]); b.rotation.set(0, 0, 0); }
        b.userData.lid.rotation.x = 2.2 * jobEnv(u, L.up, L.down);
      } else if (u < 1) {
        // set down and rolled back to its kerb
        if (b.parent !== scene) { scene.attach(b); x.from = b.position.clone(); x.hd = b.rotation.z; b.userData.lid.rotation.x = 0; }
        const k = ease(clamp((u - L.down[1]) / (1 - L.down[1])));
        b.position.set(lerp(x.from.x, x.home.x, k), lerp(x.from.y, x.home.y, k), lerp(x.from.z, x.home.z, k)); b.rotation.set(-L.roll * Math.sin(k * Math.PI), 0, lerp(x.hd, 0, k));
      } else { if (b.parent !== scene) scene.attach(b); b.position.copy(x.home); b.rotation.set(0, 0, 0); x.t0 = null; }
    }
    // THE FARES: waiting, walked to the car and in; out at the door and away; another waiting
    for (const f of fares) {
      const n = Number(V[f.F.held]) || 0, p = f.p;
      if (n >= 1 && f.was < 1 && pilot && pilot.mount && pilot.mount.cab) { f.state = 'in'; f.t0 = t; f.car = pilot; }
      if (n < 1 && f.was >= 1 && f.car) { f.state = 'out'; f.t0 = t; const d = door(f.car); p.position.set(d[0], d[1], d[2]); f.from = d; const a = f.car.transform.heading + Math.PI / 2; f.to = [d[0] + Math.cos(a) * 5, d[1] + Math.sin(a) * 5, d[2]]; fade(p, 1); p.visible = true; }
      f.was = n;
      const walk = function (to) { const dx = to[0] - p.position.x, dy = to[1] - p.position.y, d = Math.hypot(dx, dy), st = Math.min(d, JM.fare.walk / 60); if (d > 0.01) { p.position.x += (dx / d) * st; p.position.y += (dy / d) * st; p.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; } p.position.z = to[2] + Math.abs(Math.sin(t * 9)) * 0.05; return d; };
      if (f.state === 'in') {
        const d = walk(door(f.car)), k = clamp((t - f.t0 - 2.5) / JM.fare.fade);
        if (d < 0.35 || k > 0) { fade(p, 1 - clamp(k + (d < 0.35 ? 0.5 : 0))); if (k >= 1 || d < 0.35) { p.visible = false; f.state = 'riding'; } }
      } else if (f.state === 'out') {
        const d = walk(f.to);
        if (d < 0.3) { fade(p, 1 - clamp((t - f.t0 - 3) / JM.fare.fade)); if (t - f.t0 > 3 + JM.fare.fade) { f.state = 'gone'; f.t0 = t; p.visible = false; } }
        else if (t - f.t0 > 6) { f.state = 'gone'; f.t0 = t; p.visible = false; }
      } else if (f.state === 'gone' && t - f.t0 > 2.5) { p.position.set(f.F.at[0], f.F.at[1], f.F.at[2]); p.rotation.z = 0; fade(p, 1); p.visible = true; f.state = 'wait'; }
      else if (f.state === 'wait') p.position.z = f.F.at[2];
    }
    // THE PARCELS: an arc to the door, taken there
    for (let i = parcels.length - 1; i >= 0; i--) {
      const q = parcels[i], k = clamp((t - q.t0) / JM.parcel.s);
      q.m.position.set(lerp(q.from[0], q.to[0], k), lerp(q.from[1], q.to[1], k), lerp(q.from[2], q.to[2], k) + Math.sin(k * Math.PI) * JM.parcel.h);
      q.m.rotation.z = k * 3; if (k >= 1) { const s = Math.max(0, 1 - (t - q.t0 - JM.parcel.s) / 0.25); q.m.scale.setScalar(s); if (s <= 0) { scene.remove(q.m); parcels.splice(i, 1); } }
    }
    window.__mojJobStops = { bins: bins.length, lifting: bins.filter((x) => x.t0 != null).length, fares: fares.map((f) => f.state), parcels: parcels.length, tipped: tipped };
  })();
})();
`;
}
