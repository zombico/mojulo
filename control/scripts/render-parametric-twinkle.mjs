#!/usr/bin/env node
/**
 * render-parametric-twinkle.mjs — hear the parametric (locked-voice) L3 engine.
 * Drives the REAL modules: authorScore (L5) → renderParametricSong (L3 parametric).
 * No Kokoro, no external voice — pure synthesis. Usage: node scripts/render-parametric-twinkle.mjs [out.wav]
 */
import { writeFileSync } from 'node:fs';
import { authorScore } from '../lib/graph/beats/beats-song-lyrics.js';
import { renderParametricSong } from '../lib/graph/beats/beats-song-voice-parametric.js';

const argv = process.argv.slice(2);
const out = argv.find((a) => !a.startsWith('--')) || 'parametric-twinkle.wav';
const gainArg = argv.indexOf('--gain');
const CONSONANT_GAIN = gainArg >= 0 ? Number(argv[gainArg + 1]) : 1.3;
const SHORT = argv.includes('--short');   // first line only, for fast A/B

const TWINKLE = [
  ['Twin', 'C4', 1], ['kle', 'C4', 1], ['twin', 'G4', 1], ['kle', 'G4', 1], ['lit', 'A4', 1], ['tle', 'A4', 1], ['star', 'G4', 2],
  ['How', 'F4', 1], ['I', 'F4', 1], ['won', 'E4', 1], ['der', 'E4', 1], ['what', 'D4', 1], ['you', 'D4', 1], ['are', 'C4', 2],
  ['Up', 'G4', 1], ['a', 'G4', 1], ['bove', 'F4', 1], ['the', 'F4', 1], ['world', 'E4', 1], ['so', 'E4', 1], ['high', 'D4', 2],
  ['Like', 'G4', 1], ['a', 'G4', 1], ['dia', 'F4', 1], ['mond', 'F4', 1], ['in', 'E4', 1], ['the', 'E4', 1], ['sky', 'D4', 2],
  ['Twin', 'C4', 1], ['kle', 'C4', 1], ['twin', 'G4', 1], ['kle', 'G4', 1], ['lit', 'A4', 1], ['tle', 'A4', 1], ['star', 'G4', 2],
  ['How', 'F4', 1], ['I', 'F4', 1], ['won', 'E4', 1], ['der', 'E4', 1], ['what', 'D4', 1], ['you', 'D4', 1], ['are', 'C4', 2],
];

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

const bpm = 108;
const score = authorScore(SHORT ? TWINKLE.slice(0, 7) : TWINKLE, bpm);
const { data, sr } = renderParametricSong(score, {
  consonantGain: CONSONANT_GAIN,
  expression: { vibrato: { depth: 0.25, rate: 5.5, delay: 0.35 }, swell: 0.2, attack: 0.02, release: 0.07 },
});
writeFileSync(out, encodeInt16Wav(data, sr));
console.log(`  parametric engine — ${score.length} notes @ ${bpm}bpm, consonantGain ${CONSONANT_GAIN}`);
console.log(`→ ${out}  (${(data.length / sr).toFixed(1)}s, ${sr}Hz)`);
