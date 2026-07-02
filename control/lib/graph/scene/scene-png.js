/**
 * Scene HTML → PNG buffer (headless rasterizer for the "save a PNG of a scene"
 * path). CSS preserve-3d scenes — fractal cities, transportation hubs, solid
 * turntables, rooms — render hard live; the gallery bakes them to a still image
 * so a thumbnail doesn't spin up a 3D engine per card.
 *
 * The HTML is the SAME markup the live /scene viewer serves (via scene-html.js),
 * loaded in a resolved Chromium (chromium.js) and screenshotted at the scene's
 * own canvas element so there's no surrounding page chrome or letterboxing.
 */

import puppeteer from 'puppeteer-core';

import { resolveChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } from '@/lib/graph/scene/chromium';

// The scene emitters wrap their canvas in one of these (`.viewport` for the
// preserve-3d scene/city/hub, `.stage` for the solid turntable). Screenshotting
// that element clips exactly to the rendered scene, dropping the centered-flex
// body padding and any overlaid control/hint UI.
const SCENE_ROOT_SELECTORS = ['.viewport', '.stage'];

// Overlaid affordances that exist only for live interaction — hidden before the
// shot so the baked still is just the scene.
const HIDE_SELECTORS = ['#ctrl', '.ctrl', '.hint', '.controls'];

/**
 * Rasterize a self-contained scene HTML document to a PNG buffer.
 *
 * @param {string} html — a full scene HTML document (from renderSceneHtml)
 * @param {object} [opts]
 * @param {number} [opts.deviceScaleFactor=2] — pixel density (2 = crisp/retina)
 * @param {number} [opts.settleMs=1500] — wait after DOM parse so the heavy
 *   preserve-3d layout/paint + per-frame shading loop settle (and a turntable
 *   reaches a representative angle) before the shot
 * @param {number} [opts.timeoutMs=60000] — overall navigation/launch timeout
 * @returns {Promise<Buffer>} PNG bytes
 */
export async function renderSceneToPng(html, { deviceScaleFactor = 2, settleMs = 1500, timeoutMs = 60000 } = {}) {
  if (!html || typeof html !== 'string') {
    throw new Error('renderSceneToPng requires scene HTML');
  }
  const executablePath = await resolveChromium();

  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: CHROMIUM_LAUNCH_ARGS,
      timeout: timeoutMs,
    });
    const page = await browser.newPage();
    // Generous viewport: bigger than any scene canvas (city is 1120×780) so the
    // canvas is never clipped before the element screenshot crops to it.
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor });
    // The scene is a large, fully self-contained document (no subresources) whose
    // cost is preserve-3d layout/paint, not network — so wait on DOM parse, not
    // 'load'/'networkidle' (which the heavy layout can push past any timeout).
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Best-effort font readiness (never let it hang the bake), then a settle so the
    // heavy layout + rAF shading loop have painted and a turntable has rotated off
    // dead-front into a more dimensional pose.
    await Promise.race([
      page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {}),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await new Promise((r) => setTimeout(r, settleMs));
    await page.evaluate((hide) => {
      for (const sel of hide) {
        for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
      }
    }, HIDE_SELECTORS);

    let target = null;
    for (const sel of SCENE_ROOT_SELECTORS) {
      target = await page.$(sel);
      if (target) break;
    }

    const shot = target
      ? await target.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(shot);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// The three.js World (scene-three.js) wraps its canvas in `#wrap`; screenshotting
// that element clips to the rendered viewport, dropping body padding.
const WORLD_ROOT_SELECTOR = '#wrap';
// The World's live-only overlays: `.hud` camera presets (top-left), `.hint`
// controls legend (bottom-right) — hidden so the baked still is just the scene.
const WORLD_HIDE_SELECTORS = ['.hud', '.hint'];

/**
 * Rasterize a navigable three.js World (scene-three.js `emitThreeWorld`) to a PNG.
 *
 * Distinct from `renderSceneToPng` in two ways the WebGL backend forces:
 *   1. Software GL — launches with `CHROMIUM_WEBGL_ARGS` (SwiftShader). The default
 *      args pass `--disable-gpu`, which renders a WebGL canvas BLANK.
 *   2. Self-contained input — the World loads three.js from an importmap. Pass HTML
 *      emitted with `inline: true` so three is base64-embedded and resolves with no
 *      origin and no network; the `cdn:`/default importmaps point at a URL `setContent`
 *      can't resolve (no origin) or shouldn't depend on here (network), so the offline
 *      bake stays on `inline:`.
 *
 * @param {string} html — a self-contained World document (emitThreeWorld({ inline: true }))
 * @param {object} [opts]
 * @param {number} [opts.width=1120] — viewport width (the World sizes its canvas to the window)
 * @param {number} [opts.height=780] — viewport height
 * @param {number} [opts.deviceScaleFactor=2] — pixel density (2 = crisp/retina)
 * @param {number} [opts.settleMs=2500] — wait after parse so WebGL init + the first
 *   render frames paint before the shot
 * @param {number} [opts.timeoutMs=60000] — overall navigation/launch timeout
 * @returns {Promise<Buffer>} PNG bytes
 */
export async function renderWorldToPng(html, {
  width = 1120,
  height = 780,
  deviceScaleFactor = 2,
  settleMs = 2500,
  timeoutMs = 60000,
} = {}) {
  if (!html || typeof html !== 'string') {
    throw new Error('renderWorldToPng requires World HTML');
  }
  const executablePath = await resolveChromium();

  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: CHROMIUM_WEBGL_ARGS,
      timeout: timeoutMs,
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    await Promise.race([
      page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {}),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    // WebGL needs a few rAF frames to initialize the context and draw; the settle
    // covers context creation + the first render pass before we screenshot.
    await new Promise((r) => setTimeout(r, settleMs));
    await page.evaluate((hide) => {
      for (const sel of hide) {
        for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
      }
    }, WORLD_HIDE_SELECTORS);

    const target = await page.$(WORLD_ROOT_SELECTOR);
    const shot = target
      ? await target.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(shot);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
