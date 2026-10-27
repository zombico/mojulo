/**
 * mint_solid kind 'layered' — a solid born layered (stations × slots, pinned details, dials).
 *
 * The stored manifest is `{ kind:'layered', title, recipe, plan?, dials, channels?, units, facing, seat?,
 * toon?, ledger }`: the RECIPE is the source; on every read the world registry lowers it through
 * station-loft-faces.js to studio faces (the compiled mesh itself), so a dial patch (`update_sketch { patch:[{ op:'set',
 * path:'/dials/jawOpen', value: 30 }] }`) reshapes the solid in place and the studio, `measure_solid`
 * and every export leg see the recompiled mesh. The mint pays the layered audit (per-part closure) and,
 * for a rigged recipe, the rig gates.
 * The PLAN door (`mint_solid { kind:'layered', via:'plan', plan }`): a ring plan (station-loft-plan.js — a joint
 * table, segments with ring radii, details by address, dials / rig / clips as data) is expanded into the recipe
 * at mint and stored beside it; an `update_sketch` patch under `/plan` re-expands the recipe, a patch under
 * `/dials` or `/recipe` edits as before. The recipe stays the compatibility promise; the plan is the authoring record.
 * The HERO door (`mint_solid { kind:'layered', via:'hero', spec:{ cast, register, tune, body?, head?, … } }`): the hero
 * form (hero-form.js — a human on the vajra rest skeleton) generated from a cast word and a TUNE (proportion as
 * percentages of the cast's own baseline: the body proportion lab's contract), stored as `hero` beside `plan` and
 * `recipe`. A patch under `/hero` regenerates the plan and the recipe (`/hero/tune/shoulders` → 1.1 is "ten percent
 * broader"); the readout answers in metres. The recipe stays the compatibility promise; `hero` is the authoring record
 * one level above the plan.
 * The hero wears the fitted LANDMARK head by default; `head: 'anime'` wears the ANIME HEAD instead (anime-head.js: the
 * Anime Form Studio's head, ported) with its own words for `face`, `hair` (families, controls, per-clump `locks`) and
 * `expression`; `headPreset` is its design base. Its GRAPHIC FACE (`sculpt`, anime-sculpt.js) is on by default, read when
 * the plan is generated and never stored: `hero.sculpt` stores only the words that differ from the base (sparse, the field
 * absent when none), `false` the studio's own face.
 * `gesture` is the STAND (hero-gesture.js): a preset word, an object of pose words or a list, stored as given and
 * resolved per cast into a one-key `gesture` clip listed first in the plan; the anime hero stands `relaxed` unless it
 * says otherwise (`rest` for none) — a plan-time default, never stored. The World shows the static solid skinned at
 * it; the readout measures it.
 * `clips` is the operator's motion (hero-gesture.js withHeroClips): `{ <name>: [keys] | false }` in the rig's pose
 * words, stored as given and merged over the hero's own when the plan is generated (a name it has replaced in place,
 * `false` removing one; `gesture` stays the stand's); the readout lists them. On the anime head a clip may be
 * `{ seconds, keys }` (its designed duration; every clip has one, heroClipSeconds) and a key may carry `face` (its
 * facial track, drawn by the export: anime-face-tracks.js); `blink: false` turns its ambient blink off (stored only
 * when false).
 * Manual: lib/graph/solid-vocab/layered.md. Reference recipe: docs/examples/dragon-layered; reference plan:
 * docs/examples/dragon-body/seed-recipe.mjs.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveToon, toonLightErrors } from '@/lib/graph/polygonizer/vexar';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import { compileLayered, resolveLayeredDials, pinFrame } from '@/lib/graph/polygonizer/station-loft';
import { expandPlan } from '@/lib/graph/polygonizer/station-loft-plan';
import { coreMeasures, coreAdvice } from '@/lib/graph/polygonizer/hero-core-measures';
import { dressSilhouette } from '@/lib/graph/polygonizer/dress-silhouette';
import { outlineMeasures, outlineCritic } from '@/lib/graph/polygonizer/dress-outline';
import { validateStylism, styledHero, stylismLedger, STYLISM_LAWS_VERSION } from '@/lib/graph/stylism';
import { readKit, kitDress } from '@/lib/graph/sportswear/kits.js';
import { readSilhouette, silhouetteAdvice, cohesionAdvice } from '@/lib/graph/stylism/silhouette';
import { heroPlan, planScale, castOf, lawCast, bustCeilingError, isBuiltCast, HERO_LAWS_VERSION, readsHeroLaws, takesLegSet, takesArmLength, castPole, castLabel, validateBuiltCast, HERO_BUILD_NAMES, HERO_BUILDS, PROPORTION_WORDS, HERO_CASTS, HERO_CORES, DEFAULT_CORE, REGISTERS, BODY_DEFAULTS, PALETTE as HERO_PALETTE, TUNE_KEYS, TUNE_AGGREGATE_KEYS, HERO_MOVE_NAMES, resolveTune, storedTune, validateTune, tuneWarnings } from '@/lib/graph/polygonizer/hero-form';
import { humanoidPlan, PALETTE as HUMANOID_PALETTE } from '@/lib/graph/polygonizer/humanoid-plan';
import { humanoidAnchors, EXPRESSIONS, westernExpressionErrors, HEAD_PRESETS, FACE_KEYS, FACE_AGGREGATE_KEYS, FACE_MOVE_NAMES, resolveFace, validateFace, faceWarnings } from '@/lib/graph/polygonizer/humanoid-head';
import { HAIR_KEYS, HAIR_STYLE_NAMES, resolveHair, validateHair, hairWarnings, withGrownFall } from '@/lib/graph/polygonizer/humanoid-hair';
import { validateCast, resolveCast, CAST_KEYS, CAST_PRESET_NAMES } from '@/lib/graph/polygonizer/figure-cast';
import { isOutfitBuild, outfitReadout, outfitTones, OUTFIT_LAWS_VERSION } from '@/lib/graph/outfit/expand';
import { DETAIL_WORDS, KIT_WORDS, validateDress, validateDressPaint, PAINT_WORDS, validateOutfit, OUTFIT_WORDS, dressPlan, kitPalette, dressContext, libraryFeet } from '@/lib/graph/polygonizer/hero-dress';
import { isArmorBuild, armorReadout, armorFamily, armorMaterials, armorLanguage, ARMOR_LAWS_VERSION } from '@/lib/graph/armor/expand';
import { validateStatueBuild, normalizeStatue, statueHero, statueHair, statueRecipe, STATUE_LAWS_VERSION, STATUE_STYLES } from '@/lib/graph/statue/expand';
import { validateCreatureStatue } from '@/lib/graph/statue/creature';
import { mutagenErrors } from '@/lib/graph/mutagen/index';
import { rigSpecies } from '@/lib/graph/mutagen/rig';
import { MATERIAL_WORDS as STATUE_MATERIAL_WORDS, CROP_WORDS as STATUE_CROP_WORDS, BASE_WORDS as STATUE_BASE_WORDS } from '@/lib/graph/statue/principles';
import { justify } from '@/lib/graph/polygonizer/station-loft-adorn';
import { layeredClearance } from '@/lib/graph/polygonizer/station-loft-clearance';
import { layeredLegibility } from '@/lib/graph/polygonizer/station-loft-legibility';
import { fitEvidence } from '@/lib/graph/polygonizer/humanoid-head-fit';
import { ANIME_FACE, ANIME_HAIR, ANIME_FACE_KEYS, ANIME_HAIR_KEYS, ANIME_POSES, ANIME_PRESETS, resolveAnimeFace, validateAnimeFace, animeFaceWarnings, resolveAnimeHair, validateAnimeHair, animeHairWarnings, resolveAnimeExpression, validateAnimeExpression, animeExpressionWarnings, animeCoverageWarnings, animeFaceZoneWarnings, ANIME_HAIR_BASE, ANIME_HAIR_FORM_WORDS } from '@/lib/graph/polygonizer/anime-head';
import { ANIME_HAIR_STYLES } from '@/lib/graph/polygonizer/anime-head';
import { validateGenki, genkiStand } from '@/lib/graph/polygonizer/anime-genki';
import { LOOK_TABLES, validateLook, resolveLook, composeAnime, heroHeadPole as headPoleOf, animeHeroEffective as animeEffective } from '@/lib/graph/polygonizer/anime-looks';
import { ANIME_SCULPT, ANIME_SCULPT_KEYS, SCULPT_SHAPE_KEYS, validateAnimeSculpt, resolveAnimeSculpt, sparseSculpt, animeSculptWarnings, describeAnimeSculpt } from '@/lib/graph/polygonizer/anime-sculpt';
import { layeredStats, persistedLayeredLedger } from '@/lib/graph/polygonizer/station-loft-faces';
import { validateBake } from '@/lib/graph/polygonizer/surface-bake';
import { validateFieldPaint, fieldPaintReadout } from '@/lib/graph/polygonizer/field-paint';
import { validateRig, bindLayered, auditRig, layeredClip, rigNodesAt, holdGrip } from '@/lib/graph/polygonizer/station-loft-rig';
import { formSlice, physique as physiqueBuild, PHYSIQUES, PHYSIQUE_DIALS } from '@/lib/graph/polygonizer/body-relational';
import { cervicalNeck, roundOut } from '@/lib/graph/polygonizer/body-relational-builds';
import { envelopeParts } from '@/lib/graph/polygonizer/body-relational-envelope';
import { bodyPartMap } from '@/lib/graph/polygonizer/body-relational-map';
import { fieldGarment, FIELD_GARMENTS } from '@/lib/graph/polygonizer/body-relational-garment';
import { fitPlates, fieldPlates, wornPieces } from '@/lib/graph/polygonizer/body-relational-armour';
import { FOOTWEAR, FOOTWEAR_TONES, readTones } from '@/lib/graph/footwear';
import { footwearAuthored } from '@/lib/graph/footwear/adapters/authored';
import { footwear } from '@/lib/graph/footwear/adapters/realistic';
import { SUITS } from '@/lib/graph/plating';
import { plating } from '@/lib/graph/plating/adapters/realistic';
import { HANDWEAR } from '@/lib/graph/handwear';
import { handwear } from '@/lib/graph/handwear/adapters/realistic';
import { handwearAuthored } from '@/lib/graph/handwear/adapters/authored';
import { loosePants, LOOSE_GARMENTS } from '@/lib/graph/polygonizer/body-relational-drape';
import { giJacket, LOOSE_TOPS } from '@/lib/graph/polygonizer/body-relational-gi';
import { wearPieces } from '@/lib/graph/polygonizer/body-relational-wear';
import { placeSurfaceOffset, surfaceLocalOffset } from '@/lib/graph/polygonizer/surface-pin';
import { relationalHeadRecipe } from '@/lib/graph/polygonizer/hero-relational-head';
import { ONE_SKIN_RUNGS } from '@/lib/graph/polygonizer/hero-one-skin';
import { heroJewellery, heroHair, heroFaceHair } from '@/lib/graph/polygonizer/hero-head-layers';
import { readScalp, hairLevel } from '@/lib/graph/epidermis/dermal-hair';
import { heroDermisSpec } from '@/lib/graph/epidermis/dermal-hero';
import { composeFace, FACE_BUCKETS, FACE_SHAPES, FACE_FEATURES, FACE_AGE } from '@/lib/graph/polygonizer/face-compose';
import { readAncestry } from '@/lib/graph/epidermis/dermal-looks';
import { randomInt, createHash } from 'node:crypto';
import { solveTune } from '@/lib/graph/polygonizer/head-relational';
import { DERMIS_DIALS } from '@/lib/graph/epidermis/dermal-map';
import { faunaBones, motionGaits, checkBehaviors } from '@/lib/graph/fauna/rig';
import { bugBones, bugMotionGaits, bugMotionBehaviors } from '@/lib/graph/bugs/rig';
import { WINGBEATS } from '@/lib/graph/bugs/gait';
import { prepareStrokes, strokesLedger } from '@/lib/mcp/tools/layered-strokes';
import { packRecipe } from '@/lib/graph/sketch/manifest-store';
import { validateGear, gearRecord, gearMounts, gearReadout, gearBuild, gearTriangles } from '@/lib/graph/polygonizer/hero-gear';
import { isSwing, SWING_HAND, heroSwing } from '@/lib/graph/polygonizer/hero-swing';
import { expandEquipment } from '@/lib/graph/equipment/expand';
import { GESTURE_CLIP, GESTURE_WORDS, GESTURE_KEYS, STRUCTURED_SWING_BASE, heroGesture, validateGesture, resolveGesture, withGestureClip, gestureWord, standPose, poseLayered, gestureClearance, validateHeroClips, withHeroClips, heroClipSeconds, CLIP_KEYS } from '@/lib/graph/polygonizer/hero-gesture';
import { validateHeroMotion, motionPlan, locomotionClips } from '../../graph/polygonizer/hero-motion.js';
import { legGirths } from '../../graph/polygonizer/hero-stride.js';
import { targetError, readTarget, RESOLUTIONS, FRAMINGS, DEFAULT_TARGET } from '../../graph/era/target.js';
import { densityPlan, castDensityReadout } from '../../graph/era/cast-density.js';
import { eraCastConventions } from '../../graph/era/eras.js';
import { readGeocube } from '../../graph/era/geocube.js';
import { dressSurfaces, agedTones, materialsErrors, recipeTones, CREATURE_MATERIALS, genreCloth } from '@/lib/graph/materials/dress-materials';
import { GENRES } from '@/lib/graph/stylism/genres';
import { heroTarget, heroEra } from '../../graph/era/cast-light.js';
import { castSpend } from '../../graph/era/cast-spend.js';
import { facePaintDense } from '../../graph/polygonizer/face-paint.js';
import { lookReadout } from '../../graph/era/looks.js';
import { noseDialErrors, NOSE_DEFAULTS } from '../../graph/polygonizer/anime-nose.js';
import { tieredChest, tieredJoints, tieredSockets, tieredFace, tieredPole, tieredGarments, tieredKit, TIERED_FACE } from '../../graph/polygonizer/tiered-form.js';
import { drawnPlan } from '../../graph/polygonizer/creature-drawn.js';
import { compileOutfit, OUTFIT_KIND_NAMES, uOfStation } from '../../graph/polygonizer/outfit-plan.js';
import { tierKit } from '../../graph/polygonizer/adorn-tier.js';
import { styleMeasures, styleCritic, chestMeasures, chestCritic } from '../../graph/polygonizer/hero-style-critic.js';
import { stampHero, withDefaultWalk, withDefaultForm } from '../../graph/polygonizer/motion-stamp.js';
import { resolveMotion } from '../../graph/gameworld/hero-vibe.js';

/** Compile + audit + lower + the workbench plan gate, for the mint and the readouts. Throws with a pointer. */
export function planLayered(manifest) {
  let mesh;
  try { mesh = compileLayered(manifest.recipe, manifest.dials || {}, manifest.channels || {}); }
  catch (err) { throw new Error(`layered recipe: ${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  const stats = layeredStats(mesh, manifest.recipe, { units: manifest.units || 'm', seat: manifest.seat !== false });
  // a rigged recipe pays its gates at mint: bindings by declaration, rest skinning identity, every clip's keyposes solvable
  let rig = null;
  if (manifest.recipe.rig) {
    try {
      const R = validateRig(manifest.recipe.rig); const skin = bindLayered(mesh, manifest.recipe, R);
      const clips = manifest.recipe.clips || {}; for (const [name, keys] of Object.entries(clips)) layeredClip(keys, R);
      // the door's gaits (hero-motion.js) bake on this rig at mint: a gait it cannot ground refuses naming it
      if (manifest.recipe.locomotion) locomotionClips(manifest.recipe.locomotion, R);
      // a hero's stand the rig cannot solve names the field that made it (the solver's own hint is about crouch and heel
      // channels the stand's author never wrote); solved once here, before the audit poses every clip's keys
      if (manifest.hero && clips[GESTURE_CLIP]) {
        try { for (const key of clips[GESTURE_CLIP]) rigNodesAt(R, key); }
        catch (err) { throw new Error(`the stand (hero.gesture ${JSON.stringify(heroGesture(manifest.hero))}): ${err.message.replace(/ — lower the crouch.*$/, '')} — set /hero/gesture to another stand (${GESTURE_WORDS.join(', ')}) or ease the pose words that load that leg`); }
      }
      // a door clip (hero.clips) the rig cannot solve names the clip and the key, or the phase between keys the World's rig
      // pack samples (world-kinds.js packLayeredRig, 12 keys), before the audit poses every key unnamed; the rig's advice
      // is said for that key, or for the keys either side of that phase
      if (manifest.hero?.clips) for (const name of Object.keys(manifest.hero.clips)) {
        if (!Array.isArray(clips[name])) continue;
        const fn = layeredClip(clips[name], R), kp = Array.isArray(manifest.hero.clips[name]) ? '' : '.keys'; let at = '';   // `{ seconds, keys }`: its keys by path
        try { clips[name].forEach((key, i) => { at = `${kp}[${i}]`; rigNodesAt(R, key); }); for (let k = 0; k < 12; k++) { at = ` at phase ${k}/12`; rigNodesAt(R, fn(k / 12)); } }
        catch (err) {
          const advice = at.startsWith(`${kp}[`) ? err.message.replace(/, change (heel[LR]), or set rig\.reach: 'clamp'$/, ' or change $1 in that key') : err.message.replace(/ — lower the crouch, change heel[LR], or set rig\.reach: 'clamp'$/, ' — ease the keys either side of that phase (a foot planted there must still reach its toe)');
          throw new Error(`the clip '${name}' (hero.clips.${name}${at}): ${advice} — set /hero/clips/${name}`);
        }
      }
      const a = auditRig(mesh, skin, R, Object.values(clips).flat());
      if (a.badWeights || a.restIdentity > 1e-9 || a.maxPlantedDrift > 1e-9) throw new Error(`bad weights ${a.badWeights}, rest identity ${a.restIdentity}, planted drift ${a.maxPlantedDrift}`);
      rig = { bones: R.bones.length, blendedVertices: a.blended, clips: Object.keys(clips), maxLengthError: a.maxLengthError, legs: a.poses.map((p) => p.legs) };
    } catch (err) { throw new Error(`layered rig: ${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  }
  // a minted animal's MOTION (fauna/rig.js) pays its gates here too: every vertex bound to the species' skeleton with
  // valid weights, every gait one the species has and every behavior one it can be posed doing (its clips are packed
  // from the gait and behavior solvers at read time)
  if (manifest.recipe.motion && !manifest.recipe.rig) {
    try {
      // an oozed animal's motion names its species and the ooze it was made with: its own body (mutagen/rig.js)
      const M0 = manifest.recipe.motion, M = M0.ooze ? { ...M0, species: rigSpecies(M0) } : M0, bug = !!M.bug, B = bug ? bugBones(M) : faunaBones(M.species);
      if (!B) throw new Error(`unknown species '${M.species}'`);
      // a bug's motion carries its bauplan (bugs/rig.js): its gaits are the ones its parts move by, every behavior word
      const have = bug ? bugMotionGaits(M.bug, M.species || null) : motionGaits(M.species), who = bug ? 'this bug' : `'${M.species}'`;
      for (const g of M.gaits || []) if (!have.includes(g)) throw new Error(`${who} has no gait '${g}' (it can: ${have.join(', ')})`);
      if (bug) for (const w of M.behaviors || []) if (!bugMotionBehaviors().includes(w)) throw new Error(`no behavior '${w}' (the behaviors: ${bugMotionBehaviors().join(', ')})`);
      if (bug && M.wingbeat !== undefined && !(M.wingbeat > 0) && !WINGBEATS.includes(M.wingbeat)) throw new Error(`\`wingbeat\` is ${WINGBEATS.join(' | ')} or beats a second`);
      if (!bug) checkBehaviors(M.species, M.behaviors || [], M.variants || {});
      const skin = bindLayered(mesh, manifest.recipe, B);
      let bad = 0; skin.weights.forEach((w) => { if (Math.abs(w.reduce((a, b) => a + b, 0) - 1) > 1e-9 || w.some((x) => !(x >= 0))) bad++; });
      if (bad) throw new Error(`${bad} vertices with bad weights`);
      rig = { bones: B.bones.length, blendedVertices: skin.weights.filter((w) => w.filter((x) => x > 1e-9).length > 1).length, clips: [...(M.gaits || []), ...(M.behaviors || [])], species: M0.species ?? null, ...(bug ? { bug: true } : {}) };
    } catch (err) { throw new Error(`animal motion: ${err.message} — the species' gaits and behaviors: get_solid_vocab({ id: 'animals' }).`); }
  }
  return { mesh, stats: { ...stats, layered: { dials: mesh.dials, parts: Object.keys(mesh.parts).length, auditFailures: stats.auditFailures, ...(rig ? { rig } : {}) } } };
}

/** A manifest carrying a `plan` regenerates its recipe from it; one carrying `hero` regenerates the PLAN from the hero
 * record first (`from: 'plan'` keeps a hand-edited plan and re-expands it alone). Dial values for dials the new recipe
 * lacks are dropped. */
export function expandLayeredManifest(manifest, { from = 'auto' } = {}) {
  if (!manifest?.plan && !manifest?.hero) return manifest;
  const hero = manifest.hero && from !== 'plan' ? normalizeHero(manifest.hero) : manifest.hero;
  const plan = manifest.hero && from !== 'plan' ? heroPlanOf(hero) : manifest.plan;
  const recipe = expandHeroAwarePlan(plan, hero ? kittedHero(hero) : hero, hero ? null : manifest.geocube);
  const known = new Set(Object.keys(recipe.dials || {}));
  const dials = Object.fromEntries(Object.entries(manifest.dials || {}).filter(([k]) => known.has(k)));
  return { ...manifest, ...(hero ? { hero } : {}), plan, recipe, dials: resolveLayeredDials(recipe.dials || {}, dials) };
}
/** A recipe whose walk keeps the legs clear as they pass (hero-gaits.js HERO_WALK `swingClear`) carries the body's leg
 * girths on that gait (hero-stride.js legGirths), read off the recipe as built (the realistic body's own legs), so every
 * reader compiles the same walk. Any other recipe: as it was. */
function withLegGirths(recipe) {
  const L = recipe?.locomotion; if (!L || !recipe.rig) return recipe;
  const wants = Object.entries(L).filter(([, g]) => Number.isFinite(g?.spec?.walk?.swingClear));
  if (!wants.length) return recipe;
  const girths = legGirths(recipe, validateRig(recipe.rig)); if (!girths) return recipe;
  return { ...recipe, locomotion: { ...L, ...Object.fromEntries(wants.map(([n, g]) => [n, { ...g, girths }])) } };
}
/**
 * A hero in its sport's KIT (`kit`, sportswear/kits.js): the words lowered into the dress the body has, every read, so an
 * edit to the kit re-dresses it. The authored body bare with the kit painted over it (the operator's own detail and
 * paint still win and come after); the realistic body in the athlete's outfit card unless it names an outfit. The kit's
 * colours sit beneath the operator's own palette. Without a kit, the hero as it is; the record keeps the words alone.
 */
export function kittedHero(hero) {
  if (!hero || hero.kit === undefined || hero.kit === null) return hero;
  const { kit, ...rest } = hero, D = kitDress(kit, { realistic: hero.form === 'realistic' });
  const own = rest.paint === undefined ? [] : Array.isArray(rest.paint) ? rest.paint : [rest.paint];
  return {
    ...rest,
    ...(D.outfit ? { outfit: rest.outfit ?? D.outfit } : { detail: rest.detail ?? D.detail, paint: [...D.paint, ...own] }),
    palette: { ...D.tones, ...(rest.palette ?? {}) },
  };
}
/** expandPlan, except that an armour's head piece (a helm, a kabuto, a theme's helm) on the anime head refuses by
 * name: the piece is addressed on the landmark cranium, which the anime head does not carry. */
function expandHeroAwarePlan(plan, hero, geocube = null) {
  // a creature's plan may name its own materials (worn where its level names `materials`): checked whenever it is expanded
  const own = !hero && plan?.materials !== undefined ? planMaterialsErrors(plan.materials) : [];
  if (own.length) throw new Error(`plan refused: ${own.join('; ')}`);
  // a STATUE (statue/expand.js): the expanded recipe cut to its format, carved in its material, its surface tagged
  if (hero?.statue) return statueRecipeOf(expandAware(plan, hero), plan, hero);
  return withLegGirths(withDressMaterials(expandAware(plan, hero), hero, plan, geocube));
}
/** The realistic form's build (body-relational.js): the cast's pole's (male: norrin, female: shalla) under the record's
 * physique (its laws aside) */
function realisticBuild(hero) {
  // (a word patched in, `set /hero/physique 'jacked'`, reads as itself)
  const p = hero.physique ?? 'athletic', { laws = 1, ...dials } = typeof p === 'string' ? { from: p } : p;
  const name = femaleOf(hero) ? 'shalla' : 'norrin', B = physiqueBuild(name, Object.keys(dials).length ? dials : 'athletic');
  // (realistic laws 3: the neck's column leaning forward up to the skull, body-relational-builds.js CERVICAL_NECK; laws 4:
  // the limbs' masses rounded out, ROUND_OUT)
  const N = laws >= 3 ? cervicalNeck(B, name) : B;
  const R4 = laws >= 4 ? roundOut(N) : N;
  // (realistic laws 6: the crotch found no lower than 0.6 W under the hip and the pelvis's rings under it drawn in to a
  // cone, on EVERY build; laws 1 to 5 did so only under a physique with a dial set, and the athletic base, the build
  // itself byte for byte, hung the pelvis down between touching thighs to the knees: body-relational.js CROTCH)
  return laws >= 6 ? { ...R4, crotch: true } : R4;
}
/** A realistic body: the recipe re-sampled onto the build's form field (formSlice). A slice costs seconds, so slices are
 * kept by what a slice reads: the body's parts (the trunk, the limbs, the pectorals and the bust it removes, the hands it
 * may scale), the rig, the dials and the build; a hit lays the kept body onto the recipe at hand (its head, its palette,
 * whatever the dress changed there, as they are). So a world's inline hero re-expanded each render, or an edit that
 * leaves the body (the dress, the hair, the colours), finds its slice */
const SLICES = new Map(), SLICES_KEPT = 8;
const SLICE_READS = /^(torso|neck|pelvis|(upperArm|foreArm|thigh|shank|foot|toes|pectoral|bust|hand|thumb|index|middle|ring|little)[RL])$/;
function realisticRecipe(recipe, hero) {
  const B = realisticBuild(hero), reads = (parts) => Object.fromEntries(Object.entries(parts).filter(([k]) => SLICE_READS.test(k)));
  const key = JSON.stringify([reads(recipe.parts), recipe.rig, recipe.dials, B]);
  let kept = SLICES.get(key);
  if (kept) { SLICES.delete(key); SLICES.set(key, kept); }
  else {
    const out = formSlice(recipe, validateRig(recipe.rig), B).recipe;
    kept = { parts: reads(out.parts), removed: Object.keys(recipe.parts).filter((k) => SLICE_READS.test(k) && !out.parts[k]), rig: out.rig, dials: out.dials, ...(out.correctives ? { correctives: out.correctives } : {}) };
    SLICES.set(key, kept); if (SLICES.size > SLICES_KEPT) SLICES.delete(SLICES.keys().next().value);
  }
  const K = structuredClone(kept), parts = Object.fromEntries(Object.entries(recipe.parts).filter(([k]) => !K.removed.includes(k)));
  const S = { ...recipe, parts: { ...parts, ...K.parts }, rig: K.rig, dials: K.dials, ...(K.correctives ? { correctives: K.correctives } : {}) };
  // (the relational head, `head: 'relational'`, swapped in on the sliced body: hero-relational-head.js)
  if (hero.head !== 'relational') return S;
  // (realistic laws 2: the head as ONE SKIN, hero-one-skin.js; laws 1 the pieces)
  // (and under laws 2 the head's whole BUDGET by its size on screen: the skin, the globes, the hair's coats, the beard
  // and the brows on the target's rung; a hero drawn for no target its skin whole: hero-one-skin.js ONE_SKIN_RUNGS,
  // hero-head-layers.js HEAD_BUDGET)
  const laws = (hero.physique && typeof hero.physique === 'object' ? hero.physique.laws : undefined) ?? 1, one = laws >= 2;
  // (and under laws 5 its fit keeps the neck's column, so the normal bake can rebuild the skin's own field)
  const face = realisticFaceOf(hero), H = relationalHeadOn(S, femaleOf(hero) ? 'female' : 'male', face, { oneSkin: one, rung: one && hero.target ? heroHairLevel(hero) : null, column: one && laws >= 5 });
  // THE FACE'S PIERCINGS on its head (hero-head-layers.js): the composed face's, pinned to the visage, their metals'
  // colours under the palette's own
  if (!face || !H.headFit) return H;
  let out = H;
  // (each layer's colours over the plan's defaults, under the operator's own palette)
  const own = hero.palette || {}, wear = (L) => { out = { ...out, parts: { ...out.parts, ...structuredClone(L.parts) }, palette: { ...(out.palette || {}), ...L.palette, ...own } }; };
  if (face.piercings?.length) wear(jewelleryOf(H, face.piercings));
  // THE SCALP on its head (hero-head-layers.js heroHair): the composed face's cut over its ancestry's, its cards
  const scalp = faceScalp(hero, face), dermis = heroDermisSpec(faceSkin(hero)).spec;
  // (the hair's rung on the grass's ladder by the head's size on screen: the hero's target, else a third of the blades)
  const level = heroHairLevel(hero);
  if (scalp) wear(hairOf(H, dermis, scalp, level, one));
  // THE FACE'S HAIR (hero-head-layers.js heroFaceHair): a styled beard curling by the scalp's type, the brows and the
  // lashes by the ancestry's grooms with the composed face's over them
  const A = readAncestry({ id: face.ancestry, sex: femaleOf(hero) ? 'female' : 'male', seed: hero.face.seed ?? 1 });
  const epidermis = { from: 'default', hair: { ...(A.epidermis?.hair || {}), ...(face.epidermis?.hair || {}) } };
  wear(faceHairOf(H, dermis, { type: scalp ? readScalp(scalp).type : 'straight', epidermis, level, ...(one ? { budget: true } : {}) }));
  return out;
}
/** the realistic face's SCALP groom: its ancestry's (dermal-looks.js readAncestry), the composed cut in its place when the
 * face rolled one (a style), else the face's hint over the ancestry's (a peak's part, the streaks); null for none */
function faceScalp(hero, C) {
  const A = readAncestry({ id: C.ancestry, sex: femaleOf(hero) ? 'female' : 'male', seed: hero.face.seed ?? 1 });
  if (C.scalp?.style) return { ...C.scalp, seed: hero.face.seed ?? 1 };
  if (!A.scalp || A.scalp === 'none') return null;
  return C.scalp ? { ...(typeof A.scalp === 'string' ? { style: A.scalp } : A.scalp), ...C.scalp } : A.scalp;
}
/** The relational head on a sliced body, kept as the body's slice is: by what the swap reads (the neck it seals to, the
 * landmark head it is fitted to, the rig's joints, the pole), and laid onto the recipe at hand (the parts it changed or
 * added, the parts it removed, its creases, the dials it dropped, the joints it moved). A swap costs seconds */
const HEADS = new Map();
/** a head's piercings, kept by its fit and the list (the chart they are placed on costs seconds) */
const JEWELS = new Map(), HAIRS = new Map();
/** the head each laid-on slice wears, by what made it (the key it is kept by): its layers are pinned to that head's skin,
 * whose faces move with more than its fit (the neck it is cut on, the rung it is netted at), so they are kept by it */
const HEAD_OF = new WeakMap(), wornHead = (S) => HEAD_OF.get(S) ?? JSON.stringify(S.headFit);
/** a head's face hair (the beard's cards, the brows', the lashes'), kept as its scalp's are */
const FACE_HAIRS = new Map();
function faceHairOf(S, dermis, opts) {
  const key = JSON.stringify([wornHead(S), dermis, opts]);
  let H = FACE_HAIRS.get(key);
  if (!H) { H = heroFaceHair(S, dermis, opts); FACE_HAIRS.set(key, H); if (FACE_HAIRS.size > 16) FACE_HAIRS.delete(FACE_HAIRS.keys().next().value); }
  return H;
}
/** a head's hair cards, kept by its fit, its dermis and its groom (growing them costs seconds) */
function hairOf(S, dermis, scalp, level, budget = false) {
  const key = JSON.stringify([wornHead(S), dermis, scalp, level, budget]);
  let H = HAIRS.get(key);
  if (!H) { H = heroHair(S, dermis, scalp, { level, budget }); HAIRS.set(key, H); if (HAIRS.size > 16) HAIRS.delete(HAIRS.keys().next().value); }
  return H;
}
/** THE HAIR'S RUNG (dermal-hair.js HAIR_LADDER, the grass's ladder): by the head's height on screen under the hero's
 * target (era/target.js: its figure's pixels, a head about a seventh of them); a hero drawn for no target L1 */
export function heroHairLevel(hero) {
  const t = heroTarget(hero); if (!t) return 'L1';
  try { return hairLevel(readTarget(t).figurePx / HEAD_SHARE); } catch { return 'L1'; }
}
const HEAD_SHARE = 7;
function jewelleryOf(S, piercings) {
  const key = JSON.stringify([wornHead(S), piercings]);
  let J = JEWELS.get(key);
  if (!J) { J = heroJewellery(S, piercings); JEWELS.set(key, J); if (JEWELS.size > 16) JEWELS.delete(JEWELS.keys().next().value); }
  return J;
}
function relationalHeadOn(S, sex, face = null, { oneSkin = false, rung = null, column = false } = {}) {
  const own = face ? { relations: face.relations, eyes: face.eyes, ...(face.tune ? { tune: face.tune } : {}) } : {};
  const key = JSON.stringify([S.parts.neck, S.parts.cranium, S.parts.jaw, S.rig.joints, sex, own, oneSkin, rung, ...(column ? ['column'] : [])]);
  let d = HEADS.get(key);
  if (d) { HEADS.delete(key); HEADS.set(key, d); }
  else {
    const opts = { ...(rung ? { oneSkin: ONE_SKIN_RUNGS[rung] } : {}), ...(column ? { column: true } : {}) };
    const r = relationalHeadRecipe(S, { sex, ...own, oneSkin, ...(Object.keys(opts).length ? { opts } : {}) });
    d = {
      parts: Object.fromEntries(Object.entries(r.parts).filter(([k, p]) => JSON.stringify(p) !== JSON.stringify(S.parts[k]))),
      removed: Object.keys(S.parts).filter((k) => !r.parts[k]), creases: r.creases, dropped: Object.keys(S.dials || {}).filter((k) => !r.dials?.[k]), joints: r.rig.joints, headFit: r.headFit,
      // (a dial the head re-aimed: the one skin's parts in place of the cranium and the jaw)
      redialled: Object.fromEntries(Object.entries(r.dials || {}).filter(([k, v]) => S.dials?.[k] && JSON.stringify(v) !== JSON.stringify(S.dials[k]))),
    };
    HEADS.set(key, d); if (HEADS.size > SLICES_KEPT) HEADS.delete(HEADS.keys().next().value);
  }
  const D = structuredClone(d), parts = Object.fromEntries(Object.entries(S.parts).filter(([k]) => !D.removed.includes(k)));
  const dials = S.dials ? Object.fromEntries(Object.entries(S.dials).filter(([k]) => !D.dropped.includes(k)).map(([k, v]) => [k, D.redialled?.[k] ?? v])) : S.dials;
  const out = { ...S, parts: { ...parts, ...D.parts }, ...(D.creases !== undefined ? { creases: D.creases } : {}), ...(dials ? { dials } : {}), rig: { ...S.rig, joints: D.joints }, ...(D.headFit ? { headFit: D.headFit } : {}) };
  HEAD_OF.set(out, key);
  return out;
}
/** the realistic form's tune: the hero's own times the build's (its shoulders; the physique's stature and shoulders), so
 * the slice's frame finds the build's tune where it laid its masses out */
function realisticTune(hero) {
  const bt = realisticBuild(hero).tune || {}, own = hero.tune || {};
  return Object.fromEntries([...new Set([...Object.keys(own), ...Object.keys(bt)])].map((k) => [k, (own[k] ?? 1) * (bt[k] ?? 1)]));
}
/** A creature plan's own `materials` ({ <group>: <material> | false }, as an armour card's) checked → error strings. */
export function planMaterialsErrors(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['plan.materials is { <group>: <material> } (a shelf name, { metal, finish? }, or false)'];
  return Object.keys(m).includes('age') ? ['plan.materials: age is the level\'s (its geocube\'s materials), not the body\'s'] : materialsErrors(m, 'plan.materials');
}
/** A hero whose `geocube` names `materials` wears them (materials/dress-materials.js): its armour, outfit and dress groups
 * as `recipe.surfaces`, shaded as materials by the World page and the exporters, at the cube's `age`. A CREATURE does
 * the same through the manifest's own `geocube` (it has no hero record): its body's horn and shell (CREATURE_MATERIALS)
 * and its plan's `materials` standing where a hero's armour card does. Absent: the recipe as it was. */
function withDressMaterials(recipe, hero, plan = null, geocube = null) {
  const G = hero ? hero.geocube : geocube;
  if (!G) return recipe;
  const M = readGeocube(G).materials;
  if (M === undefined || M === false) return recipe;
  // a creature's groups are painted by its parts' tints (no palette): those are its tones
  const tones = hero ? recipe.palette || {} : recipeTones(recipe);
  const genre = hero?.stylism ? GENRES[hero.stylism.genre ?? 'fantasy'] : null;
  const surfaces = dressSurfaces({ palette: tones, family: hero ? armorFamily(hero.adorn) : null, cloth: genre ? genreCloth(genre.materials?.cloth) : null, card: hero ? armorMaterials(hero.adorn) : { ...CREATURE_MATERIALS, ...(plan?.materials ?? {}) }, overrides: M === true ? null : M });
  // an aged level (`materials: { age }`) repaints its aged groups' tones toward the aged metal
  const aged = surfaces && M !== true ? agedTones(tones, surfaces, M.age) : null;
  // a level that names materials dresses even a figure none of whose groups the table names: its cloth and leather take
  // the level's painted finish (world-kinds.js levelClothBake reads `surfaces`, here empty)
  return { ...recipe, ...(aged ? { palette: { ...recipe.palette, ...aged } } : {}), surfaces: surfaces ?? {} };
}
function statueRecipeOf(recipe, plan, hero) {
  // (the realistic head's own parts, the face and the nose it wears beside the plan's head, go with a lost head: the
  // parts riding the head or the jaw are the head's)
  const head = hero.form === 'realistic' ? (plan.include || []).find((i) => i.name === 'head') : null;
  const onHead = head ? Object.keys(recipe.parts).filter((n) => !head.parts?.[n] && /^(head|jaw)$/.test(typeof recipe.parts[n].bind === 'string' ? recipe.parts[n].bind : recipe.parts[n].bind?.bone ?? '')) : [];
  const cutPlan = onHead.length ? { ...plan, include: plan.include.map((i) => (i === head ? { ...i, parts: { ...i.parts, ...Object.fromEntries(onHead.map((n) => [n, recipe.parts[n]])) } } : i)) } : plan;
  const { recipe: carved, trace } = statueRecipe(recipe, cutPlan, hero.statue, { female: femaleOf(hero) });
  if (hero.form !== 'realistic') return { ...carved, statue: trace };
  // (a realistic body carved has no skin: the stone or the bronze is its surface, not the dermis an export would paint)
  const { dermis: _d, ...stone } = carved;
  // (and its bust has no stumps of the upper arms: its torso carries the shoulder's mass, and a stump cut from the arm's
  // first rings, the deltoid's, stood out past it as a disc; what was worn on them and pinned to them goes too)
  if (trace.crop !== 'bust') return { ...stone, statue: trace };
  const parts = { ...stone.parts }, gone = new Set(Object.keys(parts).filter((n) => /(^|_)upperArm[RL]$/.test(n)));
  for (let grew = true; grew;) { grew = false; for (const [n, p] of Object.entries(parts)) if (!gone.has(n) && p.pin && gone.has(p.pin.parent)) { gone.add(n); grew = true; } }
  for (const n of gone) delete parts[n];
  const dials = Object.fromEntries(Object.entries(stone.dials || {}).flatMap(([k, d]) => (Array.isArray(d.parts) ? (d.parts.some((n) => !gone.has(n)) ? [[k, { ...d, parts: d.parts.filter((n) => !gone.has(n)) }]] : []) : typeof d.part === 'string' && gone.has(d.part) ? [] : [[k, d]])));
  return { ...stone, parts, ...(stone.dials ? { dials } : {}), statue: trace };
}
/** THE REALISTIC HERO'S EXPANSION: the bare body (the plan without its dress) expanded and re-sampled onto the form
 * field, then the plan expanded again on that body (expandPlan's `body`), so the garments, the paint and the adornment
 * are made on the realistic body's rings; the slice's rig, correctives and dial blends carried over, a garment's points
 * taking its body point's correctives. Undressed, the slice itself */
const DRESS_KEYS = ['garments', 'paint', 'details', 'body', 'adorn'];
const ENVELOPED = /^(torso|neck|pelvis|(upperArm|foreArm|thigh|shank)[RL])$/;
/** The realistic hero's SKIN on its recipe: the resolved dermis (`dermis`, epidermis/dermal-hero.js heroDermisSpec: the
 * cast's preset, the palette's Skin as its tone, the door's `skin`), which an export paints, and the palette's Skin its
 * base colour, so the page, a face no texture covers and the texture agree. */
function withSkin(R, hero) {
  const { spec, base } = heroDermisSpec(faceSkin(hero));
  // an OUTFIT takes the body's suit off (the trunk and the limbs painted Top and Bottom): its garments are the clothes, the
  // body under them skin (a face they cover on the base colour, one they leave bare textured); the feet keep their shoes
  const dressed = Array.isArray(hero.outfit) ? hero.outfit.length > 0 : !!hero.outfit && hero.outfit !== 'none';
  const parts = dressed ? Object.fromEntries(Object.entries(R.parts).map(([k, p]) => [k, SUITED.test(k) && p.group !== 'Skin' && !p.garment ? { ...p, group: 'Skin' } : p])) : R.parts;
  return { ...R, parts, dermis: spec, palette: { ...(R.palette || {}), Skin: base } };
}
/** the realistic body's parts the suit paints */
const SUITED = /^(torso|pelvis|upperArm[RL]|foreArm[RL]|thigh[RL]|shank[RL])$/;

function realisticExpand(plan, hero) {
  const has = (v) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length);
  const bare = Object.fromEntries(Object.entries(plan).filter(([k]) => !DRESS_KEYS.includes(k)));
  const S = realisticRecipe(expandPlan(bare), hero);
  // THE FIELD GARMENTS: an outfit word with a body-part version (body-relational-garment.js FIELD_GARMENTS) is made on
  // the body's parts, one cloth field across its segments, in place of its segment pieces (`<word>`, `<word>Sleeve` …)
  const words = Array.isArray(hero.outfit) ? hero.outfit : typeof hero.outfit === 'string' ? [hero.outfit] : [];
  const fieldWords = words.filter((w) => FIELD_GARMENTS[w]);
  if (fieldWords.length) plan = { ...plan, garments: (plan.garments || []).filter((g) => !fieldWords.some((w) => new RegExp(`^${w}([A-Z]|$)`).test(g.id))) };
  // FOOTWEAR: a word with a footwear card (lib/graph/footwear FOOTWEAR) is the library's, in place of its segment pieces
  // (`boot…`, `shoe…`, `<word>…`)
  const footWords = words.filter((w) => FOOTWEAR[w]), footPiece = new RegExp(`^(boot|shoe|${footWords.join('|')})[A-Z]`);
  if (footWords.length) plan = { ...plan, garments: (plan.garments || []).filter((g) => !footPiece.test(g.id)) };
  // PLATING: a suit word (lib/graph/plating SUITS: a powered suit's undersuit and plates) is the library's
  const suitWords = words.filter((w) => SUITS[w]);
  // HANDWEAR: a glove word (lib/graph/handwear HANDWEAR) is the library's
  const handWords = words.filter((w) => HANDWEAR[w]);
  // LOOSE garments (body-relational-drape.js LOOSE_GARMENTS: martialPants; body-relational-gi.js LOOSE_TOPS: gi): the
  // drape's, in place of their segment pieces
  const looseWords = words.filter((w) => LOOSE_GARMENTS[w] || LOOSE_TOPS[w]);
  if (looseWords.length) plan = { ...plan, garments: (plan.garments || []).filter((g) => !looseWords.some((w) => new RegExp(`^${w}([A-Z]|$)`).test(g.id))) };
  // the rest of the GARMENTS (an outfit card's, a stylism's, a word's copy pieces, its boots and its belt) worn by the
  // tailor (body-relational-wear.js), a skirt carried down from its body; a panel, a cape or a hood left to the authored
  // kernel on the envelope
  let wear = null;
  if (plan.garments?.length || (Array.isArray(plan.paint) && plan.paint.some((x) => Array.isArray(x?.part)))) {
    // (a jacket's fronts close as the figure's do: a man's right over his left, a woman's left over her right)
    const B = realisticBuild(hero), RS = validateRig(S.rig);
    wear = wearPieces(S, RS, B, bodyPartMap(S, RS, B), plan.garments || [], plan.adorn || [], Array.isArray(plan.paint) ? plan.paint : [], plan.tailoring && { ...plan.tailoring, over: femaleOf(hero) ? 'left' : 'right' });
    // what the expander placed on a worn piece (a row of buttons, an embroidered emblem, a painted trim) moved to the cloth
    // it is now (its alias), its stations' `u` shifted where the piece was merged (and turned, `k`, on a skirt carried
    // down from its coat: its hem the lowest `u`) and a limb's `run` taken as its `u`; with no window of its own, the
    // piece's own on a merged tube; a
    // side-less limb name for both sides; what has no cloth to land on is left off
    const uOf = (sg) => { const P = S.parts[sg] ?? S.parts[`${sg}R`]; return P ? P.stations[P.stations.length - 1].u ?? 1 : 1; };
    const moved = (x) => {
      if (typeof x?.part !== 'string' || !wear.worn.has(x.part.split('_')[0])) return [x];
      const hits = [wear.alias.get(x.part), wear.alias.get(`${x.part}R`), wear.alias.get(`${x.part}L`)].filter(Boolean); if (!hits.length) return [];
      return hits.map((a) => { const sh = (r) => r.map((v) => (a.k ?? 1) * v + a.du).sort((p, q) => p - q), run = x.run && !x.u ? x.run.map((v) => v * uOf(a.seg)) : null;
        const { run: _r, ...rest } = x; return { ...(run ? rest : x), part: a.part, ...(x.s ? { s: sh(x.s) } : {}), ...(x.u ? { u: sh(x.u) } : {}), ...(run ? { u: sh(run) } : {}), ...(a.win && !x.u && !run && !x.s ? { u: a.win } : {}), ...(Array.isArray(x.over) ? { over: x.over.map((o) => wear.alias.get(o)?.part ?? o) } : {}) }; });
    };
    // (what the authored kernel still makes, a panel, a cape, a hood, hangs over the tailor's cloth: its `over`, the trunk's
    // and the legs' cloth, a cape's and a hood's the sleeves' too)
    const cloth = Object.keys(wear.parts), trunkCloth = cloth.filter((k) => /_(body|torso|pelvis|leg[RL]|thigh[RL]|shank[RL])$/.test(k)), allCloth = cloth.filter((k) => /_(body|torso|pelvis|leg[RL]|thigh[RL]|shank[RL]|arm[RL]|upperArm[RL]|foreArm[RL]|neck)$/.test(k));
    const hangs = (g) => (/^(panel|cape|hood)$/.test(g.fit) ? { ...g, over: [...(g.over || []), ...(g.fit === 'panel' ? trunkCloth : allCloth)] } : g);
    plan = { ...plan, garments: (plan.garments || []).filter((g) => !wear.worn.has(g.id)).map(hangs), ...(plan.adorn ? { adorn: plan.adorn.filter((A) => !wear.belts.has(A.id)).flatMap(moved) } : {}),
      ...(plan.body?.rows ? { body: { ...plan.body, rows: plan.body.rows.flatMap(moved) } } : {}), ...(Array.isArray(plan.paint) ? { paint: plan.paint.filter((x, i) => !wear.painted.has(i)).flatMap(moved) } : {}) };
  }
  if (!DRESS_KEYS.some((k) => has(plan[k])) && !fieldWords.length && !footWords.length && !suitWords.length && !handWords.length && !looseWords.length && !(wear && Object.keys(wear.parts).length)) return S;
  // (an adornment or a garment stood off `over` parts the slice removed, the pectorals and the bust: the torso's field
  // carries the chest now, so they stand off the torso alone; the tailor's cloth stays, which a cape hangs over)
  const kept = (o) => (Array.isArray(o) ? o.filter((p) => S.parts[p] || wear?.parts[p]) : o);
  const onBody = (xs) => (Array.isArray(xs) ? xs.map((x) => (x && x.over !== undefined ? { ...x, over: kept(x.over) } : x)) : xs);
  // (and paint addressed to a part the slice removed is the torso's there, which its own entries paint)
  const painted = (xs) => (Array.isArray(xs) ? xs.filter((x) => !x?.part || S.parts[x.part] || S.parts[`${x.part}R`] || S.parts[`${x.part}L`] || wear?.parts[x.part]) : xs);
  // the dress made on the body's ENVELOPE (body-relational-envelope.js: the skin's grid, each ring carried out over its
  // hollows as cloth and plate would lie), then the skin put back under it, with whatever the dress wrote on those parts
  // beside their points (the paint's groups)
  const env = { ...S, parts: envelopeParts(S.parts, Object.keys(S.parts).filter((k) => ENVELOPED.test(k))) };
  // (the tailor's cloth in the body the dress is made on, so a button, an emblem or a trim placed on a worn piece finds it)
  if (wear) Object.assign(env.parts, wear.parts);
  // (an armour's plates fitted: each a hollow shell over the realistic skin, sampled as densely as it; its cuirass and
  // its fauld field shells round the trunk, worn on the body the rest of the kit is baked over, so a strap, a tasset and
  // the pauldron stack over them: body-relational-armour.js)
  let kit = plan.adorn ? fitPlates(isArmorBuild(hero.adorn) ? wornPieces(onBody(plan.adorn), hero.adorn.wear) : onBody(plan.adorn), env.parts) : null;
  const shells = kit && isArmorBuild(hero.adorn) ? (() => { const B = realisticBuild(hero), RS = validateRig(S.rig); return fieldPlates(kit, S, RS, B, bodyPartMap(S, RS, B)); })() : null;
  if (shells) { kit = shells.kit; Object.assign(env.parts, shells.parts); }
  const R = expandPlan({ ...plan, ...(kit ? { adorn: kit } : {}), ...(plan.garments ? { garments: onBody(plan.garments) } : {}), ...(plan.paint ? { paint: painted(plan.paint) } : {}) }, { body: env });
  const onEnvelope = { ...R.parts };
  for (const k of Object.keys(env.parts)) if (ENVELOPED.test(k) && R.parts[k]) {
    const E = env.parts[k], D = R.parts[k], wrote = Object.keys(D).filter((f) => f !== 'stations' && JSON.stringify(D[f]) !== JSON.stringify(E[f]));
    R.parts[k] = { ...S.parts[k], ...Object.fromEntries(wrote.map((f) => [f, D[f]])) };
  }
  // a piece pinned to an enveloped part was baked in the envelope's frame there: its offsets put into the skin's frame
  // at its pin, so it stands at rest where it was made (placed by the skin's frame as baked, a hip plate swung out where
  // the envelope had bridged a hollow and turned the face)
  const l1 = (parts) => compileLayered({ schema: 'layered-v1', frame: R.frame, dials: {}, parts: Object.fromEntries(Object.entries(parts).filter(([, p]) => p.layer === 1)) }, {}, { details: false, creases: false }).parts;
  const pinned = Object.entries(R.parts).filter(([, p]) => p.pin && ENVELOPED.test(p.pin.parent));
  if (pinned.length) {
    const cE = l1(onEnvelope), cS = l1(R.parts), r6 = (v) => v.map((x) => Math.round(x * 1e6) / 1e6);
    for (const [name, P] of pinned) {
      const fE = pinFrame(cE[P.pin.parent], P.pin), fS = pinFrame(cS[P.pin.parent], P.pin), re = (o) => r6(surfaceLocalOffset(fS, placeSurfaceOffset(fE, o)));
      const offsets = Object.fromEntries(Object.entries(P.offsets || {}).map(([id, o]) => [id, re(o)]));
      let stretch = P.stretch;
      if (stretch) { const o = re(stretch.origin), t = re(stretch.origin.map((x, i) => x + stretch.axis[i])), d = t.map((x, i) => x - o[i]), l = Math.hypot(...d); stretch = { ...stretch, origin: o, axis: r6(d.map((x) => x / l)) }; }
      R.parts[name] = { ...P, offsets, ...(stretch ? { stretch } : {}) };
    }
  }
  R.rig = S.rig;
  if (S.headFit) R.headFit = S.headFit;
  // the dials: the dressed expansion's (a garment rides its body part's), the slice's blends over the new stations, a
  // part the slice removed left out
  R.dials = Object.fromEntries(Object.entries(R.dials || {}).map(([k, d]) => {
    const s = S.dials?.[k], out = { ...d, ...(Array.isArray(d.parts) ? { parts: d.parts.filter((p) => R.parts[p]) } : {}) };
    return [k, s?.blend ? { ...out, blend: { ...(d.blend || {}), ...s.blend } } : out];
  }));
  if (wear) {
    for (const [name, part] of Object.entries(wear.parts)) {
      // (the cloth went through the dress's expansion in the body, which painted its trims: that is the part kept)
      R.parts[name] = R.parts[name] ?? part;
      const seg = name.slice(name.indexOf('_') + 1);
      for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
    }
    R.palette = { ...wear.tones, ...(R.palette || {}) };
  }
  // (the trousers first, a jacket over them: its belt theirs, their sash left off, its skirt clear of them)
  const topWorn = looseWords.some((w) => LOOSE_TOPS[w]);
  for (const w of [...looseWords.filter((x) => LOOSE_GARMENTS[x]), ...looseWords.filter((x) => LOOSE_TOPS[x])]) {
    const B = realisticBuild(hero), RS = validateRig(S.rig), map = bodyPartMap(S, RS, B);
    const W = LOOSE_TOPS[w] ? giJacket(S, RS, B, map, w, { id: w, under: Object.fromEntries(Object.entries(R.parts).filter(([, p]) => p.garment)) })
      : loosePants(S, RS, B, map, topWorn ? { ...LOOSE_GARMENTS[w], sash: false } : w, { id: w });
    for (const [name, part] of Object.entries(W.parts)) {
      R.parts[name] = part;
      const seg = name.slice(name.indexOf('_') + 1);
      for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
    }
    R.palette = { ...W.tones, ...(R.palette || {}) };
  }
  for (const w of suitWords) {
    const B = realisticBuild(hero), RS = validateRig(S.rig), W = plating(S, RS, B, bodyPartMap(S, RS, B), w, { id: w });
    for (const [name, part] of Object.entries(W.parts)) {
      R.parts[name] = part;
      // (it rides its segment's dials, as a garment does)
      const seg = name.slice(name.indexOf('_') + 1);
      for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
    }
    // (the suit's tones over the palette's defaults, the operator's own palette over all; its glow full-bright)
    R.palette = { ...W.tones, ...(R.palette || {}) };
    for (const g of W.named) if (!hero.palette?.[g] && W.tones[g]) R.palette[g] = W.tones[g];
    if (W.emissive.length) R.emissive = [...new Set([...(R.emissive || []), ...W.emissive])];
  }
  for (const w of footWords) {
    const B = realisticBuild(hero), RS = validateRig(S.rig), W = footwear(S, RS, B, bodyPartMap(S, RS, B), w, { id: w });
    for (const [name, part] of Object.entries(W.parts)) {
      R.parts[name] = part;
      const seg = name.slice(name.indexOf('_') + 1);
      for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
    }
    // (the tones the card or its colourway names stand over the palette's defaults; the operator's own palette over all)
    R.palette = { ...W.tones, ...(R.palette || {}) };
    for (const g of W.named) if (!hero.palette?.[g]) R.palette[g] = W.tones[g];
    // (a tone of another group, the leather's shade, read against the palette as it now stands)
    R.palette = readTones(R.palette);
    // (heeled shoes: the rig stands every pose in them)
    if (W.stance) R.rig = { ...R.rig, stance: W.stance };
  }
  for (const w of handWords) { const B = realisticBuild(hero), RS = validateRig(S.rig); wearHands(R, hero, handwear(S, RS, B, bodyPartMap(S, RS, B), w, { id: w })); }
  if (shells?.tones) R.palette = { ...shells.tones, ...(R.palette || {}) };
  if (fieldWords.length) {
    const B = realisticBuild(hero), RS = validateRig(S.rig), map = bodyPartMap(S, RS, B);
    for (const w of fieldWords) for (const [name, part] of Object.entries(fieldGarment(S, RS, B, map, { id: w, ...FIELD_GARMENTS[w] }).parts)) {
      R.parts[name] = part;
      // (it rides its segment's dials, as a garment does)
      const seg = name.slice(w.length + 1);
      for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
    }
  }
  if (S.correctives) R.correctives = garmentCorrectives(S.correctives, R.parts);
  return R;
}
/** a body's correctives worn by its garments: a garment ring copied from a body ring (the same station id; a garment's
 * own between-rings carry `mix: [a, b, f]`, read from the body's rings either side) takes the body point's offset, slot
 * for slot, so a raised arm's pauldron lifts the sleeve with the skin under it */
function garmentCorrectives(C, parts) {
  const garments = Object.entries(parts).filter(([, p]) => p.garment && p.layer === 1);
  return C.map((c) => {
    const d = { ...c.d };
    for (const [g, G] of garments) {
      const body = g.split('_').pop(); if (!parts[body]) continue;
      for (const st of G.stations) for (const sl of G.slots) {
        let o = c.d[`${body}/${st.id}.${sl}`];
        const m = !o && st.mix;
        if (m) { const a = c.d[`${body}/${m[0]}.${sl}`], b = c.d[`${body}/${m[1]}.${sl}`], t = m[2]; if (a || b) o = [0, 1, 2].map((i) => Math.round(((a?.[i] ?? 0) * (1 - t) + (b?.[i] ?? 0) * t) * 1e6) / 1e6); }
        if (o) d[`${g}/${st.id}.${sl}`] = o;
      }
    }
    return { ...c, d };
  });
}
/** a handwear word's parts worn on the recipe `R` (in place): each riding its segment's dials, the card's tones over the
 * palette's defaults (the operator's own over all, a tone of another group read), and a mitten's grip held at rest (the
 * digits and their joints closed into it, the body's and the glove's, so the bind, every pose and an export hold the
 * hand inside the shell) */
function wearHands(R, hero, W) {
  for (const [name, part] of Object.entries(W.parts)) {
    R.parts[name] = part;
    const seg = name.slice(name.indexOf('_') + 1);
    for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
  }
  R.palette = { ...W.tones, ...(R.palette || {}) };
  for (const g of W.named) if (!hero.palette?.[g]) R.palette[g] = W.tones[g];
  R.palette = readTones(R.palette);
  if (W.grip) { const H = holdGrip(R.rig, R.parts, W.grip); R.rig = H.rig; Object.assign(R.parts, H.parts); }
}
/** the AUTHORED body's wearables: the handwear words on its hands (lib/graph/handwear, the authored adapter) */
function authoredWear(R, hero) {
  const words = Array.isArray(hero?.outfit) ? hero.outfit : typeof hero?.outfit === 'string' ? [hero.outfit] : [];
  const handWords = words.filter((w) => HANDWEAR[w]);
  if (handWords.length && R.rig?.hands) for (const w of handWords) wearHands(R, hero, handwearAuthored(R, validateRig(R.rig), w, { id: w }));
  // the FOOTWEAR library's cards on the bare foot the plan kept for them (lib/graph/footwear, the authored adapter)
  for (const w of libraryFeet(hero?.outfit)) { const W = footwearAuthored(R, validateRig(R.rig), w, { id: w }); if (W) wearFeet(R, hero, W, w); }
  return R;
}
/** a footwear card's pieces into the authored recipe, as the realistic body's are: its parts beside the foot's (in the
 * foot's dials), its tones over the palette's defaults and under the operator's, and a heeled card's stance on the rig */
function wearFeet(R, hero, W, id) {
  // (a closed shoe's foot is not drawn: the leather is made and weighted off it first, and the game foot's boxy sections
  // stood past the toe cap the library tucks the leather under; a sandal's foot stays, the straps and the sole on it)
  for (const S of ['R', 'L']) if (W.parts[`${id}_foot${S}`]) {
    const gone = new Set([`foot${S}`, ...['hallux', 'toe2', 'toe3', 'toe4', 'toe5'].map((t) => `${t}${S}`)]);
    for (const n of gone) delete R.parts[n];
    for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts)) d.parts = d.parts.filter((n) => !gone.has(n));
  }
  for (const [name, part] of Object.entries(W.parts)) {
    R.parts[name] = part;
    const seg = name.slice(name.indexOf('_') + 1);
    for (const d of Object.values(R.dials || {})) if (Array.isArray(d.parts) && d.parts.includes(seg) && !d.parts.includes(name)) d.parts.push(name);
  }
  R.palette = { ...FOOTWEAR_TONES, ...W.tones, ...(R.palette || {}) };
  for (const g of W.named || []) if (!hero.palette?.[g]) R.palette[g] = W.tones[g];
  R.palette = readTones(R.palette);
  if (W.stance) R.rig = { ...R.rig, stance: W.stance };
}
function expandAware(plan, hero) {
  // a creature drawn for its target (creature-drawn.js: `style.drawn`): bridged and densified first; absent, the plan itself
  // an OUTFIT designed for the whole body (outfit-plan.js) compiles first, in layer order; absent, the plan itself
  try { const full = drawnPlan(compileOutfit(plan)); return hero?.form === 'realistic' ? withSkin(realisticExpand(full, hero), hero) : authoredWear(expandPlan(full), hero); } catch (err) {
    if (hero?.head === 'anime' && isArmorBuild(hero.adorn) && /off cranium/.test(err.message)) {
      throw new Error("hero refused: adorn: this armour's head piece (a helm, a kabuto, or a theme's helm) is not fitted to the anime head yet; wear it with head 'landmark' or 'none', or choose a plate style with no head piece");
    }
    throw err;
  }
}

/** An anime hero's LOOK stamp kept with its words: re-resolved only when the list changed (a re-tuned look word never
 * changes a stored row until its list is edited); an emptied or removed look drops its stamp. Anything else as given. */
export function normalizeHero(hero) {
  // the door's clips stay sparse after a patch under /hero/clips (the last one removed, or the field set to null, drops it)
  if (hero && hero.clips !== undefined && (hero.clips === null || !Object.keys(hero.clips).length)) { const { clips: _c, ...rest } = hero; hero = rest; }
  // the ambient blink is stored only when off: a patch setting it back on (true, null) drops the field
  if (hero && hero.blink !== undefined && hero.blink !== false) { const { blink: _b, ...rest } = hero; hero = rest; }
  // genki set back to 0 (or null) by a patch drops the field
  if (hero && hero.genki !== undefined && !(Number.isFinite(hero.genki) && hero.genki > 0)) { const { genki: _g, ...rest } = hero; hero = rest; }
  // a face or a tune patched in as a word or a list (update_character's spec, a /hero/face set) is resolved as heroRecord
  // resolves it at mint, so an edit stores what a mint stores; read raw, a list stacked among composeAnime's layers is
  // taken for an object of controls and draws the base (the anime face, the anime tune)
  if (hero) hero = resolveHeroWords(hero);
  if (!hero || hero.head !== 'anime') return hero;
  // the graphic face's layer is kept sparse after a patch under /hero/sculpt (a word set back to the base drops out; an
  // emptied or null sculpt drops the field); a record without one is as it was
  if (hero.sculpt !== undefined) { const sc = hero.sculpt === null ? null : sparseSculpt(resolveAnimeSculpt(hero.sculpt)); const { sculpt: _s, ...rest } = hero; hero = sc === null ? rest : { ...hero, sculpt: sc }; }
  // the hair form words stay sparse after a patch under /hero/hair (a word set to null drops out: the base's stands)
  if (hero.hair && typeof hero.hair === 'object' && ANIME_HAIR_FORM_WORDS.some((k) => hero.hair[k] === null)) hero = { ...hero, hair: Object.fromEntries(Object.entries(hero.hair).filter(([k, v]) => !(ANIME_HAIR_FORM_WORDS.includes(k) && v === null))) };
  const words = hero.look === undefined || hero.look === null ? [] : Array.isArray(hero.look) ? hero.look : [hero.look];
  if (!words.length) { if (hero.look === undefined && hero.lookResolved === undefined) return hero; const { look: _l, lookResolved: _r, ...rest } = hero; return rest; }
  if (hero.lookResolved && JSON.stringify(hero.lookResolved.words) === JSON.stringify(words)) return Array.isArray(hero.look) ? hero : { ...hero, look: words };
  return { ...hero, look: words, lookResolved: resolveLook(words) };
}
/** heroRecord's resolution of the ratio fields it stores resolved (the tune, the face), applied to a WORD or a LIST only
 * (an object is already one layer and kept as given), with the move trail (`from`, `faceFrom`) set from the new value or
 * dropped when it names no move. `look` and `sculpt` are normalizeHero's own; `hair`, `expression` and `gesture` are
 * read as lists where they are composed (composeAnime, resolveGesture) and stay as given. */
function resolveHeroWords(hero) {
  const words = (v) => typeof v === 'string' || Array.isArray(v);
  const resolveFaceOf = { landmark: resolveFace, anime: resolveAnimeFace }[hero.head ?? 'landmark'];
  if (!words(hero.tune) && !(resolveFaceOf && words(hero.face))) return hero;
  const out = { ...hero };
  const withTrail = (field, trailKey, resolve) => { const { from, ...v } = resolve(out[field]); out[field] = v; if (from) out[trailKey] = from; else delete out[trailKey]; };
  if (words(out.tune)) withTrail('tune', 'from', (t) => { const { from, ...v } = resolveTune(t); return { ...storedTune(v), ...(from ? { from } : {}) }; });
  if (resolveFaceOf && words(out.face)) withTrail('face', 'faceFrom', resolveFaceOf);
  return out;
}

// ─── The hero door ────────────────────────────────────────────────────────
/** the base forms a hero may name: 'tiered' (tiered-form.js: the game body, stamped at mint when none is named,
 * motion-stamp.js withDefaultForm), 'realistic' (body-relational.js: the body re-sampled onto the form field, dialled by
 * a `physique`), 'classic' (deprecated: the game body before the tiered form, what a hero stored without a form reads) */
export const HERO_FORMS = Object.freeze(['tiered', 'realistic', 'classic']);
/** the deprecated streamlined core: still read on a hero that names it (the classic body carries it), said on its readout */
/** the deprecated classic body: still read on a hero that names it or was stored without a form, said on its readout */
export const CLASSIC_DEPRECATED = "the classic body (form: 'classic', or a hero stored without a form) is deprecated: the game body is the tiered form (set /hero/form to 'tiered')";
const onClassic = (hero) => hero.form === 'classic' || ((hero.form === undefined || hero.form === null) && hero.core !== 'streamlined');
export const STREAMLINED_DEPRECATED = "the streamlined core (core: 'streamlined') is deprecated: the game body is the tiered form on the structured core (drop /hero/core); a hero that keeps it is built on the classic body";
/** the realistic body's laws (body-relational.js: its builds, the physique's dials, the slice): stamped on the record's
 * `physique` at mint, so a later retune never moves a stored hero. 2: the relational head as ONE SKIN (hero-one-skin.js);
 * 3: the neck's column leaning forward up to the skull (body-relational-builds.js CERVICAL_NECK); 4: the limbs' masses
 * rounded out, each joint filled between its bellies (body-relational-builds.js ROUND_OUT); 5: the one skin's relief
 * baked from its own field into a normal map on the lit engine export (epidermis/dermal-relief.js; its fit keeps the
 * neck's column it was joined to, `headFit.column`, so the field can be rebuilt), the body as laws 4 built it; 6: the
 * crotch and the pelvis's cone under it on every build, the athletic base included (body-relational.js, the hip's
 * handover) */
export const REALISTIC_LAWS_VERSION = 6;
export const HERO_FIELDS = ['cast', 'register', 'tune', 'body', 'girth', 'headScale', 'scale', 'palette', 'head', 'face', 'hair', 'expression', 'headPreset', 'look', 'proportions', 'detail', 'adorn', 'paint', 'outfit', 'gesture', 'sculpt', 'clips', 'blink', 'gear', 'core', 'statue', 'genki', 'motion', 'target', 'geocube', 'form', 'physique', 'skin', 'painterly', 'stylism', 'laws', 'kit'];
/** what the hero door takes beside a hero's own words: the mint's (the layered kind's top-level keys) and `vibe` */
export const HERO_DOOR_KEYS = Object.freeze(['title', 'ref', 'folder_ref', 'toon', 'dials', 'channels', 'units', 'facing', 'seat', 'hullShade', 'bake', 'fieldPaint', 'rim', 'strokes', 'vibe', 'egocube']);
/** where a word the hero door does not take belongs: the words agents guess, then the nearest known word */
const KEY_HOMES = Object.freeze({
  bulk: "muscle is the realistic body's physique: form: 'realistic', physique: { bulk }", muscle: "muscle is the realistic body's physique: form: 'realistic', physique: { bulk, tone }", muscles: "muscle is the realistic body's physique: form: 'realistic', physique: { bulk, tone }",
  tone: "tone is the realistic body's physique: form: 'realistic', physique: { tone }", weight: "weight is the realistic body's physique: form: 'realistic', physique: { weight }", fat: "fat is the realistic body's physique: form: 'realistic', physique: { weight }",
  build: "a build is the cast's: cast: { pole: 'female' | 'male', build: '<build>' }",
  pole: "the pole is the cast's: cast: { pole: 'female' | 'male', build? }",
  age: "a child is the cast's child build: cast: { pole, build: 'child' }",
  height: 'height is a tune: tune: { stature: <ratio to the cast> }', stature: 'stature is a tune: tune: { stature }',
  jersey: "a sport's kit is kit: '<sport>' | { sport, colours, pattern } (sportswear/kits.js)", uniform: "a sport's kit is kit: '<sport>' | { sport, colours, pattern } (sportswear/kits.js)", sportswear: "a sport's kit is kit: '<sport>' | { sport, colours, pattern }", strip: "a sport's kit is kit: '<sport>' | { sport, colours, pattern }",
  colour: 'colours are the palette: palette: { … }', color: 'colours are the palette: palette: { … }', colors: 'colours are the palette: palette: { … }', colours: 'colours are the palette: palette: { … }',
  clothes: 'clothes are detail (a word) or outfit (garments that follow the body)', clothing: 'clothes are detail (a word) or outfit', dress: 'clothes are detail (a word) or outfit', armor: "armour is an adorn build: adorn: { type: 'armor', style }", armour: "armour is an adorn build: adorn: { type: 'armor', style }",
  weapon: "held things are gear: gear: { right: { item: 'sword' } }", item: "held things are gear: gear: { right: { item } }", items: 'held things are gear: gear: { right, left, back, hip }',
  pose: 'the stand is gesture', stance: 'the stand is gesture (or a ready stance in motion)', animation: 'moves are motion (gaits and moves by word) or clips (your own keys)', animations: 'moves are motion or clips', walk: 'a walk is motion: motion: { walk }',
  wings: "a body beyond a person is a creature (create_character as: 'creature', a ring plan) or an animal (as: 'animal')", tail: "a body beyond a person is a creature (as: 'creature') or an animal (as: 'animal')", horns: "a body beyond a person is a creature (as: 'creature')",
  fieldPaint: "field paint is the row's, beside bake: update_character { patch: [{ op: 'set', path: '/fieldPaint', value: [{ part, chart, shape, group, color }] }] }",
  bake: "the bake is the row's, beside toon: update_character { patch: [{ op: 'set', path: '/bake', value: true | { finish, strength } }] }",
  plan: "a ring plan is a creature's (create_character as: 'creature'); the hero door makes its own", recipe: "a recipe is a creature's (as: 'creature', or mint_solid kind 'layered')", species: "a species is an animal (create_character as: 'animal')",
});
// the optimal-string-alignment distance: a swapped pair of letters ('hiar') is one edit, as people type it
const editDistance = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[a.length][b.length]; };
/** The refusal line for a word the hero door does not take. */
export function heroKeyHint(k) {
  const home = KEY_HOMES[k] ?? KEY_HOMES[k.toLowerCase()];
  if (home) return `${k}: not a hero word; ${home}`;
  const near = [...HERO_FIELDS, 'vibe'].map((w) => [w, editDistance(k.toLowerCase(), w.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
  return `${k}: not a hero word${near && near[1] <= Math.max(2, Math.floor(k.length / 3)) ? ` (did you mean ${near[0]}?)` : ''}; the hero's words are ${HERO_FIELDS.filter((w) => w !== 'laws').join(', ')}, and vibe`;
}
/**
 * `vibe` on the door: words for how the hero moves (hero-vibe.js VIBES), lowered at mint into the gaits' dials and a
 * stand, as the character book's motion page lowers them; the hero's own `motion` gaits and `gesture` win. Stored as
 * the motion it lowers to, never as the words. → { spec, vibe } (vibe: the readout's { read, unread, reasons }).
 */
export function lowerVibe(spec, vibe) {
  if (vibe === undefined || vibe === null) return { spec, vibe: null };
  const R = resolveMotion({ vibe });
  const motion = R.motion ? { ...R.motion, ...(spec.motion && typeof spec.motion === 'object' ? spec.motion : {}) } : spec.motion;
  return {
    spec: { ...spec, ...(motion !== undefined ? { motion } : {}), ...(spec.gesture === undefined && R.gesture ? { gesture: R.gesture } : {}) },
    vibe: { read: R.vibe, unread: R.unread, reasons: R.reasons },
  };
}
const HEAD_WORDS = ['landmark', 'anime', 'none', 'relational'];
/** the heads that take face / hair / expression / headPreset words */
const WORN = new Set(['landmark', 'anime']);
const headOf = (hero) => hero.head ?? 'landmark';
/** a head whose rig carries a jaw chain (a door clip's `jaw`): the landmark head, or an include with a `jawHinge` joint
 * (hero-form.js decides the chain the same way) */
const jawedHead = (hero) => headOf(hero) === 'landmark' || headOf(hero) === 'relational' || !!hero.head?.joints?.jawHinge;
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
/** a hero whose cast reads female (a statue card drapes and paints by silhouette) */
const femaleOf = (hero) => castOf(hero.cast, hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero'))?.silhouette === 'female';
/** the cast word a stand's preset entry is read for (hero-gesture.js castEntry): the build form's build, whose body the
 * preset's arm swing was tuned to clear, else its pole; any other cast as given */
const gestureCast = (cast) => (isBuiltCast(cast) ? (cast.build && cast.build !== 'canonical' ? cast.build : castPole(cast)) : cast);

/** the figure casts that read as a child (figure-cast.js) and the anime look that says so (anime-looks.js `kid`) */
// the child-coded words are the builds that carry a child's body (hero-form.js HERO_BUILDS `child`): one list, not two
export const CHILD_CODED_CASTS = Object.freeze(HERO_BUILD_NAMES.filter((b) => HERO_BUILDS[b].child));
const CHILD_CODED_LOOKS = Object.freeze(['kid']);
/** why a cast is child-coded, read off the RESOLVED cast, or null: the word, the build form's build, a preset a list or a
 * dial map names (figure-cast resolveCast's `from`), or dials equal to a child-coded preset's */
function childCast(cast) {
  if (cast === undefined || cast === null) return null;
  if (typeof cast === 'string') return CHILD_CODED_CASTS.includes(cast) ? `the '${cast}' cast` : null;
  if (isBuiltCast(cast)) return CHILD_CODED_CASTS.includes(cast.build) ? `the '${cast.build}' build` : null;
  if (validateCast(cast).length) return null;   // a malformed cast is refused by name on its own
  const R = resolveCast(cast), named = (R.from ?? '').split('+').find((w) => CHILD_CODED_CASTS.includes(w));
  if (named) return `the cast on '${named}'`;
  const same = CHILD_CODED_CASTS.find((w) => { const C = resolveCast(w); return CAST_KEYS.every((k) => R[k] === C[k]); });
  return same ? `the cast resolving to '${same}'` : null;
}
/** why a hero spec is child-coded (its resolved cast, or a look word), or null */
function childCoding(spec) {
  const cast = childCast(spec.cast); if (cast) return cast;
  const looks = spec.look === undefined || spec.look === null ? [] : Array.isArray(spec.look) ? spec.look : [spec.look];
  const kid = looks.find((w) => CHILD_CODED_LOOKS.includes(w));
  return kid ? `the '${kid}' look` : null;
}

/** THE REALISTIC BODY DEPICTS ADULTS. A child-coded hero asked of it (`childCoding`: a child or chibi figure cast, or
 * the anime 'kid' look) is that cast's stylized western figure instead, the authored body, its colours keyed the same:
 * the realistic skin's colour (its tone, as the dermis reads it) the palette's `Skin` unless the palette names one, every
 * palette key as given; the realistic body's own keys (the form, the physique, the skin, its relational head and its
 * face) left off.
 * The dress words carry over as they are: both bodies read the same outfit language. Any other spec as it is. */
export function adultsOnly(spec) {
  if (!spec || typeof spec !== 'object' || spec.form !== 'realistic' || !childCoding(spec)) return spec;
  const { form: _f, physique: _p, skin, head, ...rest } = spec;
  // (the realistic face's words are its own head's: the stylized head keeps its own)
  if (realisticFaced(spec)) delete rest.face;
  let Skin = rest.palette?.Skin ?? null;
  if (!Skin && skin && typeof skin === 'object') try { Skin = heroDermisSpec({ cast: castPole(rest.cast) ?? 'male', palette: rest.palette, skin }).base; } catch { Skin = null; }
  return { ...rest, ...(head !== undefined && head !== 'relational' ? { head } : {}), ...(rest.palette || Skin ? { palette: { ...(rest.palette || {}), ...(Skin ? { Skin } : {}) } } : {}) };
}

/** Error strings for a hero spec (empty = valid). Form only; the numbers' fitness is heroPlan's to judge.
 * `staleScale` tolerates a `scale` on a worn head (which the worn heads never read): a spec re-recorded on every render
 * (a world's inline hero) was written before the refusal and must keep rendering. */
export function validateHeroSpec(spec, { staleScale = false } = {}) {
  spec = adultsOnly(spec);
  const errs = [];
  const casts = [...Object.keys(HERO_CASTS), ...CAST_PRESET_NAMES];
  if (spec.cast !== undefined) {
    if (typeof spec.cast === 'string') { if (!HERO_CASTS[spec.cast]) errs.push(...validateCast(spec.cast, 'cast').map((e) => `${e} — or a hero cast (${Object.keys(HERO_CASTS).join(', ')}), or a pole with a build: { pole: 'female', build: '${spec.cast}' }`)); }
    else if (isBuiltCast(spec.cast)) errs.push(...validateBuiltCast(spec.cast, 'cast'));
    else errs.push(...validateCast(spec.cast, 'cast'));
  }
  if (spec.register !== undefined && !(typeof spec.register === 'string' ? REGISTERS[spec.register] : spec.register && typeof spec.register === 'object' && typeof spec.register.slots === 'string' && typeof spec.register.limbSlots === 'string' && Number.isFinite(spec.register.e))) {
    errs.push(`register: a register word (${Object.keys(REGISTERS).join(', ')}) or { slots, limbSlots, e }`);
  }
  errs.push(...validateTune(spec.tune));
  errs.push(...validateGenki(spec));
  errs.push(...validateHeroMotion(spec.motion));
  if (spec.body !== undefined) {
    if (!spec.body || typeof spec.body !== 'object' || Array.isArray(spec.body)) errs.push(`body: an object of radii in metres (have ${Object.keys(BODY_DEFAULTS).join(', ')}); for PERCENTAGES of the cast use tune`);
    else for (const k of Object.keys(spec.body)) if (!(k in BODY_DEFAULTS)) errs.push(`body.${k}: not a body control (have ${Object.keys(BODY_DEFAULTS).join(', ')}); a proportion word (${TUNE_KEYS.join(', ')}) belongs in tune`);
    // a CHILD-CODED figure (a child or chibi figure cast, or the anime 'kid' look) takes no bust, at mint and on every edit
    const coded = childCoding(spec);
    if (coded && spec.body && typeof spec.body === 'object' && spec.body.bust !== undefined && spec.body.bust !== 0) errs.push(`body.bust: ${coded} is a child-coded figure and takes no bust; remove body.bust (0 is the only value it takes)`);
  }
  for (const k of ['girth', 'headScale', 'scale']) if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] > 0)) errs.push(`${k}: must be a finite number > 0`);
  if (spec.palette !== undefined) {
    if (!spec.palette || typeof spec.palette !== 'object') errs.push('palette: { Skin, Top, Bottom, Shoes: "#rrggbb" }');
    else for (const [g, v] of Object.entries(spec.palette)) if (!isHex(v)) errs.push(`palette.${g}: must be a "#rrggbb" colour`);
  }
  if (spec.head !== undefined && spec.head !== null && !HEAD_WORDS.includes(spec.head) && !(spec.head && typeof spec.head === 'object' && spec.head.parts && typeof spec.head.parts === 'object')) {
    errs.push(`head: 'landmark' (the fitted landmark head, the default), 'anime' (the Anime Form Studio's head), 'relational' (the relational head, on the realistic body), 'none' (a blank head trunk), or a baked head include { parts, dials?, creases?, palette?, joints, bind } (docs/examples/hero-head baked.json)`);
  }
  if (spec.head === 'anime') {
    errs.push(...validateAnimeFace(spec.face));
    if (spec.hair !== 'none') errs.push(...validateAnimeHair(spec.hair));
    errs.push(...validateAnimeExpression(spec.expression));
    if (spec.headPreset !== undefined && !ANIME_PRESETS.includes(spec.headPreset)) errs.push(`headPreset: one of ${ANIME_PRESETS.join(', ')} (the anime head's design base; defaults to the cast when it is male / female, else male)`);
    errs.push(...validateLook(spec.look));
    errs.push(...validateAnimeSculpt(spec.sculpt));
    if (spec.painterly !== undefined && spec.painterly !== null && spec.painterly !== true && !(spec.painterly && typeof spec.painterly === 'object' && !Array.isArray(spec.painterly))) errs.push('painterly: true is the painterly toon look: the face painted into a texture (the eyes, lashes, brows and mouth on a smooth face, in place of the feature slabs) and a soft edge between the light and the shade; { nose: { profile, width } } sets its nose dials; null or absent is the slab face and the hard step');
    else if (spec.painterly && typeof spec.painterly === 'object') { for (const k of Object.keys(spec.painterly)) if (k !== 'nose') errs.push(`painterly.${k}: not a painterly dial (nose)`); errs.push(...noseDialErrors(spec.painterly.nose, 'painterly.nose')); }
  } else {
    if (spec.look !== undefined && spec.look !== null) errs.push(`look: the looks are the anime head's (head: 'anime')`);
    if (spec.sculpt !== undefined && spec.sculpt !== null) errs.push(`sculpt: the graphic face is the anime head's (head: 'anime')`);
    if (spec.painterly !== undefined && spec.painterly !== null) errs.push(`painterly: the painterly look is the anime head's (head: 'anime')`);
    if (!realisticFaced(spec)) errs.push(...validateFace(spec.face));
    errs.push(...validateHair(spec.hair));
    errs.push(...westernExpressionErrors(spec.expression));
    if (spec.headPreset !== undefined && !HEAD_PRESETS[spec.headPreset]) errs.push(`headPreset: one of ${Object.keys(HEAD_PRESETS).join(', ')} (the head's pole and fit; defaults to the cast when it is male / female, else male)`);
  }
  errs.push(...validateDress({ detail: spec.detail, adorn: spec.adorn }));
  errs.push(...validateDressPaint(spec.paint));
  errs.push(...validateOutfit(spec.outfit));
  errs.push(...validateStylism(spec.stylism));
  errs.push(...readKit(spec.kit));
  if (isOutfitBuild(spec.outfit) && Array.isArray(spec.outfit.pieces)) for (const [i, P] of spec.outfit.pieces.entries()) if (P && typeof P.kind === 'string' && !OUTFIT_KIND_NAMES.includes(P.kind)) errs.push(`outfit.pieces[${i}].kind: '${P.kind}' is not a piece (${OUTFIT_KIND_NAMES.join(', ')})`);
  // the hand's words (wrist, fingers) on a hero whose hand has them: the structured core
  const hands = (spec.core ?? DEFAULT_CORE) === 'structured';
  errs.push(...validateGesture(spec.gesture, 'gesture', { hands }));
  // the door's clips: the stand's pose words and the clip words; `jaw` only on a head with a jaw bone (jawedHead); a key's
  // `face` on the anime head (its expression), the landmark head and the realistic body's relational head (`western`:
  // their channels, western-face-rig.js; the relational face weighs the same, relational-face-rig.js); a clip's
  // `seconds` only on the anime head
  const landmark = spec.head === undefined || spec.head === 'landmark', relational = spec.head === 'relational' || (spec.form === 'realistic' && spec.head === undefined);
  errs.push(...validateHeroClips(spec.clips, { jaw: jawedHead(spec), face: spec.head === 'anime', western: landmark || relational, expression: landmark, hands }));
  if (spec.blink !== undefined && spec.blink !== null) {
    if (spec.head !== 'anime' && !landmark) errs.push(`blink: the ambient blink is the anime or the landmark head's (head: 'anime' | 'landmark')`);
    else if (typeof spec.blink !== 'boolean') errs.push('blink: false turns the hero\'s ambient blink off (true is the default and not stored)');
  }
  errs.push(...validateGear(spec.gear));
  if (spec.statue !== undefined && spec.statue !== null) errs.push(...validateStatueBuild(spec.statue, spec));
  if (isSwing(spec.gesture) && !spec.gear?.[SWING_HAND[spec.gesture]]) errs.push(`gesture '${spec.gesture}' swings the ${SWING_HAND[spec.gesture]} hand's gear: add gear.${SWING_HAND[spec.gesture]} (an item's build words, e.g. { item: '${spec.gesture === 'bash' ? 'shield' : spec.gesture === 'plant' ? 'staff' : 'sword'}' })`);
  if (spec.proportions !== undefined && !PROPORTION_WORDS.includes(spec.proportions)) errs.push(`proportions: 'anime' (about 6.5 / 7 heads tall: the default with the anime head), 'hero' (the realistic casts: the default with the landmark head) or 'herobot' (the hero robot's toy-hero body, about 4.5 heads tall: a big head, short arms and torso, big hands and feet)`);
  if (spec.core !== undefined && !HERO_CORES.includes(spec.core)) errs.push(`core: 'structured' (the default: the vajra core, a pelvis bone turned by the hip line alone and a lumbar bone, the pelvis part, converged legs) or 'streamlined' (the hero before it, deprecated: the classic body only)`);
  // what the hero is drawn for (era/target.js) and the level's look (era/geocube.js): a cube is checked as a stage checks one
  if (spec.target !== undefined && spec.target !== null && targetError(spec.target)) errs.push(`${targetError(spec.target)} — what the hero is drawn for: its rings hold the outline within \`error\` pixels there`);
  if (spec.geocube !== undefined && spec.geocube !== null) { try { readGeocube(spec.geocube); } catch (e) { errs.push(`${e.message} — the cube whose light the hero is baked in (a preset id, a document or { from, … })`); } }
  if (spec.laws !== undefined && !(Number.isInteger(spec.laws) && spec.laws >= 1 && spec.laws <= HERO_LAWS_VERSION)) errs.push(`laws: ${spec.laws} is unknown — this kernel carries hero laws 1 … ${HERO_LAWS_VERSION} (stamped at mint; leave it out)`);
  if (spec.form !== undefined && spec.form !== null && !HERO_FORMS.includes(spec.form)) errs.push(`form: ${HERO_FORMS.map((f) => `'${f}'`).join(' | ')} (the tiered base, the game body and the default at mint: triangles spent where the eye reads them, detail added by tier; the realistic body: the anatomy on one skin, dialled by physique; the classic body, deprecated: the game body before it, and what a hero stored without a form reads)`);
  const wearsHead = spec.head === undefined || WORN.has(spec.head);
  // the worn heads (humanoid-plan.js) size the figure by the cast and tune.stature alone and never read `scale`
  if (wearsHead && spec.scale !== undefined && !staleScale) errs.push(`scale: the ${headOf(spec)} head's figure takes its height from tune.stature (a ratio to the cast's own height: tune: { stature: 0.85 }); scale sizes only the blank trunk (head: 'none') or a baked head include`);
  if (!wearsHead) for (const k of [...(realisticFaced(spec) ? [] : ['face']), 'hair', 'expression', 'headPreset']) if (spec[k] !== undefined) errs.push(`${k}: only the landmark head or the anime head takes it (head: 'landmark' | 'anime')`);
  // a worn head sizes its figure from one named cast (humanoid-plan.js wornHead): a list or a dial map is the blank trunk's
  if (wearsHead && spec.cast !== undefined && typeof spec.cast !== 'string' && !isBuiltCast(spec.cast)) errs.push(`cast: a list or a dial map builds only the blank trunk (head: 'none'); the ${headOf(spec)} head takes a cast word or a pole with a build ({ pole: 'female', build: 'brute' })`);
  // the tiered form's joints and sockets are cut on the structured core's pelvis and lumbar bones
  if (spec.form === 'tiered' && spec.core === 'streamlined') errs.push("form: 'tiered' builds on the structured core (its joints are cut on the pelvis and lumbar bones); drop core: 'streamlined', or the tiered form");
  errs.push(...realisticErrors(spec));
  return errs;
}

/** THE REALISTIC HERO'S FACE (face-compose.js: a face composed per feature, its features agreeing by their character).
 * Its words: `seed` (the roll: another seed, another face), `ethnicity` (FACE_ETHNICITIES: a population whose rolls it
 * takes; a list of base ones, a mix of them), `want` ({ feature: shape }: the face aimed, the shapes named in place of
 * the roll's, the rest the seed's), `character` ([soft −1 … angular 1, delicate −1 … strong 1]), `accent` (one feature
 * taken far from the rest, or false), `nose` (its axis, short and flat −1 … long and pointed 1), `beauty` (0 every roll
 * at its full reach … 1 the population's mean, the asymmetry slight) and `age` (years; the roll is the person at prime).
 * THE HEROIC BASELINE (HERO_FACE): a hero's face drawn toward its population's harmonious mean, at prime age. Composed
 * on every read: the face's relations and eyes shape the relational head, its skin (the ancestry's tone, undertone and
 * hair colour, the hairline, the marks, the beard, the years) lies under the hero's own `skin`. */
export const HERO_FACE = Object.freeze({ beauty: 0.75 });
export const FACE_ETHNICITIES = Object.freeze(Object.keys(FACE_BUCKETS));
/** the ethnicities a roll draws from when none is named: every base population, and the mixed */
const BASE_ETHNICITIES = Object.keys(FACE_BUCKETS).filter((k) => FACE_BUCKETS[k].ancestry);
export const ROLLED_ETHNICITIES = Object.freeze([...BASE_ETHNICITIES, 'mixed']);
const FACE_WORDS = ['seed', 'ethnicity', 'want', 'character', 'accent', 'nose', 'beauty', 'age', 'fit'];
/** THE FACE'S OWN FIT (head-relational.js solveTune: the skin's masses tuned so it lands on its composed relations, as the
 * studies show it; the pole's tune serves a face near its pole, close but not exact). Solved once at mint (~45 s) and
 * stamped, `fit: { tune, of }`, `of` the fingerprint of the relations it was solved for: a face whose words have changed
 * since reads a fit that is not its own and wears the pole's tune until it is minted again. */
const relationsPrint = (rel) => createHash('sha256').update(JSON.stringify(rel)).digest('hex').slice(0, 16);
const FIT_KEYS = ['eu', 'zy', 'go', 'op', 'g', 'gn', 'n', 'sn', 'prn', 'al', 'mod'];
/** does this spec wear the realistic face (the realistic body's own head) */
const realisticFaced = (spec) => spec?.form === 'realistic' && (spec.head === undefined || spec.head === null || spec.head === 'relational');
function realisticFaceErrors(f) {
  if (typeof f !== 'object' || Array.isArray(f)) return [`face: the realistic face's words { ${FACE_WORDS.join(', ')} } (each as get_solid_vocab({ id: 'layered' }) names it)`];
  const errs = [];
  for (const k of Object.keys(f)) if (!FACE_WORDS.includes(k)) errs.push(`face.${k}: not a realistic face's word (${FACE_WORDS.join(', ')})`);
  if (f.seed !== undefined && !(Number.isInteger(f.seed) && f.seed >= 1)) errs.push('face.seed: an integer ≥ 1 (the roll; another seed is another face)');
  const e = f.ethnicity;
  if (e !== undefined && !(typeof e === 'string' ? FACE_BUCKETS[e] : Array.isArray(e) && e.length >= 2 && e.every((x) => BASE_ETHNICITIES.includes(x)) && new Set(e).size === e.length)) errs.push(`face.ethnicity: one of ${FACE_ETHNICITIES.join(', ')}, or a list of two or more of ${BASE_ETHNICITIES.join(', ')} (a mix of them)`);
  if (f.want !== undefined) {
    if (!f.want || typeof f.want !== 'object' || Array.isArray(f.want)) errs.push(`face.want: { feature: shape } (${FACE_FEATURES.join(', ')})`);
    else for (const [k, v] of Object.entries(f.want)) if (!FACE_SHAPES[k]) errs.push(`face.want.${k}: a feature (${FACE_FEATURES.join(', ')})`); else if (!FACE_SHAPES[k][v]) errs.push(`face.want.${k}: one of ${Object.keys(FACE_SHAPES[k]).join(', ')}`);
  }
  if (f.character !== undefined && !(Array.isArray(f.character) && f.character.length === 2 && f.character.every((v) => Number.isFinite(v) && v >= -1 && v <= 1))) errs.push('face.character: [soft −1 … angular 1, delicate −1 … strong 1]');
  if (f.accent !== undefined && f.accent !== false && !FACE_SHAPES[f.accent]) errs.push(`face.accent: false or a feature (${FACE_FEATURES.join(', ')})`);
  if (f.nose !== undefined && !(Number.isFinite(f.nose) && f.nose >= -1 && f.nose <= 1)) errs.push('face.nose: −1 (short and flat) … 1 (long and pointed)');
  if (f.beauty !== undefined && !(Number.isFinite(f.beauty) && f.beauty >= 0 && f.beauty <= 1)) errs.push('face.beauty: 0 (every roll at its full reach) … 1 (the population\'s mean)');
  if (f.age !== undefined && !(Number.isFinite(f.age) && f.age >= FACE_AGE.range[0] && f.age <= FACE_AGE.range[1])) errs.push(`face.age: years, ${FACE_AGE.range.join(' … ')} (the roll is the person at ${FACE_AGE.prime})`);
  if (f.fit !== undefined && !(f.fit && typeof f.fit === 'object' && typeof f.fit.of === 'string' && f.fit.tune && typeof f.fit.tune === 'object' && Object.entries(f.fit.tune).every(([k, v]) => FIT_KEYS.includes(k) && Number.isFinite(v) && Math.abs(v) < 0.5))) errs.push('face.fit: the face\'s own fit as the mint stamps it ({ tune, of }); leave it out and the next mint solves it');
  return errs;
}
const FACES = new Map();
/** The realistic hero's composed face (composeFace's: relations, eyes, dermis, picks …), or null when it wears none. */
export function realisticFaceOf(hero) {
  if (hero?.form !== 'realistic' || hero.head !== 'relational' || !hero.face || typeof hero.face !== 'object') return null;
  const f = hero.face, sex = femaleOf(hero) ? 'female' : 'male', key = JSON.stringify([sex, f]);
  if (FACES.has(key)) return FACES.get(key);
  const e = f.ethnicity ?? 'western';
  const C = composeFace({ sex, seed: f.seed ?? 1, ...(Array.isArray(e) ? { parents: Object.fromEntries(e.map((x) => [x, 1])) } : { bucket: e }), beauty: f.beauty ?? HERO_FACE.beauty,
    ...(f.age !== undefined ? { age: f.age } : {}), ...(f.character ? { character: f.character } : {}), ...(f.accent !== undefined ? { accent: f.accent } : {}), ...(f.nose !== undefined ? { nose: f.nose } : {}), ...(f.want ? { want: f.want } : {}) });
  // (its own fit when the stamp is for these relations)
  if (f.fit?.tune && f.fit.of === relationsPrint(C.relations)) C.tune = f.fit.tune;
  FACES.set(key, C); if (FACES.size > 64) FACES.delete(FACES.keys().next().value);
  return C;
}
/** the hero with its face's skin under its own: the ancestry's dermis, the face's (the palette's Skin, when it names one,
 * standing for the tone as it always has), every word a dermis dial; a hero without a face as it was */
function faceSkin(hero) {
  const C = realisticFaceOf(hero); if (!C) return hero;
  const { from: _f, ...anc } = readAncestry({ id: C.ancestry, sex: femaleOf(hero) ? 'female' : 'male', seed: hero.face.seed ?? 1 }).dermis;
  const rolled = Object.fromEntries(Object.entries({ ...anc, ...C.dermis }).filter(([k]) => k in DERMIS_DIALS && k !== 'sex'));
  if (hero.palette?.Skin) delete rolled.tone;
  return { ...hero, skin: { ...rolled, ...(hero.skin || {}) } };
}
/** THE FACE ROLLED AT MINT: a realistic hero minted wears a face, its words stamped so it rebuilds as it was. What is not
 * decided is rolled: the seed, the ethnicity (ROLLED_ETHNICITIES) and, when no cast is named, the sex; what is named
 * bounds the roll (an ethnicity, a cast), and the rest of the words tune it (want, character, accent, nose, beauty, age).
 * A remake keeps the face it was stamped with (and the cast that came with it) unless the order names one. Only the mint
 * calls this: a hero stored without a face wears its pole's head. */
export function withRolledFace(spec, was = null) {
  if (!realisticFaced(spec)) return spec;
  if (was && (spec.face === undefined || spec.face === null) && was.face) return { ...spec, face: was.face, ...(spec.cast === undefined && was.cast !== undefined ? { cast: was.cast } : {}) };
  const f = spec.face === undefined || spec.face === null ? {} : spec.face;
  if (typeof f !== 'object' || Array.isArray(f)) return spec;   // (refused by name at the record)
  const face = { ...f, ...(f.seed === undefined ? { seed: randomInt(1, 2147483647) } : {}), ...(f.ethnicity === undefined ? { ethnicity: ROLLED_ETHNICITIES[randomInt(ROLLED_ETHNICITIES.length)] } : {}) };
  return { ...spec, face, ...(spec.cast === undefined ? { cast: randomInt(2) ? 'female' : 'male' } : {}) };
}
/** THE FACE'S OWN FIT stamped at mint (the realistic face's `fit`): solved for its composed relations (~45 s) unless the
 * stamp it carries is already for them; any other spec as it is. Only the mint calls this, after withRolledFace. */
export function withFaceFit(spec) {
  if (!realisticFaced(spec) || !spec.face || typeof spec.face !== 'object' || Array.isArray(spec.face)) return spec;
  const { fit, ...words } = spec.face, C = realisticFaceOf({ ...spec, form: 'realistic', head: 'relational', face: words });
  if (!C || fit?.of === relationsPrint(C.relations)) return spec;
  const { tune } = solveTune({ sex: femaleOf(spec) ? 'female' : 'male', relations: C.relations });
  return { ...spec, face: { ...words, fit: { tune: Object.fromEntries(Object.entries(tune).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6])), of: relationsPrint(C.relations) } } };
}
/** the readout's face: what was rolled, so a face liked can be kept by its words or aimed at again */
function faceReadout(hero) {
  const C = realisticFaceOf(hero); if (!C) return null;
  return { words: hero.face, ethnicity: hero.face.ethnicity ?? 'western', rolled: C.bucket, ...(C.mixed ? { mixed: C.mixed } : {}), ...(C.hybrid ? { hybrid: C.hybrid } : {}), ancestry: C.ancestry, picks: C.picks, character: C.character, accent: C.accent, hairLevel: heroHairLevel(hero), fit: C.tune ? 'its own (solved at mint)' : 'its pole\'s (minted before the fit, or its words changed since: mint it again to solve its own)',
    shown: `the head\'s shape and its skin (tone, hairline, marks, stubble, the years), its hair, its brows and lashes, a styled beard${C.piercings?.length ? ', its piercings' : ''}` };
}

/** The realistic form's refusals: what it takes (a `physique`), and what it does not wear yet. Dress, armour, kits,
 * paint and details are addressed on the authored body's rings and baked before the body is re-sampled, so on the
 * realistic body they would float or vanish; the body's radii are the field's, dialled by the physique */
function realisticErrors(spec) {
  const errs = [], R = spec.form === 'realistic';
  if (spec.physique !== undefined && spec.physique !== null && !R) errs.push("physique: dials the realistic body; add form: 'realistic' (or leave physique out)");
  if (spec.head === 'relational' && !R) errs.push("head: the relational head is worn by the realistic body; add form: 'realistic'");
  if (spec.skin !== undefined && spec.skin !== null && !R) errs.push("skin: the realistic body's skin (its tone and its look: undertone, age, freckles, lines, war paint …); add form: 'realistic' (another form's skin colour is palette: { Skin })");
  if (!R) return errs;
  if (realisticFaced(spec) && spec.face !== undefined && spec.face !== null) errs.push(...realisticFaceErrors(spec.face));
  if (spec.skin !== undefined && spec.skin !== null) {
    const k = spec.skin;
    if (typeof k !== 'object' || Array.isArray(k)) errs.push(`skin: { ${Object.keys(DERMIS_DIALS).filter((d) => d !== 'sex').join(', ')} } (each as get_solid_vocab({ id: 'layered' }) names it)`);
    else if (k.sex !== undefined) errs.push("skin.sex: the skin's sex is the cast's; drop it");
    else if (k.tone !== undefined && spec.palette?.Skin && String(k.tone).toLowerCase() !== spec.palette.Skin.toLowerCase()) errs.push('skin.tone and palette.Skin both name the skin\'s colour; give one');
    else try { heroDermisSpec({ cast: spec.cast, palette: spec.palette, skin: k }); } catch (e) { errs.push(`skin: ${e.message.replace(/^dermis: /, '')}`); }
  }
  if (spec.physique !== undefined && spec.physique !== null) {
    const p = spec.physique, { laws, ...dials } = typeof p === 'object' && !Array.isArray(p) ? p : {};
    if (typeof p !== 'string' && (typeof p !== 'object' || Array.isArray(p))) errs.push(`physique: a word (${Object.keys(PHYSIQUES).join(' | ')}) or { from?, ${PHYSIQUE_DIALS.join(', ')} } (each −1 to 1, 0 the athletic base)`);
    else {
      try { physiqueBuild('norrin', typeof p === 'string' ? p : Object.keys(dials).length ? dials : 'athletic'); } catch (e) { errs.push(`physique: ${e.message.replace(/^body-relational: /, '')}`); }
      if (laws !== undefined && !(Number.isInteger(laws) && laws >= 1 && laws <= REALISTIC_LAWS_VERSION)) errs.push(`physique.laws: ${laws} is unknown — this kernel carries the realistic laws 1 … ${REALISTIC_LAWS_VERSION} (stamped at mint; leave it out)`);
    }
  }
  if (spec.cast !== undefined && spec.cast !== 'male' && spec.cast !== 'female') errs.push("cast: the realistic body is built for 'male' or 'female' (its builds, norrin and shalla); dial it with physique (it depicts adults: a child or chibi cast asked of it is that cast's stylized figure, its colours kept)");
  if (spec.head !== undefined && !['landmark', 'none', 'relational'].includes(spec.head)) errs.push("head: the realistic body wears the landmark head, the relational head or none (head: 'landmark' | 'relational' | 'none')");
  if (spec.core === 'streamlined') errs.push("core: the realistic body is cut on the structured core's pelvis; drop core: 'streamlined'");
  if (spec.proportions !== undefined && spec.proportions !== 'hero') errs.push("proportions: the realistic body takes the realistic casts' ('hero'); dial it with physique");
  // (`detail` is the authored body's own clothing, fitted to its rings: the realistic body is clothed by an outfit, which
  // its tailor makes on its own rings)
  if (spec.detail !== undefined && spec.detail !== null && spec.detail !== 'none') errs.push("detail: the authored body's own clothing, fitted to its rings; the realistic body is dressed by an outfit (outfit: { type: 'outfit', style }, a garment word) or paint words; drop detail, or the realistic form");
  for (const k of ['body', 'girth']) if (spec[k] !== undefined && spec[k] !== null) errs.push(`${k}: the realistic body's girths are its field's; dial them with physique: { bulk, tone, weight, height }`);
  return errs;
}

/** The stored `hero` record: the cast word, the register, the RESOLVED tune (every control at its value, so a patch by
 * path finds it; a control added later is left out at 1, hero-form SPARSE_TUNE_KEYS), the move trail, and whatever else
 * the operator gave. Stored resolved for the same reason casts are: a later re-tuning of a move never changes a stored
 * row's meaning. */
export function heroRecord(spec, { staleScale = false } = {}) {
  // (a realistic child is the stylized figure: the realistic body depicts adults)
  spec = adultsOnly(spec);
  const errs = validateHeroSpec(spec, { staleScale });
  if (errs.length) throw new Error(`hero refused:\n - ${errs.join('\n - ')}\nThe hero door: { cast: 'male' | 'female' | a figure cast | { pole: 'male' | 'female', build: ${HERO_BUILD_NAMES.join(' | ')} }, register, tune: a move (${HERO_MOVE_NAMES.join(' / ')}), { ${TUNE_KEYS.join(', ')} } or a list, face: a move (${FACE_MOVE_NAMES.join(' / ')}), { ${FACE_KEYS.join(', ')} } or a list, hair?: a style (${HAIR_STYLE_NAMES.join(' / ')}), { style, ${HAIR_KEYS.join(', ')} } or a list, expression?, sculpt?: the anime head's graphic face (an object of words, a move (${ANIME_SCULPT.MOVE_NAMES.join(' / ')}), a list or false), painterly?: true (the anime head's painterly look: the face painted, a soft edge), detail?: ${DETAIL_WORDS.join(' | ')}, adorn?: ${KIT_WORDS.join(' | ')} | { type: 'armor', style, dials }, paint?: ${Object.keys(PAINT_WORDS).join(' | ')} | { part, u?, run?, t?, group } | a list, outfit?: { type: 'outfit', style, dials?, language? } | ${Object.keys(OUTFIT_WORDS).join(' | ')} | { id, part, u?, run?, ease, flare?, over?, group } | a list, body?, palette?, head?: 'landmark' | 'none' | include, gesture?: ${GESTURE_WORDS.join(' | ')} | { ${GESTURE_KEYS.join(', ')} } | a list, clips?: { <name>: [keys] | { seconds, keys } | false } (keys in pose words: ${CLIP_KEYS.join(', ')}; a key's face on the anime or the landmark head), motion?: { walk?, jog?, sprint?: true | { <the gait's dials>, tilt, seconds }, <a jump, roll or stop>?: true | { seconds }, <a pose, stance or strike (hairToss, jotaroPoint, guard, jab …, <name>Left its mirror)>?: true | { seconds } }, blink?: false, target?: ${Object.keys(RESOLUTIONS).join(' | ')} | { resolution, framing?: ${Object.keys(FRAMINGS).join(' | ')}, error? }, geocube?: a cube (its light, era and target unless target is named) }`);
  const { from, ...resolved } = resolveTune(spec.tune), tune = storedTune(resolved);   // a sparse control at 1 stores nothing
  const hero = { cast: spec.cast ?? 'male', register: spec.register ?? 'round', tune, ...(from ? { from } : {}), head: spec.head ?? (spec.form === 'realistic' ? 'relational' : 'landmark') };   // (the realistic body's own head by default; a record stores its head, so a hero minted before keeps its)
  if (hero.head === 'landmark') {
    const { from: faceFrom, ...face } = resolveFace(spec.face);
    // the tiered form's female wears its longer default (tiered-form.js TIERED_FACE), stored as any style is
    const tieredHair = spec.form === 'tiered' ? TIERED_FACE[spec.headPreset ?? (femaleOf({ cast: spec.cast ?? 'male', proportions: spec.proportions }) ? 'female' : 'male')]?.hair : null;
    Object.assign(hero, { face, ...(faceFrom ? { faceFrom } : {}), hair: resolveHair(spec.hair ?? tieredHair ?? 'swept'), expression: spec.expression ?? 'neutral' });
    if (spec.headPreset !== undefined) hero.headPreset = spec.headPreset;
  } else if (hero.head === 'anime') {
    // the OWN layer, stored resolved like the landmark head's (every control at its value, so a patch by path finds it)
    // but sparse where a look may speak: the family is null unless named, the expression absent unless given, so a
    // look's family and pose stand; the effective head is the look's stamp with this layer on top (composeAnime)
    const { from: faceFrom, ...face } = resolveAnimeFace(spec.face);
    if (spec.headPreset !== undefined) hero.headPreset = spec.headPreset;
    const hair = spec.hair === 'none' ? 'none' : resolveAnimeHair(spec.hair ?? null);
    Object.assign(hero, { face, ...(faceFrom ? { faceFrom } : {}), hair, ...(spec.expression !== undefined ? { expression: resolveAnimeExpression(spec.expression) } : {}) });
    const words = spec.look === undefined || spec.look === null ? [] : Array.isArray(spec.look) ? spec.look : [spec.look];
    if (words.length) Object.assign(hero, { look: [...words], lookResolved: resolveLook(words) });
    // the graphic face: SPARSE (the words that differ from the base; absent when none, so the default is read at plan
    // time and never stored); `false` (the studio's face) is stored
    if (spec.sculpt !== undefined && spec.sculpt !== null) { const sc = sparseSculpt(resolveAnimeSculpt(spec.sculpt)); if (sc !== null) hero.sculpt = sc; }
    // the painterly look (face-paint.js, the soft ramp): stored only when on
    if (spec.painterly === true) hero.painterly = true;
    else if (spec.painterly && typeof spec.painterly === 'object') hero.painterly = { ...(spec.painterly.nose ? { nose: { ...spec.painterly.nose } } : {}) };
  }
  for (const k of ['body', 'girth', 'headScale', 'scale', 'palette', 'proportions', 'detail', 'adorn', 'paint', 'outfit', 'core', 'target', 'geocube', 'form', 'skin', 'kit']) if (spec[k] !== undefined && spec[k] !== null) hero[k] = spec[k];
  // the realistic face's words (realisticFaceOf), stored as given: composed on every read
  if (hero.head === 'relational' && spec.face !== undefined && spec.face !== null) hero.face = structuredClone(spec.face);
  // the realistic body's physique, always stored on a realistic hero (athletic when none is given), with the laws
  if (spec.form === 'realistic') { const p = spec.physique ?? 'athletic', o = typeof p === 'string' ? { from: p } : { ...p }; hero.physique = o.laws === undefined ? { ...o, laws: REALISTIC_LAWS_VERSION } : o; }
  // genki (anime-genki.js): stored only when it adds something (absent and 0 store nothing)
  if (Number.isFinite(spec.genki) && spec.genki > 0) hero.genki = spec.genki;
  // the stand, stored AS GIVEN (a word re-resolves for the cast on every regeneration, so a /hero/cast edit carries the
  // stand to the new body); the anime hero's `relaxed` is a plan-time default (heroGesture), never stored
  if (spec.gesture !== undefined && spec.gesture !== null) hero.gesture = spec.gesture;
  // the door's clips, stored AS GIVEN and sparse: absent when none (an empty object stores nothing)
  if (spec.clips && typeof spec.clips === 'object' && Object.keys(spec.clips).length) hero.clips = spec.clips;
  // the door's motion (hero-motion.js), stored AS GIVEN and sparse: absent when none (an empty object stores nothing)
  if (spec.motion && typeof spec.motion === 'object' && Object.keys(spec.motion).length) hero.motion = spec.motion;
  // the ambient blink: on by default (read at export, never stored); stored only when turned off
  if (spec.blink === false) hero.blink = false;
  // held and carried gear (hero-gear.js): each slot's build words with the laws stamped; absent ⇒ no key
  const gear = gearRecord(spec.gear); if (gear) hero.gear = gear;
  // an armour build is stamped with the laws it was minted under, so a later refinement never moves a stored suit
  if (isArmorBuild(hero.adorn) && hero.adorn.laws === undefined) hero.adorn = { ...hero.adorn, laws: ARMOR_LAWS_VERSION };
  if (isOutfitBuild(hero.outfit) && hero.outfit.laws === undefined) hero.outfit = { ...hero.outfit, laws: OUTFIT_LAWS_VERSION };
  // the stylism tuner's words (lib/graph/stylism/), stamped with the laws they resolve under; absent ⇒ no key
  if (spec.stylism) hero.stylism = spec.stylism.laws === undefined ? { ...spec.stylism, laws: STYLISM_LAWS_VERSION } : { ...spec.stylism };
  // a statue build (statue/expand.js): a style word stored as its build, stamped with the laws; the card's hair set at
  // mint when the hero names none (the hair is stored resolved, so a later card edit leaves it: patch /hero/hair)
  // the hero laws (hero-form.js HERO_LAWS_VERSION): stamped at mint on a hero that reads their tables; a spec re-recorded
  // on every render (a world's inline hero, staleScale) is never stamped here, so an absent stamp keeps reading laws 1
  if (spec.laws !== undefined) hero.laws = spec.laws;
  else if (!staleScale && readsHeroLaws(spec)) hero.laws = HERO_LAWS_VERSION;
  if (spec.statue !== undefined && spec.statue !== null) {
    const s = normalizeStatue(spec.statue); hero.statue = s.laws === undefined ? { ...s, laws: STATUE_LAWS_VERSION } : s;
    const hair = hero.head === 'landmark' && spec.hair === undefined ? statueHair(hero.statue, { female: femaleOf(hero) }) : undefined;
    if (hair !== undefined) hero.hair = resolveHair(hair);
  }
  return hero;
}

/** The plan a hero record generates: the humanoid starter when it wears the landmark head (the default), the bare hero
 * form with a blank trunk (`head: 'none'`) or a baked include; the door's clips (`clips`) merged over its own, and the
 * stand (`gesture`) as its first clip. */
export function heroPlanOf(hero) {
  // a sport's KIT (sportswear/kits.js) lowers first, into the dress every pass below reads; absent ⇒ the hero as it is
  hero = kittedHero(hero);
  // the STYLISM tuner resolves first, into the outfit (and an armour build's dials) every pass below reads; absent ⇒ the hero
  hero = styledHero(hero);
  // a statue's card stands, stills and drapes the hero beneath its own words (statue/expand.js passes 1 and 2)
  hero = statueHero(hero, { female: femaleOf(hero), structured: (hero.core ?? DEFAULT_CORE) === 'structured' });
  // the door's clips merge over the form's own (hero-gesture.js withHeroClips); the stand rides as a one-key `gesture`
  // clip listed first; the anime hero's default is read here, so a /hero/head switch takes it on or drops it; neither ⇒
  // the plan as it was
  // a swing word (hero-swing.js): the stand is the swing's ready key and the swing rides as its own looping clip after it
  const own = withHeroClips(targetPlan(designedPieces(heroFormPlan(hero), hero), hero), hero.clips);
  let swing = heroSwing(hero, { expand: expandEquipment, gearBuild });
  // the structured core's legs converge at rest, so a swing's planted feet take a base of their own (STRUCTURED_SWING_BASE):
  // narrower than the guard's, because a swing's keys crouch little and a straight leg cannot reach a wide foot; every key
  // sinks at least that far
  if (swing && (hero.core ?? DEFAULT_CORE) === 'structured') swing = { ...swing, keys: swing.keys.map((k) => ({ ...STRUCTURED_SWING_BASE, ...k, crouch: Math.max(k.crouch ?? 0, STRUCTURED_SWING_BASE.crouch) })) };
  if (swing) { const p = withGestureClip(own, swing.keys[0]); return withLocomotion(hero, gripHands(p.rig ? { ...p, clips: { [GESTURE_CLIP]: p.clips[GESTURE_CLIP], [swing.word]: swing.keys, ...Object.fromEntries(Object.entries(p.clips).filter(([k]) => k !== GESTURE_CLIP)) } } : p, hero)); }
  // genki moves the resolved stand (the stance, the chest, the chin); a swing's keys are its own and stay as they are
  return withLocomotion(hero, gripHands(withGestureClip(own, genkiStand(resolveGesture(heroGesture(hero), gestureCast(hero.cast), { core: hero.core ?? DEFAULT_CORE }), hero)), hero));
}
/** The DESIGNED pieces an outfit build carries (`outfit.pieces`, an Egocube's designed dress: mantle, pauldron, sash,
 * bracers …), worn over the cut on the hero's own landmarks (outfit-plan.js compileOutfit, as a creature wears them), in
 * the intent's palette roles; before the target, so a tiered kit tiers them. No pieces ⇒ the plan as it was. */
function designedPieces(plan, hero) {
  const O = isOutfitBuild(hero.outfit) && Array.isArray(hero.outfit.pieces) && hero.outfit.pieces.length ? hero.outfit : null;
  if (!O) return plan;
  const { worn } = sortPieces(plan, O);
  return worn.length ? compileOutfit({ ...plan, outfit: { intent: O.intent ?? {}, pieces: worn } }) : plan;
}
/** Which designed pieces sit on this body: each compiled alone, kept when every place it reads is a number on its part
 * (a piece built for a creature's landmarks may find none on a person's: a necklace's pin on a layered chest); the
 * rest are said (heroReadout), never dropped without a word. → { worn, unworn: [{ kind, why }] } */
export function sortPieces(plan, O) {
  const worn = [], unworn = [], before = plan.adorn?.length ?? 0;
  const finite = (v) => (typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(finite) : v && typeof v === 'object' ? Object.values(v).every(finite) : true);
  const segOf = (n) => plan.segments.find((g) => g.name === n);
  for (const piece of O.pieces) {
    let c;
    try { c = compileOutfit({ ...plan, outfit: { intent: O.intent ?? {}, pieces: [piece] } }); } catch (e) { unworn.push({ kind: piece.kind, why: e.message }); continue; }
    const added = c.adorn.slice(before), grown = c.segments.slice(plan.segments.length);
    const off = added.find((A) => !finite(A) || (A.mode === 'shell' && Array.isArray(A.s) && segOf(A.part)?.stations && A.s[1] > uOfStation(segOf(A.part).stations.at(-1), segOf(A.part).stations.length - 1)))
      ?? grown.map((g) => ({ id: g.name, g })).find(({ g }) => !finite(g) || (Array.isArray(g.stations) && g.stations.some((st) => !Array.isArray(st.at) || st.at.length !== 3 || st.r === undefined)));
    if (off) unworn.push({ kind: piece.kind, why: `no place on this body for its ${off.id} yet (it was designed on a creature's landmarks)` });
    else worn.push(piece);
  }
  return { worn, unworn };
}
/** The hero's target on its plan (era/cast-density.js): each body part whose outline misses by more than the target's
 * error takes one split, after the dress's refine. No target ⇒ the plan as it was. The realistic body takes none: its
 * rings are its own (every point given, not drawn from its slots, which a split would halve under them); its target
 * reads the hair's rung (heroHairLevel). */
function targetPlan(plan, hero) {
  const target = heroTarget(hero);
  return tieredDress(target && hero.form !== 'realistic' ? densityPlan(plan, target) : plan, hero, target);
}
/** The tiered form's dress, on the plan its target split: its garments over the bridges and split with their parts
 * (tiered-form.js tieredGarments), its kit over the joints (tieredKit), and that kit as the hero's target shows it (adorn-tier.js; the default target when it
 * names none, as the tiered face reads it). Another form ⇒ the plan as it was. */
function tieredDress(plan, hero, target) {
  if (hero.form !== 'tiered') return plan;
  const dressed = tieredGarments(plan);
  return dressed.adorn?.length ? { ...dressed, adorn: tierKit(tieredKit(dressed.adorn, dressed, { laws: hero.laws ?? 1 }), dressed, target ?? DEFAULT_TARGET).kit } : dressed;
}
/** the door's MOTION (hero-motion.js) on a rigged plan: its gaits as `plan.locomotion` (compiled where the clips are
 * packed); absent ⇒ the plan as it was. A vault on a leg the hero laws set back (LEG_SET, laws 3) says `legSet`, and a
 * guard on an arm they shortened (ARM_LENGTH, laws 5) says `armLength`: the moves follow the body they were built on,
 * and a hero minted before those laws gets neither, its clips as they were. */
function withLocomotion(hero, plan) {
  const locomotion = plan?.rig ? motionPlan(hero.motion) : null;
  if (!locomotion) return plan;
  const body = { core: hero.core ?? DEFAULT_CORE, laws: hero.laws ?? 1 };
  const legSet = takesLegSet(body), armLength = takesArmLength({ ...body, cast: hero.cast ?? 'male', proportions: hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero') });
  if (!legSet && !armLength) return { ...plan, locomotion };
  const marked = Object.fromEntries(Object.entries(locomotion).map(([n, e]) => [n, e.vault && legSet ? { ...e, legSet: true } : e.guard && armLength ? { ...e, armLength: true } : e]));
  return { ...plan, locomotion: marked };
}
/** A hand that holds gear (gear.right / gear.left: a blade's or a staff's grip, a shield's back grip) closes round it:
 * every clip key that says nothing of that hand's fingers takes the `grip` hand word, on a rig whose hands have digits
 * (the structured core); any other plan untouched. */
function gripHands(plan, hero) {
  const held = ['right', 'left'].filter((s) => hero.gear?.[s]).map((s) => `fingers${s === 'right' ? 'R' : 'L'}`);
  if (!held.length || !plan?.rig?.hands || !plan.clips) return plan;
  return { ...plan, clips: Object.fromEntries(Object.entries(plan.clips).map(([name, keys]) => [name, keys.map((k) => ({ ...Object.fromEntries(held.filter((f) => k[f] === undefined).map((f) => [f, 'grip'])), ...k }))])) };
}
/** The anime hero's own colours per design base, under the operator's (its palette wins): the hair base's colour at a
 * mid-dark value, so its lit and shade tones both read under the character light and against the World's dark backdrop
 * — a warm dark brown on the male (CIE L* ≈ 33), a blue-black on the female (L* ≈ 35, so her shade side, floored at
 * L* 20.5, still parts from the backdrop by 15) — and the eye and brow strokes darker than the hair (L* ≈ 8), the
 * darkest mark on the head. */
const ANIME_HERO_PALETTE = Object.freeze({ male: Object.freeze({ Hair: '#644634', Ink: '#16181c' }), female: Object.freeze({ Hair: '#465365', Ink: '#16181c' }) });
/** the hair base the door applied to an anime hero, resolved: its form, and its cut when worn (`eff.hairCut`) */
const animeHairBaseOf = (hero, eff) => { const B = ANIME_HAIR_BASE[headPoleOf(hero)]; return resolveAnimeHair([B.form, ...(eff.hairCut ? [eff.hairCut] : [])]); };
/** The bust the tiered form profiles into the torso (metres): the body's own, else the adult female's default (a share of
 * her chest, as hero-form.js BUST_FORM); none on a child-coded figure. */
function tieredBust(hero) {
  if (childCoding(hero)) return 0;
  if (hero.body?.bust !== undefined) {
    // (the ceiling heroPlan holds a bust to, held here too: the tiered plan is built bare and the bust profiled after)
    const props = hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero'), chest = hero.body.chest ?? castOf(lawCast(hero.cast, hero.laws ?? 1, props).cast, props)?.body?.chest ?? BODY_DEFAULTS.chest;
    const err = bustCeilingError(hero.body.bust, chest); if (err) throw new Error(err);
    return hero.body.bust;
  }
  if (!femaleOf(hero)) return 0;
  return Math.round(0.27 * (castOf(hero.cast, hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero'))?.body?.chest ?? BODY_DEFAULTS.chest) * 1e6) / 1e6;
}
/** The hero's form plan: today's, or with `form: 'tiered'` the tiered base (tiered-form.js): the bust as a profile on
 * the torso's rings in place of its own domes. */
/** Whether a hero's kit carries a cowl that presses its ears: in its adorn list, or in an armour build's `with` (the kit
 *  worn over the armour); a cowl's `ears: false` leaves them. */
export function cowlPressesEars(hero) {
  const kit = Array.isArray(hero?.adorn) ? hero.adorn : Array.isArray(hero?.adorn?.with) ? hero.adorn.with : [];
  return kit.some((A) => A?.signature?.kind === 'cowl' && A.signature.ears !== false);
}

function heroFormPlan(hero) {
  if (hero.form !== 'tiered') return heroFormPlanOf(hero);
  const pole = tieredPole(hero);
  return tieredSockets(tieredJoints(tieredChest(heroFormPlanOf(tieredFace({ ...hero, body: { ...(hero.body ?? {}), bust: 0 } }, pole)), tieredBust(hero)), undefined, { respace: (hero.laws ?? 1) >= 7 }), { web: (hero.laws ?? 1) >= 10 ? 3 : (hero.laws ?? 1) >= 9 ? 2 : (hero.laws ?? 1) >= 8 ? 1 : 0 });
}
function heroFormPlanOf(hero) {
  // a child-coded figure (childCoding) never takes the adult female's default bust (hero-form.js BUST_FORM): its body says 0
  // (a footwear library card on the game body keeps its foot bare under it, for the card to be worn over: the library's
  // authored adapter, after the plan; the realistic body re-samples its own foot)
  const feet = hero.form !== 'realistic' && libraryFeet(hero.outfit).length ? { feet: 'bare' } : {};
  // (the cast as the hero's laws read it: hero-form.js lawCast, the chibi's head and arms under laws 6)
  const L = lawCast(hero.cast, hero.laws ?? 1, hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero')), cast = L.cast;
  const body = { ...(L.body ?? {}), ...(hero.body ?? {}), ...(childCoding(hero) ? { bust: 0 } : {}) };
  const common = { ...feet, register: hero.register, tune: hero.form === 'realistic' ? realisticTune(hero) : hero.tune, body, girth: hero.girth ?? 1, headScale: hero.headScale ?? L.headScale, ...(hero.core !== undefined ? { core: hero.core } : {}), ...(hero.laws !== undefined ? { laws: hero.laws } : {}), ...(hero.form === 'realistic' ? { seat: false } : {}) };
  const dress = { ...(hero.detail !== undefined ? { detail: hero.detail } : {}), ...(hero.adorn !== undefined ? { adorn: hero.adorn } : {}), ...(hero.paint !== undefined ? { paint: hero.paint } : {}), ...(hero.outfit !== undefined ? { outfit: hero.outfit } : {}), ...(childCoding(hero) ? { childCoded: true } : {}) };
  // the relational head is laid out on the landmark head's plan, bald, and swapped in after the slice (realisticRecipe)
  if (hero.head === 'relational') return humanoidPlan({ preset: cast, ...common, face: {}, hair: 'none', expression: 'neutral', palette: hero.palette ?? {}, ...dress });
  if ((hero.head ?? 'landmark') === 'landmark') {
    // (a COWL in the kit presses the ears to the head, as a cowl's cloth does: they stand off it at a small angle and
    // lift, so the cowl passes close over them; its `ears: false` leaves them as they are. No cowl: the ears as before)
    const cowled = cowlPressesEars(hero);
    const features = cowled ? { ...(hero.faceFeatures ?? {}), earAngle: 0.03, earLift: 0 } : hero.faceFeatures;
    return humanoidPlan({ preset: cast, ...common, face: hero.face ?? {}, hair: hero.hair ?? 'swept', expression: hero.expression ?? 'neutral', palette: hero.palette ?? {}, ...(features ? { features } : {}), ...(hero.headPreset ? { headPreset: hero.headPreset } : {}), ...(hero.proportions ? { proportions: hero.proportions } : {}), ...dress });
  }
  if (hero.head === 'anime') {
    const eff = animeEffective(hero);   // the look's stamp, the own layer on top, the hair base under them
    return humanoidPlan({ preset: cast, ...common, tune: eff.tune, head: 'anime', face: eff.face, hair: eff.hair, expression: eff.expression, sculpt: eff.sculpt, palette: { ...ANIME_HERO_PALETTE[headPoleOf(hero)], ...(hero.palette ?? {}) }, ...(hero.painterly ? { facePaint: { dense: facePaintDense(heroTarget(hero)), nose: { ...NOSE_DEFAULTS, ...(hero.painterly.nose ?? {}) } } } : {}), ...(hero.headPreset ? { headPreset: hero.headPreset } : {}), ...(hero.proportions ? { proportions: hero.proportions } : {}), ...dress });
  }
  // the blank trunk and a baked include take `proportions` too (the anime casts), as the two worn heads do
  const plan = heroPlan({ cast, ...common, scale: hero.scale, palette: hero.palette || dress.adorn || isOutfitBuild(dress.outfit) ? { ...HERO_PALETTE, ...kitPalette(dress.adorn), ...outfitTones(dress.outfit), ...(hero.palette || {}) } : HERO_PALETTE, head: hero.head === 'none' ? null : hero.head, ...(hero.proportions ? { proportions: hero.proportions } : {}), ...(hero.detail === 'swimsuit' && !childCoding(hero) ? { bare: true } : {}) });
  const { childCoded, ...worn } = dress;
  return dressPlan(plan, { ...worn, laws: hero.laws ?? 1, figure: { female: castOf(hero.cast, hero.proportions ?? 'hero')?.silhouette === 'female', child: !!childCoded }, operatorPalette: hero.palette ?? {}, scale: planScale({ cast: hero.cast, scale: hero.scale, tune: hero.tune, proportions: hero.proportions ?? 'hero' }) });
}
/** The dress the hero wears, in the operator's terms: the words (or 'data'), the parts each layer baked, and the
 * adornment ledger — every signature must read and be a real share of its adornment's picture (advice, never a refusal).
 * `mesh` is the compiled figure; without it the ledger is skipped. */
export function dressReadout(hero, plan, mesh, recipe) {
  if (hero.detail === undefined && hero.adorn === undefined && hero.paint === undefined && hero.outfit === undefined) return null;
  const word = (v) => (v === undefined ? 'none' : typeof v === 'string' ? v : isArmorBuild(v) ? `armor:${typeof v.style === 'string' ? v.style : 'inline'}` : 'data');
  const DRESS = /^(crease|tile|patch|pad|spur|spine|stud|ring|cuff|wrap|collar)\./;
  const parts = Object.keys(mesh?.parts || {}); const count = (re) => parts.filter((n) => re.test(n)).length;
  const out = { detail: word(hero.detail), adorn: word(hero.adorn), ...(hero.paint !== undefined ? { paint: (Array.isArray(hero.paint) ? hero.paint : [hero.paint]).map((x) => (typeof x === 'string' ? x : 'data')) } : {}), ...(hero.outfit !== undefined ? { outfit: isOutfitBuild(hero.outfit) ? outfitReadout(hero.outfit, plan, { drawn: hero.head === 'anime' ? 'anime' : null }) : (Array.isArray(hero.outfit) ? hero.outfit : [hero.outfit]).map((x) => (typeof x === 'string' ? x : x.id)) } : {}), ...(mesh ? { parts: { detail: count(DRESS), adorn: count(/^adorn\./) } } : {}) };
  if (isArmorBuild(hero.adorn)) out.armor = armorReadout(hero.adorn, dressContext(plan.style));   // the style, dials, pieces worn, focal
  // (a GHOST adornment is thread on cloth, no plate of its own: its legibility is the families' below, not a share of a plate)
  // (a piece the mesh does not carry is not judged: the realistic body wears the kit's trunk panels, hoops, feet and
  // shoulders as field shells of its own and leaves the head's and the optional pieces off, body-relational-armour.js;
  // those are `unworn`, named, never "does not read")
  const plated = mesh ? plan.adorn?.filter((A) => !A.ghost && mesh.parts?.[`adorn.${A.id}`]) ?? [] : [];
  // (a belt the realistic tailor made as cloth, `<id>_<part>` (body-relational-wear.js `belts`), is worn: a band, not a plate)
  const tailored = (A) => parts.some((n) => n.startsWith(`${A.id}_`));
  const off = mesh ? plan.adorn?.filter((A) => !A.ghost && !mesh.parts?.[`adorn.${A.id}`] && !tailored(A)) ?? [] : [];
  if (off.length) out.unworn = off.map((A) => A.id);
  if (plated.length) out.adornments = justify(mesh, plated.map((A) => ({ id: A.id, signature: A.signature.kind }))).map((r) => ({ id: r.id, signature: r.signature, verdict: r.verdict, exposed: r.sigExposed, share: r.sigShare }));
  // the read at the viewing height: the character height from which each dress family reads (the face's is measure_solid's)
  if (mesh) { const L = layeredLegibility(mesh); out.legibility = { viewPx: L.viewPx, families: L.families.filter((f) => DRESS.test(`${f.family}.`) || f.family.startsWith('adorn.')) }; }
  // the dress stays OUT of the body at every dial extreme (station-loft-clearance.js); the worst configuration is named
  // the dressed silhouette (dress-silhouette.js): the cloth's waist and taper against the body's, advice when it fills them
  if (recipe && hero.outfit !== undefined) { const S = dressSilhouette(recipe); if (S) out.silhouette = S; }
  // the dressed OUTLINE (dress-outline.js; docs/garment-principles.md), on either body, read off the mesh: its family against
  // the bare body's, each half's fit, where loose cloth comes back to the body, the divisions, the flair, and the advice in
  // each style. A read, never a refusal: a figure it cannot read (no trunk to slice) goes without it
  let M = null;
  if (mesh?.provenance && recipe?.rig) try { M = outlineMeasures(mesh, recipe); } catch { M = null; }
  if (M) {
    const sex = femaleOf(hero) ? 'female' : 'male', canons = hero.stylism?.canon ? [hero.stylism.canon] : ['western', 'anime'];
    out.outline = { family: M.family, bare: M.bareFamily, fit: { top: M.fit.top.class, bottom: M.fit.bottom.class }, returns: M.returns, divisions: M.divisions.map((d) => `${d.kind}@${d.f}`), flair: M.flair.of,
      advice: Object.fromEntries(canons.map((st) => [st, outlineCritic(M, st, { sex }).advice])) };
  }
  // what the GAME BODY wears plain or not at all, said (advice, never a refusal): the tailoring is the realistic body's
  // tailor's; the plating suits its library's realistic adapter's; a footwear card on the streamlined core its base
  if (hero.form !== 'realistic') {
    const words = (Array.isArray(hero.outfit) ? hero.outfit : [hero.outfit]).filter((w) => typeof w === 'string'), only = [];
    if (plan.tailoring) only.push(`tailoring (${Object.keys(plan.tailoring).join(', ')}): a jacket's front and lapels, its shoulder and waist, a tie and a waistcoat's V are made on the realistic body; the game body wears the pieces plain`);
    const suits = words.filter((w) => Object.hasOwn(SUITS, w)); if (suits.length) only.push(`${suits.join(', ')}: plated suits are worn on the realistic body; the game body wears none (its armour is an armour build, adorn: { type: 'armor' })`);
    // (a footwear card is the library's on the structured core, through its authored adapter; the streamlined core's feet
    // are boxes it has no foot for)
    const shoes = hero.core === 'streamlined' ? libraryFeet(words) : []; if (shoes.length) only.push(`${shoes.join(', ')}: worn as plain boots, shoes or sandals on the streamlined core; the card's cut, sole and adornment need the structured core's foot`);
    if (only.length) out.realisticOnly = only;
  }
  // (GHOST thread lies in the cloth it is worked on: sinking into its own carrier alone is the stitch, not a fault)
  const stitched = (id, a) => { const A = plan.adorn.find((x) => x.id === id); return !!A?.ghost && (a.worst.into || []).every((n) => n === A.part); };
  if (recipe && plan.adorn?.length) { const C = layeredClearance(recipe); out.clearance = { sinking: C.sinking.filter((id) => !C.adornments[id] || !stitched(id, C.adornments[id])), worst: Object.fromEntries(Object.entries(C.adornments).map(([id, a]) => [id, { at: a.worst.dial ? `${a.worst.dial} ${a.worst.value}` : 'rest', share: a.worst.share, ...(a.worst.into?.length ? { into: a.worst.into } : {}) }])) }; }
  return out;
}
/** what the hero's form rests on: the worn head's fit (views observed, views inferred), whether the face moved off it
 * (then the face is AUTHORED, not fitted), and the body (authored from a cast and a tune, no reference). */
export function heroEvidence(hero) {
  if (hero.head === 'anime') {
    const moved = Object.entries(composeAnime(hero, 'bob').face).filter(([k, v]) => v !== ANIME_FACE.DEFAULT[k]).map(([k]) => k);
    const sc = composeAnime(hero, 'bob').sculpt, scMoved = sc === false ? null : describeAnimeSculpt(sparseSculpt(sc));
    const cut = hero.hair === 'none' ? null : animeEffective(hero).hairCut;
    return { head: { construction: 'the Anime Form Studio head (authored, no fit, no reference)', base: headPoleOf(hero), face: moved.length ? `authored off the base: ${moved.join(', ')}` : 'as the base', sculpt: sc === false ? "the studio's face (sculpt false)" : scMoved ? `the graphic face, authored off its base: ${scMoved}` : 'the graphic face, as the base',
      hair: hero.hair === 'none' ? 'none' : cut ? `the ${headPoleOf(hero)} hair base: the ${cut} cut over its form` : "a named family over the hair base's form" }, body: 'authored: a cast and a tune, no reference' };
  }
  if ((hero.head ?? 'landmark') !== 'landmark') return { head: typeof hero.head === 'string' ? `${hero.head}: no fit` : 'include: as given', body: 'authored: a cast and a tune, no reference' };
  const pole = headPoleOf(hero); const E = fitEvidence(pole); const moved = Object.entries(hero.face || {}).filter(([, v]) => v !== 1).map(([k]) => k);
  return { head: { fit: pole, observed: E.observed.map((o) => `${o.view} (${o.yawDegrees}°)`), inferred: E.inferred, face: moved.length ? `authored off the fit: ${moved.join(', ')}` : 'as fitted' }, body: 'authored: a cast and a tune, no reference' };
}
/** What the face did, in metres off the fitted head's landmarks at the worn scale: crown to chin, across the cheekbones,
 * across the jaw angles, between the pupils. */
export function faceMeasures(hero, plan) {
  const inc = plan.include?.find((i) => i.name === 'head'); if (!inc) return null;
  // the anime head measures itself (at its worn head scale); the figure's cast scale is applied after
  // (the graphic face's `features` are ratios: carried unscaled)
  // the figure's scale is the plan's own (hero-form.js planScale: the cast's scale times the tune's stature, on the
  // proportions the head wears), so a stature-only tune moves the metres and leaves the heads-tall where it was
  if (hero.head === 'anime') { const k = planScale({ cast: hero.cast, tune: animeEffective(hero).tune, proportions: hero.proportions ?? 'anime' }); return inc.faceMeasures ? Object.fromEntries(Object.entries(inc.faceMeasures).map(([m, v]) => [m, m === 'features' ? v : Math.round(v * k * 1000) / 1000])) : null; }
  const props = hero.proportions ?? 'hero', scale = planScale({ cast: hero.cast, tune: hero.tune, proportions: props });   // the worn head is scaled with the figure
  const headScale = (hero.headScale ?? castOf(hero.cast, props)?.headScale ?? 1) * (hero.tune?.head ?? 1);   // humanoid-plan wornHead
  const a = humanoidAnchors(headPoleOf(hero), hero.face ?? {}), k = scale * headScale, r3 = (x) => Math.round(x * k * 1000) / 1000;
  return { head_m: r3(a.crown[2] - a.menton[2]), cheekbones_m: r3(2 * a.zygionR[0]), jaw_m: r3(2 * a.gonionR[0]), pupils_m: r3(2 * a.eyeR[0]) };
}

/** What the tune did, in the operator's units: height off the compiled stats, the yoke and the pelvis off the plan's rings. */
export function heroMeasures(plan, stats) {
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const torso = plan.segments.find((s) => s.name === 'torso'), thigh = plan.segments.find((s) => s.name === 'thighR');
  return {
    height_m: stats?.size?.h ?? null,
    shoulder_m: torso ? r3(2 * (torso.stations.find((st) => st.id === 'st3') ?? torso.stations[3]).r[0]) : null,   // across the yoke ring at the shoulders
    hip_m: thigh ? r3(2 * (thigh.stations[1].at[0] + thigh.stations[1].r[0])) : null,   // across the pelvis at the hip rings
  };
}

/** The NECK the anime hero wears, off the compiled figure at rest: its form (`loft`, a cast's neck form, or the
 * `segment`), its width across a horizontal section halfway from the collar ring to the front chin tip, and that width
 * over W — the face width at the cheek outline, the feature table's W (the front half of the face's skin between the lip
 * line and the eye level). Null without a mesh or a neck. */
export function neckReadout(plan, mesh) {
  const seg = plan?.segments?.find((s) => s.name === 'neck'), torso = plan?.segments?.find((s) => s.name === 'torso');
  if (!mesh || !seg || !torso || !mesh.parts?.neck || !mesh.parts?.face) return null;
  const skin = [], sclera = [], mouth = [], neck = [];
  mesh.faces.forEach((t, fi) => {
    const part = mesh.provenance[t[0]].part, g = mesh.groups[fi], tri = t.map((vi) => mesh.vertices[vi]);
    if (part === 'neck') neck.push(tri);
    else if (part === 'face') (g === 'Skin' ? skin : g === 'Sclera' ? sclera : g === 'Mouth' ? mouth : []).push(...tri);
  });
  if (!skin.length || !neck.length) return null;
  const ys = skin.map((p) => p[1]), midY = (Math.min(...ys) + Math.max(...ys)) / 2, mean = (P) => P.reduce((a, p) => a + p[2], 0) / P.length;
  const eyeZ = mean(sclera.filter((p) => p[0] > 0)), mouthZ = mean(mouth);
  const chin = Math.min(...skin.filter((p) => Math.abs(p[0]) < 0.004 && p[1] > midY).map((p) => p[2]));
  const W = 2 * skin.filter((p) => p[1] > midY && p[2] > mouthZ && p[2] < eyeZ).reduce((a, p) => Math.max(a, Math.abs(p[0])), 0);
  const z = (torso.stations.at(-1).z + chin) / 2; let lo = Infinity, hi = -Infinity;
  for (const T of neck) for (let e = 0; e < 3; e++) { const a = T[e], b = T[(e + 1) % 3], da = a[2] - z, db = b[2] - z; if ((da < 0) !== (db < 0)) { const x = a[0] + (b[0] - a[0]) * (da / (da - db)); if (x < lo) lo = x; if (x > hi) hi = x; } }
  if (!(hi > lo) || !(W > 0)) return null;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return { form: seg.kind === 'loft' ? 'loft' : 'segment', width_m: r3(hi - lo), ofW: r3((hi - lo) / W) };
}

/** The BUDGET a hero spends (a standing machine metric, advice only): the compiled mesh's triangles and vertices per
 * palette group (a vertex counts in each group whose faces use it), largest first, and the stored plan and recipe in
 * bytes (the row carries both; the recipe as stored, without the parts it copies whole from the plan's include). */
export function heroBudget(plan, mesh, recipe) {
  if (!mesh) return null;
  const tris = new Map(), verts = new Map();
  mesh.faces.forEach((t, fi) => { const g = mesh.groups[fi] ?? 'none'; tris.set(g, (tris.get(g) || 0) + 1); let s = verts.get(g); if (!s) verts.set(g, s = new Set()); for (const vi of t) s.add(vi); });
  const groups = Object.fromEntries([...tris.keys()].sort((a, b) => tris.get(b) - tris.get(a) || (a < b ? -1 : 1)).map((g) => [g, { triangles: tris.get(g), vertices: verts.get(g).size }]));
  return { triangles: mesh.faces.length, vertices: mesh.vertices.length, groups, bytes: { plan: plan ? Buffer.byteLength(JSON.stringify(plan)) : 0, recipe: recipe ? Buffer.byteLength(JSON.stringify(plan ? packRecipe(plan, recipe) : recipe)) : 0 } };
}

/** How far a hand may sink past its rest overlap, and a free sole below or above the floor, before the readout advises. */
const GESTURE_SINK_MM = 5, GESTURE_SOLE_MM = { sink: 5, float: 10 };
/** The STAND the hero holds, measured on the compiled figure skinned at its `gesture` clip: the word, the support, the
 * hand and forearm against the torso, the bust and the thighs (hero-gesture.js gestureClearance), and the free foot's
 * sole against the floor (the rig holds a planted toe; a free foot is placed by its own angles). Null without a stand. */
export function gestureReadout(hero, mesh, recipe) {
  if (!mesh || !recipe?.rig || !recipe.clips?.[GESTURE_CLIP]) return null;
  const R = validateRig(recipe.rig); const pose = standPose(recipe, R); if (!pose) return null;
  const P = poseLayered(mesh, recipe, pose, { R }); const V = P.mesh.vertices;
  const sole = (verts, S) => { let lo = Infinity; mesh.vertices.forEach((_, i) => { const part = mesh.provenance[i].part; if (part === `foot${S}` || part === `toes${S}` || /^(hallux|toe\d)[RL]$/.test(part) && part.endsWith(S)) lo = Math.min(lo, verts[i][2]); }); return lo; };
  const free = Object.entries(P.report.legs).filter(([, l]) => !l.planted).map(([S]) => S).sort();
  const freeSoleMm = Object.fromEntries(free.map((S) => [S, Math.round((sole(V, S) - sole(mesh.vertices, S)) * 10000) / 10 + 0]));   // + 0: no −0
  return { word: gestureWord(heroGesture(hero)) ?? 'data', support: pose.support ?? 'both', clearance: gestureClearance(mesh, V), ...(free.length ? { freeSoleMm } : {}) };
}
/** The stand's advice: a hand sunk into the body, a free sole off the floor, and the reshaping dials beside a stand (the
 * rig poses the REST joints, so a leaned trunk or a widened stance is posed again about joints that did not move). */
function gestureWarnings(g, dials) {
  if (!g) return [];
  const out = [];
  for (const [pair, c] of Object.entries(g.clearance.pairs)) if (c.depthMm - c.restDepthMm > GESTURE_SINK_MM) { const [a, b] = pair.split('→'); out.push(`gesture '${g.word}': ${a} sinks ${c.depthMm} mm into ${b} (${c.inside} points) on this body — its values were placed on another; set /hero/gesture to another stand or edit the arm (/hero/gesture as an object or a list ending in one)`); }
  for (const [S, mm] of Object.entries(g.freeSoleMm || {})) if (mm < -GESTURE_SOLE_MM.sink || mm > GESTURE_SOLE_MM.float) out.push(`gesture '${g.word}': the free ${S === 'L' ? 'left' : 'right'} foot ${mm < 0 ? `sinks ${-mm} mm below` : `floats ${mm} mm above`} the floor on this body — edit hip${S} / knee${S} in /hero/gesture`);
  const lean = dials?.lean ?? 0, stance = dials?.stance ?? 1;
  if (lean !== 0 || stance !== 1) out.push(`gesture '${g.word}' beside ${[lean !== 0 ? `lean ${lean}` : null, stance !== 1 ? `stance ${stance}` : null].filter(Boolean).join(' and ')}: the stand poses the rest joints, so the dial's reshaping is posed a second time — set the dial back to rest (lean 0, stance 1) or /hero/gesture to 'rest'`);
  return out;
}

/** Clip durations with the door's gaits over the hero's own: a gait (hero-motion.js motionPlan, `recipe.locomotion`)
 * replaces the clip of its name, so it plays at the gait's seconds. Only where durations are said (`seconds` non-empty). */
function locoSeconds(seconds, locomotion) {
  if (!seconds || !Object.keys(seconds).length || !locomotion) return seconds;
  const out = { ...seconds };
  for (const [name, g] of Object.entries(locomotion)) if (name in out && Number.isFinite(g?.seconds)) out[name] = g.seconds;
  return out;
}

/** The door's CLIPS as the readout says them (only on a hero that authored some): every clip the figure plays, in
 * order (the stand first when it stands), the door's own (new or replacing the hero's of that name), and the hero's own
 * it removed; on the anime head each played clip's designed duration (`seconds`) and the door clips carrying a facial
 * track (`face`). */
function clipsReadout(hero, recipe) {
  if (!hero.clips) return null;
  const names = Object.keys(hero.clips), removed = names.filter((n) => hero.clips[n] === false);
  const seconds = locoSeconds(heroClipSeconds(hero, recipe?.clips) ?? {}, recipe?.locomotion);
  const face = hero.head === 'anime' || (hero.head ?? 'landmark') === 'landmark' ? names.filter((n) => hero.clips[n] !== false && (Array.isArray(hero.clips[n]) ? hero.clips[n] : hero.clips[n]?.keys || []).some((k) => k?.face !== undefined && k.face !== null)) : [];
  return { plays: Object.keys(recipe?.clips || {}), authored: names.filter((n) => hero.clips[n] !== false), ...(removed.length ? { removed } : {}), ...(Object.keys(seconds).length ? { seconds } : {}), ...(face.length ? { face } : {}) };
}

/** The hero readout that rides the mint and every `/hero` edit: cast, register, the tune with its trail, metres, the
 * stand, the door's clips, the budget, advice. `mesh` is the compiled figure the row shows (its dials and channels);
 * `dressMesh` the one the dress ledgers read (the door's is compiled at rest, as it always was; default `mesh`). */
export function heroReadout(hero, plan, stats, extraWarnings = [], { mesh, recipe, dressMesh = mesh } = {}) {
  const movedOf = (r) => Object.fromEntries(Object.entries(r || {}).filter(([, v]) => v !== 1));
  const kind = headOf(hero), landmark = kind === 'landmark', anime = kind === 'anime';
  const inc = plan.include?.find((i) => i.name === 'head');
  const eff = anime ? animeEffective(hero) : null;
  const hair = landmark ? resolveHair(hero.hair ?? 'swept') : anime ? (eff.hair === 'none' ? { style: 'none' } : eff.hair) : null;
  const animeFace = anime ? eff.face : null, animeExpression = anime ? eff.expression : null, tune = anime ? eff.tune : hero.tune;
  // the anime head's feature spacing is advised against its base's bands (anime-sculpt.js FEATURE_BANDS) unless a look
  // names another character; the table itself rides faceMeasures either way
  const warnings = [...(hero.core === 'streamlined' ? [STREAMLINED_DEPRECATED] : onClassic(hero) ? [CLASSIC_DEPRECATED] : []), ...(recipe?.statue?.warnings ?? []), ...tuneWarnings(tune), ...(landmark ? [...faceWarnings(hero.face), ...hairWarnings(hair)] : []),
    ...(anime ? [...animeFaceWarnings(animeFace, headPoleOf(hero), { sculpt: eff.sculpt }), ...animeSculptWarnings(eff.sculpt), ...(hero.look?.length ? [] : inc?.faceMeasures?.features?.advice ?? []), ...(hair.style === 'none' ? [] : animeHairWarnings(hair, { words: eff.hairWords })), ...animeExpressionWarnings(animeExpression), ...animeCoverageWarnings(inc?.hairCoverage), ...animeFaceZoneWarnings(inc?.hairCoverage, { veil: hair.veil })] : []), ...extraWarnings];
  const dress = dressReadout(styledHero(hero), plan, dressMesh, recipe);
  // the stylism's notes, and the outline read back off the dressed figure (the arms left out)
  if (dress && hero.stylism) { const L = stylismLedger(hero);
    if (dressMesh?.faces) { const R = readSilhouette(dressMesh), advice = silhouetteAdvice(L.silhouette.outline, R); L.silhouette.read = { outline: R.outline, widths: R.widths, cohesive: R.cohesive, ...(R.cohesive ? {} : { islands: R.islands, floating: R.floating }) };
      if (advice) L.notes.push({ stage: 'silhouette', technique: 'read', where: 'the front outline', principle: 'the outline reads at a thumbnail', why: advice });
      // ONE SHAPE: a mass standing apart reads as a floating bit, unless the genre is a detached one
      if (!R.cohesive && !L.silhouette.detached) { const gaps = cohesionAdvice(R); L.notes.push({ stage: 'silhouette', technique: 'gaps', where: gaps.where, principle: 'the outline is one shape', why: gaps.why }); warnings.push(`stylism: ${gaps.why}`); } }
    dress.stylism = L; }
  const stand = gestureReadout(hero, mesh, recipe); warnings.push(...gestureWarnings(stand, stats?.layered?.dials));
  // the midsection measured (hero-core-measures.js) for the design loop's critic; its advice joins the warnings on the
  // structured core (the default: its bands are its contract), and stays in `core.advice` on a streamlined hero
  const coreM = coreMeasures(plan, mesh), coreBody = castOf(hero.cast, hero.proportions ?? (anime ? 'anime' : 'hero'))?.silhouette === 'female' ? 'female' : 'male';
  const core = coreM ? { core: hero.core ?? DEFAULT_CORE, body: coreBody, ...coreM, advice: coreAdvice(coreM, coreBody) } : null;
  if (core && core.core === 'structured') warnings.push(...core.advice);
  // a designed piece with no place on this body is said, never dropped without a word (sortPieces)
  const styledOutfit = styledHero(hero).outfit;
  if (isOutfitBuild(styledOutfit) && styledOutfit.pieces?.length) for (const u of sortPieces(plan, styledOutfit).unworn) warnings.push(`outfit.pieces: the ${u.kind} is not worn: ${u.why}`);
  const clips = clipsReadout(hero, recipe);
  const budget = heroBudget(plan, mesh, recipe);
  const unjustified = (dress?.adornments || []).filter((a) => a.verdict !== 'justified').map((a) => `adornment ${a.id}: its ${a.signature} ${a.verdict === 'unjustified' ? 'does not read' : 'reads but is a small share of its picture'} (exposed ${a.exposed}, share ${a.share}; wants ≥ 0.25 and ≥ 0.08) — make the element bolder or ask whether the adornment is wanted`);
  if (unjustified.length) warnings.push(...unjustified);
  if (dress?.armor?.worn?.includes('kabuto') && hair && hair.style !== 'none') warnings.push(`the kabuto covers the head and the hair (${hair.style}) passes through it: set /hero/hair/style 'none'`);
  // (a hard-suit's SHELL helm is cast over the whole head, as the kabuto is)
  if (dress?.armor?.worn?.includes('helm') && armorLanguage(hero.adorn)?.helm === 'shell' && hair && hair.style !== 'none') warnings.push(`the shell helm covers the head and the hair (${hair.style}) passes through it: set /hero/hair/style 'none'`);
  for (const id of dress?.clearance?.sinking || []) { const w = dress.clearance.worst[id]; warnings.push(`adornment ${id} sinks into ${(w.into || []).join(', ') || 'the body'} at ${w.at} (${Math.round(w.share * 100)} % of its points): keep that dial nearer rest, or move the adornment`); }
  const ownMoved = (r, one = (k) => ANIME_FACE.DEFAULT[k] ?? ANIME_HAIR.DEFAULT[k] ?? 1) => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'style' && k !== 'locks' && typeof v === 'number' && v !== one(k))) : r);
  return { cast: hero.cast, register: hero.register, tune, ...(hero.from ? { from: hero.from } : {}), moved: movedOf(tune), measures: heroMeasures(plan, stats),
    ...(anime && hero.look?.length ? { look: hero.look, lookFrom: hero.look.join('+'), own: { face: ownMoved(hero.face), hair: hero.hair === 'none' ? 'none' : { ...(hero.hair?.style ? { style: hero.hair.style } : {}), ...ownMoved(hero.hair), ...(Object.keys(hero.hair?.locks || {}).length ? { locks: Object.keys(hero.hair.locks) } : {}) }, ...(hero.expression ? { expression: hero.expression } : {}), ...(hero.sculpt !== undefined ? { sculpt: hero.sculpt } : {}), tune: movedOf(hero.tune) } } : {}),
    head: landmark ? 'landmark' : typeof hero.head === 'string' ? hero.head : 'include', ...(hero.genki ? { genki: hero.genki } : {}),
    ...((F) => (F ? { realisticFace: F } : {}))(faceReadout(hero)),
    ...(anime ? { base: headPoleOf(hero), proportions: hero.proportions ?? 'anime', ...(inc?.faceMeasures ? (() => { const fm = faceMeasures(hero, plan); return { headsTall: Math.round((inc.shift[2] + fm.crown_z) / fm.head_m * 100) / 100 }; })() : {}), face: animeFace, ...(hero.faceFrom ? { faceFrom: hero.faceFrom } : {}), faceMoved: Object.fromEntries(Object.entries(animeFace).filter(([k, v]) => v !== ANIME_FACE.DEFAULT[k])),
      sculpt: eff.sculpt === false ? false : sparseSculpt(eff.sculpt) ?? {},
      // hairMoved: what moved off the hair base the door applied (its form, and its cut when worn), the look's moves included
      hair, hairMoved: hair.style === 'none' ? {} : (() => { const B = animeHairBaseOf(hero, eff); const lockMoved = Object.keys(hair.locks || {}).filter((n) => JSON.stringify(hair.locks[n]) !== JSON.stringify(B.locks[n])); return { ...Object.fromEntries(ANIME_HAIR_KEYS.filter((k) => hair[k] !== B[k]).map((k) => [k, hair[k]])), ...(lockMoved.length ? { locks: lockMoved } : {}) }; })(),
      // the hair base worn: its cut (a hair word) when nothing named a family, else null; its form rides in `hair`
      hairCut: eff.hairCut ?? null,
      hairMeasures: inc?.hairMeasures ?? null, ...(inc?.hairCoverage ? { hairCoverage: inc.hairCoverage } : {}), expression: animeExpression, faceMeasures: faceMeasures(hero, plan), ...(mesh ? { neck: neckReadout(plan, mesh) } : {}) } : {}),
    ...(landmark ? { face: hero.face, ...(hero.faceFrom ? { faceFrom: hero.faceFrom } : {}), faceMoved: movedOf(hero.face), hair, hairMoved: movedOf(Object.fromEntries(Object.entries(hair).filter(([k]) => k !== 'style'))), hairMeasures: inc?.hairMeasures ?? null, expression: hero.expression, faceMeasures: faceMeasures(hero, plan) } : {}),
    evidence: heroEvidence(hero),
    ...(dress ? { dress } : {}),
    ...(recipe?.statue ? { statue: recipe.statue } : {}),
    ...(stand ? { gesture: stand } : {}),
    ...(core ? { core } : {}),
    ...(clips ? { clips } : {}),
    ...(hero.gear && recipe?.rig ? { gear: (() => { const R = validateRig(recipe.rig); const out = gearReadout(gearMounts(hero, R), R); const sw = heroSwing(hero, { expand: expandEquipment, gearBuild });
      // the swing's contact data for a game's hit test (the clip never reads it): the impact's phase, the window, the reach
      if (sw && out[sw.hand]) out[sw.hand].swing = { word: sw.word, class: sw.cls, strike: sw.strike, window: sw.window, reachM: out[sw.hand].lengthM, cone: 70 };
      return out; })() } : {}),
    ...(budget ? { budget } : {}),
    // the style critics (hero-style-critic.js): the proportions in head heights against the western and the anime canon,
    // the hero's own style named; and with a target, where its triangles go against the tier's reserve (cast-spend.js)
    // (an adult female figure's chest is read too: its spacing, its height and the gap at the sternum)
    ...((sm) => (sm ? { critic: { style: anime || hero.proportions === 'anime' ? 'anime' : 'western', measures: sm, western: styleCritic(sm, 'western', coreBody), anime: styleCritic(sm, 'anime', coreBody),
      ...(coreBody === 'female' && !childCoding(hero) ? ((cm) => (cm ? { chest: { measures: cm, ...chestCritic(cm) } } : {}))(chestMeasures(plan, mesh, sm.head_m)) : {}) } } : {}))(mesh ? styleMeasures(plan, mesh) : null),
    // the carried gear is drawn beside the figure's mesh (hero-gear.js): the spend counts it as its own region
    ...(mesh && heroTarget(hero) ? { spend: castSpend(mesh, plan, heroTarget(hero), { gear: hero.gear && recipe?.rig ? gearTriangles(gearMounts(hero, validateRig(recipe.rig))) : null }) } : {}),
    // the painterly look (era/looks.js): its conventions built and still planned
    ...(hero.painterly ? { painterly: lookReadout('painterly-toon') } : {}),
    ...(budget && heroTarget(hero) ? { density: { ...castDensityReadout(plan, heroTarget(hero), budget.triangles), era: heroEra(hero), ...(hero.geocube ? { geocube: readGeocube(hero.geocube).id } : {}),
      ...((pl) => (pl.length ? { planned: pl } : {}))(eraCastConventions(heroEra(hero)).filter((c) => c.status === 'planned').map((c) => c.id)),
      ...((pt) => (pt.length ? { partial: pt } : {}))(eraCastConventions(heroEra(hero)).filter((c) => c.status === 'partial').map((c) => c.id)) } } : {}),
    ...(warnings.length ? { warnings } : {}) };
}

/** The hero door: a cast word and a tune → the hero form's plan → the plan door, with `hero` stored beside the plan. */
/** the landmark head's hair stamped with the grown fall (humanoid-hair.js withGrownFall) where the recipe is written: a
 * new hero's fall hangs by the spine law and frames the face; a stored hero keeps its bytes. The anime head's hair and
 * the realistic body's relational head are their own builders and are left as given. */
function withGrownHair(spec) {
  if (!spec || typeof spec !== 'object' || spec.hair === undefined || spec.hair === null) return spec;
  if (spec.head !== undefined && spec.head !== 'landmark') return spec;
  const hair = withGrownFall(spec.hair);
  return hair === spec.hair ? spec : { ...spec, hair };
}

export async function createLayeredHeroHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("The hero door takes spec { cast?, register?, tune?, face?, hair?, expression?, sculpt?, detail?, adorn?, body?, palette?, head?, gesture?, clips?: { <name>: [keys] | { seconds, keys } | false } (a key's face on the anime or the landmark head), blink?: false, title? }. Read get_solid_vocab({ id: 'layered' }) (the Hero door, and its hero-* sections: get_solid_vocab({ id: 'layered', section: 'hero-looks' }) …).");
  // a word the door does not take is refused by name with where it belongs (it was dropped without a word)
  const unknown = Object.keys(input).filter((k) => !HERO_FIELDS.includes(k) && !HERO_DOOR_KEYS.includes(k));
  if (unknown.length) throw new Error(`hero refused:\n - ${unknown.map(heroKeyHint).join('\n - ')}\nThe hero door — manual: get_solid_vocab({ id: 'layered' }) (the Hero door).`);
  const { spec: heroSpec, vibe } = lowerVibe(Object.fromEntries(HERO_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]])), input.vibe);
  // a new hero walks with the calibrated gait unless it brings its own walk (withDefaultWalk), and the door's gaits are
  // stored by value as they are minted now (motion-stamp.js), so a later mint table never moves them
  const hero = heroRecord(stampHero(withDefaultWalk(withRolledFace(withGrownHair(withDefaultForm(heroSpec))))));
  let plan;
  try { plan = heroPlanOf(hero); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }) (the Hero door, and its hero-* sections by name).`); }
  const rest = Object.fromEntries(Object.entries(input).filter(([k]) => !HERO_FIELDS.includes(k) && k !== 'vibe'));
  let planned = null;   // the mint's own compiled figure: the readout's stand and budget read it
  const out = await createLayeredPlanHandler({ ...rest, plan, hero, title: input.title ?? `hero · ${castLabel(hero.cast)}${hero.head === 'anime' ? ` · anime${hero.look?.length ? ` · ${hero.look.join('+')}` : ''}` : ''}${hero.from ? ` · ${hero.from}` : ''}${hero.faceFrom ? ` · ${hero.faceFrom}` : ''}` }, { onPlanned: (p) => { planned = p; } });
  const face = hero.head === 'anime' ? ` The anime head by word: /hero/face/<control> (${ANIME_FACE_KEYS.join(', ')}; 1 = the base, tilt an offset); the hair: /hero/hair/style (${ANIME_HAIR_STYLES.join(', ')}), /hero/hair/<control> (${ANIME_HAIR_KEYS.join(', ')}) and /hero/hair/locks/<clump> ({ cx, cy, cz, tx, ty, tz }: fringe-1…7, left-temple-0…2, right-temple-0…2, back-1…11, crown-±1-0…2 on short); the hair's form /hero/hair/<word> (${ANIME_HAIR_FORM_WORDS.join(', ')}; lift { crown, temple, fringe, nape } in construction units; false the studio's construction, null back to the base's); the hair base (the cut worn while no family is named: ${Object.entries(ANIME_HAIR_BASE).map(([pole, b]) => `${b.cut} on the ${pole}`).join(', ')}, its form under every family); /hero/expression (${Object.keys(ANIME_POSES).join(', ')} or { blink, smile, open, brow }). The graphic face: /hero/sculpt (an object of ${ANIME_SCULPT_KEYS.join(', ')}, ${Object.keys(SCULPT_SHAPE_KEYS).join(', ')}; 1 = the base, positions and angles offsets; moves ${ANIME_SCULPT.MOVE_NAMES.join(', ')}; false for the studio's face), then /hero/sculpt/<word>. A LOOK composes presets by word: set /hero/look to a list (archetypes ${LOOK_TABLES.archetype.join(', ')}; face traits ${LOOK_TABLES.face.join(', ')}; graphic-face traits ${LOOK_TABLES.sculpt.join(', ')}; hair traits and families ${LOOK_TABLES.hair.join(', ')}; poses); the controls above apply on top of it.` : hero.head === 'landmark' ? ` The face by word too: /hero/face/<control> (${FACE_KEYS.join(', ')}; groups ${FACE_AGGREGATE_KEYS.join(', ')}; moves ${FACE_MOVE_NAMES.join(', ')}); the hair: /hero/hair/style (${HAIR_STYLE_NAMES.join(', ')}) and /hero/hair/<control> (${HAIR_KEYS.join(', ')}); /hero/expression.` : '';
  const dressNext = ` Detail and adornment: /hero/detail (${DETAIL_WORDS.join(', ')}), /hero/outfit (garments that follow the body: an outfit build { type: 'outfit', style, dials }, restyled by /hero/outfit/dials/<stylize | fit | coverage | ornament> and /hero/outfit/style; or ${Object.keys(OUTFIT_WORDS).join(', ')}, or a list), /hero/paint (second skin: ${Object.keys(PAINT_WORDS).join(', ')}, or a list) and /hero/adorn (${KIT_WORDS.join(', ')}); or an armour build /hero/adorn { type: 'armor', style, dials, theme? }, restyled by /hero/adorn/dials/<stylize | coverage | mass | ornament>, /hero/adorn/style and /hero/adorn/theme. The stand: /hero/gesture (${GESTURE_WORDS.join(', ')}, or pose words ${GESTURE_KEYS.join(', ')}). Clips: set /hero/clips to { <name>: [keys] } (each key an object of the stand's pose words; the head and neck may aim; heelL, heelR, lift, support: 'none'${jawedHead(hero) ? ', jaw' : ''}), then /hero/clips/<name> (remove drops a door clip); a name the figure plays (${Object.keys(plan.clips || {}).filter((c) => c !== GESTURE_CLIP).join(', ')}) replaces that clip, false removes one of the hero's own.${hero.head === 'anime' ? ` On the anime head a key may carry face (an expression word, { blink, smile, open, brow } or a list), a clip may be { seconds, keys } (its designed duration; the clips play ${Object.entries(locoSeconds(heroClipSeconds(hero, plan.clips) || {}, plan.locomotion)).filter(([c]) => c !== GESTURE_CLIP).map(([c, s]) => `${c} ${s} s`).join(', ')}), and /hero/blink false turns the ambient blink off.` : (hero.head ?? 'landmark') === 'landmark' ? ` A key may carry face (an expression word, or { word?, browRaise, browTilt, mouthCorner, aperture, blink }: the face's blend shapes in an export), and /hero/blink false turns the ambient blink off.` : ''} A statue: /hero/statue (a period card: ${STATUE_STYLES.join(', ')}; or { type: 'statue', style, material: ${STATUE_MATERIAL_WORDS.join(' | ')}, crop: ${STATUE_CROP_WORDS.join(' | ')}, lose: [head, armR, forearmL, …], base: ${STATUE_BASE_WORDS.join(' | ')}, dials: { wear } }).`;
  // the dress ledgers read the figure at REST (every dial at its rest, no channels), as the door always measured them;
  // the mint's own mesh is that figure unless the mint turned a dial or carried a channel
  const dressed = hero.detail !== undefined || hero.adorn !== undefined;
  const atRest = planned && !planned.channels && Object.entries(planned.recipe.dials || {}).every(([k, d]) => planned.dials?.[k] === d.rest);
  const dressMesh = dressed && planned ? (atRest ? planned.mesh : compileLayered(planned.recipe, {})) : planned?.mesh;
  return {
    ...out,
    hero: heroReadout(hero, plan, out.stats, [], { mesh: planned?.mesh, recipe: planned?.recipe, dressMesh }),
    ...(vibe ? { vibe: { ...vibe, motion: hero.motion ?? null, gesture: hero.gesture ?? null } } : {}),
    next: { tool: 'update_sketch', args: { ref: out.ref, patch: [{ op: 'set', path: '/hero/tune/<control>', value: '<ratio to the cast, 1 = as cast>' }] }, reason: `Tune a proportion by word (${TUNE_KEYS.join(', ')}; groups ${TUNE_AGGREGATE_KEYS.join(', ')}; moves ${HERO_MOVE_NAMES.join(', ')}); the plan and the recipe regenerate in place.${face}${dressNext} Turn a live dial via /dials/<name>.` },
  };
}

/** The plan audit — WHO printed the numbers. Mojulo is loopback and cannot watch a worker, so this is form + presence
 * (the dream-audit posture): `source` 'agent' (the agent wrote the numbers itself), 'text:<model>' or 'image:<worker>'
 * (a worker did; then `prompt` and one of job_id | token | seed | image_sha256 are required). Malformed refuses. */
export const PLAN_SOURCE_RE = /^(agent|text:[\w.@:/-]+|image:[\w.@:/-]+)$/;
export const PLAN_PROVENANCE_KIND = 'plan-reconstruction';
export function validatePlanAudit(audit, label = 'plan_audit') {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return [`${label}: must be an object — { source: 'agent' | 'text:<model>' | 'image:<worker>', prompt?, job_id | token | seed | image_sha256? }`];
  const errors = [];
  if (typeof audit.source !== 'string' || !PLAN_SOURCE_RE.test(audit.source)) errors.push(`${label}.source: required — 'agent', 'text:<model>' (e.g. 'text:codex') or 'image:<worker>' (e.g. 'image:comfyui@127.0.0.1:8188')`);
  if (audit.source !== 'agent') {
    if (typeof audit.prompt !== 'string' || audit.prompt.trim().length < 8) errors.push(`${label}.prompt: required when a worker printed the plan — the request it was given (≥ 8 chars)`);
    const gen = audit.job_id ?? audit.token ?? audit.seed ?? audit.image_sha256;
    if (gen === undefined || gen === null || String(gen).trim() === '') errors.push(`${label}: required one of job_id | token | seed | image_sha256 — a handle on the worker's answer`);
  }
  return errors;
}

/** The plan door: expand the ring plan into the recipe, then mint as usual with the plan (and its audit) stored beside it.
 * `internal` is the doors' own (never a tool argument): `onPlanned({ mesh, recipe, stats })` sees the mint's compiled mesh. */
export async function createLayeredPlanHandler(input, internal = {}) {
  if (!input || typeof input !== 'object' || !input.plan || typeof input.plan !== 'object') {
    throw new Error("The plan door needs `plan` — { schema: 'layered-plan-v1', frame, joints, segments, details?, include?, dials?, rig?, clips? }. Read get_solid_vocab({ id: 'layered' }) (the Plan section); the worked plans are docs/examples/dragon-body/seed-recipe.mjs and docs/examples/ring-plans/.");
  }
  let provenance;
  if (input.plan_audit !== undefined) {
    const errors = validatePlanAudit(input.plan_audit);
    if (errors.length) throw new Error(`plan_audit refused:\n - ${errors.join('\n - ')}`);
    const { source, prompt, job_id, token, seed, image_sha256 } = input.plan_audit;
    provenance = { kind: PLAN_PROVENANCE_KIND, plan_audit: { source, ...(prompt ? { prompt } : {}), ...(job_id != null ? { job_id } : {}), ...(token != null ? { token } : {}), ...(seed != null ? { seed } : {}), ...(image_sha256 != null ? { image_sha256 } : {}) } };
  }
  const cubeErrs = creatureCubeErrors(input);
  if (cubeErrs.length) throw new Error(`layered refused:\n - ${cubeErrs.join('\n - ')}`);
  let recipe;
  try { recipe = expandHeroAwarePlan(input.plan, input.hero, input.hero ? null : input.geocube); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  return createLayeredHandler({ ...input, recipe, ...(provenance ? { provenance } : {}) }, internal);
}

/** A creature's `geocube` (the level it lives in, as a hero's record names one): a plan's, never a hero's (the hero
 * names it in its record) nor a bare recipe's (no plan to dress) → error strings. */
function creatureCubeErrors(input) {
  if (input.geocube === undefined || input.geocube === null) return [];
  if (input.hero) return ["geocube: a hero names its cube in its record (hero.geocube, create_character's spec)"];
  if (!input.plan) return ['geocube: a creature takes its level through its plan (the plan door): a bare recipe has no plan to dress'];
  try { readGeocube(input.geocube); return []; } catch (e) { return [e.message]; }
}

export async function createLayeredHandler(input, { onPlanned } = {}) {
  if (!input || typeof input !== 'object' || !input.recipe || typeof input.recipe !== 'object' || !input.recipe.parts) {
    throw new Error("The layered kind needs `recipe` — { frame, parts: { <name>: { layer, slots, stations, caps | pin, offsets, faces } }, dials?, creases? }. Read get_solid_vocab({ id: 'layered' }); the worked recipe is docs/examples/dragon-layered/recipe.json.");
  }
  const { title, recipe, plan, hero, provenance, dials, channels, units, facing, seat, toon, hullShade, bake, fieldPaint, rim, strokes, statue, species, ooze, egocube, geocube, ref, folder_ref: folderRef } = input;
  const cubeErrs = creatureCubeErrors(input);
  if (cubeErrs.length) throw new Error(`layered refused:\n - ${cubeErrs.join('\n - ')}`);
  // a CREATURE carved (statue/creature.js): stored beside a plan that is not a hero, carved by the layered resolve on
  // every read; a hero's statue is its own build (/hero/statue)
  if (statue !== undefined) {
    if (hero) throw new Error("a hero's statue is its build: /hero/statue (the layered kind's STATUE section)");
    const errs = validateCreatureStatue(statue);
    if (errs.length) throw new Error(`layered: ${errs.join('; ')}`);
  }
  // the OOZES a species was mutated by (graph/mutagen, the animal door): its form is already the stored plan's; kept for
  // provenance and the read-time layers, and only on an animal
  if (ooze !== undefined) {
    if (typeof species !== 'string' || !species || !ooze || typeof ooze !== 'object') throw new Error("`ooze` is an animal's: create_character({ as: 'animal', spec: { species, ooze } })");
    const errs = mutagenErrors(ooze.oozes, ooze.seed, ooze.stylism);
    if (errs.length) throw new Error(`layered: ${errs.join('; ')}`);
  }
  const fieldErrs = validateFieldPaint(fieldPaint);
  if (fieldErrs.length) throw new Error(`fieldPaint refused:\n - ${fieldErrs.join('\n - ')}\nField paint — manual: get_solid_vocab({ id: 'layered' }) (the Spec section).`);
  const bakeErrs = validateBake(bake);
  if (bakeErrs.length) throw new Error(`bake refused:\n - ${bakeErrs.join('\n - ')}\nThe bake — manual: get_solid_vocab({ id: 'layered' }) (the Spec section).`);
  const lightErrs = toon && typeof toon === 'object' ? toonLightErrors(toon.light) : [];
  if (lightErrs.length) throw new Error(`toon refused:\n - ${lightErrs.join('\n - ')}\nThe character light — manual: get_solid_vocab({ id: 'layered' }) (the Spec section).`);
  // a toon the dial reads is stored as given; so is an explicit OPT-OUT the character light reads (`light: false`, or
  // `ink: false` on the anime hero, whose outline is on by default) — the dial alone would read either as nothing
  const keepToon = !!resolveToon(toon, { light: true }) || (!!toon && typeof toon === 'object' && toon.ink === false && hero?.head === 'anime');
  let manifest = {
    kind: 'layered',
    ...(title ? { title } : {}),
    recipe,
    ...(plan && typeof plan === 'object' ? { plan } : {}),   // the authoring record, when the solid was minted through the plan door
    ...(hero && typeof hero === 'object' ? { hero } : {}),   // one level above the plan: the cast and tune the hero door generated it from
    ...(provenance && typeof provenance === 'object' ? { provenance } : {}),   // who printed the plan (validated by the plan door)
    dials: resolveLayeredDials(recipe.dials || {}, dials || {}),   // every dial stored at its value, so a patch by path finds it
    ...(channels && typeof channels === 'object' ? { channels } : {}),
    units: typeof units === 'string' ? units : 'm',   // stored, not defaulted at read: measure_solid and the STL scale read the manifest's units
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    ...(seat === false ? { seat: false } : {}),
    ...(toon != null ? { toon: keepToon ? toon : undefined } : {}),
    // the shader-look dials (opt-in, rigged recipes): hull-smooth bake normals and the figure rim —
    // stored as authored; the layered world resolve validates shapes on read
    ...(hullShade === true || (hullShade && typeof hullShade === 'object') ? { hullShade } : {}),
    ...(bake === true || (bake && typeof bake === 'object') ? { bake } : {}),
    ...(Array.isArray(fieldPaint) && fieldPaint.length ? { fieldPaint } : {}),   // field paint (field-paint.js): shapes cut into the faces, on every read   // the bake stack (surface-bake.js): painted light per corner, on every read
    ...(Array.isArray(rim) && rim.length === 5 && rim.every(Number.isFinite) ? { rim } : {}),
    ...(strokes !== undefined ? { strokes } : {}),   // drawn lines as the authoring record (layered-strokes.js); usually stored later by update_sketch
    ...(statue !== undefined ? { statue } : {}),   // a creature carved (above); absent ⇒ byte-identical
    ...(ooze !== undefined ? { ooze } : {}),   // { oozes, seed } (above); absent ⇒ byte-identical
    ...(typeof species === 'string' && species ? { species } : {}),   // the species a ring plan was minted as (animal.js): the row is an animal; never read by the resolve
    ...(egocube && typeof egocube === 'object' && typeof egocube.ref === 'string' ? { egocube } : {}),   // the sheet it was made from { ref, rev, print, years?, member? } (create_character { egocube }); never read by the resolve
    ...(geocube !== undefined && geocube !== null ? { geocube } : {}),   // a creature's level (above): its materials, drawn in its light
  };
  const planned = planLayered(manifest); const { stats } = planned;
  if (typeof onPlanned === 'function') onPlanned({ mesh: planned.mesh, recipe: manifest.recipe, stats, dials: manifest.dials, channels: manifest.channels });
  // strokes: validated, each given the camera it was drawn against, and resolved into the ledger
  manifest = prepareStrokes(manifest, planned.mesh);
  const strokeLedger = strokesLedger(manifest, planned.mesh);
  manifest.ledger = persistedLayeredLedger({ ...stats.ledger, ...(strokeLedger ? { strokes: strokeLedger } : {}) });
  const sketch = SketchRepository.create({ title: title || `layered · ${stats.monomers} part${stats.monomers === 1 ? '' : 's'}`, manifest, ref, folderRef: folderRef ?? null });
  warmScenePng(sketch);
  return {
    ok: true, ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`, sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`, url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
    ...(manifest.fieldPaint ? { fieldPaint: fieldPaintReadout(planned.mesh, manifest.fieldPaint) } : {}),
    next: { tool: 'update_sketch', args: { ref: sketch.ref, patch: [{ op: 'set', path: '/dials/<name>', value: '<number>' }] }, reason: 'Turn a dial in place; the solid re-lowers on read.' },
  };
}
