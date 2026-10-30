/**
 * align — a line's TEXT TIMED BY ITS RECORDING, when the voice that spoke it said nothing of its timing (a person's
 * narration, a speech engine without timings): the recording's voiced stretches found by its loudness, the text's own
 * pauses (speech.js: a comma's, a sentence's) laid on its longest silences, and each phrase's phonemes spread over the
 * voice's own time in that stretch by the rules' durations (a stressed vowel longest, a reduced one shortest). Coarse
 * beside an engine's own timings (a phrase's phonemes keep the rules' proportions), sure where it counts: the mouth
 * speaks when the voice does and shuts when it stops.
 *
 *   `voicedSpans(samples, rate)`  the recording's voiced stretches, seconds: [[t0, t1]]
 *   `alignText(text, samples, rate)` → { phonemes: [{ p (ARPAbet, its stress digit), t, dur } | { p: 'sil', t, dur }],
 *                                       words: [{ w, t, dur, emph? }] }, seconds from the recording's start
 *   `loudness(samples, rate)`     no text: the voice's loudness at `fps` (0 … 1), { fps, v }, what the mouth opens by
 *
 * Pure and deterministic: arithmetic over the samples.
 */
import { textTimeline } from './speech.js';

/** the analysis: its hop and window (s); voiced when a frame's loudness is `rise` of the way from the floor (the
 * recording's quiet, its `floorAt` quantile) to its peak; a gap under `bridge` s closed, a stretch under `least` s let go;
 * a silence of `pause` s or more a place for the text's pauses, matched to one where it falls `near` the same share of
 * the line (of the voice's time and of the text's), a longer silence (to `long` s) the surer match */
export const ALIGN = Object.freeze({ hop: 0.01, win: 0.025, rise: 0.1, floorAt: 0.1, bridge: 0.06, least: 0.04, pause: 0.1, near: 0.15, long: 0.3 });
/** the loudness envelope's rate (Hz), its normalizing quantile, its curve */
export const LOUDNESS = Object.freeze({ fps: 30, at: 0.95, gamma: 0.7 });

const rmsFrames = (samples, rate, hop, win) => {
  const h = Math.max(1, Math.round(hop * rate)), w = Math.max(h, Math.round(win * rate)), out = [];
  for (let s = 0; s + 1 <= samples.length; s += h) { let e = 0, n = 0; for (let i = s; i < Math.min(samples.length, s + w); i++) { e += samples[i] * samples[i]; n++; } out.push(Math.sqrt(e / Math.max(1, n))); }
  return out;
};
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

/** the recording's voiced stretches, seconds: [[t0, t1]] in time order */
export function voicedSpans(samples, rate) {
  const R = rmsFrames(samples, rate, ALIGN.hop, ALIGN.win), peak = Math.max(0, ...R), floor = quantile(R, ALIGN.floorAt);
  if (!(peak > 0)) return [];
  const thr = floor + ALIGN.rise * (peak - floor), spans = [];
  let start = -1;
  R.forEach((r, i) => { if (r > thr && start < 0) start = i; else if (r <= thr && start >= 0) { spans.push([start, i]); start = -1; } });
  if (start >= 0) spans.push([start, R.length]);
  const merged = [];
  for (const s of spans) { const last = merged.at(-1); if (last && (s[0] - last[1]) * ALIGN.hop < ALIGN.bridge) last[1] = s[1]; else merged.push([...s]); }
  return merged.filter(([a, b]) => (b - a) * ALIGN.hop >= ALIGN.least).map(([a, b]) => [+(a * ALIGN.hop).toFixed(4), +(b * ALIGN.hop).toFixed(4)]);
}

/** a stretch of voiced spans as one timeline: its voiced time u (0 … total) → the recording's time */
const voicedClock = (spans) => {
  const total = spans.reduce((t, [a, b]) => t + (b - a), 0);
  return { total, at: (u) => { let left = u; for (const [a, b] of spans) { if (left <= b - a + 1e-9) return a + left; left -= b - a; } return spans.at(-1)[1]; } };
};

/** A line's text timed by its recording (see the head of the file). */
export function alignText(text, samples, rate) {
  const { segs, words } = textTimeline(text), spans = voicedSpans(samples, rate);
  // (the text's phrases, between its pauses)
  const phrases = [[]];
  for (const g of segs) { if (g.p === 'sil') { if (phrases.at(-1).length) phrases.push([]); } else phrases.at(-1).push(g); }
  if (!phrases.at(-1).length) phrases.pop();
  if (!spans.length || !phrases.length) return { phonemes: segs.map((g) => ({ p: g.p === 'sil' ? 'sil' : `${g.p}${g.stress === null ? '' : g.stress}`, t: +g.t.toFixed(4), dur: +g.dur.toFixed(4) })), words: words.map((w) => ({ ...w, t: +w.t.toFixed(4), dur: +w.dur.toFixed(4) })) };
  // THE PHRASES ON THE SILENCES: each of the text's pauses (at its share of the text's rule time) matched to a silence
  // between voiced stretches (at its share of the voice's time) where they fall near each other, in order, the longer
  // silence the surer (a short comma the voice ran through matches none, and its phrases are spoken as one; a breath
  // the text has no pause for is inside a phrase)
  const voiced = spans.reduce((t, [a, b]) => t + (b - a), 0), lens = phrases.map((ph) => ph.reduce((t, g) => t + g.dur, 0)), textAll = lens.reduce((t, x) => t + x, 0);
  const f = lens.slice(0, -1).map((_, j) => lens.slice(0, j + 1).reduce((t, x) => t + x, 0) / textAll);
  let before = 0;
  const gaps = spans.slice(1).map((s, i) => { before += spans[i][1] - spans[i][0]; return { i, len: s[0] - spans[i][1], g: before / voiced }; }).filter((x) => x.len >= ALIGN.pause);
  const score = (j, x) => { const near = 1 - Math.abs(f[j] - x.g) / ALIGN.near; return near > 0 ? near + 0.5 * Math.min(1, x.len / ALIGN.long) : -Infinity; };
  // (the best ordered matching: best[j][k] over the first j pauses and the first k silences)
  const J = f.length, K = gaps.length, best = Array.from({ length: J + 1 }, () => new Array(K + 1).fill(0)), how = Array.from({ length: J + 1 }, () => new Array(K + 1).fill(0));
  for (let j = 1; j <= J; j++) for (let k = 1; k <= K; k++) {
    const m = best[j - 1][k - 1] + score(j - 1, gaps[k - 1]), a = best[j - 1][k], b = best[j][k - 1];
    if (m > a && m > b) { best[j][k] = m; how[j][k] = 1; } else if (a >= b) { best[j][k] = a; how[j][k] = 2; } else { best[j][k] = b; how[j][k] = 3; }
  }
  const pairs = [];
  for (let j = J, k = K; j > 0 && k > 0;) { if (how[j][k] === 1) { pairs.unshift([j - 1, gaps[k - 1].i]); j--; k--; } else if (how[j][k] === 2) j--; else k--; }
  // (the voice's stretches between the matched silences, and the text's phrases between the matched pauses)
  const groups = [], merged = []; let from = 0, pf = 0;
  for (const [j, i] of pairs) { groups.push(spans.slice(from, i + 1)); from = i + 1; merged.push(phrases.slice(pf, j + 1).flat()); pf = j + 1; }
  groups.push(spans.slice(from)); merged.push(phrases.slice(pf).flat());
  phrases.splice(0, phrases.length, ...merged);
  const out = [], wordAt = new Map();
  phrases.forEach((ph, k) => {
    const clock = voicedClock(groups[k]), R = ph.reduce((t, g) => t + g.dur, 0);
    let u = 0;
    if (k > 0) { const a = groups[k - 1].at(-1)[1], b = groups[k][0][0]; out.push({ p: 'sil', t: +a.toFixed(4), dur: +(b - a).toFixed(4) }); }
    for (const g of ph) {
      const t0 = clock.at((u / R) * clock.total), t1 = clock.at(((u + g.dur) / R) * clock.total); u += g.dur;
      out.push({ p: `${g.p}${g.stress === null || g.stress === undefined ? '' : g.stress}`, t: +t0.toFixed(4), dur: +(t1 - t0).toFixed(4) });
      if (g.word >= 0) { const w = wordAt.get(g.word); wordAt.set(g.word, w ? { t: w.t, end: t1 } : { t: t0, end: t1 }); }
    }
  });
  return { phonemes: out, words: words.map((w, i) => { const at = wordAt.get(i) ?? { t: 0, end: 0 }; return { w: w.w, t: +at.t.toFixed(4), dur: +(at.end - at.t).toFixed(4), ...(w.emph ? { emph: true } : {}) }; }) };
}

/** The voice's loudness at LOUDNESS.fps, 0 … 1 (its `at` quantile the full, eased by `gamma`): { fps, v } */
export function loudness(samples, rate) {
  const R = rmsFrames(samples, rate, 1 / LOUDNESS.fps, 2 / LOUDNESS.fps), top = quantile(R, LOUDNESS.at) || 1;
  return { fps: LOUDNESS.fps, v: R.map((r) => +Math.min(1, (r / top) ** LOUDNESS.gamma).toFixed(3)) };
}
