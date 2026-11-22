#!/usr/bin/env node
/**
 * The sound library's conditioner: recorded takes in, level-matched masters and the library's index out.
 *
 *   node scripts/sound-library/condition.mjs --cards spike --out <dir>
 *
 * Every take of every card is kept as a VARIANT of its card (a game plays them in turn, the shelf's per-hit
 * variation), so picking is leaving a take out, not choosing one in. Per take, with ffmpeg ($MOJULO_FFMPEG, else
 * PATH; required here: conditioning is the one step that needs it):
 *   - decoded to 16-bit PCM WAV at 44.1 kHz, its channels kept (the master; the shipped codec is chosen later);
 *   - one-shots and instrument pieces: leading silence trimmed (below -60 dBFS), peak-normalized to -1 dBFS;
 *   - beds and loops: never trimmed (the seam is the loop's), loudness-normalized (beds -24 LUFS, a vehicle's loops -14), the
 *     seam measured: the jump from the last sample to the first against the bed's median sample-to-sample step;
 *   - named by its bytes: <out>/masters/<sha16>.wav, with <sha16>.mp3 beside it (160 kbps, the form a page inlines:
 *     about a tenth of the WAV; an offline render reads the WAV).
 * Writes <out>/library.json: { version, cards: { <card>: { shelf | band, role, loop, prompt, variants: [ { id,
 * take, seconds, rate, channels, peakDb, lufs, seam?, source: { sha256, request } } ] } } }, ordered by card and take
 * so the same takes make the same index. Re-running rewrites only what changed (masters are content-addressed).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCards } from './cards/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RATE = 44100;
const PEAK_DB = -1;
const BED_LUFS = -24;
const LOOP_LUFS = -14;   // a vehicle's loops (role 'loop'): an engine at the wheel, not a bed under the score

function args(argv) {
  const a = { cards: 'spike', out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--cards') a.cards = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else throw new Error(`condition: unknown argument ${k}`);
  }
  if (!a.out) throw new Error('condition: --out <dir> is required');
  return a;
}

function ffmpegBin() {
  const env = process.env.MOJULO_FFMPEG;
  if (env && existsSync(env)) return env;
  return spawnSync('ffmpeg', ['-version']).status === 0 ? 'ffmpeg' : null;
}

function run(ff, argv) {
  const r = spawnSync(ff, ['-hide_banner', '-nostats', ...argv], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`condition: ffmpeg failed: ${String(r.stderr).split('\n').slice(-3).join(' ')}`);
  return String(r.stderr);
}

/** { peakDb, lufs } of a file */
function levels(ff, file) {
  const err = run(ff, ['-i', file, '-af', 'volumedetect,ebur128', '-f', 'null', '-']);
  const peak = err.match(/max_volume: (-?[\d.]+) dB/), lufs = [...err.matchAll(/\bI:\s+(-?[\d.]+) LUFS/g)];
  return { peakDb: peak ? Number(peak[1]) : null, lufs: lufs.length ? Number(lufs[lufs.length - 1][1]) : null };
}

/** a 16-bit PCM WAV's header facts and its samples as Int16 frames */
function readWav(bytes) {
  let fmt = null, data = null;
  for (let o = 12; o + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', o, o + 4), size = bytes.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { channels: bytes.readUInt16LE(o + 10), rate: bytes.readUInt32LE(o + 12) };
    else if (id === 'data') data = { at: o + 8, size: Math.min(size, bytes.length - o - 8) };
    o += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('condition: a master with no fmt or data chunk');
  return { ...fmt, frames: Math.floor(data.size / (2 * fmt.channels)), at: data.at };
}

/** the loop seam: the jump from the last frame to the first, over the median frame-to-frame step (1 ≈ seamless) */
function seam(bytes, w) {
  const ch = w.channels, s = (f, c) => bytes.readInt16LE(w.at + (f * ch + c) * 2);
  const steps = [];
  for (let f = 1; f < w.frames; f += 7) { let d = 0; for (let c = 0; c < ch; c++) d += Math.abs(s(f, c) - s(f - 1, c)); steps.push(d / ch); }
  steps.sort((x, y) => x - y);
  const median = steps[steps.length >> 1] || 1;
  let jump = 0; for (let c = 0; c < ch; c++) jump += Math.abs(s(0, c) - s(w.frames - 1, c));
  return +((jump / ch) / median).toFixed(2);
}

function condition(ff, src, card, tmp) {
  const one = card.role !== 'bed' && card.role !== 'loop';
  const trim = one ? 'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.002,' : '';
  // pass 1: decode (and trim) at the master rate, to measure what the gain must be
  run(ff, ['-y', '-i', src, '-af', `${trim}aresample=${RATE}`, '-c:a', 'pcm_s16le', tmp]);
  const lv = levels(ff, tmp);
  const gain = one ? PEAK_DB - lv.peakDb : Math.min((card.role === 'loop' ? LOOP_LUFS : BED_LUFS) - lv.lufs, PEAK_DB - lv.peakDb);
  const out = `${tmp}.g.wav`;
  run(ff, ['-y', '-i', tmp, '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
  return out;
}

async function main() {
  const a = args(process.argv.slice(2));
  const ff = ffmpegBin();
  if (!ff) throw new Error('condition: ffmpeg not found ($MOJULO_FFMPEG or PATH); conditioning needs it');
  const CARDS = await loadCards(a.cards);
  const ledgerFile = path.join(a.out, 'ledger.jsonl');
  const ledger = existsSync(ledgerFile) ? readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const masters = path.join(a.out, 'masters');
  mkdirSync(masters, { recursive: true });
  const tmp = path.join(a.out, '.condition.tmp.wav');
  const cards = {};
  let n = 0;
  for (const c of CARDS) {
    const dir = path.join(a.out, 'takes', c.id);
    if (!existsSync(dir)) continue;
    const takes = readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => parseInt(f)).sort((x, y) => x - y);
    const variants = [];
    for (const t of takes) {
      const src = path.join(dir, `${t}.mp3`), made = condition(ff, src, c, tmp);
      const bytes = readFileSync(made), id = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
      const at = path.join(masters, `${id}.wav`);
      if (!existsSync(at)) renameSync(made, at);
      const mp3 = path.join(masters, `${id}.mp3`);
      if (!existsSync(mp3)) run(ff, ['-y', '-i', at, '-codec:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', '-id3v2_version', '0', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3]);
      const w = readWav(bytes), lv = levels(ff, at), led = ledger.find((e) => e.card === c.id && e.take === t);
      variants.push({
        id, take: t, seconds: +(w.frames / w.rate).toFixed(3), rate: w.rate, channels: w.channels, peakDb: lv.peakDb, lufs: lv.lufs,
        ...(c.role === 'bed' || c.role === 'loop' ? { seam: seam(bytes, w) } : {}),
        source: { sha256: led?.sha256 ?? createHash('sha256').update(readFileSync(src)).digest('hex'), request: led?.request ?? null },
      });
      n++;
    }
    cards[c.id] = { ...(c.shelf ? { shelf: c.shelf } : {}), ...(c.band ? { band: c.band } : {}), ...(c.engine ? { engine: c.engine, rpm: c.rpm } : {}), ...(c.flavor ? { flavor: c.flavor } : {}), role: c.role, loop: !!c.loop, prompt: c.prompt, variants };
  }
  const index = { version: 1, set: a.cards, rate: RATE, levels: { oneShotPeakDb: PEAK_DB, bedLufs: BED_LUFS, loopLufs: LOOP_LUFS }, cards };
  writeFileSync(path.join(a.out, 'library.json'), `${JSON.stringify(index, null, 1)}\n`);
  for (const f of [tmp, `${tmp}.g.wav`]) if (existsSync(f)) spawnSync('rm', ['-f', f]);
  console.log(`condition: ${n} variants over ${Object.keys(cards).length} cards → ${path.join(a.out, 'library.json')}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
