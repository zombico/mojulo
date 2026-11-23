/**
 * SORTIE (a terminal): a mission's goals held together, in no order, as a space-combat sim's mission lists them; and
 * its craft arriving through it. Won when every goal is met; lost when a craft it says to protect goes down.
 *
 *   goals     [{ destroy: [ids] } | { protect: [ids] } | { survive: s }], each with an optional `say` (what the
 *             comms say when it is met; a protected craft lost says why the mission failed)
 *               destroy   every craft named down
 *               protect   none of them down: one down fails the mission (a protect goal is met while the others are)
 *               survive   the seconds flown
 *   arrivals  [{ craft: [ids], after?: s, down?: [ids], with?: transit, say? }]   craft minted asleep and brought in:
 *             `after` seconds into the mission, or once every craft in `down` is down (both: whichever is later), each
 *             with its transit (`with`: a jump in, say); `say` what the comms say as they arrive
 *
 * Lowered onto the bus (no runtime of its own): a count of each destroy goal's downs, a timer for each survive goal and
 * each arrival's wait, a watch on each count; `sortie:goal { n, of }` as each is met, `sortie:won` when all are,
 * `sortie:lost` when a protected craft goes down, `arrival { n }` as each group comes in.
 *
 *   lowerSortie(p, ctx) → { world, on, emits }   (game/mechanics.js registers it)
 *
 * Pure, no dice.
 */
const ids = (v) => Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && x);

export function lowerSortie(p, ctx) {
  const where = `sortie[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const G = p.goals, A = p.arrivals ?? [];
  if (!Array.isArray(G) || !G.length) fail('needs goals: [{ destroy: [ids] } | { protect: [ids] } | { survive: s }], at least one');
  G.forEach((g, k) => {
    const kind = ['destroy', 'protect', 'survive'].filter((f) => g && g[f] !== undefined);
    if (kind.length !== 1) fail(`goals[${k}] is one of destroy, protect, survive`);
    if (kind[0] === 'survive' ? !(Number.isFinite(g.survive) && g.survive > 0) : !ids(g[kind[0]])) fail(`goals[${k}].${kind[0]} is ${kind[0] === 'survive' ? 'the seconds flown, above 0' : 'the ids of the craft, at least one'}`);
    if (g.say !== undefined && typeof g.say !== 'string') fail(`goals[${k}].say is a line`);
  });
  if (!G.some((g) => g.destroy || g.survive)) fail('a mission is won by a goal met: at least one destroy or survive (protect alone is never won)');
  if (!Array.isArray(A)) fail('arrivals is a list: [{ craft: [ids], after?, down?, with?, say? }]');
  A.forEach((a, k) => {
    if (!a || !ids(a.craft)) fail(`arrivals[${k}].craft is the ids brought in, at least one`);
    if (a.after !== undefined && !(Number.isFinite(a.after) && a.after >= 0)) fail(`arrivals[${k}].after is seconds into the mission`);
    if (a.down !== undefined && !ids(a.down)) fail(`arrivals[${k}].down is the ids that must be down first`);
    if (a.after === undefined && a.down === undefined) fail(`arrivals[${k}] says when: after (seconds), down (ids), or both`);
  });
  const i = ctx.i, pre = `__srt_${i}`, met = `${pre}_met`, toMeet = G.filter((g) => !g.protect).length;
  const world = { vars: { [met]: 0 }, initial: [{ type: `${pre}:go` }], reactions: [], watches: [], sequences: [], hud: [] };
  G.forEach((g, k) => {
    const done = `${pre}_g${k}`, ev = `${pre}:met:${k}`;
    if (g.destroy) {
      world.vars[done] = 0;
      for (const id of g.destroy) world.reactions.push({ on: 'down', match: { entity: id }, do: 'inc', var: done, by: 1 });
      world.watches.push({ type: ev, when: { var: done, gte: g.destroy.length } });
    }
    if (g.survive) world.sequences.push({ id: `${pre}_s${k}`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: g.survive } }, { do: 'emit', type: ev }] });
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
    } else world.sequences.push({ id: `${pre}_a${k}`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: a.after } }, { do: 'emit', type: go }] });
    for (const id of a.craft) world.reactions.push({ on: go, do: 'ctrl', op: 'spawn', who: id, fresh: true, ...(typeof a.with === 'string' ? { with: a.with } : {}) });
    world.reactions.push({ on: go, do: 'emit', type: 'arrival', n: k + 1 });
    if (a.say) world.hud.push({ on: go, text: a.say, ttl: 4 });
  });
  world.hud.push({ var: met, label: 'Goals', as: 'counter', max: toMeet });
  return { world, on: { 'sortie:won': { end: 'success' }, 'sortie:lost': { end: 'fail' } }, emits: ['sortie:goal', 'sortie:won', 'sortie:lost', 'arrival'] };
}
