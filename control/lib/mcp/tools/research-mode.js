/**
 * MCP Ring 9 — research mode (the optional research drawer).
 *
 * The ACCRETIVE / exploratory counterpart to plan mode. Where a Plan pushes
 * toward an outcome, a Research session has no goal but to assist the user —
 * it accretes broad material (links, articles, summaries, screencaps, notes)
 * into a durable, book-like context. Starting a session auto-saves it. Its one
 * structured output is synthesize_abstract: a distilled thesis sent to plan
 * mojulo for evaluation, optionally forging a Draft plan.
 *
 * Deliberately a LOW-PROMINENCE drawer (posture-sibling to sketches): NOT woven
 * into forward_context, no quick-orientation rule. The agent enters research
 * mode only when the user explicitly asks to research / gather / look into
 * something — discovered via tools/list, primed by enter_research_mode.
 *
 * Tool surface:
 *   - enter_research_mode   — the light research brief (opposite of the
 *     four-lens plan discipline; trust the model's natural research strength).
 *   - start_research        — auto-save a session.
 *   - bind_research_item    — accrete a broad item.
 *   - synthesize_abstract   — distill the book; optionally evaluate via the
 *     research→plan bridge.
 *   - sketch_research       — preview the book as a hub-spoke diagram without
 *     synthesizing. Standalone sketch (not bound to the book).
 *   - get_research          — read a full book (session + items + abstracts).
 *   - list_research         — list sessions.
 *
 * One-way coupling: research depends on plans (via lib/research/evaluate.js);
 * plans never import research. See
 * lite-template/integration/app-system/0528/research-mode.md.
 *
 * Research–science composition (research-science.plan.md): the `experiment`
 * item kind binds a science-view artifact WITH its provenance ({ recipe,
 * stats } in metadata — gated at bind time), and synthesize_abstract's
 * `review: true` runs the deterministic reviewer over those items
 * (recompute-from-recipe via measure-view's recomputeViewStats — the machina
 * forward+verify posture, never an LLM pass). Same one-way discipline:
 * research imports the view planners; the views never import research.
 */

import { createHash } from 'node:crypto';

import { registerTool } from '@/lib/mcp/server';
import { ResearchRepository } from '@/lib/db/repositories/research';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { evaluateAbstract } from '@/lib/research/evaluate';
import { mintSketch } from '@/lib/mcp/tools/sketches';
import { recomputeViewStats, REVIEWABLE_VIEW_KINDS } from '@/lib/mcp/tools/measure-view';
import { researchToSketchManifest } from '@/lib/sketch-derive';

function sketchUrl(ref) {
  return `/sketches/${encodeURIComponent(ref)}`;
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// whitespace-normalized containment — the quote check. Verbatim modulo whitespace: quotes
// wrap and re-indent when they travel; words do not.
const normalizeWs = (s) => String(s).replace(/\s+/g, ' ').trim();

// Broad but known item kinds. A book holds anything, but the bind tool gates
// on this set so a typo doesn't silently create a junk kind. Adding a kind is
// a one-line change here — the table column stays freeform on purpose. The
// `sketch` kind is the ad hoc diagram-reference path: bind an existing
// `sk_<…>` sketch via media_ref (counterpart to the auto-minted diagram that
// synthesize_abstract attaches to each thesis). The `experiment` kind is the
// provenance-carrying variant for science-view artifacts: media_ref is the
// sketch, metadata carries the { recipe, stats } the create_* mint returned —
// so the book remembers the exact initial conditions and the measured outcome,
// not just what the artifact looked like. Unlike the other kinds it has a
// typed gate (see bindResearchItemHandler): a bound experiment without its
// recipe is unreproducible, which defeats the kind.
// The `prediction` kind is the falsification structure, formalized: expected numeric
// outcomes anchored to an experiment item, checked deterministically at review time.
// A falsified prediction is a RESULT, not an integrity failure — review reports it in
// its own `predictions` block and never marks the book inconsistent for being wrong.
const KNOWN_KINDS = new Set([
  'link',
  'article',
  'summary',
  'screencap',
  'note',
  'quote',
  'snippet',
  'sketch',
  'experiment',
  'prediction',
]);

// relative tolerance for prediction checks when the item doesn't declare one. Predictions
// come from truncated series and closed forms compared against sampled measurements —
// exact equality is the wrong bar; 1% is beyond any honest sampling error in the channel.
const PREDICTION_DEFAULT_TOLERANCE = 0.01;

const RESEARCH_BRIEF = `# Research mode

You are in **research mode** — an optional drawer for gathering. Unlike plan mode, there is **no goal but to assist the user**, and no terminus. You are writing a durable book.

## What to do

- **Bind broadly.** Anything that helps: a \`link\`, an \`article\` (with its fetched text), a \`summary\` you wrote, a \`screencap\`, a \`note\`, a \`quote\`, a \`snippet\`. Bind summaries you generate as their own items so the book remembers what it concluded. The book holds anything.
- **Trust your natural strength.** Mojulo doesn't prescribe a research method — read, connect, summarize on demand. The substrate just gives you a durable place to write and a pipe to hand finished thoughts downstream.
- **Never force convergence.** A research session can outlive many plans. Don't push toward an outcome — that's plan mode's job.

## Numerical experiments (science views)

A science-view artifact is a **reproducible experiment**: its recipe pins the exact initial conditions, and the stats digest the mint returned is the measured outcome. Bind one with \`kind: 'experiment'\` — \`media_ref\` = the \`sk_<…>\` ref, \`metadata\` = \`{ recipe, stats }\` captured verbatim from the create_* response — so the book remembers what was *run*, not just what it looked like. For a parameter sweep ("what happens to X as I vary Y?"), call \`run_experiment_sweep\` — one call mints every point, binds every experiment, and auto-plots param-vs-outcome into the book; bind your comparative analysis as a \`summary\` alongside. \`measure_view({ ref })\` reads back the physical time-series (mechanics-view dynamics and orbit-view only — the kinds whose numbers are real SI). At synthesis, \`synthesize_abstract({ review: true })\` recomputes every experiment from its stored artifact and flags drift (\`artifact_missing\` / \`recipe_drift\` / \`stats_mismatch\`) — a provenance check, never a judgment of the thesis; that stays yours.

**Predict before you conclude.** Bind a \`prediction\` — \`metadata: { experiment_item_id, expected: { flightTime: 7.657 }, tolerance? }\`, formula/reasoning in \`body\` — and review checks each expected value against the experiment's measured outcomes: **confirmed / falsified / unmeasurable**, in their own \`predictions\` block. A falsified prediction is a *result*, not an integrity failure — it never marks the book inconsistent. Math views measure too, at tier \`exact\` (derivative-view: f, f′, the secant limit; series-view: partial-sum errors by term count) — convergence-rate experiments and numerical falsification of identities are in scope.

## Source integrity (quotes and articles)

The same recompute-don't-trust posture works on literature. \`article\` bodies are content-hashed automatically at bind time. When you bind a \`quote\` taken from an article already in the book, anchor it: \`metadata: { source_item_id: <the article's item_id> }\`. Review then verifies every anchored quote still appears verbatim in its source (\`quote_drift\` / \`quote_source_missing\` / \`source_hash_mismatch\`). Quotes citing only an external \`source_url\` are fine — they simply aren't checkable.

## When a concept crystallizes

If, while gathering, a concept emerges that *could become work*, call \`synthesize_abstract\` — distill the book into a tight thesis (what concept emerged, why it matters, what it implies). With \`evaluate: true\`, the abstract is sent to **plan mojulo** for evaluation against the plans paradigm. Supply your own judgment: a \`suggested_lens\` (spike / segment_expansion / vertical_reinforcement / collider) and a \`recommendation\` — \`forge\` if there's a tractable spike here (plan mojulo will forge a Draft plan seeded from the abstract), or \`keep_researching\` with a \`missing\` list if the book isn't ripe yet. Forging a plan does nothing on its own; it just hands the baton to plan mode.

## Lifecycle

start_research (auto-saves) → bind_research_item (loop, broadly) → synthesize_abstract (distill → optionally evaluate). No compile, no execute. You decide if and when to synthesize.

## Gather / Stash — the sharper path (prefer this for new gatherings)

There is a second, sharper-edged path with a typed intake contract: **Gather** (the verb) binds items into a **Stash** (a renameable user-facing bucket with optional Drawers). Use this path when you want the UI to render items meaningfully (each item has a type — text / markdown / image / svg / script / pointer / link — and the gate validates required-per-type metadata).

- \`mint_stash({ title })\` — create a stash (returns \`stash_ref\`).
- \`gather({ stash_ref, type, …per-type fields, drawer? })\` — bind a typed item. Malformed items are *rejected at the gate*, not stored as junk.
- \`mint_drawer({ stash_ref, name })\` — optional sub-grouping.
- \`rename_stash\`, \`list_stashes\`, \`get_stash\` for the rest.

The legacy research book (\`start_research\` / \`bind_research_item\` / \`synthesize_abstract\`) still works for existing books, but **prefer Gather/Stash for new gatherings** — it's the only path Cook collides, and the only one that lands as a first-class deliberation node other rings can read.

## Cook — the nucleation collider (low-frequency, high-signal)

Gathering is the routine. **Cook is the irruption** — you only fire it when enough material has accreted that nucleation is possible AND a real *dismantling question* presents itself. Most sessions never cook; that's correct.

### Cook stops at cook

Cook materializes ONE outcome artifact aimed at ONE target. **It does not fan out to plan mode.** If a cook outcome later reads as tractable work, plan mode pulls it via \`forge_plan({ source: { kind: 'cook', cook_ref } })\` — that's a plan-side decision made later, not a cook outlet. Any future ring (audit, compose, brief, …) that wants to deliberate on a cook output reads it the same way: cook is a first-class node, rings read nodes.

Don't look for a \`cook({ outlet: 'plan' })\` shape. It doesn't exist on purpose.

### The binding vow

A Cook aims its nucleation arrow at **ONE target** — the singular \`aim\`. If you find yourself wanting to nucleate two outcomes from the same superposition, that is *two cooks*. Refuse to compound them. The body of a report can enumerate, structure, and detail; the **outcome** is the singular framing the aim names.

> "What open questions remain?" is ONE aim. The body lists six questions — that is *inferred sub-structure within the single answer*, not six separate outcomes.

### The three requirements

1. **Cleave slices of context from Stash(es).** A slice is a *deliberate cut* — \`{ stash_ref, item_ids? }\`. Choose the items. Omitting \`item_ids\` for a whole-stash slice is allowed but should be the exception; if you haven't chosen, you haven't cleaved. Multiple slices, including across stashes, are the superposition you nucleate from.

2. **A dismantling question, not an exploratory one.** A dismantling question seeks *pattern in the situation*: "what unifies these?", "where do these disagree?", "what is the hidden structure?". Exploratory questions ("tell me about X") are *gathering* — they belong upstream.

3. **Nucleate one new artifact.** You author \`report_md\` — a tight, focused composition aimed at the singular target. The slices are **recombinator material, not citation material**: they flavor the prose's reasoning and language without appearing in it as quotes or "we read X then Y." If the report cites slices like sources, you are writing a Wiki page, not a Cook outcome.

### Tool surface

- \`cook({ slices: [{ stash_ref, item_ids? }, …], aim, report_md, suggested_lens?, visuals?, additional_context? })\` — materializes the Outcome Artifact folder (\`control/data/outcomes/<cook_ref>/\` with report.md, static index.html, manifest.json, optional svg/png). Returns \`{ cook_ref, outcome_url, … }\`.
- \`get_cook({ cook_ref })\` — read a cook row (the index pointing at its folder). The way any ring reads a cook node.
- \`list_cooks({ limit? })\` — the outcomes inbox.

The cook tool is the only tool that fires the furnace. Mojulo materializes the artifact; you do the nucleating. To later promote a cook to plan-mode work: \`forge_plan({ source: { kind: 'cook', cook_ref } })\` (plan-side, not cook-side).`;

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

export async function enterResearchModeHandler(_input, _ctx) {
  return { brief: RESEARCH_BRIEF };
}

export async function startResearchHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('start_research requires an object with title');
  }
  const session = ResearchRepository.startSession({ title: input.title });
  return { ok: true, research_ref: session.researchRef, title: session.title, status: session.status };
}

export async function bindResearchItemHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('bind_research_item requires an object');
  }
  const { research_ref, kind, title, body, source_url, media_ref, metadata } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  if (!kind || typeof kind !== 'string') {
    throw new Error('kind is required');
  }
  if (!KNOWN_KINDS.has(kind)) {
    throw new Error(
      `kind '${kind}' is not recognized. Known kinds: ${[...KNOWN_KINDS].join(', ')}.`,
    );
  }
  // experiment gate: a science-view binding without its provenance is unreproducible —
  // reject at the door (Gather-style) rather than store a junk experiment. `metadata.stats`
  // is recommended (it is what review recomputes against) but optional: some views return
  // thin digests, and a recipe alone still reproduces the run.
  if (kind === 'experiment') {
    if (!media_ref || typeof media_ref !== 'string') {
      throw new Error(
        "kind 'experiment' requires media_ref — the sk_<…> ref of the science-view sketch (from the create_* response).",
      );
    }
    const recipe = metadata && typeof metadata === 'object' ? metadata.recipe : undefined;
    if (!recipe || typeof recipe !== 'object' || typeof recipe.kind !== 'string') {
      throw new Error(
        "kind 'experiment' requires metadata.recipe — the recipe object the create_* mint returned (it must carry its `kind`). "
        + 'Bind metadata: { recipe, stats } verbatim from the mint response so the book holds the exact initial conditions.',
      );
    }
  }
  // prediction gate: expected values without an anchor are uncheckable; an anchor without
  // expected values predicts nothing. Both are required, both structural.
  if (kind === 'prediction') {
    const anchor = metadata && typeof metadata === 'object' ? metadata.experiment_item_id : undefined;
    if (!Number.isFinite(+anchor)) {
      throw new Error(
        "kind 'prediction' requires metadata.experiment_item_id — the item_id of the experiment this prediction is checked against.",
      );
    }
    const expected = metadata.expected;
    const numericKeys = expected && typeof expected === 'object'
      ? Object.entries(expected).filter(([, v]) => Number.isFinite(+v))
      : [];
    if (numericKeys.length === 0) {
      throw new Error(
        "kind 'prediction' requires metadata.expected — an object of >= 1 finite numeric values keyed by outcome/stat name "
        + "(e.g. { flightTime: 7.657 }). Put the reasoning/formula in `body`; optional metadata.tolerance sets the relative bar (default 0.01).",
      );
    }
  }
  // article bodies are content-hashed at bind time (the turn-hashing posture applied to
  // sources): the hash is the server's own stamp, so out-of-band body edits become
  // tamper-evident and anchored quotes can be verified against an untouched source.
  const boundMetadata =
    kind === 'article' && typeof body === 'string' && body
      ? { ...(metadata && typeof metadata === 'object' ? metadata : {}), content_hash: sha256(body) }
      : metadata;
  const item = ResearchRepository.bindItem({
    researchRef: research_ref,
    kind,
    title,
    body,
    sourceUrl: source_url,
    mediaRef: media_ref,
    metadata: boundMetadata,
  });
  return { ok: true, item_id: item.id, research_ref: item.researchRef, kind: item.kind };
}

// ── the deterministic reviewer (synthesize_abstract { review: true }) ──
//
// The machina forward+verify posture applied to the research book: for every bound
// `experiment` item, recompute reality from the stored artifact and compare it against
// what the book claims. Three integrity checks, three discrepancy codes:
//   artifact_missing — the sketch the item points at no longer exists;
//   recipe_drift     — the sketch's stored manifest differs from the recipe bound at
//                      bind time (the artifact was edited after the book cited it);
//   stats_mismatch   — re-running the planner from the stored manifest yields a stats
//                      digest that differs from the metadata.stats snapshot (the planner's
//                      physics changed since bind time — the "figure ↔ code" check).
// Purely structural: recompute-and-compare, no LLM. It checks artifact↔recipe↔snapshot
// integrity, NOT whether the thesis prose is supported — that judgment stays the agent's
// ("agent judges, server structures"). Experiments whose recipe kind has no reviewer
// (REVIEWABLE_VIEW_KINDS) are counted as skipped, not failed.
//
// The same posture, generalized to LITERATURE (research-science.plan.md Phase 6): a
// `quote` item anchored to a source in the same book via metadata.source_item_id gets:
//   quote_source_missing — the anchor points at no item, or at one with no body;
//   source_hash_mismatch — the source's body no longer matches its bind-time
//                          content_hash (out-of-band edit; deduped per source);
//   quote_drift          — the quote's whitespace-normalized text no longer appears
//                          verbatim in the source body (the misquotation check).
// Anchoring is optional — a quote citing only an external source_url is not checkable
// and is left alone rather than false-flagged.
//
// PREDICTIONS get their own block, with different semantics: a falsified prediction is a
// scientific result, not a book-integrity failure, so prediction verdicts NEVER touch
// `consistent`. Only a broken anchor (prediction_source_missing) is a discrepancy. Each
// expected key is checked against the anchored experiment's bound outcomes/stats within
// the item's relative tolerance (default PREDICTION_DEFAULT_TOLERANCE) and lands as
// confirmed | falsified | unmeasurable in review.predictions.results.
function reviewExperimentItems(researchRef) {
  const book = ResearchRepository.getFullBook(researchRef);
  const experiments = (book?.items || []).filter((it) => it.kind === 'experiment');
  const discrepancies = [];
  let checked = 0;
  let skipped = 0;
  for (const it of experiments) {
    const recipe = it.metadata && typeof it.metadata === 'object' ? it.metadata.recipe : undefined;
    if (!recipe || !REVIEWABLE_VIEW_KINDS.has(recipe.kind)) { skipped += 1; continue; }
    checked += 1;
    const sketch = it.mediaRef ? SketchRepository.getByRef(it.mediaRef) : null;
    if (!sketch) {
      discrepancies.push({ item_id: it.id, code: 'artifact_missing', detail: `sketch '${it.mediaRef}' not found` });
      continue;
    }
    if (JSON.stringify(sketch.manifest) !== JSON.stringify(recipe)) {
      discrepancies.push({
        item_id: it.id, code: 'recipe_drift',
        detail: 'the stored sketch manifest differs from the recipe bound at bind time — the artifact was edited after the book cited it',
      });
    }
    const boundStats = it.metadata.stats;
    if (boundStats && typeof boundStats === 'object') {
      let recomputed;
      try {
        recomputed = recomputeViewStats(sketch.manifest);
      } catch (err) {
        discrepancies.push({ item_id: it.id, code: 'stats_mismatch', detail: `recompute failed: ${err?.message || err}` });
        continue;
      }
      for (const [key, bound] of Object.entries(boundStats)) {
        if (!(key in recomputed)) continue;   // snapshot keys the digest no longer carries are not drift
        const now = recomputed[key];
        const same = typeof bound === 'number' && typeof now === 'number'
          ? Math.abs(bound - now) <= Math.max(1e-9, Math.abs(bound) * 1e-9)
          : JSON.stringify(bound) === JSON.stringify(now);
        if (!same) {
          discrepancies.push({
            item_id: it.id, code: 'stats_mismatch',
            detail: `${key}: bound ${JSON.stringify(bound)} ≠ recomputed ${JSON.stringify(now)}`,
          });
        }
      }
    }
  }
  // anchored-quote integrity (source items resolved within the same book).
  const byId = new Map((book?.items || []).map((it) => [it.id, it]));
  const anchored = (book?.items || []).filter(
    (it) => it.kind === 'quote' && it.metadata && typeof it.metadata === 'object' && it.metadata.source_item_id != null,
  );
  const hashFlagged = new Set();
  let quotesChecked = 0;
  for (const q of anchored) {
    quotesChecked += 1;
    const src = byId.get(q.metadata.source_item_id);
    if (!src || typeof src.body !== 'string' || !src.body) {
      discrepancies.push({
        item_id: q.id, code: 'quote_source_missing',
        detail: `source item ${q.metadata.source_item_id} not found in this book, or it has no body to quote from`,
      });
      continue;
    }
    const srcHash = src.metadata && typeof src.metadata === 'object' ? src.metadata.content_hash : undefined;
    if (srcHash && !hashFlagged.has(src.id) && sha256(src.body) !== srcHash) {
      hashFlagged.add(src.id);
      discrepancies.push({
        item_id: src.id, code: 'source_hash_mismatch',
        detail: 'the source body no longer matches its bind-time content_hash — edited out-of-band since binding',
      });
    }
    if (typeof q.body !== 'string' || !q.body.trim() || !normalizeWs(src.body).includes(normalizeWs(q.body))) {
      discrepancies.push({
        item_id: q.id, code: 'quote_drift',
        detail: 'the quoted text no longer appears verbatim (whitespace-normalized) in its source item',
      });
    }
  }

  // anchored predictions: expected vs measured, per key.
  const predictionItems = (book?.items || []).filter(
    (it) => it.kind === 'prediction' && it.metadata && typeof it.metadata === 'object',
  );
  const predictions = { checked: 0, confirmed: 0, falsified: 0, unmeasurable: 0, results: [] };
  for (const p of predictionItems) {
    predictions.checked += 1;
    const exp = byId.get(p.metadata.experiment_item_id);
    if (!exp || exp.kind !== 'experiment' || !exp.metadata || typeof exp.metadata !== 'object') {
      discrepancies.push({
        item_id: p.id, code: 'prediction_source_missing',
        detail: `experiment item ${p.metadata.experiment_item_id} not found in this book (or is not an experiment)`,
      });
      continue;
    }
    const tolRaw = +p.metadata.tolerance;
    const tol = Number.isFinite(tolRaw) && tolRaw > 0 ? tolRaw : PREDICTION_DEFAULT_TOLERANCE;
    const measuredSource = { ...(exp.metadata.stats || {}), ...(exp.metadata.outcomes || {}) };
    for (const [key, rawExpected] of Object.entries(p.metadata.expected || {})) {
      const expected = +rawExpected;
      if (!Number.isFinite(expected)) continue;   // gated at bind; belt-and-braces
      const measured = measuredSource[key];
      if (typeof measured !== 'number' || !Number.isFinite(measured)) {
        predictions.unmeasurable += 1;
        predictions.results.push({ item_id: p.id, key, expected, verdict: 'unmeasurable', detail: `experiment ${exp.id} carries no measured '${key}'` });
        continue;
      }
      const relError = Math.abs(measured - expected) / Math.max(Math.abs(expected), 1e-12);
      const ok = relError <= tol;
      predictions[ok ? 'confirmed' : 'falsified'] += 1;
      predictions.results.push({
        item_id: p.id, key, expected, measured, rel_error: +relError.toPrecision(3), tolerance: tol,
        verdict: ok ? 'confirmed' : 'falsified',
      });
    }
  }

  return {
    items_checked: checked,
    items_skipped: skipped,
    quotes_checked: quotesChecked,
    predictions,
    consistent: discrepancies.length === 0,
    discrepancies,
  };
}

export async function synthesizeAbstractHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('synthesize_abstract requires an object with research_ref + abstract');
  }
  const {
    research_ref,
    abstract,
    evaluate,
    review,
    suggested_lens,
    recommendation,
    missing,
    plan_title,
  } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  if (!abstract || typeof abstract !== 'string') {
    throw new Error('abstract is required (the distilled thesis text)');
  }
  const session = ResearchRepository.getSession(research_ref);
  if (!session) {
    throw new Error(`Research session '${research_ref}' not found.`);
  }

  const itemCount = ResearchRepository.countItems(research_ref);

  // Deterministic review (opt-in): recompute every experiment item from its stored artifact
  // and flag drift. Soft-fail like the posterity sketch — a review hiccup must never block
  // recording the thesis; the failure itself is reported in the review block.
  let reviewBlock = null;
  if (review) {
    try {
      reviewBlock = reviewExperimentItems(research_ref);
    } catch (err) {
      reviewBlock = {
        items_checked: 0, items_skipped: 0, quotes_checked: 0,
        predictions: { checked: 0, confirmed: 0, falsified: 0, unmeasurable: 0, results: [] },
        consistent: false, discrepancies: [], error: err?.message || String(err),
      };
    }
  }

  // Posterity: auto-mint a hub-spoke diagram of the book (items → thesis) so
  // each append-only abstract snapshot carries its own diagram. Soft-fail — a
  // sketch hiccup must never block recording the thesis (sketches are scratch
  // siblings).
  let sketchRef = null;
  let sketchWarning = null;
  try {
    const book = ResearchRepository.getFullBook(research_ref);
    const { ref } = mintSketch({
      title: `Research: ${session.title}`,
      manifest: researchToSketchManifest(book, abstract),
    });
    sketchRef = ref;
  } catch (err) {
    sketchWarning = err?.message || String(err);
  }

  const row = ResearchRepository.insertAbstract({
    researchRef: research_ref,
    body: abstract,
    itemCount,
    sketchRef,
  });

  if (!evaluate) {
    // A review without an evaluation still belongs to this snapshot's audit — record it in
    // the same assessment_json the evaluation would use, so the append-only abstract row
    // carries its own consistency check.
    if (reviewBlock) {
      ResearchRepository.attachAbstractEvaluation(row.id, { planRef: null, assessment: { review: reviewBlock } });
    }
    return {
      ok: true,
      abstract_id: row.id,
      item_count: itemCount,
      evaluated: false,
      ...(reviewBlock ? { review: reviewBlock } : {}),
      ...(sketchRef ? { sketch_ref: sketchRef, sketch_url: sketchUrl(sketchRef) } : {}),
      ...(sketchWarning ? { sketch_warning: sketchWarning } : {}),
    };
  }

  // In-process short-circuit to the same evaluator the HTTP bridge wraps.
  const { assessment, planRef } = evaluateAbstract({
    researchRef: research_ref,
    abstract,
    suggestedLens: suggested_lens,
    recommendation,
    missing,
    planTitle: plan_title,
  });
  const recorded = reviewBlock ? { ...assessment, review: reviewBlock } : assessment;
  ResearchRepository.attachAbstractEvaluation(row.id, { planRef, assessment: recorded });

  return {
    ok: true,
    abstract_id: row.id,
    item_count: itemCount,
    evaluated: true,
    assessment,
    ...(reviewBlock ? { review: reviewBlock } : {}),
    ...(sketchRef ? { sketch_ref: sketchRef, sketch_url: sketchUrl(sketchRef) } : {}),
    ...(sketchWarning ? { sketch_warning: sketchWarning } : {}),
    ...(planRef
      ? { plan_ref: planRef, message: `Abstract evaluated as tractable — forged Draft plan ${planRef}. Open plan mode to develop it.` }
      : { message: `Abstract recorded; plan mojulo recommends continued research${assessment.missing.length ? `: ${assessment.missing.join('; ')}` : '.'}` }),
  };
}

export async function sketchResearchHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('sketch_research requires an object with research_ref');
  }
  const { research_ref, thesis } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  const book = ResearchRepository.getFullBook(research_ref);
  if (!book) {
    throw new Error(`Research session '${research_ref}' not found.`);
  }
  const itemCount = book.items.length;
  if (itemCount === 0) {
    throw new Error(
      `Research session '${research_ref}' has no bound items — nothing to sketch. Bind items via bind_research_item first.`,
    );
  }
  const { ref } = mintSketch({
    title: `Research: ${book.session.title}`,
    manifest: researchToSketchManifest(book, thesis || ''),
  });
  return {
    ok: true,
    research_ref,
    sketch_ref: ref,
    sketch_url: sketchUrl(ref),
    item_count: itemCount,
    message: `Sketched book (${itemCount} item(s) → thesis hub) at ${sketchUrl(ref)}. Standalone preview — not bound to the book; pass it to bind_research_item with kind:'sketch' to keep it.`,
  };
}

export async function getResearchHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_research requires an object with research_ref');
  }
  const { research_ref } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  const book = ResearchRepository.getFullBook(research_ref);
  if (!book) {
    throw new Error(`Research session '${research_ref}' not found.`);
  }
  return {
    research_ref: book.session.researchRef,
    title: book.session.title,
    status: book.session.status,
    created_at: book.session.createdAt,
    updated_at: book.session.updatedAt,
    items: book.items.map((it) => ({
      item_id: it.id,
      kind: it.kind,
      title: it.title,
      body: it.body,
      source_url: it.sourceUrl,
      media_ref: it.mediaRef,
      metadata: it.metadata,
      created_at: it.createdAt,
    })),
    abstracts: book.abstracts.map((a) => ({
      abstract_id: a.id,
      body: a.body,
      item_count: a.itemCount,
      plan_ref: a.planRef,
      assessment: a.assessment,
      sketch_ref: a.sketchRef,
      ...(a.sketchRef ? { sketch_url: sketchUrl(a.sketchRef) } : {}),
      created_at: a.createdAt,
    })),
  };
}

export async function listResearchHandler(input, _ctx) {
  const { status } = input || {};
  const sessions = ResearchRepository.listSessions(status ? { status } : {});
  return {
    total: sessions.length,
    sessions: sessions.map((s) => ({
      research_ref: s.researchRef,
      title: s.title,
      status: s.status,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerResearchModeTools() {
  registerTool({
    name: 'enter_research_mode',
    description:
      "Ring 9 — OPTIONAL DRAWER (research mode). Returns the light research discipline: there is no goal but to assist; bind broadly (links, articles, summaries, screencaps, notes); trust your natural research strength; never force convergence. When a concept crystallizes, synthesize_abstract hands it to plan mojulo. Call ONLY when the user explicitly asks to research / gather / look into something — research mode is a drawer, not part of the main flow. Read-only.",
    inputSchema: { type: 'object', properties: {} },
    handler: enterResearchModeHandler,
  });

  registerTool({
    name: 'start_research',
    description:
      "Ring 9 — start (auto-save) a research session. Low-ceremony: the book exists the moment research begins. Returns { research_ref, title, status:'open' }. Bind items to it with bind_research_item.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the research book (the topic).' },
      },
      required: ['title'],
    },
    handler: startResearchHandler,
  });

  registerTool({
    name: 'bind_research_item',
    description:
      "Ring 9 — bind a broad item to a research book. The core accretion verb; call it as many times as useful. `kind` is one of: link, article, summary, screencap, note, quote, snippet, sketch, experiment. Bind summaries you generate as their own items so the book remembers what it concluded. screencap items reference stored media via media_ref; `sketch` items reference an existing `sk_<…>` diagram (from create_sketch) via media_ref — the ad hoc way to pin a diagram into a book. `experiment` items pin a SCIENCE-VIEW artifact with its provenance: media_ref = the sketch ref, metadata = { recipe, stats } verbatim from the create_* mint response (gated — an experiment without its recipe is unreproducible and is rejected). `article` bodies are content-hashed automatically at bind time; anchor a `quote` to an in-book source via metadata.source_item_id so review can verify it verbatim. `prediction` items state expected numeric outcomes BEFORE concluding: metadata = { experiment_item_id, expected: { <outcome>: value }, tolerance? } with the formula/reasoning in body — review verdicts each key confirmed/falsified/unmeasurable (gated: an anchor and >= 1 finite expected value are required). Returns { item_id, research_ref, kind }.",
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to bind into.' },
        kind: {
          type: 'string',
          enum: ['link', 'article', 'summary', 'screencap', 'note', 'quote', 'snippet', 'sketch', 'experiment', 'prediction'],
          description: 'The kind of item.',
        },
        title: { type: 'string', description: 'Optional short title/label.' },
        body: { type: 'string', description: 'Markdown body — article text, the summary, the note, the quote, the snippet.' },
        source_url: { type: 'string', description: 'Optional source URL (for link / article / quote).' },
        media_ref: { type: 'string', description: 'Reference to stored media (for screencap) or a `sk_<…>` sketch ref (for kind=sketch / kind=experiment).' },
        metadata: { type: 'object', description: 'Optional free-form metadata. REQUIRED for kind=experiment: { recipe, stats } captured verbatim from the science-view mint response.' },
      },
      required: ['research_ref', 'kind'],
    },
    handler: bindResearchItemHandler,
  });

  registerTool({
    name: 'synthesize_abstract',
    description:
      "Ring 9 — distill the research book into a tight thesis (what concept emerged, why it matters, what it implies). Records the abstract (append-only history) AND auto-mints a hub-spoke DIAGRAM of the book (items → thesis) attached to this snapshot — `sketch_url` in the response, viewable in the /research pane. With `review: true`, runs the DETERMINISTIC reviewer first — recompute each `experiment` item from its stored artifact (artifact_missing / recipe_drift / stats_mismatch) AND verify every anchored `quote` against its in-book source (quote_drift / quote_source_missing / source_hash_mismatch) AND check every `prediction` against its experiment's measured outcomes (confirmed / falsified / unmeasurable, in a separate `predictions` block — a falsified prediction is a RESULT and never marks the book inconsistent) — recording it all with the snapshot (a provenance/consistency check, never a judgment of the thesis). With `evaluate: true`, sends the abstract to plan mojulo for evaluation against the plans paradigm: supply your own judgment via `suggested_lens` + `recommendation` (`forge` if there's a tractable spike — plan mojulo forges a Draft plan seeded from the abstract; `keep_researching` with a `missing` list otherwise). Returns { abstract_id, item_count, evaluated, review?, sketch_ref?, sketch_url?, assessment?, plan_ref? }. Forging a plan does nothing on its own — it hands the baton to plan mode.",
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to synthesize.' },
        abstract: { type: 'string', description: 'The distilled thesis text (markdown ok).' },
        evaluate: {
          type: 'boolean',
          description: 'When true, send the abstract to plan mojulo for evaluation (and possible Draft-plan forge).',
        },
        review: {
          type: 'boolean',
          description: "When true, deterministically re-verify every `experiment` item (recompute from the stored artifact, compare against the bound { recipe, stats } snapshot) and every anchored `quote` (verbatim-in-source check), recording the result with this abstract. Integrity check only — it never blocks the thesis.",
        },
        suggested_lens: {
          type: 'string',
          enum: ['spike', 'segment_expansion', 'vertical_reinforcement', 'collider'],
          description: 'Your judgment of which plan lens fits, if any (only used when evaluate is true).',
        },
        recommendation: {
          type: 'string',
          enum: ['forge', 'keep_researching'],
          description: "Your verdict. 'forge' = tractable spike, create a Draft plan. 'keep_researching' = not ripe yet. Defaults to keep_researching.",
        },
        missing: {
          type: 'array',
          items: { type: 'string' },
          description: 'What more research would sharpen the concept (guidance when keep_researching).',
        },
        plan_title: { type: 'string', description: 'Optional title for the forged Draft plan (defaults to the abstract first line).' },
      },
      required: ['research_ref', 'abstract'],
    },
    handler: synthesizeAbstractHandler,
  });

  registerTool({
    name: 'sketch_research',
    description:
      "Ring 9 — preview the research book as a hub-spoke diagram WITHOUT synthesizing an abstract. Derives the same diagram `synthesize_abstract` auto-mints (items → central thesis hub). Standalone — NOT bound to the book or any abstract (research sketches are normally tied to abstracts; this is a free-standing preview). Useful while gathering: visualize the shape of the book at any moment, or preview what a candidate thesis would look like as the hub label before committing to synthesize. To keep the sketch in the book, bind it with bind_research_item({ kind:'sketch', media_ref: <sketch_ref> }). Refuses on empty book (nothing to draw). Returns { ok, research_ref, sketch_ref, sketch_url, item_count, message }.",
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to sketch.' },
        thesis: {
          type: 'string',
          description: 'Optional candidate thesis text — populates the hub station\'s sublabel so you can preview what a thesis would look like before synthesizing.',
        },
      },
      required: ['research_ref'],
    },
    handler: sketchResearchHandler,
  });

  registerTool({
    name: 'get_research',
    description:
      'Ring 9 — fetch a full research book: the session plus all bound items and all synthesized abstracts (with their plan_ref / assessment if evaluated). Returns the whole book.',
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to read.' },
      },
      required: ['research_ref'],
    },
    handler: getResearchHandler,
  });

  registerTool({
    name: 'list_research',
    description:
      "Ring 9 — list research sessions (optional `status` filter: open | archived). Returns { total, sessions: [{ research_ref, title, status, created_at, updated_at }] }, most-recently-active first.",
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'archived'], description: 'Filter by status.' },
      },
    },
    handler: listResearchHandler,
  });
}

// Test seam.
export const _internals = { KNOWN_KINDS, RESEARCH_BRIEF, reviewExperimentItems };
