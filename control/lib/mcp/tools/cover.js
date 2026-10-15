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
import { pluginProfileActive, pluginProfileNotice, withPluginProfile } from '@/lib/mcp/plugin-profile';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { normalizeCoverManifest, coverRenderTargets } from '@/lib/graph/image-outcomes/cover-manifest';
import { renderCoverSvg } from '@/lib/graph/image-outcomes/cover-preview';
import { checkUploadedArt, readUploadFrom } from '@/lib/graph/image-outcomes/cover-upload';
import { readPaletteSpec, solvePalette } from '@/lib/graph/color-theorist/solve.js';
import { coverPalette } from '@/lib/graph/color-theorist/adapters.js';
import { freshPaletteSeed } from '@/lib/graph/color-theorist/stamp.js';
import { seedOfRef } from '@/lib/graph/beats/field-cue';

const COVER_TOKENS = ['bg', 'accent', 'ink'];
/** The cover's colours: its own { bg, accent, ink } as given; else a palette solved (color-theorist) from the spec
 * given, or rolled for this cover (its ref's when it has one); false keeps the stock cover colours. */
function coverColours(palette, ref) {
  if (palette === false) return null;
  if (palette && typeof palette === 'object' && COVER_TOKENS.some((k) => k in palette)) return palette;
  let spec = palette === undefined ? {} : readPaletteSpec(palette, 'palette');
  if (spec === 'auto') spec = {};
  if (spec.seed === undefined) spec = { ...spec, seed: ref ? (seedOfRef(ref) % 2147483646) + 1 : freshPaletteSeed(spec) };
  return coverPalette(solvePalette(spec));
}

export function createCoverHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_cover requires { title }');
  const {
    title, for_kind: forKind, format, art, cover_title: coverTitle, author, series, subtext,
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
  // The Claude plugin profile (lib/mcp/plugin-profile.js) has no painted layers: its covers take a
  // flat or carved title (flat is what an unpainted 'painted' title shows) and no render brief.
  const profile = pluginProfileActive();
  if (profile && titleRealizer === 'painted') throw new Error(pluginProfileNotice("create_cover title_realizer 'painted'"));
  if (profile && renderBrief) throw new Error(pluginProfileNotice('create_cover render_brief'));
  const realizer = titleRealizer || (profile ? 'flat' : 'painted');
  // the illustration: an uploaded picture when `art` maps one (cover-upload.js); else, with no image worker (the
  // plugin profile), the palette placeholder the operator replaces by uploading; else painted, as before
  if (art !== undefined) {
    readUploadFrom(art);
    const bad = checkUploadedArt(art);
    if (bad.length) throw new Error(`art: ${bad.join('; ')}`);
  }
  const illustrationRealizer = art !== undefined ? 'upload' : profile ? 'placeholder' : 'painted';
  if (!['painted', 'carved', 'flat'].includes(realizer)) {
    throw new Error("`title_realizer` must be 'painted', 'carved', or 'flat'");
  }

  const colours = coverColours(palette, ref);
  const artDirection = {
    ...(renderBrief ? { renderBrief } : {}),
    ...(colours ? { palette: colours } : {}),
    type: { ...(titleFont ? { titleFont } : {}), ...(textFont ? { textFont } : {}) },
    composition: { ...(archetype ? { archetype } : {}) },
    ...(relationship ? { relationship } : {}),
    ...(checklist ? { checklist } : {}),
  };

  if (format !== undefined && forKind !== 'game') throw new Error("`format` is a game cover's: for_kind: 'game'");
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
    ...(format !== undefined ? { format } : {}),
    artDirection,
    slots: {
      illustration: {
        realizer: illustrationRealizer,
        ...(art !== undefined ? { from: { stash: art.stash, item: art.item } } : {}),
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

  const sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });

  const enc = encodeURIComponent(sketch.ref);
  const targets = coverRenderTargets(manifest);
  if (profile) {
    return {
      ok: true,
      ref: sketch.ref,
      url: `/sketches/${enc}`,
      svgUrl: `/api/sketches/${enc}/svg?inline=1`,
      coverUrl: `/api/sketches/${enc}/cover.png`,
      archetype: manifest.artDirection.composition.archetype,
      for_kind: manifest.for_kind,
      ...(manifest.format ? { format: manifest.format } : {}),
      next: illustrationRealizer === 'upload'
        ? `Cover renders now at coverUrl: the uploaded picture and a ${realizer} title.`
        : `Cover renders now at coverUrl: a palette placeholder illustration and a ${realizer} title. For real art, ask the operator to upload the picture into a stash on the dashboard (add image), find its item id with get_stash, then map it: update_sketch this cover, patch /slots/illustration = { realizer: 'upload', from: { stash, item } } (or create_cover art: { stash, item }).`,
    };
  }
  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${enc}`,
    svgUrl: `/api/sketches/${enc}/svg?inline=1`,
    coverUrl: `/api/sketches/${enc}/cover.png`,
    archetype: manifest.artDirection.composition.archetype,
    for_kind: manifest.for_kind,
    ...(manifest.format ? { format: manifest.format } : {}),
    render_targets: targets,
    next: illustrationRealizer === 'upload' ? `Cover renders now at coverUrl with the uploaded picture and a ${realizer} title.` : `Cover renders now at coverUrl with a placeholder illustration and a ${realizer} title. Painting the illustration${targets.includes('title') ? " and an alpha'd title mark" : ''} rides the render bicycle (a later phase); the recipe is unchanged when those bind.`,
  };
}

export function registerCoverTools() {
  registerTool(withPluginProfile({
    name: 'create_cover',
    description:
      "Mint a publication COVER — an illustration + title + subtext (author/series) + metadata (barcode/note) composed under one art direction, for a novel, a picture book, or a game (`for_kind: 'game'`, `format`: key-art, the backdrop a title screen draws its menu over, capsule, box, icon). Persists with kind `cover`; renders immediately (a palette placeholder illustration + a carved title) with NO image worker, then swaps in painted layers later without changing the recipe.\n\nStructure is guaranteed (every piece placed, legible, in the safe area); look varies (archetype × palette × type × treatment), so covers don't clone. `for_kind` seeds aspect, archetype and slots.\n\nTitle: `title_realizer` picks how the title becomes pixels — 'painted' (default; a worker paints an alpha'd letter mark onto mojulo-carved letterforms), 'carved' (metalified 3D wordmark), or 'flat' (filled outline). mojulo always owns the letter SHAPES (from the font shelf), so spelling/forms are fixed; the worker only paints style.\n\nReturns { ok, ref, url, svgUrl, coverUrl, render_targets, next }. SVG face at url; raster composite at coverUrl.",
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Sketch title (also the default cover title).' },
        cover_title: { type: 'string', description: 'The title text shown on the cover (defaults to `title`).' },
        for_kind: { type: 'string', description: "Publication kind that seeds aspect/archetype/slots: 'novel' (default), 'picture_book' or 'game'." },
        art: { type: 'object', description: 'An uploaded picture as the illustration: { stash, item } (a stash image item).', properties: { stash: { type: 'string' }, item: { type: 'integer' } } },
        format: { type: 'string', enum: ['key-art', 'capsule', 'box', 'icon'], description: "A game cover's format (default key-art: a title screen's backdrop; its archetype leaves the menu room)." },
        author: { type: 'string', description: 'Author byline (convenience → subtext role author).' },
        series: { type: 'string', description: 'Series/edition line (convenience → subtext role series).' },
        subtext: { type: 'array', description: 'Explicit subtext runs [{ role, text, font? }] (roles: author, series; a game: tagline). Overrides author/series.', items: { type: 'object' } },
        isbn: { type: 'string', description: 'ISBN/EAN (convenience → metadata barcode).' },
        note: { type: 'string', description: 'Edition/credit note (convenience → metadata note).' },
        metadata: { type: 'array', description: 'Explicit metadata [{ kind, value }] (kinds: barcode, note; a game: studio). Overrides isbn/note.', items: { type: 'object' } },
        illustration_brief: { description: 'The illustration subject/style — a string (subject) or an object { subject?, style?, camera? }.' },
        archetype: { type: 'string', description: 'Layout family: full-bleed-overlay | framed-below; a game: logo-center | lower-third | hero-side (else seeded by for_kind).' },
        palette: { description: "Cover palette: { bg, accent, ink } (#hex), or a palette spec solved for what the book or game is (pick_palette: { seed, heat?, weight?, activity?, scheme?, … }). Left out, one is rolled for the cover; false keeps the stock cover colours." },
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
  }, {
    edits: [
      [
        'renders immediately (a palette placeholder illustration + a carved title) with NO image worker, then swaps in painted layers later without changing the recipe.',
        "renders immediately: a placeholder illustration (until the operator uploads a picture to a stash and you map it: `art`) and a title set from mojulo's own letterforms.",
      ],
      [
        "Title: `title_realizer` picks how the title becomes pixels — 'painted' (default; a worker paints an alpha'd letter mark onto mojulo-carved letterforms), 'carved' (metalified 3D wordmark), or 'flat' (filled outline). mojulo always owns the letter SHAPES (from the font shelf), so spelling/forms are fixed; the worker only paints style.",
        "Title: `title_realizer` picks how the title becomes pixels — 'flat' (default; filled outline) or 'carved' (metalified 3D wordmark). mojulo owns the letter SHAPES (from the font shelf), so spelling and forms are fixed.",
      ],
      ['Returns { ok, ref, url, svgUrl, coverUrl, render_targets, next }.', 'Returns { ok, ref, url, svgUrl, coverUrl, next }.'],
    ],
    schema: (schema) => {
      delete schema.properties.render_brief;
      delete schema.properties.illustration_brief;
      schema.properties.title_realizer.description = "How the title becomes pixels: 'flat' (default) or 'carved'.";
      return schema;
    },
  }));
}
