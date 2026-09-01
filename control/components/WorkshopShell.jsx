'use client';

/**
 * The workshop shell with its own nav rail — the frame `/dashboard` and
 * `/library` wear.
 *
 * The rail is the third rendering of the ONE nav model (workshop-nav.jsx),
 * after the home directory's door grid and the global slide-out drawer: the
 * same groups, presence gating and hues, compressed to single rows — a small
 * line icon and a name — because inside a working surface the nav is a lane
 * change, not a landing page.
 *
 * It lives INSIDE the shell: a zero-width strip on the container's left edge,
 * under the top strip, that expands rightward over the content. The brand mark
 * in the strip is the one trigger (aria-expanded points here), which is why
 * shell pages need no "Open navigation" affordance of their own. Esc, a
 * click-away on the shell, or navigating closes it. Collapsed it is `inert`,
 * so its links never catch a keyboard tab through the page.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import MojuloMark from '@/components/brand/MojuloMark';
import { NavStrip } from '@/components/WorkshopHome';
import { visibleWorkshopGroups, hueVars, FloorIcon, DOOR_ICONS } from '@/components/workshop-nav';

const fetcher = (url) => fetch(url).then((r) => r.json());

const LIVE_HUE = { base: 'var(--live)', strong: 'var(--live-strong)', idle: 'var(--live-idle)' };

/** One lane: small icon + name on a single row. Hue comes from the group's --h. */
function RailRow({ href, label, active, onNavigate, children }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-[12px] tracking-tight transition-colors duration-100 hover:bg-[color:var(--bay-bench)] hover:text-[color:var(--h)] ${
          active ? 'text-[color:var(--h)]' : 'text-[color:var(--ink-secondary)]'
        }`}
      >
        {children}
        {label}
      </Link>
    </li>
  );
}

export function WorkshopRail({ open, onClose }) {
  const t = useTranslations('home');
  const pathname = usePathname();
  // Open gates the fetch, same as the drawer; SWR dedupes with any other reader.
  const { data: presence } = useSWR(open ? '/api/workshop/presence' : null, fetcher);
  const groups = visibleWorkshopGroups(presence);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isActive = (href) => pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));

  return (
    <>
      {/* Click-away, scoped to the shell rather than the window: the rail is a
          part of this instrument, not an app-level mode. */}
      {open && <div aria-hidden onClick={onClose} className="absolute inset-0 z-20" />}
      <aside
        id="workshop-rail"
        aria-label={t('title')}
        inert={!open}
        className={`absolute inset-y-0 left-0 z-30 overflow-hidden bg-[color:var(--bay-void)] transition-[width] duration-200 ease-out motion-reduce:transition-none ${
          open
            ? 'w-[232px] border-r border-[color:var(--bay-rail)] shadow-[10px_0_30px_rgb(0_0_0/0.35)]'
            : 'w-0'
        }`}
      >
        {/* Fixed inner width so labels never reflow mid-slide. */}
        <nav className="h-full w-[232px] overflow-y-auto py-2">
          {/* Above the modes and outside them (the drawer's rule): home and the
              floor are views of everything, so they wear the live hue. */}
          <ul className="px-2 pb-2" style={hueVars(LIVE_HUE)}>
            <RailRow href="/" label={t('title')} active={pathname === '/'} onNavigate={onClose}>
              <MojuloMark size={16} className="shrink-0 opacity-80" />
            </RailRow>
            <RailRow
              href="/dashboard"
              label={t('tiles.dashboard')}
              active={isActive('/dashboard')}
              onNavigate={onClose}
            >
              <FloorIcon className="h-4 w-4 shrink-0 opacity-80" />
            </RailRow>
          </ul>

          {groups.map((group) => (
            <div
              key={group.key}
              style={hueVars(group.hue)}
              className="border-t border-[color:var(--bay-rail)] px-2 py-2"
            >
              <div className="flex items-center gap-2 px-2 pb-1.5">
                <group.Icon className="ws-mode-label h-3 w-3" />
                <span className="ws-mode-label font-mono text-[9px] uppercase tracking-[0.22em]">
                  {t(`groups.${group.key}`)}
                </span>
              </div>
              <ul>
                {group.tiles.map((tile) => {
                  const TileIcon = DOOR_ICONS[tile.icon];
                  return (
                    <RailRow
                      key={tile.href}
                      href={tile.href}
                      label={t(`tiles.${tile.key}`)}
                      active={isActive(tile.href)}
                      onNavigate={onClose}
                    >
                      <TileIcon className="h-4 w-4 shrink-0 opacity-80" />
                    </RailRow>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

/** The width knob is an identity-free per-page choice (workshop-shell.plan.md):
    1040 reads-and-leaves, 1400 is the content default, 1600 is a gallery wall. */
const WIDTHS = {
  1040: 'max-w-[1040px]',
  1400: 'max-w-[1400px]',
  1600: 'max-w-[1600px]',
};

/**
 * NavStrip + rail + the page's outer main, wired: the strip's brand toggles
 * the rail, pages put their regions in `children`.
 *
 * `posture` picks the height model — 'scroll' lets the shell grow and the
 * page scroll (the floor); 'pinned' makes the shell a viewport-height
 * instrument whose panes scroll inside (the library) and REPLACES the old
 * h-[calc(100vh-66px)] idiom, since there is no chrome above to subtract.
 *
 * The strip's pills come from `packs`/`total` when the page already holds
 * them (the floor's /api/home read); left undefined, the shell makes the
 * shallow counts-only read itself — SWR dedupes it across surfaces.
 */
export default function WorkshopShell({
  authEnabled = false,
  packs,
  total,
  crumb,
  posture = 'scroll',
  width = 1400,
  children,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const needPills = packs === undefined && total === undefined;
  const { data: shallow } = useSWR(needPills ? '/api/home?shallow=1' : null, fetcher);

  const shell = (
    <div
      className={`moj-shell mx-auto flex w-full flex-col ${WIDTHS[width] || WIDTHS[1400]} ${
        posture === 'pinned' ? 'min-h-0 flex-1' : ''
      }`}
    >
      <NavStrip
        isNav
        authEnabled={authEnabled}
        packs={packs ?? shallow?.status?.packs ?? []}
        total={total ?? shallow?.library?.total}
        crumb={crumb}
        navOpen={navOpen}
        onBrandToggle={() => setNavOpen((v) => !v)}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <WorkshopRail open={navOpen} onClose={() => setNavOpen(false)} />
        {children}
      </div>
    </div>
  );

  return posture === 'pinned' ? (
    <main className="flex h-screen flex-col px-4 py-4 sm:px-6 sm:py-5">{shell}</main>
  ) : (
    <main className="px-4 py-6 sm:px-8 sm:py-10">{shell}</main>
  );
}
