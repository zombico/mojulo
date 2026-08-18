/**
 * Pamphlet writer (publication kind: pamphlet).
 *
 * 6-panel tri-fold layout (front cover, 4 content panels, back cover) sized
 * for US-letter print folding. Each panel renders as its own card on screen
 * — paginated for browser print — and the book-viewer mode shows one panel
 * at a time (default aspect 11/17, portrait-tall like a folded panel).
 *
 * Item resolver dispatch:
 *   markdown → content panel (h1 = panel title, body = panel content)
 *   sketch / svg → illustration appended to the previous content panel
 *                   (or as its own visual-only panel if no markdown precedes)
 *   other → skipped
 *
 * `report_md` becomes the front-cover blurb (under the title). If 5 or
 * fewer markdown items are gathered, the back cover gets a default
 * "End / share" note. More than 4 content items → extra panels still render
 * (the artifact stops being a true tri-fold but stays readable).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';
import { resolveSketchItem, stripXmlDecl } from '../resolvers/sketch.js';

const DEFAULT_VIEWER_ASPECT = '11 / 17';

export const PAMPHLET_VERSION = 'pa-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'pamphlet.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

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

function panelNumber(n) { return String(n).padStart(2, '0'); }

export async function writePamphletOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'pamphlet',
  viewerAspect = DEFAULT_VIEWER_ASPECT,
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (pamphlet builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const skipped = [];
  const contentPanels = [];
  // Each content panel: { title, bodyHtml, illustrationHtml?, illustrationFile? }
  let currentPanel = null;
  let illustrationFiles = [];
  let illustrationIdx = 0;

  for (const item of items) {
    if (item.type === 'markdown') {
      // Flush current panel.
      if (currentPanel) contentPanels.push(currentPanel);
      const { title, rest } = splitMarkdownHeader(item.bodyMd);
      currentPanel = {
        title: title || item.title || 'Panel',
        bodyHtml: rest ? renderMarkdown(rest) : '',
        illustrationHtml: null,
        illustrationFile: null,
      };
      continue;
    }
    if (item.type === 'sketch' || item.type === 'svg') {
      let inline = null;
      let standalone = null;
      if (item.type === 'sketch') {
        const r = await resolveSketchItem(
          { metadata: { sketch_ref: item.metadata?.sketch_ref } },
          { technical: false },
        );
        if (!r.dangling) { inline = r.svgInline; standalone = r.svgStandalone; }
      } else {
        const raw = item.body || null;
        if (raw) { inline = stripXmlDecl(raw); standalone = raw; }
      }
      if (!inline) continue; // silently drop missing visuals — pamphlet is print-oriented
      illustrationIdx += 1;
      const filename = `panel-${panelNumber(illustrationIdx)}.svg`;
      illustrationFiles.push({ filename, body: standalone });
      const illustrationHtml = `<div class="illustration">${inline}</div>`;
      if (currentPanel) {
        currentPanel.illustrationHtml = illustrationHtml;
        currentPanel.illustrationFile = filename;
      } else {
        // Visual-only panel.
        contentPanels.push({ title: item.metadata?.label || item.title || '', bodyHtml: '', illustrationHtml, illustrationFile: filename });
      }
      continue;
    }
    skipped.push({ id: item.id, type: item.type, reason: `pamphlet does not render type '${item.type}'` });
  }
  if (currentPanel) contentPanels.push(currentPanel);

  if (contentPanels.length === 0 && (!reportMd || !reportMd.trim())) {
    throw new Error(
      `Stash '${stashRef}' produced 0 pamphlet content — needs markdown / sketch items or a non-empty report_md.`,
    );
  }

  // Render panels: front cover, content panels, back cover.
  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '';
  const blurbCompactHtml = blurbHtml
    ? `<p style="margin-top:18px;font-size:13px;color:rgba(255,255,255,0.85);">${blurbHtml.replace(/<p>|<\/p>/g, '')}</p>`
    : '';

  const frontPanelHtml = [
    '<section class="panel front" data-viewer-page>',
    '<div class="top">',
    `<p class="eyebrow">${escapeHtml(full.stash.title)}</p>`,
    `<h1>${escapeHtml(aim)}</h1>`,
    blurbCompactHtml,
    '</div>',
    `<p class="imprint">Mojulo &middot; ${escapeHtml(humanNow())}</p>`,
    '</section>',
  ].join('\n');

  const contentPanelsHtml = contentPanels.map((p, i) => `
<section class="panel content" data-viewer-page>
  <p class="label">Panel ${i + 1}</p>
  <h2>${escapeHtml(p.title)}</h2>
  <div class="body">${p.bodyHtml || '<p style="color:#a1a1aa;font-style:italic;">(no body)</p>'}</div>
  ${p.illustrationHtml || ''}
</section>`).join('\n');

  const backPanelHtml = `
<section class="panel back" data-viewer-page>
  <h2>End</h2>
  <p class="end-note">Materialized by mojulo cook. Fold along the two vertical creases for a tri-fold pamphlet.</p>
</section>`;

  const panelsHtml = frontPanelHtml + '\n' + contentPanelsHtml + '\n' + backPanelHtml;

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  for (const f of illustrationFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / pamphlet template v${PAMPHLET_VERSION}`),
    template_version: escapeHtml(PAMPHLET_VERSION),
    title: escapeHtml(aim),
    panels_html: panelsHtml,
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
    template: 'pamphlet',
    template_version: PAMPHLET_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    panel_count: contentPanels.length + 2, // +2 for front and back
    illustration_count: illustrationFiles.length,
    skipped_items: skipped,
    files: [
      'report.md',
      'index.html',
      ...illustrationFiles.map((f) => f.filename),
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
    templateVersion: PAMPHLET_VERSION,
    panelCount: contentPanels.length + 2,
    skippedItems: skipped,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeader };
