/**
 * Connected Services loader — the canonical union view.
 *
 * A Connected Service is an agent-layer solution that calls MCP. It shows up
 * in two forms, unified here into one shape:
 *   - skill        — mirrored from the host adapter (meta_skills, via declare_skills)
 *   - mcp_solution — a materialized mcp-orbit composition (mcp_orbit_compositions)
 *
 * This shape is THE contract every viewer (/mcp-skills, /map) consumes — it is
 * contingent on the canonization data model (the meta_skills schema + the
 * declare_skills payload + the orbit composition shape), so it is defined here
 * and projected, never redefined, downstream.
 *
 * `calls` are resolved against the current MCP inventory so each can be marked
 * `present` (wired) or not (a capability the operator hasn't installed). `needs`
 * carries unbound abstract capability slots (e.g. a catalyst that wants a CRM
 * the operator hasn't picked yet) → the viewer's "needs X" dangling stubs.
 *
 * Uncapped reads straight from the repositories, same posture as
 * lib/apps/loader.js — UI/agent surfaces need ground truth, not the capped brief.
 *
 * See lite-template/integration/app-system/0527/CONNECTED_SERVICES_CANONIZATION_PLAN.md.
 */

import { SkillsRepository } from '@/lib/db/repositories/skills';
import { MCPOrbitCompositionRepository } from '@/lib/db/repositories/mcp-orbit';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';

// Set of currently-declared MCP server names (lowercased) so a service's
// `calls` can be flagged wired vs missing. mojulo is only "present" if the
// agent declared it in inventory — we don't synthesize a mojulo-self row here;
// a skill that calls mojulo tools should list 'mojulo' among its calls.
function buildPresentServerSet() {
  const inv = InventoryRepository.currentInventory();
  const set = new Set();
  for (const s of inv.servers || []) {
    if (s?.name) set.add(s.name.toLowerCase());
  }
  return set;
}

function resolveCall(call, presentSet) {
  const out = { server: call.server, present: presentSet.has(String(call.server).toLowerCase()) };
  if (call.role) out.role = call.role;
  if (Array.isArray(call.tools)) out.tools = call.tools;
  return out;
}

function projectSkill(skill, presentSet) {
  return {
    ref: skill.ref,
    kind: 'skill',
    form: skill.catalystId ? 'catalyst' : 'manual',
    name: skill.name,
    summary: skill.description || null,
    calls: (skill.calls || []).map((c) => resolveCall(c, presentSet)),
    needs: skill.needs || [],
    provenance: {
      source: 'host',
      hostPath: skill.hostPath,
      hostAdapter: skill.hostAdapter || null,
      catalystId: skill.catalystId || null,
    },
    mirroredAt: skill.mirroredAt,
  };
}

// Compositions carry no name; derive a short label from the first line of the
// operator's stated intent, falling back to the ref.
function deriveCompositionName(intentMd, ref) {
  if (typeof intentMd === 'string' && intentMd.trim()) {
    const firstLine = intentMd.trim().split('\n')[0].trim();
    return firstLine.length > 64 ? `${firstLine.slice(0, 61)}…` : firstLine;
  }
  return ref;
}

function projectComposition(comp, presentSet) {
  const mcpRefs = (comp.componentRefs || []).filter((r) => r && r.kind === 'mcp');
  return {
    ref: comp.ref,
    kind: 'mcp_solution',
    form: 'orbit',
    name: deriveCompositionName(comp.intentMd, comp.ref),
    summary: comp.intentMd || null,
    calls: mcpRefs.map((r) => resolveCall({ server: r.ref, role: r.role }, presentSet)),
    needs: [],
    components: comp.componentRefs || [],
    knobs: comp.knobs || {},
    artifactRef: comp.artifactRef || null,
    status: comp.status,
    provenance: { source: 'orbit', compositionRef: comp.ref },
    materializedAt: comp.updatedAt || comp.createdAt,
  };
}

function timestampOf(service) {
  return service.mirroredAt || service.materializedAt || 0;
}

/**
 * The union view. Returns `{ services: [...] }` newest-first across both forms.
 * Each service: `{ ref, kind, form, name, summary, calls, needs, provenance,
 * mirroredAt|materializedAt }`.
 */
export function listConnectedServices() {
  const presentSet = buildPresentServerSet();

  const skills = SkillsRepository.list().map((s) => projectSkill(s, presentSet));
  const solutions = MCPOrbitCompositionRepository.list({ status: 'materialized' }).map((c) =>
    projectComposition(c, presentSet),
  );

  const services = [...skills, ...solutions].sort((a, b) => timestampOf(b) - timestampOf(a));
  return { services };
}

/**
 * Single Connected Service by ref. Skill refs start with `skill_`; orbit
 * solution refs with `comp_`. Returns null if not found.
 */
export function getConnectedService(ref) {
  if (!ref || typeof ref !== 'string') {
    throw new Error('getConnectedService requires a string ref');
  }
  const presentSet = buildPresentServerSet();

  if (ref.startsWith('skill_')) {
    const skill = SkillsRepository.getByRef(ref);
    return skill ? projectSkill(skill, presentSet) : null;
  }
  const comp = MCPOrbitCompositionRepository.findByRef(ref);
  if (!comp || comp.status !== 'materialized') return null;
  return projectComposition(comp, presentSet);
}
