# MCP Apps mesh preview — development

Enable `MOJULO_MCP_APPS=1` in the environment of the existing npm/source Mojulo MCP
server, restart it, and reconnect the host to refresh its tool list. The dedicated
`preview_world` tool appears in both flat and packed modes. It is operator-only
when role delegation is enabled, and disabled in the Claude plugin profile.
Existing authentication and local-only deployment rules still apply.

This is an MCP capability, not a Work-box HTML attachment. Installing the tarball
in a shell does not connect an MCP server or register a ChatGPT UI. Use an existing
MCP Apps-capable connection for the live test. No tunnel, public endpoint, domain,
server registration or marketplace submission is created by this package.

## Live test prompt

> Use my connected Mojulo MCP server. Confirm preview_world is available. Create
> a small city, then call preview_world with its ref. Show the inline mesh preview.
> Edit the same city's seed through update_sketch, then call preview_world again.
> Keep the same ref. I will test orbit, zoom, Reset view and Refresh. Export the
> full HTML and GLB through the usual tools too. Report any resource, bridge or CSP
> errors; do not call an exported HTML window proof that the MCP widget works.

The widget displays the existing GLB export with orbit/zoom and reset controls.
Refresh re-exports the same ref through normal tool authorization. Model-visible
results contain ref/title/revision/bytes; the mesh is in result metadata only.
Edits stay with existing Mojulo tools, followed by another preview call. This first
viewer is a static mesh snapshot, not the full world/game runtime. Animation,
walk-through controls and downloads remain in normal exports. Inline meshes are
limited to 8 MiB; larger outputs use file handoff.

## Local verification

From `control/`, create an absolute scratch directory and choose an installed Chrome:

```sh
MOJULO_APPS_SMOKE_DIR="$scratch" npx vitest run lib/mcp/apps/preview.test.js
MOJULO_CHROMIUM="$chrome" node scripts/smoke-mcp-apps.mjs --fixture-dir "$scratch"
```

The browser smoke uses an opaque sandbox, restrictive CSP, actual WebGL rendering,
bridge initialization/result delivery, same-ref refresh, and orbit/reset controls.
It is a local host simulator; it does not certify the ChatGPT client.

## Wire contract

- Resource: `ui://mojulo/mesh-preview/v1.html`, MIME `text/html;profile=mcp-app`.
- Tool descriptor: `_meta.ui.resourceUri` and visibility `model`/`app`.
- Bridge: `ui/initialize`, initialized/result/size notifications, `tools/call`.
- No remote assets, nested frames or server URLs. Three.js r184 modules are vendored
  with their MIT license, matching the existing world renderer.
- Payloads are regenerated from the stored recipe; no UI cache or separate scene store.

Official references checked September 29, 2026:
[UI resources and metadata](https://developers.openai.com/plugins/build/chatgpt-ui),
[bridge quickstart](https://developers.openai.com/plugins/build/app-quickstart).

## Development and production installation

`mojulo-dev` is a development connection to a source checkout. Production runs the
released npm package; the preview protocol does not depend on a Git checkout.
The plugin is the discovery/workflow/connection package, while npm distributes the
engine. `npx mojulo init` remains an advanced setup path, not the intended main UX.

For a shell-enabled Work session, the skill can bootstrap the pinned npm package
inside that workspace. That execution path is field-tested; automatic registration
of a Work-box process as a native MCP Apps connection is not established by it.

For a connected MCP server, a plugin can bundle its configuration or map a registered
connection. Which local launch options exist depends on the host. Do not treat the
local desktop settings flow as evidence that ChatGPT.com launches npm on a user's
computer. Public MCP submission currently documents a hosted HTTPS endpoint, with
local MCP support requiring coordination with OpenAI. npm can still supply the
package installed on that service. Hosting remains a separate scope from core.

For the local development test, run this branch with the preview opt-in before
refreshing the development connection. A server running another checkout will not
acquire this branch's tools merely because the plugin was installed.

References: [package and register a plugin](https://developers.openai.com/plugins/build/plugins),
[refresh and test an MCP connection](https://developers.openai.com/plugins/deploy/connect-chatgpt).
