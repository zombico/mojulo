/**
 * THE ERRAND'S PROOF (a machine gate, never the eyes'): each errand walked on the bus across the level orders a run made,
 * in the order its laws found, the bag carried from level to level as the store carries it. On each leg's level the
 * walker goes from the stage's start to the leg's place (a trade's) and back; a bounty's foe is given its fall (the proof
 * cannot fight: said as assumed, as defeat-all's audit is); at the giver's, to the hand-in. Proved when the giver says
 * `errand:done:<id>`. What it does not prove: the walk between levels (the `solvable` law reads the links for that), the
 * walls on a stage (the walk is straight; a trail is open ground), the fight, and what a hit or a fall costs the cargo on
 * the way (its margin is said: what arrives against what is asked).
 *
 *   proveErrands(world, manifests) → [{ errand, proved, legs: [{ item, level, bag }], assumed, arrives, says }] | null
 *                                    manifests: { <level id>: the manifest of the level's last stage, as the run made it }
 *   lastStageManifests(steps)      → that map, from runSteps' steps
 *
 * Pure (the bus is the same code the page runs).
 */
import { readGameworld } from './world.js';
import { gameStore } from './levels.js';
import { composeMechanics } from '../game/mechanics.js';
import { deriveLevelPlayer } from '../game/level-synth.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();

/** Each level's last stage's manifest, from runSteps' steps (`level-<id>-<k>`, the last k a level's last stage). */
export function lastStageManifests(steps) {
  const out = {};
  for (const s of steps) {
    const m = /^level-(.+)-(\d+)$/.exec(s.key);
    if (m && s.order?.manifest) out[m[1]] = s.order.manifest;
  }
  return out;
}

// one visit: the level's bus, its bag seeded from what was carried in, the walker along `walk`, events between
function visit(manifest, store, bag, walk, events = []) {
  const mechs = manifest.game?.mechanics ?? [];
  const { player, spawn } = deriveLevelPlayer(manifest);
  const c = composeMechanics(mechs, { storeSchema: store, player, spawn, fall: 'none' }), ev = c.events;
  const s = B.createBusState(ev, ev.entities);
  Object.assign(s.vars, bag);
  let prev;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const e of events) pump([e]);
  const pts = [spawn, ...walk, spawn];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
    for (let k = 0; k <= n; k++) {
      const q = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] ?? 0];
      const z = B.deriveZoneEvents([{ id: player, position: q }], prev, ev.sources);
      prev = z.prev; pump(z.events);
      if (s.log.some((r) => typeof r.type === 'string' && r.type.startsWith('errand:done:'))) break;
    }
  }
  return { bag: Object.fromEntries(Object.entries(s.vars).filter(([k]) => k.startsWith('held:bag:'))), log: s.log.map((r) => r.type) };
}

/** Each errand proved on the bus across its levels, or null for a world with none. */
export function proveErrands(world, manifests) {
  const G = readGameworld(world);
  if (!G.errands?.length) return null;
  const store = gameStore(world, null);
  let bag = {};
  return G.errands.map((E) => {
    const legs = [], assumed = [], missing = [];
    const solvable = E.laws.find((l) => l.law === 'solvable');
    const order = solvable.holds ? E.order : [];
    for (const item of order) {
      const N = E.list.find((x) => x.item === item), M = manifests[N.at];
      if (!M) { missing.push(N.at); continue; }
      const mechs = M.game?.mechanics ?? [];
      if (N.from) {
        assumed.push(`${item}: a ${N.from.foe}'s fall is given (the proof cannot fight)`);
        ({ bag } = visit(M, store, bag, [], [{ type: 'down', entity: `foe-${N.from.foe}-1` }]));
      } else {
        const T = mechs.find((m) => m.kind === 'trade' && m.item === item);
        if (!T) { missing.push(`${N.at} (no trade for ${item})`); continue; }
        ({ bag } = visit(M, store, bag, [T.at]));
      }
      legs.push({ item, level: N.at, bag: { ...bag } });
    }
    const H = manifests[E.giver], D = H?.game?.mechanics.find((m) => m.kind === 'deliver' && m.id === E.id);
    let proved = false;
    if (H && D && !missing.length && solvable.holds) {
      const arrived = { ...bag };
      const r = visit(H, store, bag, [D.at]);
      proved = r.log.includes(`errand:done:${E.id}`);
      bag = r.bag;
      legs.push({ item: 'delivered', level: E.giver, bag: { ...bag } });
      const arrives = E.roots.map((root) => ({ item: root, arrives: arrived[`held:bag:${root}`] ?? 0, asked: E.list.find((x) => x.item === root).min }));
      return { errand: E.id, proved, legs, assumed, arrives, says: proved ? `walked ${E.order.join(' → ')} → ${E.giver}: delivered` : `the giver at '${E.giver}' did not take it: ${arrives.map((a) => `${a.item} ${a.arrives} of ${a.asked}`).join(', ')}` };
    }
    return { errand: E.id, proved, legs, assumed, arrives: [], says: !solvable.holds ? `not walked: ${solvable.says}` : missing.length ? `not walked: no stage made for ${missing.join(', ')}` : `the giver's level '${E.giver}' lays no hand-in` };
  });
}
