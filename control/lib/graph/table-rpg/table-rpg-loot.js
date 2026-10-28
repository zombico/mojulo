/**
 * THE TABLE RPG'S LOOT — arms of every kind found on the fallen, rolled from a table and made by the equipment kernel
 * (equipment/expand.js), so a hoard is a shelf of real objects: a sabre, a halberd, a hand axe, a mace, a sceptre, a
 * wand, a longbow, a shield, a carbine, each in a style, its bonus by the rank of what guarded it and its look rising
 * with it (more ornament, more stylized, a stone that glows). The rules stay portable: a loot table is a table whose
 * rows give items (table-rpg-kernel.js), a foe's `loot` the table rolled when it is beaten.
 *
 *   a table written as loot words: tables: { <id>: { name?, loot: { n?, rank?, era?, style?, forms?, seed? } } }
 *     n      how many artifacts it holds (2 to 12; 6): its die is 1dn, a row each
 *     rank   the rank of what guards it, 1 to 5 (2): the bonus (+1 at 1–2, +2 at 3–4, +3 at 5) and how rich it looks
 *     era    myth | modern | future (myth): which forms are found (a myth's blades and hafts, a modern world's guns)
 *     style  an equipment style for every piece (one of the samples' looks per piece when none)
 *     forms  the forms it may hold (LOOT_FORMS ids; every form of its era when none)
 *     seed   its own dice (the module's when none)
 *   withLoot(module) → module   each loot table written out as rows and its artifacts as items (`<table>-<k>`); an item
 *     the module writes with the same id wins field by field (an artifact recorded on it keeps the rest)
 *   LOOT_FORMS   the forms: an equipment build, the kind (weapon | armour), the faculty it strikes with, the noun
 */
import { streamOf } from '../city/plan/dice.js';
import { SEEDED_STYLES } from '../equipment/styles.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const LOOT_KEYS = ['n', 'rank', 'era', 'style', 'forms', 'seed'];
export const LOOT_ERAS = Object.freeze(['myth', 'modern', 'future']);

const F = (noun, build, extra = {}) => Object.freeze({ noun, build, kind: 'weapon', ...extra });
/** Each form an equipment build in the kernel's own words; `stone` where its focal can carry one, `eras` where found. */
export const LOOT_FORMS = Object.freeze({
  dagger: F('dagger', { item: 'dagger' }, { faculty: 'agility', stone: 'pommel' }),
  sword: F('sword', { item: 'sword' }, { stone: 'guard' }),
  sabre: F('sabre', { item: 'sword', parts: { blade: 'sabre' } }, { faculty: 'agility', stone: 'pommel' }),
  falchion: F('falchion', { item: 'sword', parts: { blade: 'cleaver' } }, { stone: 'guard' }),
  greatsword: F('greatsword', { item: 'greatsword' }, { stone: 'guard' }),
  flamberge: F('flamberge', { item: 'greatsword', parts: { blade: 'flamberge' } }, { stone: 'pommel' }),
  spear: F('spear', { item: 'staff', parts: { head: 'spear' } }, { faculty: 'agility' }),
  halberd: F('halberd', { item: 'staff', parts: { head: 'halberd' } }),
  axe: F('axe', { item: 'staff', parts: { head: 'axe', reach: 'arm' } }),
  mace: F('mace', { item: 'staff', parts: { head: 'mace', reach: 'arm' } }),
  maul: F('maul', { item: 'staff', parts: { head: 'mace' }, dials: { mass: 1.6 } }),
  quarterstaff: F('quarterstaff', { item: 'staff', parts: { head: 'plain' } }, { faculty: 'agility' }),
  sceptre: F('sceptre', { item: 'staff', parts: { head: 'ringed', reach: 'arm' } }, { faculty: 'presence' }),
  wand: F('wand', { item: 'staff', parts: { head: 'claw', reach: 'wand', focus: 'head' } }, { faculty: 'wits', stone: 'head', needs: true }),
  rod: F('rod', { item: 'staff', parts: { head: 'block', reach: 'arm', focus: 'head' } }, { faculty: 'insight', stone: 'head', needs: true }),
  'staff of power': F('staff', { item: 'staff', parts: { head: 'crescent', focus: 'head' } }, { faculty: 'wits', stone: 'head', needs: true }),
  longbow: F('longbow', { item: 'bow', parts: { limb: 'longbow' } }, { faculty: 'agility', stone: 'riser' }),
  recurve: F('recurve bow', { item: 'bow', parts: { limb: 'recurve' } }, { faculty: 'agility', stone: 'riser' }),
  shield: F('shield', { item: 'shield', parts: { outline: 'heater' } }, { kind: 'armour', stone: 'boss' }),
  buckler: F('buckler', { item: 'shield', parts: { outline: 'round' } }, { kind: 'armour', stone: 'boss' }),
  pistol: F('pistol', { item: 'pistol' }, { faculty: 'agility', eras: ['modern', 'future'] }),
  carbine: F('carbine', { item: 'carbine' }, { faculty: 'agility', eras: ['modern', 'future'] }),
  shotgun: F('shotgun', { item: 'shotgun' }, { eras: ['modern', 'future'] }),
});
// a modern world keeps a knife, a club and a shield beside its guns
const MODERN_TOO = new Set(['dagger', 'mace', 'buckler']);
const formsOf = (era) => Object.keys(LOOT_FORMS).filter((f) => (LOOT_FORMS[f].eras ? LOOT_FORMS[f].eras.includes(era) : era === 'myth' || MODERN_TOO.has(f)));
// a style in a word, as a name says it
const STYLE_WORD = { historical: 'old', elven: 'elven', dwarven: 'dwarven', brutal: 'cruel', eastern: 'eastern', 'anime-hero': 'bright', druid: 'living', celestial: 'starlit' };
const GEMS = ['quartz', 'amethyst', 'ruby', 'sapphire', 'tourmaline', 'opal', 'diamond'];
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

export function readLoot(L, at) {
  if (!isObj(L)) throw new Error(`table rpg: ${at}.loot is { ${LOOT_KEYS.join(', ')} }`);
  for (const k of Object.keys(L)) if (!LOOT_KEYS.includes(k)) throw new Error(`table rpg: ${at}.loot.${k} is not a loot word (${LOOT_KEYS.join(', ')})`);
  if (L.n !== undefined && !(Number.isInteger(L.n) && L.n >= 2 && L.n <= 12)) throw new Error(`table rpg: ${at}.loot.n is 2 to 12: the artifacts it holds`);
  if (L.rank !== undefined && !(Number.isInteger(L.rank) && L.rank >= 1 && L.rank <= 5)) throw new Error(`table rpg: ${at}.loot.rank is 1 to 5: the rank of what guards it`);
  if (L.era !== undefined && !LOOT_ERAS.includes(L.era)) throw new Error(`table rpg: ${at}.loot.era is ${LOOT_ERAS.join(', ')}`);
  if (L.style !== undefined && !(typeof L.style === 'string' ? SEEDED_STYLES[L.style] : isObj(L.style))) throw new Error(`table rpg: ${at}.loot.style is an equipment style (${Object.keys(SEEDED_STYLES).join(', ')}) or a card`);
  if (L.forms !== undefined && !(Array.isArray(L.forms) && L.forms.length && L.forms.every((f) => LOOT_FORMS[f]))) throw new Error(`table rpg: ${at}.loot.forms are some of ${Object.keys(LOOT_FORMS).join(', ')}`);
  if (L.seed !== undefined && !(Number.isInteger(L.seed) && L.seed >= 0)) throw new Error(`table rpg: ${at}.loot.seed is a whole number`);
  return L;
}

/** A loot table's artifacts: [{ id, item }], each a form in a style, its bonus and its look by the rank. */
export function rollLoot(tableId, L, seed) {
  const n = L.n ?? 6, rank = L.rank ?? 2, era = L.era ?? 'myth', bonus = Math.min(3, 1 + Math.floor((rank - 1) / 2));
  const r = streamOf(L.seed ?? seed, 'table-loot', tableId), pool = [...(L.forms ?? formsOf(era))], styles = Object.keys(SEEDED_STYLES);
  const out = [];
  for (let k = 1; k <= n; k++) {
    // each form once until the pool runs dry, then again
    if (!pool.length) pool.push(...(L.forms ?? formsOf(era)));
    const form = pool.splice(Math.floor(r() * pool.length), 1)[0], Fm = LOOT_FORMS[form];
    const firearm = !!Fm.eras, style = firearm ? (era === 'future' ? 'future' : 'service') : L.style ?? pick(r, styles);
    // the richer the guard, the richer the look: ornament and stylize rise with the bonus, a stone from +2 (always on a
    // form whose head cradles one), glowing more the higher
    const stone = Fm.stone && (Fm.needs || bonus >= 2) ? { gem: pick(r, GEMS), glow: Math.min(1, 0.25 * bonus) } : null;
    const build = {
      ...Fm.build, style,
      ...(firearm ? {} : { dials: { ...(Fm.build.dials ?? {}), stylize: Math.min(1, 0.25 + 0.15 * bonus), ornament: bonus } }),
      ...(stone ? { gem: stone, parts: { ...(Fm.build.parts ?? {}), focus: Fm.stone } } : {}),
      seed: 1 + Math.floor(r() * 1e6),
    };
    const word = typeof style === 'string' ? STYLE_WORD[style] ?? style : style.id ?? 'strange';
    const name = `the ${stone ? `${stone.gem}-set ` : ''}${firearm ? '' : `${word} `}${Fm.noun}`;
    out.push({ id: `${tableId}-${k}`, item: { name, kind: Fm.kind, bonus, ...(Fm.faculty ? { faculty: Fm.faculty } : {}), build, text: `${firearm ? `A ${style === 'future' ? 'smooth, pale' : 'plain service'} ${Fm.noun}` : `A ${word} ${Fm.noun}`}${stone ? `, a ${stone.gem} in its ${Fm.stone}` : ''}.` } });
  }
  return out;
}

export function withLoot(module) {
  const tables = module.tables ?? {};
  if (!Object.values(tables).some((T) => T?.loot !== undefined)) return module;
  const seed = module.seed ?? 1, items = { ...(module.items ?? {}) }, out = {};
  for (const [id, T] of Object.entries(tables)) {
    if (T?.loot === undefined) { out[id] = T; continue; }
    if (T.rows !== undefined) throw new Error(`table rpg: table '${id}' is loot words or rows, not both`);
    const L = readLoot(T.loot, `tables.${id}`), found = rollLoot(id, L, seed);
    for (const { id: iid, item } of found) items[iid] = { ...item, ...(module.items?.[iid] ?? {}) };
    out[id] = { name: T.name ?? 'Loot', die: `1d${found.length}`, rows: found.map(({ id: iid }, k) => ({ on: k + 1, text: `${cap(items[iid].name)}.`, item: iid })), loot: L };
  }
  return { ...module, tables: out, items };
}
const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
