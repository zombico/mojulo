---
{
  "id": "hermes",
  "name": "Hermes",
  "summary": "Baseline Hermes contract — stdio-wired, materializes catalysts as a workflow file plus config in a directory the user picks, scheduled out-of-band; native skills layout and scheduler still to be confirmed.",
  "version": 1,
  "artifactTarget": "<dir>/workflow.md + <dir>/config.json (Hermes' native skills layout is unconfirmed — see 'Unverified' below)",
  "schedulingMechanism": "out-of-band (system cron / launchd invoking a headless Hermes session)",
  "secretsPosture": "inspect_bot_env only — never cat .env",
  "supportsClientInfoHint": ["hermes"]
}
---

# Hermes adapter

Your host is **Hermes**. This card exists so a Hermes session stops resolving `generic` and gets the discipline sections that matter, but it is deliberately narrower than the Claude Code and Codex cards on two points that nobody has verified yet. Where it says *unverified*, trust your own runtime over this file — you can see your substrate and this card cannot.

## Connect over stdio

Mojulo's stdio front door (`npx -y mojulo`) is **tokenless and host-spawned**: no dashboard, no port, no bearer. If you connected over Streamable HTTP to `http://localhost:3001/api/mcp` instead, you needed `CONTROL_PLANE_MCP_KEY` and a bearer on every call — that is the only path with an auth prompt, and it is a variant for operators who run the dashboard persistently, not the default.

Two consequences worth stating plainly:

- **A token prompt means you are on the wrong transport.** Stdio removes the prompt rather than automating around it. If you have reason to stay on HTTP, that path is fully supported — set `CONTROL_PLANE_MCP_KEY` and send the bearer; just tell the operator why, since it is the variant that can fail mid-task.
- **"Is the control plane up?" stops being a question.** Under stdio the server is spawned by you; a dead substrate is a spawn failure at session start, which your runtime already surfaces — not a mid-task hang. If you *are* on the HTTP variant and a call returns connection-refused, tell the operator the control plane is down and how to start it (`npx mojulo` / the dashboard launcher). Fail fast; don't retry mid-task.

## Orientation

Call `forward_context` first — it is the routing index, and it is stateful (workshop pulse, install-gated wings, versioned with the server). Route from its rows, pull ONE drawer at a time, and let the pack dispatchers stay cold until a row routes you into one. Don't pull `get_tool_index` if you are working under a context budget; `forward_context` plus `semantic_search` is the cheap discovery surface.

## Artifact target

Materialize the workflow as **two files** in a directory the user picks:

- `<dir>/workflow.md` — the procedure: inputs, mapping table, idempotency strategy, output contract, and the standing-moves block below as its opening section. Human-readable and version-controllable.
- `<dir>/config.json` — the resolved parameters plus `liveMode: false`.

**If Hermes has a native skills directory, prefer it** — write the same content in that layout instead, and tell the user where it landed. This card doesn't name a path because none has been confirmed; see *Unverified* below. Do not write `.claude/skills/` — that is another host's layout, and a compat scan (if one exists) is a migration courtesy, not this adapter's target.

## Standing-moves preamble (inline into every artifact)

```md
## Standing moves — run every time, before this workflow's main steps

1. **Preflight (mojulo MCP).** Verify the mojulo tools this workflow calls are visible. If missing, say "mojulo MCP not bound" and stop.
2. **Preflight (destination MCP).** Verify the destination tools are visible. If missing, name the missing server and stop.
3. **Drift check.** Re-read the source shape and compare against the snapshot in `config.json`. Refresh before writing if it moved.
4. **Secrets posture.** Never `cat` or read `~/.mojulo/**/.env*` — route through `inspect_bot_env`. Same rule on error paths.
5. **Dry-run gate.** Read `liveMode` from `config.json`. If `false`, render the destination payload and stop. If `true`, proceed to the live write.
```

## Parameter collection

One batched round before materializing. Skip what the user already answered. Resolved values go into `config.json`.

## Tool discovery

Cross-reference the catalyst's `destinationExamples` against the MCP tools bound in your session. Destination installed → bind it. Not installed → offer it as a soft upgrade, never a blocker; the user opts into upgrades.

## Dry-run as a concrete step

Bake it into the artifact's first step, with the flip location named:

> First invocation: pull one real record, render the full destination payload, do not call the destination's write tool. Flip `liveMode: true` in `config.json` to go live.

## Scheduling

Out-of-band unless you can confirm Hermes' own scheduler (unverified). Document the recommended cadence in `workflow.md`'s frontmatter and let the user wire `cron` / `launchd` / whatever they run against a headless Hermes session. Don't name a scheduler you haven't confirmed exists.

## State storage

- **Cursor** — `<dir>/state.json` (`{ lastRunAt, highWaterMark }`), read at start, written at end.
- **Destination-side dedupe** — search-before-create on the catalyst's `dedupeKey`, always, regardless of where the cursor lives.

## Output reporting

The per-record decision log from the catalyst's `outputContract` to stdout, with a copy at `<dir>/runs/<timestamp>.json`. At minimum `recordId`, `action` (`inserted | updated | skipped-* | failed`), `destinationRecordId?`; end with `{ cursor, totals }`.

## Secrets posture

- Never `cat` or read `~/.mojulo/**/.env*` — always `inspect_bot_env`.
- Never inline secret values into `workflow.md` or `config.json`; prefer Hermes' secret-injection mechanism if it has one.
- No path may log raw `.env` contents, including error paths.

## Primitive binding flow (no-bot composition)

Same shape as the other adapters: `meta_context_declare_inventory` (richer snapshot, REPLACE semantics) → `bind_primitives` per slot → materialize as `workflow.md` + `config.json` → seal with `meta_context_commit({ type: 'primitive_artifact_materialization', adapter_id: 'hermes', ... })`. Call bound tool names from the snapshot directly, not affordance names, and copy each binding's mapping intent + pitfalls into `workflow.md` — the provider body is session-scoped, the file has to stand alone at run time. Re-declare when `bind_primitives` warns `snapshot_stale`.

---

## Unverified — read this before trusting the two thin sections

This card ships narrow on purpose. Four things about Hermes are unconfirmed at authoring time, and guessing them would be worse than admitting them:

1. **The `clientInfo.name` Hermes actually sends.** The hint list here matches on `hermes`; if you resolved this card, it worked. If a Hermes session resolves `generic` instead, pass `clientInfoHint: 'hermes'` to `get_adapter` / `get_catalyst` and tell the operator the hint needs pinning.
2. **The config file path and format.** This is why `npx mojulo init` detects Hermes but prints a paste snippet instead of writing: a write to a guessed path would report success against a file Hermes never reads.
3. **The native skills layout** — hence the `workflow.md` + `config.json` fallback above.
4. **The scheduler**, hence out-of-band scheduling.

If you can confirm any of these from your own runtime, tell the operator — each one is a small edit to this card and to `lib/mcp/hosts/hermes.json`, and it moves Hermes onto the same footing as Claude Code and Codex.
