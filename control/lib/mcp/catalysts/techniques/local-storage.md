---
{
  "id": "technique-local-storage",
  "name": "Local storage",
  "summary": "Bind a folder on the operator's machine to an artifact as a document-store primitive against the filesystem MCP, with the binding decision recorded as an artifact-scope principle in the contextmap.",
  "valueHook": "give this artifact a folder on disk it can read from and write to, with the choice recorded for audit.",
  "kind": "technique",
  "version": 1,
  "category": "runtime-primitive",
  "requires": {
    "mcp": ["filesystem"]
  }
}
---

# Technique: local-storage

Bind a folder on the operator's machine to an artifact (a skill, an app, or a direct-use composition) as a `document-store` primitive against the filesystem MCP. Two variants: `local-storage:persistent` (workspace-root sub-path; survives stop/restart) and `local-storage:temporary` (`os.tmpdir()/mojulo/<artifact_ref>/`; advisory cleanup at teardown).

This technique is the substrate that lets artifacts read inputs and write outputs without inventing a per-artifact storage convention. The decision audit (variant, path, retention) lands in the contextmap; the bound tool surface comes from the operator's installed filesystem MCP. **One technique application = one folder + one binding row + one referencing principle.** Multi-folder artifacts apply the technique multiple times.

## Substrate posture (read before walking the steps)

- **The MCP's allow-list is the only runtime sandbox.** `path_prefix` on the binding tells the agent *where to write*; the MCP enforces only its launch-time allowed paths. A binding scoped to `/Users/op/workspace/digest` against an MCP allowed at `/Users/op` means an agent ignoring the binding could write anywhere under `/Users/op`. The audit chain (binding + commit) is the evidence trail, not a runtime block.
- **`operator.workspace_root` is set once, reused thereafter.** Subsequent technique applications read it via `meta_context_brief`; only ask the operator to set or change it.
- **Conflicts are surfaced, not silently adopted.** If the chosen sub-path exists but mojulo didn't create it (no recorded binding), the operator either *claims* the existing folder (records a binding retroactively) or *relocates* (picks a different sub-path). Never write to operator state mojulo didn't materialize.
- **Variant is chosen at application time, not later.** A persistent artifact that should have been temporary becomes the operator's cleanup problem; a temporary artifact promoted to persistent loses its declared retention story. Confirm the variant with the operator before binding.

## The five steps

### 1 — Resolve or set `operator.workspace_root`

Call `meta_context_brief({ scope: { kind: 'fleet' } })`. On the operator node, look for the most recent principle with `sourceEvent === 'operator_workspace_setup'` — its body carries the current `Workspace root:` line.

- **Set:** continue to step 2 using that workspace root.
- **Unset:** ask the operator for an absolute path (POSIX `/Users/<name>/<dir>` or Windows `C:\Users\<name>\<dir>`) that is **not** their home directory root. Suggest a dedicated `<home>/mojulo-workspace` if they're unsure. Then call `meta_context_commit({ type: 'operator_workspace_setup', workspace_root: '<absolute>' })`. If `operator_kyc` hasn't been committed yet, that call returns `operator_anchor_missing` — surface the kyc step first.

For `local-storage:temporary`, skip this step entirely. Temporary bindings root at `os.tmpdir()/mojulo/<artifact_ref>/` regardless of the operator's workspace.

### 2 — Confirm the filesystem MCP in inventory

The fleet brief from step 1 carries `inventory` (current declared inventory) and `vendorKnowledge` (one row per provider, including `filesystem` once seeded). Look up:

- `vendorKnowledge.providers` — is `filesystem` present? (Yes if `seedMcpCapabilities` ran on first install; you can confirm the body via `get_mcp_capabilities({ provider_ref: 'filesystem' })`.)
- `inventory.servers` — has the operator's agent connected a filesystem MCP server? Names vary by agent: `filesystem`, `claude_ai_Filesystem`, `mcp_filesystem`.

If the filesystem MCP is *not* in the operator's inventory, surface the one-line install instruction and exit — re-running the technique after install is the recovery path. The install command is host-dependent; for Claude Code it is:

```
claude mcp add filesystem npx -y @modelcontextprotocol/server-filesystem <workspace_root>
```

…with the workspace_root from step 1 as the allowed path. After install, the operator runs `meta_context_declare_inventory` (their agent typically auto-runs this on session start) to register the new server.

### 3 — Choose the sub-path, apply `conflict-vs-claim`, call `bind_primitives`

Pick the sub-path:

- `:persistent` — `<workspace_root>/<artifact_ref_or_label>/`. The label should be stable, human-readable, kebab-case (e.g. `digest-skill`, `dental-extractions`). Avoid timestamps in the folder name — those go in *files inside* the folder, not in the path.
- `:temporary` — `os.tmpdir()/mojulo/<artifact_ref>/`.

Probe the path on disk via the filesystem MCP's read affordance (e.g. `get_file_info` or `list_directory`):

- **Path does not exist.** Proceed to bind. The MCP creates the folder lazily on the first write, or you can `create_directory` explicitly.
- **Path exists, recorded in contextmap as a prior mojulo binding.** Reuse the existing binding ref; do not create a duplicate. Surface the existing binding to the operator and confirm reuse before continuing.
- **Path exists, mojulo did not create it.** Ask the operator: claim (record this binding retroactively, accept whatever's in the folder as starting state) or relocate (pick a different sub-path). Never silently adopt.

Then call `bind_primitives`:

```
bind_primitives({
  primitive: 'document-store',
  role: 'destination',           // or 'source' for read-only bindings
  server: '<filesystem inventory server name>',
  pathPrefix: '<chosen sub-path>',
  bindings: {
    'create-with-mime': { tool: '<write tool name from the snapshot>', confidence: 'agent-inferred' },
    'find-by-key-in-scope': { tool: '<search/list tool from the snapshot>', confidence: 'agent-inferred' },
    // append-to-existing, move-to-folder typically unbound for plain filesystem MCPs
  }
})
```

The returned `artifact.ref` (a `prov_<id>`) is the stable handle for step 4.

### 4 — Graduate via `meta_context_commit`

```
meta_context_commit({
  type: 'primitive_artifact_materialization',
  adapter_id: '<claude-code|codex|generic>',
  artifact: { locator: '<artifact_ref or absolute path>', label: '<human label>' },
  composition_intent: 'local-storage:<persistent|temporary> binding for <artifact label>',
  provider_artifact_refs: ['<prov_id from step 3>']
})
```

This seals the audit chain: the artifact node now references the binding row; future `meta_context_brief` calls scoped to this artifact surface the binding without re-parsing the body. The auto-summary principle on the artifact node names the primitive / role / affordance / bound tool — readers do not need to re-derive the binding from prose.

### 5 — Wire the artifact (addressing)

The runtime-addressing matrix decides how the artifact reaches the bound folder. Per artifact kind:

- **Skill (workflow-catalyst materialization).** Bake the absolute path into the SKILL.md body at synthesis time. The skill body instructs the agent to call the filesystem MCP against that exact path. Example: `"Read input files from /Users/op/mojulo-workspace/digest-skill/inputs/, write the digest to /Users/op/mojulo-workspace/digest-skill/outputs/<date>.md."` Do not parameterize the path at runtime; the binding is the source of truth at synthesis time.
- **App (app-catalyst materialization).** The Runner MCP injects the path as an env var on `start_app`. Naming convention: `MOJULO_LOCAL_STORAGE_PATH` for single-binding artifacts; `MOJULO_LOCAL_STORAGE_<TAG>_PATH` (uppercase tag) for multi-binding artifacts where the catalyst declared roles like `inputs` and `outputs`. The app's config block lists the env var names; a one-line README note in the app artifact reminds the operator that the env var is wired by mojulo on start.
- **Direct agent use (no artifact materialized).** The agent reads `manifest.pathPrefix` from the binding row via `meta_context_brief` and uses it directly. Re-applying the technique because the workspace moved regenerates the binding; the path on the new binding is the only source of truth.

## Variant: `local-storage:temporary`

Identical to the steps above with three substitutions:

- Step 1 is skipped (`operator.workspace_root` is not consulted).
- Step 3 chooses `os.tmpdir()/mojulo/<artifact_ref>/` instead of a workspace sub-path.
- The materialization commit's `composition_intent` ends in `local-storage:temporary`, and an additional artifact-scope principle states the cleanup policy (advisory in v0 — mojulo does not actually delete the folder on artifact teardown; the operator is responsible, or a future `scheduled-task` technique enforces TTLs).

Use `:temporary` for scratch space the artifact regenerates each run (caches, intermediate outputs, derived state). Use `:persistent` when "what was here last run?" is the workflow's data, not its waste.

## Pitfalls

- **Workspace root pointing at home directory.** `/Users/op` opens SSH keys, browser data, financial documents. Steer the operator to a dedicated subdirectory.
- **Re-application after the operator moved the workspace.** Re-running the technique against the new root produces a fresh binding, but in-flight artifacts with baked paths (skill bodies, app env vars) still point at the old folder. v0 ships manual re-materialization; flag stale bindings to the operator when you observe them.
- **Symlinks under `path_prefix`.** Operators occasionally symlink inside their workspace. The MCP's allow-list constrains the *resolved* target, but the binding's `path_prefix` is a string prefix — a symlink whose target lies outside the prefix is reachable. Probe for symlinks at step 3 and surface any that resolve outside the binding's intended scope.
- **Concurrent writers.** Two artifacts bound to the same path race. No file lock affordance exists in the filesystem MCP. If the workflow genuinely needs shared writable state, prefer a different primitive (`local-sql` once that technique ships) or coordinate at the agent layer.
- **Encoding.** The filesystem MCP's `write_file` is text-shaped on most implementations. Binary artifacts (images, archives) need base64 encoding or a different primitive entirely.
