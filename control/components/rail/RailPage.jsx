'use client';

/**
 * A recipe on a rail, as one page: what it is for and how far each part of that has come (left), the thing itself in
 * its book, its World or its game (centre), what it is made of (right), and everything it and its parts have been
 * taken out as (below): each outcome folder whole, a page opening in its own tab. The view on screen opens on its own
 * too, and a book downloads as one self-contained file.
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
import { PART_STYLE, Dot, concernTitle, briefStyle, concernStyle } from '@/components/rail/marks';
import { formatBytes } from '@/lib/render-bay/lanes';

const fetcher = async (url) => {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.reason || `HTTP ${res.status}`);
  return body;
};

/* ── exits ────────────────────────────────────────────────────────────────── */

const EXIT_PATHS = {
  book: 'M4 5.5C6.5 4 9.5 4 12 5.5V19c-2.5-1.5-5.5-1.5-8 0V5.5zM12 5.5C14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0',
  walk: 'M13 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM10 8l-2.5 4M10 8l3 1.5 2 3M10 8l-.5 5 2.5 3.5V21M9.5 13 7 21',
  play: 'M7 4.5v15l12-7.5z',
  playtest: 'M5 4.5v15l10-7.5zM18 5v14M21 5v14',
  characters: 'M9 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM2.5 19v-2.5a4 4 0 0 1 8 0V19M13.5 19v-2.5a4 4 0 0 1 8 0V19',
  open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z',
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
    <ol className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col">
      {outcomes.map((o) => {
        const total = o.concerns.length;
        const done = o.concerns.filter((c) => c.state === 'given' || c.state === 'waived').length;
        return (
          <li key={o.id} className="border-b border-[color:var(--bay-rail)] px-4 py-3 lg:last:border-b-0">
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
                    <Dot style={concernStyle(c)} />
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

/** What the project and its parts were taken out as: each owner's outcome folder, by its subfolders. A page opens in
 *  its own tab; anything else is taken. A subfolder with many files starts folded. */
function Shipped({ shipped }) {
  if (!shipped.length) return null;
  return (
    <section className="max-h-[32vh] overflow-y-auto border-t border-[color:var(--bay-rail)] px-4 py-3">
      {shipped.map((o) => (
        <div key={o.ref} className="mb-3 last:mb-0">
          <div className="mb-1.5 flex items-baseline gap-3 font-mono text-[10px] text-[color:var(--ink-muted)]">
            <a href={o.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]" title={o.url}>
              <ExitIcon id="folder" className="h-3.5 w-3.5" />
              {o.ref}
            </a>
            {o.role && <span className="uppercase tracking-[0.18em] text-[9px]">{o.role}</span>}
            <span className="ml-auto tabular-nums">{o.total} · {formatBytes(o.bytes)}</span>
          </div>
          <div className="flex flex-col gap-1">
            {o.groups.map((g) => {
              const list = (
                <ul className={`flex flex-wrap gap-1.5 ${g.dir ? 'mt-1 pl-3' : ''}`}>
                  {g.files.map((f) => (
                    <li key={f.path}>
                      <a
                        href={f.href}
                        {...(f.page ? { target: '_blank', rel: 'noreferrer' } : { download: '' })}
                        className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[10px] hover:border-[color:var(--live)] hover:text-[color:var(--ink-primary)] ${
                          f.page ? 'border-[color:var(--live-idle)] text-[color:var(--live)]' : 'border-[color:var(--bay-rail-lit)] text-[color:var(--ink-secondary)]'
                        }`}
                      >
                        <span>{g.dir ? f.path.slice(g.dir.length + 1) : f.path}</span>
                        <span className="tabular-nums text-[color:var(--ink-muted)]">{formatBytes(f.bytes)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              );
              // the folder's own files plainly; each subfolder folds, open while it is short
              return g.dir ? (
                <details key={g.dir} open={g.total <= 8} className="group">
                  <summary className="cursor-pointer list-none font-mono text-[10px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">
                    <span className="inline-block w-3 transition-transform group-open:rotate-90">›</span>{g.dir}/ <span className="tabular-nums">{g.total}</span>
                  </summary>
                  {list}
                  {g.total > g.files.length && <span className="mt-1 block pl-3 font-mono text-[10px] text-[color:var(--ink-muted)]">+{g.total - g.files.length}</span>}
                </details>
              ) : <div key=".">{list}</div>;
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── the page ─────────────────────────────────────────────────────────────── */

export default function RailPage({ refId: ref, initialTitle = null, authEnabled = false }) {
  const { data, error } = useSWR(`/api/sketches/${encodeURIComponent(ref)}/rail`, fetcher, {
    refreshInterval: 8000,
    revalidateOnFocus: true,
  });
  const exits = data?.exits ?? [];
  // the pages the recipe draws are views too: a world's own atlas, a stage's boards
  const sheets = useMemo(() => (data?.sheets ?? []).map((x) => ({ id: `sheet:${x.id}`, name: x.name, href: x.href })), [data?.sheets]);
  const views = useMemo(() => [...exits, ...sheets], [exits, sheets]);
  const [view, setView] = useState(null); // { id, hash? }
  // the book first when there is one, else the first way in
  useEffect(() => {
    if (!view && views.length) setView({ id: views[0].id });
  }, [views, view]);
  const exit = views.find((e) => e.id === view?.id);
  // a book or a sheet downloads as one self-contained page; a World or a game is played, not taken
  const takes = exit && (exit.id === 'book' || exit.id === 'characters' || exit.id.startsWith('sheet:'));
  const src = exit ? `${exit.href}${view.hash ? `#${view.hash}` : ''}` : null;

  // a concern opens where its part is drawn: the world bible, or the character bible
  const onConcern = (c) => {
    const at = c.view || 'book';
    if (exits.some((e) => e.id === at)) setView({ id: at, hash: c.anchor || '' });
  };

  return (
    <WorkshopShell posture="pinned" width={1600} authEnabled={authEnabled} crumb={data?.title || initialTitle || ref}>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-3">
        <h1 className="text-[18px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{data?.title || initialTitle || ref}</h1>
        <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{ref}</span>
        {data && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">{[data.rail, data.kind !== data.rail && data.kind].filter(Boolean).join(' · ')}</span>}
        {data?.parent && (
          <Link href={`/sketches/${encodeURIComponent(data.parent)}`} className="font-mono text-[11px] text-[color:var(--live)] hover:underline">↑ {data.parent}</Link>
        )}
        <nav className="ml-auto flex items-center gap-1" aria-label="views">
          {/* the view on screen, on its own: in a tab of its own, and the book as one self-contained file */}
          {exit && (
            <>
              <a href={exit.href} target="_blank" rel="noreferrer" title={exit.href} aria-label={`${exit.id} ↗`} className="rounded-[var(--radius-control)] p-1.5 text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">
                <ExitIcon id="open" />
              </a>
              {takes && (
                <a href={`${exit.href}${exit.href.includes('?') ? '&' : '?'}download=1`} title={`${exit.href}?download=1`} aria-label={`${exit.id} ⤓`} className="rounded-[var(--radius-control)] p-1.5 text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">
                  <ExitIcon id="download" />
                </a>
              )}
              <span aria-hidden className="mx-1 h-4 w-px bg-[color:var(--bay-rail)]" />
            </>
          )}
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
        {/* the pages it draws, by name: a world's land, flora, structures, castle; a stage's boards */}
        {sheets.length > 0 && (
          <nav className="flex w-full flex-wrap items-center gap-1.5 pt-1" aria-label="sheets">
            {sheets.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setView({ id: x.id })}
                aria-pressed={view?.id === x.id}
                className={`rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  view?.id === x.id
                    ? 'border-[color:var(--live)] text-[color:var(--live)]'
                    : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]'
                }`}
              >
                {x.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      {(error || data?.errors?.length) && (
        <p className="border-b border-[color:var(--bay-rail)] px-4 py-2 font-mono text-[11px] text-[color:var(--fault)]">
          {error ? error.message : data.errors.join(' · ')}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
        {/* a project with no outcomes of its own (a game) has no column for them */}
        {(!data || data.outcomes.length > 0) && (
          <aside className="border-[color:var(--bay-rail)] max-lg:border-b lg:w-[240px] lg:shrink-0 lg:overflow-y-auto lg:border-r">
            {data ? <Outcomes outcomes={data.outcomes} onConcern={onConcern} /> : <Loading />}
          </aside>
        )}

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

      {data && <Shipped shipped={data.shipped ?? []} />}
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
