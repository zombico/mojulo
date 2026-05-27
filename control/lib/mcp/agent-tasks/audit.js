/**
 * agent-tasks audit — contextmap principle recording for completed tasks.
 *
 * Sits next to [./queue.js]: the queue owns request matchmaking; this
 * module owns the durable audit row that records a successful task
 * outcome on the calling app's artifact node. Called by the per-kind
 * submit MCP tool (or the Node fulfiller) inside the synchronous submit
 * path so the principle is durable BEFORE the HTTP response unblocks.
 *
 * Today only the `envelope_inference` kind writes here, producing
 * `app_inference` principles. Future kinds (`classification`,
 * `decision`, etc.) get their own source_event values and their own
 * per-kind composer functions.
 *
 * The principle records WHO fulfilled the task via the `fulfiller`
 * block — `agent-mcp` for the /loop path (operator's Claude Code
 * agent calling submit_envelope_inference over MCP) or
 * `node-driven-runtime` for the Node fulfiller (control plane spawning
 * a headless subprocess via a runtime adapter). Honest provenance keeps
 * the contextmap auditable as fulfillment shifts between the two paths.
 *
 * See APP_SPIKE_A_REFRAME_PLAN.md, spike_qualities.md, and
 * AGENT_TASKS_NODE_DRIVEN_PLAN.md.
 */

import { MetaNodeRepository, MetaPrincipleRepository } from '@/lib/db/repositories/meta-context';

function resolveCallerArtifactNode(callerRef) {
  if (!callerRef || typeof callerRef !== 'string') return null;
  const direct = MetaNodeRepository.findByRef('artifact', callerRef);
  if (direct) return direct;
  // Tolerate bare locators / app names by scanning artifact nodes — common
  // in spike-time tests where the agent passes the absolute path without an
  // adapter prefix. Linear scan is fine: artifact-node population is
  // operator-scale, not run-rate.
  const all = MetaNodeRepository.listByKind('artifact');
  for (const node of all) {
    if (node?.payload?.locator === callerRef) return node;
    if (node?.payload?.app?.name === callerRef) return node;
  }
  return null;
}

function composeFulfillerLines(fulfiller) {
  if (!fulfiller || typeof fulfiller !== 'object') return [];
  const lines = ['', '**Fulfiller:**'];
  if (fulfiller.kind) lines.push(`- **kind:** \`${fulfiller.kind}\``);
  if (fulfiller.runtime) lines.push(`- **runtime:** \`${fulfiller.runtime}\``);
  if (fulfiller.model) lines.push(`- **model:** \`${fulfiller.model}\``);
  return lines;
}

function composeInferencePrincipleBody({ inputs, envelope, durationMs, callerRef, model, fulfiller }) {
  const userTextPreview = (() => {
    if (!inputs || typeof inputs !== 'object') return null;
    const t = typeof inputs.text === 'string' ? inputs.text : null;
    if (!t) return null;
    return t.length > 240 ? `${t.slice(0, 240)}...` : t;
  })();
  const answerPreview = (() => {
    const a = envelope?.answer;
    if (typeof a !== 'string') return null;
    return a.length > 240 ? `${a.slice(0, 240)}...` : a;
  })();
  const lines = [
    `**App inference call**`,
    '',
    `- **mode:** \`agent-routed\``,
    `- **duration_ms:** ${durationMs}`,
  ];
  // Top-level model line is kept for backward compatibility with existing
  // tests / readers. The fulfiller block also surfaces model if provided,
  // so newer readers can rely on the structured fulfiller fields.
  if (model) lines.push(`- **model:** \`${model}\``);
  if (callerRef) lines.push(`- **caller_ref:** \`${callerRef}\``);
  if (inputs?.image_base64 || inputs?.image) {
    lines.push(`- **image_input:** yes`);
  }
  lines.push(...composeFulfillerLines(fulfiller));
  if (userTextPreview) {
    lines.push('', '**Input text preview:**', '', '> ' + userTextPreview.replace(/\n/g, '\n> '));
  }
  if (answerPreview) {
    lines.push('', '**Answer preview:**', '', '> ' + answerPreview.replace(/\n/g, '\n> '));
  }
  return lines.join('\n');
}

function recordInferencePrinciple({ artifactNode, body }) {
  if (!artifactNode) return null;
  return MetaPrincipleRepository.insert({
    scope_kind: 'node',
    scope_id: artifactNode.id,
    body_md: body,
    source_event: 'app_inference',
  });
}

/**
 * Build the `app_inference` principle for a delivered envelope and write it
 * to the contextmap. Called from the `submit_envelope_inference` MCP tool
 * (or the Node fulfiller) before deliverResult unblocks the HTTP response.
 *
 * @param {object} args
 * @param {string} args.caller_ref
 * @param {object} args.inputs
 * @param {object} args.envelope
 * @param {number} args.durationMs
 * @param {string} [args.model] — the model the worker reported using.
 * @param {object} [args.fulfiller] — { kind, runtime?, model? }; identifies
 *   which fulfiller produced the envelope (agent-mcp vs node-driven-runtime).
 * @returns {{ principle: object|null, artifactNode: object|null }}
 */
export function recordInferenceOutcome({ caller_ref, inputs, envelope, durationMs, model, fulfiller }) {
  const artifactNode = resolveCallerArtifactNode(caller_ref);
  if (!artifactNode) return { principle: null, artifactNode: null };
  const body = composeInferencePrincipleBody({
    inputs,
    envelope,
    durationMs,
    callerRef: caller_ref,
    model,
    fulfiller,
  });
  const principle = recordInferencePrinciple({ artifactNode, body });
  return { principle, artifactNode };
}

export const _internals = {
  resolveCallerArtifactNode,
  composeInferencePrincipleBody,
  composeFulfillerLines,
  recordInferencePrinciple,
};
