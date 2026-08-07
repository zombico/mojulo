/**
 * Scheduler daemon — fires `trigger/scheduled@0.1.0` bindings.
 *
 * Reads active trigger artifacts from `mcp_orbit_trigger_artifacts` at boot,
 * registers each in a croner instance, and on fire: renders the payload
 * template, parks the task via `parkRequestForTrigger`, and writes a
 * `trigger_firing` principle on the target artifact node.
 *
 * Croner's `job.stop()` cancels future schedules but does NOT abort
 * in-flight callbacks (verified via pre-flight spike). The daemon tracks
 * in-flight async fires in a Set and drains them on `stop()` so SIGTERM
 * never orphans a task or its audit principle.
 *
 * Boot wiring lives in the runtime daemon host (`mojulo-daemons`), gated by
 * `MOJULO_DAEMONS=enabled` and `MOJULO_TRIGGER_RUNTIME` (opt-in, symmetric with
 * `MOJULO_AGENT_RUNTIME`). The control plane retains an in-process fallback
 * boot (see `lib/db/index.js`) when the host is not used. Reload signaling
 * rides on a process-internal EventEmitter — `bind_trigger` / `unbind_trigger`
 * call `requestReload()`, and the daemon picks it up the next tick.
 *
 * Phase 1: schedule kind only. Webhook (Phase 2) and watch (Phase 3) ship
 * as sibling daemons in this directory.
 *
 * See lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md.
 */

import { EventEmitter } from 'node:events';

import { Cron } from 'croner';

import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';
import { parkRequestForTrigger } from '@/lib/mcp/agent-tasks/queue';
import { recordTriggerFiring } from '@/lib/mcp/agent-tasks/audit';

const COMPONENT_REF = 'trigger/scheduled@0.1.0';

// Process-internal event bus for reload signaling. `bind_trigger` and
// `unbind_trigger` emit 'reload' here; the daemon listens. Single-process
// control plane means in-process events are sufficient — cross-process
// signaling waits for a deployment shape that warrants it.
const triggerEvents = new EventEmitter();

const jobs = new Map(); // trigger_ref → Cron instance
const inFlight = new Set(); // in-flight async fire promises
let started = false;
let reloadListener = null;

/**
 * Render a payload template with flat key substitution. Replaces `{{key}}`
 * occurrences anywhere a string appears in the template tree with the
 * matching value from `vars`. Missing keys leave the placeholder in place
 * so a forgotten substitution is visible to the operator (vs silently
 * stringified `undefined`).
 *
 * Phase 1 supports flat key substitution only — no loops, no conditionals.
 * Operators wanting richer transforms do that in the fulfiller, not in the
 * trigger's payload-shaping step.
 */
export function renderPayloadTemplate(template, vars) {
  if (template === null || template === undefined) return template;
  if (typeof template === 'string') {
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match;
    });
  }
  if (Array.isArray(template)) {
    return template.map((item) => renderPayloadTemplate(item, vars));
  }
  if (typeof template === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(template)) {
      out[k] = renderPayloadTemplate(v, vars);
    }
    return out;
  }
  return template;
}

function buildFireVars(scheduledAt, firedAt) {
  // Flat-key substitutions available inside a payload template at fire-time.
  // Kept narrow (4 keys) to discourage operators from building business
  // logic into payload templates. If a trigger needs richer context,
  // compose it in the fulfiller.
  return {
    fired_at: firedAt.toISOString(),
    fired_at_date: firedAt.toISOString().slice(0, 10),
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : firedAt.toISOString(),
    fired_at_unix: String(Math.floor(firedAt.getTime() / 1000)),
  };
}

async function fireTrigger(trigger, scheduledAt) {
  const firedAt = new Date();
  const driftMs = scheduledAt ? firedAt.getTime() - scheduledAt.getTime() : 0;
  const vars = buildFireVars(scheduledAt, firedAt);

  let parkedTaskRef = null;
  try {
    const payload = renderPayloadTemplate(trigger.payloadTemplate, vars);
    if (!payload || typeof payload.task_kind !== 'string') {
      throw new Error("rendered payload is missing 'task_kind'");
    }
    // Tag the payload with the caller_ref so the fulfiller's existing
    // app_inference audit attaches to the same artifact node as the
    // trigger_firing principle. Without this, the audit chain would
    // dangle — the parked task wouldn't know whose artifact to credit.
    const taggedPayload = { ...payload, caller_ref: payload.caller_ref || trigger.artifactRef };
    const result = parkRequestForTrigger(taggedPayload);
    parkedTaskRef = result.request_id;
  } catch (err) {
    console.warn(
      `[scheduler] parkRequestForTrigger failed for ${trigger.triggerRef}:`,
      err?.message || err,
    );
    // We still write the firing principle so the audit chain shows the
    // intended fire — but with no parkedTaskRef so the operator sees the
    // gap. Better to record "we tried to fire and failed" than to silently
    // drop the event.
  }

  try {
    recordTriggerFiring({
      artifactRef: trigger.artifactRef,
      triggerRef: trigger.triggerRef,
      componentRef: trigger.componentRef,
      firedAt: firedAt.toISOString(),
      parkedTaskRef,
      evidence: {
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        fired_at: firedAt.toISOString(),
        drift_ms: driftMs,
      },
    });
  } catch (err) {
    console.warn(
      `[scheduler] recordTriggerFiring failed for ${trigger.triggerRef}:`,
      err?.message || err,
    );
  }
}

function registerJob(trigger) {
  const { cron, timezone } = trigger.bindingParams;
  const job = new Cron(cron, { timezone: timezone || 'UTC' }, (self) => {
    const scheduledAt = self?.currentRun ? self.currentRun() : null;
    const work = fireTrigger(trigger, scheduledAt).catch((err) => {
      // Unexpected — fireTrigger swallows its own errors. Belt-and-braces
      // so a thrown promise can't break the daemon.
      console.warn(`[scheduler] unhandled fire error for ${trigger.triggerRef}:`, err?.message || err);
    });
    inFlight.add(work);
    work.finally(() => inFlight.delete(work));
    return work;
  });
  jobs.set(trigger.triggerRef, job);
}

function loadAndRegisterAll() {
  const triggers = TriggerArtifactRepository.listActive({ componentRef: COMPONENT_REF });
  for (const trigger of triggers) {
    if (!jobs.has(trigger.triggerRef)) registerJob(trigger);
  }
}

function startReloadListener() {
  if (reloadListener) return;
  reloadListener = () => {
    if (!started) return;
    try {
      reload();
    } catch (err) {
      console.warn('[scheduler] reload failed:', err?.message || err);
    }
  };
  triggerEvents.on('reload', reloadListener);
}

function stopReloadListener() {
  if (reloadListener) {
    triggerEvents.off('reload', reloadListener);
    reloadListener = null;
  }
}

/**
 * Start the daemon. Idempotent — re-entrant calls are no-ops.
 */
export function startScheduler() {
  if (started) return;
  started = true;
  startReloadListener();
  loadAndRegisterAll();
}

/**
 * Re-read active triggers, cancel jobs for triggers that are no longer
 * active, register newly-active ones. Invoked from the reload listener
 * after bind_trigger / unbind_trigger; safe to call directly in tests.
 */
export function reload() {
  if (!started) return;
  const triggers = TriggerArtifactRepository.listActive({ componentRef: COMPONENT_REF });
  const desired = new Set(triggers.map((t) => t.triggerRef));
  // Cancel jobs that are no longer active.
  for (const [ref, job] of jobs) {
    if (!desired.has(ref)) {
      job.stop();
      jobs.delete(ref);
    }
  }
  // Register newly-active triggers. Existing registrations stay — their
  // binding_params are immutable (rebinding produces a new trigger_ref).
  for (const trigger of triggers) {
    if (!jobs.has(trigger.triggerRef)) registerJob(trigger);
  }
}

/**
 * Stop the daemon and drain in-flight fires. Cancels future schedules
 * synchronously, then awaits any callback that was mid-fire so its
 * `parkRequestForTrigger` + `recordTriggerFiring` complete before
 * resolution. Idempotent.
 */
export async function stopScheduler() {
  if (!started) return;
  started = false;
  stopReloadListener();
  for (const job of jobs.values()) {
    try {
      job.stop();
    } catch (err) {
      console.warn('[scheduler] job.stop() error during shutdown:', err?.message || err);
    }
  }
  jobs.clear();
  await Promise.allSettled([...inFlight]);
  inFlight.clear();
}

/**
 * Called by `bind_trigger` / `unbind_trigger` (or tests) to request a
 * daemon reload. No-op when the daemon isn't running.
 */
export function requestReload() {
  triggerEvents.emit('reload');
}

export function isSchedulerRunning() {
  return started;
}

// Test seams. Not part of the public daemon API.
export const _internals = {
  jobs,
  inFlight,
  triggerEvents,
  renderPayloadTemplate,
  buildFireVars,
  fireTrigger,
  isStarted: () => started,
};
