/**
 * THE PRINTER — a press page (book-press.js) printed to PDF by headless Chromium, the browser the scene bakes already
 * resolve (scene/chromium.js: an explicit binary, the cached build, a system browser, or a fetch only with consent and
 * never under the plugin profile). The page sets its own paper by `@page`, so the PDF is the page as the style laid it:
 * its size, its margins, the running title and the page numbers, the colours printed (`printBackground`), the inlined
 * faces embedded, the headings as the PDF's outline.
 *
 *   printPdf(html, { allowFetch? }) → Buffer   throws when no browser can be had (the error says how to get one)
 *
 * A PDF carries its own creation date, so two prints of one book are equal page for page, not byte for byte: the
 * page (bookHtml) is the recipe's deterministic artifact, the PDF its print.
 */
import { loadPuppeteer } from '../scene/puppeteer-lazy.js';
import { resolveChromium, launchChromium } from '../scene/chromium.js';

export async function printPdf(html, { allowFetch } = {}) {
  await loadPuppeteer();
  const executablePath = await resolveChromium({ allowFetch });
  const browser = await launchChromium({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
