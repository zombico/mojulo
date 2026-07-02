/**
 * Headless-Chromium resolver for the scene PNG baker (CSS preserve-3d scenes
 * can only be rasterized faithfully by a real browser engine).
 *
 * The control plane deliberately ships no postinstall download — the embed model
 * (`fetch-embed-model.js`) and the ffmpeg binary (`lib/motion/ffmpeg.js`) are both
 * explicit/lazy so `npx mojulo` doesn't immediately pull hundreds of MB. We mirror
 * that exact stance here: DETECT a usable browser, else LAZY-FETCH a Chrome-for-
 * Testing build on the FIRST scene-PNG render (never at install), cache it, reuse.
 *
 * Resolution order:
 *   1. $MOJULO_CHROMIUM / $PUPPETEER_EXECUTABLE_PATH — an explicit pinned binary.
 *   2. A previously lazy-fetched Chrome-for-Testing build in the cache dir.
 *   3. A system browser (Chrome / Chromium / Edge / Brave) at a well-known path.
 *   4. Lazy-fetch Chrome-for-Testing via @puppeteer/browsers into the cache dir.
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

/** Where the lazy-fetched browser is cached (gitignored data dir by default). */
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

/** Lazy-fetch the pinned Chrome-for-Testing build into the cache dir. */
async function fetchChrome() {
  // Dynamic import: @puppeteer/browsers is only needed on the cold path, and this
  // keeps the resolver loadable in environments that never bake a scene.
  const { install, computeExecutablePath, detectBrowserPlatform, Browser } = await import('@puppeteer/browsers');
  const platform = detectBrowserPlatform();
  if (!platform) throw new Error('could not detect browser platform');
  const cacheDir = chromiumCacheDir();
  const buildId = CHROME_BUILD;

  const existing = computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir });
  if (existing && existsSync(existing)) return existing;

  const installed = await install({ browser: Browser.CHROME, buildId, cacheDir });
  return installed.executablePath;
}

let cachedExecutable = null;

/**
 * Resolve a usable headless-Chromium executable path, fetching one if needed.
 * @param {object} [opts]
 * @param {boolean} [opts.allowFetch=true] set false to require a pre-existing binary
 * @returns {Promise<string>} an executable path suitable for puppeteer.launch()
 */
export async function resolveChromium({ allowFetch = true } = {}) {
  if (cachedExecutable) return cachedExecutable;

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

  if (!allowFetch) throw new Error(noChromiumMessage('auto-fetch disabled'));

  let fetched;
  try {
    fetched = await fetchChrome();
  } catch (err) {
    throw new Error(noChromiumMessage(`fetch failed: ${err.message}`));
  }
  if (fetched && (await probe(fetched))) return (cachedExecutable = fetched);
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
