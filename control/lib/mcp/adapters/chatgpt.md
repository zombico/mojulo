---
{
  "id": "chatgpt",
  "name": "ChatGPT",
  "summary": "Runs Mojulo through connected MCP or a shell-enabled Work box; keeps server files distinct from session files and preserves recipes for resumption. Preview, file delivery, image generation and scheduling depend on the current session.",
  "version": 1,
  "artifactTarget": "A portable recipe with Mojulo version and a workflow in the current session\u2019s supported workspace or file delivery surface",
  "schedulingMechanism": "Only a scheduler explicitly available in this session",
  "secretsPosture": "Use list_env for key names; never read .env or embed tokens in recipes or workflow files",
  "supportsClientInfoHint": [
    "chatgpt"
  ]
}
---

# ChatGPT adapter

ChatGPT is a distinct host from Codex. The user has run Mojulo through connected MCP
and inside a temporary Linux Work box. Delivery details below remain conservative
until field-tested in the specific ChatGPT session; there is no universal box path,
attachment limit, browser binary, scheduler, or persistent skill directory assumed.

## Choose the available execution path

1. If Mojulo MCP tools are connected, use them. Start with `forward_context` and
   `get_adapter` with `id: 'chatgpt'`; open only the relevant pack or vocabulary.
   Keep recipes on that server and iterate on the same ref. A connected server's
   filesystem is not the Work box filesystem, even if both tools are available.
2. Otherwise, if this session exposes a shell-enabled Work box, inspect Node
   (`node --version`, requires >=22.14), npm and the writable workspace. Reuse an
   installed, suitable Mojulo version or install an explicitly pinned version in
   that workspace. During unreleased development use the supplied branch tarball;
   do not assume a branch's version is already available from npm. Do not run
   `mojulo init`, start the dashboard, or create a second server to use the CLI.
3. If neither is available, describe the missing connection/runtime. Do not claim
   that asking for Work mode guarantees a box or that this skill creates one.

## Shell orientation

Set `MOJULO_HOST=chatgpt` and `MOJULO_SURFACE=box` on each invocation, or in an
execution environment known to persist across shell calls. With the pinned package
installed in the workspace, use `npx --no-install mojulo orient`, then
`npx --no-install mojulo call version` and `npx --no-install mojulo call get_adapter`.
Use `help <tool>` for schemas and `call <tool> --json @args.json` for larger inputs.
Each invocation is a fresh process. Orient once per fresh working context.

`MOJULO_SURFACE=local` describes the connected operator-side MCP installation;
`box` describes Mojulo running inside this session. On a shared MCP endpoint use
explicit adapter selection rather than changing process-wide host variables for
one client. The adapter card does not set the server's export context.

## Make, inspect, iterate, deliver

Mint once, then use `update_sketch` / `edit_solid` on that ref. Probe for an installed
browser before rendering and set `MOJULO_CHROMIUM` only to a verified binary. Report
whether an actual render was inspected; an export succeeding is not visual approval.
Use the self-contained HTML for offline inspection. Do not assume an exported HTML
file automatically renders inline in ChatGPT; MCP Apps resources are separate work.

In a Work box, deliver the exported file through the attachment/download mechanism
actually present in the session. Copy only to its documented delivery directory
when one exists. Use its returned link; do not turn an arbitrary path into a guessed
sandbox URL. Prefer the direct zip/model/recipe where supported; Muse's HTML-only
Library workaround is not a ChatGPT requirement. If no delivery tool exists, state
that the export is on disk and delivery remains incomplete.

Through MCP, a returned path or relative /outcomes URL belongs to the server.
Transfer the bytes through an available authorized file mechanism, or use a genuinely
reachable download URL supplied by that deployment. Never substitute a Work-box
path for server bytes, expose the server, or publish a file just to complete a handoff.
An unknown surface must remain explicit rather than selecting a guessed file door.

## Preserve and resume

For temporary boxes, hand back the recipe as well as the requested output. Record the
exact Mojulo version returned by `version`, the recipe/ref and any external assets
needed to reproduce it. A surviving conversation does not prove its box survived.
In a fresh box install the recorded version and rehydrate from the recipe using the
relevant tool's documented schema; do not assume every recipe has one import command.
On persistent MCP first retrieve the existing recipe and edit it in place.

## Native capabilities and workflows

Check which image, file, preview and scheduling tools this session actually exposes.
Do not inherit Codex automation_update or Muse cron instructions. Native image output
can be bound only if the image tool, Mojulo binding tools and byte transfer are all
available. A reference/render is derived; the recipe stays authoritative.
For reusable workflows, save instructions and provenance in an explicitly available
workspace or downloadable file; do not invent a global skill installation directory.
For recurring external actions, demonstrate a read-only dry run before the configured
live run. Use list_env/set_env for secrets; never read .env or embed bearer tokens.

## Connected MCP Apps preview

If `preview_world` is advertised, call it with the stored ref after creation or an
edit to show an inline mesh snapshot. Its Refresh action reads that same ref; recipe
edits remain the existing Mojulo tools. Full world/game controls stay in HTML exports.
This requires an MCP Apps-capable connection and server opt-in, not just a shell or
an HTML window. When the tool is absent, continue with normal file delivery.
