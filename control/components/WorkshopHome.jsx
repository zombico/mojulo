'use client';

/**
 * Workshop Home — the front door as a DIRECTORY, not a workshop.
 *
 * The splayed floor moved to `/dashboard`. What lands here is the thing the old
 * tile launcher was trying to be and the floor could never be: a page you read
 * in one glance and leave immediately. Every door is a plate wearing its own
 * dot-relief face, grouped by mode, named and nothing else.
 *
 * ── The page is one object ──────────────────────────────────────────────────
 * The whole surface is a single curved shell, and the shell's top strip IS the
 * nav — brand, locator, install state, and Settings, on the one page that has
 * no chrome above it (AuthNav stands down at `/`). Two bars stacked over a page
 * whose entire job is "here are the doors" was the app describing itself twice.
 * Settings stays chrome rather than becoming a thirteenth door, which is the
 * rule workshop-nav.jsx already states: a mode holds what the agent MAKES.
 *
 * There is deliberately no drawer trigger here. The drawer exists so the rack is
 * reachable from other pages; on the rack itself it would open a copy of the
 * page behind it.
 *
 * ── The brand system, stated plainly (3d-factory-ui.plan.md §7) ─────────────
 *   · ONE frame, divided by shared hairlines. Padding, never margin.
 *   · The Ben-Day field means exactly one thing — space that can be minted into
 *     and has not been. So it appears twice: behind the ghosted mark on the
 *     dashboard plate (the floor is where minted things land) and under the
 *     amber ask card. Never behind a door: a door is not latent space.
 *   · Dot rows are proportions paired with their number, never decoration.
 *   · Hue carries STATE. Doors are ink at rest and take their mode's hue on
 *     hover; the one thing wearing a lit hue at rest is the ask card, because
 *     it is the only affordance that needs the agent to act.
 *   · Mono for what a machine wrote, sans for the names a person reads.
 *
 * The nav model is shared with the global slide-out (workshop-nav.jsx), which is
 * what keeps this page and the drawer from ever disagreeing about what exists —
 * including the presence gating that hides an operational door with no records.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import { DotRow } from '@/components/brand/DotRow';
import IconRelief from '@/components/brand/IconRelief';
import MojuloMark from '@/components/brand/MojuloMark';
import { CopyPrompt, StatusBar } from '@/components/WorkshopChrome';
import { visibleWorkshopGroups, hueVars, FloorIcon, DOOR_ICONS } from '@/components/workshop-nav';
import { LIBRARY_ZONES, zoneCounts } from '@/lib/graph/sketch/library-zones';

const fetcher = (url) => fetch(url).then((r) => r.json());

/** The starter prompt the amber card hands over. Handed to the agent, never run here. */
const STARTER_PROMPT =
  'Call forward_context on the mojulo MCP, tell me what is already on the bench, and suggest three things worth making next.';

/* ── the treatment's chrome vocabulary ────────────────────────────────────── */

/** A machine-written label: mono, tiny, wide-tracked, uppercase. */
function Micro({ children, className = '', style }) {
  return (
    <span
      style={style}
      className={`font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)] ${className}`}
    >
      {children}
    </span>
  );
}

/** A status capsule in the shell's nav strip. `live` lights it teal with a lead dot. */
function Pill({ children, live = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
        live
          ? 'border-[color:var(--live)]/35 text-[color:var(--live)]'
          : 'border-[color:var(--bay-rail-lit)] text-[color:var(--ink-muted)]'
      }`}
    >
      {live && <span aria-hidden className="inline-block h-[5px] w-[5px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

function GearIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

/* ── the nav strip ────────────────────────────────────────────────────────── */

/**
 * The shell's top edge. Where the shell IS the page's nav (`/`, and the floor at
 * `/dashboard` where AuthNav also stands down) it carries Settings and the
 * sign-out; anywhere else this component is the empty-workshop fallback, AuthNav
 * is overhead, and the strip stays purely informational rather than duplicating
 * it. Exported so the splayed floor can wear the same strip on the same shell.
 * `crumb` overrides the locator word. The brand is three things by context: at
 * `/` it rests (the rack needs no trigger), given `onBrandToggle` it opens the
 * shell's own nav rail (WorkshopShell), and otherwise it walks home.
 */
export function NavStrip({ isNav, authEnabled, packs, total, crumb, navOpen = false, onBrandToggle = null }) {
  const t = useTranslations('home');
  const tSettings = useTranslations('settings');
  const tLogin = useTranslations('login');
  const router = useRouter();
  const atRoot = usePathname() === '/';

  async function onLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.replace('/login');
  }

  const chrome =
    'moj-hover-pop inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1 font-mono text-[10px] text-[color:var(--ink-muted)] transition-colors hover:bg-[color:var(--bay-bench)] hover:text-[color:var(--ink-primary)]';

  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-4 py-2.5 sm:px-6">
      {onBrandToggle ? (
        <button
          type="button"
          onClick={onBrandToggle}
          aria-expanded={navOpen}
          aria-controls="workshop-rail"
          aria-label={navOpen ? t('drawer.close') : t('drawer.open')}
          className="moj-hover-wave flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <MojuloMark size={28} className="text-[color:var(--ink-primary)]" />
          <h1 className="text-[13px] tracking-[0.06em] text-[color:var(--ink-primary)]">mojulo</h1>
        </button>
      ) : atRoot ? (
        <span className="flex items-center gap-3">
          <MojuloMark size={28} className="text-[color:var(--ink-primary)]" />
          <h1 className="text-[13px] tracking-[0.06em] text-[color:var(--ink-primary)]">mojulo</h1>
        </span>
      ) : (
        <Link href="/" className="moj-hover-wave flex items-center gap-3 transition-opacity hover:opacity-80">
          <MojuloMark size={28} className="text-[color:var(--ink-primary)]" />
          <h1 className="text-[13px] tracking-[0.06em] text-[color:var(--ink-primary)]">mojulo</h1>
        </Link>
      )}
      <Micro className="hidden sm:inline">/ {crumb ?? t('crumb')}</Micro>

      <span className="ml-auto flex items-center gap-2">
        {packs.length > 0 && <Pill live>{t('packsPill', { packs: packs.join(' · ') })}</Pill>}
        {total != null && <Pill>{t('artifactsPill', { n: total })}</Pill>}
        {isNav && (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-[color:var(--bay-rail)]" />
            <Link href="/settings" className={chrome}>
              <GearIcon />
              <span className="hidden sm:inline">{tSettings('title')}</span>
            </Link>
            {authEnabled && (
              <button type="button" onClick={onLogout} className={chrome}>
                <SignOutIcon />
                <span className="hidden sm:inline">{tLogin('signOut')}</span>
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

/* ── the dashboard plate ──────────────────────────────────────────────────── */

/**
 * The one card on the page, and the only place the field texture is earned: the
 * floor is where minted artifacts land, so the plate the link sits on is latent
 * space with the mark condensing out of it. The zone tallies are dot rows
 * against the library total — a proportion read beside its own number, and the
 * only description this door needs.
 */
function DashboardPlate({ library }) {
  const t = useTranslations('home');
  const tz = useTranslations('floor.zones');
  const total = library?.total ?? 0;
  const zones = zoneCounts(library?.counts || {});

  return (
    <Link
      href="/dashboard"
      className="moj-hover-wave moj-hover-pop group flex items-stretch gap-4 border-b border-[color:var(--bay-rail)] px-4 py-4 transition-colors hover:bg-[color:var(--bay-bench)]/40 sm:gap-6 sm:px-6"
    >
      <span
        aria-hidden
        className="moj-field flex w-24 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] sm:w-32"
      >
        <MojuloMark
          size={72}
          className="text-[color:var(--ink-secondary)]/70 transition-colors duration-150 group-hover:text-[color:var(--live)]"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-3">
        <span className="flex items-center gap-3">
          <FloorIcon className="h-4 w-4 shrink-0 text-[color:var(--ink-muted)] transition-colors group-hover:text-[color:var(--live)]" />
          <span className="text-[15px] font-medium tracking-tight text-[color:var(--ink-primary)]">
            {t('dashboard.title')}
          </span>
          <Micro className="ml-auto hidden text-[color:var(--live)] opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
            {t('dashboard.open')}
          </Micro>
        </span>

        {/* Each row is a part of the SAME whole (the library total), which is
            what makes the two comparable at a glance. */}
        <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LIBRARY_ZONES.map((zone) => (
            <span key={zone.key} className="inline-flex items-center gap-2">
              <DotRow part={zones[zone.key] || 0} whole={total} />
              <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">
                <span className="text-[color:var(--ink-secondary)]">{zones[zone.key] || 0}</span>{' '}
                {tz(zone.key)}
              </span>
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}

/* ── the doors ────────────────────────────────────────────────────────────── */

/**
 * One mode's doors, as a grid of plates. Shared with the drawer, which is the
 * same rack at a narrower width — one component, so the two surfaces cannot
 * drift in shape any more than they can drift in contents.
 *
 * A grid rather than a list because a door needs exactly two things — its face
 * and its name — and a list's spare width pulls in prose to fill it. The mode
 * header is a hue and a word: a count of doors sitting beside a grid of doors is
 * the page counting for you something you can already see.
 */
export function DoorGrid({ group, columns = 'grid-cols-3 sm:grid-cols-5 md:grid-cols-8', onNavigate }) {
  const t = useTranslations('home');
  return (
    <section
      style={hueVars(group.hue)}
      className="border-b border-[color:var(--bay-rail)] px-4 py-4 last:border-b-0 sm:px-6"
    >
      <div className="flex items-center gap-2 pb-4">
        <group.Icon className="ws-mode-label h-3.5 w-3.5" />
        <span className="ws-mode-label font-mono text-[9px] uppercase tracking-[0.22em]">
          {t(`groups.${group.key}`)}
        </span>
        <span aria-hidden className="ml-3 h-px flex-1 bg-[color:var(--bay-rail)]" />
      </div>

      <ul className={`grid gap-x-3 gap-y-5 ${columns}`}>
        {group.tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              onClick={onNavigate}
              className="ws-door group flex flex-col items-center gap-2.5"
            >
              <span className="ws-door-plate flex aspect-square w-full max-w-[84px] items-center justify-center rounded-[var(--radius-card)] border bg-[color:var(--bay-void)]">
                <IconRelief
                  name={tile.icon}
                  Icon={DOOR_ICONS[tile.icon]}
                  size={62}
                  className="h-[74%] w-[74%]"
                />
              </span>
              <span className="ws-door-name text-center text-[12px] leading-tight tracking-tight">
                {t(`tiles.${tile.key}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── the host agent ───────────────────────────────────────────────────────── */

/**
 * The one fact this page knows that no other page reports: whether a host agent
 * is actually attached, and how much of an MCP surface it declared. It rides the
 * status bar's `note` slot rather than taking a section of its own — the old
 * launcher gave it a heading and a chip row, which was more furniture than a
 * one-line fact deserves.
 */
function useAgentNote() {
  const t = useTranslations('home.agentStatus');
  const { data } = useSWR('/api/agent-status', fetcher, { refreshInterval: 15000 });
  if (!data) return null;

  const live = data.liveSessions || [];
  const inv = data.inventory || {};
  const servers = inv.servers || [];
  if (live.length === 0 && !(inv.toolCount > 0)) return null;

  const parts = [live.length > 0 ? t('liveLabel') : t('staleLabel')];
  if (live.length === 1) {
    const { name, version } = live[0];
    parts.push(version ? t('harnessOne', { name, version }) : t('harnessOneNoVersion', { name }));
  } else if (live.length > 1) {
    parts.push(t('harnessMany', { count: live.length }));
  }
  if (servers.length > 0) {
    parts.push(t('serversLabel', { count: servers.length }));
    parts.push(t('toolsLabel', { count: inv.toolCount }));
  }
  return parts.join(' · ');
}

/* ── the page ─────────────────────────────────────────────────────────────── */

export default function WorkshopHome({ authEnabled = false, asNav = false }) {
  const t = useTranslations('home');
  // `shallow=1` skips the head artifact and its outcome scan — this page draws
  // counts, not a viewport, and has no reason to pay for either.
  const { data } = useSWR('/api/home?shallow=1', fetcher, { revalidateOnFocus: false });
  const { data: presence } = useSWR('/api/workshop/presence', fetcher);
  const groups = visibleWorkshopGroups(presence);
  const agentNote = useAgentNote();
  // The strip is the app's nav on the real front door, and wherever the caller
  // says the chrome has stood down (`asNav` — the floor's empty-workshop
  // fallback at /dashboard). Under AuthNav it must not double the chrome.
  const isNav = usePathname() === '/' || asNav;

  return (
    <main className="px-4 py-6 sm:px-8 sm:py-10">
      <div className="moj-shell mx-auto w-full max-w-[1040px]">
        <NavStrip
          isNav={isNav}
          authEnabled={authEnabled}
          packs={data?.status?.packs || []}
          total={data?.library?.total}
        />

        <DashboardPlate library={data?.library} />

        {groups.map((group) => (
          <DoorGrid key={group.key} group={group} />
        ))}

        {/* The one mutating affordance on the page, and it does not mutate: it
            hands the operator a prompt for their own agent. Amber, on the
            field, exactly once — the "not a conversational surface" rule made
            visible rather than merely obeyed. */}
        <div className="moj-field-faint border-t border-[color:var(--bay-rail)] px-4 py-4 sm:px-6">
          <div className="flex max-w-sm flex-col gap-2 rounded-[var(--radius-card)] border border-[color:var(--forge)]/40 bg-[color:var(--bay-bench)] p-3">
            <Micro style={{ color: 'var(--forge)' }}>{t('ask.title')}</Micro>
            <p className="font-mono text-[10px] leading-relaxed text-[color:var(--ink-muted)]">
              {t('ask.body')}
            </p>
            <CopyPrompt value={STARTER_PROMPT} />
          </div>
        </div>

        <StatusBar status={data?.status} queue={data?.queue} library={data?.library} note={agentNote} />
      </div>
    </main>
  );
}
