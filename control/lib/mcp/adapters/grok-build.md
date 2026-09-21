---
{
  "id": "grok-build",
  "name": "Grok Build (xAI)",
  "summary": "Studio rider + catalyst writer: native image_gen/image_edit is the paint worker (recipe stays sovereign); materializes catalysts as user-owned skills under ~/.grok/skills/.",
  "version": 2,
  "artifactTarget": "~/.grok/skills/<slug>/SKILL.md",
  "schedulingMechanism": "system cron / launchd invoking a headless grok session (verify Grok's native scheduler before preferring it)",
  "secretsPosture": "Grok-config-held secrets + inspect_bot_env — never cat .env",
  "supportsClientInfoHint": ["grok-shell", "grok-build", "grok"]
}
---

# Grok Build adapter

Your host is **Grok Build** (xAI's CLI agent). This card is how you ride mojulo from this host — **studio making first**, catalyst materialization second. Pull it once per session (`get_adapter`, no `id`) before the first mint or the first synthesized skill.

If you are **Grok chat** driving a sandbox shell with no MCP binding (not Grok Build), the MCP notes on this card do not apply to you: use the CLI-only host section in [AGENTS.md](../../../../AGENTS.md#cli-only--remote-sandbox-no-mcp-no-browser) — `npx mojulo call …`, `export_model` with `format: 'html'`, files as the handoff.

When a catalyst does materialize a runnable artifact, it is a **user-owned skill** at `~/.grok/skills/<slug>/SKILL.md`. Once written it belongs entirely to the user — they edit, version-control, and iterate on it; mojulo does not host, execute, or store skills.

**Write Grok's native layout, not Claude's.** Grok compat-scans `.claude/skills/`, so a skill authored there would appear to work. Don't do it: the compat scan is a migration courtesy, not this adapter's target. A skill materialized for a Grok operator lives under `~/.grok/skills/`.

## First-session behavior — you are an output-capped host

Grok caps MCP tool results (~20k bytes), and several mojulo surfaces exceed that. Measured against your cap, so you can budget rather than guess:

- `forward_context` ~9k and `get_substrate` ~10k — both fit. `forward_context` is the routing index; read the rows and pull ONE drawer at a time.
- `get_tool_index` is ~48k — roughly 2.4× your cap. Calling it costs a truncated read; `forward_context` plus `semantic_search` covers the same ground in fitting pieces. Your call, but that's the trade.
- Pack unveils range ~4k–36k. The heavy ones (connected services, stash, image render, game, illustration, diagram, motion) can spill; the rest fit. If a result looks truncated, narrow the call rather than retrying it identically.

None of this is enforced — mojulo won't refuse a call because it might truncate, and it won't silently reshape a response you asked for. If you decide a truncated read is worth it, take it; just tell the operator what got cut so they can decide whether to narrow it or work from the fragment. This section is written for any capped host; you are the first card to carry it.

## Studio rider — you are the judgment Mojulo refused to embed

Mojulo holds recipes, units, refusals, and proof. You hold vision, form-split, and the `when` line. Filling `kind` / `spec` is table stakes; these standing moves are the ride:

1. **Split the ask.** Native image (`image_gen` / `image_edit`) is the look. Mojulo is the recipe — pose, scale, world, proof, print. One operator sentence is often several artifacts that must stay the same thing. Do not dump the whole ask into one mint or one picture.
2. **You are the paint worker.** Mojulo designs composition-locked scaffolds; it cannot paint. Most hosts need ComfyUI or a subscription. You close the loop in-session: mint the scaffold → paint from the packet → bind with `bind_image_render` (skins: `edit_solid` / `get_skin_packet` then apply). The PNG is a derived render. The recipe stays sovereign. The eyes gate is the operator's — see `docs/bicycles.md`; do not invent a gate here.
3. **Two motion systems.** `forge_motion` is deterministic (turntable, traversal that can prove a level). Native video (`image_to_video` / `reference_to_video`) is cinema. Do not substitute one for the other.
4. **A no is a next move.** `needs-vocab` → read the named card. Traversal `stuck` → change the path. Unaudited game → walk it or say you skipped. Do not retry the same call louder.
5. **Write the `when` line.** `save_recipe` is findable later only if `when` is this conversation's intent, not the ref.

## Artifact target

- Path: `~/.grok/skills/<slug>/SKILL.md`
- Slug pattern: `<subject>-<short-purpose>` (e.g. `acme-crm-sync`, `weekly-drive-digest`). Multiple catalysts can materialize against one subject — distinct slugs, no collisions.
- Helper files (config templates, mapping tables, fixtures) sit next to the SKILL.md in the same directory.

## Standing-moves preamble (inline into every materialized skill)

A skill is the only thing guaranteed to be read at run time, so the standing moves go into its opening block:

```md
## Standing moves — run every time, before this workflow's main steps

1. **Preflight (mojulo MCP).** Verify the mojulo tools this workflow calls are visible. If missing, say "mojulo MCP not bound" and stop.
2. **Preflight (destination MCP).** Verify the destination tools are visible. If missing, name the missing server and stop.
3. **Drift check.** Re-read the source shape (e.g. `get_deployment`) and compare against the snapshot recorded in this skill's config. Refresh before writing if it moved.
4. **Secrets posture.** Never `cat` or read `~/.mojulo/**/.env*` — route through `inspect_bot_env`. Same rule on error paths.
5. **Dry-run gate.** Read `liveMode` from `config.json`. If `false`, render the destination payload and stop. If `true`, proceed to the live write.
```

## Parameter collection

Ask the catalyst's `parameters` questions in one batched round before writing the skill. Don't drip them. Skip anything the user already answered in their intent. Resolved values land in a `config.json` beside the SKILL.md.

## Tool discovery

You can see which MCP tools are bound in this session. Cross-reference the catalyst's `destinationExamples` against what's available:

- Destination MCP installed → bind it and write a working skill.
- Not installed → mention it as a soft upgrade ("a CRM MCP — HubSpot, Salesforce, Pipedrive, Attio — would unlock the live-write path"). Don't gatekeep; the user opts into upgrades.

## Dry-run as a concrete skill step

`dryRun: true` as a default is not enough — it gets skipped under deadline pressure. Bake it into the skill's **first step**, with a concrete flip location:

> First invocation: pull one real record, render the full destination payload, do not call the destination's write tool. Flip `liveMode: true` in `<skill-dir>/config.json` to go live.

A skill that defaults to dry-run but doesn't *demonstrate* it as its opening move shouldn't ship.

## Scheduling

Grok's own scheduler is the right target **if** it has one — confirm the mechanism and its invocation against Grok's current docs before you promise a cadence. If it doesn't, or you can't confirm, fall back to the portable path: system `cron` / `launchd` invoking a headless Grok session against the skill, with the recommended cadence documented in the skill's frontmatter. Don't invent a scheduler name; say which one you used.

## State storage

- **Cursor** — a state file at `<skill-dir>/state.json` (`{ lastRunAt, highWaterMark }`), read at start, written at end.
- **Destination-side dedupe** — search-before-create on the catalyst's named `dedupeKey`. This is the durable defense regardless of where the cursor lives; always include it.

## Output reporting

Print the per-record decision log from the catalyst's `outputContract`, and persist a copy to `<skill-dir>/runs/<timestamp>.json`. Shape: at minimum `recordId`, `action` (`inserted | updated | skipped-* | failed`), `destinationRecordId?`. End with `{ cursor, totals }`.

## Secrets posture

- Never `cat` or read `~/.mojulo/**/.env*` directly — always `inspect_bot_env`, which returns `{ key, value, masked }`.
- Never inline secret values into the SKILL.md or `config.json`. If Grok has a secret-injection mechanism, reference secrets through it; otherwise leave them out entirely and let the destination MCP's auth surface hold them.
- No path may log raw `.env` contents — error handlers that dump the environment for debugging are the common leak.

## Hand-off to the user

- Where the skill lives and how to invoke it.
- The exact dry-run flip (`config.json` → `liveMode`).
- That scheduling is theirs to wire, and which mechanism you documented.
- Re-run the catalyst flow if the source's shape changes later.

---

## Primitive binding flow (no-bot composition)

The parallel flow for **no-bot, primitive-shaped** workflows: declare your installed MCPs as a richer-snapshot inventory (`meta_context_declare_inventory`, REPLACE semantics), call `bind_primitives` once per primitive slot, materialize as a skill in the same layout as above, and seal with `meta_context_commit({ type: 'primitive_artifact_materialization', adapter_id: 'grok-build', ... })`.

Two Grok-specific notes:

- **Introspect from the interactive session.** Declare what your session can actually see; label confidence honestly (`names_only` when you have a name but no schema). A fabricated `tools_list_full` snapshot poisons the audit trail — an honest `names_only` one still produces a working generated body.
- **The snapshot is large; your cap is not.** Declare inventory in one call, but pull `bind_primitives` bodies one slot at a time and copy the mapping intent + pitfalls into the skill as you go. The provider body is session-scoped; the skill has to be self-contained at run time.

`bind_primitives` returns `snapshot_stale` when the inventory is over 24h old — re-declare before binding rather than shipping a skill against a stale tool surface.
