'use client';

/**
 * /maker — Mojulo Maker studio hub.
 *
 * The creative concern: a tuned, opinionated surface, sibling to the Sketches
 * concern (/sketches, tuned for diagrams & scientific explanation). This page
 * is a plain launcher — the same icon tiles as Workshop Home's Studio drawer
 * (WORKSHOP_GROUPS is the single source of truth, so the rails here and in the
 * nav can never drift). Each rail's gallery does its own data loading; this
 * page renders no previews. It is not a conversational surface (minting is
 * driven from the host agent per the dashboard golden rule).
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { WORKSHOP_GROUPS, hueVars } from '@/components/workshop-nav';

export default function MakerHubPage() {
  const t = useTranslations('maker');
  const tHome = useTranslations('home');
  const studio = WORKSHOP_GROUPS.find((g) => g.key === 'studio');

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-900">
      <div className="px-8 pt-8 pb-12 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100">{t('hub.title')}</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-2xl">{t('hub.subtitle')}</p>

        <div
          style={hueVars(studio.hue)}
          className="mt-8 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-6 sm:p-8"
        >
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-6">
            {studio.tiles.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="ws-tile flex flex-col items-center gap-2.5"
              >
                <div className="ws-tile-box flex items-center justify-center aspect-square w-full max-w-[96px] rounded-xl border bg-[color:var(--background)]">
                  <tile.Icon className="h-10 w-10" />
                </div>
                <span className="ws-tile-label text-xs font-medium text-center text-[color:var(--text-secondary)]">
                  {tHome(`tiles.${tile.key}`)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
