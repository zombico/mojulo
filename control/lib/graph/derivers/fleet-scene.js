/**
 * deriveFleetSceneTopology — pure projection from the fleet-scene view model
 * (lib/fleet-scene/loader.js) to a topology {title, nodes, edges}, with no
 * coordinates. Pair with layoutFleetScene(topology) → manifest CreationMap renders.
 *
 * Every node carries `role`, `layer:'air'|'ground'`, and an optional `href`
 * (clickable target). Every edge carries `kind` so a page's `framing` can pick
 * which kinds render. Reuses the four existing station kinds:
 *   apps → filesystem (slate)   bots → db_row (purple)
 *   servers → mcp_tool (teal)   services → input (dashed)
 *
 * Node id scheme (must match crossLinks ids built in the loader):
 *   app-<ref>   bot-<id>   server-<name>   service-<ref>
 *
 * No DB I/O — the caller passes the view model in. See
 * lite-template/integration/app-system/0528/fleet-scene/FLEET_SCENE_PLAN.md.
 */

// Which edge kinds each framing renders. `map` is sparse on purpose — the
// stratification is the message, so only the one cleanly-persisted cross-plane
// link draws. `mcp-skills` (later page) adds the bipartite skill→server web.
const EDGE_KINDS_BY_FRAMING = {
  map: new Set(['exposes']),
  'mcp-skills': new Set(['exposes', 'calls']),
};

function serverId(name) {
  return `server-${name}`;
}

function truncate(text, max = 48) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function deriveServerNodes(servers, nodes) {
  for (const s of servers) {
    nodes.push({
      id: serverId(s.name),
      role: 'server',
      layer: 'air',
      kind: 'mcp_tool',
      label: s.name,
      sublabel: `${s.toolCount} tool${s.toolCount === 1 ? '' : 's'}${s.kind === 'self' ? ' · mojulo' : s.kind === 'app' ? ' · app' : ''}`,
      items: s.topTools || [],
      href: '/mcp-skills',
    });
  }
}

function deriveServiceNodes(services, nodes) {
  for (const svc of services) {
    nodes.push({
      id: `service-${svc.ref}`,
      role: 'service',
      layer: 'air',
      kind: 'input',
      label: svc.name || svc.ref,
      sublabel: truncate(svc.summary) || svc.form || svc.kind,
      href: `/mcp-skills/${encodeURIComponent(svc.ref)}`,
    });
  }
}

function deriveAppNodes(apps, nodes) {
  for (const app of apps) {
    nodes.push({
      id: `app-${app.ref}`,
      role: 'app',
      layer: 'ground',
      kind: 'filesystem',
      label: app.name || app.ref,
      sublabel: app.status || 'app',
      href: app.href,
    });
  }
}

function deriveBotNodes(bots, nodes) {
  for (const bot of bots) {
    nodes.push({
      id: `bot-${bot.id}`,
      role: 'bot',
      layer: 'ground',
      kind: 'db_row',
      label: bot.name || bot.id,
      sublabel: bot.status || 'bot',
      href: bot.href,
    });
  }
}

// `calls` edges (service → server) — only emitted under framings that allow
// them, and only when the called server is present as a node in this scene.
function deriveCallEdges(services, serverIds, edges) {
  for (const svc of services) {
    for (const call of svc.calls || []) {
      const toId = serverId(call.server);
      if (!serverIds.has(toId)) continue;
      edges.push({ from: `service-${svc.ref}`, to: toId, kind: 'calls', label: 'calls' });
    }
  }
}

export function deriveFleetSceneTopology(vm, { framing = 'map' } = {}) {
  if (!vm) throw new Error('deriveFleetSceneTopology requires a view model');
  const allowed = EDGE_KINDS_BY_FRAMING[framing] || EDGE_KINDS_BY_FRAMING.map;

  const air = vm.air || {};
  const ground = vm.ground || {};
  const servers = air.servers || [];
  const services = air.services || [];

  const nodes = [];
  // Ground first, air second — paint order matches the band stacking, though
  // the renderer also keys elevation off `layer` independently.
  deriveAppNodes(ground.apps || [], nodes);
  deriveBotNodes(ground.bots || [], nodes);
  deriveServerNodes(servers, nodes);
  deriveServiceNodes(services, nodes);

  const nodeIds = new Set(nodes.map((n) => n.id));
  const serverIds = new Set(servers.map((s) => serverId(s.name)));

  const edges = [];
  if (allowed.has('exposes')) {
    for (const link of vm.crossLinks || []) {
      if (link.kind !== 'exposes') continue;
      if (!nodeIds.has(link.from.id) || !nodeIds.has(link.to.id)) continue;
      edges.push({ from: link.from.id, to: link.to.id, kind: 'exposes', label: 'exposes' });
    }
  }
  if (allowed.has('calls')) {
    deriveCallEdges(services, serverIds, edges);
  }

  return { title: 'Fleet', nodes, edges };
}
