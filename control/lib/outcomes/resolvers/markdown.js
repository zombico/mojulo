/**
 * Markdown resolver — turns a `markdown`-typed stash item (or any item with
 * `body_md`) into rendered HTML for embedding into a published page element.
 *
 * Thin wrapper over the shared `renderMarkdown` helper so kinds can call a
 * resolver-per-type uniformly without each one importing markdown.js directly.
 *
 * Used by `picture_book` (captions), `slide_deck` (slide body), and any
 * future kind that surfaces per-item prose. See lib/outcomes/PUBLISHER.plan.md.
 */

import { renderMarkdown } from '../markdown.js';

/**
 * Resolve a stash item's markdown body to HTML. If the item has no body_md,
 * returns null — caller decides whether that's a "no caption" empty state or
 * a fatal contract violation.
 *
 * @param {object} item — the stash item
 * @returns {{ html: string|null, raw: string|null }}
 */
export function resolveMarkdownItem(item) {
  const raw = item?.bodyMd ?? null;
  if (!raw || typeof raw !== 'string' || raw.length === 0) {
    return { html: null, raw: null };
  }
  return { html: renderMarkdown(raw), raw };
}

/** Render a free-floating markdown string (not from a stash item). */
export function resolveMarkdownString(md) {
  if (!md || typeof md !== 'string' || md.length === 0) {
    return { html: null, raw: null };
  }
  return { html: renderMarkdown(md), raw: md };
}
