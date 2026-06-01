import { expandNeoRembrandt } from '@/lib/graph/neo-rembrandt/index.js';
import { expandGridLayout, validateSketchManifest } from '@/lib/graph/sketch-manifest.js';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys.js';
import { decryptApiKey } from '@/lib/deployment-auth.js';
import { generateStructured, getDefaultModelForTask, LLM_PROVIDERS } from '@/lib/llm-providers.js';
import { validateConstellationGrid, withConstellationGrid } from './constellation.js';
import { lowerRecipeManifest, recipeFamilyAllowlist } from './recipe-compiler.js';

export { buildConstellationGrid, validateConstellationGrid, withConstellationGrid } from './constellation.js';
export { applyDepictionOverlay, lowerDepictionLayout, normalizeDepiction, PANEL_DEPICTION_RECIPES } from './depiction-layout.js';
export { compileSketchRecipe, lowerRecipeManifest, recipeFamilyAllowlist } from './recipe-compiler.js';

export const POLYGONIZER_SYSTEM_PROMPT = `You are Mojulo's polygonizer.

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
- polygonizer.elementMandala: generated local top-down math spaces for elements. Each generated element gets its own mandala bound to its constellation node, then projects into the overall scene/panel space.
- polygonizer.outputStyle: optional named visual style. Use "blueprint" for CAD-like sketch sheets with 1px grid/dimension linework, borderless mass tones, annotations, and scaled mandala/vector coordinates.
- recipe: optional transient authoring shorthand. Recipe families are ${recipeFamilyAllowlist().join(', ')}. Recipes are not renderer marks; if you use one, lower it into polygonizer metadata and renderer vocabulary before storage.
- scene: one depictable aspect inside the broader depiction context: camera, perspective, view, light, palette.
- cameraPrimitive: optional deterministic camera grammar. Use cameraPrimitive.kind = "two-point" with polygonizer.pureMandala for adult-eye room shots with paired floor/ceiling perspective.
- gesture: optional top-level field. For figures, gesture may include a main body line, a crossGesture for the active arm/action line, and dynamicSkeleton metadata that names head/torso/pelvis plus shoulder/elbow/hand joints. Dynamic skeleton is compiled from gestures + joints into normal blob/sphere marks; do not emit a skeleton renderer mark.
- marks: compact construction marks and primitives.

Renderer vocabulary:
- form{mode:"abstract"|"animated"|"realistic"|"dummy",stock:"bipedal"|"plane-object"|"lower-body-dummy"|"full-body-dummy",role?,anchor:[x,y],scale?,massTuning?,speciesStock?,gesture?}
- solid{x,y,width,height,depth,depthOffset?,faces?,role?,fill?,stroke?,z?}
- volume{primitive:"cup",role?,anchor:[x,y],height,rimWidth,footWidth,wallThickness?,rings?,openTop?,fill?,stroke?,z?}
- partition{target:"role-of-prior-solid",axis:"y",count,role?,thickness?}
- array{role,count,from:[x,y],to:[x,y],upperFrom?,upperTo?,scaleFrom?,scaleTo?,item:{kind:"line"|"solid",...}}
- mandalaField{role,screenOrigin?,unitScale?,depthScale?,debugInset?,paths:[{role?,basis:"ray"|"arc"|"spiral"|"lattice",samples?,spread?,scaleFrom?,scaleTo?,heightRange?,widthRange?,depthRange?,pinTo?{kind:"constellation-node",roles?,rolePrefix?,fit?},spawn:{kind:"solid"|"blob"|"sphere"|"oval"|"line",...}}]}
- line{x1,y1,x2,y2}, polyline{points:[[x,y],...]}, polygon{points:[[x,y],...]}
- plane, sphere, oval, egg, cylinder, blob, text

Rules:
- Emit JSON only. No markdown.
- Never emit recipe family names as marks[].kind. Recipes are authoring shorthand only.
- Treat scene as one possible depictable panel concern, not the whole layout paradigm. For multi-panel pictures, use top-level depiction.display/panels to decide how many containers fit in the total picture, then lower visible panel structure to existing grid/rect/line/text marks.
- The most basic depiction display is a full equal grid with 1px panel borders. More advanced displays are panel-blocking paradigms: unequal comic-page layouts, inset/callout panels, strips, before/after pairs, or unrelated panels. Use eye-line as the key layout rule.
- Named panel-depiction recipes for graphic design/layout mode: sunday-comic, manga-high-eye-control, american-comic-widescreen-panels, natgeo, monoculous, cover-mode, time-magazine-cover. Use them as depiction.panelRecipe/display.kind only; never as marks[].kind.
- Garment/textile recipes: use recipe.kind = "garmentPattern" with style/patternKind "blueprint", "tartan", "houndstooth", "victorian wallpaper", or "mandala fabric". These lower to ordinary marks. For textile patterns, make composition, repeat spacing, alignment, and edge-to-edge cadence explicit in polygonizer metadata; never emit tartan/houndstooth/wallpaper as mark kinds.
- Architectural construction recipes: use recipe.kind = "architecturalConstruction" when the prompt is a fast house/building request. The compiler must first create polygonizer.pureMandala.kind = "zero-vector-element-map": a 0px normalized slot map for body, roof, entry, porch, steps/stairs, chimney, and facade rhythms. Element libraries bind into those constellation slots only after overlap is resolved in mandala space. Prefer this over hand-enumerating building parts.
- Panels may be transparent movable layout containers. Use panel.transparent/frameVisible:false or display.transparentPanels plus explicit panel bounds/x/y/w/h when a panel should behave like a draggable PowerPoint-style element. It still lowers to a transparent rect, not a new mark kind.
- Cover recipes can be transparent overlays over a normal scene sketch. Use display.overlay:true when the scene/background should remain ordinary marks and the cover lowers only its transparent panel zones, frame, masthead, issue label, cover lines, and lettering above it.
- Use depiction.lettering.carriers for speech bubbles, thought bubbles, shout balloons, and narration blocks. Lettering carriers sit above panel/world/constellation reasoning; visible carriers lower to ordinary rect/polygon/circle/text marks. Speech tails point toward a figure head anchor when known. Narration blocks do not need tails.
- Use depiction.lettering.carriers kind "handwrittenBubbleLetters" for graphic-design lettering. This is glyph construction, not font text: letters lower to polygon-locked glyph bodies using a deterministic angle/curvature profile. Optional 3D/extrude effects lower to additional offset polygons. Do not emit marks kind "bubbleLetters", "handwrittenBubbleLetters", or "glyph".
- Constellation grids apply per panel only when that panel needs local CCA/world reasoning; unrelated panels may each own their own world.
- Prefer one primitive plus one repeat rule over many manual fragments.
- For figure-like single forms, prefer a form mark with a broad stock/tuning over manual body-part inventories.
- Forms are constellation-authored by default. If no world constellation is supplied, treat the form as authored in a flat eye-level CCA constellation; "2D" means flat constellation physics, not no constellation.
- Mandala math space moves up to generated elements: each element can own a local top-down mapping, using the same mandala principle while remaining bound to its position in the overall constellation/depiction space.
- Use mandalaField when a reality-agnostic path/lattice/spiral should spawn many ordinary marks from the pure mandala map. It is construction sugar only; it lowers to solid/blob/line marks before final rendering.
- When mandala samples need to become real scene units, use path.pinTo with constellation node roles or rolePrefix. The mandala remains separate contemplation space; pinTo attaches interpreted samples to resolved constellation/grid units.
- For geometry debugging, set mandalaField.debugInset to render the 0-elevation vector mandala map in the upper-left corner. Use polygonizer.contactChecks to validate base/top/span hit-region relationships after polygon expansion.
- Use polygonizer.metamandala for local support floors/rays derived from explicit axes or solved contact regions. A metamandala surface is an L-basis planning/debug layer, not a final primitive; debug laser marks may render with metamandalaDebug:true.
- For post-solve placement, use polygonizer.metamandala.relaxation.enabled with rules that move a target role family onto a resolved surfaceRole. Use surface.face:"top" when the support should mean the top plane of a solid rather than every contact edge in the support volume.
- Constellation nodes may declare hitboxes for math-space support/collision truth. Metamandala surfaces can use kind:"fromHitbox" with nodeRole/hitboxRole, then relaxation can align:"center" to move dependent marks onto the hitbox center independently of the visual polygon skin.
- For training-data pose consistency, use form{mode:"dummy",stock:"lower-body-dummy"} when the pelvis/legs/feet are the main concern. It lowers into pelvis CCA/blob, hip/knee/ankle joint spheres, and limb blobs that terminate into those joints.
- Use form{mode:"dummy",stock:"full-body-dummy"} for complete mannequin training poses. It lowers into head, torso, pelvis, shoulder/elbow/wrist/hip/knee/ankle joints, and joint-mediated arm/leg blobs. It may include a per-mark gesture body line plus optional arm gesture paths; do not emit a formDummy renderer mark.
- For gesture-driven figures, use the main gesture to stand/carry head, torso center, and pelvis. Use crossGesture for the active arm/action line. Use dynamicSkeleton anchors to name joints and connection spans so deterministic z stacking and joint mediation can be applied before blob expansion.
- Use polygonizer.realityFacts to state what must be visible for identity.
- Use polygonizer.minimalAbstractions to explain the compact construction grammar.
- Use polygonizer.blockingReality to separate each major element into fundamental shape blocks before marks. Example: house = body CCA + roof panel CCAs + window/door CCA rhythm.
- Keep blockingReality compact: use array-item/path/field blocks for repeated or broad structure instead of enumerating every visible detail.
- For hollow tapered rotational objects such as cups, prefer volume{primitive:"cup"} over a generic cylinder so the renderer can create a ring stack with rim, inner wall, taper, and foot.
- If you include polygonizer.constellation, it must be a non-rendered CCA grid with one node per element: renderOrder, parent, depthBand, anchor, bounds, local cca, and childRegion.
- Do not use solidPreset, planePreset, or object for polygonizer subjects unless the user explicitly asks for a preset.
- If the prompt names a count, preserve it in the construction mark. Example: "4 rows" -> partition.count = 4.
- Every partition.target must exactly match the role of an earlier solid mark.
- For angled objects, set scene.perspective.mode = "one-point" and scene.perspective.vanishingPoint.
- For room interiors that need floor and ceiling grids, set cameraPrimitive.kind = "two-point", provide vanishingPoints.left/right, and provide polygonizer.pureMandala.room plus pinnedElements.
- For angled/static scenes, include polygonizer.draftingTable and keep its vanishingPoint aligned with scene.perspective.vanishingPoint.
- For vector solids/buildings/cabinets, solve full form but render only view-legible faces when the back/vanishing-facing face reads as construction. Use faceCull:"hide-back" or faceCull:"hide-vanishing-face" on solid marks; do not draw detached screen-space facades to fake height.
- Bind facade detail such as windows to the resolved visible face polygons after cuboid expansion. Do not place windows as raw 2D rects over a 3D solid unless the depiction is explicitly flat graphic design.
- For blueprint output, set polygonizer.outputStyle = "blueprint" and scene.renderMode = "grid-render"; use 1px linework, dimension ticks, labels, and scaled pureMandala coordinates. Keep it blueprint-like rather than fully engineered unless the user asks for engineering detail.
- Use element depth bands to choose z/autoZ consistently with the eye-line: closer elements should paint later unless explicit occlusion says otherwise.
- For bridges/spans, use an array for repeated suspenders/posts and at least two tower structures when identity requires it.
- Tops are closed by default; use openTop:true only for cups/tubes.`;

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

export function buildPolygonizerUserPrompt(prompt) {
  return `Visual prompt:
${prompt}

Produce a compact Mojulo sketch manifest JSON object. You may reason with a transient recipe, but the returned drawable manifest must use only existing Mojulo mark kinds.`;
}

export function buildPolygonizerRepairPrompt({ prompt, errors, manifest } = {}) {
  return `The polygonizer manifest failed local validation.

Original visual prompt:
${prompt || ''}

Validation errors:
${(errors || []).map((err) => `- ${err}`).join('\n')}

Previous manifest:
${JSON.stringify(manifest || {}, null, 2)}

Return corrected JSON only. Preserve the same one-trip output shape: polygonizer, scene, marks.`;
}

export async function polygonizePrompt({
  prompt,
  modelClient,
  provider,
  apiKey,
  model,
  maxRepairs = 0,
} = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('polygonizePrompt requires a non-empty prompt string');
  }
  const callModel = modelClient || defaultModelClient({ provider, apiKey, model });
  const first = await requestManifest(callModel, buildPolygonizerUserPrompt(prompt));
  let lastManifest = first.manifest;
  let validation = validatePolygonizerManifest(lastManifest, prompt);
  if (validation.ok) {
    lastManifest = lowerRecipeManifest(lastManifest);
    return {
      ok: true,
      manifest: lastManifest,
      expandedManifest: validation.expandedManifest,
      attempts: 1,
    };
  }

  for (let attempt = 0; attempt < maxRepairs; attempt++) {
    const repairPrompt = buildPolygonizerRepairPrompt({
      prompt,
      errors: validation.errors,
      manifest: lastManifest,
    });
    const repaired = await requestManifest(callModel, repairPrompt);
    lastManifest = repaired.manifest;
    validation = validatePolygonizerManifest(lastManifest, prompt);
    if (validation.ok) {
      lastManifest = lowerRecipeManifest(lastManifest);
      return {
        ok: true,
        manifest: lastManifest,
        expandedManifest: validation.expandedManifest,
        attempts: attempt + 2,
      };
    }
  }

  return {
    ok: false,
    manifest: lastManifest,
    errors: validation.errors,
    repairPrompt: buildPolygonizerRepairPrompt({
      prompt,
      errors: validation.errors,
      manifest: lastManifest,
    }),
    attempts: maxRepairs + 1,
  };
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
  if (Array.isArray(manifestWithConstellation.marks)) {
    validateConstructionReferences(manifestWithConstellation.marks, errors);
    validatePromptSpecificFacts(manifestWithConstellation, prompt, errors);
    validateDraftingTable(manifestWithConstellation, errors);
    validateElementCorrespondence(manifestWithConstellation, errors);
    validateBlockingReality(manifestWithConstellation, errors);
    errors.push(...validateConstellationGrid(manifestWithConstellation));
  }

  let expandedManifest = null;
  if (errors.length === 0) {
    try {
      expandedManifest = expandNeoRembrandt(expandGridLayout(manifestWithConstellation));
    } catch (err) {
      errors.push(`Sketch expansion error: ${err.message}`);
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
  };
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

async function requestManifest(callModel, userPrompt) {
  const response = await callModel({
    systemInstruction: POLYGONIZER_SYSTEM_PROMPT,
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
