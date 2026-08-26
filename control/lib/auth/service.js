// Auth service — the Node-runtime identity resolution.
//
// Default (roles off): every request is the same local operator, exactly as
// before. With the roles pack enabled (MOJULO_ROLES, lib/mcp/roles-pack.plan.md
// Phase 4), a dashboard session cookie carrying delegate claims resolves to
// that user — with the LAZY revocation check the Edge layer can't do: the
// token's epoch must match users.token_epoch (revoke_role_key bumps it, so a
// revoked delegate's outstanding sessions die here). Anything without valid
// delegate claims — no cookie, admin claims, bearer-authed calls, callers
// outside a request context — resolves to the local operator, preserving
// today's behavior everywhere else.

import { rolesEnabled } from '@/lib/roles/keys';

const LOCAL_USER = {
  id: 'local',
  email: 'local@mojulo',
  name: 'Local Operator',
};

async function resolveSessionUser() {
  if (!rolesEnabled() || !process.env.CONTROL_PLANE_PASSWORD) return null;
  let token = null;
  try {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const { SESSION_COOKIE } = await import('@/lib/auth/session');
    token = store.get(SESSION_COOKIE)?.value || null;
  } catch {
    return null; // outside a request context (scripts, tests)
  }
  if (!token) return null;
  try {
    const { verifySessionToken } = await import('@/lib/auth/session');
    const claims = await verifySessionToken(token, process.env.CONTROL_PLANE_PASSWORD);
    if (!claims || claims.r !== 'privileged' || !claims.u) return null;
    const { UserRepository } = await import('@/lib/db/repositories/users');
    const user = UserRepository.findById(claims.u);
    if (!user || user.revokedAt) return null;
    if (user.expiresAt && Date.now() > user.expiresAt) return null;
    // Lazy revocation: an epoch bump invalidates every outstanding session.
    if (user.tokenEpoch !== claims.e) return null;
    return {
      id: user.id,
      email: `${user.name}@mojulo`,
      name: user.name,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  return (await resolveSessionUser()) || LOCAL_USER;
}

export async function requireAuth() {
  return getCurrentUser();
}
