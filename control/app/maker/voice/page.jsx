'use client';

/**
 * /maker/voice — the Voice shelf: TUNABLE cards for voice registers
 * (kind `voice-register`, voice-worker.plan.md). Unlike its Studio siblings
 * there is nothing to render in-plane — a register is a recipe an EXTERNAL
 * worker speaks — so the card exposes the recipe itself as live knobs: the
 * two axes are sliders, the blend/weights/speed recompute in the browser on
 * every drag (resolveVoiceRegister is pure math), and playback comes from
 * axis-stamped bound samples — the card plays the nearest rendered point,
 * chihaya edge to motoko edge. Tuning never edits the stored register;
 * the copy affordances hand the tuned point back to the host agent, which
 * is where authoring (and re-minting) lives.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { resolveVoiceRegister } from '@/lib/graph/voice/voice-register';

function AxisSlider({ label, leftPole, rightPole, value, onChange, marks }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs text-neutral-400">
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-800 accent-indigo-400"
          aria-label={label}
        />
        {/* Rendered-point marks: the audible spots along this axis. */}
        {marks.map((m) => (
          <span
            key={m}
            className="pointer-events-none absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/80"
            style={{ left: `${m * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-neutral-500">
        <span>{leftPole}</span>
        <span>{rightPole}</span>
      </div>
    </div>
  );
}

function CopyButton({ value, label }) {
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
  const t = useTranslations('maker.voice');
  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
    >
      {copied ? t('copied') : label}
    </button>
  );
}

function speakCommand(resolved) {
  return `cd ~/mojulo-voicegen && venv/bin/python speak.py --text "<line>" --voice "${resolved.voiceArg}" --speed ${resolved.speed} --out line.wav`;
}

function starterPrompt(ref) {
  // Agent-directed text (like the beats studio's prompt builders) — not UI chrome.
  return `Read my mojulo voice register '${ref}' with get_voice and render a spoken line with it through the local voice backend (get_voice_vocab has the worker loop).`;
}

function nearestSample(samples, axes) {
  let best = null;
  let bestDist = Infinity;
  for (const s of samples) {
    const dist = (s.confidence - axes.confidence) ** 2 + (s.depth - axes.depth) ** 2;
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

function RegisterCard({ sketch }) {
  const t = useTranslations('maker.voice');
  const baseAxes = {
    confidence: sketch.manifest?.axes?.confidence ?? 0.5,
    depth: sketch.manifest?.axes?.depth ?? 0,
  };
  const [axes, setAxes] = useState(baseAxes);
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sketches/${encodeURIComponent(sketch.ref)}/voice-samples`)
      .then((res) => (res.ok ? res.json() : { samples: [] }))
      .then((data) => { if (!cancelled) setSamples(data.samples || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sketch.ref]);

  // The live recompute: dragging a slider re-resolves the blend in the
  // browser — pure math over the same module the MCP mint uses. The stored
  // register is never edited from here.
  const resolved = useMemo(() => {
    try {
      return resolveVoiceRegister({ ...sketch.manifest, axes, speed: null });
    } catch {
      return null;
    }
  }, [sketch.manifest, axes]);

  const playable = nearestSample(samples, axes);
  const tunedAway = axes.confidence !== baseAxes.confidence || axes.depth !== baseAxes.depth;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-neutral-100">{sketch.title}</h3>
        <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
          {sketch.manifest?.bank}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-[11px] text-neutral-500">{sketch.ref}</p>
      {resolved ? (
        <>
          <div className="mt-3 space-y-3">
            <AxisSlider
              label={t('axisConfidence')}
              leftPole={t('poleMeek')}
              rightPole={t('poleAuthority')}
              value={axes.confidence}
              onChange={(confidence) => setAxes((a) => ({ ...a, confidence }))}
              marks={[...new Set(samples.map((s) => s.confidence))]}
            />
            <AxisSlider
              label={t('axisDepth')}
              leftPole={t('poleNative')}
              rightPole={t('poleDeep')}
              value={axes.depth}
              onChange={(depth) => setAxes((a) => ({ ...a, depth }))}
              marks={[...new Set(samples.map((s) => s.depth))]}
            />
          </div>
          {tunedAway ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-indigo-300">{t('tuned')}</span>
              <button
                type="button"
                onClick={() => setAxes(baseAxes)}
                className="text-[10px] text-neutral-400 underline decoration-dotted hover:text-neutral-200"
              >
                {t('reset')}
              </button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(resolved.weights).map(([id, w]) => (
              <span key={id} className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
                {id} · {w}
              </span>
            ))}
            <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-neutral-400">
              {t('speed')} {resolved.speed}
            </span>
          </div>
          {sketch.manifest?.direction ? (
            <p className="mt-2 text-xs italic text-neutral-400">“{sketch.manifest.direction}”</p>
          ) : null}
          {playable ? (
            <div className="mt-3">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                {t('playingAt', { c: playable.confidence.toFixed(2), d: playable.depth.toFixed(2) })}
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a bound
                  voice sample is the audio form of the recipe; its text rides
                  the provenance sidecar, not a caption track. */}
              <audio key={playable.url} controls preload="none" src={playable.url} className="h-8 w-full" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">{t('noSamples')}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={resolved.voiceArg} label={t('copyBlend')} />
            <CopyButton value={speakCommand(resolved)} label={t('copyCommand')} />
            <CopyButton value={starterPrompt(sketch.ref)} label={t('copyPrompt')} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-amber-400">{t('unresolvable')}</p>
      )}
    </div>
  );
}

export default function MakerVoicePage() {
  const t = useTranslations('maker.voice');
  const [sketches, setSketches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sketches?bucket=voice');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setSketches(data.sketches || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-neutral-100">{t('title')}</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-400">{t('subtitle')}</p>
      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">{t('loading')}</p>
      ) : error ? (
        <p className="mt-8 text-sm text-red-400">{error}</p>
      ) : sketches.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
          <p className="text-sm text-neutral-400">{t('empty')}</p>
          <div className="mt-3 flex justify-center">
            <CopyButton
              value="Mint a voice register in mojulo with create_voice (read get_voice_vocab first) — start from the jp-female bank."
              label={t('copyPrompt')}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sketches.map((s) => <RegisterCard key={s.ref} sketch={s} />)}
        </div>
      )}
    </div>
  );
}
