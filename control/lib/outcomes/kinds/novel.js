/**
 * Novella writer (publication kind: novel).
 *
 * Scroll-mode fiction prose — short story, novella, or novel. Drawers become
 * numbered chapters (optional — a single-chapter short story works too); items
 * inside a drawer route to one of three slots:
 *
 *   markdown → prose section (renders the markdown body; multiple markdown
 *              items in one drawer are separated by a centered `***` scene
 *              break)
 *   text     → italicized epigraph at the top of the chapter (if first item)
 *              OR pull-quote between scenes (if mid-chapter)
 *   sketch   → small frontispiece insert at the top of the chapter (used
 *              sparingly — fiction prose is mostly text)
 *
 * Anything else is skipped with a record in the manifest. `report_md` becomes
 * a front-matter section (dedication / epigraph) on the cover; the TOC lists
 * chapters by name only (no item counts — novels don't advertise structure).
 * No book-viewer.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';
import { resolveSketchItem } from '../resolvers/sketch.js';

export const NOVEL_VERSION = 'nv-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'novel.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pad(n) { return String(n).padStart(3, '0'); }

// Roman numerals up to 50 — covers any plausible novel chapter count.
function toRoman(n) {
  if (!Number.isInteger(n) || n < 1) return String(n);
  const map = [
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rem = n;
  for (const [v, s] of map) {
    while (rem >= v) { out += s; rem -= v; }
  }
  return out;
}

const ACCEPTED = new Set(['markdown', 'text', 'sketch']);

function groupItemsByDrawer(full, itemIds) {
  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of full.drawers) byDrawerId.set(d.id, []);

  const skipped = [];
  for (const it of items) {
    if (!ACCEPTED.has(it.type)) {
      skipped.push({ id: it.id, type: it.type, reason: `novel does not render type '${it.type}'` });
      continue;
    }
    const bucket = byDrawerId.get(it.drawerId === null ? null : it.drawerId)
      || byDrawerId.get(null);
    bucket.push(it);
  }

  const chapters = [];
  const rootItems = byDrawerId.get(null);
  if (rootItems.length > 0) chapters.push({ name: null, drawerId: null, items: rootItems });
  for (const d of full.drawers) {
    const bucket = byDrawerId.get(d.id);
    if (bucket.length > 0) chapters.push({ name: d.name, drawerId: d.id, items: bucket });
  }
  return { chapters, skippedItems: skipped };
}

export async function writeNovelOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'novel',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (novel builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = groupItemsByDrawer(full, itemIds);
  const totalItems = plan.chapters.reduce((n, c) => n + c.items.length, 0);
  if (totalItems === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 chapter items — novel needs at least one markdown/text/sketch item.`,
    );
  }

  const figureFiles = [];
  const chaptersOut = [];
  let chapterIdx = 0;

  for (const chapter of plan.chapters) {
    const numbered = chapter.name !== null;
    if (numbered) chapterIdx += 1;
    const displayIdx = numbered ? chapterIdx : 0;
    const sceneHtmlParts = [];
    let epigraphHtml = '';
    let frontispieceHtml = '';
    let frontispieceFilename = null;
    let frontispieceDangling = false;
    let firstItem = true;
    let prosePieceCount = 0;

    for (const item of chapter.items) {
      if (item.type === 'text') {
        const body = String(item.body || '').trim();
        if (!body) { firstItem = false; continue; }
        if (firstItem) {
          epigraphHtml = `<blockquote class="epigraph"><p>${escapeHtml(body)}</p></blockquote>`;
        } else {
          sceneHtmlParts.push(`<aside class="pull-quote"><p>${escapeHtml(body)}</p></aside>`);
        }
      } else if (item.type === 'sketch') {
        if (frontispieceHtml) continue; // only the first sketch becomes a frontispiece
        const sketchRef = item.metadata?.sketch_ref;
        const r = await resolveSketchItem({ metadata: { sketch_ref: sketchRef } }, { technical: false });
        if (r.dangling || !r.svgInline) {
          frontispieceDangling = true;
        } else {
          frontispieceFilename = `frontispiece-${pad(figureFiles.length + 1)}.svg`;
          figureFiles.push({ filename: frontispieceFilename, body: r.svgStandalone });
          frontispieceHtml = `<figure class="frontispiece">${r.svgInline}${item.metadata?.label ? `<figcaption>${escapeHtml(item.metadata.label)}</figcaption>` : ''}</figure>`;
        }
      } else if (item.type === 'markdown') {
        const prose = renderMarkdown(item.bodyMd || '');
        if (prosePieceCount > 0) sceneHtmlParts.push(`<hr class="scene-break" />`);
        sceneHtmlParts.push(`<div class="scene">${prose}</div>`);
        prosePieceCount += 1;
      }
      firstItem = false;
    }

    chaptersOut.push({
      idx: displayIdx,
      numbered,
      name: chapter.name,
      roman: numbered ? toRoman(displayIdx) : null,
      epigraphHtml,
      frontispieceHtml,
      frontispieceFilename,
      frontispieceDangling,
      sceneHtml: sceneHtmlParts.join('\n'),
      sceneCount: prosePieceCount,
    });
  }

  // No drawers → a continuous short story: no chapters, so suppress both the
  // Contents page and the per-section heading. Any drawer reintroduces both
  // (a mixed stash with loose root items keeps its "Opening" prologue header).
  const isContinuous = !chaptersOut.some((c) => c.numbered);

  // TOC: chapter list only, no counts. Omitted entirely for a short story.
  const tocRowsHtml = chaptersOut.map((c) => {
    const anchor = c.numbered ? `ch-${c.idx}` : 'opening';
    const labelLeft = c.numbered ? `${c.roman}` : '—';
    const labelRight = c.name || 'Opening';
    return `<li><a href="#${anchor}"><span class="toc-num">${escapeHtml(labelLeft)}</span><span class="toc-title">${escapeHtml(labelRight)}</span></a></li>`;
  }).join('\n');
  const tocHtml = isContinuous
    ? ''
    : `<nav class="toc">\n  <h2>Contents</h2>\n  <ol>\n    ${tocRowsHtml}\n  </ol>\n</nav>`;

  const chapterBlocks = chaptersOut.map((c) => {
    const anchor = c.numbered ? `ch-${c.idx}` : 'opening';
    const parts = [];
    parts.push(`<section class="chapter" id="${anchor}">`);
    if (!isContinuous) {
      parts.push(
        `<header class="chapter-head">`
          + (c.numbered ? `<p class="chapter-num">${escapeHtml(c.roman)}</p>` : '')
          + `<h2>${escapeHtml(c.name || 'Opening')}</h2>`
          + `</header>`,
      );
    }
    if (c.frontispieceHtml) parts.push(c.frontispieceHtml);
    if (c.epigraphHtml) parts.push(c.epigraphHtml);
    if (c.sceneHtml) parts.push(c.sceneHtml);
    parts.push(`</section>`);
    return parts.join('\n');
  }).join('\n');

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');
  for (const f of figureFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const frontMatterHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '';

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / novel template v${NOVEL_VERSION}`),
    template_version: escapeHtml(NOVEL_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    front_matter_html: frontMatterHtml,
    toc_html: tocHtml,
    chapters_html: chapterBlocks,
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'novel',
    template_version: NOVEL_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    continuous: isContinuous,
    chapter_count: isContinuous ? 0 : chaptersOut.length,
    scene_count: chaptersOut.reduce((n, c) => n + c.sceneCount, 0),
    chapters: chaptersOut.map((c) => ({
      number: c.numbered ? c.idx : null,
      roman: c.roman,
      name: c.name,
      scene_count: c.sceneCount,
      frontispiece: c.frontispieceFilename || null,
      has_epigraph: !!c.epigraphHtml,
    })),
    skipped_items: plan.skippedItems,
    files: ['report.md', 'index.html', ...figureFiles.map((f) => f.filename)],
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1,
    templateVersion: NOVEL_VERSION,
    chapterCount: chaptersOut.length,
    skippedItems: plan.skippedItems,
  };
}

export const _internals = { escapeHtml, toRoman, groupItemsByDrawer };
