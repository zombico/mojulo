/**
 * Image-outcomes manifests — normalize + validate.
 *
 * Two kinds, one family (see image-outcomes.plan.md):
 *   - `image-outcome`   — a single directed shot: camera-space forms with
 *                         preserve levels, protected/overlay zones, a brief.
 *   - `sequential-art`  — a directed page: panels with camera beats, pose
 *                         figures, forms, and bubble zones.
 *
 * The manifest is the recipe; everything downstream (scaffold SVG, render
 * instructions, the future composite) is a pure function of it. Manifests
 * are timeless — no timestamps, no dice. Bubble `lettering` lives here for
 * the composite pass ONLY; it must never reach render instructions.
 */

import { isCameraKind, CAMERA_KINDS } from './cameras.js';
import { isPoseKind, POSE_KINDS } from './poses.js';
import { isKnownMotionName } from '../polygonizer/figure-render.js';
import { validateGarmentField } from '../polygonizer/figure-garments.js';
import { validateFluffs } from '../polygonizer/figure-fluff.js';
import { articulate } from '../polygonizer/figure-vajra.js';
import { resolveStyleMaterial } from './styles.js';
import { pageRecipeEntry, recipePanelBounds, PAGE_RECIPE_IDS } from './page-recipes.js';
import { subCelStates } from './pan-cel-spike/sub-cels.js';
import { eyeLevelUnit } from './keyframe-spike/stage.js';

export const KIND_IMAGE_OUTCOME = 'image-outcome';
export const KIND_SEQUENTIAL_ART = 'sequential-art';
export const KIND_CHARACTER_SHEET = 'character-sheet';
export const KIND_KEYFRAME_ANIMATION = 'keyframe-animation';
export const KIND_SCENE_MOTION = 'scene-motion';

export const IMAGE_OUTCOME_CONTRACT = 'image-outcome/v1';
export const SEQUENTIAL_ART_CONTRACT = 'sequential-art/v1';
export const CHARACTER_SHEET_CONTRACT = 'character-sheet/v1';
export const KEYFRAME_ANIMATION_CONTRACT = 'keyframe-animation/v1';
export const SCENE_MOTION_CONTRACT = 'scene-motion/v1';

// Default frame canvas for keyframe cels (matches parts-bank-spike/front.js's
// CANVAS — the meru guides the render packet emits are this size).
const KEYFRAME_CANVAS = { width: 832, height: 1216 };
// The face expression channels available over a finished keyframe cycle. Each
// non-base state is a WHOLE cel render (never a decal, per animation-cheats
// Addendum 4). Base states (eyes-open, mouth-closed) ride the body cel itself,
// so they never become render targets. subCelStates is the single source of
// truth for the vocab (shared with face-composite.js).
// manifest channel → sub-cel vocab (face-composite selects `face/<vocab>-<state>`).
const KEYFRAME_FACE_CHANNELS = { blink: 'blink', speech: 'mouth' };

export const RENDER_STRATEGIES = ['per-panel', 'whole-page', 'hybrid'];
const DEFAULT_RENDER_STRATEGY = 'per-panel';

const PRESERVE_LEVELS = new Set(['strict', 'guided', 'loose']);

export function isImageOutcomesKind(kind) {
  return kind === KIND_IMAGE_OUTCOME || kind === KIND_SEQUENTIAL_ART
    || kind === KIND_CHARACTER_SHEET || kind === KIND_KEYFRAME_ANIMATION
    || kind === KIND_SCENE_MOTION;
}

function rectToPolygon({ x, y, w, h }) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

function bboxFromPolygon(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function normalizeViewBox(viewBox, fallback) {
  const width = Number(viewBox?.width ?? fallback.width);
  const height = Number(viewBox?.height ?? fallback.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('viewBox requires positive width and height');
  }
  return { width, height };
}

function normalizeCamera(camera, context) {
  if (camera == null) return { kind: 'wide-establishing' };
  if (typeof camera !== 'object') throw new Error(`${context}: camera must be an object`);
  const kind = camera.kind;
  if (!kind || typeof kind !== 'string') throw new Error(`${context}: camera.kind is required`);
  // Closed vocabulary (I2): the camera is a precision dial, not vibes.
  // Per-instance horizonY / vanishingPoint ride alongside the kind.
  if (!isCameraKind(kind)) {
    throw new Error(`${context}: unknown camera kind '${kind}' (one of: ${CAMERA_KINDS.join(', ')})`);
  }
  return { ...camera, kind };
}

function normalizeZone(zone, context) {
  const x = Number(zone?.x);
  const y = Number(zone?.y);
  const w = Number(zone?.w);
  const h = Number(zone?.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    throw new Error(`${context}: zone requires numeric x/y and positive w/h`);
  }
  const out = { x, y, w, h, label: zone.label || '' };
  if (typeof zone.lettering === 'string' && zone.lettering.length > 0) {
    out.lettering = zone.lettering;
  }
  return out;
}

export function normalizeForm(form, index, context = 'forms') {
  if (!form || typeof form !== 'object') throw new Error(`${context}[${index}] must be an object`);
  const id = form.id || `form-${index + 1}`;
  const role = form.role || 'mass';
  const preserve = PRESERVE_LEVELS.has(form.preserve) ? form.preserve : 'guided';
  const polygon = Array.isArray(form.polygon)
    ? form.polygon.map((p) => [Number(p[0]), Number(p[1])])
    : rectToPolygon(form.bbox || { x: 0, y: 0, w: 1, h: 1 });
  if (polygon.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    throw new Error(`${context}[${index}] (${id}): polygon points must be numeric`);
  }
  const bbox = form.bbox || bboxFromPolygon(polygon);
  return {
    id,
    role,
    label: form.label || role,
    depthBand: form.depthBand || 'midground',
    depthRank: Number.isFinite(form.depthRank) ? form.depthRank : index,
    preserve,
    materialHint: form.materialHint || '',
    mayRestyle: form.mayRestyle !== false,
    polygon,
    bbox,
    notes: form.notes || '',
  };
}

function normalizeRenderBrief(brief, defaults) {
  // Style tuning (styles.js): a preset locks a drawing discipline; a preset +
  // `overrides` forks that template; a fully inline custom style authors one
  // outright. resolveStyleMaterial carries the resolved lock + a stable
  // `styleId` token (the shared-source key scene cohesion inherits on). No
  // style at all = the freeform max-capability path.
  const material = resolveStyleMaterial(brief, defaults); // throws on unknown preset/dial
  return {
    ...(material.preset ? { preset: material.preset, dials: material.dials } : {}),
    ...(material.id ? { id: material.id } : {}),
    styleId: material.styleId,
    style: material.style,
    mood: material.mood,
    lighting: material.lighting,
    lock: material.lock,
    // The spike's sequential contract called this `preserve`; accept both.
    mustPreserve: brief?.mustPreserve || brief?.preserve || defaults.mustPreserve,
    mayInvent: brief?.mayInvent || defaults.mayInvent,
    negative: material.negative,
  };
}

export function normalizeImageOutcomeManifest(input) {
  if (!input?.title) throw new Error('image-outcome manifest requires title');
  if (!input?.intent) throw new Error('image-outcome manifest requires intent');
  const viewBox = normalizeViewBox(input.viewBox, { width: 1536, height: 1024 });
  const forms = (input.forms || [])
    .map((form, i) => normalizeForm(form, i))
    .sort((a, b) => a.depthRank - b.depthRank);
  if (forms.length === 0) throw new Error('image-outcome manifest requires at least one form');
  // Identity metadata rides single shots too (a picture-book page is one
  // directed shot casting a recurring character): same characters[] block
  // as sequential-art, same figure binding, same sheet/packet machinery.
  const characters = normalizeCharacters(input.characters);
  return {
    kind: KIND_IMAGE_OUTCOME,
    contractVersion: IMAGE_OUTCOME_CONTRACT,
    title: String(input.title),
    intent: String(input.intent),
    mode: input.mode || 'blockout',
    source: input.source || { type: 'inline' },
    viewBox,
    camera: normalizeCamera(input.camera, 'image-outcome'),
    horizonY: Number.isFinite(input.horizonY) ? input.horizonY : Math.round(viewBox.height * 0.42),
    vanishingPoint: Array.isArray(input.vanishingPoint)
      ? [Number(input.vanishingPoint[0]), Number(input.vanishingPoint[1])]
      : [Math.round(viewBox.width * 0.5), Math.round(viewBox.height * 0.42)],
    forms,
    characters,
    figures: (input.figures || []).map((f, i) => normalizeFigure(f, i, 'image-outcome', characters)),
    protectedZones: (input.protectedZones || []).map((z) => normalizeZone(z, 'protectedZones')),
    overlayZones: (input.overlayZones || []).map((z) => normalizeZone(z, 'overlayZones')),
    renderBrief: normalizeRenderBrief(input.renderBrief, {
      style: 'cinematic concept art',
      mood: 'clear, polished, production-ready',
      lighting: 'motivated directional light',
      mustPreserve: [
        'camera angle',
        'horizon and vanishing point',
        'relative object positions',
        'occlusion order',
        'protected text/overlay zones',
      ],
      mayInvent: ['surface materials', 'weather', 'facade details', 'small props', 'atmosphere'],
      negative: [
        'do not move strict forms',
        'do not add readable text anywhere',
        'do not change panel boundaries or road edges',
      ],
    }),
  };
}

// Optional high-fidelity pose source: the protoform figure rig behind
// create_figure (per-joint DOF + spine, sex/build morphs, garments, views).
// The stick vocabulary remains the default control layer; a `rig` upgrades
// one figure to an exact posed silhouette rendered into the scaffold.
//
// Two pose languages, composable:
//   - `motion` + `phase` — sample the substrate's authored motion vocabulary
//     ('walk' / 'wave' / 'stretch' / a gait or keyframe spec) at phase ∈ [0,1),
//     the same choreographies create_figure animates. Preferred: authored
//     poses over hand-guessed joint angles.
//   - `pose` — raw per-joint DOF; when both are present, explicit pose keys
//     override the sampled motion (fine-tune one joint on top of a gait).
// Fields pass through to the figure renderer, which clamps joints to limits —
// so a rig can't break the form; validation here is shape-level only.
function normalizeRig(rig, context) {
  if (typeof rig !== 'object' || Array.isArray(rig)) {
    throw new Error(`${context}: rig must be an object ({ motion?, phase?, pose?, proto?, garment?, view?, setup?, note? })`);
  }
  for (const key of ['pose', 'proto']) {
    if (rig[key] != null && (typeof rig[key] !== 'object' || Array.isArray(rig[key]))) {
      throw new Error(`${context}: rig.${key} must be an object`);
    }
  }
  if (rig.motion != null && typeof rig.motion !== 'string' && (typeof rig.motion !== 'object' || Array.isArray(rig.motion))) {
    throw new Error(`${context}: rig.motion must be a motion name ('walk'/'wave'/'stretch') or a gait/keyframe spec object`);
  }
  if (rig.phase != null && !(Number.isFinite(rig.phase) && rig.phase >= 0 && rig.phase < 1)) {
    throw new Error(`${context}: rig.phase must be a number in [0, 1)`);
  }
  if (rig.phase != null && rig.motion == null) {
    throw new Error(`${context}: rig.phase requires rig.motion`);
  }
  if (rig.view != null && typeof rig.view !== 'string' && !Number.isFinite(rig.view)) {
    throw new Error(`${context}: rig.view must be a named view or an azimuth number`);
  }
  if (rig.note != null && typeof rig.note !== 'string') {
    throw new Error(`${context}: rig.note must be a string`);
  }
  // The body's wardrobe + stylized register are gated against the SAME closed
  // vocabulary create_figure uses (garment was previously passing through
  // unvalidated). fluffs (the fluff/mascot register) replaces proto when present.
  const garmentErrs = validateGarmentField(rig.garment, `${context}: rig.garment`);
  if (garmentErrs.length) throw new Error(garmentErrs.join('; '));
  if (rig.fluffs != null) {
    if (!Array.isArray(rig.fluffs) || rig.fluffs.length === 0) {
      throw new Error(`${context}: rig.fluffs must be a non-empty array of fluff specs`);
    }
    const fluffErrs = validateFluffs(rig.fluffs, articulate(rig.pose || {}));
    if (fluffErrs.length) throw new Error(`${context}: rig.fluffs — ${fluffErrs[0]}`);
  }
  const out = {};
  if (rig.motion != null) out.motion = rig.motion;
  if (rig.phase != null) out.phase = rig.phase;
  if (rig.pose != null) out.pose = rig.pose;
  if (rig.proto != null) out.proto = rig.proto;
  if (rig.fluffs != null) out.fluffs = rig.fluffs;
  if (rig.garment != null) out.garment = rig.garment;
  if (rig.view != null) out.view = rig.view;
  if (rig.setup != null) out.setup = String(rig.setup);
  if (rig.note != null) out.note = rig.note;
  return out;
}

// Per-outfit body dials on a character-sheet row (the wardrobe[] channel): each
// outfit may carry its own garment/pose/motion/proto, merged OVER the shared
// character.rig body at render — same body, different outfit per row. Dials
// require a rig (a wardrobe needs a body to hang on). Returns the validated
// subset; {} when the outfit declares none (label-only prose row).
const OUTFIT_DIAL_KEYS = ['garment', 'pose', 'motion', 'phase', 'proto'];
function normalizeOutfitBody(outfit, charId, hasRig) {
  const present = OUTFIT_DIAL_KEYS.filter((k) => outfit[k] != null);
  if (present.length === 0) return {};
  if (!hasRig) {
    throw new Error(
      `character ${charId}: outfit '${outfit.id}' carries figure dials (${present.join(', ')}) but the character declares no rig — put the shared body on character.rig first`,
    );
  }
  const out = {};
  const garmentErrs = validateGarmentField(outfit.garment, `character ${charId}: outfit '${outfit.id}'.garment`);
  if (garmentErrs.length) throw new Error(garmentErrs.join('; '));
  if (outfit.garment != null) out.garment = outfit.garment;
  for (const key of ['pose', 'proto']) {
    if (outfit[key] != null && (typeof outfit[key] !== 'object' || Array.isArray(outfit[key]))) {
      throw new Error(`character ${charId}: outfit '${outfit.id}'.${key} must be an object`);
    }
    if (outfit[key] != null) out[key] = outfit[key];
  }
  if (outfit.motion != null) {
    if (typeof outfit.motion !== 'string' && (typeof outfit.motion !== 'object' || Array.isArray(outfit.motion))) {
      throw new Error(`character ${charId}: outfit '${outfit.id}'.motion must be a motion name or a keyframe spec object`);
    }
    out.motion = outfit.motion;
  }
  if (outfit.phase != null) {
    if (!(Number.isFinite(outfit.phase) && outfit.phase >= 0 && outfit.phase < 1)) {
      throw new Error(`character ${charId}: outfit '${outfit.id}'.phase must be a number in [0, 1)`);
    }
    if (outfit.motion == null) throw new Error(`character ${charId}: outfit '${outfit.id}'.phase requires motion`);
    out.phase = outfit.phase;
  }
  return out;
}

// Characters are IDENTITY METADATA on a sequential-art manifest (the
// model-sheet pattern from pan-cel, transposed to comics): each declares
// who someone is — description, optional outfits, optional rig for build —
// independent of where they stand in any panel. The render worker
// generates one neutral-lighting reference sheet per character FIRST and
// conditions every panel on it, so identity stops being prompt luck.
function normalizeCharacter(ch, index) {
  if (!ch || typeof ch !== 'object') throw new Error(`characters[${index}] must be an object`);
  // A bare { ref } entry is a pointer to a standalone character-sheet
  // sketch; the mint tools (create_sketch / update_sketch) inline it before
  // this validator runs. Reaching here unresolved means the caller bypassed
  // the tool layer.
  if (ch.ref && (!ch.id || !ch.description)) {
    throw new Error(
      `characters[${index}]: unresolved character ref '${ch.ref}' — mint via create_sketch/update_sketch (they inline the referenced character-sheet), or inline id + description directly`,
    );
  }
  const id = ch.id;
  if (!id || typeof id !== 'string') throw new Error(`characters[${index}]: id is required`);
  if (!ch.description || typeof ch.description !== 'string') {
    throw new Error(`character ${id}: description is required (face, hair, build, signature features)`);
  }
  const hasRig = ch.rig != null;
  const outfits = (ch.outfits || []).map((outfit, i) => {
    if (!outfit || typeof outfit !== 'object') throw new Error(`character ${id}: outfits[${i}] must be an object`);
    if (!outfit.id || typeof outfit.id !== 'string') throw new Error(`character ${id}: outfits[${i}].id is required`);
    if (!outfit.description || typeof outfit.description !== 'string') {
      throw new Error(`character ${id}: outfit '${outfit.id}' requires a description`);
    }
    return { id: outfit.id, description: outfit.description, ...normalizeOutfitBody(outfit, id, hasRig) };
  });
  const seen = new Set();
  for (const outfit of outfits) {
    if (seen.has(outfit.id)) throw new Error(`character ${id}: duplicate outfit id '${outfit.id}'`);
    seen.add(outfit.id);
  }
  const out = { id, description: ch.description, outfits };
  if (ch.name != null) out.name = String(ch.name);
  if (ch.rig != null) out.rig = normalizeRig(ch.rig, `character ${id}`);
  // Provenance: a character inlined from a standalone character-sheet
  // sketch keeps the source ref, so the render packet can serve that
  // sheet's bound PNG as the conditioning reference.
  if (ch.ref != null) {
    if (typeof ch.ref !== 'string') throw new Error(`character ${id}: ref must be a sketch ref string`);
    out.ref = ch.ref;
  }
  return out;
}

function normalizeCharacters(list) {
  const characters = (list || []).map(normalizeCharacter);
  const seen = new Set();
  for (const ch of characters) {
    if (seen.has(ch.id)) throw new Error(`duplicate character id: ${ch.id}`);
    seen.add(ch.id);
  }
  return characters;
}

function normalizeFigure(figure, index, context, characters) {
  const x = Number(figure?.x);
  const y = Number(figure?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${context}: figures[${index}] requires numeric x/y`);
  }
  const pose = figure.pose || 'stand';
  if (typeof pose !== 'string' || !isPoseKind(pose)) {
    throw new Error(
      `${context}: figures[${index}].pose '${pose}' is not a pose vocabulary entry (one of: ${POSE_KINDS.join(', ')})`,
    );
  }
  const out = {
    id: figure.id || `figure-${index + 1}`,
    x,
    y,
    scale: Number.isFinite(figure.scale) ? figure.scale : 1,
    pose,
  };
  if (figure.rig != null) {
    out.rig = normalizeRig(figure.rig, `${context}: figures[${index}]`);
  }
  // Identity binding: a figure may reference a declared character (and one
  // of its outfits) — membership is validated so a panel can't point at an
  // identity the sheet run won't produce.
  if (figure.character != null) {
    if (!characters) {
      throw new Error(`${context}: figures[${index}].character requires a manifest with characters[]`);
    }
    const ch = characters.find((c) => c.id === figure.character);
    if (!ch) {
      throw new Error(
        `${context}: figures[${index}].character '${figure.character}' is not declared (characters: ${characters.map((c) => c.id).join(', ') || 'none'})`,
      );
    }
    out.character = figure.character;
    if (figure.outfit != null) {
      if (!ch.outfits.some((o) => o.id === figure.outfit)) {
        throw new Error(
          `${context}: figures[${index}].outfit '${figure.outfit}' is not declared on character '${ch.id}' (outfits: ${ch.outfits.map((o) => o.id).join(', ') || 'none'})`,
        );
      }
      out.outfit = figure.outfit;
    }
  } else if (figure.outfit != null) {
    throw new Error(`${context}: figures[${index}].outfit requires a character reference`);
  }
  return out;
}

function normalizePanel(panel, index, characters, autoBounds) {
  if (!panel || typeof panel !== 'object') throw new Error(`panels[${index}] must be an object`);
  const id = panel.id || `p${index + 1}`;
  if (!panel.beat) throw new Error(`panel ${id}: beat is required`);
  // Bounds are explicit, or laid out by the page recipe (the vexar
  // pipeline's panel-blocking paradigms, shared via page-recipes.js).
  const bounds = panel.bounds ?? autoBounds;
  if (![bounds?.x, bounds?.y, bounds?.w, bounds?.h].every(Number.isFinite) || bounds.w <= 0 || bounds.h <= 0) {
    throw new Error(
      `panel ${id}: bounds requires numeric x/y and positive w/h — or omit bounds and set pageRecipe to a layout paradigm (one of: ${PAGE_RECIPE_IDS.join(', ')})`,
    );
  }
  return {
    id,
    beat: String(panel.beat),
    bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
    camera: normalizeCamera(panel.camera, `panel ${id}`),
    figures: (panel.figures || []).map((f, i) => normalizeFigure(f, i, `panel ${id}`, characters)),
    forms: (panel.forms || []).map((form, i) => normalizeForm(form, i, `panel ${id} forms`)),
    bubbleZones: (panel.bubbleZones || []).map((z) => normalizeZone(z, `panel ${id} bubbleZones`)),
  };
}

export function normalizeSequentialArtManifest(input) {
  if (!input?.title) throw new Error('sequential-art manifest requires title');
  if (!input?.intent) throw new Error('sequential-art manifest requires intent');
  const renderStrategy = input.renderStrategy ?? DEFAULT_RENDER_STRATEGY;
  if (!RENDER_STRATEGIES.includes(renderStrategy)) {
    throw new Error(`sequential-art renderStrategy must be one of ${RENDER_STRATEGIES.join(', ')}`);
  }
  const characters = normalizeCharacters(input.characters);
  const pageRecipe = input.pageRecipe || 'sequential-page';
  const recipe = pageRecipeEntry(pageRecipe);
  const viewBox = normalizeViewBox(input.viewBox, { width: 1536, height: 2048 });
  const rawPanels = input.panels || [];
  // Auto-layout: panels may omit bounds when the recipe is a known
  // panel-blocking paradigm — the same layout math as the deterministic
  // comic pipeline fills them in, by panel order.
  let layout = null;
  if (rawPanels.some((p) => p && typeof p === 'object' && p.bounds == null)) {
    if (!recipe) {
      throw new Error(
        `panels without bounds need a layout paradigm — set pageRecipe to one of: ${PAGE_RECIPE_IDS.join(', ')} (or give every panel explicit bounds)`,
      );
    }
    layout = recipePanelBounds(recipe.id, viewBox, rawPanels.length);
  }
  const panels = rawPanels.map((panel, i) => normalizePanel(panel, i, characters, layout?.[i]));
  if (panels.length === 0) throw new Error('sequential-art manifest requires at least one panel');
  const seen = new Set();
  for (const panel of panels) {
    if (seen.has(panel.id)) throw new Error(`duplicate panel id: ${panel.id}`);
    seen.add(panel.id);
  }
  return {
    kind: KIND_SEQUENTIAL_ART,
    contractVersion: SEQUENTIAL_ART_CONTRACT,
    title: String(input.title),
    intent: String(input.intent),
    pageRecipe,
    // Reading flow defaults from the recipe (manga paradigms read RTL);
    // an explicit readingFlow always wins.
    readingFlow: input.readingFlow || recipe?.readingFlow || 'left-to-right, top-to-bottom',
    renderStrategy,
    viewBox,
    characters,
    panels,
    renderBrief: normalizeRenderBrief(input.renderBrief, {
      style: 'clean painted sequential-art page, cohesive palette',
      mood: 'clear staging, readable silhouettes',
      lighting: 'per-panel motivated light',
      mustPreserve: [
        'panel staging and camera per panel',
        'figure pose silhouettes',
        'bubble/caption reserves left blank',
        'occlusion order',
      ],
      mayInvent: ['clothing design', 'environment detail', 'atmosphere', 'texture'],
      negative: [
        'no readable text',
        'no panel borders or speech bubbles in the painted layer',
        'do not crop out staged figures',
      ],
    }),
  };
}

/**
 * A standalone character sheet — the character as its own reusable
 * primitive. Minted once (`sk_` ref), rendered by the external worker,
 * bound via `bind_character_sheet`, then referenced from any number of
 * sequential-art manifests as `characters: [{ ref }]`. The sheet layout is
 * fixed: a model-sheet turnaround strip (front / three-quarter / side /
 * back), one row per outfit, neutral presentation.
 */
export function normalizeCharacterSheetManifest(input) {
  if (!input?.title) throw new Error('character-sheet manifest requires title');
  const character = normalizeCharacter(input.character, 0);
  if (character.ref) {
    throw new Error('a character-sheet manifest declares its character inline — refs point AT sheets, not from them');
  }
  const rows = Math.max(1, character.outfits.length);
  return {
    kind: KIND_CHARACTER_SHEET,
    contractVersion: CHARACTER_SHEET_CONTRACT,
    title: String(input.title),
    intent: input.intent ? String(input.intent) : `character reference sheet for ${character.name || character.id}`,
    viewBox: normalizeViewBox(input.viewBox, { width: 1536, height: 512 * rows }),
    character,
    renderBrief: normalizeRenderBrief(input.renderBrief, {
      style: 'clean character model sheet, consistent identity across all views',
      mood: 'neutral, documentary, production reference',
      lighting: 'flat even studio light — no scene lighting, no drama',
      mustPreserve: [
        'same face, hair, and build in every view and every row',
        'front / three-quarter / side / back order on a common ground line',
        'one row per outfit; only the outfit changes between rows',
      ],
      mayInvent: ['pose relaxation details', 'fabric behavior consistent with the outfit descriptions'],
      negative: [
        'no readable text, labels, or annotations',
        'no scene, props, or background art',
        'no dramatic lighting or action posing',
      ],
    }),
  };
}

/**
 * A keyframe animation — body animation as WHOLE meru-locked cels
 * (animation-cheats.plan.md Addendum 4). The rig emits one posed-mannequin
 * meru guide per key of a motion; the worker paints a full cel over each; the
 * cels compose on twos into the motion. Optional face channels (blink / speech)
 * layer expression VARIANTS — themselves whole cels, never decals — selected
 * per output frame on a seeded schedule (that composite is the forge_motion
 * step; this manifest only declares the recipe and enumerates render targets).
 *
 * The manifest is the recipe: the meru guides are DERIVED from `motion`+`keys`
 * at render-packet time, never stored. Identity rides `characters[]` (usually
 * one) exactly as sequential-art does, so the packet's character-sheet
 * conditioning machinery locks the character across every cel for free.
 */
export function normalizeKeyframeAnimationManifest(input) {
  if (!input?.title) throw new Error('keyframe-animation manifest requires title');
  if (input.motion == null) {
    throw new Error("keyframe-animation manifest requires motion (a name like 'wave'/'walk' or a keyframe spec object)");
  }
  if (typeof input.motion !== 'string' && (typeof input.motion !== 'object' || Array.isArray(input.motion))) {
    throw new Error('keyframe-animation motion must be a motion name string or a keyframe spec object');
  }
  // A motion NAME string must resolve to the real vocabulary. Reject an unknown
  // name here (with the valid set) instead of letting it crash at guide render
  // where sampleMotionPose returns null and the emitter dereferences it.
  if (typeof input.motion === 'string' && !isKnownMotionName(input.motion)) {
    throw new Error(
      `keyframe-animation motion '${input.motion}' is not a known motion. Use one of: `
      + `walk, wave, stretch, sprint, an emote (nod/headshake/bow/shrug/cheer/clap/point/think), `
      + `or an object { keyframes: [pose, …] } where each pose is create_figure joint dials `
      + `(numbers per joint — e.g. { elbowR: 120, spine: { axial: 0.2 } } — NOT prose).`
    );
  }
  // Footgun guard: authored key poses belong INSIDE motion ({ keyframes: [...] }),
  // not as a top-level `poses`/`keyframes` field — which would be silently dropped,
  // minting an empty animation. Catch the common mis-authoring with a pointer.
  if (input.poses != null || (typeof input.motion !== 'object' && input.keyframes != null)) {
    throw new Error(
      "keyframe-animation: authored key poses go in motion, not a top-level field — "
      + "pass motion: { keyframes: [pose, …] } (each pose = create_figure joint dials). "
      + "A top-level `poses`/`keyframes` field is not part of the manifest and would be ignored."
    );
  }
  const keys = Number(input.keys ?? 6);
  if (!Number.isInteger(keys) || keys < 1) throw new Error('keyframe-animation keys must be an integer >= 1');
  const fps = Number(input.fps ?? 12);
  const onTwos = Number(input.onTwos ?? 2);
  const cycles = Number(input.cycles ?? 3);
  for (const [name, v] of [['fps', fps], ['onTwos', onTwos], ['cycles', cycles]]) {
    if (!Number.isInteger(v) || v < 1) throw new Error(`keyframe-animation ${name} must be an integer >= 1`);
  }
  const characters = normalizeCharacters(input.characters);
  if (characters.length === 0) {
    throw new Error('keyframe-animation manifest requires at least one character (identity lock across cels)');
  }
  const canvas = input.canvas
    ? normalizeViewBox({ width: input.canvas.width, height: input.canvas.height }, KEYFRAME_CANVAS)
    : { ...KEYFRAME_CANVAS };
  const out = {
    kind: KIND_KEYFRAME_ANIMATION,
    contractVersion: KEYFRAME_ANIMATION_CONTRACT,
    title: String(input.title),
    intent: input.intent ? String(input.intent) : `keyframe animation of ${characters[0].name || characters[0].id}`,
    motion: input.motion,
    motionLabel: typeof input.motion === 'string' ? input.motion : String(input.motionLabel || 'motion'),
    keys,
    fps,
    onTwos,
    cycles,
    canvas,
    characters,
  };
  // A clip MAY declare a style (preset / fork / custom) — the shared source a
  // scene inherits so the plate is painted in the same look. Omitted → no
  // renderBrief, and the cels use the historical flat-cel default.
  if (input.renderBrief != null) {
    out.renderBrief = normalizeRenderBrief(input.renderBrief, {
      style: 'flat cel animation style, clean dark outlines, flat colors',
      mood: 'clear, consistent, on-model',
      lighting: 'flat cel lighting',
      mustPreserve: [],
      mayInvent: [],
      negative: [],
    });
  }
  if (input.blink != null) out.blink = normalizeFaceTrack('blink', input.blink);
  if (input.speech != null) out.speech = normalizeFaceTrack('speech', input.speech);
  return out;
}

// The directorial blink override: output frames on which a blink's CLOSED phase
// is guaranteed to land, painted over the seeded schedule (resolveBlinkTrack).
function normalizeForcedFrames(forcedFrames, ctx) {
  if (forcedFrames == null) return {};
  if (!Array.isArray(forcedFrames) || !forcedFrames.every((f) => Number.isInteger(f) && f >= 0)) {
    throw new Error(`${ctx} forcedFrames must be an array of output-frame integers >= 0`);
  }
  return { forcedFrames: forcedFrames.map(Number) };
}

// Face channel tracks are optional and purely a scheduling recipe (mulberry32
// blink dice / speech flap spans, resolved at composite time). They add render
// targets (the expression variant cels) but no body-cel work.
function normalizeFaceTrack(kind, track) {
  if (typeof track !== 'object' || Array.isArray(track)) {
    throw new Error(`keyframe-animation ${kind} must be an object`);
  }
  if (kind === 'blink') {
    const seed = Number(track.seed ?? 1);
    const meanGapSec = Number(track.meanGapSec ?? 2.2);
    if (!Number.isFinite(seed) || !Number.isFinite(meanGapSec) || meanGapSec <= 0) {
      throw new Error('keyframe-animation blink requires numeric seed and positive meanGapSec');
    }
    return { seed, meanGapSec, ...normalizeForcedFrames(track.forcedFrames, 'keyframe-animation blink') };
  }
  // speech
  const spans = Array.isArray(track.spans) ? track.spans : [];
  for (const s of spans) {
    if (!Array.isArray(s) || s.length !== 2 || !s.every(Number.isFinite) || s[0] >= s[1]) {
      throw new Error('keyframe-animation speech spans must be [startSec, endSec] pairs with start < end');
    }
  }
  const flapsPerSec = Number(track.flapsPerSec ?? 8);
  if (!Number.isInteger(flapsPerSec) || flapsPerSec < 1) {
    throw new Error('keyframe-animation speech flapsPerSec must be an integer >= 1');
  }
  return { spans: spans.map((s) => [Number(s[0]), Number(s[1])]), flapsPerSec };
}

/**
 * scene-motion — the layer ABOVE keyframe clips (scene-promotion.plan.md SP1).
 * A recipe that stages several finished character clips over a background PLATE
 * with a declared ground plane, camera shots (pan/zoom/cuts), and one clock. The
 * only render target is the plate (the cast are separate keyframe-animation
 * clips); cast members carry a clipRef, never pixels. `unit` is the eye-level
 * fit (derived from the ground plane) so figures never read as giants.
 */
export function normalizeSceneMotionManifest(input) {
  if (!input?.title) throw new Error('scene-motion manifest requires title');
  const fps = Number(input.fps ?? 12);
  const onTwos = Number(input.onTwos ?? 2);
  const cycles = Number(input.cycles ?? 1);
  for (const [name, v] of [['fps', fps], ['onTwos', onTwos], ['cycles', cycles]]) {
    if (!Number.isInteger(v) || v < 1) throw new Error(`scene-motion ${name} must be an integer >= 1`);
  }
  const frame = normalizeViewBox(input.frame, KEYFRAME_CANVAS);
  const stage = normalizeSceneStage(input.stage);
  const cast = normalizeSceneCast(input.cast);
  const castIds = new Set(cast.map((c) => c.id));
  const shots = normalizeSceneShots(input.shots, castIds);
  const out = {
    kind: KIND_SCENE_MOTION,
    contractVersion: SCENE_MOTION_CONTRACT,
    title: String(input.title),
    intent: input.intent ? String(input.intent) : `scene: ${cast.map((c) => c.id).join(', ')}`,
    fps, onTwos, cycles, frame, stage, cast, shots,
  };
  // The plate's style. An EXPLICIT scene renderBrief (preset / fork / custom) is
  // the operator override; when omitted, the create_sketch handler bakes the
  // style INHERITED from the lead cast clip at mint (resolveScenePlateStyle) so
  // the plate is painted in the cast's look — the load-bearing shared source.
  if (input.renderBrief != null) {
    out.renderBrief = normalizeRenderBrief(input.renderBrief, {
      style: 'painted background plate',
      mood: 'setting that matches the cast',
      lighting: 'consistent with the cast lighting',
      mustPreserve: [], mayInvent: [], negative: [],
    });
  }
  return out;
}

function normalizeSceneStage(stage, plateRef = 'plate') {
  if (!stage || typeof stage !== 'object') throw new Error('scene-motion requires a stage (the ground plane)');
  const horizonY = Number(stage.horizonY);
  const groundYRef = Number(stage.groundYRef);
  if (!(horizonY < groundYRef)) throw new Error('scene-motion stage: horizonY must be above groundYRef');
  const dRef = Number(stage.dRef ?? 1);
  if (!(dRef > 0)) throw new Error('scene-motion stage: dRef must be > 0');
  const cameraHeight = Number(stage.cameraHeight ?? 0.93);
  if (!(cameraHeight > 0)) throw new Error('scene-motion stage: cameraHeight must be > 0');
  const unit = stage.unit != null ? Number(stage.unit) : eyeLevelUnit(groundYRef, horizonY, cameraHeight);
  if (!(unit > 0)) throw new Error('scene-motion stage: unit must be > 0');
  const p = stage.plate || {};
  const pw = Number(p.width); const ph = Number(p.height);
  if (!(pw > 0 && ph > 0)) throw new Error('scene-motion stage.plate requires positive width and height');
  const out = {
    unit, dRef, horizonY, groundYRef, cameraHeight,
    plate: { ref: plateRef, width: pw, height: ph, depth: Number(p.depth ?? 4), originX: Number(p.originX ?? 0), originY: Number(p.originY ?? 0) },
    floor: Array.isArray(stage.floor) ? [Number(stage.floor[0]), Number(stage.floor[1])] : [horizonY, ph],
  };
  if (Array.isArray(stage.bands) && stage.bands.length) {
    out.bands = stage.bands.map((b, i) => {
      const ref = String(b.ref || `band-${i}`);
      if (ref === 'plate' || /^plate-shot-\d+$/.test(ref)) throw new Error(`scene-motion band ref '${ref}' is reserved for plates`);
      return { ref, depth: Number(b.depth), originX: Number(b.originX ?? 0), originY: Number(b.originY ?? 0) };
    });
  }
  return out;
}

function normalizeSceneCast(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('scene-motion requires at least one cast member');
  const ids = new Set();
  return list.map((c, i) => {
    if (!c || typeof c !== 'object') throw new Error(`scene-motion cast[${i}] must be an object`);
    const id = String(c.id || '').trim();
    if (!id) throw new Error(`scene-motion cast[${i}] requires an id`);
    if (ids.has(id)) throw new Error(`scene-motion duplicate cast id '${id}'`);
    ids.add(id);
    const clipRef = String(c.clipRef || '').trim();
    if (!clipRef) throw new Error(`scene-motion cast '${id}' requires clipRef (a keyframe-animation sk_ / mo_ clip)`);
    const markX = Number(c.markX);
    if (!Number.isFinite(markX)) throw new Error(`scene-motion cast '${id}' requires numeric markX`);
    const depth = Number(c.depth ?? 1);
    if (!(depth > 0)) throw new Error(`scene-motion cast '${id}' depth must be > 0`);
    const out = { id, clipRef, markX, depth };
    if (c.facing) out.facing = String(c.facing);
    if (c.phase != null) out.phase = Number(c.phase);
    if (c.onTwos != null) out.onTwos = Number(c.onTwos);
    if (Array.isArray(c.depthKeys)) {
      out.depthKeys = c.depthKeys.map((k) => ({ t: Number(k.t), depth: Number(k.depth) }));
    }
    if (c.face) out.face = normalizeSceneFace(c.face, id);
    return out;
  });
}

// Scene face tracks feed scene-compose's resolveActorFace / resolveMouthTrack,
// which expects speech spans as { from, to } objects (NOT the keyframe [a,b] pair).
function normalizeSceneFace(face, id) {
  const out = {};
  if (face.blink != null) {
    const seed = Number(face.blink.seed ?? 1);
    const meanGapSec = Number(face.blink.meanGapSec ?? 2.2);
    if (!Number.isFinite(seed) || !(meanGapSec > 0)) throw new Error(`scene-motion cast '${id}' blink needs numeric seed + positive meanGapSec`);
    out.blink = { seed, meanGapSec, ...normalizeForcedFrames(face.blink.forcedFrames, `scene-motion cast '${id}' blink`) };
  }
  if (face.speech != null) {
    const spans = Array.isArray(face.speech.spans) ? face.speech.spans : [];
    out.speech = {
      spans: spans.map((s) => {
        const from = Number(s.from ?? s[0]); const to = Number(s.to ?? s[1]);
        if (!(from < to)) throw new Error(`scene-motion cast '${id}' speech span needs from < to`);
        return { from, to };
      }),
      flapsPerSec: Number(face.speech.flapsPerSec ?? 8),
    };
  }
  return out;
}

function normalizeSceneShots(list, castIds) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('scene-motion requires at least one shot');
  return list.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`scene-motion shot[${i}] must be an object`);
    const span = Array.isArray(s.span) ? s.span.map(Number) : null;
    if (!span || span.length !== 2 || !(span[0] < span[1])) throw new Error(`scene-motion shot[${i}] needs span [tIn, tOut] with tIn < tOut`);
    const cast = Array.isArray(s.cast) ? s.cast.map(String) : [];
    for (const id of cast) if (!castIds.has(id)) throw new Error(`scene-motion shot[${i}] names unknown cast '${id}'`);
    const camera = Array.isArray(s.camera) && s.camera.length ? s.camera.map((k) => ({
      t: Number(k.t ?? 0),
      ...(k.camX != null ? { camX: Number(k.camX) } : {}),
      ...(k.camY != null ? { camY: Number(k.camY) } : {}),
      ...(k.zoom != null ? { zoom: Number(k.zoom) } : {}),
      ...(k.ease ? { ease: String(k.ease) } : {}),
    })) : [{ t: 0, camX: 0 }];
    // Camera keyframe t is SHOT-LOCAL seconds (0 at the shot's own tIn). An
    // absolute-time key silently freezes the camera (sampleCamera clamps past
    // the last in-range key) — refuse it at mint instead.
    const localDur = span[1] - span[0];
    for (const k of camera) {
      if (!(k.t >= 0 && k.t <= localDur)) {
        throw new Error(
          `scene-motion shot[${i}] camera keyframe t=${k.t} is outside the shot's LOCAL time [0, ${localDur}] `
          + '(camera t restarts at 0 each shot — do not use scene-absolute seconds)',
        );
      }
    }
    const out = { span, cast, camera };
    // The CROSS-CUT: a shot may play on its OWN stage (a different setting — the
    // phone-call cut). Its plate is a separate render target `plate-shot-<i>`;
    // cast marks/depths inside this shot read against THIS stage's plane.
    if (s.stage != null) out.stage = normalizeSceneStage(s.stage, `plate-shot-${i}`);
    return out;
  });
}

/**
 * scene-motion render targets: the base plate, plus one `plate-shot-<i>` per
 * shot that carries its own stage (the cross-cut). Occluder bands are declared
 * for the compositor but are NOT render targets in v1 (no band scaffold/audit
 * yet) — a band without a source is skipped at composite time.
 */
function sceneRenderTargets(manifest) {
  return [
    'plate',
    ...(manifest.shots || []).map((s, i) => (s.stage ? `plate-shot-${i}` : null)).filter(Boolean),
  ];
}

/** Parse a scene-motion render target: 'plate', 'plate-shot-<i>', or a declared band ref. */
export function parseSceneTarget(manifest, target) {
  const t = String(target || '');
  if (t === 'plate') return { plate: true, stage: manifest.stage };
  const shotMatch = /^plate-shot-(\d+)$/.exec(t);
  if (shotMatch) {
    const shotIndex = Number(shotMatch[1]);
    const shot = manifest.shots?.[shotIndex];
    if (!shot?.stage) throw new Error(`'${target}' names shot ${shotIndex}, which has no stage of its own`);
    return { plate: true, shotIndex, stage: shot.stage };
  }
  const band = (manifest.stage?.bands || []).find((b) => b.ref === t);
  if (band) return { band };
  throw new Error(`'${target}' is not a scene-motion render target (expected 'plate', 'plate-shot-<i>', or a band ref)`);
}

export function normalizeImageOutcomesManifest(input) {
  if (!input || typeof input !== 'object') throw new Error('manifest must be an object');
  if (input.kind === KIND_IMAGE_OUTCOME) return normalizeImageOutcomeManifest(input);
  if (input.kind === KIND_SEQUENTIAL_ART) return normalizeSequentialArtManifest(input);
  if (input.kind === KIND_CHARACTER_SHEET) return normalizeCharacterSheetManifest(input);
  if (input.kind === KIND_KEYFRAME_ANIMATION) return normalizeKeyframeAnimationManifest(input);
  if (input.kind === KIND_SCENE_MOTION) return normalizeSceneMotionManifest(input);
  throw new Error(`unknown image-outcomes kind: ${input.kind}`);
}

/**
 * The render targets a manifest expands to (the I3 expansion rule): one
 * 'page' for single shots, whole-page sequential-art, and character
 * sheets; one target per panel for per-panel; page first, then panels,
 * for hybrid. Shared by the render packet, the bind tool, and the final
 * composite so "which units get generated" has one answer.
 */
export function renderTargets(manifest) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  if (normalized.kind === KIND_KEYFRAME_ANIMATION) return keyframeRenderTargets(normalized);
  if (normalized.kind === KIND_SCENE_MOTION) return sceneRenderTargets(normalized);
  if (normalized.kind !== KIND_SEQUENTIAL_ART || normalized.renderStrategy === 'whole-page') {
    return ['page'];
  }
  const panelIds = normalized.panels.map((p) => p.id);
  return normalized.renderStrategy === 'hybrid' ? ['page', ...panelIds] : panelIds;
}

/**
 * Parse a keyframe render target into its parts. `key-3` → a body cel;
 * `key-3/face/blink-closed` → an expression variant of key 3's cel. Returns
 * `{ keyIndex, face }` where `face` is null for a body cel or
 * `{ vocab, state }` for a variant. Throws on a malformed target.
 */
export function parseKeyframeTarget(target) {
  const m = /^key-(\d+)(?:\/face\/([a-z]+)-([a-z]+))?$/.exec(String(target || ''));
  if (!m) throw new Error(`'${target}' is not a keyframe render target (expected key-N or key-N/face/<vocab>-<state>)`);
  const keyIndex = Number(m[1]);
  return { keyIndex, face: m[2] ? { vocab: m[2], state: m[3] } : null };
}

/**
 * A keyframe animation expands to one BODY cel per key (`key-0…key-{K-1}`)
 * plus, per active face channel, one expression VARIANT cel per key
 * (`key-<i>/face/<vocab>-<state>` for each non-base state). Base states ride
 * the body cel, so they never appear. Body cels come first so the animation is
 * composable the moment the body run is accepted, before any face variants.
 */
function keyframeRenderTargets(manifest) {
  const bodyTargets = [];
  for (let i = 0; i < manifest.keys; i += 1) bodyTargets.push(`key-${i}`);
  const faceTargets = [];
  for (const [channel, vocab] of Object.entries(KEYFRAME_FACE_CHANNELS)) {
    if (!manifest[channel]) continue;
    const variants = subCelStates(vocab).slice(1); // drop the base state
    for (let i = 0; i < manifest.keys; i += 1) {
      for (const state of variants) faceTargets.push(`key-${i}/face/${vocab}-${state}`);
    }
  }
  return [...bodyTargets, ...faceTargets];
}
