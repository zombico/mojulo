### The Claude plugin for 3.2: Claude Code installs mojulo, and a skill for each way in

The 3.1 plugin was held by the plugin directory and never published; the plugin returns with 3.2, shaped to what the
directory reads.

- **Claude Code installs the server.** The plugin's root carries `package.json` and `package-lock.json` (one exact
  dependency, `mojulo`, every package hashed and from registry.npmjs.org). Claude Code installs them itself when the
  plugin is added or updated, into its own copy of the plugin, and the plugin runs
  `node ${CLAUDE_PLUGIN_ROOT}/node_modules/mojulo/scripts/mcp-stdio.mjs`. The 3.1 launcher (`server/launch.mjs`, an
  `npm ci` of ours at first start) is gone, so the plugin runs no installer of its own, needs no npm at start, and the
  first session starts at once. Claude Code installs with scripts off; no package mojulo needs has an install script
  (better-sqlite3 and sharp arrive prebuilt), and the lockfile is refused when one does.
- **The plugin declares the host it reaches** (`network.hosts`: registry.npmjs.org, for `check_for_updates` and the
  dashboard) and passes `claude plugin validate --strict` with nothing to report.
- **A skill for each way in.** `make-character`, `design-game`, `design-object`, `make-exhibit` (the four starts the
  `initialize` preamble offers) and `design-building`, `design-interior` (the building rails), each loaded on the
  person's own words and carrying its start's steps, the routing cards it goes to and the entry tool to load (Claude
  Code defers MCP tool schemas). They are generated from the routing cards (`scripts/plugin-skills.mjs`, written by
  `node scripts/plugin-agents.mjs` with the subagents), so a skill and the server's routing say the same thing; the
  main `mojulo` skill names them.
- **The checks follow.** `plugin-lock.mjs` writes the plugin's root package; `check-plugin-version.mjs` holds the
  server command, the one exact dependency, the lockfile (version 2 or 3, no install scripts, no overrides) and the
  directory's limits (under 512 files, each under 256 KiB).
- plugin.json is 3.2.0, the release the plugin ships with; at the release `plugin-lock.mjs` locks mojulo 3.2.0.
