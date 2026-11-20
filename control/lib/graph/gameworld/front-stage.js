/**
 * THE START SCREEN'S SUBJECTS — what a game has that is worth putting on its start screen, and the stage a front card
 * would lay from it (game/front-stage.js is the stage's shape; playscape/ui/front-cards/ its layouts). The start screen
 * is a visual artifact of the game's own characters, vehicles and props, never a level or a set, so a game is offered
 * one only when it has something to show.
 *
 * Its subjects are the sketches the game's runs made (made.js) and the hero it adopted, each under its ROLE:
 *
 *   hero   the one the player is: the hero as equipped, else as made, else the hero adopted (characters.hero.ref)
 *   ally   the cast beside it: its people (cast-<id>), athletes, the farmhand, the stall keeper
 *   foe    who it meets: the foes and the guards a run made
 *   ride   its vehicle
 *   prop   what it carries: the gear a run made (gear-<class>)
 *
 *   frontSubjects(world)                 → [{ role, ref, from }] in order of importance, each role's own in its order
 *   fillStage(card, subjects, wanted?)   → [{ role, ref }] one a slot, or null when a slot stands nothing: each slot
 *                                          takes the subject `wanted` names for it (a role: the first of that role not
 *                                          yet stood; a ref: that sketch), else the first not yet stood of its roles
 *   frontStageSuggestion(world)          → { composition, subjects, why, patch } | null: the card the game's genre is
 *                                          suited by (else the fallback) whose slots its subjects fill; null when the
 *                                          front already has a stage or nothing fills one
 *   stagedFront(world, front)            → the front as the game carries it: its stage's subjects (roles, refs, or
 *                                          none) settled to the refs that fill its card's slots, so the export pictures
 *                                          sketches; a stage nothing fills keeps no subjects (the export says so)
 *
 * Pure: the world's own record, no database (a ref is the runner's word that the sketch is there).
 */
import { FRONT_CARDS, FRONT_CARD_IDS, SUBJECT_ROLES, fallbackCard } from '../playscape/ui/front-cards/loader.js';
import { RAILS } from './rails.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// a made key's role, and its place among its role's own (a number after the name orders foe-2 after foe)
const ROLE_OF = [
  [/^hero-equipped$/, 'hero', 0], [/^hero$/, 'hero', 1],
  [/^cast-[a-z][a-z0-9-]*$/, 'ally', 0], [/^athlete(-\d+)?$/, 'ally', 1], [/^farmhand(-\d+)?$/, 'ally', 2], [/^keeper(-\d+)?$/, 'ally', 3],
  [/^foe(-\d+)?$/, 'foe', 0], [/^guard(-\d+)?$/, 'foe', 1],
  [/^ride$/, 'ride', 0],
  [/^gear-[a-z]+$/, 'prop', 0],
];
const numberOf = (k) => { const m = k.match(/-(\d+)$/); return m ? Number(m[1]) : 0; };

export function frontSubjects(world) {
  const made = isObj(world?.made) ? world.made : {};
  const found = [];
  for (const [key, rec] of Object.entries(made)) {
    const hit = ROLE_OF.find(([re]) => re.test(key));
    if (hit && isObj(rec) && typeof rec.ref === 'string' && rec.ref) found.push({ role: hit[1], ref: rec.ref, from: `made.${key}`, rank: hit[2], n: numberOf(key), key });
  }
  const adopted = world?.characters?.hero?.ref;
  if (typeof adopted === 'string' && adopted && !found.some((s) => s.role === 'hero')) found.push({ role: 'hero', ref: adopted, from: 'characters.hero.ref', rank: 2, n: 0, key: '' });
  // the equipped hero and the hero as made are one character: the start screen stands it once
  const heroes = found.filter((s) => s.role === 'hero').sort((a, b) => a.rank - b.rank);
  const kept = found.filter((s) => s.role !== 'hero' || s === heroes[0]);
  const order = (s) => SUBJECT_ROLES.indexOf(s.role);
  return kept
    .sort((a, b) => order(a) - order(b) || a.rank - b.rank || a.n - b.n || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ role, ref, from }) => ({ role, ref, from }));
}

export function fillStage(card, subjects, wanted = []) {
  const used = new Set(), out = [];
  for (let i = 0; i < card.slots.length; i++) {
    const slot = card.slots[i], w = wanted[i];
    let pick = null;
    if (typeof w === 'string' && !SUBJECT_ROLES.includes(w)) pick = { role: subjects.find((s) => s.ref === w)?.role ?? null, ref: w };
    else {
      const roles = typeof w === 'string' ? [w] : slot.roles;
      const s = subjects.find((x) => roles.includes(x.role) && !used.has(x.ref));
      if (s) pick = { role: s.role, ref: s.ref };
    }
    if (!pick) return null;
    used.add(pick.ref);
    out.push(pick);
  }
  return out;
}

const genresOf = (world) => RAILS[world?.rail?.from]?.handles?.genres ?? [];

export function frontStageSuggestion(world) {
  if (world?.front?.stage !== undefined) return null;
  const subjects = frontSubjects(world);
  if (!subjects.length) return null;
  const genres = genresOf(world);
  const suited = FRONT_CARD_IDS.filter((id) => FRONT_CARDS[id].suits.some((g) => genres.includes(g)));
  const fb = fallbackCard();
  const order = [...suited, ...(fb && !suited.includes(fb.id) ? [fb.id] : [])];
  for (const id of order) {
    const card = FRONT_CARDS[id], filled = fillStage(card, subjects);
    if (!filled) continue;
    const stage = { composition: id, subjects: filled.map((s) => s.role) };
    const why = `${suited.includes(id) ? `${card.name} is a ${genres.find((g) => card.suits.includes(g))} game's start screen` : `${card.name}, the start screen for any game`}: ${filled.map((s) => `its ${s.role}`).join(' and ')} on it, the game's name and its menu as words. Pictures only (no 3D) unless mode: '3d'`;
    const patch = isObj(world.front) ? [{ op: 'set', path: '/front/stage', value: stage }] : [{ op: 'set', path: '/front', value: { stage } }];
    return { composition: id, subjects: stage.subjects, why, patch };
  }
  return null;
}

export function stagedFront(world, front) {
  if (!isObj(front) || !isObj(front.stage)) return front;
  const card = FRONT_CARDS[front.stage.composition];
  if (!card) return front;
  const { subjects: _s, ...stage } = front.stage;
  const filled = fillStage(card, frontSubjects(world), Array.isArray(front.stage.subjects) ? front.stage.subjects : []);
  return { ...front, stage: filled ? { ...stage, subjects: filled.map((s) => s.ref) } : stage };
}
