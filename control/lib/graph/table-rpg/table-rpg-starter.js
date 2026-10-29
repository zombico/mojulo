/**
 * THE STARTER — a whole table game from a few words, to be edited in place: `starter: { use, seed?, town? }` on a
 * module fills what the module leaves out. A town, two days of road with a table rolled each day, and a dungeon drawn
 * from a building's program (table-rpg-program.js: a crypt, a keep, a temple …) with its minions, the boss in its goal
 * room guarding the prize, its key off the way and an ARTIFACT beside it (a weapon or a shield in the building's arms
 * style, table-rpg-gear.js), and a wandering table; the goal is to bring the prize back. What the
 * module writes itself is kept: a starter never overwrites a key; its foes and items sit beside the module's, an entry
 * of the same id merged field by field, the module's winning.
 *
 * And CHARACTER CREATION when the module names no party: three members rolled as a frontline, a flanker and a support,
 * each a persona on the egocube (who they are) and a sheet rolled by the rules card (what they can do), so the party
 * is the game's own from its seed.
 *
 *   withStarter(module) → module   the module with its starter's parts and a party filled in where absent
 *   STARTER_PARTY                  the roles the party is rolled in when the module names none
 */
import { dungeonFromProgram } from './table-rpg-program.js';

export const STARTER_PARTY = Object.freeze(['frontline', 'flanker', 'support']);

// a program's foes as the table names them: a minion and the boss in the goal room
const FOES_OF = {
  crypt: ['Restless Dead', 'Barrow Lord'], tomb: ['Restless Dead', 'Barrow Lord'], keep: ['Man-at-Arms', 'Castellan'],
  temple: ['Zealot', 'High Priest'], tavern: ['Thug', 'Boss'], guardhouse: ['Guard', 'Captain'], library: ['Living Book', 'Archivist'],
  lab: ['Escaped Experiment', 'Director'], tower: ['Sentry', 'Warden'],
};
// the arms a building's people would carry (an equipment style sample) and the ARTIFACT kept with its key: a weapon or a
// shield the party may take up before the boss, its look the equipment kernel's words in that style
const STYLE_OF = { crypt: 'historical', tomb: 'eastern', keep: 'dwarven', temple: 'celestial', tower: 'elven', library: 'druid', tavern: 'brutal', guardhouse: 'historical' };
const RELIC_OF = {
  crypt: { name: 'the barrow blade', kind: 'weapon', bonus: 1, text: 'A leaf-bladed sword with a cold blue stone in the guard.', build: { item: 'sword', parts: { blade: 'leaf' }, gem: 'sapphire' } },
  tomb: { name: 'the sleeper\'s blade', kind: 'weapon', bonus: 1, text: 'Pattern-welded, and quiet in the hand.', build: { item: 'sword' } },
  keep: { name: 'the warden\'s shield', kind: 'armour', bonus: 1, text: 'A heater shield with the keep\'s chevron.', build: { item: 'shield', parts: { outline: 'heater', device: 'chevron' } } },
  temple: { name: 'the rite staff', kind: 'weapon', bonus: 1, faculty: 'insight', text: 'A crescent head around a clear stone.', build: { item: 'staff', parts: { head: 'crescent', focus: 'head' }, gem: 'diamond' } },
  tower: { name: 'the watcher\'s bow', kind: 'weapon', bonus: 1, faculty: 'agility', text: 'Light, and taller than its archer.', build: { item: 'bow' } },
  library: { name: 'the reader\'s staff', kind: 'weapon', bonus: 1, faculty: 'wits', text: 'A branch that kept growing after it was cut.', build: { item: 'staff', parts: { head: 'branch', focus: 'head' }, gem: { gem: 'quartz', cut: 'natural' } } },
  lab: { name: 'the prototype', kind: 'weapon', bonus: 1, faculty: 'agility', text: 'Nobody signed it out.', build: { item: 'carbine', style: 'future' } },
};
const RELIC = { name: 'the old blade', kind: 'weapon', bonus: 1, text: 'Older than the place it was left in.', build: { item: 'sword' } };
// the era a building's loot is of (table-rpg-loot.js): a lab's arms are the future's
const ERA_OF = { lab: 'future' };
// the fantasy a building lends the beasts of its cast (mutagen/oozes/)
const OOZE_OF = { crypt: 'skeletal', tomb: 'zombie', lab: 'techno' };
const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const words = (s) => String(s).replace(/[-_]/g, ' ');

function starterParts({ use, seed = 1, town = 'Hollowmere' }) {
  const [minion, boss] = FOES_OF[use] ?? ['Prowler', 'Master'];
  const { dungeon, items } = dungeonFromProgram({ use, seed, foes: { minion: slug(minion), boss: slug(boss) } });
  const goalRoom = dungeon.rooms.find((r) => r.id === dungeon.goal);
  goalRoom.items = [...(goalRoom.items ?? []), 'prize'];
  // the artifact lies with the key, off the way: found, it can be taken up before the boss
  const keyRoom = dungeon.rooms.find((r) => (r.items ?? []).some((x) => items[typeof x === 'string' ? x : x.item]?.kind === 'key')) ?? goalRoom;
  keyRoom.items = [...(keyRoom.items ?? []), 'relic'];
  const did = slug(use), place = slug(`${use} site`), home = slug(town);
  return {
    hook: `Something is kept in the ${words(dungeon.goal)} of the ${words(use)} beyond ${town}, and the folk there want it brought out.`,
    goal: { item: 'prize' },
    ending: `The prize is out of the ${words(use)}, and ${town} sleeps easier.`,
    world: {
      start: home,
      places: [
        { id: home, name: town, kind: 'town', text: `A small town at the edge of the map, where the work begins.` },
        { id: 'crossroads', name: 'the Crossroads', kind: 'landmark', text: 'A worn stone marks where the roads part.' },
        { id: place, name: `the ${cap(words(use))}`, kind: 'dungeon', text: `The way into the ${words(use)}.`, dungeon: did },
      ],
      routes: [{ a: home, b: 'crossroads', days: 1, danger: 'road' }, { a: 'crossroads', b: place, days: 1, danger: 'road' }],
    },
    dungeons: { [did]: { ...dungeon, wander: 'wander' } },
    // the boss keeps a hoard and the road's bandits their spoils, arms of every kind rolled by the loot words
    // (table-rpg-loot.js), a lab's of the future
    foes: { [slug(minion)]: { name: minion, rank: 1 }, [slug(boss)]: { name: boss, rank: 3, text: `the ${words(use)}'s master`, loot: 'hoard' }, bandit: { name: 'Bandit', rank: 1, loot: 'spoils' } },
    ...(STYLE_OF[use] ? { gear: { style: STYLE_OF[use] } } : {}),
    items: { ...items, relic: RELIC_OF[use] ?? RELIC, prize: { name: 'the prize', kind: 'treasure', text: 'What the town sent you for.' }, salve: { name: 'a salve', kind: 'heal', heal: 'some' } },
    tables: {
      road: { name: 'On the road', die: '1d6', rows: [
        { on: 1, text: 'Bandits step out of the brush.', foes: ['bandit', 'bandit'] },
        { on: 2, text: 'A traveller trades you a salve.', item: 'salve' },
        { on: [3, 6], text: 'The road is quiet.' },
      ] },
      hoard: { name: `The ${boss.toLowerCase()}'s hoard`, loot: { n: 6, rank: 3, era: ERA_OF[use] ?? 'myth' } },
      spoils: { name: 'Bandit spoils', loot: { n: 4, rank: 1, era: ERA_OF[use] ?? 'myth' } },
      wander: { name: `In the ${words(use)}`, die: '1d6', rows: [
        { on: 1, text: `A ${minion.toLowerCase()} finds you.`, foes: [slug(minion)] },
        { on: [2, 6], text: 'Only the dark, and your own breath.' },
      ] },
    },
  };
}

export function withStarter(module) {
  let out = module;
  if (module.starter !== undefined) {
    const S = module.starter;
    if (!S || typeof S !== 'object' || typeof S.use !== 'string') throw new Error('table rpg: starter is { use: <a building program: crypt, keep, temple, tavern …>, seed?, town? }');
    for (const k of Object.keys(S)) if (!['use', 'seed', 'town'].includes(k)) throw new Error(`table rpg: starter.${k} is not a setting (use, seed, town)`);
    const parts = starterParts({ ...S, seed: S.seed ?? module.seed ?? 1 });
    const rest = { ...module };
    delete rest.starter;
    out = { ...parts, ...rest };
    // the starter's foes and items are kept beside the module's, an entry the module writes winning field by field (a
    // character or an artifact recorded on the starter's boss or its relic keeps the rest of it)
    for (const k of ['foes', 'items']) if (rest[k]) out[k] = { ...parts[k], ...Object.fromEntries(Object.entries(rest[k]).map(([id, v]) => [id, { ...(parts[k][id] ?? {}), ...v }])) };
    // a cast takes the starter's people: the boss leads it, the minions are its troops, the road's bandits the rival's
    // and a beast of the cast takes the building's fantasy (a crypt's bone, a lab's machine)
    if (module.cast) {
      const [minion, boss] = FOES_OF[S.use] ?? ['Prowler', 'Master'], own = module.cast === true ? {} : module.cast;
      out.cast = { ...own, ...(own.as ? {} : { as: { mastermind: slug(boss), troop: slug(minion), hand: 'bandit' } }), ...(own.ooze === undefined && OOZE_OF[S.use] ? { ooze: OOZE_OF[S.use] } : {}) };
    }
  }
  if (out.party === undefined) out = { ...out, party: STARTER_PARTY.map((role, i) => ({ id: `pc-${i + 1}`, egocube: { facets: { role } } })) };
  return out;
}
