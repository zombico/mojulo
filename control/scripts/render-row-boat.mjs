#!/usr/bin/env node
/**
 * render-row-boat.mjs — a FRESH song through the parametric engine: "Row, Row, Row
 * Your Boat". Drives the real modules (authorScore L5 → renderParametricSong L3),
 * with a per-song katakana `overrides` table (the mechanism a real song recipe uses)
 * so each word is authored for clean enunciation. Usage: node scripts/render-row-boat.mjs [out.wav]
 */
import { writeFileSync } from 'node:fs';
import { authorScore, DEFAULT_OVERRIDES } from '../lib/graph/beats/beats-song-lyrics.js';
import { renderParametricSong } from '../lib/graph/beats/beats-song-voice-parametric.js';

const out = process.argv[2] || 'row-boat.wav';

// [syllable, note, beats] — the classic C-major melody
const ROW = [
  ['row', 'C4', 1], ['row', 'C4', 1], ['row', 'C4', 1], ['your', 'D4', 1], ['boat', 'E4', 2],
  ['gen', 'E4', 1], ['tly', 'D4', 1], ['down', 'E4', 1], ['the', 'F4', 1], ['stream', 'G4', 2],
  ['mer', 'C5', 0.5], ['ri', 'C5', 0.5], ['ly', 'C5', 1], ['mer', 'G4', 0.5], ['ri', 'G4', 0.5], ['ly', 'G4', 1],
  ['mer', 'E4', 0.5], ['ri', 'E4', 0.5], ['ly', 'E4', 1], ['mer', 'C4', 0.5], ['ri', 'C4', 0.5], ['ly', 'C4', 1],
  ['life', 'G4', 1], ['is', 'F4', 1], ['but', 'E4', 1], ['a', 'D4', 1], ['dream', 'C4', 2],
];

// hand-authored katakana per word (raw: precise, no loanword replacers)
const overrides = {
  ...DEFAULT_OVERRIDES,
  row: 'ロウ', your: 'ユア', boat: 'ボウ', gen: 'ジェン', tly: 'リ', down: 'ダウン',
  the: 'ザ', stream: 'ストリー', mer: 'メ', ri: 'リ', ly: 'リ',   // held words end on the nucleus
  life: 'ライフ', is: 'イズ', but: 'バッ', a: 'ア', dream: 'ドリー',
  // NOTE: boat/stream/dream are held (2-beat) and end in a consonant. Authored to
  // sustain the real nucleus vowel (bo-o, stree, dree) — the final t/m is dropped
  // rather than sustained as an epenthetic "to"/"mu". See the elongation finding.
};

function encodeInt16Wav(data, sr) {
  const pcm = Buffer.alloc(data.length * 2);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767))), i * 2);
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(pcm.length, 40); pcm.copy(buf, 44);
  return buf;
}

const bpm = 96;
const score = authorScore(ROW, bpm, { overrides, raw: true });
console.log(score.map((s) => `${s.syllable}→${s.kata}`).join('  '));
const { data, sr } = renderParametricSong(score, {
  expression: { vibrato: { depth: 0.22, rate: 5.5, delay: 0.35 }, swell: 0.2, attack: 0.02, release: 0.07 },
});
writeFileSync(out, encodeInt16Wav(data, sr));
console.log(`\n  Row Your Boat — ${score.length} notes @ ${bpm}bpm  →  ${out}  (${(data.length / sr).toFixed(1)}s)`);
