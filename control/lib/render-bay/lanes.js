/**
 * Render Bay lanes — the one model of "mojulo is producing something".
 *
 * Four expressions of the same sentence were scattered across the dashboard with
 * no single place to watch them: the durable image-render queue
 * (`image_render_requests`), GI bakes (`bake-world-gi.mjs`), cooks (`/outputs`)
 * and model/audio/game exports (per-artifact download buttons). This module is
 * the shared vocabulary all three lanes read from, so the page, the API route and
 * the tests cannot drift about what a state MEANS.
 *
 * ── The gates are never conflated ───────────────────────────────────────────
 * docs/bicycles.md: a bicycle is a loop with a MACHINE gate (something measurable
 * a program checks) and an EYES gate (a person or agent looking). They are
 * different gates and the surface must not merge them. That is why the queue has
 * four stages and not the three §5 named: `submitted` is precisely the state
 * where the machine is done and the eyes have not looked, and folding it into
 * "in flight" would hide the one gate §5 asks to make visible.
 *
 * ── Nothing here mutates ─────────────────────────────────────────────────────
 * Every lane action resolves to agent-directed prompt TEXT (the golden rule: the
 * dashboard renders state and hands the operator a prompt). The prompt strings
 * are addressed to the operator's agent, not UI chrome, so they stay English —
 * the same call the beats/voice studios make.
 *
 * Pure and import-light on purpose: the client bundle carries it, and the API
 * route uses the same functions server-side.
 *
 * Design: components/3d-factory-ui.plan.md §5.
 */

/** The three lanes, in display order. */
export const RENDER_LANES = ['queue', 'bakes', 'outputs'];

/** Queue stages, in flow order. `gate` is the eyes gate; see the header. */
export const QUEUE_STAGES = ['queued', 'inFlight', 'gate', 'done'];

/**
 * Every status the `image_render_requests` CHECK constraint allows, mapped to
 * its stage, its signal hue token (globals.css: teal exists/runs, amber the agent
 * must act, red fault) and who the row is waiting on.
 *
 * `rejected` is deliberately `done` + waiting on the worker rather than a stage
 * of its own: the row is terminal for the eyes gate but `recordSubmit` accepts
 * `rejected`, so a repaint lands back on the same row.
 */
const QUEUE_STATUS = {
  pending:   { stage: 'queued',   signal: 'forge', waitingOn: 'worker' },
  in_flight: { stage: 'inFlight', signal: 'forge', waitingOn: 'worker' },
  submitted: { stage: 'gate',     signal: 'forge', waitingOn: 'eyes' },
  accepted:  { stage: 'done',     signal: 'live',  waitingOn: null },
  rejected:  { stage: 'done',     signal: 'fault', waitingOn: 'worker' },
  expired:   { stage: 'done',     signal: 'idle',  waitingOn: null },
  cancelled: { stage: 'done',     signal: 'idle',  waitingOn: null },
};

/**
 * A status's meaning. An unknown status (a future CHECK value this build predates)
 * lands in `done` as idle and says so rather than vanishing from every lane — a
 * queue row the surface cannot classify must still be countable.
 */
export function queueStatusMeta(status) {
  return QUEUE_STATUS[status] || { stage: 'done', signal: 'idle', waitingOn: null, unknown: true };
}

/**
 * How long a pulled request may sit in_flight before the surface calls it stale.
 * The schema comment is explicit that there is no lease here — `pulled_at` is a
 * timestamp, not a claim that expires — so this is a READING, never a transition:
 * the bay flags it, and only the operator's agent decides to re-pull.
 */
export const STALE_IN_FLIGHT_SECONDS = 30 * 60;

/** Has this pulled request been in flight past the staleness reading? */
export function isStalled(request, nowSeconds) {
  if (!request || request.status !== 'in_flight' || !request.pulledAt) return false;
  return nowSeconds - request.pulledAt > STALE_IN_FLIGHT_SECONDS;
}

/**
 * Stages whose rows are NEVER collapsed. The eyes gate is per-render by nature:
 * each submitted PNG needs its own look and carries its own `request_id`, and
 * `accept_image_render` takes exactly one. Every other stage is waiting on a
 * worker, and `pull_image_render` drains by REF — so the tool's own grain is the
 * artifact there, and the surface should match it.
 */
export const PER_REQUEST_STAGES = ['gate'];

/**
 * Collapse a stage's rows to one per ref.
 *
 * Without this the bay is unreadable on a real workshop: one sequential-art page
 * parks a request per panel and one keyframe clip parks a request per mouth
 * shape, so twenty-four rows of the same ref push the eyes gate and the other two
 * lanes off the bottom of the screen. Twenty-four pending targets on one clip is
 * ONE artifact waiting, and that is what the operator is deciding about.
 *
 * The group keeps the newest movement, the worst-case stall, and every target,
 * so nothing is hidden — only folded.
 */
export function collapseByRef(requests = []) {
  const groups = new Map();
  for (const request of requests) {
    const group = groups.get(request.ref) || {
      ref: request.ref,
      kind: request.kind,
      status: request.status,
      requests: [],
      targets: [],
      updatedAt: 0,
      pulledAt: null,
    };
    group.requests.push(request);
    group.targets.push(request.target);
    group.updatedAt = Math.max(group.updatedAt, request.updatedAt || 0);
    // The OLDEST pull in the group, so a stall reading reflects the worst case
    // rather than being reset by whichever sibling was claimed most recently.
    if (request.pulledAt && (group.pulledAt == null || request.pulledAt < group.pulledAt)) {
      group.pulledAt = request.pulledAt;
    }
    groups.set(request.ref, group);
  }
  return [...groups.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Bucket queue rows by stage, preserving the incoming order within each. */
export function groupQueueByStage(requests = []) {
  const out = Object.fromEntries(QUEUE_STAGES.map((s) => [s, []]));
  for (const request of requests) {
    out[queueStatusMeta(request?.status).stage].push(request);
  }
  return out;
}

/** Per-status tallies plus a per-stage roll-up, from whole-table counts. */
export function queueTotals(statusCounts = {}) {
  const stages = Object.fromEntries(QUEUE_STAGES.map((s) => [s, 0]));
  let total = 0;
  for (const [status, n] of Object.entries(statusCounts)) {
    stages[queueStatusMeta(status).stage] += n;
    total += n;
  }
  return { total, stages, statuses: { ...statusCounts } };
}

/**
 * The agent-directed prompt for a queue row, or null when the row is settled and
 * there is nothing to ask for. Terminal-but-idle rows (expired, cancelled) get
 * no prompt on purpose: re-parking is a `request_image_render` against the head
 * manifest, not a resurrection of a dead row.
 */
export function queuePrompt(request) {
  if (!request) return null;
  const { status, ref, target, id } = request;
  if (status === 'pending') {
    return `Pull and paint the queued render for ${ref} (target "${target}"): call pull_image_render({ ref: "${ref}" }), condition your image generator on the returned scaffold, then submit_image_render({ request_id, image_path }).`;
  }
  if (status === 'in_flight') {
    return `Render request ${id} (${ref}, target "${target}") is in flight with a worker. If it has stalled, re-pull it with pull_image_render({ request_id: "${id}" }) and submit against the same id.`;
  }
  if (status === 'submitted') {
    return `Eyes gate: look at the submitted render for ${ref} (target "${target}") and verify it against the scaffold — beat/pose carried, strict forms placed, bubble zones blank, identity holding. Then accept_image_render({ request_id: "${id}", accept_audit: { … }, source: "<your id, not the worker's>" }) or reject_image_render({ request_id: "${id}", accept_audit: { notes: "…" } }).`;
  }
  if (status === 'rejected') {
    return `Render request ${id} (${ref}, target "${target}") was rejected. Repaint against the same request and re-submit: pull_image_render({ request_id: "${id}" }) then submit_image_render({ request_id: "${id}", image_path }).`;
  }
  return null;
}

/**
 * The prompt for a collapsed group. `pull_image_render({ ref })` drains one
 * sketch's requests, so a whole waiting artifact is one ask — which is why the
 * fold is honest rather than merely tidy.
 */
export function queueGroupPrompt(group) {
  if (!group) return null;
  const n = group.requests.length;
  if (n === 1) return queuePrompt(group.requests[0]);
  if (group.status === 'pending' || group.status === 'in_flight') {
    return `Paint the ${n} queued renders for ${group.ref}: call pull_image_render({ ref: "${group.ref}" }) repeatedly — it claims the oldest pending target each time — condition your image generator on each returned scaffold, and submit_image_render({ request_id, image_path }) after each. Targets: ${group.targets.join(', ')}.`;
  }
  if (group.status === 'rejected') {
    return `${n} renders for ${group.ref} were rejected. Repaint each against its own request: pull_image_render({ request_id }) then submit_image_render({ request_id, image_path }). Targets: ${group.targets.join(', ')}.`;
  }
  return null;
}

/**
 * The machine gate's threshold in `bake-world-gi.mjs`: more than a quarter of the
 * lit-paint floor faces coming back near-black means the facing or the bake is
 * wrong, and the driver fails before binding anything.
 */
export const BAKE_BLACK_FRAC_LIMIT = 0.25;

/**
 * The two gates on a bake, read honestly.
 *
 * A bake row EXISTS only because the machine gate already passed — the driver
 * exits before it binds otherwise — so the machine gate is reported as passed
 * WITH its measured numbers rather than re-derived. The eyes gate has no column:
 * nothing records that the operator looked. So it reports `recorded: false` and
 * stays the operator's call, instead of borrowing the machine's verdict, which
 * is exactly the conflation docs/bicycles.md forbids.
 */
export function bakeGates(bake) {
  const blackFrac = bake?.floorBlackFrac;
  const matchRate = bake?.matchRate;
  return {
    machine: {
      passed: true,
      floorBlackFrac: typeof blackFrac === 'number' ? blackFrac : null,
      matchRate: typeof matchRate === 'number' ? matchRate : null,
      limit: BAKE_BLACK_FRAC_LIMIT,
    },
    eyes: { recorded: false, href: bakeViewHref(bake) },
  };
}

/**
 * Where the eyes gate is actually satisfied — the artifact under its Baked
 * display mode (phase 2's `?display=`). A `generated-mesh` bake lives in its own
 * `<ref>_gi` variant, so that is the ref to open; an `inline-faces` bake
 * recoloured the world's own faces, so the bake IS the artifact.
 */
export function bakeViewHref(bake) {
  if (!bake?.ref) return null;
  return `/sketches/${encodeURIComponent(bake.ref)}?display=baked`;
}

/** The agent-directed prompt for a bake row: re-bake at a different preset. */
export function bakePrompt(bake) {
  if (!bake) return null;
  const source = bake.from || bake.ref;
  return `Re-bake the world GI for ${source} at a different preset: node scripts/bake-world-gi.mjs --ref ${source} --preset interior-day|exterior|space|interior-lit --write (add --preview for a dry run; from a checkout's control/, or \`mojulo script bake-world-gi\` with the same flags on an install). Needs a local Blender.`;
}

/**
 * Output-file kinds, keyed off the append-only filenames the writers mint. Each
 * key is an i18n key and a signal, never a display string.
 *
 * `model`/`mesh` are kept apart: `model.glb` is what `export_model` wrote from the
 * recipe, `mesh-<n>.glb` is a refined mesh bound BACK from an external tool. Same
 * extension, opposite direction of travel, and the bay should not blur them.
 */
const OUTPUT_FILE_KINDS = [
  { kind: 'model', test: (n) => /^model\.(glb|stl)$/i.test(n) },
  { kind: 'mesh', test: (n) => /^mesh-\d+\.glb$/i.test(n) },
  { kind: 'render', test: (n) => /^render-.*\.png$/i.test(n) },
  { kind: 'skin', test: (n) => /^skin-\d+\.png$/i.test(n) },
  { kind: 'voice', test: (n) => /^voice-\d+\.wav$/i.test(n) },
  { kind: 'motion', test: (n) => /\.(gif|mp4|webm)$/i.test(n) },
  { kind: 'game', test: (n) => /^game\.html$/i.test(n) },
  { kind: 'audio', test: (n) => /\.(wav|mp3|ogg)$/i.test(n) },
  { kind: 'score', test: (n) => /\.mid$/i.test(n) },
  { kind: 'page', test: (n) => /\.(html|svg|md)$/i.test(n) },
  { kind: 'recipe', test: (n) => /^(recipe\.json|manifest\.json)$/i.test(n) },
];

/** Classify one output filename. Anything unmatched is `other`, never dropped. */
export function classifyOutputFile(name) {
  if (!name) return 'other';
  for (const { kind, test } of OUTPUT_FILE_KINDS) if (test(name)) return kind;
  return 'other';
}

/**
 * The kinds an outputs row carries, tallied and ordered by OUTPUT_FILE_KINDS so
 * two rows with the same contents always chip identically.
 */
export function tallyOutputKinds(files = []) {
  const counts = {};
  for (const file of files) {
    const kind = classifyOutputFile(typeof file === 'string' ? file : file?.name);
    counts[kind] = (counts[kind] || 0) + 1;
  }
  const order = [...OUTPUT_FILE_KINDS.map((k) => k.kind), 'other'];
  return order.filter((k) => counts[k]).map((kind) => ({ kind, count: counts[kind] }));
}

/** Human-facing byte size. Mono readout, so the width is stable at 1 decimal. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(1)} ${units[unit]}`;
}
