/**
 * Motion — ffmpeg resolver for the stitcher (multi-clip → long-form MP4/H.264).
 *
 * The control plane has no video encoder of its own (sharp/libvips is image-only)
 * and deliberately ships no postinstall download — `fetch-embed-model.js` is
 * explicit/lazy so `npx mojulo` doesn't immediately pull a model. We mirror that
 * stance for ffmpeg: DETECT a usable binary, else LAZY-FETCH a static build on
 * the FIRST stitch (never at install), cache it, reuse it thereafter.
 *
 * Resolution order:
 *   1. $MOJULO_FFMPEG — an explicit pinned binary path (verified by `-version`).
 *   2. `ffmpeg` on PATH (the operator ran `brew install ffmpeg` / `apt install`).
 *   3. A previously lazy-fetched binary in the cache dir.
 *   4. Lazy-fetch a static build from the ffmpeg-static GitHub releases (the
 *      de-facto-standard multi-platform binaries used by millions of installs),
 *      gunzip → chmod +x → functional `-version` gate.
 *
 * Integrity gate: a functional `-version` run, the same gate ffmpeg-static itself
 * relies on (it ships no checksum). If a fetch lands a wrong/corrupt asset, the
 * gate fails and we surface an actionable error pointing at `brew install ffmpeg`
 * and the $MOJULO_FFMPEG override.
 *
 * This is a CONTROL-PLANE concern only. The Debian-slim / multi-arch-GHCR /
 * glibc native-dep rules in CLAUDE.md govern the bot image, not this path; the
 * control plane is single-user and self-hosted.
 */

import { promises as fs, existsSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import { pipeline as streamPipeline } from 'node:stream/promises';
import https from 'node:https';
import path from 'node:path';

// Pinned ffmpeg-static release (see github.com/eugeneware/ffmpeg-static). Asset
// names are `ffmpeg-${platform}-${arch}.gz`; platform/arch are Node's own.
const FFMPEG_STATIC_RELEASE = 'b6.1.1';
const FFMPEG_STATIC_BASE = 'https://github.com/eugeneware/ffmpeg-static/releases/download';

/** Where lazy-fetched binaries are cached (gitignored data dir by default). */
export function ffmpegCacheDir() {
  return process.env.MOJULO_FFMPEG_DIR || path.join(process.cwd(), 'data', 'ffmpeg');
}

function staticAsset() {
  const platform = process.platform; // darwin | linux | win32
  const arch = process.arch; // arm64 | x64
  const exe = platform === 'win32' ? '.exe' : '';
  return {
    url: `${FFMPEG_STATIC_BASE}/${FFMPEG_STATIC_RELEASE}/ffmpeg-${platform}-${arch}.gz`,
    binName: `ffmpeg-${platform}-${arch}${exe}`,
  };
}

function noFfmpegMessage(detail) {
  return [
    'No usable ffmpeg found and the static-binary fetch did not succeed.',
    detail ? `(${detail})` : '',
    'Stitching needs an H.264 encoder. Either install ffmpeg on this host',
    '(macOS: `brew install ffmpeg`, Debian/Ubuntu: `apt install ffmpeg`),',
    'or point $MOJULO_FFMPEG at an ffmpeg binary, then retry the stitch.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Resolve true if `bin` runs and reports a version (the integrity gate). */
function probe(bin) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      const p = spawn(bin, ['-version'], { stdio: 'ignore' });
      p.on('error', () => done(false));
      p.on('close', (code) => done(code === 0));
    } catch {
      done(false);
    }
  });
}

/** GET with redirect following (GitHub release assets 302 to a CDN object). */
function httpsGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) {
      reject(new Error('too many redirects'));
      return;
    }
    https
      .get(url, { headers: { 'user-agent': 'mojulo-motion' } }, (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          resolve(httpsGet(new URL(headers.location, url).toString(), redirects + 1));
          return;
        }
        if (statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${statusCode} for ${url}`));
          return;
        }
        resolve(res);
      })
      .on('error', reject);
  });
}

/** Download the gzipped static binary, decompress to `destBin`, mark executable. */
async function fetchStatic(url, destBin) {
  await fs.mkdir(path.dirname(destBin), { recursive: true });
  const tmp = `${destBin}.download`;
  const res = await httpsGet(url);
  await streamPipeline(res, createGunzip(), createWriteStream(tmp));
  if (process.platform !== 'win32') {
    await fs.chmod(tmp, 0o755).catch(() => {});
  }
  await fs.rename(tmp, destBin);
}

let cachedBin = null;

/**
 * Resolve a usable ffmpeg binary path, fetching one if needed.
 * @param {object} [opts]
 * @param {boolean} [opts.allowFetch=true]  set false to require a pre-existing binary
 * @returns {Promise<string>} an ffmpeg binary path/name suitable for spawn()
 */
export async function resolveFfmpeg({ allowFetch = true } = {}) {
  if (cachedBin) return cachedBin;

  const override = process.env.MOJULO_FFMPEG;
  if (override && (await probe(override))) return (cachedBin = override);

  if (await probe('ffmpeg')) return (cachedBin = 'ffmpeg');

  const { url, binName } = staticAsset();
  const onDisk = path.join(ffmpegCacheDir(), binName);
  if (existsSync(onDisk) && (await probe(onDisk))) return (cachedBin = onDisk);

  if (!allowFetch) throw new Error(noFfmpegMessage('auto-fetch disabled'));

  try {
    await fetchStatic(url, onDisk);
  } catch (err) {
    throw new Error(noFfmpegMessage(`fetch failed: ${err.message}`));
  }
  if (await probe(onDisk)) return (cachedBin = onDisk);
  throw new Error(noFfmpegMessage('fetched binary failed its -version check'));
}

/** Reset the memoized resolution (tests). */
export function _resetFfmpegCache() {
  cachedBin = null;
}

/**
 * Run ffmpeg with `args`, rejecting on a non-zero exit with captured stderr.
 * @param {string} bin   resolved ffmpeg path
 * @param {string[]} args
 */
export function runFfmpeg(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 16384) stderr = stderr.slice(-16384);
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().split('\n').slice(-4).join(' ')}`));
    });
  });
}
