/**
 * THE JOBS — the work inside one req (reqs.js), each the size of one agent's turn: the exact call it reads with, the
 * pages it may write, the call it reports with, and the tier of judgment it needs. A req's jobs are issued when the
 * director starts it (`req: { id, start: true }`), from its staffing:
 *
 *   author    writes the unit: reads its view, sends its pages as a patch with the decisions it made and why
 *             soloist: one author, kept on submit (its patch applied at once)
 *   diverge   studio: n authors (budget.diverge), each given an ANGLE on the remit so the n differ: the plainest
 *             reading, the boldest, the furthest from the precedent. Each patch is held; the director (or the creator)
 *             keeps one (`req: { id, keep: 'j2' }`): that patch is applied, the others declined and kept on record
 *   critic    studio, issued when a proposal is kept (budget.critics): a fresh reading with a LENS (design against the
 *             remit, play as a player, look as a viewer), never the maker's reasoning; it sends findings
 *   probe     a level's, the server's own (a ride job, `req: { id, probe: true }`): the play probe (game/level-probe.js)
 *             played over the level's stages as they stand; its verdict is the received gate's last check
 *
 *   A decision is { slot, value?, because? }: one without `because` is a choice the seed made, counted as uncited.
 *   An ask is what the remit wants that no word of the recipe reaches: kept on the job, a gap said, never faked.
 *   A patch op past the unit's pages is held and applied as the door applies any patch, and said (`outside`).
 *   Budget (reqs.js budgetOf): jobs issued, the diverge count, the critics, the reissues; a job past it is not issued,
 *   and the req comes back to the director with that said.
 *
 * Pure: the req and its jobs in; the plan, the briefs and the checks out. The ledger rows are db/repositories.
 */
import { TIERS } from '../../agent-tasks/tiers.js';
import { unitOf } from './chapters.js';
import { budgetOf } from './reqs.js';

export const ANGLES = Object.freeze([
  'the remit read most plainly: what it asks, made well',
  'the boldest reading of the remit: the version a player remembers',
  'the reading furthest from the precedent: what this unit can do that the last one did not',
]);
export const LENSES = Object.freeze({
  design: 'against the remit and the precedent: does it do what it was asked, and is its one new idea there?',
  play: 'as a player: the way in, what stands in the way, the way out; where it is a default and plays like one',
  look: 'as a viewer: the first sight of it, its palette against the world, what reads as a default',
});
export const JOB_KINDS = Object.freeze(['author', 'diverge', 'critic', 'probe']);
export const JOB_STATUSES = Object.freeze(['issued', 'submitted', 'kept', 'declined', 'reissued']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The lower of two tiers (the budget's tier is a ceiling). */
const capped = (tier, ceiling) => TIERS[Math.min(TIERS.indexOf(tier), TIERS.indexOf(ceiling) < 0 ? TIERS.length - 1 : TIERS.indexOf(ceiling))];

/** The authors a req is started with. → [{ kind, tier, angle? }] */
export function authorPlan(req) {
  const B = budgetOf(req);
  if (!(B.diverge > 0)) return [{ kind: 'author', tier: B.tier }];
  return Array.from({ length: B.diverge }, (_, i) => ({ kind: 'diverge', tier: B.tier, angle: ANGLES[i % ANGLES.length] }));
}

/** The critics a kept proposal is given. → [{ kind: 'critic', tier, lens }] */
export function criticPlan(req) {
  const B = budgetOf(req), lenses = Object.keys(LENSES);
  return Array.from({ length: Math.max(0, B.critics | 0) }, (_, i) => ({ kind: 'critic', tier: capped('judge', B.tier), lens: lenses[i % lenses.length] }));
}

/** How many more jobs the budget allows, counting every job issued (a reissue is a job). */
// (the server's own ride jobs, the probe among them, are not an agent's and spend nothing)
export const jobsLeft = (req, jobs) => Math.max(0, (budgetOf(req).jobs | 0) - jobs.filter((j) => j.kind !== 'probe').length);
export const reissuesLeft = (req, jobs) => Math.max(0, (budgetOf(req).reissues | 0) - jobs.filter((j) => j.status === 'reissued').length);

/** The pages a unit's job writes: a level's page, or its chapter's paths. */
export function unitPaths(unit) {
  const u = unitOf(unit);
  if (!u) return [];
  return u.level != null ? [`/levels/${u.level}`] : [...u.chapter.paths];
}

/** A patch's ops that land past the unit's pages. */
export function outsideOf(unit, patch = []) {
  const own = unitPaths(unit);
  return patch.map((op) => op?.path).filter((p) => typeof p === 'string' && !own.some((q) => p === q || p.startsWith(`${q}/`)));
}

/** A report's decisions, cited and not. */
export function citing(decisions = []) {
  const uncited = decisions.filter((d) => !(typeof d?.because === 'string' && d.because.trim())).map((d) => String(d?.slot ?? '?'));
  return { cited: decisions.length - uncited.length, ...(uncited.length ? { uncited } : {}) };
}

/** A submission checked against its job: an author's patch, a critic's findings. Throws with what is wrong. */
export function checkSubmit(job, input) {
  if (!job) throw new Error('no such job');
  if (job.status !== 'issued') throw new Error(`${job.id} is ${job.status}: only an issued job reports`);
  const { patch, decisions, findings } = input;
  if (decisions !== undefined && (!Array.isArray(decisions) || decisions.some((d) => !isObj(d) || typeof d.slot !== 'string'))) throw new Error('decisions are [{ slot, value?, because? }]');
  if (input.asks !== undefined && (!Array.isArray(input.asks) || input.asks.some((a) => typeof a !== 'string'))) throw new Error('asks are ["what the remit asks that no word reaches", …]');
  if (job.kind === 'critic') {
    if (!Array.isArray(findings) || findings.some((f) => !isObj(f) || typeof f.says !== 'string')) throw new Error(`${job.id} is a critic: it reports findings: [{ says, part?, severity? }]`);
    if (patch !== undefined) throw new Error(`${job.id} is a critic: it reports findings, never a patch`);
    return;
  }
  if (!Array.isArray(patch) || !patch.length || patch.some((op) => !isObj(op) || typeof op.path !== 'string')) throw new Error(`${job.id} is an author: it reports its pages as patch: [{ op, path, value? }]`);
}

/** What a job is handed: the call it reads with, what it writes, how it reports. Everything else is in its view. */
export function jobBrief(job, req, { ref }) {
  const submit = job.kind === 'critic'
    ? { tool: 'design_game', args: { ref, req: { id: req.id, job: job.id, findings: '[{ says, part?, severity? }]' } } }
    : { tool: 'design_game', args: { ref, req: { id: req.id, job: job.id, patch: '[{ op, path, value }] on your pages', decisions: '[{ slot, value, because }]', asks: '[what the remit asks that no word of the recipe reaches]' } } };
  return {
    job: job.id, kind: job.kind, tier: job.tier, status: job.status,
    ...(job.angle ? { angle: job.angle } : {}), ...(job.lens ? { lens: `${job.lens}: ${LENSES[job.lens]}` } : {}),
    read: { tool: 'design_game', args: { ref, chapter: req.unit } },
    ...(job.kind === 'critic' ? {} : { writes: unitPaths(req.unit) }),
    submit,
  };
}

/** A job as the ledger reports it once it has reported: what it did, without the patch itself. */
export function jobReport(job) {
  const r = job.report ?? {};
  return {
    job: job.id, kind: job.kind, status: job.status,
    ...(job.angle ? { angle: job.angle } : {}), ...(job.lens ? { lens: job.lens } : {}),
    ...(Array.isArray(r.patch) ? { writes: [...new Set(r.patch.map((op) => op.path))] } : {}),
    ...(Array.isArray(r.decisions) ? { decisions: citing(r.decisions) } : {}),
    ...(Array.isArray(r.findings) ? { findings: r.findings } : {}),
    ...(r.outside?.length ? { outside: r.outside } : {}),
    ...(Array.isArray(r.asks) && r.asks.length ? { asks: r.asks } : {}),
  };
}

/** What the director does next with a req, from its jobs: start it, hand the issued jobs out, keep one proposal, hand
 * the critics out, probe a level (`probe`: 'none' | 'failed' | 'holds', the received gate's probe as it stands; 'skipped' when
 * no browser could play it, which goes on to the creator), fix what the probe found (reissue its author), or show the creator. */
export function nextOf(jobs = [], { level = false, probe = 'none' } = {}) {
  const live = jobs.filter((j) => j.status !== 'reissued' && j.kind !== 'probe');
  if (!live.length) return 'start';
  const authors = live.filter((j) => j.kind !== 'critic');
  if (authors.some((j) => j.status === 'issued')) return 'work';
  if (!authors.some((j) => j.status === 'kept')) return 'keep';
  if (live.some((j) => j.kind === 'critic' && j.status === 'issued')) return 'critique';
  // a level is played by the probe before the creator is shown it; a probe that does not hold sends it back to its author
  if (level && probe === 'none') return 'probe';
  if (level && probe === 'failed') return 'fix';
  return 'review';
}

/** A req's jobs in a line each: `j1 diverge submitted`. */
export const jobLines = (jobs = []) => jobs.map((j) => `${j.id} ${j.kind} ${j.status}`);
