/**
 * THE ASKS — the production ledger's top: the intent the agent acts on, cut as a ticket when intent becomes work (a unit
 * asked for, a verdict given, a patch written, a run made), never once a turn. So a long session's decisions can be read
 * back without its turns: from any ticket, a trace walks to the intent above it and the work below it.
 *
 *   an ask      { intent: '<the agent's inference of what the person wants, in its own words>', units?: ['<unit>'] }
 *               (a<n> within its world). It is the agent's INFERENCE, never the person's message: there is no field for
 *               their words, and a call that tries to give them is refused. Acting on an inferred intent is the consent
 *               the record stands on; the person's words stay in their conversation.
 *   its links   what it caused, one row each (db gameworld_ask_links: its parent pointer): a req raised, a verdict given
 *               (the part, at the recipe's revision), a patch written or a run made (the revision it left)
 *   a trace     from an ask (a3), a req (r2) or a job (r2.j1): the ask, its reqs with their jobs (each decision with its
 *               because, what no word reached, the critics' findings, the revision a kept patch made), its verdicts, its
 *               patches and runs. Its correlation path (`<world>·a3·r2·j1`) is derived, never stored.
 *
 * Pure: the ledger's rows in, the check and the trace out.
 */

export const ASK_INTENT_MAX = 1024;
// the person's words have no field: a call that tries to give them is refused, naming the rule
const WORDS = ['says', 'said', 'prompt', 'message', 'words', 'quote', 'text', 'verbatim'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** An `ask` as the door takes it: a new one ({ intent, units? }) or an existing one by its id (a3). Throws, teaching. */
export function checkAsk(ask) {
  if (typeof ask === 'string') {
    if (!/^a[1-9]\d*$/.test(ask)) throw new Error('design_game: an ask is { intent, units? } to cut a ticket, or an existing ticket\'s id (a1, a2 …)');
    return;
  }
  if (!isObj(ask)) throw new Error('design_game: an ask is { intent, units? } to cut a ticket, or an existing ticket\'s id (a1, a2 …)');
  const words = Object.keys(ask).filter((k) => WORDS.includes(k));
  if (words.length) throw new Error(`design_game: an ask records the intent you inferred, in your own words, never the person's (${words.join(', ')} has no place in it): give { intent }`);
  const unknown = Object.keys(ask).filter((k) => k !== 'intent' && k !== 'units');
  if (unknown.length) throw new Error(`design_game: an ask is { intent, units? } (not ${unknown.join(', ')})`);
  if (typeof ask.intent !== 'string' || !ask.intent.trim()) throw new Error('design_game: an ask\'s intent is what you understood and are doing, in a sentence or two');
  if (ask.intent.length > ASK_INTENT_MAX) throw new Error(`design_game: an ask's intent is at most ${ASK_INTENT_MAX} characters: the intent, not a transcript`);
  if (ask.units !== undefined && (!Array.isArray(ask.units) || ask.units.some((u) => typeof u !== 'string'))) throw new Error('design_game: an ask\'s units are the units it maps to, ["level:crypt", "foes"]');
}

/** A trace's starting point: an ask (a3), a req (r2) or a job (r2.j1). → { ask?, req?, job? } or throws. */
export function traceStart(id) {
  if (typeof id !== 'string') throw new Error('design_game: trace names a ticket: an ask (a3), a req (r2) or a job (r2.j1)');
  if (/^a[1-9]\d*$/.test(id)) return { ask: id };
  const m = /^(r[1-9]\d*)(?:\.(j[1-9]\d*))?$/.exec(id);
  if (!m) throw new Error('design_game: trace names a ticket: an ask (a3), a req (r2) or a job (r2.j1)');
  return { req: m[1], ...(m[2] ? { job: m[2] } : {}) };
}

/** A job as a trace shows it: what it did and why, without the patch's values. */
export function tracedJob(job) {
  const r = job.report ?? {};
  return {
    id: job.id, kind: job.kind, status: job.status,
    ...(job.angle ? { angle: job.angle } : {}), ...(job.lens ? { lens: job.lens } : {}),
    ...(Array.isArray(r.patch) ? { wrote: [...new Set(r.patch.map((op) => op.path))] } : {}),
    ...(Array.isArray(r.decisions) && r.decisions.length ? { decisions: r.decisions.map((d) => ({ slot: d.slot, ...(d.value !== undefined ? { value: d.value } : {}), because: d.because ?? null })) } : {}),
    ...(Array.isArray(r.asks) && r.asks.length ? { asks: r.asks } : {}),
    ...(Array.isArray(r.findings) && r.findings.length ? { findings: r.findings } : {}),
    ...(job.kind === 'probe' ? { holds: r.holds === true, ...(r.skipped ? { skipped: r.skipped } : {}) } : {}),
    ...(Number.isInteger(r.rev) ? { rev: r.rev } : {}),
  };
}

/**
 * The trace. → { path, ask?, reqs, verdicts, patches, runs }
 *   world      the world's ref (the path's root)
 *   ask        the ask ({ id, intent, units? }) or null (a req raised with no ticket)
 *   links      its links ([{ kind, target, detail? }])
 *   reqs       the reqs to show ([{ id, unit, status, remit? }]), each with `jobs` (their rows)
 *   focus      { req?, job? }: where the trace started, when below the ask
 */
export function traceOf({ world, ask = null, links = [], reqs = [], focus = {} }) {
  const path = [world, ask?.id, focus.req, focus.job].filter(Boolean).join('·');
  const by = (kind) => links.filter((l) => l.kind === kind);
  return {
    path,
    ...(ask ? { ask: { id: ask.id, intent: ask.intent, ...(ask.units ? { units: ask.units } : {}) } } : { ask: null }),
    reqs: reqs.map((r) => ({ id: r.id, unit: r.unit, status: r.status, ...(r.remit ? { remit: r.remit } : {}), jobs: (r.jobs ?? []).filter((j) => !focus.job || r.id !== focus.req || j.id === focus.job).map(tracedJob) })),
    ...(by('verdict').length ? { verdicts: by('verdict').map((l) => ({ part: l.target, ...(l.detail ?? {}) })) } : {}),
    ...(by('patch').length ? { patches: by('patch').map((l) => ({ rev: Number(l.target), ...(l.detail ?? {}) })) } : {}),
    ...(by('run').length ? { runs: by('run').map((l) => ({ rev: Number(l.target), ...(l.detail ?? {}) })) } : {}),
  };
}
