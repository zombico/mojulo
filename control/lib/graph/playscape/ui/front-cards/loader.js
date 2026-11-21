/**
 * THE FRONT CARDS — a game's start screen laid out as data, so a new start screen is a card, not code (the theme cards'
 * sibling: a theme card says how the screen is drawn, a front card says what is on it and where). A start screen is a
 * visual artifact: a few SUBJECTS (the game's own characters, vehicles, props: never a level or a set), its name and its
 * menu, on a graphic ground, entering on beats. Each `<id>.json` beside this file is one card:
 *
 *   { "id": "<the file's name>", "name": "…", "about": "what it shows, in a line", "author"?,
 *     "suits": ["<genre>", …],          the genres it is the start screen for (gameworld/rails.js handles.genres)
 *     "fallback"?: true,                 the card a game whose genre no card suits is offered (one card at most)
 *     "slots": [{ roles, view, crop, anchor, facing? }],   what stands on it, in order of importance: each a subject
 *                                        of one of its roles (SUBJECT_ROLES), seen from its view, cropped and
 *                                        anchored, turned left (the default) or right on the screen
 *     "ground": "theme" | "plain" | "split",   the graphic behind: the theme's stage shapes, its ground alone, or the
 *                                        screen cut on a diagonal, a side a subject
 *     "frames": { "wide": FRAME, "tall": FRAME },   the layout on a landscape screen and on a phone held upright
 *       FRAME: { subjects: [[x, y, w, h], …] (one box a slot), title: PART & { size, behind? }, tagline?: PART, menu: PART }
 *       PART:  { box: [x, y, w, h], align: start | center | end }     boxes in percent of the screen
 *     "motion": [{ part, enter, at }] }  the entrance, beat by beat: at in ms from the screen's first frame
 *
 * Every card is read when this module loads and checked here; a card that loads is a start screen that lays out.
 *
 *   FRONT_CARDS · FRONT_CARD_IDS     id → the card as written (frozen)
 *   SUBJECT_ROLES · SUBJECT_VIEWS · SUBJECT_CROPS · SUBJECT_FACINGS · TITLE_SIZES · ENTRANCES · PARTS
 *   frontCard(id)                    → the card, or null
 *   fallbackCard()                   → the card a game no card suits is offered, or null
 *
 * Reads the cards beside it (a data reader: scripts/test-changed.mjs DATA_READERS). Pure otherwise.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../../../module-dir.js';

const DIR = moduleDir(import.meta.url, 'lib/graph/playscape/ui/front-cards');

// what a subject is to the game: its hero (the one the player is), an ally (the cast beside it), a foe (one it meets,
// its boss first), a ride (its vehicle), a prop (a thing it carries: a weapon, a tool, a piece)
export const SUBJECT_ROLES = Object.freeze(['hero', 'ally', 'foe', 'ride', 'prop']);
// where the subject is seen from (a yaw off its own front at capture), and how much of it the frame keeps
export const SUBJECT_VIEWS = Object.freeze({ front: 0, 'three-quarter': 35, profile: 90, 'back-three-quarter': 145 });
export const SUBJECT_CROPS = Object.freeze(['full', 'knees', 'waist', 'bust']);
export const SUBJECT_ANCHORS = Object.freeze(['bottom', 'center']);
// which way the subject turns on the screen: left (the default: a view's yaw shows its front turned to the left) or
// right, the same view taken from its other side
export const SUBJECT_FACINGS = Object.freeze(['left', 'right']);
export const TITLE_SIZES = Object.freeze(['large', 'huge']);
export const ALIGNS = Object.freeze(['start', 'center', 'end']);
// the theme's stage shapes, its ground alone, or the screen cut on a hard diagonal (each subject's side its own colour)
export const GROUNDS = Object.freeze(['theme', 'plain', 'split']);
export const PARTS = Object.freeze(['ground', 'subject', 'title', 'tagline', 'menu']);
// how a part enters: `letters` the name letter by letter, `stagger` the menu row by row; the rest whole
export const ENTRANCES = Object.freeze(['fade', 'rise', 'slide', 'slam', 'wipe', 'letters', 'stagger']);
const FRAMES = ['wide', 'tall'];
const KEYS = ['id', 'name', 'about', 'author', 'suits', 'fallback', 'slots', 'ground', 'frames', 'motion'];
const ID = /^[a-z][a-z0-9-]{1,40}$/;
const GENRE = /^[a-z][a-z0-9-]{1,40}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isBox = (b) => Array.isArray(b) && b.length === 4 && b.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) && b[0] + b[2] <= 100 && b[1] + b[3] <= 100 && b[2] > 0 && b[3] > 0;

function readPart(p, where, extra = []) {
  if (!isObj(p)) throw new Error(`${where} is { box: [x, y, w, h], align${extra.map((k) => `, ${k}`).join('')} }`);
  for (const k of Object.keys(p)) if (!['box', 'align', ...extra].includes(k)) throw new Error(`${where}.${k}: not part of a part (box, align${extra.map((k) => `, ${k}`).join('')})`);
  if (!isBox(p.box)) throw new Error(`${where}.box is [x, y, w, h] in percent of the screen, inside it`);
  if (!ALIGNS.includes(p.align)) throw new Error(`${where}.align is one of: ${ALIGNS.join(', ')}`);
}

export function readFrontCard(card, file = `${card?.id}.json`) {
  const where = `front-cards/${file}`;
  if (!isObj(card)) throw new Error(`${where} is a card { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(card)) if (!KEYS.includes(k)) throw new Error(`${where}: ${k} is not part of a front card (${KEYS.join(', ')})`);
  if (card.id !== file.replace(/\.json$/, '') || !ID.test(card.id)) throw new Error(`${where}: id is the file's name (lower case, digits, hyphens)`);
  for (const k of ['name', 'about']) if (!isStr(card[k])) throw new Error(`${where}: ${k} is words`);
  if (card.author !== undefined && !isStr(card.author)) throw new Error(`${where}: author is words`);
  if (!Array.isArray(card.suits) || !card.suits.every((g) => GENRE.test(g)) || new Set(card.suits).size !== card.suits.length) throw new Error(`${where}: suits is a list of genres (gameworld/rails.js), each once`);
  if (card.fallback !== undefined && card.fallback !== true) throw new Error(`${where}: fallback is true, or left out`);
  if (!Array.isArray(card.slots) || !card.slots.length || card.slots.length > 4) throw new Error(`${where}: slots is a list of one to four subjects`);
  card.slots.forEach((s, i) => {
    const at = `${where}: slots[${i}]`;
    if (!isObj(s)) throw new Error(`${at} is { roles, view, crop, anchor, facing? }`);
    for (const k of Object.keys(s)) if (!['roles', 'view', 'crop', 'anchor', 'facing'].includes(k)) throw new Error(`${at}.${k}: not part of a slot (roles, view, crop, anchor, facing)`);
    if (!Array.isArray(s.roles) || !s.roles.length || !s.roles.every((r) => SUBJECT_ROLES.includes(r))) throw new Error(`${at}.roles is a list of: ${SUBJECT_ROLES.join(', ')}`);
    if (!(s.view in SUBJECT_VIEWS)) throw new Error(`${at}.view is one of: ${Object.keys(SUBJECT_VIEWS).join(', ')}`);
    if (!SUBJECT_CROPS.includes(s.crop)) throw new Error(`${at}.crop is one of: ${SUBJECT_CROPS.join(', ')}`);
    if (!SUBJECT_ANCHORS.includes(s.anchor)) throw new Error(`${at}.anchor is one of: ${SUBJECT_ANCHORS.join(', ')}`);
    if (s.facing !== undefined && !SUBJECT_FACINGS.includes(s.facing)) throw new Error(`${at}.facing is one of: ${SUBJECT_FACINGS.join(', ')}`);
  });
  if (!GROUNDS.includes(card.ground)) throw new Error(`${where}: ground is one of: ${GROUNDS.join(', ')}`);
  if (!isObj(card.frames) || FRAMES.some((f) => !card.frames[f]) || Object.keys(card.frames).some((f) => !FRAMES.includes(f))) throw new Error(`${where}: frames is { wide, tall }: the layout on a landscape screen and on a phone held upright`);
  for (const f of FRAMES) {
    const F = card.frames[f], at = `${where}: frames.${f}`;
    if (!isObj(F)) throw new Error(`${at} is { subjects, title, tagline?, menu }`);
    for (const k of Object.keys(F)) if (!['subjects', 'title', 'tagline', 'menu'].includes(k)) throw new Error(`${at}.${k}: not part of a frame (subjects, title, tagline, menu)`);
    if (!Array.isArray(F.subjects) || F.subjects.length !== card.slots.length) throw new Error(`${at}.subjects is a box [x, y, w, h] for each of the ${card.slots.length} slots`);
    F.subjects.forEach((b, i) => { if (!isBox(b)) throw new Error(`${at}.subjects[${i}] is [x, y, w, h] in percent of the screen, inside it`); });
    readPart(F.title, `${at}.title`, ['size', 'behind']);
    if (!TITLE_SIZES.includes(F.title.size)) throw new Error(`${at}.title.size is one of: ${TITLE_SIZES.join(', ')}`);
    if (F.title.behind !== undefined && typeof F.title.behind !== 'boolean') throw new Error(`${at}.title.behind is true (the name set behind the subjects) or false`);
    if (F.tagline !== undefined) readPart(F.tagline, `${at}.tagline`);
    readPart(F.menu, `${at}.menu`);
  }
  if (!Array.isArray(card.motion) || !card.motion.length) throw new Error(`${where}: motion is a list of beats [{ part, enter, at }]`);
  const seen = new Set();
  card.motion.forEach((m, i) => {
    const at = `${where}: motion[${i}]`;
    if (!isObj(m) || Object.keys(m).some((k) => !['part', 'enter', 'at'].includes(k))) throw new Error(`${at} is { part, enter, at }`);
    if (!PARTS.includes(m.part)) throw new Error(`${at}.part is one of: ${PARTS.join(', ')}`);
    if (seen.has(m.part)) throw new Error(`${at}: ${m.part} enters once`);
    seen.add(m.part);
    if (!ENTRANCES.includes(m.enter)) throw new Error(`${at}.enter is one of: ${ENTRANCES.join(', ')}`);
    if (m.enter === 'letters' && m.part !== 'title') throw new Error(`${at}: only the title enters letter by letter`);
    if (m.enter === 'stagger' && m.part !== 'menu') throw new Error(`${at}: only the menu enters row by row`);
    if (!Number.isInteger(m.at) || m.at < 0 || m.at > 3000) throw new Error(`${at}.at is whole milliseconds from the first frame, 0 to 3000`);
  });
  for (const p of ['title', 'menu']) if (!seen.has(p)) throw new Error(`${where}: motion gives the ${p} its entrance`);
  return card;
}

const deepFreeze = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; };

export const FRONT_CARDS = Object.freeze(Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
  .map((f) => { const c = readFrontCard(JSON.parse(readFileSync(path.join(DIR, f), 'utf8')), f); return [c.id, deepFreeze(c)]; })));
export const FRONT_CARD_IDS = Object.freeze(Object.keys(FRONT_CARDS));
{
  const fallbacks = FRONT_CARD_IDS.filter((id) => FRONT_CARDS[id].fallback);
  if (fallbacks.length > 1) throw new Error(`front-cards: one card at most is the fallback (${fallbacks.join(', ')} say they are)`);
}

export const frontCard = (id) => FRONT_CARDS[id] ?? null;
export const fallbackCard = () => FRONT_CARDS[FRONT_CARD_IDS.find((id) => FRONT_CARDS[id].fallback)] ?? null;
