/**
 * Field guide writer (publication kind: field_guide).
 *
 * Paginated book-style publication where each item becomes a "specimen
 * entry" — an illustration + a labeled descriptor + a body. Drawers become
 * sections (like genus / family / region groupings in a real field guide).
 *
 * Item resolver dispatch:
 *   sketch + markdown body_md → illustrated specimen (sketch is the
 *                                illustration, markdown's first line is the
 *                                label/name, the rest is the description)
 *   sketch (no markdown)      → specimen with just label/scientific name
 *   markdown only             → text-only entry (description without
 *                                illustration)
 *   svg                       → illustrated specimen (svg is the illustration)
 *   other                     → skipped
 *
 * `report_md` becomes the foreword on the cover page. Book-viewer mode is
 * supported (default aspect is 10/7, like picture_book).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';
import { resolveSketchItem, stripXmlDecl } from '../resolvers/sketch.js';

const DEFAULT_VIEWER_ASPECT = '10 / 7';

export const FIELD_GUIDE_VERSION = 'fg-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'field_guide.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function specimenNumber(n) { return String(n).padStart(3, '0'); }

function splitMarkdownHeader(md) {
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

export async function writeFieldGuideOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'field_guide',
  viewerAspect = DEFAULT_VIEWER_ASPECT,
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (field_guide builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  // Group by drawer.
  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of full.drawers) byDrawerId.set(d.id, []);
  const skipped = [];
  for (const item of items) {
    const accepted = ['sketch', 'svg', 'markdown'].includes(item.type);
    if (!accepted) {
      skipped.push({ id: item.id, type: item.type, reason: `field_guide does not render type '${item.type}'` });
      continue;
    }
    const bucket = byDrawerId.get(item.drawerId === null ? null : item.drawerId) || byDrawerId.get(null);
    bucket.push(item);
  }

  // Build sections.
  const sections = [];
  const rootItems = byDrawerId.get(null);
  if (rootItems.length > 0) sections.push({ name: null, items: rootItems });
  for (const d of full.drawers) {
    const items = byDrawerId.get(d.id);
    if (items.length > 0) sections.push({ name: d.name, items });
  }

  const specimenCount = sections.reduce((n, s) => n + s.items.length, 0);
  if (specimenCount === 0 && (!reportMd || !reportMd.trim())) {
    throw new Error(
      `Stash '${stashRef}' produced 0 specimens — field_guide needs sketch/svg/markdown items or a non-empty report_md.`,
    );
  }

  // Resolve each item into a specimen.
  const specimenFiles = [];
  let illustrationIdx = 0;
  const sectionsHtml = [];

  for (const section of sections) {
    if (section.name) {
      sectionsHtml.push(`<div class="section-divider"><h2>${escapeHtml(section.name)}</h2></div>`);
    }
    for (const item of section.items) {
      let illustrationHtml = '';
      let label = item.metadata?.label || item.title || '';
      let scientific = '';
      let description = '';
      let cls = 'specimen';

      if (item.type === 'sketch') {
        const r = await resolveSketchItem(
          { metadata: { sketch_ref: item.metadata?.sketch_ref } },
          { technical: false },
        );
        if (r.dangling || !r.svgInline) {
          illustrationHtml = `<div class="illustration missing">missing illustration · ${escapeHtml(item.metadata?.sketch_ref || '')}</div>`;
        } else {
          illustrationIdx += 1;
          const filename = `specimen-${specimenNumber(illustrationIdx)}.svg`;
          specimenFiles.push({ filename, body: r.svgStandalone });
          illustrationHtml = `<div class="illustration">${r.svgInline}</div>`;
        }
        if (item.bodyMd) {
          const { title, rest } = splitMarkdownHeader(item.bodyMd);
          if (title) { label = label || title; scientific = title === label ? '' : title; }
          description = rest ? renderMarkdown(rest) : '';
        }
        if (!label) label = item.metadata?.label || 'Specimen';
      } else if (item.type === 'svg') {
        const raw = item.body || null;
        if (raw) {
          illustrationIdx += 1;
          const filename = `specimen-${specimenNumber(illustrationIdx)}.svg`;
          specimenFiles.push({ filename, body: raw });
          illustrationHtml = `<div class="illustration">${stripXmlDecl(raw)}</div>`;
        } else {
          illustrationHtml = `<div class="illustration missing">missing illustration</div>`;
        }
        label = item.title || 'Specimen';
      } else if (item.type === 'markdown') {
        const { title, rest } = splitMarkdownHeader(item.bodyMd);
        label = title || item.title || 'Note';
        description = rest ? renderMarkdown(rest) : '';
        cls = 'specimen text-only';
      }

      const labelHtml = `<p class="label">${escapeHtml(label)}</p>`;
      const scientificHtml = scientific && scientific !== label ? `<p class="scientific">${escapeHtml(scientific)}</p>` : '';
      const descriptionHtml = description ? `<div class="description">${description}</div>` : '';
      sectionsHtml.push(
        `<article class="${cls}" data-viewer-page>${illustrationHtml}${labelHtml}${scientificHtml}${descriptionHtml}</article>`,
      );
    }
  }

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  for (const f of specimenFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const forewordHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#94a3b8;font-style:italic;">(no foreword)</p>';

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / field_guide template v${FIELD_GUIDE_VERSION}`),
    template_version: escapeHtml(FIELD_GUIDE_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_foreword_html: forewordHtml,
    specimens_html: sectionsHtml.join('\n'),
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
    template: 'field_guide',
    template_version: FIELD_GUIDE_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    section_count: sections.length,
    specimen_count: specimenCount,
    skipped_items: skipped,
    files: [
      'report.md',
      'index.html',
      ...specimenFiles.map((f) => f.filename),
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
    templateVersion: FIELD_GUIDE_VERSION,
    specimenCount,
    skippedItems: skipped,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeader };
