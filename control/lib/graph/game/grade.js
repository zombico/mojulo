/**
 * THE GRADE (an emitter): a level's medal, read off what it kept at the moment it is won. Each criterion names a var the
 * level keeps (a time, the seconds flown out of a band, a landing's sink rate) and the bounds of gold, silver and bronze;
 * the medal is the worst a criterion gives (a fast lesson flown sloppily is not gold). A lesson's grade: the time it took
 * and how cleanly it held its bands, a landing's softness.
 *
 *   criteria   [{ var, label?, best: 'low' | 'high', gold, silver, bronze }]: for a low best (a time), at or under a
 *              bound earns it; for a high (a score), at or over. Past bronze earns none (0)
 *   on         the event it is read at (default 'objectives:done', the objectives' win)
 *
 * Lowered onto the bus (no runtime of its own): a var `__grade` from 3 (gold) down, each criterion read in turn at `on`
 * and capping it in steps (the bus has no conjunctions: a criterion's step is its own event, its cap guarded by the medal
 * still above it); then `grade:gold | grade:silver | grade:bronze | grade:none`, and a toast.
 *
 * It keeps the medal for the level's result: `{ var: '__grade', label: 'Medal', best: 'high', names: GRADE_NAMES }`,
 * the shell showing it by its name and remembering the best.
 *
 * Params: { criteria: [...], on? }
 *   lowerGrade(p, ctx) → { world, keep, emits }   (game/mechanics.js registers it)
 *
 * Pure, no dice.
 */
export const GRADE_NAMES = Object.freeze(['no medal', 'bronze', 'silver', 'gold']);
export const GRADE_VAR = '__grade';
const VAR = /^[A-Za-z_][A-Za-z0-9_:-]{0,63}$/;

export function lowerGrade(p, ctx) {
  const where = `grade[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const C = p.criteria;
  if (!Array.isArray(C) || !C.length) fail('needs criteria: [{ var, best: low | high, gold, silver, bronze }], at least one');
  C.forEach((c, k) => {
    const at = `criteria[${k}]`;
    if (!c || typeof c !== 'object') fail(`${at} is { var, best, gold, silver, bronze }`);
    if (typeof c.var !== 'string' || !VAR.test(c.var)) fail(`${at}.var is the kept var it reads`);
    if (c.best !== 'low' && c.best !== 'high') fail(`${at}.best is low (a time: less is better) or high (a score)`);
    for (const m of ['gold', 'silver', 'bronze']) if (!Number.isFinite(c[m])) fail(`${at}.${m} is a number: the bound that earns it`);
    const ok = c.best === 'low' ? c.gold <= c.silver && c.silver <= c.bronze : c.gold >= c.silver && c.silver >= c.bronze;
    if (!ok) fail(`${at}: gold, silver and bronze go from the best bound to the least (${c.best === 'low' ? 'gold ≤ silver ≤ bronze' : 'gold ≥ silver ≥ bronze'})`);
  });
  const on = p.on ?? 'objectives:done';
  if (typeof on !== 'string' || !on) fail('on is the event the grade is read at');
  const G = GRADE_VAR, pre = `__grade_${ctx.i}`;
  const world = { vars: { [G]: 0 }, reactions: [], hud: [] };
  // read at the win: gold to start, each criterion in turn (its own event, after the one before)
  world.reactions.push({ on, do: 'set', var: G, to: 3 }, { on, do: 'emit', type: `${pre}:c0` });
  C.forEach((c, k) => {
    const step = `${pre}:c${k}`, worse = c.best === 'low' ? 'gt' : 'lt';
    // past gold: silver at most; past silver: bronze at most; past bronze: none (each a cap, guarded by the medal still
    // above it, so a criterion only ever lowers it)
    [['gold', 2], ['silver', 1], ['bronze', 0]].forEach(([b, cap]) => {
      const capE = `${pre}:c${k}:${b}`;
      world.reactions.push({ on: step, if: { var: c.var, [worse]: c[b] }, do: 'emit', type: capE });
      world.reactions.push({ on: capE, if: { var: G, gt: cap }, do: 'set', var: G, to: cap });
    });
    world.reactions.push({ on: step, do: 'emit', type: k + 1 < C.length ? `${pre}:c${k + 1}` : `${pre}:said` });
  });
  // said: by its name, on the bus and as a toast
  GRADE_NAMES.forEach((name, m) => {
    const type = m ? `grade:${name}` : 'grade:none';
    world.reactions.push({ on: `${pre}:said`, if: { var: G, eq: m }, do: 'emit', type, medal: m });
    world.hud.push({ on: type, text: m ? `${name[0].toUpperCase()}${name.slice(1)}` : 'No medal', as: 'toast', ttl: 3 });
  });
  return {
    world,
    keep: [{ var: G, label: 'Medal', best: 'high', names: [...GRADE_NAMES] }, ...C.filter((c) => c.label).map((c) => ({ var: c.var, label: c.label, best: c.best }))],
    emits: ['grade:gold', 'grade:silver', 'grade:bronze', 'grade:none'],
  };
}
