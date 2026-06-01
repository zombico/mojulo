'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

function BotIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 4v4" />
      <path d="M15 4v4" />
      <circle cx="9.5" cy="13" r="0.75" fill="currentColor" />
      <circle cx="14.5" cy="13" r="0.75" fill="currentColor" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}

function ConnectedServicesIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="4" cy="6" r="1.75" />
      <circle cx="20" cy="6" r="1.75" />
      <circle cx="4" cy="18" r="1.75" />
      <circle cx="20" cy="18" r="1.75" />
      <path d="M10.2 10.4l-4.6-3.2" />
      <path d="M13.8 10.4l4.6-3.2" />
      <path d="M10.2 13.6l-4.6 3.2" />
      <path d="M13.8 13.6l4.6 3.2" />
    </svg>
  );
}

function AppsGridIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SketchIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Decision diamond — the recognizable flowchart element. Thinner
          stroke than the pencil so the two read as distinct layers. */}
      <path d="M 12 11 L 21 16.5 L 12 22 L 3 16.5 Z" strokeWidth="1.25" />
      {/* Pencil hovering above, tip pointing down at the diamond. */}
      <path d="M 20 3 L 14 9 L 11.5 9.5 L 12 7 L 18 1 Z" />
      <path d="M 14 9 L 12 7" />
      <path d="M 18.9 4 L 16.9 2" />
    </svg>
  );
}

function PlanIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14.5h7" />
      <path d="M8.5 18h4" />
    </svg>
  );
}

function NotebookIcon({ className = 'h-10 w-10' }) {
  // Open notebook — two facing pages with a center spine and ruled lines.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 6c-1.8-1.2-4-1.8-6.5-1.8-.8 0-1.5.6-1.5 1.4v11c0 .8.7 1.3 1.5 1.3 2.5 0 4.7.6 6.5 1.8" />
      <path d="M12 6c1.8-1.2 4-1.8 6.5-1.8.8 0 1.5.6 1.5 1.4v11c0 .8-.7 1.3-1.5 1.3-2.5 0-4.7.6-6.5 1.8" />
      <path d="M12 6v13.7" />
      <path d="M6.5 9h3" />
      <path d="M6.5 12h3" />
      <path d="M14.5 9h3" />
      <path d="M14.5 12h3" />
    </svg>
  );
}

function MapIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}

function SettingsIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

function BrandLogo({ className = 'w-28 h-28' }) {
  // Three-card stack with teal gradient — same composition as the login
  // page logo, but static (no deal animation) since the home launcher is
  // visited often and a constant animation would get noisy.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="160 115 70 70"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="home-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d6f68" />
          <stop offset="0.55" stopColor="#134e4a" />
          <stop offset="1" stopColor="#0a2a28" />
        </linearGradient>
        <linearGradient id="home-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7af0dc" />
          <stop offset="0.5" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#138a78" />
        </linearGradient>
        <linearGradient id="home-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9f5e8" />
          <stop offset="0.5" stopColor="#5eead4" />
          <stop offset="1" stopColor="#26b8a0" />
        </linearGradient>
      </defs>
      <rect x="-9.25" y="-19.55" width="11" height="40" rx="7.75" fill="url(#home-back)" transform="translate(183.8, 150) rotate(17)" />
      <rect x="-6.45" y="-21.55" width="11" height="40" rx="7.75" fill="url(#home-mid)" transform="translate(191, 150) rotate(340)" />
      <rect x="-6.00" y="-21.55" width="11" height="40" rx="7.75" fill="url(#home-front)" transform="translate(206.3, 150) rotate(340)" />
    </svg>
  );
}

function formatAge(seconds, t) {
  if (seconds == null) return null;
  if (seconds < 10) return t('declaredNow');
  if (seconds < 60) return t('declaredSeconds', { seconds: Math.floor(seconds) });
  if (seconds < 3600) return t('declaredMinutes', { minutes: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('declaredHours', { hours: Math.floor(seconds / 3600) });
  return t('declaredDays', { days: Math.floor(seconds / 86400) });
}

function AgentStatus() {
  const t = useTranslations('home.agentStatus');
  const { data } = useSWR('/api/agent-status', fetcher, { refreshInterval: 15000 });
  if (!data) return null;

  const live = data.liveSessions || [];
  const inv = data.inventory || {};
  const servers = inv.servers || [];
  const hasLive = live.length > 0;
  const hasInventory = (inv.toolCount || 0) > 0;
  if (!hasLive && !hasInventory) return null;

  const isFresh = hasLive || inv.fresh;
  const dotClass = isFresh
    ? 'bg-green-400'
    : 'bg-amber-400';

  let harnessLabel = null;
  if (hasLive) {
    if (live.length === 1) {
      const { name, version } = live[0];
      harnessLabel = version
        ? t('harnessOne', { name, version })
        : t('harnessOneNoVersion', { name });
    } else {
      harnessLabel = t('harnessMany', { count: live.length });
    }
  }

  const statusLabel = hasLive ? t('liveLabel') : t('staleLabel');
  const ageLabel = formatAge(inv.ageSeconds, t);

  return (
    <section className="mt-16 pt-6 border-t border-[color:var(--border-color)]/60">
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
          {t('title')}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--text-muted)]">
        <span className="text-[color:var(--text-secondary)]">{statusLabel}</span>
        {harnessLabel && (
          <span className="font-mono text-[color:var(--text-secondary)]">{harnessLabel}</span>
        )}
        {servers.length > 0 && (
          <span>
            {t('serversLabel', { count: servers.length })} · {t('toolsLabel', { count: inv.toolCount })}
          </span>
        )}
        {ageLabel && !hasLive && <span>{ageLabel}</span>}
      </div>
      {servers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {servers.map((s) => (
            <span
              key={s.name}
              className="rounded border border-[color:var(--border-color)]/60 px-1.5 py-0.5 text-[10px] font-mono text-[color:var(--text-muted)]"
            >
              {s.name}
              <span className="text-[color:var(--text-muted)]/60"> · {s.toolCount}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// Standalone sign-out — only rendered when auth is enabled on the host.
// Sits in the top-right corner so the launcher reads as logo + grid first
// and the sign-out is reachable without being part of the chrome.
function SignOutButton() {
  const tLogin = useTranslations('login');
  const router = useRouter();

  async function onLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.replace('/login');
  }

  return (
    <div className="absolute top-4 right-4">
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition"
      >
        <SignOutIcon />
        {tLogin('signOut')}
      </button>
    </div>
  );
}

const TILES = [
  { key: 'bots',      href: '/bots',       Icon: BotIcon },
  { key: 'mcpSkills', href: '/mcp-skills', Icon: ConnectedServicesIcon },
  { key: 'apps',      href: '/apps',       Icon: AppsGridIcon },
  { key: 'sketch',    href: '/sketches',   Icon: SketchIcon },
  { key: 'plan',      href: '/plan',       Icon: PlanIcon },
  { key: 'map',       href: '/map',        Icon: MapIcon },
  { key: 'research',  href: '/research',   Icon: NotebookIcon },
  // Settings lives in the grid because the home launcher hides the global
  // nav row — this is the operator's way back to host config.
  { key: 'settings',  href: '/settings',   Icon: SettingsIcon },
];

export default function HomeLauncher({ authEnabled = false }) {
  const t = useTranslations('home');

  return (
    <main className="relative min-h-screen">
      <h1 className="sr-only">{t('title')}</h1>
      {authEnabled ? <SignOutButton /> : null}

      <div className="px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col items-center select-none">
            <BrandLogo className="w-28 h-28" />
            <p className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              {t('title')}
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
            {TILES.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex flex-col items-center gap-3"
              >
                <div className="flex items-center justify-center aspect-square w-full max-w-[140px] rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] hover:border-[color:var(--brand-teal)] hover:bg-[color:var(--surface-elevated)]/30 transition">
                  <tile.Icon className="h-16 w-16 text-[color:var(--text-secondary)] group-hover:text-[color:var(--brand-teal)] transition" />
                </div>
                <span className="text-sm font-medium text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)] transition">
                  {t(`tiles.${tile.key}`)}
                </span>
              </Link>
            ))}
          </div>
          <AgentStatus />
        </div>
      </div>
    </main>
  );
}
