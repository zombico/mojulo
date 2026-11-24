/**
 * A PERSON'S PAGES: what a townsperson says as the story moves on, RPG Maker's event pages in words. A person's `say`
 * (folk.js) may be a list of pages, read top to bottom: the first whose `if` holds is what they say, and a page with no
 * `if` always holds (the last, as a rule: what they say once nothing above it does).
 *
 *   say: { <person path | role>: text | [text, …] | [{ if?: condition | [condition], say: text | [text, …] }, …] }
 *     condition   a scene's (playscape/ui/scenes.js): { flag } | { not } | { has: '<item>' } | { done: '<level>' }
 *                 | { chapter } | { var, gte | gt | lte | lt | eq | ne }   (all of a list must hold)
 *
 * Lowered onto scenes, one a page on the same talk (folk-cast.js): each page's scene holds when its own conditions do
 * AND every page above it fails, written as exclusive branches (a page above with conditions c1, c2 fails as ¬c1, or c1
 * and ¬c2), so exactly one page is said each time the person is spoken to. Every condition is a value on the bus, so
 * each has its opposite (a flag set ↔ unset; held, done, a chapter turned ↔ its var not 1; a comparison turned round).
 *
 *   isPaged(v)            → a say value is a list of pages
 *   readPages(v, at)      → [{ if: [condition], lines: [text] }] or throws, teaching
 *   pageConds(pages)      → [[condition, …], …] per page: the conjunctions that hold where it, and none above it, is
 *                           said (a page that can never be said, under one with no `if`, has none: [])
 *   defaultLines(pages)   → the lines said when no condition can be read (a talk menu): the last page with no `if`, else
 *                           the first page's
 *
 * Pure and import-free.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (v) => typeof v === 'string' && v.trim().length > 0;
const CMP = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne'];
const TURN = Object.freeze({ gte: 'lt', gt: 'lte', lte: 'gt', lt: 'gte', eq: 'ne', ne: 'eq' });
// (a person rarely has more than a few pages, each a condition or two: the branches past this are refused, teaching)
export const PAGE_BRANCHES = 64;

export const isPaged = (v) => Array.isArray(v) && v.length > 0 && v.every(isObj);

function readCond(c, at) {
  const keys = isObj(c) ? Object.keys(c) : [];
  const one = (k) => keys.length === 1 && keys[0] === k && words(c[k]);
  if (one('flag') || one('not') || one('has') || one('done') || one('chapter')) return c;
  if (isObj(c) && words(c.var) && keys.length === 2 && CMP.some((k) => Number.isFinite(c[k]))) return c;
  throw new Error(`folk: say${at} is { flag } | { not } | { has: '<item>' } | { done: '<level>' } | { chapter } | { var, ${CMP.join(' | ')} }: a scene's condition`);
}

export function readPages(v, at = '') {
  if (!isPaged(v)) throw new Error(`folk: say${at} is a list of pages, [{ if?, say }], the first whose if holds said`);
  return v.map((p, i) => {
    for (const k of Object.keys(p)) if (k !== 'if' && k !== 'say') throw new Error(`folk: say${at}[${i}].${k} is not a page's (if, say)`);
    const lines = [].concat(p.say ?? []);
    if (!lines.length || !lines.every(words)) throw new Error(`folk: say${at}[${i}].say is text | [text, …]: what the person says on this page`);
    const conds = p.if === undefined ? [] : [].concat(p.if);
    if (p.if !== undefined && !conds.length) throw new Error(`folk: say${at}[${i}].if is a condition or a list of them (leave it out for a page always said)`);
    return { if: conds.map((c, j) => readCond(c, `${at}[${i}].if${Array.isArray(p.if) ? `[${j}]` : ''}`)), lines };
  });
}

/** A condition's opposite, in the same words where they have one, else on the var it is read as (scenes.js readCond). */
export function notCond(c) {
  if (c.flag !== undefined) return { not: c.flag };
  if (c.not !== undefined) return { flag: c.not };
  if (c.has !== undefined) return { var: `has-${c.has}`, ne: 1 };
  if (c.done !== undefined) return { var: `done-${c.done}`, ne: 1 };
  if (c.chapter !== undefined) return { var: `chapter-${c.chapter}`, ne: 1 };
  const op = CMP.find((k) => Number.isFinite(c[k]));
  return { var: c.var, [TURN[op]]: c[op] };
}

/** A page's conditions as it fails, as exclusive branches: c1..cn fails as ¬c1 | c1 ∧ ¬c2 | … | c1 ∧ … ∧ ¬cn. */
const fails = (conds) => conds.map((c, i) => [...conds.slice(0, i), notCond(c)]);

export function pageConds(pages, at = '') {
  const out = [];
  // (the branches where every page so far failed: one empty branch before the first)
  let failed = [[]];
  for (const p of pages) {
    out.push(failed.map((b) => [...b, ...p.if]));
    if (!p.if.length) { failed = []; continue; }
    failed = failed.flatMap((b) => fails(p.if).map((f) => [...b, ...f]));
    if (failed.length > PAGE_BRANCHES) throw new Error(`folk: say${at}: its pages' conditions branch past ${PAGE_BRANCHES} ways; say it with fewer pages or fewer conditions on each`);
  }
  return out;
}

export function defaultLines(pages) {
  const open = [...pages].reverse().find((p) => !p.if.length);
  return (open ?? pages[0]).lines;
}
