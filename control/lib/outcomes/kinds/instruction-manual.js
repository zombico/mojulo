/**
 * Instruction-manual writer (publication kind: instruction_manual).
 *
 * IKEA-style furniture-assembly booklet. Paginated (book-viewer), portrait.
 * Each assembly STEP is one page: a dominant exploded-isometric diagram band on
 * top, a numbered multi-column instruction block, and a pinned fine-print foot
 * strip for disclaimers/warnings ("really small text").
 *
 * Drawers become numbered Parts. Items inside a section route to:
 *
 *   markdown → opens a NEW numbered step. Leading `# heading` = step title; the
 *              body is rendered multi-column. A TRAILING `> blockquote` is peeled
 *              off as that step's fine print.
 *   sketch   → if the current open step has no diagram, it becomes that step's
 *              diagram; otherwise it opens a new diagram-only step page. The
 *              "gather the diagram right after its step" convention is what pairs
 *              them. Live sketches are written to step-NNN.svg and inlined;
 *              dangling refs render a placeholder.
 *   text     → appended to the current step's fine-print zone (or a standalone
 *              note page if no step is open yet).
 *
 * Anything else is skipped. `report_md` becomes the cover blurb; `aim` is the
 * cover title. Default aspect 7/10 — portrait booklet.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';
import { resolveSketchItem } from '../resolvers/sketch.js';

const DEFAULT_VIEWER_ASPECT = '7 / 10'; // portrait booklet
export const INSTRUCTION_MANUAL_VERSION = 'im-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'instruction_manual.html');

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

/**
 * Peel a TRAILING blockquote block off markdown — used as the step's fine
 * print/warning. Returns { body, finePrint } where finePrint is plain text
 * (blockquote markers stripped, lines joined). If there's no trailing
 * blockquote the body is returned unchanged and finePrint is ''.
 */
function peelTrailingFinePrint(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end -= 1;
  let start = end;
  while (start > 0 && /^>\s?/.test(lines[start - 1])) start -= 1;
  if (start === end) return { body: md, finePrint: '' };
  const finePrint = lines.slice(start, end).map((l) => l.replace(/^>\s?/, '')).join(' ').trim();
  const body = lines.slice(0, start).join('\n').replace(/\s+$/, '');
  return { body, finePrint };
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
      skipped.push({ id: it.id, type: it.type, reason: `instruction_manual does not render type '${it.type}'` });
      continue;
    }
    const bucket = byDrawerId.get(it.drawerId === null ? null : it.drawerId)
      || byDrawerId.get(null);
    bucket.push(it);
  }

  const sections = [];
  const rootItems = byDrawerId.get(null);
  if (rootItems.length > 0) sections.push({ name: null, drawerId: null, items: rootItems });
  for (const d of full.drawers) {
    const bucket = byDrawerId.get(d.id);
    if (bucket.length > 0) sections.push({ name: d.name, drawerId: d.id, items: bucket });
  }
  return { sections, skippedItems: skipped };
}

export async function writeInstructionManualOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'instruction_manual',
  viewerAspect = DEFAULT_VIEWER_ASPECT,
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (instruction_manual builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = groupItemsByDrawer(full, itemIds);
  const totalSlots = plan.sections.reduce((n, s) => n + s.items.length, 0);
  if (totalSlots === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 items — instruction_manual needs at least one markdown step or sketch diagram.`,
    );
  }

  const diagramFiles = [];
  const sectionsOut = [];
  let partIdx = 0;
  let stepCounter = 0;

  for (const section of plan.sections) {
    const numbered = section.name !== null;
    if (numbered) partIdx += 1;
    const steps = [];
    let cur = null; // the currently open step

    const openStep = (title) => {
      stepCounter += 1;
      cur = { number: stepCounter, title: title || '', bodyHtml: '', finePrintBits: [], diagram: null };
      steps.push(cur);
      return cur;
    };

    for (const item of section.items) {
      if (item.type === 'markdown') {
        const { title, rest } = splitMarkdownHeader(item.bodyMd);
        const { body, finePrint } = peelTrailingFinePrint(rest || item.bodyMd || '');
        const step = openStep(title);
        step.bodyHtml = body ? renderMarkdown(body) : '';
        if (finePrint) step.finePrintBits.push(finePrint);
      } else if (item.type === 'sketch') {
        const sketchRef = item.metadata?.sketch_ref;
        // Diagrams sit on the light assembly-sheet band — render with dark ink
        // so default-colored labels/callouts stay legible (sketches default to
        // a white-on-dark theme for the /sketches viewer).
        const r = await resolveSketchItem(
          { metadata: { sketch_ref: sketchRef } },
          { technical: false, surface: 'light' },
        );
        let filename = null;
        let inline = null;
        if (!r.dangling && r.svgInline) {
          filename = `step-${pad(diagramFiles.length + 1)}.svg`;
          diagramFiles.push({ filename, body: r.svgStandalone });
          inline = r.svgInline;
        }
        const diagram = {
          inline, filename, dangling: r.dangling, sketchRef, label: item.metadata?.label || '',
        };
        if (cur && !cur.diagram) {
          cur.diagram = diagram;
        } else {
          const step = openStep('');
          step.diagram = diagram;
        }
      } else if (item.type === 'text') {
        if (cur) cur.finePrintBits.push(item.body || '');
        else { const step = openStep(''); step.finePrintBits.push(item.body || ''); }
      }
    }

    sectionsOut.push({
      idx: numbered ? partIdx : 0,
      numbered,
      name: section.name,
      steps,
    });
  }

  // Page sections.
  const pageBlocks = [];
  for (const s of sectionsOut) {
    if (s.numbered) {
      pageBlocks.push(
        `<section class="part-divider" data-viewer-page>`
          + `<p class="part-eyebrow">Part ${s.idx}</p>`
          + `<h2 class="part-name">${escapeHtml(s.name)}</h2>`
          + `</section>`,
      );
    }
    for (const step of s.steps) {
      let diagramHtml;
      if (!step.diagram) {
        diagramHtml = `<div class="diagram empty" aria-hidden="true"></div>`;
      } else if (step.diagram.inline) {
        diagramHtml = `<div class="diagram">${step.diagram.inline}</div>`;
      } else {
        diagramHtml = `<div class="diagram missing">missing diagram &middot; ${escapeHtml(step.diagram.sketchRef || '')}</div>`;
      }
      const titleHtml = step.title ? `<h3 class="step-title">${escapeHtml(step.title)}</h3>` : '';
      const bodyHtml = step.bodyHtml ? `<div class="step-body">${step.bodyHtml}</div>` : '';
      const finePrint = step.finePrintBits.filter(Boolean).join(' ');
      const finePrintHtml = finePrint
        ? `<div class="fine-print"><span class="fine-print-mark">!</span><span>${escapeHtml(finePrint)}</span></div>`
        : '';
      pageBlocks.push(
        `<section class="page step-page" data-viewer-page>`
          + `<div class="illustration">${diagramHtml}</div>`
          + `<div class="step-text">`
          + `<div class="step-num" aria-label="Step ${step.number}">${step.number}</div>`
          + `<div class="step-content">${titleHtml}${bodyHtml}</div>`
          + `</div>`
          + finePrintHtml
          + `</section>`,
      );
    }
  }

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');
  for (const f of diagramFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#94a3b8;font-style:italic;">(no overview note)</p>';

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / instruction_manual template v${INSTRUCTION_MANUAL_VERSION}`),
    template_version: escapeHtml(INSTRUCTION_MANUAL_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_blurb_html: blurbHtml,
    pages_html: pageBlocks.join('\n'),
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    viewer_aspect: escapeHtml(viewerAspect),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  const stepCount = sectionsOut.reduce((n, s) => n + s.steps.length, 0);
  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'instruction_manual',
    template_version: INSTRUCTION_MANUAL_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    part_count: sectionsOut.filter((s) => s.numbered).length,
    step_count: stepCount,
    diagram_count: diagramFiles.length,
    parts: sectionsOut.map((s) => ({
      number: s.numbered ? s.idx : null,
      name: s.name,
      steps: s.steps.map((st) => ({
        number: st.number,
        title: st.title || null,
        has_diagram: !!st.diagram,
        diagram_filename: st.diagram?.filename || null,
        dangling: !!st.diagram?.dangling,
      })),
    })),
    skipped_items: plan.skippedItems,
    files: ['report.md', 'index.html', ...diagramFiles.map((f) => f.filename)],
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1,
    templateVersion: INSTRUCTION_MANUAL_VERSION,
    stepCount,
    skippedItems: plan.skippedItems,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeader, peelTrailingFinePrint, groupItemsByDrawer };
