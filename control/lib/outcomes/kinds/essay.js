/**
 * Outcome Artifact writer (Ring 9 — research mode v2, slice 2).
 *
 * Materializes a Cook's output as a self-contained folder:
 *
 *   <OUTCOMES_DIR>/<cook_ref>/
 *     ├── report.md       — raw markdown (the load-bearing artifact)
 *     ├── index.html      — static doc, all visuals inlined or referenced
 *     ├── manifest.json   — machine-readable index (what's in the folder, why)
 *     ├── *.svg / *.png   — visual files referenced by index.html
 *
 * Strictly static: no JS framework, no client-side rendering, no runtime. The
 * file on disk IS the artifact — it can be opened directly from the filesystem,
 * served via the /outcomes/<ref>/ route, or zipped and emailed.
 *
 * Outcomes are frozen to the template version they were authored against.
 * When TEMPLATE_VERSION is bumped, existing outcomes are NOT regenerated — they
 * stay as documents at their original version (recorded in manifest.json).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';

export const TEMPLATE_VERSION = '1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'outcome.html');

const FILENAME_SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}\.(svg|png)$/;

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function renderCleavedSlices(slices) {
  if (!slices || slices.length === 0) return '<span style="color:#94a3b8">(none)</span>';
  return slices
    .map((s) => {
      const title = escapeHtml(s.title || '(untitled)');
      const ref = escapeHtml(s.stashRef);
      // Distinguish a cleaved slice ("3 of 13 items") from a whole-stash slice
      // ("whole · 13 items") in the chip — the cleaved/whole distinction is
      // load-bearing for understanding what context Cook held in superposition.
      const tag = s.whole
        ? `whole · ${s.itemCount} item${s.itemCount === 1 ? '' : 's'}`
        : `${s.itemCount} of ${s.total} item${s.total === 1 ? '' : 's'}`;
      return `<a class="stash-chip" href="/stashes/${ref}">${title} <span style="color:#94a3b8">[${escapeHtml(tag)}]</span><code>${ref}</code></a>`;
    })
    .join('');
}

function renderVisualsSection(visuals) {
  if (!visuals || visuals.length === 0) return '';
  const cards = visuals
    .map((v) => {
      const caption = v.caption ? `<div class="visual-caption">${escapeHtml(v.caption)}</div>` : '';
      let body;
      if (v.type === 'svg') {
        // SVG body inlines directly. We already validated it starts with
        // <?xml or <svg at the gate (same rule as stash svg items).
        body = v.body;
      } else if (v.type === 'png') {
        body = `<img src="${escapeHtml(v.filename)}" alt="${escapeHtml(v.caption || v.filename)}">`;
      } else {
        body = `<em style="color:#94a3b8">unknown visual type: ${escapeHtml(v.type)}</em>`;
      }
      return `<figure class="visual-card"><div class="visual-body">${body}</div>${caption}</figure>`;
    })
    .join('\n');
  return `<section class="visuals"><h2>Visuals</h2>${cards}</section>`;
}

function headline(query, max = 80) {
  const trimmed = String(query || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function isoNow() {
  return new Date().toISOString();
}

function humanNow() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

/** Validate a visual entry. Throws on contract failure. */
function validateVisual(v, i) {
  if (!v || typeof v !== 'object') throw new Error(`visuals[${i}] must be an object`);
  if (!v.filename || typeof v.filename !== 'string') {
    throw new Error(`visuals[${i}].filename is required`);
  }
  if (!FILENAME_SAFE.test(v.filename)) {
    throw new Error(
      `visuals[${i}].filename '${v.filename}' must be safe (alphanumeric + _-., ending in .svg or .png, no paths)`,
    );
  }
  if (v.type !== 'svg' && v.type !== 'png') {
    throw new Error(`visuals[${i}].type must be 'svg' or 'png'`);
  }
  if (v.type === 'svg') {
    if (!v.body || typeof v.body !== 'string') {
      throw new Error(`visuals[${i}] (svg) requires \`body\` (the SVG source)`);
    }
    if (!/^\s*<(\?xml|svg)\b/i.test(v.body)) {
      throw new Error(`visuals[${i}].body must start with <?xml or <svg`);
    }
  } else {
    if (!v.data_base64 || typeof v.data_base64 !== 'string') {
      throw new Error(`visuals[${i}] (png) requires \`data_base64\``);
    }
  }
}

/**
 * Write a complete Outcome Artifact folder.
 *
 * @param {object} args
 * @param {string} args.cookRef
 * @param {string} args.aim — the singular dismantling question (the vow)
 * @param {Array<{ stashRef, title, whole, itemCount, total? }>} args.slices —
 *   resolved slice manifest (the cleaved material held in superposition)
 * @param {string} args.reportMd
 * @param {Array<{ filename, type, body?, data_base64?, caption? }>} [args.visuals]
 * @param {string} [args.suggestedLens]
 * @returns {Promise<{ outcomeDir, indexPath, fileCount, templateVersion }>}
 */
export async function writeOutcome({ cookRef, aim, slices, reportMd, visuals = [], suggestedLens, publicationKind = 'essay', styleOverridesHtml = '' }) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (typeof aim !== 'string' || aim.length === 0) throw new Error('aim is required');
  if (typeof reportMd !== 'string' || reportMd.length === 0) throw new Error('reportMd is required');
  if (!Array.isArray(slices)) throw new Error('slices must be an array');
  if (!Array.isArray(visuals)) throw new Error('visuals must be an array');

  // Validate all visuals up front — fail fast, no half-written folder.
  visuals.forEach(validateVisual);

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  // 1. report.md — the source-of-truth artifact.
  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  // 2. visual files (each visual gets a file in the folder, even SVGs that
  //    also inline into index.html — keeps the folder a complete export).
  for (const v of visuals) {
    const filePath = path.join(dir, v.filename);
    if (v.type === 'svg') {
      await fs.writeFile(filePath, v.body, 'utf8');
    } else {
      await fs.writeFile(filePath, Buffer.from(v.data_base64, 'base64'));
    }
  }

  // 3. render markdown → HTML, fill the template, write index.html.
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const reportHtml = renderMarkdown(reportMd);
  const lens = suggestedLens ? escapeHtml(suggestedLens) : '<span style="color:#94a3b8">(unset)</span>';
  const titleText = headline(aim) || cookRef;
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / outcome template v${TEMPLATE_VERSION}`),
    title: escapeHtml(titleText),
    aim_text: escapeHtml(aim),
    cleaved_slices: renderCleavedSlices(slices),
    lens,
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    report_html: reportHtml,
    visuals_section: renderVisualsSection(visuals),
    plan_handoff_url: `/research/cooks/${encodeURIComponent(cookRef)}/send-to-plan`,
    template_version: escapeHtml(TEMPLATE_VERSION),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  // 4. manifest.json — machine-readable index of what's in the folder.
  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template_version: TEMPLATE_VERSION,
    generated_at: isoNow(),
    aim,
    suggested_lens: suggestedLens || null,
    slices: slices.map((s) => ({
      stash_ref: s.stashRef,
      title: s.title,
      whole: !!s.whole,
      item_count: s.itemCount,
      ...(s.whole ? {} : { item_ids: s.itemIds, total: s.total }),
    })),
    files: [
      'report.md',
      'index.html',
      ...visuals.map((v) => v.filename),
    ],
    visuals: visuals.map((v) => ({
      filename: v.filename,
      type: v.type,
      caption: v.caption || null,
    })),
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1, // +1 for manifest.json itself
    templateVersion: TEMPLATE_VERSION,
  };
}

// Test seam.
export const _internals = { escapeHtml, headline, validateVisual, FILENAME_SAFE };
