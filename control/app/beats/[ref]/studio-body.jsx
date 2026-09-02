'use client';

/**
 * /beats/[ref]'s client body — the beats studio proper: player iframe (grid +
 * playhead + annotate-here live inside it), revision list (play any rev, "what
 * changed" via the musical diff), the annotation panel, WAV export, and
 * copy-revision-prompt.
 *
 * A deliberation surface, not a chat: the studio renders state and captures
 * marks; authoring stays with the operator's host agent (get_beats →
 * update_beats). The copy-revision-prompt affordance is the bridge.
 *
 * Blocked per 3d-factory-ui.plan.md §7c: the pinned shell is the one frame —
 * the header band, the player pane and the aside are its regions, meeting at
 * shared hairlines instead of floating in gutters. The player pane is the
 * instrument's screen (the well behind the iframe is `--bay-void`, the render
 * register); the aside partitions into revisions and annotations. The one
 * amber affordance is the copy-revision-prompt — the ask handed to the agent.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import WorkshopShell from '@/components/WorkshopShell';

function anchorLabel(anchor, t) {
  if (!anchor || anchor.scope === 'artifact') return t('anchor.artifact');
  if (anchor.scope === 'track') return t('anchor.track', { track: anchor.track });
  if (anchor.scope === 'cue') return t('anchor.cue', { cue: anchor.cue });
  const parts = [t('anchor.bar', { bar: anchor.bar })];
  if (anchor.step !== undefined) parts.push(t('anchor.step', { step: anchor.step }));
  if (anchor.track) parts.push(anchor.track);
  return parts.join(' · ');
}

function anchorPromptLabel(anchor) {
  if (!anchor || anchor.scope === 'artifact') return 'whole piece';
  if (anchor.scope === 'track') return `track ${anchor.track}`;
  if (anchor.scope === 'cue') return `cue ${anchor.cue}`;
  const parts = [`bar ${anchor.bar}`];
  if (anchor.step !== undefined) parts.push(`step ${anchor.step}`);
  if (anchor.track) parts.push(`track ${anchor.track}`);
  return parts.join(', ');
}

/** Aside section header — the eyebrow register, self-labelling the partition. */
function AsideHeader({ children }) {
  return (
    <header className="flex items-baseline gap-2 border-b border-[color:var(--bay-rail)] px-4 py-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--ink-secondary)]">
        {children}
      </h2>
    </header>
  );
}

export default function BeatsStudioBody({ sketchRef: ref, authEnabled = false }) {
  const t = useTranslations('beatsStudio');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [rev, setRev] = useState(null);           // null = head
  const [diffFor, setDiffFor] = useState(null);   // rev whose "what changed" is open
  const [diff, setDiff] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/beats/${encodeURIComponent(ref)}/meta`);
      if (res.status === 404 || res.status === 422) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setMeta(await res.json());
    } catch (e) {
      setError(e.message);
    }
  }, [ref]);

  useEffect(() => { load(); }, [load]);
  // annotate-here happens inside the player iframe; refresh the panel when the
  // operator comes back to the page chrome.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const showDiff = useCallback(async (r) => {
    if (diffFor === r) { setDiffFor(null); setDiff(null); return; }
    setDiffFor(r);
    setDiff(null);
    try {
      const res = await fetch(`/api/beats/${encodeURIComponent(ref)}/diff?a=${r - 1}&b=${r}`);
      const body = await res.json();
      setDiff(res.ok ? body.summary : [body.error || `HTTP ${res.status}`]);
    } catch (e) {
      setDiff([e.message]);
    }
  }, [ref, diffFor]);

  const openAnnotations = useMemo(
    () => (meta?.annotations || []).filter((a) => a.status === 'open'),
    [meta],
  );

  const copyRevisionPrompt = useCallback(async () => {
    const lines = [
      `Revise the mojulo beats artifact '${ref}'${meta?.title ? ` ("${meta.title}")` : ''}.`,
      `Read it first with get_beats({ ref: '${ref}' }) — the recipe plus the open annotations below —`,
      'then apply the changes with update_beats (set `note` to a revision message, and pass',
      '`resolveAnnotations: [ids]` for the marks the edit answers).',
    ];
    if (openAnnotations.length) {
      lines.push('', 'Open annotations:');
      for (const a of openAnnotations) {
        lines.push(`- [#${a.id}] (${anchorPromptLabel(a.anchor)}) ${a.body}`);
      }
    } else {
      lines.push('', '(No open annotations — describe the change you want.)');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(t('copyFailed'));
    }
  }, [ref, meta, openAnnotations, t]);

  const encRef = encodeURIComponent(ref);
  const playerSrc = `/api/beats/${encRef}${rev ? `?rev=${rev}` : ''}`;
  const wavHref = `/api/beats/${encRef}.wav${rev ? `?rev=${rev}` : ''}`;
  const midHref = `/api/beats/${encRef}.mid${rev ? `?rev=${rev}` : ''}`;

  const body = notFound ? (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 text-xl font-semibold text-[color:var(--ink-primary)]">{t('notFoundTitle')}</h1>
      <p className="text-sm text-[color:var(--ink-secondary)]">{t('notFoundBody', { ref })}</p>
    </div>
  ) : (
    <>
      <header className="moj-part-b px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
          {t('eyebrow')}{meta ? ` · ${meta.kind}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-[color:var(--ink-primary)]">
            {meta?.title || ref}
          </h1>
          <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">
            {ref}
            {meta?.bpm ? ` · ${meta.bpm} BPM` : ''}
            {meta?.headRev ? ` · ${t('headRev', { rev: meta.headRev })}` : ''}
          </span>
        </div>
      </header>
      {error && (
        <p className="moj-part-b px-5 py-2.5 text-[13px] text-[color:var(--fault)]">{error}</p>
      )}

      {/* Below lg the whole column scrolls (the pre-shell reading); at lg the
          shell is the pinned instrument and each pane scrolls on its own. */}
      <div className="flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
        {/* The screen — the player and its key row. One region; the division
            against the aside is a single shared hairline, responsive to which
            side the aside is on. */}
        <div className="flex min-w-0 flex-col border-[color:var(--bay-rail)] max-lg:border-b lg:flex-1 lg:border-r">
          <div className="bg-[color:var(--bay-void)] p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <iframe
              src={playerSrc}
              title={meta?.title || ref}
              className="mx-auto block w-full max-w-[860px] border-0"
              style={{ aspectRatio: '760 / 720' }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--bay-rail)] px-4 py-2.5">
            <button
              onClick={copyRevisionPrompt}
              className="rounded-[var(--radius-control)] border border-[color:var(--forge-idle)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--forge)] transition-colors duration-100 hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10"
            >
              {copied ? t('copied') : t('copyRevisionPrompt')}
            </button>
            <a
              href={wavHref}
              className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-secondary)] transition-colors duration-100 hover:text-[color:var(--ink-primary)]"
            >
              {t('exportWav')}
            </a>
            {meta?.kind !== 'beats-sfx' && (
              <a
                href={midHref}
                className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-secondary)] transition-colors duration-100 hover:text-[color:var(--ink-primary)]"
              >
                {t('exportMidi')}
              </a>
            )}
          </div>
        </div>

        <aside className="flex w-full flex-col lg:w-[340px] lg:shrink-0 lg:overflow-y-auto">
          <section className="moj-part-b">
            <AsideHeader>{t('revisions')}</AsideHeader>
            <div className="px-4 py-3">
              {meta?.revisions?.length ? (
                <ol className="space-y-1.5">
                  {meta.revisions.map((r) => {
                    const active = rev === r.rev || (rev === null && r.rev === meta.headRev);
                    return (
                      <li key={r.rev} className="text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRev(r.rev === meta.headRev ? null : r.rev)}
                            className={`rounded-[var(--radius-control)] border px-2 py-1 font-mono transition-colors duration-100 ${
                              active
                                ? 'border-[color:var(--live)] text-[color:var(--live)]'
                                : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
                            }`}
                          >
                            {t('revN', { rev: r.rev })}
                          </button>
                          <span className="truncate text-[color:var(--ink-secondary)]">{r.note || '—'}</span>
                          {r.rev > 1 && (
                            <button
                              onClick={() => showDiff(r.rev)}
                              className="ml-auto whitespace-nowrap text-[11px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]"
                            >
                              {t('whatChanged')}
                            </button>
                          )}
                        </div>
                        {diffFor === r.rev && (
                          <ul className="ml-2 mt-1 space-y-0.5 border-l border-[color:var(--bay-rail)] pl-3 text-[11px] text-[color:var(--ink-secondary)]">
                            {(diff || [t('diffLoading')]).map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-xs text-[color:var(--ink-muted)]">{t('noRevisions')}</p>
              )}
            </div>
          </section>

          <section className="moj-part-b">
            <header className="flex items-baseline gap-2 border-b border-[color:var(--bay-rail)] px-4 py-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--ink-secondary)]">
                {t('annotations')}
              </h2>
              <button onClick={load} className="font-mono text-[11px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]">
                {t('refresh')}
              </button>
            </header>
            <div className="px-4 py-3">
              {meta?.annotations?.length ? (
                <ul className="space-y-2">
                  {meta.annotations.map((a) => (
                    <li
                      key={a.id}
                      className={`rounded-[var(--radius-card)] border px-2.5 py-2 text-xs ${
                        a.status === 'open'
                          ? 'border-[color:var(--forge-idle)] bg-[color:var(--forge)]/10 text-[color:var(--ink-primary)]'
                          : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                        <span>#{a.id}</span>
                        <span>{anchorLabel(a.anchor, t)}</span>
                        <span className={`ml-auto ${a.status === 'open' ? 'text-[color:var(--forge)]' : ''}`}>
                          {a.status === 'open' ? t('statusOpen') : t('statusResolved', { rev: a.resolvedRev ?? '—' })}
                        </span>
                      </div>
                      <p className="mt-1 leading-snug">{a.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[color:var(--ink-muted)]">{t('noAnnotations')}</p>
              )}
              <p className="mt-2 text-[11px] text-[color:var(--ink-muted)]">{t('annotateHint')}</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );

  return (
    <WorkshopShell posture="pinned" width={1600} crumb={t('eyebrow')} authEnabled={authEnabled}>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
    </WorkshopShell>
  );
}
