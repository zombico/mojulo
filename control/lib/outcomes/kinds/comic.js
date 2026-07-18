/**
 * Comic outcome writer (cook publication kind, sibling of picture_book).
 *
 * Materializes a single-stash cook as a static HTML comic. Each sketch-typed
 * item is one page; drawers become chapters. Distinct from picture_book in
 * three ways: format (american-comic / sunday-strip / manga-tankobon /
 * webtoon), reading flow (pagination + reading_direction), and a fidelity
 * dial (nemu → breakdown → pencils → inks) that flips presentation without
 * regenerating art. See lib/outcomes/kinds/COMIC.plan.md for the design.
 *
 * Output folder mirrors picture_book:
 *
 *   <OUTCOMES_DIR>/<cook_ref>/
 *     ├── report.md          — cover blurb (markdown)
 *     ├── index.html         — static comic viewer (with fidelity toggle)
 *     ├── manifest.json      — adds format, fidelity, pagination,
 *     │                        reading_direction, per-page overrides
 *     ├── page-001.svg
 *     └── …
 *
 * The viewer ships a fidelity dial that flips `data-fidelity` on the root —
 * same artifact, different presentation. No regeneration.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomesBaseDir } from '../paths.js';
import { resolveSketchItem } from '../resolvers/sketch.js';

export const COMIC_TEMPLATE_VERSION = 'comic-1';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'comic.html');

// Format presets resolve to a (pagination, reading_direction, aspect) triple.
// `aspect` is the CSS aspect ratio applied to each page wrapper; the
// book-viewer shares the same aspect mechanism via `--viewer-aspect`.
const FORMAT_PRESETS = {
  'american-comic': {
    pagination: 'pages',
    reading_direction: 'ltr',
    aspect: '7 / 10',
    label: 'American comic',
  },
  'sunday-strip': {
    pagination: 'pages',
    reading_direction: 'ltr',
    aspect: '16 / 6',
    label: 'Sunday strip',
  },
  'manga-tankobon': {
    pagination: 'pages',
    reading_direction: 'rtl',
    aspect: '5 / 7',
    label: 'Manga (tankōbon)',
  },
  webtoon: {
    pagination: 'vertical_scroll',
    reading_direction: null,
    aspect: null,
    label: 'Webtoon',
  },
};

export const FIDELITY_LEVELS = ['nemu', 'breakdown', 'pencils', 'inks'];

const FIDELITY_LABEL = {
  nemu: 'ネーム / Nēmu',
  breakdown: 'Breakdown',
  pencils: 'Pencils',
  inks: 'Inks',
};

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function pageNumber(n) { return String(n).padStart(3, '0'); }

/**
 * Build the ordered page list from a stash. Same drawer/order rules as
 * picture_book (drawers in listDrawers order; items per `created_at ASC,
 * id ASC`; root items lead). Non-sketch items are skipped with a record.
 */
function planComicFromStash(full) {
  const { drawers, items } = full;
  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of drawers) byDrawerId.set(d.id, []);
  const skipped = [];
  for (const it of items) {
    if (it.type !== 'sketch') {
      skipped.push({ id: it.id, type: it.type, reason: 'comic template only renders sketch items' });
      continue;
    }
    const bucket = byDrawerId.get(it.drawerId === null ? null : it.drawerId);
    if (!bucket) {
      byDrawerId.get(null).push(it);
    } else {
      bucket.push(it);
    }
  }
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
  const comicMeta = stashItem.metadata?.comic || {};
  return {
    stashItemId: stashItem.id,
    sketchRef: stashItem.metadata?.sketch_ref,
    label: stashItem.metadata?.label || null,
    captionMd: stashItem.bodyMd || null,
    // Per-page comic metadata (all optional):
    //   fidelity:  override the publication-level fidelity for this page
    //   spread:    'left' | 'right' — pair adjacent left+right into a spread
    //   role:      'cover' (treated specially), 'page' (default)
    fidelityOverride: FIDELITY_LEVELS.includes(comicMeta.fidelity) ? comicMeta.fidelity : null,
    spread: comicMeta.spread === 'left' || comicMeta.spread === 'right' ? comicMeta.spread : null,
    role: comicMeta.role || null,
  };
}

function renderChapter(chapter, pages, startIndex, opts) {
  const parts = [];
  if (chapter.name) {
    const label = chapter.items.length === 1 ? '1 page' : `${chapter.items.length} pages`;
    parts.push(
      `<div class="chapter-divider" data-viewer-page><div class="label">Chapter &middot; ${escapeHtml(label)}</div><h2>${escapeHtml(chapter.name)}</h2></div>`,
    );
  }
  // Pair left/right pages within this chapter into spreads (pages mode only;
  // a left at end-of-chapter can't pair with a right at start-of-next-chapter
  // — the divider would interpose). Skipped spreads land in opts.skippedSpreads.
  const groups = groupSpreads(chapter.items, pages, startIndex, opts);
  for (const g of groups) {
    if (g.kind === 'single') {
      parts.push(renderPage(g.page, g.displayNumber, chapter, opts));
    } else {
      parts.push(renderSpread(g.left, g.right, g.leftNumber, g.rightNumber, chapter, opts));
    }
  }
  return parts.join('\n');
}

function groupSpreads(chapterItems, pages, startIndex, opts) {
  const groups = [];
  for (let i = 0; i < chapterItems.length; i++) {
    const page = pages[startIndex + i];
    const next = i + 1 < chapterItems.length ? pages[startIndex + i + 1] : null;
    const displayNumber = startIndex + i + 1;
    if (
      opts.pagination === 'pages' &&
      page.spread === 'left' &&
      next &&
      next.spread === 'right'
    ) {
      groups.push({
        kind: 'spread',
        left: page,
        right: next,
        leftNumber: displayNumber,
        rightNumber: displayNumber + 1,
      });
      i += 1; // consumed both
    } else {
      // Orphan spread marker (left without a right, or right without a left
      // before it) — render as a single and record so the operator sees.
      if (page.spread && opts.pagination === 'pages') {
        opts.skippedSpreads.push({
          page_number: displayNumber,
          spread: page.spread,
          reason: page.spread === 'left'
            ? 'no right-page follows'
            : 'no left-page precedes',
        });
      }
      groups.push({ kind: 'single', page, displayNumber });
    }
  }
  return groups;
}

// One illustration body for both single pages and spread halves: inline SVG
// (diagram pages / scaffolds), a composited final PNG (AI-painted pages —
// referenced by relative filename so the folder stays self-contained), or
// the missing placeholder.
function illustrationHtml(page) {
  if (page.svgInline) return `<div class="illustration">${page.svgInline}</div>`;
  if (page.pngFilename) {
    return `<div class="illustration"><img src="${escapeHtml(page.pngFilename)}" alt="${escapeHtml(page.label || page.sketchRef || 'page')}" style="width:100%;height:100%;object-fit:contain;display:block;"/></div>`;
  }
  return `<div class="illustration missing">missing illustration &middot; ${escapeHtml(page.sketchRef || '(no sketch_ref)')}</div>`;
}

function fidelityFor(page, defaultFidelity) {
  return page.fidelityOverride || defaultFidelity;
}

function renderPage(page, displayNumber, chapter, opts) {
  const fidelity = fidelityFor(page, opts.fidelity);
  const illustration = illustrationHtml(page);
  const captionHtml = page.captionMd
    ? `<div class="caption">${renderMarkdown(page.captionMd)}</div>`
    : '';
  const chapterLabel = chapter.name ? `${escapeHtml(chapter.name)} &middot; ` : '';
  const lockedAttr = page.fidelityOverride ? ' data-fidelity-locked="true"' : '';
  const overrideTag = page.fidelityOverride
    ? ` &middot; <span class="fidelity-override">override: ${escapeHtml(page.fidelityOverride)}</span>`
    : '';
  return [
    `<section class="page" data-viewer-page data-fidelity="${escapeHtml(fidelity)}"${lockedAttr}>`,
    illustration,
    captionHtml,
    `<div class="page-meta"><span>${chapterLabel}page ${displayNumber}</span><span>${escapeHtml(page.label || '')}${overrideTag}</span></div>`,
    '</section>',
  ].join('\n');
}

function renderSpread(left, right, leftNumber, rightNumber, chapter, opts) {
  // RTL formats (manga) flip the visual order so the eye lands on the right
  // page first, then sweeps left — matches reading direction.
  const first = opts.reading_direction === 'rtl' ? right : left;
  const second = opts.reading_direction === 'rtl' ? left : right;
  const firstNum = opts.reading_direction === 'rtl' ? rightNumber : leftNumber;
  const secondNum = opts.reading_direction === 'rtl' ? leftNumber : rightNumber;
  const firstFidelity = fidelityFor(first, opts.fidelity);
  const secondFidelity = fidelityFor(second, opts.fidelity);
  const mixed = firstFidelity !== secondFidelity;
  if (mixed) {
    opts.mixedFidelitySpreads.push({
      pages: [leftNumber, rightNumber],
      fidelities: { left: fidelityFor(left, opts.fidelity), right: fidelityFor(right, opts.fidelity) },
    });
  }
  const inner = (page, num, role) => {
    const illustration = illustrationHtml(page);
    const captionHtml = page.captionMd
      ? `<div class="caption">${renderMarkdown(page.captionMd)}</div>`
      : '';
    const fidelity = fidelityFor(page, opts.fidelity);
    const lockedAttr = page.fidelityOverride ? ' data-fidelity-locked="true"' : '';
    const overrideTag = page.fidelityOverride
      ? ` &middot; <span class="fidelity-override">override: ${escapeHtml(page.fidelityOverride)}</span>`
      : '';
    return [
      `<div class="spread-half ${role}" data-fidelity="${escapeHtml(fidelity)}" data-spread="${escapeHtml(page.spread)}"${lockedAttr}>`,
      illustration,
      captionHtml,
      `<div class="page-meta"><span>page ${num}</span><span>${escapeHtml(page.label || '')}${overrideTag}</span></div>`,
      '</div>',
    ].join('\n');
  };
  const chapterLabel = chapter.name ? `${escapeHtml(chapter.name)} &middot; ` : '';
  return [
    `<section class="spread" data-viewer-page data-spread-pair="true">`,
    `<div class="spread-row">`,
    inner(first, firstNum, 'first'),
    inner(second, secondNum, 'second'),
    `</div>`,
    `<div class="page-meta spread-meta"><span>${chapterLabel}spread ${leftNumber}-${rightNumber}</span><span>${mixed ? '⚠ mixed fidelity' : ''}</span></div>`,
    `</section>`,
  ].join('\n');
}

function resolveFormat(format) {
  if (!format) return { name: 'american-comic', ...FORMAT_PRESETS['american-comic'] };
  if (!FORMAT_PRESETS[format]) {
    throw new Error(
      `comic: unknown format '${format}'. Allowed: ${Object.keys(FORMAT_PRESETS).join(', ')}.`,
    );
  }
  return { name: format, ...FORMAT_PRESETS[format] };
}

function resolveFidelity(fidelity) {
  if (fidelity === undefined || fidelity === null) return 'nemu';
  if (!FIDELITY_LEVELS.includes(fidelity)) {
    throw new Error(
      `comic: unknown fidelity '${fidelity}'. Allowed: ${FIDELITY_LEVELS.join(', ')}.`,
    );
  }
  return fidelity;
}

/**
 * Write a comic outcome folder.
 *
 * @param {object} args
 * @param {string} args.cookRef
 * @param {string} args.aim — cover title
 * @param {string} args.stashRef — single stash the comic is built from
 * @param {string} [args.reportMd] — cover blurb (markdown)
 * @param {string} [args.format] — preset id; default 'american-comic'
 * @param {string} [args.fidelity] — default render stage; default 'nemu'
 * @param {string} [args.outcomeDir] — base dir override
 * @param {string} [args.publicationKind='comic']
 * @param {string} [args.viewerAspect] — overrides the format's default aspect
 * @param {string} [args.styleOverridesHtml]
 */
export async function writeComicOutcome({
  cookRef,
  aim,
  stashRef,
  reportMd = '',
  format,
  fidelity,
  outcomeDir,
  publicationKind = 'comic',
  viewerAspect,
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required (used as cover title)');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (comic template builds from a single stash)');
  }
  const resolvedFormat = resolveFormat(format);
  const resolvedFidelity = resolveFidelity(fidelity);
  const effectiveAspect = viewerAspect || resolvedFormat.aspect || '7 / 10';

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = planComicFromStash(full);
  const pageCount = plan.chapters.reduce((n, c) => n + c.items.length, 0);
  if (pageCount === 0) {
    throw new Error(
      `Stash '${stashRef}' has no sketch items — comic template needs at least one sketch-typed item to produce a page.`,
    );
  }

  // Resolve each page's sketch_ref → inline SVG + standalone file.
  const pages = [];
  let pageIdx = 0;
  for (const chapter of plan.chapters) {
    for (const item of chapter.items) {
      pageIdx += 1;
      // AI-painted pages (sequential-art / image-outcome) publish their
      // composited final PNG when every render target is bound; otherwise
      // (and for all diagram sketches) the SVG path is unchanged.
      const resolved = await resolveSketchItem(
        { metadata: { sketch_ref: item.sketchRef } },
        { technical: false, preferFinalRender: true },
      );
      const filename = `page-${pageNumber(pageIdx)}.${resolved.png ? 'png' : 'svg'}`;
      pages.push({
        ...item,
        filename,
        svgInline: resolved.svgInline,
        svgStandalone: resolved.svgStandalone,
        png: resolved.png,
        pngFilename: resolved.png ? filename : null,
        dangling: resolved.dangling,
      });
    }
  }

  const dir = outcomeDir || path.join(outcomesBaseDir(), cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  for (const page of pages) {
    if (page.png) {
      await fs.writeFile(path.join(dir, page.filename), page.png);
    } else if (page.svgStandalone) {
      await fs.writeFile(path.join(dir, page.filename), page.svgStandalone, 'utf8');
    }
  }

  // Render index.html.
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#8a8a8a; font-style: italic;">(no cover blurb)</p>';

  // Per-render bookkeeping that the section renderers append to.
  const renderOpts = {
    pagination: resolvedFormat.pagination,
    reading_direction: resolvedFormat.reading_direction,
    fidelity: resolvedFidelity,
    skippedSpreads: [],
    mixedFidelitySpreads: [],
  };

  const sections = [];
  let runningIdx = 0;
  for (const chapter of plan.chapters) {
    sections.push(renderChapter(chapter, pages, runningIdx, renderOpts));
    runningIdx += chapter.items.length;
  }

  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / comic template v${COMIC_TEMPLATE_VERSION}`),
    template_version: escapeHtml(COMIC_TEMPLATE_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_blurb_html: blurbHtml,
    pages_html: sections.join('\n'),
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    viewer_aspect: escapeHtml(effectiveAspect),
    style_overrides: styleOverridesHtml,
    format_name: escapeHtml(resolvedFormat.name),
    format_label: escapeHtml(resolvedFormat.label),
    pagination: escapeHtml(resolvedFormat.pagination),
    reading_direction: escapeHtml(resolvedFormat.reading_direction || ''),
    initial_fidelity: escapeHtml(resolvedFidelity),
    initial_fidelity_label: escapeHtml(FIDELITY_LABEL[resolvedFidelity]),
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  const manifest = {
    cook_ref: cookRef,
    publication: {
      kind: publicationKind,
      format: resolvedFormat.name,
      fidelity: resolvedFidelity,
      pagination: resolvedFormat.pagination,
      ...(resolvedFormat.reading_direction ? { reading_direction: resolvedFormat.reading_direction } : {}),
    },
    template: 'comic',
    template_version: COMIC_TEMPLATE_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    page_count: pageCount,
    chapters: plan.chapters.map((c, ci) => ({
      name: c.name,
      page_count: c.items.length,
      pages: c.items.map((item, ii) => {
        const matched = pages.find((p) => p.stashItemId === item.stashItemId);
        const filename = matched?.filename || `page-${pageNumber(
          plan.chapters.slice(0, ci).reduce((n, cc) => n + cc.items.length, 0) + ii + 1,
        )}.svg`;
        return {
          stash_item_id: item.stashItemId,
          sketch_ref: item.sketchRef,
          label: item.label,
          caption: item.captionMd,
          filename,
          dangling: !!matched?.dangling,
          ...(item.fidelityOverride ? { fidelity_override: item.fidelityOverride } : {}),
          ...(item.spread ? { spread: item.spread } : {}),
          ...(item.role ? { role: item.role } : {}),
        };
      }),
    })),
    skipped_items: plan.skippedItems,
    ...(renderOpts.skippedSpreads.length > 0 ? { skipped_spreads: renderOpts.skippedSpreads } : {}),
    ...(renderOpts.mixedFidelitySpreads.length > 0 ? { mixed_fidelity_spreads: renderOpts.mixedFidelitySpreads } : {}),
    files: [
      'report.md',
      'index.html',
      ...pages.filter((p) => p.svgStandalone || p.png).map((p) => p.filename),
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
    fileCount: manifest.files.length + 1,
    templateVersion: COMIC_TEMPLATE_VERSION,
    pageCount,
    chapters: manifest.chapters,
    skippedItems: plan.skippedItems,
    skippedSpreads: renderOpts.skippedSpreads,
    mixedFidelitySpreads: renderOpts.mixedFidelitySpreads,
    format: resolvedFormat.name,
    fidelity: resolvedFidelity,
    pagination: resolvedFormat.pagination,
    readingDirection: resolvedFormat.reading_direction,
  };
}

export const _internals = {
  escapeHtml,
  planComicFromStash,
  groupSpreads,
  resolveFormat,
  resolveFidelity,
  FORMAT_PRESETS,
};
