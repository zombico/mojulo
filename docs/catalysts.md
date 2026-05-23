# Catalysts

A **catalyst** is a curated, host-neutral workflow recipe that mojulo ships through MCP. The user's agent (Claude Code, Codex, or any other MCP-capable host) calls `get_catalyst`, reads the recipe, introspects a deployed bot's shape, picks a destination MCP from what's installed locally, and materializes a concrete **runnable artifact** through the **host adapter** for its client — a Claude Code skill under `.claude/skills/`, a Codex automation, or a generic `workflow.md` + runner. The artifact is the user's once written; mojulo's role ends at handing over the catalyst plus its host adapter.

The name is deliberately bare — not "skill catalyst," not "workflow catalyst." Catalysts **produce** runnable artifacts; they are not themselves artifacts, and prefixing them with one host's term blurs the boundary the design depends on. The bifurcation is load-bearing: catalysts are host-neutral mojulo-side workflow patterns, and they sit at a different layer than the host-specific artifact they help create.

The "catalyst" name is also literal as a metaphor. Each file enables one phase transition from a vague user intent + a bot's shape + a destination MCP + a host adapter into a structured runnable artifact. The catalyst itself is not consumed (the file persists and can catalyze again for the next bot, the next user, the next host) and does not appear in the resulting artifact — it's the nucleation point that lets the artifact crystallize out.

This document is the **author** spec: format, validation, and the principles a good catalyst body follows. For the **user-facing** explanation (what catalysts are, how to invoke the flow from an agent session), see the "Catalysts" section of [docs/mcp-integration.md](mcp-integration.md).

---

## Three concepts, kept distinct

Three terms in this space overlap and need to be kept separate by authors and by the model reading the catalysts. If you're weighing whether to **add a new mojulo protocol** vs. **write a catalyst** for a given use case, see the decision rubric in [docs/protocol-composition.md](protocol-composition.md) under "Before adding a protocol — could a catalyst do this?" — short version: protocols change what the bot does inside a conversation, catalysts change what happens with the bot's data afterward.

| Concept                    | Where it lives                                              | What it is                                                                                                                                                                                                                                                | Lifecycle                                                                                  |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Mojulo protocol**        | [control/lib/composer/protocols/](../control/lib/composer/protocols/) | A *bot's* runtime capability — `knowledge`, `formGathering`, `triage`, `appointments`, `opticalRead`. Composed into the bot's `instructions.txt` at build time.                                                                                          | Set when the bot is built. Read off a deployment via `get_deployment`.                     |
| **Runnable artifact**      | User's machine, host-specific path                          | A *user-owned* file the agent's host executes when invoked — a Claude Code skill at `.claude/skills/<name>/SKILL.md`, a Codex automation, a generic `workflow.md` + runner. Calls MCP tools (mojulo's + others) to do the work. Path and scheduling shape are host-specific.   | Synthesized once from a catalyst + host adapter; owned and edited by the user thereafter. Mojulo never sees it. |
| **Catalyst** (this doc)    | [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/) | A *host-neutral workflow recipe* mojulo ships through MCP. Consumed once at synthesis time to catalyze a runnable artifact. The catalyst is not the artifact; it tells the agent how to write one when paired with a host adapter and a bot.                | Lives in the repo. Read once per synthesis via `get_catalyst`.                          |
| **Host adapter**           | [control/lib/mcp/adapters/](../control/lib/mcp/adapters/)   | The host-specific half of synthesis — artifact path, scheduling mechanism, secrets posture, output reporting. Three ship today: `claude-code`, `codex`, `generic`. Composed into every `get_catalyst` response between the core preamble and the catalyst body. | Lives in the repo. Auto-resolved per session from MCP `clientInfo.name`, or overridden by passing `host` to `get_catalyst`. |

Every `get_catalyst` response composes three sections in order: a host-neutral **core preamble** (posture, vocabulary, safety defaults — `CATALYST_CORE_PREAMBLE` in [control/lib/mcp/tools/catalysts.js](../control/lib/mcp/tools/catalysts.js)), the **host adapter** body for the bound client, and the **catalyst body** itself. The preamble explicitly authorizes the agent to treat the catalyst as a starting point — adapt freely, combine across catalysts, write from scratch when no catalyst fits — and reaffirms the only non-negotiables: `dryRun: true` defaults for external writes and mojulo trace fields (deployment id, conversation id, submission id, captured-at) in every destination payload.

When writing a catalyst body, you can assume the reader has just been (a) reminded which is which, (b) told it's free to deviate, and (c) handed host-specific materialization rules by the adapter. Don't waste body space repeating any of that — focus on the *thinking* (mapping intent, idempotency strategy, pitfalls) that earns the catalyst its place in the library, and keep the body **host-neutral**.

---

## Host-neutral catalyst body + host adapter — the split

The catalyst body carries the **portable** workflow contract — what to read from mojulo, how to map it to the destination, when to ask vs. assume, how to stay idempotent, what fails non-obviously. None of that depends on whether the resulting artifact is a Claude Code skill or a Codex automation.

The host adapter carries the **substrate-specific** half — where to write the artifact, how the host schedules recurring runs, how the host handles secrets, how the artifact reports its dry-run output. This is what differs between `.claude/skills/<slug>/SKILL.md` (scheduled via `/schedule`) and a Codex automation (scheduled via `automation_update` cron, state in workspace files).

**As a catalyst author, your job is to keep the body host-neutral.** Concretely:

- The Materialization section should say "hand the resolved workflow to the host adapter to materialize the runnable artifact" — *not* "write `.claude/skills/<slug>/SKILL.md`."
- Don't name specific scheduling mechanisms (`/schedule`, `automation_update`, cron). The adapter knows.
- Don't name specific secret-posture mechanisms (`.claude/settings.json` deny rules, automation-level secrets). The adapter knows.
- Don't bake in specific dry-run UX (CLI flag, automation parameter). The adapter encodes the dry-run / inspect / promote loop in its substrate's idioms; you only require the *default*.
- The Behavior contract section names inputs in host-neutral terms (`deploymentId`, `since`, `dryRun`). The adapter renders those into CLI flags, automation parameters, or whatever fits.

If your body sentence is something the Codex adapter and the Claude Code adapter would phrase differently, it belongs in the adapter, not the catalyst.

See the exemplar [control/lib/mcp/catalysts/qualify-lead-to-crm.md](../control/lib/mcp/catalysts/qualify-lead-to-crm.md) — its Materialization section opens with "Per the bound host adapter (artifact target, scheduling, and dry-run encoding live there):" and proceeds with host-neutral steps.

---

## Where catalysts live

`control/lib/mcp/catalysts/` — one `.md` file per catalyst, shipped with the repo. The loader ([control/lib/mcp/catalysts/loader.js](../control/lib/mcp/catalysts/loader.js)) scans this directory at process start and exposes the library via four MCP tools (see [MCP surface](#mcp-surface) below).

**There is no user-writable catalyst directory.** This is a deliberate scope choice — catalysts are an MCP affordance, and custom or one-off patterns belong on the agent's host side, not in mojulo's storage. Users wanting a bespoke workflow either let their agent synthesize from scratch (no catalyst needed) or maintain their own catalyst-shaped markdown locally for their agent to consume.

To add a new built-in catalyst: write the `.md` file, restart the control plane, send a PR.

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
- `category` (string) — filter axis for `list_catalysts`. Existing categories: `crm-sync`, `itsm`, `calendar`, `digest`, `analysis`, `rag-curation`, `extraction-pipeline`. Don't proliferate.
- `requires.protocols` (string[]) — mojulo protocols the target bot must have enabled.
- `requires.optionalProtocols` (string[]) — protocols that enrich the catalyst but aren't required.
- `requires.destinationMcpCategory` (string) — what kind of destination MCP the artifact needs (e.g., `crm-like`, `ticketing-like`, `calendar-like`, `actuator-like`, `doc-or-channel-like`, `data-store-like`).
- `requires.destinationExamples` (string[]) — **required when `destinationMcpCategory` is set.** 3-5 named MCPs that satisfy the category (e.g., for `crm-like`: `["HubSpot", "Salesforce", "Pipedrive", "Attio", "Close"]`). `recommend_catalysts` surfaces these as consultation suggestions ("you could install HubSpot to unlock this"); missing or empty is a hole in the consultation posture.
- `parameters` (object[]) — questions the agent asks the user during synthesis. Each entry: `{ name, prompt, default? }`. Typically 2-4 entries; more than 5 usually means the catalyst is trying to do two things.
- `mcpTools` (object) — declares the tool surface the artifact uses. `mcpTools.mojulo` is the array of mojulo MCP tools; `mcpTools.destination.description` is the abstract description of the destination MCP (do not bind to a specific MCP).
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

Every shipped catalyst follows this six-section template. Don't deviate without reason.

1. **Opening paragraph** — what this catalyst does in plain English, ~2-3 sentences. Frame the source protocol or data shape it operates on.
2. **Materialization** — numbered steps, host-neutral. First step is almost always `get_deployment(deploymentId)` to read the bot's shape. Then "ask the user the N `parameters` questions" (batched). Then "inspect the bound destination MCP" to discover its concrete surface. Last step: **"hand the resolved workflow to the host adapter to materialize the runnable artifact."** Don't bake in a specific artifact path or scheduling mechanism — the host adapter owns that, and writing `.claude/skills/<...>/SKILL.md` or `Codex automation` directly into the catalyst body re-couples it to one host.
3. **Mapping intent** — the load-bearing section. Specific field-to-field guidance, what to do when a field doesn't fit, when to ask the user vs. when to assume. This is where the value-add lives. Be concrete — quote field names, name destination shapes (e.g. "HubSpot uses `firstname`/`lastname`; Salesforce uses `FirstName`/`LastName`; Attio uses object/attribute pairs — synthesize from the destination MCP's surface, never assume a flat `name` field").
4. **Idempotency** — cursor strategy AND dedupe key. Always pair them — the cursor (typically a `since` parameter on a timestamp) is the primary defense, search-before-create on a stable id is the safety net.
5. **Pitfalls** — bullets, each with a specific mitigation (not just the risk). At minimum touch on: PII exposure (especially anything where the LLM reads form/conversation content), irreversible writes (default `dryRun: true`, opt-in to live), rate limits, calibration drift. Add domain-specific pitfalls.
6. **Behavior contract** — bullets for `Inputs:`, `Outputs:`, `Side effects (live mode):`. Inputs always include `deploymentId` (required), `since` (optional ISO), `dryRun` (default true). The host adapter renders the contract into its substrate's idioms (CLI flags, automation parameters, etc.) — keep the body host-neutral.

### Body principles

- **Default `dryRun` to true.** Any catalyst that writes externally should produce an artifact that defaults to dry-run, with the user opting into live writes explicitly. The user can override after synthesis, but the synthesized default is conservative.
- **Always require mojulo trace in destination payloads.** Submission id, conversation id, deployment id, captured-at timestamp. The reviewer on the destination side needs to be able to walk back to the source — this is the differentiator vs. opaque integration platforms.
- **Surface PII concerns.** Multiple catalysts pull form/conversation content back through the LLM at routing time. The bot's data-handling posture was set at capture time; artifact synthesis is a place to reaffirm the user is OK with the new exposure.
- **Don't auto-write to the bot.** Catalysts read from mojulo and write to destinations. No catalyst should reach into the bot's corpus or config — those paths stay user-mediated.
- **Sample, don't sweep.** Analytical catalysts (signal scanning, gap mining) should default to bounded samples (typically 30). The user graduates after calibration. Full-scan defaults produce surprise LLM bills.
- **Keep the body host-neutral.** No `.claude/skills/` paths, no `/schedule` or `automation_update` references, no host-specific dry-run UX. Push that into the adapter.

### What NOT to write in the body

- Don't restate vocabulary disambiguation (catalyst vs. artifact vs. protocol). The core preamble prepended to every `get_catalyst` response already does that — you'd be duplicating.
- Don't restate the "adapt freely, posture is starting point not contract" preamble. Same reason.
- Don't restate host adapter rules (artifact path, scheduling, secrets). The composed adapter section already does that.
- Don't pad sections that don't apply. If there's no meaningful trend-delta concern, skip it — don't fabricate.

---

## MCP surface

Four tools, registered by [control/lib/mcp/tools/catalysts.js](../control/lib/mcp/tools/catalysts.js):

| Tool                  | Purpose                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_catalysts`      | Returns `id`, `name`, `summary`, `valueHook`, `category`, `requires` for each catalyst. Optional `category` filter.                                                          |
| `get_catalyst`        | Returns one catalyst's full composed body: core preamble + host adapter section + catalyst body. Accepts optional `host` to override the auto-resolved adapter.              |
| `recommend_catalysts` | Recommends catalysts for one bot (`deploymentId`) or across the fleet (`scope: 'fleet'` / `deploymentIds`). Annotates each with `missingProtocols`, `crossBot`, etc. Includes a `consultationPosture` block + a `materialization` block (available adapters + recommended-for-this-client). |
| `custom_catalyst`     | Returns an author's guide for drafting a new catalyst to PR back to the library. Self-contained — posture-check rules, batched context questions, body template, validation checklist, PR hand-off. Use this when the user wants to *contribute* a new catalyst, not when they want to automate something for themselves. |

Bot-shape introspection is intentionally not a separate tool — `get_deployment` ([control/lib/mcp/tools/operate.js](../control/lib/mcp/tools/operate.js)) already returns enabled protocols, form schema, triage routes, and identity. The agent does the match between a catalyst's `requires` and a deployment's shape.

Adapter discovery is handled by `list_adapters` / `get_adapter` from the adapters ring (sibling to catalysts). Every `get_catalyst` response auto-composes the resolved adapter into the returned body, so most agents won't need to call `get_adapter` directly — but it's there for sessions that want to bind the adapter once and reuse it across multiple catalyst reads.

---

## Adding a new catalyst (checklist)

1. Pick an unused `id` (slug). Kebab-case, ≤ ~40 chars, shape `<source>-to-<destination>` or `<verb>-<source>-<modifier>`.
2. Write `control/lib/mcp/catalysts/<id>.md` following the format and six-section template above.
3. Pick or reuse a `category`. Don't proliferate — seven should cover most workflows.
4. Pick or reuse a `requires.destinationMcpCategory` and include 3-5 `requires.destinationExamples`.
5. Run `npx vitest run lib/mcp/catalysts/loader.test.js` from `control/` — the loader test will fail-load on missing required fields, malformed JSON, and `destinationMcpCategory` set without `destinationExamples`. New `.md` files are picked up automatically; no test edit is required.
6. Sanity-check the body against an existing adapter: read [control/lib/mcp/adapters/claude-code.md](../control/lib/mcp/adapters/claude-code.md) and [control/lib/mcp/adapters/codex.md](../control/lib/mcp/adapters/codex.md). If a sentence in your body would be phrased differently by those two, it belongs in the adapter, not the catalyst.
7. PR the catalyst file. No code change to the loader, the MCP tools, or the test is needed.

For a richer author's walkthrough with worked examples of when a request is *not* catalyst-shaped, call `custom_catalyst` from an MCP-connected agent session — that surface is maintained alongside the loader and stays in sync with the validation rules.
