#!/usr/bin/env node
/**
 * Scaffold a historic culture at depth 0: a card spread from an existing culture (its kit and layout, in the new
 * card's own colours), registered in lib/graph/historic/cultures/index.js, with a README naming its next step.
 * On the first run it renders, the `historic` kind mints it, and it is an encyclopedia entry (BASIS: no record
 * yet). The guide: docs/historic/README.md.
 *
 *   node scripts/new-culture.mjs <id> --like <culture> --label "<label>" --years <from>,<to>
 *        --period "<name>" [--read-at <year>] (--place "<where>" | --invented) --region <region>
 *        --aliases "<word>,<word>,…" [--dry]
 *
 * Years are negative for BCE. `--dry` prints what it would write and changes nothing. Run from control/.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const HIST = 'lib/graph/historic', INDEX = join(HIST, 'cultures/index.js');
const die = (m) => { console.error(`new-culture: ${m}`); process.exit(1); };

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    if (k === 'dry' || k === 'invented') out[k] = true;
    else { if (i + 1 >= argv.length) die(`--${k} needs a value`); out[k] = argv[++i]; }
  }
  return out;
}

/** The registry as written: culture id → { constant, file }. */
function readRegistry(src) {
  const files = {};
  for (const m of src.matchAll(/^import \{ ([^}]+) \} from '\.\/([\w-]+)\.js';$/gm)) for (const c of m[1].split(',').map((x) => x.trim())) files[c] = m[2];
  const block = src.slice(src.indexOf('export const HISTORIC_CULTURES = {'));
  const reg = {};
  for (const m of block.matchAll(/^ {2}'?([\w-]+)'?: (\w+),$/gm)) reg[m[1]] = { constant: m[2], file: files[m[2]] };
  return reg;
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const args = parseArgs(process.argv.slice(2));
const id = args._[0];
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) die('the first argument is the new culture\'s id: lowercase letters, digits, hyphens');
if (!existsSync(INDEX)) die(`run from control/ (no ${INDEX})`);
const src = readFileSync(INDEX, 'utf8'), reg = readRegistry(src);
if (reg[id]) die(`'${id}' is already a culture`);
const like = args.like;
if (!like || !reg[like]) die(`--like names the culture to start from: one of ${Object.keys(reg).join(', ')}`);
for (const k of ['label', 'years', 'period', 'region', 'aliases']) if (!args[k]) die(`--${k} is required`);
const years = String(args.years).split(',').map(Number);
if (years.length !== 2 || !years.every(Number.isInteger) || years[0] > years[1]) die('--years is <from>,<to> in whole years, negative for BCE, from ≤ to');
const readAt = args['read-at'] === undefined ? null : Number(args['read-at']);
if (readAt !== null && !(Number.isInteger(readAt) && readAt >= years[0] && readAt <= years[1])) die('--read-at is a whole year inside --years');
if (!args.invented && !args.place) die('--place "<where>" (or --invented for a made-up place)');
const aliases = String(args.aliases).split(',').map((a) => a.trim()).filter(Boolean);
if (!aliases.length || aliases.some((a) => a.length < 3)) die('--aliases: comma-separated search words, 3+ characters each');
if (!/^[a-z][a-z0-9-]*$/.test(args.region)) die('--region is an id: lowercase letters, digits, hyphens');

const CONST = id.toUpperCase().replace(/-/g, '_'), base = reg[like];
const cardFile = join(HIST, `cultures/${id}.js`);
if (existsSync(cardFile)) die(`${cardFile} exists`);

const card = `/**
 * ${args.label} — DEPTH 0: a card on ${like}'s kit and layout, drawn in its own colours (docs/historic/README.md).
 * Scaffolded by scripts/new-culture.mjs. Deepen it in order:
 *  - its palette and skins, from reference images (every layout draws the card's palette);
 *  - depth 1: its record (record/${id}.js) and style card (style/${id}.js, registered in style/index.js);
 *  - depth 2: its own assets through the asset loop (assets/${id}.js, then \`assets\` here);
 *  - depth 3: its own layout (layouts/${id}.js, registered in layouts/index.js, then \`layout\` here).
 */
import { ${base.constant} } from './${base.file}.js';

export const ${CONST} = {
  ...${base.constant},
  label: ${q(args.label)},
  years: [${years[0]}, ${years[1]}],
  readAt: ${readAt === null ? 'null' : readAt},${readAt === null ? '                    // none chosen: a general depiction of the span' : ''}
  period: ${q(args.period)},
  place: ${args.invented ? 'null' : q(args.place)},${args.invented ? '                     // invented' : ''}
  region: ${q(args.region)},
  aliases: [${aliases.map(q).join(', ')}],   // what people call it (search)
  record: null,                    // none yet: its entry claims nothing as attested until record/${id}.js lands
  land: null,                      // no farm or works scenes until its own (\`land\`: an id in farmstead.js / workshops.js)
  palette: { ...${base.constant}.palette },   // ${like}'s colours until this culture's own are set
};
`;

// the registry: the import after the last culture import, the row before the map closes
const lines = src.split('\n');
const lastImport = lines.map((l, i) => (/^import .* from '\.\/[\w-]+\.js';$/.test(l) ? i : -1)).filter((i) => i >= 0).pop();
lines.splice(lastImport + 1, 0, `import { ${CONST} } from './${id}.js';`);
const close = lines.findIndex((l, i) => i > lines.findIndex((x) => x.startsWith('export const HISTORIC_CULTURES')) && l === '};');
lines.splice(close, 0, `  ${/-/.test(id) ? q(id) : id}: ${CONST},`);
const index = lines.join('\n');

const readmeDir = join('..', 'docs/historic', id), readme = join(readmeDir, 'README.md');
const doc = `# ${args.label}

Depth 0: a card on ${like}'s kit and layout (\`control/${cardFile}\`). The method, the depths and how a culture lands
on the release-candidate trunk: [../README.md](../README.md).

## Next

1. Palette and skins from reference images: set \`palette\` (and \`skins\`) on the card.
2. Depth 1: the record (\`record/${id}.js\`, cited, with confidence) and the style card (\`style/${id}.js\`, a machine
   check per principle). Set \`record\` on the card.
3. Depth 2: its own assets, through the asset loop.
4. Depth 3: its own layout.

## References

(The reference images and what each gives the kit, indexed as they arrive.)
`;

if (args.dry) {
  console.log(`--- ${cardFile}\n${card}\n--- ${INDEX} (new lines)\nimport { ${CONST} } from './${id}.js';\n  ${id}: ${CONST},\n--- ${readme}\n${doc}`);
  process.exit(0);
}
writeFileSync(cardFile, card);
writeFileSync(INDEX, index);
if (!existsSync(readme)) { mkdirSync(readmeDir, { recursive: true }); writeFileSync(readme, doc); }
console.log(`new-culture: '${id}' at depth 0 on ${like}'s kit and layout
  ${cardFile}
  ${INDEX} (registered)
  docs/historic/${id}/README.md
Check it:   npx vitest run lib/graph/historic/cultures.test.js lib/graph/historic/entries.test.js
Mint it:    create_sketch({ title, manifest: { kind: 'historic', culture: '${id}' } })`);
