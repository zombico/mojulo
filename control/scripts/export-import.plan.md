# `mojulo export` / `mojulo import` — full-workshop portability

Status: **design, nothing implemented.** Companion CLI pair to
[mcp-init.mjs](./mcp-init.mjs): one command to bundle the whole workshop
(`~/.mojulo/`) into a portable archive, one to restore it onto a fresh home —
laptop migration, backup/disaster-recovery, and host moves with the same
bundle.

## Why

The ownership story has an exit door at every bay except the deliberation
surfaces: bots export as zips, worlds as `.glb`, conversations via
`export_conversations` — but plans, research, contextmap, stashes, and cooks
live only in `~/.mojulo/`'s SQLite with no typed way out. A full-workshop
export closes that gap and upgrades the positioning from "your machine is the
substrate" to "*any* machine of yours is the substrate." For the
regulated-SMB segment the same bundle is the backup/DR artifact, which
matters more than laptop migration does.

Most of the work is already done by the packaging layer: `resolveMojuloPaths`
funnels ALL workshop state under one root, storage rows are keys resolved
against `STORAGE_ROOT` ([lib/storage/index.js](../lib/storage/index.js)),
builds store `relativeArtifactPath` when available
([lib/deployers/build.js](../lib/deployers/build.js)), and the API-key
ciphertext decrypts anywhere by default
([lib/deployment-auth.js](../lib/deployment-auth.js) — static fallback key
unless `API_KEY_ENCRYPTION_KEY` is set). The command formalizes "tar up
`~/.mojulo`" and handles the residue that does NOT travel.

## Goal / non-goals

- **Goal:** `npx mojulo export` on machine A → move one file → `npx mojulo
  import <bundle>` on machine B → the shelf renders identically, Fly bots
  reconnect, and everything machine-bound is flagged, not silently broken.
- **Non-goals (v1):**
  - **No merge.** Import-as-merge (two active laptops, reconcile) is a
    different, much harder problem — refs collide, contextmap seals conflict,
    audit-chain semantics get murky. v1 is restore-onto-fresh-home only and
    **refuses to import over a non-empty `MOJULO_HOME`**.
  - **No downgrade.** Importing a bundle from a NEWER mojulo into an older
    install is refused via the manifest version check. (Older → newer is the
    supported direction: the additive column-migrators in
    [lib/db/index.js](../lib/db/index.js) run at DB open and upgrade in
    place.)
  - **No per-bay selective export.** Whole-workshop or nothing in v1; the
    manifest records counts per bay so a future `--only plans,research` has
    a natural seam.

## Surface

Keep the single `mojulo` bin — two new argv branches in
[mcp-stdio.mjs](./mcp-stdio.mjs), same pattern as `init`: branch **before**
the stdio-server setup, delegate to a self-contained script that does its own
loader register + `resolveMojuloPaths`, and exits itself.

```
npx mojulo export [outfile]        # default: ./mojulo-export-<version>.zip
    --no-secrets                   # strip key material (see Secrets)
    --fleet                        # also bundle local bot data dirs (see Scope)
    --print                        # dry-run: manifest to stdout, write nothing

npx mojulo import <bundle>
    --home <dir>                   # target MOJULO_HOME (default resolve order)
    --print                        # dry-run: validate + reconciliation report only
```

Scripts: `mcp-export.mjs` + `mcp-import.mjs` (siblings of `mcp-init.mjs`).

## Bundle format

A zip (we already ship `archiver` for bot artifacts; reuse it for export).
Import needs an extractor — decision:

- **Recommended:** add one small unzip dep (`yauzl` or `unzipper`) to
  `control`. Check [next.config.mjs](../next.config.mjs)
  `serverExternalPackages` if it has native bindings (both named options are
  pure JS, so no).
- Alternative: system `tar` + `.tgz` (present on macOS/Linux/Win10+), zero
  deps but shells out and gives up the archiver reuse on the write side.

Layout inside the bundle mirrors `MOJULO_HOME` so a human can also just unzip
it by hand and understand what they're looking at:

```
manifest.json
data/mojulo-lite.db          # consistent snapshot (see DB snapshot)
data/artifacts/**            # zips + staging dirs (relative paths preserved)
data/storage/**              # uploaded documents, keyed layout as-is
fleet/<deploymentId>/data/** # --fleet only: per-bot conversation SQLite
```

Excluded always: `models/` (113MB, re-fetched lazily), any `exports/`
scratch, `*.db-wal` / `*.db-shm` sidecars (superseded by the snapshot).

## DB snapshot

Do **not** raw-copy the SQLite file — the control plane or a stdio session
may hold it open in WAL mode and a file copy can capture a torn state. Use
better-sqlite3's `db.backup()` (online backup API) to write a consistent
snapshot into the staging dir, then hash it. This also means export does not
require stopping anything.

## Manifest shape

```json
{
  "kind": "mojulo-export",
  "format": 1,
  "mojuloVersion": "0.2.x",
  "createdAt": "2026-07-02T00:00:00Z",
  "host": { "platform": "darwin", "mojuloHome": "/Users/x/.mojulo" },
  "scope": "workshop",
  "secrets": { "included": true, "encryption": "default" },
  "counts": {
    "deployments": 4, "documents": 12, "sketches": 31, "plans": 7,
    "research": 3, "stashes": 5, "cooks": 2, "opsTags": 1
  },
  "db": { "file": "data/mojulo-lite.db", "sha256": "…" },
  "externalPaths": [
    { "kind": "cook_outcome_dir",  "ref": "ck_…", "path": "/abs/on/source" },
    { "kind": "inventory_host_path", "ref": "…",  "path": "/abs/on/source" }
  ],
  "fleet": [
    { "deploymentId": "…", "target": "fly",   "bundledData": false },
    { "deploymentId": "…", "target": "local", "bundledData": true  }
  ]
}
```

- `format` is the bundle-format version; import refuses `format` it doesn't
  know and refuses `mojuloVersion` newer than itself.
- `secrets.encryption: "env-key"` when `API_KEY_ENCRYPTION_KEY` was set at
  export time — import warns that the same env var must be present on the
  target or key rows won't decrypt.
- `externalPaths` enumerates every absolute host path referenced by DB rows
  (cook `outcome_dir`, meta-context mirror `host_path`). Populated at export
  by a single sweep; consumed by the import report.

## Secrets policy

Two distinct kinds of key material ride in a naive copy:

1. **`api_keys` rows** — AES-256-GCM ciphertext. Included by default
   (portable per the static-fallback derivation); `--no-secrets` deletes the
   rows from the snapshot DB (the snapshot is already a private copy, so this
   is a plain `DELETE`).
2. **Bot artifact zips** — each staged zip embeds a `.env` with the bot's
   `MOJULO_API_KEY` and possibly a pasted LLM key. `--no-secrets` therefore
   also excludes `data/artifacts/**` and the manifest records
   `"artifactsStripped": true`; import then marks those deployments
   `needs_rebuild`. Do not attempt to surgically rewrite `.env` inside zips —
   exclusion is the honest, standing-secrets-rule-compatible behavior.

## Import flow

1. Validate: manifest present, `format` known, `mojuloVersion` ≤ self,
   `db.sha256` matches.
2. Refuse non-empty target: `MOJULO_HOME` exists AND (DB file present OR
   artifacts/storage non-empty) → print "move the existing home aside first"
   and exit 2. No `--force` in v1.
3. Extract into `MOJULO_HOME`, open the DB (open-time migrators upgrade an
   older schema in place).
4. **Reconcile** (see table), inside one transaction.
5. Print the import report: per-bay counts restored, deployment dispositions,
   dead `externalPaths`, secrets caveats, and the next-step line ("run
   `npx mojulo init` to wire this machine's MCP hosts — host wiring is never
   part of the bundle").

## Deployment reconciliation rules

| Row state at import | Disposition |
|---|---|
| Fly deployment | Keep as-is. The row is metadata + URL; the machine is remote. Best-effort re-verify (proxy ping) updates `last_seen_at`; failures downgrade to `unreachable`, never delete. |
| Local docker, was `running` | Containers don't exist on the target. Set status → `stopped`, clear any container/port fields. Artifact zip present → user restarts via normal paths; artifact stripped (`--no-secrets`) → `needs_rebuild`. |
| Local docker, user-unzipped run dir | The unzip location was never mojulo's to know. Nothing to restore; the deployment row + artifact zip travel, the user re-unzips. Document in the report, don't guess. |
| App running refs + inventory rows FK'd to `running_ref` | Purge. Running refs are ephemeral by definition; the artifact ref (contextmap identity) is what persists. |
| Agent-tasks queue | In-memory only — nothing to do. Parked promises on the source died with the process (`INFERENCE_PARKED_LOST` is already the contract). |
| `externalPaths` entries missing on target | Keep the rows, flag each in the report. Never null out — the user may recreate the path or re-point it. |
| Trigger bindings | Keep, but import report lists them explicitly: they resume firing once daemons start on the new machine, and the operator should know what will wake up. |

## Fleet scope (`--fleet`)

Workshop export deliberately excludes bot conversation data (golden rule:
it never enters the control-plane DB, and the bundle shouldn't quietly
become the place it leaks into). `--fleet` makes the inclusion explicit:

- For each **local** deployment whose staging dir under `ARTIFACTS_DIR`
  contains a `data/` mount, copy it to `fleet/<deploymentId>/data/`.
- **Fly** bots: nothing to bundle — the volume is remote and moves with the
  Fly app, not the laptop.
- User-unzipped bots at unknown paths: not discoverable; the report says so.
- On import, fleet data restores next to the re-staged artifact so a
  restarted local bot resumes its history — hash chains verify across the
  move because the rows are byte-identical.

## Remaining work / open questions

- [ ] Pick the unzip dep (`yauzl` vs `unzipper`) — or commit to system `tar`.
- [ ] Confirm every path-bearing column is root-relative in practice, not
      just by convention — one sweep over repositories writing
      `storage_path` / `artifact_path` / `outcome_dir`; normalize any
      stragglers at export rather than migrating old rows.
- [ ] Decide whether `export` warns when the dashboard/daemons are running
      (backup API makes it safe for the DB, but artifacts mid-build could be
      torn — probably: warn + skip in-progress staging dirs).
- [ ] Windows path handling in `externalPaths` (record as-is, compare
      platform in manifest, warn on cross-platform import).
- [ ] Future seams, explicitly out of v1: `--only <bays>` selective export,
      scheduled export (a trigger binding that writes the bundle — DR
      autopilot), merge-import.
