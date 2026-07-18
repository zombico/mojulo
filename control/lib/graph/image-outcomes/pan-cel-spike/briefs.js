/**
 * Render instructions for the three pan-cel target kinds — plate, character
 * key (cel 0), cel (pan-cel-motion.plan.md, spike build step 3). Written for
 * a foreign render worker reading them cold, like image-outcomes
 * instructions.js. Invariants carried over: art layer only, no readable
 * text; NEW fixed clause — the lighting lock (plan: generation order,
 * stage 3).
 */

import { cameraPhrase } from '../cameras.js';
import { facingPhrase } from './facings.js';
import { cyclePosePhrase } from './cycle-poses.js';
import { subCelPhrase, subCelStates } from './sub-cels.js';

const LIGHTING_LOCK =
  'Same character, same light — light direction, shadow side, color temperature, and contact shadow behavior must match the character key exactly; only the pose changes.';

function briefSections(renderBrief) {
  return [
    '## Must Preserve',
    ...renderBrief.mustPreserve.map((s) => `- ${s}`),
    '',
    '## Style Direction',
    `- style: ${renderBrief.style}`,
    `- mood: ${renderBrief.mood}`,
    `- lighting: ${renderBrief.lighting}`,
    '',
    '## May Invent',
    ...renderBrief.mayInvent.map((s) => `- ${s}`),
    '',
    '## Avoid',
    ...renderBrief.negative.map((s) => `- ${s}`),
  ];
}

export function buildPlateInstructions(manifest) {
  const p = manifest.plate;
  return [
    `# ${p.title}`,
    '',
    p.intent,
    '',
    'Use the scaffold image as the composition source of truth. Render a finished background plate that preserves the shot geometry.',
    '',
    `This plate is OVERSIZED: the animation frame is ${manifest.frame.width}×${manifest.frame.height} and a camera window pans across the full ${p.viewBox.width}×${p.viewBox.height} plate. Paint the entire canvas at even, edge-to-edge quality — every crop must stand alone as a frame background.`,
    '',
    `Camera: ${p.camera.kind} — ${cameraPhrase(p.camera.kind)}.`,
    '',
    'This is a CLEAN PLATE: no figures, no characters, no creatures anywhere. A character layer is composited over it later.',
    '',
    ...briefSections(p.renderBrief),
  ].join('\n');
}

export function buildKeyInstructions(manifest) {
  const k = manifest.characterKey;
  const light = manifest.plate.renderBrief.lighting;
  return [
    `# ${manifest.title} — character key (cel 0)`,
    '',
    'A model sheet: the SAME character repeated once per cell of the strip, in the facings marked on the scaffold, standing in a neutral study pose on the common ground line.',
    '',
    `Character: ${k.character}`,
    '',
    `Facings, left to right: ${k.facings.map((f) => `${f} (${facingPhrase(f)})`).join('; ')}.`,
    '',
    'LIGHTING REFERENCE: the attached background plate. Light the character under that scene\'s light — ' + light + '. This sheet is the lighting and identity contract for every animation cel that follows.',
    '',
    '## Must Preserve',
    '- identical character (face, hair, costume, proportions) in every cell',
    '- identical height in every cell — feet on the marked ground line',
    '- the facing marked under each cell',
    '- lighting matching the plate: shadow side, color temperature, key direction',
    '',
    '## Avoid',
    '- no background scenery in the cells (flat neutral field)',
    '- no readable text, labels, or panel borders in the painted layer',
    '- no pose acting — neutral stand only; the animation poses come later',
  ].join('\n');
}

export function buildHeldCelInstructions(manifest) {
  const h = manifest.heldCel;
  const baseNotes = manifest.subCels
    .map((sc) => `- ${sc.id} region {x:${sc.rect.x}, y:${sc.rect.y}, ${sc.rect.w}×${sc.rect.h}}: paint the BASE state — ${subCelPhrase(sc.vocab, subCelStates(sc.vocab)[0])}`)
    .join('\n');
  return [
    `# ${manifest.title} — held cel`,
    '',
    manifest.intent,
    '',
    `Camera: ${h.camera.kind} — ${cameraPhrase(h.camera.kind)}. Frame ${manifest.frame.width}×${manifest.frame.height}.`,
    '',
    'CONDITIONING: the character key (identity + lighting contract) and, if present, the accepted plate (scene + light reference).',
    '',
    h.description,
    '',
    `LIGHTING LOCK: ${LIGHTING_LOCK}`,
    '',
    'This is a HELD cel: it is on screen for the entire shot while tiny sub-cel regions swap over it. The marked regions must be cleanly repaintable rectangles:',
    baseNotes,
    '',
    '## Must Preserve',
    '- the character exactly as the key sheet defines her',
    '- sub-cel regions flat-on and unobstructed (no hair, hands, or props crossing them)',
    '- lighting matching the key: shadow side, color temperature',
    '',
    '## Avoid',
    '- no readable text, borders, or bubbles',
    '- no motion blur, no mid-blink or open-mouth base state',
  ].join('\n');
}

/**
 * Round-2 contract (sub-cel retrospective): FULL-FRAME EDIT only. Round 1's
 * standalone patches were painted on approximated skin and composited as
 * band-aid rectangles — a background that never matched cannot be
 * difference-keyed away. An edit of the whole held cel keeps every
 * non-feature pixel honest by construction; mojulo crops the region itself.
 */
export function buildSubCelInstructions(manifest, subCelId, state) {
  const sc = manifest.subCels.find((s) => s.id === subCelId);
  if (!sc) throw new Error(`unknown sub-cel '${subCelId}'`);
  const baseState = subCelStates(sc.vocab)[0];
  return [
    `# ${manifest.title} — sub-cel ${sc.id}/${state}`,
    '',
    `An EDIT of the held cel: the entire ${manifest.frame.width}×${manifest.frame.height} image re-emitted with ONLY the ${sc.vocab} changed to: ${subCelPhrase(sc.vocab, state)}. (The held cel's own ${sc.vocab} is the base state: ${subCelPhrase(sc.vocab, baseState)}.)`,
    '',
    'Do NOT deliver a cropped patch — full frame only. The compositor crops the region itself (' +
      `{x:${sc.rect.x}, y:${sc.rect.y}, ${sc.rect.w}×${sc.rect.h}}, measured from the held cel) and difference-keys it, so only the real feature change survives.`,
    '',
    `LIGHTING LOCK: ${LIGHTING_LOCK}`,
    '',
    '## Must Preserve',
    '- everything except the ' + sc.vocab + ': hair, jaw, scarf, background, lighting — the stiller the image, the cleaner the flap',
    `- the exact frame size ${manifest.frame.width}×${manifest.frame.height}`,
    '',
    '## Avoid',
    '- no cropped/patch output; no re-framing or zooming',
    '- no readable text; no restyling, recoloring, or re-lighting',
  ].join('\n');
}

/**
 * The ACETATE contract (v2 — adopted after the in-place attempt ghosted;
 * see the plan's retrospective): the cel is a traditional animation cel —
 * the character painted ALONE on a fully transparent background, composited
 * by mojulo. No background repaint to drift, no matte to guess. The context
 * image is provided for lighting/scale reference only. Mojulo owns the
 * contact shadow (deterministic, consistent across every cel + position).
 */
export function buildCelInstructions(manifest, celId, { crop } = {}) {
  const cel = manifest.cels.find((c) => c.id === celId);
  if (!cel) throw new Error(`unknown cel '${celId}'`);
  return [
    `# ${manifest.title} — cel ${cel.id}`,
    '',
    `One animation cel of a ${manifest.schedule.cycle.length}-cel walk cycle at ${manifest.fps} fps.`,
    '',
    'THIS IS AN ACETATE CEL, traditional animation style: paint the CHARACTER ONLY on a fully TRANSPARENT background (alpha PNG). If your harness cannot output transparency, use a single flat uniform chroma green (#00ff00) background instead — nothing else in the canvas.',
    '',
    'CONDITIONING: (1) the character key — the identity + lighting contract; (2) the pose scaffold / context image for THIS cel — use it for pose, scale, and light reference; do NOT paint its background.',
    '',
    `Pose: ${cel.pose} — ${cyclePosePhrase(cel.pose)}.`,
    `Facing: ${cel.facing} — ${facingPhrase(cel.facing)}.`,
    '',
    `LIGHTING LOCK: ${LIGHTING_LOCK}`,
    '',
    ...(crop
      ? [`Canvas size exactly ${crop.w}×${crop.h}. Place the character exactly where the stick figure stands in the context image — same position in the canvas, same stride width, feet at the same height.`, '']
      : []),
    '## Must Preserve',
    '- the character exactly as the key sheet defines her',
    '- the stick pose silhouette (limb positions, stride width, feet placement)',
    '- rim/fill consistent with the key light (low sun from frame-left)',
    '',
    '## Avoid',
    '- NO background of any kind: no ground, no sky, no scenery, no gradient',
    '- NO cast/contact shadow on the ground — the compositor owns the shadow',
    '- no readable text, borders, bubbles, or labels',
    '- no motion blur',
  ].join('\n');
}
