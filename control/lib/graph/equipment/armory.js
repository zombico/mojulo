// equipment/armory — the generic arms a crowd is armed from: a roster of named builds (laws 2, the `grave` card) and the
// KITS a role draws from, so a skeleton host (undead/tiered.js) or any rank-and-file crowd carries varied, plausible
// gear — a rabble with cudgels and bone clubs, soldiers with swords, axes and maces behind round and kite shields,
// archers with bows, wardens with hammers and polearms, brutes with two-handed weapons, a captain with a longsword —
// each individual's pick a roll on its own seed.
//
//   ARMORY_ARMS      name → a build (the equipment kernel's words; stored as words, re-derived on every read)
//   ARMORY_KITS      role → { slot: [arm names | null] }: what a hand of that role may hold (null: empty)
//   armFrom(kit, seed)   → gear { right?, left?, back?, hip? } for the hero door (a laws-2 build per slot); a
//                    two-handed arm (TWO_HANDED) leaves the left hand empty
//   ARMORY_VERSION   stamped on a host that draws from the armory, so a later roster never re-arms a minted one
//
// A new arm is a row; a new role a kit. Pure and deterministic: mulberry32 on the seed.
import { mulberry32 } from './shapes.js';

export const ARMORY_VERSION = 1;
const BONE = ['matte', '#d6cfbd'];

export const ARMORY_ARMS = Object.freeze({
  'rusted-sword': { item: 'sword', style: 'grave' },
  'notched-blade': { item: 'sword', style: 'grave', parts: { blade: 'cleaver' } },
  'grave-dagger': { item: 'dagger', style: 'grave' },
  'old-longsword': { item: 'sword', style: 'grave', parts: { hilt: 'hand-and-half' } },
  'old-greatsword': { item: 'greatsword', style: 'grave' },
  'grave-axe': { item: 'staff', style: 'grave', parts: { hilt: 'arm', end: 'axe' } },
  cudgel: { item: 'staff', style: 'grave', parts: { hilt: 'arm', end: 'club' } },
  'spiked-club': { item: 'staff', style: 'grave', parts: { hilt: 'arm', end: 'spiked' } },
  'bone-club': { item: 'staff', style: 'grave', parts: { hilt: 'arm', end: 'bone', shaft: BONE } },
  'flanged-mace': { item: 'staff', style: 'grave', parts: { hilt: 'arm', end: 'flanged' } },
  'war-hammer': { item: 'staff', style: 'grave', parts: { hilt: 'arm', end: 'hammer' } },
  'broken-spear': { item: 'staff', style: 'grave', parts: { hilt: 'long', end: 'spear', hiltLength: 105 } },
  'grave-halberd': { item: 'staff', style: 'grave', parts: { hilt: 'pole', end: 'halberd' } },
  'reaper-scythe': { item: 'staff', style: 'grave', parts: { hilt: 'long', end: 'scythe' } },
  'grave-bow': { item: 'bow', style: 'grave' },
  'rotten-buckler': { item: 'shield', style: 'grave', parts: { outline: 'buckler', construction: 'planks' } },
  'cracked-round': { item: 'shield', style: 'grave', parts: { outline: 'round', curve: 'dish', construction: 'planks' } },
  'old-kite': { item: 'shield', style: 'grave', parts: { outline: 'kite', curve: 'barrel', construction: 'planks' } },
  'grave-scutum': { item: 'shield', style: 'grave', parts: { outline: 'scutum', construction: 'panels' } },
});
export const ARMORY_NAMES = Object.freeze(Object.keys(ARMORY_ARMS));
/** the arms that take both hands: whoever rolls one carries no shield (its left hand is on the haft or the grip) */
export const TWO_HANDED = Object.freeze(['old-greatsword', 'grave-halberd', 'reaper-scythe']);

export const ARMORY_KITS = Object.freeze({
  rabble: { right: ['cudgel', 'bone-club', 'grave-dagger', 'spiked-club', 'broken-spear'], left: [null, null, 'rotten-buckler'] },
  soldier: { right: ['rusted-sword', 'grave-axe', 'flanged-mace', 'notched-blade'], left: ['cracked-round', 'old-kite', 'grave-scutum'] },
  archer: { left: ['grave-bow'], hip: [null, 'grave-dagger'] },
  warden: { right: ['war-hammer', 'grave-halberd', 'broken-spear'], left: [null, 'grave-scutum'] },
  brute: { right: ['spiked-club', 'flanged-mace', 'reaper-scythe', 'old-greatsword'] },
  captain: { right: ['old-longsword', 'old-greatsword', 'war-hammer'], left: [null, 'grave-scutum'] },
});
export const ARMORY_KIT_NAMES = Object.freeze(Object.keys(ARMORY_KITS));

/** A role's gear on a seed: each slot its kit names, one arm rolled (or none), as laws-2 builds. */
export function armFrom(kit, seed = 1) {
  const K = ARMORY_KITS[kit];
  if (!K) throw new Error(`armory: no kit '${kit}' (${ARMORY_KIT_NAMES.join(', ')})`);
  const rand = mulberry32(((seed >>> 0) ^ 0x2545f491) >>> 0), gear = {};
  for (const slot of ['right', 'left', 'back', 'hip']) {
    const pool = K[slot]; if (!pool) continue;
    const name = pool[Math.floor(rand() * pool.length)];
    if (slot === 'left' && TWO_HANDED.includes(gear.right?.armory)) continue;   // (the roll is spent either way: seeds stay stable)
    if (name) gear[slot] = { type: 'equipment', ...ARMORY_ARMS[name], laws: 2, armory: name };
  }
  return gear;
}
