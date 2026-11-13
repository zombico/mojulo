// SPIKE roll, the Node half: each seed's roll on the level as Node plays it (levelSim): the sight across each wall, the
// nav grid, and a win steered straight at the exit against one steered corner to corner on the nav grid.
//   node scripts/spikes/roll/node.mjs [seeds=12]
import { spikeLevel } from './level.mjs';
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');
const { levelSim, steer, outcomeIn, keyEvents, SIM_DT } = await import('../../../lib/graph/game/level-equivalence.js');

const seeds = Number(process.argv[2] ?? 12), E = composeLive();
const L = await spikeLevel(), P = L.payload, r1 = (v) => Math.round(v * 10) / 10;
// (the nav grid is cut for a body at its feet's height: on a land that climbs, the feet's own, asked each time)
const body = (z) => ({ radius: 0.3, height: 1.7, footZ: z });

function win(payload, seed, how, seconds = 150) {
  const sim = levelSim(payload, { seed }), me = sim.world.byId[sim.world.pilotId];
  let outcome = null, hop = 0, best = Infinity, still = 0, hops = 0, i = 0;
  for (; i < seconds / SIM_DT && !outcome; i++) {
    const t = me.transform.pos;
    let aim = L.exit;
    if (how === 'nav') { const path = E.navPath(sim.world, [t[0], t[1]], [L.exit[0], L.exit[1]], body(t[2] - (me.rule.eye || 0))); if (path && path.length) aim = [path[0][0], path[0][1], t[2]]; }
    const inp = steer(me, aim), d = Math.hypot(L.exit[0] - t[0], L.exit[1] - t[1]);
    if (d < best - 0.05) { best = d; still = 0; } else if (++still > 30) { hop = 6; still = 0; hops++; }
    if (hop > 0) { inp.jump = 1; inp.jumpHeld = 1; hop--; }
    Object.assign(sim.input, inp);
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT, keyEvents(payload, inp.keys));
    outcome = outcomeIn(payload.game || {}, sim.bus.log, n0);
  }
  return `${outcome ? outcome.result || 'ended' : 'stuck'} ${r1(i * SIM_DT)}s${hops ? ` ${hops} hops` : ''}`;
}

console.log(`level: ${P.faces.length} faces, ${P.colliders.length} colliders, ${Object.keys(P.roll.things).length} rolled things; no walls: straight ${win(L.bare, 1, 'straight')}`);
const distinct = new Set();
for (let seed = 1; seed <= seeds; seed++) {
  const W = levelSim(P, { seed }).world, R = W.rolled;
  distinct.add(R.stand.join(','));
  const sightOk = L.blocks.every((b) => E.sightBlocked([b.at[0], b.at[1] - 2, b.at[2] + 1], [b.at[0], b.at[1] + 2, b.at[2] + 1], W.colliders) === R.stand.includes(b.id));
  const path = E.navPath(W, [L.spawn[0], L.spawn[1]], [L.exit[0], L.exit[1]], body(L.spawn[2] - 1.7));
  console.log(`seed ${seed}: stands ${R.stand.map((s) => s.slice(5)).join('') || '-'} · sight ${sightOk ? 'right' : 'WRONG'} · nav ${path ? path.length + ' corners' : 'NO WAY'} · straight ${win(P, seed, 'straight')} · by nav ${win(P, seed, 'nav')}`);
}
console.log(`${distinct.size} different rolls in ${seeds} seeds`);
// the product's own audit over the same seeds (game/roll-audit.js)
const { rollAudit } = await import('../../../lib/graph/game/roll-audit.js');
const A = rollAudit(P, { seeds, plays: seeds });
for (const l of A.laws) console.log(`audit · ${l.law}: ${l.holds ? 'holds' : 'DOES NOT HOLD'} · ${l.says}`);
for (const f of A.failed) console.log(`audit · seed ${f.seed} ${f.law}: ${f.says}`);
process.exit(0);
