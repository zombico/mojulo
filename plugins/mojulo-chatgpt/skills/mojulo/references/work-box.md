# Work-box bootstrap and recovery

Use only when the current session has shell access and no suitable Mojulo MCP connection.
Paths below are variables: choose the session's actual writable workspace and locate
`../scripts/runner.mjs` relative to this reference. Do not assume `/mnt/data` or a
persistent home. The runner requires Node >=22.14 and npm for installation.

## Inspect, then reuse or install

```sh
node "$runner" status --workspace "$workspace"
```

Status is read-only: it reports Node, the workspace runtime, npm, and installed
browser/ffmpeg candidates without installing packages or opening a database. A
missing browser does not block geometry or HTML exports. An explicit render in the
normal npm build may download Chromium; inspect the requested operation and runtime
before taking that path. `MOJULO_CHROMIUM` can name a verified installed binary.

Reuse an existing **package directory** (the directory containing Mojulo's
`package.json` and `scripts/`) with `--package-root "$package_root"` on each command.
It must match `--version`; no global install or PATH mutation is needed.

Otherwise install the pinned package in `.mojulo-chatgpt/runtime`:

```sh
node "$runner" install --workspace "$workspace" --version 3.0.0
```

This runs npm, downloads dependencies, and runs their native install scripts. It
writes only the managed runtime under the chosen workspace plus npm's normal cache.
For development use the supplied **branch tarball**, because a registry package with
the same version does not contain unreleased branch changes:

```sh
node "$runner" install --workspace "$workspace" --version 3.0.0 --tarball "$tarball"
```

The runner records the tarball SHA-256. A repeated install of the same source reuses
it; a different source/version requires a new workspace instead of silently replacing
an existing runtime. A failed install may leave a partial runtime: inspect the error
and use a fresh workspace after fixing the cause. Do not silently switch to latest.

## Run

```sh
node "$runner" exec --workspace "$workspace" -- orient
node "$runner" exec --workspace "$workspace" -- call version
node "$runner" exec --workspace "$workspace" -- call get_adapter
node "$runner" exec --workspace "$workspace" -- call forward_context
node "$runner" exec --workspace "$workspace" -- help compose_world
```

Tool names are arguments to `call`, not runner subcommands. For example:

```sh
node "$runner" exec --workspace "$workspace" -- call compose_world --json '{"base":"city","seed":91,"ref":"sk_chatgpt_field","title":"ChatGPT field test","overrides":{"context":{"depth":2},"region":{"x":0,"y":0,"w":16,"d":16}}}'
```

Use `help compose_world` to inspect the schema; do not invoke `pack_world` directly.
A clean start writes nothing to stderr. Preserve any warning or error for diagnosis.

Pass a nondefault `--version` on each invocation. Put runner options before `--`;
Mojulo arguments follow it. The wrapper sets `MOJULO_HOST=chatgpt`,
`MOJULO_SURFACE=box`, and all standard data paths below `.mojulo-chatgpt/home` on
every call, overriding inherited storage paths. It does not use `~/.mojulo`.
Mojulo CLI output, exit codes and stdin pass through. Larger inputs can use:

```sh
node "$runner" exec --workspace "$workspace" -- call create_sketch --json @args.json
```

For long operations, set `--timeout-ms` before `--`. A timeout reports failure;
check the existing ref before retrying a write. The process may have already stored it.

## Checkpoint an export

After `export_model` writes `recipe.json`, preserve it with the exact runtime version
and the existing recipe ref/title:

```sh
node "$runner" checkpoint --workspace "$workspace" \
  --recipe "$recipe" --ref "$ref" --title "$title" --out "$capsule"
```

The new capsule contains the manifest, its SHA-256, the Mojulo version, source
provenance, and `restore` arguments. It refuses to overwrite an existing file; choose
a new checkpoint filename for a later revision. Deliver it alongside the requested
model or bundle through the session's actual file tools. Keep the original tarball
for an unreleased build; the capsule contains its hash, not its bytes.

## Resume in a fresh box

Read the capsule's `mojulo.version` and `mojulo.source`. Install that version (or the
original tarball) into a fresh workspace, then:

```sh
node "$runner" restore --workspace "$fresh_workspace" --version "$saved_version" \
  --capsule "$capsule"
```

Restore verifies the version, manifest hash and development-tarball hash, then passes
only `title`, `ref` and `manifest` to Mojulo's existing `create_sketch` tool. Mojulo
validates the manifest and refuses a duplicate ref; this never replaces a stored
recipe. If the ref already exists, inspect it with the available Mojulo read tools
before deciding whether it is the same artifact or a conflict.

The hashes prove the capsule is self-consistent, not who made it. Validating a recipe
that carries a JavaScript `program` (a `workbench` recipe from the code door) runs that
program, so restore itself runs it. Before restoring a capsule or recipe received from
elsewhere, read `capsule.restore.manifest.program` as code.

This is manifest recovery, not a database/asset backup. External textures, image/audio
bindings, dependent sketch refs and custom recipe-book builders are not embedded.
Preserve those separately and use the relevant kind's documented workflow if
`create_sketch` cannot restore it.

Re-export with the same arguments. Compare the restored manifest and the relevant
model bytes/geometry before calling the recovery exact. Mojulo's mint API can normalize
manifests; a successful create alone does not prove equivalence. The automated branch
smoke tests cover a self-contained world, not every recipe kind or ChatGPT delivery.
