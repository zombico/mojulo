/**
 * THE PRODUCTION — how a game is run, the way a studio runs one. The creator is its creative director and its
 * publisher: the pillars and the vertical slice are theirs, and the milestones they set. The director (the person's
 * agent) is its game director: it runs the floor within the pillars and makes the calls. A crew per beat makes the work;
 * an ASSISTANT DIRECTOR prepares each call for the director and never makes it.
 *
 *   style        the director's, set once a world (and overridable per req): it sets the assistant director's posture
 *                  yeoman       → assistive   "is it done, and done well?"   ship it well; notes, never blocks, on sameness
 *                  auteur       → strict      "is it ours?"                  every choice traces to the intent and the book
 *                  avant-garde  → elevating   "what would make it memorable?"  beyond the default, within the world's laws
 *                auteur when none is set: every production has pillars, and holding them is the assistant's first job
 *   a pillar     a unit the creator always sees: what game it is, the main quest, the hero's direction and look
 *   the slice    the vertical slice: the first level the creator accepts. Before it, everything is the creator's; after
 *                it, the director may settle a unit itself (DIRECTED, never the creator's ACCEPTED), except a pillar and a
 *                checkpoint
 *   checkpoints  what else the creator sees after the slice: 'act' (the level of each act's last built beat), or
 *                'every' (every unit: the director settles nothing)
 *   a role       a job's stable seat, `<world>:<kind>:<department>` (the assistant: `<world>:assistant`): the same seat
 *                does the same kind of work beat after beat, so a host may keep one agent in it, its precedent in its own
 *                context and its stable prompt cached
 *
 * Pure: the production's settings, the unit and the ledger in; the posture, the role and what the director may do out.
 */
import { unitOf, chapterById } from './chapters.js';
import { STYLES, DEFAULT_STYLE, POSTURE_OF, POSTURES } from './job-words.js';

export { STYLES, DEFAULT_STYLE, POSTURE_OF, POSTURES };

export const RECOMMENDS = Object.freeze(['pass-up', 'rework', 'elevate']);
export const CHECKPOINTS = Object.freeze({ act: 'the level of each act\'s last built beat', every: 'every unit: the director settles nothing' });
/** The units the creator always sees: what game it is, its main quest, the hero's direction and look. */
export const PILLARS = Object.freeze(['intent', 'main-quest', 'direction', 'hero']);
export const DIRECTS = Object.freeze({ settle: 'the director\'s own call: directed', rework: 'back to its crew, with the note', creator: 'shown to the creator, whose verdict it is' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A production setting as the door takes it. Throws, teaching. */
export function checkProduction(P) {
  if (!isObj(P)) throw new Error('design_game: production is { style?, checkpoints? }');
  const unknown = Object.keys(P).filter((k) => k !== 'style' && k !== 'checkpoints');
  if (unknown.length) throw new Error(`design_game: production is { style?, checkpoints? } (not ${unknown.join(', ')})`);
  if (P.style !== undefined && P.style !== null && !STYLES[P.style]) throw new Error(`design_game: a style is ${Object.keys(STYLES).join(', ')}`);
  if (P.checkpoints !== undefined && (!Array.isArray(P.checkpoints) || P.checkpoints.some((c) => !CHECKPOINTS[c]))) throw new Error(`design_game: checkpoints are [${Object.keys(CHECKPOINTS).join(' | ')}] (the pillars and the slice are always the creator's)`);
}

/** The style a req is worked in: its own, else the world's, else the default. */
export const styleOf = (req, production) => req?.style ?? production?.style ?? DEFAULT_STYLE;
export const postureOf = (req, production) => POSTURE_OF[styleOf(req, production)];

/** A job's stable seat: `<world>:<kind>:<department>`, the assistant `<world>:assistant`. */
export function roleOf(world, kind, unit) {
  if (kind === 'assistant') return `${world}:assistant`;
  const u = unitOf(unit);
  return `${world}:${kind === 'diverge' ? 'author' : kind}:${u?.chapter?.department ?? 'production'}`;
}

/** Is a unit a pillar (always the creator's)? */
export const isPillar = (unit) => PILLARS.includes(unitOf(unit)?.chapter?.id) && unitOf(unit)?.level == null;

/** The levels a checkpoint names: 'act' → each act's last built beat's level (from questPlays' plays and the quest). */
export function checkpointLevels(checkpoints, { quest = null, plays = {} } = {}) {
  if (!checkpoints?.includes('act') || !quest) return [];
  const parts = quest.chapters ?? quest.acts ?? [];
  return parts.map((A) => [...(A.beats ?? [])].reverse().find((B) => B.built !== false && plays[B.id])).filter(Boolean).map((B) => plays[B.id]);
}

/**
 * May the director settle this req itself? → { may: true } or { may: false, why }.
 *   slice    has the creator accepted the vertical slice (a level's req, accepted by them)?
 *   units    the req's units (its own and its crew's)
 */
export function maySettle({ units = [], slice = false, checkpoints = [], checkpointed = [] }) {
  if (!slice) return { may: false, why: 'before the vertical slice is accepted, the creator accepts every unit: show it to them' };
  if (checkpoints.includes('every')) return { may: false, why: 'the production\'s checkpoints are every unit: the creator accepts each' };
  const pillar = units.find(isPillar);
  if (pillar) return { may: false, why: `${pillar} is a pillar: the creator accepts it` };
  const cp = units.map((u) => unitOf(u)?.level).find((lv) => lv != null && checkpointed.includes(lv));
  if (cp) return { may: false, why: `level:${cp} is a checkpoint (the last beat of an act): the creator accepts it` };
  return { may: true };
}

/** The assistant's verdict, checked. Throws, teaching. */
export function checkRecommendation({ recommend, reasons, fixes, bolder }) {
  if (!RECOMMENDS.includes(recommend)) throw new Error(`the assistant recommends ${RECOMMENDS.join(', ')}: recommend, with reasons`);
  if (!Array.isArray(reasons) || !reasons.length || reasons.some((r) => typeof r !== 'string' || !r.trim())) throw new Error('the assistant gives its reasons: reasons: ["…"]');
  if (fixes !== undefined && (!Array.isArray(fixes) || fixes.some((f) => typeof f !== 'string'))) throw new Error('fixes are ["…"]');
  if (bolder !== undefined && typeof bolder !== 'string') throw new Error('bolder is the bolder angle, in a sentence');
}

/** The production as the readout says it. */
export function productionSummary(production, { slice = false, accepted = 0, directed = 0 } = {}) {
  const style = production?.style ?? DEFAULT_STYLE;
  return {
    style, ...(production?.style ? {} : { defaulted: true }), posture: POSTURE_OF[style],
    slice: slice ? 'accepted: the director may settle units outside the pillars and checkpoints' : 'not yet: the creator accepts every unit',
    ...(production?.checkpoints?.length ? { checkpoints: production.checkpoints } : {}),
    seen: { accepted, directed },
  };
}

export const departmentOf = (unit) => chapterById(unitOf(unit)?.chapter?.id ?? '')?.department ?? null;
