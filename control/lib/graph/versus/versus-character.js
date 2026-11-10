/**
 * versus character — a fighter who is a character made with create_character.
 *
 * A game's roster names characters: `{ id, hero: { ref }, name?, color?, style?, signature?, weapon?, … }`. The BODY is
 * the character's, measured off its own skeleton (the layered hero's rig joints) into the fight's body dials, so a
 * long-armed character reaches further and its boxes follow. The FIGHT is read off the sheet the character was made
 * from (versus-sheet.js: its role, archetype, build and age, at the sheet's revision the character records), the entry's
 * own fight words over it; a character made without a sheet is an all-rounder unless the entry says. The game stores
 * the ref, never the measure: like a quick game's adopted hero, the fighter follows the character's edits, measured again
 * wherever the game is served (the play route, the export, an arena's World page, the edit gate).
 *
 * The calibration: the default male hero (create_character's `cast: 'male'`) is the fight's canonical body, arm, leg and
 * torso 1; a dial is the character's proportion over his. Height is the character's own (mm to the top of the head).
 *
 * NOT ONLY A PERSON: any stored body that stands on two legs and fights with two arms is a fighter, a hero, a mascot or a
 * two-legged creature (create_character's doors), its skeleton the fight's joints (FIGHT_JOINTS). A body that is not a
 * hero has no hero record to read its girth from: its girth is its trunk's breadth (its widest ring over its height)
 * against the canonical body's, and its colour its palette's. A four-legged body, or one with no arms, is not a
 * fighter, and says why. A fighter's own strikes (`moves`) are a hero's: their clips are made by the hero door.
 */
import { BODY_DIALS } from './versus-compile.js';
import { fighterSpec, fighterFromSheet, fighterName } from './versus-sheet.js';
import { castOf, BODY_DEFAULTS } from '../polygonizer/hero-form.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';
import { resolveCharacterLight } from '../polygonizer/station-loft-shade.js';
import { beastHeadOf } from '../beast/head.js';
import { HEAD_LIBRARY } from '../creature-heads/index.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const HEX = /^#[0-9a-f]{6}$/i;
/** A roster entry that names a character (unresolved). */
export const isCharacterEntry = (e) => isObj(e) && e.hero !== undefined;

const at = (j) => (Array.isArray(j) ? j : j.at);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * A SNOUT CARRIED LOW: a beastfolk fighter (a hero with a `beast`, beast/tiered.js) whose head has a snout fights with
 * its head down, its stance's `stoop` (versus-rig.js stoopPose: the head lower, the hurt box shorter, its front and its
 * reach as they were), by how far its head reaches forward (its library head's own word, creature-heads/index.js): a long
 * snout or muzzle the most, a short muzzle or a beak less, a snake's head or mandibles a little. A person's head, none.
 */
export const SNOUT_STOOP = Object.freeze({ 'long snout': 26, 'long muzzle': 26, 'short muzzle': 16, beak: 16, snake: 10, mandibles: 10 });
export function snoutStoop(hero) {
  if (!isObj(hero?.beast)) return 0;
  let id = null;
  try { id = beastHeadOf(hero)?.id ?? null; } catch { id = null; }
  id ??= typeof hero.beast.head?.relational === 'string' ? hero.beast.head.relational : null;
  return SNOUT_STOOP[HEAD_LIBRARY[id]?.head] ?? 0;
}

/** The joints a fight measures and poses a body by: two legs, two arms, a trunk and a head. */
export const FIGHT_JOINTS = Object.freeze(['headTop', 'neckHub', 'pelvisHub', 'shoulderR', 'elbowR', 'wristR', 'shoulderL', 'elbowL', 'wristL', 'hipR', 'kneeR', 'ankleR', 'hipL', 'kneeL', 'ankleL']);
/** A body's breadth: its trunk's widest ring (its plan's trunk segments, the head's and the hair's left out), across
 * and through, over its height: the girth of a body that is not a hero (a round mascot is broad, whatever its bones). */
export function trunkBreadth(plan, joints) {
  let w = 0;
  for (const seg of plan?.segments ?? []) {
    if (seg?.kind !== 'trunk' || /^(head|hair|neck|face|ear|tail)/i.test(seg.name ?? '')) continue;
    for (const st of seg.stations ?? []) { const r = Array.isArray(st?.r) ? st.r : [st?.r, st?.r]; if (Number.isFinite(r[0]) && Number.isFinite(r[1])) w = Math.max(w, r[0] + r[1]); }
  }
  return w / at(joints.headTop)[2];
}

/** A skeleton's measures (m): stature, the arm's reach, the hip's height, the trunk from pelvis to neck. */
export function measureSkeleton(joints) {
  const J = (k) => {
    if (!joints[k]) throw new Error(`versus: the character's skeleton has no ${k}`);
    return at(joints[k]);
  };
  return {
    height: J('headTop')[2],
    arm: dist(J('shoulderR'), J('elbowR')) + dist(J('elbowR'), J('wristR')),
    leg: J('hipR')[2],
    torso: J('neckHub')[2] - J('pelvisHub')[2],
  };
}

/** A hero record's girth: its girth dial, its cast's, and its chest and waist against the cast's defaults. */
function heroGirth(hero) {
  const preset = castOf(hero.cast ?? 'canonical', hero.proportions ?? 'hero');
  const b = { ...BODY_DEFAULTS, ...(preset?.body ?? {}), ...(hero.body ?? {}) };
  return (hero.girth ?? 1) * (preset?.girth ?? 1) * (b.chest + b.waist);
}

let LAYERED = null;
const layered = async () => (LAYERED ??= await import('../../mcp/tools/layered.js'));
let REF = null;
// the default male hero's measures and girth, the fight's canonical body
async function reference() {
  if (REF) return REF;
  const { heroRecord, expandLayeredManifest } = await layered();
  const hero = heroRecord({ cast: 'male' }), E = expandLayeredManifest({ kind: 'layered', hero }), joints = E.recipe.rig.joints;
  REF = { m: measureSkeleton(joints), girth: heroGirth(hero), breadth: trunkBreadth(E.plan, joints) };
  return REF;
}

/** A measure and a girth → the fight's body dials, held inside what the gate reads; `held` names any dial it moved. */
export function bodyDials(m, girth, ref) {
  const rel = (k) => (m[k] / m.height) / (ref.m[k] / ref.m.height);
  const raw = { height: Math.round(m.height * 1000), arm: r3(rel('arm')), leg: r3(rel('leg')), torso: r3(rel('torso')), girth: r3(girth / ref.girth) };
  const body = {}, held = [];
  for (const [k, v] of Object.entries(raw)) {
    const [lo, hi] = BODY_DIALS[k];
    body[k] = Math.min(hi, Math.max(lo, v));
    if (body[k] !== v) held.push(`${k} ${v} → ${body[k]}`);
  }
  return { body, held };
}

/** A character's own strikes and guard in the plane (versus-hero.js heroFight), solved on its rig */
async function heroFightOf(manifest, moves) {
  const { expandLayeredManifest } = await layered();
  const { validateRig } = await import('../polygonizer/station-loft-rig.js');
  const { heroFight, readHeroMoves } = await import('./versus-hero.js');
  readHeroMoves(moves);
  return heroFight(validateRig(expandLayeredManifest(manifest).recipe.rig), moves);
}
/** What a stored row is to the fight, said when it is not a fighter (create_character's words for what it is). */
function notAFighter(manifest, where, ref, joints) {
  const at = `versus: ${where}.hero.ref '${ref}'`, two = 'a fighter stands on two legs and fights with two arms (a hero, a mascot or a two-legged creature: create_character)';
  if (!manifest) return `${at} is not a stored character (make one with create_character)`;
  if (manifest.kind !== 'layered') return `${at} is a ${manifest.kind ?? 'sketch'}, not a character: ${two}`;
  if (manifest.species || manifest.fauna) return `${at} is a four-legged ${manifest.species ?? 'animal'}: ${two}`;
  if (!joints) return `${at} has no skeleton to fight with: ${two}`;
  const missing = FIGHT_JOINTS.filter((k) => !joints[k]);
  const arms = missing.some((k) => /^(shoulder|elbow|wrist)/.test(k)), legs = missing.some((k) => /^(hip|knee|ankle)/.test(k));
  return `${at}'s body has no ${arms && legs ? 'arms or legs' : arms ? 'arms' : legs ? 'legs' : missing.join(', ')} to fight with: ${two}`;
}
/** A stored row's manifest → the character's skeleton (the fight's joints); throws, saying why, when it is not a fighter. */
async function fighterBody(manifest, where, ref) {
  let joints = null, plan = null;
  if (manifest?.kind === 'layered') {
    const { expandLayeredManifest } = await layered();
    try { const E = expandLayeredManifest(manifest); joints = E.recipe?.rig?.joints ?? null; plan = E.plan ?? manifest.plan ?? null; } catch { joints = null; }
  }
  if (!joints || FIGHT_JOINTS.some((k) => !joints[k])) throw new Error(notAFighter(manifest, where, ref, joints));
  return { joints, plan };
}
// a body's colour: a hero's top, a creature's palette's first colour (its body's, as the recipe lists it)
async function paletteColour(manifest) {
  // (a hero's is its top's or none, as it always was)
  if (manifest.hero) { const top = manifest.hero.palette?.Top; return typeof top === 'string' && HEX.test(top) ? top : null; }
  const { expandLayeredManifest } = await layered();
  const pal = Object.values(expandLayeredManifest(manifest).recipe?.palette ?? {}).map((v) => (typeof v === 'string' ? v : v?.color ?? v?.base ?? null));
  return pal.find((v) => typeof v === 'string' && HEX.test(v)) ?? null;
}
/** A stored row's manifest → the character's body dials and colour; throws when the row is not a fighter. */
export async function measureCharacter(manifest, where = 'fighter', ref = '?') {
  const { joints, plan } = await fighterBody(manifest, where, ref), R = await reference();
  const breadth = manifest.hero ? 0 : trunkBreadth(plan, joints);
  const girth = manifest.hero ? heroGirth(manifest.hero) : R.girth * (breadth > 0 ? breadth / R.breadth : 1);
  const { body, held } = bodyDials(measureSkeleton(joints), girth, R);
  const color = await paletteColour(manifest);
  return { body, held, ...(color ? { color } : {}) };
}

/**
 * A roster with its characters measured and their fights read: each `{ hero: { ref }, … }` entry becomes the solver's
 * intent, the sheet's reading (`reads`: what each facet chose and why) under the entry's own fight words (`style` the
 * fight's style), with the character's `body`, its colour unless the entry names one, its name (the entry's, else the
 * sheet's) and `character: ref`. `lookup(ref)` → a row's manifest or null; `sheetOf(record)` → the sheet a character's
 * `egocube` record names, or null. A roster without a character comes back as given.
 */
export async function resolveCharacters(roster, lookup, sheetOf = () => null) {
  if (!Array.isArray(roster) || !roster.some(isCharacterEntry)) return roster;
  const out = [];
  for (const [i, e] of roster.entries()) {
    if (!isCharacterEntry(e)) { out.push(e); continue; }
    const where = `roster[${i}]`;
    let spec;
    try { spec = fighterSpec(e, i); } catch (err) { throw new Error(`versus: ${where}: ${err.message.replace(/^versus: /, '')}`); }
    const ref = spec.hero.ref, manifest = lookup(ref);
    const { body, color } = await measureCharacter(manifest, where, ref);
    // (its own strikes, solved on its own rig: versus-hero.js; the guard it stands in with them)
    let fight = null;
    if (spec.moves !== undefined && !manifest.hero) throw new Error(`versus: ${where}.moves: a fighter's own strikes are a hero's (their clips are made by the hero door); '${ref}' fights in a tradition's moves (tradition)`);
    if (spec.moves !== undefined) {
      try { fight = await heroFightOf(manifest, spec.moves); } catch (err) { throw new Error(`versus: ${where}.${err.message.replace(/^versus(-hero)?: /, '')}`); }
    }
    const sheet = manifest.egocube ? sheetOf(manifest.egocube) : null;
    const read = sheet ? fighterFromSheet(sheet) : { intent: { archetype: 'all-rounder' }, reads: [] };
    const { style, ...over } = spec.over;
    // (a snout carried low: the entry's own stoop over its head's; none for a person)
    const stoop = snoutStoop(manifest.hero), stance = over.stance && read.intent.stance ? { ...read.intent.stance, ...over.stance } : over.stance ?? read.intent.stance;
    out.push({
      id: spec.id, name: spec.name ?? (sheet ? fighterName(sheet) : spec.id),
      ...read.intent, ...(style ? { archetype: style } : {}), ...over,
      ...(over.stance && read.intent.stance ? { stance } : {}),
      ...(stoop && stance?.stoop === undefined ? { stance: { ...(stance ?? {}), stoop } } : {}),
      body, ...(spec.color ?? color ? { color: spec.color ?? color } : {}), character: ref,
      ...(sheet ? { sheet: manifest.egocube.ref, reads: read.reads } : {}),
      ...(fight ? { heroNormals: fight.normals, guard: fight.guard } : {}),
    });
  }
  return out;
}

/** The sheet a character's egocube record names, as it was when the character was made (its revision, by print). */
async function storeSheets() {
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { SketchRevisionRepository } = await import('@/lib/db/repositories/sketch-revisions');
  const { egocubeNodes, egocubePrint } = await import('../egocube/kind.js');
  return (rec) => {
    if (!isObj(rec) || typeof rec.ref !== 'string') return null;
    const head = SketchRepository.getByRef(rec.ref)?.manifest;
    const m = head?.kind === 'egocube' && egocubePrint(head) === rec.print ? head : SketchRevisionRepository.get(rec.ref, rec.rev)?.manifest ?? head;
    if (m?.kind !== 'egocube') return null;
    try {
      const nodes = egocubeNodes(m);
      return (rec.years !== undefined ? nodes.find((n) => n.years === rec.years) : nodes[0])?.sheet ?? null;
    } catch { return null; }
  };
}

/** A manifest (a versus game, or an arena's versus channel) with its roster's characters measured from the store. */
export async function withCharacters(holder) {
  if (!isObj(holder) || !Array.isArray(holder.roster) || !holder.roster.some(isCharacterEntry)) return holder;
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  return { ...holder, roster: await resolveCharacters(holder.roster, (ref) => SketchRepository.getByRef(ref)?.manifest ?? null, await storeSheets()) };
}

/**
 * The gate a versus game pays at mint and on every edit: every fighter a character (measured, its fight read off its
 * sheet), fought on arenas. → { ok, errors, laws, fighters: [{ id, character, sheet?, reads? }] }.
 */
export async function versusGate(manifest) {
  const { readVersusManifest } = await import('./versus-page.js');
  const errors = [];
  if (!Array.isArray(manifest?.roster) || !manifest.roster.length) errors.push('roster: a versus game names its fighters, each a character ({ hero: { ref } })');
  else manifest.roster.forEach((e, i) => { if (!isCharacterEntry(e)) errors.push(`roster[${i}] is not a character: every fighter is one ({ hero: { ref } }, made with create_character)`); });
  if (!Array.isArray(manifest?.arenas) || !manifest.arenas.length) errors.push('arenas: a versus game is fought on its arenas (stage worlds), at least one');
  if (errors.length) return { ok: false, errors, laws: [], fighters: [] };
  let measured;
  try { measured = await withCharacters(manifest); } catch (e) { return { ok: false, errors: [e.message.replace(/^versus: /, '')], laws: [], fighters: [] }; }
  const fighters = measured.roster.map((e) => ({ id: e.id, character: e.character, ...(e.sheet ? { sheet: e.sheet, reads: e.reads } : {}) }));
  return { ...readVersusManifest(measured), fighters };
}

/**
 * A character's own body for an arena (versus-figure.js poses it): its layered rig's bones and rigid parts, the clips
 * left out (the fight is the motion). → { bones: [{ id, head, tail }], parts: [{ pos, col } | null] }, or null when
 * the rig has no parts to draw (the stick figure stands in).
 *
 * A fighter that throws its OWN strikes (`moves`, versus-hero.js) is drawn as it was made: `fight` names the clips its
 * fight plays (FIGHT_CLIPS, its strikes', its guard's, its blows' and blocks', its knockdown's), solved on its own rig
 * from the door's motion words laid onto its record for the bake (the row is not changed), and the body is PLAYED:
 * one skinned mesh of its parts (their joints and weights), its painted skin (`paintTex`, each part's `uv`) and those
 * clips, as the World page plays a hero; resolved as the lit export resolves it (its albedo unshaded, each corner's normal
 * `nrm` and the relief's tangent `tan`, the skin's atlas full size, its relief `normalTex` and `ormTex`), so the arena
 * lights it as an engine does. → { played: true, lit?, bones, parts: [{ pos, col, jnt, wgt, faces, uv?, nrm?, tan? }],
 * clips, paintTex?, normalTex?, ormTex? }.
 */
export async function characterBody(manifest, { fight = null, register = null } = {}) {
  const { expandLayeredManifest } = await layered();
  const { WORLD_KINDS } = await import('../worlds/world-kinds.js');
  const m = fight && manifest?.hero ? { ...manifest, hero: { ...manifest.hero, motion: { ...(manifest.hero.motion ?? {}), ...Object.fromEntries(fightMotion(fight).map((w) => [w, true])) } } } : manifest;
  // A CHARACTER DRAWN IN THE CHARACTER LIGHT (the anime hero's cel look, station-loft-shade.js) is played in it: its tones
  // are the light's own (each group's shade swatch, the unlit eyes and ink kept as drawn), baked TWICE, every group
  // stepped lit and every group stepped in shade, so each corner carries both of its tones and the arena steps between
  // them by its own key as the body turns (versus-arena.client.js), the light never turning with the body
  // (a fight game's register draws every body its one way, from the lit export: versus-arena.client.js)
  if (fight && !register && m?.hero && resolveCharacterLight(m, {})) {
    const toon = await toonBody(m, fight, WORLD_KINDS, expandLayeredManifest);
    if (toon) return toon;
  }
  // (a played body as an engine gets it, the lit export's: its albedo unshaded, each corner's normal, the skin's relief
  // and its full-size atlas, for the arena to light as it moves; the posed figure as before)
  const ctx = fight ? { title: 'fighter', light: FLAT_LIGHT, unshaded: true, face: true } : { title: 'fighter' };
  const scene = await WORLD_KINDS.layered.resolve(expandLayeredManifest(m), ctx);
  const fig = scene?.figures?.body;
  if (!fig || !Array.isArray(fig.bones) || !fig.parts?.some((p) => p?.pos)) return null;
  const bones = fig.bones.map(({ id, head, tail }) => ({ id, head, tail }));
  if (fight && fig.parts.some((p) => p?.jnt)) {
    const clips = Object.fromEntries(Object.entries(fig.clips ?? {}).filter(([k]) => fight.includes(k)).map(([k, c]) => [k, { k: c.k, b: c.b, ...(c.once ? { once: true } : {}), ...(c.s ? { s: c.s } : {}) }]));
    return { played: true, ...(fig.parts.some((p) => p?.nrm) ? { lit: true } : {}), bones, parts: fig.parts.map((p) => (p?.pos ? { pos: p.pos, col: p.col, jnt: p.jnt, wgt: p.wgt, faces: p.faces, ...(p.uv ? { uv: p.uv } : {}), ...(p.nrm ? { nrm: p.nrm } : {}), ...(p.tan ? { tan: p.tan } : {}) } : null)), clips,
      ...(fig.paintTex ? { paintTex: fig.paintTex } : {}), ...(fig.normalTex ? { normalTex: fig.normalTex } : {}), ...(fig.ormTex ? { ormTex: fig.ormTex } : {}) };
  }
  return { bones, parts: fig.parts.map((p) => (p?.pos ? { pos: p.pos, col: p.col } : null)) };
}

/** A toon body: the character light baked with every palette group's step forced lit, then forced in shade (no highlight,
 * so neither bake splits a face and both carry the same corners), the shade tone riding each corner as `colShade`.
 * → the played body with `toon: true`, or null when the two bakes do not line up (the lit export's body is played) */
async function toonBody(m, fight, WORLD_KINDS, expandLayeredManifest) {
  const groups = Object.keys(expandLayeredManifest(m).recipe?.palette ?? {});
  const stepped = (t) => ({ ...m, toon: { ...(m.toon ?? {}), light: { threshold: t, thresholds: Object.fromEntries(groups.map((g) => [g, t])), highlight: {} } } });
  // (a threshold under every N·L steps a group lit, one over every N·L in shade)
  const [lit, shade] = await Promise.all([-2, 2].map((t) => WORLD_KINDS.layered.resolve(expandLayeredManifest(stepped(t)), { title: 'fighter', face: true })));
  const A = lit?.figures?.body, B = shade?.figures?.body;
  if (!A?.parts?.some((p) => p?.jnt) || !B?.parts || A.parts.length !== B.parts.length) return null;
  if (A.parts.some((p, i) => (p?.faces ?? 0) !== (B.parts[i]?.faces ?? 0))) return null;
  const clips = Object.fromEntries(Object.entries(A.clips ?? {}).filter(([k]) => fight.includes(k)).map(([k, c]) => [k, { k: c.k, b: c.b, ...(c.once ? { once: true } : {}), ...(c.s ? { s: c.s } : {}) }]));
  return {
    played: true, toon: true, bones: A.bones.map(({ id, head, tail }) => ({ id, head, tail })),
    parts: A.parts.map((p, i) => (p?.pos ? { pos: p.pos, col: p.col, colShade: B.parts[i].col, jnt: p.jnt, wgt: p.wgt, faces: p.faces, ...(p.uv ? { uv: p.uv } : {}) } : null)),
    clips, ...(A.paintTex ? { paintTex: A.paintTex } : {}),
  };
}
/** the clips a fighter with its own strikes plays: its strikes (by slot), its guard, its blows and blocks taken in the
 * guard, and its knockdown (a rest: getting down, and up) */
export const FIGHT_REACTS = Object.freeze(['guard', 'block', 'blockBody', 'guardHitHigh', 'guardHitBody', 'guardHitLow', 'guardStagger', 'knockedOutDown', 'knockedOutUp']);
export const fightClips = (heroNormals) => [...new Set([...Object.values(heroNormals).map((n) => n.hero.word), ...FIGHT_REACTS])];
/** the door's motion words that make those clips (the knockdown's two are one rest word) */
const fightMotion = (clips) => [...new Set(clips.map((c) => (/^knockedOut(Down|Up)$/.test(c) ? 'knockedOut' : c)))];

/** the clips a fighter with a tradition's moves plays: its guard alone, whose hands (the fists it makes) its body keeps
 * as the fight's own poses drive it (versus-arena.client.js: the figure's segments onto its bones) */
export const TRADITION_CLIPS = Object.freeze(['guard']);

/** An arena's measured roster → { <ref>: body } for each character in it (one body per character), from the store,
 * each played in its own body: a fighter with its own strikes (`heroNormals`) with its fight's clips, one with a
 * tradition's moves with its guard's (the fight's poses drive the rest). Under a fight game's `register` every body is
 * its lit export (its albedo and its normals), for the arena to draw each the register's one way. */
export async function characterBodies(roster, { register = null } = {}) {
  const list = (Array.isArray(roster) ? roster : []).filter((e) => typeof e?.character === 'string');
  if (!list.length) return null;
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const out = {};
  for (const e of list) {
    if (out[e.character]) continue;
    const fight = e.heroNormals ? fightClips(e.heroNormals) : TRADITION_CLIPS;
    const body = await characterBody(SketchRepository.getByRef(e.character)?.manifest, { fight, register }).catch(() => null);
    if (body) out[e.character] = body;
  }
  return Object.keys(out).length ? out : null;
}
