/**
 * MCP Ring 7 (runtime) — app runner tools.
 *
 * The MCP face of the local runner ([control/lib/runners/local.js]). The
 * agent uses these to lifecycle materialized apps without thinking about
 * Docker, port allocation, systemd, pm2. Lifecycle verbs only.
 *
 * Ring placement: "Ring 7" by convention — runtime tools are a distinct
 * concern from Ring 6 deliberation surfaces. Sub-plan A's
 * `run_protocol_envelope` (when it lands) will sit alongside these in
 * Ring 7. The naming is informal; the registration order in
 * `ensureToolsRegistered` is what readers actually see.
 *
 * Single-runner posture in the spike: there's exactly one runner
 * (`local`), and `start_app` calls it directly. The `list_runners`
 * affordance exists for forward-compatibility with the runner contract
 * (Fly, Docker, Vercel substitutes) but isn't pluggable yet.
 *
 * See APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { LocalRunner } from '@/lib/runners/local';
import { installScaffold } from '@/lib/app-mcp-scaffold/install';

// ── handlers ─────────────────────────────────────────────────────────────

export async function installScaffoldHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('install_scaffold requires { artifact_ref, app_name, materialization_ref }');
  }
  const out = installScaffold({
    targetDir: input.artifact_ref,
    appName: input.app_name,
    materializationRef: input.materialization_ref,
    declaredPurpose: input.declared_purpose,
    overwrite: input.overwrite === true,
    wireControlPlaneKey: input.wire_control_plane_key === true,
  });
  return {
    scaffold_dir: out.scaffoldDir,
    env_path: out.envPath,
    bearer_generated: out.bearerGenerated,
    reused: out.reused === true,
    control_plane_key_wired: out.controlPlaneKeyWired === true,
    url_wired: out.urlWired === true,
    app_ref_wired: out.appRefWired === true,
    ...(out.controlPlaneKeyWireReason ? { control_plane_key_wire_reason: out.controlPlaneKeyWireReason } : {}),
    // Bearer NOT returned (same posture as start_app); read from .env if needed.
  };
}

export async function listRunnersHandler() {
  return {
    runners: [
      {
        name: LocalRunner.name,
        capabilities: LocalRunner.capabilities,
      },
    ],
  };
}

export async function startAppHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('start_app requires { artifact_ref, app_name, materialization_ref }');
  }
  const out = await LocalRunner.start({
    artifactRef: input.artifact_ref,
    appName: input.app_name,
    materializationRef: input.materialization_ref,
    declaredPurpose: input.declared_purpose,
    serverName: input.server_name,
  });
  return {
    running_ref: out.runningRef,
    url: out.url,
    mcp_url: out.mcpUrl,
    inventory_tools_registered: out.inventoryToolsRegistered,
    // Bearer is intentionally NOT returned — it's available via .env on the
    // host filesystem and via the inventory entry. Returning it here would
    // surface a secret in tool outputs that get rendered into agent transcripts.
  };
}

export async function stopAppHandler(input) {
  if (!input?.running_ref || typeof input.running_ref !== 'string') {
    throw new Error('stop_app requires { running_ref }');
  }
  return LocalRunner.stop(input.running_ref);
}

export async function statusAppHandler(input) {
  if (!input?.running_ref || typeof input.running_ref !== 'string') {
    throw new Error('status_app requires { running_ref }');
  }
  const s = await LocalRunner.status(input.running_ref);
  return {
    running_ref: s.runningRef ?? input.running_ref,
    status: s.status,
    url: s.url ?? null,
    mcp_url: s.mcpUrl ?? null,
    artifact_ref: s.artifactRef ?? null,
    started_at: s.startedAt ?? null,
  };
}

export async function listRunningHandler() {
  const running = await LocalRunner.list();
  return {
    running: running.map((r) => ({
      running_ref: r.runningRef,
      artifact_ref: r.artifactRef,
      url: r.url,
      mcp_url: r.mcpUrl,
      started_at: r.startedAt,
      status: r.status,
    })),
  };
}

export async function listEnvHandler(input) {
  if (!input?.artifact_ref || typeof input.artifact_ref !== 'string') {
    throw new Error('list_env requires { artifact_ref }');
  }
  return LocalRunner.listEnv(input.artifact_ref);
}

export async function setEnvHandler(input) {
  if (!input?.artifact_ref || typeof input.artifact_ref !== 'string') {
    throw new Error('set_env requires { artifact_ref, key, value }');
  }
  if (typeof input.key !== 'string') throw new Error('set_env requires { key } as a string');
  if (typeof input.value !== 'string') throw new Error('set_env requires { value } as a string');
  return LocalRunner.setEnv(input.artifact_ref, input.key, input.value);
}

export async function deleteEnvHandler(input) {
  if (!input?.artifact_ref || typeof input.artifact_ref !== 'string') {
    throw new Error('delete_env requires { artifact_ref, key }');
  }
  if (typeof input.key !== 'string') throw new Error('delete_env requires { key } as a string');
  return LocalRunner.deleteEnv(input.artifact_ref, input.key);
}

// ── registration ─────────────────────────────────────────────────────────

export function registerRunnerTools() {
  registerTool({
    name: 'install_scaffold',
    description:
      "**Entry point for the App paradigm** — call first when the user wants a long-running local tool that does background work and parks inference back on the agent (\"watch this folder and extract data\", \"a thing on my laptop that processes Z in the background and asks me when it needs to think\", batch / image-extraction apps). The path is `install_scaffold` → `meta_context_commit({type:'app_materialization'})` → `start_app`. Materialize the shared app-MCP scaffold into `<artifact_ref>/app-mcp/`. Substitutes `app_name`, `materialization_ref`, and `declared_purpose` into the templated describe.js; generates and writes `APP_MCP_BEARER` to the artifact's `.env` if not already present (static-per-app bearer policy). Idempotent — running on an existing scaffold returns `reused: true` and does not regenerate the bearer. Pass `overwrite: true` to repave (e.g., post-evolution). When `wire_control_plane_key: true`, the control plane writes its own MCP bearer + URL + the materialization_ref into the app's `.env` as `MOJULO_CONTROL_PLANE_KEY`/`MOJULO_CONTROL_PLANE_URL`/`MOJULO_APP_REF`; the bearer never crosses the response (only booleans confirming what was written). Call BEFORE `meta_context_commit({type:'app_materialization'})` — the commit's verification check requires `<locator>/app-mcp/server.js` to exist.",
    inputSchema: {
      type: 'object',
      properties: {
        artifact_ref: { type: 'string', description: "Absolute path to the app's artifact directory (must already exist)." },
        app_name: { type: 'string', description: "Stable human-readable identifier. Baked into describe.js." },
        materialization_ref: { type: 'string', description: "Opaque ref pointing back to the materialization commit. Typically the composite artifact ref `<adapter_id>:<locator>`." },
        declared_purpose: { type: 'string', description: "Optional one-line purpose. Baked into describe.js." },
        overwrite: { type: 'boolean', description: "When true, repaves the scaffold directory even if it already exists. Bearer is still reused from .env." },
        wire_control_plane_key: { type: 'boolean', description: "When true, writes MOJULO_CONTROL_PLANE_URL / MOJULO_CONTROL_PLANE_KEY / MOJULO_APP_REF to the app's .env from the control plane's process env (CONTROL_PLANE_MCP_KEY). The bearer is never returned in the response. Idempotent — existing values are left intact. Default false." },
      },
      required: ['artifact_ref', 'app_name', 'materialization_ref'],
    },
    handler: installScaffoldHandler,
  });

  registerTool({
    name: 'list_runners',
    description:
      "List the runner implementations available to the control plane. In the spike, returns the single `local` runner. The contract is forward-compatible with cloud runners (Fly, Vercel, Docker) but pluggability lands post-spike.",
    inputSchema: { type: 'object', properties: {} },
    handler: listRunnersHandler,
  });

  registerTool({
    name: 'start_app',
    description:
      "Bring up a materialized app's SPA + MCP sidecar atomically. Both processes come up or neither — if either fails to print its URL within the startup timeout, the other is killed and the call throws. On success, the app's MCP is auto-declared into the operator's inventory under `server_kind = 'app'` so its tools appear alongside vendor MCPs in `meta_context_brief({kind:'fleet'}).inventory`. Returns `{ running_ref, url, mcp_url, inventory_tools_registered }`. The bearer is intentionally NOT returned in the response — it persists in the artifact's `.env` (`APP_MCP_BEARER`); read it from there if needed.",
    inputSchema: {
      type: 'object',
      properties: {
        artifact_ref: {
          type: 'string',
          description: "Absolute path to the app's artifact directory. Must contain a working `npm start` and the scaffolded `app-mcp/` subdirectory.",
        },
        app_name: {
          type: 'string',
          description: "Stable human-readable identifier for the app — baked into the sidecar's describe.js at scaffold time and used as the default inventory `server` name.",
        },
        materialization_ref: {
          type: 'string',
          description: "Opaque ref pointing back to the app's `app_materialization` commit (typically the composite artifact ref `<adapter_id>:<locator>`). Baked into the sidecar's describe.js for round-tripping to the contextmap.",
        },
        declared_purpose: {
          type: 'string',
          description: "Optional one-line purpose, baked into describe.js.",
        },
        server_name: {
          type: 'string',
          description: "Optional override for the inventory `server` name. Defaults to `app_name` when omitted.",
        },
      },
      required: ['artifact_ref', 'app_name', 'materialization_ref'],
    },
    handler: startAppHandler,
  });

  registerTool({
    name: 'stop_app',
    description:
      "Stop both the app and its MCP sidecar (SIGTERM, SIGKILL fallback after a short grace period), remove the app's inventory entries by `running_ref`, drop the in-memory runner state. Idempotent — calling on an unknown `running_ref` returns `{ stopped: false, reason: 'unknown_running_ref' }`.",
    inputSchema: {
      type: 'object',
      properties: {
        running_ref: { type: 'string', description: "The `running_ref` returned by `start_app`." },
      },
      required: ['running_ref'],
    },
    handler: stopAppHandler,
  });

  registerTool({
    name: 'status_app',
    description:
      "Read the runner's current view of one app's state. Returns `{ running_ref, status: 'running' | 'crashed' | 'unknown', url, mcp_url, artifact_ref, started_at }`. `unknown` means the runner has no record of this ref (either never started or the runtime daemon is down).",
    inputSchema: {
      type: 'object',
      properties: {
        running_ref: { type: 'string' },
      },
      required: ['running_ref'],
    },
    handler: statusAppHandler,
  });

  registerTool({
    name: 'list_running',
    description:
      "List every app the runner currently tracks. Returns `{ running: [{ running_ref, artifact_ref, url, mcp_url, started_at, status }] }`. When the runtime daemon is down, this degrades to an empty list.",
    inputSchema: { type: 'object', properties: {} },
    handler: listRunningHandler,
  });

  registerTool({
    name: 'list_env',
    description:
      "Return the env-var keys defined in the artifact's `.env` file. Values are intentionally NOT returned — the control plane mediates env-var reading via the runner, but the values themselves never enter the response (preserves the 'env values never enter the control plane' invariant from the parent App paradigm plan). Use `set_env`/`delete_env` to mutate.",
    inputSchema: {
      type: 'object',
      properties: {
        artifact_ref: { type: 'string', description: "Absolute path to the app's artifact directory." },
      },
      required: ['artifact_ref'],
    },
    handler: listEnvHandler,
  });

  registerTool({
    name: 'set_env',
    description:
      "Add or update a key in the artifact's `.env` file. Comments and blank lines in the file are preserved across writes. Key must match `[A-Za-z_][A-Za-z0-9_]*`. Value passes through verbatim — operator is responsible for quoting if needed.",
    inputSchema: {
      type: 'object',
      properties: {
        artifact_ref: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['artifact_ref', 'key', 'value'],
    },
    handler: setEnvHandler,
  });

  registerTool({
    name: 'delete_env',
    description:
      "Remove a key from the artifact's `.env` file. Returns `{ deleted: true }` if the key was present, `{ deleted: false }` if it wasn't (no-op). Comments and other keys are preserved.",
    inputSchema: {
      type: 'object',
      properties: {
        artifact_ref: { type: 'string' },
        key: { type: 'string' },
      },
      required: ['artifact_ref', 'key'],
    },
    handler: deleteEnvHandler,
  });
}
