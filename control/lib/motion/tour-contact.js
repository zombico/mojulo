/**
 * A tour's CONTACT SHEET, shot: the exhibit's own page opened in a resolved Chromium, each stop seated in turn (no
 * easing) and photographed as a visitor meets it (the view, the lit part, the caption on its plate), read by the page's
 * own probe (exhibit/page-audit.js), and laid a row a stop (exhibit/contact.js, motion/contact-sheet.js).
 *
 *   renderTourContact({ sketch, params: { width?, height?, cell? } }) → Promise<{ png, rows, audit, width, height, cut? }>
 *
 * It is the page a visitor gets, not a capture page: the plate and the dimming are part of what is looked at.
 */
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { loadPuppeteer } from '@/lib/graph/scene/puppeteer-lazy';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '@/lib/graph/scene/chromium';
import { auditStops } from '@/lib/graph/exhibit/page-audit';
import { tourContactRows, MAX_STOPS } from '@/lib/graph/exhibit/contact';
import { composeContactSheet } from './contact-sheet.js';

const DEFAULT_W = 960, DEFAULT_H = 600, TIMEOUT = 180000;

export async function renderTourContact({ sketch, params = {} }) {
  const tour = sketch?.manifest?.tour;
  if (!tour || !Array.isArray(tour.stops) || !tour.stops.length) throw new Error(`'${sketch?.ref}' has no tour to lay out: give it stops first (update_sketch: set /tour; manual: get_view_vocab({ id: 'tour' }))`);
  const { payload } = (await resolveWorldScene(sketch, { view: params.view })) || {};
  if (!payload) throw new Error(`sketch '${sketch?.ref}' (kind '${sketch?.manifest?.kind}') has no World page a tour stands in`);
  const width = Math.round(params.width || DEFAULT_W), height = Math.round(params.height || DEFAULT_H);
  const html = emitThreeWorld({ ...payload, inline: true });
  await loadPuppeteer();
  const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: TIMEOUT, protocolTimeout: TIMEOUT });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForFunction(() => window.__mojTour, { timeout: TIMEOUT });
    const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pngs = [];
    const audit = await auditStops((fn, arg) => page.evaluate(fn, arg), { settle, each: async (i) => { if (i < MAX_STOPS) pngs.push(await page.screenshot({ type: 'png' })); } });
    const rows = tourContactRows(tour, audit);
    const png = await composeContactSheet(rows, pngs, { width, height, cell: params.cell ?? 480, thirds: params.thirds !== false });
    return { png, rows, audit, width, height, ...(tour.stops.length > MAX_STOPS ? { cut: `the sheet holds the first ${MAX_STOPS} of ${tour.stops.length} stops` } : {}) };
  } finally {
    await browser.close();
  }
}
