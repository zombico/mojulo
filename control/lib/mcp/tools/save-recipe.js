/**
 * save_recipe — the cookbook's write path (recipe-book.plan.md, Phase 5): the
 * first-class affordance for the operator to KEEP a recipe. Promotes a
 * minted-and-tuned sketch into a named entry in the operator's own cookbook
 * (a Door-1 recipe card + recipe.json beside the instance's data), so it can
 * be recalled BY INTENT later — the loop mint → tweak → keep → recall.
 *
 * The card's `when` line is the product moment: the AGENT writes it from the
 * conversation's intent ("the pendulum setup for my Tuesday class"), and that
 * line leads the embedding — it is what makes the recipe findable by meaning
 * months later. Saves are ledgered with a local git commit in the cookbook
 * (no remote, ever — sharing is the operator's act).
 *
 * Lanes (recipe-book.plan.md, Phase 4): study-object recipes (create_view
 * kinds — core AND attached-book ones) and beats recipes (create_beats
 * kinds). Both are pure self-contained params over a regenerating kernel.
 * Solids / motion join by the same lane pattern once their extraction story
 * is settled (solid specs ride per-kind authoring doors; motion recipes embed
 * instance-local subject refs — each deserves its own care).
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { VIEW_KINDS } from '@/lib/mcp/tools/create-view';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';
import { bookViewKinds } from '@/lib/graph/views/recipe-book/registry';
import { saveRecipeEntry } from '@/lib/graph/views/recipe-book/cookbook';
import { ensureBookLoaded, _resetBookLoader } from '@/lib/graph/views/recipe-book/loader';
import { getViewVocabCatalog, _resetViewVocabCache } from '@/lib/graph/views/view-vocab/loader';
import { getBeatsVocabCatalog, _resetBeatsVocabCache } from '@/lib/graph/beats/beats-vocab/loader';

const ID_RE = /^[a-z][a-z0-9-]{1,47}$/;

// manifest.kind → { kind, family }: core kinds store either `<kind>-view`
// (saturn-view) or the kind itself (dna-process); book kinds carry an explicit
// manifestKind in the registry snapshot.
export function deriveViewKind(manifestKind) {
  for (const [k, entry] of Object.entries(VIEW_KINDS)) {
    if (manifestKind === k || manifestKind === `${k}-view`) return { kind: k, family: entry.family };
  }
  for (const bk of bookViewKinds().values()) {
    if (manifestKind === bk.manifestKind) return { kind: bk.id, family: bk.family };
  }
  return null;
}

/**
 * manifest.kind → the save LANE: which entry tool re-mints it, which chapter
 * it files under, which vocab catalog guards id uniqueness and serves recall.
 * `family` is the card's frontmatter family (null ⇒ omitted — beats cards
 * don't carry one); `mint` is the card-body phrase for the re-mint path
 * (cards never name entry tools in their bodies — `entry` carries that).
 */
export function deriveRecipeLane(manifestKind) {
  if (isBeatsKind(manifestKind)) {
    return {
      entry: 'create_beats', kind: manifestKind, chapter: 'beats', family: null,
      vocabKind: 'beats_vocab', reader: 'get_beats_vocab',
      catalog: getBeatsVocabCatalog, mint: 'beats mint',
    };
  }
  const v = deriveViewKind(manifestKind);
  if (v) {
    return {
      entry: 'create_view', kind: v.kind, chapter: v.family, family: v.family,
      vocabKind: 'view_vocab', reader: 'get_view_vocab',
      catalog: getViewVocabCatalog, mint: 'study-object mint',
    };
  }
  return null;
}

// The saved card mirrors the book format exactly — a cookbook IS a valid book.
export function draftRecipeCard({ id, name, family, entry, mint, when, summary, notes, kind, recipe, ref }) {
  const front = {
    id,
    name,
    ...(family ? { family } : {}),
    entry,
    summary: summary || `A saved recipe over the '${kind}' kind — ${name}.`,
    when,
  };
  return `---\n${JSON.stringify(front, null, 2)}\n---\n\n`
    + `Saved from sketch \`${ref}\` — a kept setting of the \`${kind}\` kind.\n`
    + (notes ? `\n${notes}\n` : '')
    + `\n## Recipe\n\n\`\`\`json\n${JSON.stringify(recipe, null, 2)}\n\`\`\`\n\n`
    + `Pass the \`kind\` and \`params\` above to the ${mint}. The\n`
    + `underlying kind's full manual is its own card (\`id: '${kind}'\`).\n`;
}

export async function saveRecipeHandler(input) {
  const { ref, id, when, name, summary, notes } = input && typeof input === 'object' ? input : {};
  if (typeof ref !== 'string' || !ref.trim()) throw new Error('save_recipe requires `ref` — the stored sketch to keep');
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    throw new Error("save_recipe requires `id` — kebab-case, 2–48 chars (e.g. 'tuesday-pendulum')");
  }
  if (typeof when !== 'string' || !when.trim()) {
    throw new Error('save_recipe requires `when` — the intent phrases that should recall this recipe later '
      + "(write it from the conversation, e.g. 'the pendulum setup for my Tuesday class; slow storm aurora for the projector')");
  }

  const sketch = SketchRepository.getByRef(ref.trim());
  if (!sketch) throw new Error(`save_recipe: sketch '${ref}' not found`);
  const manifest = sketch.manifest;
  if (!manifest || typeof manifest.kind !== 'string') throw new Error(`save_recipe: sketch '${ref}' has no manifest kind`);

  await ensureBookLoaded();   // book kinds must be resolvable before deriving
  const lane = deriveRecipeLane(manifest.kind);
  if (!lane) {
    throw new Error(`save_recipe: '${manifest.kind}' is not a keepable recipe kind — save_recipe covers `
      + 'create_view and create_beats artifacts today (solids / motion join by the same lane pattern)');
  }

  if (lane.catalog().has(id)) {
    throw new Error(`save_recipe: id '${id}' already exists in the catalog — pick another (e.g. '${id}-2')`);
  }

  const params = { ...manifest };
  delete params.kind;
  delete params.title;
  const displayName = (typeof name === 'string' && name.trim()) || sketch.title || manifest.title || `${lane.kind} recipe`;
  const recipe = { entry: lane.entry, kind: lane.kind, params, title: displayName };
  const cardText = draftRecipeCard({
    id, name: displayName, family: lane.family, entry: lane.entry, mint: lane.mint,
    when: when.trim(), summary, notes, kind: lane.kind, recipe, ref: sketch.ref,
  });

  const saved = saveRecipeEntry({ id, chapter: lane.chapter, cardText, recipe });

  // Make the save visible NOW: drop the card/catalog caches, reload the book
  // snapshot, and upsert the index (reindexAll is incremental — unchanged
  // rows are hash-skipped, so this is a single-card write in practice).
  _resetBookLoader();
  _resetViewVocabCache();
  _resetBeatsVocabCache();
  await ensureBookLoaded();
  let indexed = false;
  try {
    const { reindexAll } = await import('@/lib/db/repositories/embeddings');
    await reindexAll();
    indexed = true;
  } catch (err) {
    console.warn(`save_recipe: saved but reindex failed (${err.message}) — run scripts/reindex-embeddings.js`);
  }

  return {
    ok: true,
    id,
    kind: lane.kind,
    chapter: lane.chapter,
    cookbook: saved.dir,
    committed: saved.committed,
    indexed,
    recall: { [lane.reader]: { id }, semantic_search: { kinds: [lane.vocabKind], query: when.trim() } },
  };
}

export function registerSaveRecipeTools() {
  registerTool({
    name: 'save_recipe',
    description:
      "KEEP a recipe: promote a minted-and-tuned artifact into the operator's own COOKBOOK — a named, "
      + 'intent-recallable catalog entry (card + params) beside the instance data, ledgered with a local git commit. '
      + 'The saved entry joins the same catalog as shipped kinds: recall it later via '
      + "semantic_search over the family's vocab kind or its get_*_vocab reader, and re-mint via the family's entry "
      + 'tool. Write `when` from the CONVERSATION\'S intent — it is what makes the recipe findable by meaning later. '
      + 'Reach for "save this / keep this setup / remember this view for my class / keep that loop". Saves '
      + 'create_view recipes (core and attached-book kinds) and create_beats recipes; solids / motion join later.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The stored sketch to keep (its manifest becomes the recipe).' },
        id: { type: 'string', description: "Catalog id for the saved recipe — kebab-case, unique (e.g. 'tuesday-pendulum')." },
        when: { type: 'string', description: 'Intent phrases that should recall this recipe later — written from the conversation.' },
        name: { type: 'string', description: 'Display name (defaults to the sketch title).' },
        summary: { type: 'string', description: 'One-line card summary (defaults from name + kind).' },
        notes: { type: 'string', description: 'Optional card body paragraph (why this setting is kept, teaching notes).' },
      },
      required: ['ref', 'id', 'when'],
    },
    handler: saveRecipeHandler,
  });
}
