// The shell-route registry — which pages wear the workshop shell.
//
// A shell page's top strip IS its nav (WorkshopShell.jsx), so the global
// chrome (AuthNav + Breadcrumbs) stands down there. Both consult this ONE list
// instead of growing per-route conditionals; converting a page to the shell
// means adding its route here and nothing in the chrome components.
//
// `/sketches/<ref>` is NOT here: it is the bare artifact frame, where ALL
// chrome (shell included) stands down — AuthNav/Breadcrumbs keep their own
// check for it. `/login` is not here either: the auth screen stays chromeless
// by its own rules. The nested `/dashboard/*` bot pages (documents,
// deployments) are deliberately absent until the chatbot-pack phase of
// components/workshop-shell.plan.md — an exact match on '/dashboard' must not
// swallow them.

const SHELL_PATHS = new Set([
  '/',
  '/dashboard',
  '/library',
  '/maker',
  '/maker/motion',
  '/maker/beats',
  '/maker/voice',
  '/maker/games',
  '/arcade',
  '/render-bay',
  '/outputs',
  '/research',
  '/plan',
  '/stashes',
  '/mcp-skills',
  '/apps',
  '/data',
  '/graph',
  '/map',
  '/observability',
  '/settings',
]);

// Detail readings of shell surfaces (refs and their sub-views).
const SHELL_PREFIXES = ['/stashes/', '/mcp-skills/', '/apps/', '/beats/', '/games/'];

export function isShellPath(pathname) {
  if (!pathname) return false;
  if (SHELL_PATHS.has(pathname)) return true;
  return SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
