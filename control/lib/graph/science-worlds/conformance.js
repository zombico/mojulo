/**
 * The shader conformance gate: is what a shader-drawn science page computes what the solver computes? A shader runs
 * on the GPU, where the solver cannot see it, so the page is loaded in headless Chrome (capture mode) and asked:
 *
 *   VALUE probes  — the page's own model function `sciValue(a, b)` at given inputs (the probe bridge,
 *                   channels/science.js `__sciProbe`), against the value JS computes for the same input.
 *   IMAGE probes  — a frame rendered from a given camera and read back (`__sciPixels`), measured by a function
 *                   (the radius of a dark disk, a ring's position), against JS's prediction for that camera.
 *
 * The gate advises like every gate. Without a browser it is `ran: false` ("not run"), never a refusal and never a
 * pass: `ok` is null then. The mint never launches a browser; the e2e tier and scripts/science-conformance.mjs do.
 *
 *   valueProbe = { id, a: [x, y, z, w], b?: [x, y, z, w], expect: number | number[], tol, rel? }
 *   imageProbe = { id, camera: { pos, target, vfov }, measure(frame) → number, expect, tol }
 *     frame = { width, height, rgba: Uint8Array }, rows bottom-up (gl.readPixels order)
 */

import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

const sig = (v, n = 4) => (Number.isFinite(v) ? +v.toPrecision(n) : v);

/** Judge the read-back values against their probes. Pure: the gate's verdict from numbers. */
export function judge({ values = [], images = [] }, { values: vOut = [], images: iOut = [] }) {
  const rows = [];
  values.forEach((p, i) => {
    const got = vOut.slice(i * 4, i * 4 + 4), want = Array.isArray(p.expect) ? p.expect : [p.expect];
    let worst = 0;
    want.forEach((w, k) => {
      const e = Math.abs(got[k] - w) / (p.rel ? Math.max(Math.abs(w), 1e-30) : 1);
      worst = Math.max(worst, Number.isFinite(e) ? e : Infinity);
    });
    rows.push({ id: p.id, kind: 'value', error: worst, tol: p.tol, ok: worst <= p.tol, got: got.slice(0, want.length).map((v) => sig(v, 6)), want: want.map((v) => sig(v, 6)) });
  });
  images.forEach((p, i) => {
    const got = iOut[i];
    const error = Math.abs(got - p.expect);
    rows.push({ id: p.id, kind: 'image', error: Number.isFinite(error) ? error : Infinity, tol: p.tol, ok: error <= p.tol, got: sig(got, 5), want: sig(p.expect, 5) });
  });
  const worst = rows.reduce((w, r) => (!w || r.error / (r.tol || 1) > w.error / (w.tol || 1) ? r : w), null);
  return { ok: rows.every((r) => r.ok), rows, worst };
}

/** The gate row a conformance run reports, in the solver's gate shape. */
export function conformanceGate(result) {
  if (!result.ran) {
    return { id: 'shader-conformance', want: 'the picture the shader draws is computed from the solver\'s numbers', ok: null, ran: false, value: null, detail: `not run: ${result.why}` };
  }
  const { ok, rows, worst } = result;
  return {
    id: 'shader-conformance', want: 'the picture the shader draws is computed from the solver\'s numbers', ok, ran: true,
    value: { probes: rows.length, worst: worst ? { id: worst.id, error: sig(worst.error, 3), tol: worst.tol } : null },
    detail: ok ? 'every probe of the shader agrees with JS' : `disagrees: ${rows.filter((r) => !r.ok).map((r) => r.id).join(', ')}`,
  };
}

/**
 * Run a shader page's probes in headless Chrome. `payload` is the World payload (emitThreeWorld's input) whose
 * `science.probe` the page's assembler set (shader.js shaderPage). Resolves `{ ran, why? , ok, rows, worst }`.
 * `browser` is a test seam: an object with `values(html, pairs)` and `images(html, cameras)` replacing Chrome.
 */
export async function runConformance(payload, { values = [], images = [] }, { width = 320, height = 240, timeoutMs = 120000, browser = null } = {}) {
  if (!payload?.science?.probe) throw new Error('science-worlds: conformance needs a payload whose science block carries its shader probe');
  const html = emitThreeWorld({ ...payload, inline: true, capture: true });
  const pairs = values.map((p) => [p.a, p.b || [0, 0, 0, 0]]);
  const cameras = images.map((p) => p.camera);
  let drive = browser;
  if (!drive) {
    try { drive = await chromeDriver({ width, height, timeoutMs }); } catch (err) { return { ran: false, why: `no browser (${String(err.message || err).split('\n')[0]})` }; }
  }
  try {
    const vOut = values.length ? await drive.values(html, pairs) : [];
    const frames = images.length ? await drive.images(html, cameras) : [];
    const iOut = images.map((p, i) => p.measure(frames[i]));
    return { ran: true, ...judge({ values, images }, { values: vOut, images: iOut }) };
  } finally {
    if (drive.close) await drive.close();
  }
}

// one Chrome per run: the page is loaded once per call, in capture mode, at the given size
async function chromeDriver({ width, height, timeoutMs }) {
  const { loadPuppeteer } = await import('@/lib/graph/scene/puppeteer-lazy');
  const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');
  await loadPuppeteer();
  const executablePath = await resolveChromium();
  const browser = await launchChromium({ executablePath, headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: timeoutMs });
  const open = async (html) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready === true && typeof window.__sciProbe === 'function', { timeout: timeoutMs });
    // the capture owns the framing: size the wrap to the frame and let the page's resize handler fix the renderer
    await page.evaluate((w, h) => {
      const el = document.querySelector('#wrap');
      if (el) { el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.maxWidth = 'none'; el.style.aspectRatio = 'auto'; }
      window.dispatchEvent(new Event('resize'));
    }, width, height);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    return page;
  };
  return {
    async values(html, pairs) {
      const page = await open(html);
      try { return await page.evaluate((p) => window.__sciProbe(p), pairs); } finally { await page.close(); }
    },
    async images(html, cameras) {
      const page = await open(html);
      try {
        const out = [];
        for (const c of cameras) {
          // eslint-disable-next-line no-await-in-loop -- frames share one context
          const f = await page.evaluate((s) => window.__sciPixels(s), { pos: c.pos, target: c.target, vfov: c.vfov, t: 0 });
          out.push({ width: f.width, height: f.height, rgba: new Uint8Array(Buffer.from(f.rgba, 'base64')) });
        }
        return out;
      } finally { await page.close(); }
    },
    close: () => browser.close().catch(() => {}),
  };
}

/** A common image measure: the radius, in pixels, of the region darker than `below` (0–255 luminance), as √(area/π). */
export function darkDiskRadius(frame, { below = 8 } = {}) {
  let n = 0;
  for (let i = 0; i < frame.rgba.length; i += 4) {
    const L = 0.2126 * frame.rgba[i] + 0.7152 * frame.rgba[i + 1] + 0.0722 * frame.rgba[i + 2];
    if (L < below) n++;
  }
  return Math.sqrt(n / Math.PI);
}
