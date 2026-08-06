/**
 * create_cover — mint a publication COVER as a sketch. A cover composes an
 * illustration + a title + subtext (author/series) + metadata (barcode/note)
 * under one art direction, ready to bind onto a publication (cover-
 * composition.plan.md). Persists with `kind: 'cover'`; the /svg route shows the
 * deterministic SVG face, /cover.png the raster composite (with painted layers
 * when bound).
 *
 * Phase B (no worker): a cover renders immediately with a palette-derived
 * placeholder illustration and a flat carved title. Painting the illustration
 * and an alpha'd title mark rides the render bicycle in a later phase; the
 * recipe (art direction + slots) is unchanged when those layers bind.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { normalizeCoverManifest, coverRenderTargets } from '@/lib/graph/image-outcomes/cover-manifest';
import { renderCoverSvg } from '@/lib/graph/image-outcomes/cover-preview';

export function createCoverHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_cover requires { title }');
  const {
    title, for_kind: forKind, cover_title: coverTitle, author, series, subtext,
    isbn, note, metadata, illustration_brief: illustrationBrief,
    archetype, palette, title_font: titleFont, text_font: textFont,
    relationship, checklist, render_brief: renderBrief, title_realizer: titleRealizer,
    ref, folder_ref: folderRef,
  } = input;

  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (folderRef !== undefined && folderRef !== null && !SketchFolderRepository.getByRef(folderRef)) {
    throw new Error(`Folder '${folderRef}' not found`);
  }
  const realizer = titleRealizer || 'painted';
  if (!['painted', 'carved', 'flat'].includes(realizer)) {
    throw new Error("`title_realizer` must be 'painted', 'carved', or 'flat'");
  }

  const artDirection = {
    ...(renderBrief ? { renderBrief } : {}),
    ...(palette ? { palette } : {}),
    type: { ...(titleFont ? { titleFont } : {}), ...(textFont ? { textFont } : {}) },
    composition: { ...(archetype ? { archetype } : {}) },
    ...(relationship ? { relationship } : {}),
    ...(checklist ? { checklist } : {}),
  };

  const subtextList = Array.isArray(subtext) ? subtext : [
    ...(series ? [{ role: 'series', text: series }] : []),
    ...(author ? [{ role: 'author', text: author }] : []),
  ];
  const metadataList = Array.isArray(metadata) ? metadata : [
    ...(isbn ? [{ kind: 'barcode', value: isbn }] : []),
    ...(note ? [{ kind: 'note', value: note }] : []),
  ];

  const input2 = {
    for_kind: forKind,
    artDirection,
    slots: {
      illustration: {
        realizer: 'painted',
        brief: illustrationBrief == null ? {}
          : typeof illustrationBrief === 'string' ? { subject: illustrationBrief } : illustrationBrief,
      },
      title: { text: coverTitle || title, realizer },
      subtext: subtextList,
      metadata: metadataList,
    },
  };

  const manifest = normalizeCoverManifest(input2);

  // Render the SVG face once to validate (bad font / bad shape fail here).
  try { renderCoverSvg(manifest); }
  catch (err) { throw new Error(`cover render failed: ${err.message}`); }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  const targets = coverRenderTargets(manifest);
  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${enc}`,
    svgUrl: `/api/sketches/${enc}/svg?inline=1`,
    coverUrl: `/api/sketches/${enc}/cover.png`,
    archetype: manifest.artDirection.composition.archetype,
    for_kind: manifest.for_kind,
    render_targets: targets,
    next: `Cover renders now at coverUrl with a placeholder illustration and a ${realizer} title. Painting the illustration${targets.includes('title') ? " and an alpha'd title mark" : ''} rides the render bicycle (a later phase); the recipe is unchanged when those bind.`,
  };
}

export function registerCoverTools() {
  registerTool({
    name: 'create_cover',
    description:
      "Mint a publication COVER — an illustration + title + subtext (author/series) + metadata (barcode/note) composed under one art direction, ready to bind onto a publication (a novel/picture_book cover today). Persists with kind `cover`; renders immediately (a palette placeholder illustration + a carved title) with NO image worker, then swaps in painted layers later without changing the recipe.\n\nStructure is guaranteed (every declared piece is placed, legible, in the safe area); look is not (archetype × palette × typeface × title treatment vary), so covers don't clone. Pick a publication with `for_kind` (seeds aspect + archetype + slots); override any of it.\n\nTitle: `title_realizer` picks how the title becomes pixels — 'painted' (default; a worker paints an alpha'd letter mark onto mojulo-carved letterforms), 'carved' (metalified 3D wordmark), or 'flat' (filled outline). mojulo always owns the letter SHAPES (from the font shelf), so spelling/forms are fixed; the worker only paints style.\n\nReturns { ok, ref, url, svgUrl, coverUrl, render_targets, next }. View the SVG face at url; the raster composite is coverUrl (/cover.png).",
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Sketch title (also the default cover title).' },
        cover_title: { type: 'string', description: 'The title text shown on the cover (defaults to `title`).' },
        for_kind: { type: 'string', description: "Publication kind that seeds aspect/archetype/slots: 'novel' (default) or 'picture_book'." },
        author: { type: 'string', description: 'Author byline (convenience → subtext role author).' },
        series: { type: 'string', description: 'Series/edition line (convenience → subtext role series).' },
        subtext: { type: 'array', description: 'Explicit subtext runs [{ role, text, font? }] (roles: author, series). Overrides author/series.', items: { type: 'object' } },
        isbn: { type: 'string', description: 'ISBN/EAN (convenience → metadata barcode).' },
        note: { type: 'string', description: 'Edition/credit note (convenience → metadata note).' },
        metadata: { type: 'array', description: 'Explicit metadata [{ kind, value }] (kinds: barcode, note). Overrides isbn/note.', items: { type: 'object' } },
        illustration_brief: { description: 'The illustration subject/style — a string (subject) or an object { subject?, style?, camera? }.' },
        archetype: { type: 'string', description: 'Layout family: full-bleed-overlay | framed-below (else seeded by for_kind).' },
        palette: { type: 'object', description: 'Cover palette { bg, accent, ink } (#hex).', properties: { bg: { type: 'string' }, accent: { type: 'string' }, ink: { type: 'string' } } },
        title_font: { type: 'string', description: 'Font-shelf key for the title (e.g. im-fell, archivo-black, great-vibes).' },
        text_font: { type: 'string', description: 'Font-shelf key for subtext (e.g. inter).' },
        title_realizer: { type: 'string', description: "How the title becomes pixels: 'painted' (default), 'carved', or 'flat'." },
        relationship: { type: 'string', description: 'How the title relates to the illustration (art-direction contract, in words).' },
        checklist: { type: 'array', description: 'Eyes-gate checklist lines for later verification.', items: { type: 'string' } },
        render_brief: { description: 'Style-Lock render brief (preset/dials or inline custom) shared by illustration + painted title.' },
        ref: { type: 'string', description: 'Optional explicit sketch ref (1-64 chars [A-Za-z0-9_-]).' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createCoverHandler,
  });
}
