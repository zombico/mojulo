'use client';

/**
 * Chrome shared by every workshop surface: the status bar every home-ish page
 * closes with.
 *
 * It lives in its own module for a plain structural reason. The bench
 * (ViewportHome) falls through to the directory (WorkshopHome) on an empty or
 * failed read, and the directory wears the same status bar — so leaving it in
 * ViewportHome made the pair import each other.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function StatusBar({ status, queue, library, note = null }) {
  const t = useTranslations('home3d');
  const waiting = (queue?.stages?.queued || 0) + (queue?.stages?.inFlight || 0);
  const gate = queue?.stages?.gate || 0;
  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[color:var(--bay-rail)] px-6 py-2 font-mono text-[10px] text-[color:var(--ink-muted)]">
      {/* The machine-on light. Install state is DERIVED from disk, so a lean host
          can read WHY it has fewer doors instead of just having fewer of them. */}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--live)' }} aria-hidden />
        {t('status.packs', { packs: status?.packs?.length ? status.packs.join(' · ') : t('status.kernelOnly') })}
      </span>
      <Link href="/render-bay" className="hover:text-[color:var(--ink-secondary)]">
        {t('status.queue', { n: waiting })}
      </Link>
      {gate > 0 && (
        <Link href="/render-bay" style={{ color: 'var(--forge)' }} className="hover:underline">
          {t('status.gate', { n: gate })}
        </Link>
      )}
      <Link href="/library" className="hover:text-[color:var(--ink-secondary)]">
        {t('status.library', { n: library?.total ?? 0 })}
      </Link>
      {note && <span>{note}</span>}
      {status?.toolCalls != null && <span className="ml-auto">{t('status.toolCalls', { n: status.toolCalls })}</span>}
    </footer>
  );
}
