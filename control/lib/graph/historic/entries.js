/**
 * entries — the historic cultures as encyclopedia entries: view-vocab cards of family `entry`, generated from
 * the culture, record and style cards at catalog load. Never written by hand, so an entry cannot drift from
 * what the generator draws, and a culture is findable the day its card lands.
 *
 * Three cards per need, so the agent reads only as deep as the ask:
 *  - a HUB per region with more than one culture (`egypt`): the timeline, which entry answers which ask;
 *  - an ENTRY per culture (`thebes`): the infobox (subject, period, place, depiction, basis, checks), its
 *    parts by handle, its scenes, and STARTERS — `historic` manifests to copy and change;
 *  - its RECORD (`thebes/record`): every record entry with its confidence and sources, read on demand to
 *    justify a claim. Kept out of search (`index: false`) so an entry always answers before its sources.
 *
 * Everything is read off the culture card: its `record` (`{ id, entries, sources }`), `region`, `aliases`,
 * `period`, `place`, `readAt`. A region named here (REGIONS) adds its own search words; one that is not still
 * gets its hub.
 *
 * BASIS maps the record's confidence: read → ATTESTED, secondary → RECONSTRUCTED, unverified → CONJECTURAL.
 * Placement and layout are never ATTESTED: the town plan is a reconstruction from parallels. Every entry says up
 * front that it is a GENERAL depiction of its period, not one year's town: anachronisms are expected. Counts are
 * computed here, never typed.
 */
import { HISTORIC_CULTURES } from './historic-city.js';
import { HISTORIC_SCENES } from './historic-kind.js';
import { REGION_CULTURES } from './historic-region.js';
import { FARM_CULTURES } from './farmstead.js';
import { HISTORIC_STYLES } from './style/index.js';
import { describeHistoric, fmtSpan, periodText } from '../depiction.js';
import { REGIONS } from './regions.js';
import { depthText } from './depth.js';
import { relationsOf, lineageTree, KINDS } from './lineage.js';
import { landOf } from './cultures/index.js';

export { REGIONS };


export const BASIS = { read: 'ATTESTED', secondary: 'RECONSTRUCTED', unverified: 'CONJECTURAL' };
const BASIS_ORDER = ['read', 'secondary', 'unverified'];

/** The bytes an entry card's body may take: the infobox, parts and starters, never a manual. */
export const ENTRY_BODY_CEILING = 3200;
/** A record card is read on purpose, to justify a claim: longer, still bounded. */
export const RECORD_BODY_CEILING = 9000;

const dedupe = (a) => [...new Set(a)];
const words = (id) => id.replace(/^[a-z]{2}-/, '').replace(/-/g, ' ');   // eg-sphinx-row → sphinx row
const scenesOf = (id) => Object.keys(HISTORIC_SCENES).filter((s) => HISTORIC_SCENES[s].cultures.includes(id));
const seasonsOf = (id, scene) => (scene === 'region' ? Object.keys(REGION_CULTURES[id]?.crops || {})
  : scene === 'farm' ? Object.keys(FARM_CULTURES[landOf(id)]?.seasons || { harvest: 1, sowing: 1 }) : []);

/** The record's share by basis: `{ read: n, secondary: n, unverified: n }`. */
function basisCounts(entries) {
  const n = { read: 0, secondary: 0, unverified: 0 };
  for (const e of entries) if (e.confidence in n) n[e.confidence] += 1;
  return n;
}

/** The starters: `historic` manifests to copy and change, one per scene the culture has (the land in its last season). */
function starters(id) {
  const out = [[`the town`, { kind: 'historic', culture: id, scene: 'city' }], [`the town from its approach`, { kind: 'historic', culture: id, scene: 'city', view: 'approach' }]];
  for (const scene of scenesOf(id).filter((s) => s !== 'city')) {
    const seasons = seasonsOf(id, scene), season = seasons.length > 2 ? seasons[seasons.length - 1] : undefined;
    const label = scene === 'region' ? `its land${season ? ` in ${season}` : ''}` : scene === 'farm' ? 'a farmstead' : 'the works';
    out.push([label, { kind: 'historic', culture: id, scene, ...(season ? { season } : {}) }]);
  }
  return out;
}

/** The search line: the culture's own words, its region's, its patterns and assets as people would say them. */
function whenOf(id, K) {
  const region = REGIONS[K.region];
  return dedupe([...(K.aliases || []), ...(region ? region.aliases : []), K.label.toLowerCase(), ...(K.period ? [K.period.toLowerCase()] : []),
    ...(K.patterns || []).map(words), 'historic city', 'ancient town', 'inspired level']).map((w) => `"${w}"`).join(', ');
}

/** The entry's LINEAGE line: what it draws on and what draws on it ("continues giza; drawn on by —"). */
function lineageText(id) {
  const { drawsOn, drawnOnBy } = relationsOf(id);
  const on = drawsOn.map((r) => `${r.kind} ${r.from}`).join(', ') || 'draws on no culture here';
  const by = drawnOnBy.map((r) => `${r.by} (${r.kind})`).join(', ') || '—';
  return `${on}; drawn on by ${by}. The tree: card 'historic-lineage'.`;
}

/** The lineage card: every relation between the cultures, by kind, with what it carries. Found by search. */
export function lineageCard() {
  const edges = lineageTree(), C = HISTORIC_CULTURES;
  const lines = ['# The lineage of the historic cultures', '',
    'How the cultures draw on each other through history. A new culture names its relations and starts from what they carry (the scaffold writes a brief of it); a drawn record entry is a parallel to verify, never the new culture\'s basis.', '',
    'Kinds:', ...Object.entries(KINDS).map(([k, v]) => `- ${k}: ${v}`), '', 'Relations (later ← earlier):'];
  for (const e of edges) lines.push(`- ${e.to} ← ${e.from} (${e.kind}: ${e.parts.join(', ')})${e.note ? ` — ${e.note}` : ''}`);
  const roots = Object.keys(C).filter((id) => !(C[id].draws || []).length);
  lines.push('', `Roots (draw on no culture here): ${roots.join(', ')}.`);
  return { id: 'historic-lineage', name: 'The lineage of the historic cultures', family: 'entry', entry: 'create_sketch', generated: true,
    summary: 'How the historic cultures draw on each other: continues, inherits, contact, contemporary, variant.',
    when: '"lineage", "influence", "what came before", "built on", "successor", "descended from", "culture tree", "start a new civilization from"',
    body: lines.join('\n') };
}

/** One culture's entry card. */
export function entryCard(id) {
  const K = HISTORIC_CULTURES[id], d = describeHistoric({ culture: id }), R = K.record || null;
  const n = R ? basisCounts(R.entries) : null, style = HISTORIC_STYLES[id];
  const skins = dedupe(Object.values(K.skins?.kinds || {}));
  const scenes = scenesOf(id).map((s) => { const se = seasonsOf(id, s); return se.length ? `${s} (season ${se.join(' | ')})` : s; });
  const lines = [
    `# ${d.subject}`, '', d.caption, '',
    `SUBJECT    ${d.subject}`,
    `PERIOD     ${periodText(d.period)}`,
    `PLACE      ${d.place === 'invented' ? 'invented — no real place' : d.place}`,
    `DEPICTION  era ${d.depiction.era} (the hardware budget); look: ${style ? `the ${id} style card` : 'none yet'}`,
    `DEPTH      ${depthText(id)} (0 a card on another culture's work … 3 its own place)`,
    `LINEAGE    ${lineageText(id)}`,
    `SCOPE      a general depiction of the place in its period, not a reconstruction of one year: expect anachronisms (pieces from across the span side by side, gaps filled from parallels). Say so when you hand it over.`,
    R ? `BASIS      the ${R.id} record: ${R.entries.length} entries — ${n.read} ATTESTED, ${n.secondary} RECONSTRUCTED, ${n.unverified} CONJECTURAL; ${Object.keys(R.sources).length} sources. The town plan and placement are RECONSTRUCTED from parallels. In full: card '${id}/record'.`
      : 'BASIS      no record yet: read every part as CONJECTURAL.',
    style ? `CHECKS     ${style.principles.length} principles on its style card, each machine-checked; the eyes gate is the operator's.` : 'CHECKS     none yet.',
    '',
    'PARTS (what it is made of, by the ids its generators use)',
    `  palette   ${Object.keys(K.palette || {}).length} roles: ${Object.keys(K.palette || {}).slice(0, 12).join(', ')}${Object.keys(K.palette || {}).length > 12 ? ' …' : ''}`,
    `  skins     ${skins.join(', ')}`,
    `  patterns  ${(K.patterns || []).join(', ')}`,
    ...(Object.keys(K.assets || {}).length ? [`  assets    ${Object.keys(K.assets).join(', ')}`] : []),
    '',
    `SCENES     ${scenes.join(' · ')}`,
    '',
    'STARTERS (manifests: copy one, change it, mint it)',
    ...starters(id).map(([label, m]) => `  ${label}: ${JSON.stringify(m)}`),
    '',
    `RIFF  A seed, a scene, a season or a view (an unknown one is refused with the list) keeps it this entry. A level, a fantasy town or an ${K.region || 'era'}-inspired scene built in another kind after these parts is a derived work: caption it "inspired by ${d.subject}", never as the place itself.`,
  ];
  return {
    id, name: d.subject, family: 'entry', entry: 'create_sketch', generated: true,
    summary: d.caption,
    when: whenOf(id, K),
    body: lines.join('\n'),
  };
}

/** One culture's record card: every record entry, by basis, with its sources. Read on demand; not searched. */
export function recordCard(id) {
  const K = HISTORIC_CULTURES[id], R = K.record;
  if (!R) return null;
  const by = (c) => R.entries.filter((e) => e.confidence === c);
  // the first author of a list, never half a parenthesis ('various (sxlib, Wikipedia)' → 'various')
  const who = (a) => { const first = a.split(',')[0]; return first.includes('(') && !first.includes(')') ? first.slice(0, first.indexOf('(')).trim() : first; };
  const cite = (e) => (e.sources || []).map((s) => `${who(s.author)} ${s.year}`).join('; ');
  const lines = [`# ${K.label}: the record (${R.id})`, '', `What the entry stands on: ${R.entries.length} entries, each with its confidence and sources.`];
  for (const c of BASIS_ORDER) {
    const es = by(c);
    if (!es.length) continue;
    lines.push('', `${BASIS[c]} (${c}):`);
    for (const e of es) lines.push(`- ${e.name} [${e.kind}]${cite(e) ? ` — ${cite(e)}` : ''}${e.disputes ? ' (disputed)' : ''}`);
  }
  const style = HISTORIC_STYLES[id];
  if (style) lines.push('', 'HOW IT IS DRAWN (style card principles, each machine-checked):', ...style.principles.map((p) => `- ${p}`));
  let body = lines.join('\n');
  if (body.length > RECORD_BODY_CEILING) body = `${body.slice(0, body.lastIndexOf('\n', RECORD_BODY_CEILING - 60))}\n… (the rest of the record is in its source file)`;
  return { id: `${id}/record`, name: `${K.label}: the record`, family: 'entry', entry: 'create_sketch', generated: true, index: false,
    summary: `The sources and confidence behind the ${K.label} entry.`, when: `"how do we know", "sources for ${K.label.toLowerCase()}"`, body };
}

/** A region's hub: its cultures in time order, each with its caption. Only where a region has more than one. */
export function hubCards() {
  const by = {};
  for (const [id, K] of Object.entries(HISTORIC_CULTURES)) if (K.region) (by[K.region] ||= []).push(id);
  return Object.entries(by).filter(([, ids]) => ids.length > 1).map(([region, ids]) => {
    const Rg = REGIONS[region] || { label: region[0].toUpperCase() + region.slice(1), aliases: [region] }, sorted = [...ids].sort((a, b) => HISTORIC_CULTURES[a].years[0] - HISTORIC_CULTURES[b].years[0]);
    const span = [Math.min(...ids.map((i) => HISTORIC_CULTURES[i].years[0])), Math.max(...ids.map((i) => HISTORIC_CULTURES[i].years[1]))];
    const body = [`# ${Rg.label}`, '', `Entries in time order (${fmtSpan(span)}). Open the one the ask names; for a general "${region}" ask, offer the choice. Each is a general depiction of its period, with anachronisms to expect.`, '',
      ...sorted.map((i) => `- '${i}': ${describeHistoric({ culture: i }).caption}`), '',
      `An ${region}-inspired level or scene is built after an entry's parts (each entry lists them) and is captioned as inspired by it, not as the place.`].join('\n');
    return { id: region, name: Rg.label, family: 'entry', entry: 'create_sketch', generated: true,
      summary: `${Rg.label}: ${sorted.map((i) => HISTORIC_CULTURES[i].label).join(', ')}.`,
      when: dedupe([...Rg.aliases, ...ids.flatMap((i) => HISTORIC_CULTURES[i].aliases || [])]).map((w) => `"${w}"`).join(', '), body };
  });
}

/** Every generated card: the hubs, then each culture's entry and its record. */
export function historicEntryCards() {
  const out = [...hubCards(), lineageCard()];
  for (const id of Object.keys(HISTORIC_CULTURES)) {
    out.push(entryCard(id));
    const r = recordCard(id);
    if (r) out.push(r);
  }
  return out;
}
