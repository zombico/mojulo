/**
 * MCP Ring 8 — plan mode (deliberation → execution).
 *
 * Plan mode is the PROPOSED layer of mojulo's deliberation model: the
 * speculative counterpart to contextmap's committed reality. Most sessions
 * stay sessions; a few accumulate enough signal to become Plans — sealed
 * cognitive units that draw the schematic of one vertical slice (a "spike")
 * and, once tractable, compile to a manifest of tool calls the operator can
 * execute under per-execution approval.
 *
 * Tool surface:
 *   - enter_plan_mode — return the deliberation discipline (the four lenses,
 *     the frame, the shadow scratchpad, introspection-on-signal). The closest
 *     thing to "the plan-mode system prompt" shipped as a pullable brief.
 *   - forge_plan      — seal a Draft plan from a session (goal + optional
 *     frame/manifest/analysis shadow scratchpad).
 *   - revise_plan     — append a revision note + patch the schematic; resets
 *     status to draft (touching the schematic un-commits the compile).
 *   - compile_plan    — Draft → Actionable. Validates the manifest against the
 *     LIVE tool registry. If any call doesn't resolve to a shipped tool,
 *     compile FAILS with a structured missing-capability reason and the plan
 *     stays Draft (which is itself a roadmap signal).
 *   - execute_plan    — Actionable → executed/failed. Runs the manifest in
 *     order through the same handler path a remote tools/call hits. Stops on
 *     first failure. Requires an explicit confirm — the per-execution gate.
 *   - list_plans      — list plans (optional status filter). Read-only.
 *   - get_plan        — fetch one plan; flips its read/unread (seen) flag.
 *
 * v0 scope: no cross-plan context (plans never see other plans); subplans live
 * inside the prime plan's manifest, not as sibling rows. Execution records a
 * per-call log on the plan row — contextmap graduation (principles tagged with
 * plan_ref) is deferred until plans get first-class contextmap nodes.
 *
 * See lite-template/integration/app-system/0527/plan-feature/PLAN_MODE.md.
 */

import { registerTool, invokeRegisteredTool, hasRegisteredTool } from '@/lib/mcp/server';
import { PlanRepository } from '@/lib/db/repositories/plans';
import { recordPlanReleases, isReleaseCommitType } from '@/lib/mcp/meta-context/plan-release';

// Plan-mode meta-tools may never appear inside a plan's manifest — that would
// let a plan forge/compile/execute other plans, defeating the per-execution
// gate and inviting recursion. The validator rejects any manifest call naming
// one of these.
const PLAN_MODE_TOOL_NAMES = new Set([
  'enter_plan_mode',
  'forge_plan',
  'revise_plan',
  'compile_plan',
  'execute_plan',
  'list_plans',
  'get_plan',
]);

// Cap stored per-call result text so the execution log can't balloon the plan
// row (or leak a large payload verbatim). The full result still flows back to
// the calling agent in the execute_plan response; only the persisted log is
// truncated.
const MAX_RESULT_SNIPPET = 2000;

// ---------------------------------------------------------------------------
// enter_plan_mode — the deliberation discipline
// ---------------------------------------------------------------------------

const PLAN_MODE_BRIEF = `# Plan mode

You are in **plan mode** — a deliberation surface where a session is *gently pushed toward an outcome*, not left open-ended. Your job is to hone in on the goal, find the first vertical slice, draw a long-enough spike, and hammer it to the ground. A plan is the schematic of that spike.

## The four lenses (hold loosely; do not lock in early)

Carry all four available and slide between them until the *valuable gem* reveals itself. Do not announce which lens you're using and do not commit to one until the operator asks you to compile — each lens has a different manifest shape, so committing early forecloses recognition.

1. **Spike planning** (0→1, brand-new thing) — push: *"what's the smallest end-to-end that proves it?"*
2. **Segment expansion** (take a spike, widen it) — push: *"name the next three segments that share this shape."*
3. **Vertical reinforcement** (take a joint, fortify it) — push: *"what does this joint not carry today?"*
4. **Collider** (superpose existing concepts, extract implications) — push: *"what concrete artifact materializes — and is it itself a spike?"* A collider often does not terminate in itself; it *spawns* a spike plan rather than compiling directly.

## The shadow scratchpad (step 0 before each reply)

Before every reply, privately update a candidate manifest of tool calls + an un-shared analysis (which lens is winning, what reality says, what to discard). **These calls are DRAFTED, never FIRED** — do not invoke any mutating tool while deliberating. The scratchpad is how you stay productive without acting on speculation. Persist it only when you forge or revise the plan (as the \`analysis\` + \`manifest\` fields), not every turn.

## Introspection on signal

When enough signal accumulates that the gem is revealing, ground the candidate frame against committed reality BEFORE presenting it — compose \`meta_context_brief({scope:{kind:'fleet'}})\`, \`semantic_search\` for prior-art, and \`get_catalyst\` for recipe overlap. Introspection can RE-LENS the frame: you think it's a spike, find an overlapping artifact, and it becomes a reinforcement. Do this signal-triggered, not at session start — early grounding constrains lens-switching prematurely.

## The frame (the moment you present for approval)

When a frame crystallizes, present it: *"this is a [lens] toward [goal] with first slice [W]; I considered and discarded [other lenses]. Approve this frame?"* The operator approves the lens choice + the manifest in one move. They may instead send revision notes — apply them via \`revise_plan\` (mode-switching is a normal revision move).

## Tractability and the lifecycle

A plan is **tractable** — and only then Actionable — iff its spike is specific enough to be executed *deterministically by mojulo's build tools*: every manifest call must resolve to a live MCP tool. If it needs a capability mojulo doesn't have, it stays Draft (the missing capability is a roadmap signal). If the spike's value IS "codify this recipe," writing a catalyst is just another manifest call — so be it.

Flow: forge_plan (Draft) → revise_plan (loop) → compile_plan (Draft→Actionable; validates the manifest) → operator runs execute_plan (per-execution approval). Each manifest call lands as an ordinary mojulo tool call; lineage is carried by the plan's execution log.

## Manifest shape

\`manifest\` is an ordered array of \`{ "tool": "<live_tool_name>", "args": { ... }, "note": "<optional why>" }\`. Plan-mode meta-tools (forge_plan, compile_plan, execute_plan, …) may not appear in a manifest.`;

export async function enterPlanModeHandler(_input, _ctx) {
  return { brief: PLAN_MODE_BRIEF };
}

// ---------------------------------------------------------------------------
// forge_plan
// ---------------------------------------------------------------------------

export async function forgePlanHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('forge_plan requires an object with title + goal');
  }
  const { title, goal, lens, frame, manifest, analysis } = input;
  const plan = PlanRepository.forge({
    title,
    goalMd: goal,
    lens,
    frame,
    manifest,
    analysis,
  });
  return {
    ok: true,
    plan_ref: plan.planRef,
    status: plan.status,
    lens: plan.lens,
    has_manifest: Array.isArray(plan.manifest) && plan.manifest.length > 0,
  };
}

// ---------------------------------------------------------------------------
// revise_plan
// ---------------------------------------------------------------------------

export async function revisePlanHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('revise_plan requires an object with plan_ref + note');
  }
  const { plan_ref, note, goal, lens, frame, manifest, analysis } = input;
  if (!plan_ref || typeof plan_ref !== 'string') {
    throw new Error('plan_ref is required');
  }
  const patch = { note };
  if (goal !== undefined) patch.goalMd = goal;
  if (lens !== undefined) patch.lens = lens;
  if (frame !== undefined) patch.frame = frame;
  if (manifest !== undefined) patch.manifest = manifest;
  if (analysis !== undefined) patch.analysis = analysis;
  const plan = PlanRepository.revise(plan_ref, patch);
  if (!plan) {
    throw new Error(`Plan '${plan_ref}' not found. Call list_plans to see existing plans.`);
  }
  return {
    ok: true,
    plan_ref: plan.planRef,
    status: plan.status,
    lens: plan.lens,
    revisions: plan.revisionLog.length,
  };
}

// ---------------------------------------------------------------------------
// compile_plan — Draft → Actionable, gated on manifest tractability
// ---------------------------------------------------------------------------

/**
 * Validate a manifest against the LIVE tool registry. Returns
 * { calls, unknownTools, illegalTools, errors }. A manifest is tractable iff
 * errors is empty AND unknownTools is empty AND illegalTools is empty.
 */
function validateManifest(manifest) {
  const errors = [];
  const unknownTools = [];
  const illegalTools = [];
  const calls = [];
  if (!Array.isArray(manifest) || manifest.length === 0) {
    errors.push('manifest must be a non-empty array of { tool, args } calls');
    return { calls, unknownTools, illegalTools, errors };
  }
  manifest.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`manifest[${i}] must be an object { tool, args }`);
      return;
    }
    const { tool, args } = entry;
    if (!tool || typeof tool !== 'string') {
      errors.push(`manifest[${i}].tool must be a tool name (string)`);
      return;
    }
    if (args !== undefined && (typeof args !== 'object' || Array.isArray(args))) {
      errors.push(`manifest[${i}].args must be an object when provided`);
      return;
    }
    if (PLAN_MODE_TOOL_NAMES.has(tool)) {
      illegalTools.push(tool);
      return;
    }
    if (!hasRegisteredTool(tool)) {
      unknownTools.push(tool);
      return;
    }
    calls.push({ step: i, tool, args: args || {}, note: entry.note });
  });
  return { calls, unknownTools, illegalTools, errors };
}

export async function compilePlanHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('compile_plan requires an object with plan_ref');
  }
  const { plan_ref } = input;
  if (!plan_ref || typeof plan_ref !== 'string') {
    throw new Error('plan_ref is required');
  }
  const plan = PlanRepository.getByRef(plan_ref);
  if (!plan) {
    throw new Error(`Plan '${plan_ref}' not found.`);
  }

  const { calls, unknownTools, illegalTools, errors } = validateManifest(plan.manifest);
  const tractable =
    errors.length === 0 && unknownTools.length === 0 && illegalTools.length === 0;

  if (!tractable) {
    // Stay Draft. Hand back a structured "why" so the agent can either fix the
    // manifest (illegal/malformed) or surface the missing capability as a
    // roadmap signal (unknown tools = mojulo can't do this deterministically
    // yet).
    return {
      ok: false,
      compiled: false,
      plan_ref,
      status: plan.status, // unchanged (draft)
      reason: 'not_tractable',
      errors,
      unknown_tools: unknownTools,
      illegal_tools: illegalTools,
      message:
        unknownTools.length > 0
          ? `Plan stays Draft: ${unknownTools.length} manifest call(s) reference tools mojulo doesn't ship (${[...new Set(unknownTools)].join(', ')}). Either revise the spike to use live tools, or treat the gap as a roadmap signal.`
          : illegalTools.length > 0
            ? `Plan stays Draft: manifest references plan-mode meta-tools (${[...new Set(illegalTools)].join(', ')}), which may not appear in a manifest.`
            : `Plan stays Draft: manifest is malformed. ${errors.join('; ')}`,
    };
  }

  const updated = PlanRepository.setStatus(plan_ref, 'actionable');
  return {
    ok: true,
    compiled: true,
    plan_ref,
    status: updated.status,
    steps: calls.length,
    message: `Plan is Actionable: ${calls.length} step(s) resolve to live tools. Awaiting operator approval — execute_plan with confirm:true to run.`,
  };
}

// ---------------------------------------------------------------------------
// execute_plan — the per-execution gate, then run the manifest
// ---------------------------------------------------------------------------

function snippet(value) {
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text && text.length > MAX_RESULT_SNIPPET) {
    return `${text.slice(0, MAX_RESULT_SNIPPET)}…[truncated]`;
  }
  return text;
}

export async function executePlanHandler(input, ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('execute_plan requires an object with plan_ref + confirm');
  }
  const { plan_ref, confirm } = input;
  if (!plan_ref || typeof plan_ref !== 'string') {
    throw new Error('plan_ref is required');
  }
  if (confirm !== true) {
    throw new Error(
      'execute_plan requires confirm:true — this is the per-execution operator approval gate. Each run must be explicitly confirmed.',
    );
  }
  const plan = PlanRepository.getByRef(plan_ref);
  if (!plan) {
    throw new Error(`Plan '${plan_ref}' not found.`);
  }
  if (plan.status !== 'actionable') {
    throw new Error(
      `Plan '${plan_ref}' is '${plan.status}', not 'actionable'. Only Actionable plans can execute — compile_plan it first (and re-compile after any revision).`,
    );
  }

  // Re-validate at execution time: the registry could have changed, or a
  // revision could have slipped a bad call past a stale compile. Belt and
  // suspenders against executing an unknown tool.
  const { calls, unknownTools, illegalTools, errors } = validateManifest(plan.manifest);
  if (errors.length || unknownTools.length || illegalTools.length) {
    PlanRepository.setStatus(plan_ref, 'draft');
    throw new Error(
      `Plan '${plan_ref}' is no longer tractable (manifest changed or a tool was removed). Reset to Draft. errors=${JSON.stringify(errors)} unknown=${JSON.stringify(unknownTools)} illegal=${JSON.stringify(illegalTools)}`,
    );
  }

  PlanRepository.setStatus(plan_ref, 'executing');

  const executionLog = [];
  // Artifact materializations this manifest produced — the "a service was
  // registered" signal that closes the loop (release principle + archive).
  const materializations = [];
  let failed = false;
  for (const call of calls) {
    const startedAt = Math.floor(Date.now() / 1000);
    try {
      const result = await invokeRegisteredTool(call.tool, call.args, ctx);
      if (
        call.tool === 'meta_context_commit' &&
        result &&
        result.ok === true &&
        Number.isInteger(result.artifactNodeId) &&
        isReleaseCommitType(call.args?.type)
      ) {
        materializations.push({
          artifactNodeId: result.artifactNodeId,
          commitType: call.args.type,
        });
      }
      executionLog.push({
        step: call.step,
        tool: call.tool,
        ok: true,
        result_snippet: snippet(result),
        ran_at: startedAt,
      });
    } catch (err) {
      executionLog.push({
        step: call.step,
        tool: call.tool,
        ok: false,
        error: err?.message || String(err),
        ran_at: startedAt,
      });
      failed = true;
      break; // stop on first failure — operator re-forges the remainder
    }
  }

  const terminalStatus = failed ? 'failed' : 'executed';
  PlanRepository.recordExecution(plan_ref, { executionLog, status: terminalStatus });

  // Close the loop: if the manifest materialized artifact(s) into the
  // contextmap, graduate the plan — write a `plan_release` principle on each
  // artifact node and archive the plan. Soft-fail: the manifest already
  // succeeded and committed to the contextmap, so a release-recording failure
  // must NOT turn a successful execution into a reported failure. We surface
  // it as a warning instead.
  let release = null;
  let releaseWarning = null;
  if (!failed && materializations.length > 0) {
    try {
      const planRow = PlanRepository.getByRef(plan_ref);
      const closed = await recordPlanReleases({ plan: planRow, materializations });
      if (closed) release = closed.release;
    } catch (err) {
      releaseWarning = err?.message || String(err);
    }
  }

  const archivedCount = release?.artifacts?.length || 0;

  return {
    ok: !failed,
    plan_ref,
    status: terminalStatus,
    steps_run: executionLog.length,
    steps_total: calls.length,
    execution_log: executionLog,
    ...(release ? { release, archived: true } : {}),
    ...(releaseWarning ? { release_warning: releaseWarning } : {}),
    ...(failed
      ? {
          message: `Execution stopped at step ${executionLog[executionLog.length - 1].step} (${executionLog[executionLog.length - 1].tool}). Plan marked 'failed'; the completed steps are recorded. Re-forge the remainder as a new plan.`,
        }
      : archivedCount > 0
        ? {
            message: `Plan executed: ${calls.length} step(s) ran. Materialized ${archivedCount} artifact(s) → a plan_release principle was timestamped on each artifact's contextmap subhistory and the plan was archived.`,
          }
        : {
            message: `Plan executed: ${calls.length} step(s) ran. Each call ran through the same handler path as a direct tools/call.`,
          }),
  };
}

// ---------------------------------------------------------------------------
// list_plans / get_plan
// ---------------------------------------------------------------------------

function planSummary(p) {
  return {
    plan_ref: p.planRef,
    title: p.title,
    lens: p.lens,
    status: p.status,
    seen: p.seen,
    archived: p.archived,
    steps: Array.isArray(p.manifest) ? p.manifest.length : 0,
    revisions: p.revisionLog.length,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export async function listPlansHandler(input, _ctx) {
  const { status } = input || {};
  const plans = PlanRepository.list(status ? { status } : {});
  return { total: plans.length, plans: plans.map(planSummary) };
}

export async function getPlanHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_plan requires an object with plan_ref');
  }
  const { plan_ref } = input;
  if (!plan_ref || typeof plan_ref !== 'string') {
    throw new Error('plan_ref is required');
  }
  // Opening the plan flips its read/unread flag — the light inbox gate.
  const plan = PlanRepository.getByRef(plan_ref, { markSeen: true });
  if (!plan) {
    throw new Error(`Plan '${plan_ref}' not found.`);
  }
  return {
    plan_ref: plan.planRef,
    title: plan.title,
    goal: plan.goalMd,
    lens: plan.lens,
    status: plan.status,
    seen: plan.seen,
    frame: plan.frame,
    manifest: plan.manifest,
    analysis: plan.analysis,
    revision_log: plan.revisionLog,
    execution_log: plan.executionLog,
    archived: plan.archived,
    archived_at: plan.archivedAt,
    release: plan.release,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerPlanModeTools() {
  registerTool({
    name: 'enter_plan_mode',
    description:
      "Ring 8 — DELIBERATION surface (plan mode). Returns the plan-mode discipline: the four lenses (spike / segment-expansion / vertical-reinforcement / collider) held loosely, the shadow-scratchpad step-0 (draft tool calls but never fire them while deliberating), introspection-on-signal (ground the frame against committed reality only once the gem reveals), the frame-for-approval moment, and the lifecycle (forge → revise → compile → execute). Call this FIRST when the operator wants to plan a non-trivial piece of work — it primes you to push gently toward an outcome rather than open-endedly chat. Read-only, idempotent.",
    inputSchema: { type: 'object', properties: {} },
    handler: enterPlanModeHandler,
  });

  registerTool({
    name: 'forge_plan',
    description:
      "Ring 8 — seal a Draft plan from a session that's accumulated enough signal to warrant a solution. Persists the goal plus (optionally) the lens the frame settled into, the frame itself, the candidate manifest (ordered { tool, args } calls), and the un-shared analysis (lens weights, discarded lenses, introspection refs) — i.e. the projected shadow scratchpad. A plan can start goal-only and accrete its manifest through revise_plan. Returns { plan_ref, status:'draft', lens, has_manifest }. Forging does NOT execute anything — plans are speculative until compiled and run.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short human title for the plan inbox.' },
        goal: {
          type: 'string',
          description: 'The named goal (markdown ok) — what spike this plan hammers.',
        },
        lens: {
          type: 'string',
          enum: ['spike', 'segment_expansion', 'vertical_reinforcement', 'collider'],
          description: 'Which of the four lenses the frame settled into (optional while undecided).',
        },
        frame: {
          type: 'object',
          description:
            'The crystallized frame presented for approval: lens, goal restatement, first-slice summary, and discarded_lenses. Free-form object.',
        },
        manifest: {
          type: 'array',
          description:
            'Ordered candidate tool calls. Each item: { tool: <live tool name>, args: {…}, note?: <why> }. Plan-mode meta-tools may not appear here. Validated at compile time.',
          items: { type: 'object' },
        },
        analysis: {
          type: 'object',
          description:
            'Un-shared deliberation provenance: { lens_weights, discarded_lenses, introspection_refs, … }. Free-form object.',
        },
      },
      required: ['title', 'goal'],
    },
    handler: forgePlanHandler,
  });

  registerTool({
    name: 'revise_plan',
    description:
      "Ring 8 — apply a revision to a plan. Appends a { note, revised_at } entry to the revision log and optionally patches goal / lens / frame / manifest / analysis. Mode-switching ('this is a reinforcement, not a spike') is a normal revision. A revision ALWAYS resets status to 'draft' — touching the schematic un-commits the compile, so you must compile_plan again before re-executing. Returns { plan_ref, status:'draft', lens, revisions }.",
    inputSchema: {
      type: 'object',
      properties: {
        plan_ref: { type: 'string', description: 'Plan ref returned by forge_plan.' },
        note: {
          type: 'string',
          description: 'What changed and why (the operator note or your own re-framing rationale).',
        },
        goal: { type: 'string', description: 'New goal (optional patch).' },
        lens: {
          type: 'string',
          enum: ['spike', 'segment_expansion', 'vertical_reinforcement', 'collider'],
          description: 'Re-lens the plan (optional patch).',
        },
        frame: { type: 'object', description: 'Replace the frame (optional patch).' },
        manifest: {
          type: 'array',
          description: 'Replace the manifest (optional patch).',
          items: { type: 'object' },
        },
        analysis: { type: 'object', description: 'Replace the analysis (optional patch).' },
      },
      required: ['plan_ref', 'note'],
    },
    handler: revisePlanHandler,
  });

  registerTool({
    name: 'compile_plan',
    description:
      "Ring 8 — attempt Draft → Actionable. This is a COMPILE STEP, not a status flip: it validates the plan's manifest against the LIVE tool registry. Tractable iff every call resolves to a shipped MCP tool (and none are plan-mode meta-tools or malformed). On success: status becomes 'actionable' and the plan is ready for operator-approved execution. On failure: the plan stays Draft and the response carries a structured reason — `unknown_tools` (mojulo can't do this deterministically yet → roadmap signal), `illegal_tools`, or malformed `errors`. Returns { ok, compiled, status, steps?, unknown_tools?, illegal_tools?, errors?, message }.",
    inputSchema: {
      type: 'object',
      properties: {
        plan_ref: { type: 'string', description: 'Plan ref to compile.' },
      },
      required: ['plan_ref'],
    },
    handler: compilePlanHandler,
  });

  registerTool({
    name: 'execute_plan',
    description:
      "Ring 8 — execute an Actionable plan's manifest. THE PER-EXECUTION APPROVAL GATE: requires confirm:true, and the plan must be in status 'actionable' (compile it first; re-compile after any revision). Runs each manifest call in order through the exact same handler path a remote tools/call hits, so executed steps behave identically to operator-typed calls. Re-validates the manifest at execution time (resets to Draft and aborts if a tool vanished). STOPS ON FIRST FAILURE — completed steps are recorded, the plan is marked 'failed', and the operator re-forges the remainder. On full success the plan is marked 'executed'. CLOSES THE LOOP: if the manifest materialized artifact(s) into the contextmap (an app/primitive/artifact `meta_context_commit`), a `plan_release` principle is timestamped on each artifact node's subhistory and the plan is archived (status stays 'executed'; archive is orthogonal) — the response then carries `release` + `archived:true`. Release-recording is soft (a failure there surfaces as `release_warning`, never failing a successful execution). Returns { ok, status, steps_run, steps_total, execution_log, release?, archived?, message }. Use deliberately — manifest calls can be mutating (deploys, env writes); the confirm gate is the only thing between Actionable and real side effects.",
    inputSchema: {
      type: 'object',
      properties: {
        plan_ref: { type: 'string', description: 'Plan ref to execute (must be Actionable).' },
        confirm: {
          type: 'boolean',
          description: 'Must be true. The explicit per-execution operator approval.',
        },
      },
      required: ['plan_ref', 'confirm'],
    },
    handler: executePlanHandler,
  });

  registerTool({
    name: 'list_plans',
    description:
      "Ring 8 — list plans (the inbox). Optional `status` filter (draft / actionable / executing / executed / failed). Returns { total, plans: [{ plan_ref, title, lens, status, seen, steps, revisions, created_at, updated_at }] }. Read-only — does not flip the read/unread flag (only get_plan does).",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'actionable', 'executing', 'executed', 'failed'],
          description: 'Filter by status.',
        },
      },
    },
    handler: listPlansHandler,
  });

  registerTool({
    name: 'get_plan',
    description:
      "Ring 8 — fetch one plan in full (goal, lens, frame, manifest, analysis, revision_log, execution_log). Opening a plan flips its read/unread (`seen`) flag to read — this is the light inbox gate, not a formal review. Returns the full plan object.",
    inputSchema: {
      type: 'object',
      properties: {
        plan_ref: { type: 'string', description: 'Plan ref to fetch.' },
      },
      required: ['plan_ref'],
    },
    handler: getPlanHandler,
  });
}

// Test seam.
export const _internals = { validateManifest, PLAN_MODE_TOOL_NAMES, PLAN_MODE_BRIEF };
