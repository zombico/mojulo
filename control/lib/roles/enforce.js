import { SPINE, FOLDED, isPackId, homePackForTool } from '@/lib/mcp/packs';
import { rolesEnabled, isAdminContext } from './keys';

/**
 * Roles pack Phase 2 — capability enforcement (lib/mcp/roles-pack.plan.md).
 *
 * The third axis on packs: install (is it physically present), presentation
 * (is its schema in context), and now AUTHORIZATION (may THIS caller execute
 * it). Enforced at the same chokepoints as the install gate — handleToolCall
 * and invokeRegisteredTool in server.js, plus the pack dispatcher in
 * tools/packs-tools.js — with the same advisory idiom: a terminal, anti-spin
 * pointer, never a silent failure. Execution integrity, not information
 * hiding (the iron-wall doctrine): knowing a tool exists is fine; running it
 * without the bay is not.
 *
 * authNotice() is deliberately PURE — grants and flags ride the execution
 * context (loaded once per request at the identity mint in api/mcp/route.js),
 * so chokepoints stay synchronous and DB-free. Chokepoint enforcement is the
 * entire reason this layer is cheap: the ancestor's per-route imperative
 * checks drifted (61 of 72 routes hand-rolled it); here there are exactly
 * three code paths and they all funnel through this one function.
 */

// Roles administration — admin-only structurally (on the deny-list below) and
// unlisted by default; listTools surfaces them to ADMIN callers once the roles
// pack is enabled.
export const ROLES_ADMIN_TOOLS = ['mint_role_key', 'list_role_keys', 'revoke_role_key'];

// ── The hard deny-list ───────────────────────────────────────────────────────
// Never grantable regardless of grants — checked separately and FIRST, so a
// misconfigured grant table cannot expose it: secrets/env surfaces, daemon
// control, roles administration. Admin (the operator) only.
export const DENY_LIST = [
  // secrets / env
  'set_env',
  'delete_env',
  'list_env',
  'inspect_bot_env',
  // daemon control
  'start_daemon',
  'stop_daemon',
  'restart_daemon',
  // roles administration (this pack's own tools)
  ...ROLES_ADMIN_TOOLS,
];

// ── Action-class tags (gated by flags on the key, independent of packs) ──────
// outward: things that LEAVE the host (deploys, anything that spends or
// publishes). lifecycle: things that start/stop processes. save_modular_bot
// carries both — it spawns the bot locally and can deploy it to Fly. The
// daemon tools are deny-listed above and never reach these checks.
export const OUTWARD_TOOLS = ['save_modular_bot'];
export const LIFECYCLE_TOOLS = ['install_scaffold', 'start_app', 'stop_app', 'save_modular_bot'];

// propose-vs-seal: a propose_only key can forge plans, draft compositions,
// sketch research — but sealing reality stays with the operator. "Claude
// proposes, user disposes", promoted to an access boundary.
export const SEAL_TOOLS = ['execute_plan', 'meta_context_commit', 'save_modular_bot'];

const DENY_SET = new Set(DENY_LIST);
const OUTWARD_SET = new Set(OUTWARD_TOOLS);
const LIFECYCLE_SET = new Set(LIFECYCLE_TOOLS);
const SEAL_SET = new Set(SEAL_TOOLS);
const SPINE_SET = new Set(SPINE);
const FOLDED_SET = new Set(FOLDED);

/**
 * Terminal advisory when `context`'s key may not execute `name`, else null.
 * Order matters: deny-list first (structural, cannot be granted around), then
 * pack grants (the core boundary), then the key's flags (action classes).
 *
 * Pack dispatcher names (pack_*) pass through — a bare unveil is orientation
 * (not a secret); the dispatcher re-enters here per MEMBER at dispatch time.
 */
export function authNotice(name, context, env = process.env) {
  if (!rolesEnabled(env)) return null;
  if (isAdminContext(context)) return null;

  if (DENY_SET.has(name)) {
    return (
      `'${name}' is admin-only on this control plane — it sits on the roles pack's hard deny-list ` +
      `(secrets, daemon control, roles administration) and is never grantable. Ask the operator. ` +
      `Do not retry it with this key.`
    );
  }

  const pack = homePackForTool(name);
  if (pack) {
    const grants = new Set(context?.userGrants || []);
    if (!grants.has(pack.id)) {
      return (
        `This key does not carry the ${pack.id} bay, so '${name}' cannot run here. ` +
        `Granted bays: ${context?.userGrants?.length ? context.userGrants.join(', ') : '(none)'}. ` +
        `Ask the operator to grant ${pack.id} if this work is yours to do. ` +
        `Do not retry ${pack.id} tools with this key.`
      );
    }
  } else if (!SPINE_SET.has(name) && !FOLDED_SET.has(name) && !isPackId(name)) {
    // Unhomed and not orientation: unlisted aliases and internals. Delegates
    // use canonical names through granted bays; this is a routing pointer,
    // not a capability the key could carry.
    return (
      `'${name}' is not part of any capability bay this key can carry. Use the canonical tool ` +
      `through one of the granted bays (${context?.userGrants?.length ? context.userGrants.join(', ') : 'none granted'}).`
    );
  }

  const flags = context?.userFlags || {};
  if (flags.propose_only && SEAL_SET.has(name)) {
    return (
      `This key is propose-only: '${name}' seals reality (executes plans / commits the contextmap / deploys), ` +
      `which stays with the operator. Leave the proposal (a plan, a draft) for the operator to review and execute. ` +
      `Do not retry '${name}' with this key.`
    );
  }
  if (OUTWARD_SET.has(name) && !flags.outward) {
    return (
      `'${name}' is an OUTWARD action (it leaves this host — deploys, spends, or publishes) and this key ` +
      `was not cut with the outward flag. Ask the operator if this is yours to do. Do not retry it with this key.`
    );
  }
  if (LIFECYCLE_SET.has(name) && !flags.lifecycle) {
    return (
      `'${name}' is a LIFECYCLE action (it starts or stops processes on this host) and this key was not ` +
      `cut with the lifecycle flag. Ask the operator if this is yours to do. Do not retry it with this key.`
    );
  }

  return null;
}

/** True when this privileged context may see/execute tools of `pack`. Used by
 * listTools to filter the connect surface to the caller's bays. */
export function packGranted(pack, context) {
  return new Set(context?.userGrants || []).has(pack.id);
}

/** True when `name` should appear in a privileged caller's tools/list: spine
 * and folded stay (orientation is not a secret, and every SPINE member is
 * read-only — verified by roles.test.js), deny-listed tools never list, pack
 * members list only under a grant. */
export function toolListedForContext(name, context, env = process.env) {
  if (!rolesEnabled(env) || isAdminContext(context)) return true;
  if (DENY_SET.has(name)) return false;
  const pack = homePackForTool(name);
  if (pack) return packGranted(pack, context);
  return true; // spine / folded / unpacked orientation surface
}
