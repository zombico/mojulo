/**
 * WAKE (an emitter): foes asleep until the player passes a mark of one of its facts. A rail stage's waves are woken as
 * the craft's distance along its path passes each wave's mark; any gauge the bus reads may be the mark (a height, a
 * speed: worlds/event-bus.js gauges). Each wave is woken once, the first time its gauge is entered.
 *
 *   marks   [{ fact, min?, max?, foes: [ids] }]   a gauge's fact and its range (either open); the foes minted dormant and
 *           woken (`ctrl spawn`) when the player enters it
 *
 * Lowered onto the bus (no runtime of its own): a gauge source a wave, a flag that it has been woken, `wake { n, of }`.
 *
 *   lowerWake(p, ctx) → { world, emits }   (game/mechanics.js registers it)
 *
 * Pure, no dice.
 */
const FACTS = ['along', 'alt', 'agl', 'speed', 'climb', 'bank', 'heading'];

export function lowerWake(p, ctx) {
  const where = `wake[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const W = p.marks;
  if (!Array.isArray(W) || !W.length) fail('needs marks: [{ fact, min?, max?, foes: [ids] }], at least one');
  const seen = new Set();
  W.forEach((w, k) => {
    const at = `marks[${k}]`;
    if (!w || typeof w !== 'object') fail(`${at} is { fact, min?, max?, foes }`);
    if (!FACTS.includes(w.fact)) fail(`${at}.fact is one of ${FACTS.join(', ')}`);
    if (!Number.isFinite(w.min) && !Number.isFinite(w.max)) fail(`${at}: a mark is min, max or both (the range the player enters)`);
    if (!Array.isArray(w.foes) || !w.foes.length || w.foes.some((f) => typeof f !== 'string' || !f)) fail(`${at}.foes is the ids woken, at least one`);
    for (const f of w.foes) { if (seen.has(f)) fail(`${at}: '${f}' is woken twice`); seen.add(f); }
  });
  const pre = `__wake_${ctx.i}`, world = { vars: {}, sources: [], reactions: [] };
  W.forEach((w, k) => {
    const zone = `wake_${ctx.i}_${k}`, done = `${pre}_${k}`, go = `${pre}:go:${k}`;
    world.vars[done] = 0;
    world.sources.push({ type: 'gauge', zone, fact: w.fact, ...(Number.isFinite(w.min) ? { min: w.min } : {}), ...(Number.isFinite(w.max) ? { max: w.max } : {}), watch: ctx.player });
    world.reactions.push({ on: 'enter', match: { zone }, if: { var: done, eq: 0 }, do: 'emit', type: go });
    world.reactions.push({ on: go, do: 'set', var: done, to: 1 }, { on: go, do: 'emit', type: 'wake', n: k + 1, of: W.length });
    for (const f of w.foes) world.reactions.push({ on: go, do: 'ctrl', op: 'spawn', who: f, fresh: true });
  });
  return { world, emits: ['wake'] };
}
