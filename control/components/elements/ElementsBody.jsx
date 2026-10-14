'use client';

/**
 * /elements — what a world is built and styled from, all of it on screen without asking: first the repertoire (every
 * sheet mojulo draws from its own tables, in a kit), then each family of elements (geocubes, kits, city grammars) as
 * cards of their own colours. A card opens the element: its specimen, live. View only; every word is the data's own.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import WorkshopShell from '@/components/WorkshopShell';
import Repertoire from '@/components/rail/Repertoire';
import { ColourStrips } from '@/components/elements/marks';

const fetcher = (url) => fetch(url).then((r) => r.json());

function ElementCard({ family, el }) {
  return (
    <Link
      href={`/elements/${encodeURIComponent(family)}/${encodeURIComponent(el.id)}`}
      className="moj-hover-pop flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] p-3 transition-colors hover:border-[color:var(--live)]"
    >
      <ColourStrips colours={el.colours} />
      <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--ink-primary)]">{el.title}</span>
      {el.reads && <span className="line-clamp-2 text-[11px] text-[color:var(--ink-secondary)]">{el.reads}</span>}
      <span className="mt-auto truncate font-mono text-[10px] text-[color:var(--ink-muted)]">{el.id}</span>
    </Link>
  );
}

export default function ElementsBody({ authEnabled = false }) {
  const t = useTranslations('home.tiles');
  const { data } = useSWR('/api/elements', fetcher, { revalidateOnFocus: false });
  return (
    <WorkshopShell posture="scroll" width={1400} authEnabled={authEnabled} crumb={t('elements')}>
      <div className="px-4 py-5 sm:px-6">
        <h1 className="mb-4 text-[18px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{t('elements')}</h1>
        <Repertoire />
        {(data?.families ?? []).map((f) => (
          <section key={f.id} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">{f.name}</span>
              <span aria-hidden className="h-px flex-1 bg-[color:var(--bay-rail)]" />
              <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">{f.elements.length}</span>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {f.elements.map((el) => <li key={el.id}><ElementCard family={f.id} el={el} /></li>)}
            </ul>
          </section>
        ))}
      </div>
    </WorkshopShell>
  );
}
