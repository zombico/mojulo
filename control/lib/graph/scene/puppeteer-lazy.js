/**
 * puppeteer-core, loaded on the first browser launch instead of at import (lib/lazy-deps.js says
 * why). chromium.js, scene-png.js and motion/world-frames.js all sit on the stdio boot path.
 *
 * Callers that launch a browser load it BEFORE resolveChromium(): a missing puppeteer-core is then a
 * DependencyUnavailableError, not a string of failed launch probes that ends in a Chrome download.
 */

import { lazyDependency } from '@/lib/lazy-deps';

export const loadPuppeteer = lazyDependency(
  'puppeteer-core',
  async () => (await import('puppeteer-core')).default,
  'drives headless Chromium for PNG renders and World frame capture',
);

/** Stand-in for the default export where only `launch` is called (chromium.js's probe). */
export const puppeteer = {
  launch: async (options) => (await loadPuppeteer()).launch(options),
};
