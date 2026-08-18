/**
 * Flyer writer (publication kind: flyer).
 *
 * Single-page US-letter publication with a hero band on top (first
 * sketch/image item or a solid accent), a headline (drawn from the first
 * markdown item's first line, or `aim`), a body section, and a CTA row of
 * link items. Designed for printing or sharing as a one-page artifact.
 *
 * Item resolver dispatch:
 *   first sketch / image / svg item → hero visual
 *   first markdown item            → headline (h1) + body
 *   subsequent markdown items      → appended to body
 *   text items                     → appended to body as paragraphs
 *   link items                     → CTA buttons in the bottom row
 *   other types                    → skipped (recorded in manifest.skipped_items)
 *
 * Folder layout (self-contained):
 *
 *   <OUTCOMES_DIR>/<cook_ref>/
 *     ├── report.md          — fallback body if no markdown items are gathered
 *     ├── index.html         — the static flyer
 *     ├── manifest.json
 *     └── hero.svg           — optional, when the hero is a sketch
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';
import { resolveSketchItem, stripXmlDecl } from '../resolvers/sketch.js';

export const FLYER_VERSION = 'fl-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'flyer.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function splitMarkdownHeadline(md) {
  const lines = String(md || '').split('\n');
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) { titleIdx = i; break; }
  }
  if (titleIdx === -1) return { headline: '', rest: '' };
  const headline = lines[titleIdx].replace(/^#+\s+/, '').trim();
  const rest = lines.slice(titleIdx + 1).join('\n').replace(/^\s+/, '');
  return { headline, rest };
}

export async function writeFlyerOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'flyer',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (flyer builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  // Dispatch into flyer slots. First sketch-shaped item wins hero; first
  // markdown sets headline + opening body; everything else stacks.
  let heroItem = null;
  let heroResolution = null;
  let heroFilename = null;
  let headline = null;
  const bodyChunks = [];
  const ctas = [];
  const skipped = [];

  for (const item of items) {
    if (!heroItem && (item.type === 'sketch' || item.type === 'svg' || item.type === 'image')) {
      heroItem = item;
      if (item.type === 'sketch') {
        const r = await resolveSketchItem(
          { metadata: { sketch_ref: item.metadata?.sketch_ref } },
          { technical: false },
        );
        heroResolution = r;
        if (r.svgStandalone) heroFilename = 'hero.svg';
      } else if (item.type === 'svg') {
        const raw = item.body || null;
        heroResolution = {
          svgInline: raw ? stripXmlDecl(raw) : null,
          svgStandalone: raw,
          dangling: !raw,
        };
        if (raw) heroFilename = 'hero.svg';
      } else if (item.type === 'image') {
        // images come from media_ref; v1 skips and records — wiring image
        // assets through is a follow-up. The flyer still works with text +
        // links; only the hero loses its image.
        skipped.push({ id: item.id, type: 'image', reason: 'image resolver not in v1' });
        heroItem = null;
      }
      continue;
    }
    if (item.type === 'markdown') {
      if (headline === null) {
        const split = splitMarkdownHeadline(item.bodyMd);
        headline = split.headline;
        if (split.rest) bodyChunks.push(renderMarkdown(split.rest));
      } else if (item.bodyMd) {
        bodyChunks.push(renderMarkdown(item.bodyMd));
      }
      continue;
    }
    if (item.type === 'text') {
      if (item.body) bodyChunks.push(`<p>${escapeHtml(item.body)}</p>`);
      continue;
    }
    if (item.type === 'link') {
      ctas.push({ url: item.sourceUrl, label: item.title || item.sourceUrl });
      continue;
    }
    skipped.push({ id: item.id, type: item.type, reason: `flyer does not render type '${item.type}'` });
  }

  // Fallbacks: when items aren't enough, fall back to aim + report_md.
  if (!headline) headline = aim;
  if (bodyChunks.length === 0 && reportMd && reportMd.trim().length > 0) {
    bodyChunks.push(renderMarkdown(reportMd));
  }

  // Hero rendering: either an inline SVG canvas, or a flat accent band.
  let heroVisualHtml = '';
  let heroClass = 'no-visual';
  if (heroItem && heroResolution && heroResolution.svgInline) {
    heroVisualHtml = heroResolution.svgInline;
    heroClass = '';
  }

  // CTA buttons.
  const ctasHtml = ctas.length > 0
    ? `<div class="cta-row">${ctas.map(
        (c) => `<a class="cta" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.label)}</a>`,
      ).join('')}</div>`
    : '';

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  // 1. report.md (the body source-of-truth if items don't carry it).
  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  // 2. hero asset on disk (if any).
  if (heroFilename && heroResolution.svgStandalone) {
    await fs.writeFile(path.join(dir, heroFilename), heroResolution.svgStandalone, 'utf8');
  }

  // 3. index.html via template.
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / flyer template v${FLYER_VERSION}`),
    template_version: escapeHtml(FLYER_VERSION),
    title: escapeHtml(headline || aim),
    flyer_headline: escapeHtml(headline || aim),
    hero_class: heroClass,
    hero_visual_html: heroVisualHtml,
    flyer_body_html: bodyChunks.join('\n') || '<p style="color:#94a3b8; font-style: italic;">(no body)</p>',
    flyer_ctas_html: ctasHtml,
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  // 4. manifest.json
  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'flyer',
    template_version: FLYER_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    headline,
    hero_filename: heroFilename || null,
    cta_count: ctas.length,
    body_block_count: bodyChunks.length,
    skipped_items: skipped,
    files: [
      'report.md',
      'index.html',
      ...(heroFilename ? [heroFilename] : []),
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
    templateVersion: FLYER_VERSION,
    headline,
    skippedItems: skipped,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeadline };
