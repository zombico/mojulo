/**
 * Book compositor — drives the REAL picture_book.html template with PNG
 * page illustrations.
 *
 * This is the spike's integration seam: the shipping picture-book writer
 * (lib/outcomes/kinds/picture-book.js) resolves pages to inline SVG only.
 * Here the same template + page markup is fed <img> pages instead, proving
 * the pb-2 shape (generated raster as page illustration) without touching
 * the writer or the DB. Deterministic: the caller supplies the edition
 * label; no timestamps are minted here (timeless-manifests doctrine —
 * timestamps belong to render events, not recipes).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { renderMarkdown } from '../../../outcomes/markdown.js';
import { renderTemplate } from '../../../outcomes/render-template.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(HERE, '..', '..', '..', 'outcomes', 'template', 'picture_book.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

export async function rasterSvg(svg, { width, height }) {
  return sharp(Buffer.from(svg)).resize({ width, height, fit: 'fill' }).png().toBuffer();
}

/** One page section — the writer's renderPage markup with an <img> illustration. */
function renderImgPage({ filename, captionMd, label }, displayNumber, pageCount) {
  const captionHtml = captionMd
    ? `<div class="caption">${renderMarkdown(captionMd)}</div>`
    : '<div class="caption empty">(no caption)</div>';
  return [
    '<section class="page" data-viewer-page>',
    `<div class="illustration"><img src="${escapeHtml(filename)}" alt="page ${displayNumber}" style="width:100%; height:100%; object-fit:contain; display:block;"/></div>`,
    captionHtml,
    `<div class="page-meta"><span>page ${displayNumber} of ${pageCount}</span><span>${escapeHtml(label || '')}</span></div>`,
    '</section>',
  ].join('\n');
}

/**
 * Build the book's index.html from the real picture_book template.
 *
 * @param {object} args
 * @param {object} args.book — the fixture ({ title, blurb })
 * @param {Array}  args.pages — [{ filename, captionMd, label }] in reading order
 * @param {string} args.edition — e.g. 'scaffold edition' | 'generated edition'
 * @param {object} [args.cover] — { filename } of a raster cover illustration;
 *   rendered on the cover page under the typeset title (the P5 read: art from
 *   the render, words from the book — the title never lives in the raster)
 * @returns {Promise<string>} the index.html body
 */
export async function buildBookHtml({ book, pages, edition, cover }) {
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const pagesHtml = pages
    .map((page, i) => renderImgPage(page, i + 1, pages.length))
    .join('\n');
  const coverIllustrationHtml = cover
    ? `<div class="cover-illustration"><img src="${escapeHtml(cover.filename)}" alt="cover illustration"/></div>\n`
    : '';
  return renderTemplate(tpl, {
    generator: escapeHtml(`mojulo picture-book render spike — ${edition}`),
    template_version: escapeHtml('pb-spike'),
    title: escapeHtml(book.title),
    cover_title: escapeHtml(book.title),
    cover_blurb_html: coverIllustrationHtml + renderMarkdown(book.blurb),
    pages_html: pagesHtml,
    cook_ref: escapeHtml('ck_spike_picture_book'),
    generated_at_iso: escapeHtml(`(${edition} — deterministic spike, no timestamp)`),
    generated_at_human: escapeHtml(edition),
    viewer_aspect: escapeHtml('3 / 2'),
    style_overrides: cover
      ? '<style>.cover .blurb .cover-illustration { margin: 0 0 1.2rem; } .cover .blurb .cover-illustration img { width: 100%; max-height: 60vh; object-fit: contain; display: block; border-radius: 4px; }</style>'
      : '',
  });
}
