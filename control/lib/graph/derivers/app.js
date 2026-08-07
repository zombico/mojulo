/**
 * deriveAppTopology — pure projection from getApp(ref) + active triggers
 * to a topology object {nodes, edges} with role tags and no coordinates.
 *
 * Pair with `layout(topology)` in lib/graph/layout.js to get a manifest
 * that CreationMap.jsx renders. Splitting derivation from layout means
 * future entity kinds (MCPs, bots, compositions) reuse the same layout
 * pass, and we can swap slot-layout for a real graph layout later without
 * touching the derivers.
 *
 * The deriver does no DB I/O of its own — the caller passes in the data
 * it walks. Keeps it cheap to unit test and easy to drive from either an
 * API route or a server component.
 */

function pushNode(nodes, node) {
  nodes.push(node);
  return node.id;
}

function shortTool(name) {
  // Tool names in inventory come back fully qualified
  // ("mcp__myapp__do_thing"). Strip the prefix so they fit in a station
  // bullet without truncation.
  if (typeof name !== 'string') return String(name);
  const m = name.match(/^mcp__[^_]+__(.+)$/);
  return m ? m[1] : name;
}

export function deriveAppTopology({ app, triggers = [] }) {
  if (!app) throw new Error('deriveAppTopology requires { app }');

  const nodes = [];
  const edges = [];

  const artifactId = pushNode(nodes, {
    id: 'artifact',
    role: 'artifact',
    kind: 'filesystem',
    label: app.name || app.ref,
    sublabel: app.adapterId ? `${app.adapterId} · app artifact` : 'app artifact',
  });

  const bindings = app.bindings || {};

  const runnerId = bindings.runner
    ? pushNode(nodes, {
        id: 'binding-runner',
        role: 'binding-runner',
        kind: 'mcp_tool',
        label: 'Runner',
        sublabel: bindings.runner.technique || 'runner binding',
      })
    : null;

  const durabilityId = bindings.durability
    ? pushNode(nodes, {
        id: 'binding-durability',
        role: 'binding-durability',
        kind: 'db_row',
        label: 'Durability',
        sublabel: bindings.durability.technique || 'storage binding',
      })
    : null;

  const inferenceId = bindings.inference
    ? pushNode(nodes, {
        id: 'binding-inference',
        role: 'binding-inference',
        kind: 'mcp_tool',
        label: 'Inference',
        sublabel: bindings.inference.technique || 'inference binding',
      })
    : null;

  const mcpSelfId = bindings.mcp_self
    ? pushNode(nodes, {
        id: 'binding-mcp-self',
        role: 'binding-mcp-self',
        kind: 'mcp_tool',
        label: 'MCP self',
        sublabel: bindings.mcp_self.technique || 'app MCP',
      })
    : null;

  // Tools the running sidecar declares — aggregated into one box so the
  // diagram doesn't explode when an app exposes a dozen handlers.
  const tools = app.inventory?.tools || [];
  let toolsId = null;
  if (tools.length > 0) {
    const items = tools.slice(0, 3).map((t) => shortTool(t.name || t));
    if (tools.length > 3) items.push(`+${tools.length - 3} more`);
    toolsId = pushNode(nodes, {
      id: 'tools',
      role: 'tools',
      kind: 'mcp_tool',
      label: `${tools.length} tool${tools.length === 1 ? '' : 's'}`,
      sublabel: 'registered on sidecar',
      items,
    });
  }

  // Aggregate two outcome-rate principle streams so the graph stays a
  // structural overview rather than a firehose.
  const principles = app.principles || [];
  const inferenceCount = principles.filter((p) => p.sourceEvent === 'app_inference').length;
  const triggerFiringCount = principles.filter((p) => p.sourceEvent === 'trigger_firing').length;

  const inferencesId =
    inferenceCount > 0
      ? pushNode(nodes, {
          id: 'inferences',
          role: 'inferences',
          kind: 'db_row',
          label: 'Inferences',
          sublabel: `${inferenceCount} run${inferenceCount === 1 ? '' : 's'} recorded`,
        })
      : null;

  // Triggers fan in from the left — one node per active binding so the
  // shape of an app's autonomous activation is visible at a glance.
  const triggerIds = [];
  triggers.forEach((trig, idx) => {
    const kind = (trig.componentRef || '').split('@')[0].split('/')[1] || 'trigger';
    const params = trig.bindingParams || {};
    const sublabel = params.cron ? `cron: ${params.cron}` : kind;
    const id = pushNode(nodes, {
      id: `trigger-${idx}`,
      role: 'trigger',
      kind: 'input',
      label: trig.triggerRef || `trigger ${idx + 1}`,
      sublabel,
    });
    triggerIds.push(id);
  });

  for (const tId of triggerIds) {
    edges.push({ from: tId, to: artifactId, label: 'fires' });
  }
  if (triggerFiringCount > 0 && triggerIds.length > 0 && inferencesId) {
    // Annotate the trigger→artifact half of the loop with the firing count;
    // attach to the first trigger edge to avoid relabeling N parallel arrows.
    edges[0].label = `fires (${triggerFiringCount}×)`;
  }
  if (runnerId) edges.push({ from: runnerId, to: artifactId, label: 'manages' });
  if (durabilityId) edges.push({ from: artifactId, to: durabilityId, label: 'writes' });
  if (inferenceId) edges.push({ from: artifactId, to: inferenceId, label: 'calls' });
  if (mcpSelfId) edges.push({ from: artifactId, to: mcpSelfId, label: 'exposes' });
  if (mcpSelfId && toolsId) edges.push({ from: mcpSelfId, to: toolsId, label: 'registers' });
  if (inferencesId) edges.push({ from: artifactId, to: inferencesId, label: 'produces' });

  return { title: app.name || app.ref, nodes, edges };
}
