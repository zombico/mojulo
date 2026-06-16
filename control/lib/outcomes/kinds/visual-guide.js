/**
 * Visual guide writer (publication kind: visual_guide).
 *
 * Picture-book DNA with structure: paginated, sketch-heavy, but every chapter
 * earns an intro page derived from a leading markdown item, and the book
 * opens with an auto TOC. Think "Visual Guide to <X>" — fan reference books
 * that read sequentially but anchor on illustrated plates.
 *
 * Drawers become numbered chapters. Items inside a drawer route to:
 *
 *   markdown → chapter intro (if first markdown in chapter; h1 = subtitle)
 *              OR interstitial text page (subsequent markdown items)
 *   sketch   → plate page (large illustration, body_md → caption underneath)
 *   text     → quote spread (centered text on its own page)
 *
 * Anything else is skipped. `report_md` becomes the cover blurb. Book-viewer
 * mode is supported (default aspect 4/3 — landscape guide format).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';
import { resolveSketchItem } from '../resolvers/sketch.js';

const DEFAULT_VIEWER_ASPECT = '4 / 3';
export const VISUAL_GUIDE_VERSION = 'vg-1';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'visual_guide.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pad(n) { return String(n).padStart(3, '0'); }

function splitMarkdownHeader(md) {
  const lines = String(md || '').split('\n');
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) { titleIdx = i; break; }
  }
  if (titleIdx === -1) return { title: '', rest: '' };
  const first = lines[titleIdx];
  if (!/^#+\s+/.test(first)) return { title: '', rest: lines.join('\n') };
  const title = first.replace(/^#+\s+/, '').trim();
  const rest = lines.slice(titleIdx + 1).join('\n').replace(/^\s+/, '');
  return { title, rest };
}

const ACCEPTED = new Set(['sketch', 'markdown', 'text']);

function groupItemsByDrawer(full, itemIds) {
  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of full.drawers) byDrawerId.set(d.id, []);

  const skipped = [];
  for (const it of items) {
    if (!ACCEPTED.has(it.type)) {
      skipped.push({ id: it.id, type: it.type, reason: `visual_guide does not render type '${it.type}'` });
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

export async function writeVisualGuideOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'visual_guide',
  viewerAspect = DEFAULT_VIEWER_ASPECT,
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (visual_guide builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = groupItemsByDrawer(full, itemIds);
  const totalSlots = plan.chapters.reduce((n, c) => n + c.items.length, 0);
  if (totalSlots === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 items — visual_guide needs at least one sketch/markdown/text item.`,
    );
  }
  const sketchCount = plan.chapters.reduce(
    (n, c) => n + c.items.filter((it) => it.type === 'sketch').length, 0,
  );
  if (sketchCount === 0) {
    throw new Error(
      `Stash '${stashRef}' has no sketch items — visual_guide is illustration-anchored; at least one plate is required.`,
    );
  }

  const plateFiles = [];
  const chaptersOut = [];
  let chapterIdx = 0;
  let plateCounter = 0;

  for (const chapter of plan.chapters) {
    const numbered = chapter.name !== null;
    if (numbered) chapterIdx += 1;
    const displayIdx = numbered ? chapterIdx : 0;
    const pages = [];
    let firstMarkdownConsumed = false;
    let chapterIntro = null;

    for (const item of chapter.items) {
      if (item.type === 'markdown') {
        const { title, rest } = splitMarkdownHeader(item.bodyMd);
        if (!firstMarkdownConsumed && numbered) {
          chapterIntro = {
            subtitle: title,
            bodyHtml: rest ? renderMarkdown(rest) : (title ? '' : renderMarkdown(item.bodyMd || '')),
          };
          firstMarkdownConsumed = true;
        } else {
          pages.push({
            kind: 'interstitial',
            itemId: item.id,
            title: title || '',
            bodyHtml: rest ? renderMarkdown(rest) : renderMarkdown(item.bodyMd || ''),
          });
        }
      } else if (item.type === 'sketch') {
        const sketchRef = item.metadata?.sketch_ref;
        const r = await resolveSketchItem({ metadata: { sketch_ref: sketchRef } }, { technical: false });
        plateCounter += 1;
        let filename = null;
        let inline = null;
        if (!r.dangling && r.svgInline) {
          filename = `plate-${pad(plateFiles.length + 1)}.svg`;
          plateFiles.push({ filename, body: r.svgStandalone });
          inline = r.svgInline;
        }
        pages.push({
          kind: 'plate',
          itemId: item.id,
          number: numbered ? `${displayIdx}.${pages.filter((p) => p.kind === 'plate').length + 1}` : `${plateCounter}`,
          label: item.metadata?.label || '',
          captionHtml: item.bodyMd ? renderMarkdown(item.bodyMd) : '',
          filename,
          inline,
          dangling: r.dangling,
          sketchRef,
        });
      } else if (item.type === 'text') {
        pages.push({
          kind: 'quote',
          itemId: item.id,
          body: item.body || '',
        });
      }
    }

    chaptersOut.push({
      idx: displayIdx,
      numbered,
      name: chapter.name,
      intro: chapterIntro,
      pages,
    });
  }

  // TOC rows.
  const tocRowsHtml = chaptersOut.map((c) => {
    const plateCount = c.pages.filter((p) => p.kind === 'plate').length;
    const counts = plateCount > 0 ? `${plateCount} plate${plateCount === 1 ? '' : 's'}` : '—';
    return `<li class="toc-row"><span class="toc-num">${c.numbered ? `Ch ${c.idx}` : '—'}</span><span class="toc-name">${escapeHtml(c.name || 'Opening')}</span><span class="toc-count">${escapeHtml(counts)}</span></li>`;
  }).join('\n');

  // Page sections.
  const pageBlocks = [];
  for (const c of chaptersOut) {
    // Chapter divider page (always for numbered chapters, even without intro).
    if (c.numbered) {
      const subtitleHtml = c.intro?.subtitle
        ? `<p class="chapter-subtitle">${escapeHtml(c.intro.subtitle)}</p>` : '';
      const introBodyHtml = c.intro?.bodyHtml
        ? `<div class="chapter-intro">${c.intro.bodyHtml}</div>` : '';
      pageBlocks.push(
        `<section class="chapter-divider" data-viewer-page>`
          + `<p class="chapter-eyebrow">Chapter ${c.idx}</p>`
          + `<h2 class="chapter-name">${escapeHtml(c.name)}</h2>`
          + subtitleHtml + introBodyHtml
          + `</section>`,
      );
    }
    for (const p of c.pages) {
      if (p.kind === 'plate') {
        const ill = p.inline
          ? `<div class="plate-img">${p.inline}</div>`
          : `<div class="plate-img missing">missing illustration · ${escapeHtml(p.sketchRef || '')}</div>`;
        const labelLine = `<p class="plate-label"><span class="plate-num">Plate ${escapeHtml(p.number)}</span>${p.label ? ` &middot; ${escapeHtml(p.label)}` : ''}</p>`;
        const captionLine = p.captionHtml ? `<div class="plate-caption">${p.captionHtml}</div>` : '';
        pageBlocks.push(
          `<section class="plate" data-viewer-page>${ill}${labelLine}${captionLine}</section>`,
        );
      } else if (p.kind === 'interstitial') {
        pageBlocks.push(
          `<section class="interstitial" data-viewer-page>`
            + (p.title ? `<h3>${escapeHtml(p.title)}</h3>` : '')
            + `<div class="interstitial-body">${p.bodyHtml}</div>`
            + `</section>`,
        );
      } else if (p.kind === 'quote') {
        pageBlocks.push(
          `<section class="quote" data-viewer-page><blockquote><p>${escapeHtml(p.body)}</p></blockquote></section>`,
        );
      }
    }
  }

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');
  for (const f of plateFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#94a3b8;font-style:italic;">(no inside-cover note)</p>';

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / visual_guide template v${VISUAL_GUIDE_VERSION}`),
    template_version: escapeHtml(VISUAL_GUIDE_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_blurb_html: blurbHtml,
    toc_rows: tocRowsHtml,
    pages_html: pageBlocks.join('\n'),
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    viewer_aspect: escapeHtml(viewerAspect),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'visual_guide',
    template_version: VISUAL_GUIDE_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    chapter_count: chaptersOut.length,
    plate_count: chaptersOut.reduce((n, c) => n + c.pages.filter((p) => p.kind === 'plate').length, 0),
    chapters: chaptersOut.map((c) => ({
      number: c.numbered ? c.idx : null,
      name: c.name,
      intro_subtitle: c.intro?.subtitle || null,
      pages: c.pages.map((p) => ({
        kind: p.kind,
        item_id: p.itemId,
        ...(p.kind === 'plate' ? { number: p.number, label: p.label, filename: p.filename, dangling: p.dangling } : {}),
        ...(p.kind === 'interstitial' ? { title: p.title } : {}),
      })),
    })),
    skipped_items: plan.skippedItems,
    files: ['report.md', 'index.html', ...plateFiles.map((f) => f.filename)],
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1,
    templateVersion: VISUAL_GUIDE_VERSION,
    chapterCount: chaptersOut.length,
    skippedItems: plan.skippedItems,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeader, groupItemsByDrawer };
