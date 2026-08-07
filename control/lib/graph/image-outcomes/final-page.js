/**
 * Final-page composite (plan I5, minimal) — the deterministic re-assembly
 * that makes the page trustworthy again after the generative layer:
 *
 *   final = bound render(s) + SVG overlay derived from the manifest
 *
 * Mojulo owns the overlay — panel borders, gutters (the page ground the
 * panels sit on), bubble shapes, and LETTERING (the only place bubble text
 * ever becomes pixels). Under `per-panel` (the default) each panel's bound
 * PNG is fitted into its panel bounds on a paper-white page; `whole-page`
 * uses the single page render as the base; `hybrid` layers panel renders
 * over the page render. Given (manifest, bound renders), the composite is
 * stable — a lettering-only manifest edit changes final.png WITHOUT
 * touching the generative layer.
 *
 * image-outcome finals are the bound page render as-is (no overlay yet —
 * its overlayZones carry labels, not lettering).
 */

import { promises as fs } from 'node:fs';
import sharp from 'sharp';

import {
  KIND_SEQUENTIAL_ART,
  KIND_IMAGE_OUTCOME,
  normalizeImageOutcomesManifest,
  renderTargets,
} from './manifest.js';
import { boundRenderMap } from './render-store.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Greedy word wrap by estimated glyph width — lettering is short beat text,
// not typography; the goal is "fits the bubble", not TeX.
function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function bubbleSvg(zone) {
  const rx = Math.min(42, zone.h / 2);
  const shape = `<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="${rx}" fill="#ffffff" stroke="#111111" stroke-width="4"/>`;
  if (!zone.lettering) return shape;
  const fontSize = Math.max(18, Math.min(30, Math.round(zone.h / 4)));
  const maxChars = Math.max(6, Math.floor((zone.w - 32) / (fontSize * 0.56)));
  const lines = wrapText(zone.lettering, maxChars);
  const lineHeight = fontSize * 1.25;
  const cx = zone.x + zone.w / 2;
  const startY = zone.y + zone.h / 2 - ((lines.length - 1) * lineHeight) / 2;
  const text = lines
    .map((line, i) => `<text x="${cx}" y="${startY + i * lineHeight}" font-size="${fontSize}" font-family="Comic Sans MS, Chalkboard SE, Segoe Print, sans-serif" font-weight="600" fill="#111111" text-anchor="middle" dominant-baseline="middle">${esc(line)}</text>`)
    .join('');
  return shape + text;
}

/**
 * The overlay layer as SVG: transparent ground, panel borders, bubbles +
 * lettering. Pure function of the manifest — the deterministic half of the
 * final page.
 */
export function renderPageOverlaySvg(manifest) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  if (normalized.kind !== KIND_SEQUENTIAL_ART) {
    throw new Error('the page overlay belongs to sequential-art manifests');
  }
  const { width, height } = normalized.viewBox;
  const parts = [];
  for (const panel of normalized.panels) {
    const b = panel.bounds;
    parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#111111" stroke-width="6"/>`);
    for (const zone of panel.bubbleZones) parts.push(bubbleSvg(zone));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${parts.join('\n')}
</svg>
`;
}

async function fitted(source, w, h, left, top) {
  const input = Buffer.isBuffer(source) ? source : await fs.readFile(source);
  const buffer = await sharp(input)
    .resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { fit: 'cover' })
    .png()
    .toBuffer();
  return { input: buffer, left: Math.round(left), top: Math.round(top) };
}

/**
 * Composite the final page from bound renders.
 *
 * @param {object} manifest — image-outcome or sequential-art manifest
 * @param {Object<string, Buffer|string>} renders — target → PNG buffer or path;
 *   must cover every target from `renderTargets(manifest)`.
 * @returns {Promise<Buffer>} final PNG bytes
 */
export async function compositeFinalPage(manifest, renders) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  const targets = renderTargets(normalized);
  const missing = targets.filter((t) => renders[t] == null);
  if (missing.length) {
    throw new Error(`missing bound renders for target(s): ${missing.join(', ')}`);
  }
  const { width, height } = normalized.viewBox;

  if (normalized.kind === KIND_IMAGE_OUTCOME) {
    const page = await fitted(renders.page, width, height, 0, 0);
    return sharp(page.input).png().toBuffer();
  }
  if (normalized.kind !== KIND_SEQUENTIAL_ART) {
    throw new Error('final pages exist for image-outcome and sequential-art manifests');
  }

  const layers = [];
  if (normalized.renderStrategy !== 'per-panel') {
    layers.push(await fitted(renders.page, width, height, 0, 0));
  }
  if (normalized.renderStrategy !== 'whole-page') {
    for (const panel of normalized.panels) {
      const b = panel.bounds;
      layers.push(await fitted(renders[panel.id], b.w, b.h, b.x, b.y));
    }
  }
  const overlay = await sharp(Buffer.from(renderPageOverlaySvg(normalized)))
    .resize(width, height)
    .png()
    .toBuffer();
  layers.push({ input: overlay, left: 0, top: 0 });

  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

/**
 * Composite a stored sketch's final page from its LATEST bound renders.
 * Returns { png } when every target is bound, or { missing } when not.
 */
export async function compositeFinalForSketch(sketch) {
  const normalized = normalizeImageOutcomesManifest(sketch.manifest);
  if (normalized.kind !== KIND_SEQUENTIAL_ART && normalized.kind !== KIND_IMAGE_OUTCOME) {
    throw new Error('final pages exist for image-outcome and sequential-art sketches');
  }
  const targets = renderTargets(normalized);
  const bound = boundRenderMap(sketch.ref, targets);
  const missing = targets.filter((t) => !bound[t]);
  if (missing.length) return { png: null, missing };
  const renders = Object.fromEntries(targets.map((t) => [t, bound[t].path]));
  return { png: await compositeFinalPage(normalized, renders), missing: [] };
}
