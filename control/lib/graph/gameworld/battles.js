/**
 * BATTLES — the book's party battles: a concern of the world beside its characters and its systems. The hero and the
 * cast who join it (characters.cast.<id>.joins) are the party, each in a class they can switch; packs of foes stand on
 * the trails' beats, met in order across the game and tougher further on; each stage has a rest at its start; and the
 * party, its levels, classes and skills, goes from level to level in the store's party slice (the party mechanic).
 * The fights themselves are play.rpg (playscape/rpg): this lays it on every stage that has a trail.
 *
 *   battles?: {
 *     party?: { hero?: { class?, name?, level?, bonus?, classes? }, <cast id>: { … } }
 *                          each member's class (hero: fighter; those who join, in turn: mage, cleric, rogue, knight, monk;
 *                          a casting page's (casting.js): the hero and its first party each the class their sheet reads as,
 *                          the rolled party in from the start unless the page gives one a joins flag; a rolled
 *                          familiar beside its keeper, picking for itself: play.rpg `auto`)
 *     packs?: [[foe ids]], the packs met along the way, in walking order across the game's trail stages; past the last,
 *                          the last again (default PACKS)
 *     per?: n,             packs on each trail stage (2), on its beats; on a glyph map, in each region past its first
 *     boss?: [foe ids],    the last trail stage's last pack, no escape from it
 *     foe?: <hero-door spec>,   how every foe on the map looks (each its own, FOE_LOOKS, by default)
 *     looks?: { <foe id>: beast | people | person },   each foe's own look in a character door's words (FOE_LOOKS):
 *                          { species, ooze?, stylism? } a beast; { people, facets?, dress? } a people (a lineage, the
 *                          beast-kin, the undead: skeleton, zombie, ragged, rotting…); a person through the hero door
 *     rest?: false,        no rest at each stage's start (default: E there restores HP and MP; where an inn stands, it is
 *                          the rest)
 *     shops?: false | { wares?, inn? },   a merchant and an innkeeper beside each fighting stage's start (default on):
 *                          the merchant's wares by how far on (SHOP_WARES) or the book's own, bought back at half; a
 *                          night at the inn for INN_PRICE gold, more further on, or the book's price (inn: false, none)
 *     random?: { every?, chance?, after? },   random encounters on the trails, drawn from that stage's packs
 *     classes?, skills?, foes?, items?, gear?, juice?, rules?,   play.rpg's own (playscape/rpg/rpg.js), over the presets
 *   The party and the bag (its items, the gear not worn, and its gold: held:bag:gold) are carried level to level.
 *   }
 * A world that writes none but whose intent fights turn by turn (its cube's power.combat) is laid with the defaults.
 *
 * Pure. `laidBattles(G)` the world with them laid; `readBattles(v, characters)` reads the shape and throws, teaching; `battleBase(G)` is the play.rpg every stage
 * shares (its party, classes, skills, foes, items, rules); `battlePlan(G, stages)` the packs each stage meets;
 * `battleCast(G, stage, ends, { ref, packs, from })` what a stage stands and plays; `battleRoster(G)` the party slice's
 * roster as the game starts.
 */
import { readRpg } from '../playscape/rpg/rpg.js';
import { withBoardBook } from '../board/board-battle.js';
import { CLASS_PRESETS, FOE_PRESETS, ITEM_PRESETS } from '../playscape/rpg/presets.js';
import { rpgInit, rpgSave } from '../playscape/rpg/kernel.js';
import { cubeOfWorld } from './intent.js';
import { castingOf, castingIds } from './casting.js';
import { foeFigure, beastLook, readBeastFoe, stand, facing } from './stage-figures.js';
import { bodyOf } from '../foes/fit.js';
import { readPeopleSkin, peopleRoll, peopleSeed } from '../foes/people.js';
import { foeClass } from '../foes/index.js';
import { rollEgocube } from '../egocube/egocube.js';
import { statureOf } from '../egocube/cast.js';
import { fieldOf } from './casting.js';
import { settingOfGame } from './cast-setting.js';
import { fieldFigure, libraryFigure } from './stage-figures.js';

export const PACKS = Object.freeze([
  ['slime', 'slime'], ['wolf', 'bat'], ['goblin', 'spider', 'slime'], ['skeleton', 'wolf'],
  ['bandit', 'goblin', 'bat'], ['shaman', 'goblin', 'goblin'], ['golem', 'wisp'], ['skeleton', 'skeleton', 'wisp'],
]);
// THE SHOPS ON THE WAY: each stage that fights opens with a merchant and an innkeeper beside where the party comes in.
// The merchant sells what that far along calls for (SHOP_WARES, by the packs met before: the starters' gear, then the
// iron and silver, then the dearer cures), and buys back at half; the inn's night (full HP and MP, cured) costs more
// the further on (INN_PRICE + INN_STEP a tier). The inn is the stage's rest: no free one beside it.
export const SHOP_WARES = Object.freeze([
  Object.freeze(['potion', 'antidote', 'bronze-sword', 'oak-staff', 'cestus', 'leather-armor', 'robe']),
  Object.freeze(['potion', 'antidote', 'ether', 'firebomb', 'iron-sword', 'silver-staff', 'gi', 'chain-mail', 'swift-ring']),
  Object.freeze(['hi-potion', 'ether', 'remedy', 'feather', 'firebomb', 'iron-sword', 'silver-staff', 'chain-mail', 'mana-charm', 'swift-ring']),
]);
export const INN_PRICE = 6, INN_STEP = 6;
export const SHOP_KEEPER = Object.freeze({ cast: 'male', palette: { Top: '#7a5a2a' } });
// (the tier a stage's shop is at: the packs met before it, two a tier)
export const tierOf = (from) => Math.min(SHOP_WARES.length - 1, Math.floor(from / 2));
/** Whether the run stands shops on its battle stages (on unless the book says `shops: false`). */
export const shopsOn = (G) => !!G.battles && G.battles.shops !== false && G.battles.on !== 'board';
export const JOINER_CLASSES = Object.freeze(['mage', 'cleric', 'rogue', 'knight', 'monk']);
export const BATTLE_FOE = Object.freeze({ cast: 'male', palette: { Top: '#6b2222' }, gear: { right: { item: 'dagger' } } });
// THE BATTLE FOES' LOOKS: each foe of the presets (playscape/rpg/presets.js) stood on the map as what it is, in the
// character doors' own words: a BEAST where the fauna has one ({ species, ooze?, stylism? }: grown by the mutagen's ooze
// where it is more than an animal); a PEOPLE ({ people, facets?, dress? }, foes/people.js: a lineage of the egocube's,
// the beast-kin, the undead form library's skeleton, zombie, ragged or rotting one, made from its sheet as a bestiary
// people is); a PERSON through the hero door (its spec). A book names its own per foe (`battles.looks`); a world's one
// `battles.foe` stands for all; a foe with none stands as the plain one (BATTLE_FOE).
export const FOE_LOOKS = Object.freeze({
  slime: { species: 'frog', ooze: 'venom' },
  bat: { species: 'fruitBat' },
  wolf: { species: 'wolf' },
  spider: { species: 'rat', ooze: 'venom' },
  shroom: { species: 'frog', ooze: 'mythical' },
  wisp: { species: 'greatHornedOwl', ooze: 'shadow' },
  golem: { species: 'brownBear', ooze: 'crystal' },
  drake: { species: 'velociraptor', ooze: 'fire' },
  goblin: { people: 'orcish' },
  shaman: { people: 'orcish' },
  bandit: BATTLE_FOE,
  skeleton: { people: 'skeleton' },
  zombie: { people: 'zombie' },
});
const isPeopleLook = (look) => !!look && typeof look === 'object' && look.people !== undefined;
// a battle people's sheet: its skin rolled in the game's setting as a caster where its foe fights by magic, else as a
// frontline fighter (foes/people.js peopleRole), its seed the world's moved by the foe's kind (one sheet per kind)
export function battlePeopleRoll(G, kind, look) {
  const P = FOE_PRESETS[kind] || {}, caster = (P.mag ?? 0) > (P.atk ?? 0);
  return peopleRoll(look, foeClass(caster ? 'lobber' : 'walker'), { seed: peopleSeed(G.seed, `battle:${kind}`), setting: settingOfGame(G) });
}
// the height a beast foe stands at in a fight (metres), whatever its species' own: a monster's presence, not the animal's
// (a slime grown from a frog stands knee-high, a golem from a bear over a person); a foe not here stands at its own size
export const FOE_HEIGHT = Object.freeze({ slime: 0.7, bat: 0.9, spider: 0.8, shroom: 0.9, wisp: 1.2, golem: 2.3, drake: 2.6 });
// how far a foe kind reaches round its middle as it stands (metres): a beast at its fight height by its species' build
const reachOf = (G, kind) => {
  const look = foeLookOf(G, kind);
  if (isPeopleLook(look)) return 0.35;
  if (!beastLook(look) || !FOE_HEIGHT[kind] || G.battles?.foe) return 0.3;
  const m = bodyOf(look.species, { ooze: look.ooze });
  return Math.min(2.5, Math.max(0.15, m.extent * (FOE_HEIGHT[kind] / Math.max(0.05, m.height)) * 0.5));
};
/** The look a foe stands in: the world's one foe look where it writes it, else the foe's own, else the plain one. */
export const foeLookOf = (G, id) => G.battles?.foe ?? G.battles?.looks?.[id] ?? FOE_LOOKS[id] ?? BATTLE_FOE;
export { isPeopleLook };
/** The figure kinds a run makes for its battles: one per foe the plan stands (each its own look), or one for all where
 * the world writes its own foe look. */
export const foeKindsOf = (G, plan) => (G.battles?.foe !== undefined ? ['foe'] : [...new Set(Object.values(plan ?? {}).flat(2).filter(Boolean))]);
export const PARTY_SLICE = 'party';
// the bag the party's items, gear and gold are carried in (the bag mechanic), and what it holds as the game starts
export const BAG_SLICE = 'bag';
export const BAG_START = Object.freeze({ potion: 2 });
// where battles are fought: a stage walked along a trail (its beats), or a building level's rooms on the way to its goal
// room (a dungeon: its boss in the goal room, levels.js buildingEnds); a building made by ref, a building's inside
// entered by its door (a town's house), a city and a roadway have none
export const FOUGHT = (s) => !['interior', 'city', 'roadway'].includes(s.section) && !(s.section === 'building' && s.building?.ref);
const KEYS = ['on', 'board', 'party', 'followers', 'packs', 'per', 'boss', 'sets', 'foe', 'looks', 'rest', 'shops', 'random', 'classes', 'skills', 'foes', 'items', 'gear', 'juice', 'rules'];
const BOARD_KEYS = ['cols', 'rows', 'cap', 'rules', 'skirmish', 'epochs', 'talk'];
const MEMBER_KEYS = ['class', 'name', 'level', 'bonus', 'classes', 'gear'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`gameworld: battles${m}`);
const words = (s) => s.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
const r3 = (v) => Math.round(v * 1000) / 1000;

const packOf = (v, where) => {
  if (!Array.isArray(v) || !v.length || v.length > 6 || !v.every((f) => typeof f === 'string' && f)) throw err(`${where} is a pack: 1 to 6 foe ids (${Object.keys(FOE_PRESETS).join(', ')}, or the world's own foes)`);
  return [...v];
};

/** The concern as written, read; `characters` (the world's, read) say who can be in the party. */
// the book's epochs (board-levels.js): its levels in order, cut into chapters, each a map of its own
function readEpochs(E, ids) {
  const shape = '.board.epochs is the book\'s levels in order, cut into chapters: [{ name?, levels: [level id, …] }, …]';
  if (!Array.isArray(E) || !E.length) throw err(shape);
  for (const [k, e] of E.entries()) {
    if (!isObj(e) || !Array.isArray(e.levels) || !e.levels.length || !e.levels.every((l) => typeof l === 'string')) throw err(`${shape} (epochs[${k}])`);
    for (const x of Object.keys(e)) if (!['name', 'levels'].includes(x)) throw err(`.board.epochs[${k}].${x} is not part of an epoch (name, levels)`);
    if (e.name !== undefined && (typeof e.name !== 'string' || !e.name.trim())) throw err(`.board.epochs[${k}].name is the epoch's name, a few words`);
  }
  const flat = E.flatMap((e) => e.levels);
  if (ids && flat.join('|') !== ids.join('|')) throw err(`.board.epochs: every level once, in the book's order (${ids.join(', ')}); they hold ${flat.join(', ')}`);
}

export function readBattles(v, characters = null, ids = null) {
  if (v === undefined) return null;
  if (!isObj(v)) throw err(' is { on?, board?, party?, followers?, packs?, per?, boss?, foe?, rest?, random?, classes?, skills?, foes?, items?, rules? }');
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw err(`.${k} is not part of the battles (${KEYS.join(', ')})`);
  const cast = characters?.cast ?? {};
  // (a casting page's first party may be named too: its ids are read from its words, without rolling, at the largest
  // scale when the page names none, since the prompt's words decide it)
  const rolled = characters?.casting ? new Set(castingIds({ scale: 'journey', ...characters.casting }).filter((x) => x.bond === 'party').map((x) => x.id)) : new Set();
  if (v.party !== undefined) {
    if (!isObj(v.party)) throw err('.party is { hero?: { class }, <cast id>: { class } }: each member\'s class');
    for (const [id, m] of Object.entries(v.party)) {
      if (id !== 'hero' && !cast[id]?.joins && !rolled.has(id)) throw err(`.party.${id}: the party is the hero and the cast who join it (characters.cast.<id>.joins)${cast[id] ? `; give ${id} a joins flag` : ''}`);
      if (!isObj(m)) throw err(`.party.${id} is { class?, name?, level?, bonus?, classes? }`);
      for (const k of Object.keys(m)) if (!MEMBER_KEYS.includes(k)) throw err(`.party.${id}.${k} is not part of a member (${MEMBER_KEYS.join(', ')})`);
    }
  }
  const packs = v.packs === undefined ? null : (Array.isArray(v.packs) && v.packs.length ? v.packs.map((p, i) => packOf(p, `.packs[${i}]`)) : (() => { throw err('.packs is a list of packs, each 1 to 6 foe ids'); })());
  if (v.per !== undefined && !(Number.isInteger(v.per) && v.per >= 0 && v.per <= 6)) throw err('.per is the packs on each trail stage, 0 to 6');
  // (followers: false, the party fights beside the hero but does not walk the map with it: the leader alone walks, as a
  // classic party RPG's; a member who joins on a story flag still stands where the story puts it)
  if (v.followers !== undefined && typeof v.followers !== 'boolean') throw err('.followers is true (the party walks the map behind the hero, the default) or false (the hero walks alone; the party still fights)');
  const boss = v.boss === undefined ? null : packOf(v.boss, '.boss');
  // (sets: the story flag the boss's fall sets, carried on as every flag is: a quest's last step done by it, a moment after)
  if (v.sets !== undefined && !(typeof v.sets === 'string' && /^[a-z][a-z0-9-]*$/.test(v.sets))) throw err('.sets is the flag the boss\'s fall sets (a story flag: lowercase words joined by hyphens)');
  if (v.sets !== undefined && v.boss === undefined) throw err('.sets is set by the boss\'s fall: name the boss pack (boss)');
  if (v.foe !== undefined && !isObj(v.foe)) throw err('.foe is a hero-door spec (how a foe on the map looks), { species, ooze?, stylism? } for a beast, or { people, facets?, dress? } for a people');
  if (beastLook(v.foe)) readBeastFoe(v.foe, null, '.foe', err);
  else if (isPeopleLook(v.foe)) { try { readPeopleSkin(v.foe, 'battles.foe'); } catch (e) { throw err(`.foe: ${e.message.replace(/^[^:]*: /, '')}`); } }
  // (each foe's own look, in a character door's words: a beast, a people, or a person's spec)
  if (v.looks !== undefined) {
    if (!isObj(v.looks)) throw err('.looks is { <foe id>: a beast { species, ooze?, stylism? } | a people { people, facets?, dress? } | a person (the hero door\'s spec) }');
    for (const [id, L] of Object.entries(v.looks)) {
      if (!isObj(L)) throw err(`.looks.${id} is a beast, a people or a person`);
      if (beastLook(L)) readBeastFoe(L, null, `.looks.${id}`, err);
      else if (L.people !== undefined) { try { readPeopleSkin(L, `battles.looks.${id}`); } catch (e) { throw err(`.looks.${id}: ${e.message.replace(/^[^:]*: /, '')}`); } }
    }
  }
  if (v.rest !== undefined && typeof v.rest !== 'boolean') throw err('.rest is false for no rest at each stage\'s start');
  if (v.shops !== undefined && v.shops !== false) {
    if (!isObj(v.shops)) throw err('.shops is false for no merchant and inn on the way, or { wares?: [item or gear ids], inn?: gold | false }');
    for (const k of Object.keys(v.shops)) if (!['wares', 'inn'].includes(k)) throw err(`.shops has no key '${k}' (wares, inn)`);
    if (v.shops.wares !== undefined && !(Array.isArray(v.shops.wares) && v.shops.wares.length && v.shops.wares.every((w) => typeof w === 'string'))) throw err('.shops.wares is the merchant\'s wares on every stage: item or gear ids');
    if (v.shops.inn !== undefined && v.shops.inn !== false && !(Number.isInteger(v.shops.inn) && v.shops.inn >= 0)) throw err('.shops.inn is a night\'s price on every stage, or false for no inn');
  }
  if (v.random !== undefined) {
    if (!isObj(v.random)) throw err('.random is { every?, chance?, after? }: random encounters on the trails, drawn from each stage\'s packs');
    for (const k of Object.keys(v.random)) if (!['every', 'chance', 'after'].includes(k)) throw err(`.random.${k} is not part of it (every, chance, after)`);
  }
  // on: 'board' fights each stage's packs as a tactics battle on spots over the stage's own ground (board/), the stage
  // the battle's level (gameworld/board-levels.js); absent, the party battles' fights on the trail
  if (v.on !== undefined && v.on !== 'board') throw err(".on is 'board' (each stage a tactics battle on its own ground), or absent (fights met on the trail)");
  if (v.board !== undefined) {
    if (v.on !== 'board') throw err(".board is the board's own settings, for on: 'board'");
    if (!isObj(v.board)) throw err(`.board is { ${BOARD_KEYS.join(', ')} } (every one optional)`);
    for (const k of Object.keys(v.board)) if (!BOARD_KEYS.includes(k)) throw err(`.board.${k} is not part of it (${BOARD_KEYS.join(', ')})`);
    if (v.board.skirmish !== undefined && typeof v.board.skirmish !== 'boolean') throw err('.board.skirmish is true or false: a battle on each area\'s map to fight again (true by default)');
    if (v.board.epochs !== undefined) readEpochs(v.board.epochs, ids);
    if (v.board.talk !== undefined && !(isObj(v.board.talk) && Object.entries(v.board.talk).every(([k, x]) => ['bubble', 'portrait'].includes(k) && typeof x === 'boolean'))) throw err('.board.talk is { bubble?, portrait? }: the words over whoever speaks (on unless false), a close portrait of them beside (off unless true)');
  }
  const out = { ...v, ...(packs ? { packs } : {}), ...(boss ? { boss } : {}) };
  // the play.rpg it makes, read now, so a wrong class, skill, foe or rule is said where it was written
  readRpg({ rpg: battleBase({ battles: out, characters }) });
  for (const p of [...(packs ?? []), ...(boss ? [boss] : [])]) readRpg({ rpg: { ...battleBase({ battles: out, characters }), encounters: [{ id: 'check', foes: p }] } });
  return out;
}

/** The world as the run lays it: a world whose cube fights turn by turn (power.combat turn-based: the jrpg genre, or
 * its own cube) and writes no battles is laid with the defaults, the encounters concern laid as the cover concern is;
 * one whose cube fights tactics (power.combat tactics) with its battles on boards.
 * A quick world is its own (its goal says what it fights). */
export function laidBattles(G) {
  if (G.battles !== undefined || G.quick) return G;
  const c = cubeOfWorld(G).cube.power?.combat, has = (x) => (Array.isArray(c) ? c.includes(x) : c === x);
  // tactics: the battles on boards (board-levels.js); turn-based: met on the trail
  return has('tactics') ? { ...G, battles: { on: 'board' } } : has('turn-based') ? { ...G, battles: {} } : G;
}

/** The party: the hero first, then each cast member who joins, in the cast's order. */
export function battleParty(G) {
  const P = G.battles?.party ?? {}, out = [];
  const at = (id, cls, name, joins) => {
    const m = P[id] ?? {};
    return { id, name: m.name ?? name, class: m.class ?? cls, ...(m.level !== undefined ? { level: m.level } : {}), ...(m.bonus ? { bonus: m.bonus } : {}), ...(m.classes ? { classes: m.classes } : {}), ...(m.gear ? { gear: m.gear } : {}), ...(joins ? { joins } : {}) };
  };
  const C = G.characters?.casting ? castingOf(G) : null, laid = new Set(G.characters?.rolled ?? []);
  out.push(at('hero', C ? C.anchor.cls : 'fighter', 'Hero', null));
  let k = 0;
  for (const [id, c] of Object.entries(G.characters?.cast ?? {})) if (c.joins && !laid.has(id)) out.push(at(id, JOINER_CLASSES[k++ % JOINER_CLASSES.length], c.name ?? words(id), c.joins));
  for (const M of C?.members ?? []) if (M.bond === 'party') out.push(at(M.id, M.cls, M.name, M.joins ?? null));
  // a familiar of the hero or of a first-party member fights beside its keeper, picking for itself
  const keeperOf = (M) => (M.of === C.sheet.anchor ? 'hero' : C.members.find((K) => K.path === M.of)?.id);
  for (const M of C?.members ?? []) {
    const keeper = M.bond === 'familiar' && keeperOf(M);
    if (keeper && out.some((x) => x.id === keeper)) out.push({ ...at(M.id, M.cls, M.name, M.joins ?? null), auto: { keeper } });
  }
  return out;
}

/** The play.rpg every stage shares, less its encounters. */
export function battleBase(G) {
  const B = G.battles ?? {};
  const own = Object.fromEntries(['classes', 'skills', 'foes', 'items', 'gear', 'juice'].filter((k) => B[k] !== undefined).map((k) => [k, B[k]]));
  // gold is the bag's (held:bag:gold), so it is carried as every item is
  // a book fighting on boards has the board's own book besides (the summoner and its summons), when it uses it
  const base = { party: battleParty(G), ...own, rules: { defeat: 'fail', gold: 'held:bag:gold', ...(B.rules ?? {}) } };
  return B.on === 'board' ? withBoardBook(base) : base;
}

// the beats a pack may stand on: along the way, the exit and the trailhead left free; in a building (its `rooms` and the
// route to its goal room, `via`: levels.js buildingEnds), the rooms the way passes through, one spot in each on the
// way, two in a long one, none in the room it starts in or the goal room (a room off the way, past the goal room, has none)
// (a glyph map's, level/grid-ends.js: the beats along its way, in the order it walks them, none in its home region, the
// town the party sets out from; its pockets and its places' doors are the story's)
const freeBeats = (ends) => (ends?.rooms && ends.via ? wayBeats(ends) : ends?.map ? (ends.beats ?? []).filter((b) => b.beat === 'along' && !(ends.home && b.region === ends.home)) : (ends?.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead'));
const LONG_ROOM = 8, WAY_STEP = 0.25, CLEAR_OF_GOAL = 5.5;
function wayBeats(ends) {
  const line = [ends.spawn, ...ends.via, ends.exit], pts = [];
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1], b = line[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / WAY_STEP));
    for (let j = k === 1 ? 0 : 1; j <= m; j++) pts.push([a[0] + ((b[0] - a[0]) * j) / m, a[1] + ((b[1] - a[1]) * j) / m]);
  }
  const inRoom = (r, p) => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.d;
  const ends0 = ends.rooms.filter((r) => inRoom(r, ends.spawn) || inRoom(r, ends.exit));
  const out = [];
  for (const r of ends.rooms) {
    if (ends0.includes(r)) continue;
    // (none at the goal room's threshold: a pack there would be met with what waits in it)
    const own = pts.filter((p) => inRoom(r, p) && !ends0.some((q) => inRoom(q, p)) && Math.hypot(p[0] - ends.exit[0], p[1] - ends.exit[1]) >= CLEAR_OF_GOAL);
    if (!own.length) continue;
    const n = own.length * WAY_STEP >= LONG_ROOM ? 2 : 1;
    for (let j = 0; j < n; j++) { const p = own[Math.floor(((j + 0.5) * own.length) / n)]; out.push({ beat: n > 1 ? `${r.id}-${j + 1}` : r.id, at: [r3(p[0]), r3(p[1]), r.z], first: own[0] }); }
  }
  // (in the order the way meets them)
  const along = (p) => pts.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
  return out.sort((a, b) => along(a.first) - along(b.first) || a.at[0] - b.at[0]).map(({ first: _f, ...b }) => b);
}
/** How many packs a stage has room for (its free beats). */
export const roomOf = (ends) => freeBeats(ends).length;

/** The packs each stage meets (by its index in `stages`): `per` on each trail stage (as many as it has room for:
 * `room(i)`, its free beats), the ladder walked in order across the game, the boss as the last pack of the last stage
 * with room; a stage with a lair (`lair(i)`: a building's goal room) keeps its boss there, its packs in its rooms before.
 * → { [stage index]: [pack] } */
export function battlePlan(G, stages, room = () => Infinity, lair = () => false) {
  const B = G.battles ?? {}, packs = B.packs ?? PACKS, per = B.per ?? 2, plan = {};
  let k = 0;
  // (none in the hub: the town is where the party comes back to)
  // (walked in the order the main quest plays its levels, act by act, beat by beat: the plains before the woods before
  // the dungeon, whatever order the world writes its levels in; a level no beat plays after them, in the stages' order)
  const parts = G.mainQuest ? G.mainQuest[G.mainQuest.shape ?? 'acts'] : null;
  const order = Array.isArray(parts) ? [...new Set(parts.flatMap((A) => (A.beats ?? []).map((b) => (b?.as?.kind === 'level' ? b.as.at : b?.as?.level))).filter(Boolean))] : [];
  const rank = (i) => { const r = order.indexOf(stages[i].level); return r < 0 ? order.length : r; };
  const fought = stages.map((s, i) => [s, i]).filter(([s]) => FOUGHT(s) && !(G.hub && s.level === G.hub)).map(([, i]) => i).sort((a, b) => rank(a) - rank(b) || a - b);
  const last = B.boss ? [...fought].reverse().find((i) => lair(i) || Math.min(per || 1, room(i)) > 0) : undefined;
  // (a glyph map's stage is the whole chapter: `per` in each of its regions past the first, the town it sets out from)
  const perOf = (i) => (stages[i].section === 'map' ? per * Math.max(1, Object.keys(stages[i].manifest?.level?.grid?.regions?.key ?? {}).length - 1) : per);
  for (const i of fought) {
    const pi = perOf(i), den = i === last && lair(i), n = den ? Math.min(pi, room(i)) + 1 : Math.min(i === last ? Math.max(pi, 1) : pi, room(i)), own = i === last ? n - 1 : n;
    plan[i] = [];
    for (let j = 0; j < own; j++) plan[i].push(packs[Math.min(k++, packs.length - 1)]);
    if (i === last) plan[i].push(B.boss);
  }
  return plan;
}

/**
 * A stage's battles: each pack stands on one of the trail's beats (evenly along it, the exit and the trailhead left
 * free), each of its foes its own figure in its own look (FOE_LOOKS), spread round the beat facing back down the way;
 * walking up to the pack starts the fight, and each falls as the fight is won. A rest at the stage's start. `refs`: each
 * foe kind's figure (`ref` the one figure where the world writes its own foe look); `packs`: the stage's; `from`: the
 * game-wide number of its first.
 * → { figures, entities, play, mechanics } (the stage's extra: levels.js stageLevelOrder)
 */
export function battleCast(G, stage, ends, { ref, refs = null, keeper = null, packs = [], from = 0, seed = 1 } = {}) {
  const B = G.battles ?? {}, base = battleBase(G);
  const along = freeBeats(ends);
  // (a building's boss stands in its goal room, `bossAt`, the packs before it in the rooms on the way; on a trail it is
  // the last pack along the way)
  const lair = !!(B.boss && ends.bossAt && packs.at(-1) === B.boss);
  const n = Math.min(packs.length - (lair ? 1 : 0), along.length);
  const picks = Array.from({ length: n }, (_, k) => along[Math.min(along.length - 1, Math.floor(((k + 0.5) * along.length) / n))]);
  if (lair) picks.push({ beat: 'goal', at: ends.bossAt });
  const met = lair ? [...packs.slice(0, n), packs.at(-1)] : packs;
  const figures = {}, entities = [], encounters = [];
  picks.forEach((b, k) => {
    const id = `foe-${k + 1}`, back = k ? picks[k - 1].at : ends.spawn, h = facing(b.at, back);
    // (each foe of the pack its own figure: the first on the beat, the rest a step aside on either side and a step back,
    // the step as wide as the pack's largest needs: a golem's is not a bat's)
    const span = Math.max(1.4, ...met[k].map((kind) => 2 * reachOf(G, kind) + 0.6));
    const who = met[k].map((kind, j) => {
      const fid = j ? `${id}-${j + 1}` : id, side = (j % 2 ? 1 : -1) * Math.ceil(j / 2) * span, back1 = Math.ceil(j / 2) * span * 0.5;
      const at = [r3(b.at[0] - Math.sin(h) * side - Math.cos(h) * back1), r3(b.at[1] + Math.cos(h) * side - Math.sin(h) * back1), b.at[2]];
      const look = foeLookOf(G, kind), fref = refs?.[kind] ?? ref;
      if (isPeopleLook(look)) {
        // (a people from its sheet, as a bestiary people stands: a person or a beast-kin on its own moves, at its stature)
        const sheet = rollEgocube(battlePeopleRoll(G, G.battles?.foe !== undefined ? 'foe' : kind, look));
        stand({ figures, entities }, fid, fieldFigure(fref, fieldOf({ body: 'person', sheet })), at, h);
        const e = entities.at(-1);
        e.rule = { ...e.rule, collideHeight: r3(statureOf({ body: 'person', sheet })) };
        return fid;
      }
      stand({ figures, entities }, fid, foeFigure(fref, look), at, h);
      // (a beast drawn at its foe's height: its body scaled, what it collides with and where it is hit with it)
      if (beastLook(look) && FOE_HEIGHT[kind] && !G.battles?.foe) {
        const m = bodyOf(look.species, { ooze: look.ooze }), k = FOE_HEIGHT[kind] / Math.max(0.05, m.height), x = m.extent * k, e = entities.at(-1);
        e.body = { ...e.body, scale: r3(k), egg: { a: r3(Math.max(0.2, x * 0.3)), c: r3(FOE_HEIGHT[kind] / 2), cz: r3(FOE_HEIGHT[kind] / 2) } };
        e.rule = { ...e.rule, collideHeight: FOE_HEIGHT[kind], collideRadius: r3(Math.min(2.5, Math.max(0.15, x * 0.25))) };
      }
      return fid;
    });
    const boss = B.boss && k === picks.length - 1 && met[k] === B.boss;
    // (met before the goal room's exit is reached: its zone is smaller than the fight's)
    // (in a building, the room it is met in: an arena stage holds the fight to it)
    const room = ends.rooms?.find((r) => b.at[0] >= r.x && b.at[0] <= r.x + r.w && b.at[1] >= r.y && b.at[1] <= r.y + r.d);
    encounters.push({ id: `pack-${from + k + 1}`, foes: [...met[k]], at: [b.at[0], b.at[1]], who: who.length > 1 ? who : id, ...(boss ? { flee: false } : {}), ...(boss && lair ? { near: 3 } : {}), ...(room ? { room: [room.x, room.y, r3(room.x + room.w), r3(room.y + room.d), room.z] } : {}) });
  });
  const random = B.random ? { sets: packs.length ? packs.map((p) => [...p]) : [PACKS[0]], ...B.random } : null;
  // the merchant and the innkeeper, beside where the party comes in (none where the book says no shops, or none stands)
  // (in a hub world they stand in the hub instead, hubCast)
  const shop = keeper && shopsOn(G) && !G.hub && encounters.length ? shopsAt(G, ends, figures, entities, keeper, waresFor(G, from), innOf(G, tierOf(from))) : null;
  const rpg = { ...base, ...(encounters.length ? { encounters } : {}), ...(random ? { random } : {}), ...(shop ? { shops: shop.shops } : {}), rules: { ...base.rules, seed } };
  // (a hub world's rest is its inn: none on the way unless the book asks for one)
  const rest = (B.rest ?? !G.hub) === false || shop?.inn ? [] : [{ id: 'rpg-rest-spot', when: { use: { at: [ends.spawn[0], ends.spawn[1]], r: 2.5 }, prompt: 'rest' }, then: [{ emit: 'rpg-rest' }, { say: 'Rested', as: 'toast' }] }];
  if (shop) rest.push(...shop.cues);
  // the boss's fall sets its flag (battles.sets): the story hears it as any flag (a quest's step, a moment after it)
  const bossEnc = B.sets ? encounters.find((e) => e.flee === false && B.boss && e.foes.join('|') === B.boss.join('|')) : null;
  if (bossEnc) rest.push({ id: 'rpg-boss-sets', when: { on: `rpg-won:${bossEnc.id}` }, then: { emit: `flag:${B.sets}` } });
  // the party and the bag carried (the party and bag mechanics); a wiped party fails the level under defeat: 'fail'
  const mechanics = [{ kind: 'party', slice: PARTY_SLICE }, { kind: 'bag', slice: BAG_SLICE }, ...(rpg.rules.defeat === 'fail' ? [{ kind: 'fail-on-death', startHp: 1 }] : [])];
  return { figures, entities, play: { rpg, ...(rest.length ? { cues: rest } : {}) }, mechanics };
}

// the wares the world can sell: the tier's (or the book's own), less what the world's items and gear leave out
export function waresFor(G, from, list0 = null) {
  const B = G.battles, list = B.shops?.wares ?? list0 ?? SHOP_WARES[tierOf(from)];
  const has = (v, k) => v === undefined || (Array.isArray(v) ? v.includes(k) : isObj(v) && k in v);
  return list.filter((w) => (ITEM_PRESETS[w] || (isObj(B.items) && B.items[w]) ? has(B.items, w) : has(B.gear, w)));
}
// a keeper's place beside the stage's start: a few steps on toward the first pack, to one side, where the ground is
// near the start's (else on the line), facing back at the start
function besideStart(ends, side) {
  const s = ends.spawn, ahead = [...(ends.beats ?? []).filter((b) => b.beat !== 'exit').map((b) => b.at), ends.exit].filter(Boolean);
  const far = ahead.find((a) => Math.hypot(a[0] - s[0], a[1] - s[1]) > 4) ?? ahead[0] ?? [s[0] + 1, s[1]];
  const dx = far[0] - s[0], dy = far[1] - s[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, along = Math.min(3, d * 0.4);
  const ground = typeof ends.ground === 'function' ? ends.ground : () => null;
  for (const off of [side * 2.6, side * 1.6, 0]) {
    const x = s[0] + ux * along - uy * off, y = s[1] + uy * along + ux * off, z = ground(x, y);
    if (off === 0 || (z != null && Math.abs(z - s[2]) < 1)) return { at: [r3(x), r3(y), r3(z ?? s[2])], face: r3(Math.atan2(s[1] - y, s[0] - x)) };
  }
  return null;
}
// a night's price at tier k: the book's, else dearer further on; null for no inn
export const innOf = (G, k) => (G.battles.shops?.inn === false ? null : G.battles.shops?.inn ?? INN_PRICE + INN_STEP * k);
function shopsAt(G, ends, figures, entities, keeper, wares, inn) {
  const shops = {}, cues = [];
  const put = (id, side, S, word, hello) => {
    const p = besideStart(ends, side);
    if (!p) return false;
    stand({ figures, entities }, id, libraryFigure(keeper), p.at, p.face);
    shops[id] = S;
    cues.push({ id: `rpg-${id}`, when: { use: { at: [p.at[0], p.at[1]], r: 2 }, prompt: word }, then: { emit: `rpg-shop:${id}` } });
    cues.push({ id: `rpg-${id}-hello`, when: { near: { at: [p.at[0], p.at[1]], r: 3.2 } }, once: true, then: { say: hello, as: 'toast' } });
    return true;
  };
  if (wares.length) put('merchant', 1, { name: 'Merchant', wares }, 'shop', 'Wares for the road?');
  const stood = inn != null && put('innkeeper', -1, { name: 'Inn', inn }, 'stay', `A bed for ${inn} gold.`);
  return Object.keys(shops).length ? { shops, cues, inn: stood } : null;
}

// the shops a town's folk keep (no figure, no cue: the folk's own use opens them, folk-cast.js folkExtra)
const folkShops = (wares, inn) => {
  const shops = { ...(wares.length ? { merchant: { name: 'Merchant', wares } } : {}), ...(inn != null ? { innkeeper: { name: 'Inn', inn } } : {}) };
  return Object.keys(shops).length ? { shops, cues: [], inn: inn != null } : null;
};
/** The shops a hub's folk keep, as folk-cast.js folkExtra takes them: { merchant?, inn?: { id, prompt } }. */
export const hubFolkShops = (G) => (shopsOn(G) && G.hub ? { ...(waresFor(G, 0, HUB_WARES).length ? { merchant: { id: 'merchant', prompt: 'Shop' } } : {}), ...(innOf(G, 0) != null ? { inn: { id: 'innkeeper', prompt: 'Inn' } } : {}) } : null);
// the hub's merchant sells the first two tiers' wares at once (the gold says what the party can have yet)
export const HUB_WARES = Object.freeze([...new Set([...SHOP_WARES[0], ...SHOP_WARES[1]])]);
/**
 * The hub's market (a world's `hub`, battles.js shops): its merchant and its inn beside where the party comes into the
 * town, the party and the bag carried there as on a stage that fights; null on any other stage, or with no shops.
 * → { figures, entities, play: { rpg, cues }, mechanics } (the stage's extra: levels.js stageLevelOrder)
 */
export function hubCast(G, stage, ends, { keeper, folk = false } = {}) {
  if (!shopsOn(G) || stage.level !== G.hub || (!keeper && !folk)) return null;
  const wares = waresFor(G, 0, HUB_WARES), inn = innOf(G, 0);
  // (a town with folk keeps them itself: its shopkeeper and an innkeeper among its people, folk-cast.js; no keeper
  // stands of its own)
  const figures = {}, entities = [], shop = folk ? folkShops(wares, inn) : shopsAt(G, ends, figures, entities, keeper, wares, inn);
  if (!shop) return null;
  const base = battleBase(G);
  const mechanics = [{ kind: 'party', slice: PARTY_SLICE }, { kind: 'bag', slice: BAG_SLICE }];
  return { figures, entities, play: { rpg: { ...base, shops: shop.shops }, cues: shop.cues }, mechanics };
}

/** The party slice's roster as the game starts: each member as the battle kernel saves it (numbers only). */
export function battleRoster(G) {
  const cfg = readRpg({ rpg: battleBase(G) });
  return Object.fromEntries(Object.entries(rpgSave(cfg, rpgInit(cfg))).map(([id, stats]) => [id, { name: cfg.party.find((p) => p.id === id).name, level: stats.lv, stats }]));
}

export const BATTLE_CLASSES = Object.freeze(Object.keys(CLASS_PRESETS));
