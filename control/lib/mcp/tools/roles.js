/**
 * Roles-admin tools — Phase 1 of the roles pack (lib/mcp/roles-pack.plan.md).
 *
 * Operator-owned delegation, NOT multi-tenancy: the operator (the admin — the
 * god-key CONTROL_PLANE_MCP_KEY, or any local transport) cuts scoped bearer
 * keys for their own delegates. Admin-only structurally — roles administration
 * sits on the hard deny-list and is never grantable to a privileged key.
 *
 * Activation-gated (MOJULO_ROLES=enabled): with roles off these tools answer
 * with a pointer to the activation, never execute, and nothing else in the
 * substrate changes. Registered `listed: false` in Phase 1 — callable by name
 * on every transport, off the tools/list surface; promotion to a listed
 * pack_roles rides Phase 2 alongside grant enforcement (authNotice).
 *
 * Phase 1 mints only 'privileged' keys: admin IS the operator (the god-key),
 * not a mintable role. Grants, flags, and spaces attach to keys in later
 * phases; a Phase 1 key is identity + attribution only.
 */

import { registerTool } from '@/lib/mcp/server';
import { rolesEnabled, isAdminContext, mintToken, hashToken } from '@/lib/roles/keys';
import { UserRepository, LOCAL_ADMIN_ID } from '@/lib/db/repositories/users';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function requireRolesAdmin(context) {
  if (!rolesEnabled()) {
    throw new Error(
      'The roles pack is not enabled on this host — mojulo is in its default single-operator mode ' +
        '(no user identity). To turn on operator-owned delegation, set MOJULO_ROLES=enabled in ' +
        "control/.env and restart. Do not retry roles tools until it is enabled."
    );
  }
  if (!isAdminContext(context)) {
    throw new Error(
      'Roles administration is admin-only, and this key does not carry it. Ask the operator ' +
        '(the admin key) to make this change. Do not retry with this key.'
    );
  }
}

function userStatus(user) {
  if (user.revokedAt) return 'revoked';
  if (user.expiresAt && Date.now() > user.expiresAt) return 'expired';
  return 'active';
}

function presentUser(user) {
  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    status: userStatus(user),
    createdAt: user.createdAt,
    expiresAt: user.expiresAt,
    revokedAt: user.revokedAt,
  };
}

async function mintRoleKeyHandler(input, context) {
  requireRolesAdmin(context);
  const { name, expires_in_days } = input || {};
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('name is required — who is this key for (a collaborator, a cron agent)?');
  }
  const trimmed = name.trim();
  if (UserRepository.findByName(trimmed)) {
    throw new Error(
      `A key named '${trimmed}' already exists. Revoke it first (revoke_role_key) or pick another name — one key per delegate.`
    );
  }
  let expiresAt = null;
  if (expires_in_days !== undefined) {
    if (!Number.isFinite(expires_in_days) || expires_in_days <= 0) {
      throw new Error('expires_in_days must be a positive number of days.');
    }
    expiresAt = Date.now() + Math.round(expires_in_days * MS_PER_DAY);
  }

  // The operator's own admin row exists from the first mint on — the FK
  // target for attribution and later grants.
  UserRepository.ensureLocalAdmin();

  const token = mintToken();
  const user = UserRepository.create({
    name: trimmed,
    role: 'privileged',
    tokenHash: hashToken(token),
    expiresAt,
  });

  return {
    ...presentUser(user),
    token,
    message:
      'Key minted. The token is shown ONCE and stored only as a hash — hand it to the delegate now. ' +
      'They connect with it as the MCP bearer in place of the operator key. Revoke any time with revoke_role_key.',
  };
}

async function listRoleKeysHandler(_input, context) {
  requireRolesAdmin(context);
  const users = UserRepository.list().map(presentUser);
  return {
    users,
    message: users.length
      ? undefined
      : 'No keys yet. mint_role_key cuts the first delegate key; the operator needs none (the MCP key is the admin key).',
  };
}

async function revokeRoleKeyHandler(input, context) {
  requireRolesAdmin(context);
  const { user } = input || {};
  if (typeof user !== 'string' || !user.trim()) {
    throw new Error('user is required — the key id (usr_…) or name to revoke.');
  }
  const target = UserRepository.findById(user.trim()) || UserRepository.findByName(user.trim());
  if (!target) throw new Error(`No key found for '${user.trim()}'. list_role_keys shows what exists.`);
  if (target.id === LOCAL_ADMIN_ID) {
    throw new Error(
      "The operator's own row cannot be revoked — the admin credential is CONTROL_PLANE_MCP_KEY, rotated in control/.env, not here."
    );
  }
  if (target.revokedAt) {
    return { ...presentUser(target), message: 'Already revoked.' };
  }
  const revoked = UserRepository.revoke(target.id);
  return {
    ...presentUser(revoked),
    message: `Revoked. The key stops resolving immediately; '${revoked.name}' keeps its attribution history in telemetry.`,
  };
}

export function registerRolesTools() {
  registerTool({
    name: 'mint_role_key',
    description:
      "Cut a scoped bearer key for a delegate (a collaborator or an agent) on this control plane — the roles pack's mint. Admin-only; requires MOJULO_ROLES=enabled. Returns the plaintext token exactly once (stored as a hash). Optional expiry via expires_in_days — recommended for agent keys. Phase 1 keys carry identity + telemetry attribution; pack grants arrive with grant enforcement.",
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: "Who the key is for — unique per delegate (e.g. 'ana', 'fleet-digest-cron').",
        },
        expires_in_days: {
          type: 'number',
          description: 'Optional TTL in days; the key stops resolving after this. Recommended for agent keys (e.g. 30).',
        },
      },
      required: ['name'],
    },
    // The one tool whose result contains secret material — exempt from
    // full-capture telemetry so the token never persists (see telemetry.js).
    noCapture: true,
    listed: false,
    handler: mintRoleKeyHandler,
  });

  registerTool({
    name: 'list_role_keys',
    description:
      'List every key the operator has cut on this control plane (roles pack): name, role, status (active / expired / revoked), expiry. Admin-only; requires MOJULO_ROLES=enabled. Token hashes are never returned.',
    inputSchema: { type: 'object', properties: {} },
    listed: false,
    handler: listRoleKeysHandler,
  });

  registerTool({
    name: 'revoke_role_key',
    description:
      "Revoke a delegate's key by id or name (roles pack): the key stops resolving immediately; the row and its telemetry attribution remain. Admin-only; requires MOJULO_ROLES=enabled.",
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'Key id (usr_…) or delegate name to revoke.' },
      },
      required: ['user'],
    },
    listed: false,
    handler: revokeRoleKeyHandler,
  });
}
