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
  // (a point to HOLD at, { at, hold: <job id> }: arrived, the key held down 2 s on the bus's timers, then let go)
  // (a point is [x, y, z], or { at, hold }: an array has an .at of its own, so it is told apart by being one)
  const holds = new Map(walk.filter((w) => !Array.isArray(w) && w?.hold).map((w) => [w.at, w.hold]));
  const pts = [spawn, ...walk.map((w) => (Array.isArray(w) ? w : w.at)), spawn];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
    for (let k = 0; k <= n; k++) {
      const q = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] ?? 0];
      const z = B.deriveZoneEvents([{ id: player, position: q }], prev, ev.sources);
      prev = z.prev; pump(z.events);
      if (s.log.some((r) => typeof r.type === 'string' && r.type.startsWith('errand:done:'))) break;
    }
    const job = holds.get(b);
    if (job) { pump([{ type: `shift:hold:${job}` }]); for (let k = 0; k < 20; k++) pump(B.tickTimers(s, 0.1)); pump([{ type: `shift:let:${job}` }]); }
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
    // (a SHIFT, jobsified.js: its task taken and one of its vehicles got into, then its work walked in it: a route's
    // stops held at in order, a collect's piles held at (the key's hold counted on the bus's timers) until full and the
    // dump, a haul's site; the proof cannot drive, so the getting in is given and said)
    if (E.vehicle) {
      const H = manifests[E.giver], mechs = H?.game?.mechanics ?? [], Sh = mechs.find((m) => m.kind === 'shift' && m.id === E.id), Tk = mechs.find((m) => m.kind === 'task' && m.id === E.id);
      if (!Sh) return { errand: E.id, proved: false, legs: [], assumed: [], arrives: [], says: `the giver's level '${E.giver}' lays no driving job for it` };
      // (a mow is on foot: its round a minigame, started and won, the page's to play)
      const events = [...(Tk ? [{ type: `app:sub:${Tk.app}` }, { type: `app:take:${E.id}` }] : []), ...(Sh.mode === 'mow' ? [{ type: `minigame:${E.id}` }, { type: `minigame-won:${E.id}` }] : [{ type: 'mounted', rider: 'hero', mount: Sh.cabs[0] }])];
      const mode = Sh.mode ?? 'route', unload = Sh.unload?.at ?? Sh.depot;
      const walk = mode === 'dig' ? [] : mode === 'mow' ? [Sh.depot] : mode === 'sweep' ? Sh.stops.map((q) => q.at) : mode === 'haul' ? [Sh.site.at] : mode === 'collect' ? Sh.stops.slice(0, Sh.load).map((q) => ({ at: q.at, hold: E.id })) : Sh.stops.map((q) => ({ at: q.at, hold: E.id }));
      // (a job that asks for papers, a licence: held, as if bought at the forger)
      const papers = Tk?.needs?.item ? { [`held:bag:${Tk.needs.item}`]: 1 } : {};
      // (one taken at a faction's HQ: checked in there, its call come)
      const Hq = Tk ? null : mechs.find((m) => m.kind === 'offer' && m.id === E.id && m.hq);
      if (Hq) Object.assign(papers, { [`flag-${Hq.flag}`]: 1, ...(Hq.after ? { [`flag-${Hq.after}`]: 1 } : {}) });
      // (a dig: the operator's scoops and tips given, a truck's worth, the page's to say)
      const dig = mode === 'dig' ? Array.from({ length: Sh.loads }, () => [{ type: `shift:scoop:${E.id}` }, { type: `shift:tip:${E.id}` }]).flat() : [];
      const r = visit(H, store, { ...bag, ...papers }, mode === 'dig' ? [] : mode === 'collect' ? [...walk, unload] : walk, [...events, ...dig]);
      const proved = r.log.includes(`errand:done:${E.id}`), where = mode === 'haul' ? (Sh.site.to ?? 'site') : mode === 'collect' ? (Sh.unload ? 'dump' : Sh.yard ?? 'depot') : mode === 'dig' ? 'tipper' : mode === 'sweep' ? 'last heap' : mode === 'mow' ? 'shed' : 'last stop';
      bag = r.bag;
      return { errand: E.id, proved, legs: [{ item: mode, level: E.giver, bag: { ...bag } }], assumed: [Sh.mode === 'mow' ? 'the hero wins the mowing round: the proof cannot play it' : `the hero gets into the ${Sh.vehicle ?? 'vehicle'} (${Sh.cabs[0]}): the proof cannot drive`, ...(Tk?.needs ? [`the hero holds the ${Tk.needs.name ?? Tk.needs.item}, bought at the forger`] : []), ...(Hq ? [`the hero has checked in at the ${Hq.name ?? Hq.hq} HQ`] : [])], arrives: [],
        says: proved ? `driven: ${mode === 'sweep' ? `${Sh.stops.length} heaps swept` : mode === 'mow' ? 'walked to the shed, its round won (given: the minigame\'s)' : mode === 'dig' ? `${Sh.loads} bucketfuls scooped and tipped (given: the operator's)` : mode === 'haul' ? 'to the ' + where : mode === 'collect' ? `${Sh.load} piles held at and emptied at the ${where}` : `${Sh.stops.length} stops held at in order`}: paid` : `the ${where} did not pay: ${r.log.filter((t) => typeof t === 'string' && t.startsWith('flag:stop-')).length} piles or stops made` };
    }
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
