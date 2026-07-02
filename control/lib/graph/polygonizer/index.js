import { expandNeoRembrandt } from '@/lib/graph/neo-rembrandt/index.js';
import { expandGridLayout, validateSketchManifest } from '@/lib/graph/sketch/sketch-manifest.js';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys.js';
import { decryptApiKey } from '@/lib/deployment-auth.js';
import { generateStructured, getDefaultModelForTask, LLM_PROVIDERS } from '@/lib/llm-providers.js';
import { getRenderPrimitiveCards, listSketchVocab } from '@/lib/graph/sketch-vocab/loader.js';
import { createHash } from 'node:crypto';
import { validateConstellationGrid, withConstellationGrid } from './constellation.js';
import {
  validateCameraWorldFraming,
  validateElementMandalaOverflows,
  validateMetamandalaUnitScale,
  withGeneratedElementMandala,
  withResolvedWorldCamera,
} from './pure-mandala.js';
import { buildSolvedScaffold } from './scaffold.js';
import { blockLayoutIds, mandalaPatternIds, shotGlyphIds } from './mandala-patterns.js';
import { lowerRecipeManifest, recipeFamilyAllowlist } from './recipe-compiler.js';
import { routeCardsByEmbedding, _resetCardVectorCacheForTests } from './card-router.js';
import { applyDeterministicRepairs } from './repair-patches.js';
import { applyShotGlyphImplications } from './glyph-implications.js';

export {
  buildConstellationGrid,
  validateConstellationGrid,
  withConstellationGrid,
  withResolvedChildRegionsWorld,
} from './constellation.js';
export { applyDepictionOverlay, lowerDepictionLayout, normalizeDepiction, PANEL_DEPICTION_RECIPES } from './depiction-layout.js';
export {
  projectRoomHeightManjis,
  projectRoomSceneElements,
  resolveRoomSceneElementPlan,
  resolveRoomSurfaces,
  roomSceneElementDiagnostics,
  ROOM_SCENE_ELEMENT_PRESETS,
  walkRoomSceneElements,
} from './room-scene-elements.js';
export {
  projectLeggedThing,
  resolveLeggedThing,
  resolveLeggedThingLibrary,
  ROOM_LEGGED_THING_VARIANTS,
} from './room-legged-things.js';
export {
  blockLayoutIds,
  blockLayoutLibrary,
  buildMandalaPatternLayer,
  buildBlockLayoutPlan,
  buildShotGlyphPlan,
  mandalaPatternIds,
  mandalaPatternLibrary,
  resolveBlockLayout,
  resolveMandalaPattern,
  resolveShotGlyph,
  shotGlyphIds,
  shotGlyphLibrary,
} from './mandala-patterns.js';
export { compileSketchRecipe, lowerRecipeManifest, recipeFamilyAllowlist } from './recipe-compiler.js';

/**
 * POLYGONIZER_CORE_PROMPT — the always-on body of the polygonizer's system
 * prompt. It declares the top-level manifest shape, the core renderer
 * vocabulary that any prompt may need (solid, partition, array, line/polygon,
 * plane/sphere/oval/blob/text), and the schema-level rules that apply
 * regardless of which higher-level primitive the model reaches for.
 *
 * Higher-level primitives (rBrush, fluidField, sparkField, wispField,
 * blobPla, visionPane, volume:"cup", cubieLattice, mandalaField,
 * mandalaArrangement, form, roomConcept, two-point camera, lettering
 * carriers, panel-depiction recipes, metamandala light sources, the
 * garment-pattern and architectural-construction recipes) live as
 * render-primitive cards in lib/graph/sketch-vocab/ and are injected by
 * buildPolygonizerSystemPrompt() only when the classifier (or the caller)
 * picks them. The card body itself is the only place each primitive's
 * grammar lives — see lite-template/integration/0603/polygonizer_optimization.md.
 */
export const POLYGONIZER_CORE_PROMPT = `You are Mojulo's polygonizer.

Convert the user's visual prompt into one compact sketch manifest JSON object.

Return:
- depiction: optional top-level visual metacontext. Its paradigm is "depiction"; it records display, panel count, panel blocking paradigm, related/unrelated physical visual mode, whether a constellation grid applies per panel, eye-line layout intent, and lettering carriers such as speech bubbles, narration boxes, or hand-written bubble letters. It is audit/layout metadata, not a renderer primitive.
- polygonizer: audit metadata about the subject, impact point, reality facts, and minimal abstractions.
- polygonizer.concept: movement concept and depiction class (static-scene, portrait, panel).
- polygonizer.picture: framing, shot angle, camera distance, and composition intent.
- polygonizer.elements: picture-space inventory of major elements, importance, footprint, depth band, and blocking basis likely needed.
- polygonizer.blockingReality: coarse primitive blocks needed before inside/outside solve. This is not an object-part catalog.
- polygonizer.draftingTable: horizon, vanishing point, baseline, ruler axes, depth bands, and eye-line stacking rule when perspective/scene composition matters.
- polygonizer.constellation: optional CCA constellation grid; if omitted, Mojulo derives it deterministically from elements + draftingTable.
- polygonizer.elementMandala: generated local top-down math spaces for elements. Each generated element gets its own mandala bound to its constellation node, then projects into the overall scene/panel space. Every element shares one meru-owned unitScale (pixels per world unit) so a "size N" mark renders at the same pixel size in any element mandala and overflows past an element's bounds are measurable in world units. Each generated element carries a worldBudget = bounds / meruUnitScale; author marks within that budget. Default meru unitScale is viewBox.width / 36 (aligned with the two-point camera's xRange = [-18, 18]); declare polygonizer.metamandala.unitScale or polygonizer.metamandala.sceneExtent.width when a scene needs a non-default ruler.
- polygonizer.mandalaPatternLayer: optional metaconcept mapping layer. Use it when the prompt asks for invisible 0px mandala reasoning, imprint patterns, boundary maps, street/block layouts, shot glyphs, or a reusable vector pattern library. Pattern ids include ${mandalaPatternIds().join(', ')}. Standard shot glyph ids include ${shotGlyphIds().join(', ')}. These are seed patterns, not a closed set; the model may extend, modify, derive, or combine them for the shot.
- polygonizer.outputStyle: optional named visual style. Use "blueprint" for CAD-like sketch sheets with 1px grid/dimension linework, borderless mass tones, annotations, and scaled mandala/vector coordinates.
- recipe: optional transient authoring shorthand. Recipe families are ${recipeFamilyAllowlist().join(', ')}. Recipes are not renderer marks; if you use one, lower it into polygonizer metadata and renderer vocabulary before storage.
- scene: one depictable aspect inside the broader depiction context: camera, perspective, view, light, palette. Lighting may be supplied directly as scene.light or derived deterministically from polygonizer.metamandala.lightSources.
- cameraPrimitive: optional deterministic camera grammar (see camera-two-point card when paired floor/ceiling perspective is needed).
- polygonizer.roomConcept: optional first-class room planning contract (see room-concept-interior card for full-frame interior shots).
- gesture: optional top-level field. For figures, gesture may include a main body line, a crossGesture for the active arm/action line, and dynamicSkeleton metadata that names head/torso/pelvis plus shoulder/elbow/hand joints. Dynamic skeleton is compiled from gestures + joints into normal blob/sphere marks; do not emit a skeleton renderer mark.
- marks: compact construction marks and primitives.

Core renderer vocabulary (always available):
- solid{x,y,width,height,depth,depthOffset?,faces?,role?,fill?,stroke?,z?}
- partition{target:"role-of-prior-solid",axis:"y",count,role?,thickness?}
- array{role,count,from:[x,y],to:[x,y],upperFrom?,upperTo?,scaleFrom?,scaleTo?,item:{kind:"line"|"solid",...}}
- line{x1,y1,x2,y2}, polyline{points:[[x,y],...]}, polygon{points:[[x,y],...]}
- plane, sphere, oval, egg, cylinder, blob, text

Advanced primitives (form, volume{primitive:"cup"}, mandalaField, mandalaArrangement/horizontalStack, fluidField, swirlField, rBrush, blobPla, sparkField, wispField, visionPane, cubieLattice) and recipe families (garmentPattern, architecturalConstruction, panel-depiction recipes) are documented in render-primitive cards. When the user's prompt needs one, the matching card body is injected below. If a needed primitive is not described in the injected cards, fall back to the core renderer vocabulary above and the schema-level rules — repair will fetch additional cards if expansion fails.

Rules:
- Emit JSON only. No markdown.
- Never emit recipe family names as marks[].kind. Recipes are authoring shorthand only.
- Treat scene as one possible depictable panel concern, not the whole layout paradigm. For multi-panel pictures, use top-level depiction.display/panels to decide how many containers fit in the total picture, then lower visible panel structure to existing grid/rect/line/text marks.
- The most basic depiction display is a full equal grid with 1px panel borders. More advanced displays are panel-blocking paradigms: unequal comic-page layouts, inset/callout panels, strips, before/after pairs, or unrelated panels. Use eye-line as the key layout rule.
- Panels may be transparent movable layout containers. Use panel.transparent/frameVisible:false or display.transparentPanels plus explicit panel bounds/x/y/w/h when a panel should behave like a draggable PowerPoint-style element. It still lowers to a transparent rect, not a new mark kind.
- Cover recipes can be transparent overlays over a normal scene sketch. Use display.overlay:true when the scene/background should remain ordinary marks and the cover lowers only its transparent panel zones, frame, masthead, issue label, cover lines, and lettering above it.
- Constellation grids apply per panel only when that panel needs local CCA/world reasoning; unrelated panels may each own their own world.
- Prefer one primitive plus one repeat rule over many manual fragments.
- Mandala math space moves up to generated elements: each element can own a local top-down mapping, using the same mandala principle while remaining bound to its position in the overall constellation/depiction space.
- Use polygonizer.mandalaPatternLayer for zero-pixel reasoning over named vector patterns. It is not a renderer primitive. It names reusable boundary contracts drawn from the seed id list above. Treat the library as seed grammar: extend, modify, derive, or combine patterns when the setting needs a better top-down fit. The layer should say which invisible slots, axes, handedness, collision groups, support rails, and depth bands are solved before visible marks are emitted.
- Use polygonizer.mandalaPatternLayer.shotGlyph for standard reusable seeing conditions. A shot glyph is a mandala-space combo of camera vector, view wedge, light entry, support plane, subject envelope, and z/occlusion bias. Interior glyphs lower into cameraPrimitive, mandalaPatternLayer.cameraWindow, polygonizer.roomConcept, and polygonizer.metamandala.lightSources; exterior street glyphs also carry visionPane plus placementSpace support/parcel rails so buildings and street slope share one gravity basis before visible skins are accepted.
- Use shotGlyph "school-of-athens-central-hall" for centralized one-point civic interiors: a single axis-mundi vanishing hub, bilateral hall mandala, floor-depth grid, high-side ambient light, and staged depth bands. It is general; arbitrary subjects can bind into the hall slots.
- For streets or settlements, choose polygonizer.mandalaPatternLayer.blockLayout before visible lowering. Block layout seeds include ${blockLayoutIds().join(', ')}. Use the block layout to vary street rhythm, parcel bands, anchors, and landmark bias before emitting visionPane and building marks.
- Shot first: the camera angle determines what is looked at; what is looked at determines what appears in the mandala layout. Do not build an entire world. Build only enough top-down mandala space for camera-visible required content, supports, occluders, and face regions.
- Use polygonizer.spatialPlanning or polygonizer.rendrantPipeline with mode:"plan-before-skin" when perspective/support/collision matters. Planning resolves shot glyphs, room concepts, camera window, CCA/local spaces, hitboxes, gravity/support edges, shadow receivers, and z-adjacency before visible assets are treated as final skins.
- For shot-constrained planning, include polygonizer.mandalaPatternLayer.cameraWindow with two terminator vectors. The planning goal is to fit required content between the left and right terminator vectors in metamandala/top-down space, then project only that solved wedge into visible marks.
- For figure-like single forms, prefer a form mark with a broad stock/tuning over manual body-part inventories. Forms are constellation-authored by default. If no world constellation is supplied, treat the form as authored in a flat eye-level CCA constellation; "2D" means flat constellation physics, not no constellation.
- Use polygonizer.metamandala for local support floors/rays derived from explicit axes or solved contact regions. A metamandala surface is an L-basis planning/debug layer, not a final primitive; debug laser marks may render with metamandalaDebug:true. polygonizer.meru is accepted as the future-facing name and Rendrant normalizes it into polygonizer.metamandala.
- polygonizer.metamandala owns the scene-wide unitScale (pixels per world unit) that every element mandala consumes. Declare polygonizer.metamandala.unitScale or polygonizer.metamandala.sceneExtent.width when a scene needs a non-default ruler; otherwise the default viewBox.width / 36 applies. Authoring marks inside an element with xyz / sizeXYZ should respect that element's worldBudget = bounds / unitScale; overflows past the budget are detected at mint and governed by polygonizer.metamandala.boundaryPolicy: "allow" (default — silent), "attribute" (overflow records feed meru.gravity / meru.relaxation as cross-element contact), or "reject" (mint fails).
- For parent → child sub-mandala carving in shared world units, declare polygonizer.constellation.nodes[*].childRegionWorld:{ width, length, offsetX?, offsetY? } on the parent. The substrate resolves it through the meru unitScale into a pixel childRegion centered on the parent's bounds (plus the optional offsets in world units), so a parent reserves child space in feet/meters/whatever its meru ruler denominates instead of pixel arithmetic. The world declaration wins when both childRegionWorld and a legacy pixel childRegion are present; the original pixel rectangle is preserved as childRegionPixelDeclared for audit.
- For two-point perspective cameras, prefer world-coordinate authoring over screen-pixel vanishing-point tuning. Declare cameraPrimitive.roomBasis.worldExtent:{ width, depth, height? } (or polygonizer.metamandala.roomExtent) to set the room's world dimensions; xRange/yRange/verticalUnit derive from there via meru.unitScale. Declare cameraPrimitive.worldFraming:{ cameraPosition:[x,y,z], lookAt:[x,y,z], horizontalFov? } to place the camera in the same world ruler; the substrate derives screen-space vanishingPoints and horizonY through a pinhole projection. Explicit pixel-coord vanishingPoints / xRange / frontLeft still win when declared — world-framing supplies defaults, not overrides.
- Use polygonizer.metamandala.gravity when a visible body should land on a support fact. Declare gravity.supports[] as surfaces (prefer kind:"fromHitbox" for math-space support) and gravity.bodies[] as body/support edges. Body includeRoles move with the body, but shadowRoles remain receiver-owned surface artifacts.
- Use the sticky boots metaconcept when a coherent floaty form should stick to a floor/support without changing its internal construction. Until stickyBoots is first-class, express it with metamandala.relaxation or gravity using a synthetic boot/support role.
- For post-solve placement, use polygonizer.metamandala.relaxation.enabled with rules that move a target role family onto a resolved surfaceRole. Use surface.face:"top" when the support should mean the top plane of a solid rather than every contact edge in the support volume.
- Constellation nodes may declare hitboxes for math-space support/collision truth. Metamandala surfaces can use kind:"fromHitbox" with nodeRole/hitboxRole, then relaxation can align:"center" to move dependent marks onto the hitbox center independently of the visual polygon skin.
- Use polygonizer.realityFacts to state what must be visible for identity.
- Use polygonizer.minimalAbstractions to explain the compact construction grammar.
- Use polygonizer.blockingReality to separate each major element into fundamental shape blocks before marks. Example: house = body CCA + roof panel CCAs + window/door CCA rhythm.
- Keep blockingReality compact: use array-item/path/field blocks for repeated or broad structure instead of enumerating every visible detail.
- If you include polygonizer.constellation, it must be a non-rendered CCA grid with one node per element: renderOrder, parent, depthBand, anchor, bounds, local cca, and childRegion.
- Do not use solidPreset, planePreset, or object for polygonizer subjects unless the user explicitly asks for a preset.
- If the prompt names a count, preserve it in the construction mark. Example: "4 rows" -> partition.count = 4.
- Every partition.target must exactly match the role of an earlier solid mark.
- For angled objects, set scene.perspective.mode = "one-point" and scene.perspective.vanishingPoint.
- For angled/static scenes, include polygonizer.draftingTable and keep its vanishingPoint aligned with scene.perspective.vanishingPoint.
- For vector solids/buildings/cabinets, solve full form but render only view-legible faces when the back/vanishing-facing face reads as construction. Use faceCull:"hide-back" or faceCull:"hide-vanishing-face" on solid marks; do not draw detached screen-space facades to fake height.
- Bind facade detail such as windows to the resolved visible face polygons after cuboid expansion. Do not place windows as raw 2D rects over a 3D solid unless the depiction is explicitly flat graphic design.
- For blueprint output, set polygonizer.outputStyle = "blueprint" and scene.renderMode = "grid-render"; use 1px linework, dimension ticks, labels, and scaled pureMandala coordinates. Keep it blueprint-like rather than fully engineered unless the user asks for engineering detail.
- Use element depth bands to choose z/autoZ consistently with the eye-line: closer elements should paint later unless explicit occlusion says otherwise.
- For bridges/spans, use an array for repeated suspenders/posts and at least two tower structures when identity requires it.
- Tops are closed by default; use openTop:true only for cups/tubes.`;

/**
 * Compose the polygonizer's system prompt from the core body plus optional
 * render-primitive cards. Each card body is appended verbatim under an
 * `## <name>` heading.
 *
 * - cards: array of card objects (each with `id`, `name`, `body`) OR the
 *   literal string `'all'` to load every render-primitive card from disk.
 *   Default: empty (CORE only).
 *
 * The "include all cards" path is the safety net used on first repair when
 * the classifier may have mis-routed.
 */
export function buildPolygonizerSystemPrompt({ cards = [] } = {}) {
  const resolved = cards === 'all' ? getRenderPrimitiveCards('all') : Array.isArray(cards) ? cards : [];
  if (resolved.length === 0) return POLYGONIZER_CORE_PROMPT;
  const sections = resolved
    .map((card) => `\n## ${card.name}\n\n${card.body}`)
    .join('\n');
  return `${POLYGONIZER_CORE_PROMPT}\n\nInjected render-primitive cards:\n${sections}`;
}

// Back-compat: the all-cards composition is what older callers expect. Eager
// concat at module load — the loader caches its catalog, so this is one
// 18-file read on first import.
export const POLYGONIZER_SYSTEM_PROMPT = buildPolygonizerSystemPrompt({ cards: 'all' });

export const POLYGONIZER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'viewBox', 'polygonizer', 'scene', 'marks'],
  properties: {
    title: { type: 'string' },
    viewBox: {
      type: 'object',
      additionalProperties: true,
      required: ['width', 'height'],
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
      },
    },
    depiction: { type: 'object', additionalProperties: true },
    polygonizer: {
      type: 'object',
      additionalProperties: true,
      required: ['subject', 'impactPoint', 'realityFacts', 'minimalAbstractions'],
      properties: {
        subject: { type: 'string' },
        impactPoint: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number' },
        },
        cameraIntent: { type: 'string' },
        realityFacts: {
          type: 'array',
          items: { type: 'string' },
        },
        minimalAbstractions: {
          type: 'array',
          items: { type: 'string' },
        },
        concept: { type: 'object', additionalProperties: true },
        picture: { type: 'object', additionalProperties: true },
        elements: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        blockingReality: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              role: { type: 'string' },
              basis: { type: 'string' },
              footprint: { type: 'string' },
              anchor: {
                type: 'array',
                minItems: 2,
                maxItems: 2,
                items: { type: 'number' },
              },
              depthBand: { type: 'string' },
              contains: { type: 'string' },
              attachesTo: { type: 'string' },
              repeats: { type: 'string' },
              purpose: { type: 'string' },
            },
          },
        },
        draftingTable: { type: 'object', additionalProperties: true },
      },
    },
    scene: { type: 'object', additionalProperties: true },
    marks: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', additionalProperties: true },
    },
  },
};

/**
 * Schema for turn 1 of the plan-then-skin protocol. Same shape as
 * POLYGONIZER_SCHEMA but without `marks` in `required` — turn 1 emits the
 * planning manifest only (polygonizer/scene/depiction/viewBox).
 */
export const POLYGONIZER_PLANNING_SCHEMA = {
  ...POLYGONIZER_SCHEMA,
  required: ['title', 'viewBox', 'polygonizer', 'scene'],
};

export const POLYGONIZER_PLANNING_ADDENDUM = `
PLANNING-ONLY TURN (plan-then-skin protocol):
Return the planning manifest only: title, viewBox, polygonizer, scene, depiction.
Do NOT emit a "marks" array. Marks are authored in turn 2 against a
resolved scaffold. Focus on: polygonizer.subject, impactPoint, realityFacts,
minimalAbstractions, elements, constellation, draftingTable,
metamandala.gravity.bodies (with supportRole), and any
spatialPlanning / rendrantPipeline contract. Authorship-preview checks gate
this turn.

For shot glyphs: when a canonical shot glyph from the seed library fits the
scene (ids include ${shotGlyphIds().join(', ')}), you only need to declare
the reference — polygonizer.shotGlyph: { id: "<glyph-id>" }. The substrate
auto-populates the glyph's implications (topology.cameraVector / lightEntry /
support, hallMandala.axisMundi, mandalaPatternLayer.cameraWindow,
roomConcept) from the library card before authorship-preview runs. Only
author the consequence fields explicitly when you are deriving a non-canonical
shot or overriding a specific axis-mundi screen point.`;

export const POLYGONIZER_SKIN_ADDENDUM = `
SKIN-ONLY TURN (plan-then-skin protocol):
The planning manifest has been resolved into a solved scaffold (constellation
grid, drafting table, mandala patterns, pinned anchors). The scaffold is
provided as known-good context in the user prompt. Author "marks" only,
against the scaffold's anchors. Preserve the top-level shape: title, viewBox,
polygonizer, scene, marks. Do not redo planning.`;

export function buildPolygonizerPlanningSystemPrompt() {
  // Planning turn always sees all cards — the model is choosing which
  // render primitives turn 2 will use, so it needs the full vocab.
  return `${buildPolygonizerSystemPrompt({ cards: 'all' })}${POLYGONIZER_PLANNING_ADDENDUM}`;
}

export function buildPolygonizerSkinSystemPrompt({ cards } = {}) {
  return `${buildPolygonizerSystemPrompt({ cards: cards === undefined ? 'all' : cards })}${POLYGONIZER_SKIN_ADDENDUM}`;
}

/**
 * Compose the polygonizer user-side prompt, optionally prefixed with one or
 * more prior-scene advisory sections.
 *
 * Two preload inputs are accepted (only one should be passed; if both are
 * given, `preloadManifests` wins):
 *   - `preloadManifest`: single manifest object — back-compat path. Rendered
 *     under the original "Prior scene" header so existing single-preload
 *     callers (and their captured prompts) keep working byte-for-byte.
 *   - `preloadManifests`: array of `{ manifest, ref?, title?, as?, note? }`
 *     entries. When the array has more than one item OR any item carries an
 *     `as` label, each entry gets its own labeled section ("Prior {as}",
 *     falling back to "Prior scene"). A single unlabeled entry collapses to
 *     the back-compat single-prior wording so single-prior usage stays
 *     prompt-identical.
 *
 * The model is told these are advisory only — never a binding contract on
 * the new manifest — so a drifted next turn isn't violating anything.
 */
export function buildPolygonizerUserPrompt(prompt, { preloadManifest, preloadManifests } = {}) {
  const entries = normalizePreloadEntries({ preloadManifest, preloadManifests });
  const preloadSection = renderPreloadSection(entries);
  return `${preloadSection}Visual prompt:
${prompt}

Produce a compact Mojulo sketch manifest JSON object. You may reason with a transient recipe, but the returned drawable manifest must use only existing Mojulo mark kinds.`;
}

function normalizePreloadEntries({ preloadManifest, preloadManifests }) {
  if (Array.isArray(preloadManifests) && preloadManifests.length > 0) {
    return preloadManifests
      .filter((e) => e && e.manifest)
      .map((e) => ({
        manifest: e.manifest,
        ref: e.ref ?? null,
        title: e.title ?? null,
        as: e.as && typeof e.as === 'string' && e.as.trim() ? e.as.trim() : null,
        note: e.note ?? null,
      }));
  }
  if (preloadManifest) {
    return [{ manifest: preloadManifest, ref: null, title: null, as: null, note: null }];
  }
  return [];
}

function renderPreloadSection(entries) {
  if (entries.length === 0) return '';

  const isUnlabeledSingle = entries.length === 1 && !entries[0].as;
  if (isUnlabeledSingle) {
    return `Prior scene (advisory context — extend, modify, or ignore as the new prompt requires; this is not a binding contract on the new manifest):
${JSON.stringify(entries[0].manifest, null, 2)}

`;
  }

  const header =
    'Prior context (advisory — extend, modify, or ignore as the new prompt requires; none of these are binding contracts on the new manifest):\n\n';
  const blocks = entries.map((entry) => {
    const role = entry.as ? `Prior ${entry.as}` : 'Prior scene';
    const handle = entry.ref
      ? entry.title
        ? ` — ${entry.ref} (from "${entry.title}")`
        : ` — ${entry.ref}`
      : '';
    const noteLine = entry.note ? `\nAgent note: ${entry.note}` : '';
    return `${role}${handle}:${noteLine}\n${JSON.stringify(entry.manifest, null, 2)}`;
  });
  return `${header}${blocks.join('\n\n')}\n\n`;
}

// Map a construction-mark kind to the render-primitive card whose body
// documents its grammar. Used to inject a "see also" pointer when a mark of
// that kind fails expansion. Kept here (not in the loader) because it's a
// polygonizer-side policy — the loader is just a catalog.
const KIND_TO_CARD_ID = {
  blobPla: 'blob-pla',
  fluidField: 'fluid-field',
  swirlField: 'fluid-field',
  rBrush: 'r-brush',
  sparkField: 'spark-field',
  showerField: 'spark-field',
  wispField: 'wisp-field',
  visionPane: 'vision-pane',
  cubieLattice: 'cubie-lattice',
};

function vocabHintsForFailure({ expansionFailure, errors } = {}) {
  const ids = new Set();
  const failedKind = expansionFailure?.kind;
  if (failedKind && KIND_TO_CARD_ID[failedKind]) {
    ids.add(KIND_TO_CARD_ID[failedKind]);
  }
  const text = (errors || []).join(' ');
  for (const [kind, id] of Object.entries(KIND_TO_CARD_ID)) {
    if (text.includes(kind)) ids.add(id);
  }
  if (ids.size === 0) return [];
  try {
    return getRenderPrimitiveCards([...ids]);
  } catch {
    return [];
  }
}

function partitionTargetErrorPresent(errors) {
  return (errors || []).some((err) =>
    typeof err === 'string' && /partition\s+'.*?'\s+target\s+'.*?'/i.test(err),
  );
}

function collectPriorMarkRoles(manifest) {
  const marks = Array.isArray(manifest?.marks) ? manifest.marks : [];
  const out = [];
  for (const mark of marks) {
    if (!mark || typeof mark.role !== 'string' || !mark.role) continue;
    if (mark.kind === 'partition') continue; // partitions need a *prior* target
    out.push({ role: mark.role, kind: mark.kind || 'unknown' });
  }
  return out;
}

export function buildPolygonizerRepairPrompt({
  prompt,
  errors,
  manifest,
  partial,
  vocabHints,
  partialGrid,
} = {}) {
  const lines = [
    'The polygonizer manifest failed local validation.',
    '',
    'Original visual prompt:',
    prompt || '',
    '',
    'Validation errors:',
    ...((errors || []).map((err) => `- ${err}`)),
  ];

  if (partitionTargetErrorPresent(errors)) {
    const priorRoles = collectPriorMarkRoles(manifest);
    if (priorRoles.length) {
      lines.push(
        '',
        'Available prior-mark roles a partition.target may bind to:',
        ...priorRoles.map(({ role, kind }) => `- ${role} (${kind})`),
      );
    }
  }

  if (partial) {
    lines.push('', 'Partial expansion result:');
    if (Number.isFinite(partial.expandedSoFar)) {
      lines.push(`- expanded ${partial.expandedSoFar} construction mark(s) before failure`);
    }
    if (partial.sourceIndex !== undefined) {
      const kind = partial.kind || 'unknown';
      const role = partial.role || '(anonymous)';
      lines.push(`- failed at marks[${partial.sourceIndex}] (kind=${kind}, role=${role})`);
    }
    if (Array.isArray(partial.availableRoles) && partial.availableRoles.length) {
      lines.push(`- roles available at the moment of failure: ${partial.availableRoles.join(', ')}`);
    }
  }

  if (partialGrid) {
    lines.push(
      '',
      'Resolved constellation grid (the node graph your references must bind to):',
      JSON.stringify(partialGrid, null, 2),
    );
  }

  if (Array.isArray(vocabHints) && vocabHints.length) {
    lines.push('', 'See also — render-primitive grammar for the failing kind(s):');
    for (const card of vocabHints) {
      lines.push('', `## ${card.name}`, '', card.body);
    }
  }

  lines.push(
    '',
    'Previous manifest:',
    JSON.stringify(manifest || {}, null, 2),
    '',
    'Return corrected JSON only. Preserve the same one-trip output shape: polygonizer, scene, marks.',
  );

  return lines.join('\n');
}

export async function polygonizePrompt({
  prompt,
  modelClient,
  provider,
  apiKey,
  model,
  maxRepairs = 0,
  cards,
  mode = 'one-trip',
  preloadManifest,
  preloadManifests,
} = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('polygonizePrompt requires a non-empty prompt string');
  }
  const callModel = modelClient || defaultModelClient({ provider, apiKey, model });
  if (mode === 'plan-then-skin') {
    return polygonizePromptPlanThenSkin({ prompt, callModel, maxRepairs, cards, preloadManifest, preloadManifests });
  }
  // First-trip cards: caller-supplied list, or all cards (current behavior).
  // Repair trips always fall back to all cards — that's the safety net for
  // classifier mis-routes (see Phase 1 plan, risk section).
  const firstSystemPrompt = buildPolygonizerSystemPrompt({
    cards: cards === undefined ? 'all' : cards,
  });
  const repairSystemPrompt = buildPolygonizerSystemPrompt({ cards: 'all' });

  const first = await requestManifest(callModel, buildPolygonizerUserPrompt(prompt, { preloadManifest, preloadManifests }), firstSystemPrompt);
  let lastManifest = applyShotGlyphImplications(first.manifest);
  let validation = validatePolygonizerManifest(lastManifest, prompt);
  const patchesApplied = [];
  ({ manifest: lastManifest, validation } = tryDeterministicRepairs({ manifest: lastManifest, validation, prompt, patchesApplied }));
  if (validation.ok) {
    lastManifest = lowerRecipeManifest(lastManifest);
    return {
      ok: true,
      manifest: lastManifest,
      expandedManifest: validation.expandedManifest,
      attempts: 1,
      patchesApplied,
    };
  }

  for (let attempt = 0; attempt < maxRepairs; attempt++) {
    const repairPrompt = buildRepairPromptFromValidation({ prompt, manifest: lastManifest, validation });
    const repaired = await requestManifest(callModel, repairPrompt, repairSystemPrompt);
    lastManifest = applyShotGlyphImplications(repaired.manifest);
    validation = validatePolygonizerManifest(lastManifest, prompt);
    ({ manifest: lastManifest, validation } = tryDeterministicRepairs({ manifest: lastManifest, validation, prompt, patchesApplied }));
    if (validation.ok) {
      lastManifest = lowerRecipeManifest(lastManifest);
      return {
        ok: true,
        manifest: lastManifest,
        expandedManifest: validation.expandedManifest,
        attempts: attempt + 2,
        patchesApplied,
      };
    }
  }

  return {
    ok: false,
    manifest: lastManifest,
    errors: validation.errors,
    repairPrompt: buildRepairPromptFromValidation({ prompt, manifest: lastManifest, validation }),
    attempts: maxRepairs + 1,
    patchesApplied,
  };
}

/**
 * Apply deterministic (rule-fixable) repair patches and re-validate. When at
 * least one patch fires, returns the patched manifest + the fresh validation
 * result; otherwise returns the inputs unchanged. Pushes the patch names onto
 * `patchesApplied` so the caller can surface which repairs were used.
 */
function tryDeterministicRepairs({ manifest, validation, prompt, patchesApplied }) {
  if (validation.ok) return { manifest, validation };
  const { manifest: patched, applied } = applyDeterministicRepairs(manifest, validation.errors);
  if (applied.length === 0) return { manifest, validation };
  if (patchesApplied) patchesApplied.push(...applied);
  const revalidated = validatePolygonizerManifest(patched, prompt);
  return { manifest: patched, validation: revalidated };
}

/**
 * Plan-then-skin variant: the planning turn's "validation" is the
 * `buildSolvedScaffold` result (errors[] plus `authorshipPreview`). Patches
 * fire against those errors; on success the scaffold is rebuilt.
 */
function tryDeterministicPlanningRepairs({ manifest, scaffoldResult, patchesApplied }) {
  if (scaffoldResult.ok) return { manifest, scaffoldResult };
  const { manifest: patched, applied } = applyDeterministicRepairs(manifest, scaffoldResult.errors);
  if (applied.length === 0) return { manifest, scaffoldResult };
  if (patchesApplied) patchesApplied.push(...applied);
  const rebuilt = buildSolvedScaffold(patched);
  return { manifest: patched, scaffoldResult: rebuilt };
}

/**
 * Two-turn plan-then-skin orchestrator. Turn 1 emits a planning-only
 * manifest; mojulo runs `buildSolvedScaffold` (validators + 5a authorship
 * preview) to produce a known-good scaffold; turn 2 emits marks against the
 * scaffold. Each turn has its own repair loop bounded by maxRepairs.
 */
async function polygonizePromptPlanThenSkin({ prompt, callModel, maxRepairs, cards, preloadManifest, preloadManifests }) {
  const planningSystem = buildPolygonizerPlanningSystemPrompt();
  const skinSystem = buildPolygonizerSkinSystemPrompt({
    cards: cards === undefined ? 'all' : cards,
  });
  const turns = [];
  const patchesApplied = [];

  // Turn 1 — planning
  let planning = await runPlanningTurn(callModel, buildPolygonizerUserPrompt(prompt, { preloadManifest, preloadManifests }), planningSystem);
  planning.manifest = applyShotGlyphImplications(planning.manifest);
  let scaffoldResult = buildSolvedScaffold(planning.manifest);
  ({ manifest: planning.manifest, scaffoldResult } = tryDeterministicPlanningRepairs({
    manifest: planning.manifest,
    scaffoldResult,
    patchesApplied,
  }));
  turns.push({ phase: 'planning-turn', ok: scaffoldResult.ok, errors: scaffoldResult.errors || null });

  for (let attempt = 0; !scaffoldResult.ok && attempt < maxRepairs; attempt++) {
    const planRepairPrompt = buildPlanningRepairPrompt({
      prompt,
      manifest: planning.manifest,
      errors: scaffoldResult.errors,
      authorshipPreview: scaffoldResult.authorshipPreview,
    });
    planning = await runPlanningTurn(callModel, planRepairPrompt, planningSystem);
    planning.manifest = applyShotGlyphImplications(planning.manifest);
    scaffoldResult = buildSolvedScaffold(planning.manifest);
    ({ manifest: planning.manifest, scaffoldResult } = tryDeterministicPlanningRepairs({
      manifest: planning.manifest,
      scaffoldResult,
      patchesApplied,
    }));
    turns.push({ phase: 'planning-repair', ok: scaffoldResult.ok, errors: scaffoldResult.errors || null });
  }

  if (!scaffoldResult.ok) {
    return {
      ok: false,
      phase: 'planning',
      manifest: planning.manifest,
      errors: scaffoldResult.errors,
      authorshipPreview: scaffoldResult.authorshipPreview || null,
      attempts: turns.length,
      turns,
      patchesApplied,
    };
  }

  // Turn 2 — skin (against the same scaffold; never redo planning).
  // preloadManifest is intentionally NOT re-prepended on turn 2 — the scaffold
  // is now the load-bearing prior context, and double-feeding the prior scene
  // alongside the scaffold would dilute the skin instruction.
  let skin = await runSkinTurn(callModel, buildPolygonizerUserPrompt(prompt), skinSystem, scaffoldResult.scaffold);
  skin.manifest = applyShotGlyphImplications(skin.manifest);
  let validation = validatePolygonizerManifest(skin.manifest, prompt);
  ({ manifest: skin.manifest, validation } = tryDeterministicRepairs({
    manifest: skin.manifest,
    validation,
    prompt,
    patchesApplied,
  }));
  turns.push({ phase: 'skin-turn', ok: validation.ok, errors: validation.ok ? null : validation.errors });

  for (let attempt = 0; !validation.ok && attempt < maxRepairs; attempt++) {
    const skinRepairPrompt = buildSkinRepairPrompt({
      prompt,
      manifest: skin.manifest,
      validation,
      scaffold: scaffoldResult.scaffold,
    });
    skin = await runSkinTurn(callModel, skinRepairPrompt, skinSystem, scaffoldResult.scaffold);
    skin.manifest = applyShotGlyphImplications(skin.manifest);
    validation = validatePolygonizerManifest(skin.manifest, prompt);
    ({ manifest: skin.manifest, validation } = tryDeterministicRepairs({
      manifest: skin.manifest,
      validation,
      prompt,
      patchesApplied,
    }));
    turns.push({ phase: 'skin-repair', ok: validation.ok, errors: validation.ok ? null : validation.errors });
  }

  if (validation.ok) {
    return {
      ok: true,
      manifest: lowerRecipeManifest(skin.manifest),
      expandedManifest: validation.expandedManifest,
      authorshipPreview: scaffoldResult.authorshipPreview,
      scaffold: scaffoldResult.scaffold,
      attempts: turns.length,
      turns,
      patchesApplied,
    };
  }

  return {
    ok: false,
    phase: 'skin',
    manifest: skin.manifest,
    errors: validation.errors,
    authorshipPreview: scaffoldResult.authorshipPreview,
    scaffold: scaffoldResult.scaffold,
    attempts: turns.length,
    turns,
    patchesApplied,
  };
}

async function runPlanningTurn(callModel, userPrompt, systemInstruction) {
  const response = await callModel({
    systemInstruction,
    prompt: userPrompt,
    schema: POLYGONIZER_PLANNING_SCHEMA,
  });
  return { manifest: normalizeModelResponse(response) };
}

async function runSkinTurn(callModel, userPrompt, systemInstruction, scaffold) {
  const promptWithScaffold = `${userPrompt}

Solved scaffold (use these resolved anchors as known-good context; do not redo planning):
${JSON.stringify(scaffold, null, 2)}`;
  const response = await callModel({
    systemInstruction,
    prompt: promptWithScaffold,
    schema: POLYGONIZER_SCHEMA,
  });
  return { manifest: normalizeModelResponse(response) };
}

function buildPlanningRepairPrompt({ prompt, manifest, errors, authorshipPreview }) {
  const lines = [
    'Visual prompt:',
    prompt,
    '',
    'Planning turn produced an invalid scaffold. Fix the planning manifest only — do not emit marks.',
    '',
    'Errors:',
    ...(errors || []).map((err) => `- ${err}`),
  ];
  if (authorshipPreview?.checks?.length) {
    const failing = authorshipPreview.checks.filter((check) => check.ok === false);
    if (failing.length) {
      lines.push('', 'Authorship-preview failing checks:');
      for (const check of failing) {
        lines.push(`- ${check.role}: ${check.reason}`);
      }
    }
  }
  lines.push('', 'Previous planning manifest:', JSON.stringify(manifest || {}, null, 2));
  lines.push('', 'Return corrected planning JSON only (no marks field).');
  return lines.join('\n');
}

function buildSkinRepairPrompt({ prompt, manifest, validation, scaffold }) {
  const repair = buildRepairPromptFromValidation({ prompt, manifest, validation });
  return `${repair}

Solved scaffold from turn 1 (do not modify; use as known-good context):
${JSON.stringify(scaffold, null, 2)}`;
}

function buildRepairPromptFromValidation({ prompt, manifest, validation }) {
  const errors = validation?.errors || [];
  const partial = validation?.expansionFailure || null;
  const partialGrid = shouldIncludeConstellation(errors, partial)
    ? validation?.constellation || null
    : null;
  const vocabHints = vocabHintsForFailure({ expansionFailure: partial, errors });
  return buildPolygonizerRepairPrompt({
    prompt,
    errors,
    manifest,
    partial,
    partialGrid,
    vocabHints,
  });
}

function shouldIncludeConstellation(errors, partial) {
  if ((errors || []).some((err) => typeof err === 'string' && err.includes('polygonizer.constellation'))) {
    return true;
  }
  return Boolean(partial);
}

// ── Card classifier ───────────────────────────────────────────────────────
//
// Cheap pre-pass that picks the render-primitive / recipe cards a prompt is
// likely to need, so the main polygonizer system prompt only ships the
// grammar that's actually relevant. Default path: local embedding similarity
// against the cards' `when` clauses (one CPU call, no network — see
// card-router.js). Legacy path: an LLM classifier call, kept reachable for
// (a) tests that mock `classifierClient`, and (b) callers that opt in via
// `router: 'llm'` with `provider`/`apiKey` set.
//
// Cache by sha256(prompt) — identical prompts skip the router entirely.
// Mojulo is single-user/self-hosted, so a process-wide Map is fine; no
// eviction needed at expected volume.

export const POLYGONIZER_CLASSIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['cards'],
  properties: {
    tiers: { type: 'array', items: { type: 'string' } },
    cards: { type: 'array', items: { type: 'string' } },
  },
};

const _classifierCache = new Map();

export function buildPolygonizerClassifierPrompt(catalog) {
  const lines = catalog
    .map((c) => `- ${c.id} (${c.tier}): ${c.when}`)
    .join('\n');
  return `You route polygonizer prompts to render-primitive and recipe cards.

Given a user's visual prompt, return JSON {"tiers": [<tier>, ...], "cards": [<id>, ...]} — the ids of cards whose construction grammar the polygonizer will likely need.

Be inclusive but not exhaustive: when in doubt, include the card. The cost of an extra card is small; the cost of a missing one is a repair trip.

Tiers:
- "render-primitive" — most prompts need at least one.
- "recipe" — only include when the prompt explicitly asks for that recipe family (garment pattern, house/building, comic page / magazine cover, named panel-depiction recipe).

Available cards (id (tier): when-to-pick):
${lines}

Return JSON only. No markdown. No commentary.`;
}

export async function classifyPromptForCards({
  prompt,
  classifierClient,
  provider,
  apiKey,
  model,
  router,
} = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('classifyPromptForCards requires a non-empty prompt string');
  }
  const cacheKey = createHash('sha256').update(prompt).digest('hex');
  if (_classifierCache.has(cacheKey)) {
    return { ..._classifierCache.get(cacheKey), cached: true };
  }

  // Decide path. Default is embedding (local CPU, no network). LLM path
  // activates when (a) a `classifierClient` is explicitly injected — tests
  // and explicit overrides; (b) the caller passes `router: 'llm'` — force
  // even when an embedder is also available.
  const useLlm = !!classifierClient || router === 'llm';

  if (!useLlm) {
    try {
      const routed = await routeCardsByEmbedding({ prompt });
      const result = {
        cards: routed.cards,
        tiers: routed.tiers,
        router: 'embedding',
        scores: routed.scores,
      };
      _classifierCache.set(cacheKey, result);
      return { ...result, cached: false };
    } catch (err) {
      // Embedder failure is non-fatal — fall back to the safety net (all
      // cards) so the manifest call still has full grammar.
      return {
        cards: 'all',
        tiers: [],
        router: 'embedding',
        cached: false,
        classifierError: err.message,
      };
    }
  }

  const catalog = listSketchVocab({ tier: ['render-primitive', 'recipe'] });
  const knownIds = new Set(catalog.map((c) => c.id));
  const systemInstruction = buildPolygonizerClassifierPrompt(catalog);
  const call = classifierClient || defaultClassifierClient({ provider, apiKey, model });

  let raw;
  try {
    const response = await call({
      systemInstruction,
      prompt,
      schema: POLYGONIZER_CLASSIFIER_SCHEMA,
    });
    raw = normalizeModelResponse(response);
  } catch (err) {
    // Classifier failure is non-fatal — fall back to the safety net (all
    // cards) so the manifest call still has full grammar. The error is
    // surfaced so the MCP tool can log it.
    return {
      cards: 'all',
      tiers: [],
      router: 'llm',
      cached: false,
      classifierError: err.message,
    };
  }

  const cards = Array.isArray(raw?.cards)
    ? raw.cards.filter((id) => typeof id === 'string' && knownIds.has(id))
    : [];
  const tiers = Array.isArray(raw?.tiers)
    ? raw.tiers.filter((t) => typeof t === 'string')
    : [];

  const result = { cards, tiers, router: 'llm' };
  _classifierCache.set(cacheKey, result);
  return { ...result, cached: false };
}

function defaultClassifierClient({ provider, apiKey, model } = {}) {
  if (!provider || !apiKey) {
    throw new Error('classifyPromptForCards requires classifierClient or provider/apiKey');
  }
  return async ({ systemInstruction, prompt, schema }) =>
    generateStructured(provider, prompt, apiKey, systemInstruction, schema, model);
}

// Test seam — clears BOTH the prompt-hash cache AND the card-router's
// vector cache, since they're peers in the classifier's lifecycle.
export function _resetClassifierCacheForTests() {
  _classifierCache.clear();
  _resetCardVectorCacheForTests();
}

export function validatePolygonizerManifest(manifest, prompt = '') {
  const errors = [];
  try {
    manifest = lowerRecipeManifest(manifest);
  } catch (err) {
    return { ok: false, errors: [err.message] };
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest must be a JSON object'] };
  }
  if (!manifest.polygonizer || typeof manifest.polygonizer !== 'object' || Array.isArray(manifest.polygonizer)) {
    errors.push('manifest.polygonizer is required');
  }
  if (!Array.isArray(manifest.marks) || manifest.marks.length === 0) {
    errors.push('manifest.marks must be a non-empty array');
  }
  const manifestWithConstellation = withConstellationGrid(manifest);
  const manifestWithCamera = withResolvedWorldCamera(manifestWithConstellation);
  const manifestWithMeru = withGeneratedElementMandala(manifestWithCamera);
  if (Array.isArray(manifestWithMeru.marks)) {
    validateConstructionReferences(manifestWithMeru.marks, errors);
    validatePromptSpecificFacts(manifestWithMeru, prompt, errors);
    validateDraftingTable(manifestWithMeru, errors);
    validateElementCorrespondence(manifestWithMeru, errors);
    validateBlockingReality(manifestWithMeru, errors);
    errors.push(...validateConstellationGrid(manifestWithMeru));
    errors.push(...validateMetamandalaUnitScale(manifestWithMeru));
    errors.push(...validateCameraWorldFraming(manifestWithMeru));
    const overflowReport = validateElementMandalaOverflows(manifestWithMeru);
    errors.push(...overflowReport.errors);
    if (overflowReport.overflows.length && overflowReport.policy === 'attribute') {
      attachMeruOverflows(manifestWithMeru, overflowReport.overflows);
    }
  }

  let expandedManifest = null;
  let expansionFailure = null;
  if (errors.length === 0) {
    try {
      expandedManifest = expandNeoRembrandt(expandGridLayout(manifestWithMeru));
    } catch (err) {
      errors.push(`Sketch expansion error: ${err.message}`);
      if (err.expansionContext) {
        expansionFailure = { message: err.message, ...err.expansionContext };
      }
    }
  }
  if (expandedManifest) {
    const { ok, errors: sketchErrors } = validateSketchManifest(expandedManifest);
    if (!ok) errors.push(...sketchErrors);
  }

  return {
    ok: errors.length === 0,
    errors,
    expandedManifest: errors.length === 0 ? expandedManifest : null,
    expansionFailure,
    constellation: manifestWithMeru?.polygonizer?.constellation || null,
  };
}

function attachMeruOverflows(manifest, overflows) {
  const polygonizer = manifest.polygonizer;
  if (!polygonizer || typeof polygonizer !== 'object') return;
  const elementMandala = polygonizer.elementMandala;
  if (!elementMandala || typeof elementMandala !== 'object' || Array.isArray(elementMandala)) return;
  elementMandala.meruOverflows = overflows;
}

function validateDraftingTable(manifest, errors) {
  const perspective = manifest.scene?.perspective;
  if (!perspective || perspective.mode !== 'one-point') return;
  const polygonizer = manifest.polygonizer || {};
  const draftingTable = polygonizer.draftingTable;
  if (!draftingTable || typeof draftingTable !== 'object' || Array.isArray(draftingTable)) {
    errors.push('perspective polygonizer manifests require polygonizer.draftingTable');
    return;
  }
  const sceneVp = validPoint(perspective.vanishingPoint);
  const tableVp = validPoint(draftingTable.vanishingPoint);
  if (!sceneVp || !tableVp) {
    errors.push('scene.perspective.vanishingPoint and polygonizer.draftingTable.vanishingPoint must be [x,y]');
    return;
  }
  if (Math.hypot(sceneVp[0] - tableVp[0], sceneVp[1] - tableVp[1]) > 0.01) {
    errors.push('polygonizer.draftingTable.vanishingPoint must match scene.perspective.vanishingPoint');
  }
  const bands = draftingTable.depthBands;
  if (bands && typeof bands === 'object' && !Array.isArray(bands)) {
    for (const [name, range] of Object.entries(bands)) {
      if (!Array.isArray(range) || range.length !== 2 || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) {
        errors.push(`polygonizer.draftingTable.depthBands.${name} must be [minY,maxY]`);
      } else if (range[0] > range[1]) {
        errors.push(`polygonizer.draftingTable.depthBands.${name} must be ordered top-to-bottom`);
      }
    }
  }
}

function validateElementCorrespondence(manifest, errors) {
  const elements = manifest.polygonizer?.elements;
  if (!Array.isArray(elements) || elements.length === 0 || !Array.isArray(manifest.marks)) return;
  const markRoles = manifest.marks
    .map((mark) => (typeof mark?.role === 'string' ? mark.role.toLowerCase() : ''))
    .filter(Boolean);
  for (const element of elements) {
    if (!element || typeof element !== 'object') continue;
    if (!/primary|secondary/.test(String(element.importance || ''))) continue;
    const role = String(element.role || '').toLowerCase();
    const terms = role
      .split(/[^a-z0-9]+/)
      .filter((term) => term && !['and', 'or', 'the', 'side', 'mass'].includes(term));
    if (!terms.length) continue;
    const matched = markRoles.some((markRole) => terms.some((term) => markRole.includes(term)));
    if (!matched) {
      errors.push(`polygonizer.elements role '${element.role}' needs corresponding marks`);
    }
  }
}

function validateBlockingReality(manifest, errors) {
  const blocks = manifest.polygonizer?.blockingReality;
  if (!Array.isArray(blocks) || blocks.length === 0 || !Array.isArray(manifest.marks)) return;
  const elements = Array.isArray(manifest.polygonizer?.elements) ? manifest.polygonizer.elements : [];
  const elementText = elements
    .map((element) => [element?.role, element?.footprint, element?.blockingNeeded, element?.insideNeeded].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();
  const markTexts = collectMarkTexts(manifest.marks);
  const repeatedBlocks = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const role = String(block.role || '').trim();
    const basis = String(block.basis || '').trim();
    const purpose = String(block.purpose || '').trim();
    if (!role) {
      errors.push('polygonizer.blockingReality item requires role');
      continue;
    }
    if (!basis) {
      errors.push(`polygonizer.blockingReality role '${role}' requires basis`);
    }
    if (!purpose) {
      errors.push(`polygonizer.blockingReality role '${role}' requires purpose`);
    }
    const terms = roleTerms(role);
    const elementMatched = !elements.length || terms.some((term) => elementText.includes(term));
    if (!elementMatched) {
      errors.push(`polygonizer.blockingReality role '${role}' needs corresponding element context`);
    }
    const markMatched = terms.some((term) => markTexts.some((text) => text.includes(term)));
    const relationMatched = ['attachesTo', 'contains', 'repeats'].some((field) => {
      const relationTerms = roleTerms(block[field]);
      return relationTerms.some((term) => markTexts.some((text) => text.includes(term)));
    });
    if (!markMatched && !relationMatched) {
      errors.push(`polygonizer.blockingReality role '${role}' needs corresponding mark family`);
    }
    if (isRepeatedBlock(block)) repeatedBlocks.push(role);
  }

  const manualDetailCount = blocks.filter((block) => /\b(?:window|post|suspender|book|rail|picket)[-_ ]?\d+\b/i.test(block?.role || '')).length;
  const repeatedMarkCount = manifest.marks.filter((mark) => mark?.kind === 'array' || mark?.kind === 'partition').length;
  if (manualDetailCount >= 4 && repeatedBlocks.length === 0 && repeatedMarkCount === 0) {
    errors.push('polygonizer.blockingReality appears to enumerate repeated details; use array-item/path/partition blocks instead');
  }
}

function collectMarkTexts(marks) {
  const out = [];
  for (const mark of marks) {
    if (!mark || typeof mark !== 'object') continue;
    out.push([mark.role, mark.kind, mark.target, mark.constructionRole].filter(Boolean).join(' ').toLowerCase());
    if (mark.item && typeof mark.item === 'object') {
      out.push([mark.item.role, mark.item.kind].filter(Boolean).join(' ').toLowerCase());
    }
  }
  return out.filter(Boolean);
}

function isRepeatedBlock(block) {
  const basis = String(block?.basis || '').toLowerCase();
  return basis.includes('array') || basis.includes('partition') || Boolean(block?.repeats);
}

function roleTerms(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term && term.length > 2 && !STOP_TERMS.has(term));
}

const STOP_TERMS = new Set([
  'and',
  'the',
  'side',
  'mass',
  'item',
  'block',
  'basis',
  'front',
  'rear',
  'left',
  'right',
  'near',
  'far',
  'mid',
  'main',
  'body',
  'plane',
]);

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? point
    : null;
}

function validateConstructionReferences(marks, errors) {
  const roles = new Set();
  for (const mark of marks) {
    if (mark?.kind === 'partition') {
      if (!mark.target || typeof mark.target !== 'string') {
        errors.push(`partition '${mark.role || '(anonymous)'}' requires target`);
      } else if (!roles.has(mark.target)) {
        errors.push(`partition '${mark.role || '(anonymous)'}' target '${mark.target}' must match an earlier mark role`);
      }
    }
    if (typeof mark?.role === 'string' && mark.role) roles.add(mark.role);
  }
}

function validatePromptSpecificFacts(manifest, prompt, errors) {
  const lower = prompt.toLowerCase();
  if (/bookshelf|bookcase/.test(lower)) {
    if (manifest.marks.some((mark) => ['solidPreset', 'planePreset', 'object'].includes(mark?.kind))) {
      errors.push('bookshelf polygonizer prompt must not use presets/assets');
    }
    const rowCount = extractRowCount(lower);
    if (rowCount !== null) {
      const hasPartition = manifest.marks.some((mark) => mark?.kind === 'partition' && mark.count === rowCount);
      if (!hasPartition) {
        errors.push(`bookshelf prompt asks for ${rowCount} rows; expected partition.count = ${rowCount}`);
      }
    }
  }
  if (/golden gate|bridge/.test(lower)) {
    const facts = (manifest.polygonizer?.realityFacts || []).join(' ').toLowerCase();
    if (!/two|2/.test(facts) || !/tower/.test(facts)) {
      errors.push('bridge polygonizer facts must mention two towers');
    }
    const suspenderArray = manifest.marks.find((mark) => mark?.kind === 'array' && /suspender|post|cable/i.test(mark.role || ''));
    if (!suspenderArray || Number(suspenderArray.count) < 8) {
      errors.push('bridge prompt needs an array of at least 8 suspenders/posts');
    }
  }
}

function extractRowCount(prompt) {
  const digit = prompt.match(/\b(\d+)\s+(?:shelf\s+)?rows?\b/);
  if (digit) return Number(digit[1]);
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  const word = prompt.match(/\b(one|two|three|four|five|six|seven|eight)\s+(?:shelf\s+)?rows?\b/);
  return word ? words[word[1]] : null;
}

async function requestManifest(callModel, userPrompt, systemInstruction = POLYGONIZER_SYSTEM_PROMPT) {
  const response = await callModel({
    systemInstruction,
    prompt: userPrompt,
    schema: POLYGONIZER_SCHEMA,
  });
  return { manifest: normalizeModelResponse(response) };
}

function defaultModelClient({ provider, apiKey, model } = {}) {
  if (!provider || !apiKey) {
    throw new Error('polygonizePrompt requires modelClient or provider/apiKey');
  }
  return async ({ systemInstruction, prompt, schema }) =>
    generateStructured(provider, prompt, apiKey, systemInstruction, schema, model);
}

export async function resolvePolygonizerModelConfig({ provider, apiKey, apiKeyId, model } = {}) {
  let selectedProvider = provider;
  let selectedApiKey = apiKey;
  let selectedModel = model;

  if (apiKeyId) {
    const record = await ApiKeyRepository.findById(apiKeyId);
    if (!record) throw new Error(`Saved API key ${apiKeyId} not found`);
    if (selectedProvider && record.provider !== selectedProvider) {
      throw new Error(`Saved API key provider "${record.provider}" does not match selected provider "${selectedProvider}"`);
    }
    selectedProvider = record.provider;
    selectedApiKey = decryptApiKey(record.encryptedKey);
  }

  if (!selectedProvider) {
    const keys = await ApiKeyRepository.findByUserId('local');
    const defaultKey = keys.find((key) => key.isDefault && LLM_PROVIDERS[key.provider]) ||
      keys.find((key) => LLM_PROVIDERS[key.provider]);
    if (defaultKey) {
      selectedProvider = defaultKey.provider;
      selectedApiKey = decryptApiKey(defaultKey.encryptedKey);
    }
  }

  if (!selectedProvider) selectedProvider = 'ollama';
  if (!LLM_PROVIDERS[selectedProvider]) {
    throw new Error(`Unsupported provider: ${selectedProvider}`);
  }
  if (selectedProvider !== 'ollama' && (!selectedApiKey || typeof selectedApiKey !== 'string')) {
    throw new Error('API key is required. Provide apiKey/apiKeyId or configure a saved default provider key.');
  }
  if (!selectedModel) {
    selectedModel = getDefaultModelForTask(selectedProvider, 'structured');
  }

  return {
    provider: selectedProvider,
    apiKey: selectedApiKey || '',
    model: selectedModel,
  };
}

export function normalizeModelResponse(response) {
  if (response && typeof response === 'object' && !Array.isArray(response)) return response;
  if (typeof response !== 'string') {
    throw new Error('polygonizer model response must be an object or JSON string');
  }
  const trimmed = response.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : extractJsonObject(trimmed);
  return JSON.parse(candidate);
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('polygonizer model response did not contain a JSON object');
  }
  return text.slice(start, end + 1);
}
