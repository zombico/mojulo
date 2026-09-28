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
 *      The download comes from storage.googleapis.com and is unpacked by running
 *      the system `unzip` (`tar.exe` or PowerShell on Windows); @puppeteer/browsers
 *      3 has no built-in unzip or proxy support, so a host behind an HTTP proxy
 *      points $MOJULO_CHROMIUM at an installed browser instead.
 *
 * Integrity gate: a functional headless launch (open + close), the same "does it
 * actually run" gate ffmpeg.js applies with `-version`. A wrong/corrupt binary
 * fails the gate and we surface an actionable error pointing at `brew install`
 * and the $MOJULO_CHROMIUM override.
 *
 * Sandbox: Chromium keeps its own sandbox (the pages are agent-generated HTML).
 * Only Linux ever drops it: as root, or after a sandboxed launch failed with one
 * of Chrome's sandbox errors; see launchChromium.
 *
 * CONTROL-PLANE concern only. The Debian-slim / glibc bot-image rules in CLAUDE.md
 * govern the bot image, not this path; the control plane is single-user/self-hosted.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { puppeteer } from '@/lib/graph/scene/puppeteer-lazy';

import { installedGroups } from '@/lib/mcp/packs';
import { chromiumFetchAllowed, recordChromiumFetch } from '@/lib/graph/scene/chromium-consent';
import { trackDownload } from '@/lib/net/download-log';

// The Chrome-for-Testing build fetched on first use: the one the installed
// puppeteer-core is released against (its PUPPETEER_REVISIONS.chrome), so a
// puppeteer bump moves this pin in the same commit; chromium.test.js fails until
// it does. One buildId covers every platform through detectBrowserPlatform.
// $MOJULO_CHROMIUM_BUILD overrides it.
export const PINNED_CHROME_BUILD = '154.0.8037.57';
const CHROME_BUILD = process.env.MOJULO_CHROMIUM_BUILD || PINNED_CHROME_BUILD;

// No --no-sandbox here: launchChromium adds it on Linux only, as a fallback.
const LAUNCH_ARGS = ['--disable-gpu'];

// WebGL launch args for the navigable three.js World (scene-three.js → /world).
// The default LAUNCH_ARGS pass `--disable-gpu`, which is correct for the CSS-3D
// preserve-3d and SVG bakes (deterministic, no GL needed) but yields a BLANK
// canvas for a WebGL page. Headless WebGL needs a software GL backend: route GL
// through ANGLE's SwiftShader (CPU) rasterizer instead of disabling the GPU.
// `--enable-unsafe-swiftshader` opts into SwiftShader on Chrome builds that
// otherwise gate it; `--ignore-gpu-blocklist` keeps a blocklisted host from
// silently falling back to no-GL.
const WEBGL_LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

// The Linux fallback when Chromium's sandbox cannot start (see launchChromium).
const NO_SANDBOX_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

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

// Set once this Linux host has shown it cannot run the sandbox (a launch failed
// with one of Chrome's sandbox errors, or the process is root); later launches
// go straight to the fallback instead of failing first every time.
let linuxSandboxUnavailable = false;

// Chrome's own words when its sandbox cannot start. puppeteer puts the browser's
// recent stderr in the launch error's message, so they are matched there; a
// timeout, a missing library or a spawn failure never matches, and never drops
// the sandbox.
const SANDBOX_FAILURE = /No usable sandbox|setuid sandbox|SUID sandbox|Running as root without --no-sandbox|Failed to move to new namespace|user namespace/i;

/** The line of a launch error that names a sandbox failure, or null when it is some other failure. */
export function sandboxFailureLine(err) {
  const lines = String(err?.message || err || '').split('\n');
  return lines.find((line) => SANDBOX_FAILURE.test(line))?.trim().slice(0, 200) || null;
}

/**
 * puppeteer.launch with Chromium's sandbox on. macOS and Windows always launch
 * sandboxed. A Linux container or CI runner often lacks the unprivileged user
 * namespaces the sandbox needs, so there a sandboxed launch that fails with one
 * of Chrome's sandbox errors is retried once with --no-sandbox, the fallback is
 * logged to stderr, and later launches reuse it. Chrome never sandboxes as
 * root, so a root process starts on the fallback. Any other failure (a launch
 * timeout under load, a missing library, a spawn error) is thrown as it is and
 * leaves the sandbox on for the next launch.
 *
 * @param {object} opts  puppeteer.launch options; `args` defaults to the CSS-3D/SVG bake args
 * @param {object} [seams]  tests only: { platform, launch, uid }
 */
export async function launchChromium(
  opts = {},
  { platform = process.platform, launch = (o) => puppeteer.launch(o), uid = process.getuid?.() } = {},
) {
  const sandboxed = { headless: true, ...opts, args: opts.args || LAUNCH_ARGS };
  if (platform !== 'linux') return launch(sandboxed);
  const unsandboxed = { ...sandboxed, args: [...NO_SANDBOX_ARGS, ...sandboxed.args] };
  if (!linuxSandboxUnavailable && uid === 0) {
    linuxSandboxUnavailable = true;
    console.error('[mojulo] Running as root, where Chromium cannot keep its sandbox: launching it with --no-sandbox.');
  }
  if (linuxSandboxUnavailable) return launch(unsandboxed);
  try {
    return await launch(sandboxed);
  } catch (err) {
    const why = sandboxFailureLine(err);
    if (!why) throw err;
    let browser;
    try {
      browser = await launch(unsandboxed);
    } catch {
      throw err; // fails either way: report the sandboxed attempt
    }
    linuxSandboxUnavailable = true;
    console.error(
      `[mojulo] Chromium would not start with its sandbox on this Linux host (${why}). `
        + 'Running it with --no-sandbox for the rest of this process; containers and CI runners '
        + 'often lack the user namespaces the sandbox needs.',
    );
    return browser;
  }
}

/** Resolve true if `executablePath` launches headless and closes cleanly. */
async function probe(executablePath) {
  let browser = null;
  try {
    browser = await launchChromium({ executablePath, args: LAUNCH_ARGS });
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
  const installed = await trackDownload(`Chrome for Testing ${buildId} (~500 MB on disk) into ${cacheDir}`, () =>
    install({ browser: Browser.CHROME, buildId, cacheDir }));
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
 * @returns {Promise<string>} an executable path suitable for launchChromium()
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
  // the creative pack. Creative ships with every install, so only a MOJULO_PACKS
  // override that leaves it out lands here; that install sheds the browser entirely.
  // All the cheap detection above (override / cached fetch / system browser) still
  // runs — only the heavy FETCH is gated.
  if (!installedGroups().has('creative')) {
    throw new Error(
      'Scene-PNG rendering is a creative-pack capability and MOJULO_PACKS gates the creative pack off '
        + "here, so no Chromium was auto-fetched (that download is ~500 MB). Include 'creative' in "
        + 'MOJULO_PACKS, or point $MOJULO_CHROMIUM at an existing Chrome / Chromium / Edge binary.',
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

/** Reset the memoized resolution and the Linux sandbox fallback (tests). */
export function _resetChromiumCache() {
  cachedExecutable = null;
  linuxSandboxUnavailable = false;
}
