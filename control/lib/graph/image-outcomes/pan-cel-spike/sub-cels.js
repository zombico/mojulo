/**
 * Sub-cels — the talking-mouth + blink primitive (pan-cel-motion.plan.md,
 * "Sub-cels" section). A HELD base cel with tiny regions that swap
 * independently on deterministic schedules: mouth flaps driven by speech
 * spans, blinks by a seeded schedule. The model paints a handful of stills;
 * duration is free.
 *
 * Doctrine: base state (mouth closed, eyes open) is painted INTO the held
 * cel — only non-base states are separate stills. Seeded dice only
 * (mulberry32, the beats doctrine); no Date, no Math.random.
 */

export const MOUTH_VOCAB = {
  closed: { phrase: 'mouth closed, relaxed — the held cel\'s own mouth' },
  mid: { phrase: 'mouth half-open, mid-syllable' },
  open: { phrase: 'mouth open, vowel-wide' },
};

export const BLINK_VOCAB = {
  open: { phrase: 'eyes open — the held cel\'s own eyes' },
  half: { phrase: 'eyelids half-lowered, mid-blink' },
  closed: { phrase: 'eyes fully closed' },
};

export const SUB_CEL_VOCABS = { mouth: MOUTH_VOCAB, blink: BLINK_VOCAB };

export function subCelStates(vocab) {
  const v = SUB_CEL_VOCABS[vocab];
  if (!v) throw new Error(`unknown sub-cel vocab '${vocab}' (one of: ${Object.keys(SUB_CEL_VOCABS).join(', ')})`);
  return Object.keys(v);
}

export function subCelPhrase(vocab, state) {
  const v = SUB_CEL_VOCABS[vocab];
  const entry = v?.[state];
  if (!entry) throw new Error(`unknown ${vocab} state '${state}' (one of: ${Object.keys(v || {}).join(', ')})`);
  return entry.phrase;
}

// The beats kernel's PRNG — deterministic, seedable, tiny.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Speech track → one mouth state per frame. Inside a span the mouth cycles
 * closed→mid→open→mid at flapsPerSec (quantized to fps); outside, closed.
 */
export function resolveMouthTrack({ spans = [], flapsPerSec = 8 }, { fps, frames }) {
  const FLAP_CYCLE = ['closed', 'mid', 'open', 'mid'];
  const states = [];
  for (let f = 0; f < frames; f += 1) {
    const t = f / fps;
    const span = spans.find((s) => t >= s.from && t < s.to);
    if (!span) {
      states.push('closed');
    } else {
      const phase = Math.floor((t - span.from) * flapsPerSec) % FLAP_CYCLE.length;
      states.push(FLAP_CYCLE[phase]);
    }
  }
  return states;
}

/**
 * Blink track → one blink state per frame. Seeded: blink onsets spaced
 * meanGapSec ± half, each blink a half→closed→half envelope scaled to fps
 * (at low fps it degrades gracefully to a single closed frame).
 *
 * `forcedFrames` is the directorial override: a guaranteed blink whose CLOSED
 * phase lands exactly on each named output frame, painted over the seeded
 * schedule (seeded blinks still run — a forced blink is an addition, so
 * re-seeding never moves a directed beat).
 */
export function resolveBlinkTrack({ seed = 1, meanGapSec = 3, forcedFrames = [] }, { fps, frames }) {
  const rand = mulberry32(seed);
  const states = new Array(frames).fill('open');
  const closedFrames = Math.max(1, Math.round(0.1 * fps));
  const halfFrames = fps >= 10 ? 1 : 0;
  const paint = (start) => {
    let f = start;
    for (let i = 0; i < halfFrames && f < frames; i += 1, f += 1) if (f >= 0) states[f] = 'half';
    for (let i = 0; i < closedFrames && f < frames; i += 1, f += 1) if (f >= 0) states[f] = 'closed';
    for (let i = 0; i < halfFrames && f < frames; i += 1, f += 1) if (f >= 0) states[f] = 'half';
  };
  let t = meanGapSec * (0.5 + rand()); // first blink lands mid-shot-ish, seeded
  while (t * fps < frames) {
    paint(Math.round(t * fps));
    t += meanGapSec * (0.5 + rand());
  }
  for (const forced of forcedFrames) paint(Math.round(forced) - halfFrames);
  return states;
}

/**
 * Resolve every sub-cel's track → { [subCelId]: string[] } (one state per
 * frame). Pure function of (manifest.subCels, fps, frames).
 */
export function resolveSubCelTracks(manifest, frames) {
  const fps = manifest.fps;
  const out = {};
  for (const sc of manifest.subCels) {
    const known = subCelStates(sc.vocab);
    let states;
    if (sc.track.kind === 'speech') states = resolveMouthTrack(sc.track, { fps, frames });
    else if (sc.track.kind === 'blink') states = resolveBlinkTrack(sc.track, { fps, frames });
    else throw new Error(`sub-cel '${sc.id}': unknown track kind '${sc.track.kind}' (speech | blink)`);
    for (const s of states) {
      if (!known.includes(s)) throw new Error(`sub-cel '${sc.id}': track emitted unknown state '${s}'`);
    }
    out[sc.id] = states;
  }
  return out;
}

// ── placeholder art (pipeline proof only — a stick bust + glyph states) ──

export function placeholderBustSvg({ width, height, mouthRect, eyesRect }) {
  // base features derive from the manifest rects (rect calibration: the
  // regions are truth; the placeholder face is drawn to them, not vice versa)
  const ec = { x: eyesRect.x + eyesRect.w / 2, y: eyesRect.y + eyesRect.h / 2 };
  const mc = { x: mouthRect.x + mouthRect.w / 2, y: mouthRect.y + mouthRect.h / 2 };
  const cx = (ec.x + mc.x) / 2;
  const cy = ec.y + (mc.y - ec.y) * 0.35;
  const r = Math.max(150, (mc.y - ec.y) + 100);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#1b2432"/>
  <path d="M ${cx - 260} ${height} Q ${cx} ${height - 300} ${cx + 260} ${height} Z" fill="#0f1622" stroke="#f59e0b" stroke-width="8"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0f1622" stroke="#f59e0b" stroke-width="10"/>
  <line x1="${ec.x - eyesRect.w * 0.32}" y1="${ec.y}" x2="${ec.x - eyesRect.w * 0.12}" y2="${ec.y}" stroke="#f59e0b" stroke-width="10" stroke-linecap="round"/>
  <line x1="${ec.x + eyesRect.w * 0.12}" y1="${ec.y}" x2="${ec.x + eyesRect.w * 0.32}" y2="${ec.y}" stroke="#f59e0b" stroke-width="10" stroke-linecap="round"/>
  <line x1="${mc.x - mouthRect.w * 0.28}" y1="${mc.y}" x2="${mc.x + mouthRect.w * 0.28}" y2="${mc.y}" stroke="#f59e0b" stroke-width="9" stroke-linecap="round"/>
</svg>`;
}

const MOUTH_GLYPHS = {
  mid: (w, h) => `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.28}" ry="${h * 0.16}" fill="#0f1622" stroke="#f59e0b" stroke-width="8"/>`,
  open: (w, h) => `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.3}" ry="${h * 0.34}" fill="#0f1622" stroke="#f59e0b" stroke-width="8"/>`,
};

const BLINK_GLYPHS = {
  half: (w, h) => `<path d="M ${w * 0.08} ${h * 0.5} Q ${w * 0.25} ${h * 0.72} ${w * 0.42} ${h * 0.5}" fill="none" stroke="#f59e0b" stroke-width="9" stroke-linecap="round"/><path d="M ${w * 0.58} ${h * 0.5} Q ${w * 0.75} ${h * 0.72} ${w * 0.92} ${h * 0.5}" fill="none" stroke="#f59e0b" stroke-width="9" stroke-linecap="round"/>`,
  closed: (w, h) => `<line x1="${w * 0.08}" y1="${h * 0.5}" x2="${w * 0.42}" y2="${h * 0.5}" stroke="#f59e0b" stroke-width="9" stroke-linecap="round"/><line x1="${w * 0.58}" y1="${h * 0.5}" x2="${w * 0.92}" y2="${h * 0.5}" stroke="#f59e0b" stroke-width="9" stroke-linecap="round"/>`,
};

export function placeholderSubCelSvg({ vocab, state, rect }) {
  const glyphs = vocab === 'mouth' ? MOUTH_GLYPHS : BLINK_GLYPHS;
  const glyph = glyphs[state];
  if (!glyph) throw new Error(`no placeholder glyph for ${vocab}/${state} (base states live in the held cel)`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rect.w} ${rect.h}" width="${rect.w}" height="${rect.h}">
  <rect width="${rect.w}" height="${rect.h}" fill="#0f1622"/>
  ${glyph(rect.w, rect.h)}
</svg>`;
}
