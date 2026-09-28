/**
 * Roles pack activation gate (lib/roles/keys.js re-exports it). Its own module, with no imports, so
 * the dashboard's session check (lib/auth/delegate-session.js, loaded by middleware.js) can ask
 * whether the pack is on without pulling in lib/db: keys.js imports the users repository.
 */
export function rolesEnabled(env = process.env) {
  return env.MOJULO_ROLES === 'enabled';
}
