'use client';

/**
 * /data's client body — the explorer/sql/analytics tabs inside the workshop
 * shell. The `?tab=` read needs useSearchParams (hence the Suspense boundary);
 * page.jsx resolves the auth flag server-side and hands it down for the
 * strip's sign-out.
 */

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import WorkshopShell from '@/components/WorkshopShell';
import ExplorerView from './ExplorerView';
import AnalyticsView from './AnalyticsView';
import SqlExplorerView from './SqlExplorerView';

const TABS = ['explorer', 'sql', 'analytics'];

function DataShell() {
  const t = useTranslations('data');
  const searchParams = useSearchParams();
  const router = useRouter();
  const requested = searchParams.get('tab');
  const initial = TABS.includes(requested) ? requested : 'explorer';
  const [tab, setTab] = useState(initial);

  function switchTab(next) {
    setTab(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', next);
    router.replace(`/data?${sp.toString()}`);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">{t('title')}</h1>
          <p className="text-[color:var(--text-secondary)] mt-2">{t('subtitle')}</p>
        </header>

        <nav
          className="flex gap-1 border-b border-[color:var(--border-color)]"
          aria-label={t('title')}
        >
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
                tab === key
                  ? 'border-[color:var(--brand-teal)] text-[color:var(--text-primary)]'
                  : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              {t(`tabs.${key}`)}
            </button>
          ))}
        </nav>

        <div>
          {tab === 'explorer' && <ExplorerView />}
          {tab === 'sql' && <SqlExplorerView />}
          {tab === 'analytics' && <AnalyticsView />}
        </div>
      </div>
    </div>
  );
}

export default function DataBody({ authEnabled = false }) {
  const t = useTranslations('data');
  return (
    <WorkshopShell posture="pinned" width={1400} crumb={t('title')} authEnabled={authEnabled}>
      <Suspense fallback={null}>
        <DataShell />
      </Suspense>
    </WorkshopShell>
  );
}
