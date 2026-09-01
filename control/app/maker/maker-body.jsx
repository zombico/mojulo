'use client';

/**
 * /maker's client body — Mojulo Maker studio hub.
 *
 * The creative concern: a tuned, opinionated surface, sibling to the Sketches
 * concern (/sketches, tuned for diagrams & scientific explanation). This page
 * is a plain launcher — the same icon tiles as Workshop Home's Studio drawer
 * (WORKSHOP_GROUPS is the single source of truth, so the rails here and in the
 * nav can never drift). Each rail's gallery does its own data loading; this
 * page renders no previews. It is not a conversational surface (minting is
 * driven from the host agent per the dashboard golden rule).
 *
 * Wears the workshop shell (AuthNav and the breadcrumb bar stand down here);
 * page.jsx resolves the auth flag server-side and hands it down for the
 * strip's sign-out.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import WorkshopShell from '@/components/WorkshopShell';
import { WORKSHOP_GROUPS, hueVars, DOOR_ICONS } from '@/components/workshop-nav';

export default function MakerHubBody({ authEnabled = false }) {
  const t = useTranslations('maker');
  const tHome = useTranslations('home');
  const studio = WORKSHOP_GROUPS.find((g) => g.key === 'studio');

  return (
    <WorkshopShell posture="scroll" width={1040} authEnabled={authEnabled} crumb={tHome('groups.studio')}>
      <div className="w-full px-8 pt-8 pb-12 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100">{t('hub.title')}</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-2xl">{t('hub.subtitle')}</p>

        <div
          style={hueVars(studio.hue)}
          className="mt-8 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-6 sm:p-8"
        >
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-6">
            {studio.tiles.map((tile) => {
              // Tiles name their icon (DOOR_ICONS registry), same as the
              // shell rail and the home directory's door grid.
              const TileIcon = DOOR_ICONS[tile.icon];
              return (
              <Link
                key={tile.href}
                href={tile.href}
                className="ws-tile flex flex-col items-center gap-2.5"
              >
                <div className="ws-tile-box flex items-center justify-center aspect-square w-full max-w-[96px] rounded-xl border bg-[color:var(--background)]">
                  <TileIcon className="h-10 w-10" />
                </div>
                <span className="ws-tile-label text-xs font-medium text-center text-[color:var(--text-secondary)]">
                  {tHome(`tiles.${tile.key}`)}
                </span>
              </Link>
              );
            })}
          </div>
        </div>
      </div>
    </WorkshopShell>
  );
}
