/**
 * SORTIE (a terminal): a mission's goals held together, in no order, as a space-combat sim's mission lists them; and
 * its craft arriving through it. Won when every goal is met; lost when a craft it says to protect goes down.
 *
 *   goals     [{ destroy: [ids] } | { protect: [ids] } | { survive: s } | { reach: <beacon> }], each with an optional
 *             `say` (what the comms say when it is met; a protected craft lost says why the mission failed)
 *               destroy   every craft named down
 *               protect   none of them down: one down fails the mission (a protect goal is met while the others are)
 *               survive   the seconds flown
 *               reach     the pilot flown to a beacon while it is lit
 *   arrivals  [{ craft: [ids], after?: s, down?: [ids], reach?: <beacon>, with?: transit, say? }]   craft minted asleep
 *             and brought in: `after` seconds into the mission, or once every craft in `down` is down, or once the
 *             pilot reaches a beacon (`after` with either: that long after it), each with its transit (`with`: a jump
 *             in, say); `say` what the comms say as they arrive
 *   beacons   [{ id, at: [x, y, z], radius, entity?, lit?: { after?: s, down?: [ids], reach?: <beacon> }, say? }]
 *             places in space the pilot is sent to: a sphere the pilot flies into (the bus's zone), dark until it is
 *             lit (at once without `lit`; else seconds in, or once those craft are down, or once another beacon is
 *             reached), reached once, while lit; its `entity` the marker brought in as it lights and sent away as it is
 *             reached; `say` what the comms say as it is reached. `beacon:lit { beacon }` and `beacon:reached { beacon }`
 *
 * Lowered onto the bus (no runtime of its own): a count of each destroy goal's downs, a timer for each survive goal and
 * each arrival's wait, a watch on each count, a zone for each beacon (its state a var: -1 dark, 0 lit, 1 reached);
 * `sortie:goal { n, of }` as each is met, `sortie:won` when all are, `sortie:lost` when a protected craft goes down,
 * `arrival { n }` as each group comes in.
 *
 *   lowerSortie(p, ctx) → { world, on, emits }   (game/mechanics.js registers it)
 *
 * Pure, no dice.
 */
const ids = (v) => Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && x);

export function lowerSortie(p, ctx) {
  const where = `sortie[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const G = p.goals, A = p.arrivals ?? [], Bs = p.beacons ?? [];
  if (!Array.isArray(Bs)) fail('beacons is a list: [{ id, at, radius, entity?, lit?, say? }]');
  const bIds = new Set();
  Bs.forEach((b, k) => {
    if (!b || typeof b.id !== 'string' || !b.id || bIds.has(b.id)) fail(`beacons[${k}].id is a name, once`);
    bIds.add(b.id);
    if (!Array.isArray(b.at) || b.at.length !== 3 || !b.at.every(Number.isFinite)) fail(`beacons[${k}].at is [x, y, z]`);
    if (!(Number.isFinite(b.radius) && b.radius > 0)) fail(`beacons[${k}].radius is metres, above 0`);
    const L = b.lit;
    if (L !== undefined && (!L || typeof L !== 'object' || (L.after === undefined && L.down === undefined && L.reach === undefined))) fail(`beacons[${k}].lit says when: after (seconds), down (ids), reach (a beacon)`);
    if (L && L.down !== undefined && !ids(L.down)) fail(`beacons[${k}].lit.down is the ids that must be down first`);
  });
  for (const b of Bs) if (b.lit && b.lit.reach !== undefined && (!bIds.has(b.lit.reach) || b.lit.reach === b.id)) fail(`beacon '${b.id}' is lit when '${b.lit.reach}' is reached: no other beacon of that id`);
  if (!Array.isArray(G) || !G.length) fail('needs goals: [{ destroy: [ids] } | { protect: [ids] } | { survive: s } | { reach: <beacon> }], at least one');
  G.forEach((g, k) => {
    const kind = ['destroy', 'protect', 'survive', 'reach'].filter((f) => g && g[f] !== undefined);
    if (kind.length !== 1) fail(`goals[${k}] is one of destroy, protect, survive, reach`);
    if (kind[0] === 'reach' ? !bIds.has(g.reach) : kind[0] === 'survive' ? !(Number.isFinite(g.survive) && g.survive > 0) : !ids(g[kind[0]])) fail(`goals[${k}].${kind[0]} is ${kind[0] === 'reach' ? 'a beacon\'s id' : kind[0] === 'survive' ? 'the seconds flown, above 0' : 'the ids of the craft, at least one'}`);
    if (g.say !== undefined && typeof g.say !== 'string') fail(`goals[${k}].say is a line`);
  });
  if (!G.some((g) => g.destroy || g.survive || g.reach)) fail('a mission is won by a goal met: at least one destroy or survive, or a beacon to reach (protect alone is never won)');
  if (!Array.isArray(A)) fail('arrivals is a list: [{ craft: [ids], after?, down?, reach?, with?, say? }]');
  A.forEach((a, k) => {
    if (!a || !ids(a.craft)) fail(`arrivals[${k}].craft is the ids brought in, at least one`);
    if (a.after !== undefined && !(Number.isFinite(a.after) && a.after >= 0)) fail(`arrivals[${k}].after is seconds into the mission`);
    if (a.down !== undefined && !ids(a.down)) fail(`arrivals[${k}].down is the ids that must be down first`);
    if (a.reach !== undefined && !bIds.has(a.reach)) fail(`arrivals[${k}].reach is a beacon's id`);
    if (a.down !== undefined && a.reach !== undefined) fail(`arrivals[${k}] waits on craft down or a beacon reached, one of them`);
    if (a.after === undefined && a.down === undefined && a.reach === undefined) fail(`arrivals[${k}] says when: after (seconds), down (ids), reach (a beacon), or after with either`);
  });
  const i = ctx.i, pre = `__srt_${i}`, met = `${pre}_met`, toMeet = G.filter((g) => !g.protect).length;
  const world = { vars: { [met]: 0 }, initial: [{ type: `${pre}:go` }], reactions: [], watches: [], sequences: [], hud: [] };
  // THE BEACONS: each a zone the pilot flies into, its state a var (-1 dark, 0 lit, 1 reached); reached is an event of
  // its own (`<pre>:reach:<id>`) the goals and the arrivals wait on
  const reachE = (id) => `${pre}:reach:${id}`, litE = (id) => `${pre}:lit:${id}`, bVar = (id) => `${pre}_b_${id}`;
  if (Bs.length) world.sources = [];
  Bs.forEach((b, k) => {
    const v = bVar(b.id), zone = `${pre}:b:${b.id}`;
    world.vars[v] = b.lit ? -1 : 0;
    world.sources.push({ type: 'zone', zone, at: b.at.slice(), radius: b.radius, planar: false, ...(ctx.player ? { watch: ctx.player } : {}) });
    // lit: at once, after its seconds, once its craft are down, or once another beacon is reached
    if (!b.lit) world.reactions.push({ on: `${pre}:go`, do: 'emit', type: litE(b.id) });
    else if (b.lit.down) {
      const cnt = `${pre}_bl${k}`, ready = `${pre}:bready:${k}`;
      world.vars[cnt] = 0;
      for (const id of b.lit.down) world.reactions.push({ on: 'down', match: { entity: id }, do: 'inc', var: cnt, by: 1 });
      world.watches.push({ type: ready, when: { var: cnt, gte: b.lit.down.length } });
      world.sequences.push({ id: `${pre}_bl${k}`, trigger: { on: ready }, steps: [...(b.lit.after ? [{ await: { timer: b.lit.after } }] : []), { do: 'emit', type: litE(b.id) }] });
    } else if (b.lit.reach) world.sequences.push({ id: `${pre}_bl${k}`, trigger: { on: reachE(b.lit.reach) }, steps: [...(b.lit.after ? [{ await: { timer: b.lit.after } }] : []), { do: 'emit', type: litE(b.id) }] });
    else world.sequences.push({ id: `${pre}_bl${k}`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: b.lit.after } }, { do: 'emit', type: litE(b.id) }] });
    world.reactions.push({ on: litE(b.id), if: { var: v, eq: -1 }, do: 'set', var: v, to: 0 });
    world.reactions.push({ on: litE(b.id), do: 'emit', type: 'beacon:lit', beacon: b.id });
    if (b.entity) world.reactions.push({ on: litE(b.id), do: 'ctrl', op: 'spawn', who: b.entity, fresh: true });
    // reached: flown into while lit, once
    world.reactions.push({ on: 'enter', match: { zone }, if: { var: v, eq: 0 }, do: 'emit', type: reachE(b.id) });
    world.reactions.push({ on: reachE(b.id), do: 'set', var: v, to: 1 }, { on: reachE(b.id), do: 'emit', type: 'beacon:reached', beacon: b.id });
    if (b.entity) world.reactions.push({ on: reachE(b.id), do: 'ctrl', op: 'vanish', who: b.entity });
    if (b.say) world.hud.push({ on: reachE(b.id), text: b.say, ttl: 4 });
  });
  G.forEach((g, k) => {
    const done = `${pre}_g${k}`, ev = `${pre}:met:${k}`;
    if (g.destroy) {
      world.vars[done] = 0;
      for (const id of g.destroy) world.reactions.push({ on: 'down', match: { entity: id }, do: 'inc', var: done, by: 1 });
      world.watches.push({ type: ev, when: { var: done, gte: g.destroy.length } });
    }
    if (g.survive) world.sequences.push({ id: `${pre}_s${k}`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: g.survive } }, { do: 'emit', type: ev }] });
    if (g.reach) world.reactions.push({ on: reachE(g.reach), do: 'emit', type: ev });
    if (g.protect) for (const id of g.protect) world.reactions.push({ on: 'down', match: { entity: id }, do: 'emit', type: 'sortie:lost', goal: k + 1 });
    if (!g.protect) world.reactions.push({ on: ev, do: 'inc', var: met, by: 1 }, { on: ev, do: 'emit', type: 'sortie:goal', n: k + 1, of: toMeet });
    if (g.say) world.hud.push({ on: g.protect ? 'sortie:lost' : ev, text: g.say, ttl: 4 });
  });
  world.watches.push({ type: 'sortie:won', when: { var: met, gte: toMeet } });
  A.forEach((a, k) => {
    const go = `${pre}:arrive:${k}`;
    // (once its others are down: a count of them, its watch the go; then its seconds, if it has them)
    if (a.down) {
      const cnt = `${pre}_a${k}`, ready = `${pre}:ready:${k}`;
      world.vars[cnt] = 0;
      for (const id of a.down) world.reactions.push({ on: 'down', match: { entity: id }, do: 'inc', var: cnt, by: 1 });
      world.watches.push({ type: ready, when: { var: cnt, gte: a.down.length } });
      world.sequences.push({ id: `${pre}_a${k}`, trigger: { on: ready }, steps: [...(a.after ? [{ await: { timer: a.after } }] : []), { do: 'emit', type: go }] });
    } else if (a.reach) world.sequences.push({ id: `${pre}_a${k}`, trigger: { on: reachE(a.reach) }, steps: [...(a.after ? [{ await: { timer: a.after } }] : []), { do: 'emit', type: go }] });
    else world.sequences.push({ id: `${pre}_a${k}`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: a.after } }, { do: 'emit', type: go }] });
    for (const id of a.craft) world.reactions.push({ on: go, do: 'ctrl', op: 'spawn', who: id, fresh: true, ...(typeof a.with === 'string' ? { with: a.with } : {}) });
    world.reactions.push({ on: go, do: 'emit', type: 'arrival', n: k + 1 });
    if (a.say) world.hud.push({ on: go, text: a.say, ttl: 4 });
  });
  world.hud.push({ var: met, label: 'Goals', as: 'counter', max: toMeet });
  return { world, on: { 'sortie:won': { end: 'success' }, 'sortie:lost': { end: 'fail' } }, emits: ['sortie:goal', 'sortie:won', 'sortie:lost', 'arrival', ...(Bs.length ? ['beacon:lit', 'beacon:reached'] : [])] };
}
