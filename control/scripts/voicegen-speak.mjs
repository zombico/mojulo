#!/usr/bin/env node
/**
 * speak.mjs — the local voice backend's one verb (voice-worker.plan.md V0).
 *
 * Installed by install-local-voicegen.sh into the sibling voicegen dir
 * (default ~/mojulo-voicegen) and run from there — this file is the
 * checked-in template (templates are recipes, weights are not). Kokoro-82M
 * ONNX weights are fetched lazily on first run into <install>/models/,
 * never into this repo.
 *
 * Usage (from the install dir):
 *   node speak.mjs --text "Hello there" --out hello.wav
 *   node speak.mjs --file script.txt --voice am_adam --speed 1.1 --out line.wav
 *   node speak.mjs --list-voices
 *
 * Prints one JSON result line on success so a driving agent can parse the
 * handback: { ok, path, bytes, seconds, sample_rate, rms, voice, speed, model }.
 * The rms figure is the future submit-gate's non-silence check, computed at
 * the source so the worker audit can carry it.
 */

import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8'; // ~92MB; fp32 is ~326MB and not audibly better for this seam
const DEFAULT_VOICE = 'af_heart';

const { values: args } = parseArgs({
  options: {
    text: { type: 'string' },
    file: { type: 'string' },
    voice: { type: 'string', default: DEFAULT_VOICE },
    speed: { type: 'string', default: '1.0' },
    out: { type: 'string' },
    'list-voices': { type: 'boolean', default: false },
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));

// Keep the model store inside the install dir (the backend owns its
// weights, like ComfyUI's models/ — nothing lands in a global cache).
const { env } = await import('@huggingface/transformers');
env.cacheDir = path.join(here, 'models');

const { KokoroTTS } = await import('kokoro-js');
const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE, device: 'cpu' });

// No process.exit() below the model load — onnxruntime's thread pool aborts
// (mutex lock failed) if the process is torn down mid-session; fall through
// to a natural exit instead. usage() runs before the load, where exit is safe.
if (args['list-voices']) {
  const voices = tts.voices ? Object.keys(tts.voices) : [];
  process.stdout.write(`${JSON.stringify({ ok: true, model: MODEL_ID, voices }, null, 2)}\n`);
} else {
  const text = args.text ?? (args.file ? (await fs.readFile(args.file, 'utf8')).trim() : null);
  if (!text || !args.out) {
    throw new Error('speak.mjs requires --text "..." (or --file <path>) and --out <path.wav>, or --list-voices');
  }
  const speed = Number(args.speed);
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`invalid --speed: ${args.speed}`);
  }

  const audio = await tts.generate(text, { voice: args.voice, speed });
  const outPath = path.resolve(args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await audio.save(outPath);

  const samples = audio.audio;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) sumSq += samples[i] * samples[i];
  const rms = samples.length ? Math.sqrt(sumSq / samples.length) : 0;
  const { size: bytes } = await fs.stat(outPath);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    path: outPath,
    bytes,
    seconds: Number((samples.length / audio.sampling_rate).toFixed(3)),
    sample_rate: audio.sampling_rate,
    rms: Number(rms.toFixed(5)),
    voice: args.voice,
    speed,
    model: MODEL_ID,
  })}\n`);
}
