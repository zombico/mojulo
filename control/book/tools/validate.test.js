/**
 * Tests for the validator itself — run with no install: node --test.
 *
 * Each test builds a throwaway book in a temp dir, breaks exactly one thing,
 * and asserts the corresponding check fires. The point is not coverage for its
 * own sake: every case here is a way an entry can be silently skipped by
 * mojulo's book loader, so a check that stops working is a check that stops
 * catching a real, invisible failure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { validateBook, formatReport, parseCard, CARD_CATALOGS } from './validate.js';

const WHEN = 'show the thing; visualize the thing; the thing for class';   // long enough not to warn

const card = (meta, body = 'The parameter manual.') => `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${body}\n`;

const PURE_BUILDER = `export const kind = { id: 'widget', manifestKind: 'widget-view', family: 'science', title: 'mojulo widget' };
export function plan(recipe) { return { faces: [], stats: {} }; }
export function assemble(recipe, { title } = {}) { return { faces: [], title }; }
`;

/** A minimal well-formed book: one create_view recipe. Callers mutate the
 *  returned shape before writing it. */
function baseBook() {
  return {
    manifest: {
      book: 'test-book',
      bookVersion: '0.1.0',
      requiresMojulo: '>=1.4.2',
      chapters: ['science'],
      entries: [{ type: 'recipe', chapter: 'science', dir: 'widget', id: 'widget', since: '0.1.0' }],
    },
    files: {
      'chapters/science/widget/card.md': card({
        id: 'widget', name: 'Widget', family: 'science', entry: 'create_view',
        summary: 'A ready-to-mint preset.', when: WHEN,
      }),
      'chapters/science/widget/recipe.json': { entry: 'create_view', kind: 'atom', params: {}, title: 'Widget' },
    },
  };
}

function write(t, { manifest, files }) {
  const root = mkdtempSync(join(tmpdir(), 'recipe-book-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (manifest !== null) writeFileSync(join(root, 'manifest.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest, null, 2));
  for (const [rel, content] of Object.entries(files ?? {})) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

const render = (r) => r.issues.map((i) => `${i.level} ${i.where}: ${i.message}`).join('\n') || '(no issues)';
const hasError = (r, re) => assert.ok(r.errors.some((e) => re.test(`${e.where} ${e.message}`)), `expected an ERROR matching ${re}, got:\n${render(r)}`);
const hasWarning = (r, re) => assert.ok(r.warnings.some((w) => re.test(`${w.where} ${w.message}`)), `expected a WARNING matching ${re}, got:\n${render(r)}`);
const clean = (r) => assert.equal(r.errors.length, 0, `expected no errors, got:\n${render(r)}`);

// ---- the happy path -------------------------------------------------------

test('a well-formed book validates with no errors and no warnings', async (t) => {
  const r = await validateBook(write(t, baseBook()));
  clean(r);
  assert.equal(r.warnings.length, 0, render(r));
  assert.deepEqual(r.stats.byEntry, { create_view: 1 });
  assert.equal(r.stats.recipes, 1);
});

test('formatReport leads with errors and reports the count', async (t) => {
  const b = baseBook();
  b.manifest.entries[0].id = 'mismatched';
  const out = formatReport(await validateBook(write(t, b)));
  assert.match(out, /ERROR/);
  assert.match(out, /✗/);
});

// ---- manifest -------------------------------------------------------------

test('a directory with no manifest.json is not a book at all', async (t) => {
  const r = await validateBook(write(t, { manifest: null, files: {} }));
  hasError(r, /manifest\.json.*missing/);
});

test('unparseable manifest.json stops the run with one clear error', async (t) => {
  const r = await validateBook(write(t, { manifest: '{ not json', files: {} }));
  hasError(r, /not valid JSON/);
});

test('bookVersion and requiresMojulo must be well-formed', async (t) => {
  const b = baseBook();
  b.manifest.bookVersion = '0.1';
  b.manifest.requiresMojulo = 'latest';
  const r = await validateBook(write(t, b));
  hasError(r, /bookVersion/);
  hasError(r, /requiresMojulo/);
});

test("an entry's since may not run ahead of bookVersion", async (t) => {
  const b = baseBook();
  b.manifest.entries[0].since = '0.2.0';   // bookVersion is 0.1.0
  hasError(await validateBook(write(t, b)), /'since' 0\.2\.0 is ahead of bookVersion 0\.1\.0/);
});

test('type must be one of the entry types', async (t) => {
  const b = baseBook();
  b.manifest.entries[0].type = 'preset';
  hasError(await validateBook(write(t, b)), /'type' must be/);
});

test('the entry folder is chapters/<chapter>/<id> — dir and id may not drift', async (t) => {
  const b = baseBook();
  b.manifest.entries[0].dir = 'widget';
  b.manifest.entries[0].id = 'gadget';
  hasError(await validateBook(write(t, b)), /'id' is 'gadget' but 'dir' is 'widget'/);
});

test("a row whose folder does not exist is reported, not crashed on", async (t) => {
  const b = baseBook();
  b.manifest.entries.push({ type: 'recipe', chapter: 'science', dir: 'ghost', id: 'ghost', since: '0.1.0' });
  hasError(await validateBook(write(t, b)), /declares chapters\/science\/ghost\/ but that folder does not exist/);
});

// ---- drift in the other direction: the filesystem ------------------------

test('a folder with no manifest row is invisible to mojulo, so it is an error', async (t) => {
  const b = baseBook();
  b.files['chapters/science/orphan/card.md'] = card({
    id: 'orphan', name: 'Orphan', family: 'science', entry: 'create_view', summary: 'x', when: WHEN,
  });
  hasError(await validateBook(write(t, b)), /orphan.*no manifest\.json row/);
});

test('an undeclared chapter directory is an error; a declared-but-absent one warns', async (t) => {
  const b = baseBook();
  b.manifest.chapters = ['science', 'bio'];      // bio declared, never created
  b.files['chapters/beats/x/card.md'] = card({   // beats created, never declared
    id: 'x', name: 'X', entry: 'create_beats', summary: 'x', when: WHEN,
  });
  b.manifest.entries.push({ type: 'recipe', chapter: 'beats', dir: 'x', id: 'x', since: '0.1.0' });
  b.files['chapters/beats/x/recipe.json'] = { entry: 'create_beats', kind: 'beats-pattern', title: 'X', params: {} };
  const r = await validateBook(write(t, b));
  hasError(r, /chapters\/beats\/ exists but 'beats' is not in 'chapters'/);
  hasWarning(r, /chapter 'bio' is declared but/);
});

// ---- cards ----------------------------------------------------------------

test('a card with no frontmatter fences is skipped by the loader, so it fails here', async (t) => {
  const b = baseBook();
  b.files['chapters/science/widget/card.md'] = 'Just prose, no fences.\n';
  hasError(await validateBook(write(t, b)), /missing JSON frontmatter fences/);
});

test('every required frontmatter field is enforced', async (t) => {
  for (const field of ['id', 'name', 'entry', 'summary', 'when']) {
    const b = baseBook();
    const meta = { id: 'widget', name: 'Widget', family: 'science', entry: 'create_view', summary: 's', when: WHEN };
    delete meta[field];
    b.files['chapters/science/widget/card.md'] = card(meta);
    hasError(await validateBook(write(t, b)), new RegExp(`missing required frontmatter field '${field}'`));
  }
});

test('the card id must match the manifest entry id', async (t) => {
  const b = baseBook();
  b.files['chapters/science/widget/card.md'] = card({
    id: 'other', name: 'Widget', family: 'science', entry: 'create_view', summary: 's', when: WHEN,
  });
  hasError(await validateBook(write(t, b)), /card id 'other' does not match/);
});

test('an entry tool with no catalog in mojulo is caught here', async (t) => {
  const b = baseBook();
  b.files['chapters/science/widget/card.md'] = card({
    id: 'widget', name: 'Widget', family: 'science', entry: 'create_hologram', summary: 's', when: WHEN,
  });
  hasError(await validateBook(write(t, b)), /'create_hologram' has no catalog/);
});

test('an empty card body fails — the parameter manual is the value', async (t) => {
  const b = baseBook();
  b.files['chapters/science/widget/card.md'] = card({
    id: 'widget', name: 'Widget', family: 'science', entry: 'create_view', summary: 's', when: WHEN,
  }, '');
  hasError(await validateBook(write(t, b)), /body is empty/);
});

test('a thin `when` line warns — it is the whole semantic-search surface', async (t) => {
  const b = baseBook();
  b.files['chapters/science/widget/card.md'] = card({
    id: 'widget', name: 'Widget', family: 'science', entry: 'create_view', summary: 's', when: 'a widget',
  });
  const r = await validateBook(write(t, b));
  clean(r);
  hasWarning(r, /'when' is 8 chars/);
});

// ---- the per-catalog family rules ----------------------------------------

test('view cards require a view family; a solid family there is an error', async (t) => {
  for (const family of [undefined, 'object']) {
    const b = baseBook();
    const meta = { id: 'widget', name: 'Widget', entry: 'create_view', summary: 's', when: WHEN };
    if (family) meta.family = family;
    b.files['chapters/science/widget/card.md'] = card(meta);
    hasError(await validateBook(write(t, b)), /family/);
  }
});

test('solid cards require a solid family', async (t) => {
  const b = baseBook();
  b.manifest.chapters = ['solids'];
  b.manifest.entries = [{ type: 'recipe', chapter: 'solids', dir: 'pot', id: 'pot', since: '0.1.0' }];
  b.files = {
    'chapters/solids/pot/card.md': card({ id: 'pot', name: 'Pot', family: 'science', entry: 'mint_solid', summary: 's', when: WHEN }),
    'chapters/solids/pot/recipe.json': { entry: 'mint_solid', kind: 'workbench', title: 'Pot', spec: {} },
  };
  hasError(await validateBook(write(t, b)), /family 'science' is not a solid family/);
});

test('beats cards carry no family; one that does is dead data and warns', async (t) => {
  const b = baseBook();
  b.manifest.chapters = ['beats'];
  b.manifest.entries = [{ type: 'recipe', chapter: 'beats', dir: 'loop', id: 'loop', since: '0.1.0' }];
  b.files = {
    'chapters/beats/loop/card.md': card({ id: 'loop', name: 'Loop', family: 'science', entry: 'create_beats', summary: 's', when: WHEN }),
    'chapters/beats/loop/recipe.json': { entry: 'create_beats', kind: 'beats-pattern', title: 'Loop', params: {} },
  };
  const r = await validateBook(write(t, b));
  clean(r);
  hasWarning(r, /dead data/);
});

test("motion cards may omit family — it defaults to 'motion' — but not contradict it", async (t) => {
  const make = (family) => {
    const b = baseBook();
    b.manifest.chapters = ['motion'];
    b.manifest.entries = [{ type: 'recipe', chapter: 'motion', dir: 'shot', id: 'shot', since: '0.1.0' }];
    const meta = { id: 'shot', name: 'Shot', entry: 'forge_motion', summary: 's', when: WHEN };
    if (family) meta.family = family;
    b.files = {
      'chapters/motion/shot/card.md': card(meta),
      'chapters/motion/shot/recipe.json': { entry: 'forge_motion', shot: { motion: 'push_in' } },
    };
    return b;
  };
  clean(await validateBook(write(t, make(undefined))));
  clean(await validateBook(write(t, make('motion'))));
  hasError(await validateBook(write(t, make('science'))), /not a motion family/);
});

// ---- id collisions, scoped per catalog like the loader -------------------

test('two entries sharing an id in one catalog collide; across catalogs they do not', async (t) => {
  const collide = baseBook();
  collide.manifest.chapters = ['science', 'math'];
  collide.manifest.entries.push({ type: 'recipe', chapter: 'math', dir: 'widget', id: 'widget', since: '0.1.0' });
  collide.files['chapters/math/widget/card.md'] = card({ id: 'widget', name: 'W', family: 'math', entry: 'create_view', summary: 's', when: WHEN });
  collide.files['chapters/math/widget/recipe.json'] = { entry: 'create_view', kind: 'ftc', params: {}, title: 'W' };
  hasError(await validateBook(write(t, collide)), /already used in the view catalog/);

  const ok = baseBook();
  ok.manifest.chapters = ['science', 'beats'];
  ok.manifest.entries.push({ type: 'recipe', chapter: 'beats', dir: 'widget', id: 'widget', since: '0.1.0' });
  ok.files['chapters/beats/widget/card.md'] = card({ id: 'widget', name: 'W', entry: 'create_beats', summary: 's', when: WHEN });
  ok.files['chapters/beats/widget/recipe.json'] = { entry: 'create_beats', kind: 'beats-pattern', title: 'W', params: {} };
  clean(await validateBook(write(t, ok)));
});

// ---- Door 1: recipe.json --------------------------------------------------

test('a recipe entry needs a parseable recipe.json', async (t) => {
  const missing = baseBook();
  delete missing.files['chapters/science/widget/recipe.json'];
  hasError(await validateBook(write(t, missing)), /recipe\.json is missing/);

  const broken = baseBook();
  broken.files['chapters/science/widget/recipe.json'] = '{ nope';
  hasError(await validateBook(write(t, broken)), /recipe\.json.*not valid JSON/);
});

test('the card and the recipe must name the same entry tool', async (t) => {
  const b = baseBook();
  b.files['chapters/science/widget/recipe.json'] = { entry: 'mint_solid', kind: 'atom', params: {} };
  hasError(await validateBook(write(t, b)), /must name the same tool/);
});

test('each entry tool requires the keys that carry its mint', async (t) => {
  const cases = [
    ['create_view', { entry: 'create_view', params: {} }, /needs 'kind'/],
    ['compose_world', { entry: 'compose_world', title: 'w' }, /needs 'base'/],
    ['mint_solid', { entry: 'mint_solid', kind: 'workbench' }, /needs 'spec'/],
    ['forge_motion', { entry: 'forge_motion', subject: {} }, /needs 'shot'/],
  ];
  for (const [entry, recipe, expected] of cases) {
    const b = baseBook();
    const family = { create_view: 'science', compose_world: 'world', mint_solid: 'object' }[entry];
    const meta = { id: 'widget', name: 'Widget', entry, summary: 's', when: WHEN };
    if (family) meta.family = family;
    b.files['chapters/science/widget/card.md'] = card(meta);
    b.files['chapters/science/widget/recipe.json'] = recipe;
    hasError(await validateBook(write(t, b)), expected);
  }
});

// ---- Door 2: builders -----------------------------------------------------

function builderBook(source = PURE_BUILDER) {
  const b = baseBook();
  b.manifest.entries = [{ type: 'builder', chapter: 'science', dir: 'widget', id: 'widget', since: '0.1.0' }];
  b.files = {
    'chapters/science/widget/card.md': card({
      id: 'widget', name: 'Widget', family: 'science', entry: 'create_view', summary: 's', when: WHEN,
    }),
    'chapters/science/widget/builder.js': source,
    'chapters/science/widget/builder.test.js': "import test from 'node:test';\ntest('ok', () => {});\n",
  };
  return b;
}

test('a well-formed builder entry validates clean', async (t) => {
  const r = await validateBook(write(t, builderBook()));
  clean(r);
  assert.equal(r.stats.builders, 1);
});

test('a builder ships with the tests that are its machine gate', async (t) => {
  const b = builderBook();
  delete b.files['chapters/science/widget/builder.test.js'];
  hasError(await validateBook(write(t, b)), /builder\.test\.js is missing/);
});

test('impurity is caught by source scan, in prose-heavy builders too', async (t) => {
  const cases = [
    [`import { helper } from './helper.js';\n${PURE_BUILDER}`, /static import/],
    [PURE_BUILDER.replace('return { faces: [], stats: {} }', 'return { faces: [], jitter: Math.random() }'), /Math\.random/],
    [PURE_BUILDER.replace('return { faces: [], stats: {} }', 'return { faces: [], t: Date.now() }'), /Date\.now/],
    [PURE_BUILDER.replace('return { faces: [], stats: {} }', 'return { faces: [], t: new Date() }'), /new Date/],
    [`const fs = require('node:fs');\n${PURE_BUILDER}`, /require/],
    [PURE_BUILDER.replace('return { faces: [], stats: {} }', 'return { faces: [], d: process.env.DEBUG }'), /process state/],
  ];
  for (const [source, expected] of cases) {
    hasError(await validateBook(write(t, builderBook(source))), expected);
  }
  // The real builders discuss their own purity in prose ("no imports, no
  // dice") — comments must not trip the scan.
  const commented = `/**\n * Pure: no imports, no Math.random(), no Date.now().\n */\n// also no require()\n${PURE_BUILDER}`;
  clean(await validateBook(write(t, builderBook(commented))));
});

test('the injected-toolkit signature stays legal', async (t) => {
  const tier2 = `export const kind = { id: 'widget', manifestKind: 'widget-view', family: 'science', title: 'mojulo widget' };
export function plan(recipe, { toolkit } = {}) {
  if (!toolkit?.effects?.buildVolumeFrag) throw new Error('needs the injected effects toolkit');
  return { raymarch: { frag: toolkit.effects.buildVolumeFrag({ globals: '' }) }, stats: {} };
}
export function assemble(recipe, { title, toolkit } = {}) { return { faces: [], title }; }
`;
  clean(await validateBook(write(t, builderBook(tier2))));
});

test('the export contract is enforced the way the loader enforces it', async (t) => {
  const noAssemble = `export const kind = { id: 'widget', manifestKind: 'widget-view', family: 'science', title: 'x' };\n`;
  hasError(await validateBook(write(t, builderBook(noAssemble))), /must export \{ kind/);

  const idDrift = PURE_BUILDER.replace("id: 'widget'", "id: 'gadget'");
  hasError(await validateBook(write(t, builderBook(idDrift))), /kind\.id 'gadget' does not match/);

  const badPlan = `${PURE_BUILDER}\nexport const planX = 1;`.replace('export function plan(recipe) { return { faces: [], stats: {} }; }', 'export const plan = 42;');
  hasError(await validateBook(write(t, builderBook(badPlan))), /'plan' is exported but is not a function/);
});

test("a family the loader would silently coerce to 'science' warns", async (t) => {
  const b = builderBook(PURE_BUILDER.replace("family: 'science'", "family: 'world'"));
  const r = await validateBook(write(t, b));
  clean(r);
  hasWarning(r, /silently coerces it to 'science'/);
});

test('a builder that cannot be imported is reported, not thrown', async (t) => {
  hasError(await validateBook(write(t, builderBook('export const kind = { syntax error'))), /failed to import/);
});

test('builders exist only for the create_view lane', async (t) => {
  const b = builderBook();
  b.manifest.entries[0].entry = 'mint_solid';
  hasError(await validateBook(write(t, b)), /only for 'create_view'/);
});

// ---- the transcription itself --------------------------------------------

test('CARD_CATALOGS covers every entry tool the book can route to', () => {
  assert.deepEqual(Object.keys(CARD_CATALOGS).sort(), [
    'compose_world', 'create_beats', 'create_figure', 'create_view', 'edit_solid', 'forge_motion', 'mint_solid', 'stitch_motion',
  ]);
});

test('parseCard returns the body separately from the frontmatter', () => {
  const root = mkdtempSync(join(tmpdir(), 'recipe-book-test-'));
  const p = join(root, 'card.md');
  writeFileSync(p, card({ id: 'a', name: 'A', entry: 'create_view', summary: 's', when: WHEN }, 'The manual.'));
  const parsed = parseCard(p);
  assert.equal(parsed.id, 'a');
  assert.equal(parsed.body, 'The manual.');
  rmSync(root, { recursive: true, force: true });
});

test('the wardrobe lane: a garment entry is card + garment.json, an outfit entry card + outfit.json', async (t) => {
  const card = (id, name) => `---\n{ "id": "${id}", "name": "${name}", "entry": "create_figure", "summary": "s", "when": "dress a figure in this; a long enough intent line for the gate" }\n---\n\nDials.\n`;
  const b = baseBook();
  b.manifest.chapters = ['science', 'wardrobe'];
  b.manifest.entries.push(
    { type: 'garment', chapter: 'wardrobe', dir: 'shift', id: 'shift', since: '0.1.0' },
    { type: 'outfit', chapter: 'wardrobe', dir: 'look', id: 'look', since: '0.1.0' },
  );
  b.files['chapters/wardrobe/shift/card.md'] = card('shift', 'Shift');
  b.files['chapters/wardrobe/shift/garment.json'] = { id: 'shift', pieces: [{ id: 'front', fit: 'pattern', sloper: 'bodice-front' }] };
  b.files['chapters/wardrobe/look/card.md'] = card('look', 'Look');
  b.files['chapters/wardrobe/look/outfit.json'] = { fit: 'regular', layers: ['shift'] };
  const r = await validateBook(write(t, b));
  assert.equal(r.errors.length, 0, formatReport(r));
  assert.equal(r.stats.wardrobe, 2);

  const bad = baseBook();
  bad.manifest.chapters = ['science', 'wardrobe'];
  bad.manifest.entries.push({ type: 'garment', chapter: 'wardrobe', dir: 'ghost', id: 'ghost', since: '0.1.0' }, { type: 'outfit', chapter: 'wardrobe', dir: 'empty', id: 'empty', since: '0.1.0' });
  bad.files['chapters/wardrobe/ghost/card.md'] = card('ghost', 'Ghost');
  bad.files['chapters/wardrobe/empty/card.md'] = card('empty', 'Empty');
  bad.files['chapters/wardrobe/empty/outfit.json'] = { layers: [] };
  const rb = await validateBook(write(t, bad));
  hasError(rb, /garment\.json is missing/);
  hasError(rb, /non-empty 'layers'/);
});
