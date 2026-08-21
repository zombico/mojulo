/**
 * Brief writer (publication kind: brief).
 *
 * Single-page executive brief on US-letter geometry. Two-column body —
 * supporting points on the left (markdown items), sidebar visuals + callouts
 * on the right (sketches + text items). The agent's `report_md` lands in
 * the executive-summary block at the top.
 *
 * Item resolver dispatch:
 *   markdown → point card in left column
 *   sketch / svg → figure in right sidebar
 *   text → callout box in right sidebar
 *   image / link / pointer → skipped (recorded in manifest.skipped_items)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';
import { resolveSketchItem, stripXmlDecl } from '../resolvers/sketch.js';

export const BRIEF_VERSION = 'br-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'brief.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function figureNumber(n) { return String(n).padStart(2, '0'); }

export async function writeBriefOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'brief',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (brief builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const points = [];      // markdown items
  const figures = [];     // sketch/svg items
  const callouts = [];    // text items
  const skipped = [];

  for (const item of items) {
    if (item.type === 'markdown') {
      points.push(item);
    } else if (item.type === 'sketch') {
      const r = await resolveSketchItem(
        { metadata: { sketch_ref: item.metadata?.sketch_ref } },
        { technical: false },
      );
      figures.push({ item, resolution: r });
    } else if (item.type === 'svg') {
      const raw = item.body || null;
      figures.push({
        item,
        resolution: {
          svgInline: raw ? stripXmlDecl(raw) : null,
          svgStandalone: raw,
          dangling: !raw,
        },
      });
    } else if (item.type === 'text') {
      callouts.push(item);
    } else {
      skipped.push({ id: item.id, type: item.type, reason: `brief does not render type '${item.type}'` });
    }
  }

  if (points.length === 0 && figures.length === 0 && callouts.length === 0 && (!reportMd || !reportMd.trim())) {
    throw new Error(
      `Stash '${stashRef}' produced 0 brief content — needs markdown / sketch / text items or a non-empty report_md.`,
    );
  }

  // Build points HTML.
  const pointsHtml = points.map((p) => {
    const headingMatch = /^#+\s+(.+)$/m.exec(p.bodyMd || '');
    const heading = headingMatch ? headingMatch[1].trim() : (p.title || 'Point');
    const body = (p.bodyMd || '').replace(/^#+\s+.+$/m, '').trim();
    const bodyHtml = body ? renderMarkdown(body) : '';
    return `<div class="point"><h2>${escapeHtml(heading)}</h2>${bodyHtml}</div>`;
  }).join('\n');

  // Build sidebar HTML.
  const sidebarParts = [];
  const figureFiles = [];
  let figIdx = 0;
  for (const f of figures) {
    if (f.resolution.dangling || !f.resolution.svgInline) {
      sidebarParts.push(`<div class="sidebar-item callout">⚠ missing visual — ${escapeHtml(f.item.metadata?.sketch_ref || f.item.title || '(no ref)')}</div>`);
      continue;
    }
    figIdx += 1;
    const filename = `figure-${figureNumber(figIdx)}.svg`;
    figureFiles.push({ filename, body: f.resolution.svgStandalone });
    const caption = f.item.metadata?.label || f.item.title || '';
    sidebarParts.push(
      `<div class="sidebar-item"><figure>${f.resolution.svgInline}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure></div>`,
    );
  }
  for (const c of callouts) {
    if (c.body) {
      sidebarParts.push(`<div class="sidebar-item callout">${escapeHtml(c.body)}</div>`);
    }
  }
  const sidebarHtml = sidebarParts.length > 0
    ? sidebarParts.join('\n')
    : '<div class="sidebar-item callout" style="font-style:italic;color:#94a3b8;">(no sidebar items)</div>';

  // Executive summary.
  const execSummaryHtml = reportMd && reportMd.trim().length > 0
    ? `<div class="exec-summary"><p class="label">Executive summary</p>${renderMarkdown(reportMd)}</div>`
    : '';

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  for (const f of figureFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / brief template v${BRIEF_VERSION}`),
    template_version: escapeHtml(BRIEF_VERSION),
    title: escapeHtml(aim),
    exec_summary_html: execSummaryHtml,
    points_html: pointsHtml || '<p style="color:#94a3b8; font-style: italic;">(no points)</p>',
    sidebar_html: sidebarHtml,
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
    template: 'brief',
    template_version: BRIEF_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    point_count: points.length,
    figure_count: figureFiles.length,
    callout_count: callouts.length,
    skipped_items: skipped,
    files: [
      'report.md',
      'index.html',
      ...figureFiles.map((f) => f.filename),
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
    templateVersion: BRIEF_VERSION,
    pointCount: points.length,
    figureCount: figureFiles.length,
    skippedItems: skipped,
  };
}

export const _internals = { escapeHtml };
