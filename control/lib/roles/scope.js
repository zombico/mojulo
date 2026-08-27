import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Workshop-space scope — Phase 4 of the roles pack (lib/mcp/roles-pack.plan.md).
 *
 * The caller's space rides an AsyncLocalStorage entered at the ONE handler
 * invocation seam (instrumentedInvoke in lib/mcp/telemetry.js — both call
 * paths, plus pack dispatch, funnel through it), so the four scoped
 * repositories read `currentSpaceId()` themselves and no call site threads a
 * parameter. Chokepoint discipline again: repositories can't forget an
 * argument nobody passes.
 *
 * Semantics: a NULL scope is the operator — no filtering, byte-identical to
 * today (also what test code, dashboard routes, and background jobs outside
 * a handler see; background pipeline steps mutate rows BY ID that were
 * created in-scope, so reads/lists in handlers are the enforcement surface).
 * A delegate's scope is their own space id: their creates stamp it, their
 * reads see only it, and rows outside it read as not-found (404-not-403,
 * lifted from the ancestor).
 */

const storage = new AsyncLocalStorage();

/** Enter `fn` under a caller scope. A null scope runs bare (the operator). */
export function runWithScope(scope, fn) {
  if (!scope) return fn();
  return storage.run(scope, fn);
}

/** The active caller's workshop-space id, or null for the operator/default. */
export function currentSpaceId() {
  return storage.getStore()?.spaceId ?? null;
}

/** Build the scope for an execution context — non-null only for a delegate
 * key that carries a space. */
export function scopeFromContext(context) {
  if (context?.userRole === 'privileged' && context.userSpaceId) {
    return { spaceId: context.userSpaceId, userId: context.userId };
  }
  return null;
}
