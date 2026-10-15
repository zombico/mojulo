/**
 * versus character — a fighter who is a character made with create_character.
 *
 * A roster entry may name a stored hero instead of a cast: `{ id, hero: { ref }, name?, archetype?, signature?, color?,
 * weapon?, … }`. The moveset is still the archetype's and the designer's words; the BODY is the character's, measured
 * off its own skeleton (the layered hero's rig joints) into the fight's body dials, so a long-armed character reaches
 * further and its boxes follow. The game stores the ref, never the measure: like a quick game's adopted hero, the fighter
 * follows the character's edits, measured again wherever the game is served (the play route, the export, an arena's
 * World page, the edit gate).
 *
 * The calibration: the default male hero (create_character's `cast: 'male'`) is the fight's canonical body, arm, leg and
 * torso 1; a dial is the character's proportion over his. Height is the character's own (mm to the top of the head).
 */
import { BODY_DIALS } from './versus-compile.js';
import { castOf, BODY_DEFAULTS } from '../polygonizer/hero-form.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const HEX = /^#[0-9a-f]{6}$/i;
// a character's body is its own: these would contradict it
const NOT_WITH_HERO = ['cast', 'body', 'recipe'];

/** A roster entry that names a character (unresolved). */
export const isCharacterEntry = (e) => isObj(e) && e.hero !== undefined;

/** The shape of a character entry, before any lookup; throws naming what is wrong. */
export function readCharacterEntry(e, where = 'fighter') {
  if (!isObj(e.hero) || Object.keys(e.hero).join() !== 'ref' || typeof e.hero.ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(e.hero.ref)) {
    throw new Error(`versus: ${where}.hero is { ref } (a character made with create_character)`);
  }
  for (const k of NOT_WITH_HERO) if (e[k] !== undefined) throw new Error(`versus: ${where}.${k}: a character's body is its own (drop ${k}, or the hero)`);
}

const at = (j) => (Array.isArray(j) ? j : j.at);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

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
  const hero = heroRecord({ cast: 'male' });
  REF = { m: measureSkeleton(expandLayeredManifest({ kind: 'layered', hero }).recipe.rig.joints), girth: heroGirth(hero) };
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

/** A stored row's manifest → the character's body dials and colour; throws when the row is not a character. */
export async function measureCharacter(manifest, where = 'fighter', ref = '?') {
  if (!manifest || manifest.kind !== 'layered' || !isObj(manifest.hero)) {
    throw new Error(`versus: ${where}.hero.ref '${ref}' is not a stored character (make one with create_character { as: 'hero' })`);
  }
  const { expandLayeredManifest } = await layered();
  const joints = expandLayeredManifest(manifest).recipe?.rig?.joints;
  if (!joints) throw new Error(`versus: ${where}.hero.ref '${ref}' has no skeleton to measure`);
  const { body, held } = bodyDials(measureSkeleton(joints), heroGirth(manifest.hero), await reference());
  const top = manifest.hero.palette?.Top;
  return { body, held, ...(typeof top === 'string' && HEX.test(top) ? { color: top } : {}) };
}

/**
 * A roster with its characters measured: each `{ hero: { ref }, … }` entry becomes an intent with the character's
 * `body` (and its colour, unless the entry names one) and `character: ref`. `lookup(ref)` → a row's manifest or null.
 * A roster without a character comes back as given.
 */
export async function resolveCharacters(roster, lookup) {
  if (!Array.isArray(roster) || !roster.some(isCharacterEntry)) return roster;
  const out = [];
  for (const [i, e] of roster.entries()) {
    if (!isCharacterEntry(e)) { out.push(e); continue; }
    const where = `roster[${i}]`;
    readCharacterEntry(e, where);
    const { hero, ...intent } = e;
    const { body, color } = await measureCharacter(lookup(hero.ref), where, hero.ref);
    out.push({ ...intent, body, ...(intent.color === undefined && color ? { color } : {}), character: hero.ref });
  }
  return out;
}

/** A manifest (a versus game, or an arena's versus channel) with its roster's characters measured from the store. */
export async function withCharacters(holder) {
  if (!isObj(holder) || !Array.isArray(holder.roster) || !holder.roster.some(isCharacterEntry)) return holder;
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  return { ...holder, roster: await resolveCharacters(holder.roster, (ref) => SketchRepository.getByRef(ref)?.manifest ?? null) };
}

/** The gate a versus game pays at mint and on every edit, its characters measured first: → { ok, errors, laws }. */
export async function versusGate(manifest) {
  const { readVersusManifest } = await import('./versus-page.js');
  let measured;
  try { measured = await withCharacters(manifest); } catch (e) { return { ok: false, errors: [e.message.replace(/^versus: /, '')], laws: [] }; }
  return readVersusManifest(measured);
}

/**
 * A character's own body for an arena (versus-skin.js poses it): its layered rig's bones and rigid parts, the clips
 * left out (the fight is the motion). → { bones: [{ id, head, tail }], parts: [{ pos, col } | null] }, or null when
 * the rig has no parts to draw (the stick figure stands in).
 */
export async function characterBody(manifest) {
  const { expandLayeredManifest } = await layered();
  const { WORLD_KINDS } = await import('../worlds/world-kinds.js');
  const scene = await WORLD_KINDS.layered.resolve(expandLayeredManifest(manifest), { title: 'fighter' });
  const fig = scene?.figures?.body;
  if (!fig || !Array.isArray(fig.bones) || !fig.parts?.some((p) => p?.pos)) return null;
  return { bones: fig.bones.map(({ id, head, tail }) => ({ id, head, tail })), parts: fig.parts.map((p) => (p?.pos ? { pos: p.pos, col: p.col } : null)) };
}

/** An arena's measured roster → { <ref>: body } for each character in it (one body per character), from the store. */
export async function characterBodies(roster) {
  const refs = [...new Set((Array.isArray(roster) ? roster : []).map((e) => e?.character).filter((r) => typeof r === 'string'))];
  if (!refs.length) return null;
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const out = {};
  for (const ref of refs) {
    const body = await characterBody(SketchRepository.getByRef(ref)?.manifest).catch(() => null);
    if (body) out[ref] = body;
  }
  return Object.keys(out).length ? out : null;
}
