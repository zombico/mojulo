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
 *     bossPages?: [page],  the boss fight's own pages (play.rpg encounters' `pages`: a line as it begins, at half its
 *                          HP, at its nth round; each said once)
 *     foe?: <hero-door spec>,   how every foe on the map looks (each its own, FOE_LOOKS, by default)
 *     looks?: { <foe id>: beast | people | person },   each foe's own look in a character door's words (FOE_LOOKS):
 *                          { species, ooze?, stylism? } a beast; { people, facets?, dress? } a people (a lineage, the
 *                          beast-kin, the undead: skeleton, zombie, ragged, rotting…); a person through the hero door
 *     heights?: { <foe id>: metres },   how tall a beast foe stands in a fight (FOE_HEIGHT by default; a foe with none
 *                          stands at its species' own size)
 *     rest?: false,        no rest at each stage's start (default: E there restores HP and MP; where an inn stands, it is
 *                          the rest)
 *     shops?: false | { wares?, inn? },   a merchant and an innkeeper beside each fighting stage's start (default on):
 *                          the merchant's wares by how far on (SHOP_WARES) or the book's own, bought back at half; a
 *                          night at the inn for INN_PRICE gold, more further on, or the book's price (inn: false, none)
 *     random?: { every?, chance?, after? },   random encounters on the trails, drawn from that stage's packs
 *     classes?, skills?, foes?, items?, gear?, juice?, states?, techs?, rules?,   play.rpg's own (playscape/rpg/rpg.js), over the presets
 *     manual?: <a lorecube manual, at any depth>,   a setting's creatures fielded (battles-manual.js): its foes and their
 *                          skills, its packs by role and level and its boss, each under the page's own word for it
 *     tree?: <a lorecube skill tree, at any depth> | [trees],   a school the party can be in (battles-tree.js): a class
 *                          and its techniques as skills, learned by rank or bought, each under the page's own word
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
import { CLASS_PRESETS, FOE_PRESETS, ITEM_PRESETS, GEAR_PRESETS } from '../playscape/rpg/presets.js';
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
import { readGrid } from '../level/grid.js';
import { mapItems } from '../level/map-items.js';
import { manualBattles } from './battles-manual.js';
import { treesBattles } from './battles-tree.js';
import { ARMORY_ARMS } from '../equipment/armory.js';
import { chestCast, chestsPer, chestKinds, readChests, CHEST_SLICE } from './chests.js';
import { MOTION_GAITS } from '../polygonizer/hero-motion.js';
import { WIN_OF_CLASS } from '../egocube/moves.js';

export const PACKS = Object.freeze([
  ['slime', 'slime'], ['wolf', 'bat'], ['goblin', 'spider', 'slime'], ['skeleton', 'wolf'],
  ['bandit', 'goblin', 'bat'], ['shaman', 'goblin', 'goblin'], ['golem', 'wisp'], ['skeleton', 'skeleton', 'wisp'],
]);
// THE SHOPS ON THE WAY: each stage that fights opens with a merchant and an innkeeper beside where the party comes in.
// The merchant sells what that far along calls for (SHOP_WARES, by the packs met before: the starters' gear, then the
// iron and silver, then the dearer cures), and buys back at half; the inn's night (full HP and MP, cured) costs more
// the further on (INN_PRICE + INN_STEP a tier). The inn is the stage's rest: no free one beside it.
export const SHOP_WARES = Object.freeze([
  Object.freeze(['potion', 'antidote', 'bronze-sword', 'oak-staff', 'cestus', 'leather-armor', 'robe', 'power-tonic', 'scan-lens']),
  Object.freeze(['potion', 'antidote', 'ether', 'firebomb', 'iron-sword', 'silver-staff', 'gi', 'chain-mail', 'swift-ring', 'venom-dagger', 'hunter-charm', 'shadow-cloak', 'hunting-bow', 'sleep-powder', 'smoke-bomb', 'riposte-ring', 'guardian-crest']),
  Object.freeze(['hi-potion', 'ether', 'remedy', 'feather', 'firebomb', 'iron-sword', 'silver-staff', 'chain-mail', 'mana-charm', 'swift-ring', 'flame-sword', 'ember-ring', 'phoenix-charm']),
]);
export const INN_PRICE = 6, INN_STEP = 6;
// the temple's rite (a town's priest, era/town-trades.js): the gold to raise one fallen member, healed and cured
export const RAISE_PRICE = 20;
// what a smithy's master sells (a town's smith): the gear of the hub's wares, arms and armour, beside the merchant's
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
  // (the story's bosses, round-bosses.js)
  leviathan: { species: 'seaSerpent', ooze: 'frost' },
  roc: { species: 'baldEagle', ooze: 'storm' },
  colossus: { species: 'mammoth', ooze: 'crystal' },
  // (a boss's people are named whole, never rolled to a child or an elder: the champion a hero in its prime, the warlord
  // a seasoned outlaw of brute build, who took what it rules)
  champion: { people: 'human', facets: { age: 'adult', build: 'heroic', archetype: 'hero' } },
  warlord: { people: 'orcish', facets: { age: 'seasoned', build: 'brute', archetype: 'outlaw' } },
  goblin: { people: 'orcish' },
  shaman: { people: 'orcish' },
  bandit: BATTLE_FOE,
  skeleton: { people: 'skeleton' },
  zombie: { people: 'zombie' },
});
const isPeopleLook = (look) => !!look && typeof look === 'object' && look.people !== undefined;
// THE BATTLE FOES' ARMS: what each people foe of the presets holds, by its kind (equipment/armory.js rows): the goblin
// its lineage's rank-and-file cudgel (foe-casting.js PEOPLE_ARMS), the shaman a bone club for its fetish staff, the
// skeleton a rusted sword and a cracked round shield; the zombie claws, bare. A person's are its spec's (the bandit's
// dagger). A look that writes its own `gear` holds that; one written for every foe (`battles.foe`) holds only its own. A
// foe held so fights with the swings the page bakes on its rig (egocube/moves.js ARMED_ATTACKS). A new kind's arms is a
// row.
export const FOE_ARMS = Object.freeze({
  goblin: Object.freeze({ right: 'cudgel' }),
  shaman: Object.freeze({ right: 'bone-club' }),
  skeleton: Object.freeze({ right: 'rusted-sword', left: 'cracked-round' }),
  // (the story's bosses: the champion's longsword and kite shield, the warlord's great axe)
  champion: Object.freeze({ right: 'old-longsword', left: 'old-kite' }),
  warlord: Object.freeze({ right: 'grave-axe' }),
});
/** A battle foe's gear as the hero door takes it (laws-2 builds), or null: its look's own, else its kind's row (`key` the
 * foe kind, or 'foe' for the one look every foe stands in). */
export function foeGearOf(look, key) {
  if (isObj(look) && isObj(look.gear)) return structuredClone(look.gear);
  // (a kind's arms go with its own look, written out or not: one the world dresses its own way, an era's, holds only
  // what that look says)
  const row = key !== 'foe' && isPeopleLook(look) && FOE_LOOKS[key] && JSON.stringify(look) === JSON.stringify(FOE_LOOKS[key]) ? FOE_ARMS[key] : null;
  return row ? Object.fromEntries(Object.entries(row).map(([slot, name]) => [slot, { type: 'equipment', ...structuredClone(ARMORY_ARMS[name]), laws: 2, armory: name }])) : null;
}
// a battle people's sheet: its skin rolled in the game's setting as a caster where its foe fights by magic, else as a
// frontline fighter (foes/people.js peopleRole), its seed the world's moved by the foe's kind (one sheet per kind)
export function battlePeopleRoll(G, kind, look) {
  const P = FOE_PRESETS[kind] || {}, caster = (P.mag ?? 0) > (P.atk ?? 0);
  return peopleRoll(look, foeClass(caster ? 'lobber' : 'walker'), { seed: peopleSeed(G.seed, `battle:${kind}`), setting: settingOfGame(G) });
}
// the height a beast foe stands at in a fight (metres), whatever its species' own: a monster's presence, not the animal's
// (a slime grown from a frog stands knee-high, a golem from a bear over a person); a foe not here stands at its own size
export const FOE_HEIGHT = Object.freeze({ slime: 0.7, bat: 0.9, spider: 0.8, shroom: 0.9, wisp: 1.2, golem: 2.3, drake: 2.6, leviathan: 3, roc: 2.4, colossus: 3.4 });
// (the book's own, battles.heights, over these)
const heightOf = (G, kind) => G.battles?.heights?.[kind] ?? FOE_HEIGHT[kind];
// how far a foe kind reaches round its middle as it stands (metres): a beast at its fight height by its species' build
const reachOf = (G, kind) => {
  const look = foeLookOf(G, kind);
  if (isPeopleLook(look)) return 0.35;
  if (!beastLook(look) || !heightOf(G, kind) || G.battles?.foe) return 0.3;
  const m = bodyOf(look.species, { ooze: look.ooze });
  return Math.min(2.5, Math.max(0.15, m.extent * (heightOf(G, kind) / Math.max(0.05, m.height)) * 0.5));
};
/**
 * THE CITADEL'S LOCKS, met in play: a walled core's gated doors (wcd/wcd.js, a door with a `gate`) between spaces this
 * building stands for are LOCKS across its route (game/mechanics.js `lock`), each after one of its packs in the order the
 * route meets them: each on the last doorway between its guard and what lies past it (the next pack, or the boss), its
 * key, named for the space it opens (the Vault Key), carried by that guard and given as its fight is won (kept: the party
 * menu's Key tab). A door with no doorway between a guard and what follows is not laid: never a lock whose key lies past
 * it. → { mechanics, cues, items } or null (no walled core here, no route, no pack to carry a key)
 */
export function citadelLocks(G, stage, ends, encounters) {
  const W = G.wcd, via = ends?.via;
  if (!W || stage.section !== 'building' || !Array.isArray(via) || via.length < 3) return null;
  const here = (sp) => W.spaces?.[sp]?.level === stage.level;
  const doors = (W.doors ?? []).filter((d) => d.gate && here(d.from) && here(d.to));
  const guards = encounters.filter((e) => e.flee !== false && /^pack-/.test(e.id)), boss = encounters.find((e) => e.flee === false);
  if (!doors.length || !guards.length) return null;
  // (at the walker's eye, as an escape room's locks are: escape.js; the goal room's floor's)
  const z = ends.exit?.[2] ?? ends.spawn?.[2] ?? 0, pt = (p) => [p[0], p[1], z];
  // (how far along the route a point lies: its projection on the route's nearest leg, as a distance from the way in)
  const legs = via.slice(1).map((b, k) => { const a = via[k]; return { a, b, from: 0, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
  legs.reduce((acc, L) => { L.from = acc; return acc + L.len; }, 0);
  const along = (q) => {
    let best = Infinity, s = 0;
    for (const L of legs) {
      const dx = L.b[0] - L.a[0], dy = L.b[1] - L.a[1], t = L.len ? Math.max(0, Math.min(1, ((q[0] - L.a[0]) * dx + (q[1] - L.a[1]) * dy) / (L.len * L.len))) : 0;
      const d = Math.hypot(L.a[0] + dx * t - q[0], L.a[1] + dy * t - q[1]);
      if (d < best) { best = d; s = L.from + L.len * t; }
    }
    return s;
  };
  // (the doorways the route passes, its waypoints between the way in and the goal; the guards and the boss along it)
  const ways = via.slice(1, -1).map((p, k) => ({ p, prev: via[k], s: along(p) }));
  const order = guards.map((e) => ({ e, s: along(e.at) })).sort((a, b) => a.s - b.s);
  const end = boss ? along(boss.at) : along(via.at(-1));
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1), mechanics = [], cues = [], items = {};
  // (each door after a guard, on the last doorway before what lies past it, the next guard or the boss; a door with no
  // doorway there is not laid, never one its key lies beyond)
  let g = 0;
  for (const D of doors) {
    for (; g < order.length; g++) {
      const lo = order[g].s, hi = g + 1 < order.length ? order[g + 1].s : end, way = ways.filter((w) => w.s > lo + 0.5 && w.s < hi - 0.5).at(-1);
      if (!way) continue;
      const key = `${D.to}-key`, name = `${cap(D.to)} Key`;
      mechanics.push({ kind: 'lock', id: `${D.to}`.slice(0, 32), key, name, at: pt(way.p), back: pt(way.prev), radius: 1.2, planar: false });
      items[key] = { name, kind: 'key' };
      cues.push({ id: `${key}-won`, when: { on: `rpg-won:${order[g].e.id}` }, once: true, then: [{ give: key }, { say: `Found the ${name}!`, as: 'toast' }] });
      g++;
      break;
    }
  }
  return mechanics.length ? { mechanics, cues, items } : null;
}

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
const KEYS = ['on', 'board', 'party', 'followers', 'packs', 'per', 'boss', 'bossPages', 'sets', 'foe', 'looks', 'heights', 'rest', 'shops', 'random', 'classes', 'skills', 'foes', 'items', 'gear', 'juice', 'states', 'rules', 'manual', 'tree', 'wins', 'chests', 'techs'];
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
  // (chests: the treasure each fighting stage keeps off its path, chests.js)
  readChests(v.chests, err);
  // (wins: the victory pose each class strikes when a fight is won, over its starter (egocube/moves.js WIN_OF_CLASS): any
  // of the hero door's motion words, a showcase pose or a victory)
  if (v.wins !== undefined) {
    const classes = [...new Set([...Object.keys(CLASS_PRESETS), ...(isObj(v.classes) ? Object.keys(v.classes) : [])])];
    if (!isObj(v.wins)) throw err(`.wins is { <class>: <pose> }: the victory pose each class strikes (its starter: ${Object.entries(WIN_OF_CLASS).map(([c, w]) => `${c} ${w}`).join(', ')})`);
    for (const [c, w] of Object.entries(v.wins)) {
      if (!classes.includes(c)) throw err(`.wins.${c}: no class '${c}' (the classes: ${classes.join(', ')})`);
      if (typeof w !== 'string' || !['move', 'rest'].includes(MOTION_GAITS[w]?.motion)) throw err(`.wins.${c} is a pose the hero door strikes (a showcase or a victory: ${Object.keys(MOTION_GAITS).filter((k) => /^victory/.test(k)).join(', ')}, fistToSky, peaceWink…), not '${w}'`);
    }
  }
  // (sets: the story flag the boss's fall sets, carried on as every flag is: a quest's last step done by it, a moment after)
  if (v.sets !== undefined && !(typeof v.sets === 'string' && /^[a-z][a-z0-9-]*$/.test(v.sets))) throw err('.sets is the flag the boss\'s fall sets (a story flag: lowercase words joined by hyphens)');
  if (v.sets !== undefined && v.boss === undefined) throw err('.sets is set by the boss\'s fall: name the boss pack (boss)');
  // (bossPages: the boss fight's own pages, play.rpg encounters' `pages`, read with it where it is laid)
  if (v.bossPages !== undefined && (v.boss === undefined || !Array.isArray(v.bossPages))) throw err('.bossPages is the boss fight\'s own pages, [{ when, say, who?, sets? }] (playscape/rpg/rpg.js): name the boss pack (boss)');
  if (v.foe !== undefined && !isObj(v.foe)) throw err('.foe is a hero-door spec (how a foe on the map looks), { species, ooze?, stylism? } for a beast, or { people, facets?, dress? } for a people');
  if (beastLook(v.foe)) readBeastFoe(v.foe, null, '.foe', err);
  else if (isPeopleLook(v.foe)) { try { readPeopleSkin(v.foe, 'battles.foe'); } catch (e) { throw err(`.foe: ${e.message.replace(/^[^:]*: /, '')}`); } }
  // (how tall each beast foe stands in a fight)
  if (v.heights !== undefined && !(isObj(v.heights) && Object.values(v.heights).every((h) => typeof h === 'number' && h >= 0.3 && h <= 12))) throw err('.heights is { <foe id>: metres, 0.3 to 12 }: how tall a beast foe stands in a fight');
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
  // a manual on the page (battles-manual.js): its creatures the foes, their skills, its ladder and its boss, each a
  // floor under the page's own words
  const M = v.manual === undefined ? null : (() => { try { return manualBattles(v.manual); } catch (e) { throw err(`.manual${String(e.message).replace(/^lorecube: manual/, '')}`); } })();
  // a skill tree on the page (battles-tree.js): each school a class, its techniques skills, the same floor
  const T = v.tree === undefined ? null : (() => { try { return treesBattles(v.tree); } catch (e) { throw err(`.tree${String(e.message).replace(/^lorecube: tree/, '')}`); } })();
  const lore = {
    ...(M ? { foes: { ...M.foes, ...(v.foes ?? {}) }, looks: { ...M.looks, ...(v.looks ?? {}) } } : {}),
    ...(M || T ? { skills: { ...(M?.skills ?? {}), ...(T?.skills ?? {}), ...(v.skills ?? {}) } } : {}),
    ...(T ? { classes: { ...T.classes, ...(v.classes ?? {}) } } : {}),
    ...(M && (packs ?? M.packs) ? { packs: packs ?? M.packs } : {}), ...(M && (boss ?? M.boss) ? { boss: boss ?? M.boss } : {}),
  };
  const out = { ...v, ...(packs ? { packs } : {}), ...(boss ? { boss } : {}), ...lore };
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
  const own = Object.fromEntries(['classes', 'skills', 'foes', 'items', 'gear', 'juice', 'states', 'techs'].filter((k) => B[k] !== undefined).map((k) => [k, B[k]]));
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
// (a planned map's packs stand where its pieces say, level/map-items.js: the passages' packs, the climax's boss)
const freeBeats = (ends) => (ends?.rooms && ends.via ? wayBeats(ends) : ends?.map && ends.packs ? ends.packs : ends?.map ? (ends.beats ?? []).filter((b) => b.beat === 'along' && !(ends.home && b.region === ends.home)) : (ends?.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead'));
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
  // (its regions as the map reads them, level/grid.js: a planned map's segments, each its region, stitched)
  // (a planned map: a pack where each of its pieces stands, the passages' and the climax's: level/map-items.js)
  const mapPer = (grid) => { const G = readGrid(grid, 'level.grid'), it = mapItems(G).filter((x) => x.kind === 'pack' || x.kind === 'boss'); return G.plan && it.length ? it.length : per * Math.max(1, Object.keys(G.regions ?? {}).length - 1); };
  const perOf = (i) => (stages[i].section === 'map' ? mapPer(stages[i].manifest.level.grid) : per);
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
        // (made for party battles: its strikes in turn, its recoils, its roar, egocube/moves.js foeBattleMovesOf; held,
        // its kind's arms swung: FOE_ARMS)
        const key = G.battles?.foe !== undefined ? 'foe' : kind;
        stand({ figures, entities }, fid, fieldFigure(fref, fieldOf({ body: 'person', sheet, battle: true }, { armed: !!foeGearOf(look, key)?.right })), at, h);
        const e = entities.at(-1);
        e.rule = { ...e.rule, collideHeight: r3(statureOf({ body: 'person', sheet })) };
        return fid;
      }
      // (a beast with its other ways at a foe as its acts: a snap, a maul, its roar; egocube/moves.js beastMovesOf)
      stand({ figures, entities }, fid, foeFigure(fref, look, { battle: true }), at, h);
      // (a beast drawn at its foe's height: its body scaled, what it collides with and where it is hit with it)
      if (beastLook(look) && heightOf(G, kind) && !G.battles?.foe) {
        const H = heightOf(G, kind), m = bodyOf(look.species, { ooze: look.ooze }), k = H / Math.max(0.05, m.height), x = m.extent * k, e = entities.at(-1);
        e.body = { ...e.body, scale: r3(k), egg: { a: r3(Math.max(0.2, x * 0.3)), c: r3(H / 2), cz: r3(H / 2) } };
        e.rule = { ...e.rule, collideHeight: H, collideRadius: r3(Math.min(2.5, Math.max(0.15, x * 0.25))) };
      }
      return fid;
    });
    const boss = B.boss && k === picks.length - 1 && met[k] === B.boss;
    // (met before the goal room's exit is reached: its zone is smaller than the fight's)
    // (in a building, the room it is met in: an arena stage holds the fight to it)
    const room = ends.rooms?.find((r) => b.at[0] >= r.x && b.at[0] <= r.x + r.w && b.at[1] >= r.y && b.at[1] <= r.y + r.d);
    encounters.push({ id: `pack-${from + k + 1}`, foes: [...met[k]], at: [b.at[0], b.at[1]], who: who.length > 1 ? who : id, ...(boss ? { flee: false } : {}), ...(boss && B.bossPages ? { pages: B.bossPages.map((p) => ({ ...p })) } : {}), ...(boss && lair ? { near: 3 } : {}), ...(room ? { room: [room.x, room.y, r3(room.x + room.w), r3(room.y + room.d), room.z] } : {}) });
  });
  // THE CHESTS (chests.js): on the beats the packs leave free, spread along the way, each a step aside from it
  // (a glyph map's packs stand on its own pack marks: its chests on the beats along its way, but its home's)
  const same = (a, b) => Math.abs(a.at[0] - b.at[0]) < 0.5 && Math.abs(a.at[1] - b.at[1]) < 0.5;
  const pool = ends?.map ? (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead' && !(ends.home && b.region === ends.home)) : along;
  const nChests = chestsPer(G), freeLeft = nChests ? pool.filter((b) => !picks.some((p) => same(p, b))) : [];
  const chestSpots = Array.from({ length: Math.min(nChests, freeLeft.length) }, (_, k) => {
    const i = Math.min(freeLeft.length - 1, Math.floor(((k + 0.5) * freeLeft.length) / Math.min(nChests, freeLeft.length))), b = freeLeft[i], next = along[along.indexOf(b) + 1] ?? { at: ends.exit ?? ends.spawn };
    return { at: b.at, toward: next.at && (next.at[0] !== b.at[0] || next.at[1] !== b.at[1]) ? next.at : ends.spawn };
  });
  // (what each is called where the world names it: an era's med-kits, chests.js names the find by them)
  const named = (id) => (isObj(B.items) && B.items[id]?.name) || (isObj(B.gear) && B.gear[id]?.name) || null;
  // (locked chests' keys won from the stage's packs, never its boss; a mimic's fight beside the packs')
  const chests = chestSpots.length ? chestCast(chestSpots, { tier: tierOf(from), from: 0, seed: seed + from, named, packs: encounters.filter((e) => e.flee !== false).map((e) => e.id), ...chestKinds(G) }) : null;
  if (chests) entities.push(...chests.entities);
  if (chests?.encounters) encounters.push(...chests.encounters);
  // (a walled core's gated doors on this building, met in play: citadelLocks below)
  const locks = citadelLocks(G, stage, ends, encounters);
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
  // (a stage with chests keeps what each still holds in the store: the bag's holders, so an opened chest stays open)
  const mechanics = [{ kind: 'party', slice: PARTY_SLICE }, { kind: 'bag', slice: BAG_SLICE, ...(chestsPer(G) ? { holders: CHEST_SLICE } : {}) }, ...(rpg.rules.defeat === 'fail' ? [{ kind: 'fail-on-death', startHp: 1 }] : [])];
  if (chests) rest.push(...chests.play.cues);
  if (locks) { rest.push(...locks.cues); mechanics.push(...locks.mechanics); }
  const items = { ...(chests?.play.items ?? {}), ...(locks?.items ?? {}) };
  return { figures, entities, play: { rpg, ...(rest.length ? { cues: rest } : {}), ...(chests ? { menus: chests.play.menus } : {}), ...(Object.keys(items).length ? { items } : {}) }, mechanics };
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

// the shops a town's folk keep (no figure, no cue: the folk's own use opens them, folk-cast.js folkExtra); its temple
// where its priest raises the fallen, its smithy where its smith sells the arms and armour among the wares
const folkShops = (wares, inn, G, ends) => {
  const smithy = wares.filter((w) => GEAR_PRESETS[w] || G?.battles?.gear?.[w]);
  // (a trade's shop only where its lot's door is laid on the stage, so its keeper stands to keep it: a small town's
  // street may leave a lot on its square with no frontage)
  const laid = (t) => (ends?.townDoors ?? []).some((d) => d.id.startsWith(`town-${t}-`));
  const shops = { ...(wares.length ? { merchant: { name: 'Merchant', wares } } : {}), ...(inn != null ? { innkeeper: { name: 'Inn', inn } } : {}),
    ...(templeOf(G) && laid('temple') ? { temple: { name: 'Temple', raise: RAISE_PRICE } } : {}), ...(smithyOf(G) && laid('smithy') && smithy.length ? { smith: { name: 'Smithy', wares: smithy } } : {}) };
  return Object.keys(shops).length ? { shops, cues: [], inn: inn != null } : null;
};
// (a town whose street keeps a temple or a smithy, era/town-trades.js: the hub's level's `enter` names the trade)
const enters = (G) => [].concat(G?.levels?.[G.hub]?.places?.street?.enter ?? []);
const templeOf = (G) => enters(G).includes('temple');
const smithyOf = (G) => enters(G).includes('smithy');
/** The shops a hub's folk keep, as folk-cast.js folkExtra takes them: { merchant?, inn?, temple?, smith?: { id, prompt } }. */
export const hubFolkShops = (G) => (shopsOn(G) && G.hub ? { ...(waresFor(G, 0, HUB_WARES).length ? { merchant: { id: 'merchant', prompt: 'Shop' } } : {}), ...(innOf(G, 0) != null ? { inn: { id: 'innkeeper', prompt: 'Inn' } } : {}),
  ...(templeOf(G) ? { temple: { id: 'temple', prompt: 'Temple' } } : {}), ...(smithyOf(G) ? { smith: { id: 'smith', prompt: 'Smithy' } } : {}) } : null);
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
  const figures = {}, entities = [], shop = folk ? folkShops(wares, inn, G, ends) : shopsAt(G, ends, figures, entities, keeper, wares, inn);
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
