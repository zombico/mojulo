'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import { WORKSHOP_GROUPS, BrandMark, hueVars } from './workshop-nav';

const fetcher = (url) => fetch(url).then((r) => r.json());

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

export default function HomeLauncher() {
  const t = useTranslations('home');
  // Default to the Operate mode so the operator lands on their running fleet.
  const [active, setActive] = useState('operate');
  const group = WORKSHOP_GROUPS.find((g) => g.key === active) || WORKSHOP_GROUPS[0];

  return (
    <main className="relative min-h-screen">
      <div className="px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col items-center select-none">
            <BrandMark className="w-16 h-16" idPrefix="home" />
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              {t('title')}
            </h1>
          </div>

          {/* Three top-level modes. Selecting one opens its drawer below. */}
          <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-5">
            {WORKSHOP_GROUPS.map((g) => {
              const isActive = g.key === active;
              return (
                <button
                  key={g.key}
                  type="button"
                  aria-expanded={isActive}
                  aria-controls="workshop-drawer"
                  onClick={() => setActive(g.key)}
                  style={hueVars(g.hue)}
                  className={`ws-modebtn flex flex-col items-center gap-3 rounded-2xl border px-4 py-6 bg-[color:var(--surface-primary)] ${
                    isActive ? 'is-active' : 'border-[color:var(--border-color)]'
                  }`}
                >
                  <g.Icon className="ws-modebtn-ico h-11 w-11" />
                  <span className="ws-modebtn-label text-base font-semibold tracking-tight">
                    {t(`groups.${g.key}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Drawer — always present, so it stays neutral (never styled active). */}
          <div
            id="workshop-drawer"
            role="region"
            aria-live="polite"
            style={hueVars(group.hue)}
            className="mt-6 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-6 sm:p-8"
          >
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-6">
              {group.tiles.map((tile) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="ws-tile flex flex-col items-center gap-2.5"
                >
                  <div className="ws-tile-box flex items-center justify-center aspect-square w-full max-w-[96px] rounded-xl border bg-[color:var(--background)]">
                    <tile.Icon className="h-10 w-10" />
                  </div>
                  <span className="ws-tile-label text-xs font-medium text-center text-[color:var(--text-secondary)]">
                    {t(`tiles.${tile.key}`)}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <AgentStatus />
        </div>
      </div>
    </main>
  );
}
