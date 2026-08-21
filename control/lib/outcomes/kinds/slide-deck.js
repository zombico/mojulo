/**
 * Slide-deck outcome writer (publication kind: slide_deck).
 *
 * Materializes a single-slice cook as a static HTML slide deck. The slice may
 * be whole-stash or cleaved via `item_ids`. Each supported stash item becomes
 * one slide; drawers become section-divider slides. The deck is the first
 * publication kind that exercises the resolver layer (lib/outcomes/resolvers/)
 * across multiple item types — see lib/outcomes/PUBLISHER.plan.md.
 *
 * Item resolver dispatch (v1):
 *   sketch   → full-bleed visual slide (svg via resolveSketchItem)
 *   svg      → full-bleed visual slide (item.bodySvg inlined)
 *   markdown → title + body slide (first non-empty line is the title)
 *   text     → centered plain-text slide
 *   image / link / pointer / script → skipped (recorded in manifest.skipped_items)
 *
 * Folder layout (self-contained, like every other kind):
 *
 *   <OUTCOMES_DIR>/<cook_ref>/
 *     ├── report.md          — cover blurb (load-bearing for the cover slide)
 *     ├── index.html         — the static deck
 *     ├── manifest.json      — machine-readable deck structure
 *     ├── slide-001.svg      — per visual-slide standalone SVG (sketch / svg items)
 *     ├── slide-002.svg
 *     └── …
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';
import { resolveSketchItem, stripXmlDecl } from '../resolvers/sketch.js';

export const SLIDE_DECK_VERSION = 'sd-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'slide_deck.html');

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

function slideNumber(n) {
  return String(n).padStart(3, '0');
}

/**
 * Split a markdown body into (title, restMd). The title is the first non-empty
 * line with any leading `# ` stripped; the rest is everything after.
 */
function splitMarkdownTitle(md) {
  const lines = String(md || '').split('\n');
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) { titleIdx = i; break; }
  }
  if (titleIdx === -1) return { title: '', rest: '' };
  const title = lines[titleIdx].replace(/^#+\s+/, '').trim();
  const rest = lines.slice(titleIdx + 1).join('\n').replace(/^\s+/, '');
  return { title, rest };
}

/**
 * Build the ordered slide list from a stash + slice. Drawer order: root first,
 * then drawers in StashRepository.listDrawers order. Within each drawer, items
 * are in (created_at ASC, id ASC) order. If `itemIds` is supplied, the slice
 * is filtered to that set, but order still follows the natural arrangement.
 */
function planDeckFromStash(full, itemIds) {
  const { drawers, items: allItems } = full;
  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? allItems.filter((it) => filter.has(it.id)) : allItems;

  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of drawers) byDrawerId.set(d.id, []);
  const skipped = [];
  for (const it of items) {
    const bucket = byDrawerId.get(it.drawerId === null ? null : it.drawerId);
    if (!bucket) {
      byDrawerId.get(null).push(it);
    } else {
      bucket.push(it);
    }
  }

  const sections = [];
  const rootItems = byDrawerId.get(null);
  if (rootItems.length > 0) {
    sections.push({ name: null, items: rootItems });
  }
  for (const d of drawers) {
    const drawerItems = byDrawerId.get(d.id);
    if (drawerItems.length > 0) {
      sections.push({ name: d.name, items: drawerItems });
    }
  }
  return { sections, skipped };
}

/**
 * Resolve one stash item into a slide spec. Returns null when the item type
 * isn't supported (the caller records it in skipped_items).
 */
async function resolveItemToSlide(item, sketchTheme) {
  switch (item.type) {
    case 'sketch': {
      const r = await resolveSketchItem(
        { metadata: { sketch_ref: item.metadata?.sketch_ref } },
        { technical: false, surface: sketchTheme?.surface, vars: sketchTheme?.vars },
      );
      return {
        kind: 'visual',
        svgInline: r.svgInline,
        svgStandalone: r.svgStandalone,
        dangling: r.dangling,
        label: item.metadata?.label || item.title || null,
        sourceRef: item.metadata?.sketch_ref || null,
      };
    }
    case 'svg': {
      // svg items store their SVG source in `item.body` (the stash contract
      // funnels bodySvg → body at intake — see validateItemContract).
      const raw = item.body || null;
      const inline = raw ? stripXmlDecl(raw) : null;
      return {
        kind: 'visual',
        svgInline: inline,
        svgStandalone: raw,
        dangling: !raw,
        label: item.title || null,
        sourceRef: null,
      };
    }
    case 'markdown': {
      const { title, rest } = splitMarkdownTitle(item.bodyMd);
      const bodyHtml = rest ? renderMarkdown(rest) : '';
      return {
        kind: 'title_body',
        title,
        bodyHtml,
        label: item.title || null,
      };
    }
    case 'text': {
      return {
        kind: 'text',
        body: item.body || '',
        label: item.title || null,
      };
    }
    default:
      return null;
  }
}

function renderSectionDivider(name, idx) {
  return [
    '<section class="slide section" data-viewer-page>',
    `<div class="label">Section &middot; slide ${slideNumber(idx)}</div>`,
    `<h2>${escapeHtml(name)}</h2>`,
    '</section>',
  ].join('\n');
}

function renderSlide(slide, displayNumber, sectionName) {
  const sectionLabel = sectionName ? `${escapeHtml(sectionName)} &middot; ` : '';
  const meta = `<div class="slide-meta"><span>${sectionLabel}slide ${displayNumber}</span><span>${escapeHtml(slide.label || '')}</span></div>`;

  switch (slide.kind) {
    case 'visual': {
      const cls = slide.dangling ? 'slide visual missing' : 'slide visual';
      const canvas = slide.dangling
        ? `<div class="canvas">missing illustration &middot; ${escapeHtml(slide.sourceRef || '(no source)')}</div>`
        : `<div class="canvas">${slide.svgInline}</div>`;
      return `<section class="${cls}" data-viewer-page>${canvas}${meta}</section>`;
    }
    case 'title_body': {
      const titleTag = slide.title ? `<h1>${escapeHtml(slide.title)}</h1>` : '';
      return [
        '<section class="slide title-body" data-viewer-page>',
        titleTag,
        `<div class="body">${slide.bodyHtml}</div>`,
        meta,
        '</section>',
      ].join('\n');
    }
    case 'text': {
      return [
        '<section class="slide text" data-viewer-page>',
        `<div class="body">${escapeHtml(slide.body)}</div>`,
        meta,
        '</section>',
      ].join('\n');
    }
    default:
      return '';
  }
}

/**
 * Write a slide-deck outcome folder.
 *
 * @param {object} args
 * @param {string} args.cookRef
 * @param {string} args.aim — used as the cover title
 * @param {string} args.stashRef — the single stash the deck is built from
 * @param {number[]} [args.itemIds] — when present, restrict the deck to these items
 * @param {string} [args.reportMd] — optional cover blurb (markdown)
 * @param {string} [args.publicationKind='slide_deck']
 * @param {{surface:'dark'|'light', vars:object}} [args.sketchTheme] — presentation
 *   theme inputs for embedded sketch slides, so the visual band matches the page
 *   chrome the same theme set via styleOverridesHtml. Null keeps the dark default.
 * @returns {Promise<{ outcomeDir, indexPath, fileCount, templateVersion, slideCount, sections, skippedItems }>}
 */
const DEFAULT_VIEWER_ASPECT = '16 / 9';

export async function writeSlideDeckOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'slide_deck',
  viewerAspect = DEFAULT_VIEWER_ASPECT,
  styleOverridesHtml = '',
  sketchTheme = null,
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required (used as cover title)');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (slide_deck builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = planDeckFromStash(full, itemIds);

  // Resolve every item to a slide spec (or skip). We capture standalone SVGs
  // so each visual slide gets a sibling .svg file in the outcome folder.
  const sectionsResolved = [];
  let visualIdx = 0;
  for (const section of plan.sections) {
    const slides = [];
    for (const item of section.items) {
      const slide = await resolveItemToSlide(item, sketchTheme);
      if (!slide) {
        plan.skipped.push({
          id: item.id,
          type: item.type,
          reason: `slide_deck v1 does not render type '${item.type}'`,
        });
        continue;
      }
      if (slide.kind === 'visual' && slide.svgStandalone) {
        visualIdx += 1;
        slide.filename = `slide-${slideNumber(visualIdx)}.svg`;
      }
      slides.push({ item, slide });
    }
    if (slides.length > 0) sectionsResolved.push({ name: section.name, slides });
  }

  const slideCount = sectionsResolved.reduce((n, s) => n + s.slides.length, 0);
  if (slideCount === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 slides — slide_deck needs at least one item of type sketch/svg/markdown/text.`,
    );
  }

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  // 1. report.md — cover blurb source.
  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  // 2. standalone SVG files for visual slides.
  for (const section of sectionsResolved) {
    for (const { slide } of section.slides) {
      if (slide.kind === 'visual' && slide.svgStandalone && slide.filename) {
        await fs.writeFile(path.join(dir, slide.filename), slide.svgStandalone, 'utf8');
      }
    }
  }

  // 3. render the deck HTML.
  // Slide numbering runs across sections (1-indexed). Section dividers are
  // *not* counted as slides — they have their own "Section · slide N" label
  // that points at the *next* content slide.
  const htmlParts = [];
  let displayIdx = 0;
  for (const section of sectionsResolved) {
    if (section.name) {
      htmlParts.push(renderSectionDivider(section.name, displayIdx + 1));
    }
    for (const { slide } of section.slides) {
      displayIdx += 1;
      htmlParts.push(renderSlide(slide, displayIdx, section.name));
    }
  }

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#94a3b8; font-style: italic;">(no cover blurb)</p>';

  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / slide_deck template v${SLIDE_DECK_VERSION}`),
    template_version: escapeHtml(SLIDE_DECK_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_blurb_html: blurbHtml,
    slides_html: htmlParts.join('\n'),
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    viewer_aspect: escapeHtml(viewerAspect),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  // 4. manifest.json
  const visualFilenames = [];
  const manifestSections = sectionsResolved.map((section) => ({
    name: section.name,
    slide_count: section.slides.length,
    slides: section.slides.map(({ item, slide }) => {
      if (slide.kind === 'visual' && slide.filename) visualFilenames.push(slide.filename);
      return {
        stash_item_id: item.id,
        type: item.type,
        slide_kind: slide.kind,
        label: slide.label,
        ...(slide.kind === 'visual'
          ? { filename: slide.filename || null, dangling: !!slide.dangling, source_ref: slide.sourceRef || null }
          : {}),
        ...(slide.kind === 'title_body' ? { title: slide.title || null } : {}),
      };
    }),
  }));

  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'slide_deck',
    template_version: SLIDE_DECK_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    slide_count: slideCount,
    sections: manifestSections,
    skipped_items: plan.skipped,
    files: ['report.md', 'index.html', ...visualFilenames],
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
    templateVersion: SLIDE_DECK_VERSION,
    slideCount,
    sections: manifestSections,
    skippedItems: plan.skipped,
  };
}

// Test seam.
export const _internals = {
  escapeHtml,
  splitMarkdownTitle,
  planDeckFromStash,
  resolveItemToSlide,
  renderSlide,
  renderSectionDivider,
};
