#!/usr/bin/env node
/**
 * Mouth foley's bake: the shelf's mouth sounds rendered by the local voice worker (Kokoro says a sound word, warp.py's
 * chain makes it a sound effect), traced into recipes (sfx-shelf/trace.js) and written to the generated
 * lib/graph/sfx-shelf/sets/mouth-traces.js. Kokoro is needed only here: the traces play and export without it.
 *
 *   node scripts/mouth-foley/bake.mjs [--check] [--all] [--from <dir>] [--wav <dir>]
 *     --check       exit 1 when the page is stale, write nothing (needs the worker, or --from)
 *     --all         render the alternates too (approved takes no row voices yet): WAVs and the report only
 *     --from <dir>  trace <dir>/<id>.wav instead of rendering (no worker needed)
 *     --wav <dir>   write each original and its traced render side by side, to listen (<id>.wav, <id>--traced.wav)
 *
 * The worker is $MOJULO_VOICEGEN, else ~/mojulo-voicegen (install-local-voicegen.sh --ja). Without it, and without
 * --from, the bake says so and leaves the page as it is.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PAGE = resolve(HERE, '../../lib/graph/sfx-shelf/sets/mouth-traces.js');

/**
 * The recipes: a row id, the sound word, the voice, its speed, the chain (warp.py). `with` lays the trace under a
 * family's own cue, `db` under it, its loudest moment on the cue's (a hybrid). `alt` is an approved take no row voices
 * yet: rendered with --all, never written to the page.
 */
export const RECIPES = [
  { id: 'swing', text: 'シュッ', voice: 'jm_kumo', speed: 1.0, chain: 'swoosh' },
  { id: 'blade-swing', text: 'ザシュッ', voice: 'jm_kumo', speed: 1.3, chain: 'blade-kiin', ring: { text: 'キーン', voice: 'jm_kumo', speed: 1.0 } },
  { id: 'katana-swing', text: 'ヒュン', voice: 'jm_kumo', speed: 1.2, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'katana-heavy-swing', text: 'ブン', voice: 'jm_kumo', speed: 1.2, chain: 'heavy' },
  { id: 'blunt-swing', text: 'ブォン', voice: 'jm_kumo', speed: 1.1, chain: 'heavy' },
  { id: 'net-swish', text: 'スパッ', voice: 'jm_kumo', speed: 1.3, chain: 'air' },
  { id: 'swell-in', text: 'スッ', voice: 'jm_kumo', speed: 1.2, chain: 'reverse' },
  // approved takes, not yet a row's voice
  { id: 'alt-shun', alt: true, text: 'シュン', voice: 'jm_kumo', speed: 1.2, chain: 'swoosh' },
  { id: 'alt-shua', alt: true, text: '唰', voice: 'zm_yunjian', speed: 1.2, chain: 'swoosh' },
  { id: 'alt-hyuun', alt: true, text: 'ヒューン', voice: 'jm_kumo', speed: 1.0, chain: 'swoosh' },
  { id: 'alt-jf-shu', alt: true, text: 'シュッ', voice: 'jf_alpha', speed: 1.3, chain: 'swoosh' },
  { id: 'alt-en-swish', alt: true, text: 'swish', voice: 'am_onyx', speed: 1.2, chain: 'swoosh' },
  { id: 'alt-katana-hu', alt: true, text: '呼', voice: 'zm_yunjian', speed: 1.0, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'alt-katana-su', alt: true, text: 'スッ', voice: 'jm_kumo', speed: 1.2, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'alt-katana-whoosh', alt: true, text: 'whoosh', voice: 'am_onyx', speed: 1.0, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'alt-blade-shu', alt: true, text: 'シュッ', voice: 'jm_kumo', speed: 1.0, chain: 'blade' },
  { id: 'alt-blade-shing', alt: true, text: 'shing', voice: 'am_onyx', speed: 1.2, chain: 'blade-kiin', ring: { text: 'キーン', voice: 'jm_kumo', speed: 1.0 } },
  { id: 'alt-swell-shua', alt: true, text: '唰', voice: 'zm_yunjian', speed: 1.2, chain: 'reverse' },
];

// a chain that keeps the voiced hum traces its voicing; the rest are air (trace.js `voicing`)
const VOICED_CHAINS = new Set(['heavy']);

export function workerDir() {
  const w = process.env.MOJULO_VOICEGEN || join(homedir(), 'mojulo-voicegen');
  return existsSync(join(w, 'venv/bin/python')) && existsSync(join(w, 'models/kokoro-v1.0.onnx')) ? w : null;
}

function renderRecipes(recipes, worker) {
  const out = mkdtempSync(join(tmpdir(), 'mouth-foley-'));
  const list = join(out, 'recipes.json');
  writeFileSync(list, JSON.stringify(recipes.map(({ id, text, voice, speed, chain, ring }) => ({ id, text, voice, speed, chain, ...(ring ? { ring } : {}) }))));
  execFileSync(join(worker, 'venv/bin/python'), [join(HERE, 'warp.py'), '--worker', worker, '--recipes', list, '--out', out], { stdio: ['ignore', 'pipe', 'inherit'] });
  return out;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
function peakOf(channels) {
  const m = channels.length > 1 ? channels[0].map((v, i) => (v + channels[1][i]) / 2) : channels[0];
  let at = 0, pk = 0;
  for (let i = 0; i < m.length; i++) if (Math.abs(m[i]) > pk) { pk = Math.abs(m[i]); at = i; }
  return { at, pk };
}

/** Bake: { page (the generated JS), report }. `dir` holds <id>.wav for every recipe. */
export async function bake(recipes, dir, { wav = null } = {}) {
  const { traceSound, refineTrace } = await import('../../lib/graph/sfx-shelf/trace.js');
  const { renderBeatsOffline } = await import('../../lib/graph/beats/beats-render.js');
  const { decodeWav } = await import('../../lib/graph/beats/audio-measure.js');
  const { measureSound } = await import('../../lib/graph/sfx-shelf/measure.js');
  const { familyCue } = await import('../../lib/graph/sfx-shelf/families.js');
  const renderCue = async (cue) => {
    const { wav: bytes } = await renderBeatsOffline({ kind: 'beats-sfx', title: 'mouth foley', cues: { c: cue } }, { cue: 'c', tail: 0.3, sampleRate: 44100 });
    return { bytes: Buffer.from(bytes), ...decodeWav(Buffer.from(bytes)) };
  };
  const entries = {}, report = [];
  if (wav) mkdirSync(wav, { recursive: true });
  for (const r of recipes) {
    const file = join(dir, `${r.id}.wav`);
    const { sr, channels } = decodeWav(readFileSync(file));
    const { gesture, targets } = traceSound(channels, sr, { voicing: VOICED_CHAINS.has(r.chain) });
    const refined = await refineTrace(gesture, targets, (g) => renderCue([g]));
    let trace = refined.gesture, cue = [trace];
    if (r.with) {
      // the hybrid: the voice under the family's own cue, its loudest moment on the cue's
      const base = familyCue(r.with.family, r.with.dials);
      const b = peakOf((await renderCue(base)).channels), v = peakOf((await renderCue([trace])).channels);
      trace = { ...trace, at: r3(Math.max(0, b.at - v.at) / 44100), vol: r3((10 ** (r.with.db / 20) * b.pk) / v.pk) };
      cue = [...base, trace];
    }
    const out = await renderCue(cue);
    const mo = measureSound(channels.length > 1 ? channels : channels[0], sr), mt = measureSound(out.channels.length > 1 ? out.channels : out.channels[0], out.sr);
    report.push({ id: r.id, frames: trace.lv.length, error: refined.error, voiced: !!trace.voiced, original: mo, traced: mt });
    if (wav) { copyFileSync(file, join(wav, `${r.id}.wav`)); writeFileSync(join(wav, `${r.id}--traced.wav`), out.bytes); }
    if (!r.alt) entries[r.id] = { text: r.text, voice: r.voice, speed: r.speed, chain: r.chain, ...(r.ring ? { ring: r.ring } : {}), ...(r.with ? { with: { family: r.with.family, dials: r.with.dials } } : {}), trace };
  }
  return { page: pageJs(entries), report };
}

function pageJs(entries) {
  return [
    '/**',
    ' * sfx-shelf/sets/mouth-traces — the mouth sounds traced into recipes (sfx-shelf/trace.js), one per row the mouth set',
    ' * voices. Generated by `node scripts/mouth-foley/bake.mjs` from each recipe (the sound word, its voice and speed,',
    ' * the chain) rendered by the local voice worker: do not edit. `with` is a family cue the trace is laid under.',
    ' */',
    '',
    'export const MOUTH_TRACES = Object.freeze({',
    ...Object.entries(entries).map(([id, e]) => `  '${id}': ${JSON.stringify(e)},`),
    '});',
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const check = args.includes('--check'), from = opt('--from'), wav = opt('--wav');
  const recipes = RECIPES.filter((r) => args.includes('--all') || !r.alt);
  let dir = from;
  if (!dir) {
    const worker = workerDir();
    if (!worker) {
      console.log('mouth-foley: no voice worker (set MOJULO_VOICEGEN or run install-local-voicegen.sh --ja); the traces stand as they are');
      process.exit(0);
    }
    dir = renderRecipes(recipes, worker);
  }
  const { page, report } = await bake(recipes, dir, { wav });
  for (const r of report) {
    console.log(`  ${r.id.padEnd(20)} frames ${String(r.frames).padStart(3)}  missed ${String(r.error).padStart(4)} dB  ms ${r.original.ms}→${r.traced.ms}  centroid ${r.original.centroidHz}→${r.traced.centroidHz}  heard ${r.original.heard}→${r.traced.heard}`);
  }
  if (wav) writeFileSync(join(wav, 'report.json'), JSON.stringify(report, null, 2));
  const stale = !existsSync(PAGE) || readFileSync(PAGE, 'utf8') !== page;
  if (check) {
    console.log(stale ? 'mouth-traces.js is stale: run node scripts/mouth-foley/bake.mjs' : 'mouth-traces.js is current');
    process.exit(stale ? 1 : 0);
  }
  if (stale) writeFileSync(PAGE, page);
  console.log(stale ? `wrote ${PAGE}` : 'mouth-traces.js already current');
}
