'use client';

/**
 * /motion — gallery of motion artifacts ("Motion Projects").
 *
 * Motions are created via the `forge_motion` MCP tool and filed as Motion
 * Project resource groups (an ops tag binding a subject/recipe stash + each
 * rendered shot). This page is the browse surface: cards grouped by project,
 * each linking to the frame-accurate player at /outcomes/<motion_ref>/.
 *
 * Cards are YouTube-style: a widescreen (16:9) preview on top, title and
 * metadata underneath, three to a row. Previews do NOT auto-play: on a mouse
 * device the animation is loaded only on hover; on a touch device (no hover) it
 * plays on its own. This keeps a wall of motion from animating at once. Since a
 * motion's only assets are themselves animated (the motion.svg flipbook,
 * motion.gif, or motion.mp4) and there's no static first-frame, the un-hovered
 * state shows a placeholder rather than a frozen frame.
 *
 * Renders state; offers no authoring. The operator drives forge_motion from
 * their host agent per the dashboard golden rule.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

// Coarse pointers (touch) can't hover, so previews can't be hover-gated there —
// they play on their own. Fine-pointer (mouse) devices gate playback on hover.
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return coarse;
}

const MOTION_STYLES = {
  turntable: 'border-sky-500 text-sky-300 bg-sky-900/30',
  orbit: 'border-cyan-500 text-cyan-300 bg-cyan-900/30',
  push_in: 'border-violet-500 text-violet-300 bg-violet-900/30',
  dolly_zoom: 'border-fuchsia-500 text-fuchsia-300 bg-fuchsia-900/30',
  flythrough: 'border-emerald-500 text-emerald-300 bg-emerald-900/30',
  deck: 'border-amber-500 text-amber-300 bg-amber-900/30',
  stitch: 'border-rose-500 text-rose-300 bg-rose-900/30',
  motion: 'border-gray-600 text-gray-400 bg-gray-700/40',
};

export default function MotionGalleryPage() {
  const t = useTranslations('motion');
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async (q) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/motion?q=${encodeURIComponent(q || '')}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProjects(data.projects || []);
      setTotal((data.motions || []).length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(query), 200);
    return () => clearTimeout(id);
  }, [load, query]);

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-900">
      <div className="px-8 pt-6 pb-4 max-w-7xl mx-auto">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{t('title')}</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">{t('subtitle')}</p>
          </div>
          <span className="text-sm text-gray-400 shrink-0">{t('total', { count: total })}</span>
        </div>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mt-6">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="mt-6 space-y-10">
          {loading && projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">{t('loading')}</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              {total === 0 && !query ? (
                <div className="space-y-2">
                  <p>{t('empty')}</p>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">{t('emptyHint')}</p>
                </div>
              ) : (
                <p>{t('noMatch')}</p>
              )}
            </div>
          ) : (
            projects.map((p) => (
              <section key={p.tagRef || '__untagged__'}>
                <div className="flex items-baseline gap-2 mb-3 pb-2 border-b border-gray-800">
                  {p.tagRef ? (
                    <span className="text-sm font-semibold text-gray-200">
                      {p.title || t('untitledProject')}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-gray-400 italic">{t('untagged')}</span>
                  )}
                  <span className="text-xs text-gray-500">· {t('shots', { count: p.motions.length })}</span>
                  {p.tagRef && <span className="font-mono text-[10px] text-gray-600">{p.tagRef}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
                  {p.motions.map((m) => (
                    <MotionTile key={m.motionRef} motion={m} t={t} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MotionTile({ motion, t }) {
  const style = MOTION_STYLES[motion.motion] || MOTION_STYLES.motion;
  // Preview asset, in memory order: an mp4 streams + decodes in hardware; a gif
  // is a single decoded loop. The flipbook SVG is the heaviest — every frame
  // lives in the DOM at once — so it's the last resort, used only when a motion
  // shipped nothing else (export:'svg'). This keeps a wall of thumbnails cheap
  // even though the durable artifact for the SVG families is still the .svg.
  const asset = motion.mp4Url || motion.gifUrl || motion.svgUrl;
  const hasVideo = Boolean(motion.mp4Url);

  const coarse = useCoarsePointer();
  const [hovered, setHovered] = useState(false);
  // Active = the animated asset is mounted/playing. Touch devices play always
  // (they can't hover); mouse devices play only while hovered.
  const active = coarse || hovered;

  return (
    <Link
      href={motion.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group flex flex-col"
    >
      {/* Top: widescreen preview. Animates only when active. */}
      <div
        className={`relative aspect-video w-full flex items-center justify-center overflow-hidden rounded-xl border border-gray-700 group-hover:border-teal-500 transition ${
          hasVideo ? 'bg-black' : 'bg-[#fafaf6]'
        }`}
      >
        <MotionPreview motion={motion} asset={asset} hasVideo={hasVideo} active={active} t={t} />
        {!active && asset && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <PlayBadge />
          </span>
        )}
        {motion.frames != null && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-medium text-white/90 pointer-events-none">
            {t('framesLabel', { count: motion.frames })}
          </span>
        )}
      </div>

      {/* Below: title, then smaller metadata line. */}
      <div className="mt-2.5 min-w-0">
        <div className="flex items-start gap-1.5">
          <span
            className={`mt-0.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${style}`}
          >
            {motion.motion}
          </span>
          <h3 className="text-sm font-medium text-gray-100 leading-snug line-clamp-2 group-hover:text-teal-300 transition">
            {motion.title}
          </h3>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
          {motion.fps != null && <span>{t('fpsLabel', { fps: motion.fps })}</span>}
          {motion.fps != null && <span className="text-gray-700">·</span>}
          <span className="font-mono text-[10px] text-gray-600 truncate">{motion.motionRef}</span>
        </div>
      </div>
    </Link>
  );
}

// The animated asset. Mounted only when `active` so previews don't all run at
// once — for an mp4 that means play()/pause() on the <video> (which stays
// mounted, `preload="metadata"` so it isn't buffered until played); for the
// flipbook SVG / GIF it means assigning the <img> src on demand (the only way
// to gate a self-animating raster/DOM asset).
function MotionPreview({ motion, asset, hasVideo, active, t }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [active]);

  if (!asset) {
    return <span className="text-xs text-gray-400">{t('noPreview')}</span>;
  }

  if (hasVideo) {
    return (
      <video
        ref={videoRef}
        src={asset}
        className="max-w-full max-h-full object-contain"
        muted
        loop
        playsInline
        preload="metadata"
      />
    );
  }

  // Flipbook SVG / GIF: only give it a src when active, so it isn't animating
  // (or even loaded) until the user hovers / it's on a touch device.
  return active ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset} alt={motion.title} className="max-w-full max-h-full object-contain" />
  ) : null;
}

function PlayBadge() {
  return (
    <span className="flex items-center justify-center h-9 w-9 rounded-full bg-gray-900/55 text-white/90 border border-white/30 transition group-hover:scale-105 group-hover:bg-gray-900/70">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-[1px]" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}
