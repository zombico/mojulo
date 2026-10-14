'use client';

/**
 * Projects as cards: a title, its ref, and one bar per outcome showing how far it has come. Each card reads its own
 * rail, so a shelf of them fills in as each answers. View only: a card opens the project's page.
 */

import Link from 'next/link';
import useSWR from 'swr';

import { OutcomeBar } from '@/components/rail/marks';

const fetcher = (url) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function ProjectCard({ project }) {
  const { data: rail } = useSWR(`/api/sketches/${encodeURIComponent(project.ref)}/rail`, fetcher, { revalidateOnFocus: true });
  const outcomes = rail?.outcomes ?? [];
  return (
    <Link
      href={`/sketches/${encodeURIComponent(project.ref)}`}
      className="moj-hover-pop group flex flex-col gap-3 rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] p-3 transition-colors hover:border-[color:var(--live)]"
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--ink-primary)]">{project.title}</span>
      <span className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(outcomes.length, 1)}, minmax(0, 1fr))` }}>
        {outcomes.length
          ? outcomes.map((o) => (
            <span key={o.id} className="flex min-w-0 flex-col gap-1" title={`${o.name} ${o.concerns.filter((c) => c.state === 'given' || c.state === 'waived').length}/${o.concerns.length}`}>
              <OutcomeBar outcome={o} />
              {/* a name under each bar while they fit; past that the bars speak and the name is the bar's title */}
              {outcomes.length <= 5 && <span className="truncate font-mono text-[8px] uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">{o.name}</span>}
            </span>
          ))
          : <span className="block h-1 animate-pulse rounded-full bg-[color:var(--bay-rail)] motion-reduce:animate-none" aria-hidden />}
      </span>
      <span className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-[color:var(--ink-muted)]">
        <span className="min-w-0 truncate">{project.ref}</span>
        <span className="shrink-0 text-[9px] uppercase tracking-[0.18em]">{project.kind}</span>
      </span>
    </Link>
  );
}

export function ProjectGrid({ projects, columns = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' }) {
  return (
    <ul className={`grid grid-cols-1 gap-3 ${columns}`}>
      {projects.map((p) => (
        <li key={p.ref}><ProjectCard project={p} /></li>
      ))}
    </ul>
  );
}
