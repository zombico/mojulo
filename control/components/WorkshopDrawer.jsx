'use client';

/**
 * The global Workshop nav — the home rack, reachable from anywhere.
 *
 * It renders the SAME `DoorGrid` the front door does, three columns instead of
 * eight, so the drawer is not a second design of the nav but the same rack at a
 * narrower width. That is stronger than the old agreement, which was only about
 * CONTENTS (both read `visibleWorkshopGroups`, so a mode with nothing in it is
 * absent from both): the two can now no longer drift in SHAPE either — a door
 * gets its relief plate, its hue-on-hover, and its name in one place.
 *
 * It is a floating shell rather than a flush slab, matching the front door's own
 * curved frame: the workshop is one object you open, not a panel welded to the
 * window. Opened from the AuthNav brand, so the rack is one click away on every
 * page that is not itself the rack — `/` has no trigger, because there the
 * drawer would open a copy of the page behind it.
 *
 * Workshop Home is the first link inside, and the Dashboard sits above the modes
 * rather than inside one: it is not a fourth mode, it is the view of everything
 * the modes make.
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { DoorGrid } from './WorkshopHome';
import { visibleWorkshopGroups, BrandMark, hueVars, FloorIcon } from './workshop-nav';

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function WorkshopDrawer({ open, onClose }) {
  const t = useTranslations('home');
  // `open` gates the fetch: the drawer is mounted on every page, and an unopened
  // drawer has no reason to hit the API. SWR dedupes with the home's copy.
  const { data: presence } = useSWR(open ? '/api/workshop/presence' : null, fetcher);
  const groups = visibleWorkshopGroups(presence);
  const pathname = usePathname();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  const isActive = (href) =>
    pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));

  // Esc closes; focus the close button on open; lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={open ? undefined : true}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel — inset and curved, the front door's shell on its side. */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className={`moj-shell absolute inset-y-3 left-3 flex w-[22rem] max-w-[88vw] flex-col transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
        }`}
      >
        {/* The same nav strip the front door wears. */}
        <div className="flex items-center gap-3 border-b border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-4 py-2.5">
          <Link
            href="/"
            onClick={onClose}
            className="moj-hover-pop group inline-flex items-center gap-2.5 text-[13px] tracking-[0.06em] text-[color:var(--ink-secondary)] transition-colors hover:text-[color:var(--ink-primary)]"
          >
            <BrandMark className="h-6 w-6" idPrefix="wsdrawer" />
            {t('title')}
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('drawer.close')}
            className="moj-hover-pop ml-auto rounded-[var(--radius-control)] p-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[color:var(--bay-bench)] hover:text-[color:var(--ink-primary)]"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {/* The floor sits above the modes and outside them: not a fourth mode,
              the view of everything the modes make. Teal, because what it shows
              is what exists. */}
          <div
            className="border-b border-[color:var(--bay-rail)] px-4 py-3"
            style={hueVars({ base: 'var(--live)', strong: 'var(--live-strong)', idle: 'var(--live-idle)' })}
          >
            <Link
              href="/dashboard"
              onClick={onClose}
              aria-current={isActive('/dashboard') ? 'page' : undefined}
              className={`ws-door group flex items-center gap-3 rounded-[var(--radius-card)] px-1 py-1 ${
                isActive('/dashboard') ? 'is-active' : ''
              }`}
            >
              <span className="ws-door-plate moj-field flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] border">
                <FloorIcon className="h-5 w-5" />
              </span>
              <span className="ws-door-name text-[13px] tracking-tight">{t('tiles.dashboard')}</span>
            </Link>
          </div>

          {groups.map((group) => (
            <DoorGrid key={group.key} group={group} columns="grid-cols-3" onNavigate={onClose} />
          ))}
        </nav>
      </aside>
    </div>
  );
}
