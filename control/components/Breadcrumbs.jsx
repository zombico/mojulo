'use client';

// Global breadcrumb trail, rendered just below AuthNav on every page except the
// home launcher, the login screen, and the bare sketch artifact views (where
// AuthNav also hides its chrome). The bar is a fixed 33px tall: content pages
// subtract nav (33px) + breadcrumbs (33px) = 66px from 100vh, so keep this
// height in sync with the calc(100vh-66px) sizing used across app/.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Route templates → ordered trail. The trail is the ancestor chain *after* the
// Home crumb (always prepended) up to and including the current page (the last
// crumb, which is never a link). Each crumb is one of:
//   - { labelKey }  — full i18n key path resolved off the root translator
//   - { dynamic }   — name of a [param] segment; its decoded value is the label
// An optional `href` (a path template, [param] tokens filled from the URL) turns
// the crumb into a link when it isn't the leaf. Non-routable intermediates
// (e.g. a deployment, which has no standalone page) simply omit `href`.
const ROUTES = [
  { tpl: '/apps', trail: [{ labelKey: 'apps.title' }] },
  {
    tpl: '/apps/[ref]',
    trail: [{ labelKey: 'apps.title', href: '/apps' }, { dynamic: 'ref' }],
  },
  {
    tpl: '/apps/[ref]/graph',
    trail: [
      { labelKey: 'apps.title', href: '/apps' },
      { dynamic: 'ref', href: '/apps/[ref]' },
      { labelKey: 'breadcrumbs.appGraph' },
    ],
  },
  { tpl: '/bots', trail: [{ labelKey: 'home.tiles.bots' }] },
  {
    tpl: '/bot-factory/modular',
    trail: [
      { labelKey: 'home.tiles.bots', href: '/bots' },
      { labelKey: 'dashboard.newBotWizard' },
    ],
  },
  {
    tpl: '/chat-builder',
    trail: [
      { labelKey: 'home.tiles.bots', href: '/bots' },
      { labelKey: 'dashboard.newBotChat' },
    ],
  },
  {
    tpl: '/dashboard/documents',
    trail: [
      { labelKey: 'home.tiles.bots', href: '/bots' },
      { labelKey: 'dashboard.documents.title' },
    ],
  },
  {
    tpl: '/dashboard/deployments/[id]/conversations',
    trail: [
      { labelKey: 'home.tiles.bots', href: '/bots' },
      { labelKey: 'breadcrumbs.deployment' },
      { labelKey: 'nav.conversations' },
    ],
  },
  {
    tpl: '/dashboard/deployments/[id]/submissions',
    trail: [
      { labelKey: 'home.tiles.bots', href: '/bots' },
      { labelKey: 'breadcrumbs.deployment' },
      { labelKey: 'submissions.title' },
    ],
  },
  {
    tpl: '/dashboard/deployments/[id]/cloud-deploy',
    trail: [
      { labelKey: 'home.tiles.bots', href: '/bots' },
      { labelKey: 'breadcrumbs.deployment' },
      { labelKey: 'cloudDeploy.title' },
    ],
  },
  { tpl: '/data', trail: [{ labelKey: 'data.title' }] },
  { tpl: '/graph', trail: [{ labelKey: 'graph.title' }] },
  { tpl: '/map', trail: [{ labelKey: 'map.title' }] },
  { tpl: '/observability', trail: [{ labelKey: 'observability.title' }] },
  { tpl: '/research', trail: [{ labelKey: 'research.title' }] },
  { tpl: '/stashes', trail: [{ labelKey: 'stashes.title' }] },
  {
    tpl: '/stashes/[ref]',
    trail: [{ labelKey: 'stashes.title', href: '/stashes' }, { dynamic: 'ref' }],
  },
  { tpl: '/outputs', trail: [{ labelKey: 'home.tiles.outputs' }] },
  // Studio (the retired "Maker" wordmark) — the /maker hub lists these rails,
  // so the Studio crumb links up to it.
  { tpl: '/maker', trail: [{ labelKey: 'home.groups.studio' }] },
  {
    tpl: '/maker/illustrations',
    trail: [{ labelKey: 'home.groups.studio', href: '/maker' }, { labelKey: 'home.tiles.illustrations' }],
  },
  {
    tpl: '/maker/worlds',
    trail: [{ labelKey: 'home.groups.studio', href: '/maker' }, { labelKey: 'home.tiles.worlds' }],
  },
  {
    tpl: '/maker/motion',
    trail: [{ labelKey: 'home.groups.studio', href: '/maker' }, { labelKey: 'home.tiles.motion' }],
  },
  {
    tpl: '/maker/beats',
    trail: [{ labelKey: 'home.groups.studio', href: '/maker' }, { labelKey: 'home.tiles.beats' }],
  },
  {
    // the beats studio — a dashboard page (unlike /sketches/<ref>, which is a
    // bare artifact frame and drops all chrome).
    tpl: '/beats/[ref]',
    trail: [
      { labelKey: 'home.groups.studio', href: '/maker' },
      { labelKey: 'home.tiles.beats', href: '/maker/beats' },
      { dynamic: 'ref' },
    ],
  },
  { tpl: '/mcp-skills', trail: [{ labelKey: 'mcpSkills.title' }] },
  {
    tpl: '/mcp-skills/[ref]',
    trail: [{ labelKey: 'mcpSkills.title', href: '/mcp-skills' }, { dynamic: 'ref' }],
  },
  {
    tpl: '/mcp-skills/[ref]/graph',
    trail: [
      { labelKey: 'mcpSkills.title', href: '/mcp-skills' },
      { dynamic: 'ref', href: '/mcp-skills/[ref]' },
      { labelKey: 'mcpSkills.viewGraph' },
    ],
  },
  { tpl: '/plan', trail: [{ labelKey: 'plan.title' }] },
  { tpl: '/settings', trail: [{ labelKey: 'settings.title' }] },
  { tpl: '/sketches', trail: [{ labelKey: 'sketchesIndex.title' }] },
];

// Match a concrete pathname against the templates, capturing [param] segments
// (kept URL-encoded so reconstructed hrefs round-trip).
function matchRoute(pathname) {
  const segs = pathname.split('/').filter(Boolean);
  for (const route of ROUTES) {
    const tplSegs = route.tpl.split('/').filter(Boolean);
    if (tplSegs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < tplSegs.length; i++) {
      const token = tplSegs[i];
      if (token.startsWith('[') && token.endsWith(']')) {
        params[token.slice(1, -1)] = segs[i];
      } else if (token !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function fillHref(tpl, params) {
  return tpl.replace(/\[([^\]]+)\]/g, (_, name) => params[name] ?? '');
}

function truncate(value, max = 28) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations();

  // Skip the home launcher, the login screen, and the bare sketch artifact
  // views (mirrors AuthNav, which drops all chrome on /sketches/<ref>).
  if (!pathname) return null;
  if (pathname === '/' || pathname === '/login') return null;
  if (pathname.startsWith('/sketches/')) return null;

  const matched = matchRoute(pathname);
  if (!matched) return null;

  const { route, params } = matched;
  const crumbs = route.trail.map((crumb, i) => {
    const isLast = i === route.trail.length - 1;
    const label = crumb.dynamic
      ? truncate(decodeURIComponent(params[crumb.dynamic] || ''))
      : t(crumb.labelKey);
    const href = !isLast && crumb.href ? fillHref(crumb.href, params) : null;
    return { label, href, isLast };
  });

  const linkClass =
    'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition';

  return (
    <nav
      aria-label="Breadcrumb"
      className="h-[33px] w-full border-b border-[color:var(--border-color)] bg-[color:var(--surface-primary)] px-4 flex items-center text-xs overflow-x-auto"
    >
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        <li>
          <Link href="/" className={linkClass}>
            {t('breadcrumbs.home')}
          </Link>
        </li>
        {crumbs.map((crumb, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span aria-hidden className="text-[color:var(--text-muted)]/50">
              /
            </span>
            {crumb.href ? (
              <Link href={crumb.href} className={linkClass}>
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={crumb.isLast ? 'page' : undefined}
                className={
                  crumb.isLast
                    ? 'text-[color:var(--text-primary)] font-medium'
                    : 'text-[color:var(--text-muted)]'
                }
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
