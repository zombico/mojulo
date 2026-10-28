/**
 * THE CHARACTER BOOK — the game book's second concern, beside the world's ground: who walks it. The world held the
 * slot open (`characters`); this reads it. Its first page is the HERO, in two halves:
 *
 *   LOOKS     visual only, no stats: each element designed on its own page (body, head, hair, colour), then composed
 *             top down through the hero door into a base version that wears only an underlayer fitted to the world
 *   ACTIONS   what the hero can do outside platforming: the power system, the main power set, its escalation from
 *             early to mid, or an idiom read as "<convention>-like". What the hero can do decides the world's systems
 *
 * Above the hero stands the DIRECTION every page reads: the TRADITION (anime or western, chosen explicitly, never
 * defaulted), where the direction comes FROM (the world's kit, pole and building ornament, or the creator's own), the
 * MOTIF, and the leading and supporting design elements. A crossing out of the tradition is a named BRIDGE; it and
 * every departure from the world are kept in a LEDGER, as a level's overrides of its world are.
 *
 *   characters: {
 *     direction: {
 *       tradition: 'anime' | 'western',
 *       from?: 'world' | 'custom',               // world (the default): inherit the kit's ramps, pole and ornament
 *       motif?: [words] | { words, on? },         // repeated shape language
 *       primary?, secondary?,                    // the design's leading and supporting elements, in words
 *       palette?: [hex],                         // the character palette; the kit's ramps when from the world
 *       bridge?: { head?, proportions?, toon? }, // explicit crossings out of the tradition
 *       shading?: 'painted' | 'cel' | 'graphic' | 'chiaroscuro' | 'none',  // how the skin's shade is painted in the
 *                                              // world's palette (color-theorist/adapters.js skinDirection; painted
 *                                              // when the world has a palette and this is absent)
 *     },
 *     hero?: {
 *       ref?,                                    // a hero made on its own (create_character), adopted: the run makes
 *                                              // none and pins this one; its own looks and motion play
 *       looks?: { body?, head?, hair?, colour?, underlayer?, base? },
 *       motion?,                                 // the feel (hero-vibe.js): vibe words, axes, custom clips
 *       actions?,                                // what it can do (actions.js)
 *       adornment?,                              // the equipment the main loop calls for (adornment.js)
 *     },
 *     cast?: { <id>: { name?, looks?, motion? } }, // the other people: each a looks and a motion page, as the hero's,
 *                                              // styled by the same direction (no actions, adornment or gear: those
 *                                              // are the player's); placed in levels by the story (story.js)
 *     casting?: { scale?, n?, anchor?, cast?, factions?, bodies?, seed? },   // the people ROLLED as one cast for the
 *                                              // game, as many as it asks for (casting.js); reviewed as characters:cast
 *     folk?: true | { seed?, cap?, pool?, domicile?, domiciles?, say? },   // the TOWNS' people, grown from each town
 *                                              // a level lays (folk/folk.js), stood by their houses (folk-cast.js)
 *   }
 *
 * Pure. `readCharacters` reads the shape alone (the world reader calls it, so it never reads the world back);
 * `resolveDirection(G)` hands the world's direction down onto a read world.
 */
import { kitCard, languageCard, hasKitCard, hasLanguageCard } from './style-guide.js';
import { poleOf } from '../era/style/pole.js';
import { readActions } from './actions.js';
import { readMotion } from './hero-vibe.js';
import { readAdornment } from './adornment.js';
import { readCastRequest, castOfScale, SCALES } from '../egocube/cast.js';
import { readFolk } from '../folk/folk.js';
import { SKIN_SHADINGS } from '../color-theorist/adapters.js';

/** Western and anime: the two traditions every character and world is tuned to; a hero is drawn in one of them. */
export const TRADITIONS = Object.freeze({
  anime: { read: 'the anime tradition: the anime head, its proportions (about 6.5–7 heads) and the character light', head: 'anime', proportions: 'anime', toon: true, pole: 'banded' },
  western: { read: 'the western tradition: the landmark head, heroic proportions and no character light', head: 'landmark', proportions: 'hero', toon: false, pole: 'material' },
});
/** What a tradition decides of the hero, and what a bridge may cross. */
export const BRIDGE = Object.freeze({
  head: ['landmark', 'anime'],
  proportions: ['hero', 'anime', 'herobot'],
  toon: [true, false],
});
export const FROM = Object.freeze({
  world: 'the world\'s direction: its kit\'s ramps, its pole and its building ornament',
  custom: 'the creator\'s own direction, standing alone',
});
const DIRECTION_KEYS = ['tradition', 'from', 'motif', 'primary', 'secondary', 'palette', 'bridge', 'shading'];

/** The hero's looks: each element its own page, each the hero-door fields it decides. */
export const LOOKS_ELEMENTS = Object.freeze({
  body: { read: 'the silhouette: its cast, build and register', fields: ['cast', 'register', 'tune', 'body', 'girth', 'headScale', 'scale', 'core'] },
  head: { read: 'the head and face', fields: ['headPreset', 'face', 'sculpt', 'expression', 'look', 'genki'] },
  hair: { read: 'the hair', fields: ['hair'] },
  colour: { read: 'the colour: the hero\'s palette', fields: ['palette'] },
});
const LOOKS_KEYS = [...Object.keys(LOOKS_ELEMENTS), 'underlayer', 'base'];
/** Hero-door fields the looks never set, and why. */
const NOT_LOOKS = Object.freeze({
  head: 'the head is the tradition\'s; cross it with direction.bridge.head',
  proportions: 'the proportions are the tradition\'s; cross them with direction.bridge.proportions',
  detail: 'the base wears its underlayer (looks.underlayer); dress is adornment, a later page',
  outfit: 'the base wears its underlayer (looks.underlayer); an outfit is adornment, a later page',
  adorn: 'adornment is a later page, over the base',
  paint: 'adornment is a later page, over the base',
  gear: 'equipment is a later page, shaped to the main loop',
  gesture: 'the stand is motion\'s (hero.motion)',
  clips: 'clips are motion\'s (hero.motion)',
  motion: 'motion is its own half of the page (hero.motion)',
  blink: 'the blink is motion\'s (hero.motion)',
  statue: 'a statue is not a character',
});
/** The parts the character book is reviewed in, in order (character-review.js): the direction, the four looks pages,
 * the pinned base, the motion, the actions, the adornment, the world's equipment table it seeds (equipment.js), and
 * the systems numbered from the actions (mechanics.js): their stats and their HUD.
 * They share the world's `review` field with the world's own parts. */
export const CHARACTER_PART_IDS = Object.freeze(['characters:direction', ...Object.keys(LOOKS_ELEMENTS).map((k) => `hero:${k}`), 'hero:base', 'hero:motion', 'hero:actions', 'hero:adornment', 'equipment', 'mechanics:stats', 'mechanics:hud']);
const HERO_KEYS = ['ref', 'name', 'looks', 'motion', 'actions', 'adornment'];
const KEYS = ['direction', 'hero', 'cast', 'casting', 'folk'];
/** The casting page's part: present only in a book that has one (casting.js). */
export const CAST_PART = 'characters:cast';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const word = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 60;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const err = (m) => new Error(`characters: ${m}`);

function readMotif(v, at) {
  const o = Array.isArray(v) || typeof v === 'string' ? { words: [v].flat() } : isObj(v) ? { ...v } : null;
  if (!o) throw err(`${at} is words, or { words, on? }`);
  for (const k of Object.keys(o)) if (!['words', 'on'].includes(k)) throw err(`${at}.${k} is not a motif setting (words, on)`);
  const words = [o.words].flat();
  if (!words.length || !words.every(word)) throw err(`${at}.words is a word or a list of words (the motif's shape language: "chevron", "crescent", "rope knot")`);
  const on = o.on === undefined ? undefined : [o.on].flat();
  if (on && !on.every(word)) throw err(`${at}.on is where the motif repeats, in words ("hem", "collar", "hair locks")`);
  return { words: words.map((w) => w.trim()), ...(on ? { on: on.map((w) => w.trim()) } : {}) };
}

const CHOOSE = () => `tradition is chosen explicitly: ${Object.entries(TRADITIONS).map(([k, t]) => `'${k}' (${t.read})`).join(', or ')}. A crossing out of it is a named direction.bridge`;

function readDirection(d) {
  if (!isObj(d)) throw err(`direction is { ${DIRECTION_KEYS.join(', ')} }, and its ${CHOOSE()}`);
  for (const k of Object.keys(d)) if (!DIRECTION_KEYS.includes(k)) throw err(`direction.${k} is not part of the direction (${DIRECTION_KEYS.join(', ')})`);
  if (!TRADITIONS[d.tradition]) throw err(`direction.${CHOOSE()}`);
  const from = d.from ?? 'world';
  if (!FROM[from]) throw err(`direction.from '${from}' is ${Object.keys(FROM).map((k) => `'${k}'`).join(' or ')}`);
  const out = { tradition: d.tradition, from };
  if (d.motif !== undefined) out.motif = readMotif(d.motif, 'direction.motif');
  for (const k of ['primary', 'secondary']) if (d[k] !== undefined) {
    if (!word(d[k])) throw err(`direction.${k} is the design's ${k === 'primary' ? 'leading' : 'supporting'} element, in words (a shape, a material, an element: "flame", "brass", "wind")`);
    out[k] = d[k].trim();
  }
  if (d.palette !== undefined) {
    if (!Array.isArray(d.palette) || !d.palette.length || !d.palette.every(isHex)) throw err('direction.palette is a list of colours (#rrggbb), the character palette');
    out.palette = d.palette.map((h) => h.toLowerCase());
  }
  if (d.shading !== undefined) {
    if (!SKIN_SHADINGS.hasOwnProperty(d.shading)) throw err(`direction.shading is how the skin's shade is painted in the world's palette: ${Object.keys(SKIN_SHADINGS).map((k) => `'${k}'`).join(', ')}`);
    out.shading = d.shading;
  }
  if (d.bridge !== undefined) {
    if (!isObj(d.bridge)) throw err(`direction.bridge is { ${Object.keys(BRIDGE).join(', ')} }`);
    out.bridge = {};
    for (const [k, v] of Object.entries(d.bridge)) {
      if (!BRIDGE[k]) throw err(`direction.bridge.${k} is not something a tradition decides (${Object.keys(BRIDGE).join(', ')})`);
      if (!BRIDGE[k].includes(v)) throw err(`direction.bridge.${k} is ${BRIDGE[k].map((x) => JSON.stringify(x)).join(' | ')}`);
      if (TRADITIONS[d.tradition][k] === v) throw err(`direction.bridge.${k}: ${JSON.stringify(v)} is the ${d.tradition} tradition's own; a bridge crosses out of it (leave it out)`);
      out.bridge[k] = v;
    }
  }
  return out;
}

function readLooks(L) {
  if (!isObj(L)) throw err(`hero.looks is { ${LOOKS_KEYS.join(', ')} }`);
  const out = {};
  for (const [k, v] of Object.entries(L)) {
    const at = `hero.looks.${k}`;
    if (!LOOKS_KEYS.includes(k)) throw err(`${at}${NOT_LOOKS[k] ? `: ${NOT_LOOKS[k]}` : ` is not a looks page (${LOOKS_KEYS.join(', ')})`}`);
    if (k === 'underlayer') {
      if (v !== null && !isObj(v)) throw err(`${at} is an outfit build { type: 'outfit', style?, dials?, language? }, or null for the one the world's setting chooses`);
      out.underlayer = v;
    } else if (k === 'base') {
      if (!isObj(v) || typeof v.ref !== 'string' || !Number.isInteger(v.rev) || v.rev < 1 || !/^[0-9a-f]{8}$/.test(v.print ?? '')) throw err(`${at} is the pinned base version { ref, rev, print }`);
      for (const x of Object.keys(v)) if (!['ref', 'rev', 'print'].includes(x)) throw err(`${at}.${x} is not part of the base (ref, rev, print)`);
      out.base = { ref: v.ref, rev: v.rev, print: v.print };
    } else {
      const E = LOOKS_ELEMENTS[k];
      // the hair page may be the hair itself (a style word, or its settings), as the hero door takes it
      const o = k === 'hair' && !(isObj(v) && Object.keys(v).length === 1 && 'hair' in v) ? { hair: v } : v;
      if (!isObj(o)) throw err(`${at} is { ${E.fields.join(', ')} }: ${E.read}`);
      for (const f of Object.keys(o)) {
        if (NOT_LOOKS[f]) throw err(`${at}.${f}: ${NOT_LOOKS[f]}`);
        if (!E.fields.includes(f)) {
          const home = Object.keys(LOOKS_ELEMENTS).find((e) => LOOKS_ELEMENTS[e].fields.includes(f));
          throw err(`${at}.${f} is not the ${k} page's (${E.fields.join(', ')})${home ? `; ${f} is the ${home} page's` : ''}`);
        }
      }
      out[k] = { ...o };
    }
  }
  return out;
}

const CAST_ID = /^[a-z][a-z0-9-]{0,23}$/;
const CAST_KEYS = ['name', 'looks', 'motion', 'joins'];
/** The cast: the other people, each { name?, looks?, motion? }. Their looks take the hero's pages but no pinned base. */
function readCast(c) {
  if (!isObj(c)) throw err('cast is { <id>: { name?, looks?, motion?, joins? } }: the other people, by a short id (mayor, guard)');
  const out = {};
  for (const [id, m] of Object.entries(c)) {
    const at = `cast.${id}`;
    if (!CAST_ID.test(id)) throw err(`${at}: a cast id is a short lower-case name (mayor, old-guard)`);
    if (id === 'hero') throw err(`${at}: the hero is the hero's page; the cast are the others`);
    if (!isObj(m)) throw err(`${at} is { ${CAST_KEYS.join(', ')} }`);
    for (const k of Object.keys(m)) if (!CAST_KEYS.includes(k)) throw err(`${at}.${k} is not part of a cast member (${CAST_KEYS.join(', ')})${['actions', 'adornment'].includes(k) ? '; that is the player\'s, on the hero' : ''}`);
    if (m.name !== undefined && !(typeof m.name === 'string' && m.name.trim() && m.name.length <= 40)) throw err(`${at}.name is the name the box shows (Mayor Ilse)`);
    if (isObj(m.looks) && m.looks.base !== undefined) throw err(`${at}.looks.base: a cast member has no pinned base (the hero's alone)`);
    // joins: the flag that makes them a companion (playscape/ui/party.js): from then on they follow the hero
    if (m.joins !== undefined && !(typeof m.joins === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(m.joins))) throw err(`${at}.joins is the flag that makes them join the hero (a lowercase name: joined-${id})`);
    const looks = m.looks === undefined ? undefined : readLooks(m.looks);
    out[id] = { ...(m.name !== undefined ? { name: m.name.trim() } : {}), ...(looks ? { looks } : {}), ...(m.motion !== undefined ? { motion: readMotion(m.motion) } : {}), ...(m.joins ? { joins: m.joins } : {}) };
  }
  return out;
}

const CASTING_KEYS = ['scale', 'n', 'anchor', 'cast', 'factions', 'bodies', 'seed'];
/** The casting page (casting.js): its words, read through the cast roller's, a name and a joins flag the book's own. */
function readCasting(c, written) {
  if (!isObj(c)) throw err(`casting is { ${CASTING_KEYS.join(', ')} }: the people rolled for the game (scale: ${Object.keys(SCALES).join(' | ')})`);
  for (const k of Object.keys(c)) if (!CASTING_KEYS.includes(k)) throw err(`casting.${k} is not part of the casting page (${CASTING_KEYS.join(', ')})`);
  if (c.scale !== undefined && !SCALES[c.scale]) throw err(`casting.scale is ${Object.keys(SCALES).join(', ')}: how complete a game, and the cast it asks for`);
  if (c.n !== undefined && !(Number.isInteger(c.n) && c.n >= 1 && c.n <= 7)) throw err('casting.n is the party besides the hero, 1 to 7');
  if (c.anchor !== undefined && !(isObj(c.anchor) && Object.keys(c.anchor).every((k) => ['brief', 'facets', 'faction'].includes(k)))) throw err('casting.anchor is the hero as a sheet: { brief?, facets?, faction? }');
  if (c.cast !== undefined && !isObj(c.cast)) throw err('casting.cast is { <key>: { relation, … } }: relations over the scale\'s');
  const cast = {};
  for (const [key, m] of Object.entries(c.cast ?? {})) {
    if (isObj(m) && m.name !== undefined && !(typeof m.name === 'string' && m.name.trim() && m.name.length <= 40)) throw err(`casting.cast.${key}.name is the name the box shows`);
    if (isObj(m) && m.joins !== undefined && !(typeof m.joins === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(m.joins))) throw err(`casting.cast.${key}.joins is the flag that brings them to the hero on the field`);
    cast[key] = isObj(m) ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'name' && k !== 'joins')) : m;
  }
  const own = { ...castOfScale(c.scale ?? 'hero', { n: c.n ?? 3 }), ...cast };
  try { readCastRequest({ anchor: c.anchor, cast: own, factions: c.factions, bodies: c.bodies, seed: c.seed }); }
  catch (e) { throw err(`casting: ${e.message.replace(/^cast: /, '')}`); }
  for (const key of Object.keys(own)) {
    const ids = own[key].n ? Array.from({ length: own[key].n }, (_, i) => `${key}-${i + 1}`) : [key];
    for (const id of ids.map((x) => x.replace(/\//g, '-'))) if (written?.[id]) throw err(`casting: '${id}' is a written cast member's id too; give the rolled one another key`);
  }
  return c;
}

/** Read a world's characters and say what is wrong. → { direction, hero?, cast?, casting? }. */
export function readCharacters(C) {
  if (!isObj(C)) throw err(`characters is { ${KEYS.join(', ')} }: the direction first, then the hero`);
  for (const k of Object.keys(C)) if (!KEYS.includes(k)) throw err(`'${k}' is not part of the character book (${KEYS.join(', ')})`);
  const out = { direction: readDirection(C.direction) };
  if (C.cast !== undefined && C.cast !== null) out.cast = readCast(C.cast);
  if (C.casting !== undefined) out.casting = readCasting(C.casting, out.cast);
  // the towns' people (folk/folk.js): true, or their words; each town a level lays grows its own (folk-cast.js)
  if (C.folk !== undefined && C.folk !== false) out.folk = readFolk(C.folk);
  if (C.hero !== undefined) {
    if (!isObj(C.hero)) throw err(`hero is { ${HERO_KEYS.join(', ')} }`);
    for (const k of Object.keys(C.hero)) {
      if (!HERO_KEYS.includes(k)) throw err(`hero.${k} is not part of the hero's page (${HERO_KEYS.join(', ')})${NOT_LOOKS[k] ? `; ${NOT_LOOKS[k]}` : LOOKS_ELEMENTS[k] ? `; ${k} is a looks page (hero.looks.${k})` : ''}`);
      if (k !== 'looks' && k !== 'ref' && k !== 'name' && C.hero[k] !== undefined && !isObj(C.hero[k])) throw err(`hero.${k} is an object`);
    }
    if (C.hero.ref !== undefined && !(typeof C.hero.ref === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(C.hero.ref))) throw err('hero.ref is the sketch ref of a hero made with create_character (the run adopts it and makes none)');
    out.hero = {};
    if (C.hero.ref !== undefined) out.hero.ref = C.hero.ref;
    // a named hero (create_character spec.name): design_game finds its ref by name and writes both, so the run pins the row
    if (C.hero.name !== undefined) {
      if (typeof C.hero.name !== 'string' || !C.hero.name.trim()) throw err('hero.name is the name of a hero made with create_character (spec.name): the run adopts it by name');
      if (C.hero.ref === undefined) throw err(`hero.name '${C.hero.name}' is found by design_game, which writes its ref beside it; a world read without it names hero.ref`);
      out.hero.name = C.hero.name;
    }
    if (C.hero.looks !== undefined) out.hero.looks = readLooks(C.hero.looks);
    if (C.hero.motion !== undefined) out.hero.motion = readMotion(C.hero.motion);
    if (C.hero.actions !== undefined) out.hero.actions = readActions(C.hero.actions);
    if (C.hero.adornment !== undefined) out.hero.adornment = readAdornment(C.hero.adornment);
  }
  return out;
}

/**
 * The direction as the world hands it down, onto a read world (readGameworld's): `{ tradition, from, hero, kit,
 * pole, ramps, motif, primary, secondary, palette, ledger }`. `hero` is what the tradition decides of the hero
 * (head, proportions, toon), bridges applied; `ledger` every departure: a bridge from its tradition, a tradition
 * against its world's pole, an own motif or palette over the world's. Null when the world has no characters.
 */
export function resolveDirection(G) {
  if (!G.characters) return null;
  const D = G.characters.direction, T = TRADITIONS[D.tradition], ledger = [];
  const at = 'direction';
  const hero = { head: T.head, proportions: T.proportions, toon: T.toon, ...(D.bridge || {}) };
  for (const [k, v] of Object.entries(D.bridge || {})) ledger.push({ scope: 'tradition', at, key: k, world: T[k], local: v });
  const out = { tradition: D.tradition, from: D.from, hero };
  if (D.from === 'world') {
    const kit = G.style.kit, pole = poleOf(kit);
    const anchor = G.civilizations[G.style.civilization]?.anchor;
    // a room kit (a nave, a plaza, a lab) has no outdoor style card, so no ramps; a trail kit builds nothing, so no ornament
    const card = hasKitCard(kit) ? kitCard(kit) : { ramps: [] }, ornament = hasLanguageCard(kit) ? languageCard(kit, anchor, G.seed).vocab.ornaments : [];
    const worldTradition = Object.keys(TRADITIONS).find((t) => TRADITIONS[t].pole === pole);
    if (worldTradition !== D.tradition) ledger.push({ scope: 'world', at, key: 'tradition', world: worldTradition, local: D.tradition });
    Object.assign(out, { kit, pole, ramps: card.ramps });
    const worldMotif = ornament.length ? { words: [...ornament], on: [] } : null;
    if (D.motif) {
      if (worldMotif && !same(worldMotif.words, D.motif.words)) ledger.push({ scope: 'world', at, key: 'motif', world: worldMotif.words, local: D.motif.words });
      out.motif = D.motif;
    } else if (worldMotif) out.motif = { words: worldMotif.words };
    if (D.palette) { ledger.push({ scope: 'world', at, key: 'palette', world: card.ramps.map((r) => r.name), local: D.palette }); out.palette = D.palette; }
  } else {
    if (D.motif) out.motif = D.motif;
    if (D.palette) out.palette = D.palette;
  }
  for (const k of ['primary', 'secondary']) if (D[k]) out[k] = D[k];
  out.ledger = ledger;
  return out;
}
