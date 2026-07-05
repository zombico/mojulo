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
import {
  CAPTURE_GLOBAL, CAPTURE_READY, CAPTURE_FRAME, CAPTURE_STEP, CAPTURE_PROBE,
  CAPTURE_COMPILE_WALK_TO, WORLD_ROOT_SELECTOR, WORLD_HIDE_SELECTORS,
} from '@/lib/graph/scene/capture-contract';

// the bridge names ride into every page.evaluate as an argument — browser closures
// can't capture node-scope imports, so the contract crosses the seam explicitly.
const BRIDGE = { g: CAPTURE_GLOBAL, ready: CAPTURE_READY, frame: CAPTURE_FRAME, step: CAPTURE_STEP, probe: CAPTURE_PROBE, compile: CAPTURE_COMPILE_WALK_TO };

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
    await page.waitForFunction((b) => window[b.g] && window[b.g][b.ready] === true, { timeout: timeoutMs }, BRIDGE);

    // Hide live-only overlays so the bake is just the scene.
    await page.evaluate((hide) => {
      for (const sel of hide) for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
    }, WORLD_HIDE_SELECTORS);

    const pngs = [];
    for (const spec of specs) {
      // eslint-disable-next-line no-await-in-loop -- frames are ordered + share one context
      await page.evaluate((s, b) => window[b.g][b.frame](s), spec, BRIDGE);
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

/**
 * Replay an input-driven TRAVERSAL through a capture-mode World (renderer-ladder P3).
 *
 * Where renderWorldFrames flies a camera over a time-parameterized world, this drives the
 * world's LIVE channels (controllable entities, physics, events) one fixed tick at a time via
 * `window.__mojCapture.step({ dt, input })` — the same runtime the interactive page runs, under
 * a recorded input script. After every tick it reads `__mojCapture.probe()` (entity transforms,
 * HUD/bus vars, physics bodies), so a traversal yields BOTH the raster frames for an MP4/GIF and
 * a per-tick probe stream to assert against ("the player reached the exit; score is 2").
 * Deterministic: the model layer is wall-clock-free, so same ticks → identical probes + frames.
 *
 * @param {string} html  a self-contained World — emitThreeWorld({ inline:true, capture:true })
 * @param {Array<object|null>} ticks  one normalized input snapshot per tick (null/{} = no input);
 *   entries may also carry an explicit per-tick camera for chase shots: { input, pos, target }.
 * @param {object} [opts]
 * @param {number} [opts.fps=24]      tick rate — dt is 1/fps, and the natural encode fps
 * @param {number} [opts.width=720]
 * @param {number} [opts.height=540]
 * @param {boolean} [opts.frames=true]   screenshot every tick (false = probes only, much faster)
 * @param {number} [opts.settleMs=2000]
 * @param {number} [opts.timeoutMs=120000]
 * @returns {Promise<{ pngs: Buffer[], probes: object[], width, height, fps }>}
 */
export async function renderWorldTraversal(html, ticks, {
  fps = 24,
  width = 720,
  height = 540,
  deviceScaleFactor = 1,
  frames = true,
  settleMs = 2000,
  timeoutMs = 120000,
} = {}) {
  if (!html || typeof html !== 'string') throw new Error('renderWorldTraversal requires World HTML');
  if (!Array.isArray(ticks) || !ticks.length) throw new Error('renderWorldTraversal requires ≥1 input tick');
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
    await new Promise((r) => setTimeout(r, settleMs));
    await page.waitForFunction((b) => window[b.g] && window[b.g][b.ready] === true, { timeout: timeoutMs }, BRIDGE);
    await page.evaluate((hide) => {
      for (const sel of hide) for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
    }, WORLD_HIDE_SELECTORS);

    const dt = 1 / Math.max(1, fps);
    const pngs = [];
    const probes = [];
    for (const tick of ticks) {
      const t = tick && typeof tick === 'object' ? tick : {};
      // eslint-disable-next-line no-await-in-loop -- ticks are ordered + share one context
      const probe = await page.evaluate((s, b) => {
        window[b.g][b.step](s);
        return window[b.g][b.probe]();
      }, { dt, input: t.input || t, pos: t.pos, target: t.target }, BRIDGE);
      probes.push(probe);
      if (frames) {
        // eslint-disable-next-line no-await-in-loop
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
        // eslint-disable-next-line no-await-in-loop
        const target = await page.$(WORLD_ROOT_SELECTOR);
        // eslint-disable-next-line no-await-in-loop
        const shot = target ? await target.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png', fullPage: false });
        pngs.push(Buffer.from(shot));
      }
    }

    return { pngs, probes, width, height, fps };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Compile a waypoint route into a traversal tick script (renderer-convergence step 3).
 *
 * Loads the capture-mode World ONCE and drives `__mojCapture.compileWalkTo` leg by leg —
 * closed-loop steering against the live walk/platform rule, in-page, so the compiler can
 * never disagree with the rule it steers. The returned `ticks` are a plain Phase-3 input
 * script: replay them (renderWorldTraversal, on a FRESH load — compiling stepped this one)
 * and every determinism/probe guarantee holds by construction.
 *
 * No pathfinding in v1: each leg is greedy seek + the rule's own wall slide. A blocked leg
 * reports `{ stuck: true, atTick }` and compilation stops there — recorded, never an
 * infinite loop.
 *
 * @param {string} html  emitThreeWorld({ inline:true, capture:true }) document
 * @param {Array<[x,y] | {target:[x,y], id?, arrive?, maxTicks?}>} waypoints
 * @returns {Promise<{ ticks: object[], legs: object[], arrived: boolean }>}
 */
export async function compileWorldWaypoints(html, waypoints, {
  fps = 24,
  id = null,
  settleMs = 2000,
  timeoutMs = 240000,
} = {}) {
  if (!html || typeof html !== 'string') throw new Error('compileWorldWaypoints requires World HTML');
  if (!Array.isArray(waypoints) || !waypoints.length) throw new Error('compileWorldWaypoints requires ≥1 waypoint');
  const executablePath = await resolveChromium();
  let browser = null;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: timeoutMs });
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 240 });   // compile pass renders tiny — probes, not pictures
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await new Promise((r) => setTimeout(r, settleMs));
    await page.waitForFunction((b) => window[b.g] && window[b.g][b.ready] === true, { timeout: timeoutMs }, BRIDGE);
    const dt = 1 / Math.max(1, fps);
    const ticks = [];
    const legs = [];
    for (const wp of waypoints) {
      const spec = Array.isArray(wp) ? { target: wp } : { ...wp };
      // eslint-disable-next-line no-await-in-loop -- legs are ordered and share the live world
      const leg = await page.evaluate((s, b) => window[b.g][b.compile](s), { dt, id, ...spec }, BRIDGE);
      legs.push({ target: spec.target, arrived: !!leg.arrived, at: leg.at || null, ticksUsed: (leg.ticks || []).length, ...(leg.stuck ? { stuck: true, atTick: leg.atTick } : {}) });
      ticks.push(...(leg.ticks || []));
      if (!leg.arrived) break;                              // a blocked leg ends the route — recorded above
    }
    return { ticks, legs, arrived: legs.length === waypoints.length && legs.every((l) => l.arrived) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
