/**
 * entries — the animal rosters as encyclopedia entries: solid-vocab cards (family `creature`, `generated: true`),
 * generated from each roster's species and its `about` / `wanted` tables at catalog load. Never written by hand, so a
 * card cannot drift from what the builder makes, and an animal is findable the day its species lands. The pattern is
 * the historic cultures' (../historic/entries.js); the tool list does not grow per animal.
 *
 * Three cards per need, so the agent reads only as deep as the ask:
 *  - the INDEX (`animals`): every animal by the name people say, and the asked-for ones not built yet;
 *  - a HUB per family (`animal/feline`): its species, and its WANTED rows with the built species that stands in;
 *  - an ENTRY per species (`animal/houseCat`): subject, size, stance, how it moves, basis, the STARTER spec, its kin.
 *
 * A ROSTER is `{ id, species, about, wanted, familyOf, stanceOf, spec, movesOf? }`: `species` by id (each with a
 * `name`), `about` by id (`{ common, aliases, sci, size, source }`), `wanted` by id (`{ family, near, aliases, note }`),
 * `spec(id)` the `animal` kind spec that mints it, `movesOf(id)` its locomotion (`{ gaits, note }`, ./locomotion/).
 * Add a roster to ROSTERS and its animals join the cards, the name resolver (`resolveAnimalName`) and the contract
 * test (entries.test.js). Counts are computed here, never typed.
 */
import { SPECIES, stanceOf } from './species.js';
import { FAMILY_ABOUT, FAMILY_WANTED } from './families.js';
import { locomotionFor } from './locomotion/index.js';

/** The rosters the encyclopedia reads. */
export const ROSTERS = [
  { id: 'fauna', species: SPECIES, about: FAMILY_ABOUT, wanted: FAMILY_WANTED,
    familyOf: (id) => SPECIES[id].family, stanceOf, spec: (id) => ({ species: id }),
    movesOf: (id) => locomotionFor(SPECIES[id].family, id) },
];

/** The bytes a species entry's body may take: an infobox and a starter, never a manual. */
export const ENTRY_BODY_CEILING = 1400;
/** A family hub lists its species and its wanted rows. */
export const HUB_BODY_CEILING = 2600;
/** The index lists every animal by name, one line per family. */
export const INDEX_BODY_CEILING = 7000;

const dedupe = (a) => [...new Set(a)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const words = (id) => id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();   // houseCat → house cat
const bare = (name) => (name || '').replace(/^(a|an|the) /, '');               // 'a house cat' → 'house cat'
const quote = (a) => dedupe(a.filter(Boolean)).map((w) => `"${w}"`).join(', ');

/** A word as people type it, made comparable: lower case, no article, single spaces, hyphens and underscores as spaces. */
export function normalizeName(s) {
  return String(s).trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').replace(/^(a|an|the) /, '');
}

/** Every animal across the rosters: `{ id, roster, family, about, wanted? }`, built ones first. */
function animals() {
  const out = [];
  for (const R of ROSTERS) {
    for (const id of Object.keys(R.species)) out.push({ id, roster: R, family: R.familyOf(id), about: R.about[id] || null });
    for (const [id, w] of Object.entries(R.wanted || {})) out.push({ id, roster: R, family: w.family, wanted: w });
  }
  return out;
}

/**
 * The name index: every species id, its id as words, its common name and aliases, and every wanted animal's id and
 * aliases → the animal. Built once. Throws on a collision: one word, one animal (the contract test reads the throw).
 */
let NAMES = null;
export function animalNameIndex() {
  if (NAMES) return NAMES;
  const map = new Map();
  const claim = (word, a) => {
    const k = normalizeName(word); if (!k) return;
    const had = map.get(k);
    if (had && had.id !== a.id) throw new Error(`animal names: '${k}' names both '${had.id}' and '${a.id}' — one word, one animal`);
    map.set(k, a);
  };
  for (const a of animals()) {
    const names = a.wanted ? [a.id, words(a.id), ...(a.wanted.aliases || [])]
      : [a.id, words(a.id), a.about?.common, ...(a.about?.aliases || [])];
    for (const n of names) claim(n, a);
  }
  NAMES = map;
  return map;
}

/**
 * What a typed name means: `{ id, roster }` for a built species, `{ wanted: id, near, note }` for an asked-for animal
 * not built yet, `null` for an unknown word. Tries the word, then its singular ('cats' → 'cat', 'wolves' → 'wolf').
 */
export function resolveAnimalName(word) {
  if (typeof word !== 'string' || !word.trim()) return null;
  const idx = animalNameIndex(), k = normalizeName(word);
  const a = idx.get(k) || (k.endsWith('ves') && idx.get(`${k.slice(0, -3)}f`)) || (k.endsWith('es') && idx.get(k.slice(0, -2)))
    || (k.endsWith('s') && idx.get(k.slice(0, -1))) || null;
  if (!a) return null;
  return a.wanted ? { wanted: a.id, near: a.wanted.near, note: a.wanted.note, family: a.family } : { id: a.id, roster: a.roster.id };
}

const label = (a) => a.about?.common || bare(a.roster.species[a.id].name) || words(a.id);
const starterText = (R, id) => `{ "kind": "animal", "spec": ${JSON.stringify(R.spec(id))} }`;

/** The MOVES rows: the gaits in plain words, slowest first, and how the animal moves them. */
function movesLines(R, id) {
  const M = R.movesOf?.(id); if (!M) return [];
  return [`MOVES    ${Object.keys(M.gaits).join(', ')}`, ...(M.note ? [`         ${M.note}`] : [])];
}

/** One species' entry card. */
export function speciesCard(R, id) {
  const S = R.species[id], A = R.about[id] || {}, family = R.familyOf(id);
  const kin = Object.keys(R.species).filter((k) => k !== id && R.familyOf(k) === family);
  const name = cap(A.common || bare(S.name) || words(id));
  const lines = [
    `# ${name}${A.sci && A.sci !== 'mythic' ? ` (${A.sci})` : ''}`, '',
    `${cap(bare(S.name) || words(id))}, built on the ${family} family's tables.`, '',
    `SUBJECT  ${S.name || words(id)} (${family})`,
    `ALSO     ${dedupe([A.common, ...(A.aliases || [])].filter((w) => w && w !== A.common)).join(', ') || '—'}`,
    `SIZE     ${A.size || 'not recorded'} (true scale, metres)`,
    `STANCE   ${R.stanceOf(id) || '—'}`,
    ...movesLines(R, id),
    `BASIS    ${A.source ? `the size from ${A.source}; the build is fit to it (closed, attached, size gates).` : 'no source recorded.'} How it reads is the operator's eyes gate.`,
    '',
    'STARTER  (copy it, give it a title, mint it)',
    `  ${starterText(R, id)}`,
    '',
    "TUNE     iterate in place on the minted ref: '/plan/…' patches or '/dials/<name>'. Figure-body `opts` do not apply.",
    `KIN      ${kin.length ? kin.map((k) => label({ id: k, roster: R, about: R.about[k] })).join(', ') : 'none yet'} — card 'animal/${family}'.`,
  ];
  return {
    id: `animal/${id}`, name, family: 'creature', entry: 'mint_solid', generated: true,
    summary: `${cap(bare(S.name) || words(id))}: a ready species for the animal kind, ${A.size ? `${A.size}, ` : ''}${R.stanceOf(id) || ''}.`,
    when: quote([A.common, ...(A.aliases || []), words(id), bare(S.name), A.sci && A.sci !== 'mythic' ? A.sci.toLowerCase() : null, `make me a ${A.common || words(id)}`, `a ${A.common || words(id)} to 3d print`, 'animal']),   // as the ask is phrased
    body: lines.join('\n'),
  };
}

/** One family's hub card: its species and its wanted rows. */
export function hubCard(family, members) {
  const built = members.filter((a) => !a.wanted), wanted = members.filter((a) => a.wanted);
  const lines = [`# The ${family} family`, '',
    `${built.length} species built on the ${family} tables${wanted.length ? `, ${wanted.length} asked for and not built yet` : ''}.`, '',
    'SPECIES (name → card)', ...built.map((a) => `  ${label(a)} → animal/${a.id}`)];
  if (wanted.length) {
    lines.push('', 'NOT YET (the nearest built species stands in: say so when you hand it over)');
    for (const a of wanted) lines.push(`  ${words(a.id)}${a.wanted.aliases?.length ? ` (${a.wanted.aliases.join(', ')})` : ''}: nearest ${label({ id: a.wanted.near, roster: a.roster, about: a.roster.about[a.wanted.near] })} (animal/${a.wanted.near}) — ${a.wanted.note}`);
  }
  return {
    id: `animal/${family}`, name: `The ${family} family`, family: 'creature', entry: 'mint_solid', generated: true,
    summary: `The ${family} animals: ${built.map(label).join(', ')}${wanted.length ? `; not yet: ${wanted.map((a) => words(a.id)).join(', ')}` : ''}.`,
    when: quote([family, ...built.map(label), ...wanted.flatMap((a) => [words(a.id), ...(a.wanted.aliases || [])])]),
    body: lines.join('\n'),
  };
}

/** The index card: every animal by the name people say, by family, and the asked-for ones not built yet. */
export function indexCard(byFamily) {
  const fams = Object.keys(byFamily);
  const built = fams.flatMap((f) => byFamily[f].filter((a) => !a.wanted)), wanted = fams.flatMap((f) => byFamily[f].filter((a) => a.wanted));
  const lines = ['# Animals', '',
    `Every animal the animal kind builds, by the name people say: ${built.length} species in ${fams.length} families. Each has an entry card \`animal/<id>\` with its size and a starter spec; each family a hub \`animal/<family>\`. A name that is not an id still mints: the kind resolves common names and aliases.`, '',
    'BUILT (name: id)'];
  for (const f of fams) { const b = byFamily[f].filter((a) => !a.wanted); if (b.length) lines.push(`  ${f}: ${b.map((a) => `${label(a)}: ${a.id}`).join(' · ')}`); }
  lines.push('', 'NOT YET (nearest built species)', `  ${wanted.map((a) => `${words(a.id)} → ${a.wanted.near}`).join(' · ')}`,
    '', 'Anything else: an invented creature is the `layered` kind; a new fish or snake from parameters is card \'animal\' (its param tables).');
  return {
    id: 'animals', name: 'Animals: every species the animal kind builds', family: 'creature', entry: 'mint_solid', generated: true,
    summary: `The animal roster by everyday name: ${built.length} species, ${wanted.length} asked-for animals with a stand-in.`,
    when: '"which animals", "what animals are there", "list of animals", "animal roster", "which species", "zoo", "farm animals", "pets", "wildlife"',
    body: lines.join('\n'),
  };
}

/** Every generated animal card: the index, one hub per family, one entry per species. */
export function animalEntryCards() {
  const byFamily = {};
  for (const a of animals()) (byFamily[a.family] ||= []).push(a);
  const cards = [indexCard(byFamily)];
  for (const [f, members] of Object.entries(byFamily)) cards.push(hubCard(f, members));
  for (const R of ROSTERS) for (const id of Object.keys(R.species)) cards.push(speciesCard(R, id));
  return cards;
}
