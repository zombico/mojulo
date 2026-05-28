'use client';

import { useTranslations } from 'next-intl';

export default function PlanPage() {
  const t = useTranslations('plan');
  return (
    <main className="min-h-[calc(100vh-66px)] p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <p className="text-[color:var(--text-secondary)] mt-2">{t('subtitle')}</p>
      </div>
    </main>
  );
}
