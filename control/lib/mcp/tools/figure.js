/**
 * create_figure — mint a POSED protoform human figure as a sketch. The figure
 * substrate (figure-vajra armature + figure-proto flesh + figure-spine bend +
 * figure-garments) graduated onto the sketch surface: persists with
 * `kind: 'figure'`; the /api/sketches/<ref>/svg route dispatches on that
 * discriminator to renderFigureToSvg (same pattern as manji-tree / carved-solid).
 *
 * The figure is a pure function of (pose, proto, garment) — nothing is baked, so
 * "posing" is just choosing the dials, and a pose can never break the form
 * (joint LIMITS + spine caps clamp every value).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { renderFigureToSvg, renderFigureFrames, figureIsAnimated, figurePatternReport, FIGURE_VIEWS, motionTiming } from '@/lib/graph/polygonizer/figure-render';
import { stampMotion } from '@/lib/graph/polygonizer/figure-posing';
import { EMOTE_NAMES } from '@/lib/graph/polygonizer/figure-emotes';
import { GARMENTS, validateGarmentSpec } from '@/lib/graph/polygonizer/figure-garments';
import { validateOutfit, resolveOutfitNames } from '@/lib/graph/polygonizer/figure-outfit';
import { bookWardrobe } from '@/lib/graph/views/recipe-book/registry';
import { validateFluffs } from '@/lib/graph/polygonizer/figure-fluff';
import { validateCast, resolveCast } from '@/lib/graph/polygonizer/figure-cast';
import { articulate } from '@/lib/graph/polygonizer/figure-vajra';
import { encodeGif } from '@/lib/motion';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';
import { FIGURE_SETUPS, FIGURE_SETUP_NAMES } from '@/lib/visual-language/themes';

const GARMENT_KEYS = Object.keys(GARMENTS);
/** the refusal for a figure's retired `dream_audit` (the figure-spec loop it attested for is gone) */
export const DREAM_AUDIT_RETIRED = "dream_audit: not a figure word (the attestation is retired with its loop); mint the figure without it. A character from a picture you can see is reference_protocol({ target: 'character' }); from words, create_character({ as: 'hero' }).";

export async function createFigureHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('mint_solid kind "figure" requires { title }');
  const { title, pose, proto, garment, fluffs, view, background, setup, ref, folder_ref: folderRef } = input;
  let { cast } = input;
  if (typeof cast === 'string' && /^\s*[{[]/.test(cast)) { try { cast = JSON.parse(cast); } catch { /* a bare preset name stays a name */ } }
  let { outfit } = input;
  if (typeof outfit === 'string' && /^\s*[{[]/.test(outfit)) { try { outfit = JSON.parse(outfit); } catch { /* a bare name stays a name */ } }
  // Defensive transport parse: object-valued params whose inputSchema declares a
  // permissive/union type can arrive JSON-stringified from some MCP clients. Parse
  // an object/array that came across as a string so the validators below see the
  // real shape (a plain string like 'walk' is left untouched → still validated).
  let { motion, animate } = input;
  if (typeof motion === 'string' && /^\s*[{[]/.test(motion)) {
    try { motion = JSON.parse(motion); } catch { /* leave as string; validator will reject */ }
  }
  if (typeof animate === 'string' && /^\s*[{[]/.test(animate)) {
    try { animate = JSON.parse(animate); } catch { /* leave as string; handler falls back to defaults */ }
  }
  // The image-worker attestation left with its loop: a figure records no provenance of its own now, and a figure
  // minted with one before keeps it as data its renderer never reads.
  if (input.dream_audit !== undefined) throw new Error(DREAM_AUDIT_RETIRED);
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  // `outfit` (outfit.plan.md): the tiered authoring form — a named outfit from the book, or
  // { fit?, layers } inner → outer. Book names are resolved BY VALUE here, once, so the stored
  // recipe never depends on the book again; core lowers it to `garment` at every render.
  if (outfit !== undefined && outfit !== null && garment !== undefined && garment !== null) {
    throw new Error('`outfit` and `garment` are one or the other: `outfit` is the tiered form that lowers to `garment`');
  }
  if (outfit !== undefined && outfit !== null) {
    const wardrobe = bookWardrobe();
    const errs = validateOutfit(outfit, 'outfit', { wardrobe });
    if (errs.length) throw new Error(`Invalid outfit:\n - ${errs.join('\n - ')}`);
    outfit = resolveOutfitNames(outfit, wardrobe);
  }
  if (garment !== undefined && garment !== null) {
    // A single entry OR an array (layering: e.g. ['trousers','jacket'] worn
    // together). Each entry is a GARMENTS key or an INLINE wardrobe-piece spec
    // (a piece authored as data — pieces + cuts/panels + its own mugen
    // clearances — resolved against ANY body).
    const entries = Array.isArray(garment) ? garment : [garment];
    for (const [i, entry] of entries.entries()) {
      if (typeof entry === 'string') {
        if (!GARMENT_KEYS.includes(entry)) {
          throw new Error(`\`garment\` must be one of ${GARMENT_KEYS.join(', ')} — or an inline spec object ({ id, pieces, … }) — got '${entry}'`);
        }
      } else {
        const errs = validateGarmentSpec(entry, Array.isArray(garment) ? `garment[${i}]` : 'garment');
        if (errs.length) throw new Error(`Invalid inline garment spec:\n - ${errs.join('\n - ')}`);
      }
    }
  }
  if (setup !== undefined && setup !== null && !FIGURE_SETUP_NAMES.includes(setup)) {
    throw new Error(`\`setup\` must be one of ${FIGURE_SETUP_NAMES.join(', ')} (or null)`);
  }
  // THE CAST (figure-cast.js): rest limb/segment proportions, applied at the vajra level before
  // anything is fleshed. A preset RESOLVES BY VALUE here so the stored recipe carries the numbers
  // — re-tuning a preset later can never change an already-minted figure, and the operator's next
  // move (read the manifest, nudge one dial) has something to read.
  if (cast !== undefined && cast !== null) {
    const cerrs = validateCast(cast);
    if (cerrs.length) throw new Error(`\`cast\`: ${cerrs.join('; ')}`);
    cast = resolveCast(cast);
  }
  if (fluffs !== undefined && fluffs !== null) {
    // Fluffform (the stylized flesh register) REPLACES proto as the body source
    // when present — validate the closed shape table against the real landmark set.
    if (!Array.isArray(fluffs) || fluffs.length === 0) throw new Error('`fluffs` must be a non-empty array of fluff specs (or null)');
    const ferrs = validateFluffs(fluffs, articulate(pose || {}));
    if (ferrs.length) throw new Error(`\`fluffs\`: ${ferrs[0]}${ferrs.length > 1 ? ` (+${ferrs.length - 1} more)` : ''}`);
  }
  if (view !== undefined && typeof view !== 'number' && !FIGURE_VIEWS.includes(view)) {
    throw new Error(`\`view\` must be a number (azimuth°) or one of ${FIGURE_VIEWS.join(', ')}`);
  }
  if (motion !== undefined && motion !== null) {
    const okString = typeof motion === 'string' && (['walk', 'wave', 'sprint', 'run'].includes(motion) || EMOTE_NAMES.includes(motion));
    const okSpec = motion && typeof motion === 'object'
      && (typeof motion.walk === 'object' || typeof motion.gait === 'object'
        || typeof motion.sprint === 'object' || typeof motion.run === 'object' || Array.isArray(motion.keyframes)
        || (typeof motion.wave === 'object' && motion.wave !== null)
        || (typeof motion.emote === 'string' && EMOTE_NAMES.includes(motion.emote)));
    if (!okString && !okSpec) throw new Error(`\`motion\` must be 'walk' | 'sprint' | 'wave', an emote name (${EMOTE_NAMES.join('/')}), { walk: {…dials} }, { sprint: {…dials} }, { wave: { seconds, waves, swing } }, { emote, intensity? }, or { keyframes: [pose, …] } (or null)`);
    // a gait is stored BY VALUE, every dial of the walk (or run) as it is minted now (figure-posing.js stampMotion), so
    // tuning the mint table later never moves this figure; a cast preset resolves the same way above
    motion = stampMotion(motion);
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }
  const manifest = {
    kind: 'figure',
    ...(pose !== undefined && pose !== null ? { pose } : {}),
    ...(proto !== undefined && proto !== null ? { proto } : {}),
    ...(fluffs !== undefined && fluffs !== null ? { fluffs } : {}),
    ...(cast !== undefined && cast !== null ? { cast } : {}),
    ...(garment !== undefined && garment !== null ? { garment } : {}),
    ...(outfit !== undefined && outfit !== null ? { outfit } : {}),
    ...(view !== undefined && view !== null ? { view } : {}),
    ...(motion !== undefined && motion !== null ? { motion } : {}),
    ...(background !== undefined ? { background } : {}),
    ...(setup !== undefined && setup !== null ? { setup } : {}),
    title,
  };

  // Render once to validate (a bad dial fails here, not at view time).
  try { renderFigureToSvg(manifest); }
  catch (err) { throw new Error(`figure render failed: ${err.message}`); }

  const sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });

  // Motion: a `motion` (walk) renders a looping GIF into the sketch's outcome
  // folder. Auto when the manifest animates; `animate:false` skips it.
  let gifUrl = null;
  const wantGif = animate === undefined ? figureIsAnimated(manifest) : (animate !== false && figureIsAnimated(manifest));
  if (wantGif) {
    try {
      // a stamped motion plays its loop in real seconds; an explicit animate { frames, fps } wins (motionTiming)
      const { frames, fps } = motionTiming(manifest.motion, animate);
      const dir = outcomeDirFor(sketch.ref);
      await fs.mkdir(dir, { recursive: true });
      // GIF backdrop follows the setup (transparent GIFs aren't supported, so a
      // `background:false` figure falls back to the setup/default ground).
      const gifBg = (setup && FIGURE_SETUPS[setup]?.bg) || '#eef1f4';
      await encodeGif(renderFigureFrames(manifest, frames), path.join(dir, 'motion.gif'), { width: 480, fps, bg: gifBg, loop: 0 });
      gifUrl = `${outcomeUrlFor(sketch.ref)}motion.gif`;
    } catch (err) { gifUrl = null; }   // GIF is a bonus; the still SVG already succeeded
  }

  // A cut-and-sewn garment (fit:'pattern') hands back the tailor's readout — girths, per-seam
  // ease and gap, per-piece strain, warnings — so the agent can re-dial before looking. Absent
  // a pattern garment the key is absent.
  let pattern = null;
  try { pattern = figurePatternReport(manifest); } catch (err) { pattern = null; }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    svgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/svg?inline=1`,
    ...(gifUrl ? { gifUrl } : {}),
    ...(pattern ? { patternSvgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/pattern.svg?inline=1` } : {}),
    ...(pattern ? { pattern: pattern.map(({ id, stature_cm, girths, pieces, seams, hang, warnings }) => ({
      id, stature_cm, girths: girths.trunk ?? girths,
      pieces: pieces.map((p) => ({ id: p.id, chart: p.chart, ...(p.sloper ? { sloper: p.sloper } : {}), area_cm2: p.area_cm2, strain_max: p.strain.max, clipped: p.clipped })),
      seams: seams.map(({ line, ...s }) => s), hang, warnings,
    })) } : {}),
  };
}

/**
 * emote_figure — use posing to EMOTE: apply a named body-language emote (a
 * figure-emotes keyframe recipe) to an EXISTING kind:'figure' sketch. Default is
 * non-destructive: the emote renders as `emote-<name>.gif` in the sketch's
 * outcome folder and the stored recipe is untouched. `mint` instead derives a
 * new figure sketch carrying the emote as its `motion` — a referenceable recipe
 * a world's `figures` map can pick up via `figureRef` (world-scene.js).
 */
export async function emoteFigureHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('edit_solid op "emote" requires { ref, spec: { emote } }');
  const { ref, emote, intensity, view } = input;
  // Defensive transport parse (see createFigureHandler): object-valued params can
  // arrive JSON-stringified from some MCP clients.
  let { animate, mint } = input;
  if (typeof animate === 'string' && /^\s*[{[]/.test(animate)) {
    try { animate = JSON.parse(animate); } catch { /* fall back to defaults */ }
  }
  if (typeof mint === 'string' && /^\s*[{[]/.test(mint)) {
    try { mint = JSON.parse(mint); } catch { /* leave as string */ }
  }
  const src = ref && typeof ref === 'string' ? SketchRepository.getByRef(ref) : null;
  if (!src) throw new Error(`Figure sketch '${ref}' not found`);
  if (src.manifest?.kind !== 'figure') throw new Error(`'${ref}' is kind '${src.manifest?.kind}', not a figure — edit_solid op 'emote' poses stored figures (mint_solid kind 'figure')`);
  if (typeof emote !== 'string' || !EMOTE_NAMES.includes(emote)) {
    throw new Error(`\`emote\` must be one of ${EMOTE_NAMES.join(', ')}`);
  }
  if (intensity !== undefined && (typeof intensity !== 'number' || intensity <= 0 || intensity > 3)) {
    throw new Error('`intensity` must be a number in (0, 3] (1 = as authored)');
  }
  if (view !== undefined && view !== null && typeof view !== 'number' && !FIGURE_VIEWS.includes(view)) {
    throw new Error(`\`view\` must be a number (azimuth°) or one of ${FIGURE_VIEWS.join(', ')}`);
  }
  const motion = intensity && intensity !== 1 ? { emote, intensity } : emote;
  const m = src.manifest;

  if (mint) {
    // Derived recipe: same body/garment/setup, the emote as its motion. Rides the
    // create_figure path so validation + GIF behavior stay in one place.
    return createFigureHandler({
      title: (typeof mint === 'object' && mint.title) || `${src.title} — ${emote}`,
      pose: m.pose, proto: m.proto, ...(m.cast ? { cast: m.cast } : {}), ...(m.fluffs ? { fluffs: m.fluffs } : {}),
      ...(m.outfit != null ? { outfit: m.outfit } : { garment: m.garment }),
      view: view ?? m.view, setup: m.setup, background: m.background,
      motion, animate,
      ...(typeof mint === 'object' && mint.ref ? { ref: mint.ref } : {}),
    });
  }

  // the side GIF is made now, so it plays the emote as minted now (its loop in real seconds: figure-posing.js EMOTE_MINT)
  const timed = stampMotion(motion);
  const { frames, fps } = motionTiming(timed, animate);
  const dir = outcomeDirFor(src.ref);
  await fs.mkdir(dir, { recursive: true });
  const gifBg = (m.setup && FIGURE_SETUPS[m.setup]?.bg) || '#eef1f4';
  const gifManifest = { ...m, motion: timed, ...(view !== undefined && view !== null ? { view } : {}) };
  await encodeGif(renderFigureFrames(gifManifest, frames), path.join(dir, `emote-${emote}.gif`), { width: 480, fps, bg: gifBg, loop: 0 });
  return {
    ok: true,
    ref: src.ref,
    emote,
    url: `/sketches/${encodeURIComponent(src.ref)}`,
    gifUrl: `${outcomeUrlFor(src.ref)}emote-${emote}.gif`,
  };
}
