# app-mcp — agent extension contract

This directory is the **MCP sidecar** for the app you (the agent) are building. It ships pre-wired with two tools — `describe_app` and `health` — and the HTTP+bearer transport in `server.js`. Your job: add app-specific tools that expose the app's internal state or actions to mojulo's connecting agent (the one that drives the control plane).

## When to add a tool here

Add a tool when:

- The app maintains state mojulo's agent should be able to inspect (recent extractions, queued items, error logs).
- The app supports an action mojulo's agent should be able to trigger from the contextmap side (clear cache, reprocess an item, export a result).
- The app exposes a computed view mojulo's deliberation surfaces (composer, capabilities) could compose against.

Don't add a tool here for things the SPA already does — UI affordances are user-facing, MCP tools are agent-facing. They serve different audiences.

## How to add a tool

1. Create a file under `tools/<your-tool>.js` exporting an object with the shape:

   ```js
   export const yourTool = {
     name: 'your_tool',
     description: 'One-paragraph description. Used by tools/list AND semantic recall — be specific about what the tool returns and when an agent should call it.',
     inputSchema: { type: 'object', properties: { /* JSON Schema */ }, required: [] },
     async handler(args) {
       // Do the work; return either a plain object (auto-serialized to text)
       // or an MCP-shaped { content: [{ type: 'text', text }] } payload.
       return { ok: true, /* ... */ };
     },
   };
   ```

2. Register it in `server.js` at the **AGENT EXTENSION POINT** marker:

   ```js
   import { yourTool } from './tools/your-tool.js';
   registerTool(yourTool);
   ```

3. Restart the app (via the runner's `stop_app` + `start_app`). The new tool will appear in the next `describe_app` response and in mojulo's declared inventory.

## Conventions

- **Read tools** should be cheap and idempotent. They're called frequently (Apps pane polling, semantic recall).
- **Write tools** should validate input strictly and return enough state for the caller to verify the action took effect (don't return `{ ok: true }` alone — return the new state).
- **Error returns** should use MCP's `isError: true` shape with a `content[0].text` explaining the failure. Throwing also works (the dispatcher converts it), but a structured return lets you carry remediation hints.
- **No vendor-specific tool names.** This sidecar represents `{{APP_NAME}}`. Tool names should be of the app's own vocabulary (e.g. `list_extractions`, not `gmail_search`).
- **No long-running tools.** If a tool would take >5 seconds, kick off the work asynchronously, store the job state inside the app, and expose a poll tool. The MCP protocol is request/response, not streaming.

## What's already wired

- `describe_app` — returns this app's identity + the live tool list. Don't override; it auto-reflects whatever you add.
- `health` — liveness ping. Don't override; the Apps pane polls it.
- `lib/envelope-client.js` — stub for calling mojulo's LLM adapter primitive from inside this sidecar. Currently throws `EnvelopePrimitiveUnavailableError`; Sub-plan A fills it in.

## Bearer / port

The runner injects `APP_MCP_BEARER` via process.env at start_app time. Don't hardcode a bearer. Don't add a second auth scheme — the bearer is the only authentication path mojulo's agent uses to call this sidecar.

The port is allocated by the runner (or by the OS if `APP_MCP_PORT=0`). `server.js` prints the resolved URL on a line starting with `APP_MCP_URL=` for the runner to parse.

## What this sidecar is NOT for

- **It's not the app's backend.** The SPA in this artifact has its own concerns (UI, user state, the actual feature). This sidecar only talks to mojulo's connecting agent.
- **It's not a place for runtime business logic.** If a tool here does "real work," that work should live in the SPA's codebase too — the tool here just exposes it. Avoid making the sidecar the only place a piece of logic exists.
- **It's not user-facing.** Bearer-only auth, loopback-only host. The end-user never reaches this server directly.

## When in doubt

If you're not sure whether something belongs as an app-mcp tool, an SPA component, or a contextmap principle:

- **Read-only thing the user wants to see?** → SPA.
- **Read-only thing mojulo's agent wants to act on?** → app-mcp tool here.
- **Structural decision about how this app was built?** → contextmap principle (committed by `meta_context_commit` at materialization time).
