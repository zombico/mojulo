// SPIKE roll, the Node half: is a wall gone "from the start" right for the walk, the sight, the nav grid and the
// ground, and does a win steered straight at the exit survive rolled cover?   node scripts/spikes/roll/node.mjs [seeds=12]
import { spikeLevel, buildRoll } from './level.mjs';
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');
const { simLevel } = await import('../../../lib/graph/game/level-sim.js');
const { faceGround, pageGroundFaces, steer, outcomeIn, keyEvents, SIM_DT } = await import('../../../lib/graph/game/level-equivalence.js');

const seeds = Number(process.argv[2] ?? 12), E = composeLive(), { rollOf } = buildRoll();
const L = await spikeLevel(), P = L.payload, r1 = (v) => Math.round(v * 10) / 10;
const pilot0 = P.entities.find((e) => e.id === 'player'), body = { radius: pilot0.rule.collideRadius || 0.3, height: pilot0.rule.collideHeight || 1.7 };
const blocksOf = (ids) => L.asks.filter((a) => ids.includes(a.id)).flatMap((a) => a.blocks);

// a win, played on the level as rolled (the standing walls plain colliders, the gone ones' faces off the ground):
// straight at the exit as winScript steers, or corner to corner on the nav grid
function win(rolled, how, seconds = 150) {
  const gone = new Set(blocksOf(rolled.gone).map((id) => `break:${id}`)), standing = new Set(blocksOf(rolled.stand));
  const faces = P.faces.filter((f) => !gone.has(f.node));
  const colliders = [...P.colliders, ...P.breakables.filter((b) => standing.has(b.id)).map((b) => ({ min: b.min, max: b.max, of: b.id }))];
  const sim = simLevel({ entities: P.entities, events: P.events || {}, colliders, camera: P.camera }, { ground: faceGround(pageGroundFaces(faces)), powers: P.game?.powers || null });
  const me = sim.world.byId[sim.world.pilotId];
  let outcome = null, hop = 0, best = Infinity, still = 0, hops = 0, i = 0;
  for (; i < seconds / SIM_DT && !outcome; i++) {
    const t = me.transform.pos;
    let aim = L.exit;
    if (how === 'nav') { const path = E.navPath(sim.world, [t[0], t[1]], [L.exit[0], L.exit[1]], body); if (path && path.length) aim = [path[0][0], path[0][1], t[2]]; }
    const inp = steer(me, aim), d = Math.hypot(L.exit[0] - t[0], L.exit[1] - t[1]);
    if (d < best - 0.05) { best = d; still = 0; } else if (++still > 30) { hop = 6; still = 0; hops++; }
    if (hop > 0) { inp.jump = 1; inp.jumpHeld = 1; hop--; }
    Object.assign(sim.input, inp);
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT, keyEvents(P, inp.keys));
    outcome = outcomeIn(P.game || {}, sim.bus.log, n0);
  }
  return { outcome: outcome ? outcome.result || outcome : null, s: r1(i * SIM_DT), hops, left: r1(best) };
}

const out = { level: { faces: P.faces.length, colliders: P.colliders.length, blocks: P.breakables.length, walls: L.asks.length }, seeds: [] };
out.bare = { straight: win({ stand: [], gone: L.asks.map((a) => a.id) }, 'straight'), nav: win({ stand: [], gone: L.asks.map((a) => a.id) }, 'nav') };
const distinct = new Set();
for (let seed = 1; seed <= seeds; seed++) {
  const R = rollOf(L.roll, seed);
  distinct.add(R.stand.join(','));
  // the runtime's own "gone from the start": restoreBlock on every block of a wall not picked
  const W = E.createWorld({ entities: P.entities, colliders: P.colliders, breakables: P.breakables });
  const c0 = W.colliders.length;
  for (const id of blocksOf(R.gone)) E.restoreBlock(W, id);
  for (let k = 0; k < 60; k++) E.stepWorld(W, {}, 1 / 30, { ground: (q) => L.ground(q) ?? 0 });
  const standing = W.breakables.filter((b) => !b.broken), moved = standing.filter((b) => b.falling || b.landed).length;
  const hows = [...new Set(W.breaks.map((b) => b.how))];
  // the sight across each wall, a metre over its foot: blocked where it stands, clear where it is gone
  const sight = L.asks.map((a) => E.sightBlocked([a.at[0], a.at[1] - 2, a.at[2] + 1], [a.at[0], a.at[1] + 2, a.at[2] + 1], W.colliders));
  const sightOk = L.asks.every((a, k) => sight[k] === R.stand.includes(a.id));
  // the nav grid after the splice
  const path = E.navPath(W, [L.spawn[0], L.spawn[1]], [L.exit[0], L.exit[1]], body);
  // the ground over a gone wall's top: the page's ground ray over ALL the faces (the gone wall's still in the bank)
  const phantom = L.asks.filter((a) => R.gone.includes(a.id)).filter((a) => { const g = L.ground([a.at[0], a.at[1], a.at[2] + 2.5]); return g !== null && g > a.at[2] + 1; }).length;
  out.seeds.push({ seed, stand: R.stand.map((s) => s.slice(5)).join(''), colliders: `${c0}→${W.colliders.length}`, breaks: W.breaks.length, hows, moved, sightOk, nav: path === null ? null : path.length, phantomGround: phantom, straight: win(R, 'straight'), viaNav: win(R, 'nav') });
}
out.distinct = `${distinct.size} of ${seeds}`;
console.log(JSON.stringify(out, null, 1));
process.exit(0);
