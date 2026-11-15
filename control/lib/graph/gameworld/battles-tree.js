/**
 * A SKILL TREE ON THE BATTLES PAGE — the second lore part a game is laid from, and the first that reaches levelling. A
 * tree (lorecube/tree.js: a school, its element, its techniques and what each does) is written on a gameworld's
 * battles (`battles.tree`: one, or a list), at whatever depth it has, and the party battles take it: the school is a
 * CLASS the party can be in or switch to, each technique a skill of the school's element, learned at a rank or bought
 * on the tree. The page's own words still win (`classes`, `skills`): a tree is a floor, as the manual is
 * (battles-manual.js).
 *
 * The rungs still open are derived here and said as derived, for the battles chapter's author to write a pass at a
 * time (intensifyTree):
 *   order   as written: each technique learned a rank after the one before it, while the class has ranks; past the
 *           last rank, bought after the one before it
 *   costs   by depth (derivedCosts): dearer the deeper it stands
 *
 *   treeOrder(T)    → { id, name?, rung, open: [<rung still derived>], techniques: n }   what the part is, for a readout
 *   treeBattles(T)  → { classes, skills, order }   what the battles page takes from one tree (lowerTree, the open rungs
 *                     derived)
 *   treesOf(v)      → the page's trees as a list (one tree, or a list of them)
 *   treesBattles(v) → { classes, skills, orders: [order] }   every tree's, a school's id said once
 *
 * Pure. A malformed tree throws as the lorecube says it (readTree), where it was written.
 */
import { readTree, intensifyTree, lowerTree, TREE, MAX_RANK } from '../lorecube/tree.js';
import { rungOf } from '../lorecube/passes.js';

/** The order a tree is given when it says none: learned rank by rank as written, then bought one after another. */
const derivedOrder = (V) => Object.fromEntries(V.techniques.map((t, i) => [t.id, i < MAX_RANK ? { at: i + 1 } : { requires: [V.techniques[i - 1].id] }]));

/** The tree costed: the rungs it lacks derived, the ones it holds kept. */
function costed(T) {
  let V = readTree(T);
  const open = [];
  if (!V.order) { V = intensifyTree(V, { order: derivedOrder(V) }).tree; open.push('order'); }
  if (!V.costs) { V = intensifyTree(V, { costs: true }).tree; open.push('costs'); }
  return { V, open };
}

export function treeOrder(T) {
  const R = readTree(T), { open } = costed(T);
  return { id: R.id, ...(R.name ? { name: R.name } : {}), rung: rungOf(TREE, R), open, techniques: R.techniques.length };
}

export function treeBattles(T) {
  const { V } = costed(T), L = lowerTree(V);
  return { classes: L.classes, skills: L.skills, order: treeOrder(T) };
}

export const treesOf = (v) => (Array.isArray(v) ? v : [v]);

export function treesBattles(v) {
  const list = treesOf(v), classes = {}, skills = {}, orders = [];
  if (!list.length) throw new Error('lorecube: tree is a school, or a list of schools: { id, element, techniques: [{ id, does }], order?, costs? }');
  for (const T of list) {
    const B = treeBattles(T);
    if (classes[B.order.id]) throw new Error(`lorecube: tree '${B.order.id}' is said twice: a school is one class`);
    Object.assign(classes, B.classes);
    Object.assign(skills, B.skills);
    orders.push(B.order);
  }
  return { classes, skills, orders };
}
