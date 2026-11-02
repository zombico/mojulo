/**
 * THE WAVE GAUNTLET'S PROOF (a machine gate, never the eyes'): each level held as a gauntlet played on the bus, on the
 * level order a run made: time runs, each foe the mechanic wakes is given its fall at once (the proof cannot fight: said
 * as assumed, as defeat-all's audit is), and the way out is walked into at the end. Proved when the level's success
 * fires. It shows that every wave wakes, in order, and only after the one before is down, and that the seal lifts; not
 * that a fight can be won (that is the eyes', and the foes' numbers).
 *
 *   proveGauntlets(world, manifests) → [{ level, proved, woke: [[ids a wave]], says, assumed }] | null
 *                                      manifests: { <level id>: the manifest of its last stage }
 *   lastStageManifests(steps)        → that map, from runSteps' steps
 *
 * Pure (the bus is the same code the page runs).
 */
import { readGameworld } from './world.js';
import { composeMechanics } from '../game/mechanics.js';
import { deriveLevelPlayer } from '../game/level-synth.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();

/** Each level's last stage's manifest, from runSteps' steps (`level-<id>-<k>`, the last k a level's last stage). */
export function lastStageManifests(steps) {
  const out = {};
  for (const s of steps) { const m = /^level-(.+)-(\d+)$/.exec(s.key); if (m && s.order?.manifest) out[m[1]] = s.order.manifest; }
  return out;
}

function play(manifest, level) {
  const mechs = manifest.game?.mechanics ?? [], G = mechs.find((m) => m.kind === 'wave-gauntlet');
  if (!G) return { level, proved: false, woke: [], says: 'its last stage lays no wave gauntlet' };
  const { player, spawn } = deriveLevelPlayer(manifest);
  const c = composeMechanics(mechs, { player, spawn, fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  const woke = [], won = Object.keys(c.on).filter((k) => c.on[k].end === 'success');
  const pump = (list) => {
    B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); }
    const ops = s._ctrlOps ?? []; s._ctrlOps = [];
    const spawned = ops.filter((o) => o.op === 'spawn').map((o) => o.who);
    if (spawned.length) { woke.push(spawned); pump(spawned.map((id) => ({ type: 'down', entity: id }))); }
  };
  pump(ev.initial ?? []);
  const total = G.arenas.reduce((n, A) => n + A.waves.length, 0);
  // time enough for every pause (each at most its arena's breath), a tenth of a second a step
  for (let k = 0; k < (total + 2) * 120 && !s.log.some((r) => r.type === `gauntlet:clear:${G.id}`); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); }
  if (G.at) { let prev; for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: player, position: G.at }], prev, ev.sources); prev = z.prev; pump(z.events); } }
  const log = s.log.map((r) => r.type), proved = won.some((t) => log.includes(t));
  const want = G.arenas.flatMap((A) => A.waves.map((W) => W.foes.map((f) => (typeof f === 'string' ? f : f.id))));
  const inOrder = JSON.stringify(woke) === JSON.stringify(want);
  return { level, proved: proved && inOrder, woke, says: proved && inOrder ? `${woke.length} waves woke in order, each after the last was down; the seal lifted and the way out won` : !inOrder ? `the waves woke ${JSON.stringify(woke)}, not ${JSON.stringify(want)}` : `woke ${woke.length} of ${want.length} waves; the level was not won` };
}

/** Each gauntlet level proved on the bus, or null for a world with none. */
export function proveGauntlets(world, manifests) {
  const G = readGameworld(world), ids = G.ids.filter((id) => G.levels[id].goal?.gauntlet);
  if (!ids.length) return null;
  return ids.map((id) => (manifests[id] ? { ...play(manifests[id], id), assumed: ['every foe\'s fall is given as it wakes (the proof cannot fight)'] } : { level: id, proved: false, woke: [], says: 'no stage made for it', assumed: [] }));
}
