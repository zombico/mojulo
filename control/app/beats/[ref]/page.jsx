'use client';

/**
 * /beats/[ref] — the beats STUDIO (B9.2): the canonical home of one musical
 * artifact. Player iframe (grid + playhead + annotate-here live inside it),
 * revision list (play any rev, "what changed" via the musical diff), the
 * annotation panel, WAV export, and copy-revision-prompt.
 *
 * A deliberation surface, not a chat: the studio renders state and captures
 * marks; authoring stays with the operator's host agent (get_beats →
 * update_beats). The copy-revision-prompt affordance is the bridge.
 */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

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

export default function BeatsStudioPage({ params }) {
  const { ref } = use(params);
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

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-gray-300">
        <h1 className="text-xl font-semibold mb-2">{t('notFoundTitle')}</h1>
        <p className="text-sm text-gray-400">{t('notFoundBody', { ref })}</p>
      </div>
    );
  }

  const encRef = encodeURIComponent(ref);
  const playerSrc = `/api/beats/${encRef}${rev ? `?rev=${rev}` : ''}`;
  const wavHref = `/api/beats/${encRef}.wav${rev ? `?rev=${rev}` : ''}`;
  const midHref = `/api/beats/${encRef}.mid${rev ? `?rev=${rev}` : ''}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 text-gray-200">
      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-widest text-gray-500 font-mono">{t('eyebrow')}{meta ? ` · ${meta.kind}` : ''}</p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold text-gray-100">{meta?.title || ref}</h1>
          <span className="text-xs text-gray-500 font-mono">
            {ref}
            {meta?.bpm ? ` · ${meta.bpm} BPM` : ''}
            {meta?.headRev ? ` · ${t('headRev', { rev: meta.headRev })}` : ''}
          </span>
        </div>
      </header>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div>
          <iframe
            src={playerSrc}
            title={meta?.title || ref}
            className="w-full border border-gray-700 rounded-lg bg-[#131320]"
            style={{ aspectRatio: '760 / 720' }}
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={copyRevisionPrompt}
              className="px-3 py-1.5 text-xs border border-amber-700 rounded-md text-amber-300 hover:bg-amber-950"
            >
              {copied ? t('copied') : t('copyRevisionPrompt')}
            </button>
            <a
              href={wavHref}
              className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700"
            >
              {t('exportWav')}
            </a>
            {meta?.kind !== 'beats-sfx' && (
              <a
                href={midHref}
                className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700"
              >
                {t('exportMidi')}
              </a>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">{t('revisions')}</h2>
            {meta?.revisions?.length ? (
              <ol className="space-y-1.5">
                {meta.revisions.map((r) => {
                  const active = rev === r.rev || (rev === null && r.rev === meta.headRev);
                  return (
                    <li key={r.rev} className="text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRev(r.rev === meta.headRev ? null : r.rev)}
                          className={`px-2 py-1 rounded border font-mono ${active ? 'border-teal-500 text-teal-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                        >
                          {t('revN', { rev: r.rev })}
                        </button>
                        <span className="text-gray-400 truncate">{r.note || '—'}</span>
                        {r.rev > 1 && (
                          <button
                            onClick={() => showDiff(r.rev)}
                            className="ml-auto text-[11px] text-gray-500 hover:text-gray-300 whitespace-nowrap"
                          >
                            {t('whatChanged')}
                          </button>
                        )}
                      </div>
                      {diffFor === r.rev && (
                        <ul className="mt-1 ml-2 pl-3 border-l border-gray-700 text-[11px] text-gray-400 space-y-0.5">
                          {(diff || [t('diffLoading')]).map((line, i) => <li key={i}>{line}</li>)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-xs text-gray-500">{t('noRevisions')}</p>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-gray-300">{t('annotations')}</h2>
              <button onClick={load} className="text-[11px] text-gray-500 hover:text-gray-300">{t('refresh')}</button>
            </div>
            {meta?.annotations?.length ? (
              <ul className="space-y-2">
                {meta.annotations.map((a) => (
                  <li
                    key={a.id}
                    className={`text-xs border rounded-md px-2.5 py-2 ${a.status === 'open' ? 'border-amber-800 bg-amber-950/30' : 'border-gray-800 text-gray-500'}`}
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                      <span>#{a.id}</span>
                      <span>{anchorLabel(a.anchor, t)}</span>
                      <span className="ml-auto">{a.status === 'open' ? t('statusOpen') : t('statusResolved', { rev: a.resolvedRev ?? '—' })}</span>
                    </div>
                    <p className="mt-1 leading-snug">{a.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">{t('noAnnotations')}</p>
            )}
            <p className="text-[11px] text-gray-600 mt-2">{t('annotateHint')}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
