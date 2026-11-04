/**
 * persona — WHO reads: a record of its own (kind `persona`) pointing at a hero, with a voice and a delivery, and the
 * READS it keeps (its scripts). The hero is its body and its face (create_character as 'hero'); the persona is the hero
 * cast as a speaker, so one hero can be an anchor on one record and a caller on another, and a persona outlives an edit
 * to its hero's face (it points, it does not copy).
 *
 *   THE RECORD: { kind: 'persona', persona: { hero: <ref>, voice?: <ref> (a voice register, create_voice), register:
 *   <a delivery register: a name or { from, …tune }, delivery.js>, style?: <a playing style, actor/style.js>, role?:
 *   <a role, actor/role.js>, reads: { <id>: { script, register?, style?, role?, seed? } } } }
 *
 *   THE PERSONA IS THE ACTOR: one kind of actor, a hero playing a role from a script. Its register is its role of
 *   speech; a STYLE (thespian, action-star, anime-mocap, extra) says how much it does and when, and a ROLE its state of
 *   mind, resting face and status (actor/). With neither, a read is the persona's as it always was, byte for byte.
 *
 *   A READ (`personaReads`): its script read in its register, played in its style by its role (each its own, else the
 *   persona's): actor/interpret.js `actRead`, on every read of the record (a recipe: the scripts are kept, the timings
 *   regenerate). A read's FACE take is the hero's
 *   `perform` take of the same name (`personaTakes`), played where the face is drawn (fidelity.js); its captions and its
 *   body track are everywhere's.
 *
 * Pure: the door (create_character as 'persona') looks the refs up; this module checks shapes and compiles.
 */
import { deliveryErrors } from './delivery.js';
import { captionCues } from './captions.js';
import { actRead } from '../actor/interpret.js';
import { styleErrors } from '../actor/style.js';
import { roleErrors } from '../actor/role.js';

export const PERSONA_KIND = 'persona';
export const isPersonaKind = (kind) => kind === PERSONA_KIND;
/** a read's id: a word, as a take's name is (it becomes the hero's `face:<id>` clip) */
export const READ_ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const PERSONA_KEYS = ['hero', 'voice', 'register', 'style', 'role', 'reads'];
const READ_KEYS = ['script', 'register', 'style', 'role', 'seed'];

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Error lines for a persona's words (empty = valid); the refs are checked by the door, against the store */
export function personaErrors(P) {
  if (!isPlain(P)) return ["a persona is { hero: <a hero's ref>, voice?, register?, reads?: { <id>: { script, register?, seed? } } }"];
  const errs = [];
  const unknown = Object.keys(P).filter((k) => !PERSONA_KEYS.includes(k));
  if (unknown.length) errs.push(`a persona takes ${PERSONA_KEYS.join(', ')} (not ${unknown.join(', ')})`);
  if (typeof P.hero !== 'string' || !P.hero) errs.push("hero: a hero's ref (create_character { as: 'hero' })");
  if (P.voice !== undefined && (typeof P.voice !== 'string' || !P.voice)) errs.push("voice: a voice register's ref");
  if (P.register !== undefined) errs.push(...deliveryErrors(P.register, 'register'));
  if (P.style !== undefined) errs.push(...styleErrors(P.style, 'style'));
  if (P.role !== undefined) errs.push(...roleErrors(P.role, 'role'));
  if (P.reads !== undefined) {
    if (!isPlain(P.reads)) errs.push('reads: { <id>: { script, register?, seed? } }');
    else for (const [id, R] of Object.entries(P.reads)) {
      const at = `reads.${id}`;
      if (!READ_ID.test(id)) { errs.push(`${at}: a read's id is a word (letters, digits, - and _; it names the hero's face:<id> clip)`); continue; }
      if (!isPlain(R)) { errs.push(`${at}: { script, register?, seed? }`); continue; }
      const extra = Object.keys(R).filter((k) => !READ_KEYS.includes(k));
      if (extra.length) errs.push(`${at}: a read takes ${READ_KEYS.join(', ')} (not ${extra.join(', ')})`);
      if (typeof R.script !== 'string' || !R.script.trim()) errs.push(`${at}.script: text (a blank line a new paragraph; *stress*, [pause], [pause 1.5], (aside))`);
      else {
        try { actOf(P, R); } catch (e) { errs.push(`${at}: ${e.message}`); }
      }
      if (R.register !== undefined) errs.push(...deliveryErrors(R.register, `${at}.register`));
      if (R.style !== undefined) errs.push(...styleErrors(R.style, `${at}.style`));
      if (R.role !== undefined) errs.push(...roleErrors(R.role, `${at}.role`));
      if (R.seed !== undefined && !(Number.isInteger(R.seed) && R.seed >= 0)) errs.push(`${at}.seed: a whole number (the face's blinks and glances)`);
    }
  }
  return errs;
}

/** The record a persona's words make: { kind, persona } with its register named (the anchor's when none is given) */
export function personaManifest(P) {
  const errs = personaErrors(P);
  if (errs.length) throw new Error(`persona: ${errs.join('; ')}`);
  return { kind: PERSONA_KIND, persona: { hero: P.hero, ...(P.voice ? { voice: P.voice } : {}), register: P.register ?? 'anchor', ...(P.style !== undefined ? { style: P.style } : {}), ...(P.role !== undefined ? { role: P.role } : {}), reads: P.reads ?? {} } };
}

/** A read compiled as its actor plays it (actor/interpret.js): its register, style and role its own, else the persona's;
 * with no style and no role, read.js's read as it always was */
function actOf(persona, R) {
  const style = R.style ?? persona.style, role = R.role ?? persona.role;
  return actRead({ script: R.script, register: R.register ?? persona.register ?? 'anchor', ...(style !== undefined ? { style } : {}), ...(role !== undefined ? { role } : {}), seed: R.seed ?? 1 });
}

/** Each read compiled: { <id>: the read } (interpret.js actRead: read.js's read played in a style by a role, where the
 * persona or the read names one) */
export function personaReads(persona) {
  return Object.fromEntries(Object.entries(persona.reads ?? {}).map(([id, R]) => [id, actOf(persona, R)]));
}

/** The hero's face takes a persona's reads make: { <id>: a `perform` take ({ beats, seconds, seed }) }, as the hero's door
 * takes them (layered.js `perform`), so a read plays wherever a hero's take does (its GLB's face:<id> clip) */
export function personaTakes(persona, reads = personaReads(persona)) {
  return Object.fromEntries(Object.entries(reads).map(([id, R]) => [id, { beats: R.beats, seconds: R.seconds, seed: persona.reads[id].seed ?? 1, ...(R.intensity !== undefined ? { intensity: R.intensity } : {}) }]));
}

/** A read in short, as the door reports it: its length, its lines and words, its stresses, captions and gestures */
export function readSummary(id, R) {
  const words = R.lines.reduce((n, L) => n + L.words.length, 0), cues = captionCues(R);
  return { id, register: R.register, ...(R.style ? { style: R.style } : {}), ...(R.role ? { role: R.role.status } : {}), seconds: R.seconds, lines: R.lines.length, words, stressed: R.lines.flatMap((L) => L.words.filter((w) => w.emph).map((w) => w.w)), captions: cues.length, gestures: R.body.map((b) => b.gesture) };
}

