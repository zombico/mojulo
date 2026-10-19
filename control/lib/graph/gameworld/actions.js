/**
 * THE HERO'S ACTIONS — the second half of the hero's page: what the hero CAN do beyond platforming. Can is not the
 * beginning: the page lays out the main power set in broad strokes, the early-to-mid progression clearly, and the
 * late game only as far as the creator cares to. What the hero can do decides the world's core systems, so this page
 * seeds `mechanics` (a later page), as data only: nothing here is numbered.
 *
 *   actions: {
 *     idiom?: '<convention>-like',             // read through IDIOMS into a system and a progression template
 *     system?: { kind, resource?, source?, rule? },   // what powers run on and where they come from
 *     powers?: [ { id, verb, element?, look?, attack?, move? } ],
 *     progression?: [ { stage: 'early' | 'mid' | 'late', gains: [power ids], gate?: '<what unlocks it>' } ],
 *   }
 *
 * An idiom is a design convention a genre is known by, never a title: "-like" names a pattern, and mojulo extracts
 * no assets from any game. A word the lexicon does not know is not an error; it goes to `open`, for the creator.
 * Powers name a `look` (playscape/elements LOOKS) or an `attack` (playscape/elements beams); a power with neither is
 * held as words and listed open. A power's `move` (TRAVERSAL_MOVES) is what it lets the hero do on the ground it opens: in
 * a map world, a power that keys a door gives the hero that move when it is picked up. Without an idiom the system, a power list and early and mid stages are all the
 * creator's to state.
 *
 * Pure. `readActions(A)` reads the shape and says what is wrong; `resolveActions(A, direction)` expands the idiom,
 * checks the references and returns the page with its `open` list and its `mechanicsSeed`.
 */
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';

/** What powers run on. */
export const SYSTEM_KINDS = Object.freeze({
  resource: 'powers spend a resource that refills (ki, mana, energy)',
  stamina: 'every action, powers included, spends one stamina pool; the moveset is learned',
  unlock: 'a power is a key: traversal and gates open as powers are found',
  transform: 'the hero changes form; each form is a tier with its own set',
  equip: 'powers come from what the hero carries',
});
export const STAGES = Object.freeze(['early', 'mid', 'late']);

/** The moves a power can give the hero: each a change to the platform rule, made from the level's own rule. */
export const TRAVERSAL_MOVES = Object.freeze({
  'double-jump': { read: 'a second jump in the air', rule: () => ({ airJumps: 1 }) },
  glide: { read: 'a held jump slows the fall', rule: () => ({ glideFall: 2.5 }) },
  'high-jump': { read: 'jumps half as high again', rule: (base) => ({ jumpSpeed: Math.round((base?.jumpSpeed ?? 8.5) * Math.sqrt(1.5) * 1000) / 1000 }) },
});

/** The moves a hero STARTS with (`actions.moves`, the city stalker's): each a patch to the platform rule, held from the
 *  first level, in every level it plays (a trail, a building, an inside), outdoors and in: the wall (any wall held and
 *  crawled, worlds/controllable/wall.js) and the swinger's line (to a face or a ceiling above, swing.js). A building
 *  level a hero with one plays lays its rooms' ceilings as colliders (a climb ends under them, a line lands on them).
 *  Moves found later are powers (`move`, TRAVERSAL_MOVES). */
export const HERO_MOVES = Object.freeze({
  wall: { read: 'any wall held and crawled, up onto its roof, jumped off', rule: Object.freeze({ wall: true }) },
  swinger: { read: 'a line to a face or a ceiling above and ahead, swung on; on the ground a zip to the wall', rule: Object.freeze({ gear: 'swinger' }) },
});

/** Genre conventions, by the word they are known by. Each: a system, and a progression template of stage → gate. */
export const IDIOMS = Object.freeze({
  'metroidvania-like': {
    read: 'traversal powers gate regions; the map is the progression',
    system: { kind: 'unlock', source: 'found in the world', rule: 'a power opens the places that were closed' },
    progression: [{ stage: 'early', gate: 'the first region, and the first key power' }, { stage: 'mid', gate: 'regions opened by earlier powers' }, { stage: 'late', gate: 'the last gate, backtracked to' }],
  },
  'soulslike': {
    read: 'one stamina pool, a learned moveset, sparse upgrades',
    system: { kind: 'stamina', resource: 'stamina', source: 'refills by rest and by timing', rule: 'every action spends it' },
    progression: [{ stage: 'early', gate: 'the basic moveset, learned by dying' }, { stage: 'mid', gate: 'a build chosen from sparse upgrades' }, { stage: 'late', gate: 'mastery, not new powers' }],
  },
  'shonen-like': {
    read: 'a ki resource, transformation tiers, charged beams',
    system: { kind: 'transform', resource: 'ki', source: 'charged, and raised by being hurt', rule: 'a form is a tier; a beam is charged and spent' },
    progression: [{ stage: 'early', gate: 'the base form and a first charged beam' }, { stage: 'mid', gate: 'the first transformation tier' }, { stage: 'late', gate: 'the form above' }],
  },
  'action-adventure-like': {
    read: 'one tool per region, dungeon gates',
    system: { kind: 'equip', source: 'a dungeon\'s prize', rule: 'each tool solves its region and opens the next' },
    progression: [{ stage: 'early', gate: 'the first tool, from the first dungeon' }, { stage: 'mid', gate: 'tools that combine' }, { stage: 'late', gate: 'the last dungeon' }],
  },
});

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const word = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;
const err = (m) => new Error(`characters: hero.actions${m}`);

function readSystem(s, at) {
  if (!isObj(s)) throw err(`${at} is { kind, resource?, source?, rule? }`);
  for (const k of Object.keys(s)) if (!['kind', 'resource', 'source', 'rule'].includes(k)) throw err(`${at}.${k} is not part of the system (kind, resource, source, rule)`);
  if (!SYSTEM_KINDS[s.kind]) throw err(`${at}.kind is ${Object.keys(SYSTEM_KINDS).map((k) => `'${k}'`).join(', ')}`);
  const out = { kind: s.kind };
  for (const k of ['resource', 'source', 'rule']) if (s[k] !== undefined) {
    if (!word(s[k])) throw err(`${at}.${k} is words`);
    out[k] = s[k].trim();
  }
  return out;
}

/** Read the actions page and say what is wrong. Shape only; references are checked by resolveActions. */
export function readActions(A) {
  if (!isObj(A)) throw err(' is { idiom?, system?, powers?, progression?, moves? }');
  for (const k of Object.keys(A)) if (!['idiom', 'system', 'powers', 'progression', 'moves'].includes(k)) throw err(`.${k} is not part of the actions page (idiom, system, powers, progression, moves)`);
  const out = {};
  if (A.moves !== undefined) {
    if (!Array.isArray(A.moves) || !A.moves.every((m) => HERO_MOVES[m]) || new Set(A.moves).size !== A.moves.length) throw err(`.moves is a list of the moves the hero starts with, each once: ${Object.keys(HERO_MOVES).map((m) => `'${m}'`).join(', ')}`);
    out.moves = [...A.moves];
  }
  if (A.idiom !== undefined) {
    if (!word(A.idiom) || !/like$/.test(A.idiom.trim().toLowerCase())) throw err(`.idiom is a convention read as "x-like" (${Object.keys(IDIOMS).join(', ')}); a pattern, never a title`);
    out.idiom = A.idiom.trim().toLowerCase();
  }
  if (A.system !== undefined) out.system = readSystem(A.system, '.system');
  if (A.powers !== undefined) {
    if (!Array.isArray(A.powers)) throw err('.powers is a list of { id, verb, element?, look?, attack?, move? }');
    const seen = new Set();
    out.powers = A.powers.map((p, i) => {
      const at = `.powers[${i}]`;
      if (!isObj(p)) throw err(`${at} is { id, verb, element?, look?, attack?, move? }`);
      for (const k of Object.keys(p)) if (!['id', 'verb', 'element', 'look', 'attack', 'move'].includes(k)) throw err(`${at}.${k} is not part of a power (id, verb, element, look, attack, move)`);
      if (p.move !== undefined && !TRAVERSAL_MOVES[p.move]) throw err(`${at}.move is one of ${Object.keys(TRAVERSAL_MOVES).map((m) => `'${m}'`).join(', ')}: what the power lets the hero do`);
      if (!ID.test(p.id ?? '')) throw err(`${at}.id is a lowercase id ("fire-lance")`);
      if (seen.has(p.id)) throw err(`${at}.id '${p.id}' appears twice`);
      seen.add(p.id);
      if (!word(p.verb)) throw err(`${at}.verb is what the power does, in words ("pull", "burn", "glide")`);
      const q = { id: p.id, verb: p.verb.trim() };
      for (const k of ['element', 'look', 'attack']) if (p[k] !== undefined) {
        if (!word(p[k])) throw err(`${at}.${k} is a word`);
        q[k] = p[k].trim();
      }
      if (p.move !== undefined) q.move = p.move;
      return q;
    });
  }
  if (A.progression !== undefined) {
    if (!Array.isArray(A.progression)) throw err('.progression is a list of { stage, gains, gate? }');
    const seen = new Set();
    out.progression = A.progression.map((s, i) => {
      const at = `.progression[${i}]`;
      if (!isObj(s)) throw err(`${at} is { stage, gains, gate? }`);
      for (const k of Object.keys(s)) if (!['stage', 'gains', 'gate'].includes(k)) throw err(`${at}.${k} is not part of a stage (stage, gains, gate)`);
      if (!STAGES.includes(s.stage)) throw err(`${at}.stage is ${STAGES.map((x) => `'${x}'`).join(' | ')}`);
      if (seen.has(s.stage)) throw err(`${at}.stage '${s.stage}' appears twice`);
      seen.add(s.stage);
      const gains = s.gains === undefined ? [] : s.gains;
      if (!Array.isArray(gains) || !gains.every((g) => typeof g === 'string')) throw err(`${at}.gains is a list of power ids`);
      if (s.gate !== undefined && !word(s.gate)) throw err(`${at}.gate is what unlocks the stage, in words`);
      return { stage: s.stage, gains: [...gains], ...(s.gate !== undefined ? { gate: s.gate.trim() } : {}) };
    });
  }
  return out;
}

/**
 * The page resolved: the idiom expanded under what the creator stated (theirs wins), references checked.
 * → { idiom?, system, powers, progression, open: [string], mechanicsSeed } — `open` is what the creator has yet to
 * decide: an idiom the lexicon does not know, a power with no look or attack, a missing system or stage.
 * Nothing here refuses; it advises. `direction` (resolveDirection's) lends a power its element when it names none.
 */
export function resolveActions(A, direction = null) {
  const a = readActions(A ?? {}), open = [];
  const idiom = a.idiom ? IDIOMS[a.idiom] : null;
  if (a.idiom && !idiom) open.push(`idiom '${a.idiom}' is not in the lexicon (${Object.keys(IDIOMS).join(', ')}): state its system and progression`);
  const system = a.system ?? (idiom ? { ...idiom.system } : null);
  if (!system) open.push('no power system: what do powers run on, and where do they come from?');
  const powers = (a.powers ?? []).map((p) => {
    const q = { ...p };
    if (!q.element && direction?.primary) q.element = direction.primary;
    if (q.look && !LOOKS[q.look]) open.push(`power '${q.id}': look '${q.look}' is not an element look (${Object.keys(LOOKS).join(', ')})`);
    if (q.attack && !BEAM_NAMES.includes(q.attack)) open.push(`power '${q.id}': attack '${q.attack}' is not a beam (${BEAM_NAMES.join(', ')})`);
    if (!(q.look && LOOKS[q.look]) && !(q.attack && BEAM_NAMES.includes(q.attack))) open.push(`power '${q.id}' is held as words: it names no look or attack`);
    return q;
  });
  if (!powers.length) open.push('no powers: the main power set, in broad strokes');
  const ids = new Set(powers.map((p) => p.id));
  const stated = new Map((a.progression ?? []).map((s) => [s.stage, s]));
  const progression = STAGES.flatMap((stage) => {
    const s = stated.get(stage), t = idiom?.progression.find((x) => x.stage === stage);
    if (!s && !t) {
      if (stage !== 'late') open.push(`progression: the ${stage} stage is not laid out`);
      return [];
    }
    const out = { stage, gains: s ? s.gains : [], ...((s?.gate ?? t?.gate) ? { gate: s?.gate ?? t.gate } : {}) };
    for (const g of out.gains) if (!ids.has(g)) open.push(`progression ${stage}: gains '${g}', which is not a power id`);
    return [out];
  });
  const gained = new Set(progression.flatMap((s) => s.gains));
  for (const p of powers) if (!gained.has(p.id) && progression.length) open.push(`power '${p.id}' is gained at no stage`);
  const mechanicsSeed = {
    verbs: powers.map((p) => ({ id: p.id, verb: p.verb, ...(p.element ? { element: p.element } : {}) })),
    ...(system ? { system } : {}),
    stages: progression.map((s) => ({ stage: s.stage, gains: s.gains, ...(s.gate ? { gate: s.gate } : {}) })),
  };
  return { ...(a.idiom ? { idiom: a.idiom } : {}), system, powers, progression, open, mechanicsSeed };
}
