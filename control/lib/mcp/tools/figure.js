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

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { renderFigureToSvg, renderFigureFrames, figureIsAnimated, FIGURE_VIEWS } from '@/lib/graph/polygonizer/figure-render';
import { GARMENTS } from '@/lib/graph/polygonizer/figure-garments';
import { encodeGif } from '@/lib/motion';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes/paths';
import { FIGURE_SETUPS, FIGURE_SETUP_NAMES } from '@/lib/visual-language/themes';

const GARMENT_KEYS = Object.keys(GARMENTS);

export async function createFigureHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_figure requires { title }');
  const { title, pose, proto, garment, view, motion, background, setup, animate, ref, folder_ref: folderRef } = input;
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (garment !== undefined && garment !== null && !GARMENT_KEYS.includes(garment)) {
    throw new Error(`\`garment\` must be one of ${GARMENT_KEYS.join(', ')} (or null)`);
  }
  if (setup !== undefined && setup !== null && !FIGURE_SETUP_NAMES.includes(setup)) {
    throw new Error(`\`setup\` must be one of ${FIGURE_SETUP_NAMES.join(', ')} (or null)`);
  }
  if (view !== undefined && typeof view !== 'number' && !FIGURE_VIEWS.includes(view)) {
    throw new Error(`\`view\` must be a number (azimuth°) or one of ${FIGURE_VIEWS.join(', ')}`);
  }
  if (motion !== undefined && motion !== null) {
    const okString = typeof motion === 'string' && ['walk', 'wave', 'sprint', 'run'].includes(motion);
    const okSpec = motion && typeof motion === 'object'
      && (typeof motion.walk === 'object' || typeof motion.gait === 'object'
        || typeof motion.sprint === 'object' || typeof motion.run === 'object' || Array.isArray(motion.keyframes));
    if (!okString && !okSpec) throw new Error("`motion` must be 'walk' | 'sprint' | 'wave', { walk: {…dials} }, { sprint: {…dials} }, or { keyframes: [pose, …] } (or null)");
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }

  const manifest = {
    kind: 'figure',
    ...(pose !== undefined && pose !== null ? { pose } : {}),
    ...(proto !== undefined && proto !== null ? { proto } : {}),
    ...(garment !== undefined && garment !== null ? { garment } : {}),
    ...(view !== undefined && view !== null ? { view } : {}),
    ...(motion !== undefined && motion !== null ? { motion } : {}),
    ...(background !== undefined ? { background } : {}),
    ...(setup !== undefined && setup !== null ? { setup } : {}),
    title,
  };

  // Render once to validate (a bad dial fails here, not at view time).
  try { renderFigureToSvg(manifest); }
  catch (err) { throw new Error(`figure render failed: ${err.message}`); }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  // Motion: a `motion` (walk) renders a looping GIF into the sketch's outcome
  // folder. Auto when the manifest animates; `animate:false` skips it.
  let gifUrl = null;
  const wantGif = animate === undefined ? figureIsAnimated(manifest) : (animate !== false && figureIsAnimated(manifest));
  if (wantGif) {
    try {
      const frames = (typeof animate === 'object' && animate.frames) || 30;
      const fps = (typeof animate === 'object' && animate.fps) || 18;
      const dir = outcomeDirFor(sketch.ref);
      await fs.mkdir(dir, { recursive: true });
      // GIF backdrop follows the setup (transparent GIFs aren't supported, so a
      // `background:false` figure falls back to the setup/default ground).
      const gifBg = (setup && FIGURE_SETUPS[setup]?.bg) || '#eef1f4';
      await encodeGif(renderFigureFrames(manifest, frames), path.join(dir, 'motion.gif'), { width: 480, fps, bg: gifBg, loop: 0 });
      gifUrl = `${outcomeUrlFor(sketch.ref)}motion.gif`;
    } catch (err) { gifUrl = null; }   // GIF is a bonus; the still SVG already succeeded
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    svgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/svg?inline=1`,
    ...(gifUrl ? { gifUrl } : {}),
  };
}

export function registerFigureTools() {
  registerTool({
    name: 'create_figure',
    description:
      "Mint a POSED human figure — the protoform (a sculpted, vexar-lit male/female body over a manji armature) put into a pose and rendered to a sketch. Reach for this on framing like \"pose a figure / show a person reaching / a walking figure / male|female body in a stance / a figure wearing X\". The figure is a PURE FUNCTION of its dials, so posing = choosing values; joint LIMITS + spine caps clamp every value so a pose can never break the form.\n\nFour independent dial-sets, all optional (omit → canonical male, neutral stance, three-quarter view):\n\n  • pose — the POSE. Per-joint degrees-of-freedom:\n      arms: shL/shR { yaw, pitch } (shoulder swing), elbowL/elbowR (bend, 0-150°)\n      legs: hipL/hipR { yaw, pitch } (thigh swing), kneeL/kneeR (bend, 0-150°)\n      head: head { yaw, pitch }\n      SPINE: spine { sagittal, lateral, axial } each ∈ [-1,+1] — sagittal + = flex/curl forward, − = arch back; lateral = side-bend; axial = twist. This is what makes a pose read alive (contrapposto, slump, recoil) instead of rigid-vertical. The bend is distributed across the trunk by its natural mobility (lumbar flexes, thoracic rotates).\n\n  • proto — the BODY. sex ('male'|'female'); height, stockiness (girth); per-region multipliers (1 = canonical): chestWidth, bicep, forearm, quad, calf, gluteSize, pecProjection, waistTuck, etc. The same dials morph a body lean↔heavy, male↔female.\n\n  • garment — clothing over the body (it tracks the pose + body for free): one of skinSuit, wetsuit, tee, tank, dress (or null = bare).\n\n  • view — camera: 'frontal' | 'three-quarter' | 'lateral' | 'left' | 'back', or a number (azimuth degrees; 0 = front).\n\n  • setup — the STUDIO (backdrop + material + lighting + render mode), separate from the body dials: 'studio-grey' (default neutral lit study), 'white-cyc' (high-key white), or 'blueprint-wire' (a cyan ring-wave WIREFRAME on blueprint blue — the construction view to verify a region before trusting the filled render). Omit for the default lit look.\n\nMotion: pass motion:'walk' to also render a looping walk-cycle GIF into the sketch's outcome folder (returned as gifUrl); the walk is a real weight-shifting gait — the stance foot plants and the centre of mass transfers over it, with a live spine counter-rotation. Tune it with motion:{ gait:{ strideLength, armSwing, swingLift, weightShift, ... } }. `animate:false` skips it; `animate:{frames,fps}` tunes the GIF.\n\nWorkflow: this is a render — mint it, open the URL (or rasterize the svgUrl) to SEE the pose, then adjust the dials and re-mint. Persisted with kind `figure`; the /api/sketches/<ref>/svg route renders the still SVG. Returns { ok, ref, url, svgUrl, gifUrl? }. (Contrast: a flat diagram → create_sketch; a metal wordmark → create_carved_solid; a manji-tree subject in motion → forge_motion.)",
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Title for the figure sketch.' },
        pose: {
          type: 'object',
          description: 'Per-joint degrees of freedom. arms: shL/shR {yaw,pitch,roll} (roll = axial/external rotation — e.g. rolls a bent forearm UP for a wave), elbowL/elbowR (0-150); legs: hipL/hipR {yaw,pitch}, kneeL/kneeR (0-150), ankleL/ankleR (+ dorsiflex/toe-up … − plantarflex/toe-down, ≈ ±40), toeL/toeR (MTP/ball joint, 0-55, + = toes bend up over the ball for toe-off); head {yaw,pitch}; spine {sagittal,lateral,axial} each -1..+1 (sagittal +flex/−arch, lateral side-bend, axial twist).',
          properties: {
            shL: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' }, roll: { type: 'number' } } },
            shR: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' }, roll: { type: 'number' } } },
            elbowL: { type: 'number' }, elbowR: { type: 'number' },
            hipL: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' } } },
            hipR: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' } } },
            kneeL: { type: 'number' }, kneeR: { type: 'number' },
            ankleL: { type: 'number' }, ankleR: { type: 'number' },
            toeL: { type: 'number' }, toeR: { type: 'number' },
            head: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' } } },
            spine: { type: 'object', properties: { sagittal: { type: 'number' }, lateral: { type: 'number' }, axial: { type: 'number' } } },
          },
        },
        proto: {
          type: 'object',
          description: 'Body tuning. sex (male|female); height, stockiness; per-region multipliers (1 = canonical): chestWidth, pecProjection, bicep, forearm, quad, calf, gluteSize, waistTuck, scapulaBun, footLength, handSize.',
          properties: {
            sex: { type: 'string', enum: ['male', 'female'] },
            height: { type: 'number' }, stockiness: { type: 'number' },
            chestWidth: { type: 'number' }, pecProjection: { type: 'number' }, waistTuck: { type: 'number' },
            bicep: { type: 'number' }, forearm: { type: 'number' }, quad: { type: 'number' }, calf: { type: 'number' },
            gluteSize: { type: 'number' }, scapulaBun: { type: 'number' }, footLength: { type: 'number' }, handSize: { type: 'number' },
          },
        },
        garment: { type: ['string', 'null'], enum: [...GARMENT_KEYS, null], description: `Clothing over the body (tracks pose + build): ${GARMENT_KEYS.join(' | ')} | null.` },
        view: { description: "Camera: 'frontal' | 'three-quarter' | 'lateral' | 'left' | 'back', or a number (azimuth degrees, 0 = front)." },
        motion: { description: "Optional motion → looping GIF. One vocabulary (the phase→dof analog of `pose`): 'walk' = the default parameterized walk cycle (a real weight-shifting gait: the stance foot plants, the COM transfers); 'sprint' (alias 'run') = a sprinter's stride — a flight phase (both feet airborne), single-foot contact, hard forward lean, high knee drive, 90° arm pump; 'wave' = a tilt then a right-hand wave; { walk: { strideLength, stanceKnee, swingLift, armSwing, elbowBase, elbowSwing, hipSway, spineTwist, weightShift, headLevel, lean, headTilt, cadence } } = tune the walk dials (weightShift = how much the body lists onto the bearing leg; lean = forward trunk slouch; headTilt = forward head — e.g. lean+headTilt+loose limbs reads as a 'shaggy' amble; omit any → its default); { sprint: { strideLength, hipDrive, swingTuck, armSwing, armBack, elbowBend, lean, dutyFactor, flightLift, ... } } = tune the run (hipDrive = thigh/high-knee lift, armBack = backward arm drive, dutyFactor < 0.5 → longer flight, flightLift = airborne rise); { keyframes: [pose, …], loop } = author a CUSTOM motion as a list of poses — each `pose` is exactly a `pose` spec (same dials), eased between in order. Any form may add { perform: { exaggerate, anticipation, followThrough, idle } } to overlay the animation principles (limb lag, wind-up, breathing)." },
        setup: {
          type: ['string', 'null'],
          enum: [...FIGURE_SETUP_NAMES, null],
          description: "Studio SETUP — backdrop + material + lighting + render mode, so the figure need not always be the default grey lit study. 'studio-grey' (neutral grey, lit) | 'white-cyc' (high-key seamless white, lit) | 'blueprint-wire' (deep blue ground, cyan ring-wave WIREFRAME — a construction/verification view, no fill). Omit → the default lit studio look (≈ studio-grey).",
        },
        background: { type: 'boolean', description: 'Light backdrop (default true; false → transparent). A setup supplies its own ground; background:false still forces transparency for the still SVG.' },
        animate: { description: 'Motion GIF control. Omit → auto (GIF when motion is set); false → still only; { frames, fps } → tune.' },
        ref: { type: 'string', description: 'Optional explicit sketch ref (1-64 chars [A-Za-z0-9_-]).' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createFigureHandler,
  });
}
