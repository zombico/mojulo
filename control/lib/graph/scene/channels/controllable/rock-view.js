// In-page script: THE ROCK a foe picks up and throws (worlds/controllable/foe.js rockStep, a pacer's `rock`): while it
// stoops (e.foeRock: { t, lift, ground, hand }) a rock rises from the floor before it to its hand over its head; thrown, a
// world's round marked `rock` is drawn as that rock, tumbling along its arc (the projectile loop leaves it to this); broken
// in the air by a hero's round (`broke` on its burst, buster.js) it flies apart in chunks. Low poly, its faces toned by
// how they turn to the light above, as the worker bots are. Appended after the controllable channel's own script (it
// wraps stepControllable) on a page with a foe that throws rocks only, so every other page keeps every byte.
//
//   ROCK  its colour lit and in shade, its spin (turns a second), its chunks when it breaks and their life (s)

export const ROCK = Object.freeze({ lit: '#9a8a74', shade: '#5d5246', spin: 1.6, chunks: 6, life: 0.9 });

export function rockScript() {
  return `
// THE ROCK (rock-view.js): picked up, held over the head, thrown in an arc, broken apart
const __ROCK = ${JSON.stringify(ROCK)};
function __rockMesh(r) {
  const g = new THREE.IcosahedronGeometry(r, 0).toNonIndexed(), P = g.getAttribute('position'), C = new Float32Array(P.count * 3), lit = new THREE.Color(__ROCK.lit), dk = new THREE.Color(__ROCK.shade);
  for (let i = 0; i < P.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(P, i), b = new THREE.Vector3().fromBufferAttribute(P, i + 1), c = new THREE.Vector3().fromBufferAttribute(P, i + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), col = n.z + 0.3 * n.x > 0.1 ? lit : dk;
    for (let k = 0; k < 3; k++) { C[(i + k) * 3] = col.r; C[(i + k) * 3 + 1] = col.g; C[(i + k) * 3 + 2] = col.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true })); m.raycast = function () {}; scene.add(m); return m;
}
const __rockHeld = {}, __rockFly = {}, __rockBits = [];
let __rockBurstSeen = -1;
function __rockFrame() {
  const t = __world.time;
  // (held: rising from the floor before it to its hand as it stoops and lifts)
  for (const e of __world.entities) {
    const R = e.foeRock, K = e.rule && e.rule.foe && e.rule.foe.rock;
    let m = __rockHeld[e.id];
    if (!R || R.thrown || !K || e.gone) { if (m) m.visible = false; continue; }
    if (!m) m = __rockHeld[e.id] = __rockMesh(K.size);
    const u = Math.min(1, R.t / R.lift), up = u < 0.35 ? 0 : (u - 0.35) / 0.65, s = up * up * (3 - 2 * up);
    m.visible = true;
    m.position.set(R.ground[0] + (R.hand[0] - R.ground[0]) * s, R.ground[1] + (R.hand[1] - R.ground[1]) * s, R.ground[2] + (R.hand[2] - R.ground[2]) * s);
    m.rotation.set(0, 0, u * 0.6);
  }
  // (thrown: a world's round marked rock, tumbling along its arc)
  const live = {};
  for (const p of __world.projectiles || []) {
    if (!p.rock) continue;
    live[p.id] = true;
    const m = __rockFly[p.id] || (__rockFly[p.id] = __rockMesh(p.projRadius || 0.3));
    m.position.set(p.pos[0], p.pos[1], p.pos[2]);
    m.rotation.set(p.age * __ROCK.spin * 2 * Math.PI, p.age * __ROCK.spin * 1.3, 0);
  }
  for (const id in __rockFly) if (!live[id]) { scene.remove(__rockFly[id]); __rockFly[id].geometry.dispose(); __rockFly[id].material.dispose(); delete __rockFly[id]; }
  // (broken in the air: its chunks flung out and falling)
  for (const b of __world.bursts || []) {
    if (b.seq <= __rockBurstSeen) continue;
    __rockBurstSeen = b.seq;
    if (!b.broke) continue;
    for (let k = 0; k < __ROCK.chunks; k++) {
      const a = (2 * Math.PI * k) / __ROCK.chunks, m = __rockMesh((b.fxScale || 0.3) * 0.45);
      m.position.set(b.pos[0], b.pos[1], b.pos[2]);
      __rockBits.push({ m, born: t, at: b.pos.slice(), v: [Math.cos(a) * 0.6, Math.sin(a) * 2.2, 2.5 + (k % 3) * 0.8] });
    }
  }
  for (let i = __rockBits.length - 1; i >= 0; i--) {
    const B = __rockBits[i], u = t - B.born;
    if (u > __ROCK.life || u < 0) { scene.remove(B.m); B.m.geometry.dispose(); B.m.material.dispose(); __rockBits.splice(i, 1); continue; }
    B.m.position.set(B.at[0] + B.v[0] * u, B.at[1] + B.v[1] * u, B.at[2] + B.v[2] * u - 7 * u * u);
    B.m.rotation.set(u * 9, u * 6, 0);
  }
}
const __rockStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __rockStep0(dt, inputOverride); __rockFrame(); };
`;
}
