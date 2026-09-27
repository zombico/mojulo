/**
 * Headless-Chromium resolver for the scene PNG baker (CSS preserve-3d scenes
 * can only be rasterized faithfully by a real browser engine).
 *
 * The control plane deliberately ships no postinstall download — the embed model
 * (`fetch-embed-model.js`) and the ffmpeg binary (`lib/motion/ffmpeg.js`) are both
 * explicit/lazy so `npx mojulo` doesn't immediately pull hundreds of MB. We mirror
 * that stance here: DETECT a usable browser, else fetch a Chrome-for-Testing build
 * the first time an EXPLICIT render needs one (never at install, never for a
 * background or gallery bake), cache it, reuse.
 *
 * Resolution order:
 *   1. $MOJULO_CHROMIUM / $PUPPETEER_EXECUTABLE_PATH — an explicit pinned binary.
 *   2. A previously fetched Chrome-for-Testing build in the cache dir.
 *   3. A system browser (Chrome / Chromium / Edge / Brave) at a well-known path.
 *   4. Fetch Chrome-for-Testing via @puppeteer/browsers into the cache dir, only
 *      with the caller's consent: `allowFetch: true`, or a render running inside
 *      withChromiumFetch (chromium-consent.js lists the entry points that do).
 *
 * Integrity gate: a functional headless launch (open + close), the same "does it
 * actually run" gate ffmpeg.js applies with `-version`. A wrong/corrupt binary
 * fails the gate and we surface an actionable error pointing at `brew install`
 * and the $MOJULO_CHROMIUM override.
 *
 * CONTROL-PLANE concern only. The Debian-slim / glibc bot-image rules in CLAUDE.md
 * govern the bot image, not this path; the control plane is single-user/self-hosted.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import puppeteer from 'puppeteer-core';

import { installedGroups } from '@/lib/mcp/packs';
import { chromiumFetchAllowed, recordChromiumFetch } from '@/lib/graph/scene/chromium-consent';

// Pinned Chrome-for-Testing build fetched on first use. Cross-platform: the same
// buildId resolves to the right per-platform asset via detectBrowserPlatform.
// Override with $MOJULO_CHROMIUM_BUILD if this pin ever goes stale.
const CHROME_BUILD = process.env.MOJULO_CHROMIUM_BUILD || '131.0.6778.204';

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];

// WebGL launch args for the navigable three.js World (scene-three.js → /world).
// The default LAUNCH_ARGS pass `--disable-gpu`, which is correct for the CSS-3D
// preserve-3d and SVG bakes (deterministic, no GL needed) but yields a BLANK
// canvas for a WebGL page. Headless WebGL needs a software GL backend: route GL
// through ANGLE's SwiftShader (CPU) rasterizer instead of disabling the GPU.
// `--enable-unsafe-swiftshader` opts into SwiftShader on Chrome builds that
// otherwise gate it; `--ignore-gpu-blocklist` keeps a blocklisted host from
// silently falling back to no-GL.
const WEBGL_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

/**
 * Where the fetched browser is cached: $MOJULO_HOME/chromium under the bins
 * (seeded by scripts/mojulo-paths.mjs), control/data/chromium under `next dev`.
 */
export function chromiumCacheDir() {
  return process.env.MOJULO_CHROMIUM_DIR || path.join(process.cwd(), 'data', 'chromium');
}

// Well-known system-browser locations by platform. First one that exists AND
// launches wins, so an operator who already has Chrome never triggers a fetch.
function systemCandidates() {
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
  }
  if (process.platform === 'win32') {
    const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const pfx86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    return [
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pfx86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ];
}

function noChromiumMessage(detail) {
  return [
    'No usable Chromium found and the Chrome-for-Testing fetch did not succeed.',
    detail ? `(${detail})` : '',
    'Baking a CSS-3D scene to PNG needs a Chromium-family browser. Either install one',
    '(macOS: install Google Chrome, Debian/Ubuntu: `apt install chromium`),',
    'or point $MOJULO_CHROMIUM at a Chrome/Chromium/Edge binary, then retry.',
  ]
    .filter(Boolean)
    .join(' ');
}

function chromiumUnavailable() {
  const err = new Error(
    'No Chromium-family browser was found. mojulo downloads Chrome for Testing only when an explicit '
      + 'render asks for it (a motion render, a game export, an audit run, the dashboard\'s PNG download), '
      + 'never for a background or gallery bake. Install Google Chrome, Chromium, Edge or Brave '
      + '(Debian/Ubuntu: `apt install chromium`), or point $MOJULO_CHROMIUM at one, then retry.',
  );
  err.code = 'CHROMIUM_UNAVAILABLE';
  return err;
}

/** Resolve true if `executablePath` launches headless and closes cleanly. */
async function probe(executablePath) {
  let browser = null;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: LAUNCH_ARGS });
    return true;
  } catch {
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** Fetch the pinned Chrome-for-Testing build into the cache dir; `downloaded` is false when it was already there. */
async function fetchChrome() {
  // Dynamic import: @puppeteer/browsers is only needed on the cold path, and this
  // keeps the resolver loadable in environments that never bake a scene.
  const { install, computeExecutablePath, detectBrowserPlatform, Browser } = await import('@puppeteer/browsers');
  const platform = detectBrowserPlatform();
  if (!platform) throw new Error('could not detect browser platform');
  const cacheDir = chromiumCacheDir();
  const buildId = CHROME_BUILD;

  const existing = computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir });
  if (existing && existsSync(existing)) return { executablePath: existing, downloaded: false };

  console.error(`[mojulo] downloading Chrome for Testing ${buildId} (~500 MB on disk) into ${cacheDir} for an explicit render…`);
  const installed = await install({ browser: Browser.CHROME, buildId, cacheDir });
  console.error(`[mojulo] Chrome for Testing ${buildId} downloaded to ${installed.executablePath}`);
  return { executablePath: installed.executablePath, downloaded: true };
}

// Two explicit renders racing on a cold host share one download.
let fetching = null;
function fetchChromeOnce() {
  fetching ??= fetchChrome().finally(() => { fetching = null; });
  return fetching;
}

let cachedExecutable = null;

/**
 * Resolve a usable headless-Chromium executable path, fetching one only with consent.
 * @param {object} [opts]
 * @param {boolean} [opts.allowFetch] true/false to decide here; omitted, the fetch is
 *   allowed only inside withChromiumFetch (chromium-consent.js)
 * @returns {Promise<string>} an executable path suitable for puppeteer.launch()
 */
export async function resolveChromium({ allowFetch } = {}) {
  if (cachedExecutable) return cachedExecutable;
  const mayFetch = allowFetch ?? chromiumFetchAllowed();

  const override = process.env.MOJULO_CHROMIUM || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (override && existsSync(override) && (await probe(override))) {
    return (cachedExecutable = override);
  }

  // A previously fetched Chrome-for-Testing build (cheap to check before scanning
  // system paths, and the most likely hit on a host that has baked before).
  try {
    const { computeExecutablePath, detectBrowserPlatform, Browser } = await import('@puppeteer/browsers');
    const platform = detectBrowserPlatform();
    if (platform) {
      const onDisk = computeExecutablePath({
        browser: Browser.CHROME,
        buildId: CHROME_BUILD,
        cacheDir: chromiumCacheDir(),
      });
      if (onDisk && existsSync(onDisk) && (await probe(onDisk))) {
        return (cachedExecutable = onDisk);
      }
    }
  } catch {
    // @puppeteer/browsers missing/unusable — fall through to system + fetch paths.
  }

  for (const candidate of systemCandidates()) {
    if (existsSync(candidate) && (await probe(candidate))) {
      return (cachedExecutable = candidate);
    }
  }

  if (!mayFetch) throw chromiumUnavailable();

  // Never trigger the ~500 MB Chrome-for-Testing download in an install WITHOUT
  // the creative pack. Scene-PNG baking is a creative capability; an ops install
  // (a MOJULO_PACKS override without 'creative') sheds that browser entirely. All the
  // cheap detection above (override / cached fetch / system browser) still runs —
  // only the heavy FETCH is gated — so a default full install (creative present)
  // is byte-identical. See install-capabilities.plan.md P2b "don't download".
  if (!installedGroups().has('creative')) {
    throw new Error(
      'Scene-PNG rendering is a creative-pack capability and the creative pack is not installed here, '
        + 'so no Chromium was auto-fetched (that download is ~500 MB). Run `mojulo install creative` '
        + "(or include 'creative' in MOJULO_PACKS if you manage the install manually), or point "
        + '$MOJULO_CHROMIUM at an existing Chrome / Chromium / Edge binary.',
    );
  }

  let fetched;
  try {
    fetched = await fetchChromeOnce();
  } catch (err) {
    throw new Error(noChromiumMessage(`fetch failed: ${err.message}`));
  }
  if (fetched?.executablePath && (await probe(fetched.executablePath))) {
    if (fetched.downloaded) recordChromiumFetch({ build: CHROME_BUILD, dir: chromiumCacheDir() });
    return (cachedExecutable = fetched.executablePath);
  }
  throw new Error(noChromiumMessage('fetched binary failed its launch check'));
}

/** The puppeteer launch args used by the resolver and the CSS-3D/SVG scene baker. */
export const CHROMIUM_LAUNCH_ARGS = LAUNCH_ARGS;

/** Launch args for baking the WebGL World — software GL via SwiftShader (see above). */
export const CHROMIUM_WEBGL_ARGS = WEBGL_LAUNCH_ARGS;

/** Reset the memoized resolution (tests). */
export function _resetChromiumCache() {
  cachedExecutable = null;
}
