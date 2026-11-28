import { safeJson } from '../emit-util.js';
import { b64f32, b64u8 } from '../../figures/rig-bake.js';
import { operatorRig } from '../../construction-shelf/con-operate.js';

// THE OPERATED MACHINES (a played city's dig jobs, game/errand-mechanics.js `shift` `dig`; gameworld/jobsified.js): a
// building site's excavator under the operator's hands. Its parts drawn each in its parent's frame from the machine's
// operator rig (construction-shelf/con-operate.js: each part's placement a sample of its own joint, lerped), at the
// machine's cab entity (`op-<job>`, its rule still: got into with the interact key, as any cab). While the hero is in it
// and on the clock (`in-<job>`), the keys work its joints as an operator's levers do:
//   A / D  swing      W / S  arm out and in      ↑ / ↓  boom up and down      ← / →  bucket curled and opened
// What it does is said to the bus: its bucket curled shut inside the pile of spoil is a SCOOP (`shift:scoop:<job>`), and
// a full bucket opened over the tipper's bed a TIP (`shift:tip:<job>`). Spoil shows in the bucket while it is full and
// in the bed as the loads go in; a line over the HUD's foot says the levers, the load and what to do next. Emitted only
// when the level operates a machine; none ⇒ not one byte.
//
//   operateOf(manifest) → { machines: [{ id, cab, archetype, pile, bed, loads, vars, rig }] } | null
//   operateScript(spec) → the page's script; `window.__mojOperate` its probe (and `set(joints)` to pose it)

// how fast each joint turns at a lever held full (degrees a second), and the bucket's angles that curl it shut and open it
export const OPERATE = Object.freeze({ rate: Object.freeze({ slew: 35, boom: 22, stick: 30, tool: 50 }), curl: -95, open: 0, spoil: '#6b5236' });

/** What a level operates, or null: each dig job's machine and its rig (baked once per machine, kept). */
export function operateOf(manifest) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [];
  const machines = M.filter((m) => m && m.kind === 'shift' && m.mode === 'dig' && typeof m.machine === 'string' && Array.isArray(m.cabs)).map((m) => {
    const R = operatorRig(m.machine);
    return {
      id: m.id, cab: m.cabs[0], archetype: m.machine, pile: m.pile, bed: m.bed, loads: m.loads,
      vars: { in: `in-${m.id}`, bucket: `bucket-${m.id}`, load: `load-${m.id}`, on: `flag-on-${m.id}` },
      rig: { joints: R.joints, tip: R.tip, parts: R.parts.map((P) => ({ id: P.id, joint: P.joint, parent: P.parent, pos: b64f32(P.pos), col: b64u8(P.col), table: P.table })) },
    };
  });
  return machines.length ? { machines } : null;
}

export function operateScript(spec) {
  return `
// --- the operated machines: a site's excavator under the operator's levers (channels/operate.js) ---
(function () {
  const OPS = ${safeJson(spec)}, OP = ${JSON.stringify(OPERATE)};
  const f32 = (s) => new Float32Array(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer), u8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const MAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const keys = {};
  addEventListener('keydown', function (e) { keys[e.code] = true; }); addEventListener('keyup', function (e) { keys[e.code] = false; }); addEventListener('blur', function () { for (const k in keys) keys[k] = false; });
  const press = (t) => (window.__mojBus && window.__mojBus.press ? window.__mojBus.press(t) : typeof __inputQueue !== 'undefined' && __inputQueue.push({ type: t }));
  const box = (w, d, h, hex) => new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) }));
  const machines = OPS.machines.map(function (O) {
    const root = new THREE.Group(); root.userData.g = 'operate:' + O.archetype; scene.add(root);
    // its parts, each in its parent's frame (its matrix its joint's sample; one on the base stands as it is)
    const parts = O.rig.parts.map(function (P) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(f32(P.pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(u8(P.col), 3, true));
      const m = new THREE.Mesh(g, MAT); m.matrixAutoUpdate = false; m.raycast = function () {}; return m;
    });
    O.rig.parts.forEach(function (P, i) { (P.parent >= 0 ? parts[P.parent] : root).add(parts[i]); });
    const J = O.rig.joints.map(function (j) { return j.rest; });
    // (the bucket's middle at rest: where it is, carried with it; the spoil it holds)
    const T = O.rig.tip, tp = O.rig.parts[T.part], bp = f32(tp.pos), mid = [0, 0, 0];
    for (let i = 0; i < bp.length; i += 3) { mid[0] += bp[i]; mid[1] += bp[i + 1]; mid[2] += bp[i + 2]; }
    for (let k = 0; k < 3; k++) mid[k] /= bp.length / 3;
    const spoil = box(0.9, 0.9, 0.5, OP.spoil); spoil.position.set(mid[0], mid[1], mid[2] + 0.2); spoil.visible = false; parts[T.part].add(spoil);
    // the pile of spoil, a mound; the load in the tipper's bed, risen with each tip
    const pile = new THREE.Mesh(new THREE.ConeGeometry(O.pile.radius + 0.8, 1.8, 14, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(OP.spoil) }));
    pile.rotation.x = Math.PI / 2; pile.position.set(O.pile.at[0], O.pile.at[1], O.pile.at[2] + 0.9); scene.add(pile);
    const bed = box(O.bed.half[0] * 2 - 0.2, O.bed.half[1] * 2 - 0.2, 1, OP.spoil); bed.rotation.z = O.bed.heading - Math.PI / 2; bed.visible = false; scene.add(bed);
    return { O, root, parts, J, mid, spoil, bed, inPile: false, wasCurled: false, wasOpen: false, mat: new THREE.Matrix4(), v: new THREE.Vector3() };
  });
  // a part's own matrix at its joint's value: its samples lerped
  function sample(P, J, val, m) {
    const j = J, u = Math.max(0, Math.min(j.n - 1, ((val - j.lo) / (j.hi - j.lo)) * (j.n - 1))), i = Math.min(j.n - 2, Math.floor(u)), f = u - i, t = P.table, a = i * 12, b = a + 12;
    const e = (k) => t[a + k] * (1 - f) + t[b + k] * f;
    m.set(e(0), e(1), e(2), e(3), e(4), e(5), e(6), e(7), e(8), e(9), e(10), e(11), 0, 0, 0, 1);
  }
  const line = document.createElement('div');
  line.style.cssText = 'position:absolute;left:50%;bottom:calc(16% + 48px);transform:translateX(-50%);pointer-events:none;z-index:13;color:#fbf6e9;font:600 15px/1.4 system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.9);text-align:center;display:none';
  (typeof wrap !== 'undefined' && wrap ? wrap : document.body).appendChild(line);
  let shown = '', last = performance.now();
  const cap = (k) => '<b style="display:inline-block;min-width:1.4em;padding:0 4px;border:1.5px solid rgba(251,246,233,.85);border-bottom-width:3px;border-radius:4px;margin:0 2px">' + k + '</b>';
  (function tick() {
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const C = window.__mojCtrl && window.__mojCtrl.world, B = window.__mojBus && window.__mojBus.state; if (!C) return;
    const V = B ? B.vars : {};
    let h = '';
    for (const M of machines) {
      const O = M.O, e = C.byId[O.cab]; if (!e) continue;
      M.root.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]); M.root.rotation.set(0, 0, e.transform.heading - Math.PI / 2);
      // the levers, while the hero is in it and on the clock
      const working = C.pilotId === O.cab && V[O.vars.in] >= 1 && !window.__mojMenuOpen;
      if (working) {
        const lever = (pos, neg) => (keys[pos] ? 1 : 0) - (keys[neg] ? 1 : 0);
        const moves = { slew: lever('KeyA', 'KeyD'), stick: lever('KeyW', 'KeyS'), boom: lever('ArrowUp', 'ArrowDown'), tool: lever('ArrowRight', 'ArrowLeft') };
        O.rig.joints.forEach(function (j, k) {
          const d = (moves[j.name] || 0) * (OP.rate[j.name] || 30) * dt; if (!d) return;
          let v = M.J[k] + d;
          if (j.wrap) { v = ((v + 180) % 360 + 360) % 360 - 180; } else v = Math.max(j.lo, Math.min(j.hi, v));
          M.J[k] = v;
        });
      }
      O.rig.parts.forEach(function (P, i) { if (P.joint < 0) return; sample(P, O.rig.joints[P.joint], M.J[P.joint], M.mat); M.parts[i].matrix.copy(M.mat); M.parts[i].matrixWorldNeedsUpdate = true; });
      M.root.updateMatrixWorld(true);
      // where the bucket is, and how it is held
      const tool = M.J[O.rig.joints.findIndex((j) => j.name === 'tool')], w = M.v.set(M.mid[0], M.mid[1], M.mid[2]).applyMatrix4(M.parts[O.rig.tip.part].matrixWorld);
      const curled = tool < OP.curl, open = tool > OP.open;
      const inPile = Math.hypot(w.x - O.pile.at[0], w.y - O.pile.at[1]) < O.pile.radius + 0.6 && w.z < O.pile.at[2] + 1.6;
      const c = Math.cos(-(O.bed.heading - Math.PI / 2)), s = Math.sin(-(O.bed.heading - Math.PI / 2)), dx = w.x - O.bed.at[0], dy = w.y - O.bed.at[1], lx = dx * c - dy * s, ly = dx * s + dy * c;
      const overBed = Math.abs(lx) < O.bed.half[0] + 0.4 && Math.abs(ly) < O.bed.half[1] + 0.4 && w.z > O.bed.at[2] - 0.2 && w.z < O.bed.at[2] + 5;
      if (working && inPile && curled && !M.wasCurled) press('shift:scoop:' + O.id);
      if (working && overBed && open && !M.wasOpen && V[O.vars.bucket] >= 1) press('shift:tip:' + O.id);
      M.wasCurled = curled; M.wasOpen = open;
      M.spoil.visible = V[O.vars.bucket] >= 1;
      const ld = Number(V[O.vars.load]) || 0; M.bed.visible = ld > 0; M.bed.scale.z = Math.max(0.01, ld / O.loads); M.bed.position.set(O.bed.at[0], O.bed.at[1], O.bed.at[2] - 0.5 + 0.5 * ld / O.loads);
      if (C.pilotId === O.cab) h = !(V[O.vars.in] >= 1) ? 'This machine is not yours to work: take the job on Jobsified' : cap('A') + cap('D') + ' swing · ' + cap('W') + cap('S') + ' arm · ' + cap('↑') + cap('↓') + ' boom · ' + cap('←') + cap('→') + ' bucket<br>Load ' + ld + ' / ' + O.loads + ' · ' + (V[O.vars.bucket] >= 1 ? 'bucket full: swing over the tipper and open it' : 'dig into the pile and curl the bucket');
      M.state = { joints: Object.fromEntries(O.rig.joints.map((j, k) => [j.name, Math.round(M.J[k] * 10) / 10])), bucket: [Math.round(w.x * 100) / 100, Math.round(w.y * 100) / 100, Math.round(w.z * 100) / 100], inPile, overBed, curled, open };
    }
    if (h !== shown) { shown = h; line.innerHTML = h; line.style.display = h ? 'block' : 'none'; }
    window.__mojOperate = { machines: machines.map((M) => M.state || null), set: function (k, joints) { const M = machines[k]; M.O.rig.joints.forEach(function (j, i) { if (joints[j.name] != null) M.J[i] = joints[j.name]; }); } };
  })();
})();
`;
}
