'use client';

/**
 * Chrome shared by every workshop surface: the status bar every home-ish page
 * closes with, and the amber copy-prompt button each of them hands the operator.
 *
 * They live in their own module for a plain structural reason. The bench
 * (ViewportHome) falls through to the directory (WorkshopHome) on an empty or
 * failed read, and the directory wears the same status bar — so leaving these
 * two in ViewportHome made the pair import each other. A cycle of hoisted
 * function declarations happens to work; a shared module is what it should have
 * been either way, since neither piece is about the viewport.
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

/** Agent-directed prompt text, handed over rather than executed. */
export function CopyPrompt({ value }) {
  const t = useTranslations('home3d');
  const [state, setState] = useState('idle'); // idle | copied | failed
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Clipboard access can be blocked (insecure context, denied permission) —
      // say so instead of leaving the button silently inert.
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  }, [value]);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={onCopy}
      title={value}
      className={`w-full rounded-[var(--radius-control)] border px-2 py-1.5 text-left font-mono text-[10px] transition-colors duration-100 ${
        state === 'failed'
          ? 'border-[color:var(--fault)] text-[color:var(--fault)]'
          : 'border-[color:var(--forge-idle)] text-[color:var(--forge)] hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10'
      }`}
    >
      {state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : t('inspector.askCopy')}
    </button>
  );
}

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
