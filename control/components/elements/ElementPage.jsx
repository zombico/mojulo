'use client';

/**
 * One element, as a page: its specimen live in the middle (a geocube's room or land, a kit's stage, a grammar's city),
 * its colours and the recipes that name it beside it, its document below. View only; every word is the data's own.
 */

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';

import WorkshopShell from '@/components/WorkshopShell';
import { ColourStrips } from '@/components/elements/marks';

const fetcher = async (url) => {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

export default function ElementPage({ family, id, authEnabled = false }) {
  const base = `/api/elements/${encodeURIComponent(family)}/${encodeURIComponent(id)}`;
  const { data, error } = useSWR(base, fetcher, { revalidateOnFocus: true });
  const [view, setView] = useState(null);
  const at = view ?? data?.views?.[0]?.id;
  const src = at ? `${base}/world?view=${encodeURIComponent(at)}` : null;
  return (
    <WorkshopShell posture="pinned" width={1600} authEnabled={authEnabled} crumb={data?.title || id}>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{data?.title || id}</h1>
        <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{id}</span>
        <Link href="/elements" className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)] hover:text-[color:var(--live)]">{family}</Link>
        {data?.reads && <span className="text-[12px] text-[color:var(--ink-secondary)]">{data.reads}</span>}
        <nav className="ml-auto flex items-center gap-1.5" aria-label="views">
          {src && (
            <a href={src} target="_blank" rel="noreferrer" title={src} aria-label="↗" className="rounded-[var(--radius-control)] p-1.5 text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
            </a>
          )}
          {(data?.views ?? []).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={at === v.id}
              className={`rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                at === v.id ? 'border-[color:var(--live)] text-[color:var(--live)]' : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]'
              }`}
            >
              {v.name}
            </button>
          ))}
        </nav>
      </header>

      {error && <p className="border-b border-[color:var(--bay-rail)] px-4 py-2 font-mono text-[11px] text-[color:var(--fault)]">{error.message}</p>}

      <div className="flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
        <section className="relative min-h-[60vh] min-w-0 flex-1 bg-[color:var(--bay-void)] lg:min-h-0">
          {src && <iframe key={src} src={src} title={data?.title || id} className="absolute inset-0 h-full w-full border-0" />}
        </section>
        <aside className="flex flex-col gap-4 border-[color:var(--bay-rail)] px-4 py-3 max-lg:border-t lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:border-l">
          {data && <ColourStrips colours={data.colours} rows={12} height={14} />}
          {data?.usedBy?.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {data.usedBy.map((u) => (
                <li key={u.ref} className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                  <Link href={`/sketches/${encodeURIComponent(u.ref)}`} className="min-w-0 truncate text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]" title={u.title}>{u.title}</Link>
                  <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">{u.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {data?.document && (
        <details className="max-h-[32vh] overflow-y-auto border-t border-[color:var(--bay-rail)] px-4 py-2">
          <summary className="cursor-pointer list-none font-mono text-[11px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">{'{ }'}</summary>
          <pre className="mt-2 font-mono text-[10px] leading-relaxed text-[color:var(--ink-secondary)]">{JSON.stringify(data.document, null, 2)}</pre>
        </details>
      )}
    </WorkshopShell>
  );
}
