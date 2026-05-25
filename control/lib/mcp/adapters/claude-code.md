---
{
  "id": "claude-code",
  "name": "Claude Code",
  "summary": "Materializes catalysts as user-owned skills under .claude/skills/, scheduled via /schedule, secrets-guarded via .claude/settings.json deny rules.",
  "version": 1,
  "artifactTarget": ".claude/skills/<slug>/SKILL.md",
  "schedulingMechanism": "/schedule",
  "secretsPosture": ".claude/settings.json deny rules + inspect_bot_env",
  "supportsClientInfoHint": ["claude-code", "claude-ai", "claude"]
}
---

# Claude Code adapter

Your host is **Claude Code**. The runnable artifact this catalyst materializes is a **user-owned skill** at `.claude/skills/<slug>/SKILL.md`. Once written, it belongs entirely to the user — they edit, version-control, and iterate on it; mojulo does not host, execute, or store skills.

## Artifact target

- Path: `.claude/skills/<slug>/SKILL.md`
- Slug pattern: `<bot-slug>-<short-purpose>` (e.g. `acme-crm-sync`, `acme-scan-churn-intent`). Multiple catalysts can materialize against one bot — they get distinct slugs so they don't collide.
- Helper files (config templates, mapping tables, fixtures) go next to the SKILL.md in the same directory.

## Parameter collection

Ask the catalyst's `parameters` questions in one batched round before writing the skill. Don't drip questions one at a time. Skip questions the user already answered in their intent.

## Tool discovery

You already see which MCP tools are bound in this session. Cross-reference the catalyst's `destinationExamples` against what's available:

- Destination MCP installed → bind it and write a working skill.
- Destination MCP not installed → mention it as a soft upgrade ("you'd need a CRM MCP — HubSpot, Salesforce, Pipedrive, Attio — for the live-write path"). Don't gatekeep. Per the consultation posture, the user opts into upgrades; mojulo doesn't block.

## Dry-run as a concrete skill step

`dryRun: true` defaulting in the contract is not enough on its own — users skip the dry-run under deadline pressure when it's only a default. Bake it into the skill's **first step**:

> First invocation: pull one real record, render the full destination payload to stdout, do not call the destination's write tool, wait for explicit "go live" from the user. Subsequent runs default to `dryRun: false` only after that confirmation.

A skill that defaults `dryRun: true` but doesn't *demonstrate* dry-run as its opening move gets skipped. Don't ship one.

## Scheduling

For recurring execution, instruct the user to combine the skill with the `/schedule` slash command. The skill stays parameterized; `/schedule` provides cadence + bound arguments and persists the schedule in the user's Claude Code state.

## State storage

Two layers, both belong in the skill:

- **Cursor** — the skill prints the new high-water cursor (typically `captured_at`) at end of run. The user passes it back next time, or `/schedule` carries it in the bound arguments.
- **Destination-side dedupe** — search-before-create on the catalyst's named `dedupeKey` is the durable defense, independent of where the cursor lives. Always include it; the cursor is the primary defense, dedupe is the safety net.

## Output reporting

Surface the per-record decision log declared in the catalyst's `outputContract` (or the equivalent prose section) to stdout — Claude Code presents stdout to the user inline. Include the new cursor value in the trailing log line so the user (or `/schedule`) can pick it up.

## Secrets posture

Translate mojulo's "never `cat` `.env`" standing rule into a defense-in-depth deny rule the harness enforces. Suggest the user add this to `.claude/settings.json` on first connect:

```json
{
  "permissions": {
    "deny": [
      "Read(~/.mojulo/**/.env)",
      "Read(~/.mojulo/**/.env.*)",
      "Bash(cat ~/.mojulo/**/.env*)"
    ]
  }
}
```

Inside the skill itself: never `cat` or `Read` a bot's `.env` directly — always go through the `inspect_bot_env` MCP tool, which returns masked sensitive values plus clear non-sensitive ones. Skill prompts should reference `inspect_bot_env` by name when they need to read bot configuration.

## Hand-off to the user

When you finish synthesizing, tell the user:

- Where the skill was written (`.claude/skills/<slug>/SKILL.md`).
- That the skill is theirs — mojulo doesn't see it, doesn't execute it, doesn't update it. Re-run the catalyst flow if the bot's form schema or protocols change later.
- The first-invocation dry-run pattern is baked in; explain how to flip to live mode when they're satisfied.
- That `/schedule` is the way to make it recurring if they want that.

---

## Primitive binding flow (parallel path, runtime-introspected)

Everything above describes the **catalyst** flow — bot-shaped, vendor-shaped, curated body. There's a second flow mojulo supports for **no-bot, primitive-shaped** workflows: the agent declares its installed MCPs as a richer-snapshot inventory, calls `bind_primitives` per primitive slot, and `meta_context_commit` seals the materialization. Use this flow when the user wants outcomes without a chatbot in the picture AND you want the generated provider artifact to reflect the operator's actual installed MCP (tool names, schemas) rather than a curated guess. The vendor-shaped `recommend_mcp_orbit_compositions` flow is the supported default; primitive binding is the runtime-introspected alternative we're validating in parallel.

### Why Claude Code is well-suited as the introspection host

Claude Code surfaces every connected MCP's tools in your session: pre-loaded tools appear as `<function>{...}</function>` blocks at the top of the prompt, deferred tools appear by name in `<system-reminder>` blocks. Tool names follow the convention `mcp__<server>__<tool_name>` — for example, `mcp__claude_ai_Google_Drive__search_files` belongs to server `claude_ai_Google_Drive`, tool `search_files`. That naming convention is your enumeration affordance — no separate `tools/list` call is needed; you already see the surface.

### Step 1 — Enumerate MCPs from your tool surface

Scan your visible tools (pre-loaded + deferred). For each tool name matching `mcp__<server>__<tool>`:

- Parse out `server` (everything between `mcp__` and the second `__`).
- Group tools by server.
- Note which tools' schemas are already loaded (visible in `<function>{...}</function>` blocks) vs deferred (just a name in the system reminder).

### Step 2 — Load schemas for the tools that will bind primitive affordances

For each MCP server you plan to bind a primitive against, load schemas for every tool whose name you'll cite in `bindings`. Two affordances:

- **Pre-loaded tools** — the schema is already in your context as `<function>{..., "parameters": {...}}</function>`. The `parameters` field IS the input schema.
- **Deferred tools** — call `ToolSearch` with `query: "select:<tool_name>"` (or a comma-separated list) to fetch the schemas inline. The response contains the same `parameters` block.

If you ship a snapshot that references a deferred tool whose schema you never loaded, you can't honestly declare `tools_list_full` for that tool — drop it to `agent_inferred` (you knew the name, you guessed the schema from prior training-data knowledge of that API) or `names_only` (you knew only the name).

### Step 3 — Ship the snapshot via `meta_context_declare_inventory` in richer-snapshot mode

Build the call's `servers` array with one entry per MCP, and one entry per tool with the schema you just loaded. Example:

```json
{
  "servers": [
    {
      "name": "claude_ai_Google_Drive",
      "tools": [
        {
          "name": "search_files",
          "description": "Search files by query",
          "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } }, "required": ["query"] },
          "introspectionConfidence": "tools_list_full"
        },
        {
          "name": "create_file",
          "inputSchema": { "type": "object", "properties": { "name": { "type": "string" }, "mime_type": { "type": "string" } }, "required": ["name", "mime_type"] },
          "introspectionConfidence": "tools_list_full"
        }
      ]
    }
  ]
}
```

REPLACE semantics still apply — the latest declaration is authoritative; tools not in the call are wiped. So include every MCP + tool that could plausibly play a primitive role in any composition you might compose this session, not just the ones for the immediate workflow. Re-declaration is cheap; an incomplete declaration limits which primitives can bind.

### Step 4 — Bind primitives per composition slot

For each primitive slot the user's intent implies (e.g. `document-store/destination` for "weekly digest into Drive"), call `bind_primitives`:

```json
{
  "primitive": "document-store",
  "role": "destination",
  "server": "claude_ai_Google_Drive",
  "bindings": {
    "create-with-mime": { "tool": "create_file", "confidence": "agent-inferred" },
    "find-by-key-in-scope": { "tool": "search_files", "confidence": "agent-inferred" }
  }
}
```

The response carries a `prov_<id>` ref plus the inline `body` — a runtime-generated markdown artifact with the actual bound tool names + schemas filled into the primitive's role template. **Read the body in full** before composing further; it's the primitive's full guidance with this MCP's reality baked in.

The `confidence` per binding is `agent-inferred` by default. Bump to `operator-confirmed` after asking the user to confirm a specific binding (typically when two tools could plausibly satisfy one affordance and you ask the operator which to use).

### Step 5 — Materialize as a `.claude/skills/<slug>/SKILL.md` skill

Same artifact target as the catalyst flow above — Claude Code's substrate is unchanged. Differences in the skill's content:

- The skill embeds the **bound tool calls by name** (e.g. `search_files`, `create_file`) from the `bind_primitives` response, not generic affordance names.
- The skill references the generated provider body's mapping intent for pitfalls + integration specifics — copy the relevant sections directly into the SKILL.md (the provider body is session-scoped; the skill needs to be self-contained at run time).
- The dry-run pattern + `/schedule` guidance from the catalyst flow still apply unchanged. The state-storage two-layer (cursor + destination-side dedupe) still applies — the primitive's role template will name the cursor affordance and the dedupe affordance for you.

### Step 6 — Seal with `meta_context_commit` (primitive_artifact_materialization)

After the skill is written + verified existing on disk, commit:

```json
{
  "type": "primitive_artifact_materialization",
  "adapter_id": "claude-code",
  "artifact": { "locator": "<absolute path to SKILL.md>", "label": "Weekly Drive digest of Linear issues" },
  "composition_intent": "Weekly digest of open Linear issues into a Google Drive folder, Monday 9am.",
  "provider_artifact_refs": ["<every prov_xxx from bind_primitives this session>"],
  "principles": [
    { "scope": "artifact", "body_md": "Operator confirmed Monday 9am cadence and the gdrive-projects folder scope." }
  ]
}
```

The commit auto-writes a summary principle on the artifact node that records the composition intent + every binding (primitive / role / affordance / bound tool / confidence). Future sessions reading the contextmap can recover the composition's shape from that single principle.

If the commit fails (artifact verification or scope rejection), delete the skill file before retrying — a successful materialization with no commit is worse than a failed one (unauditable artifact lying in the user's `.claude/skills/`).

### Inventory freshness

The snapshot you ship in step 3 carries a `declaredAt` timestamp. `bind_primitives` returns `snapshot_stale` in `warnings` when the snapshot is more than 24h old. When that fires, re-run step 1–3 — your tool surface in the current Claude Code session is authoritative, not what mojulo cached. Re-declaration is cheap; stale schemas baked into a materialized skill are not.
