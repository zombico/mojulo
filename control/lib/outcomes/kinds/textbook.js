/**
 * Textbook writer (publication kind: textbook).
 *
 * Scroll-mode, long-form structured book. Drawers become numbered chapters;
 * items inside a drawer route to one of three slots:
 *
 *   markdown → section (h1 of the body becomes the section heading; the rest
 *              renders as the section body — paragraphs, lists, tables, code)
 *   sketch   → numbered figure (Fig. <chapter>.<figure> — <label>) with the
 *              optional `body_md` rendered underneath as the figure caption
 *   text     → key-term / callout box (renders the text in a sidebar-style box)
 *
 * Anything else is skipped with a record in the manifest. The first markdown
 * item in a drawer doubles as the chapter intro lead — convention, no extra
 * field.
 *
 * The TOC at the front is auto-derived from the chapter list (drawer name +
 * section count + figure count). `report_md` becomes a "Preface" on the
 * cover. No book-viewer (textbooks scroll).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';
import { resolveSketchItem } from '../resolvers/sketch.js';

export const TEXTBOOK_VERSION = 'tb-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'textbook.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pad(n) { return String(n).padStart(3, '0'); }

const ACCEPTED = new Set(['markdown', 'sketch', 'text']);

function groupItemsByDrawer(full, itemIds) {
  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of full.drawers) byDrawerId.set(d.id, []);

  const skipped = [];
  for (const it of items) {
    if (!ACCEPTED.has(it.type)) {
      skipped.push({ id: it.id, type: it.type, reason: `textbook does not render type '${it.type}'` });
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

/** Pull the first `# heading` out of a markdown body. Returns { title, rest }. */
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

function chapterDisplayName(chapter, idx) {
  if (chapter.name === null) return 'Front matter';
  return `Chapter ${idx} · ${chapter.name}`;
}

export async function writeTextbookOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'textbook',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (textbook builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = groupItemsByDrawer(full, itemIds);
  const totalSlots = plan.chapters.reduce((n, c) => n + c.items.length, 0);
  if (totalSlots === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 content items — textbook needs at least one markdown/sketch/text item.`,
    );
  }

  // Resolve sketches up front; gives us per-figure numbering and standalone files.
  const figureFiles = [];
  const chaptersOut = [];
  let chapterIdx = 0;

  for (const chapter of plan.chapters) {
    const numbered = chapter.name !== null;
    if (numbered) chapterIdx += 1;
    const displayIdx = numbered ? chapterIdx : 0;
    const sections = [];
    const figures = [];
    const callouts = [];
    let firstMarkdownConsumedAsIntro = false;
    let chapterIntroHtml = '';
    let figureCounter = 0;
    let sectionCounter = 0;

    for (const item of chapter.items) {
      if (item.type === 'markdown') {
        const { title, rest } = splitMarkdownHeader(item.bodyMd);
        if (!firstMarkdownConsumedAsIntro && numbered && rest && !title) {
          // No header on first item → use whole thing as intro lead.
          chapterIntroHtml = renderMarkdown(item.bodyMd);
          firstMarkdownConsumedAsIntro = true;
          continue;
        }
        sectionCounter += 1;
        const sectionTitle = title || `Section ${sectionCounter}`;
        const bodyHtml = rest ? renderMarkdown(rest) : '';
        sections.push({
          itemId: item.id,
          number: `${displayIdx || '*'}.${sectionCounter}`,
          title: sectionTitle,
          bodyHtml,
        });
      } else if (item.type === 'sketch') {
        const sketchRef = item.metadata?.sketch_ref;
        const resolved = await resolveSketchItem({ metadata: { sketch_ref: sketchRef } }, { technical: false });
        figureCounter += 1;
        const figNumber = numbered ? `${displayIdx}.${figureCounter}` : `*.${figureCounter}`;
        let inline = null;
        let filename = null;
        if (resolved.dangling || !resolved.svgInline) {
          inline = null;
        } else {
          filename = `figure-${pad(figureFiles.length + 1)}.svg`;
          figureFiles.push({ filename, body: resolved.svgStandalone });
          inline = resolved.svgInline;
        }
        figures.push({
          itemId: item.id,
          number: figNumber,
          label: item.metadata?.label || '',
          captionHtml: item.bodyMd ? renderMarkdown(item.bodyMd) : '',
          inline,
          filename,
          dangling: resolved.dangling,
          sketchRef,
        });
      } else if (item.type === 'text') {
        callouts.push({
          itemId: item.id,
          title: item.title || 'Key term',
          body: item.body || '',
        });
      }
    }

    chaptersOut.push({
      idx: displayIdx,
      numbered,
      name: chapter.name,
      displayName: chapterDisplayName(chapter, displayIdx),
      introHtml: chapterIntroHtml,
      sections,
      figures,
      callouts,
    });
  }

  // Render TOC.
  const tocRowsHtml = chaptersOut.map((c) => {
    const counts = [
      c.sections.length ? `${c.sections.length} section${c.sections.length === 1 ? '' : 's'}` : null,
      c.figures.length ? `${c.figures.length} figure${c.figures.length === 1 ? '' : 's'}` : null,
      c.callouts.length ? `${c.callouts.length} key term${c.callouts.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ');
    const anchor = c.numbered ? `ch-${c.idx}` : 'front-matter';
    return `<li class="toc-row"><a href="#${anchor}"><span class="toc-label">${escapeHtml(c.displayName)}</span><span class="toc-counts">${escapeHtml(counts || '—')}</span></a></li>`;
  }).join('\n');

  // Render chapter bodies.
  const chapterBlocks = chaptersOut.map((c) => {
    const parts = [];
    const anchor = c.numbered ? `ch-${c.idx}` : 'front-matter';
    parts.push(`<section class="chapter" id="${anchor}">`);
    parts.push(
      `<header class="chapter-head">`
        + (c.numbered ? `<p class="chapter-num">Chapter ${c.idx}</p>` : `<p class="chapter-num">Front matter</p>`)
        + `<h2>${escapeHtml(c.name || 'Opening')}</h2>`
        + `</header>`,
    );
    if (c.introHtml) {
      parts.push(`<div class="chapter-intro">${c.introHtml}</div>`);
    }
    if (c.callouts.length > 0) {
      const cls = c.callouts.map((ca) => (
        `<aside class="callout"><p class="callout-title">${escapeHtml(ca.title)}</p><p class="callout-body">${escapeHtml(ca.body)}</p></aside>`
      )).join('\n');
      parts.push(cls);
    }
    for (const s of c.sections) {
      parts.push(
        `<section class="section">`
          + `<h3><span class="section-num">${escapeHtml(s.number)}</span> ${escapeHtml(s.title)}</h3>`
          + `<div class="section-body">${s.bodyHtml}</div>`
          + `</section>`,
      );
    }
    for (const f of c.figures) {
      const illHtml = f.inline
        ? `<div class="fig-img">${f.inline}</div>`
        : `<div class="fig-img missing">missing illustration · ${escapeHtml(f.sketchRef || '')}</div>`;
      const captionLabel = `<span class="fig-num">Figure ${escapeHtml(f.number)}</span>`
        + (f.label ? ` <span class="fig-label">${escapeHtml(f.label)}</span>` : '');
      parts.push(
        `<figure class="figure">${illHtml}<figcaption>${captionLabel}${f.captionHtml ? `<div class="fig-caption">${f.captionHtml}</div>` : ''}</figcaption></figure>`,
      );
    }
    parts.push(`</section>`);
    return parts.join('\n');
  }).join('\n');

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');
  for (const f of figureFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const prefaceHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#94a3b8;font-style:italic;">(no preface)</p>';

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / textbook template v${TEXTBOOK_VERSION}`),
    template_version: escapeHtml(TEXTBOOK_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    preface_html: prefaceHtml,
    toc_rows: tocRowsHtml,
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
    template: 'textbook',
    template_version: TEXTBOOK_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    chapter_count: chaptersOut.length,
    section_count: chaptersOut.reduce((n, c) => n + c.sections.length, 0),
    figure_count: chaptersOut.reduce((n, c) => n + c.figures.length, 0),
    callout_count: chaptersOut.reduce((n, c) => n + c.callouts.length, 0),
    chapters: chaptersOut.map((c) => ({
      number: c.numbered ? c.idx : null,
      name: c.name,
      sections: c.sections.map((s) => ({ number: s.number, title: s.title, item_id: s.itemId })),
      figures: c.figures.map((f) => ({ number: f.number, label: f.label, filename: f.filename, item_id: f.itemId, dangling: f.dangling })),
      callouts: c.callouts.map((ca) => ({ title: ca.title, item_id: ca.itemId })),
    })),
    skipped_items: plan.skippedItems,
    files: ['report.md', 'index.html', ...figureFiles.map((f) => f.filename)],
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1,
    templateVersion: TEXTBOOK_VERSION,
    chapterCount: chaptersOut.length,
    skippedItems: plan.skippedItems,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeader, groupItemsByDrawer };
