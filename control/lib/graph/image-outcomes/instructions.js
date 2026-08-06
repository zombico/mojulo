/**
 * Render instructions — the prose half of the handoff packet, built from
 * the manifest for a foreign render worker reading it cold.
 *
 * Invariant (tested): bubble `lettering` NEVER appears here. The generated
 * layer is art only — no panel borders, no bubbles, no readable text; the
 * composite pass owns all of those (image-outcomes.plan.md doctrine).
 *
 * `buildRenderInstructions(manifest, { panelId })` scopes a sequential-art
 * brief to one panel — the per-panel render strategy's pull payload.
 */

import {
  KIND_IMAGE_OUTCOME,
  KIND_SEQUENTIAL_ART,
  KIND_CHARACTER_SHEET,
  KIND_KEYFRAME_ANIMATION,
  KIND_SCENE_MOTION,
  KIND_SPRITE_SHEET,
  normalizeImageOutcomesManifest,
  parseKeyframeTarget,
  parseSceneTarget,
  parseSpriteTarget,
} from './manifest.js';
import { subCelPhrase } from './pan-cel-spike/sub-cels.js';
import { cameraPhrase } from './cameras.js';
import { posePhrase } from './poses.js';
import { resolveStyle, STYLE_VOCAB } from './styles.js';
import { pageRecipeEntry } from './page-recipes.js';

// Build the "## Style Lock" block for a resolved renderBrief. Prefers the
// carried `lock` lines (present for presets, forks, and fully custom styles);
// falls back to re-resolving a preset for older stored manifests that predate
// carried locks. Returns [] when there is no discipline to state (freeform).
function styleLockLines(renderBrief, header = '## Style Lock') {
  let lock = Array.isArray(renderBrief?.lock) ? renderBrief.lock : null;
  if ((!lock || !lock.length) && renderBrief?.preset) {
    lock = resolveStyle(renderBrief.preset, renderBrief.dials).lock;
  }
  if (!lock || !lock.length) return [];
  const name = renderBrief.preset ? STYLE_VOCAB[renderBrief.preset]?.name : null;
  const source = renderBrief.preset
    ? `- preset: ${renderBrief.preset}${name ? ` (${name})` : ''}`
    : `- style source: ${renderBrief.styleId || (renderBrief.id ? `custom:${renderBrief.id}` : 'custom')}`;
  return [header, source, ...lock.map((line) => `- ${line}`), ''];
}

function briefSections(renderBrief) {
  // A style renders as a Style Lock — the drawing discipline the model must
  // hold. Prefer the carried `lock` (works for presets, forks, and fully
  // custom styles); fall back to re-resolving a preset for older stored
  // manifests that predate carried locks.
  const styleLock = styleLockLines(renderBrief);
  return [
    '## Must Preserve',
    ...renderBrief.mustPreserve.map((item) => `- ${item}`),
    '',
    ...styleLock,
    '## Style Direction',
    `- style: ${renderBrief.style}`,
    `- mood: ${renderBrief.mood}`,
    `- lighting: ${renderBrief.lighting}`,
    '',
    '## May Invent',
    ...renderBrief.mayInvent.map((item) => `- ${item}`),
    '',
    '## Avoid',
    ...renderBrief.negative.map((item) => `- ${item}`),
  ];
}

// The spike's second failure mode (after geometry drift): a worker returning
// the scaffold itself — wireframe polygons, stick figures, labels — as the
// finished artifact. This block makes the generation step explicit and bans
// the scaffold's graphic language from the output. It renders into EVERY
// brief, ahead of the shot-specific sections, so a cold agent cannot miss it.
const WORKER_PIPELINE = [
  'YOUR TASK — you are the image-generation worker:',
  '1. Load the scaffold image (the wireframe/blockout diagram).',
  '2. INVOKE YOUR IMAGE-GENERATION CAPABILITY with the scaffold as the composition reference and this brief as the prompt.',
  '3. Return the newly GENERATED, fully painted raster image.',
  '',
  'The scaffold is INPUT, never the deliverable. It is a control diagram — flat colored polygons, stick figures, dashed zone boxes, text labels. None of that graphic language may appear in your output. If your result looks like the scaffold (wireframe lines, flat unshaded shapes, visible labels or stick figures), you have traced instead of generated — discard it and generate again.',
];

function imageOutcomeInstructions(manifest) {
  const strict = manifest.forms.filter((f) => f.preserve === 'strict');
  const guided = manifest.forms.filter((f) => f.preserve === 'guided');
  const loose = manifest.forms.filter((f) => f.preserve === 'loose');
  return [
    `# ${manifest.title}`,
    '',
    manifest.intent,
    '',
    ...WORKER_PIPELINE,
    '',
    'Use the scaffold image as the composition source of truth. Render a finished raster image, but preserve the shot geometry.',
    '',
    `Camera: ${manifest.camera.kind} — ${cameraPhrase(manifest.camera.kind)}.`,
    ...characterLines(manifest.characters, 'shot'),
    ...(manifest.figures.length
      ? ['', '## Figures', ...manifest.figures.map((f) => `- ${figurePhrase(f)}`)]
      : []),
    '',
    '## Preservation Levels',
    `- strict: ${strict.map((f) => `${f.id} (${f.role})`).join(', ') || 'none'}`,
    `- guided: ${guided.map((f) => `${f.id} (${f.role})`).join(', ') || 'none'}`,
    `- loose: ${loose.map((f) => `${f.id} (${f.role})`).join(', ') || 'none'}`,
    '',
    ...briefSections(manifest.renderBrief),
  ].join('\n');
}

function figurePhrase(f) {
  // Identity binding renders ahead of the pose: the reference sheet, not
  // the panel prompt, owns what this person looks like.
  const identity = f.character
    ? ` [character ${f.character}${f.outfit ? `, outfit ${f.outfit}` : ''} — match the reference sheet exactly]`
    : '';
  // A rig figure's silhouette IS the pose spec — the scaffold shows the
  // exact articulated body, so the instruction defers to it.
  if (f.rig) {
    if (f.rig.note) return `${f.id}${identity} — ${f.rig.note}`;
    if (typeof f.rig.motion === 'string') {
      return `${f.id}${identity} — mid-'${f.rig.motion}' at phase ${f.rig.phase ?? 0}; match the scaffold silhouette exactly`;
    }
    return `${f.id}${identity} — precisely rigged pose; match the scaffold silhouette exactly`;
  }
  return `${f.id}${identity} — ${posePhrase(f.pose)}`;
}

function characterLines(characters, scope = 'panel') {
  if (!characters?.length) return [];
  return [
    '',
    `## Characters (identity metadata — generate their reference sheets FIRST, then condition every ${scope} on them)`,
    ...characters.map((c) => {
      const outfits = c.outfits.length
        ? ` Outfits: ${c.outfits.map((o) => o.id).join(', ')}.`
        : '';
      return `- ${c.id}${c.name ? ` (${c.name})` : ''}: ${c.description}${outfits}`;
    }),
  ];
}

function panelLine(panel) {
  const figures = panel.figures.map(figurePhrase).join('; ') || 'none';
  return `- ${panel.id}: ${panel.beat} Camera: ${panel.camera.kind} (${cameraPhrase(panel.camera.kind)}). Figures: ${figures}.`;
}

const ART_LAYER_ONLY = [
  'Paint the ART LAYER ONLY:',
  '- no panel borders or gutters (the page compositor draws them)',
  '- no speech bubbles or captions (bubble reserves stay blank paint-under space)',
  '- no readable text anywhere',
];

function sequentialArtInstructions(manifest, { panelId } = {}) {
  const panels = panelId
    ? manifest.panels.filter((p) => p.id === panelId)
    : manifest.panels;
  if (panelId && panels.length === 0) throw new Error(`unknown panel id: ${panelId}`);
  // A recognized page recipe carries its eye-line — the reading-path
  // direction the paradigm exists to control (ported from the vexar
  // pipeline's panel-blocking vocabulary).
  const recipe = pageRecipeEntry(manifest.pageRecipe);
  const recipeNote = `Page recipe: ${manifest.pageRecipe}${recipe ? ` — eye-line: ${recipe.eyeLine}` : ''}`;
  // Panel briefs carry the page's reading flow and eye-line too: the
  // per-panel strategy is the default pull, and a panel's internal
  // composition should lean WITH the page's reading direction.
  const scopeNote = panelId
    ? `This brief is scoped to panel ${panelId} (render strategy: ${manifest.renderStrategy}). Render this single shot; the page scaffold shows where it sits in the layout. Reading flow: ${manifest.readingFlow} — compose the shot to lean with it. ${recipeNote}.`
    : `Render strategy: ${manifest.renderStrategy}. Reading flow: ${manifest.readingFlow}. ${recipeNote}.`;
  return [
    `# ${manifest.title}${panelId ? ` — panel ${panelId}` : ''}`,
    '',
    manifest.intent,
    '',
    scopeNote,
    '',
    ...WORKER_PIPELINE,
    '',
    'Use the scaffold as the source of truth for staging, camera, and pose.',
    ...ART_LAYER_ONLY,
    ...characterLines(manifest.characters),
    '',
    '## Panels',
    ...panels.map(panelLine),
    '',
    ...briefSections(manifest.renderBrief),
  ].join('\n');
}

export function buildRenderInstructions(manifest, options = {}) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  if (normalized.kind === KIND_IMAGE_OUTCOME) return imageOutcomeInstructions(normalized);
  if (normalized.kind === KIND_SEQUENTIAL_ART) return sequentialArtInstructions(normalized, options);
  if (normalized.kind === KIND_CHARACTER_SHEET) {
    return buildCharacterSheetInstructions(normalized, normalized.character.id);
  }
  if (normalized.kind === KIND_KEYFRAME_ANIMATION) return keyframeInstructions(normalized, options);
  if (normalized.kind === KIND_SCENE_MOTION) return sceneStageInstructions(normalized, options);
  if (normalized.kind === KIND_SPRITE_SHEET) return spriteSheetInstructions(normalized, options);
  throw new Error(`unknown image-outcomes kind: ${normalized.kind}`);
}

/**
 * The per-frame handoff for a sprite-sheet target. The worker paints ONE game
 * sprite — the character in the frame's action/direction pose — over the single
 * cell scaffold, on a fully TRANSPARENT background so the bake step can quantize
 * it cleanly. Identity across frames is held by the character sheet conditioning
 * (same rules as keyframe-animation); this brief scopes the one pose.
 */
export function spriteSheetInstructions(manifest, options = {}) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  const targets = normalized.frames.map((f) => `frame-${f.id}`);
  const target = options.target ?? targets[0];
  const { frame } = parseSpriteTarget(normalized, target);
  const ch = normalized.characters[0];
  const styleBlock = normalized.renderBrief
    ? briefSections(normalized.renderBrief)
    : [
        '## Style',
        '- clean 2D game sprite, flat colors, crisp readable silhouette, on-model with every other frame',
      ];
  return [
    `# Sprite frame — ${normalized.title} · ${frame.action}${frame.direction ? ` (${frame.direction})` : ''}${frame.base ? ' · BASE' : ''}`,
    '',
    ...WORKER_PIPELINE,
    '',
    ...(ch
      ? [
          `## Character (identity — hold across ALL frames)`,
          `- ${ch.name ? `${ch.name}: ` : ''}${ch.description}`,
          ...(frame.base
            ? ['- This is the BASE frame — the canonical pose every other frame is measured against. Render the clearest, most neutral read of the character.']
            : ['- Match the base frame\'s exact design, palette, scale, and framing — ONLY the pose changes for this action.']),
          '',
        ]
      : []),
    '## The contract',
    `- Paint ONE sprite performing "${frame.action}"${frame.direction ? ` facing ${frame.direction}` : ''}, centered in the cell, feet on the baseline.`,
    `- Output EXACTLY ${normalized.cell.width}×${normalized.cell.height}px, on a FULLY TRANSPARENT background — no ground, no shadow, no scenery, no gutter fill.`,
    '- Keep the character the SAME size and vertical registration as every other frame (a walk cycle must not bob in scale).',
    '- No outline halo or anti-aliased fringe bleeding past the silhouette — the bake quantizes hard edges.',
    '',
    ...styleBlock,
  ].join('\n');
}

/**
 * The plate handoff for a scene-motion target — the JOB-STAGE contract
 * (scene-promotion.plan.md SP2). The worker paints a BACKGROUND over the stage
 * guide (scaffold.pngUrl): a ground plane whose recession agrees with the magenta
 * tick figures, all guide marks removed, exact dimensions. Cast clips composite
 * later by the declared plane — no per-placement calibration.
 */
export function sceneStageInstructions(manifest, options = {}) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  const parsed = parseSceneTarget(normalized, options.target ?? 'plate');
  // A cross-cut shot's plate target paints against that shot's OWN stage.
  const s = parsed.stage || normalized.stage;
  const w = parsed.band ? '(band)' : s.plate.width;
  const h = parsed.band ? '(band)' : s.plate.height;
  // The plate's drawing discipline. When the scene carries a renderBrief (an
  // explicit scene style, or the style inherited from the cast at mint), the
  // background is painted in exactly that style — this is the shared source
  // that makes "background watercolor = character watercolor" hold, with no
  // post-hoc check. Absent → left to the worker's default (back-compat).
  const styleBlock = normalized.renderBrief
    ? [...styleLockLines(normalized.renderBrief, '## Style — paint the background in THIS discipline (the same style as the cast)'), '']
    : [];
  return [
    `# Scene plate — ${normalized.title}${parsed.band ? ` · band ${parsed.band.ref}` : parsed.shotIndex != null ? ` · shot ${parsed.shotIndex}'s stage` : ''}`,
    '',
    'You are the image worker. `scaffold.pngUrl` is the STAGE GUIDE: it DECLARES a',
    'ground plane in MAGENTA (#ff2bd6) — a horizon line, a reference sole line, and',
    'schematic figures at several depths showing exactly how tall a person stands and',
    'where their feet land at each depth.',
    '',
    ...styleBlock,
    '## The contract',
    `- Produce ONE finished painted BACKGROUND (no characters), EXACTLY ${w}×${h}, as a`,
    '  full-frame EDIT of the guide.',
    `- The horizon sits at y=${s.horizonY}: ground below, sky/backdrop above. The ground`,
    '  recedes so a person standing at each magenta figure would have their feet ON the',
    '  painted ground at that height (near = low + large, far = high + small).',
    '- REMOVE every magenta mark, line, label, and figure — none may survive (the plate',
    '  audit rejects any magenta leak). Paint ground/scenery where they were.',
    '- The plate extends wider than the on-screen frame for camera pan headroom — paint',
    '  the full width.',
    '',
    '## The two gates',
    '1. MACHINE (runs on submit): exact dimensions, no magenta leak, sky≠ground.',
    '2. EYES (the accepting agent, over the stage overlay): the declared tick figures must',
    '   look like they STAND on your painted ground at the right heights. If a figure floats',
    '   in sky or sinks below the ground, the plane disagrees with the kernel — repaint the',
    '   recession.',
    '',
    'Cast character clips composite onto this plate later by the SAME declared plane, so a',
    'plate that passes both gates stages any clip at any depth with zero placement calibration.',
  ].join('\n');
}

/**
 * The per-cel handoff for a keyframe animation target — the HANDOFF-K1 /
 * JOB-FACE contract as instructions text (animation-cheats.plan.md Addendum 4).
 * A body target (`key-N`) paints the whole character over that key's meru
 * guide; a face target (`key-N/face/<vocab>-<state>`) re-renders that SAME pose
 * with only the expression changed — a whole cel, never a decal. The meru guide
 * (served as scaffold.pngUrl) declares scale + pose + placement; the character
 * sheet locks identity. Both gates ride the accept pass (meru = machine numbers;
 * register/identity = the accepting agent's eyes).
 */
export function keyframeInstructions(manifest, options = {}) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  const { keyIndex, face } = parseKeyframeTarget(options.target ?? `key-0`);
  const ch = normalized.characters[0];
  const { width, height } = normalized.canvas;
  const head = [
    `# Keyframe cel — ${normalized.motionLabel} key ${keyIndex}${face ? ` · face ${face.vocab}:${face.state}` : ''}`,
    '',
    `Body animation renders every frame WHOLE — no parts, no rigging. Paint a complete ${width}×${height} cel of ${ch.name || ch.id} in this key's exact pose.`,
    '',
    '## The meru contract (scaffold.pngUrl is the guide)',
    '- The guide is the rig mannequin in this key\'s pose, between two register lines (crown + ground). Paint the character OVER it, in exactly its pose, at exactly its scale and position.',
    '- Crown of the head at or just below the upper register line (hair may rise slightly); soles exactly ON the lower register line, never below. Same height in every cel — the character must not grow or shrink between keys.',
    '- Completely cover the mannequin (no surface/joints/facets survive) and REMOVE both register lines — plain background there.',
  ];
  const identity = [
    '',
    '## Identity (condition on the character sheet)',
    `- ${ch.description}`,
    `- Same outfit, same colors, same face in every cel. Condition on '${ch.id}'\`s reference sheet (characterSheets) — it, not this prompt, owns the look.`,
  ];
  // The character's drawing discipline is the clip's declared style (preset /
  // fork / custom) when present, else the historical flat-cel default. The
  // plain-background rule is a COMPOSITING invariant, not a style choice — it
  // holds in every style, because the scene plate supplies the background.
  const brief = normalized.renderBrief;
  const styleLead = (brief?.lock?.length || brief?.preset)
    ? styleLockLines(brief, '## Style').slice(0, -1)
    : ['## Style', '- Flat cel animation style, clean dark outlines, flat colors, soft daylight.'];
  const style = [
    '',
    ...styleLead,
    '- The cel background is a plain uniform pale field ONLY — no ground, no shadow, no scenery, no text. The scene plate supplies the setting; the cel is the character alone.',
    '- Consistency across the whole set is the product: identical character, identical style, identical line weight — only the pose (and, for a face cel, the expression) changes.',
  ];
  const faceClause = face
    ? [
        '',
        '## The expression change (this target only)',
        `- ${subCelPhrase(face.vocab, face.state)}.`,
        `- EVERYTHING ELSE is identical to this key's base cel (key-${keyIndex}) — same pose, outfit, scale, position. ONLY the ${face.vocab === 'blink' ? 'eyes' : 'mouth'} differ.`,
      ]
    : [];
  const gates = [
    '',
    '## The two gates',
    '1. MERU (machine — mojulo audits on submit): this cel keeps the unit (crown at/below the line, soles on the ground line, same height as the base cel). A violation returns exact pixel targets — re-render over the guide.',
    `2. REGISTER (your eyes before submitting): it READS as the same character in ${face ? 'the same pose' : 'this pose'}, painted (not a vector tracing of the mannequin), front-facing, identity consistent with the sheet.`,
    '',
    `Submit via \`submit_image_render { ref, target: '${face ? `key-${keyIndex}/face/${face.vocab}-${face.state}` : `key-${keyIndex}`}', image_path }\`.`,
  ];
  return [...head, ...identity, ...style, ...faceClause, ...gates].join('\n');
}

/**
 * The reference-sheet brief for one character — the identity anchor the
 * worker generates BEFORE any panel (the pan-cel "cel 0" pattern in comic
 * form). Works for a character declared inline on a sequential-art
 * manifest AND for a standalone `character-sheet` sketch (the reusable
 * primitive). Neutral presentation is mandated here and overrides the
 * brief's mood/lighting: the sheet is metadata, not a scene. Style Lock
 * still applies — identity must be established in the same drawing
 * discipline the panels will use.
 */
export function buildCharacterSheetInstructions(manifest, characterId) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  let ch;
  if (normalized.kind === KIND_CHARACTER_SHEET) {
    ch = normalized.character;
    if (characterId && characterId !== ch.id) {
      throw new Error(`this character-sheet declares '${ch.id}', not '${characterId}'`);
    }
  } else if (
    normalized.kind === KIND_SEQUENTIAL_ART || normalized.kind === KIND_IMAGE_OUTCOME
    || normalized.kind === KIND_KEYFRAME_ANIMATION || normalized.kind === KIND_SPRITE_SHEET
  ) {
    ch = normalized.characters.find((c) => c.id === characterId);
    if (!ch) {
      throw new Error(
        `unknown character id: ${characterId} (characters: ${normalized.characters.map((c) => c.id).join(', ') || 'none'})`,
      );
    }
  } else {
    throw new Error('character sheets belong to image-outcome, sequential-art, keyframe-animation, sprite-sheet, or character-sheet manifests');
  }
  const outfits = ch.outfits.length ? ch.outfits : [{ id: 'default', description: 'as described above' }];
  // A keyframe-animation clip MAY carry a renderBrief (preset / fork / custom
  // style) — the cels + this sheet then establish identity in that discipline.
  // Omitted → the fixed flat-cel contract (the historical default), so a clip
  // that declares no style is unchanged.
  const brief = normalized.renderBrief || {
    style: 'flat cel animation style, clean dark outlines, flat colors (the keyframe cels condition on this sheet)',
    negative: [],
  };
  const styleLock = (brief.lock?.length || brief.preset)
    ? ['', ...styleLockLines(brief, '## Style Lock (the panels use this discipline — establish identity in it)').slice(0, -1)]
    : ['', '## Style Direction', `- style: ${brief.style}`];
  return [
    `# Character reference sheet — ${ch.name || ch.id}`,
    '',
    `Identity metadata for "${normalized.title}". Generate this sheet FIRST, keep it, and condition every panel or shot featuring '${ch.id}' on it — the sheet, not the scene prompt, owns what this character looks like.`,
    '',
    'Model-sheet turnaround strip: the SAME character drawn front, three-quarter, side, and back on a common ground line, identical height in every view.',
    'NEUTRAL PRESENTATION (overrides the page mood/lighting): flat even studio light, plain pale background, relaxed standing pose — no scene, no props beyond the outfit, no dramatic posing.',
    `One horizontal row per outfit (${outfits.map((o) => o.id).join(', ')}). Same face, same hair, same build in every row — ONLY the outfit changes.`,
    '',
    '## Character',
    `- ${ch.description}`,
    '',
    '## Outfits',
    ...outfits.map((o) => `- ${o.id}: ${o.description}`),
    ...styleLock,
    '',
    '## Avoid',
    ...brief.negative.map((item) => `- ${item}`),
    '- no text, labels, or annotations on the sheet (ids live in metadata, not paint)',
  ].join('\n');
}
