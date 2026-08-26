import { createHash, randomBytes } from 'node:crypto';
import { UserRepository } from '@/lib/db/repositories/users';

/**
 * Roles pack — activation gate + key mint/resolve (lib/mcp/roles-pack.plan.md).
 *
 * Operator-owned delegation over capability bays: the operator cuts scoped,
 * revocable bearer keys for their own delegates (a collaborator, a cron
 * agent). Activation-gated, not disk-gated — pure code, no heavy dep to probe
 * (the MOJULO_TRIGGER_RUNTIME=enabled pattern): with MOJULO_ROLES unset,
 * rolesEnabled() is false, buildContext mints userId:'local' exactly as
 * before, and a fresh install is byte-identical in behavior to a roles-less
 * one.
 *
 * Key shape: `mjr_<48 hex>`, stored as a SHA-256 hash only — the plaintext is
 * returned once at mint and never again. The distinct prefix is deliberate:
 * Phase 3's credential-shape guard tells role keys, API keys (`sk-ant-`,
 * `lite_`), and subscription tokens apart by shape.
 */

const TOKEN_PREFIX = 'mjr_';

export function rolesEnabled(env = process.env) {
  return env.MOJULO_ROLES === 'enabled';
}

export function mintToken() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Resolve a presented bearer to its active delegate user, or null. Callers
 * check the god-key (CONTROL_PLANE_MCP_KEY) FIRST — this only ever resolves
 * users-table keys, and only when the roles pack is enabled.
 */
export function resolveBearerUser(token, env = process.env) {
  if (!rolesEnabled(env)) return null;
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) return null;
  return UserRepository.findActiveByTokenHash(hashToken(token));
}

/**
 * Admin check for execution contexts. A context carries `userRole` only when a
 * delegate key was resolved; its absence means a local transport (stdio CLI,
 * in-process callers) or the god-key — both ARE the operator. Shell access to
 * the host remains the actual security boundary, exactly as today.
 */
export function isAdminContext(context) {
  return !context?.userRole || context.userRole === 'admin';
}
