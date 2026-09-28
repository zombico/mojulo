---
name: write-catalyst
description: Draft a new mojulo catalyst (a curated workflow recipe shipped via MCP) into control/lib/mcp/catalysts/. Push back when the request isn't catalyst-shaped — when it's actually a mojulo code change, a one-off user skill, a write back into the workflow's own source, or too thin on mapping insight to earn a shelf spot. Invoke as `/write-catalyst` (the skill prompts for intent) or `/write-catalyst <one-line intent>`.
---

# /write-catalyst

Draft a new catalyst file in [control/lib/mcp/catalysts/](../../../control/lib/mcp/catalysts) following the format, body principles, and section template documented in [docs/catalysts.md](../../../docs/catalysts.md). Validate it parses and hand back to the user for PR.

The catalyst paradigm: a `.md` file with JSON frontmatter that mojulo ships through MCP so a user's agent can read it once and *catalyze* the synthesis of a runnable artifact (a `.claude/skills/<name>/SKILL.md`, a Codex automation, a `workflow.md`) for that user's setup. The catalyst is not a skill; it produces one. Keep this distinction sharp throughout — if you blur it, the body you draft will be wrong.

## Read these first (every invocation)

Always pull these into context before drafting anything:

- [docs/catalysts.md](../../../docs/catalysts.md) — the author spec. The two catalyst shapes (making vs workflow), format, validation, body principles, the six-section template, the checklist for adding a new one.
- [control/lib/mcp/tools/catalysts.js](../../../control/lib/mcp/tools/catalysts.js) — read `CATALYST_CORE_PREAMBLE` and the `custom_catalyst` author guide. The body you draft is read by a future agent *after* the preamble is prepended, so don't repeat what it already says; the guide's posture-check and batched questions are the same ones this skill runs.
- [control/lib/mcp/catalysts/loader.js](../../../control/lib/mcp/catalysts/loader.js) — exact validation rules. Your draft must pass `parseCatalystFile`.
- The existing `.md` files in [control/lib/mcp/catalysts/](../../../control/lib/mcp/catalysts) — these are the exemplars. `refresh-connected-services.md` is the six-section workflow exemplar; `design-object-workbench.md` is the making exemplar. Bias toward the one closest to the user's intent and study its mapping, idempotency and pitfalls sections specifically.

Don't skim. The body you write is a prompt that has to teach a future agent how to synthesize a working artifact on first try. The exemplars show the bar.

## Step 1 — Posture-check (push back here, before gathering anything)

A catalyst is the **wrong tool** in these cases. If any apply, stop and tell the user — don't try to force the request into a catalyst shape.

1. **The request changes what mojulo itself can do** — a new tool, a new recipe kind, a new export. That's a code change (or a recipe-book builder), not a catalyst. Catalysts compose what mojulo and the installed MCPs already do.
2. **The workflow writes back into its own source.** Forbidden by the body principles in [docs/catalysts.md](../../../docs/catalysts.md). Catalysts read from a source and write to *destinations* only.
3. **The request is one-off.** Catalysts are shipped library entries — reusable across users. If it's bespoke, the user should have their agent synthesize a runnable artifact directly with no catalyst — that's already a supported path.
4. **The destination is one specific MCP, not a category.** A catalyst's value is destination-agnostic mapping intent (`crm-like`, `calendar-like`, `actuator-like`, etc.). "Sync to my specific Notion database with this exact schema" is a skill, not a catalyst.
5. **The "mapping intent" is generic.** If the user can't articulate at least one non-obvious, opinionated decision the catalyst makes (a specific field-mapping choice, a default behavior, a calibration heuristic), the catalyst won't pay rent.
6. **No clear idempotency story.** Without a cursor field or a dedupe key, the Idempotency section becomes hand-waving. Push back and surface the missing decision rather than papering over it.

When pushing back, name the specific failure and suggest the right alternative (a code change or recipe-book builder, a local skill, a more specific request). Don't soften the pushback — the library is curated; a thin catalyst dilutes it.

(The chatbot factory's bot-sourced catalysts and its `requires.protocols` field left mojulo in 3.0.0. Don't draft a catalyst that reads a deployed bot or lists protocols.)

## Step 2 — Gather context (one batched round)

If posture-check passes, ask the user the following in one message. Don't drip questions out one at a time. Skip questions the user already answered in their invocation line.

1. **Workflow intent in one paragraph.** What source data → what destination concept, and the user's motivation.
2. **Source surface.** Where the workflow reads from: mojulo state through its read tools (`get_stash`, `get_cook`, `list_cooks`, `meta_context_brief`, `semantic_search`, …), or an installed MCP the operator declares through `meta_context_declare_inventory`. Name the tools the materialized artifact calls.
3. **Destination MCP category.** Pick from existing categories where possible: `crm-like`, `calendar-like`, `ticketing-like`, `actuator-like`, `doc-or-channel-like`, `data-store-like`. If proposing a new category, the user must justify why none of the existing ones fit — don't proliferate categories.
4. **Catalyst category (the `category` frontmatter field).** Use a category `list_catalysts` already shows where one fits; ask before adding a new one.
5. **Mapping insight — the value-add.** What's the specific, opinionated decision this catalyst encodes that a future agent would otherwise have to guess at? At least one. If the user gives a generic answer ("map the fields to the destination"), push back to step 1's failure mode 5.
6. **Idempotency strategy.** Cursor field (usually a source timestamp via a `since` input) AND dedupe key (usually a destination-side search-before-create on a stable id).
7. **Pitfalls.** PII exposure, irreversible writes, rate limits, calibration drift are the universal ones — surface those automatically. Ask the user for any domain-specific pitfalls (timezone bugs, confidence thresholds, schema drift).
8. **Parameters to ask the user at synthesis time.** Each `parameters[]` entry the materialized artifact will need (`name`, `prompt`, optional `default`). Typically 2-4. If you're proposing more than 5, push back — long parameter lists usually mean the catalyst is trying to do two things.

## Step 3 — Pick the id and slug

The `id` is the file slug and frontmatter `id`. Conventions from the existing library:

- kebab-case, descriptive, ≤ ~40 chars
- shape: `<source>-to-<destination>` (e.g. `weekly-linear-digest-to-drive`) or `<verb>-<source>-<modifier>` (e.g. `refresh-connected-services`, `research-mcp-vendor`)
- must not collide with an existing id in [control/lib/mcp/catalysts/](../../../control/lib/mcp/catalysts) — the loader throws on duplicates

Check `ls control/lib/mcp/catalysts/*.md` before committing to a slug.

## Step 4 — Draft the file

Path: `control/lib/mcp/catalysts/<id>.md`.

### Frontmatter

JSON, between two `---` fences.

**Required:**

- `id`, `name` (human-readable title), `summary` (one line, used in `list_catalysts`)
- `valueHook` — one sentence in **user-outcome** terms. This is the consultation surface — `recommend_catalysts` reads it aloud to position the catalyst to the user, *before* the user has decided to read the body. Don't restate the `summary`; the summary is implementation-shaped, the valueHook is outcome-shaped.

**Optional:**

- `version` (default 1), `category`, `requires.destinationMcpCategory`, `parameters`, `mcpTools.mojulo`, `mcpTools.destination.description`, `outputContract`.
- `requires.destinationExamples` — array of 3-5 named MCPs that satisfy the `destinationMcpCategory` (e.g., for `crm-like`: `["HubSpot", "Salesforce", "Pipedrive", "Attio", "Close"]`). **Required when `destinationMcpCategory` is set** — the loader enforces it. `recommend_catalysts` surfaces these as consultation suggestions ("you could install HubSpot to unlock this").

The `mcpTools.destination.description` field is *abstract* — describe the shape of MCP the materialized artifact needs and name 2-4 example MCPs that fit. Do not bind to a specific MCP.

### Body — the six-section template (workflow catalysts)

Follow the structure in [docs/catalysts.md](../../../docs/catalysts.md) ("Workflow catalysts — the six-section template"). A making catalyst is domain-shaped instead; see the section after it.

1. **Opening paragraph** — what this catalyst does, plain English, ~2-3 sentences. Frame the source data shape it operates on.
2. **Materialization** — numbered steps, host-neutral. First step is reading the source's shape (the mojulo read tool it names, or the source MCP's schema from declared inventory). Then "ask the user the N `parameters` questions" (batched). Then "inspect the bound destination MCP" to discover its concrete surface. Last step: hand the resolved workflow to the host adapter to materialize the runnable artifact — don't name an artifact path or scheduling mechanism; the adapter owns that.
3. **Mapping intent** — the load-bearing section. Specific field-to-field guidance, what to do when a field doesn't fit, when to ask the user vs. when to assume. This is where the value-add lives. Be concrete — quote field names, name destination shapes.
4. **Idempotency** — cursor strategy AND dedupe key. Always pair them — the cursor is the primary defense, search-before-create is the safety net.
5. **Pitfalls** — bullets, each with a specific mitigation (not just the risk). At minimum touch on: PII exposure (especially anything where the LLM reads personal content), irreversible writes (default `dryRun: true`, opt-in to live), rate limits, calibration drift. Add domain-specific pitfalls the user surfaced.
6. **Behavior contract** — bullets for `Inputs:`, `Outputs:`, `Side effects (live mode):`. Inputs always include the source handle (required), `since` (optional ISO), `dryRun` (default true).

### Body principles to enforce

- Default `dryRun: true` in the contract. Live mode is per-run opt-in.
- Always require mojulo trace (the source record's id and a captured-at timestamp) in destination payloads.
- Surface PII concerns explicitly when the materialized artifact will read personal content through the LLM.
- Don't write back to the source. Catalysts read from a source, write to destinations.
- Sample, don't sweep. Analytical catalysts default to bounded samples (typically 30) — the user graduates after calibration.

These principles also live in `CATALYST_CORE_PREAMBLE`, which is prepended to every `get_catalyst` response. Body content should be the *specific* application of these principles to this catalyst's domain.

### What NOT to write in the body

- Don't restate the vocabulary disambiguation (recipe vs. runnable artifact vs. catalyst). The preamble already does that.
- Don't restate the "adapt freely, posture is starting point not contract" preamble. Same reason.
- Don't pad sections that don't apply. If a catalyst has no meaningful trend-delta concern, skip it — don't fabricate one.

## Step 5 — Self-validate the draft

Before reporting back to the user, validate the draft parses:

```bash
cd control && npx vitest run lib/mcp/catalysts/loader.test.js
```

The loader parses your file at startup — if frontmatter is malformed, required fields are missing, the body is empty, or `requires.destinationMcpCategory` is set without a matching `destinationExamples` array, the test fails with a clear error pointing at your file. Fix and re-run. Don't ship a draft that fails the loader.

The loader test enumerates structural properties of the catalog but does *not* assert a fixed list of canonical ids — a new `.md` file is picked up automatically, no test edit needed.

## Step 6 — Hand off to the user

Tell the user:

- Where the file is (`control/lib/mcp/catalysts/<id>.md`)
- That the next step is to **PR the catalyst** per the checklist in [docs/catalysts.md](../../../docs/catalysts.md) ("Adding a new catalyst")
- If the new catalyst's category surfaces a discoverability gap (e.g. it's the first `itsm` catalyst, or you proposed a new category), mention that [docs/mcp-integration.md](../../../docs/mcp-integration.md) may want a mention — but don't auto-edit it, that's a user call.

## Final reminders

- **Read the exemplars every time.** The skill's quality scales with how closely you match the existing tone, density, and opinionatedness of the shipped catalysts. Don't trust your prior; re-read.
- **Push back early.** Once you've drafted a hollow catalyst, it's hard to un-write. The pushback in Step 1 is the most valuable thing this skill does.
- **The body is a prompt, not documentation.** The reader is a future agent trying to write a working artifact in one pass. Optimize for their decisions, not the user's understanding.
