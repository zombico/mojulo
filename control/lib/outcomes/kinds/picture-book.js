/**
 * Picture-book outcome writer (cook template variant).
 *
 * Materializes a single-stash cook as a static HTML picture book. Each
 * sketch-typed item in the stash becomes one page; drawers become chapters.
 * The sketch's `metadata.sketch_ref` resolves to an SVG via the shared
 * `renderSketchToSvg` lib; `body_md` (optional) becomes the per-page caption.
 *
 * The folder layout matches the standard outcome writer's posture — a
 * self-contained directory the operator can zip, email, or open directly off
 * disk:
 *
 *   <OUTCOMES_DIR>/<cook_ref>/
 *     ├── report.md          — the cover blurb the agent authored (may be empty)
 *     ├── index.html         — the static picture book (the load-bearing file)
 *     ├── manifest.json      — machine-readable book structure
 *     ├── page-001.svg       — each page's illustration as a standalone file
 *     ├── page-002.svg
 *     └── …
 *
 * Frozen to its template version (PICTURE_BOOK_TEMPLATE_VERSION). No LLM call,
 * no client-side rendering, no JS framework — same posture as the standard
 * outcome writer.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomesBaseDir } from '../paths.js';
import { resolveSketchItem } from '../resolvers/sketch.js';

// Versioned `pb-<N>` so cook rows can distinguish picture-book outcomes from
// standard ones via the `template_version` column alone (no schema change
// needed — the manifest.json on disk carries the full `template` field too).
export const PICTURE_BOOK_TEMPLATE_VERSION = 'pb-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'picture_book.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() {
  return new Date().toISOString();
}

function humanNow() {
  return new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function pageNumber(n) {
  return String(n).padStart(3, '0');
}

/**
 * Build the ordered page list from a stash.
 *
 * Drawers come in `listDrawers` order (alphabetical by name in the
 * repository); items within a drawer come in `created_at ASC, id ASC` order.
 * Root items (no drawer) lead. Non-sketch items are skipped with a record in
 * `skipped_items` for the manifest.
 *
 * Returns { chapters, skippedItems } where chapters is
 *   [{ name | null (root), items: [{ stashItem, sketchRef, label, captionMd }] }]
 */
function planBookFromStash(full) {
  const { drawers, items } = full;

  // group items by drawer (use drawerId because the listItems projection
  // attaches a `drawer` name string already, but we want a stable map).
  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of drawers) byDrawerId.set(d.id, []);
  const skipped = [];
  for (const it of items) {
    if (it.type !== 'sketch') {
      skipped.push({ id: it.id, type: it.type, reason: 'picture_book template only renders sketch items' });
      continue;
    }
    const bucket = byDrawerId.get(it.drawerId === null ? null : it.drawerId);
    if (!bucket) {
      // drawerId points at a drawer we don't know about — shouldn't happen
      // (FK), but rather than crash, treat as root.
      byDrawerId.get(null).push(it);
    } else {
      bucket.push(it);
    }
  }

  // chapter order: root first (if it has any items), then drawers in
  // listDrawers order. Empty chapters are dropped.
  const chapters = [];
  const rootItems = byDrawerId.get(null);
  if (rootItems.length > 0) {
    chapters.push({ name: null, items: rootItems.map(itemToPage) });
  }
  for (const d of drawers) {
    const drawerItems = byDrawerId.get(d.id);
    if (drawerItems.length > 0) {
      chapters.push({ name: d.name, items: drawerItems.map(itemToPage) });
    }
  }
  return { chapters, skippedItems: skipped };
}

function itemToPage(stashItem) {
  return {
    stashItemId: stashItem.id,
    sketchRef: stashItem.metadata?.sketch_ref,
    label: stashItem.metadata?.label || null,
    captionMd: stashItem.bodyMd || null,
  };
}

/** Render a single chapter section (heading + its pages) to HTML. */
function renderChapter(chapter, pages, startIndex) {
  const parts = [];
  if (chapter.name) {
    const label = chapter.items.length === 1 ? '1 page' : `${chapter.items.length} pages`;
    parts.push(
      `<div class="chapter-divider" data-viewer-page><div class="label">Chapter &middot; ${escapeHtml(label)}</div><h2>${escapeHtml(chapter.name)}</h2></div>`,
    );
  }
  for (let i = 0; i < chapter.items.length; i++) {
    const page = pages[startIndex + i];
    parts.push(renderPage(page, startIndex + i + 1, chapter));
  }
  return parts.join('\n');
}

function renderPage(page, displayNumber, chapter) {
  const illustration = page.svgInline
    ? `<div class="illustration">${page.svgInline}</div>`
    : `<div class="illustration missing">missing illustration &middot; ${escapeHtml(page.sketchRef || '(no sketch_ref)')}</div>`;
  const captionHtml = page.captionMd
    ? `<div class="caption">${renderMarkdown(page.captionMd)}</div>`
    : `<div class="caption empty">(no caption)</div>`;
  const chapterLabel = chapter.name ? `${escapeHtml(chapter.name)} &middot; ` : '';
  return [
    '<section class="page" data-viewer-page>',
    illustration,
    captionHtml,
    `<div class="page-meta"><span>${chapterLabel}page ${displayNumber}</span><span>${escapeHtml(page.label || '')}</span></div>`,
    '</section>',
  ].join('\n');
}

/**
 * Write a picture-book outcome folder.
 *
 * @param {object} args
 * @param {string} args.cookRef
 * @param {string} args.aim — used as the cover title
 * @param {string} args.stashRef — the single stash the book is built from
 * @param {string} [args.reportMd] — optional cover blurb (markdown)
 * @param {string} [args.outcomeDir] — base dir override (defaults to data/outcomes/<cookRef>)
 * @returns {Promise<{ outcomeDir, indexPath, fileCount, templateVersion, pageCount, chapters, skippedItems }>}
 */
const DEFAULT_VIEWER_ASPECT = '10 / 7';

export async function writePictureBookOutcome({
  cookRef,
  aim,
  stashRef,
  reportMd = '',
  outcomeDir,
  publicationKind = 'picture_book',
  viewerAspect = DEFAULT_VIEWER_ASPECT,
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required (used as cover title)');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (picture_book template builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = planBookFromStash(full);
  const pageCount = plan.chapters.reduce((n, c) => n + c.items.length, 0);
  if (pageCount === 0) {
    throw new Error(
      `Stash '${stashRef}' has no sketch items — picture_book template needs at least one sketch-typed item to produce a page.`,
    );
  }

  // Resolve each page's sketch_ref → inline SVG body + standalone file body.
  const pages = [];
  let pageIdx = 0;
  for (const chapter of plan.chapters) {
    for (const item of chapter.items) {
      pageIdx += 1;
      const filename = `page-${pageNumber(pageIdx)}.svg`;
      const resolved = await resolveSketchItem(
        { metadata: { sketch_ref: item.sketchRef } },
        { technical: false },
      );
      pages.push({
        ...item,
        filename,
        svgInline: resolved.svgInline,
        svgStandalone: resolved.svgStandalone,
        dangling: resolved.dangling,
      });
    }
  }

  const dir = outcomeDir || path.join(outcomesBaseDir(), cookRef);
  await fs.mkdir(dir, { recursive: true });

  // 1. report.md — the cover blurb (load-bearing as source-of-truth for the cover).
  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  // 2. per-page .svg files (each live sketch gets a standalone file in the folder).
  for (const page of pages) {
    if (page.svgStandalone) {
      await fs.writeFile(path.join(dir, page.filename), page.svgStandalone, 'utf8');
    }
  }

  // 3. render index.html.
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#8a8a8a; font-style: italic;">(no inside-cover note)</p>';

  // chapters → pages_html, with running page numbers across chapters.
  const sections = [];
  let runningIdx = 0;
  for (const chapter of plan.chapters) {
    sections.push(renderChapter(chapter, pages, runningIdx));
    runningIdx += chapter.items.length;
  }

  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / picture_book template v${PICTURE_BOOK_TEMPLATE_VERSION}`),
    template_version: escapeHtml(PICTURE_BOOK_TEMPLATE_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_blurb_html: blurbHtml,
    pages_html: sections.join('\n'),
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    viewer_aspect: escapeHtml(viewerAspect),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  // 4. manifest.json.
  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'picture_book',
    template_version: PICTURE_BOOK_TEMPLATE_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    page_count: pageCount,
    chapters: plan.chapters.map((c, ci) => ({
      name: c.name,
      page_count: c.items.length,
      pages: c.items.map((item, ii) => {
        const filename = `page-${pageNumber(
          plan.chapters.slice(0, ci).reduce((n, cc) => n + cc.items.length, 0) + ii + 1,
        )}.svg`;
        const matched = pages.find((p) => p.stashItemId === item.stashItemId);
        return {
          stash_item_id: item.stashItemId,
          sketch_ref: item.sketchRef,
          label: item.label,
          caption: item.captionMd,
          filename,
          dangling: !!matched?.dangling,
        };
      }),
    })),
    skipped_items: plan.skippedItems,
    files: [
      'report.md',
      'index.html',
      ...pages.filter((p) => p.svgStandalone).map((p) => p.filename),
    ],
  };
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1, // +1 for manifest.json itself
    templateVersion: PICTURE_BOOK_TEMPLATE_VERSION,
    pageCount,
    chapters: manifest.chapters,
    skippedItems: plan.skippedItems,
  };
}

// Test seam.
export const _internals = {
  escapeHtml,
  planBookFromStash,
  renderChapter,
  renderPage,
};
