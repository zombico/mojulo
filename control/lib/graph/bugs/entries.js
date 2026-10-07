/**
 * entries — the worked arthropods as encyclopedia entries: solid-vocab cards of family `species`, generated from the
 * roster (species.js) and its facts (about.js) at catalog load. Never written by hand, so an entry cannot drift from
 * what the builder draws, and a bug is findable the day its roster file lands. The historic entries are the pattern
 * (historic/entries.js).
 *
 * Two depths, so the agent reads only as deep as the ask:
 *  - a HUB per class (`species/insects`): its worked bugs by order, and the NOT YET lines — arthropods people ask for
 *    that no roster file builds, each with the built species that stands in. That is how "a wasp" lands honestly.
 *  - an ENTRY per species (`species/honeyBee`): the infobox (subject, size, build, parts, basis, checks) and STARTERS,
 *    `mint_solid` specs to copy and change.
 *
 * Counts are computed here, never typed. Nothing here builds geometry: the parts line reads the bauplan's forms.
 */
import { BUG_SPECIES, traitsOf } from './species.js';
import { about, wanted, ORDERS, CLASSES } from './about.js';

/** The bytes an entry card's body may take: the infobox and starters, never a manual. */
export const ENTRY_BODY_CEILING = 2600;
/** A hub lists a class: every worked bug in it and every stand-in, one line each. */
export const HUB_BODY_CEILING = 9000;

const dedupe = (a) => [...new Set(a)];
const words = (id) => id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();   // stagBeetle → stag beetle
const quote = (ws) => dedupe(ws).map((w) => `"${w}"`).join(', ');
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const mm = (m) => (m < 0.1 ? `${Number((m * 1000).toFixed(1))} mm` : `${Number((m * 100).toFixed(1))} cm`);
const classOf = (id) => ORDERS[BUG_SPECIES[id].order]?.cls;
const standsIn = (id) => Object.entries(wanted).filter(([, w]) => w.near === id);

/** the parts line: the form each part wears (forms.js names), as the matcher reads them */
function partsText(B) {
  const t = traitsOf(B), legs = dedupe([t.foreLegs, t.legs, t.hindLegs]).join(' / ');
  const out = [`head ${t.head}`, `trunk ${t.trunk}`, `tail ${t.tail}`, `legs ${legs}`];
  if (t.antennae) out.push(`antennae ${t.antennae}`);
  if (t.mouth && t.mouth !== 'none') out.push(`mouth ${t.mouth}`);
  out.push(t.wings && t.wings.length ? `wings ${t.wings.join(' + ')}` : 'no wings');
  if (t.palps) out.push(`palps ${t.palps}`);
  if (t.extras.length) out.push(t.extras.join(', '));
  return out.join(' · ');
}

/** The starters: `mint_solid` calls, the species as built, a print-sized one, and a recoloured one. */
function starters(id, B) {
  const print = B.length < 0.05 ? 0.1 : null, colorKey = Object.keys(B.colors || {})[0] || 'body';
  return [
    ['the animal at true scale', { kind: 'animal', title: about[id].common, spec: { species: id } }],
    ...(print ? [[`a ${mm(print)} model for a print (the same bug, scaled up)`, { kind: 'animal', title: `${about[id].common} model`, spec: { bug: { like: id, length: print } } }]] : []),
    ['recoloured (any key of its palette)', { kind: 'animal', title: about[id].common, spec: { bug: { like: id, colors: { [colorKey]: '#…' } } } }],
  ];
}

/** One worked bug's entry card. */
export function speciesCard(id) {
  const B = BUG_SPECIES[id], A = about[id], O = ORDERS[B.order] || { label: B.order, cls: '?' };
  const kin = Object.keys(BUG_SPECIES).filter((o) => o !== id && BUG_SPECIES[o].order === B.order);
  const stand = standsIn(id);
  const lines = [
    `# ${cap(A.common)} (${A.sci})`, '', `${cap(A.read)}.`, '',
    `SUBJECT    ${B.name} — ${A.sci}; ${B.order} (${O.label}), one of the ${O.cls}`,
    `SIZE       ${A.size} (published); built at ${mm(B.length)} head to tail tip, TRUE SCALE — scale it up for a print`,
    `PARTS      ${partsText(B)}`,
    `COLOURS    ${Object.keys(B.colors || {}).join(', ') || '—'}`,
    `BASIS      ${A.source}`,
    `CHECKS     machine: closed, grounded, every foot planted, size (scripts/fauna-fit.mjs --bug ${id}); a critic and two blind judges in the design loop. The eyes gate is the operator's.`,
    ...(kin.length ? [`KIN        other worked ${O.label}: ${kin.join(', ')}`] : []),
    ...(stand.length ? [`STANDS IN  for ${stand.map(([w, r]) => `${r.common} (it misses: ${r.note})`).join('; ')}`] : []),
    '',
    'STARTERS (mint_solid calls: copy one, change it, mint it)',
    ...starters(id, B).map(([label, m]) => `  ${label}: ${JSON.stringify(m)}`),
    '',
    `DIALS  \`bug: { like: '${id}', length, colors, over }\` re-sizes, recolours or overrides any bauplan field; \`traits\` swaps a part's form. After minting, tune in place with update_sketch on '/plan/…'.`,
  ];
  return {
    id: `species/${id}`, name: `${cap(A.common)} (${A.sci})`, family: 'species', entry: 'mint_solid', generated: true,
    summary: `${cap(A.common)}: ${A.read}. ${cap(A.size)}.`,
    when: quote([A.common, ...A.aliases, words(id), A.sci.toLowerCase(), O.label]),
    body: lines.join('\n'),
  };
}

/** A class's hub: its worked bugs by order, then what it does not build yet and what stands in. */
export function hubCard(cls) {
  const C = CLASSES[cls], ids = Object.keys(BUG_SPECIES).filter((id) => classOf(id) === cls);
  const byOrder = {};
  for (const id of ids) (byOrder[BUG_SPECIES[id].order] ||= []).push(id);
  const notYet = Object.entries(wanted).filter(([, w]) => classOf(w.near) === cls);
  const lines = [`# ${C.label}`, '', `${cap(C.what)}. ${ids.length} worked species; open the entry the ask names, or take the stand-in below.`, ''];
  for (const [order, os] of Object.entries(byOrder)) {
    lines.push(`${cap(ORDERS[order].label)} (${order}):`);
    for (const id of os) lines.push(`- 'species/${id}' ${about[id].common}: ${about[id].read}`);
  }
  if (notYet.length) {
    lines.push('', 'NOT YET (asked for, not built: the nearest worked species stands in; say which when you hand it over)');
    for (const [, w] of notYet) lines.push(`- ${w.common} → '${w.near}' (misses: ${w.note})`);
  }
  lines.push('', `ANY OTHER: describe it by order and part forms and the matcher wears them over the closest worked bug: {"kind":"animal","spec":{"bug":{"order":"…","traits":{…},"length":…}}} — the orders and forms are on the animal card.`);
  return {
    id: `species/${cls}`, name: C.label, family: 'species', entry: 'mint_solid', generated: true,
    summary: `${C.label}: ${ids.map((id) => about[id].common).join(', ')}.`,
    when: quote([...C.aliases, ...Object.keys(byOrder).map((o) => ORDERS[o].label), ...notYet.flatMap(([, w]) => [w.common, ...w.aliases])]),
    body: lines.join('\n'),
  };
}

/** Every generated card: the class hubs, then each worked bug's entry. */
export function bugEntryCards() {
  return [...Object.keys(CLASSES).map(hubCard), ...Object.keys(BUG_SPECIES).map(speciesCard)];
}

/** A NAME as people say it ('a ladybug', 'Crawdad', 'honeyBee', 'wasp') → { id, via } for a worked bug, or
 * { id: near, via: 'stand-in', wanted } for one not built; null when no arthropod goes by it. */
export function bugByName(name) {
  if (typeof name !== 'string') return null;
  if (BUG_SPECIES[name]) return { id: name, via: 'id' };
  const n = name.trim().toLowerCase().replace(/^(an?|the)\s+/, '');
  for (const [id, A] of Object.entries(about)) {
    if (id.toLowerCase() === n || A.common === n || A.aliases.includes(n)) return { id, via: id.toLowerCase() === n ? 'id' : 'alias' };
  }
  for (const [w, W] of Object.entries(wanted)) {
    if (w.toLowerCase() === n || W.common === n || W.aliases.includes(n)) return { id: W.near, via: 'stand-in', wanted: W.common, misses: W.note };
  }
  return null;
}
