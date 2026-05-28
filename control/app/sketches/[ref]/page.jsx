'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';

export default function SketchPage({ params }) {
  const { ref } = use(params);
  const t = useTranslations('sketches');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setNotFound(false);
    try {
      const res = await fetch(`/api/sketches/${encodeURIComponent(ref)}`);
      if (res.status === 404) {
        setNotFound(true);
        setData(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  const manifest = data?.manifest;

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">{t('notFoundTitle')}</h2>
          <p className="text-sm text-[color:var(--text-muted)]">{t('notFoundBody')}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-sm text-red-400">{error}</p>
      </main>
    );
  }

  if (!manifest) {
    return <main className="min-h-screen" aria-hidden />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-7xl">
        <CreationMap manifest={manifest} technical={false} />
      </div>
    </main>
  );
}
