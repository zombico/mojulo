/**
 * captions — a read's words as subtitles, on the read's own clock (read.js): a cue a line, or a line too long for two
 * rows split at its words, each part timed by its own first and last word. Out as SRT and WebVTT, the two every engine
 * and player takes.
 *
 *   captionCues(read, { width, rows }) → [{ start, end, text }]   (s; a row at most `width` characters, `rows` a cue)
 *   srt(cues), vtt(cues) → text
 *
 * Pure and deterministic.
 */

/** a cue's rows and their width (characters): the broadcast convention */
export const CAPTION = Object.freeze({ width: 42, rows: 2 });

/** The read's cues: each line, split at its words where it would not fit `rows` rows of `width` */
export function captionCues(read, { width = CAPTION.width, rows = CAPTION.rows } = {}) {
  const cues = [];
  for (const L of read.lines) {
    const words = L.words.length ? L.words : [{ w: L.text, t: L.at, dur: L.end - L.at }];
    // (a line too long for one cue split into as few as it needs, of even length, at its words)
    const len = words.map((w) => w.w).join(' ').length, n = Math.max(1, Math.ceil(len / (width * rows))), target = len / n;
    let part = [], sum = 0;
    const flush = () => { if (!part.length) return; const a = part[0], b = part.at(-1); cues.push({ start: a.t, end: r3(b.t + b.dur), text: wrap(part.map((w) => w.w).join(' '), width) }); part = []; sum = 0; };
    words.forEach((w, i) => {
      part.push(w); sum += w.w.length + 1;
      if (sum >= target && i < words.length - 1) flush();
    });
    flush();
  }
  // (a cue never runs into the next)
  for (let i = 0; i + 1 < cues.length; i++) cues[i].end = Math.min(cues[i].end, cues[i + 1].start);
  return cues;
}

/** SubRip */
export function srt(cues) {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n');
}
/** WebVTT */
export function vtt(cues) {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`;
}

/** words into rows of at most `width` (a word longer than a row keeps its row) */
function wrap(text, width) {
  const rows = [];
  for (const w of text.split(' ')) { const r = rows.at(-1); if (r !== undefined && (r + ' ' + w).length <= width) rows[rows.length - 1] = r + ' ' + w; else rows.push(w); }
  return rows.join('\n');
}
const stamp = (s, sep) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, f = ms % 1000; return `${pad(h, 2)}:${pad(m, 2)}:${pad(sec, 2)}${sep}${pad(f, 3)}`; };
const pad = (n, w) => String(n).padStart(w, '0');
const r3 = (v) => Math.round(v * 1000) / 1000;
