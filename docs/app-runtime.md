# App-runtime daemon

The app-runtime daemon promotes the in-process `LocalRunner` to a standalone
process so **app lifecycle survives a control-plane restart**. It's *substrate*,
not a primitive — invisible background machinery sitting alongside the trigger
scheduler, with the existing `start_app` / `stop_app` MCP tools becoming thin
RPC clients over its loopback HTTP API. Operators don't compose with it; they
materialize an App and the runtime just *is there*.

> Implements `lite-template/integration/app-system/0527/app-runtime-daemon.md`,
> Phase 1 (substrate + reconcile). Phase 2 (OS-level supervision) is the
> launchd / systemd recipes at the end of this doc.

## Why it exists

Before the daemon, the runner's `running` Map lived in module-scoped memory
inside the Next.js process. Every control-plane restart wiped it, but the
`meta_mcp_inventory` rows it wrote (with `server_kind='app'` and a now-forgotten
`running_ref`) survived in SQLite. The next `start_app` minted a fresh
`running_ref`, its replace-by-`running_ref` cleanup was a no-op against the
orphan rows, and the insert collided under `UNIQUE(server, tool_name)`:

```
UNIQUE constraint failed: meta_mcp_inventory.server, meta_mcp_inventory.tool_name
```

This was the documented "Restart loses tracking (deliberate v0 scope)" failure
mode. The daemon fixes it with **reconcile-on-boot**.

## Architecture

```
  control plane (Next.js, :3001)          app-runtime daemon (Node)
  ┌───────────────────────────┐           ┌────────────────────────────┐
  │ MCP tool start_app        │           │ in-memory running Map      │
  │   └─ LocalRunner (client) ─┼──HTTP────▶│   spawns app + sidecar pair│
  │      127.0.0.1:<port>     │  Bearer   │   (one per running_ref)    │
  │      Bearer <token>       │           │                            │
  │                           │           │ writes inventory rows ─────┼─▶ mojulo-lite.db
  │ Apps pane / loader ───────┼──reads───▶│ writes pidfiles ───────────┼─▶ ~/.mojulo/app-runtime/runs/
  └───────────────────────────┘  pidfiles └────────────────────────────┘
```

Three parties, one source of truth (the DB rows + pidfiles). The daemon owns the
in-memory Map but writes through to SQLite + pidfiles immediately so a restart
can reconcile.

## Lifecycle

The daemon is its **own bin** — the control plane never spawns it. You can run
it standalone or via the unified daemon host (recommended) that also starts
the scheduler:

```bash
MOJULO_DAEMONS=enabled npx -y -p mojulo mojulo-daemons
# or, from source:
MOJULO_DAEMONS=enabled node control/bin/daemons.mjs

# standalone app-runtime only:
MOJULO_APP_RUNTIME=enabled npx -y -p mojulo mojulo-app-runtime
# or, from source:
MOJULO_APP_RUNTIME=enabled node control/bin/app-runtime.mjs
```

Gating is **opt-in**. `mojulo-daemons` requires `MOJULO_DAEMONS=enabled` and
honors per-daemon overrides (`MOJULO_APP_RUNTIME=disabled` to skip app runtime,
`MOJULO_TRIGGER_RUNTIME=disabled` to skip the scheduler). When the per-daemon
gates are unset, the host starts both. The standalone `mojulo-app-runtime` bin
is still gated by `MOJULO_APP_RUNTIME=enabled`.

On boot the daemon: mints/reads its bearer, runs reconcile, binds the HTTP
server on 127.0.0.1, and writes the chosen port to its port file. On `SIGTERM` /
`SIGINT` it closes the HTTP server and exits **without killing the running
apps** — they survive as reparented processes and get re-adopted by reconcile on
the next boot. That's the whole point of the promotion.

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `MOJULO_DAEMONS` | _(unset)_ | When `enabled`, starts the unified daemon host (`mojulo-daemons`). |
| `MOJULO_APP_RUNTIME` | _(unset)_ | Must be `enabled` for the standalone bin to start. When using `mojulo-daemons`, set to `disabled` to skip app runtime. |
| `MOJULO_TRIGGER_RUNTIME` | _(unset)_ | Scheduler gate. When using `mojulo-daemons`, set to `disabled` to skip scheduling. |
| `MOJULO_APP_RUNTIME_PORT` | `0` | Listen port. `0` = OS picks a free port (advertised via the port file). |
| `MOJULO_APP_ROOT` | _(unset)_ | If set, `start` rejects any `artifact_ref` outside this directory. |
| `MOJULO_HOME` | `~/.mojulo` | Root for state. Determines the DB path and the app-runtime dir. |
| `MOJULO_APP_RUNTIME_ALLOW_RESET` | _(unset)_ | `1` enables the test-only `POST /reset` endpoint. |

The daemon resolves `MOJULO_HOME` / `SQLITE_PATH` the same way every other bin
does (`scripts/mojulo-paths.mjs`), so by default it shares `~/.mojulo` with the
stdio MCP server and the dashboard. **Dev caveat:** `npm run dev` resolves the
DB to `control/data/mojulo-lite.db` (cwd-relative), while the daemon defaults to
`~/.mojulo/data/mojulo-lite.db`. To share one DB in dev, launch the daemon with
the same `SQLITE_PATH` (or `MOJULO_HOME`) the control plane uses. Pidfiles are
unaffected — both default to `~/.mojulo/app-runtime`.

## State layout

```
~/.mojulo/app-runtime/
  port                      # the daemon's chosen 127.0.0.1 port (text)
  bearer                    # shared secret, 0600, minted on first boot
  runs/<running_ref>.json   # one pidfile per running app
```

A pidfile records `{ runningRef, appPid, sidecarPid, url, sidecarUrl, bearer,
artifactRef, appName, serverName, materializationRef, startedAt }`. It is the
daemon's only durable handle on a process it spawned in a previous life: the Map
dies with the daemon, the pidfile survives. The Apps pane loader reads pidfiles
**synchronously** (never the bearer field) so the pane renders whether or not
the daemon is up.

## HTTP API

All endpoints require `Authorization: Bearer <token>` and bind to 127.0.0.1
only. JSON in / JSON out.

| Method | Path | Body / Result |
|---|---|---|
| `GET` | `/health` | → `{ ok: true }` |
| `GET` | `/list` | → `{ running: [...] }` |
| `GET` | `/status/:ref` | → `{ runningRef, status, url, mcpUrl, … }` |
| `POST` | `/start` | `{ artifactRef, appName, materializationRef, … }` → `{ runningRef, url, mcpUrl, … }` |
| `POST` | `/stop` | `{ runningRef }` → `{ stopped, reason? }` |
| `POST` | `/reset` | test-only, gated by `MOJULO_APP_RUNTIME_ALLOW_RESET=1` |

### Client behavior when the daemon is down

The `LocalRunner` client (`control/lib/runners/local.js`) degrades reads and
fails writes loudly:

- **Reads** (`status` / `list`) → `'unknown'` / `[]`. No daemon means nothing is
  tracked.
- **Writes** (`start` / `stop`) → throw `AppRuntimeUnavailableError` pointing at
  this doc. The control plane never auto-spawns the daemon (that would recreate
  the "control-plane lifecycle leaks into app lifecycle" problem).

**Env CRUD stays local.** `list_env` / `set_env` / `delete_env` operate directly
on the artifact's `.env` in the control-plane process and are **not** proxied to
the daemon — env mutation is pure filesystem work with no shared runtime state,
so routing it through the daemon would needlessly make `set_env` fail when the
daemon is down. (Deliberate deviation from the daemon plan's literal file list.)

## Reconcile protocol

Run once at boot, before the HTTP server accepts `start_app`:

1. **Per pidfile** — if both pids are alive (`kill(pid, 0)`) **and** the sidecar
   answers a bearer-authenticated `tools/list` → **adopt** (re-register in the
   engine, pid-tracked). Otherwise → **sweep** (drop the inventory rows + the
   pidfile).
2. **Per inventory `running_ref` with no pidfile** → **sweep** the inventory
   rows. These are the classic orphans the daemon exists to kill.

After reconcile the Map and the DB are in sync, and the next `start_app` inserts
cleanly.

**Adoption limits (Unix semantics).** Adopted processes are not the daemon's
children, so it can signal them (`stop` works via `kill`) but cannot receive
`exit` events. Their status is last-known until the next reconcile re-probes the
sidecar. Adoption is "track for future kill", not "re-supervise".

## Security posture

Single-operator, self-hosted — same posture as the control plane itself.

- Binds **127.0.0.1 only**, never `0.0.0.0`.
- **Bearer auth on every request**; the bearer file is `0600`.
- `/start` spawns `npm start` in a caller-supplied directory — effectively RCE
  if exposed. Loopback + bearer are the primary guards; set `MOJULO_APP_ROOT` to
  additionally reject artifact paths outside a known root.
- Bearer rotation: `rm ~/.mojulo/app-runtime/bearer && restart-daemon`. No
  in-band rotation API.

## Phase 2 — OS-level supervision (deferred)

The daemon staying up under *app* crashes is the default (Node child exits fire
`exit` events, plus a top-level `uncaughtException` guard that logs but doesn't
exit). The daemon *itself* crashing is the harder case — without an external
supervisor it's just a process that can die. Hand it to the operator's OS.

### macOS — launchd

`~/Library/LaunchAgents/com.mojulo.app-runtime.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.mojulo.app-runtime</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/npx</string>
    <string>-y</string><string>-p</string><string>mojulo</string>
    <string>mojulo-app-runtime</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>MOJULO_APP_RUNTIME</key><string>enabled</string></dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.mojulo.app-runtime.plist
```

### Linux — systemd user unit

`~/.config/systemd/user/mojulo-app-runtime.service`:

```ini
[Unit]
Description=mojulo app-runtime daemon

[Service]
Environment=MOJULO_APP_RUNTIME=enabled
ExecStart=/usr/bin/npx -y -p mojulo mojulo-app-runtime
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now mojulo-app-runtime
```

## Relationship to the trigger scheduler

**Separate services, optionally hosted together.** App runtime and trigger
scheduling remain distinct daemons with their own gates
(`MOJULO_APP_RUNTIME` vs `MOJULO_TRIGGER_RUNTIME`) and crash domains, but
`mojulo-daemons` can host both in one process for a single lifecycle surface.
They still rendezvous at the agent-tasks queue
(`control/lib/mcp/agent-tasks/queue.js`); neither daemon needs to know the other
exists. The control plane retains an in-process scheduler fallback when
`MOJULO_DAEMONS` is not enabled.
