/**
 * THE ROUND'S ERAS — a party RPG's round in its setting's era (cast-setting.js settingOfGame: the world's kit's era). The
 * round's numbers are the presets' (playscape/rpg/presets.js: each foe's, item's and gear's stats, prices and drops, so
 * the ladder, the shops, the chests and the packs compose unchanged); an era RESKINS them: what each is called, how each
 * foe looks (a character door's words: a beast grown by an ooze, a people), what the round's people foes hold, the boss,
 * and the buildings its citadel is built of. A fantasy era (rustic, myth) is the presets as they are: no row.
 *
 *   ROUND_ERAS      era → { foes: { <kind>: { name, look } }, items: { <id>: name }, gear: { <id>: name },
 *                   citadel: { gate, vault, core, kit }, place: its levels' name word, says }   (its bosses are among its
 *                   foes: round-bosses.js)   (a foe in an era's look holds no kind's arms:
 *                   battles.js FOE_ARMS are the presets' looks')
 *   roundEraOf(era) → the era's row, or null (a fantasy era)
 *   eraBattles(row) → the battles' own rows for it: { looks, foes, items, gear } (every preset written, renamed where the
 *                   era renames it, true where it keeps it: a named table stands for the whole list)
 *
 * A new era is a row. Pure.
 */
import { FOE_PRESETS, ITEM_PRESETS, GEAR_PRESETS } from '../playscape/rpg/presets.js';

export const ROUND_ERAS = Object.freeze({
  // A FUTURE round (an alien world, a starship's): machines grown in an animal's shape, the hive's insect people, troopers
  future: Object.freeze({
    says: 'machines in an animal\'s shape, the hive and its troopers; med-kits and energy cells; a lab for its vault',
    place: 'colony',
    foes: Object.freeze({
      slime: { name: 'Nanite Blob', look: { species: 'frog', ooze: 'techno' } },
      bat: { name: 'Scout Drone', look: { species: 'fruitBat', ooze: 'techno' } },
      wolf: { name: 'Hound Unit', look: { species: 'wolf', ooze: 'transmetal' } },
      spider: { name: 'Crawler Bot', look: { species: 'rat', ooze: 'techno' } },
      shroom: { name: 'Spore Pod', look: { species: 'frog', ooze: 'venom' } },
      wisp: { name: 'Plasma Wisp', look: { species: 'greatHornedOwl', ooze: 'storm' } },
      golem: { name: 'Heavy Mech', look: { species: 'brownBear', ooze: 'techno' } },
      drake: { name: 'Core Sentinel', look: { species: 'velociraptor', ooze: 'transmetal' } },
      goblin: { name: 'Hive Drone', look: { people: 'insectoid' } },
      shaman: { name: 'Hive Mind', look: { people: 'insectoid' } },
      skeleton: { name: 'Trooper', look: { people: 'human' } },
      zombie: { name: 'Infected', look: { people: 'zombie' } },
      bandit: { name: 'Raider' },
      // (the story's bosses, round-bosses.js)
      leviathan: { name: 'Abyssal Leviathan', look: { species: 'seaSerpent', ooze: 'techno' } },
      champion: { name: 'Arena Champion', look: { people: 'human' } },
      warlord: { name: 'Hive Warlord', look: { people: 'insectoid' } },
      roc: { name: 'Storm Drone', look: { species: 'baldEagle', ooze: 'techno' } },
      colossus: { name: 'Titan Mech', look: { species: 'mammoth', ooze: 'transmetal' } },
    }),
    items: Object.freeze({ potion: 'Med-kit', 'hi-potion': 'Trauma Kit', ether: 'Energy Cell', antidote: 'Antitoxin', remedy: 'Nanocure', feather: 'Revive Shot', firebomb: 'Plasma Grenade' }),
    gear: Object.freeze({ 'bronze-sword': 'Shock Baton', 'iron-sword': 'Plasma Blade', 'oak-staff': 'Focus Rod', 'silver-staff': 'Psi Rod', cestus: 'Power Gauntlet', 'leather-armor': 'Flak Vest', 'chain-mail': 'Combat Armour', robe: 'Field Suit', gi: 'Flex Suit', 'swift-ring': 'Servo Ring', 'mana-charm': 'Psi Chip' }),
    citadel: Object.freeze({ gate: 'barracks', vault: 'lab', core: 'command', kit: 'research-lab' }),
  }),
  // A MODERN round (today's town and its wilds): strays and vermin, thugs and their boss
  modern: Object.freeze({
    says: 'strays, vermin and thugs; first-aid kits and energy drinks; a warehouse for its vault',
    place: 'riverside',
    foes: Object.freeze({
      slime: { name: 'Sludge', look: { species: 'frog', ooze: 'venom' } },
      bat: { name: 'Bat', look: { species: 'fruitBat' } },
      wolf: { name: 'Stray Dog', look: { species: 'wolf', ooze: 'dire' } },
      spider: { name: 'Sewer Rat', look: { species: 'rat', ooze: 'venom' } },
      shroom: { name: 'Toxic Toad', look: { species: 'frog', ooze: 'venom' } },
      wisp: { name: 'Night Owl', look: { species: 'greatHornedOwl', ooze: 'shadow' } },
      golem: { name: 'Bruiser', look: { people: 'human' } },
      drake: { name: 'The Boss', look: { people: 'human' } },
      goblin: { name: 'Thug', look: { people: 'human' } },
      shaman: { name: 'Cult Leader', look: { people: 'human' } },
      skeleton: { name: 'Enforcer', look: { people: 'human' } },
      zombie: { name: 'Infected', look: { people: 'zombie' } },
      bandit: { name: 'Mugger' },
      leviathan: { name: 'Lake Monster', look: { species: 'seaSerpent', ooze: 'venom' } },
      champion: { name: 'The Champ', look: { people: 'human' } },
      warlord: { name: 'The Kingpin', look: { people: 'human' } },
      roc: { name: 'Giant Condor', look: { species: 'vulture', ooze: 'storm' } },
      colossus: { name: 'Wrecking Bot', look: { species: 'mammoth', ooze: 'techno' } },
    }),
    items: Object.freeze({ potion: 'First-aid Kit', 'hi-potion': 'Trauma Kit', ether: 'Energy Drink', antidote: 'Antidote', remedy: 'Medicine', feather: 'Adrenaline Shot', firebomb: 'Flashbang' }),
    gear: Object.freeze({ 'bronze-sword': 'Baseball Bat', 'iron-sword': 'Crowbar', 'oak-staff': 'Walking Stick', 'silver-staff': 'Steel Cane', cestus: 'Knuckle Dusters', 'leather-armor': 'Leather Jacket', 'chain-mail': 'Kevlar Vest', robe: 'Hoodie', gi: 'Track Suit', 'swift-ring': 'Running Shoes', 'mana-charm': 'Lucky Charm' }),
    citadel: Object.freeze({ gate: 'guardhouse', vault: 'warehouse', core: 'office', kit: 'research-lab' }),
  }),
});
export const ROUND_ERA_IDS = Object.freeze(Object.keys(ROUND_ERAS));

export const roundEraOf = (era) => ROUND_ERAS[era] ?? null;

/** The battles' own rows an era writes: each foe's look and name, every preset item and gear, renamed where it says. */
export function eraBattles(row) {
  const renamed = (presets, names) => Object.fromEntries(Object.keys(presets).map((k) => [k, names[k] ? { ...structuredClone(presets[k]), name: names[k] } : true]));
  const looks = Object.fromEntries(Object.entries(row.foes).filter(([, f]) => f.look).map(([k, f]) => [k, structuredClone(f.look)]));
  const foes = Object.fromEntries(Object.entries(row.foes).filter(([k]) => FOE_PRESETS[k]).map(([k, f]) => [k, { ...structuredClone(FOE_PRESETS[k]), name: f.name }]));
  return { looks, foes, items: renamed(ITEM_PRESETS, row.items), gear: renamed(GEAR_PRESETS, row.gear) };
}
