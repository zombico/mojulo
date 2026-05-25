# mcp-orbit — the component store and composer

mcp-orbit is mojulo's surface for **workflows that don't need a deployed chatbot** — MCP-to-MCP wiring where the operator wants to read from one MCP (Gmail, Linear, a CRM) and write to another (Drive, Notion, Slack) on a schedule or signal. The connecting agent assembles the workflow from a small library of typed components; mojulo provides the components, the constraint validation, and the audit trail.

If a catalyst is "one curated recipe per problem," mcp-orbit is "one curated component per part-of-a-problem, agent composes the recipe." Server-stored, agent-composed.

## When mcp-orbit, when catalysts

Both surfaces synthesize runnable artifacts. The split is about whose data the workflow reads:

- **Catalysts** ([docs/catalysts.md](catalysts.md)) — the artifact reads from a **deployed mojulo bot**'s SQLite via `query_submissions` / `query_conversations`. The catalyst body assumes there's a bot with shape to read against.
- **mcp-orbit** — the artifact reads from the **operator's installed MCPs** (Linear, Gmail, etc.) and writes to other installed MCPs (Drive, Notion, Slack). No bot in the picture.

The two paths share the same downstream — both end in a host-adapter materialization (a Claude Code skill, a Codex automation, a generic workflow) sealed via `meta_context_commit({type:'artifact_materialization', ...})`. The difference is what flows into the synthesis.

## The five categories

Every mcp-orbit composition picks one component from at least the first four categories:

| Category | What it captures | Example refs |
|---|---|---|
| `mcp` | Per-MCP affordance set (`read` / `write` / `watch`). Each entry in `component_refs` carries a `role: 'source' \| 'destination'` declaring the workflow role this MCP plays in this composition. | `linear`, `gdrive`, `gmail`, `notion` |
| `trigger` | Cadence + delivery model | `scheduled`, `signal-polled`, `signal-push`, `one-shot` |
| `pattern` | Cognitive shape of the workflow | `aggregation`, `routing`, `branching`, `enrichment`, `audit` |
| `idempotency` | How re-runs avoid duplicate writes | `window-key`, `state-ledger`, `destination-search` |
| `render` | Output formatting (optional in v0; markdown is default) | `markdown-digest`, `email-html`, `chat-message` |

`source` and `destination` are **composition roles**, not component kinds. Adding a new MCP to the library is **one** `mcp` component declaring whichever affordances that MCP supports; the same component plays the source role in one composition and the destination role in another. A composition typically has two mcp entries (one in each role); compositions that read and write the same MCP carry two entries for that mcp with different roles. Combinations across the other axes compose automatically — N×T×K×P useful workflows from O(N+T+K+P) authored components.

## Where components live

Shipped components are repo-side markdown under [control/lib/mcp/mcp-orbit-components/](../control/lib/mcp/mcp-orbit-components/) in the layout `<kind>/<ref>.md`. The directory name *is* the schema — a file misplaced under the wrong kind is a loader error, not a silent reclassification.

At server startup, [loader.js](../control/lib/mcp/mcp-orbit-components/loader.js) parses every file and writes it into the `mcp_orbit_components` table with `source='builtin'`. The runtime authoritative source is the table, not disk; disk is the editable source of truth for the curated library. User-registered components (`source='custom'`, deferred to v1) coexist with builtins in the same table.

The composer's rulebook — the **meta-catalyst** — lives at [control/lib/mcp/mcp-orbit-components/meta-catalyst.md](../control/lib/mcp/mcp-orbit-components/meta-catalyst.md). Fetched via `get_meta_catalyst`; the agent reads it once per session before composing.

## The composition flow

The agent flow is fixed — call sites in order:

1. **Recognize mcp-orbit intent.** "Weekly Linear digest in Drive," "route Gmail support threads into Linear," "summarize closed issues into a channel" — these are mcp-orbit, not bot catalysts.
2. **`recommend_mcp_orbit_compositions({ intent, inventory? })`.** Server filters available components by the declared MCP inventory and the operator's KYC anchor, returns 1–3 ranked candidate compositions, and persists each as a `proposed` row in `mcp_orbit_compositions`. The recommendation itself is auditable.
3. **`get_meta_catalyst()`** once per session. Pattern catalog, constraint table, ranking heuristic, composition discipline.
4. **`get_mcp_orbit_component({ kind, ref })`** for each component the candidate uses. Read the body in full — the pitfalls sections are load-bearing.
5. **Negotiate knobs with the operator in ONE round.** Each component declares its `exposesKnobs` array; collect every prompt and batch into a single message. Update the composition row's `knobs_json`.
6. **Dry-run.** Resolve every parameter, render the output in memory, write one real (reversible) destination artifact in draft posture, then ask for promotion. Update the composition's status to `dry_run`. A "dry-run" that skips the destination write is a preview, not a dry-run.
7. **Promote → host-adapter materialization → `meta_context_commit({type:'artifact_materialization', ...})`.** The commit's `bindings` array names the actual MCP tools the composition calls (e.g. `linear.list_issues`, `gdrive.create_file`) with `fields_bound`; an artifact-scope principle records the composition ref and the negotiated knobs as the durable link between the materialized artifact and the components it was built from. Update the composition row to `status: 'materialized'` and set its `artifact_ref` to the artifact node's composite ref.

If the commit fails, **roll the artifact back via the host adapter's affordance** (delete the file / cancel the automation). A successful materialization with no contextmap commit is worse than a failed one — it's an unauditable artifact.

## Composition rules — the constraint table

These are the hard constraints the meta-catalyst declares and the agent honors at composition time. The server pre-filters what it can; the rest is the agent's job under the meta-catalyst's discipline.

1. **`trigger: scheduled` requires an `idempotency` component.** Double-writes from missed idempotency are the single most common scheduled-workflow failure. The only override is an explicit `knobs.accept_double_write: true` with operator confirmation captured in `intent_md`.
2. **`trigger: signal-polled` requires a `role: source` mcp with `capabilities.cursor: true` PLUS an idempotency component.** Without both, you'll either re-process old events or miss new ones.
3. **Every mcp entry's role must be supported by the component's affordances.** `role: 'source'` requires `affordances.read: true`; `role: 'destination'` requires `affordances.write: true`. The server pre-filter catches this — the agent should never assemble an mcp entry whose role isn't supported by its affordances.
4. **`pattern: branching` requires ≥2 distinct mcp entries in `role: 'destination'`.**
5. **`pattern: aggregation` requires the source-role mcp to expose either a window query or a cursor field.**
6. **A KYC constraint forbidding "PII to LLM" forbids any `render` component that summarizes raw bodies.** Drop to lower-depth rendering or use a structured render that doesn't pass body text through.
7. **A KYC constraint naming a preferred MCP** (e.g. "all docs go to Notion") clamps the destination at composition time. Operator KYC overrides component defaults — never the other way around.
8. **Inventory must include an MCP matching each mcp entry's `inventoryServerHints`.** No matching MCP for a chosen entry = no valid composition; the agent surfaces the gap as a soft suggestion ("you'd need a CRM MCP wired in for this") rather than blocking.

## Ranking heuristic

When `recommend_mcp_orbit_compositions` returns multiple candidates, they're ordered by:

1. **Inventory fit** (weight 0.7) — both the source-role AND destination-role mcps map cleanly to installed MCPs.
2. **Operator-KYC alignment** (weight 0.2) — components whose refs appear in the operator's locked-in constraints.
3. **Prior-materialization signal** (weight 0.1) — a composition shape that already materialized successfully for this operator ranks above an untested one.

The weights aren't load-bearing in v0; they get retuned by watching real compositions land. The ranking is surfaced in the response so the agent can override.

## Schema

Two tables in [control/data/mojulo-lite.db](../control/data/), defined in [control/lib/db/index.js](../control/lib/db/index.js):

```sql
CREATE TABLE mcp_orbit_components (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('mcp','trigger','pattern','idempotency','render')),
  ref TEXT NOT NULL,
  version TEXT NOT NULL,
  body_md TEXT NOT NULL,
  payload_json TEXT,                              -- structured frontmatter (affordances, constraints, knobs, ...)
  source TEXT NOT NULL CHECK(source IN ('builtin','custom')) DEFAULT 'builtin',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(kind, ref, version)
);

CREATE TABLE mcp_orbit_compositions (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                       -- generated 'comp_<uuid12>'
  intent_md TEXT NOT NULL,                        -- operator's ask (audit + future learning)
  component_refs TEXT NOT NULL,                   -- JSON array of {kind, ref, version, role?} — role required for kind='mcp'
  knobs_json TEXT NOT NULL,                       -- negotiated knob values
  ranking_score REAL,
  status TEXT NOT NULL CHECK(status IN ('proposed','dry_run','materialized','retired')) DEFAULT 'proposed',
  artifact_ref TEXT,                              -- composite ref to meta_nodes.artifact when materialized
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Compositions are first-class rows from the start — every recommendation logs a row even if the agent never promotes it. The v1+ trajectory (templates, analytics, sharing) all needs compositions queryable, and structure earned upfront is cheaper than retrofitting later (same reasoning as the meta-context graph).

## File format — authoring a new component

Components ship as markdown files with JSON frontmatter:

```markdown
---
{
  "ref": "linear",
  "version": "0.1.0",
  "summary": "Linear issue-tracker MCP: read (cursor on updated_at) and write (create / update / comment) affordances.",
  "requires": {
    "mcpInventoryCategory": "structured_record_store",
    "inventoryServerHints": ["linear"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": false
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "updated_at",
    "pagination": "cursor",
    "writeShapes": ["create_issue", "update_issue", "comment_on_issue"]
  },
  "exposesKnobs": [
    { "name": "team_filter", "prompt": "Restrict to a specific team?", "default": "workspace" }
  ]
}
---

# mcp: Linear

Linear is an issue tracker. Its MCP surface is bidirectional — usable as a composition source (read activity) and as a composition destination (create / update / comment). One MCP, two roles; this body teaches both...
```

### Required frontmatter fields

- `ref` — kebab-case slug; must equal the filename basename (without `.md`).
- `version` — semver string. Multiple versions of the same ref coexist; `findByRef` without a version returns the highest.
- `summary` — one line. Surfaced by `list_mcp_orbit_components`.

### Optional frontmatter fields

Component-shape-specific. Conventional fields the composer reads:

- `requires.inventoryServerHints` — array of substrings; the recommender checks the declared inventory's server names against these (case-insensitive substring match in either direction, since MCPs ship under wildly inconsistent names — `gdrive` / `google_drive` / `claude_ai_Google_Drive`).
- `affordances` — for `kind: 'mcp'` components only. `{ read: bool, write: bool, watch: bool }`. The recommender uses these to decide which composition roles this MCP can play (`role: 'source'` requires `read: true`; `role: 'destination'` requires `write: true`).
- `capabilities` — what this component can do (e.g. `cursor: true`, `supportsDrafts: true`).
- `constraints` — array of `{ rule, message }` declaring hard rules the composer must honor.
- `exposesKnobs` — array of `{ name, prompt, default? }`; what the composer negotiates with the operator at composition time.

Everything in frontmatter beyond `ref` / `version` / `summary` is rolled into `payload_json` on the row. The composer reads it as a typed structure.

### Body — what to write

The body is a **prompt that has to teach the composer how to integrate this component correctly on first try.** Anchor on the five shipped components as exemplars (especially their *pitfalls* sections — they're load-bearing). For `kind: 'mcp'` components, write **two** surface/mapping sections — one for source-role usage, one for destination-role — even if v0 only intends to ship one of them. The body is the affordance posture; thin one side and the composer can't trust the affordance map.

Sections that pay rent:

1. **One-paragraph framing** — what this component captures, what shape the MCP/cadence/pattern has.
2. **Surface shape** — concrete tool names to look for, field names that matter, pagination contract, rate-limit posture. For mcp components, **one section per role** (source-role surface, destination-role surface).
3. **Mapping intent** — the load-bearing section. The specific, opinionated decisions this component encodes that the composer would otherwise have to guess at. Quote field names; name destination shapes. Again per-role for mcp components.
4. **Pitfalls** — bullets, each with a *specific mitigation* (not just the risk). Trash-isn't-delete; first-run backfill blast; PII through the LLM; clock skew; read-after-write same-MCP loops. The shipped components are calibrated on these — match the density.

### Authoring discipline

- **Files are NOT user input — they're curated.** Validation faults throw loudly. A bad PR fails the loader.
- **Filename invariant.** `<kind>/<ref>.md` — the filename basename must equal the frontmatter `ref`. The path is the typed identifier.
- **Body density.** ~40–80 lines is right for a single-MCP / single-shape component. Going shorter usually means the mapping intent is generic; going longer means the component is doing two things — split it.
- **No `register_mcp_orbit_component` tool yet.** Custom components ship in v1. v0 is authored repo-side and shipped through the loader.

## MCP surface

Four Ring 6 tools in [control/lib/mcp/tools/mcp-orbit.js](../control/lib/mcp/tools/mcp-orbit.js), registered after meta-context and inventory so the natural reading order is contextmap → inventory → composer:

- `list_mcp_orbit_components({ kind?, ref_pattern? })` — discovery. Returns kind / ref / version / summary; bodies omitted (fetched separately).
- `get_mcp_orbit_component({ kind, ref, version? })` — fetch one row with full body and structured payload.
- `get_meta_catalyst()` — the composer rulebook. Singleton.
- `recommend_mcp_orbit_compositions({ intent, inventory? })` — pre-filter + rank + log as `proposed`. The agent does the composition; this tool just gets it started.

## What does NOT belong in mcp-orbit

- **Bot-shaped workflows** that read submissions or conversations from a deployed mojulo bot — those are catalysts, not mcp-orbit. The bot is the source of truth there; mcp-orbit assumes no bot.
- **One-off scripts the operator wants once.** Components are *reusable shapes* shared across compositions. A one-off goes straight to the host adapter, no component needed.
- **Live runtime state.** The composition log records *deliberation* (what the agent considered, what it chose), not outcomes. Outcomes happen at run-rate against the materialized artifact; mojulo doesn't host or observe those runs.

## Deferred (post-v0)

- **User-custom components** via `register_mcp_orbit_component` — schema accommodates them via `source: 'custom'`; the tool ships in v1.
- **Composition templates** — frequently-used compositions saved as named, re-usable starting points. Falls out of `mcp_orbit_compositions` queries naturally.
- **Usage analytics** — which components and compositions actually get materialized. Wait for enough real compositions to land that the data is informative.
- **Cross-operator component sharing** — registry / network-effect layer if/when it materializes.
- **Composition arbiter** — analogous to the deferred meta-context arbiter; emerges when conflict detection across compositions becomes a real problem.
- **Structured `payload_json` constraint schema** — v0 stores constraints as prose in the component body that the agent interprets. If that turns flaky, structured constraints become necessary. Watch for it.
