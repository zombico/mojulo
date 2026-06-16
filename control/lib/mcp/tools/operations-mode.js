/**
 * MCP Ring 11 — operations mode (domain-scoped orchestration).
 *
 * An ops tag is a tag + a descriptor + a set of members drawn from committed
 * reality (bots, apps, mcp-orbit compositions, cooks, catalysts, triggers,
 * stashes). The tag is the bound; the descriptor is the *thesis* against
 * which members are measured. Operations is the far-range, domain-shaped
 * view ("marketing", "finance") — distinct from workbench (close-range,
 * single-artifact tuning) and from plan / research (effort-shaped, pre-
 * reality).
 *
 * Tool surface (v0):
 *   - enter_operations_mode — return the operations-mode discipline. Posture:
 *     you are scoped to one or more domain buckets; reason inside (or across)
 *     them; do not bleed into unscoped resources. Read-only.
 *   - forge_ops_tag         — mint a tag with a title + descriptor.
 *   - bind_to_ops_tag       — attach a committed-reality resource as a member.
 *   - unbind_from_ops_tag   — detach a member (does not delete the resource).
 *   - get_ops_tag           — bounded-context read: descriptor + members.
 *   - list_ops_tags         — the inbox; optional status filter.
 *   - revise_ops_tag        — patch title / descriptor / status.
 *
 * Deferred to v0.5:
 *   - scope_to_ops_tags    — multi-tag scoping handshake for "visual seam"
 *     reasoning across two or more domains.
 *   - audit_ops_tag        — walk each member's provenance against the
 *     descriptor, return alignment notes (the descriptor-as-rubric move).
 *   - meta_nodes/meta_principles consult integration (descriptor surfaces in
 *     meta_context_brief from any session).
 *   - architecture-mode extension to /graph (operational edges, not creation
 *     lineage).
 *
 * v0 explicitly does NOT include an execute verb. Operations is consulted,
 * not driving. Resource deletion is manual through the per-resource
 * surfaces; archiving a tag stops it from scoping but leaves members
 * running.
 *
 * See lite-template/integration/app-system/0605/operations-view.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';

// ---------------------------------------------------------------------------
// enter_operations_mode — the discipline
// ---------------------------------------------------------------------------

const OPERATIONS_MODE_BRIEF = `# Operations mode

You are in **operations mode** — a domain-scoped view over committed-reality resources (bots, apps, mcp-orbit compositions, cooks, catalysts, triggers, stashes). The scope is one or more **ops tags**; each tag carries a *descriptor* that is the thesis its members are measured against.

## Posture

- **You are scoped.** Reason inside the loaded tag(s) and across their seams. Do not pull in unscoped resources without surfacing the bleed.
- **The descriptor is a rubric, not a label.** Hold each member against it. If a member's protocol / report / activity drifts from the descriptor, flag the gap.
- **Consulted, not driving.** Operations mode does not execute, deploy, or mutate resources. Recommend; the operator (or a different mode) acts.

## Membership rules

- Members are **committed reality only**: \`bot\`, \`app\`, \`mcp_orbit\`, \`cook\`, \`catalyst\`, \`trigger\`, \`stash\`.
- **Plans and research are NOT members.** They are pre-reality. They remain reachable as *provenance* through tagged members (a marketing-tagged bot's "why" answer is the plan that produced it → the cooks behind it → the research behind those cooks), but they are not themselves tagged.
- A resource can belong to multiple tags. A resource that lands in 5+ tags is a signal the tags are tracking facets, not domains — worth surfacing.

## When to use

The operator says things like: "show me the marketing operation", "how do these efforts in finance relate?", "what does our customer-success surface look like?", "is bot X still serving its domain?". The framing is *running the business*, not *deliberating about projects* (that's plan mode).

## Lifecycle

\`forge_ops_tag\` → \`bind_to_ops_tag\` (repeat as resources land) → \`get_ops_tag\` (the bounded read) → \`revise_ops_tag\` to sharpen the descriptor or archive when a concern winds down. Archiving stops the tag from scoping; members keep running and can be re-tagged elsewhere or deleted manually through their own surfaces.`;

export async function enterOperationsModeHandler(_input, _ctx) {
  return { brief: OPERATIONS_MODE_BRIEF };
}

// ---------------------------------------------------------------------------
// forge_ops_tag
// ---------------------------------------------------------------------------

export async function forgeOpsTagHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('forge_ops_tag requires an object with title + descriptor');
  }
  const { title, descriptor } = input;
  if (!title || typeof title !== 'string') {
    throw new Error('title is required');
  }
  if (!descriptor || typeof descriptor !== 'string') {
    throw new Error(
      'descriptor is required (the thesis members are measured against; precision matters)',
    );
  }
  const tag = OpsTagRepository.forge({ title, descriptorMd: descriptor });
  return {
    tag_ref: tag.tagRef,
    title: tag.title,
    status: tag.status,
    created_at: tag.createdAt,
  };
}

// ---------------------------------------------------------------------------
// bind_to_ops_tag
// ---------------------------------------------------------------------------

export async function bindToOpsTagHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('bind_to_ops_tag requires { tag_ref, member_kind, member_ref }');
  }
  const { tag_ref, member_kind, member_ref } = input;
  const member = OpsTagRepository.bind({
    tagRef: tag_ref,
    memberKind: member_kind,
    memberRef: member_ref,
  });
  return {
    ok: true,
    tag_ref: member.tagRef,
    member_kind: member.memberKind,
    member_ref: member.memberRef,
    bound_at: member.boundAt,
  };
}

// ---------------------------------------------------------------------------
// unbind_from_ops_tag
// ---------------------------------------------------------------------------

export async function unbindFromOpsTagHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('unbind_from_ops_tag requires { tag_ref, member_kind, member_ref }');
  }
  const { tag_ref, member_kind, member_ref } = input;
  const removed = OpsTagRepository.unbind({
    tagRef: tag_ref,
    memberKind: member_kind,
    memberRef: member_ref,
  });
  return {
    ok: true,
    removed,
    message: removed
      ? `Unbound ${member_kind}:${member_ref} from ${tag_ref}.`
      : `No such binding (already removed).`,
  };
}

// ---------------------------------------------------------------------------
// get_ops_tag — the bounded-context read (centerpiece)
// ---------------------------------------------------------------------------

export async function getOpsTagHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_ops_tag requires { tag_ref }');
  }
  const { tag_ref } = input;
  const tag = OpsTagRepository.getByRef(tag_ref);
  if (!tag) throw new Error(`Ops tag '${tag_ref}' not found`);
  const members = OpsTagRepository.listMembers(tag_ref);
  const counts = OpsTagRepository.memberCounts(tag_ref);
  return {
    tag_ref: tag.tagRef,
    title: tag.title,
    descriptor: tag.descriptorMd,
    status: tag.status,
    member_counts: counts,
    members: members.map((m) => ({
      member_kind: m.memberKind,
      member_ref: m.memberRef,
      bound_at: m.boundAt,
    })),
    created_at: tag.createdAt,
    updated_at: tag.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// list_ops_tags
// ---------------------------------------------------------------------------

export async function listOpsTagsHandler(input, _ctx) {
  const status = input?.status;
  const tags = OpsTagRepository.list(status ? { status } : {});
  return {
    total: tags.length,
    tags: tags.map((t) => {
      const counts = OpsTagRepository.memberCounts(t.tagRef);
      const memberTotal = Object.values(counts).reduce((acc, n) => acc + n, 0);
      return {
        tag_ref: t.tagRef,
        title: t.title,
        status: t.status,
        member_total: memberTotal,
        member_counts: counts,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// revise_ops_tag
// ---------------------------------------------------------------------------

export async function reviseOpsTagHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('revise_ops_tag requires { tag_ref, … }');
  }
  const { tag_ref, title, descriptor, status } = input;
  if (!tag_ref) throw new Error('tag_ref is required');
  const tag = OpsTagRepository.revise(tag_ref, {
    title,
    descriptorMd: descriptor,
    status,
  });
  if (!tag) throw new Error(`Ops tag '${tag_ref}' not found`);
  return {
    tag_ref: tag.tagRef,
    title: tag.title,
    status: tag.status,
    updated_at: tag.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

const MEMBER_KIND_ENUM = ['bot', 'app', 'mcp_orbit', 'cook', 'catalyst', 'trigger', 'stash'];

export function registerOperationsModeTools() {
  registerTool({
    name: 'enter_operations_mode',
    description:
      "Ring 11 — DELIBERATION surface (operations mode). Returns the operations-mode discipline: you are scoped to one or more domain ops tags (e.g. 'marketing', 'finance'); the descriptor on each tag is a rubric against which members are measured; consulted, not driving (no execute / deploy / mutate from this mode); members are committed reality only (bot / app / mcp_orbit / cook / catalyst / trigger / stash) — plans and research stay reachable as provenance THROUGH members but are not themselves taggable. Call this FIRST when the operator says things like 'show me the marketing operation', 'how do these efforts relate?', or 'is bot X still serving its domain?'. Read-only.",
    inputSchema: { type: 'object', properties: {} },
    handler: enterOperationsModeHandler,
  });

  registerTool({
    name: 'forge_ops_tag',
    description:
      "Ring 11 — mint a new ops tag (a domain-scoped bucket). Requires a `title` (short label, e.g. 'Marketing') and a `descriptor` (the THESIS members are measured against — be precise; a vague descriptor disables every downstream move). The descriptor is markdown; aim for one to three sentences naming what's in scope, the brand/voice constraint if any, and the owner. Returns { tag_ref, title, status:'active', created_at }. Members are bound separately via bind_to_ops_tag.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short label for the tag (the domain name).' },
        descriptor: {
          type: 'string',
          description:
            'Markdown thesis: what this concern covers, constraints, owner. Members will be measured against this; precision is load-bearing.',
        },
      },
      required: ['title', 'descriptor'],
    },
    handler: forgeOpsTagHandler,
  });

  registerTool({
    name: 'bind_to_ops_tag',
    description:
      "Ring 11 — attach a committed-reality resource to an ops tag as a member. `member_kind` must be one of: bot, app, mcp_orbit, cook, catalyst, trigger, stash. `member_ref` is the resource's existing ref (deployments.id for bot, etc.). Re-binding is a no-op (idempotent). Plans and research are intentionally NOT bindable — they live in /plan and /research, and remain reachable as provenance through bound members. Returns { ok, tag_ref, member_kind, member_ref, bound_at }.",
    inputSchema: {
      type: 'object',
      properties: {
        tag_ref: { type: 'string', description: 'Ops tag ref returned by forge_ops_tag.' },
        member_kind: { type: 'string', enum: MEMBER_KIND_ENUM, description: 'Type of resource being bound.' },
        member_ref: { type: 'string', description: 'The resource\'s opaque ref.' },
      },
      required: ['tag_ref', 'member_kind', 'member_ref'],
    },
    handler: bindToOpsTagHandler,
  });

  registerTool({
    name: 'unbind_from_ops_tag',
    description:
      "Ring 11 — detach a member from an ops tag. Does NOT delete the resource itself (operations mode never owns its members). Idempotent: returns ok:true with removed:false when the binding doesn't exist. Use this when a resource has stopped serving the concern OR when retiring a tag and you want to keep the resource alive under other tags.",
    inputSchema: {
      type: 'object',
      properties: {
        tag_ref: { type: 'string' },
        member_kind: { type: 'string', enum: MEMBER_KIND_ENUM },
        member_ref: { type: 'string' },
      },
      required: ['tag_ref', 'member_kind', 'member_ref'],
    },
    handler: unbindFromOpsTagHandler,
  });

  registerTool({
    name: 'get_ops_tag',
    description:
      "Ring 11 — the bounded-context READ. Returns the tag's descriptor, status, member counts per kind, and the full member list (with member_kind / member_ref / bound_at). This is the centerpiece read of operations mode — call it before reasoning about a domain. The descriptor is the rubric; the members are what gets held against it. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        tag_ref: { type: 'string', description: 'Ops tag ref to fetch.' },
      },
      required: ['tag_ref'],
    },
    handler: getOpsTagHandler,
  });

  registerTool({
    name: 'list_ops_tags',
    description:
      "Ring 11 — list ops tags (the inbox). Optional `status` filter (active / archived). Returns { total, tags: [{ tag_ref, title, status, member_total, member_counts, created_at, updated_at }] }. Use to discover what concerns exist before scoping.",
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'archived'] },
      },
    },
    handler: listOpsTagsHandler,
  });

  registerTool({
    name: 'revise_ops_tag',
    description:
      "Ring 11 — patch a tag's title, descriptor, or status. Sharpening the descriptor is the most common revision — it changes the rubric members are measured against. Setting status to 'archived' retires the tag (it stops scoping) without affecting its members or unbinding them; members keep running and can be re-tagged elsewhere or deleted manually via their own surfaces. Returns { tag_ref, title, status, updated_at }.",
    inputSchema: {
      type: 'object',
      properties: {
        tag_ref: { type: 'string' },
        title: { type: 'string', description: 'New label (optional patch).' },
        descriptor: { type: 'string', description: 'New thesis markdown (optional patch).' },
        status: { type: 'string', enum: ['active', 'archived'], description: 'Active or archived.' },
      },
      required: ['tag_ref'],
    },
    handler: reviseOpsTagHandler,
  });
}

// Test seam.
export const _internals = { OPERATIONS_MODE_BRIEF, MEMBER_KIND_ENUM };
