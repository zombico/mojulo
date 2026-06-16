'use client';

/**
 * /maker — Mojulo Maker studio hub.
 *
 * The illustration concern: a tuned, opinionated creative surface, sibling to
 * the Sketches concern (/sketches, tuned for diagrams & scientific
 * explanation). Two rails:
 *
 *   Illustrations — landscapes/figures/painterly stills (sketch rows, bucket=illustration)
 *   Worlds        — traversable three.js cityscapes/hubs (sketch rows, bucket=world)
 *   Motion        — movies & gifs (the Motion Project gallery)
 *
 * An illustration is the SAME sketch primitive as a diagram — everything a
 * sketch participates in (stash, references, diff) works identically; the
 * bucket only decides which concern owns it. This page renders state and points
 * the operator at each rail; it is not a conversational surface (minting is
 * driven from the host agent per the dashboard golden rule).
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

function useRecent(url, pick) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const { items: list, total } = pick(data);
        if (!alive) return;
        setItems(list.slice(0, 4));
        setCount(total);
      } catch {
        if (alive) {
          setItems([]);
          setCount(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return { items, count, loading };
}

export default function MakerHubPage() {
  const t = useTranslations('maker');

  const illustrations = useRecent('/api/sketches?bucket=illustration', (d) => ({
    items: (d.sketches || []).map((s) => ({
      key: s.ref,
      href: `/sketches/${encodeURIComponent(s.ref)}`,
      thumb: `/api/sketches/${encodeURIComponent(s.ref)}/svg?inline=1`,
      title: s.title,
    })),
    total: (d.sketches || []).length,
  }));

  // Worlds use PNG thumbs (they have no SVG form — the still is the baked PNG).
  const worlds = useRecent('/api/sketches?bucket=world', (d) => ({
    items: (d.sketches || []).map((s) => ({
      key: s.ref,
      href: `/sketches/${encodeURIComponent(s.ref)}`,
      thumb: `/api/sketches/${encodeURIComponent(s.ref)}/png?inline=1&scale=1`,
      title: s.title,
    })),
    total: (d.sketches || []).length,
  }));

  const motion = useRecent('/api/motion', (d) => {
    const motions = (d.projects || []).flatMap((p) => p.motions || []);
    return {
      items: motions.map((m) => ({
        key: m.motionRef,
        href: m.url,
        external: true,
        thumb: m.svgUrl || m.gifUrl,
        title: m.title,
      })),
      total: (d.motions || motions).length,
    };
  });

  const rails = [
    { key: 'illustrations', href: '/maker/illustrations', data: illustrations, accent: 'violet' },
    { key: 'worlds', href: '/maker/worlds', data: worlds, accent: 'cyan' },
    { key: 'motion', href: '/maker/motion', data: motion, accent: 'amber' },
  ];

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-900">
      <div className="px-8 pt-8 pb-12 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100">{t('hub.title')}</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-2xl">{t('hub.subtitle')}</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {rails.map((rail) => (
            <RailCard key={rail.key} rail={rail} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

const ACCENT = {
  teal: 'hover:border-teal-500 hover:shadow-teal-500/10',
  violet: 'hover:border-violet-500 hover:shadow-violet-500/10',
  cyan: 'hover:border-cyan-500 hover:shadow-cyan-500/10',
  amber: 'hover:border-amber-500 hover:shadow-amber-500/10',
};

function RailCard({ rail, t }) {
  const { key, href, data, accent } = rail;
  const { items, count, loading } = data;
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border border-gray-700 bg-gray-800/60 p-5 transition hover:shadow-lg ${ACCENT[accent]}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-100">{t(`${key}.title`)}</h2>
        <span className="text-xs text-gray-500">{t('itemCount', { count })}</span>
      </div>
      <p className="mt-1 text-xs text-gray-400 min-h-[2.5rem]">{t(`${key}.blurb`)}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded bg-gray-700/40 animate-pulse" />
          ))
        ) : items.length === 0 ? (
          <div className="col-span-2 aspect-[8/3] rounded bg-gray-900/40 border border-dashed border-gray-700 flex items-center justify-center text-[11px] text-gray-600">
            {t('empty')}
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.key}
              className="aspect-[4/3] rounded overflow-hidden bg-[#fafaf6] flex items-center justify-center"
              title={it.title}
            >
              {it.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumb} alt={it.title || ''} className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[10px] text-gray-400">{it.title}</span>
              )}
            </div>
          ))
        )}
      </div>

      <span className="mt-4 text-xs font-medium text-gray-400 group-hover:text-gray-200">
        {t('open')} →
      </span>
    </Link>
  );
}
