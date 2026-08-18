/**
 * Photojournal outcome writer (cook template variant).
 *
 * Materializes a single stash as a static, scroll-mode photo journal: a
 * continuous vertical run of photographs with markdown captions, a cover-photo
 * title page, and drawers as section breaks. Unlike the paginated kinds
 * (picture_book, slide_deck) there is no book-viewer — the page is a long
 * scroll on screen, and the `@media print` rules turn it into a "direct"
 * printable artifact (one photo per sheet, all chrome stripped — no page-meta,
 * no colophon, just the photographs and their captions).
 *
 * This is the first publication kind to render `image` items. Each image item's
 * `media_ref` is read out of stored media via the shared image resolver and
 * written into the outcome folder as a standalone file; `body_md` becomes the
 * caption. The FIRST image in the stash becomes the cover photo (lifted out of
 * the flow); `markdown` items become prose interludes between photos.
 *
 *   <OUTCOMES_DIR>/<cook_ref>/
 *     ├── report.md          — the cover blurb the agent authored (may be empty)
 *     ├── index.html         — the static photo journal (the load-bearing file)
 *     ├── manifest.json      — machine-readable journal structure
 *     ├── cover.jpg          — the title-page photo (if present)
 *     ├── photo-001.jpg      — each entry's photograph as a standalone file
 *     ├── photo-002.png
 *     └── …
 *
 * Frozen to its template version (PHOTOJOURNAL_VERSION). No LLM call, no
 * client-side rendering, no JS framework — same posture as the other kinds.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomesBaseDir } from '../paths.js';
import { resolveImageItem } from '../resolvers/image.js';

export const PHOTOJOURNAL_VERSION = 'pj-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'photojournal.html');

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

function seq(n) {
  return String(n).padStart(3, '0');
}

/**
 * Plan the journal from a stash.
 *
 * Walk order matches picture_book: root items first, then drawers in
 * `listDrawers` order; items within a bucket in intake order. The first
 * `image` item encountered (anywhere) is lifted out as the cover photo and is
 * NOT repeated in the flow. Remaining `image` items become photo entries;
 * `markdown` items become prose interludes; everything else is skipped with a
 * record for the manifest.
 *
 * Returns { cover, sections, skippedItems } where
 *   cover    = { stashItemId, mediaRef, mime, alt, captionMd } | null
 *   sections = [{ name | null (root), entries: [photoEntry | proseEntry] }]
 */
function planJournalFromStash(full) {
  const { drawers, items } = full;

  const byDrawerId = new Map();
  byDrawerId.set(null, []);
  for (const d of drawers) byDrawerId.set(d.id, []);
  for (const it of items) {
    const bucket = byDrawerId.get(it.drawerId === null ? null : it.drawerId);
    (bucket || byDrawerId.get(null)).push(it);
  }

  // Ordered buckets: root first, then drawers in order.
  const ordered = [];
  if (byDrawerId.get(null).length > 0) ordered.push({ name: null, items: byDrawerId.get(null) });
  for (const d of drawers) {
    if (byDrawerId.get(d.id).length > 0) ordered.push({ name: d.name, items: byDrawerId.get(d.id) });
  }

  const skipped = [];
  let cover = null;
  const sections = [];

  for (const bucket of ordered) {
    const entries = [];
    for (const it of bucket.items) {
      if (it.type === 'image') {
        if (!cover) {
          cover = itemToPhoto(it);
          continue; // lifted to the title page; not repeated in the flow
        }
        entries.push(itemToPhoto(it));
      } else if (it.type === 'markdown') {
        entries.push({ kind: 'prose', stashItemId: it.id, bodyMd: it.bodyMd || '' });
      } else {
        skipped.push({
          id: it.id,
          type: it.type,
          reason: 'photojournal renders image (photo) and markdown (prose) items only',
        });
      }
    }
    if (entries.length > 0) sections.push({ name: bucket.name, entries });
  }

  return { cover, sections, skippedItems: skipped };
}

function itemToPhoto(it) {
  return {
    kind: 'photo',
    stashItemId: it.id,
    mediaRef: it.mediaRef,
    mime: it.metadata?.mime || null,
    alt: it.metadata?.label || it.title || '',
    captionMd: it.bodyMd || null,
  };
}

function renderPhoto(entry) {
  const figure = entry.dangling || !entry.filename
    ? `<div class="photo missing">missing photo &middot; ${escapeHtml(entry.mediaRef || '(no media_ref)')}</div>`
    : `<img class="photo" src="${escapeHtml(entry.filename)}" alt="${escapeHtml(entry.alt)}" loading="lazy">`;
  const caption = entry.captionMd
    ? `<figcaption class="caption">${renderMarkdown(entry.captionMd)}</figcaption>`
    : '';
  return ['<figure class="entry photo-entry" data-print-page>', figure, caption, '</figure>'].join('\n');
}

function renderProse(entry) {
  if (!entry.bodyMd || !entry.bodyMd.trim()) return '';
  return `<div class="entry prose-entry">${renderMarkdown(entry.bodyMd)}</div>`;
}

/**
 * Write a photojournal outcome folder.
 *
 * @param {object} args
 * @param {string} args.cookRef
 * @param {string} args.aim — used as the title-page heading
 * @param {string} args.stashRef — the single stash the journal is built from
 * @param {string} [args.reportMd] — optional title-page blurb (markdown)
 * @param {string} [args.outcomeDir] — base dir override
 * @param {string} [args.styleOverridesHtml] — trailing <style>/<link> injected into <head>
 * @returns {Promise<{ outcomeDir, indexPath, fileCount, templateVersion, photoCount, sections, skippedItems }>}
 */
export async function writePhotojournalOutcome({
  cookRef,
  aim,
  stashRef,
  reportMd = '',
  outcomeDir,
  publicationKind = 'photojournal',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required (used as the title-page heading)');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (photojournal builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const plan = planJournalFromStash(full);
  const photoCount =
    (plan.cover ? 1 : 0) +
    plan.sections.reduce((n, s) => n + s.entries.filter((e) => e.kind === 'photo').length, 0);
  if (photoCount === 0) {
    throw new Error(
      `Stash '${stashRef}' has no image items — photojournal needs at least one image-typed (photo) item.`,
    );
  }

  const dir = outcomeDir || path.join(outcomesBaseDir(), cookRef);
  await fs.mkdir(dir, { recursive: true });

  const files = ['report.md', 'index.html'];

  // Resolve + write the cover photo.
  let coverPhotoHtml = '';
  let coverManifest = null;
  if (plan.cover) {
    const resolved = await resolveImageItem({ mediaRef: plan.cover.mediaRef, metadata: { mime: plan.cover.mime } });
    if (!resolved.dangling && resolved.buffer) {
      const filename = `cover.${resolved.ext}`;
      await fs.writeFile(path.join(dir, filename), resolved.buffer);
      files.push(filename);
      coverPhotoHtml = `<img class="cover-photo" src="${escapeHtml(filename)}" alt="${escapeHtml(plan.cover.alt)}">`;
      coverManifest = { stash_item_id: plan.cover.stashItemId, filename, dangling: false };
    } else {
      coverPhotoHtml = `<div class="cover-photo missing">missing cover photo &middot; ${escapeHtml(plan.cover.mediaRef || '(no media_ref)')}</div>`;
      coverManifest = { stash_item_id: plan.cover.stashItemId, filename: null, dangling: true };
    }
  }

  // Resolve + write each flow photo, then render every section.
  let photoIdx = 0;
  const sectionHtml = [];
  for (const section of plan.sections) {
    const parts = [];
    if (section.name) {
      parts.push(
        `<div class="section-divider" data-print-page><h2>${escapeHtml(section.name)}</h2></div>`,
      );
    }
    for (const entry of section.entries) {
      if (entry.kind === 'photo') {
        photoIdx += 1;
        const resolved = await resolveImageItem({ mediaRef: entry.mediaRef, metadata: { mime: entry.mime } });
        if (!resolved.dangling && resolved.buffer) {
          entry.filename = `photo-${seq(photoIdx)}.${resolved.ext}`;
          entry.dangling = false;
          await fs.writeFile(path.join(dir, entry.filename), resolved.buffer);
          files.push(entry.filename);
        } else {
          entry.dangling = true;
        }
        parts.push(renderPhoto(entry));
      } else {
        parts.push(renderProse(entry));
      }
    }
    sectionHtml.push(parts.join('\n'));
  }

  // 1. report.md — the title-page blurb (source-of-truth for the cover note).
  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  // 2. index.html.
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const blurbHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#8a8a8a; font-style: italic;">(no cover note)</p>';

  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / photojournal template v${PHOTOJOURNAL_VERSION}`),
    template_version: escapeHtml(PHOTOJOURNAL_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    cover_photo_html: coverPhotoHtml,
    cover_blurb_html: blurbHtml,
    sections_html: sectionHtml.join('\n'),
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  // 3. manifest.json.
  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'photojournal',
    template_version: PHOTOJOURNAL_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    photo_count: photoCount,
    cover: coverManifest,
    sections: plan.sections.map((s) => ({
      name: s.name,
      entries: s.entries.map((e) =>
        e.kind === 'photo'
          ? {
              kind: 'photo',
              stash_item_id: e.stashItemId,
              filename: e.filename || null,
              caption: e.captionMd,
              dangling: !!e.dangling,
            }
          : { kind: 'prose', stash_item_id: e.stashItemId },
      ),
    })),
    skipped_items: plan.skippedItems,
    files,
  };
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: files.length + 1, // +1 for manifest.json itself
    templateVersion: PHOTOJOURNAL_VERSION,
    photoCount,
    sections: manifest.sections,
    skippedItems: plan.skippedItems,
  };
}

// Test seam.
export const _internals = {
  escapeHtml,
  planJournalFromStash,
  itemToPhoto,
  renderPhoto,
  renderProse,
};
