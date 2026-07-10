'use client';

// Global Workshop navigation — a left slide-out that mirrors the home launcher's
// three modes (Ideate / Operate / Studio). Opened from the AuthNav brand so the
// operator can jump anywhere without first returning home. Workshop Home itself
// is the first link inside, so home stays reachable.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { WORKSHOP_GROUPS, BrandMark, hueVars } from './workshop-nav';

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function WorkshopDrawer({ open, onClose }) {
  const t = useTranslations('home');
  const pathname = usePathname();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  // A row is "active" when the current route is that destination or nested
  // under it (e.g. /maker/illustrations/<ref>).
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
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className={`absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col border-r border-[color:var(--border-color)] bg-[color:var(--surface-primary)] shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header: brand + Workshop Home link + close */}
        <div className="flex items-center justify-between border-b border-[color:var(--border-color)] px-4 py-3">
          <Link
            href="/"
            onClick={onClose}
            className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition"
          >
            <BrandMark className="h-6 w-6" idPrefix="wsdrawer" />
            {t('title')}
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('drawer.close')}
            className="rounded-md p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)]/40 hover:text-[color:var(--text-primary)] transition"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Modes — mirror of the home launcher, stacked as sections. */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-6">
            {WORKSHOP_GROUPS.map((g) => (
              <li key={g.key} style={hueVars(g.hue)}>
                <div className="flex items-center gap-2 px-2 pb-2">
                  <g.Icon className="ws-mode-label h-4 w-4" />
                  <span className="ws-mode-label text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
                    {t(`groups.${g.key}`)}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {g.tiles.map((tile) => (
                    <li key={tile.href}>
                      <Link
                        href={tile.href}
                        onClick={onClose}
                        aria-current={isActive(tile.href) ? 'page' : undefined}
                        className={`ws-row flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                          isActive(tile.href) ? 'is-active' : ''
                        }`}
                      >
                        <span className="ws-row-box flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-[color:var(--background)]">
                          <tile.Icon className="h-[18px] w-[18px]" />
                        </span>
                        {t(`tiles.${tile.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
