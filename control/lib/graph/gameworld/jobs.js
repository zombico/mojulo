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
 *   crew      a beat worked across departments as one (crews: a req's `crew`): an author per unit, each writing its own
 *             unit's pages, the crew sharing a notebook (`req: { id, job, post }`); critics once every author is kept
 *   assistant the assistant director (production.js): reads what was made, in the posture its director's style sets
 *             (assistive, strict, elevating), and recommends to the director: pass-up, rework or elevate, with reasons.
 *             It never decides: the director does (`req: { id, direct }`)
 *   a role    every job's stable seat (production.js roleOf): the same seat does the same work beat after beat
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
import { budgetOf, unitsOf } from './reqs.js';
import { POSTURES, LENSES, JOB_AGENTS } from './job-words.js';
import { checkRecommendation } from './production.js';

export const ANGLES = Object.freeze([
  'the remit read most plainly: what it asks, made well',
  'the boldest reading of the remit: the version a player remembers',
  'the reading furthest from the precedent: what this unit can do that the last one did not',
]);
export { LENSES };
export const JOB_KINDS = Object.freeze(['author', 'diverge', 'critic', 'probe', 'assistant']);
export const JOB_STATUSES = Object.freeze(['issued', 'submitted', 'kept', 'declined', 'reissued']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The lower of two tiers (the budget's tier is a ceiling). */
const capped = (tier, ceiling) => TIERS[Math.min(TIERS.indexOf(tier), TIERS.indexOf(ceiling) < 0 ? TIERS.length - 1 : TIERS.indexOf(ceiling))];

/** The authors a req is started with. → [{ kind, tier, angle? }] */
export function authorPlan(req) {
  const B = budgetOf(req);
  // a crew: an author per unit, each its own unit's
  if (Array.isArray(req.crew) && req.crew.length) return unitsOf(req).map((unit) => ({ kind: 'author', tier: B.tier, unit }));
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
// (the reissues an author is sent back by: a critic or the assistant reissued to read the work again spends none)
export const reissuesLeft = (req, jobs) => Math.max(0, (budgetOf(req).reissues | 0) - jobs.filter((j) => j.status === 'reissued' && (j.kind === 'author' || j.kind === 'diverge')).length);

/** The pages a unit's job writes: a level's page, a planned map's segment, or its chapter's paths. */
export function unitPaths(unit) {
  const u = unitOf(unit);
  if (!u) return [];
  // (a segment's glyphs, and its sketch: the segment planned in miniature, level/map-sketch.js)
  if (u.segment != null) return [`/levels/${u.level}/glyphs/segments/${u.segment}`, `/levels/${u.level}/glyphs/sketch/segments/${u.segment}`];
  return u.level != null ? [`/levels/${u.level}`] : [...u.chapter.paths];
}

/** A patch's ops that land past the unit's pages. */
/** The unit a job writes: its own (a crew's author), else its req's. */
export const jobUnit = (job, req) => job.unit ?? req.unit;

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
  if (job.kind === 'assistant') {
    if (patch !== undefined) throw new Error(`${job.id} is the assistant director: it recommends, never a patch`);
    checkRecommendation(input);
    return;
  }
  if (job.kind === 'critic') {
    if (!Array.isArray(findings) || findings.some((f) => !isObj(f) || typeof f.says !== 'string')) throw new Error(`${job.id} is a critic: it reports findings: [{ says, part?, severity? }]`);
    if (patch !== undefined) throw new Error(`${job.id} is a critic: it reports findings, never a patch`);
    return;
  }
  if (!Array.isArray(patch) || !patch.length || patch.some((op) => !isObj(op) || typeof op.path !== 'string')) throw new Error(`${job.id} is an author: it reports its pages as patch: [{ op, path, value? }]`);
}

/** What a job is handed: the call it reads with, what it writes, how it reports. Everything else is in its view. */
export function jobBrief(job, req, { ref, agents = false }) {
  const unit = jobUnit(job, req);
  // the agent to hand it to, for a host that has the plugin's job agents (capabilities.jobAgents)
  const agent = agents && JOB_AGENTS[job.kind] ? { agent: JOB_AGENTS[job.kind] } : {};
  if (job.kind === 'assistant') {
    return {
      job: job.id, kind: 'assistant', tier: job.tier, status: job.status, ...agent, ...(job.role ? { role: job.role } : {}),
      posture: `${job.posture}: ${POSTURES[job.posture]}`,
      read: { tool: 'design_game', args: { ref, chapter: req.unit, as: `${req.id}.${job.id}` } },
      submit: { tool: 'design_game', args: { ref, req: { id: req.id, job: job.id, recommend: 'pass-up | rework | elevate', reasons: '["…"]', fixes: '["…"]?', bolder: '"…"?' } } },
    };
  }
  const submit = job.kind === 'critic'
    ? { tool: 'design_game', args: { ref, req: { id: req.id, job: job.id, findings: '[{ says, part?, severity? }]' } } }
    : { tool: 'design_game', args: { ref, req: { id: req.id, job: job.id, patch: '[{ op: set | add | remove, path, value }] on your pages', decisions: '[{ slot, value, because }]', asks: '[what the remit asks that no word of the recipe reaches]' } } };
  return {
    job: job.id, kind: job.kind, tier: job.tier, status: job.status, ...agent, ...(job.role ? { role: job.role } : {}),
    ...(job.angle ? { angle: job.angle } : {}), ...(job.lens ? { lens: `${job.lens}: ${LENSES[job.lens]}` } : {}),
    read: { tool: 'design_game', args: { ref, chapter: unit, as: `${req.id}.${job.id}` } },
    ...(job.kind === 'critic' ? {} : { writes: unitPaths(unit) }),
    ...(Array.isArray(req.crew) && req.crew.length ? { crew: { units: unitsOf(req), notebook: { tool: 'design_game', args: { ref, req: { id: req.id, job: job.id, post: '"what the others need to know"' } } } } } : {}),
    submit,
  };
}

/** A job's seat: `as: '<req>.<job>'` read against its req and jobs → { job, unit, units } (the units its view may name:
 * its own for an author, the crew's for a critic and the assistant director, who read its work whole). Throws, teaching. */
export function seatOf(as, { req = null, jobs = [] } = {}) {
  const m = typeof as === 'string' ? /^(r\d+)\.(j\d+)$/.exec(as) : null;
  if (!m) throw new Error("design_game: as is a job's seat, '<req>.<job>' (its brief's read says it: 'r2.j1')");
  if (!req || req.id !== m[1]) throw new Error(`design_game: as '${as}': no req ${m[1]} in this world's ledger`);
  const job = jobs.find((j) => j.id === m[2]);
  if (!job) throw new Error(`design_game: as '${as}': ${m[1]} has no job ${m[2]} (its jobs: ${jobs.map((j) => j.id).join(', ') || 'none'})`);
  if (job.status === 'reissued') throw new Error(`design_game: as '${as}': ${m[2]} was reissued; read the job that replaced it (the req's jobs say it)`);
  if (job.kind === 'probe') throw new Error(`design_game: as '${as}': the probe is the server's, never an agent's seat`);
  // (the assistant director and a critic read the crew's work whole: every unit of the req; an author its own)
  const whole = job.kind === 'assistant' || job.kind === 'critic';
  const unit = whole ? req.unit : jobUnit(job, req);
  return { job, unit, units: whole ? unitsOf(req) : [unit] };
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
    ...(job.unit ? { unit: job.unit } : {}), ...(job.role ? { role: job.role } : {}),
    ...(r.recommend ? { recommend: r.recommend, reasons: r.reasons, ...(r.fixes ? { fixes: r.fixes } : {}), ...(r.bolder ? { bolder: r.bolder } : {}), ...(job.posture ? { posture: job.posture } : {}) } : {}),
    ...(r.outside?.length ? { outside: r.outside } : {}),
    ...(Array.isArray(r.asks) && r.asks.length ? { asks: r.asks } : {}),
  };
}

/** What the director does next with a req, from its jobs: start it, hand the issued jobs out, keep one proposal, hand
 * the critics out, probe a level (`probe`: 'none' | 'failed' | 'holds', the received gate's probe as it stands; 'skipped' when
 * no browser could play it, which goes on to the creator), fix what the probe found (reissue its author), or show the creator. */
export function nextOf(jobs = [], { level = false, probe = 'none', presented = false } = {}) {
  const live = jobs.filter((j) => j.status !== 'reissued' && j.kind !== 'probe');
  if (!live.length) return 'start';
  const authors = live.filter((j) => j.kind === 'author' || j.kind === 'diverge');
  if (authors.some((j) => j.status === 'issued')) return 'work';
  if (!authors.some((j) => j.status === 'kept')) return 'keep';
  if (live.some((j) => j.kind === 'critic' && j.status === 'issued')) return 'critique';
  // a level is played by the probe before the creator is shown it; a probe that does not hold sends it back to its author
  if (level && probe === 'none') return 'probe';
  if (level && probe === 'failed') return 'fix';
  // the assistant director prepares the call; the director makes it (settle, rework, or show the creator)
  const ad = live.filter((j) => j.kind === 'assistant').at(-1);
  if (!ad || ad.status === 'issued') return 'assist';
  return presented ? 'review' : 'decide';
}

/** A req's jobs in a line each: `j1 diverge submitted`. */
export const jobLines = (jobs = []) => jobs.map((j) => `${j.id} ${j.kind}${j.unit ? ` ${j.unit}` : ''} ${j.status}`);
