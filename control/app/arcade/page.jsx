'use client';

/**
 * /arcade — Mojulo Arcade: the menu of playable standalone games
 * (game-developer.plan.md). One cabinet per `game`-bucket sketch; a cabinet
 * launches the standalone shell (/api/sketches/<ref>/game) in a NEW TAB — the
 * game owns its whole window, no dashboard wrapper chrome. The play-facing
 * sibling of the Game Developer studio: the studio is where a game is
 * assembled, the arcade is where finished games are picked and played. Not a
 * conversational surface — minting games stays with the host agent
 * (create_game); the empty state hands back a starter prompt.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const STARTER_PROMPT =
  "Let's build a playable mojulo game: read get_game_vocab for the kits and mechanics, compose promotable level worlds, then mint it with create_game.";

function CopyButton({ value, label, copiedLabel }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — leave the button inert */
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

// The cabinet's marquee band — the game's theme accents as a gradient, so each
// cabinet carries its own color identity without any stored artwork.
function Marquee({ theme }) {
  const accent = theme?.accent || '#334155';
  const accent2 = theme?.accent2 || theme?.accent || '#0f172a';
  return (
    <div
      className="h-16 w-full rounded-t-lg"
      style={{ background: `linear-gradient(120deg, ${accent}, ${accent2})` }}
      aria-hidden="true"
    />
  );
}

function CabinetCard({ cabinet }) {
  const t = useTranslations('arcade');
  return (
    <a
      href={`/api/sketches/${encodeURIComponent(cabinet.ref)}/game`}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/60 transition hover:border-neutral-600"
    >
      <Marquee theme={cabinet.theme} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-100 group-hover:text-white">
            {cabinet.title}
          </h2>
          {cabinet.project && (
            <span
              className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400"
              title={cabinet.project.title}
            >
              {cabinet.project.status === 'shipped' ? t('shipped') : cabinet.project.title}
            </span>
          )}
        </div>
        {cabinet.tagline && <p className="text-xs text-neutral-400">{cabinet.tagline}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-neutral-500">
          <span>{t('levelCount', { count: cabinet.levelCount })}</span>
          <span className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-300 transition group-hover:border-emerald-500/60 group-hover:text-emerald-300">
            {t('play')}
          </span>
        </div>
      </div>
    </a>
  );
}

export default function ArcadePage() {
  const t = useTranslations('arcade');
  const [cabinets, setCabinets] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/arcade')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setCabinets(body.cabinets || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral-400">{t('subtitle')}</p>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && cabinets === null && <p className="text-sm text-neutral-500">{t('loading')}</p>}

      {cabinets !== null && cabinets.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center">
          <p className="text-sm text-neutral-400">{t('emptyState')}</p>
          <div className="mt-4 inline-flex">
            <CopyButton value={STARTER_PROMPT} label={t('copyStarterPrompt')} copiedLabel={t('copied')} />
          </div>
        </div>
      )}

      {cabinets !== null && cabinets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cabinets.map((cabinet) => (
            <CabinetCard key={cabinet.ref} cabinet={cabinet} />
          ))}
        </div>
      )}
    </main>
  );
}
