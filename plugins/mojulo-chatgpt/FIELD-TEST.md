# ChatGPT field test

This development package tests ChatGPT as a Mojulo runner. Local recovery is verified;
ChatGPT web/mobile attachment and preview behavior still needs this live test.
The kit is not a marketplace installation or a public MCP service.

## Starting prompt

> Use the attached Mojulo development kit to create and edit a small procedural city.
> Read the bundled skill first. If a suitable Mojulo MCP connection exists, use it and
> report its version. Otherwise, if this session has a Linux Work box with shell access,
> use the bundled runner and branch tarball. Preserve a recipe checkpoint, deliver the
> HTML, GLB and ZIP through this session's actual file tools, and report which files
> I can download and which I can preview. Do not invent attachment links. If shell access
> and a suitable MCP connection are both unavailable, explain the missing capability.

## Shell-enabled Work path

Extract the kit. Read `mojulo-chatgpt/skills/mojulo/SKILL.md` and its `references/work-box.md`.
Choose actual absolute paths for the runner, tarball and writable workspace. Run status,
then install the supplied `mojulo-3.0.0.tgz`; do not substitute the registry package.
Native dependencies require npm network access and a supported Node runtime.

1. Run `orient`, `version` and `get_adapter`. Record Node, OS, Mojulo version and tarball hash.
2. Call `compose_world` with base `city`, seed `91`, ref `sk_chatgpt_field`, and title
   `ChatGPT field test`. Use overrides `{"context":{"depth":2},"region":{"x":0,"y":0,"w":16,"d":16}}`.
3. Export GLB. Edit the same ref with `update_sketch`, patch
   `[{"op":"set","path":"/seed","value":92}]`. Re-export and confirm the model changed.
4. Export `bundle`; use the returned paths, including `recipe.json`, to write a checkpoint.
5. Deliver the HTML, GLB, ZIP and checkpoint with the host's real file-transfer facilities.
   Record downloads separately from inline previews. A server path alone is not a download.
6. Open available outputs in ChatGPT web and mobile. Check visible geometry, download access,
   and whether HTML is interactive, shown as source, or downloadable only. Record failures.
7. In a fresh Work workspace, install the identical tarball and restore the checkpoint.
   Re-export and compare recipe, GLB, HTML and ZIP hashes. Confirm restoring again refuses
   the duplicate ref without changing the model. Preserve the tarball for future recovery.

For connected MCP, use its advertised tools and delivery facilities. Do not assume the
server runs this branch or that its files are accessible to the session shell. Record any
version/capability mismatch before interpreting a failed recovery test.

## Evidence to return

Record date, ChatGPT client/surface, available capabilities, runtime/version/hash,
create/edit outcome, each format's download and preview result, fresh-workspace hash
comparison, and exact errors. Do not include credentials or private server configuration.
`local-smoke-report.json` records local machine checks only; it is not live ChatGPT evidence.

A successful result closes the delivery field gate. The next implementation is a thin
MCP Apps preview integration. Public submission additionally needs a separately designed,
authenticated hosted service and the directory's current review requirements.
