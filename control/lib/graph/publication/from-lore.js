/**
 * LORE, PUBLISHED — the lorecube's parts as the books a world keeps of them: a monster manual as a bestiary, a skill
 * tree as a grimoire. The words and the numbers come from the lore itself (lorecube/manual.js, tree.js: what it holds
 * and what it lowers to the party game), so the book a player reads says what the game plays; the plates are still
 * lifes from the prop shelf (props.js) in the element's own tint.
 *
 *   bestiaryOf(manual, { diagram?, by? })   → a publication. A chapter an element; each creature an entry with its
 *                                             numbers (once the manual is numbered) and what it fears
 *   grimoireOf(tree, { diagram?, by? })     → a publication. The school, then a chapter a tier; each technique an entry
 *   `diagram`: the part's own drawing as an SVG (lorecube/diagram.js through lib/sketch-svg.js), set as a figure
 *
 * A manual or a tree at any depth is published: what a later pass will say is left out, never invented.
 * Pure and deterministic.
 */
import { readManual, lowerManual } from '../lorecube/manual.js';
import { readTree, depthsOf, lowerTree, DOES } from '../lorecube/tree.js';
import { elementHandles, resolvePolarity, affinityOf } from '../lorecube/polarity.js';
import { stillLife } from './props.js';

const nameOf = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a.at(-1)}` : a[0] ?? '');
const tintOf = (element) => elementHandles(element)?.tint ?? undefined;

/** What stands for an element on a plate, and for what a technique does. */
export const ELEMENT_PROPS = Object.freeze({
  fire: ['candle', 'chalice'], water: ['vial', 'chalice'], ice: ['crystal', 'vial'], wind: ['orb'], storm: ['orb', 'blade'], lightning: ['orb', 'blade'],
  earth: ['toadstool', 'skull'], forest: ['toadstool', 'vial'], metal: ['blade', 'shield'], light: ['orb', 'candle'], dark: ['skull', 'candle'], moon: ['orb', 'chalice'],
});
export const DOES_PROPS = Object.freeze({ bolt: 'crystal', storm: 'orb', blade: 'blade', ward: 'shield', surge: 'candle', mend: 'vial', hex: 'skull', sap: 'toadstool' });

const ROLE_WORDS = { grunt: 'met in numbers', harrier: 'quick, and gone before it is struck', elite: 'a hard test for a party', boss: 'the one the region answers to' };

/** A monster manual as a bestiary. */
export function bestiaryOf(manual, { diagram, by } = {}) {
  const M = readManual(manual), P = resolvePolarity(M.polarity);
  const numbered = M.levels !== undefined && M.affinity !== undefined;
  const foes = numbered ? lowerManual(M).foes : null;
  const elements = [...new Set(M.creatures.map((c) => c.element))];
  const title = M.name ? `A Bestiary of ${M.name.replace(/^the /, 'the ')}` : 'A Bestiary';
  const chapters = [];
  if (diagram) chapters.push({ id: 'the-order', title: 'The order of things', blocks: [
    { p: `The creatures set down here are of ${list(elements)}. What each fears and what each shrugs off follows from how those stand to one another, and is drawn here once.`, drop: true },
    { figure: diagram, caption: 'How the elements of this region stand to each other.', span: true },
  ] });
  let n = 0;
  for (const element of elements) {
    const own = M.creatures.filter((c) => c.element === element);
    const aff = affinityOf(P, element), tint = tintOf(element);
    const props = (ELEMENT_PROPS[elementHandles(element)?.root] ?? ['skull']).map((w) => [w, tint]).slice(0, 2);
    const blocks = [
      { p: `Of ${element} there ${own.length > 1 ? 'are' : 'is'} ${own.length}${aff.weak?.length ? `, and what is of ${element} gives way to ${list(aff.weak)}` : ''}.`, drop: true },
      { plate: stillLife(props), caption: `The signs of ${element}.` },
    ];
    for (const c of own) {
      const name = c.name ?? nameOf(c.id), a = M.affinity?.[c.id], f = foes?.[c.id];
      const inner = [{ p: ROLE_WORDS[c.role] ? `${nameOf(c.role)}: ${ROLE_WORDS[c.role]}.` : `${nameOf(c.role)}.` }];
      if (a) inner.push({ facts: [['Fears', a.weak?.length ? list(a.weak) : 'nothing known'], ...(a.resist?.length ? [['Shrugs off', list(a.resist)]] : []), ...(a.absorb?.length ? [['Feeds on', list(a.absorb)]] : []), ...(a.immune?.length ? [['Untouched by', list(a.immune)]] : [])] });
      if (f) inner.push({ stat: { name: 'Its measure', note: `as met at level ${M.levels[c.id]}`, pairs: [['Life', f.hp], ['Strength', f.atk], ['Guard', f.def], ['Craft', f.mag], ['Speed', f.spd]] } });
      blocks.push({ entry: { n: ++n, title: name, blocks: inner } });
    }
    chapters.push({ id: `of-${element}`, title: `Of ${nameOf(element)}`, blocks });
  }
  return { kind: 'bestiary', title, ...(by ? { by } : {}), subtitle: `${M.creatures.length} creatures, set down by element`, chapters };
}

/** A skill tree as a grimoire. */
export function grimoireOf(tree, { diagram, by } = {}) {
  const T = readTree(tree), tint = tintOf(T.element);
  const name = T.name ?? nameOf(T.id);
  const ordered = T.order !== undefined, costed = T.costs !== undefined;
  const depths = ordered ? depthsOf(T) : {};
  const skills = costed ? lowerTree(T).skills : null;
  const kinds = [...new Set(T.techniques.map((t) => DOES_PROPS[t.does]).filter(Boolean))].slice(0, 3);
  const chapters = [{ id: 'the-school', title: 'The school', blocks: [
    { p: `${name} is a school of ${T.element}. It teaches ${T.techniques.length} workings${ordered ? ', the first of them to whoever is admitted and the rest to those who have earned them' : ''}.`, drop: true },
    { plate: stillLife((kinds.length ? kinds : ['tome']).map((w) => [w, w === 'blade' || w === 'shield' ? undefined : tint])), caption: 'What the school works with.', span: true },
    ...(diagram ? [{ figure: diagram, caption: 'The order in which its workings are come by.', span: true }] : []),
  ] }];
  const tiers = new Map();
  for (const t of T.techniques) { const d = ordered ? depths[t.id] ?? 0 : 0; (tiers.get(d) ?? tiers.set(d, []).get(d)).push(t); }
  let n = 0;
  for (const d of [...tiers.keys()].sort((a, b) => a - b)) {
    const blocks = [];
    for (const t of tiers.get(d)) {
      const how = T.order?.[t.id], cost = T.costs?.[t.id], sk = skills?.[`${T.id}-${t.id}`];
      const inner = [{ p: `${nameOf(DOES[t.does] ? DOES[t.does].reads : t.does)}.` }];
      const rows = [];
      if (how?.at !== undefined) rows.push(['Come by', `taught at rank ${how.at}`]);
      else if (how?.requires) rows.push(['Come by', how.requires.length ? `earned after ${list(how.requires.map(nameOf))}` : 'earned, with nothing before it']);
      if (cost?.mp !== undefined) rows.push(['Costs', `${cost.mp} of the reserve${cost.points ? `, and ${cost.points} to learn` : ''}`]);
      if (sk?.power !== undefined) rows.push(['Force', String(sk.power)]);
      if (rows.length) inner.push({ facts: rows });
      blocks.push({ entry: { n: ++n, title: t.name ?? nameOf(t.id), blocks: inner } });
    }
    chapters.push({ id: `tier-${d + 1}`, title: ordered ? (d === 0 ? 'The first workings' : `The ${['second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][d - 1] ?? `${d + 1}th`} tier`) : 'Its workings', blocks });
  }
  return { kind: 'grimoire', title: `The Grimoire of ${name.replace(/^The /, 'the ')}`, ...(by ? { by } : {}), subtitle: `the workings of ${T.element}, in the order they are come by`, chapters };
}
