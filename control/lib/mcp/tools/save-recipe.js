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
 * v1 scope: study-object recipes (create_view kinds — core AND attached-book
 * ones). Worlds / solids / beats join when the multi-family book lands
 * (plan Phase 4).
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { VIEW_KINDS } from '@/lib/mcp/tools/create-view';
import { bookViewKinds } from '@/lib/graph/views/recipe-book/registry';
import { saveRecipeEntry } from '@/lib/graph/views/recipe-book/cookbook';
import { ensureBookLoaded, _resetBookLoader } from '@/lib/graph/views/recipe-book/loader';
import { getViewVocabCatalog, _resetViewVocabCache } from '@/lib/graph/views/view-vocab/loader';

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

// The saved card mirrors the book format exactly — a cookbook IS a valid book.
export function draftRecipeCard({ id, name, family, when, summary, notes, kind, recipe, ref }) {
  const front = {
    id,
    name,
    family,
    entry: 'create_view',
    summary: summary || `A saved recipe over the '${kind}' kind — ${name}.`,
    when,
  };
  return `---\n${JSON.stringify(front, null, 2)}\n---\n\n`
    + `Saved from sketch \`${ref}\` — a kept setting of the \`${kind}\` kind.\n`
    + (notes ? `\n${notes}\n` : '')
    + `\n## Recipe\n\n\`\`\`json\n${JSON.stringify(recipe, null, 2)}\n\`\`\`\n\n`
    + `Pass the \`kind\` and \`params\` above to the study-object mint. The\n`
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
  const derived = deriveViewKind(manifest.kind);
  if (!derived) {
    throw new Error(`save_recipe: '${manifest.kind}' is not a create_view kind — v1 saves study-object recipes only `
      + '(worlds / solids / beats join with the multi-family book)');
  }

  if (getViewVocabCatalog().has(id)) {
    throw new Error(`save_recipe: id '${id}' already exists in the catalog — pick another (e.g. '${id}-2')`);
  }

  const params = { ...manifest };
  delete params.kind;
  delete params.title;
  const displayName = (typeof name === 'string' && name.trim()) || sketch.title || manifest.title || `${derived.kind} recipe`;
  const recipe = { entry: 'create_view', kind: derived.kind, params, title: displayName };
  const cardText = draftRecipeCard({
    id, name: displayName, family: derived.family, when: when.trim(),
    summary, notes, kind: derived.kind, recipe, ref: sketch.ref,
  });

  const saved = saveRecipeEntry({ id, chapter: derived.family, cardText, recipe });

  // Make the save visible NOW: drop the card/catalog caches, reload the book
  // snapshot, and upsert the index (reindexAll is incremental — unchanged
  // rows are hash-skipped, so this is a single-card write in practice).
  _resetBookLoader();
  _resetViewVocabCache();
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
    kind: derived.kind,
    chapter: derived.family,
    cookbook: saved.dir,
    committed: saved.committed,
    indexed,
    recall: { get_view_vocab: { id }, semantic_search: { kinds: ['view_vocab'], query: when.trim() } },
  };
}

export function registerSaveRecipeTools() {
  registerTool({
    name: 'save_recipe',
    description:
      "KEEP a recipe: promote a minted-and-tuned study-object sketch into the operator's own COOKBOOK — a named, "
      + 'intent-recallable catalog entry (card + params) beside the instance data, ledgered with a local git commit. '
      + 'The saved entry joins the same catalog as shipped kinds: recall it later via '
      + "semantic_search({ kinds: ['view_vocab'] }) or get_view_vocab({ id }), and re-mint via create_view. "
      + 'Write `when` from the CONVERSATION\'S intent — it is what makes the recipe findable by meaning later. '
      + 'Reach for "save this / keep this setup / remember this view for my class". v1 saves create_view recipes '
      + '(core and attached-book kinds).',
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
