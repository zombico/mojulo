/**
 * Consent for the Chrome for Testing download (~500 MB), kept apart from
 * chromium.js so a tool module can import it without pulling in puppeteer.
 *
 * resolveChromium never downloads a browser on its own. A render reaches the
 * download only when it runs inside withChromiumFetch, and the entry points that
 * do so are the explicit ones: forge_motion, export_game's hangar portraits,
 * create_game with auto_audit, and the dashboard's PNG download when the request
 * is a person's or an agent's own (not another web page's <img> or fetch; see
 * isExplicitRequest below). Each puts the
 * returned notice in its result, so the download is never silent. The mint-time
 * warm (scene-png-warm.js) runs inside withoutChromiumFetch, and gallery
 * thumbnails and strips run outside any scope, so neither can start it.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const scopes = new AsyncLocalStorage();

/**
 * Run `fn` with consent to download Chrome for Testing when no browser is found.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ value: T, fetched: null | { build: string, dir: string, notice: string } }>}
 *   `fetched` is set when this render made the download; put its notice in the result.
 */
export async function withChromiumFetch(fn) {
  const scope = { allow: true, fetched: null };
  const value = await scopes.run(scope, fn);
  return { value, fetched: scope.fetched };
}

/**
 * True when an HTTP request is a person's or an agent's own act: a same-origin request (a dashboard
 * click), one with Sec-Fetch-Site none (a typed or opened URL), a user-activated navigation, or a
 * request with no fetch-metadata headers (an agent's fetch). An <img> or fetch another web page
 * points at the dashboard is none of these, so it never gets the download.
 * @param {Headers} headers
 */
export function isExplicitRequest(headers) {
  const site = headers.get('sec-fetch-site');
  if (!site || site === 'same-origin' || site === 'none') return true;
  return headers.get('sec-fetch-mode') === 'navigate' && headers.get('sec-fetch-user') === '?1';
}

/** Run `fn` with the download refused, even when the caller consented (background work). */
export function withoutChromiumFetch(fn) {
  return scopes.run({ allow: false, fetched: null }, fn);
}

/** True inside withChromiumFetch (and not inside a nested withoutChromiumFetch). */
export function chromiumFetchAllowed() {
  return scopes.getStore()?.allow === true;
}

/** Tell the consenting scope that its render downloaded the browser. */
export function recordChromiumFetch({ build, dir }) {
  const scope = scopes.getStore();
  const fetched = {
    build,
    dir,
    notice:
      `Downloaded Chrome for Testing ${build} (~500 MB on disk) into ${dir} to render this. `
      + 'It is reused from there; installing Chrome, Chromium, Edge or Brave, or setting MOJULO_CHROMIUM, '
      + 'avoids the download.',
  };
  if (scope) scope.fetched = fetched;
  return fetched;
}
