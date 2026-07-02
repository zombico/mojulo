/**
 * Motion — three.js World frame capture (the WebGL frame source for forge_motion's
 * world subject family). A traversable World (scene-three.js `emitThreeWorld`,
 * emitted with `capture:true`) is loaded ONCE in a resolved Chromium + SwiftShader,
 * then driven a frame at a time via the page's `window.__mojCapture.frame(spec)`
 * hook: the driver sets the camera (pos/target/vfov) + sim-time and renders, then
 * screenshots the `#wrap` canvas. One WebGL context + one geometry upload serves the
 * whole clip, so capture cost is per-frame screenshot, not per-frame WebGL init.
 *
 * Sibling to scene-png.renderWorldToPng (which bakes a single still); this is the
 * looped, camera-driven form. Returns uniform PNG buffers the gif/mp4 encoders consume.
 */

import puppeteer from 'puppeteer-core';

import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '@/lib/graph/scene/chromium';

const WORLD_ROOT_SELECTOR = '#wrap';
const WORLD_HIDE_SELECTORS = ['.hud', '.hint'];

/**
 * Capture an ordered list of camera frames from a capture-mode World HTML.
 *
 * @param {string} html        a self-contained World document — emitThreeWorld({ inline:true, capture:true })
 * @param {Array<{pos:number[],target:number[],vfov:number,t?:number}>} specs  per-frame camera + sim-time
 * @param {object} [opts]
 * @param {number} [opts.width=720]   capture viewport width
 * @param {number} [opts.height=540]  capture viewport height
 * @param {number} [opts.deviceScaleFactor=1]
 * @param {number} [opts.settleMs=2000]  wait after parse so WebGL init + first paint settle
 * @param {number} [opts.timeoutMs=120000]
 * @returns {Promise<{ pngs: Buffer[], width: number, height: number }>}
 */
export async function renderWorldFrames(html, specs, {
  width = 720,
  height = 540,
  deviceScaleFactor = 1,
  settleMs = 2000,
  timeoutMs = 120000,
} = {}) {
  if (!html || typeof html !== 'string') throw new Error('renderWorldFrames requires World HTML');
  if (!Array.isArray(specs) || !specs.length) throw new Error('renderWorldFrames requires ≥1 camera spec');
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

    // Best-effort font readiness, then let the WebGL context create + first paint settle
    // before we start driving frames (the capture hook is published on first render).
    await Promise.race([
      page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {}),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await new Promise((r) => setTimeout(r, settleMs));

    // Wait for the capture bridge to come up (it's published once the module script runs
    // its first render). Poll briefly rather than assume it's there at domcontentloaded.
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready === true, { timeout: timeoutMs });

    // Hide live-only overlays so the bake is just the scene.
    await page.evaluate((hide) => {
      for (const sel of hide) for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
    }, WORLD_HIDE_SELECTORS);

    const pngs = [];
    for (const spec of specs) {
      // eslint-disable-next-line no-await-in-loop -- frames are ordered + share one context
      await page.evaluate((s) => window.__mojCapture.frame(s), spec);
      // a rAF tick so the just-issued render is presented before the screenshot
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
      // eslint-disable-next-line no-await-in-loop
      const target = await page.$(WORLD_ROOT_SELECTOR);
      // eslint-disable-next-line no-await-in-loop
      const shot = target
        ? await target.screenshot({ type: 'png' })
        : await page.screenshot({ type: 'png', fullPage: false });
      pngs.push(Buffer.from(shot));
    }

    return { pngs, width, height };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
