/**
 * A BOARD BATTLE — who fights on a board, read from the party battles' own book (playscape/rpg: its classes, skills,
 * foes, items and gear, the presets or a world's own), with what only a board needs added: how far each one moves and
 * climbs, and the shape of each skill on the spots. The party battles' pages keep every byte: nothing here touches
 * their kernel or their presets.
 *
 *   battle: {
 *     party: [{ id, class, at, level?, name?, face?, skills?: [extra skill ids] }]   the party's members, in classes
 *     foes:  [{ id, foe, at, name?, face? }]                                           foes by their preset (or rpg.foes) id
 *     guests?: [{ id, class, at, level?, name? }]    allies the mind plays, on the party's team (a guest to protect)
 *     deploy?: ['A1', 'B1:C2']   the spots the party is placed on before the first turn (then a member's `at` may be
 *              left out: the player places it, or it takes the next free deploy spot); cap?: how many may fight
 *     bag?:  { <item>: count }       what the party may use (two potions by default, as the book's bag starts)
 *     rpg?:  { classes?, skills?, foes?, items?, gear? }   the world's own definitions, as play.rpg takes them
 *     board?: { classes?: { <class>: { move, jump } }, foes?: { <foe>: { move, jump } },
 *               skills?: { <skill>: shape }, items?: { <item>: shape } }   over the board's own numbers below
 *     seed?, rules?                  the board kernel's: facing, height, cap, win, lose, permadeath (board-kernel.js)
 *   }
 *   shape: { min, max, kind, area, v } (board-kernel.js)
 *
 *   readBoardBattle(spec) → { cfg, units, rpg, deploy?, cap? }   the kernel's cfg and start units (each foe's loot: its
 *     xp, gold, class points and drops); rpg, the party battles' cfg read; deploy, the deploy spots by name
 *   BOARD_CLASSES, BOARD_FOES   how far each moves (spots) and climbs (height steps)
 *   skillShape(skill)          a skill's shape on the board, from what it is: a blow reaches the next spot, a spell
 *                               four, a mending three; on every foe or ally, an area round the spot aimed at
 */
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgStatsOf, rpgUsable } from '../playscape/rpg/kernel.js';

// a class's legs: the front line steps far and climbs, the caster and the healer less, the quick one furthest
export const BOARD_CLASSES = Object.freeze({
  fighter: { move: 4, jump: 3 }, knight: { move: 3, jump: 2 }, mage: { move: 3, jump: 2 },
  cleric: { move: 3, jump: 2 }, rogue: { move: 5, jump: 3 }, monk: { move: 4, jump: 4 },
});
const CLASS_LEGS = { move: 4, jump: 2 };
// a foe's: the flyers climb anything, the heavy ones barely
export const BOARD_FOES = Object.freeze({
  slime: { move: 3, jump: 1 }, bat: { move: 5, jump: 9 }, wolf: { move: 5, jump: 3 }, spider: { move: 4, jump: 4 },
  skeleton: { move: 3, jump: 2 }, wisp: { move: 4, jump: 9 }, golem: { move: 3, jump: 1 }, drake: { move: 4, jump: 4 },
});
const FOE_LEGS = { move: 4, jump: 2 };
// the skills whose shape is not what they are: a sweep round the one struck, a storm wider, a cloud round the caster
const SKILL_SHAPES = Object.freeze({
  cleave: { min: 1, max: 1, area: 1, v: 2 },
  firestorm: { min: 1, max: 4, area: 2, v: 3 },
  'fire-breath': { min: 1, max: 3, area: 1, v: 3 },
  'heal-all': { min: 0, max: 0, area: 2, v: 3 },
  rally: { min: 0, max: 0, area: 2, v: 3 },
  smoke: { min: 0, max: 0, area: 2, v: 3 },
  spores: { min: 0, max: 0, area: 2, v: 3 },
});
const ITEM_SHAPES = Object.freeze({ firebomb: { min: 1, max: 4, area: 1, v: 3 } });
const PARTY_BAG = Object.freeze({ potion: 2 });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const RULE_KEYS = ['facing', 'height', 'heightCap', 'cap', 'win', 'lose', 'permadeath', 'player'];
// the kernel's rules, checked: who wins and loses how, and the countdown
function readRules(r, ids) {
  if (!isObj(r)) no(`rules are { ${RULE_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(r)) if (!RULE_KEYS.includes(k)) no(`rules.${k} is not a battle rule (rules: ${RULE_KEYS.join(', ')})`);
  const named = (x, at) => { for (const id of Array.isArray(x) ? x : [x]) if (!ids.has(id)) no(`${at} names '${id}', who is not in this battle`); };
  if (r.win !== undefined && r.win !== 'all') {
    if (!isObj(r.win) || (r.win.leader === undefined) === (r.win.survive === undefined)) no("rules.win is 'all', { leader: id | [ids] } or { survive: turns }");
    if (r.win.leader !== undefined) named(r.win.leader, 'rules.win.leader');
    if (r.win.survive !== undefined && !(Number.isInteger(r.win.survive) && r.win.survive >= 1)) no('rules.win.survive is a number of turns');
  }
  if (r.lose !== undefined) { if (!isObj(r.lose) || r.lose.leader === undefined) no('rules.lose is { leader: id | [ids] }: the battle is lost when any of them falls'); named(r.lose.leader, 'rules.lose.leader'); }
  if (r.permadeath !== undefined && !(Number.isInteger(r.permadeath) && r.permadeath >= 0 && r.permadeath <= 9)) no('rules.permadeath is the turns a fallen unit waits to be raised before it is lost, 0 (off) to 9');
}
const no = (m) => { throw new Error(`board battle: ${m}`); };
const SHAPE_KEYS = ['min', 'max', 'kind', 'area', 'v'];

/** A skill's shape on the board, from what it is (the party battles' read of it). */
export function skillShape(sk) {
  if (sk.target === 'self') return { min: 0, max: 0, kind: 'diamond', area: 0, v: 0 };
  const blow = sk.stat === 'atk' && sk.harm, many = sk.target === 'foes' || sk.target === 'allies';
  if (sk.revive) return { min: 1, max: 3, kind: 'diamond', area: 0, v: 3 };
  if (sk.target === 'ally' || sk.target === 'allies') return { min: 0, max: 3, kind: 'diamond', area: many ? 1 : 0, v: 3 };
  if (blow) return { min: 1, max: 1, kind: 'diamond', area: many ? 1 : 0, v: 2 };
  return { min: 1, max: 4, kind: 'diamond', area: many ? 1 : 0, v: 3 };
}
function readShape(v, at) {
  if (!isObj(v)) no(`${at} is { ${SHAPE_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(v)) if (!SHAPE_KEYS.includes(k)) no(`${at}.${k} is not a shape setting (settings: ${SHAPE_KEYS.join(', ')})`);
  for (const k of ['min', 'max', 'area', 'v']) if (v[k] !== undefined && !(Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= 12)) no(`${at}.${k} is a whole number of spots (or height steps), 0 to 12`);
  if (v.kind !== undefined && !['diamond', 'line'].includes(v.kind)) no(`${at}.kind is 'diamond' or 'line'`);
  return v;
}
function readLegs(v, at) {
  if (!isObj(v)) no(`${at} is { move, jump }`);
  for (const k of Object.keys(v)) if (!['move', 'jump'].includes(k)) no(`${at}.${k}: legs are { move, jump }`);
  for (const k of ['move', 'jump']) if (v[k] !== undefined && !(Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= 12)) no(`${at}.${k} is a whole number, 0 to 12`);
  return v;
}

export function readBoardBattle(spec = {}) {
  if (!isObj(spec)) no('a battle is { party, foes, bag?, rpg?, board?, seed?, rules? }');
  const KEYS = ['party', 'foes', 'guests', 'deploy', 'cap', 'bag', 'rpg', 'board', 'seed', 'rules'];
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a battle setting (settings: ${KEYS.join(', ')})`);
  const foes = spec.foes ?? [], guests = spec.guests ?? [];
  if (!Array.isArray(guests)) no('guests are [{ id, class, at }]: allies the mind plays');
  const deploy = spec.deploy;
  if (deploy !== undefined && !(Array.isArray(deploy) && deploy.length && deploy.every((x) => typeof x === 'string'))) no('deploy is the spots the party starts on: [\'A1\', \'B1:C2\']');
  if (spec.cap !== undefined && !(Number.isInteger(spec.cap) && spec.cap >= 1 && spec.cap <= 12)) no('cap is how many of the party may fight, 1 to 12');
  const party = (spec.party ?? []).slice(0, spec.cap ?? Infinity);
  if (!Array.isArray(party) || !party.length) no('party is [{ id, class, at, level? }]: who fights for the player');
  if (!Array.isArray(foes) || !foes.length) no('foes are [{ id, foe, at }]: who stands against them');
  const ids = new Set();
  for (const [k, x, placed] of [...party.map((p, i) => [`party[${i}]`, p, !!deploy]), ...guests.map((g, i) => [`guests[${i}]`, g, false]), ...foes.map((f, i) => [`foes[${i}]`, f, false])]) {
    if (!isObj(x) || typeof x.id !== 'string' || !x.id) no(`${k} needs an id`);
    if (ids.has(x.id)) no(`two units are '${x.id}'`);
    ids.add(x.id);
    if (x.at === undefined && !placed) no(`${k} ('${x.id}') needs a spot to stand on: at: 'C4'${k.startsWith('party') ? ' (or the battle\'s deploy spots)' : ''}`);
  }
  if (spec.rules !== undefined) readRules(spec.rules, ids);
  const B = spec.board ?? {};
  if (!isObj(B)) no('board is { classes?, foes?, skills?, items? }: the board\'s numbers over its own');
  for (const k of Object.keys(B)) if (!['classes', 'foes', 'skills', 'items'].includes(k)) no(`board.${k} is not a board table (tables: classes, foes, skills, items)`);
  for (const t of ['skills', 'items']) if (B[t] !== undefined) { if (!isObj(B[t])) no(`board.${t} is { <id>: shape }`); for (const [k, v] of Object.entries(B[t])) readShape(v, `board.${t}.${k}`); }
  for (const t of ['classes', 'foes']) if (B[t] !== undefined) { if (!isObj(B[t])) no(`board.${t} is { <id>: { move, jump } }`); for (const [k, v] of Object.entries(B[t])) readLegs(v, `board.${t}.${k}`); }
  const W = spec.rpg ?? {};
  if (!isObj(W)) no('rpg is { classes?, skills?, foes?, items?, gear? }: the world\'s own, as play.rpg takes them');
  for (const k of Object.keys(W)) if (!['classes', 'skills', 'foes', 'items', 'gear'].includes(k)) no(`rpg.${k} is not a book a battle takes (books: classes, skills, foes, items, gear)`);

  // the party battles' read: the party in its classes, every foe in one encounter, the extra skills wanted
  const extra = [...new Set([...(spec.party ?? []), ...guests].flatMap((p) => p.skills ?? []))];
  const members = [...party, ...guests];
  const rpg = readRpg({ rpg: { ...W, party: members.map((p) => ({ id: p.id, class: p.class, ...(p.level !== undefined ? { level: p.level } : {}), ...(p.name !== undefined ? { name: p.name } : {}) })),
    encounters: [{ id: 'board', foes: [...new Set(foes.map((f) => f.foe))] }], ...(extra.length ? { skills: { ...Object.fromEntries(extra.map((k) => [k, true])), ...(W.skills ?? {}) } } : {}) } });
  const R = rpgInit(rpg);

  const legs = (table, own, key, base, at) => ({ ...base, ...(table[key] ?? {}), ...(own?.[key] ? readLegs(own[key], at) : {}) });
  const units = [];
  for (const p of members) {
    const guest = guests.includes(p), S = rpgStatsOf(rpg, R, p.id), M = R.m[p.id], L = legs(BOARD_CLASSES, B.classes, rpg.party.find((x) => x.id === p.id).cls, CLASS_LEGS, `board.classes.${p.class}`);
    for (const k of p.skills ?? []) if (!rpg.skills[k]) no(`party '${p.id}' has the skill '${k}', which no book defines`);
    units.push({ id: p.id, name: rpg.party.find((x) => x.id === p.id).name, side: guest ? 'guest' : 'party', ...(p.at !== undefined ? { at: p.at } : {}), ...(p.face !== undefined ? { face: p.face } : {}),
      move: L.move, jump: L.jump, hp: M.hp, hpMax: S.hp, mp: M.mp, mpMax: S.mp, atk: S.atk, def: S.def, mag: S.mag, spd: S.spd,
      skills: [...new Set([...rpgUsable(rpg, R, p.id), ...(p.skills ?? [])])], class: rpg.party.find((x) => x.id === p.id).cls });
  }
  for (const f of foes) {
    const F = rpg.foes[f.foe], L = legs(BOARD_FOES, B.foes, f.foe, FOE_LEGS, `board.foes.${f.foe}`);
    units.push({ id: f.id, name: f.name ?? F.name, side: 'foe', at: f.at, ...(f.face !== undefined ? { face: f.face } : {}),
      move: L.move, jump: L.jump, hp: F.base.hp, hpMax: F.base.hp, mp: F.base.mp, mpMax: F.base.mp, atk: F.base.atk, def: F.base.def, mag: F.base.mag, spd: F.base.spd,
      skills: [...F.skills], weak: [...F.weak], resist: [...F.resist], absorb: [...F.absorb], immune: [...F.immune], foe: f.foe, ...(F.boss ? { boss: true } : {}),
      loot: { xp: F.xp, gold: F.gold, cp: F.cp, drops: F.drops.map((d) => ({ ...d })) } });
  }

  // every skill a unit may use, with its shape; every item, with its own
  const skills = {};
  for (const k of new Set(units.flatMap((u) => u.skills))) {
    const S = rpg.skills[k];
    if (!S) no(`'${k}' is a skill no book defines`);
    const { id: _id, about: _a, carry: _c, juice: _j, ...fx } = S;
    skills[k] = { ...fx, ...skillShape(S), ...(SKILL_SHAPES[k] ?? {}), ...(B.skills?.[k] ? readShape(B.skills[k], `board.skills.${k}`) : {}) };
  }
  const items = {};
  for (const [k, I] of Object.entries(rpg.items)) {
    const base = I.target === 'foes' || I.target === 'foe' ? { min: 1, max: 4, area: I.target === 'foes' ? 1 : 0, v: 3 } : { min: 0, max: 1, area: I.target === 'allies' ? 1 : 0, v: 3 };
    items[k] = { ...I, ...base, ...(ITEM_SHAPES[k] ?? {}), ...(B.items?.[k] ? readShape(B.items[k], `board.items.${k}`) : {}) };
  }
  const bag = spec.bag ?? PARTY_BAG;
  if (!isObj(bag)) no('bag is { <item>: count }');
  for (const [k, n] of Object.entries(bag)) {
    if (!items[k]) no(`bag: '${k}' is no item (items: ${Object.keys(items).join(', ')})`);
    if (!(Number.isInteger(n) && n >= 0 && n <= 99)) no(`bag.${k} is a count, 0 to 99`);
  }
  const cfg = { seed: spec.seed ?? 'board', skills, items, bag: { party: { ...bag } }, ...(guests.length ? { teams: { guest: 'party' } } : {}), ...(spec.rules ? { rules: spec.rules } : {}) };
  return { cfg, units, rpg, ...(deploy ? { deploy: [...deploy] } : {}), ...(spec.cap !== undefined ? { cap: spec.cap } : {}) };
}
