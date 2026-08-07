/**
 * deriveConnectedServiceTopology — pure projection from a Connected Service
 * row into graph topology. No DB reads here; API routes pass in the canonical
 * service shape from lib/connected-services/loader.js.
 */

function short(text, max = 42) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}...` : t;
}

function push(nodes, node) {
  nodes.push(node);
  return node.id;
}

function isSystemServerName(name) {
  return String(name || '').toLowerCase() === 'mojulo';
}

function serviceKindLabel(service) {
  if (service.kind === 'skill') return service.form === 'catalyst' ? 'catalyst skill' : 'host skill';
  return 'mcp-orbit solution';
}

export function deriveConnectedServiceTopology({ service }) {
  if (!service) throw new Error('deriveConnectedServiceTopology requires { service }');

  const nodes = [];
  const edges = [];

  const serviceId = push(nodes, {
    id: 'service',
    role: 'service',
    kind: service.kind === 'skill' ? 'filesystem' : 'db_row',
    label: service.name || service.ref,
    sublabel: serviceKindLabel(service),
    items: [service.ref],
  });

  const calls = Array.isArray(service.calls)
    ? service.calls.filter((call) => !isSystemServerName(call.server))
    : [];
  calls.forEach((call, idx) => {
    const id = push(nodes, {
      id: `call-${idx}`,
      role: 'call',
      kind: call.present ? 'mcp_tool' : 'input',
      label: call.server,
      sublabel: call.present ? (call.role ? `${call.role} server` : 'declared server') : 'missing from inventory',
      items: Array.isArray(call.tools) && call.tools.length ? call.tools.slice(0, 3) : [],
    });
    edges.push({ from: serviceId, to: id, label: call.role ? `calls as ${call.role}` : 'calls' });
  });

  const needs = Array.isArray(service.needs) ? service.needs : [];
  needs.forEach((need, idx) => {
    const id = push(nodes, {
      id: `need-${idx}`,
      role: 'need',
      kind: 'input',
      label: need.label || need.capability,
      sublabel: 'unbound need',
    });
    edges.push({ from: id, to: serviceId, label: 'needed by' });
  });

  const provenance = service.provenance || {};
  if (service.kind === 'skill') {
    const hostId = push(nodes, {
      id: 'host',
      role: 'host',
      kind: 'filesystem',
      label: provenance.hostAdapter || 'host adapter',
      sublabel: short(provenance.hostPath, 48) || 'host-owned workflow',
    });
    edges.push({ from: hostId, to: serviceId, label: 'mirrors' });

    if (provenance.catalystId) {
      const catalystId = push(nodes, {
        id: 'catalyst',
        role: 'catalyst',
        kind: 'input',
        label: provenance.catalystId,
        sublabel: 'catalyst lineage',
      });
      edges.push({ from: catalystId, to: serviceId, label: 'seeded' });
    }
  } else {
    const compositionId = push(nodes, {
      id: 'composition',
      role: 'composition',
      kind: 'db_row',
      label: provenance.compositionRef || service.ref,
      sublabel: 'materialized composition',
    });
    edges.push({ from: compositionId, to: serviceId, label: 'projects' });

    const components = Array.isArray(service.components) ? service.components : [];
    components
      .filter((c) => c && c.kind !== 'mcp')
      .forEach((component, idx) => {
        const id = push(nodes, {
          id: `component-${idx}`,
          role: 'component',
          kind: component.kind === 'trigger' ? 'input' : 'mcp_tool',
          label: component.ref,
          sublabel: `${component.kind}@${component.version}`,
        });
        edges.push({ from: id, to: compositionId, label: 'shapes' });
      });
  }

  return { title: service.name || service.ref, nodes, edges };
}
