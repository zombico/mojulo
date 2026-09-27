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
 * Manual: lib/graph/solid-vocab/layered.md. Reference recipe: docs/examples/dragon-layered; reference plan:
 * docs/examples/dragon-body/seed-recipe.mjs.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveToon } from '@/lib/graph/polygonizer/vexar';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import { compileLayered, resolveLayeredDials } from '@/lib/graph/polygonizer/station-loft';
import { expandPlan } from '@/lib/graph/polygonizer/station-loft-plan';
import { heroPlan, HERO_CASTS, REGISTERS, BODY_DEFAULTS, PALETTE as HERO_PALETTE, TUNE_KEYS, TUNE_AGGREGATE_KEYS, HERO_MOVE_NAMES, resolveTune, validateTune, tuneWarnings } from '@/lib/graph/polygonizer/hero-form';
import { humanoidPlan, PALETTE as HUMANOID_PALETTE } from '@/lib/graph/polygonizer/humanoid-plan';
import { humanoidAnchors, EXPRESSIONS, HEAD_PRESETS, FACE_KEYS, FACE_AGGREGATE_KEYS, FACE_MOVE_NAMES, resolveFace, validateFace, faceWarnings } from '@/lib/graph/polygonizer/humanoid-head';
import { HAIR_KEYS, HAIR_STYLE_NAMES, resolveHair, validateHair, hairWarnings } from '@/lib/graph/polygonizer/humanoid-hair';
import { validateCast, CAST_PRESET_NAMES } from '@/lib/graph/polygonizer/figure-cast';
import { DETAIL_WORDS, KIT_WORDS, validateDress, dressPlan, kitPalette } from '@/lib/graph/polygonizer/hero-dress';
import { justify } from '@/lib/graph/polygonizer/station-loft-adorn';
import { layeredClearance } from '@/lib/graph/polygonizer/station-loft-clearance';
import { layeredLegibility } from '@/lib/graph/polygonizer/station-loft-legibility';
import { fitEvidence } from '@/lib/graph/polygonizer/humanoid-head-fit';
import { layeredStats, persistedLayeredLedger } from '@/lib/graph/polygonizer/station-loft-faces';
import { validateRig, bindLayered, auditRig, layeredClip } from '@/lib/graph/polygonizer/station-loft-rig';

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
  const plan = manifest.hero && from !== 'plan' ? heroPlanOf(manifest.hero) : manifest.plan;
  const recipe = expandPlan(plan);
  const known = new Set(Object.keys(recipe.dials || {}));
  const dials = Object.fromEntries(Object.entries(manifest.dials || {}).filter(([k]) => known.has(k)));
  return { ...manifest, plan, recipe, dials: resolveLayeredDials(recipe.dials || {}, dials) };
}

// ─── The hero door ────────────────────────────────────────────────────────
const HERO_FIELDS = ['cast', 'register', 'tune', 'body', 'girth', 'headScale', 'scale', 'palette', 'head', 'face', 'hair', 'expression', 'headPreset', 'detail', 'adorn'];
const HEAD_WORDS = ['landmark', 'none'];
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

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
  }
  for (const k of ['girth', 'headScale', 'scale']) if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] > 0)) errs.push(`${k}: must be a finite number > 0`);
  if (spec.palette !== undefined) {
    if (!spec.palette || typeof spec.palette !== 'object') errs.push('palette: { Skin, Top, Bottom, Shoes: "#rrggbb" }');
    else for (const [g, v] of Object.entries(spec.palette)) if (!isHex(v)) errs.push(`palette.${g}: must be a "#rrggbb" colour`);
  }
  if (spec.head !== undefined && spec.head !== null && !HEAD_WORDS.includes(spec.head) && !(spec.head && typeof spec.head === 'object' && spec.head.parts && typeof spec.head.parts === 'object')) {
    errs.push(`head: 'landmark' (the fitted landmark head, the default), 'none' (a blank head trunk), or a baked head include { parts, dials?, creases?, palette?, joints, bind } (docs/examples/hero-head baked.json)`);
  }
  errs.push(...validateFace(spec.face));
  errs.push(...validateHair(spec.hair));
  if (spec.expression !== undefined && !EXPRESSIONS[spec.expression]) errs.push(`expression: one of ${Object.keys(EXPRESSIONS).join(', ')}`);
  if (spec.headPreset !== undefined && !HEAD_PRESETS[spec.headPreset]) errs.push(`headPreset: one of ${Object.keys(HEAD_PRESETS).join(', ')} (the head's pole and fit; defaults to the cast when it is male / female, else male)`);
  errs.push(...validateDress({ detail: spec.detail, adorn: spec.adorn }));
  const wearsLandmark = spec.head === undefined || spec.head === 'landmark';
  if (!wearsLandmark) for (const k of ['face', 'hair', 'expression', 'headPreset']) if (spec[k] !== undefined) errs.push(`${k}: only the landmark head takes it (head: 'landmark')`);
  return errs;
}

/** The stored `hero` record: the cast word, the register, the RESOLVED tune (every control at its value, so a patch by
 * path finds it), the move trail, and whatever else the operator gave. Stored resolved for the same reason casts are:
 * a later re-tuning of a move never changes a stored row's meaning. */
export function heroRecord(spec) {
  const errs = validateHeroSpec(spec);
  if (errs.length) throw new Error(`hero refused:\n - ${errs.join('\n - ')}\nThe hero door: { cast: 'male' | 'female' | a figure cast, register, tune: a move (${HERO_MOVE_NAMES.join(' / ')}), { ${TUNE_KEYS.join(', ')} } or a list, face: a move (${FACE_MOVE_NAMES.join(' / ')}), { ${FACE_KEYS.join(', ')} } or a list, hair?: a style (${HAIR_STYLE_NAMES.join(' / ')}), { style, ${HAIR_KEYS.join(', ')} } or a list, expression?, detail?: ${DETAIL_WORDS.join(' | ')}, adorn?: ${KIT_WORDS.join(' | ')}, body?, palette?, head?: 'landmark' | 'none' | include }`);
  const { from, ...tune } = resolveTune(spec.tune);
  const hero = { cast: spec.cast ?? 'male', register: spec.register ?? 'round', tune, ...(from ? { from } : {}), head: spec.head ?? 'landmark' };
  if (hero.head === 'landmark') {
    const { from: faceFrom, ...face } = resolveFace(spec.face);
    Object.assign(hero, { face, ...(faceFrom ? { faceFrom } : {}), hair: resolveHair(spec.hair ?? 'swept'), expression: spec.expression ?? 'neutral' });
    if (spec.headPreset !== undefined) hero.headPreset = spec.headPreset;
  }
  for (const k of ['body', 'girth', 'headScale', 'scale', 'palette', 'detail', 'adorn']) if (spec[k] !== undefined && spec[k] !== null) hero[k] = spec[k];
  return hero;
}

/** The plan a hero record generates: the humanoid starter when it wears the landmark head (the default), the bare hero
 * form with a blank trunk (`head: 'none'`) or a baked include. */
export function heroPlanOf(hero) {
  const common = { register: hero.register, tune: hero.tune, body: hero.body ?? {}, girth: hero.girth ?? 1, headScale: hero.headScale };
  const dress = { ...(hero.detail !== undefined ? { detail: hero.detail } : {}), ...(hero.adorn !== undefined ? { adorn: hero.adorn } : {}) };
  if ((hero.head ?? 'landmark') === 'landmark') {
    return humanoidPlan({ preset: hero.cast, ...common, face: hero.face ?? {}, hair: hero.hair ?? 'swept', expression: hero.expression ?? 'neutral', palette: hero.palette ?? {}, ...(hero.headPreset ? { headPreset: hero.headPreset } : {}), ...dress });
  }
  const plan = heroPlan({ cast: hero.cast, ...common, scale: hero.scale, palette: hero.palette || dress.adorn ? { ...HERO_PALETTE, ...kitPalette(dress.adorn), ...(hero.palette || {}) } : HERO_PALETTE, head: hero.head === 'none' ? null : hero.head });
  return dressPlan(plan, { ...dress, operatorPalette: hero.palette ?? {}, scale: (hero.scale ?? HERO_CASTS[hero.cast]?.scale ?? 1) * (hero.tune?.stature ?? 1) });
}
/** The dress the hero wears, in the operator's terms: the words (or 'data'), the parts each layer baked, and the
 * adornment ledger — every signature must read and be a real share of its adornment's picture (advice, never a refusal).
 * `mesh` is the compiled figure; without it the ledger is skipped. */
export function dressReadout(hero, plan, mesh, recipe) {
  if (hero.detail === undefined && hero.adorn === undefined) return null;
  const word = (v) => (v === undefined ? 'none' : typeof v === 'string' ? v : 'data');
  const DRESS = /^(crease|tile|patch|pad|spur|spine|stud|ring|cuff|wrap|collar)\./;
  const parts = Object.keys(mesh?.parts || {}); const count = (re) => parts.filter((n) => re.test(n)).length;
  const out = { detail: word(hero.detail), adorn: word(hero.adorn), ...(mesh ? { parts: { detail: count(DRESS), adorn: count(/^adorn\./) } } : {}) };
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
  if ((hero.head ?? 'landmark') !== 'landmark') return { head: typeof hero.head === 'string' ? `${hero.head}: no fit` : 'include: as given', body: 'authored: a cast and a tune, no reference' };
  const pole = headPoleOf(hero); const E = fitEvidence(pole); const moved = Object.entries(hero.face || {}).filter(([, v]) => v !== 1).map(([k]) => k);
  return { head: { fit: pole, observed: E.observed.map((o) => `${o.view} (${o.yawDegrees}°)`), inferred: E.inferred, face: moved.length ? `authored off the fit: ${moved.join(', ')}` : 'as fitted' }, body: 'authored: a cast and a tune, no reference' };
}
/** the head's pole: the cast when it is a hero cast, else the male */
const headPoleOf = (hero) => hero.headPreset ?? (HEAD_PRESETS[hero.cast] ? hero.cast : 'male');
/** What the face did, in metres off the fitted head's landmarks at the worn scale: crown to chin, across the cheekbones,
 * across the jaw angles, between the pupils. */
export function faceMeasures(hero, plan) {
  const inc = plan.include?.find((i) => i.name === 'head'); if (!inc) return null;
  const scale = HERO_CASTS[hero.cast]?.scale ?? 1;   // the worn head is scaled with the figure
  const headScale = (hero.headScale ?? HERO_CASTS[hero.cast]?.headScale ?? 1) * (hero.tune?.head ?? 1);
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

/** The hero readout that rides the mint and every `/hero` edit: cast, register, the tune with its trail, metres, advice. */
export function heroReadout(hero, plan, stats, extraWarnings = [], { mesh, recipe } = {}) {
  const movedOf = (r) => Object.fromEntries(Object.entries(r || {}).filter(([, v]) => v !== 1));
  const landmark = (hero.head ?? 'landmark') === 'landmark';
  const hair = landmark ? resolveHair(hero.hair ?? 'swept') : null;
  const warnings = [...tuneWarnings(hero.tune), ...(landmark ? [...faceWarnings(hero.face), ...hairWarnings(hair)] : []), ...extraWarnings];
  const inc = plan.include?.find((i) => i.name === 'head');
  const dress = dressReadout(hero, plan, mesh, recipe);
  const unjustified = (dress?.adornments || []).filter((a) => a.verdict !== 'justified').map((a) => `adornment ${a.id}: its ${a.signature} ${a.verdict === 'unjustified' ? 'does not read' : 'reads but is a small share of its picture'} (exposed ${a.exposed}, share ${a.share}; wants ≥ 0.25 and ≥ 0.08) — make the element bolder or ask whether the adornment is wanted`);
  if (unjustified.length) warnings.push(...unjustified);
  for (const id of dress?.clearance?.sinking || []) { const w = dress.clearance.worst[id]; warnings.push(`adornment ${id} sinks into ${(w.into || []).join(', ') || 'the body'} at ${w.at} (${Math.round(w.share * 100)} % of its points): keep that dial nearer rest, or move the adornment`); }
  return { cast: hero.cast, register: hero.register, tune: hero.tune, ...(hero.from ? { from: hero.from } : {}), moved: movedOf(hero.tune), measures: heroMeasures(plan, stats),
    head: landmark ? 'landmark' : typeof hero.head === 'string' ? hero.head : 'include',
    ...(landmark ? { face: hero.face, ...(hero.faceFrom ? { faceFrom: hero.faceFrom } : {}), faceMoved: movedOf(hero.face), hair, hairMoved: movedOf(Object.fromEntries(Object.entries(hair).filter(([k]) => k !== 'style'))), hairMeasures: inc?.hairMeasures ?? null, expression: hero.expression, faceMeasures: faceMeasures(hero, plan) } : {}),
    evidence: heroEvidence(hero),
    ...(dress ? { dress } : {}),
    ...(warnings.length ? { warnings } : {}) };
}

/** The hero door: a cast word and a tune → the hero form's plan → the plan door, with `hero` stored beside the plan. */
export async function createLayeredHeroHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("The hero door takes spec { cast?, register?, tune?, face?, hair?, expression?, detail?, adorn?, body?, palette?, head?, title? }. Read get_solid_vocab({ id: 'layered' }) (the Hero door section).");
  const heroSpec = Object.fromEntries(HERO_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  const hero = heroRecord(heroSpec);
  let plan;
  try { plan = heroPlanOf(hero); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }) (the Hero door section).`); }
  const rest = Object.fromEntries(Object.entries(input).filter(([k]) => !HERO_FIELDS.includes(k)));
  const out = await createLayeredPlanHandler({ ...rest, plan, hero, title: input.title ?? `hero · ${hero.cast}${hero.from ? ` · ${hero.from}` : ''}${hero.faceFrom ? ` · ${hero.faceFrom}` : ''}` });
  const face = hero.head === 'landmark' ? ` The face by word too: /hero/face/<control> (${FACE_KEYS.join(', ')}; groups ${FACE_AGGREGATE_KEYS.join(', ')}; moves ${FACE_MOVE_NAMES.join(', ')}); the hair: /hero/hair/style (${HAIR_STYLE_NAMES.join(', ')}) and /hero/hair/<control> (${HAIR_KEYS.join(', ')}); /hero/expression.` : '';
  const dressed = hero.detail !== undefined || hero.adorn !== undefined;
  const recipe = dressed ? expandPlan(plan) : undefined; const mesh = recipe ? compileLayered(recipe, {}) : undefined;   // the dress ledgers read the compiled figure
  const dressNext = ` Detail and adornment: /hero/detail (${DETAIL_WORDS.join(', ')}) and /hero/adorn (${KIT_WORDS.join(', ')}).`;
  return {
    ...out,
    hero: heroReadout(hero, plan, out.stats, [], { mesh, recipe }),
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

/** The plan door: expand the ring plan into the recipe, then mint as usual with the plan (and its audit) stored beside it. */
export async function createLayeredPlanHandler(input) {
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
  try { recipe = expandPlan(input.plan); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  return createLayeredHandler({ ...input, recipe, ...(provenance ? { provenance } : {}) });
}

export async function createLayeredHandler(input) {
  if (!input || typeof input !== 'object' || !input.recipe || typeof input.recipe !== 'object' || !input.recipe.parts) {
    throw new Error("The layered kind needs `recipe` — { frame, parts: { <name>: { layer, slots, stations, caps | pin, offsets, faces } }, dials?, creases? }. Read get_solid_vocab({ id: 'layered' }); the worked recipe is docs/examples/dragon-layered/recipe.json.");
  }
  const { title, recipe, plan, hero, provenance, dials, channels, units, facing, seat, toon, ref, folder_ref: folderRef } = input;
  const manifest = {
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
    ...(toon != null ? { toon: resolveToon(toon) ? toon : undefined } : {}),
  };
  const { stats } = planLayered(manifest);
  manifest.ledger = persistedLayeredLedger(stats.ledger);
  const sketch = SketchRepository.create({ title: title || `layered · ${stats.monomers} part${stats.monomers === 1 ? '' : 's'}`, manifest, ref, folderRef: folderRef ?? null });
  warmScenePng(sketch);
  return {
    ok: true, ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`, sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`, url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
    next: { tool: 'update_sketch', args: { ref: sketch.ref, patch: [{ op: 'set', path: '/dials/<name>', value: '<number>' }] }, reason: 'Turn a dial in place; the solid re-lowers on read.' },
  };
}
