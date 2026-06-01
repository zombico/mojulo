/**
 * Fleet-scene loader — the cross-paradigm aggregation behind `/map` (and,
 * later, `/mcp-skills`). It is the ONE place the three paradigms meet:
 *
 *   - Connected Services (air solutions)  ← listConnectedServices()
 *   - the capability substrate (air servers) ← InventoryRepository
 *   - hosted processes (ground apps + bots)  ← listApps() + DeploymentRepository
 *
 * Each upstream loader stays sovereign over its own paradigm; this composes
 * their outputs into the two-plane view model the deriver projects. It owns no
 * data and writes nothing — same read-only posture as /apps. Deliberately NOT
 * folded into lib/connected-services/loader.js: that loader is the narrow
 * "Connected Service" paradigm canon (skills + orbit solutions); the fleet scene
 * spans three paradigms, so naming its engine `connected-services` would make
 * that word mean two things. See
 * lite-template/integration/app-system/0528/fleet-scene/FLEET_SCENE_PLAN.md.
 *
 * `loadFleetScene()` is async because the deployments read is async; everything
 * else is sync repository reads.
 */

import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import { listApps } from '@/lib/apps/loader';
import { listConnectedServices } from '@/lib/connected-services/loader';

const TOP_TOOLS = 3;
const SYSTEM_SERVER_NAMES = new Set(['mojulo']);

function isSystemServerName(name) {
  return SYSTEM_SERVER_NAMES.has(String(name || '').toLowerCase());
}

// mojulo is its own MCP server; classify it as `self` so the air plane can read
// the "everything calls mojulo" hub distinctly from vendor/app servers.
function serverKindFor(server) {
  if (String(server.name).toLowerCase() === 'mojulo') return 'self';
  return server.serverKind === 'app' ? 'app' : 'vendor';
}

function projectServer(server) {
  const tools = Array.isArray(server.tools) ? server.tools : [];
  return {
    name: server.name,
    kind: serverKindFor(server),
    toolCount: tools.length,
    topTools: tools.slice(0, TOP_TOOLS).map((t) => t.name || String(t)),
    runningRef: server.runningRef || null,
  };
}

function projectServiceForScene(service) {
  return {
    ...service,
    calls: (service.calls || []).filter((call) => !isSystemServerName(call.server)),
  };
}

function projectApp(app) {
  return {
    ref: app.ref,
    name: app.name,
    status: app.runtime?.status || null,
    appServerName: app.inventory?.serverName || null,
    href: `/apps/${encodeURIComponent(app.ref)}`,
  };
}

function projectBot(dep) {
  return {
    id: dep.id,
    name: dep.botName,
    status: dep.status,
    href: `/bots?id=${encodeURIComponent(dep.id)}`,
  };
}

// The one cross-plane link the data model persists cleanly: a running app
// exposes its own sidecar MCP. Match the app's declared server name to the
// app-kind inventory row (by name, falling back to runningRef) so the edge
// only draws when both ends are present in the scene.
function buildExposesLinks(apps, servers) {
  const appServerByName = new Map();
  const appServerByRunningRef = new Map();
  for (const s of servers) {
    if (s.kind !== 'app') continue;
    appServerByName.set(s.name.toLowerCase(), s);
    if (s.runningRef) appServerByRunningRef.set(s.runningRef, s);
  }

  const links = [];
  for (const app of apps) {
    if (!app.appServerName) continue;
    const match =
      appServerByName.get(app.appServerName.toLowerCase()) ||
      appServerByRunningRef.get(app.appServerName);
    if (!match) continue;
    links.push({
      from: { plane: 'ground', id: `app-${app.ref}` },
      to: { plane: 'air', id: `server-${match.name}` },
      kind: 'exposes',
    });
  }
  return links;
}

/**
 * Compose the two-plane fleet scene view model.
 *
 *   {
 *     air:    { servers:  [{ name, kind, toolCount, topTools, runningRef }],
 *               services: [{ ref, kind, form, name, summary, calls, needs }] },
 *     ground: { apps:     [{ ref, name, status, appServerName, href }],
 *               bots:     [{ id, name, status, href }] },
 *     crossLinks: [{ from, to, kind:'exposes' }],
 *   }
 */
export async function loadFleetScene() {
  const inventory = InventoryRepository.currentInventory();
  const servers = (inventory.servers || [])
    .filter((server) => !isSystemServerName(server.name))
    .map(projectServer)
    .filter((server) => server.kind !== 'self');

  const { services: rawServices } = listConnectedServices();
  const services = rawServices.map(projectServiceForScene);

  const apps = (listApps().apps || []).map(projectApp);

  const deployments = await DeploymentRepository.list();
  const bots = deployments.map(projectBot);

  const crossLinks = buildExposesLinks(apps, servers);

  return {
    air: { servers, services },
    ground: { apps, bots },
    crossLinks,
  };
}
