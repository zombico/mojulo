# `mojulo init` — one-shot installer

Status: **all three host writers implemented** ([mcp-init.mjs](./mcp-init.mjs) +
the `init` argv branch in [mcp-stdio.mjs](./mcp-stdio.mjs)). Claude Code (CLI
shell-out), Codex (`config.toml` append-if-absent), and Claude Desktop
(`claude_desktop_config.json` JSON patch) all wire real; the provider-key step
and dashboard launch are real. Remaining: an `update` path for stale entries and
inline-table detection for Codex (see Remaining work).

## Why

`npx mojulo init` is the headline command in the README quickstart, but until now
the `mojulo` bin ([mcp-stdio.mjs](./mcp-stdio.mjs)) ignored argv and booted a
stdio server waiting on stdin — so `npx mojulo init` **hung**. This closes that
gap and makes the first-run path match the README.

The deeper motive (see the visualization-layer strategy thread): the friction
that matters is *ordering*, not install weight. mojulo's strongest hook —
`forward_context` + a rendered world — needs **no LLM key**, but the old
onboarding put a key step before any payoff. `init` + the reordered quickstart
move the keyless wow to first-connect, with the key deferred to "when you build
something that reasons."

## Goal / non-goals

- **Goal:** one command, from a cold machine with an MCP host installed, to
  "mojulo is wired into my agent and I'm looking at the dashboard." No
  hand-editing of JSON/TOML.
- **Non-goals:** no LLM key *required* (offered, skippable); no bot build; no
  network calls beyond the implicit `npx` fetch.

## Surface

Keep `npx mojulo init` — no new bin. The `mojulo` bin branches on
`process.argv[2] === 'init'` and delegates to `mcp-init.mjs`, which is
self-contained (its own loader register + `resolveMojuloPaths` + chdir, like
[mcp-config.mjs](./mcp-config.mjs)) and exits itself.

## Flow

1. Banner + one-line "what this does."
2. Detect MCP hosts. Print what was found.
3. Per detected host: prompt `Wire mojulo into <host>? [Y/n]` → write/patch that
   host's config (idempotent). If none detected: print the manual block, exit 0.
4. Provider key (optional): `Set an LLM provider key now? [y/N]` → on yes,
   prompt provider + value → reuse the `ApiKeyRepository` + `encryptApiKey`
   path. On no, remind it's settable later.
5. Dashboard: `Open the dashboard now? [Y/n]` → spawn `mcp-ui.mjs` detached.
6. Final message = the **keyless first-look** instruction (not "done").

`--yes` takes all defaults (wire every detected host, skip key, open UI) for
non-interactive/CI.

## Host detection & config writes

| Host | Detect | Write |
|---|---|---|
| **Claude Code** | `claude` on PATH (`claude --version`) | Shell out — don't hand-edit. `claude mcp list` to check for an existing `mojulo`; if absent, `claude mcp add mojulo --command "npx -y mojulo"`. Let the CLI own the file format. **(implemented)** |
| **Codex CLI** | `~/.codex/config.toml` exists, or `codex` on PATH | **Append-if-absent** the `[mcp_servers.mojulo]` table header — deliberately dep-free and round-trip-safe: existing servers/comments/formatting are never rewritten. Detection matches the standard table-header form; hand-written inline-table variants aren't detected. Backup + atomic write. **(implemented)** |
| **Claude Desktop** | config dir exists — macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`, Linux `~/.config/Claude/` | Read/patch `claude_desktop_config.json`: set `mcpServers.mojulo = { command: "npx", args: ["-y", "mojulo"] }` (stdio command form, **not** the HTTP `url` form). JSON round-trips losslessly; pretty-print at 2 spaces, preserve other keys, backup + atomic write, note the restart requirement. Invalid-JSON → falls back to the manual snippet. **(implemented)** |

## Idempotency & safety (load-bearing — runs on machines with existing configs)

- **Detect-before-write.** If `mojulo` is already registered for a host, say so
  and offer *update* vs *skip*. Never silently duplicate.
- **Back up** any JSON/TOML touched to `<file>.mojulo-bak-<n>` before writing.
- **Atomic writes** (temp file + rename) so a mid-write crash can't corrupt a
  host config.
- **Never touch `.env` secrets** — the key step goes through
  `ApiKeyRepository`/`encryptApiKey` (AES-256-GCM), never a plaintext file.
- On any host-write failure, fall back to printing the exact manual command for
  that host and keep going — one bad host never aborts init.

## Flags

`--yes` (all defaults, non-interactive) · `--no-ui` (skip dashboard) ·
`--host claude-code|codex|desktop` (target one host) · `--print` (dry-run: show
what *would* be written, change nothing) · `-h/--help`.

## Final message (the payoff — keyless wow, not "done")

```
✓ mojulo wired.  State: ~/.mojulo/

Try this in your agent right now — no provider key needed:

    what is this?              →  mojulo orients itself
    generate a 3D city         →  opens a rendered scene
    make a walkable world      →  a world you can drive

    Dashboard: http://localhost:3001   ·   add a key later: mojulo-config set anthropic sk-...
```

## Test checklist

- [x] Codex `config.toml` with a pre-existing `[mcp_servers.foo]` → mojulo added,
      `foo` intact; one backup; re-run detects + skips (no dup, no 2nd backup).
      *(verified via temp-HOME smoke test, real write + idempotent re-run)*
- [x] Desktop config with other `mcpServers` → mojulo merged, `other` intact.
      *(verified via temp-HOME `--print`)*
- [x] `--print` writes nothing (both writers). *(verified)*
- [x] `--yes` non-interactive path completes with no prompts. *(verified)*
- [ ] Cold machine, only Claude Code → wires via CLI, no dup on re-run.
      *(needs a machine with `claude` but without an existing mojulo entry)*
- [ ] No host detected → prints manual block, exits 0 (not an error).
- [ ] Desktop invalid-JSON → manual-snippet fallback, no write.

## Remaining work

1. `update` path when a host already has a *stale* `mojulo` entry (today: detect
   + skip; offer rewrite-to-current-form).
2. Codex inline-table detection (`mcp_servers = { mojulo = … }`) — today only the
   `[mcp_servers.mojulo]` table-header form is detected.
3. Wider automated coverage: fold the temp-HOME smoke tests into a vitest that
   drives the writers against fixture configs (currently manual).
