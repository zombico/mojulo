'use client';

/**
 * /play's client body — every playable game, as cabinets grouped by where it came from: a gameworld's run, a quick
 * game, a pixelizer game, a game project's rules, or create_game alone (/api/arcade's `source`). A cabinet opens the
 * game in its own tab (the game owns its window); a game a gameworld made links to that world's page, and a game a
 * project claims to the project's shelf. It folds the Arcade and the Game Developer gallery into one door. View only:
 * making a game stays with the host agent.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import WorkshopShell from '@/components/WorkshopShell';

const fetcher = (url) => fetch(url).then((r) => r.json());
const SOURCES = ['world', 'quick', 'pixel', 'project', 'game'];

// The cabinet's marquee: the game's own theme accents, so each carries its colour without stored artwork.
function Marquee({ theme }) {
  const accent = theme?.accent || '#334155';
  const accent2 = theme?.accent2 || theme?.accent || '#0f172a';
  return <span className="block h-14 w-full" style={{ background: `linear-gradient(120deg, ${accent}, ${accent2})` }} aria-hidden />;
}

function Cabinet({ cabinet }) {
  const t = useTranslations('arcade');
  return (
    <li className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)]">
      <a href={cabinet.playUrl} target="_blank" rel="noreferrer" className="group flex flex-1 flex-col">
        <Marquee theme={cabinet.theme} />
        <span className="flex flex-1 flex-col gap-1.5 p-3">
          <span className="text-[13px] font-medium text-[color:var(--ink-primary)] group-hover:text-[color:var(--live)]">{cabinet.title}</span>
          {cabinet.tagline && <span className="text-[11px] text-[color:var(--ink-secondary)]">{cabinet.tagline}</span>}
          <span className="mt-auto flex items-center justify-between pt-1 font-mono text-[10px] text-[color:var(--ink-muted)]">
            <span>{cabinet.levelCount > 0 ? t('levelCount', { count: cabinet.levelCount }) : ''}</span>
            <span className="text-[color:var(--live)]">▶</span>
          </span>
        </span>
      </a>
      {(cabinet.world || cabinet.project) && (
        <span className="flex items-center gap-2 border-t border-[color:var(--bay-rail)] px-3 py-1.5 font-mono text-[10px]">
          {cabinet.world && (
            <Link href={`/sketches/${encodeURIComponent(cabinet.world)}`} className="truncate text-[color:var(--ink-muted)] hover:text-[color:var(--live)]">{cabinet.world}</Link>
          )}
          {cabinet.project && (
            <Link href={`/games/${encodeURIComponent(cabinet.project.projectRef)}`} className="truncate text-[color:var(--ink-muted)] hover:text-[color:var(--live)]">
              {cabinet.project.status === 'shipped' ? `${cabinet.project.title} · ${t('shipped')}` : cabinet.project.title}
            </Link>
          )}
        </span>
      )}
    </li>
  );
}

export default function PlayBody({ authEnabled = false }) {
  const tTiles = useTranslations('home.tiles');
  const { data } = useSWR('/api/arcade', fetcher, { refreshInterval: 15000, revalidateOnFocus: true });
  const cabinets = data?.cabinets ?? [];
  const groups = SOURCES.map((s) => [s, cabinets.filter((c) => c.source === s)]).filter(([, list]) => list.length);
  return (
    <WorkshopShell posture="scroll" width={1400} authEnabled={authEnabled} crumb={tTiles('play')}>
      <div className="px-4 py-5 sm:px-6">
        <div className="mb-4 flex items-baseline gap-3">
          <h1 className="text-[18px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{tTiles('play')}</h1>
          {data && <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">{cabinets.length}</span>}
        </div>
        {groups.map(([source, list]) => (
          <section key={source} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">{source}</span>
              <span aria-hidden className="h-px flex-1 bg-[color:var(--bay-rail)]" />
              <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">{list.length}</span>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((c) => <Cabinet key={c.ref} cabinet={c} />)}
            </ul>
          </section>
        ))}
      </div>
    </WorkshopShell>
  );
}
