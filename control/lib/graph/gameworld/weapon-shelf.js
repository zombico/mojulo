/**
 * THE WEAPON SHELF — second weapons a stylish game's hero carries beside the template's blade, each a row: what is held
 * (`held`, an item's build words, the equipment kernel's: manifested in the hand while the weapon is up, the blade on the
 * back), its reach and weight, its moves and its strings, in the words combos.js reads. A game names one in its kit's
 * weapons, `{ shelf: '<row>' }` (its id the row's unless it gives one), and any field it writes is laid over the row's
 * as an edit is (arsenal.js: `moves` move by move, `combos` by id). A new weapon is a row first.
 *
 *   bo          a staff for crowds: wide sweeps either side, a spin all round, a slam that throws them down and back
 *   spear       reach: thrusts that drive on, a sweep to clear, a launching rise, a lunge across the room
 *   scythe      the wide arc: reaping cuts round the hero, a spin, a pull that draws the foe in, an overhead reap
 *   hammer      weight: slow, heavy blows that topple, a ground blow that knocks everything round it away
 *   greatsword  the long blade in two hands: committed cuts, a rising launcher, a cleave that drops a guard
 *
 *   WEAPON_SHELF        id → the row      ·   SHELF_IDS
 *   shelfWeapon(E)      → a weapon: the row `E.shelf` names with E's fields over it, or E itself when it names none;
 *                         throws on a row the shelf has not
 *
 * Pure: words in, a weapon out.
 */
const step = (m) => ({ kind: 'step', m }), lunge = (m) => ({ kind: 'lunge', m });

export const WEAPON_SHELF = Object.freeze({
  bo: Object.freeze({ name: 'Bo', held: { item: 'staff', style: 'historical' }, reach: 2.3, damage: 0.8,
    moves: {
      'bo-1': { swing: 'left', role: 'opener', frames: 24, cancel: 15, arc: 150, travel: step(0.25), damage: 0.8, impact: 1.5 },
      'bo-2': { swing: 'right', role: 'filler', frames: 24, cancel: 15, arc: 150, travel: step(0.25), damage: 0.8, impact: 1.5 },
      'bo-spin': { swing: 'around', role: 'filler', frames: 34, cancel: 24, contact: [0.3, 0.72], arc: 360, spin: 1, damage: 1, impact: 2.5 },
      'bo-slam': { swing: 'back', role: 'finisher', frames: 46, contact: [0.5, 0.66], arc: 360, reach: 3.6, travel: lunge(0.4), damage: 2, impact: 6, topple: true, knock: 'heavy', cooldown: 30 },
      'bo-poke': { swing: 'forward', role: 'opener', frames: 30, reach: 2.8, travel: lunge(0.5), damage: 1.2, impact: 3, cooldown: 30 },
    },
    combos: [
      { id: 'sweep', name: 'Sweep', beats: ['L', 'L', 'L'], moves: ['bo-1', 'bo-2', 'bo-spin'] },
      { id: 'ground-slam', name: 'Ground slam', beats: ['L', 'L', 'L', 'H'], moves: ['bo-1', 'bo-2', 'bo-spin', 'bo-slam'] },
      { id: 'poke', name: 'Poke', beats: ['H'], moves: ['bo-poke'] },
    ] }),
  spear: Object.freeze({ name: 'Spear', held: { item: 'staff', style: 'historical', parts: { hilt: 'long', end: 'spear' } }, reach: 2.8, damage: 0.9,
    moves: {
      'spear-1': { swing: 'forward', role: 'opener', frames: 22, cancel: 14, arc: 50, travel: step(0.3), damage: 0.9, impact: 1.5 },
      'spear-2': { swing: 'forward', role: 'filler', frames: 22, cancel: 14, arc: 50, travel: step(0.3), damage: 0.9, impact: 1.5 },
      'spear-sweep': { swing: 'left', role: 'filler', frames: 30, cancel: 20, arc: 180, damage: 1, impact: 2.5 },
      'spear-drive': { swing: 'forward', role: 'finisher', frames: 40, contact: [0.4, 0.6], reach: 3.4, travel: lunge(0.7), damage: 2, impact: 5, knock: 'heavy', cooldown: 24 },
      'spear-rise': { swing: 'up', role: 'launcher', frames: 36, contact: [0.34, 0.66], travel: lunge(0.4), damage: 1, launch: 9, rise: true, cooldown: 30 },
    },
    combos: [
      { id: 'thrusts', name: 'Thrusts', beats: ['L', 'L', 'L'], moves: ['spear-1', 'spear-2', 'spear-sweep'] },
      { id: 'drive', name: 'Drive', beats: ['L', 'L', 'H'], moves: ['spear-1', 'spear-2', 'spear-drive'] },
      { id: 'rise', name: 'Rise', beats: ['bH'], moves: ['spear-rise'] },
    ] }),
  scythe: Object.freeze({ name: 'Scythe', held: { item: 'staff', style: 'historical', parts: { hilt: 'long', end: 'scythe' } }, reach: 2.6, damage: 0.9,
    moves: {
      'scythe-1': { swing: 'right', role: 'opener', frames: 26, cancel: 16, arc: 200, travel: step(0.2), damage: 0.9, impact: 1.5 },
      'scythe-2': { swing: 'left', role: 'filler', frames: 26, cancel: 16, arc: 200, travel: step(0.2), damage: 0.9, impact: 1.5 },
      'scythe-spin': { swing: 'around', role: 'filler', frames: 36, cancel: 26, contact: [0.3, 0.75], arc: 360, spin: 2, damage: 1.2, impact: 2.5 },
      'scythe-reap': { swing: 'back', role: 'finisher', frames: 44, contact: [0.5, 0.66], arc: 160, reach: 3, travel: lunge(0.4), damage: 2.2, impact: 5, topple: true, cooldown: 28 },
    },
    combos: [
      { id: 'reaping', name: 'Reaping', beats: ['L', 'L', 'L'], moves: ['scythe-1', 'scythe-2', 'scythe-spin'] },
      { id: 'reap', name: 'Reap', beats: ['L', 'L', 'H'], moves: ['scythe-1', 'scythe-2', 'scythe-reap'] },
    ] }),
  hammer: Object.freeze({ name: 'Hammer', held: { item: 'staff', style: 'historical', parts: { hilt: 'arm', end: 'hammer' } }, reach: 1.6, damage: 1.5,
    moves: {
      'hammer-1': { swing: 'right', role: 'opener', frames: 34, cancel: 22, arc: 120, travel: step(0.2), damage: 1.5, impact: 3, topple: true },
      'hammer-2': { swing: 'left', role: 'filler', frames: 34, cancel: 22, arc: 120, travel: step(0.2), damage: 1.5, impact: 3 },
      'hammer-quake': { swing: 'back', role: 'finisher', frames: 52, contact: [0.55, 0.66], arc: 360, reach: 3.2, damage: 2.5, impact: 7, topple: true, knock: 'massive', cooldown: 36 },
    },
    combos: [
      { id: 'blows', name: 'Blows', beats: ['L', 'L'], moves: ['hammer-1', 'hammer-2'] },
      { id: 'quake', name: 'Quake', beats: ['L', 'L', 'H'], moves: ['hammer-1', 'hammer-2', 'hammer-quake'] },
    ] }),
  greatsword: Object.freeze({ name: 'Greatsword', held: { item: 'greatsword', style: 'historical' }, reach: 2, damage: 1.3,
    moves: {
      'great-1': { swing: 'right', role: 'opener', frames: 30, cancel: 19, arc: 140, travel: step(0.3), damage: 1.3, impact: 2.5 },
      'great-2': { swing: 'left', role: 'filler', frames: 30, cancel: 19, arc: 140, travel: step(0.3), damage: 1.3, impact: 2.5 },
      'great-cleave': { swing: 'back', role: 'finisher', frames: 46, contact: [0.5, 0.64], arc: 90, travel: lunge(0.5), damage: 2.6, impact: 6, topple: true, knock: 'heavy', cooldown: 30 },
      'great-rise': { swing: 'up', role: 'launcher', frames: 38, contact: [0.34, 0.66], travel: lunge(0.4), damage: 1.2, launch: 9, rise: true, cooldown: 30 },
    },
    combos: [
      { id: 'cuts', name: 'Cuts', beats: ['L', 'L', 'H'], moves: ['great-1', 'great-2', 'great-cleave'] },
      { id: 'rise', name: 'Rise', beats: ['bH'], moves: ['great-rise'] },
    ] }),
});
export const SHELF_IDS = Object.freeze(Object.keys(WEAPON_SHELF));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** a weapon from the shelf: the row `E.shelf` names, E's own fields over it (moves move by move, combos by id) */
export function shelfWeapon(E) {
  if (!isObj(E) || E.shelf === undefined) return E;
  const R = WEAPON_SHELF[E.shelf];
  if (!R) throw new Error(`combos: weapons '${E.id ?? E.shelf}'.shelf is a row of the weapon shelf (${SHELF_IDS.join(', ')}), not '${E.shelf}'`);
  const { shelf, moves, combos, ...rest } = E, base = structuredClone(R);
  const M = { ...base.moves };
  if (isObj(moves)) for (const [id, m] of Object.entries(moves)) { if (m === null) delete M[id]; else M[id] = isObj(M[id]) && isObj(m) ? { ...M[id], ...m } : m; }
  let C = base.combos;
  if (Array.isArray(combos)) for (const c of combos) { const k = C.findIndex((x) => x.id === c.id); if (c.drop === true) { if (k >= 0) C = C.filter((_, i) => i !== k); } else if (k < 0) C = [...C, c]; else C = C.map((x, i) => (i === k ? { ...x, ...c } : x)); }
  return { id: shelf, ...base, ...rest, moves: M, combos: C };
}
