/** humanoid-plan.js — the HUMANOID starter (core since face-tune; docs/examples/humanoid/humanoid.plan.mjs re-exports it): the
 * hero form (hero-form.js) with a male / female preset, the body controls, and the HEAD from humanoid-head.js (rows and
 * slots resampled from a head fitted to reference images, the jaw hinged along the mandibular angle, the face controls,
 * expressions displacing the flesh, hair from the library), then the DRESS (hero-dress.js: body detail and adornment).
 * Hair, palette and expression are independent of the proportions. The shirt-panel refinement lives here; shared anatomy
 * lives in the hero form or the head. */
import { heroPlan, HERO_CASTS, BODY_DEFAULTS, REGISTERS, resolveTune, castOf, ANIME_NECK_FORMS, ANIME_WAVE, WAVE_TWIST, withWaveHand, planScale, scaleIncludePart } from './hero-form.js';
import { humanoidHead, HAIR_STYLES, EXPRESSIONS, FACE_VERSION, FACE, resolveFace, validateFace, HEAD_PRESETS } from './humanoid-head.js';
import { validateCast } from './figure-cast.js';
import { dressPlan, kitPalette } from './hero-dress.js';
import { outfitTones } from '../outfit/expand.js';
import { animeHead, ANIME_FACE, validateAnimeFace, resolveAnimeFace } from './anime-head.js';

export const BODY_PRESETS = Object.fromEntries(Object.entries(HERO_CASTS).map(([k, c]) => [k, { ...BODY_DEFAULTS, ...c.body }]));
export const PALETTE = { Skin: '#d9a77e', Top: '#3d6fa8', Bottom: '#2c3a55', Shoes: '#4a3526', Hair: '#3b291e' };
export { HAIR_STYLES, EXPRESSIONS, REGISTERS, FACE_VERSION, FACE };

/** the worn head's pole (its design base or fit) and its scale, as humanoidPlan reads them from its options (the scale on
 * demand: the tune is resolved only when it is read) */
function wornHead({ preset, headPreset, headScale, tune, props }) {
  const heroCast = typeof preset === 'string' && castOf(preset, props);
  return { heroCast, pole: headPreset ?? (heroCast ? preset : 'male'), get scale() { return (headScale ?? heroCast?.headScale ?? 1) * resolveTune(tune).head; } };
}

/**
 * @param {object} opts
 *   preset      'male' | 'female' (a HERO_CASTS word: joints, girth, body defaults; the head's dimorph pole)
 *   body        overrides on the body controls (waist, chest, chestDepth, hip, hipDepth, thigh, arm, neck)
 *   face        the FACE controls (humanoid-head.js `FACE`): a move word ('broad-jaw', 'large-eyes'), a ratio object over the
 *               shape knobs and the lab's words (skullWidth, faceWidth, faceLength, jawWidth, chinProjection, cheek, eyeSpacing,
 *               eyeSize, browHeight, noseWidth, noseSize, mouthWidth …) or a list composed by product; 1 = the fitted head
 *   headPreset  the head's pole and fit ('male' | 'female'); defaults to `preset` when that is a hero cast, else 'male'
 *   proportions 'hero' (the realistic casts) | 'anime' (hero-form ANIME_CASTS: about 6.5 / 7 heads tall, longer legs, a
 *               shorter torso, narrower shoulders, slimmer neck and limbs); defaults to 'anime' with the anime head,
 *               where a cast with a NECK FORM (ANIME_NECK_FORMS) wears it: the neck a ring loft, the trapezius ring
 *   head        'landmark' (the fitted landmark head, the default) | 'anime' (anime-head.js: the Anime Form Studio's head;
 *               `headPreset` is its design base, `face` / `hair` / `expression` its words, `register: 'lowpoly'` its coarse sampling)
 *   sculpt      the anime head's GRAPHIC FACE words (anime-sculpt.js); absent is the graphic base, `false` the studio's face
 *   register    'lowpoly' | 'round' | 'chamfer' | 'box' (the body's rings and the head's planes)
 *   hair        a HAIR_STYLES word ('crop', 'swept', 'bob', 'ponytail' … 'none');  expression  an EXPRESSIONS word
 *   headScale   scales the head (its carriers, pin-local detail and jaw anchors together)
 *   detail      BODY DETAIL (hero-dress.js): 'clothed' | 'swimsuit' | 'none' | body data — the dragon's passes with the hero's
 *               parameters; `childCoded` (the door's child-coded figure) puts a swimsuit's child in a rash vest
 *   adorn       ADORNMENT (hero-dress.js): 'ranger' | 'none' | a kit — worn over the detail, one signature each
 *   outfit      GARMENTS WITH VOLUME (hero-dress.js OUTFIT_WORDS, body-garment.js): a word, a piece or a list — the body's shape, bending with it
 *   paint       SECOND SKIN (hero-dress.js PAINT_WORDS, body-paint.js): a word, an entry or a list — painted on the body's faces
 *   tune        anything the hero form's `resolveTune` takes: percentages of the preset's own baseline (a move word,
 *               { shoulders, waist, hips, depth, torso, neck, legs, head, stature, upperArm, forearm, thigh, calf }, or a list).
 *               `head` here scales the WORN head: it is baked at the tuned scale (the form's own `head` only sizes a blank trunk)
 */
export function humanoidPlan({ preset = 'male', body = {}, face = {}, register = 'round', girth = 1, headScale, palette = {}, hair, expression = 'neutral', tune, headPreset, detail, adorn, paint, outfit, head: headKind = 'landmark', proportions, sculpt, core, childCoded = false } = {}) {
  const props = proportions ?? (headKind === 'anime' ? 'anime' : 'hero');
  const worn = wornHead({ preset, headPreset, headScale, tune, props }), { heroCast, pole } = worn;
  if (!heroCast && (typeof preset !== 'string' || validateCast(preset).length)) throw new Error(`humanoid: unknown preset '${preset}' (have ${Object.keys(HERO_CASTS).join(', ')}, or a figure cast)`);
  if (!HEAD_PRESETS[pole]) throw new Error(`humanoid: unknown headPreset '${pole}' (have ${Object.keys(HEAD_PRESETS).join(', ')})`);
  if (!['landmark', 'anime'].includes(headKind)) throw new Error(`humanoid: unknown head '${headKind}' (have landmark, anime)`);
  const anime = headKind === 'anime';
  const faceErrors = anime ? validateAnimeFace(face) : validateFace(face); if (faceErrors.length) throw new Error(`humanoid: ${faceErrors.join('; ')}`);
  const colours = { ...PALETTE, ...kitPalette(adorn), ...outfitTones(outfit), ...palette };   // a kit's and an outfit build's suggested colours, beneath the operator's (the head bakes them into its include)
  const resolvedHeadScale = worn.scale;
  let head;
  // the anime head's shaped hair keeps out of the body it is worn on: the body's neck and torso rings, read off the same
  // plan without a head (the head sits at the atlas, so the rings are taken about it, in the head's unscaled metres)
  const neckForm = anime && props !== 'hero' && typeof preset === 'string' && Object.hasOwn(ANIME_NECK_FORMS, preset) ? ANIME_NECK_FORMS[preset] : null;
  const planArgs = { cast: preset, register, girth, headScale: resolvedHeadScale, palette: colours, body, tune, ...(props !== 'hero' ? { proportions: props } : {}), ...(neckForm ? { neckForm } : {}), ...(core !== undefined ? { core } : {}), ...(detail === 'swimsuit' && !childCoded ? { bare: true } : {}) };
  if (anime) head = animeHead({ preset: pole, face, hair, expression, register, scale: resolvedHeadScale, skin: colours.Skin, hairColor: colours.Hair, palette: colours, sculpt, body: hair && hair !== 'none' ? bodyRingsAboutAtlas(heroPlan({ ...planArgs, head: null }), resolvedHeadScale) : null });
  else { const { from: _faceFrom, ...shape } = resolveFace(face); head = humanoidHead({ preset: pole, shape, register, hair: hair ?? 'swept', expression, scale: resolvedHeadScale, skin: colours.Skin, hairColor: colours.Hair, palette: colours }); }
  // the anime head on anime proportions wears its cast's NECK FORM (hero-form.js ANIME_NECK_FORMS: the ring loft rising
  // into the occiput, the trapezius ring); every other head and proportion keeps the segment neck
  const plan = heroPlan({ ...planArgs, head });
  starterTorso(plan, { register, neckForm, heroCast });
  // the anime head waves its own way, whatever the proportions (hero-form.js ANIME_WAVE: the elbow out and down, the
  // forearm upright); every other head keeps the form's wave. A hand with digits opens and turns its palm to the front
  if (anime) plan.clips.wave = plan.rig?.hands ? withWaveHand(JSON.parse(JSON.stringify(ANIME_WAVE)), WAVE_TWIST.anime) : JSON.parse(JSON.stringify(ANIME_WAVE));
  dressPlan(plan, { detail, adorn, paint, outfit, operatorPalette: palette, scale: (heroCast?.scale ?? 1) * resolveTune(tune).stature, figure: { female: heroCast?.silhouette === 'female', child: childCoded } });
  plan.frame.note = anime
    ? `1 unit = 1 m; humanoid ${preset} starter, the anime head (Anime Form Studio, ${pole} base), ${register}; proportions are body controls, hair and palette independent${(() => { const d = ANIME_FACE.describe(resolveAnimeFace(face)); return d ? `; ${d}` : ''; })()}`
    : `1 unit = 1 m; humanoid ${preset} starter, face v${FACE_VERSION}, ${register}; proportions are body controls, hair and palette independent${(() => { const d = FACE.describe(resolveFace(face)); return d ? `; ${d}` : ''; })()}`;
  return plan;
}

/** The anime head's parts `only` (a list of names) at another `expression`, as humanoidPlan with these options (`opts`, its
 * own: preset, face, register, sculpt, tune, headScale, headPreset, proportions) would wear them — bald and unfitted (the
 * expression parts are the same with the hair on), at the worn head's scale and then under the plan's own scale
 * (hero-form scalePlan) — so a part equals the recipe's part of that name. The face rig's head builds
 * (anime-face-rig.js). */
export function animeHeadAt(opts, expression, only) {
  const props = opts.proportions ?? 'anime';
  const { pole, scale } = wornHead({ preset: opts.preset, headPreset: opts.headPreset, headScale: opts.headScale, tune: opts.tune, props });
  const { parts } = animeHead({ preset: pole, face: opts.face ?? {}, register: opts.register ?? 'round', scale, sculpt: opts.sculpt, expression, hair: 'none', hairFit: false, only });
  const S = planScale({ cast: opts.preset, tune: opts.tune, proportions: props });
  return S === 1 ? parts : Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, scaleIncludePart(p, S)]));
}

/** the starter's own shirt torso over the hero plan's (broad panels, a sloping shoulder yoke, the collar's rise): applied to
 * the worn plan and to the head-less plan the anime head's hair keeps out of */
function starterTorso(plan, { register, neckForm, heroCast }) {
  // Broad shirt panels and a sloping shoulder yoke are specific to this starter.
  // Keep the hero recipe (and previously stored plans) independent of this art direction.
  const torso = plan.segments.find(s => s.name === 'torso');
  // overlap the trouser crest with a continuous shirt hem; the structured core's pelvis meets the hem itself, and a hem
  // deeper than it is a step at the waist on the bare body (the palette's seam still marks a shirt)
  if (!plan.segments.some((s) => s.name === 'pelvis')) torso.stations[0].r[1] *= 1.12;
  torso.e = Math.max(REGISTERS[register].e, 3);
  const station = (id, i) => torso.stations.find((st) => st.id === id) ?? torso.stations[i];   // a structured torso carries shaping rings between
  const shoulder = station('st3', 3), collar = station('st4', 4);
  const collarRise = 0.025 * (heroCast?.scale ?? 1);
  if (!neckForm?.trap) {   // the trapezius ring (a neck form) places the top ring itself: no collar rise, no widening
    collar.z += collarRise;
    torso.caps.tip[2] += collarRise;
  }
  shoulder.r[1] *= 1.08;
  if (!neckForm?.trap) {
    collar.r[0] *= 1.10;
    collar.r[1] *= 1.10;
    // the structured core's neck root (hero-form.js NECK_ROOT) pushed the collar's front slots down to the sternal notch
    // and back onto the neck: the rise and the widening above would carry them up and out with the ring, so each pushed
    // slot takes them back by its share of the front's push (its sides and back rise with the collar)
    const f = collar.push?.front;
    if (f && f[2] < 0) for (const d of Object.values(collar.push)) { const w = d[2] / f[2]; if (w > 0) { d[2] = +(d[2] - w * collarRise).toFixed(6); d[1] = +(d[1] - w * collar.r[1] * (0.1 / 1.1)).toFixed(6); } }
  }
}

/** the body's NECK and TORSO as ring stacks (bottom → top: { z, cy, rx, ry, e }) about the head's atlas, in the head's
 * unscaled metres: what the anime head's shaped hair keeps out of; each stack's `clear` its clearance (hair lies close
 * on the neck, the shirt's collar and shoulders stand it off) */
function bodyRingsAboutAtlas(plan, scale) {
  const hb = plan.joints.headBase[2], k = 1 / scale, ring = (z, cy, r, e) => ({ z: (z - hb) * k, cy: cy * k, rx: r[0] * k, ry: r[1] * k, e: e ?? 2 });
  const torso = plan.segments.find((q) => q.name === 'torso'), neck = plan.segments.find((q) => q.name === 'neck'), out = [];
  if (torso?.stations) { const st = [...torso.stations].sort((a, b) => a.z - b.z), top = st.at(-1), tip = torso.caps?.tip?.[2];
    out.push(Object.assign([...st.map((q) => ring(q.z, q.yc ?? 0, q.r, q.e ?? torso.e)), ...(tip > top.z ? [ring(tip, top.yc ?? 0, [top.r[0] * 0.45, top.r[1] * 0.45], top.e ?? torso.e)] : [])], { clear: 0.012 })); }
  if (neck?.kind === 'loft') out.push(Object.assign([...neck.stations].sort((a, b) => a.at[2] - b.at[2]).map((q) => ring(q.at[2], q.at[1], q.r, neck.e)), { clear: 0.002 }));
  return out;
}
