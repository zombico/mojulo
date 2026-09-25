/**
 * beats-authoring — the compact authoring layer (anthem styles). Pure; no audio.
 *
 * A stored beats recipe stays COMPACT: chord symbols and numerals, a chord
 * chart that parts voice, drum grooves with seeded fills, a global key change,
 * power chords, band templates and composition cue parts are kept as written.
 * `expandBeatsManifest` lowers them to the literal recipe the kernel already
 * plays (events, notes, phrases, rows) — at every read that renders: the WAV
 * and MIDI exports, the player page, a world soundtrack, the feature detector.
 * Nothing here reaches a page as code, so the expansions cost no kernel bytes.
 *
 * A recipe that uses none of them is returned AS IS (the same object): stored
 * recipes render byte-identical. The expansion is deterministic (seeded dice
 * only) and idempotent (its output carries no authoring field).
 */

import { PATCHES } from './audio-patches.js';
import { INSTRUMENTS } from './instruments.js';
import { buildBeatsKernel } from './beats-kernel.js';

// the kernel's pure score clock (addresses → seconds through a tempo map).
let KERNEL = null;
const kernel = () => KERNEL || (KERNEL = buildBeatsKernel());

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const isTime = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0) || (typeof v === 'string' && /^\d+(\.\d+)?(:\d+(\.\d+)?){0,2}$/.test(v));
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0; // + 0: never a -0

// ── pitch helpers ─────────────────────────────────────────────────────────────
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiOf(n) {
  const m = typeof n === 'string' && /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(n);
  if (!m) return null;
  return (Number(m[3]) + 1) * 12 + SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const nameOf = (x) => NAMES[((x % 12) + 12) % 12] + (Math.floor(x / 12) - 1);
const pcOf = (letter, acc) => (SEMI[letter.toUpperCase()] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
function shiftName(n, semis) {
  if (!semis || typeof n !== 'string') return n;
  const x = midiOf(n);
  return x == null ? n : nameOf(x + semis);
}

// ── a meter-aware clock (no tempo: positions in quarters) ────────────────────
// the kernel's scoreClock address math: a bar's length follows `meter` /
// `meters`; the beat is a quarter; a bare number is quarters from the start.
function meterQ(m) { const r = /^(\d+)\/(\d+)$/.exec(String(m || '4/4')); return r ? (4 * r[1]) / r[2] : 4; }
function makeClock(m) {
  const meters = (Array.isArray(m.meters) ? m.meters : []).filter((x) => isObj(x) && Number.isInteger(x.at)).slice().sort((a, b) => a.at - b.at);
  const m0 = meterQ(m.meter);
  const bar = (n) => {
    let q = 0, b = 0, len = m0;
    for (const x of meters) { if (x.at > n) break; q += (x.at - b) * len; b = x.at; len = meterQ(x.meter); }
    return [q + (n - b) * len, len];
  };
  const q = (at) => {
    if (typeof at === 'number') return at;
    const [n = 0, b = 0, s = 0] = String(at).split(':').map(Number);
    return bar(n)[0] + b + s / 4;
  };
  // bars → quarters from the bar where the span starts (fractional bars ok).
  const barQ = (x) => { const n = Math.floor(x); const [q0, len] = bar(n); return q0 + (x - n) * len; };
  return { q, bar, barQ };
}

// ── chord symbols ─────────────────────────────────────────────────────────────
// Intervals above the root, by quality suffix (longest match wins).
export const CHORD_QUALITIES = {
  '': [0, 4, 7], maj: [0, 4, 7], M: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], '-': [0, 3, 7],
  5: [0, 7], dim: [0, 3, 6], '°': [0, 3, 6], aug: [0, 4, 8], '+': [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  mMaj7: [0, 3, 7, 11], dim7: [0, 3, 6, 9], '°7': [0, 3, 6, 9], m7b5: [0, 3, 6, 10], 'ø': [0, 3, 6, 10], 'ø7': [0, 3, 6, 10],
  '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14], 11: [0, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17], 13: [0, 4, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15],
};
const QUALITY_KEYS = Object.keys(CHORD_QUALITIES).sort((a, b) => b.length - a.length);
function parseLetterChord(sym) {
  const m = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m) return null;
  const q = m[3];
  if (!(q in CHORD_QUALITIES)) return null;
  return { root: pcOf(m[1], m[2]), intervals: CHORD_QUALITIES[q].slice(), bass: m[4] ? pcOf(m[4], m[5]) : null };
}

// ── Roman numerals ───────────────────────────────────────────────────────────
// Degrees count from the tonic's MAJOR scale (the borrowed-chord convention:
// in A minor write i, bIII, iv, v, bVI, bVII). Upper case = a major triad,
// lower case = minor; ° dim, ø half-dim, + aug; then an extension (7 on an
// upper numeral is the dominant 7th); '/V' makes it secondary (V/V).
const DEGREE = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
const NUMERAL_RE = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|o|dim|ø|\+)?(maj7|maj9|add9|sus4|sus2|7|9|6|5|11|13)?(?:\/(.+))?$/;
export function parseKey(key) {
  if (typeof key !== 'string') return null;
  const m = /^\s*([A-G])([#b]?)\s*(m|min|minor|maj|major)?\s*$/.exec(key);
  return m ? { tonic: pcOf(m[1], m[2]), minor: !!m[3] && m[3].startsWith('m') && m[3] !== 'maj' && m[3] !== 'major' } : null;
}
function parseNumeral(sym, tonic, depth = 0) {
  const m = NUMERAL_RE.exec(sym);
  if (!m || depth > 2) return null;
  const [, acc, rn, mark, ext, of] = m;
  let base = tonic;
  if (of) {
    const target = parseNumeral(of, tonic, depth + 1);
    if (!target) return null;
    base = target.root;
  }
  const upper = rn === rn.toUpperCase();
  const root = (base + DEGREE[rn.toLowerCase()] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
  let iv;
  if (mark === '°' || mark === 'o' || mark === 'dim') iv = ext === '7' ? [0, 3, 6, 9] : [0, 3, 6];
  else if (mark === 'ø') iv = [0, 3, 6, 10];
  else if (mark === '+') iv = [0, 4, 8];
  else iv = upper ? [0, 4, 7] : [0, 3, 7];
  if (!mark || mark === '+') {
    if (ext === '7') iv.push(10);
    else if (ext === 'maj7') iv.push(11);
    else if (ext === '9') iv.push(10, 14);
    else if (ext === 'maj9') iv.push(11, 14);
    else if (ext === '6') iv.push(9);
    else if (ext === 'add9') iv.push(14);
    else if (ext === '11') iv.push(10, 14, 17);
    else if (ext === '13') iv.push(10, 14, 21);
    else if (ext === 'sus4') iv = [0, 5, 7];
    else if (ext === 'sus2') iv = [0, 2, 7];
    else if (ext === '5') iv = [0, 7];
  }
  return { root, intervals: iv, bass: null };
}
const isNumeral = (sym) => typeof sym === 'string' && /^[b#]?[IViv]/.test(sym);
/** 'Am7' | 'F/G' | 'E5' | 'IV' | 'V/V' → { root, intervals, bass } or null. */
export function parseChord(sym, key) {
  if (typeof sym !== 'string' || !sym.trim()) return null;
  const s = sym.trim();
  if (isNumeral(s)) { const k = parseKey(key); return k ? parseNumeral(s, k.tonic) : null; }
  return parseLetterChord(s);
}
function chordError(sym, key) {
  if (typeof sym !== 'string' || !sym.trim()) return 'must be a chord symbol like "Am7", "F/G", "Csus4", "E5" or a numeral like "IV", "bVII", "V/V"';
  if (isNumeral(sym.trim())) {
    if (!parseKey(key)) return `'${sym}' is a Roman numeral — it needs the recipe's \`key\` (e.g. key: 'E' or 'F#m')`;
    return `'${sym}' is not a numeral this reads (I–VII / i–vii, an optional b/# before, °/ø/+ after, an extension 7 | maj7 | 9 | 6 | add9 | sus4 | sus2 | 5, and /<numeral> for a secondary like V/V)`;
  }
  return `'${sym}' is not a chord symbol (root A–G with #/b, then a quality: ${QUALITY_KEYS.filter((k) => k).sort().join(' ')}; a slash bass like /G)`;
}

// ── voicing ───────────────────────────────────────────────────────────────────
export const VOICINGS = ['close', 'open', 'spread', 'power', 'guitar'];
const DEFAULT_OCTAVE = { close: 3, open: 3, spread: 3, power: 2, guitar: 2 };
function rootMidi(pc, octave) { return (octave + 1) * 12 + pc; }
/** chord → midi numbers in a voicing; `prev` (midi[]) → the nearest voice leading. */
export function voiceChord(ch, { voicing = 'close', octave, prev = null, lead = false } = {}) {
  const oct = Number.isInteger(octave) ? octave : DEFAULT_OCTAVE[voicing] ?? 3;
  let r = rootMidi(ch.root, oct);
  const iv = ch.intervals;
  const third = iv.find((x) => x === 3 || x === 4);
  let notes;
  if (voicing === 'power') notes = [r, r + 7, r + 12];
  else if (voicing === 'guitar') {
    // a barre shape: root, fifth, octave, then the third and the fifth an octave up
    // (a 7th replaces the octave); the root lands on the low strings (E2..D#3).
    while (r < 40) r += 12;
    while (r > 51) r -= 12;
    const sev = iv.find((x) => x === 10 || x === 11);
    notes = [r, r + 7, sev != null ? r + sev : r + 12];
    if (third != null) notes.push(r + 12 + third);
    notes.push(r + 19);
    for (const x of iv) if (x > 12) notes.push(r + 12 + x - 12);
    if (iv.includes(2) || iv.includes(5)) notes.push(r + 12 + (iv.includes(2) ? 2 : 5));
  } else if (voicing === 'open') {
    // root, then the fifth, then everything else an octave up (an open triad).
    notes = [r];
    if (iv.includes(7)) notes.push(r + 7);
    for (const x of iv) if (x !== 0 && x !== 7) notes.push(r + 12 + (x % 12) + (x > 12 ? 12 : 0));
  } else if (voicing === 'spread') {
    // a wide keyboard/strings spread: the root and fifth an octave down, the rest above the root.
    notes = [r - 12];
    if (iv.includes(7)) notes.push(r - 5);
    for (const x of iv) if (x !== 0 && x !== 7) notes.push(r + x);
  } else notes = iv.map((x) => r + x);
  notes = [...new Set(notes)].sort((a, b) => a - b);
  if (lead && prev && prev.length && voicing !== 'power' && voicing !== 'guitar') notes = leadFrom(notes, prev);
  if (ch.bass != null) {
    const lo = notes[0];
    let b = Math.floor(lo / 12) * 12 + ch.bass;
    while (b >= lo) b -= 12;
    notes = [b, ...notes.filter((x) => (x - ch.bass) % 12 !== 0 || x < b)];
  }
  return notes;
}
// nearest voice leading: over the chord's inversions and octave shifts, the
// candidate whose sorted voices move the least total semitones from `prev`.
function leadFrom(notes, prev) {
  const pcs = notes.map((x) => ((x % 12) + 12) % 12);
  const n = notes.length;
  const center = prev.reduce((a, b) => a + b, 0) / prev.length;
  let best = notes, bestD = Infinity;
  for (let inv = 0; inv < n; inv++) {
    const order = pcs.slice(inv).concat(pcs.slice(0, inv));
    for (let base = Math.round(center) - 18; base <= Math.round(center) + 6; base++) {
      if (((base % 12) + 12) % 12 !== order[0]) continue;
      const cand = [base];
      for (let k = 1; k < n; k++) { let x = cand[k - 1] + 1; while (((x % 12) + 12) % 12 !== order[k]) x++; cand.push(x); }
      const d = distance(cand, prev);
      if (d < bestD - 1e-9) { bestD = d; best = cand; }
    }
  }
  return best;
}
export function distance(a, b) {
  // total movement of sorted voices; unequal counts pair each voice with its nearest.
  const A = a.slice().sort((x, y) => x - y), B = b.slice().sort((x, y) => x - y);
  if (A.length === B.length) return A.reduce((s, x, i) => s + Math.abs(x - B[i]), 0);
  return A.reduce((s, x) => s + Math.min(...B.map((y) => Math.abs(x - y))), 0);
}

// ── the chart: a composition `progression` of chords over bars ───────────────
// [ 'Am', ['F', 2], { at?, chords: 'vi IV I V' | [...], bars?, repeat? } ] —
// segments play one after another (an `at` bar jumps). Each chord lasts
// `bars` (default 1; fractional bars are fine).
function chartSegments(prog) {
  const out = [];
  let cursor = 0;
  const push = (sym, bars) => { out.push({ at: cursor, bars, sym }); cursor += bars; };
  for (const e of Array.isArray(prog) ? prog : [prog]) {
    if (typeof e === 'string') { for (const s of e.trim().split(/\s+/)) push(s, 1); continue; }
    if (Array.isArray(e)) { push(e[0], e[1] == null ? 1 : e[1]); continue; }
    if (!isObj(e)) continue;
    if (e.at !== undefined) cursor = e.at;
    const list = typeof e.chords === 'string' ? e.chords.trim().split(/\s+/) : e.chords || [];
    for (let k = 0; k < (e.repeat || 1); k++) list.forEach((s, i) => push(s, Array.isArray(e.bars) ? e.bars[i % e.bars.length] : e.bars == null ? 1 : e.bars));
  }
  return out;
}

// ── rhythms for a chart-voicing part: velocities per sixteenth (wrapping) ───
export const RHYTHMS = {
  whole: [0.85, ...Array(15).fill(0)],
  half: [0.85, 0, 0, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 0, 0],
  quarter: [0.85, 0, 0, 0, 0.7, 0, 0, 0, 0.78, 0, 0, 0, 0.7, 0, 0, 0],
  '8ths': [0.9, 0, 0.66, 0, 0.8, 0, 0.66, 0, 0.86, 0, 0.66, 0, 0.8, 0, 0.66, 0],
  '16ths': [0.9, 0.5, 0.65, 0.5, 0.8, 0.5, 0.65, 0.5, 0.86, 0.5, 0.65, 0.5, 0.8, 0.5, 0.65, 0.5],
  offbeat: [0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0],
  gallop: [0.9, 0, 0.6, 0.6, 0.8, 0, 0.6, 0.6, 0.86, 0, 0.6, 0.6, 0.8, 0, 0.6, 0.6],
  push: [0.9, 0, 0, 0.7, 0, 0, 0.8, 0, 0, 0, 0.75, 0, 0, 0, 0.7, 0],
};
export const CHORD_VOICE_MODES = ['chord', 'strum', 'block', 'upper', 'power', 'root', 'octaves', 'arp'];
function maskOf(r) { return typeof r === 'string' ? RHYTHMS[r] : Array.isArray(r) ? r.map((v) => (v === true ? 0.9 : v === false ? 0 : v)) : RHYTHMS.whole; }
function inBars(bars, x) {
  if (bars == null) return true;
  const list = Array.isArray(bars[0]) ? bars : [bars];
  return list.some(([a, b]) => x >= a - 1e-9 && x < b - 1e-9);
}
// one chart-voicing part → literal tuples [quarter, notes, dur (quarters), vel].
function voicePart(p, chart, clock, key) {
  const mode = p.chordVoice === true ? 'chord' : p.chordVoice;
  const mask = maskOf(p.rhythm);
  const hold = p.hold == null ? 0.92 : p.hold;
  const vs = p.vel == null ? 1 : p.vel;
  const voicing = mode === 'power' ? 'power' : p.voicing || 'close';
  const octave = Number.isInteger(p.octave) ? p.octave : mode === 'root' || mode === 'octaves' ? 2 : undefined;
  const out = [];
  let prev = null, arpI = 0, octI = 0;
  for (const seg of chart) {
    if (!inBars(p.bars, seg.at)) continue;
    const ch = parseChord(seg.sym, key);
    if (!ch) continue;
    const q0 = clock.barQ(seg.at), q1 = clock.barQ(seg.at + seg.bars);
    let full = voiceChord(ch, { voicing, octave, prev, lead: !!p.lead });
    prev = full;
    const rootN = ch.bass != null ? full[0] : rootMidi(ch.root, octave == null ? 2 : octave);
    const hits = [];
    for (let k = Math.ceil(q0 * 4 - 1e-9); k < q1 * 4 - 1e-9; k++) { const v = mask[((k % mask.length) + mask.length) % mask.length]; if (v) hits.push([k / 4, v]); }
    hits.forEach(([q, v], i) => {
      const next = i + 1 < hits.length ? hits[i + 1][0] : q1;
      const d = r6(Math.max(0.0625, (next - q) * hold));
      let notes;
      if (mode === 'root') notes = [rootN];
      else if (mode === 'octaves') notes = [rootN + (octI++ % 2 ? 12 : 0)];
      else if (mode === 'upper') notes = full.length > 1 ? full.slice(1) : full;
      else if (mode === 'arp') { const seq = p.arp === 'down' ? full.slice().reverse() : p.arp === 'updown' ? full.concat(full.slice(1, -1).reverse()) : full; notes = [seq[arpI++ % seq.length]]; }
      else notes = full;
      const ev = [r6(q), notes.length === 1 ? nameOf(notes[0]) : notes.map(nameOf), d, r6(Math.min(1, v * vs))];
      if (p.art !== undefined) ev.push(p.art); // an articulation on every hit (pm chugs, staccato stabs)
      out.push(ev);
    });
  }
  return out;
}

// an event (tuple or object) with a `chord` symbol → the literal event.
function lowerChordEvent(ev, key, state) {
  if (!isObj(ev) || ev.chord === undefined) return ev;
  const ch = parseChord(ev.chord, key);
  if (!ch) return ev;
  const notes = voiceChord(ch, { voicing: ev.voicing || state.voicing || 'close', octave: Number.isInteger(ev.octave) ? ev.octave : state.octave, prev: state.prev, lead: state.lead });
  state.prev = notes;
  const n = notes.map(nameOf);
  const { chord, voicing, octave, ...rest } = ev;
  if (rest.art !== undefined || rest.dyn !== undefined) return { ...rest, n };
  // a plain tuple keeps the recipe off the score substrate when nothing else needs it.
  const t = [rest.at, n];
  if (rest.d != null || rest.v != null) t.push(rest.d == null ? null : rest.d);
  if (rest.v != null) t.push(rest.v);
  return t;
}

// ── grooves and fills (drums) ─────────────────────────────────────────────────
// A kit part's `groove` { style, bars, fills?, crash?, vel?, seed? } (or a list
// of them — each entry starts a section) lowers to literal hits: GM drum notes,
// one sixteenth long, seeded velocity breath. Fills are chosen per (seed, bar)
// from a small vocabulary, so the same seed plays the same fills. Explicit
// events in a bar win from their first onset on (a written fill replaces the
// generated one). Notes a kit lacks fall back (ride → hat, crash → open hat).
export const GROOVE_STYLES = ['eight-beat', 'sixteen-beat', 'four-floor', 'half-time', 'trance-drive', 'rock-drive', 'double-time-chorus', 'blast'];
export const FILL_KINDS = ['tom-run', 'snare-16ths', 'flam-build', 'roll-32', 'unison-8ths'];
const FILLS_EVERY = ['every-2', 'every-4', 'every-8', 'section', 'none'];
const CRASH_AT = ['section', 'fills', 'both', 'none'];
const K = 36, S = 38, H = 42, P = 44, O = 46, C = 49, R = 51, T1 = 48, T2 = 45, T3 = 41;
const at8 = [0, 2, 4, 6, 8, 10, 12, 14], at16 = [...Array(16).keys()], beats = [0, 4, 8, 12], offs = [2, 6, 10, 14];
// step → [note, velocity] per style (one 4/4 bar of sixteenths).
const STYLE = {
  'eight-beat': () => [...at8.map((i) => [i, H, i % 4 ? 0.55 : 0.8]), [0, K, 0.95], [8, K, 0.9], [10, K, 0.7], [4, S, 0.9], [12, S, 0.92]],
  'sixteen-beat': () => [...at16.map((i) => [i, H, i % 4 === 0 ? 0.75 : i % 2 ? 0.38 : 0.55]), [0, K, 0.95], [6, K, 0.72], [8, K, 0.9], [11, K, 0.6], [4, S, 0.9], [12, S, 0.92], [7, S, 0.22], [15, S, 0.2]],
  'four-floor': () => [...beats.map((i) => [i, K, i ? 0.9 : 0.98]), [4, S, 0.85], [12, S, 0.88], ...offs.map((i) => [i, O, 0.7])],
  'half-time': () => [...at8.map((i) => [i, H, i % 4 ? 0.5 : 0.75]), [0, K, 0.95], [10, K, 0.75], [8, S, 0.95]],
  'trance-drive': () => [...beats.map((i) => [i, K, 0.95]), [4, S, 0.82], [12, S, 0.86], ...offs.map((i) => [i, O, 0.72]), ...at16.filter((i) => i % 2).map((i) => [i, H, 0.34])],
  'rock-drive': () => [...at8.filter((i) => i !== 14).map((i) => [i, H, i % 4 ? 0.55 : 0.8]), [14, O, 0.75], [0, K, 0.95], [6, K, 0.8], [8, K, 0.9], [4, S, 0.92], [12, S, 0.94]],
  'double-time-chorus': () => [...beats.map((i) => [i, K, 0.92]), ...offs.map((i) => [i, S, 0.9]), ...at8.map((i) => [i, R, i % 4 ? 0.55 : 0.75])],
  blast: () => [...at8.map((i) => [i, K, 0.9]), ...at8.map((i) => [i + 1, S, 0.85]), ...at8.map((i) => [i, R, 0.6])],
};
// fill kinds: [step, note, velocity] over the fill span (from `from` to 16).
function fillHits(kind, from) {
  const out = [];
  const n = 16 - from;
  if (kind === 'tom-run') { const toms = [T1, T1, T2, T2, T3, T3, T3, K]; for (let k = 0; k < n; k++) out.push([from + k, toms[Math.floor((k * toms.length) / n)], 0.72 + (0.26 * k) / Math.max(1, n - 1)]); }
  else if (kind === 'snare-16ths') for (let k = 0; k < n; k++) out.push([from + k, S, 0.45 + (0.55 * k) / Math.max(1, n - 1)]);
  else if (kind === 'flam-build') for (let k = 0; k < n; k += 2) { out.push([from + k - 0.12, S, 0.35]); out.push([from + k, S, 0.7 + (0.3 * k) / Math.max(1, n - 1)]); }
  else if (kind === 'roll-32') for (let k = 0; k < n * 2; k++) out.push([from + k / 2, S, 0.3 + (0.7 * k) / Math.max(1, n * 2 - 1)]);
  else if (kind === 'unison-8ths') for (let k = 0; k < n; k += 2) { out.push([from + k, K, 0.9]); out.push([from + k, S, 0.8 + (0.2 * k) / Math.max(1, n - 1)]); }
  return out;
}
const FILL_FROM = { 'tom-run': 8, 'snare-16ths': 12, 'flam-build': 8, 'roll-32': 12, 'unison-8ths': 8 };
const FALLBACK = { 51: 42, 49: 46, 46: 42, 44: 42, 43: 41, 47: 45, 50: 48, 52: 49, 55: 49, 57: 49 };
// `only` / `drop` pick pieces by family (a kick part to duck by, the rest on another part).
export const GROOVE_PIECES = ['kick', 'snare', 'hat', 'ride', 'crash', 'tom'];
const PIECE_OF = { 36: 'kick', 38: 'snare', 42: 'hat', 44: 'hat', 46: 'hat', 51: 'ride', 49: 'crash', 48: 'tom', 45: 'tom', 41: 'tom' };
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(seed, n) {
  let h = (seed >>> 0) ^ 0x9E3779B9;
  h = Math.imul(h ^ (n >>> 0), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  return (h ^ (h >>> 16)) >>> 0;
}
const strSeed = (seed, s) => [...String(s)].reduce((h, c) => hashSeed(h, c.charCodeAt(0)), seed >>> 0);
function grooveList(g) { return (Array.isArray(g) ? g : [g]).filter(isObj); }
function barsOf(e) { return Array.isArray(e.bars) ? e.bars : [0, Number.isInteger(e.bars) ? e.bars : 1]; }
// one kit part's groove → literal tuples [quarter, note, 0.25, vel].
function groovePart(p, m, clock) {
  const kit = kitOf(p) || {};
  const has = (n) => !!kit[n];
  const pick = (n) => (has(n) ? n : has(FALLBACK[n]) ? FALLBACK[n] : null);
  const entries = grooveList(p.groove);
  const out = [];
  const name = nameOf;
  entries.forEach((e) => {
    const [from, to] = barsOf(e);
    const seed = Number.isInteger(e.seed) ? e.seed : strSeed(hashSeed(m.seed || 1, 0x6007E), p.name);
    const vs = e.vel == null ? 1 : e.vel;
    const every = e.fills === 'every-2' ? 2 : e.fills === 'every-4' ? 4 : e.fills === 'every-8' ? 8 : 0;
    const fillBars = new Set();
    for (let b = from; b < to; b++) if ((every && (b - from + 1) % every === 0) || ((e.fills === 'section') && b === to - 1)) fillBars.add(b);
    const crashes = new Set();
    if (e.crash === 'section' || e.crash === 'both') crashes.add(from);
    if (e.crash === 'fills' || e.crash === 'both') for (const b of fillBars) if (b + 1 < to) crashes.add(b + 1);
    for (let b = from; b < to; b++) {
      const [q0, len] = clock.bar(b);
      const steps = Math.round(len * 4);
      const rng = mulberry32(hashSeed(seed, b + 1));
      let hits = STYLE[e.style]().filter(([i]) => i < steps);
      if (fillBars.has(b)) {
        const kind = e.fill || FILL_KINDS[Math.floor(mulberry32(hashSeed(seed ^ 0xF111, b))() * FILL_KINDS.length)];
        // the fill ends the bar: it takes its usual span (or the whole bar, if shorter).
        const span = Math.min(16 - FILL_FROM[kind], steps), start = steps - span;
        hits = hits.filter(([i]) => i < start).concat(fillHits(kind, 16 - span).map(([i, n, v]) => [i - 16 + steps, n, v]));
      }
      if (crashes.has(b)) { hits = hits.filter(([i, n]) => !(i === 0 && (n === H || n === O || n === R))); hits.push([0, C, 0.95]); if (!hits.some(([i, n]) => i === 0 && n === K)) hits.push([0, K, 0.95]); }
      hits.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
      for (const [i, n, v] of hits) {
        const note = pick(n);
        if (note == null || q0 + i / 4 < 0) continue;
        if (e.only && !e.only.includes(PIECE_OF[n])) continue;
        if (e.drop && e.drop.includes(PIECE_OF[n])) continue;
        const vel = Math.max(0.05, Math.min(1, v * vs * (1 + (rng() * 2 - 1) * 0.06)));
        out.push([r6(q0 + i / 4), name(note), 0.25, r6(vel)]);
      }
    }
  });
  return out;
}
function mergeExplicit(explicit, gen, clock) {
  // a bar with written events keeps the generated hits only before its first written onset.
  const firstIn = new Map();
  for (const ev of explicit) {
    const at = Array.isArray(ev) ? ev[0] : isObj(ev) ? ev.at : undefined;
    if (!isTime(at)) continue;
    const q = clock.q(at);
    let b = 0;
    while (clock.bar(b + 1)[0] <= q + 1e-9) b++;
    if (!firstIn.has(b) || q < firstIn.get(b)) firstIn.set(b, q);
  }
  if (!firstIn.size) return explicit.concat(gen);
  return explicit.concat(gen.filter((e) => {
    let b = 0;
    while (clock.bar(b + 1)[0] <= e[0] + 1e-9) b++;
    return !firstIn.has(b) || e[0] < firstIn.get(b) - 1e-9;
  }));
}

// ── modulate: a key change from a bar on ─────────────────────────────────────
function modulationAt(mods, clock) {
  const pts = mods.map((x) => ({ q: clock.q(x.at), s: x.semitones })).sort((a, b) => a.q - b.q);
  return (q) => pts.reduce((s, p) => (q >= p.q - 1e-9 ? s + p.s : s), 0);
}

// ── teaching errors for the authoring fields (before expansion) ──────────────
function checkChordField(sym, where, key, errors) {
  if (!parseChord(sym, key)) errors.push(`${where}: ${chordError(sym, key)}`);
}
function checkVoiceOpts(o, where, errors) {
  if (o.voicing !== undefined && !VOICINGS.includes(o.voicing)) errors.push(`${where}.voicing must be one of: ${VOICINGS.join(', ')}`);
  if (o.octave !== undefined && !(Number.isInteger(o.octave) && o.octave >= 0 && o.octave <= 7)) errors.push(`${where}.octave must be an integer in [0, 7] (where the chord's root sits)`);
  if (o.lead !== undefined && typeof o.lead !== 'boolean') errors.push(`${where}.lead must be true | false (nearest voice leading from the previous chord)`);
}
function checkEventChords(list, where, key, errors) {
  (Array.isArray(list) ? list : []).forEach((ev, j) => {
    if (!isObj(ev) || ev.chord === undefined) return;
    const w = `${where}[${j}]`;
    if (ev.n !== undefined) errors.push(`${w}: give n (notes) OR chord (a symbol), not both`);
    checkChordField(ev.chord, `${w}.chord`, key, errors);
    checkVoiceOpts(ev, w, errors);
  });
}
function checkChart(prog, key, errors) {
  if (!Array.isArray(prog) && typeof prog !== 'string') { errors.push("progression must be a chord chart: ['Am', 'F', ['C', 2], { chords: 'vi IV I V', bars?: 1, repeat?: 2, at?: bar }] (one chord per bar by default)"); return; }
  (Array.isArray(prog) ? prog : [prog]).forEach((e, i) => {
    const w = `progression[${i}]`;
    if (typeof e === 'string') { for (const s of e.trim().split(/\s+/)) checkChordField(s, w, key, errors); return; }
    if (Array.isArray(e)) { checkChordField(e[0], `${w}[0]`, key, errors); if (e[1] !== undefined && !(Number.isFinite(e[1]) && e[1] > 0)) errors.push(`${w}[1] must be a length in bars (> 0)`); return; }
    if (!isObj(e)) { errors.push(`${w} must be a chord, [chord, bars] or { chords, bars?, repeat?, at? }`); return; }
    const list = typeof e.chords === 'string' ? e.chords.trim().split(/\s+/) : e.chords;
    if (!Array.isArray(list) || !list.length) errors.push(`${w}.chords must be a chord list: 'vi IV I V' or ['Am', 'F']`);
    else list.forEach((s, k) => checkChordField(s, `${w}.chords[${k}]`, key, errors));
    if (e.bars !== undefined && !([].concat(e.bars).every((b) => Number.isFinite(b) && b > 0))) errors.push(`${w}.bars must be bars per chord (> 0), or a list of them`);
    if (e.repeat !== undefined && !(Number.isInteger(e.repeat) && e.repeat >= 1 && e.repeat <= 64)) errors.push(`${w}.repeat must be an integer in [1, 64]`);
    if (e.at !== undefined && !(Number.isFinite(e.at) && e.at >= 0)) errors.push(`${w}.at must be a bar number (≥ 0)`);
  });
}
function checkBars(bars, where, errors) {
  if (bars === undefined) return;
  const list = Array.isArray(bars) && Array.isArray(bars[0]) ? bars : [bars];
  if (!list.every((r) => Array.isArray(r) && r.length === 2 && r.every((x) => Number.isFinite(x) && x >= 0) && r[1] > r[0])) errors.push(`${where}.bars must be [from, to) bars, or a list of them ([[0, 8], [16, 24]])`);
}
export const SWEEP_PARAMS = { tone: [0, 1, 'the tone macro: 1 open, 0 dark (120 Hz)'], lowcut: [20, 12000, 'Hz of a highpass (20 = open)'], level: [-80, 12, 'dB'], send: [0, 1, 'the room send'], pan: [-1, 1, '−1 left … 1 right'] };
function checkSweeps(m, errors) {
  if (!Array.isArray(m.sweeps) || !m.sweeps.length) { errors.push("sweeps must be [{ row, param, from, to, at, over, curve? }] — a ramp over bars (e.g. { row: 'pad', param: 'tone', from: 1, to: 0.2, at: '32:0:0', over: '8:0:0' })"); return; }
  const rows = new Set((m.parts || []).filter(isObj).map((p) => p.name));
  m.sweeps.forEach((w, i) => {
    const x = `sweeps[${i}]`;
    if (!isObj(w)) { errors.push(`${x} must be { row, param, from, to, at, over, curve? }`); return; }
    if (w.row !== 'master' && !rows.has(w.row)) errors.push(`${x}.row '${w.row}' is not a part of this recipe (or 'master', the whole mix)`);
    const P = SWEEP_PARAMS[w.param];
    if (!P) errors.push(`${x}.param must be one of: ${Object.keys(SWEEP_PARAMS).join(', ')}`);
    else {
      if (w.row === 'master' && (w.param === 'send' || w.param === 'pan')) errors.push(`${x}: the master sweeps tone, lowcut or level`);
      for (const k of ['from', 'to']) if (!(Number.isFinite(w[k]) && w[k] >= P[0] && w[k] <= P[1])) errors.push(`${x}.${k} must be in [${P[0]}, ${P[1]}] (${P[2]})`);
      if (w.param === 'send') { const r = (m.parts || []).find((p) => isObj(p) && p.name === w.row); if (!m.room || !r || r.send === undefined) errors.push(`${x}: a send sweep rides the row's room send — give the part a \`send\` and the recipe a \`room\``); }
    }
    if (!isTime(w.at)) errors.push(`${x}.at must be "bar:beat:sixteenth" or beats (where the ramp starts)`);
    if (!isTime(w.over) || w.over === 0 || w.over === '0:0:0') errors.push(`${x}.over must be a length ("8:0:0") or beats, > 0 (how long the ramp takes)`);
    if (w.curve !== undefined && w.curve !== 'linear' && w.curve !== 'exp') errors.push(`${x}.curve must be 'exp' (default: even in pitch / dB) or 'linear'`);
  });
}
function checkGroove(p, w, errors) {
  const list = Array.isArray(p.groove) ? p.groove : [p.groove];
  if (!list.length || !list.every(isObj)) { errors.push(`${w}.groove must be { style, bars, fills?, crash? } or a list of them (each entry starts a section)`); return; }
  if (!kitOf(p)) errors.push(`${w}.groove needs a drum kit part (instrument drum-kit, stadium-kit, acoustic-kit, drum-machine-909 …): its hits are GM drum notes`);
  list.forEach((e, i) => {
    const g = list.length > 1 ? `${w}.groove[${i}]` : `${w}.groove`;
    if (!GROOVE_STYLES.includes(e.style)) errors.push(`${g}.style must be one of: ${GROOVE_STYLES.join(', ')}`);
    const b = e.bars;
    if (!(Number.isInteger(b) && b >= 1) && !(Array.isArray(b) && b.length === 2 && b.every((x) => Number.isInteger(x) && x >= 0) && b[1] > b[0])) errors.push(`${g}.bars must be [from, to) bars (e.g. [8, 24]) or a count from bar 0`);
    if (e.fills !== undefined && !FILLS_EVERY.includes(e.fills)) errors.push(`${g}.fills must be one of: ${FILLS_EVERY.join(', ')} (section = the last bar before the next section)`);
    if (e.fill !== undefined && !FILL_KINDS.includes(e.fill)) errors.push(`${g}.fill must be one of: ${FILL_KINDS.join(', ')} (omit it for a seeded choice per bar)`);
    if (e.crash !== undefined && !CRASH_AT.includes(e.crash)) errors.push(`${g}.crash must be one of: ${CRASH_AT.join(', ')} (section = a crash on the section's downbeat; fills = after each fill)`);
    if (e.vel !== undefined && !(Number.isFinite(e.vel) && e.vel > 0 && e.vel <= 2)) errors.push(`${g}.vel must be a velocity scale in (0, 2]`);
    if (e.seed !== undefined && !(Number.isInteger(e.seed) && e.seed >= 0)) errors.push(`${g}.seed must be a non-negative integer (the fills' dice)`);
    for (const k of ['only', 'drop']) if (e[k] !== undefined && !(Array.isArray(e[k]) && e[k].length && e[k].every((x) => GROOVE_PIECES.includes(x)))) errors.push(`${g}.${k} must be a list of pieces: ${GROOVE_PIECES.join(', ')} (e.g. only: ['kick'] for a part to duck by)`);
  });
}
export function checkAuthoring(m, errors) {
  if (!isObj(m)) return;
  // a timed gesture takes dur (seconds) OR bars / beats (at the recipe's tempo).
  for (const [i, r] of (m.parts || m.tracks || []).entries()) {
    const list = isObj(r) ? cueList(r) : null;
    if (Array.isArray(list)) list.forEach((g, j) => { if (isObj(g) && g.dur !== undefined && (g.bars !== undefined || g.beats !== undefined)) errors.push(`${m.parts ? 'parts' : 'tracks'}[${i}].${r.cue !== undefined ? `cue[${j}]` : 'gesture'}: give dur (seconds) OR bars / beats, not both`); });
  }
  const key = m.key;
  const comp = m.kind === 'beats-composition';
  if (comp) {
    for (const [name, list] of Object.entries(isObj(m.phrases) ? m.phrases : {})) checkEventChords(list, `phrases.${name}`, key, errors);
    if (m.progression !== undefined) checkChart(m.progression, key, errors);
    if (m.modulate !== undefined) {
      if (!Array.isArray(m.modulate) || !m.modulate.length) errors.push("modulate must be [{ at, semitones }] — a key change from `at` on (e.g. [{ at: '64:0:0', semitones: 1 }])");
      else m.modulate.forEach((x, i) => {
        if (!isObj(x) || !isTime(x.at)) errors.push(`modulate[${i}].at must be "bar:beat:sixteenth" or beats`);
        if (!isObj(x) || !(Number.isInteger(x.semitones) && x.semitones !== 0 && Math.abs(x.semitones) <= 12)) errors.push(`modulate[${i}].semitones must be a whole number of semitones in [-12, 12], not 0`);
      });
    }
    if (m.sweeps !== undefined) checkSweeps(m, errors);
    if (m.band !== undefined && !BANDS[m.band]) errors.push(`band must be one of: ${Object.keys(BANDS).join(', ')} (a mix template: pan, send and trim per role, a room, the rhythm guitars double-tracked)`);
    (Array.isArray(m.parts) ? m.parts : []).forEach((p, i) => {
      if (!isObj(p)) return;
      const w = `parts[${i}]`;
      checkEventChords(p.events, `${w}.events`, key, errors);
      if (p.chordVoice !== undefined) {
        if (p.chordVoice !== true && !CHORD_VOICE_MODES.includes(p.chordVoice)) errors.push(`${w}.chordVoice must be one of: ${CHORD_VOICE_MODES.join(', ')} (or true = chord)`);
        if (m.progression === undefined) errors.push(`${w}.chordVoice reads the chart: add a manifest-level progression (e.g. ['Am', 'F', 'C', 'G'] or [{ chords: 'vi IV I V', repeat: 4 }])`);
        if (p.rhythm !== undefined && !(typeof p.rhythm === 'string' ? RHYTHMS[p.rhythm] : Array.isArray(p.rhythm) && p.rhythm.length && p.rhythm.every((v) => v === true || v === false || (Number.isFinite(v) && v >= 0 && v <= 1)))) errors.push(`${w}.rhythm must be a name (${Object.keys(RHYTHMS).join(', ')}) or velocities per sixteenth, wrapping`);
        if (p.hold !== undefined && !(Number.isFinite(p.hold) && p.hold > 0 && p.hold <= 1)) errors.push(`${w}.hold must be in (0, 1] (how much of the gap to the next hit a hit holds; \`gate\` stays the trance gate)`);
        if (p.vel !== undefined && !(Number.isFinite(p.vel) && p.vel > 0 && p.vel <= 2)) errors.push(`${w}.vel must be a velocity scale in (0, 2]`);
        if (p.arp !== undefined && !['up', 'down', 'updown'].includes(p.arp)) errors.push(`${w}.arp must be 'up', 'down' or 'updown'`);
        checkVoiceOpts(p, w, errors);
        checkBars(p.bars, w, errors);
      } else for (const k of ['rhythm', 'arp', 'art', 'hold']) if (p[k] !== undefined) errors.push(`${w}.${k} belongs to a chart-voicing part (set chordVoice)`);
      if (p.modulate !== undefined && p.modulate !== false) errors.push(`${w}.modulate may only be false (this part ignores the key change)`);
      if (p.groove !== undefined) checkGroove(p, w, errors);
      if (p.double !== undefined) {
        if (!(typeof p.double === 'boolean' || (isObj(p.double) && (p.double.offset === undefined || (Number.isFinite(p.double.offset) && p.double.offset >= 3 && p.double.offset <= 60)) && (p.double.pan === undefined || (Number.isFinite(p.double.pan) && Math.abs(p.double.pan) <= 1))))) errors.push(`${w}.double must be true | false or { offset?: ms in [3, 60], pan?: −1..1 } (a second take, mirrored and a little late)`);
        else if (p.double && (kitOf(p) || isCuePart(p))) errors.push(`${w}.double is for a pitched part (the rhythm guitars), not a kit or a cue part`);
      }
      if (p.power !== undefined) {
        if (typeof p.power !== 'boolean') errors.push(`${w}.power must be true | false (every single note becomes root + fifth + octave)`);
        else if (p.power && (kitOf(p) || isCuePart(p))) errors.push(`${w}.power is for a pitched part (a guitar), not a kit or a cue part`);
      }
    });
  } else {
    for (const k of ['modulate', 'sweeps', 'band']) if (m[k] !== undefined) errors.push(`${k} is a beats-composition field (${k === 'modulate' ? 'a key change over a score' : k === 'band' ? 'a mix template over a score\'s parts' : 'ramps over a score\'s bars'})`);
    for (const r of m.tracks || m.channels || []) if (isObj(r) && r.groove !== undefined) errors.push(`'${r.name}'.groove is a beats-composition part field (a pattern IS its groove: write the mask)`);
  }
  if (m.kind === 'beats-pattern' && isObj(m.chords)) {
    for (const [name, v] of Object.entries(m.chords)) if (typeof v === 'string') checkChordField(v, `chords.${name}`, key, errors);
    checkVoiceOpts(m, 'pattern', errors);
  }
}

// ── which authoring fields a manifest uses ────────────────────────────────────
// A part with `cue` / `gesture` fires it at each event. Events may be a time,
// { at, v?, d? }, or a tuple [at, _, dur?, vel?]; they lower to plain tuples
// [at, 'C4', dur, vel] (the note is a placeholder: the transport plays the cue).
export const CUE_NOTE = 'C4';
export function isCuePart(p) {
  return isObj(p) && (p.cue !== undefined || p.gesture !== undefined);
}
function cueEvent(ev, lenBeats) {
  // a cue whose gestures run long (a 4-bar riser) holds its event that long,
  // so a riser at the end of a song still fits the render.
  const dflt = lenBeats > 1 ? r6(lenBeats) : null;
  if (typeof ev === 'number' || typeof ev === 'string') return dflt ? [ev, CUE_NOTE, dflt] : [ev, CUE_NOTE];
  if (Array.isArray(ev) || isObj(ev)) {
    const at = Array.isArray(ev) ? ev[0] : ev.at, d = Array.isArray(ev) ? ev[2] : ev.d, v = Array.isArray(ev) ? ev[3] : ev.v;
    const out = [at, CUE_NOTE];
    const dd = d != null ? d : dflt;
    if (dd != null || v != null) out.push(dd == null ? null : dd);
    if (v != null) out.push(v);
    return out;
  }
  return ev;
}
// production gestures may be timed in `bars` / `beats` (at the recipe's bpm and
// meter); they lower to `dur` seconds. Returns [gestures, longest in beats].
const TIMED = { riser: 1, downlifter: 1, 'reverse-cymbal': 1, scratch: 1 };
function timeGestures(list, m) {
  const beat = 60 / (m.bpm || 120), barQ = meterQ(m.meter);
  let longest = 0;
  const out = list.map((g) => {
    if (!isObj(g)) return g;
    let q = g;
    if (g.bars != null || g.beats != null) {
      const { bars, beats, ...rest } = g;
      q = { ...rest, dur: r6(((bars || 0) * barQ + (beats || 0)) * beat) };
    }
    if (TIMED[q.type]) longest = Math.max(longest, (q.at || 0) / beat + (q.dur == null ? 2 : q.dur) / beat);
    return q;
  });
  return [out, longest];
}
const hasTimedGesture = (list) => Array.isArray(list) && list.some((g) => isObj(g) && (g.bars != null || g.beats != null));
const cueEventNeedsLowering = (ev) => !(Array.isArray(ev) && ev[1] === CUE_NOTE && ev.length <= 4);
const cueList = (r) => (r.cue !== undefined ? r.cue : r.gesture !== undefined ? [r.gesture] : null);
const hasChordEvent = (list) => Array.isArray(list) && list.some((ev) => isObj(ev) && ev.chord !== undefined);

export function usesAuthoring(m) {
  if (!isObj(m)) return false;
  if (m.kind === 'beats-composition') {
    if (m.progression !== undefined || m.modulate !== undefined || m.band !== undefined) return true;
    if (Array.isArray(m.sweeps) && m.sweeps.some((w) => isObj(w) && w.t0 == null)) return true;
    if (isObj(m.phrases) && Object.values(m.phrases).some(hasChordEvent)) return true;
    for (const p of m.parts || []) {
      if (!isObj(p)) continue;
      if (isCuePart(p) && ((Array.isArray(p.events) && p.events.some(cueEventNeedsLowering)) || hasTimedGesture(cueList(p)))) return true;
      if (hasChordEvent(p.events) || p.chordVoice !== undefined || p.groove !== undefined || p.power !== undefined || p.double !== undefined) return true;
    }
  }
  if (m.kind === 'beats-pattern' && isObj(m.chords) && Object.values(m.chords).some((v) => typeof v === 'string')) return true;
  if (m.kind === 'beats-pattern' && (m.tracks || []).some((t) => isObj(t) && hasTimedGesture(cueList(t)))) return true;
  return false;
}

/**
 * expandBeatsManifest(m) → the literal recipe the kernel plays. Returns `m`
 * itself when no authoring field is present. Never throws on a malformed
 * recipe: what it can't read it leaves for validateBeatsManifest to teach.
 */
export function expandBeatsManifest(m) {
  if (!usesAuthoring(m)) return m;
  const out = clone(m);
  const key = out.key;
  if (out.kind === 'beats-pattern') {
    if (Array.isArray(out.tracks)) out.tracks = out.tracks.map((t) => {
      if (!isObj(t) || !hasTimedGesture(cueList(t))) return t;
      const [list] = timeGestures(cueList(t), out);
      return t.cue !== undefined ? { ...t, cue: list } : { ...t, gesture: list[0] };
    });
    if (!isObj(out.chords)) return out;
    const st = { voicing: out.voicing, octave: out.octave };
    for (const [name, v] of Object.entries(out.chords)) {
      if (typeof v !== 'string') continue;
      const ch = parseChord(v, key);
      if (ch) out.chords[name] = voiceChord(ch, { voicing: st.voicing || 'close', octave: st.octave }).map(nameOf);
    }
    delete out.voicing; delete out.octave;
    return out;
  }
  if (out.kind !== 'beats-composition' || !Array.isArray(out.parts)) return out;
  const clock = makeClock(out);

  // phrases: chord symbols → notes (voice-led within the phrase).
  if (isObj(out.phrases)) {
    for (const name of Object.keys(out.phrases)) {
      if (!hasChordEvent(out.phrases[name])) continue;
      const st = { lead: true };
      out.phrases[name] = out.phrases[name].map((ev) => lowerChordEvent(ev, key, st));
    }
  }
  const chart = out.progression !== undefined ? chartSegments(out.progression) : null;
  out.parts = out.parts.map((p) => {
    if (!isObj(p)) return p;
    if (isCuePart(p)) {
      const [list, longest] = timeGestures(cueList(p) || [], out);
      const q = p.cue !== undefined ? { ...p, cue: list } : { ...p, gesture: list[0] };
      return Array.isArray(p.events) ? { ...q, events: p.events.map((ev) => cueEvent(ev, longest)) } : q;
    }
    let q = p;
    if (hasChordEvent(q.events)) { const st = { lead: !!q.lead, voicing: q.voicing, octave: q.octave }; q = { ...q, events: q.events.map((ev) => lowerChordEvent(ev, key, st)) }; }
    if (q.chordVoice !== undefined && chart) {
      const gen = voicePart(q, chart, clock, key);
      const { chordVoice, rhythm, hold, vel, arp, bars, voicing, octave, lead, art, ...rest } = q;
      q = { ...rest, events: (Array.isArray(q.events) ? q.events : []).concat(gen) };
    } else if (q.voicing !== undefined || q.octave !== undefined || q.lead !== undefined) {
      const { voicing, octave, lead, ...rest } = q;
      q = rest;
    }
    if (q.groove !== undefined) {
      const gen = groovePart(q, out, clock);
      const { groove, ...rest } = q;
      q = { ...rest, events: mergeExplicit(Array.isArray(q.events) ? q.events : [], gen, clock) };
    }
    if (q.power !== undefined) {
      // power: true — every single note becomes root + fifth + octave; the part's
      // phrases get power copies (a phrase is shared, so the copy is this part's).
      const { power, ...rest } = q;
      q = rest;
      if (power === true) {
        if (Array.isArray(q.events)) q = { ...q, events: q.events.map(powerEvent) };
        if (Array.isArray(q.form) && isObj(out.phrases)) {
          q = { ...q, form: q.form.map((f) => {
            if (!isObj(f) || !out.phrases[f.phrase]) return f;
            const id = f.phrase + '~power';
            if (!out.phrases[id]) out.phrases[id] = out.phrases[f.phrase].map(powerEvent);
            return { ...f, phrase: id };
          }) };
        }
      }
    }
    return q;
  });

  // band templates and double-tracking (a mix preset: pan / send / trim per role).
  if (typeof out.band === 'string' && BANDS[out.band]) out.parts = applyBand(out, out.band);
  if (out.parts.some((p) => isObj(p) && p.double)) out.parts = doubleParts(out);
  delete out.band;

  // modulate: every pitched event from `at` on (a kit, a cue part and a part
  // with modulate: false keep their pitch); a form entry by where it starts.
  if (Array.isArray(out.modulate) && out.modulate.length) {
    const shiftAt = modulationAt(out.modulate, clock);
    out.parts = out.parts.map((p) => {
      if (!isObj(p)) return p;
      if (p.modulate === false) { const { modulate, ...rest } = p; return rest; }
      if (isCuePart(p) || kitOf(p)) return p;
      const q = { ...p };
      if (Array.isArray(q.events)) q.events = q.events.map((ev) => shiftEvent(ev, shiftAt, clock));
      if (Array.isArray(q.form)) q.form = q.form.map((f) => { const s = isObj(f) && isTime(f.at) ? shiftAt(clock.q(f.at)) : 0; return s ? { ...f, transpose: (f.transpose || 0) + s } : f; });
      return q;
    });
  }
  // sweeps: at / over (addresses, through the tempo map) → t0 / t1 seconds.
  if (Array.isArray(out.sweeps)) {
    const c = kernel().scoreClock(out);
    out.sweeps = out.sweeps.map((w) => {
      if (!isObj(w) || !isTime(w.at) || w.t0 != null) return w;
      const q0 = c.q(w.at), q1 = q0 + (isTime(w.over) ? c.len(w.over, q0) : 0);
      return { ...w, t0: r6(c.sec(q0)), t1: r6(c.sec(q1)) };
    });
  }
  delete out.progression; delete out.key; delete out.modulate;
  return out;
}
// ── band templates (mix presets by role) and double-tracking ──────────────────
// `band` fills pan, send and trim per role where a part sets none (a row's own
// values win), adds a room when the recipe has none, and double-tracks the
// rhythm guitars. Roles come from the part's patch.
export const BANDS = {
  'anime-rock': {
    room: { model: 'plate', decay: 1.7, predelay: 0.01 },
    roles: { drums: [[0], 0.12, 0], bass: [[0], 0, -1], rhythm: [[-0.8, 0.8], 0.06, -3], lead: [[0.15], 0.18, 0], keys: [[-0.35, 0.35], 0.2, -4], brass: [[-0.55, 0.55], 0.22, -4], strings: [[-0.45, 0.45], 0.3, -6], synth: [[0.3, -0.3], 0.2, -5], pad: [[0], 0.3, -8], vocal: [[0], 0.22, 0], hit: [[0], 0.3, -3], fx: [[0], 0.25, -2] },
  },
  'trance-pop': {
    room: { model: 'room2', decay: 2.6, predelay: 0.02, damp: 0.35 },
    roles: { drums: [[0], 0.05, 0], bass: [[0], 0, -1], synth: [[-0.3, 0.3], 0.3, -2], pad: [[0], 0.35, -6], rhythm: [[-0.75, 0.75], 0.08, -5], lead: [[0.1], 0.25, -1], keys: [[-0.3, 0.3], 0.25, -4], strings: [[-0.5, 0.5], 0.35, -6], brass: [[-0.5, 0.5], 0.25, -4], vocal: [[0], 0.3, 0], hit: [[0], 0.35, -3], fx: [[0], 0.3, -2] },
  },
};
const ROLE_RE = [
  ['rhythm', /^guitar(Amp|DropChug|Electric|Muted|Clean|Nylon)$/], ['lead', /^guitarLead$/],
  ['bass', /^(bass|fmBass|reeseBass|acidBass|acidSquare|wobbleBass)/], ['hit', /^orchHit$/],
  ['keys', /^(piano|pianoGrand|rhodes|fmKeys|celesta|glockenspiel|musicBox|vibraphone|harpsichord|clav|organ|fmOrgan|marimba|xylophone|fmBell|tubularBells|crotales)/],
  ['brass', /^(trumpet|trombone|frenchHorn|tuba|fmBrass)/], ['strings', /^(violin|viola|cello|contrabass|polyStrings|stringMachine|harp|erhu)/],
  ['synth', /^(supersawLead|hoover|chipLead|sawStab|trancePluck|raveStab|fmBass)/], ['pad', /^pad/],
];
export function roleOf(p) {
  if (isCuePart(p)) return 'fx';
  if (kitOf(p)) return 'drums';
  const name = p.patch || (p.instrument && INSTRUMENTS[p.instrument] && INSTRUMENTS[p.instrument].patch);
  if (name === 'voice') return 'vocal';
  for (const [role, re] of ROLE_RE) if (re.test(name || '')) return role;
  return null;
}
function applyBand(m, band) {
  const B = BANDS[band], seen = {};
  if (!m.room) m.room = { ...B.room };
  return m.parts.map((p) => {
    if (!isObj(p)) return p;
    const role = roleOf(p), T = role && B.roles[role];
    if (!T) return p;
    const k = (seen[role] = (seen[role] || 0) + 1) - 1;
    const q = { ...p };
    if (q.pan === undefined && T[0][k % T[0].length]) q.pan = T[0][k % T[0].length];
    if (q.send === undefined && T[1]) q.send = T[1];
    if (q.trim === undefined && T[2]) q.trim = T[2];
    if (role === 'rhythm' && q.double === undefined) q.double = true;
    return q;
  });
}
// double: true | { offset: ms, pan } — a second take: the part again, mirrored
// in the stereo field and a few milliseconds late (the double-tracked wall).
function doubleParts(m) {
  const bpm = m.bpm || 120, clock = makeClock(m), out = [];
  for (const p of m.parts) {
    if (!isObj(p) || !p.double) { if (isObj(p) && p.double === false) { const { double, ...rest } = p; out.push(rest); } else out.push(p); continue; }
    const o = isObj(p.double) ? p.double : {};
    const dq = ((o.offset == null ? 12 : o.offset) / 1000) * (bpm / 60);
    const { double, ...base } = p;
    const pan = o.pan != null ? o.pan : base.pan != null ? -base.pan : 0.7;
    const shift = (at) => (isTime(at) ? r6(clock.q(at) + dq) : at);
    const twin = { ...base, name: base.name + '~double', pan };
    if (Array.isArray(base.events)) twin.events = base.events.map((ev) => (Array.isArray(ev) ? [shift(ev[0]), ...ev.slice(1)] : isObj(ev) ? { ...ev, at: shift(ev.at) } : ev));
    if (Array.isArray(base.form)) twin.form = base.form.map((f) => (isObj(f) ? { ...f, at: shift(f.at) } : f));
    out.push(base.pan == null && o.pan == null ? { ...base, pan: -pan } : base, twin);
    if (Array.isArray(m.sweeps)) m.sweeps = m.sweeps.concat(m.sweeps.filter((w) => isObj(w) && w.row === base.name).map((w) => ({ ...w, row: twin.name })));
  }
  return out;
}

const powerOf = (n) => { const x = midiOf(n); return x == null ? n : [nameOf(x), nameOf(x + 7), nameOf(x + 12)]; };
function powerEvent(ev) {
  if (Array.isArray(ev)) return typeof ev[1] === 'string' ? [ev[0], powerOf(ev[1]), ...ev.slice(2)] : ev;
  if (isObj(ev) && typeof ev.n === 'string') return { ...ev, n: powerOf(ev.n) };
  return ev;
}
function shiftEvent(ev, shiftAt, clock) {
  const at = Array.isArray(ev) ? ev[0] : isObj(ev) ? ev.at : undefined;
  if (!isTime(at)) return ev;
  const s = shiftAt(clock.q(at));
  if (!s) return ev;
  const sh = (n) => (Array.isArray(n) ? n.map((x) => shiftName(x, s)) : shiftName(n, s));
  if (Array.isArray(ev)) { const e = ev.slice(); e[1] = sh(e[1]); return e; }
  return { ...ev, n: sh(ev.n) };
}
// a kit row keeps its notes (they pick drum pieces, not pitches).
export function kitOf(p) {
  const name = p && (p.patch || (p.instrument && INSTRUMENTS[p.instrument] && INSTRUMENTS[p.instrument].patch));
  return (name && PATCHES[name] && PATCHES[name].kit) || null;
}
