/**
 * The one-time downloads a tool call can sit behind (Chrome for Testing, ffmpeg), kept so the
 * soft tool timeout (lib/mcp/telemetry.js) can name them. The download notice normally rides in
 * the tool's result (`browser_download`), and a call that runs past its budget never returns one,
 * so the timeout error says what was being fetched instead. Stderr logs each download as well.
 */

const MAX_KEPT = 8;
const entries = [];

/**
 * Run `fn`, a download, recorded under `description` (for example "Chrome for Testing 154.0.8037.57
 * (~500 MB) into ~/.mojulo/chromium").
 * @template T
 * @param {string} description
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function trackDownload(description, fn) {
  const entry = { description, startedAt: Date.now(), done: false };
  entries.push(entry);
  if (entries.length > MAX_KEPT) entries.splice(0, entries.length - MAX_KEPT);
  try {
    return await fn();
  } finally {
    entry.done = true;
  }
}

/**
 * Downloads still running, or started at or after `since` (ms since the epoch): what a call that
 * began at `since` may have waited on.
 * @param {number} since
 * @returns {{ description: string, done: boolean }[]}
 */
export function downloadsSince(since) {
  return entries
    .filter((e) => !e.done || e.startedAt >= since)
    .map(({ description, done }) => ({ description, done }));
}

/** Tests only. */
export function _resetDownloadLog() {
  entries.length = 0;
}
