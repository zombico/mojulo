# Catalysts

A **catalyst** is a curated, host-neutral workflow recipe that mojulo ships through MCP. The user's agent (Claude Code, Codex, or any other MCP-capable host) calls `get_catalyst`, reads the recipe, and either **makes something** with mojulo's own primitives or materializes a concrete **runnable artifact** through the **host adapter** for its client — a Claude Code skill under `.claude/skills/`, a Codex automation, or a generic `workflow.md` + runner. The artifact is the user's once written; mojulo's role ends at handing over the catalyst plus its host adapter.

The name is deliberately bare — not "skill catalyst," not "workflow catalyst." Catalysts **produce** runnable artifacts; they are not themselves artifacts, and prefixing them with one host's term blurs the boundary the design depends on. The bifurcation is load-bearing: catalysts are host-neutral mojulo-side workflow patterns, and they sit at a different layer than the host-specific artifact they help create.

The "catalyst" name is also literal as a metaphor. Each file enables one phase transition from a vague user intent + the shape of the thing being worked on into a structured result. The catalyst itself is not consumed (the file persists and can catalyze again for the next subject, the next user, the next host) and does not appear in the result — it's the nucleation point that lets the artifact crystallize out.

This document is the **author** spec: format, validation, and the principles a good catalyst body follows. For the **user-facing** explanation (what catalysts are, how to invoke the flow from an agent session), see the "Catalysts" section of [docs/mcp-integration.md](mcp-integration.md).

---

## Two catalyst shapes

The library holds two shapes, and confusing them is the most common authoring mistake. Both use the same frontmatter, the same loader, and the same `get_catalyst` call; they differ in what comes out the other end.

**Making catalysts** — the majority of the shelf. These teach the agent how to compose mojulo's OWN primitives into an artifact: `design-object-workbench` (bond lathe/extrude/sweep monomers on a measured grid at literal scale), `design-world-asset`, `design-vehicle-family`, `dream-edifice`, `character-from-dream`, `mobile-suit-builder`, `reconstruct-from-dream`, `explain-the-internet`, `explain-computing-from-first-principles`, `numerical-experiment-notebook`, `render-image-outcome-locally`. No destination MCP, no cursor, no dry-run — the output is a minted `ref`. Their bodies are **domain-shaped**, not templated: the value is the modelling discipline ("model each object by the manufacturing process that makes it"), the failure modes, and the iteration loop.

**Workflow catalysts** — mojulo state out to a destination MCP the operator already has. These follow the six-section template below, and their non-negotiables (dry-run default, trace fields, idempotency) exist because they write to systems outside mojulo. Some are pack-scoped: `qualify-lead-to-crm`, `submission-to-ticket`, `appointment-to-calendar`, `weekly-submissions-digest`, `scan-conversations-for-signal`, `conversations-to-channel-digest`, `submissions-to-warehouse`, and `knowledge-gap-miner` all read a deployed bot and require the **chatbot pack**. Others don't touch a bot at all — `document-extract-to-store`, `refresh-connected-services`, `research-mcp-vendor`.

The `category` field is the practical tell, though `substrate` currently does double duty across both shapes. When a new catalyst doesn't clearly sit in one shape, that is usually a sign it is trying to do two things.

---

## Three concepts, kept distinct

Three terms in this space overlap and need to be kept separate by authors and by the model reading the catalysts. (The first row applies only when the chatbot pack is installed.) If you're weighing whether to **add a new mojulo protocol** vs. **write a catalyst**, see the decision rubric in [docs/chatbot/protocol-composition.md](chatbot/protocol-composition.md) under "Before adding a protocol — could a catalyst do this?" — short version: protocols change what a bot does inside a conversation, catalysts change what happens with its data afterward.

| Concept                    | Where it lives                                              | What it is                                                                                                                                                                                                                                                | Lifecycle                                                                                  |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Mojulo protocol** *(chatbot pack)* | [control/lib/composer/protocols/](../control/lib/composer/protocols/) | A *bot's* runtime capability — `knowledge`, `formGathering`, `triage`, `appointments`, `opticalRead`. Composed into the bot's `instructions.txt` at build time.                                                                                          | Set when the bot is built. Read off a deployment via `get_deployment`.                     |
| **Runnable artifact**      | User's machine, host-specific path                          | A *user-owned* file the agent's host executes when invoked — a Claude Code skill at `.claude/skills/<name>/SKILL.md`, a Codex automation, a generic `workflow.md` + runner. Calls MCP tools (mojulo's + others) to do the work. Path and scheduling shape are host-specific.   | Synthesized once from a catalyst + host adapter; owned and edited by the user thereafter. Mojulo never sees it. |
| **Catalyst** (this doc)    | [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/) | A *host-neutral workflow recipe* mojulo ships through MCP. Consumed once at synthesis time to catalyze a runnable artifact. The catalyst is not the artifact; it tells the agent how to make one, paired with a host adapter when the result leaves mojulo.                | Lives in the repo. Read once per synthesis via `get_catalyst`.                          |
| **Host adapter**           | [control/lib/mcp/adapters/](../control/lib/mcp/adapters/)   | The host-specific half of synthesis — artifact path, scheduling mechanism, secrets posture, output reporting. Three ship today: `claude-code`, `codex`, `generic`. Composed into every `get_catalyst` response between the core preamble and the catalyst body. | Lives in the repo. Auto-resolved per session from MCP `clientInfo.name`, or overridden by passing `host` to `get_catalyst`. |

Every `get_catalyst` response composes three sections in order: a host-neutral **core preamble** (posture, vocabulary, safety defaults — `CATALYST_CORE_PREAMBLE` in [control/lib/mcp/tools/catalysts.js](../control/lib/mcp/tools/catalysts.js)), the **host adapter** body for the bound client, and the **catalyst body** itself. The preamble explicitly authorizes the agent to treat the catalyst as a starting point — adapt freely, combine across catalysts, write from scratch when no catalyst fits — and reaffirms the only non-negotiables, which bind **workflow catalysts**: `dryRun: true` defaults for external writes, and mojulo trace fields (the source ids and a captured-at timestamp) in every destination payload. Making catalysts write nothing outside mojulo, so neither applies to them.

When writing a catalyst body, you can assume the reader has just been (a) reminded which is which, (b) told it's free to deviate, and (c) handed host-specific materialization rules by the adapter. Don't waste body space repeating any of that — focus on the *thinking* (mapping intent, idempotency strategy, pitfalls) that earns the catalyst its place in the library, and keep the body **host-neutral**.

---

## Host-neutral catalyst body + host adapter — the split

The catalyst body carries the **portable** workflow contract — what to read from mojulo, how to map it to the destination, when to ask vs. assume, how to stay idempotent, what fails non-obviously. None of that depends on whether the resulting artifact is a Claude Code skill or a Codex automation.

The host adapter carries the **substrate-specific** half — where to write the artifact, how the host schedules recurring runs, how the host handles secrets, how the artifact reports its dry-run output. This is what differs between `.claude/skills/<slug>/SKILL.md` (scheduled via `/schedule`) and a Codex automation (scheduled via `automation_update` cron, state in workspace files).

This split matters most for **workflow catalysts**, whose output leaves mojulo. A making catalyst's output is a minted `ref` inside mojulo, so it barely touches the adapter at all — but its body must still stay host-neutral, because the same body is read by Claude Code, Codex, and every future host.

**As a catalyst author, your job is to keep the body host-neutral.** Concretely:

- The Materialization section should say "hand the resolved workflow to the host adapter to materialize the runnable artifact" — *not* "write `.claude/skills/<slug>/SKILL.md`."
- Don't name specific scheduling mechanisms (`/schedule`, `automation_update`, cron). The adapter knows.
- Don't name specific secret-posture mechanisms (`.claude/settings.json` deny rules, automation-level secrets). The adapter knows.
- Don't bake in specific dry-run UX (CLI flag, automation parameter). The adapter encodes the dry-run / inspect / promote loop in its substrate's idioms; you only require the *default*.
- The Behavior contract section names inputs in host-neutral terms (`deploymentId`, `since`, `dryRun`). The adapter renders those into CLI flags, automation parameters, or whatever fits.

If your body sentence is something the Codex adapter and the Claude Code adapter would phrase differently, it belongs in the adapter, not the catalyst.

Two exemplars, one per shape. Workflow: [qualify-lead-to-crm.md](../control/lib/mcp/catalysts/qualify-lead-to-crm.md) — its Materialization section opens with "Per the bound host adapter (artifact target, scheduling, and dry-run encoding live there):" and proceeds with host-neutral steps. Making: [design-object-workbench.md](../control/lib/mcp/catalysts/design-object-workbench.md) — numbered domain sections (decompose by manufacturing process → author each monomer → package → mint + iterate → pitfalls) and no adapter section at all.

---

## Where catalysts live

Two shelves, merged into one catalog by [control/lib/mcp/catalysts/catalog.js](../control/lib/mcp/catalysts/catalog.js):

- **Curated shelf** — `control/lib/mcp/catalysts/`, one `.md` file per catalyst, shipped with the repo. The loader ([control/lib/mcp/catalysts/loader.js](../control/lib/mcp/catalysts/loader.js)) scans this directory at process start. To add a built-in catalyst: write the `.md` file, restart the control plane, send a PR.
- **Local shelf** — operator-minted rows in the control-plane DB (`local_catalysts` + `local_catalyst_revisions`, repository at [control/lib/db/repositories/local-catalysts.js](../control/lib/db/repositories/local-catalysts.js)), written via the `mint_catalyst` MCP tool. Live immediately — no restart, no PR — and served through the same tools as curated entries, annotated `origin: 'local'`. See [Local catalysts](#local-catalysts) below.

One-off automations that aren't catalyst-shaped still belong on the agent's host side (a local skill), not on either shelf — the posture-check in `custom_catalyst` guards this.

---

## File format

JSON frontmatter between two `---` fences, then a markdown body:

```markdown
---
{
  "id": "qualify-lead-to-crm",
  "name": "Qualify lead and sync to CRM",
  "summary": "Score new submissions against the user's rubric and create matching CRM records, skipping low-quality leads.",
  "valueHook": "Turn yesterday's intake submissions into qualified CRM contacts overnight, deduped and scored.",
  "version": 1,
  "category": "crm-sync",
  "requires": {
    "protocols": ["formGathering"],
    "destinationMcpCategory": "crm-like",
    "destinationExamples": ["HubSpot", "Salesforce", "Pipedrive", "Attio", "Close"]
  },
  "parameters": [
    {
      "name": "qualifyingCriteria",
      "prompt": "What makes a 'qualified' submission for your business?"
    }
  ],
  "mcpTools": {
    "mojulo": ["query_submissions", "get_deployment"],
    "destination": {
      "description": "A CRM-like MCP exposing search-by-property + contact create."
    }
  }
}
---

# Title

Body markdown — the host-neutral recipe the agent reads at synthesis time.
```

JSON, not YAML, is intentional: dep-free parsing, unambiguous types, fails loudly on malformed input.

### Required fields

- `id` (string) — slug, unique across the library. Matches the filename.
- `name` (string) — human-readable title.
- `summary` (string) — one-line description, implementation-shaped. Used in `list_catalysts`.
- `valueHook` (string) — one sentence in **user-outcome** terms. Read aloud by `recommend_catalysts` to position the catalyst *before* the user has decided to read the body. Outcome-shaped ("CRM contacts overnight, deduped and scored"), not implementation-shaped — don't just restate the `summary`.

### Optional fields

- `version` (number, default 1) — bump when the body changes meaningfully.
- `category` (string) — filter axis for `list_catalysts`. Making shapes: `object-design`, `world-building`, `explainer`, `research-science`. Workflow shapes: `crm-sync`, `itsm`, `calendar`, `digest`, `analysis`, `rag-curation`, `extraction-pipeline`, `warehouse`. Plus `substrate`, which currently spans both and should not grow. Don't proliferate.
- `requires.protocols` (string[]) — *(chatbot pack)* mojulo protocols the target bot must have enabled. Making catalysts leave this empty or omit it.
- `requires.optionalProtocols` (string[]) — *(chatbot pack)* protocols that enrich the catalyst but aren't required.
- `requires.destinationMcpCategory` (string) — *(workflow only)* what kind of destination MCP the artifact needs (e.g., `crm-like`, `ticketing-like`, `calendar-like`, `actuator-like`, `doc-or-channel-like`, `data-store-like`). Omit for making catalysts — they have no destination.
- `requires.destinationExamples` (string[]) — **required when `destinationMcpCategory` is set.** 3-5 named MCPs that satisfy the category (e.g., for `crm-like`: `["HubSpot", "Salesforce", "Pipedrive", "Attio", "Close"]`). `recommend_catalysts` surfaces these as consultation suggestions ("you could install HubSpot to unlock this"); missing or empty is a hole in the consultation posture.
- `parameters` (object[]) — questions the agent asks the user during synthesis. Each entry: `{ name, prompt, default? }`. Typically 2-4 entries; more than 5 usually means the catalyst is trying to do two things.
- `mcpTools` (object) — declares the tool surface used. `mcpTools.mojulo` is the array of mojulo MCP tools (for a making catalyst this is the whole story — e.g. `["create_workbench", "semantic_search"]`); `mcpTools.destination.description` abstractly describes the destination MCP for workflow catalysts (do not bind to a specific MCP).
- `outputContract` (object) — optional structured shape of the per-run output the artifact must produce. When present, host adapters can read this to shape their own output reporting without parsing prose.

### Body

Everything after the closing `---`. The body is **the value of the catalyst** — it's a prompt the agent reads at synthesis time. Validation requires a non-empty body.

---

## Validation

The loader fails fast on:

- Missing frontmatter fences
- Malformed JSON
- Missing `id` / `name` / `summary` / `valueHook`
- Empty body
- Duplicate `id` across files

Since the library is curated (not user input), validation faults are PR bugs — the error reports the file path and the field for fast diagnosis. `requires.destinationExamples` being missing when `requires.destinationMcpCategory` is set is enforced in the loader test ([control/lib/mcp/catalysts/loader.test.js](../control/lib/mcp/catalysts/loader.test.js)).

---

## What makes a good catalyst body

The body is a prompt. The reader is the connecting agent (Claude Code, Codex, or any other MCP host). The user is not — they only see the synthesized artifact. Optimize for the agent's ability to produce a working artifact on first try, *and* keep the body host-neutral so it works regardless of which adapter is bound.

### Workflow catalysts — the six-section template

Every shipped **workflow** catalyst follows this template. Don't deviate without reason. (For making catalysts, see the next subsection — this template does not apply to them.)

1. **Opening paragraph** — what this catalyst does in plain English, ~2-3 sentences. Frame the source protocol or data shape it operates on.
2. **Materialization** — numbered steps, host-neutral. When the source is a deployed bot, the first step is `get_deployment(deploymentId)` to read its shape. Then "ask the user the N `parameters` questions" (batched). Then "inspect the bound destination MCP" to discover its concrete surface. Last step: **"hand the resolved workflow to the host adapter to materialize the runnable artifact."** Don't bake in a specific artifact path or scheduling mechanism — the host adapter owns that, and writing `.claude/skills/<...>/SKILL.md` or `Codex automation` directly into the catalyst body re-couples it to one host.
3. **Mapping intent** — the load-bearing section. Specific field-to-field guidance, what to do when a field doesn't fit, when to ask the user vs. when to assume. This is where the value-add lives. Be concrete — quote field names, name destination shapes (e.g. "HubSpot uses `firstname`/`lastname`; Salesforce uses `FirstName`/`LastName`; Attio uses object/attribute pairs — synthesize from the destination MCP's surface, never assume a flat `name` field").
4. **Idempotency** — cursor strategy AND dedupe key. Always pair them — the cursor (typically a `since` parameter on a timestamp) is the primary defense, search-before-create on a stable id is the safety net.
5. **Pitfalls** — bullets, each with a specific mitigation (not just the risk). At minimum touch on: PII exposure (especially anything where the LLM reads form/conversation content), irreversible writes (default `dryRun: true`, opt-in to live), rate limits, calibration drift. Add domain-specific pitfalls.
6. **Behavior contract** — bullets for `Inputs:`, `Outputs:`, `Side effects (live mode):`. For a bot-sourced catalyst, inputs include `deploymentId` (required), `since` (optional ISO), and `dryRun` (default true). The host adapter renders the contract into its substrate's idioms (CLI flags, automation parameters, etc.) — keep the body host-neutral.

### Making catalysts — domain-shaped, not templated

A making catalyst's body has no fixed section list, because its value is the **modelling discipline** for one domain, and that discipline dictates its own order. What every good one carries:

1. **The organizing principle, stated once and early.** `design-object-workbench` opens with "model each object by the manufacturing process that makes it" — a sentence that decides every downstream choice. If you can't write that sentence, the catalyst isn't ready.
2. **The vocabulary, as a table.** Primitive → what it is → what it makes. The agent needs to map an English noun onto mojulo's primitives without guessing.
3. **Authoring steps in the order the artifact is actually built up.** Coordinates resolved, units declared, frame stated — be concrete enough that the agent doesn't invent conventions.
4. **Mint and iterate.** Name the entry tool, then teach `update_sketch` on the same ref. A making catalyst that implies re-minting to change something is teaching the wrong loop.
5. **Pitfalls, each with its mitigation** — the specific ways this domain renders wrong, and how you'd see it. Where an eyes gate is the only real check, say so.

No dry-run, no cursor, no trace fields, no destination — those exist to protect writes outside mojulo, and a making catalyst performs none.

### Body principles

These four bind **workflow catalysts**, because they write outside mojulo:

- **Default `dryRun` to true.** Any catalyst that writes externally should produce an artifact that defaults to dry-run, with the user opting into live writes explicitly. The user can override after synthesis, but the synthesized default is conservative.
- **Always require mojulo trace in destination payloads.** Submission id, conversation id, deployment id, captured-at timestamp. The reviewer on the destination side needs to be able to walk back to the source — this is the differentiator vs. opaque integration platforms.
- **Surface PII concerns.** Multiple catalysts pull form/conversation content back through the LLM at routing time. The bot's data-handling posture was set at capture time; artifact synthesis is a place to reaffirm the user is OK with the new exposure.
- **Don't auto-write back to the source.** A workflow catalyst reads from mojulo and writes to destinations; it should never reach into a bot's corpus or config. Those paths stay user-mediated.
- **Sample, don't sweep.** Analytical catalysts (signal scanning, gap mining) should default to bounded samples (typically 30). The user graduates after calibration. Full-scan defaults produce surprise LLM bills.

These bind **every** catalyst:

- **Keep the body host-neutral.** No `.claude/skills/` paths, no `/schedule` or `automation_update` references, no host-specific dry-run UX. Push that into the adapter.
- **Teach the thinking, not the tool signature.** The agent already has the tool schemas. The catalyst earns its shelf spot on the mapping judgement, the failure modes, and the order of operations — the things a schema can't say.
- **Advise, never gate.** Catalysts surface concerns and defaults; they don't refuse. Suitability is the operator's call.

### What NOT to write in the body

- Don't restate vocabulary disambiguation (catalyst vs. artifact vs. protocol). The core preamble prepended to every `get_catalyst` response already does that — you'd be duplicating.
- Don't restate the "adapt freely, posture is starting point not contract" preamble. Same reason.
- Don't restate host adapter rules (artifact path, scheduling, secrets). The composed adapter section already does that.
- Don't pad sections that don't apply. If there's no meaningful trend-delta concern, skip it — don't fabricate.

---

## MCP surface

Five tools, registered by [control/lib/mcp/tools/catalysts.js](../control/lib/mcp/tools/catalysts.js). All read the merged catalog (curated + local shelves):

| Tool                  | Purpose                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_catalysts`      | Returns `id`, `name`, `summary`, `valueHook`, `category`, `requires`, `origin` for each catalyst. Optional `category` filter. Local entries eclipsed by a later-shipped curated id are flagged `eclipsed: true`. |
| `get_catalyst`        | Returns one catalyst's full composed body: core preamble + host adapter section + catalyst body. Accepts optional `host` to override the auto-resolved adapter, and `rev` to read a local catalyst's historical revision. Local reads include `fileText` (the shelf-file serialization) + the revision index. |
| `recommend_catalysts` | Recommends catalysts for one bot (`deploymentId`) or across the fleet (`scope: 'fleet'` / `deploymentIds`). Annotates each with `missingProtocols`, `crossBot`, `origin`, etc. Includes a `consultationPosture` block + a `materialization` block (available adapters + recommended-for-this-client). |
| `custom_catalyst`     | Returns the author's guide for drafting a new catalyst. Self-contained — posture-check rules, batched context questions, body template, validation checklist, mint + graduation hand-off. Read before `mint_catalyst`. |
| `mint_catalyst`       | Writes to the local shelf. Upsert keyed on `id`: new id → rev 1; existing local id → appends a revision (`note` required — the commit message) and revives if archived; `archive: true` shelves it (revisions kept, embedding row dropped). Refuses curated ids. Response includes `fileText` for graduation. |

Bot-shape introspection is intentionally not a separate tool — `get_deployment` ([control/lib/mcp/tools/operate.js](../control/lib/mcp/tools/operate.js)) already returns enabled protocols, form schema, triage routes, and identity. The agent does the match between a catalyst's `requires` and a deployment's shape.

Adapter discovery is handled by `list_adapters` / `get_adapter` from the adapters ring (sibling to catalysts). Every `get_catalyst` response auto-composes the resolved adapter into the returned body, so most agents won't need to call `get_adapter` directly — but it's there for sessions that want to bind the adapter once and reuse it across multiple catalyst reads.

---

## Local catalysts

The operator's own shelf, minted over MCP (design + build log: [lite-template/integration/plan-archive/local-catalysts.plan.md](../lite-template/integration/plan-archive/local-catalysts.plan.md)).

- **Same spec, same gate.** `mint_catalyst` runs the exact validator the file loader runs (`validateCatalystMeta` — required fields, kind rules, the `destinationMcpCategory` → `destinationExamples` pairing, non-empty body). The six-section editorial template is advisory locally; it's enforced by maintainers only at PR graduation.
- **Head + revisions.** The row is the live pointer; every update appends to `local_catalyst_revisions` with a required `note` (the commit message). For local catalysts `version` is derived — always the head `rev`. `get_catalyst({ id, rev })` reads history.
- **Kind is explicit.** No shelf directory to infer from — `kind` defaults to `workflow`; `technique` is equally mintable and gets the same bare-body serving rules.
- **Id policy.** Minting a curated id is refused. If a later mojulo upgrade ships a curated catalyst with an id the operator already minted, the curated one **eclipses** it: curated wins the bare id, the local row is preserved and flagged `eclipsed: true` in `list_catalysts` until re-minted under a new slug.
- **Search.** Mints/updates mirror into the semantic index per-write (under the existing `catalyst` source kind, soft-fail); archive deletes the embedding row; `reindexAll` sources the merged catalog so a from-scratch reindex includes the local shelf.
- **Graduation.** Every mint/get returns `fileText` — the exact `.md` the curated shelf would hold. Prove the catalyst out, PR that file under `control/lib/mcp/catalysts/`, then archive the local row once the curated version ships.

---

## Adding a new catalyst (checklist)

0. Decide the **shape** — making or workflow (see [Two catalyst shapes](#two-catalyst-shapes)). Everything below branches on it.
1. Pick an unused `id` (slug). Kebab-case, ≤ ~40 chars — `<source>-to-<destination>` for workflow, `<verb>-<subject>` (`design-object-workbench`, `dream-edifice`) for making.
2. Write `control/lib/mcp/catalysts/<id>.md` — the six-section template for workflow, the domain-shaped guidance for making.
3. Pick or reuse a `category` from the list above. Don't proliferate, and don't reach for `substrate` as a default.
4. **Workflow only:** pick or reuse a `requires.destinationMcpCategory` and include 3-5 `requires.destinationExamples`. Making catalysts omit both.
5. Run `npx vitest run lib/mcp/catalysts/loader.test.js` from `control/` — the loader test will fail-load on missing required fields, malformed JSON, and `destinationMcpCategory` set without `destinationExamples`. New `.md` files are picked up automatically; no test edit is required.
6. Sanity-check the body against an existing adapter: read [control/lib/mcp/adapters/claude-code.md](../control/lib/mcp/adapters/claude-code.md) and [control/lib/mcp/adapters/codex.md](../control/lib/mcp/adapters/codex.md). If a sentence in your body would be phrased differently by those two, it belongs in the adapter, not the catalyst.
7. PR the catalyst file. No code change to the loader, the MCP tools, or the test is needed.

For a richer author's walkthrough with worked examples of when a request is *not* catalyst-shaped, call `custom_catalyst` from an MCP-connected agent session — that surface is maintained alongside the loader and stays in sync with the validation rules.
