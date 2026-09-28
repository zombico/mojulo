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
 *      verify its SHA-256 → gunzip → chmod +x → functional `-version` gate.
 *
 * Integrity: the downloaded .gz must match the SHA-256 pinned below for this
 * platform BEFORE it is decompressed, made executable or run. A mismatch, or a
 * platform with no pin, fails closed: nothing is written in place of the binary
 * and the error names `brew install ffmpeg` / `apt install ffmpeg` and the
 * $MOJULO_FFMPEG override. The `-version` run stays as the "does it actually
 * run" gate after that.
 *
 * This is a CONTROL-PLANE concern only; the control plane is single-user and
 * self-hosted. (The Debian-slim / multi-arch-GHCR / glibc native-dep rules that
 * once sat beside this note governed the chatbot image, which left with the
 * chatbot factory in 3.0.0.)
 */

import { promises as fs, existsSync, createReadStream, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { pipeline as streamPipeline } from 'node:stream/promises';
import https from 'node:https';
import path from 'node:path';
import { trackDownload } from '@/lib/net/download-log';

// Pinned ffmpeg-static release (see github.com/eugeneware/ffmpeg-static). Asset
// names are `ffmpeg-${platform}-${arch}.gz`; platform/arch are Node's own.
const FFMPEG_STATIC_RELEASE = 'b6.1.1';
const FFMPEG_STATIC_BASE = 'https://github.com/eugeneware/ffmpeg-static/releases/download';

// SHA-256 of each `ffmpeg-<platform>-<arch>.gz` asset of release b6.1.1, the exact
// bytes fetched, as GitHub reports them (`gh api
// repos/eugeneware/ffmpeg-static/releases/tags/b6.1.1`, assets[].digest). Bumping
// FFMPEG_STATIC_RELEASE means re-pinning every row from the new release.
export const FFMPEG_STATIC_SHA256 = Object.freeze({
  'darwin-arm64': '8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa',
  'darwin-x64': '929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106',
  'linux-arm': '64b115a12f0ab77c277e3c418aae8b40ef881e75e746a0e2d066a206b9bc5172',
  'linux-arm64': '754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0',
  'linux-ia32': '169b27c078a8ecedb814cac67afccf15a9868d63e9d74ef86088adefaa500d00',
  'linux-x64': 'bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa',
  'win32-x64': '8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77',
});

/**
 * Where fetched binaries are cached: $MOJULO_HOME/ffmpeg under the bins (seeded
 * by scripts/mojulo-paths.mjs), control/data/ffmpeg under `next dev`.
 */
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
    sha256: FFMPEG_STATIC_SHA256[`${platform}-${arch}`],
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

/**
 * Download the gzipped static binary, check its SHA-256, and only then
 * decompress it to `destBin` and mark it executable. The .gz is hashed as it
 * streams to a temp file; on a mismatch both temp files are removed and
 * `destBin` is never created.
 *
 * @param {object} args
 * @param {string} args.url
 * @param {string|undefined} args.sha256  expected hex digest of the fetched bytes
 * @param {string} args.destBin
 * @param {(url: string) => Promise<import('node:stream').Readable>} [args.get]  tests only
 */
export async function fetchVerifiedStatic({ url, sha256, destBin, get = httpsGet }) {
  if (!sha256) {
    throw new Error(
      `no pinned SHA-256 for ${path.basename(url)} in ffmpeg-static ${FFMPEG_STATIC_RELEASE}, `
        + 'so mojulo will not download an unverified binary for this platform',
    );
  }
  await fs.mkdir(path.dirname(destBin), { recursive: true });
  const gz = `${destBin}.gz.download`;
  const tmp = `${destBin}.download`;
  try {
    const hash = createHash('sha256');
    const tap = new Transform({
      transform(chunk, _enc, done) {
        hash.update(chunk);
        done(null, chunk);
      },
    });
    await streamPipeline(await get(url), tap, createWriteStream(gz));
    const actual = hash.digest('hex');
    if (actual !== sha256) {
      const err = new Error(
        `checksum mismatch for ${url}: expected sha256 ${sha256}, got ${actual}. The download was discarded; nothing was run.`,
      );
      err.code = 'FFMPEG_CHECKSUM_MISMATCH';
      throw err;
    }
    await streamPipeline(createReadStream(gz), createGunzip(), createWriteStream(tmp));
    if (process.platform !== 'win32') {
      await fs.chmod(tmp, 0o755).catch(() => {});
    }
    await fs.rename(tmp, destBin);
  } finally {
    await fs.rm(gz, { force: true });
    await fs.rm(tmp, { force: true });
  }
}

let cachedBin = null;

/**
 * Resolve a usable ffmpeg binary path, fetching one if needed.
 * @param {object} [opts]
 * @param {boolean} [opts.allowFetch=true]  set false to require a pre-existing binary
 * @param {Function} [opts.get]  tests only: stands in for the HTTPS download
 * @returns {Promise<string>} an ffmpeg binary path/name suitable for spawn()
 */
export async function resolveFfmpeg({ allowFetch = true, get = httpsGet } = {}) {
  if (cachedBin) return cachedBin;

  const override = process.env.MOJULO_FFMPEG;
  if (override && (await probe(override))) return (cachedBin = override);

  if (await probe('ffmpeg')) return (cachedBin = 'ffmpeg');

  const { url, binName, sha256 } = staticAsset();
  const onDisk = path.join(ffmpegCacheDir(), binName);
  if (existsSync(onDisk) && (await probe(onDisk))) return (cachedBin = onDisk);

  if (!allowFetch) throw new Error(noFfmpegMessage('auto-fetch disabled'));

  try {
    console.error(`[mojulo] downloading ffmpeg ${FFMPEG_STATIC_RELEASE} (SHA-256 pinned) from ${url} into ${path.dirname(onDisk)}…`);
    await trackDownload(`ffmpeg ${FFMPEG_STATIC_RELEASE} (20 to 30 MB) from github.com into ${path.dirname(onDisk)}`, () =>
      fetchVerifiedStatic({ url, sha256, destBin: onDisk, get }));
  } catch (err) {
    const wrapped = new Error(noFfmpegMessage(`fetch failed: ${err.message}`));
    if (err.code) wrapped.code = err.code;
    throw wrapped;
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
