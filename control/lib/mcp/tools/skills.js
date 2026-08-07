/**
 * MCP Ring 6 — declare_skills.
 *
 * The mirror entry point for the Skill member of the Connected Services
 * paradigm. A Skill is a "workflow synthesized into the host adapter"
 * (.claude/skills/<name>/SKILL.md) — the host owns its lifecycle; mojulo
 * keeps a read-only reflection so a skill can be observed alongside the
 * orbit (mcp_orbit_compositions) form of a Connected Service.
 *
 * Sibling to meta_context_declare_inventory: REPLACE semantics, not append.
 * The agent introspects its own host skills (it knows its CWD / host adapter)
 * and declares them; mojulo never reaches into the host. The bright line:
 *   - meta_context_commit             → seal a structural DECISION (append-only)
 *   - meta_context_declare_inventory  → state the MCP environment (replace)
 *   - declare_skills                  → mirror the host's skills (replace)
 *
 * See lite-template/integration/app-system/0527/CONNECTED_SERVICES_CANONIZATION_PLAN.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { SkillsRepository } from '@/lib/db/repositories/skills';
import { MetaContextRepository } from '@/lib/db/repositories/meta-context';

export async function declareSkillsHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('declare_skills requires an object with a `skills` array');
  }
  const { skills } = input;
  if (!Array.isArray(skills)) {
    throw new Error('`skills` must be an array (use [] to wipe the skills mirror)');
  }

  const { replaced, inserted, mirroredAt } = SkillsRepository.declare(skills);

  const warnings = [];
  if (!MetaContextRepository.hasOperator()) warnings.push('no_operator_anchor');

  return {
    ok: true,
    skillsSeen: skills.length,
    inserted,
    replaced,
    mirroredAt,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function registerSkillsTools() {
  registerTool({
    name: 'declare_skills',
    description:
      "Mirror the host adapter's skills into mojulo so they appear as **Connected Services** alongside MCP-orbit workflows. A Skill is a workflow synthesized into your host (e.g. a `.claude/skills/<name>/SKILL.md`) — the host owns it, mojulo only reflects it for observation/visualization (it never writes to your host). **Call after synthesizing or changing a skill** (e.g. after `get_catalyst` materializes one), or at session start if your skill set changed. REPLACE semantics — the latest declaration is the whole mirror; skills not in this call are dropped (mojulo can't introspect your host, so you are the trust anchor). Declare the MCP servers each skill `calls` (resolved against your declared inventory so the viewer can show what's wired) and any unbound capability `needs` (e.g. a catalyst that wants a CRM you haven't picked yet). Distinct from `meta_context_declare_inventory` (your MCP environment) and `meta_context_commit` (append-only structural decisions). Returns `{ ok, skillsSeen, inserted, replaced, mirroredAt, warnings? }`.",
    inputSchema: {
      type: 'object',
      properties: {
        skills: {
          type: 'array',
          description:
            'Every skill currently present on the host adapter. Pass `[]` to explicitly wipe the mirror.',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: "Skill name (frontmatter name or the skill directory name).",
              },
              hostPath: {
                type: 'string',
                description:
                  "Path to the skill on the host, relative to the workspace root (e.g. '.claude/skills/local-help-conv-digest'). Used to derive a stable ref.",
              },
              description: {
                type: 'string',
                description: "One-line summary of what the skill does (frontmatter description). Optional.",
              },
              hostAdapter: {
                type: 'string',
                description:
                  "Which host adapter the skill lives in (e.g. 'claude-code', 'codex'). Optional; the mirror is adapter-agnostic.",
              },
              catalystId: {
                type: 'string',
                description:
                  "The catalyst id this skill was synthesized from, if any (its lineage). Optional.",
              },
              calls: {
                type: 'array',
                description:
                  "The MCP servers this skill calls. Each server is resolved against your declared inventory so the viewer can mark it wired vs missing. Include mojulo itself if the skill calls mojulo tools.",
                items: {
                  type: 'object',
                  properties: {
                    server: {
                      type: 'string',
                      description: "Server name as in your declared inventory (e.g. 'gmail', 'mojulo').",
                    },
                    tools: {
                      type: 'array',
                      description: "Specific tool names on that server the skill invokes. Optional.",
                      items: { type: 'string' },
                    },
                  },
                  required: ['server'],
                },
              },
              needs: {
                type: 'array',
                description:
                  "Unbound capability slots the skill needs but isn't wired to yet (e.g. a catalyst that wants 'a CRM-like MCP'). Surfaced in the viewer as a 'needs X' stub.",
                items: {
                  type: 'object',
                  properties: {
                    capability: {
                      type: 'string',
                      description: "The abstract capability category (e.g. 'crm-like', 'calendar').",
                    },
                    label: {
                      type: 'string',
                      description: "Human-readable label for the stub (e.g. 'needs a CRM'). Optional.",
                    },
                  },
                  required: ['capability'],
                },
              },
            },
            required: ['name', 'hostPath'],
          },
        },
      },
      required: ['skills'],
    },
    handler: declareSkillsHandler,
  });
}
