#!/usr/bin/env node
/**
 * render-birth-of-a-cyborg.mjs — "Birth of a Cyborg": the consolidated FULL
 * production of the Making-of-a-Cyborg spike line (after Kenji Kawai, Ghost in
 * the Shell), and the reference harness for the beats-song choir capability.
 *
 * Everything reusable that the eight render-cyborg-* iterations discovered now
 * lives in the substrate — melody decode in beats-song-melody.js, the locked
 * descratch3 choir (tiered consonant hardness, 3 de-locked voices, dark echo)
 * in beats-song-choir.js — so this script is only the SONG: the
 * Hooktheory-decoded melody, the operator's phrasing weights, the katakana
 * incantation, and the taiko + bell + drone bed (a real beats-composition
 * rendered through renderBeatsOffline and mixed under the choir). The choir is
 * placed at ABSOLUTE grid onsets (phrase-tuning the sustain only) so it stays
 * in sync with the gridded bed.
 *
 * Usage: node scripts/render-birth-of-a-cyborg.mjs [out.wav]
 */
import { writeFileSync } from 'node:fs';
import { authorSyllable } from '../lib/graph/beats/beats-song-lyrics.js';
import { normalizePeak, writeWavMono, readWavMono } from '../lib/graph/beats/beats-song-dsp.js';
import { fromRows, parseHooktheory } from '../lib/graph/beats/beats-song-melody.js';
import {
  tieredConsonantEmphasis, renderChoirAbsolute, feedbackEcho, holdFactor,
  DESCRATCH3_VOICES, DESCRATCH3_ECHO,
} from '../lib/graph/beats/beats-song-choir.js';
import { normalizeBeatsManifest } from '../lib/graph/beats/beats-manifest.js';
import { renderBeatsOffline } from '../lib/graph/beats/beats-render.js';

const out = process.argv[2] || 'birth-of-a-cyborg.wav';
const SR = 24000, bpm = 66, SPB = 60 / bpm;

// ── the song data: Hooktheory-decoded verse in G minor (rows: [beat, dur, sd, oct, rest]) ──
const HT = [
  [1,3,'1',0,1],[4,1,'7',-1,0],[5,3.5,'1',0,0],[8.5,.25,'2',0,0],[8.75,.25,'3',0,0],[9,8,'4',0,0],
  [17,3,'1',0,1],[20,1,'2',0,0],[21,6,'3',0,0],[27,.5,'3',0,0],[27.5,.5,'2',0,0],[28,.5,'1',0,0],[28.5,.5,'7',-1,0],[29,.5,'1',0,0],
  [29.5,6.5,'1',0,1],[36,1,'7',-1,0],[37,3.5,'1',0,0],[40.5,.25,'2',0,0],[40.75,.25,'3',0,0],[41,8,'4',0,0],
  [49,3,'1',0,1],[52,.25,'2',0,0],[52.25,.75,'2',0,0],[53,6,'3',0,0],[59,.5,'3',0,0],[59.5,.5,'2',0,0],[60,.5,'1',0,0],[60.5,.5,'7',-1,0],[61,.5,'1',0,0],
  [61.5,6.5,'1',0,1],[68,1,'7',-1,0],[69,2,'#6',-1,0],[71,2,'5',-1,0],[73,2,'#6',-1,0],
  [75,1,'1',0,1],[76,1,'7',-1,0],[77,2,'1',0,0],[79,2,'7',-1,0],[81,1,'1',0,0],[82,1,'2',0,0],[83,1,'3',0,0],[84,1,'4',0,0],[85,2,'5',0,0],
  [87,1,'1',0,1],[88,1,'5',0,0],[89,2,'4',0,0],[91,2,'2',0,0],[93,2,'5',0,0],
  [95,1,'1',0,1],[96,1,'5',0,0],[97,2,'4',0,0],[99,2,'2',0,0],[101,5,'5',0,0],
  [106,1,'1',0,1],[107,2,'4',0,0],[109,8,'5',0,0],
];
// the incantation, syllable × hold weight, cycled across the phrases
const GROUPS = [
  [['ア',5],['ガ',5],['マ',2],['エ',2],['バ',2]], [['ク',2],['ワ',2],['シ',2],['メ',2]],
  [['ヨ',1],['イ',1],['ニ',1],['ケ',1],['リ',1]], [['ア',5],['ガ',5],['マ',2],['エ',2],['バ',2]],
  [['テ',1],['ル',1],['ツ',1],['キ',5]], [['ト',1],['ヨ',1],['ム',1],['ナ',1],['リ',1]],
  [['ヨ',4],['バ',3],['イ',4],['ニ',4]], [['カ',2],['ミ',5],['オ',4],['リ',3],['テ',3]],
  [['ヨ',3],['ワ',3],['ア',3],['ケ',2]], [['ヌ',2],['エ',3],['ト',3],['リ',3]], [['ナ',3],['ク',2]],
];
const flat = GROUPS.flat();

// ── choir: absolute-onset placement, phrase-tuning the SUSTAIN only ───────────
const emphasis = tieredConsonantEmphasis();
let si = 0; const sung = []; const phraseHeadBeats = []; let lastOnset = -99;
for (const nt of parseHooktheory(fromRows(HT), { tonicMidi: 67, mode: 'minor' })) {
  if (nt.isRest) continue;
  const onsetSec = (nt.beat - 1) * SPB;
  if (onsetSec - lastOnset > 5 * SPB) phraseHeadBeats.push(nt.beat - 1);   // rough phrase head
  lastOnset = onsetSec;
  const [kana, w] = flat[si++] || ['ア', 3];
  const durSec = nt.beats * SPB * holdFactor(w);
  sung.push({ onsetSec, durSec, note: nt.note,
    kata: authorSyllable(kana, durSec, { overrides: { [kana]: kana }, raw: true }) });
}

const choir = renderChoirAbsolute(sung, { sr: SR, emphasis, consonantGain: 1.2, voices: DESCRATCH3_VOICES });
normalizePeak(choir, 0.85);
const choirWet = feedbackEcho(choir, SR, DESCRATCH3_ECHO);

// ── the bed: taiko + bell rings + drone, as a real beats-composition ──────────
const Gm = ['G3', 'A#3', 'D4'];
const bellEvents = phraseHeadBeats.map((b) => [b, Gm, 8, 0.6]);
const droneEvents = [];
for (let b = 0; b < 117; b += 8) droneEvents.push([b, ['G1', 'G2'], 8, 0.5]);
const kickEvents = [];
for (let b = 0; b < 117; b += 4) {
  const climax = b >= 74;
  kickEvents.push([b, 'G1', 1, climax ? 0.95 : 0.7]);
  if (climax) kickEvents.push([b + 2, 'G1', 1, 0.8]);
}
const bed = normalizeBeatsManifest({
  kind: 'beats-composition', title: 'cyborg bed', bpm, seed: 7,
  parts: [
    { name: 'bells', patch: 'fmBell', level: -9, chain: [{ type: 'reverb', decay: 3.5, wet: 0.3 }], events: bellEvents },
    { name: 'drone', patch: 'contrabass', level: -8, events: droneEvents },
    { name: 'taiko', patch: 'kick', level: -2, events: kickEvents },
  ],
});
const bedRes = await renderBeatsOffline(bed, { tail: 2.5, sampleRate: 44100 });
const { data: bedMono, sr: bedSr } = readWavMono(bedRes.wav);
// resample the 44.1k bed to the choir's 24k by linear interp
const bedAt = (sec) => { const x = sec * bedSr; const i = Math.floor(x), f = x - i; return i + 1 < bedMono.length ? bedMono[i] * (1 - f) + bedMono[i + 1] * f : (bedMono[i] || 0); };

// ── mix choir + bed ───────────────────────────────────────────────────────────
const CHOIR_GAIN = 1.0, BED_GAIN = 0.9;
const mix = new Float32Array(Math.max(choirWet.length, Math.ceil(bedRes.durationSeconds * SR)));
for (let i = 0; i < mix.length; i++) {
  const c = i < choirWet.length ? choirWet[i] : 0;
  mix[i] = c * CHOIR_GAIN + bedAt(i / SR) * BED_GAIN;
}
normalizePeak(mix, 0.92);
for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh(mix[i] * 1.05);

writeFileSync(out, writeWavMono(mix, SR));
console.log(`Birth of a Cyborg — descratch3 choir + taiko + bell rings + drone @ ${bpm}bpm  →  ${out}  (${(mix.length / SR).toFixed(1)}s)`);
