# mojulo-ui

The mojulo dashboard: the prebuilt local web UI over the same `~/.mojulo/` state that the
[mojulo](https://www.npmjs.com/package/mojulo) MCP server drives. You look at worlds, objects,
scenes, games, stashes and apps here; you drive mojulo from your agent.

```bash
npx -y mojulo-ui               # port 3001 (or the next free one), opens the browser
npx -y mojulo-ui --port 3999   # pin the port
npx -y mojulo-ui --no-open     # skip the browser
```

`npx -y -p mojulo mojulo-ui` still works: mojulo's own `mojulo-ui` command starts this package
when it is installed beside mojulo at the same version, and otherwise downloads it first with
`npm exec --yes --package=mojulo-ui@<that version>`, saying so on stderr before it does.
`MOJULO_UI_NO_FETCH=1` makes it refuse the download.

## What it is and what it does

- It depends on `mojulo` at exactly its own version. The dashboard carries a compiled copy of
  mojulo's code, and both open the same SQLite database, so they must match. Use the same version
  your agent runs (`npx -y mojulo-ui@<version>`).
- It binds to 127.0.0.1 only (`MOJULO_UI_HOST` overrides it) and refuses requests addressed to a
  foreign Host. To reach it by another name, such as a reverse proxy's or tunnel's hostname, or a
  LAN address while bound to `0.0.0.0`, list that name in `MOJULO_UI_ALLOWED_HOSTS`
  (comma-separated). That list is never bound, and a write whose Origin is one of its names passes
  even when the proxy rewrites Host to 127.0.0.1.
- It reads and writes the same places as the MCP server: `$MOJULO_HOME` (default `~/.mojulo`).
- It opens your default browser on start unless you pass `--no-open`.

It was split out of the `mojulo` package in 3.0.0, so an agent's `npx mojulo` start no longer
downloads the Next.js build. Source: [control/ui-package](https://github.com/zombico/mojulo/tree/main/control/ui-package).
The bot pages (the wizard, the chat builder, deployments) left in 3.0.0 with the chatbot factory,
which is moving to its own project; until that ships it stays on the 2.x line (`npx -y mojulo@2`).
License: Apache-2.0.
