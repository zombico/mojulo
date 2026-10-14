'use client';

/**
 * A recipe on a rail, as one page: what it is for and how far each part of that has come (left), the thing itself in
 * its book, its World or its game (centre), what it is made of (right), and what it has been taken out as (below).
 *
 * The page draws `/api/sketches/<ref>/rail` (lib/graph/rail) and nothing else, and it is view only: the agent makes and
 * changes everything; the page re-reads when it regains focus and every few seconds, so a change the agent makes shows
 * up on its own. Elements carry the meaning: a concern is a dot whose fill is its state, a part a mark whose fill is
 * its freshness. Every word on it is the data's own (outcome names, part roles, refs, file names), so the page adds
 * nothing to translate.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import WorkshopShell from '@/components/WorkshopShell';
import { formatBytes } from '@/lib/render-bay/lanes';

const fetcher = async (url) => {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.reason || `HTTP ${res.status}`);
  return body;
};

/* ── marks ────────────────────────────────────────────────────────────────── */

// A concern's state as a dot. Given by the creator's eyes is solid; given by the machine gate is a ring around a
// fainter fill, so the two never read alike.
const CONCERN_STYLE = {
  'given:eyes': { background: 'var(--live)', borderColor: 'var(--live)' },
  'given:machine': { background: 'var(--live-idle)', borderColor: 'var(--live)' },
  given: { background: 'var(--live)', borderColor: 'var(--live)' },
  open: { background: 'transparent', borderColor: 'var(--ink-muted)' },
  advised: { background: 'var(--forge)', borderColor: 'var(--forge)' },
  waived: { background: 'transparent', borderColor: 'var(--ink-muted)', borderStyle: 'dashed' },
};
const PART_STYLE = {
  fresh: { background: 'var(--live)', borderColor: 'var(--live)' },
  stale: { background: 'var(--forge)', borderColor: 'var(--forge)' },
  edited: { background: 'var(--think)', borderColor: 'var(--think)' },
  missing: { background: 'transparent', borderColor: 'var(--ink-muted)' },
  waiting: { background: 'transparent', borderColor: 'var(--ink-muted)', borderStyle: 'dotted' },
  taken: { background: 'var(--fault)', borderColor: 'var(--fault)' },
};

function Dot({ style, size = 10, title }) {
  return (
    <span
      aria-hidden={!title}
      title={title}
      className="inline-block shrink-0 rounded-full border-[1.5px]"
      style={{ width: size, height: size, ...style }}
    />
  );
}

const concernTitle = (c) => [c.name || c.id, c.state, c.gate, c.note].filter(Boolean).join(' · ');

/** An outcome in brief, as a part shows it: one mark, its worst state. */
function briefStyle(o) {
  if (o.advised) return CONCERN_STYLE.advised;
  if (o.open) return CONCERN_STYLE.open;
  if (o.given || o.waived) return CONCERN_STYLE.given;
  return { ...CONCERN_STYLE.open, opacity: 0.4 };
}

/* ── exits ────────────────────────────────────────────────────────────────── */

const EXIT_PATHS = {
  book: 'M4 5.5C6.5 4 9.5 4 12 5.5V19c-2.5-1.5-5.5-1.5-8 0V5.5zM12 5.5C14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0',
  walk: 'M13 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM10 8l-2.5 4M10 8l3 1.5 2 3M10 8l-.5 5 2.5 3.5V21M9.5 13 7 21',
  play: 'M7 4.5v15l12-7.5z',
  playtest: 'M5 4.5v15l10-7.5zM18 5v14M21 5v14',
};

function ExitIcon({ id, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={EXIT_PATHS[id] || EXIT_PATHS.book} />
    </svg>
  );
}

/* ── regions ──────────────────────────────────────────────────────────────── */

function Outcomes({ outcomes, onConcern }) {
  return (
    <ol className="flex flex-col">
      {outcomes.map((o) => {
        const total = o.concerns.length;
        const done = o.concerns.filter((c) => c.state === 'given' || c.state === 'waived').length;
        return (
          <li key={o.id} className="border-b border-[color:var(--bay-rail)] px-4 py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-[color:var(--ink-primary)]">{o.name}</span>
              <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">{total ? `${done}/${total}` : '—'}</span>
            </div>
            {total > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {o.concerns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onConcern(c)}
                    title={concernTitle(c)}
                    aria-label={concernTitle(c)}
                    className="rounded-full p-0.5 transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--live)]"
                  >
                    <Dot style={CONCERN_STYLE[c.gate ? `${c.state}:${c.gate}` : c.state] || CONCERN_STYLE.open} />
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Parts({ parts }) {
  const byRole = useMemo(() => {
    const m = new Map();
    for (const p of parts) m.set(p.role, [...(m.get(p.role) || []), p]);
    return [...m.entries()];
  }, [parts]);
  if (!parts.length) return <p className="px-4 py-3 font-mono text-[10px] text-[color:var(--ink-muted)]">—</p>;
  return (
    <div className="flex flex-col">
      {byRole.map(([role, list]) => (
        <section key={role} className="border-b border-[color:var(--bay-rail)] px-4 py-3 last:border-b-0">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">{role}</span>
            <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">
              {list.filter((p) => p.state === 'fresh').length}/{list.length}
            </span>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {list.map((p) => (
              <li key={p.ref} className="flex items-center gap-2">
                <Dot style={PART_STYLE[p.state]} size={8} title={p.state} />
                {p.state === 'missing' || p.state === 'taken' ? (
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[color:var(--ink-muted)]" title={p.ref}>{p.ref}</span>
                ) : (
                  <Link href={`/sketches/${encodeURIComponent(p.ref)}`} className="min-w-0 flex-1 truncate font-mono text-[11px] text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]" title={p.ref}>
                    {p.ref}
                  </Link>
                )}
                {p.rail && (
                  <span className="flex shrink-0 gap-0.5" title={p.rail.map((o) => `${o.id} ${o.given + o.waived}/${o.given + o.waived + o.open + o.advised}`).join(' · ')}>
                    {p.rail.map((o) => <Dot key={o.id} style={briefStyle(o)} size={6} />)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Files({ files }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 border-t border-[color:var(--bay-rail)] px-4 py-3">
      {files.map((f) => (
        <li key={f.name}>
          <a
            href={f.href}
            download
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2 py-1 font-mono text-[10px] text-[color:var(--ink-secondary)] hover:border-[color:var(--live)] hover:text-[color:var(--ink-primary)]"
          >
            <span>{f.name}</span>
            <span className="tabular-nums text-[color:var(--ink-muted)]">{formatBytes(f.bytes)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ── the page ─────────────────────────────────────────────────────────────── */

export default function RailPage({ refId: ref, initialTitle = null, authEnabled = false }) {
  const { data, error } = useSWR(`/api/sketches/${encodeURIComponent(ref)}/rail`, fetcher, {
    refreshInterval: 8000,
    revalidateOnFocus: true,
  });
  const exits = data?.exits ?? [];
  const [view, setView] = useState(null); // { id, hash? }
  // the book first when there is one, else the first way in
  useEffect(() => {
    if (!view && exits.length) setView({ id: exits[0].id });
  }, [exits, view]);
  const exit = exits.find((e) => e.id === view?.id);
  const src = exit ? `${exit.href}${view.hash ? `#${view.hash}` : ''}` : null;

  const onConcern = (c) => {
    if (exits.some((e) => e.id === 'book')) setView({ id: 'book', hash: c.anchor || '' });
  };

  return (
    <WorkshopShell posture="pinned" width={1600} authEnabled={authEnabled} crumb={data?.title || initialTitle || ref}>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{data?.title || initialTitle || ref}</h1>
        <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{ref}</span>
        {data && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">{data.rail}{data.kind !== data.rail ? ` · ${data.kind}` : ''}</span>}
        {data?.parent && (
          <Link href={`/sketches/${encodeURIComponent(data.parent)}`} className="font-mono text-[11px] text-[color:var(--live)] hover:underline">↑ {data.parent}</Link>
        )}
        <nav className="ml-auto flex items-center gap-1" aria-label="views">
          {exits.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setView({ id: e.id })}
              title={e.id}
              aria-label={e.id}
              aria-pressed={view?.id === e.id}
              className={`rounded-[var(--radius-control)] border p-1.5 transition-colors ${
                view?.id === e.id
                  ? 'border-[color:var(--live)] text-[color:var(--live)]'
                  : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]'
              }`}
            >
              <ExitIcon id={e.id} />
            </button>
          ))}
        </nav>
      </header>

      {(error || data?.errors?.length) && (
        <p className="border-b border-[color:var(--bay-rail)] px-4 py-2 font-mono text-[11px] text-[color:var(--fault)]">
          {error ? error.message : data.errors.join(' · ')}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
        <aside className="border-[color:var(--bay-rail)] max-lg:border-b lg:w-[240px] lg:shrink-0 lg:overflow-y-auto lg:border-r">
          {data ? <Outcomes outcomes={data.outcomes} onConcern={onConcern} /> : <Loading />}
        </aside>

        <section className="relative min-h-[60vh] min-w-0 flex-1 bg-[color:var(--bay-void)] lg:min-h-0">
          {src ? (
            // keyed on the recipe's revision too: when the agent changes it, the frame reads it again
            <iframe key={`${view.id}:${data?.updatedAt ?? ''}`} src={src} title={data?.title || ref} className="absolute inset-0 h-full w-full border-0" />
          ) : data ? null : <Loading />}
        </section>

        <aside className="border-[color:var(--bay-rail)] max-lg:border-t lg:w-[260px] lg:shrink-0 lg:overflow-y-auto lg:border-l">
          {data ? <Parts parts={data.parts} /> : null}
        </aside>
      </div>

      {data && <Files files={data.files ?? []} />}
    </WorkshopShell>
  );
}

function Loading() {
  return (
    <div className="flex h-full min-h-24 items-center justify-center" aria-hidden>
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--ink-muted)] border-t-transparent motion-reduce:animate-none" />
    </div>
  );
}
