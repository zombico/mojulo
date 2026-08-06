'use client';

/**
 * /games/[ref] — the GAME DEVELOPER studio (game-developer.plan.md GP3): one
 * project's assets behind the workshop tile primitive — icon tabs (the same
 * ws-tile boxes as the /maker hub, studio hue) select a category, the
 * category's assets list below in a centered vertical column, and a MODAL
 * viewer opens one asset in context (world frame, beats player) or shows why
 * it can't. Folders group by what a thing IS: the game manifest's own levels
 * and music merge into Levels/Audio beside bound candidates — provenance is a
 * badge, not a location. The game itself never previews in-page: its tab is a
 * METADATA sheet (store, theme, contents, wiring) and play is a new-tab act.
 *
 * NOT an editor: manifests stay the only source of truth; every authoring
 * affordance is a copy-prompt handed back to the host agent. Read-only,
 * focus-refresh like the beats studio.
 */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import {
  WORKSHOP_GROUPS,
  hueVars,
  GameDevIcon,
  WorldIcon,
  ObjectsIcon,
  BeatsIcon,
  MakerIcon,
  MotionIcon,
  StashIcon,
} from '@/components/workshop-nav';

const FOLDER_ORDER = ['level', 'character', 'audio', 'graphic', 'animation', 'reference'];
const FOLDER_ICONS = {
  game: GameDevIcon,
  level: WorldIcon,
  character: ObjectsIcon,
  audio: BeatsIcon,
  graphic: MakerIcon,
  animation: MotionIcon,
  reference: StashIcon,
};

function CopyButton({ value, label, copiedLabel, subtle = false }) {
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
      className={
        subtle
          ? 'rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200'
          : 'rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white'
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

function StatusChip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-neutral-700 text-neutral-400',
    good: 'border-emerald-700/60 text-emerald-300',
    warm: 'border-amber-700/60 text-amber-300',
    bad: 'border-red-800/60 text-red-400',
    dim: 'border-neutral-800 text-neutral-600',
  };
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

function levelTone(status) {
  return status === 'promoted' ? 'good' : status === 'contract' ? 'warm' : status === 'missing' ? 'bad' : 'neutral';
}

// Which live surface shows an asset in context; null → no inline preview.
function assetSrc(memberKind, kind, ref) {
  if (memberKind !== 'sketch') return null;
  const enc = encodeURIComponent(ref);
  if ((kind || '').startsWith('beats-')) return `/api/beats/${enc}`;
  return `/sketches/${enc}`;
}

export default function GameDeveloperPage({ params }) {
  const { ref } = use(params);
  const t = useTranslations('gameDev');
  const studioHue = WORKSHOP_GROUPS.find((g) => g.key === 'studio').hue;
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('game');
  const [opened, setOpened] = useState(null); // the asset in the modal viewer

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/game-projects/${encodeURIComponent(ref)}/meta`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setMeta(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  // Focus-refresh (beats-studio posture): the agent binds members out-of-band;
  // returning to the tab re-reads the shelf.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Escape closes the viewer modal.
  useEffect(() => {
    if (!opened) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpened(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  const workPrompt = useMemo(
    () =>
      `Read my mojulo game project '${ref}' with get_game_project, then help me advance it — bind new members with bind_to_game_project, or mint/revise its game with create_game({ project_ref: '${ref}' }).`,
    [ref],
  );
  const addPrompt = useCallback(
    (role) =>
      `Read my mojulo game project '${ref}' with get_game_project, then create a new ${role} artifact for it and bind it with bind_to_game_project({ ref: '${ref}', members: [{ ref: '<new ref>', role: '${role}' }] }).`,
    [ref],
  );
  const mintGamePrompt = useMemo(
    () =>
      `Read my mojulo game project '${ref}' with get_game_project, then mint its game: promote the level members with a game: contract channel and call create_game({ ..., project_ref: '${ref}' }).`,
    [ref],
  );

  // ---- Folderize: merge stored members + implied manifest entries by asset
  // context (what it IS), provenance carried as badges. ----
  const folders = useMemo(() => {
    if (!meta) return {};
    const { members, implied } = meta;
    const out = {};

    const fromStored = (m) => ({
      key: `st-${m.id}`,
      ref: m.memberRef,
      title: m.title || m.memberRef,
      label: m.label,
      missing: Boolean(m.missing),
      src: m.missing ? null : assetSrc(m.memberKind, m.kind, m.memberRef),
      badges: [
        ...(m.missing ? [{ text: t('missing'), tone: 'bad' }] : []),
        ...(m.levelStatus && m.levelStatus !== 'missing'
          ? [{ text: t(`levelStatus.${m.levelStatus}`), tone: levelTone(m.levelStatus) }]
          : []),
        ...(m.audioKind ? [{ text: t(`audioKind.${m.audioKind}`), tone: 'neutral' }] : []),
      ],
    });

    for (const role of FOLDER_ORDER) out[role] = (members[role] || []).map(fromStored);

    // Manifest levels not also bound: they belong in the Levels folder — a
    // user looking for "the ground duel level" thinks Levels, not manifests.
    for (const l of implied.levels.filter((x) => !x.alsoStored)) {
      out.level.push({
        key: `imp-l-${l.ref}`,
        ref: l.ref,
        title: l.title,
        missing: false,
        src: `/sketches/${encodeURIComponent(l.ref)}`,
        badges: [
          { text: t('levelStatus.promoted'), tone: 'good' },
          ...(l.gated ? [{ text: t('gated'), tone: 'dim' }] : []),
        ],
      });
    }
    for (const m of implied.music.filter((x) => !x.alsoStored)) {
      out.audio.push({
        key: `imp-m-${m.slot}-${m.ref}`,
        ref: m.ref,
        title: m.ref,
        missing: false,
        src: `/api/beats/${encodeURIComponent(m.ref)}`,
        badges: [{ text: t(`slot.${m.slot}`), tone: 'neutral' }],
      });
    }
    return out;
  }, [meta, t]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-8 py-16 text-center">
        <p className="text-sm text-neutral-400">{t('notFound')}</p>
        <Link href="/maker/games" className="mt-4 inline-block text-sm text-emerald-300 hover:text-emerald-200">
          {t('backToProjects')}
        </Link>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-8 py-16">
        <p className="text-sm text-red-400">{error}</p>
      </main>
    );
  }
  if (!meta) {
    return (
      <main className="mx-auto max-w-3xl px-8 py-16">
        <p className="text-sm text-neutral-500">{t('loading')}</p>
      </main>
    );
  }

  const { project, activeRules } = meta;
  const tabs = ['game', ...FOLDER_ORDER];
  const rows = tab === 'game' ? [] : folders[tab] || [];

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <header className="mb-8 flex flex-wrap items-baseline gap-x-5 gap-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">{project.title}</h1>
        <StatusChip tone={project.status === 'shipped' ? 'good' : 'neutral'}>{project.status}</StatusChip>
        <span className="text-xs text-neutral-600">{project.ref}</span>
        <div className="ml-auto flex items-center gap-3">
          {activeRules && !activeRules.missing && (
            <a
              href={activeRules.playUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-emerald-700/60 px-3 py-1.5 text-xs text-emerald-300 transition hover:border-emerald-500"
            >
              {t('playNewTab')}
            </a>
          )}
          <CopyButton value={workPrompt} label={t('copyWorkPrompt')} copiedLabel={t('copied')} />
        </div>
      </header>

      {project.charter && (
        <p className="mb-10 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-400">
          {project.charter}
        </p>
      )}

      {/* ---- The workshop tile primitive: icon tabs, studio hue. ---- */}
      <div
        style={hueVars(studioHue)}
        className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-6"
      >
        <div className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-7">
          {tabs.map((key) => {
            const Icon = FOLDER_ICONS[key];
            const count = key === 'game' ? null : (folders[key] || []).length;
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="ws-tile flex flex-col items-center gap-2.5"
                aria-pressed={active}
              >
                <div
                  className="ws-tile-box flex aspect-square w-full max-w-[96px] items-center justify-center rounded-xl border bg-[color:var(--background)]"
                  style={active ? { borderColor: 'var(--mode-studio-strong)' } : undefined}
                >
                  <Icon className={`h-9 w-9 ${count === 0 ? 'opacity-40' : ''}`} />
                </div>
                <span className={`ws-tile-label text-center text-xs font-medium ${active ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'}`}>
                  {key === 'game' ? t('gameOverview') : t(`roles.${key}`)}
                  {count !== null && count > 0 && <span className="ml-1 text-neutral-500">{count}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Below the tiles: the active category, one centered column. ---- */}
      <div className="mx-auto mt-10 max-w-2xl">
        {tab === 'game' ? (
          activeRules ? (
            <section>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h2 className="text-xl font-medium text-neutral-100">{activeRules.title}</h2>
                {activeRules.missing && <StatusChip tone="bad">{t('missing')}</StatusChip>}
              </div>
              {activeRules.tagline && (
                <p className="mb-8 text-[15px] leading-relaxed text-neutral-400">{activeRules.tagline}</p>
              )}
              <dl className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">{t('storeLabel')}</dt>
                  <dd className="space-y-1">
                    {(activeRules.store?.slices || []).map((s) => (
                      <div key={s.name} className="flex items-baseline gap-2 text-sm">
                        <span className="text-neutral-200">{s.name}</span>
                        <span className="text-xs text-neutral-500">{s.kind}</span>
                      </div>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">{t('contentsLabel')}</dt>
                  <dd className="space-y-1 text-sm text-neutral-300">
                    <div>{t('levelCountLine', { count: meta.implied.levels.length })}</div>
                    <div>{t('trackCountLine', { count: meta.implied.music.length })}</div>
                  </dd>
                </div>
                {activeRules.theme && (
                  <div>
                    <dt className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">{t('themeLabel')}</dt>
                    <dd className="flex items-center gap-2">
                      {[activeRules.theme.accent, activeRules.theme.accent2].filter(Boolean).map((c) => (
                        <span key={c} className="h-5 w-5 rounded-full border border-neutral-700" style={{ background: c }} title={c} />
                      ))}
                      {activeRules.theme.style && <span className="text-xs text-neutral-500">{activeRules.theme.style}</span>}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">{t('refLabel')}</dt>
                  <dd className="font-mono text-xs text-neutral-500">{activeRules.ref}</dd>
                </div>
              </dl>
              {!activeRules.missing && (
                <div className="mt-10 flex items-center gap-3">
                  <a
                    href={activeRules.playUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-emerald-700/60 px-3 py-1.5 text-xs text-emerald-300 transition hover:border-emerald-500"
                  >
                    {t('playNewTab')}
                  </a>
                </div>
              )}
            </section>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-neutral-600">{t('noRules')}</p>
              <CopyButton value={mintGamePrompt} label={t('copyMintPrompt')} copiedLabel={t('copied')} />
            </div>
          )
        ) : (
          <section>
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t(`roles.${tab}`)}
                <span className="ml-2 text-neutral-700">{rows.length}</span>
              </h2>
              <CopyButton value={addPrompt(tab)} label={t('copyAddPrompt')} copiedLabel={t('copied')} subtle />
            </div>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-neutral-600">{t('emptyFolder')}</p>
                <CopyButton value={addPrompt(tab)} label={t('copyAddPrompt')} copiedLabel={t('copied')} />
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setOpened(row)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-800 px-4 py-3 text-left transition hover:border-neutral-600"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-neutral-200">{row.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-neutral-600">
                        {row.ref}
                        {row.label ? `  ·  ${row.label}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {row.badges.map((b, i) => (
                        <StatusChip key={i} tone={b.tone}>{b.text}</StatusChip>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ---- The viewer: a modal, opened per asset — demo / turntable /
           player by context, or the reason there's nothing to show. ---- */}
      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpened(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-800 px-5 py-3">
              <span className="truncate text-sm text-neutral-200">{opened.title}</span>
              <span className="truncate font-mono text-[10px] text-neutral-600">{opened.ref}</span>
              <span className="ml-auto flex shrink-0 items-center gap-4">
                {opened.src && (
                  <a href={opened.src} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 transition hover:text-white">
                    {t('openNewTab')}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setOpened(null)}
                  className="text-sm text-neutral-500 transition hover:text-white"
                  aria-label={t('closeViewer')}
                >
                  ✕
                </button>
              </span>
            </div>
            {opened.src ? (
              <iframe src={opened.src} title={opened.ref} className="w-full flex-1 border-0" />
            ) : (
              <div className="flex flex-1 items-center justify-center p-12 text-center text-sm leading-relaxed text-neutral-600">
                {opened.missing ? t('missingBody') : t('noPreview')}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
