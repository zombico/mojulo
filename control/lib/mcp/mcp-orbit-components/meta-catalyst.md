# The mcp-orbit meta-catalyst — how to compose a workflow from components

You are about to assemble an **mcp-orbit composition**: a workflow that reads from the operator's installed MCP environment (Linear, Gmail, etc.) in a *source role*, does something cognitive in the middle (aggregate, route, enrich), and writes to another MCP (Drive, Notion, Slack, etc.) in a *destination role*. Mojulo provides the components and constraint validation; you provide the judgment.

**Server-stored, agent-composed.** Components are typed rows in mojulo's store with their own bodies — you read them via `get_mcp_orbit_component`. Compositions are typed rows too — every recommendation and every assembly gets logged so the deliberation is auditable.

This document is the **composition discipline**: the rulebook you read once at the start of every mcp-orbit composition. The components carry the per-MCP / per-pattern intent; this document carries the cross-component rules.

---

## The five categories

Every composition picks one component from at least the first four categories. The fifth (`render`) is optional in v0 (markdown is the default).

| Category | What it captures | Required? |
|---|---|---|
| `mcp` | Per-MCP affordance set: read, write, watch — each entry in `component_refs` carries a `role` tag (`source` or `destination`) declaring which workflow role it plays in this composition. | yes (≥1 source, ≥1 destination) |
| `trigger` | Cadence + delivery model: scheduled, signal-polled, signal-push, one-shot. | yes |
| `pattern` | Cognitive shape: aggregation, routing, branching, enrichment, audit. | yes |
| `idempotency` | How re-runs avoid duplicate writes: window-key, state-ledger, destination-search. | yes* |
| `render` | Output formatting: markdown-digest, email-html, chat-message, structured-row. | optional |

*\* Some `pattern: one-shot` compositions can elide `idempotency` with operator opt-in — see the constraint table.*

### How roles work

`source` and `destination` are **composition roles**, not component kinds. Each `mcp` component declares an `affordances` map (`{ read, write, watch }`) and can play whichever role it has the affordance for. In `component_refs`, every mcp entry carries an explicit `role: 'source' | 'destination'`:

```jsonc
[
  { "kind": "mcp", "ref": "linear",  "version": "0.1.0", "role": "source" },
  { "kind": "mcp", "ref": "gdrive",  "version": "0.1.0", "role": "destination" },
  { "kind": "trigger", "ref": "scheduled", "version": "0.1.0" },
  { "kind": "pattern", "ref": "aggregation", "version": "0.1.0" },
  { "kind": "idempotency", "ref": "window-key", "version": "0.1.0" }
]
```

The same MCP can appear twice in a composition with different roles (e.g. `mcp/linear` as `source` AND as `destination` for a "closed issues → enrichment → write back to Linear" workflow). The component body teaches both roles when both are useful; the loop pitfall is called out in its body.

Non-mcp kinds (`trigger`, `pattern`, `idempotency`, `render`) are singletons in a composition — they don't carry a role tag.

---

## Composition rules — the constraint table

These are the hard constraints. If a candidate composition violates one, EITHER pick different components OR get explicit operator opt-in captured in the composition's `intent_md` before proceeding.

1. **`trigger: scheduled` requires an `idempotency` component.** Double-writes from missed idempotency are the single most common scheduled-workflow failure. The only override is an explicit `knobs.accept_double_write: true` with operator confirmation.
2. **`trigger: signal-polled` requires a `role: source` mcp with `capabilities.cursor: true` PLUS an idempotency component.** Without both, you'll either re-process old events or miss new ones.
3. **Every mcp entry's role must be supported by the component's affordances.** `role: 'source'` requires `affordances.read: true`; `role: 'destination'` requires `affordances.write: true`. The server pre-filter catches this — agent should never assemble an mcp entry with a role its affordances don't support.
4. **`pattern: branching` requires ≥2 distinct mcp entries in `role: 'destination'`.** Without two destinations, "branching" is just "writing" — pick `pattern: enrichment` or `pattern: routing` instead.
5. **`pattern: aggregation` requires the source-role mcp to expose either a window query or a cursor field.** Otherwise "aggregate the past week" has no semantics.
6. **An operator-KYC constraint forbidding `PII to LLM` forbids any `render` component that summarizes raw bodies.** Drop to `title+url+one-line` depth or use a structured render that doesn't pass body text through.
7. **An operator-KYC constraint naming a preferred MCP (e.g. "all docs go to Notion") clamps the destination at composition time.** Operator KYC overrides component defaults — never the other way around.
8. **Inventory must include an MCP matching each mcp entry's `requires.inventoryServerHints`.** No matching MCP for a chosen entry = no valid composition; recommend installing one or surface the gap to the operator as a soft suggestion (consultation posture, not blocking).

---

## Ranking heuristic

When `recommend_mcp_orbit_compositions` returns 2–3 candidates, they're ranked by:

1. **Inventory fit (highest weight).** Compositions whose source-role AND destination-role mcps map cleanly to installed MCPs rank first.
2. **Operator-KYC alignment.** Compositions whose mcp refs are explicitly named or implied by the operator's locked-in constraints (e.g. KYC says "weekly Linear digest" → `mcp/linear (source) + pattern/aggregation + trigger/scheduled` is a near-exact match) rank above generic fits.
3. **Prior-materialization signal.** If the same composition shape has materialized before for this operator with a positive outcome (no retire), it ranks above an untested combination. The composition log makes this queryable.
4. **Component novelty.** All-else-equal, prefer compositions using components that have NOT been used together before in this operator's history — the new combination teaches the system more than another instance of an already-validated one. This weight is small in v0; it's mostly a tiebreaker.

These weights aren't load-bearing in v0 — they get tuned by watching real compositions land. The ranking is surfaced in the response so the agent can override.

---

## The composition flow

The seven-step flow every mcp-orbit composition follows:

1. **Recognize the intent.** Operator says "I want a weekly Linear digest in Drive" — that's mcp-orbit, not a bot catalyst.
2. **Call `recommend_mcp_orbit_compositions({ intent, inventory? })`.** Server filters available components by the operator's inventory and KYC constraints, returns 2–3 ranked candidate compositions as `proposed` rows.
3. **Call `get_meta_catalyst()` once per composition session.** You're reading it now — re-read sections 4 and 5 right before you assemble, they're the rulebook.
4. **Pull each component via `get_mcp_orbit_component({ ref })`.** Read the body in full — for mcp components, read BOTH the source-role and destination-role sections even if the composition only uses one (it informs the affordances posture). Don't skim the pitfalls — they're load-bearing.
5. **Negotiate knobs with the operator in ONE round.** Each component declares its `exposesKnobs` — collect every prompt, ask the operator in one message, capture the answers. Update the composition row with `knobs_json`.
6. **Dry-run.** Materialize the composition's substrate as a draft artifact. Update the composition row to `status: dry_run`. Show the operator the rendered output and one real destination write (in draft posture). Ask "promote or adjust?"
7. **Promote → host-adapter materialization → `meta_context_commit({type:'artifact_materialization', ...})`.** The commit's `bindings` include every mcp entry the composition used, with its role and the bound tool (`{ kind: 'mcp', ref, version, role, mcp_tool }` shapes in the bindings payload). The commit's principles capture the negotiated knob values. Update the composition row to `status: materialized` and set `artifact_ref` to the artifact node's composite ref.

---

## Dry-run discipline

The dry-run for any mcp-orbit composition has three required steps:

1. **Resolve.** Compute every parameter (window bounds, cursor cutoff, destination locator, dedupe key) from the run-time clock and the operator's knobs.
2. **Render.** Produce the output artifact body in memory — markdown, JSON, whatever the render contract says — and show the rendered text in the conversation. Operators catch grouping bugs at this step, not after promotion.
3. **Write one real (reversible) destination artifact.** Permissions, quotas, field validation fail at the destination, NOT in your render code. Use the destination's draft affordance (Docs: leave unpublished; Notion: don't share; Slack: send to a test channel; Linear: write to a `mojulo-dryrun` label). Surface the URL and ask for promotion confirmation.

A "dry-run" that skips step 3 is a preview, not a dry-run. The destination MCP IS where it breaks.

---

## Commit discipline

After the artifact is materialized via the host adapter, `meta_context_commit({type:'artifact_materialization', ...})` IS the audit chain — for mcp-orbit compositions, there's no bot turn history to walk back to. Skipping the commit means the next session has no record of *why this artifact exists and what it's configured to do*.

The commit's payload, specific to mcp-orbit:

- `bindings[]` — one entry per source-role and destination-role mcp tool the artifact calls (e.g. `linear.list_issues` for the source-role linear mcp, `gdrive.create_file` for the destination-role gdrive mcp). The `fields_bound` array names the actual fields the composition reads / writes.
- Record the **composition ref** in an artifact-scope principle: `"Composed from components: mcp/linear@0.1.0 (role=source), mcp/gdrive@0.1.0 (role=destination), trigger/scheduled@0.1.0, idempotency/window-key@0.1.0, pattern/aggregation@0.1.0. Composition ref: comp_<id>. Knobs: cadence=weekly, day=Mon, depth=title+url+one-line, ..."` — this is the durable link from the materialized artifact back to its composition row.

If the commit fails, **roll the artifact back via the host adapter's affordance** (delete the file / cancel the automation). A successful materialization with no commit is worse than a failed materialization — it's an unauditable artifact that will surprise the next session.

---

## What to avoid

- **Composing from intuition without reading components.** The components carry pitfalls you will not recall from training; the whole architecture exists so the agent reads them at composition time, not pretends to know them.
- **Skipping the role tag in component_refs.** Every `kind: 'mcp'` entry MUST carry `role: 'source' | 'destination'`. The validator rejects it otherwise — and silently letting it through would lose the structural distinction that the role refinement exists to preserve.
- **Skipping the knob negotiation.** Default knobs are defensible defaults, not the operator's preference. One round of questions is cheap; an artifact tuned to the wrong cadence / grouping / depth is expensive.
- **Letting a constraint violation slip with no operator confirmation.** The constraint table is the rulebook. If you can't satisfy a rule, the right path is to either pick different components or capture the operator's explicit override in `intent_md` — never silently proceed.
- **Treating the composition log as scratch.** Every composition you assemble — even ones you discard before promoting — leaves a `proposed` row. That's intentional: future ranking and analytics need to see the discards as much as the materializations. Don't try to "clean up" by deleting rows.
- **Speaking to the operator in composer vocabulary.** "I'll materialize a composition with `mcp/linear` in source-role under a scheduled trigger and `idempotency/window-key`" is correct in your internal reasoning and incomprehensible to the operator. Translate to plain task language at the user-facing layer — "I'll set up a workflow that pulls last week's Linear issues and writes a digest to Drive every Monday morning, with safeguards so a re-run doesn't double-post" — while still preserving commitment-level distinctions (*proposed* vs *dry-run* vs *materialized*) so the operator can course-correct at each gate. See the **User-facing voice** standing rule in `forward_context` for the full discipline.
