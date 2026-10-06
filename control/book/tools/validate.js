/**
 * The book's MACHINE GATE — a dependency-free validator for the whole clone.
 *
 * Why it exists: mojulo's book loader is deliberately TOLERANT. A malformed
 * card, a manifest row pointing at nothing, a builder whose `kind.id` drifted
 * from its entry — none of these throw. They are `console.warn`'d and SKIPPED,
 * because a user-editable book must never take the substrate down
 * (control/lib/graph/views/recipe-book/loader.js). That tolerance is right for
 * the substrate and wrong for the book: an entry that silently fails to load
 * looks identical, from inside this repo, to one that works.
 *
 * So every check below mirrors a specific place mojulo would skip or coerce,
 * and turns it into a loud local failure. The rules are transcribed from:
 *   - recipe-book/cards.js      — parseBookCard, CARD_CATALOGS, per-catalog dedupe
 *   - recipe-book/loader.js     — the Door-2 builder contract + version handshake
 *   - views/view-vocab/loader.js, solid-vocab/loader.js,
 *     beats/beats-vocab/loader.js, motion-vocab/loader.js
 *                               — the per-family rules applied at MERGE time
 *
 * Deliberately NOT checked: anything requiring mojulo itself. Whether a
 * recipe's `kind` names a real core kind, whether params are in range, whether
 * a builder's `manifestKind` collides with a core WORLD_KIND — those depend on
 * the installed substrate, and hard-coding a copy of its catalogs here would
 * rot. They stay where they belong: the mint (machine gate) and your eyes
 * (eyes gate). This file checks what the book can know about itself.
 *
 * Run:  node tools/validate.js [bookDir]
 * Or:   node --test        (tests/book.test.js runs it over this clone)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const BOOK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** entry tool → target vocab catalog. Mirrors cards.js CARD_CATALOGS exactly:
 *  a card whose `entry` has no row here is skipped by the book loader with
 *  "no catalog for it in this mojulo". */
export const CARD_CATALOGS = {
  create_view: 'view',
  compose_world: 'view',
  create_beats: 'beats',
  mint_solid: 'solid',
  edit_solid: 'solid',
  forge_motion: 'motion',
  stitch_motion: 'motion',
  create_figure: 'wardrobe',   // garment / outfit entries — the cards join the sketch-vocab catalog
};

/** Entry types. `recipe` and `builder` are the two doors; `garment` and `outfit`
 *  are the WARDROBE lane (mojulo's outfit plan): data-only entries read by name
 *  from `create_figure`'s `outfit`, a `garment.json` (a wardrobe spec, exactly
 *  what an inline garment is) or an `outfit.json` (`{ fit?, layers }`). */
export const ENTRY_TYPES = ['recipe', 'builder', 'garment', 'outfit'];

/** Per-catalog family rules, as applied at MERGE time by each vocab loader.
 *  `required: false` + `fallback` mirrors motion-vocab's `card.family ?? 'motion'`;
 *  `valid: null` mirrors beats-vocab, which checks no family at all. */
export const CATALOG_FAMILIES = {
  view: { valid: ['science', 'math', 'bio', 'world'], required: true },
  solid: { valid: ['figure', 'creature', 'object', 'structure', 'vehicle', 'edit'], required: true },
  motion: { valid: ['motion'], required: false, fallback: 'motion' },
  beats: { valid: null, required: false },
  wardrobe: { valid: null, required: false },
};

/** Door-1 recipe.json keys that carry the mint, per entry tool. Only tools the
 *  book actually exercises get a shape; `edit_solid` / `stitch_motion` route
 *  through CARD_CATALOGS but have no entry yet, so nothing is invented for
 *  them — add the keys with the first entry that proves the shape. */
export const RECIPE_KEYS = {
  create_view: ['kind'],
  compose_world: ['base'],
  create_beats: ['kind'],
  mint_solid: ['kind', 'spec'],
  forge_motion: ['shot'],
  edit_solid: [],
  stitch_motion: [],
};

/** The Door-2 purity contract: mojulo re-runs `assemble` on EVERY render,
 *  forever, so the same recipe must give a byte-identical scene. Scanned over
 *  builder.js with comments stripped (the builders discuss their own purity in
 *  prose). Statement-position only, so `plan(recipe, { toolkit })` — the
 *  injected-toolkit path — stays legal; importing it would not be. */
const IMPURITIES = [
  [/^[ \t]*import\s+(?![(.])/m, 'a static import — builders receive everything via ctx.toolkit'],
  [/^[ \t]*export\s+[^=]*\bfrom\s*['"]/m, 're-export from another module'],
  [/\bimport\s*\(/, 'a dynamic import()'],
  [/\brequire\s*\(/, 'require()'],
  [/\bMath\.random\s*\(/, 'Math.random() — the same recipe must give the same scene'],
  [/\bDate\.now\s*\(/, 'Date.now() — the same recipe must give the same scene'],
  [/\bnew\s+Date\b/, 'new Date() — the same recipe must give the same scene'],
  [/\bperformance\.now\s*\(/, 'performance.now() — the same recipe must give the same scene'],
  [/\bprocess\.(env|cwd|argv)\b/, 'process state — a builder may not read its environment'],
];

const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const CARD_FIELDS = ['id', 'name', 'entry', 'summary', 'when'];   // parseBookCard's required set
const BUILDER_FAMILIES = ['science', 'math', 'bio'];              // loader.js coerces anything else to 'science'
const WHEN_MIN = 40;   // the `when` line is the whole semantic-search surface

const cmpVersion = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFilledString = (v) => typeof v === 'string' && v.trim().length > 0;

const listDirs = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isDirectory()).sort()
    : [];

/** Parse a book card the way cards.js parseBookCard does — same fences, same
 *  required fields, same tolerance. Throws with the reason on failure. */
export function parseCard(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) throw new Error('missing JSON frontmatter fences');
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`frontmatter is not valid JSON — ${err.message}`);
  }
  for (const field of CARD_FIELDS) {
    if (!isFilledString(meta[field])) throw new Error(`missing required frontmatter field '${field}'`);
  }
  return { ...meta, body: raw.slice(match[0].length).trim() };
}

/**
 * Validate a book directory. Async because Door-2 builders are imported to
 * check their exports — the same import the loader does, so a builder that
 * cannot load here cannot load there either.
 *
 * → { errors, warnings, issues, stats }, each issue { level, where, message }.
 */
export async function validateBook(root = BOOK_ROOT) {
  const issues = [];
  const err = (where, message) => issues.push({ level: 'error', where, message });
  const warn = (where, message) => issues.push({ level: 'warn', where, message });
  const done = () => ({
    issues,
    errors: issues.filter((i) => i.level === 'error'),
    warnings: issues.filter((i) => i.level === 'warn'),
  });

  // ---- manifest.json: the book's only index. No manifest, no book. --------
  const manifestPath = join(root, 'manifest.json');
  if (!existsSync(manifestPath)) {
    err('manifest.json', 'missing — bookDirs() skips a directory with no manifest.json entirely');
    return { ...done(), stats: {} };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    err('manifest.json', `not valid JSON — ${e.message}`);
    return { ...done(), stats: {} };
  }

  if (!isFilledString(manifest.book)) err('manifest.json', "'book' must be a non-empty string");
  if (!SEMVER.test(String(manifest.bookVersion ?? ''))) {
    err('manifest.json', `'bookVersion' must be x.y.z (got ${JSON.stringify(manifest.bookVersion)})`);
  }
  // The version handshake: mojulo REFUSES the whole book when this is ahead of
  // the installed control plane, so a malformed range silently disables it.
  if (!isFilledString(manifest.requiresMojulo) || !/^>?=?\s*\d+\.\d+\.\d+$/.test(manifest.requiresMojulo.trim())) {
    err('manifest.json', `'requiresMojulo' must be ">=x.y.z" (got ${JSON.stringify(manifest.requiresMojulo)})`);
  }
  const declaredChapters = Array.isArray(manifest.chapters) ? manifest.chapters : null;
  if (!declaredChapters) err('manifest.json', "'chapters' must be an array");
  const entries = Array.isArray(manifest.entries) ? manifest.entries : null;
  if (!entries) {
    err('manifest.json', "'entries' must be an array");
    return { ...done(), stats: {} };
  }

  // ---- chapters[] ⇄ chapters/ on disk ------------------------------------
  const chapterDirs = listDirs(join(root, 'chapters'));
  for (const name of declaredChapters ?? []) {
    if (!chapterDirs.includes(name)) warn('manifest.json', `chapter '${name}' is declared but chapters/${name}/ does not exist`);
  }
  for (const name of chapterDirs) {
    if (declaredChapters && !declaredChapters.includes(name)) {
      err('manifest.json', `chapters/${name}/ exists but '${name}' is not in 'chapters'`);
    }
  }

  // ---- manifest rows ⇄ entry folders on disk -----------------------------
  // Drift in EITHER direction is invisible at runtime: an unbacked row is a
  // skipped entry, an undeclared folder is never read at all.
  const declared = new Set();
  for (const [i, entry] of entries.entries()) {
    const at = `manifest.json entries[${i}]`;
    if (!isFilledString(entry.chapter) || !isFilledString(entry.dir)) {
      err(at, "each entry needs a non-empty 'chapter' and 'dir'");
      continue;
    }
    declared.add(`${entry.chapter}/${entry.dir}`);
  }
  for (const chapter of chapterDirs) {
    for (const dir of listDirs(join(root, 'chapters', chapter))) {
      if (!declared.has(`${chapter}/${dir}`)) {
        err(`chapters/${chapter}/${dir}`, 'folder has no manifest.json row — mojulo reads the manifest, not the filesystem, so this entry does not exist');
      }
    }
  }

  // ---- per entry ---------------------------------------------------------
  const seenIds = new Map();   // `${catalog}:${id}` → where — mirrors the loader's per-catalog dedupe
  const stats = { entries: entries.length, recipes: 0, builders: 0, wardrobe: 0, byChapter: {}, byEntry: {} };

  for (const [i, entry] of entries.entries()) {
    const at = `manifest.json entries[${i}]`;
    if (!isFilledString(entry.chapter) || !isFilledString(entry.dir)) continue;   // already reported
    const rel = `chapters/${entry.chapter}/${entry.dir}`;
    const dir = join(root, 'chapters', entry.chapter, entry.dir);

    if (!ENTRY_TYPES.includes(entry.type)) {
      err(at, `'type' must be one of ${ENTRY_TYPES.join(', ')} (got ${JSON.stringify(entry.type)})`);
      continue;
    }
    if (!isFilledString(entry.id)) { err(at, "'id' must be a non-empty string"); continue; }
    if (entry.id !== entry.dir) err(at, `'id' is '${entry.id}' but 'dir' is '${entry.dir}' — an entry lives at chapters/<chapter>/<id>/`);
    if (declaredChapters && !declaredChapters.includes(entry.chapter)) {
      err(at, `chapter '${entry.chapter}' is not in the manifest's 'chapters' array`);
    }
    if (!SEMVER.test(String(entry.since ?? ''))) {
      err(at, `'since' must be x.y.z (got ${JSON.stringify(entry.since)})`);
    } else if (SEMVER.test(String(manifest.bookVersion ?? '')) && cmpVersion(entry.since, manifest.bookVersion) > 0) {
      err(at, `'since' ${entry.since} is ahead of bookVersion ${manifest.bookVersion} — bump the book version in the same PR`);
    }
    if (!existsSync(dir)) { err(at, `declares ${rel}/ but that folder does not exist`); continue; }

    stats[entry.type === 'builder' ? 'builders' : entry.type === 'recipe' ? 'recipes' : 'wardrobe']++;
    stats.byChapter[entry.chapter] = (stats.byChapter[entry.chapter] || 0) + 1;

    // ---- card.md ---------------------------------------------------------
    const cardPath = join(dir, 'card.md');
    if (!existsSync(cardPath)) { err(rel, 'card.md is missing — the card IS the entry; without it nothing is indexed'); continue; }
    let card;
    try {
      card = parseCard(cardPath);
    } catch (e) {
      err(`${rel}/card.md`, `${e.message} — the book loader skips this card`);
      continue;
    }

    if (card.id !== entry.id) err(`${rel}/card.md`, `card id '${card.id}' does not match the manifest entry id '${entry.id}'`);
    const catalog = CARD_CATALOGS[card.entry];
    if (!catalog) {
      err(`${rel}/card.md`, `entry tool '${card.entry}' has no catalog — expected one of ${Object.keys(CARD_CATALOGS).join(', ')}`);
      continue;
    }
    stats.byEntry[card.entry] = (stats.byEntry[card.entry] || 0) + 1;

    const key = `${catalog}:${card.id}`;
    if (seenIds.has(key)) err(`${rel}/card.md`, `id '${card.id}' is already used in the ${catalog} catalog by ${seenIds.get(key)} — first wins, this one is shadowed`);
    else seenIds.set(key, rel);

    const rules = CATALOG_FAMILIES[catalog];
    const family = card.family ?? rules.fallback;
    if (rules.valid === null) {
      if (card.family !== undefined) warn(`${rel}/card.md`, `the ${catalog} catalog checks no family — '${card.family}' is dead data`);
    } else if (family === undefined) {
      if (rules.required) err(`${rel}/card.md`, `${catalog} cards require 'family' (one of ${rules.valid.join(', ')}) — without it the merge skips the card`);
    } else if (!rules.valid.includes(family)) {
      err(`${rel}/card.md`, `family '${family}' is not a ${catalog} family (${rules.valid.join(', ')}) — the merge skips the card`);
    }

    if (!card.body) err(`${rel}/card.md`, 'the body is empty — the parameter manual is the value of the entry');
    if (card.when.trim().length < WHEN_MIN) {
      warn(`${rel}/card.md`, `'when' is ${card.when.trim().length} chars — it is what semantic search leads with; phrase it as the intents that should recall the entry`);
    }

    // ---- The wardrobe lane: garment.json / outfit.json ------------------
    // Data only. mojulo's loader validates the spec itself (validateGarmentSpec /
    // validateOutfit) and warns + skips a bad one; here the shape that lane needs.
    if (entry.type === 'garment' || entry.type === 'outfit') {
      if (card.entry !== 'create_figure') err(`${rel}/card.md`, `a ${entry.type} entry's card must route to 'create_figure' (got '${card.entry}')`);
      const specPath = join(dir, `${entry.type}.json`);
      if (!existsSync(specPath)) { err(rel, `${entry.type}.json is missing — a '${entry.type}' entry is card + ${entry.type}.json`); continue; }
      let spec;
      try {
        spec = JSON.parse(readFileSync(specPath, 'utf8'));
      } catch (e) {
        err(`${rel}/${entry.type}.json`, `not valid JSON — ${e.message}`);
        continue;
      }
      if (!isPlainObject(spec)) { err(`${rel}/${entry.type}.json`, 'must be a JSON object'); continue; }
      if (entry.type === 'garment') {
        if (!isFilledString(spec.id)) err(`${rel}/garment.json`, "a garment spec needs an 'id'");
        if (!Array.isArray(spec.pieces) || !spec.pieces.length) err(`${rel}/garment.json`, "a garment spec needs a non-empty 'pieces' array");
      } else if (!Array.isArray(spec.layers) || !spec.layers.length) {
        err(`${rel}/outfit.json`, "an outfit needs a non-empty 'layers' array, inner → outer");
      }
      continue;
    }

    // ---- Door 1: recipe.json --------------------------------------------
    if (entry.type === 'recipe') {
      const recipePath = join(dir, 'recipe.json');
      if (!existsSync(recipePath)) { err(rel, "recipe.json is missing — a 'recipe' entry is card + params"); continue; }
      let recipe;
      try {
        recipe = JSON.parse(readFileSync(recipePath, 'utf8'));
      } catch (e) {
        err(`${rel}/recipe.json`, `not valid JSON — ${e.message}`);
        continue;
      }
      if (!isPlainObject(recipe)) { err(`${rel}/recipe.json`, 'must be a JSON object'); continue; }
      if (recipe.entry !== card.entry) {
        err(`${rel}/recipe.json`, `'entry' is ${JSON.stringify(recipe.entry)} but the card routes to '${card.entry}' — the card and the params must name the same tool`);
      }
      for (const k of RECIPE_KEYS[card.entry] ?? []) {
        if (recipe[k] === undefined) err(`${rel}/recipe.json`, `a ${card.entry} recipe needs '${k}'`);
      }
      continue;
    }

    // ---- Door 2: builder.js ---------------------------------------------
    // Only the VIEW lane exists: loader.js skips a builder declaring any other
    // entry tool ("no Door-2 lane exists for that family yet").
    if (entry.entry !== undefined && entry.entry !== 'create_view') {
      err(at, `builders exist only for 'create_view' — '${entry.entry}' has no Door-2 lane`);
    }
    if (card.entry !== 'create_view') {
      err(`${rel}/card.md`, `a builder's card must route to 'create_view' (got '${card.entry}')`);
    }
    const builderPath = join(dir, 'builder.js');
    if (!existsSync(builderPath)) { err(rel, "builder.js is missing — a 'builder' entry is card + code"); continue; }
    if (!existsSync(join(dir, 'builder.test.js'))) {
      err(rel, 'builder.test.js is missing — a new kind ships with the tests that are its machine gate');
    }

    const src = stripComments(readFileSync(builderPath, 'utf8'));
    for (const [re, why] of IMPURITIES) {
      if (re.test(src)) err(`${rel}/builder.js`, `not pure: ${why}`);
    }

    let mod;
    try {
      mod = await import(pathToFileURL(builderPath).href);
    } catch (e) {
      err(`${rel}/builder.js`, `failed to import — ${e.message} — the loader skips it the same way`);
      continue;
    }
    const meta = mod.kind;
    if (!isPlainObject(meta) || !isFilledString(meta.id) || !isFilledString(meta.manifestKind) || typeof mod.assemble !== 'function') {
      err(`${rel}/builder.js`, 'must export { kind: { id, manifestKind, family, title }, assemble }');
      continue;
    }
    if (meta.id !== entry.id) err(`${rel}/builder.js`, `kind.id '${meta.id}' does not match the manifest entry id '${entry.id}'`);
    if (!BUILDER_FAMILIES.includes(meta.family)) {
      warn(`${rel}/builder.js`, `kind.family '${meta.family}' is not one of ${BUILDER_FAMILIES.join(', ')} — the loader silently coerces it to 'science'`);
    }
    if (!isFilledString(meta.title)) warn(`${rel}/builder.js`, "kind.title is missing — the loader falls back to `mojulo <id>`");
    if (mod.plan !== undefined && typeof mod.plan !== 'function') err(`${rel}/builder.js`, "'plan' is exported but is not a function");
  }

  return { ...done(), stats };
}

/** Human-readable report. Errors first — they are what fails the gate. */
export function formatReport({ errors, warnings, stats }, root = BOOK_ROOT) {
  const lines = [];
  for (const { where, message } of errors) lines.push(`  ERROR  ${where}: ${message}`);
  for (const { where, message } of warnings) lines.push(`  warn   ${where}: ${message}`);
  if (lines.length) lines.push('');
  const counted = stats?.entries !== undefined
    ? `${stats.entries} entries (${stats.recipes} recipes, ${stats.builders} builders, ${stats.wardrobe ?? 0} wardrobe)`
    : 'no entries read';
  lines.push(
    errors.length
      ? `✗ ${root}: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} across ${counted}`
      : `✓ ${root}: ${counted} valid${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}`,
  );
  return lines.join('\n');
}

// CLI: node tools/validate.js [bookDir] — also validates YOUR cookbook, which
// is a book in this exact format (~/.mojulo/data/cookbook).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] ? resolve(process.argv[2]) : BOOK_ROOT;
  const result = await validateBook(root);
  console.log(formatReport(result, root));
  process.exit(result.errors.length ? 1 : 0);
}
