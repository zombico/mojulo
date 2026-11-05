/**
 * THE REQUISITIONS — the studio's production ledger: the director asks for one UNIT at a time (a chapter of the book,
 * or one level: chapters.js unitOf), and the unit is worked to quality before the next, so a mistake stays in its unit
 * and an accepted unit is settled ground for the one after it. A req (`r1`, `r2` … within its world) is a row of the
 * ledger (db gameworld_reqs), never part of the recipe.
 *
 *   status, DERIVED each read from the book's review stamps (review.js), never stored:
 *     accepted    every part of the unit approved by the creator, unchanged since (a unit with no review part: the
 *                 creator's verdict on the print of its pages). The eyes gate: only the creator's verdict makes it
 *     stale       accepted, then the unit changed (an approval gone `changed`, or its pages' print moved), or a
 *                 chapter it reads moved since it was accepted (the prints kept when the ledger first read it accepted)
 *     received    not yet accepted, and its machine gate holds (receiptOf): a proposal kept, its decisions cited, its
 *                 critics reported, its laws holding, and a level's stages played by the probe as they stand
 *     sent back   a part of it sent back (`revise`); the creator's note is kept in the ledger as precedent
 *     open        the current unit: the first in order that is neither accepted nor cancelled
 *     queued      after the current one
 *     cancelled   the director withdrew it;  gone   its level is no longer in the world
 *   pull-through  raising a unit raises first, each as its own req, the chapters upstream it reads (chapters.js
 *                 `reads`, through and through) that the book holds and has not settled: never a chapter already
 *                 settled or already asked for. A chapter with no review of its own (written) is not pulled
 *   precedent     what the current unit reads besides its chapter: the last accepted unit of its kind (a level's is
 *                 the last accepted level) with its remit, and the creator's notes on everything sent back so far
 *   remit         what the unit must be. A level's: in, out, band (how hard), idea (the one new thing it teaches),
 *                 foes, beat (its place in the story). Advised when missing, never required
 *   staffing      soloist (one author, no diverge, no critic: the quick path) or studio (authors, diverge, critics),
 *                 each with its budget, what the server can count; the jobs that spend it are the next phase's
 *
 * Pure: the ledger's rows, the world and the readout's part stamps in; the statuses, the queue and the advice out.
 */
import { CHAPTERS, chapterById, chapterOfPart, unitOf, levelStep } from './chapters.js';
import { chapterPages } from './chapter-view.js';
import { fingerprint } from './review.js';

export const STAFFING = Object.freeze({
  soloist: Object.freeze({ jobs: 4, tier: 'design', diverge: 0, critics: 0, reissues: 2 }),
  studio: Object.freeze({ jobs: 10, tier: 'judge', diverge: 2, critics: 2, reissues: 2 }),
});
export const LEVEL_REMIT = Object.freeze({
  in: 'how the player arrives, from where and with what',
  out: 'how it ends and where it leads',
  band: 'how hard, against the levels around it',
  idea: 'the one new thing it teaches',
  foes: 'who stands in it, and their ranks',
  beat: 'its place in the story',
});
const TERMINAL = new Set(['accepted', 'cancelled', 'gone']);
const NOTES_KEPT = 12;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The budget a req works to: its staffing's, with what it overrides. */
export const budgetOf = (req) => ({ ...(STAFFING[req.staffing] ?? STAFFING.soloist), ...(isObj(req.budget) ? req.budget : {}) });

/** A unit's kind, for precedent: every level is one kind; a chapter is its own. */
export const kindOf = (unit) => (unitOf(unit)?.level != null ? 'level' : unit);

/** The print of a unit's pages: what a verdict on a unit with no review part is given on. */
export function unitPrint(world, unit) {
  const u = unitOf(unit);
  if (!u) return null;
  return fingerprint(u.level != null ? world?.levels?.[u.level] ?? null : chapterPages(world, u.chapter.id));
}

/** The readout's part stamps that are the unit's. */
export function unitParts(unit, parts = []) {
  const u = unitOf(unit);
  if (!u) return [];
  return parts.filter((p) => (u.level != null ? p.id === `level:${u.level}` : chapterOfPart(p.id) === u.chapter));
}

/** The prints of the chapters a unit reads, as they stand: kept when a unit is first read accepted, so a move upstream
 * after it stales it. */
export function upstreamPrints(unit, world) {
  const u = unitOf(unit);
  if (!u) return {};
  return Object.fromEntries(u.chapter.reads.map((r) => [r, fingerprint(chapterPages(world, r))]));
}
const upstreamMoved = (req, world) => {
  const kept = req.verdict?.upstream;
  if (!isObj(kept)) return [];
  const now = upstreamPrints(req.unit, world);
  return Object.keys(kept).filter((k) => kept[k] !== now[k]);
};

/** One req's own status, before its place in the queue. */
export function reqStatus(req, { world, parts = [] } = {}) {
  const u = unitOf(req.unit);
  if (req.verdict?.status === 'cancelled') return 'cancelled';
  if (!u || (u.level != null && !isObj(world?.levels?.[u.level]))) return 'gone';
  const own = unitParts(req.unit, parts);
  if (own.length) {
    if (own.every((p) => p.status === 'approved')) return upstreamMoved(req, world).length ? 'stale' : 'accepted';
    if (own.some((p) => p.status === 'changed')) return 'stale';
    if (own.some((p) => p.status === 'revise')) return 'sent back';
    return 'live';
  }
  if (req.verdict?.status === 'accepted') return req.verdict.print === unitPrint(world, req.unit) && !upstreamMoved(req, world).length ? 'accepted' : 'stale';
  return 'live';
}

/** Why an accepted unit went stale upstream: the chapters it reads that moved since it was accepted. */
export const staleUpstream = (req, world) => upstreamMoved(req, world);

/**
 * THE RECEIVED GATE — a unit's machine gate, before the creator's verdict. → { holds, checks, said? }
 *   proposal   a proposal kept (an author's, or a diverge author's the director kept)
 *   cited      every decision of the kept proposal says why
 *   critics    every critic issued has reported
 *   laws       the unit's parts: no law of the machine gate advising
 *   probe      a level: its stages made, and the play probe (a ride job) played them as they stand and holds
 * What it does not hold on, it says: the kept proposal's asks (what no word reaches) and the critics' findings.
 */
export function receiptOf(req, { jobs = [], parts = [], world, made = {} } = {}) {
  const u = unitOf(req.unit), live = jobs.filter((j) => j.status !== 'reissued');
  const kept = live.filter((j) => j.kind !== 'critic' && j.kind !== 'probe' && j.status === 'kept').at(-1) ?? null;
  const uncited = (kept?.report?.decisions ?? []).filter((d) => !(typeof d?.because === 'string' && d.because.trim())).map((d) => d.slot);
  const waiting = live.filter((j) => j.kind === 'critic' && j.status === 'issued').map((j) => j.id);
  const advising = unitParts(req.unit, parts).filter((p) => p.machine?.length).map((p) => `${p.id}: ${p.machine.join(', ')}`);
  const checks = [
    { check: 'proposal', holds: !!kept, ...(kept ? {} : { says: 'no proposal kept: start it and work its jobs' }) },
    { check: 'cited', holds: !!kept && !uncited.length, ...(kept && uncited.length ? { says: `decisions with no because: ${uncited.join(', ')}` } : {}) },
    { check: 'critics', holds: !waiting.length, ...(waiting.length ? { says: `still to report: ${waiting.join(', ')}` } : {}) },
    { check: 'laws', holds: !advising.length, ...(advising.length ? { says: advising.join('; ') } : {}) },
  ];
  if (u?.level != null) {
    const stages = Object.keys(made).filter((k) => levelStep(u.level).test(k)).sort();
    const prints = Object.fromEntries(stages.map((k) => [k, made[k]?.stored ?? null]));
    const probe = live.filter((j) => j.kind === 'probe' && j.status === 'submitted').at(-1) ?? null;
    const current = probe && (!kept || probe.n > kept.n) && JSON.stringify(probe.report?.prints ?? {}) === JSON.stringify(prints);
    checks.push({
      check: 'probe',
      holds: !!stages.length && !!current && probe.report?.holds === true,
      ...(!stages.length ? { says: `no stage made: { chapter: '${req.unit}', run: true }` }
        : !current ? { says: probe ? 'its stages moved since the probe played them: probe again' : 'not played: { req: { id, probe: true } }' }
        : probe.report?.holds !== true ? { says: probe.report?.skipped ?? (probe.report?.checks ?? []).filter((c) => !c.holds).map((c) => `${c.check}: ${c.says}`).join('; ') } : {}),
    });
  }
  const asks = kept?.report?.asks ?? [];
  const findings = live.filter((j) => j.kind === 'critic' && j.status === 'submitted').flatMap((j) => (j.report?.findings ?? []).map((f) => `${j.id}: ${f.says}`));
  const said = { ...(asks.length ? { asks } : {}), ...(findings.length ? { findings } : {}) };
  return { holds: checks.every((c) => c.holds), checks, ...(Object.keys(said).length ? { said } : {}) };
}

/** The ledger read: each req with its status and place; → { reqs, current } (current: the req being worked, or null).
 * `received(req)` → does its machine gate hold (receiptOf), for a req not accepted. */
export function readLedger(rows, { world, parts = [], received = null } = {}) {
  let current = null;
  const reqs = rows.map((r) => {
    const own0 = reqStatus(r, { world, parts });
    const own = own0 === 'live' && received?.(r) ? 'received' : own0;
    if (TERMINAL.has(own)) return { ...r, status: own };
    if (!current) { current = r.id; return { ...r, status: own === 'live' ? 'open' : own }; }
    return { ...r, status: own === 'live' || own === 'received' ? 'queued' : own };
  });
  return { reqs, current: reqs.find((r) => r.id === current) ?? null };
}

/** The creator's notes on a req's parts sent back, merged into what the ledger keeps; → the notes, or null if none new. */
export function notesWith(req, parts = []) {
  const kept = Array.isArray(req.notes) ? req.notes : [];
  const fresh = unitParts(req.unit, parts)
    .filter((p) => p.status === 'revise' && typeof p.note === 'string' && p.note.trim())
    .map((p) => ({ unit: req.unit, part: p.id, note: p.note }))
    .filter((n) => !kept.some((k) => k.part === n.part && k.note === n.note));
  return fresh.length ? [...kept, ...fresh] : null;
}

/** What a req reads besides its chapter: the last accepted unit of its kind before it, and the creator's notes so far. */
export function precedentOf(req, reqs) {
  const kind = kindOf(req.unit);
  const last = reqs.filter((r) => r.seq < req.seq && r.status === 'accepted' && kindOf(r.unit) === kind).at(-1);
  const notes = reqs.flatMap((r) => r.notes ?? []).slice(-NOTES_KEPT);
  if (!last && !notes.length) return null;
  return { ...(last ? { last: { id: last.id, unit: last.unit, ...(last.remit ? { remit: last.remit } : {}) } } : {}), ...(notes.length ? { notes } : {}) };
}

/** The chapters a unit pulls through: upstream it reads, held by the book and not settled, none already asked for;
 * in book order. `book` is the readout's chapters (chapterBook: id, state). */
export function pullThrough(unit, { book = [], reqs = [] } = {}) {
  const u = unitOf(unit);
  if (!u) return [];
  const up = new Set();
  const visit = (id) => { for (const r of chapterById(id)?.reads ?? []) if (!up.has(r)) { up.add(r); visit(r); } };
  visit(u.chapter.id);
  const state = new Map(book.map((c) => [c.id, c.state]));
  const asked = new Set(reqs.filter((r) => r.status !== 'cancelled' && r.status !== 'gone').map((r) => r.unit));
  return CHAPTERS.map((c) => c.id).filter((id) => up.has(id) && ['open', 'advised'].includes(state.get(id)) && !asked.has(id));
}

/** A remit's advice: for a level, the parts of a remit it leaves out (words, never a refusal). */
export function remitAdvice(unit, remit) {
  if (unitOf(unit)?.level == null) return [];
  const missing = Object.keys(LEVEL_REMIT).filter((k) => !(isObj(remit) && remit[k] !== undefined && remit[k] !== ''));
  return missing.length ? [`${unit}: its remit says nothing of ${missing.join(', ')} (${missing.map((k) => `${k}: ${LEVEL_REMIT[k]}`).join('; ')})`] : [];
}

/** The readout's line for the ledger. */
export function ledgerSummary({ reqs, current }) {
  if (!reqs.length) return null;
  const count = (s) => reqs.filter((r) => r.status === s).length;
  return {
    ...(current ? { current: { id: current.id, unit: current.unit, status: current.status, staffing: current.staffing, ...(current.remit ? { remit: current.remit } : {}) } } : {}),
    queue: reqs.filter((r) => r.status === 'queued' || ((r.status === 'stale' || r.status === 'sent back') && r.id !== current?.id)).map((r) => `${r.id} ${r.unit} (${r.status})`),
    accepted: count('accepted'),
    ...(count('cancelled') ? { cancelled: count('cancelled') } : {}),
    ...(count('gone') ? { gone: count('gone') } : {}),
  };
}

/** A req as the unit's own view carries it: the remit, the precedent and the budget it is worked to. */
export function reqForView(req, reqs) {
  const precedent = precedentOf(req, reqs);
  return { id: req.id, status: req.status, staffing: req.staffing, budget: budgetOf(req), ...(req.remit ? { remit: req.remit } : {}), ...(precedent ? { precedent } : {}) };
}
