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
import { EMOTE_NAMES } from '@/lib/graph/polygonizer/figure-emotes';
import { GARMENTS, validateGarmentSpec } from '@/lib/graph/polygonizer/figure-garments';
import { validateFluffs, FLUFF_SHAPE_NAMES } from '@/lib/graph/polygonizer/figure-fluff';
import { normalizeDreamAudit } from '@/lib/graph/image-outcomes/dream-audit';
import { articulate } from '@/lib/graph/polygonizer/figure-vajra';
import { encodeGif } from '@/lib/motion';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes/paths';
import { FIGURE_SETUPS, FIGURE_SETUP_NAMES } from '@/lib/visual-language/themes';

const GARMENT_KEYS = Object.keys(GARMENTS);

export async function createFigureHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_figure requires { title }');
  const { title, pose, proto, garment, fluffs, view, background, setup, ref, folder_ref: folderRef } = input;
  // Defensive transport parse: object-valued params whose inputSchema declares a
  // permissive/union type can arrive JSON-stringified from some MCP clients. Parse
  // an object/array that came across as a string so the validators below see the
  // real shape (a plain string like 'walk' is left untouched → still validated).
  let { motion, animate, dream_audit: dreamAudit } = input;
  if (typeof motion === 'string' && /^\s*[{[]/.test(motion)) {
    try { motion = JSON.parse(motion); } catch { /* leave as string; validator will reject */ }
  }
  if (typeof animate === 'string' && /^\s*[{[]/.test(animate)) {
    try { animate = JSON.parse(animate); } catch { /* leave as string; handler falls back to defaults */ }
  }
  if (typeof dreamAudit === 'string' && /^\s*[{[]/.test(dreamAudit)) {
    try { dreamAudit = JSON.parse(dreamAudit); } catch { /* leave as string; validator will reject */ }
  }
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (garment !== undefined && garment !== null) {
    // A single entry OR an array (layering: e.g. ['trousers','jacket'] worn
    // together). Each entry is a GARMENTS key or an INLINE wardrobe-piece spec
    // (character-from-dream C0b: a dreamed piece authored as data — pieces +
    // cuts/panels + its own mugen clearances — resolved against ANY body).
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
        || (typeof motion.emote === 'string' && EMOTE_NAMES.includes(motion.emote)));
    if (!okString && !okSpec) throw new Error(`\`motion\` must be 'walk' | 'sprint' | 'wave', an emote name (${EMOTE_NAMES.join('/')}), { walk: {…dials} }, { sprint: {…dials} }, { emote, intensity? }, or { keyframes: [pose, …] } (or null)`);
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }
  // The character-from-dream MACHINE GATE: a figure may claim dream-reconstruction
  // provenance ONLY with a valid dream_audit attesting an image worker was
  // actually invoked (source + invoked_generator:true + prompt + a generation id).
  // Absent → a plain figure (no claim). Malformed / invoked_generator:false →
  // REFUSED here. See lib/graph/image-outcomes/dream-audit.js.
  const provenance = (dreamAudit !== undefined && dreamAudit !== null) ? normalizeDreamAudit(dreamAudit) : null;

  const manifest = {
    kind: 'figure',
    ...(pose !== undefined && pose !== null ? { pose } : {}),
    ...(proto !== undefined && proto !== null ? { proto } : {}),
    ...(fluffs !== undefined && fluffs !== null ? { fluffs } : {}),
    ...(garment !== undefined && garment !== null ? { garment } : {}),
    ...(view !== undefined && view !== null ? { view } : {}),
    ...(motion !== undefined && motion !== null ? { motion } : {}),
    ...(background !== undefined ? { background } : {}),
    ...(setup !== undefined && setup !== null ? { setup } : {}),
    ...(provenance ? { provenance } : {}),
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
    ...(provenance ? { provenance: provenance.kind, dreamedBy: provenance.source } : {}),
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
  if (!input || typeof input !== 'object') throw new Error('emote_figure requires { ref, emote }');
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
  if (src.manifest?.kind !== 'figure') throw new Error(`'${ref}' is kind '${src.manifest?.kind}', not a figure — emote_figure poses stored create_figure sketches`);
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
      pose: m.pose, proto: m.proto, garment: m.garment,
      view: view ?? m.view, setup: m.setup, background: m.background,
      motion, animate,
      ...(typeof mint === 'object' && mint.ref ? { ref: mint.ref } : {}),
    });
  }

  const frames = (typeof animate === 'object' && animate.frames) || 30;
  const fps = (typeof animate === 'object' && animate.fps) || 18;
  const dir = outcomeDirFor(src.ref);
  await fs.mkdir(dir, { recursive: true });
  const gifBg = (m.setup && FIGURE_SETUPS[m.setup]?.bg) || '#eef1f4';
  const gifManifest = { ...m, motion, ...(view !== undefined && view !== null ? { view } : {}) };
  await encodeGif(renderFigureFrames(gifManifest, frames), path.join(dir, `emote-${emote}.gif`), { width: 480, fps, bg: gifBg, loop: 0 });
  return {
    ok: true,
    ref: src.ref,
    emote,
    url: `/sketches/${encodeURIComponent(src.ref)}`,
    gifUrl: `${outcomeUrlFor(src.ref)}emote-${emote}.gif`,
  };
}

export function registerFigureTools() {
  registerTool({
    name: 'create_figure',
    description:
      "Mint a POSED human figure — the protoform (a sculpted, vexar-lit male/female body over a manji armature) put into a pose and rendered to a sketch. Reach for this on framing like \"pose a figure / show a person reaching / a walking figure / male|female body in a stance / a figure wearing X\". The figure is a PURE FUNCTION of its dials, so posing = choosing values; joint LIMITS + spine caps clamp every value so a pose can never break the form.\n\nFour independent dial-sets, all optional (omit → canonical male, neutral stance, three-quarter view):\n\n  • pose — the POSE. Per-joint degrees-of-freedom:\n      arms: shL/shR { yaw, pitch } (shoulder swing), elbowL/elbowR (bend, 0-150°)\n      legs: hipL/hipR { yaw, pitch, roll } (thigh swing + axial external/internal rotation), kneeL/kneeR (bend, 0-150°), ankleL/ankleR (flex), toeL/toeR (toe curl)\n      hands: wristL/wristR { flex, deviation } (the hand bends + tilts at the wrist — the arm-mirror of the ankle), fingersL/fingersR (knuckle curl, 0-90, + = close to a fist — the mirror of the toe)\n      head: head { yaw, pitch }\n      pelvis: number (transverse pelvic rotation, deg; + = right hip forward)\n      SPINE: spine { sagittal, lateral, axial } each ∈ [-1,+1] — sagittal + = flex/curl forward, − = arch back; lateral = side-bend; axial = twist. This is what makes a pose read alive (contrapposto, slump, recoil) instead of rigid-vertical. The bend is distributed across the trunk by its natural mobility (lumbar flexes, thoracic rotates).\n\n  • proto — the BODY. sex ('male'|'female'); height, stockiness (girth); headScale (skull size — the child↔adult lever, >1 = bigger head / younger read); per-region multipliers (1 = canonical): chestWidth, bicep, forearm, quad, calf, gluteSize, pecProjection, waistTuck, etc. The same dials morph a body lean↔heavy, male↔female, adult↔child.\n\n  • fluffs — the STYLIZED body register (replaces proto when present): a chunky zdog-style body from a closed set of named simple volumes (cone/football/bead/bell/slab) bound to armature segments, composed by superposition — girth contrast by default (huge distal masses on thin connectors: action-figure / mega-boy / mecha, e.g. a Mega-Man buster is a football with an open mouth). Garments still track it.\n\n  • garment — clothing over the body (it tracks the pose + body for free; svgile-row bespoke tailoring — the body's own geometry is the tape measure, so body-relative cuts/panels/seams fit any form). One of skinSuit, wetsuit, tee, tank, dress, vest, fittedShirt, oversizedShirt, trousers (slim|baggy), skirt, jacket (cut|allCut|paneled) — or an INLINE wardrobe-piece spec ({ id, pieces, cuts?, … }: a piece authored as data, its mugen clearance = its looseness) — or an ARRAY mixing keys/specs to LAYER (e.g. ['tank', {…}, 'jacketCut']), or null = bare.\n\nSkin seam: pull `get_skin_packet({ ref })` to paint the figure's filled ?control=1 scaffold and bind it with `skin_polygomer` — the figure then WEARS the paint deterministically at /skin.png.\n\n  • view — camera: 'frontal' | 'three-quarter' | 'lateral' | 'left' | 'back', or a number (azimuth degrees; 0 = front).\n\n  • setup — the STUDIO (backdrop + material + lighting + render mode), separate from the body dials: 'studio-grey' (default neutral lit study), 'white-cyc' (high-key white), or 'blueprint-wire' (a cyan ring-wave WIREFRAME on blueprint blue — the construction view to verify a region before trusting the filled render). Omit for the default lit look.\n\nMotion: pass motion:'walk' to also render a looping walk-cycle GIF into the sketch's outcome folder (returned as gifUrl); the walk is a real weight-shifting gait — the stance foot plants and the centre of mass transfers over it, with a live spine counter-rotation. Tune it with motion:{ gait:{ strideLength, armSwing, swingLift, weightShift, ... } }. `animate:false` skips it; `animate:{frames,fps}` tunes the GIF.\n\nWorkflow: this is a render — mint it, open the URL (or rasterize the svgUrl) to SEE the pose, then adjust the dials and re-mint. Persisted with kind `figure`; the /api/sketches/<ref>/svg route renders the still SVG. Returns { ok, ref, url, svgUrl, gifUrl? }. (Contrast: a flat diagram → create_sketch; a metal wordmark → create_carved_solid; a manji-tree subject in motion → forge_motion.)",
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Title for the figure sketch.' },
        pose: {
          type: 'object',
          description: 'Per-joint degrees of freedom. arms: shL/shR {yaw,pitch,roll} (roll = axial/external rotation — e.g. rolls a bent forearm UP for a wave), elbowL/elbowR (0-150); legs: hipL/hipR {yaw,pitch,roll} (roll = thigh axial/external rotation — rolls a bent knee/foot out, e.g. to step around), kneeL/kneeR (0-150), ankleL/ankleR (+ dorsiflex/toe-up … − plantarflex/toe-down, ≈ ±40), toeL/toeR (MTP/ball joint, 0-55, + = toes bend up over the ball for toe-off); WRIST: wristL/wristR {flex (±75, the hand bends at the wrist — the arm-mirror of the ankle), deviation (±30, radial/ulnar tilt)}, fingersL/fingersR (knuckle/MCP curl, 0-90, + = fingers close toward the palm — the hand-mirror of the toe); pelvis (transverse pelvic rotation, deg, + = right hip forward); shoulders (transverse shoulder-girdle rotation, deg, + = right shoulder forward — the upper mirror of pelvis); head {yaw,pitch}; spine {sagittal,lateral,axial} each -1..+1 (sagittal +flex/−arch, lateral side-bend, axial twist).',
          properties: {
            shL: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' }, roll: { type: 'number' } } },
            shR: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' }, roll: { type: 'number' } } },
            elbowL: { type: 'number' }, elbowR: { type: 'number' },
            hipL: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' }, roll: { type: 'number' } } },
            hipR: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' }, roll: { type: 'number' } } },
            kneeL: { type: 'number' }, kneeR: { type: 'number' },
            ankleL: { type: 'number' }, ankleR: { type: 'number' },
            toeL: { type: 'number' }, toeR: { type: 'number' },
            wristL: { type: 'object', properties: { flex: { type: 'number' }, deviation: { type: 'number' } } },
            wristR: { type: 'object', properties: { flex: { type: 'number' }, deviation: { type: 'number' } } },
            fingersL: { type: 'number' }, fingersR: { type: 'number' },
            pelvis: { type: 'number' }, shoulders: { type: 'number' },
            head: { type: 'object', properties: { yaw: { type: 'number' }, pitch: { type: 'number' } } },
            spine: { type: 'object', properties: { sagittal: { type: 'number' }, lateral: { type: 'number' }, axial: { type: 'number' } } },
          },
        },
        proto: {
          type: 'object',
          description: 'Body tuning. sex (male|female); height (overall scale), stockiness (girth); headScale (skull size about the neck join — the dominant child↔adult cue: >1 enlarges the cranium so the body reads fewer "heads tall" = younger); per-region multipliers (1 = canonical): chestWidth, pecProjection, bicep, forearm, quad, calf, gluteSize, waistTuck, scapulaBun, footLength, handSize.',
          properties: {
            sex: { type: 'string', enum: ['male', 'female'] },
            height: { type: 'number' }, stockiness: { type: 'number' }, headScale: { type: 'number' },
            chestWidth: { type: 'number' }, pecProjection: { type: 'number' }, waistTuck: { type: 'number' },
            bicep: { type: 'number' }, forearm: { type: 'number' }, quad: { type: 'number' }, calf: { type: 'number' },
            gluteSize: { type: 'number' }, scapulaBun: { type: 'number' }, footLength: { type: 'number' }, handSize: { type: 'number' },
          },
        },
        fluffs: {
          type: 'array',
          description: `STYLIZED body register (the "fluff" vocabulary) — REPLACES \`proto\` when present. A chunky zdog-style body built from a CLOSED set of named simple volumes bound to armature segments/nodes, composed by superposition (girth contrast by default: huge distal masses on thin connectors — the action-figure / mega-boy / mecha read). Garments still track it. Each entry: { shape, segment|node, id?, bias?{x,y,z}, hex?, ...dials }. Shapes (${FLUFF_SHAPE_NAMES.join(' | ')}): 'cone' binds a segment [proximal,distal], dials girth + taper (taper>1 = FLARE, a boot); 'football' binds a segment, dials girth + peak (belly position) + mouth (distal flat truncation 0-0.95, the cuff / OPEN arm-cannon); 'bead' binds a node, dials r + peak (0=sphere→1=cone/crest) + squash; 'bell' binds a segment, dials girth + mouth (wide distal radius, chest/skirt); 'slab' binds a segment, dials girth + depth + n (superellipse, ↑=boxier) + taper (torso plate, foot). Segments/nodes name two/one of the 17 LANDMARKS: headTop, headBase, neckHub, navel, pelvisHub, shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R. Example Mega-Man arm: { shape:'football', segment:['elbowR','wristR'], girth:0.05, peak:0.7, mouth:0.5 } (open buster). Omit fluffs → anatomical proto body.`,
          items: { type: 'object' },
        },
        garment: { type: ['string', 'object', 'array', 'null'], description: `Clothing over the body (tracks pose + build, body-relative cuts/panels/seams carve to fit any form): a wardrobe key (${GARMENT_KEYS.join(' | ')}), an INLINE wardrobe-piece spec ({ id, color?{cloth,under}, pieces:[{ fit: hug|hull|drape|radial|pelvis|torso|shoulders|sleeve|sash, coverage?, clearance?, thickness?, basin?, anchor? }], cuts?:[{kind: wedge|band|capsule|hole|halfspace|neck|armhole, …}], panels? }) — the piece's mugen clearance IS its looseness (slim vs baggy is only the number), an ARRAY mixing keys and specs to LAYER them (e.g. ['tank', {…dreamPants}, 'jacketCut']), or null = bare.` },
        view: { description: "Camera: 'frontal' | 'three-quarter' | 'lateral' | 'left' | 'back', or a number (azimuth degrees, 0 = front)." },
        motion: { type: ['string', 'object'], description: "Optional motion → looping GIF. One vocabulary (the phase→dof analog of `pose`): 'walk' = the default parameterized walk cycle (a real weight-shifting gait: the stance foot plants, the COM transfers); 'sprint' (alias 'run') = a sprinter's stride — a flight phase (both feet airborne), single-foot contact, hard forward lean, high knee drive, 90° arm pump; 'wave' = a tilt then a right-hand wave; { walk: { strideLength, cross, stepFlare, stepRoll, pelvisRot, shoulderRot, stanceKnee, swingLift, armSwing, elbowBase, elbowSwing, handCurl, wristGive, hipSway, spineTwist, weightShift, headLevel, lean, headTilt, cadence } } = tune the walk dials (handCurl = relaxed finger curl so the hands aren't flat boards; wristGive = the wrist flexes with the arm swing; (pelvisRot = transverse pelvic rotation, the swing-side hip leads each step — a determinant of natural gait, on by default; shoulderRot = the upper mirror, the shoulder girdle contra-rotates against the pelvis; weightShift = how much the body lists onto the bearing leg; lean = forward trunk slouch; headTilt = forward head — e.g. lean+headTilt+loose limbs reads as a 'shaggy' amble; cross = lateral crossover, the stepping foot swings toward/over the midline as it plants — 0 = normal hip-width sagittal walk, ≈0.10 lands the foot on the centerline, >0.10 scissors it past for a catwalk/runway crossover; stepFlare/stepRoll = crossover CLEARANCE, the swinging back foot circumducts — flares the hip out (stepFlare, ratio of the abduction to the crossover) and rolls the knee out (stepRoll, deg) — to maneuver AROUND the planted ankle instead of colliding with it, auto-gated so a plain walk is untouched; omit any → its default); { sprint: { strideLength, hipDrive, swingTuck, armSwing, armBack, elbowBend, lean, dutyFactor, flightLift, ... } } = tune the run (hipDrive = thigh/high-knee lift, armBack = backward arm drive, dutyFactor < 0.5 → longer flight, flightLift = airborne rise); { keyframes: [pose, …], loop } = author a CUSTOM motion as a list of poses — each `pose` is exactly a `pose` spec (same dials), eased between in order. Also accepts a named EMOTE (nod / headshake / bow / shrug / cheer / point / clap / think, or { emote, intensity }) — see emote_figure. Any form may add { perform: { exaggerate, anticipation, followThrough, idle } } to overlay the animation principles (limb lag, wind-up, breathing)." },
        setup: {
          type: ['string', 'null'],
          enum: [...FIGURE_SETUP_NAMES, null],
          description: "Studio SETUP — backdrop + material + lighting + render mode, so the figure need not always be the default grey lit study. 'studio-grey' (neutral grey, lit) | 'white-cyc' (high-key seamless white, lit) | 'blueprint-wire' (deep blue ground, cyan ring-wave WIREFRAME — a construction/verification view, no fill). Omit → the default lit studio look (≈ studio-grey).",
        },
        background: { type: 'boolean', description: 'Light backdrop (default true; false → transparent). A setup supplies its own ground; background:false still forces transparency for the still SVG.' },
        animate: { type: ['boolean', 'object'], description: 'Motion GIF control. Omit → auto (GIF when motion is set); false → still only; { frames, fps } → tune.' },
        ref: { type: 'string', description: 'Optional explicit sketch ref (1-64 chars [A-Za-z0-9_-]).' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
        dream_audit: {
          type: 'object',
          description: "Character-from-dream PROVENANCE (the machine gate). Provide ONLY when this figure was reconstructed from an image worker's dreamed reference (a character sheet / exploded garment pieces you actually generated and READ). Attests the dream really happened: { source: 'native' (your own image generation) | 'local:<detail>' (e.g. 'local:comfyui@127.0.0.1:8188'), invoked_generator: true (REQUIRED — a figure tuned from imagination, not a dreamed reference, must NOT set this), prompt: '<the brief you dreamed>', and one generation id: job_id | image_sha256 | seed | token; optional notes: what the dream dictated vs. what the vocabulary could reach }. A malformed audit or invoked_generator≠true is REFUSED. Omit for an ordinary (imagined) figure — the dreamed pixels are discarded either way; only this attestation persists as provenance.",
        },
      },
    },
    handler: createFigureHandler,
  });

  registerTool({
    name: 'emote_figure',
    description:
      "Make a stored figure EMOTE — apply a named body-language emote to an existing kind `figure` sketch and render it as a looping GIF beside the sketch, leaving the stored recipe untouched. Reach for this on \"make the figure nod/bow/shrug…, have them emote/react/gesture\". Emotes: nod, headshake, bow, shrug, cheer, point, clap, think — keyframe recipes over the posing engine, wrapped in the animation-principles layer so a held beat still breathes; `intensity` pushes every pose bolder (1 = as authored). `mint:{ref?,title?}` instead derives a NEW figure sketch carrying the emote as its motion — reusable in any world via the figures-map `figureRef`. Returns { ok, ref, emote, gifUrl }.",
    inputSchema: {
      type: 'object',
      required: ['ref', 'emote'],
      properties: {
        ref: { type: 'string', description: "Ref of an existing kind 'figure' sketch." },
        emote: { type: 'string', enum: EMOTE_NAMES, description: 'The named emote to perform.' },
        intensity: { type: 'number', description: 'Exaggeration push in (0, 3]; 1 = as authored, >1 bolder.' },
        view: { description: "Camera override: 'frontal' | 'three-quarter' | 'lateral' | 'left' | 'back', or azimuth degrees." },
        animate: { type: 'object', description: 'GIF control: { frames, fps } (defaults 30 / 18).' },
        mint: { type: ['boolean', 'object'], description: 'Mint a DERIVED figure sketch carrying the emote as its motion instead of a side GIF: true or { ref?, title? }.' },
      },
    },
    handler: emoteFigureHandler,
  });
}
