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
import { compileLayered, resolveLayeredDials } from '@/lib/graph/polygonizer/station-loft';
import { expandPlan } from '@/lib/graph/polygonizer/station-loft-plan';
import { coreMeasures, coreAdvice } from '@/lib/graph/polygonizer/hero-core-measures';
import { heroPlan, planScale, castOf, HERO_CASTS, HERO_CORES, REGISTERS, BODY_DEFAULTS, PALETTE as HERO_PALETTE, TUNE_KEYS, TUNE_AGGREGATE_KEYS, HERO_MOVE_NAMES, resolveTune, validateTune, tuneWarnings } from '@/lib/graph/polygonizer/hero-form';
import { humanoidPlan, PALETTE as HUMANOID_PALETTE } from '@/lib/graph/polygonizer/humanoid-plan';
import { humanoidAnchors, EXPRESSIONS, HEAD_PRESETS, FACE_KEYS, FACE_AGGREGATE_KEYS, FACE_MOVE_NAMES, resolveFace, validateFace, faceWarnings } from '@/lib/graph/polygonizer/humanoid-head';
import { HAIR_KEYS, HAIR_STYLE_NAMES, resolveHair, validateHair, hairWarnings } from '@/lib/graph/polygonizer/humanoid-hair';
import { validateCast, CAST_PRESET_NAMES } from '@/lib/graph/polygonizer/figure-cast';
import { DETAIL_WORDS, KIT_WORDS, validateDress, dressPlan, kitPalette, dressContext } from '@/lib/graph/polygonizer/hero-dress';
import { isArmorBuild, armorReadout, ARMOR_LAWS_VERSION } from '@/lib/graph/armor/expand';
import { justify } from '@/lib/graph/polygonizer/station-loft-adorn';
import { layeredClearance } from '@/lib/graph/polygonizer/station-loft-clearance';
import { layeredLegibility } from '@/lib/graph/polygonizer/station-loft-legibility';
import { fitEvidence } from '@/lib/graph/polygonizer/humanoid-head-fit';
import { ANIME_FACE, ANIME_HAIR, ANIME_FACE_KEYS, ANIME_HAIR_KEYS, ANIME_POSES, ANIME_PRESETS, resolveAnimeFace, validateAnimeFace, animeFaceWarnings, resolveAnimeHair, validateAnimeHair, animeHairWarnings, resolveAnimeExpression, validateAnimeExpression, animeExpressionWarnings, animeCoverageWarnings, ANIME_HAIR_BASE, ANIME_HAIR_FORM_WORDS } from '@/lib/graph/polygonizer/anime-head';
import { ANIME_HAIR_STYLES } from '@/lib/graph/polygonizer/anime-head';
import { LOOK_TABLES, validateLook, resolveLook, composeAnime, heroHeadPole as headPoleOf, animeHeroEffective as animeEffective } from '@/lib/graph/polygonizer/anime-looks';
import { ANIME_SCULPT, ANIME_SCULPT_KEYS, SCULPT_SHAPE_KEYS, validateAnimeSculpt, resolveAnimeSculpt, sparseSculpt, animeSculptWarnings, describeAnimeSculpt } from '@/lib/graph/polygonizer/anime-sculpt';
import { layeredStats, persistedLayeredLedger } from '@/lib/graph/polygonizer/station-loft-faces';
import { validateRig, bindLayered, auditRig, layeredClip, rigNodesAt } from '@/lib/graph/polygonizer/station-loft-rig';
import { prepareStrokes, strokesLedger } from '@/lib/mcp/tools/layered-strokes';
import { validateGear, gearRecord, gearMounts, gearReadout, gearBuild } from '@/lib/graph/polygonizer/hero-gear';
import { isSwing, SWING_HAND, heroSwing } from '@/lib/graph/polygonizer/hero-swing';
import { expandEquipment } from '@/lib/graph/equipment/expand';
import { GESTURE_CLIP, GESTURE_WORDS, GESTURE_KEYS, STRUCTURED_STANDS, heroGesture, validateGesture, resolveGesture, withGestureClip, gestureWord, standPose, poseLayered, gestureClearance, validateHeroClips, withHeroClips, heroClipSeconds, CLIP_KEYS } from '@/lib/graph/polygonizer/hero-gesture';

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
  return { mesh, stats: { ...stats, layered: { dials: mesh.dials, parts: Object.keys(mesh.parts).length, auditFailures: stats.auditFailures, ...(rig ? { rig } : {}) } } };
}

/** A manifest carrying a `plan` regenerates its recipe from it; one carrying `hero` regenerates the PLAN from the hero
 * record first (`from: 'plan'` keeps a hand-edited plan and re-expands it alone). Dial values for dials the new recipe
 * lacks are dropped. */
export function expandLayeredManifest(manifest, { from = 'auto' } = {}) {
  if (!manifest?.plan && !manifest?.hero) return manifest;
  const hero = manifest.hero && from !== 'plan' ? normalizeHero(manifest.hero) : manifest.hero;
  const plan = manifest.hero && from !== 'plan' ? heroPlanOf(hero) : manifest.plan;
  const recipe = expandHeroAwarePlan(plan, hero);
  const known = new Set(Object.keys(recipe.dials || {}));
  const dials = Object.fromEntries(Object.entries(manifest.dials || {}).filter(([k]) => known.has(k)));
  return { ...manifest, ...(hero ? { hero } : {}), plan, recipe, dials: resolveLayeredDials(recipe.dials || {}, dials) };
}
/** expandPlan, except that an armour's head piece (a helm, a kabuto, a theme's helm) on the anime head refuses by
 * name: the piece is addressed on the landmark cranium, which the anime head does not carry. */
function expandHeroAwarePlan(plan, hero) {
  try { return expandPlan(plan); } catch (err) {
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

// ─── The hero door ────────────────────────────────────────────────────────
export const HERO_FIELDS = ['cast', 'register', 'tune', 'body', 'girth', 'headScale', 'scale', 'palette', 'head', 'face', 'hair', 'expression', 'headPreset', 'look', 'proportions', 'detail', 'adorn', 'gesture', 'sculpt', 'clips', 'blink', 'gear', 'core'];
const HEAD_WORDS = ['landmark', 'anime', 'none'];
/** the heads that take face / hair / expression / headPreset words */
const WORN = new Set(['landmark', 'anime']);
const headOf = (hero) => hero.head ?? 'landmark';
/** a head whose rig carries a jaw chain (a door clip's `jaw`): the landmark head, or an include with a `jawHinge` joint
 * (hero-form.js decides the chain the same way) */
const jawedHead = (hero) => headOf(hero) === 'landmark' || !!hero.head?.joints?.jawHinge;
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** the figure casts that read as a child (figure-cast.js) and the anime look that says so (anime-looks.js `kid`) */
export const CHILD_CODED_CASTS = Object.freeze(['child', 'chibi']);
const CHILD_CODED_LOOKS = Object.freeze(['kid']);
/** why a hero spec is child-coded (its cast, or a look word), or null */
function childCoding(spec) {
  if (typeof spec.cast === 'string' && CHILD_CODED_CASTS.includes(spec.cast)) return `the '${spec.cast}' cast`;
  const looks = spec.look === undefined || spec.look === null ? [] : Array.isArray(spec.look) ? spec.look : [spec.look];
  const kid = looks.find((w) => CHILD_CODED_LOOKS.includes(w));
  return kid ? `the '${kid}' look` : null;
}

/** Error strings for a hero spec (empty = valid). Form only; the numbers' fitness is heroPlan's to judge. */
export function validateHeroSpec(spec) {
  const errs = [];
  const casts = [...Object.keys(HERO_CASTS), ...CAST_PRESET_NAMES];
  if (spec.cast !== undefined) {
    if (typeof spec.cast === 'string') { if (!HERO_CASTS[spec.cast]) errs.push(...validateCast(spec.cast, 'cast').map((e) => `${e} — or a hero cast (${Object.keys(HERO_CASTS).join(', ')})`)); }
    else errs.push(...validateCast(spec.cast, 'cast'));
  }
  if (spec.register !== undefined && !(typeof spec.register === 'string' ? REGISTERS[spec.register] : spec.register && typeof spec.register === 'object' && typeof spec.register.slots === 'string' && typeof spec.register.limbSlots === 'string' && Number.isFinite(spec.register.e))) {
    errs.push(`register: a register word (${Object.keys(REGISTERS).join(', ')}) or { slots, limbSlots, e }`);
  }
  errs.push(...validateTune(spec.tune));
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
    errs.push(`head: 'landmark' (the fitted landmark head, the default), 'anime' (the Anime Form Studio's head), 'none' (a blank head trunk), or a baked head include { parts, dials?, creases?, palette?, joints, bind } (docs/examples/hero-head baked.json)`);
  }
  if (spec.head === 'anime') {
    errs.push(...validateAnimeFace(spec.face));
    if (spec.hair !== 'none') errs.push(...validateAnimeHair(spec.hair));
    errs.push(...validateAnimeExpression(spec.expression));
    if (spec.headPreset !== undefined && !ANIME_PRESETS.includes(spec.headPreset)) errs.push(`headPreset: one of ${ANIME_PRESETS.join(', ')} (the anime head's design base; defaults to the cast when it is male / female, else male)`);
    errs.push(...validateLook(spec.look));
    errs.push(...validateAnimeSculpt(spec.sculpt));
  } else {
    if (spec.look !== undefined && spec.look !== null) errs.push(`look: the looks are the anime head's (head: 'anime')`);
    if (spec.sculpt !== undefined && spec.sculpt !== null) errs.push(`sculpt: the graphic face is the anime head's (head: 'anime')`);
    errs.push(...validateFace(spec.face));
    errs.push(...validateHair(spec.hair));
    if (spec.expression !== undefined && !EXPRESSIONS[spec.expression]) errs.push(`expression: one of ${Object.keys(EXPRESSIONS).join(', ')}`);
    if (spec.headPreset !== undefined && !HEAD_PRESETS[spec.headPreset]) errs.push(`headPreset: one of ${Object.keys(HEAD_PRESETS).join(', ')} (the head's pole and fit; defaults to the cast when it is male / female, else male)`);
  }
  errs.push(...validateDress({ detail: spec.detail, adorn: spec.adorn }));
  errs.push(...validateGesture(spec.gesture));
  // the door's clips: the stand's pose words and the clip words; `jaw` only on a head with a jaw bone (jawedHead); a key's
  // `face` and a clip's `seconds` only on the anime head (a key's `face` elsewhere points at /hero/expression on the
  // landmark head, the one other head that takes it)
  errs.push(...validateHeroClips(spec.clips, { jaw: jawedHead(spec), face: spec.head === 'anime', expression: spec.head === undefined || spec.head === 'landmark' }));
  if (spec.blink !== undefined && spec.blink !== null) {
    if (spec.head !== 'anime') errs.push(`blink: the ambient blink is the anime head's (head: 'anime')`);
    else if (typeof spec.blink !== 'boolean') errs.push('blink: false turns the anime hero\'s ambient blink off (true is the default and not stored)');
  }
  errs.push(...validateGear(spec.gear));
  if (isSwing(spec.gesture) && !spec.gear?.[SWING_HAND[spec.gesture]]) errs.push(`gesture '${spec.gesture}' swings the ${SWING_HAND[spec.gesture]} hand's gear: add gear.${SWING_HAND[spec.gesture]} (an item's build words, e.g. { item: '${spec.gesture === 'bash' ? 'shield' : spec.gesture === 'plant' ? 'staff' : 'sword'}' })`);
  if (spec.proportions !== undefined && !['hero', 'anime'].includes(spec.proportions)) errs.push(`proportions: 'anime' (about 6.5 / 7 heads tall: the default with the anime head) or 'hero' (the realistic casts: the default with the landmark head)`);
  if (spec.core !== undefined && !HERO_CORES.includes(spec.core)) errs.push(`core: 'structured' (the vajra core: a pelvis bone turned by the hip line alone and a lumbar bone, so the lower back bends over a still pelvis) or 'streamlined' (the default)`);
  const wearsHead = spec.head === undefined || WORN.has(spec.head);
  if (!wearsHead) for (const k of ['face', 'hair', 'expression', 'headPreset']) if (spec[k] !== undefined) errs.push(`${k}: only the landmark head or the anime head takes it (head: 'landmark' | 'anime')`);
  return errs;
}

/** The stored `hero` record: the cast word, the register, the RESOLVED tune (every control at its value, so a patch by
 * path finds it), the move trail, and whatever else the operator gave. Stored resolved for the same reason casts are:
 * a later re-tuning of a move never changes a stored row's meaning. */
export function heroRecord(spec) {
  const errs = validateHeroSpec(spec);
  if (errs.length) throw new Error(`hero refused:\n - ${errs.join('\n - ')}\nThe hero door: { cast: 'male' | 'female' | a figure cast, register, tune: a move (${HERO_MOVE_NAMES.join(' / ')}), { ${TUNE_KEYS.join(', ')} } or a list, face: a move (${FACE_MOVE_NAMES.join(' / ')}), { ${FACE_KEYS.join(', ')} } or a list, hair?: a style (${HAIR_STYLE_NAMES.join(' / ')}), { style, ${HAIR_KEYS.join(', ')} } or a list, expression?, sculpt?: the anime head's graphic face (an object of words, a move (${ANIME_SCULPT.MOVE_NAMES.join(' / ')}), a list or false), detail?: ${DETAIL_WORDS.join(' | ')}, adorn?: ${KIT_WORDS.join(' | ')} | { type: 'armor', style, dials }, body?, palette?, head?: 'landmark' | 'none' | include, gesture?: ${GESTURE_WORDS.join(' | ')} | { ${GESTURE_KEYS.join(', ')} } | a list, clips?: { <name>: [keys] | { seconds, keys } | false } (keys in pose words: ${CLIP_KEYS.join(', ')}; a key's face on the anime head), blink?: false }`);
  const { from, ...tune } = resolveTune(spec.tune);
  const hero = { cast: spec.cast ?? 'male', register: spec.register ?? 'round', tune, ...(from ? { from } : {}), head: spec.head ?? 'landmark' };
  if (hero.head === 'landmark') {
    const { from: faceFrom, ...face } = resolveFace(spec.face);
    Object.assign(hero, { face, ...(faceFrom ? { faceFrom } : {}), hair: resolveHair(spec.hair ?? 'swept'), expression: spec.expression ?? 'neutral' });
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
  }
  for (const k of ['body', 'girth', 'headScale', 'scale', 'palette', 'proportions', 'detail', 'adorn', 'core']) if (spec[k] !== undefined && spec[k] !== null) hero[k] = spec[k];
  // the stand, stored AS GIVEN (a word re-resolves for the cast on every regeneration, so a /hero/cast edit carries the
  // stand to the new body); the anime hero's `relaxed` is a plan-time default (heroGesture), never stored
  if (spec.gesture !== undefined && spec.gesture !== null) hero.gesture = spec.gesture;
  // the door's clips, stored AS GIVEN and sparse: absent when none (an empty object stores nothing)
  if (spec.clips && typeof spec.clips === 'object' && Object.keys(spec.clips).length) hero.clips = spec.clips;
  // the ambient blink: on by default (read at export, never stored); stored only when turned off
  if (spec.blink === false) hero.blink = false;
  // held and carried gear (hero-gear.js): each slot's build words with the laws stamped; absent ⇒ no key
  const gear = gearRecord(spec.gear); if (gear) hero.gear = gear;
  // an armour build is stamped with the laws it was minted under, so a later refinement never moves a stored suit
  if (isArmorBuild(hero.adorn) && hero.adorn.laws === undefined) hero.adorn = { ...hero.adorn, laws: ARMOR_LAWS_VERSION };
  return hero;
}

/** The plan a hero record generates: the humanoid starter when it wears the landmark head (the default), the bare hero
 * form with a blank trunk (`head: 'none'`) or a baked include; the door's clips (`clips`) merged over its own, and the
 * stand (`gesture`) as its first clip. */
export function heroPlanOf(hero) {
  // the door's clips merge over the form's own (hero-gesture.js withHeroClips); the stand rides as a one-key `gesture`
  // clip listed first; the anime hero's default is read here, so a /hero/head switch takes it on or drops it; neither ⇒
  // the plan as it was
  // a swing word (hero-swing.js): the stand is the swing's ready key and the swing rides as its own looping clip after it
  const own = withHeroClips(heroFormPlan(hero), hero.clips);
  let swing = heroSwing(hero, { expand: expandEquipment, gearBuild });
  // the structured core's legs converge at rest, so a swing's planted feet take the guard's base (hero-gesture.js STRUCTURED_STANDS), the heel down,
  // unless a key sets its own
  if (swing && hero.core === 'structured') swing = { ...swing, keys: swing.keys.map((k) => ({ ...STRUCTURED_STANDS.guard.legs, heelR: 0, ...k })) };
  if (swing) { const p = withGestureClip(own, swing.keys[0]); return p.rig ? { ...p, clips: { [GESTURE_CLIP]: p.clips[GESTURE_CLIP], [swing.word]: swing.keys, ...Object.fromEntries(Object.entries(p.clips).filter(([k]) => k !== GESTURE_CLIP)) } } : p; }
  return withGestureClip(own, resolveGesture(heroGesture(hero), hero.cast, { core: hero.core }));
}
/** The anime hero's own colours per design base, under the operator's (its palette wins): the hair base's colour at a
 * mid-dark value, so its lit and shade tones both read under the character light and against the World's dark backdrop
 * — a warm dark brown on the male (CIE L* ≈ 33), a blue-black on the female (L* ≈ 35, so her shade side, floored at
 * L* 20.5, still parts from the backdrop by 15) — and the eye and brow strokes darker than the hair (L* ≈ 8), the
 * darkest mark on the head. */
const ANIME_HERO_PALETTE = Object.freeze({ male: Object.freeze({ Hair: '#644634', Ink: '#16181c' }), female: Object.freeze({ Hair: '#465365', Ink: '#16181c' }) });
/** the hair base the door applied to an anime hero, resolved: its form, and its cut when worn (`eff.hairCut`) */
const animeHairBaseOf = (hero, eff) => { const B = ANIME_HAIR_BASE[headPoleOf(hero)]; return resolveAnimeHair([B.form, ...(eff.hairCut ? [eff.hairCut] : [])]); };
function heroFormPlan(hero) {
  const common = { register: hero.register, tune: hero.tune, body: hero.body ?? {}, girth: hero.girth ?? 1, headScale: hero.headScale, ...(hero.core !== undefined ? { core: hero.core } : {}) };
  const dress = { ...(hero.detail !== undefined ? { detail: hero.detail } : {}), ...(hero.adorn !== undefined ? { adorn: hero.adorn } : {}) };
  if ((hero.head ?? 'landmark') === 'landmark') {
    return humanoidPlan({ preset: hero.cast, ...common, face: hero.face ?? {}, hair: hero.hair ?? 'swept', expression: hero.expression ?? 'neutral', palette: hero.palette ?? {}, ...(hero.headPreset ? { headPreset: hero.headPreset } : {}), ...(hero.proportions ? { proportions: hero.proportions } : {}), ...dress });
  }
  if (hero.head === 'anime') {
    const eff = animeEffective(hero);   // the look's stamp, the own layer on top, the hair base under them
    return humanoidPlan({ preset: hero.cast, ...common, tune: eff.tune, head: 'anime', face: eff.face, hair: eff.hair, expression: eff.expression, sculpt: eff.sculpt, palette: { ...ANIME_HERO_PALETTE[headPoleOf(hero)], ...(hero.palette ?? {}) }, ...(hero.headPreset ? { headPreset: hero.headPreset } : {}), ...(hero.proportions ? { proportions: hero.proportions } : {}), ...dress });
  }
  // the blank trunk and a baked include take `proportions` too (the anime casts), as the two worn heads do
  const plan = heroPlan({ cast: hero.cast, ...common, scale: hero.scale, palette: hero.palette || dress.adorn ? { ...HERO_PALETTE, ...kitPalette(dress.adorn), ...(hero.palette || {}) } : HERO_PALETTE, head: hero.head === 'none' ? null : hero.head, ...(hero.proportions ? { proportions: hero.proportions } : {}) });
  return dressPlan(plan, { ...dress, operatorPalette: hero.palette ?? {}, scale: planScale({ cast: hero.cast, scale: hero.scale, tune: hero.tune, proportions: hero.proportions ?? 'hero' }) });
}
/** The dress the hero wears, in the operator's terms: the words (or 'data'), the parts each layer baked, and the
 * adornment ledger — every signature must read and be a real share of its adornment's picture (advice, never a refusal).
 * `mesh` is the compiled figure; without it the ledger is skipped. */
export function dressReadout(hero, plan, mesh, recipe) {
  if (hero.detail === undefined && hero.adorn === undefined) return null;
  const word = (v) => (v === undefined ? 'none' : typeof v === 'string' ? v : isArmorBuild(v) ? `armor:${typeof v.style === 'string' ? v.style : 'inline'}` : 'data');
  const DRESS = /^(crease|tile|patch|pad|spur|spine|stud|ring|cuff|wrap|collar)\./;
  const parts = Object.keys(mesh?.parts || {}); const count = (re) => parts.filter((n) => re.test(n)).length;
  const out = { detail: word(hero.detail), adorn: word(hero.adorn), ...(mesh ? { parts: { detail: count(DRESS), adorn: count(/^adorn\./) } } : {}) };
  if (isArmorBuild(hero.adorn)) out.armor = armorReadout(hero.adorn, dressContext(plan.style));   // the style, dials, pieces worn, focal
  if (mesh && plan.adorn?.length) out.adornments = justify(mesh, plan.adorn.map((A) => ({ id: A.id, signature: A.signature.kind }))).map((r) => ({ id: r.id, signature: r.signature, verdict: r.verdict, exposed: r.sigExposed, share: r.sigShare }));
  // the read at the viewing height: the character height from which each dress family reads (the face's is measure_solid's)
  if (mesh) { const L = layeredLegibility(mesh); out.legibility = { viewPx: L.viewPx, families: L.families.filter((f) => DRESS.test(`${f.family}.`) || f.family.startsWith('adorn.')) }; }
  // the dress stays OUT of the body at every dial extreme (station-loft-clearance.js); the worst configuration is named
  if (recipe && plan.adorn?.length) { const C = layeredClearance(recipe); out.clearance = { sinking: C.sinking, worst: Object.fromEntries(Object.entries(C.adornments).map(([id, a]) => [id, { at: a.worst.dial ? `${a.worst.dial} ${a.worst.value}` : 'rest', share: a.worst.share, ...(a.worst.into?.length ? { into: a.worst.into } : {}) }])) }; }
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
    shoulder_m: torso ? r3(2 * torso.stations[3].r[0]) : null,   // across the yoke ring at the shoulders
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
 * bytes (the row carries both). */
export function heroBudget(plan, mesh, recipe) {
  if (!mesh) return null;
  const tris = new Map(), verts = new Map();
  mesh.faces.forEach((t, fi) => { const g = mesh.groups[fi] ?? 'none'; tris.set(g, (tris.get(g) || 0) + 1); let s = verts.get(g); if (!s) verts.set(g, s = new Set()); for (const vi of t) s.add(vi); });
  const groups = Object.fromEntries([...tris.keys()].sort((a, b) => tris.get(b) - tris.get(a) || (a < b ? -1 : 1)).map((g) => [g, { triangles: tris.get(g), vertices: verts.get(g).size }]));
  return { triangles: mesh.faces.length, vertices: mesh.vertices.length, groups, bytes: { plan: plan ? Buffer.byteLength(JSON.stringify(plan)) : 0, recipe: recipe ? Buffer.byteLength(JSON.stringify(recipe)) : 0 } };
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
  const sole = (verts, S) => { let lo = Infinity; mesh.vertices.forEach((_, i) => { const part = mesh.provenance[i].part; if (part === `foot${S}` || part === `toes${S}`) lo = Math.min(lo, verts[i][2]); }); return lo; };
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

/** The door's CLIPS as the readout says them (only on a hero that authored some): every clip the figure plays, in
 * order (the stand first when it stands), the door's own (new or replacing the hero's of that name), and the hero's own
 * it removed; on the anime head each played clip's designed duration (`seconds`) and the door clips carrying a facial
 * track (`face`). */
function clipsReadout(hero, recipe) {
  if (!hero.clips) return null;
  const names = Object.keys(hero.clips), removed = names.filter((n) => hero.clips[n] === false);
  const seconds = heroClipSeconds(hero, recipe?.clips) ?? {};
  const face = hero.head === 'anime' ? names.filter((n) => hero.clips[n] !== false && (Array.isArray(hero.clips[n]) ? hero.clips[n] : hero.clips[n]?.keys || []).some((k) => k?.face !== undefined && k.face !== null)) : [];
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
  const warnings = [...tuneWarnings(tune), ...(landmark ? [...faceWarnings(hero.face), ...hairWarnings(hair)] : []),
    ...(anime ? [...animeFaceWarnings(animeFace, headPoleOf(hero), { sculpt: eff.sculpt }), ...animeSculptWarnings(eff.sculpt), ...(hero.look?.length ? [] : inc?.faceMeasures?.features?.advice ?? []), ...(hair.style === 'none' ? [] : animeHairWarnings(hair, { words: eff.hairWords })), ...animeExpressionWarnings(animeExpression), ...animeCoverageWarnings(inc?.hairCoverage)] : []), ...extraWarnings];
  const dress = dressReadout(hero, plan, dressMesh, recipe);
  const stand = gestureReadout(hero, mesh, recipe); warnings.push(...gestureWarnings(stand, stats?.layered?.dials));
  // the midsection measured (hero-core-measures.js) for the design loop's critic; its advice joins the warnings only on
  // the structured core (the bands are what it opted into), so every other hero's warnings stay as they were
  const coreM = coreMeasures(plan, mesh), coreBody = castOf(hero.cast, hero.proportions ?? (anime ? 'anime' : 'hero'))?.silhouette === 'female' ? 'female' : 'male';
  const core = coreM ? { core: hero.core ?? 'streamlined', body: coreBody, ...coreM, advice: coreAdvice(coreM, coreBody) } : null;
  if (core && hero.core === 'structured') warnings.push(...core.advice);
  const clips = clipsReadout(hero, recipe);
  const budget = heroBudget(plan, mesh, recipe);
  const unjustified = (dress?.adornments || []).filter((a) => a.verdict !== 'justified').map((a) => `adornment ${a.id}: its ${a.signature} ${a.verdict === 'unjustified' ? 'does not read' : 'reads but is a small share of its picture'} (exposed ${a.exposed}, share ${a.share}; wants ≥ 0.25 and ≥ 0.08) — make the element bolder or ask whether the adornment is wanted`);
  if (unjustified.length) warnings.push(...unjustified);
  if (dress?.armor?.worn?.includes('kabuto') && hair && hair.style !== 'none') warnings.push(`the kabuto covers the head and the hair (${hair.style}) passes through it: set /hero/hair/style 'none'`);
  for (const id of dress?.clearance?.sinking || []) { const w = dress.clearance.worst[id]; warnings.push(`adornment ${id} sinks into ${(w.into || []).join(', ') || 'the body'} at ${w.at} (${Math.round(w.share * 100)} % of its points): keep that dial nearer rest, or move the adornment`); }
  const ownMoved = (r, one = (k) => ANIME_FACE.DEFAULT[k] ?? ANIME_HAIR.DEFAULT[k] ?? 1) => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'style' && k !== 'locks' && typeof v === 'number' && v !== one(k))) : r);
  return { cast: hero.cast, register: hero.register, tune, ...(hero.from ? { from: hero.from } : {}), moved: movedOf(tune), measures: heroMeasures(plan, stats),
    ...(anime && hero.look?.length ? { look: hero.look, lookFrom: hero.look.join('+'), own: { face: ownMoved(hero.face), hair: hero.hair === 'none' ? 'none' : { ...(hero.hair?.style ? { style: hero.hair.style } : {}), ...ownMoved(hero.hair), ...(Object.keys(hero.hair?.locks || {}).length ? { locks: Object.keys(hero.hair.locks) } : {}) }, ...(hero.expression ? { expression: hero.expression } : {}), ...(hero.sculpt !== undefined ? { sculpt: hero.sculpt } : {}), tune: movedOf(hero.tune) } } : {}),
    head: landmark ? 'landmark' : typeof hero.head === 'string' ? hero.head : 'include',
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
    ...(stand ? { gesture: stand } : {}),
    ...(core ? { core } : {}),
    ...(clips ? { clips } : {}),
    ...(hero.gear && recipe?.rig ? { gear: (() => { const R = validateRig(recipe.rig); const out = gearReadout(gearMounts(hero, R), R); const sw = heroSwing(hero, { expand: expandEquipment, gearBuild });
      // the swing's contact data for a game's hit test (the clip never reads it): the impact's phase, the window, the reach
      if (sw && out[sw.hand]) out[sw.hand].swing = { word: sw.word, class: sw.cls, strike: sw.strike, window: sw.window, reachM: out[sw.hand].lengthM, cone: 70 };
      return out; })() } : {}),
    ...(budget ? { budget } : {}),
    ...(warnings.length ? { warnings } : {}) };
}

/** The hero door: a cast word and a tune → the hero form's plan → the plan door, with `hero` stored beside the plan. */
export async function createLayeredHeroHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("The hero door takes spec { cast?, register?, tune?, face?, hair?, expression?, sculpt?, detail?, adorn?, body?, palette?, head?, gesture?, clips?: { <name>: [keys] | { seconds, keys } | false } (a key's face on the anime head), blink?: false, title? }. Read get_solid_vocab({ id: 'layered' }) (the Hero door section).");
  const heroSpec = Object.fromEntries(HERO_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  const hero = heroRecord(heroSpec);
  let plan;
  try { plan = heroPlanOf(hero); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }) (the Hero door section).`); }
  const rest = Object.fromEntries(Object.entries(input).filter(([k]) => !HERO_FIELDS.includes(k)));
  let planned = null;   // the mint's own compiled figure: the readout's stand and budget read it
  const out = await createLayeredPlanHandler({ ...rest, plan, hero, title: input.title ?? `hero · ${hero.cast}${hero.head === 'anime' ? ` · anime${hero.look?.length ? ` · ${hero.look.join('+')}` : ''}` : ''}${hero.from ? ` · ${hero.from}` : ''}${hero.faceFrom ? ` · ${hero.faceFrom}` : ''}` }, { onPlanned: (p) => { planned = p; } });
  const face = hero.head === 'anime' ? ` The anime head by word: /hero/face/<control> (${ANIME_FACE_KEYS.join(', ')}; 1 = the base, tilt an offset); the hair: /hero/hair/style (${ANIME_HAIR_STYLES.join(', ')}), /hero/hair/<control> (${ANIME_HAIR_KEYS.join(', ')}) and /hero/hair/locks/<clump> ({ cx, cy, cz, tx, ty, tz }: fringe-1…7, left-temple-0…2, right-temple-0…2, back-1…11, crown-±1-0…2 on short); the hair's form /hero/hair/<word> (${ANIME_HAIR_FORM_WORDS.join(', ')}; lift { crown, temple, fringe, nape } in construction units; false the studio's construction, null back to the base's); the hair base (the cut worn while no family is named: ${Object.entries(ANIME_HAIR_BASE).map(([pole, b]) => `${b.cut} on the ${pole}`).join(', ')}, its form under every family); /hero/expression (${Object.keys(ANIME_POSES).join(', ')} or { blink, smile, open, brow }). The graphic face: /hero/sculpt (an object of ${ANIME_SCULPT_KEYS.join(', ')}, ${Object.keys(SCULPT_SHAPE_KEYS).join(', ')}; 1 = the base, positions and angles offsets; moves ${ANIME_SCULPT.MOVE_NAMES.join(', ')}; false for the studio's face), then /hero/sculpt/<word>. A LOOK composes presets by word: set /hero/look to a list (archetypes ${LOOK_TABLES.archetype.join(', ')}; face traits ${LOOK_TABLES.face.join(', ')}; graphic-face traits ${LOOK_TABLES.sculpt.join(', ')}; hair traits and families ${LOOK_TABLES.hair.join(', ')}; poses); the controls above apply on top of it.` : hero.head === 'landmark' ? ` The face by word too: /hero/face/<control> (${FACE_KEYS.join(', ')}; groups ${FACE_AGGREGATE_KEYS.join(', ')}; moves ${FACE_MOVE_NAMES.join(', ')}); the hair: /hero/hair/style (${HAIR_STYLE_NAMES.join(', ')}) and /hero/hair/<control> (${HAIR_KEYS.join(', ')}); /hero/expression.` : '';
  const dressNext = ` Detail and adornment: /hero/detail (${DETAIL_WORDS.join(', ')}) and /hero/adorn (${KIT_WORDS.join(', ')}); or an armour build /hero/adorn { type: 'armor', style, dials, theme? }, restyled by /hero/adorn/dials/<stylize | coverage | mass | ornament>, /hero/adorn/style and /hero/adorn/theme. The stand: /hero/gesture (${GESTURE_WORDS.join(', ')}, or pose words ${GESTURE_KEYS.join(', ')}). Clips: set /hero/clips to { <name>: [keys] } (each key an object of the stand's pose words; the head and neck may aim; heelL, heelR, lift, support: 'none'${jawedHead(hero) ? ', jaw' : ''}), then /hero/clips/<name> (remove drops a door clip); a name the figure plays (${Object.keys(plan.clips || {}).filter((c) => c !== GESTURE_CLIP).join(', ')}) replaces that clip, false removes one of the hero's own.${hero.head === 'anime' ? ` On the anime head a key may carry face (an expression word, { blink, smile, open, brow } or a list), a clip may be { seconds, keys } (its designed duration; the clips play ${Object.entries(heroClipSeconds(hero, plan.clips) || {}).filter(([c]) => c !== GESTURE_CLIP).map(([c, s]) => `${c} ${s} s`).join(', ')}), and /hero/blink false turns the ambient blink off.` : ''}`;
  // the dress ledgers read the figure at REST (every dial at its rest, no channels), as the door always measured them;
  // the mint's own mesh is that figure unless the mint turned a dial or carried a channel
  const dressed = hero.detail !== undefined || hero.adorn !== undefined;
  const atRest = planned && !planned.channels && Object.entries(planned.recipe.dials || {}).every(([k, d]) => planned.dials?.[k] === d.rest);
  const dressMesh = dressed && planned ? (atRest ? planned.mesh : compileLayered(planned.recipe, {})) : planned?.mesh;
  return {
    ...out,
    hero: heroReadout(hero, plan, out.stats, [], { mesh: planned?.mesh, recipe: planned?.recipe, dressMesh }),
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
  let recipe;
  try { recipe = expandHeroAwarePlan(input.plan, input.hero); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  return createLayeredHandler({ ...input, recipe, ...(provenance ? { provenance } : {}) }, internal);
}

export async function createLayeredHandler(input, { onPlanned } = {}) {
  if (!input || typeof input !== 'object' || !input.recipe || typeof input.recipe !== 'object' || !input.recipe.parts) {
    throw new Error("The layered kind needs `recipe` — { frame, parts: { <name>: { layer, slots, stations, caps | pin, offsets, faces } }, dials?, creases? }. Read get_solid_vocab({ id: 'layered' }); the worked recipe is docs/examples/dragon-layered/recipe.json.");
  }
  const { title, recipe, plan, hero, provenance, dials, channels, units, facing, seat, toon, hullShade, rim, strokes, ref, folder_ref: folderRef } = input;
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
    ...(Array.isArray(rim) && rim.length === 5 && rim.every(Number.isFinite) ? { rim } : {}),
    ...(strokes !== undefined ? { strokes } : {}),   // drawn lines as the authoring record (layered-strokes.js); usually stored later by update_sketch
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
    next: { tool: 'update_sketch', args: { ref: sketch.ref, patch: [{ op: 'set', path: '/dials/<name>', value: '<number>' }] }, reason: 'Turn a dial in place; the solid re-lowers on read.' },
  };
}
