'use client';

/**
 * /maker/games — the GAME PROJECTS gallery (game-developer.plan.md GP3): one
 * card per project (title, status, charter hook, role counts), opening the
 * /games/<ref> studio. Not a conversational surface — projects are minted by
 * the host agent (create_game_project); the empty state hands back the
 * starter prompt. Finished games are PLAYED from /arcade; this rail is where
 * they are assembled.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const STARTER_PROMPT =
  "Start a mojulo game project with create_game_project({ title, charter }) — then we can gather its levels, characters, audio, and art in one place and mint the game with create_game({ project_ref }).";

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

function ProjectCard({ project }) {
  const t = useTranslations('gameDev');
  const counts = project.memberCounts || {};
  const countLine = Object.entries(counts)
    .map(([role, n]) => `${n} ${t(`roles.${role}`)}`)
    .join(' · ');
  return (
    <Link
      href={project.url}
      className="group flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-100 group-hover:text-white">{project.title}</h2>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            project.status === 'shipped' ? 'border-emerald-700/60 text-emerald-300' : 'border-neutral-700 text-neutral-400'
          }`}
        >
          {project.status}
        </span>
      </div>
      {project.charter && <p className="line-clamp-2 text-xs text-neutral-400">{project.charter}</p>}
      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-neutral-500">
        <span>{countLine || t('noMembersYet')}</span>
        {project.playable && <span className="text-emerald-400/80">{t('playable')}</span>}
      </div>
    </Link>
  );
}

export default function GameProjectsPage() {
  const t = useTranslations('gameDev');
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/game-projects')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setProjects(body.projects || []);
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
        <h1 className="text-xl font-semibold text-neutral-100">{t('galleryTitle')}</h1>
        <p className="mt-1 text-sm text-neutral-400">{t('gallerySubtitle')}</p>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && projects === null && <p className="text-sm text-neutral-500">{t('loading')}</p>}

      {projects !== null && projects.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center">
          <p className="text-sm text-neutral-400">{t('galleryEmpty')}</p>
          <div className="mt-4 inline-flex">
            <CopyButton value={STARTER_PROMPT} label={t('copyStarterPrompt')} copiedLabel={t('copied')} />
          </div>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.ref} project={p} />
          ))}
        </div>
      )}
    </main>
  );
}
