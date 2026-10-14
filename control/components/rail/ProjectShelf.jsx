'use client';

/**
 * A shelf of projects of one kind (Worlds, Places): every project on that rail, last touched first, each a card that
 * shows how far it has come. View only; an empty shelf is an empty grid.
 */

import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import WorkshopShell from '@/components/WorkshopShell';
import { ProjectGrid } from '@/components/rail/ProjectCards';
import Repertoire from '@/components/rail/Repertoire';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function ProjectShelf({ group, authEnabled = false }) {
  const t = useTranslations('home.tiles');
  const { data } = useSWR(`/api/projects?group=${group}`, fetcher, { refreshInterval: 15000, revalidateOnFocus: true });
  const projects = data?.projects ?? [];
  return (
    <WorkshopShell posture="scroll" width={1400} authEnabled={authEnabled} crumb={t(group)}>
      <div className="px-4 py-5 sm:px-6">
        <div className="mb-4 flex items-baseline gap-3">
          <h1 className="text-[18px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{t(group)}</h1>
          {data && <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">{projects.length}</span>}
        </div>
        {/* worlds lead with what a world can be built from, drawable in any kit without asking */}
        {group === 'worlds' && <Repertoire />}
        <ProjectGrid projects={projects} />
      </div>
    </WorkshopShell>
  );
}
