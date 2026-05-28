/**
 * MCP Ring 6 — trigger binding (composer-anchored activation).
 *
 * Sibling to `mcp-primitive-binding.js`. Where bind_primitives operationalizes
 * the `mcp` axis of the mcp-orbit composer, bind_trigger operationalizes the
 * `trigger` axis. Same posture: a typed component in the composer
 * (`trigger/scheduled@0.1.0` today; `trigger/webhook@0.1.0` Phase 2;
 * `trigger/watch@0.1.0` Phase 3) is the materialization target. Adding a new
 * trigger kind = ship a typed component + ship its daemon runtime; this tool
 * needs no per-kind code branch beyond the schema validator the component
 * declares.
 *
 * Phase 1 supports only `trigger/scheduled@0.1.0`. Other trigger components
 * may exist in mcp-orbit-components/trigger/ (e.g. signal-polled), but their
 * runtime daemons aren't shipped — bind_trigger rejects them at validation.
 *
 * Tool surface:
 *   - bind_trigger    — validate, insert artifact, seal via meta_context_commit
 *   - unbind_trigger  — disable an active trigger
 *   - list_triggers   — list active triggers with optional filters
 *   - get_trigger     — fetch a single trigger by ref
 *
 * See lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md.
 */

import { Cron } from 'croner';

import { registerTool } from '@/lib/mcp/server';
import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';
import { MCPOrbitComponentRepository } from '@/lib/db/repositories/mcp-orbit';
import { bestEffortDaemonReload } from '@/lib/daemons/client';
import { requestReload as requestSchedulerReload } from '@/lib/triggers/scheduler';
import { commitTriggerArtifactMaterialization } from './meta-context';

// Phase 1 ships scheduler runtime only. Future phases add webhook + watch —
// each adds an entry here once the corresponding daemon ships. Keeping this
// allowlist in code (not in the component file) means a typed component can
// exist in the composer before its runtime, and bind_trigger correctly
// surfaces "you can see this in list_mcp_orbit_components, but its runtime
// isn't here yet" rather than letting agents bind something nothing will fire.
const RUNTIME_SHIPPED_COMPONENTS = new Set(['trigger/scheduled@0.1.0']);

// ref shape: '<kind>/<ref>@<version>'. Returns null on malformed input so the
// caller can throw a typed error with a clearer message.
function parseComponentRef(componentRef) {
  if (typeof componentRef !== 'string') return null;
  const m = componentRef.match(/^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)@(\d+\.\d+\.\d+)$/i);
  if (!m) return null;
  return { kind: m[1], ref: m[2], version: m[3] };
}

// Schedule-component-specific validation. When future trigger kinds ship,
// each gets a sibling validator dispatched by component kind/ref.
function validateScheduleBindingParams(bindingParams) {
  if (!bindingParams || typeof bindingParams !== 'object' || Array.isArray(bindingParams)) {
    throw new Error('binding_params must be an object');
  }
  const { cron, timezone } = bindingParams;
  if (!cron || typeof cron !== 'string') {
    throw new Error("binding_params.cron is required (e.g. '0 9 * * *')");
  }
  if (timezone !== undefined && timezone !== null && typeof timezone !== 'string') {
    throw new Error('binding_params.timezone must be a string when provided');
  }
  // Parse with croner to reject invalid expressions at bind time. Same library
  // the scheduler daemon uses at runtime — single source of truth for what
  // counts as a valid expression. paused: true means we don't actually
  // schedule anything from this validation parse.
  let nextRunAt = null;
  try {
    const job = new Cron(cron, { timezone: timezone || 'UTC', paused: true });
    const next = job.nextRun();
    nextRunAt = next ? next.toISOString() : null;
    job.stop();
  } catch (err) {
    throw new Error(
      `binding_params.cron is not a valid cron expression: ${err?.message || String(err)}`,
    );
  }
  return { nextRunAt };
}

function validatePayloadTemplate(payloadTemplate) {
  if (
    !payloadTemplate ||
    typeof payloadTemplate !== 'object' ||
    Array.isArray(payloadTemplate)
  ) {
    throw new Error('payload_template must be an object');
  }
  if (typeof payloadTemplate.task_kind !== 'string' || !payloadTemplate.task_kind) {
    throw new Error(
      "payload_template.task_kind is required (e.g. 'envelope_inference') — names the agent-tasks queue kind that will receive the parked payload",
    );
  }
}

async function signalSchedulerReload() {
  requestSchedulerReload();
  await bestEffortDaemonReload('scheduler');
}

export async function bindTriggerHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error(
      'bind_trigger requires an object with component_ref / binding_params / payload_template',
    );
  }
  const {
    component_ref,
    binding_params,
    payload_template,
    composition_ref,
    artifact_ref,
  } = input;

  // --- composer-anchored ref resolution ----------------------------------

  const parsed = parseComponentRef(component_ref);
  if (!parsed) {
    throw new Error(
      "component_ref must be of the form '<kind>/<ref>@<version>' (e.g. 'trigger/scheduled@0.1.0')",
    );
  }
  if (parsed.kind !== 'trigger') {
    throw new Error(
      `component_ref must be of kind 'trigger' (got '${parsed.kind}'). Use bind_primitives for primitives, etc.`,
    );
  }
  const component = MCPOrbitComponentRepository.findByRef(
    parsed.kind,
    parsed.ref,
    parsed.version,
  );
  if (!component) {
    throw new Error(
      `Component '${component_ref}' is not in the composer's component store. Call list_mcp_orbit_components({kind:'trigger'}) to see what's shipped.`,
    );
  }
  if (!RUNTIME_SHIPPED_COMPONENTS.has(component_ref)) {
    throw new Error(
      `Component '${component_ref}' is typed in the composer but its runtime daemon is not shipped in this release. Phase 1 supports: ${[...RUNTIME_SHIPPED_COMPONENTS].join(', ')}.`,
    );
  }

  // --- per-component validation ------------------------------------------

  // The schedule kind is the only one Phase 1 validates concretely. Future
  // kinds add sibling branches: webhook validates the secret minting flow,
  // watch validates the source_mcp_ref + interval, etc.
  let schedulingHint = null;
  if (component_ref === 'trigger/scheduled@0.1.0') {
    const { nextRunAt } = validateScheduleBindingParams(binding_params);
    schedulingHint = { next_fire_at: nextRunAt };
  }
  validatePayloadTemplate(payload_template);

  // --- artifact_ref / composition_ref shape ------------------------------

  if (artifact_ref !== undefined && artifact_ref !== null && typeof artifact_ref !== 'string') {
    throw new Error('artifact_ref must be a string when provided');
  }
  if (
    composition_ref !== undefined &&
    composition_ref !== null &&
    typeof composition_ref !== 'string'
  ) {
    throw new Error('composition_ref must be a string when provided');
  }
  // Phase 1 requires artifact_ref — the contextmap principle attaches to the
  // target artifact node, so we need a node to attach to. Composition-only
  // triggers are deferred.
  if (!artifact_ref) {
    throw new Error(
      'artifact_ref is required in Phase 1. Composition-only triggers (no specific artifact) are deferred to a later phase.',
    );
  }

  // --- insert + seal ------------------------------------------------------

  let trigger;
  try {
    trigger = TriggerArtifactRepository.insert({
      componentRef: component_ref,
      bindingParams: binding_params,
      payloadTemplate: payload_template,
      compositionRef: composition_ref ?? null,
      artifactRef: artifact_ref,
    });
  } catch (err) {
    // The unique partial index on (composition_ref, artifact_ref,
    // component_ref) where enabled = 1 surfaces as a SQLITE_CONSTRAINT.
    // Map to a typed message the agent can act on.
    if (String(err?.message || '').includes('UNIQUE constraint')) {
      throw new Error(
        `A trigger already exists for component '${component_ref}' against this target (artifact_ref=${artifact_ref}${composition_ref ? `, composition_ref=${composition_ref}` : ''}). Call unbind_trigger first to rebind.`,
      );
    }
    throw err;
  }

  // Seal via the contextmap commit. The handler validates the target
  // artifact node exists; if it doesn't, the trigger row stays inserted
  // and the bind_trigger call surfaces the commit error — the agent's
  // recovery path is unbind_trigger + materialize the artifact first.
  let commitResult;
  try {
    commitResult = await commitTriggerArtifactMaterialization({
      type: 'trigger_artifact_materialization',
      trigger_ref: trigger.triggerRef,
    });
  } catch (err) {
    // Rollback the orphan trigger row so the operator can retry cleanly.
    TriggerArtifactRepository.disable(trigger.triggerRef);
    throw err;
  }

  // Signal the daemon (if running) to pick up the new trigger on its next
  // tick. No-op when the daemon isn't started — the bind is still durable
  // and a later boot with MOJULO_TRIGGER_RUNTIME=enabled picks it up via
  // listActive() at start.
  await signalSchedulerReload();

  return {
    ok: true,
    trigger_ref: trigger.triggerRef,
    component_ref: trigger.componentRef,
    artifact_ref: trigger.artifactRef,
    composition_ref: trigger.compositionRef,
    principle_id: commitResult.principleId,
    ...(schedulingHint || {}),
  };
}

export async function unbindTriggerHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('unbind_trigger requires an object with trigger_ref');
  }
  const { trigger_ref } = input;
  if (!trigger_ref || typeof trigger_ref !== 'string') {
    throw new Error('trigger_ref is required');
  }
  const existing = TriggerArtifactRepository.getByRef(trigger_ref);
  if (!existing) {
    throw new Error(
      `Trigger '${trigger_ref}' not found. Call list_triggers to see active triggers.`,
    );
  }
  if (!existing.enabled) {
    return { ok: true, trigger_ref, already_disabled: true };
  }
  TriggerArtifactRepository.disable(trigger_ref);
  await signalSchedulerReload();
  return { ok: true, trigger_ref, already_disabled: false };
}

export async function listTriggersHandler(input, _ctx) {
  const { component_ref, composition_ref, artifact_ref } = input || {};
  const filters = {};
  if (component_ref) filters.componentRef = component_ref;
  if (composition_ref) filters.compositionRef = composition_ref;
  if (artifact_ref) filters.artifactRef = artifact_ref;
  const triggers = TriggerArtifactRepository.listActive(filters);
  return {
    total: triggers.length,
    triggers: triggers.map((t) => ({
      trigger_ref: t.triggerRef,
      component_ref: t.componentRef,
      binding_params: t.bindingParams,
      payload_template: t.payloadTemplate,
      composition_ref: t.compositionRef,
      artifact_ref: t.artifactRef,
      created_at: t.createdAt,
    })),
  };
}

export async function getTriggerHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_trigger requires an object with trigger_ref');
  }
  const { trigger_ref } = input;
  if (!trigger_ref || typeof trigger_ref !== 'string') {
    throw new Error('trigger_ref is required');
  }
  const trigger = TriggerArtifactRepository.getByRef(trigger_ref);
  if (!trigger) {
    throw new Error(`Trigger '${trigger_ref}' not found.`);
  }
  return {
    trigger_ref: trigger.triggerRef,
    component_ref: trigger.componentRef,
    binding_params: trigger.bindingParams,
    payload_template: trigger.payloadTemplate,
    composition_ref: trigger.compositionRef,
    artifact_ref: trigger.artifactRef,
    enabled: trigger.enabled,
    superseded_by: trigger.supersededBy,
    created_at: trigger.createdAt,
  };
}

export function registerTriggerBindingTools() {
  registerTool({
    name: 'bind_trigger',
    description:
      "Ring 6 — DELIBERATION surface (trigger-binding, composer-anchored). Given a typed composer component_ref (e.g. 'trigger/scheduled@0.1.0' — the only kind whose runtime ships in this release), kind-specific binding_params, a payload_template that will be parked into the agent-tasks queue at fire time, and an artifact_ref to a contextmap node the trigger drives, materializes a trigger artifact and seals it via meta_context_commit. Resolves component_ref against the composer's typed components — no internal enum; adding a new trigger kind = ship a typed component plus its runtime daemon. The schedule kind validates `binding_params.cron` via croner at bind time (invalid expressions reject upfront, not at first fire). Returns `{ ok, trigger_ref, component_ref, artifact_ref, principle_id, next_fire_at? }`. The trigger fires only when the scheduler daemon is enabled via `MOJULO_TRIGGER_RUNTIME=enabled`; otherwise the binding is durable but inert. Phase 1 requires artifact_ref (composition-only triggers deferred). Webhook + watch components may be typed in the composer but their runtimes ship in later phases — bind_trigger surfaces a clear error in that case rather than silently accepting a binding nothing will fire.",
    inputSchema: {
      type: 'object',
      properties: {
        component_ref: {
          type: 'string',
          description:
            "Versioned composer component ref of the form '<kind>/<ref>@<version>' (e.g. 'trigger/scheduled@0.1.0'). Must match a row in the composer's component store and be in the set of components whose runtime is shipped in this release.",
        },
        binding_params: {
          type: 'object',
          description:
            "Component-specific config. For trigger/scheduled@0.1.0: `{ cron: string, timezone?: string }` (timezone defaults to UTC; scheduling math is always UTC, the operator's timezone is rendered into the payload only).",
        },
        payload_template: {
          type: 'object',
          description:
            "Object parked into the agent-tasks queue at fire time. Must include `task_kind` (e.g. 'envelope_inference'); other fields are kind-specific. Flat `{{...}}` interpolation at fire time fills in runtime values (e.g. `{{fired_at}}`).",
        },
        artifact_ref: {
          type: 'string',
          description:
            'Required in Phase 1. The contextmap artifact node the trigger drives. Must be a materialized artifact (an `app_materialization` / `primitive_artifact_materialization` commit must have run for it).',
        },
        composition_ref: {
          type: 'string',
          description:
            'Optional. The mcp_orbit_compositions row this trigger activates, when the trigger drives a composed workflow rather than a single artifact.',
        },
      },
      required: ['component_ref', 'binding_params', 'payload_template', 'artifact_ref'],
    },
    handler: bindTriggerHandler,
  });

  registerTool({
    name: 'unbind_trigger',
    description:
      'Ring 6 — disable an active trigger. Soft-deletes the trigger artifact row (enabled = 0); the scheduler daemon picks up the change on its next reload cycle. Returns `{ ok, trigger_ref, already_disabled }`. Audit principles on the target artifact node stay in place — the unbind is observable in the contextmap as the absence of further `trigger_firing` principles after the unbind time.',
    inputSchema: {
      type: 'object',
      properties: {
        trigger_ref: { type: 'string', description: 'Trigger ref returned by bind_trigger.' },
      },
      required: ['trigger_ref'],
    },
    handler: unbindTriggerHandler,
  });

  registerTool({
    name: 'list_triggers',
    description:
      'Ring 6 — list active trigger artifacts (enabled = 1, not superseded). Optional filters narrow by component_ref / composition_ref / artifact_ref. Returns `{ total, triggers: [{ trigger_ref, component_ref, binding_params, payload_template, composition_ref, artifact_ref, created_at }] }`. Use this when the operator asks "what triggers are bound" or when an agent is reasoning about whether to rebind something that may already exist.',
    inputSchema: {
      type: 'object',
      properties: {
        component_ref: { type: 'string', description: "Filter by component ref (e.g. 'trigger/scheduled@0.1.0')." },
        composition_ref: { type: 'string', description: 'Filter by composition ref.' },
        artifact_ref: { type: 'string', description: 'Filter by target artifact ref.' },
      },
    },
    handler: listTriggersHandler,
  });

  registerTool({
    name: 'get_trigger',
    description:
      'Ring 6 — fetch a single trigger artifact by ref. Returns the full row (including disabled triggers — `enabled: false` distinguishes). Use after `bind_trigger` to confirm the binding shape, or when inspecting a specific ref surfaced by `meta_context_brief`.',
    inputSchema: {
      type: 'object',
      properties: {
        trigger_ref: { type: 'string', description: 'Trigger ref.' },
      },
      required: ['trigger_ref'],
    },
    handler: getTriggerHandler,
  });
}
