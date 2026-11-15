// SPIKE momentum-course: what an obstacle course for a momentum hero (the pinball feel) has to be sized by. A
// platformer's course is sized in SPACE, by its hero's reach (feel/reach.js). A momentum hero's is sized in TIME: how
// long before an obstacle it must be seen, how wide the window to act is, and how long a mistake takes to get over.
// This measures those on the rule the game ships, in Node.   node scripts/spikes/momentum-course/lab.mjs [feel]
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { createWorld, stepWorld } = await import('../../../lib/graph/worlds/controllable-world.js');
const { feelRule } = await import('../../../lib/graph/gameworld/feel/lower.js');
const { reachOf } = await import('../../../lib/graph/gameworld/feel/reach.js');

const feel = process.argv[2] ?? 'commuter-rail-runner', DT = 1 / 60, r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const rule = { type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...feelRule(feel) };
const hooks = { ground: () => 0 };
const hero = (y = 0, x = 0) => ({ id: 'h', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [x, y, 0], heading: Math.PI / 2 } });
const world = (colliders = [], y = 0) => { const w = createWorld({ entities: [hero(y)], colliders }); return { w, me: w.byId.h }; };
const speedOf = (me, prev) => (me.transform.pos[1] - prev) / DT;

// 1. THE SPEED: from a stand to its top, and on its boost; what a full stop costs to get back
function profile(boost) {
  const { w, me } = world();
  let t90 = null, d90 = null, top = 0, prev = 0;
  for (let f = 0; f < 60 * 12; f++) { stepWorld(w, { forward: 1, ...(boost ? { boost: 1 } : {}) }, DT, hooks); const v = speedOf(me, prev); prev = me.transform.pos[1]; top = Math.max(top, v); }
  const { w: w2, me: m2 } = world(); prev = 0;
  for (let f = 0; f < 60 * 12 && t90 == null; f++) { stepWorld(w2, { forward: 1, ...(boost ? { boost: 1 } : {}) }, DT, hooks); const v = speedOf(m2, prev); prev = m2.transform.pos[1]; if (v >= 0.9 * top) { t90 = (f + 1) * DT; d90 = m2.transform.pos[1]; } }
  return { top: r1(top), to90: { s: r2(t90), m: r1(d90) } };
}
// coasting: stick let go at top speed, how far it rolls
function coast() {
  const { w, me } = world(); let prev = 0, v = 0;
  for (let f = 0; f < 60 * 6; f++) { stepWorld(w, { forward: 1 }, DT, hooks); }
  const y0 = me.transform.pos[1]; prev = y0; let f = 0;
  for (; f < 60 * 20; f++) { stepWorld(w, {}, DT, hooks); v = speedOf(me, prev); prev = me.transform.pos[1]; if (v < 0.5) break; }
  return { s: r1(f * DT), m: r1(me.transform.pos[1] - y0) };
}

// 2. THE WINDOW: a hurdle `len` long and `h` high across the way; the jump pressed `d` metres short of it. Which d clear it?
function hurdleWindow(len, h, boost) {
  const run = 60, ok = [];
  for (let d = 0.2; d <= 14; d += 0.1) {
    const { w, me } = world([{ min: [-3, run, 0], max: [3, run + len, h] }]);
    let pressed = 0, cleared = false, prev = 0, vAfter = 0;
    for (let f = 0; f < 60 * 14; f++) {
      const y = me.transform.pos[1];
      const inp = { forward: 1, ...(boost ? { boost: 1 } : {}) };
      if (!pressed && run - y <= d) pressed = 1;
      if (pressed && pressed <= 2) { inp.jump = 1; pressed++; }
      if (pressed) inp.jumpHeld = 1;
      stepWorld(w, inp, DT, hooks);
      vAfter = speedOf(me, prev); prev = me.transform.pos[1];
      if (me.transform.pos[1] > run + len + 2) { cleared = true; break; }
    }
    if (cleared) ok.push({ d, v: vAfter });
  }
  if (!ok.length) return null;
  return { from: r1(ok[ok.length - 1].d), to: r1(ok[0].d), metres: r1(ok[ok.length - 1].d - ok[0].d) };
}
// 3. A MISTAKE: run into the hurdle with no jump: the speed lost, and the time and way to be at 90 % again
function crash(top) {
  const run = 60, { w, me } = world([{ min: [-0.6, run, 0], max: [0.6, run + 0.7, 2] }]);
  let prev = 0, hit = null, back = null;
  for (let f = 0; f < 60 * 30 && back == null; f++) {
    // (a post, not a wall across: the hero steps round it once stopped, as a player would)
    const y = me.transform.pos[1], inp = { forward: 1 };
    if (hit != null && y < run + 1) inp.strafe = 1;
    stepWorld(w, inp, DT, hooks);
    const v = speedOf(me, prev); prev = me.transform.pos[1];
    if (hit == null && y > run - 2 && v < 0.5 * top) hit = { f, y: me.transform.pos[1] };
    if (hit != null && v >= 0.9 * top) back = { s: r2((f - hit.f) * DT), m: r1(me.transform.pos[1] - hit.y) };
  }
  return back;
}
// 4. STEERING: at top speed, the stick held to one side for t seconds: how far sideways it gets
function sidestep(t) {
  const { w, me } = world();
  for (let f = 0; f < 60 * 6; f++) stepWorld(w, { forward: 1 }, DT, hooks);
  const x0 = me.transform.pos[0];
  for (let f = 0; f < Math.round(t * 60); f++) stepWorld(w, { forward: 1, strafe: 1 }, DT, hooks);
  return r2(Math.abs(me.transform.pos[0] - x0));
}

const P = profile(false), B = profile(true), R = reachOf(feel);
console.log(`feel: ${feel}`);
console.log(`speed: top ${P.top} m/s, 90 % of it after ${P.to90.s} s and ${P.to90.m} m · boost ${B.top} m/s (90 % after ${B.to90.s} s, ${B.to90.m} m)`);
const C = coast(); console.log(`coast: the stick let go at top speed, it rolls ${C.m} m in ${C.s} s`);
console.log(`reach (feel/reach.js): ${Object.entries(R.moves).map(([k, m]) => `${k} ${r1(m.long)} m long, ${r1(m.height)} m high, ${r2(m.air)} s`).join(' · ')}`);
for (const [name, len, h] of [['a hurdle (0.7 m long, 0.75 m high)', 0.7, 0.75], ['a block (1.4 m long, 1 m high)', 1.4, 1], ['a long box (4 m long, 1 m high)', 4, 1]]) {
  for (const [boost, v] of [[false, P.top], [true, B.top]]) {
    const W = hurdleWindow(len, h, boost);
    console.log(`${name} at ${boost ? 'boost' : 'top speed'}: ${W ? `jump between ${W.to} and ${W.from} m short of it: a window of ${W.metres} m = ${Math.round((W.metres / v) * 60)} frames (${r2(W.metres / v)} s)` : 'not cleared by a jump'}`);
  }
}
const K = crash(P.top); console.log(`a mistake (run into a post): back at 90 % of top speed after ${K ? `${K.s} s and ${K.m} m` : 'never (in 30 s)'}`);
console.log(`steering at top speed: ${[0.25, 0.5, 1].map((t) => `${sidestep(t)} m sideways in ${t} s`).join(' · ')}`);
// 5. THE SIGHT a player needs: to see it, decide and press inside the window
for (const [who, react] of [['a quick player', 0.25], ['most players', 0.4], ['a new player', 0.6]]) console.log(`sight needed, ${who} (${react} s to react): ${r1(P.top * react)} m at top speed, ${r1(B.top * react)} m on the boost, before the window opens`);
process.exit(0);
