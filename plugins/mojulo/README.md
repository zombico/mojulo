# Mojulo

**Mojulo is a 3D compiler for Claude.** Describe an object, a walkable world or a small game, and
Claude builds it through mojulo's tools as a deterministic recipe: a few hundred bytes of JSON, or
an OpenSCAD program, that compiles back to the same geometry every time. You edit and diff the
recipe like code; every render is derived from it. From the recipe mojulo exports print-ready STL
and 3MF at true scale, glTF, OpenUSD, a self-contained HTML page you can walk offline, and Godot,
Blender, Unity and Unreal packs. Everything stays on your machine under `~/.mojulo/`.

**Runs on the Claude you already use.** Mojulo holds the recipes and does the geometry; the
thinking is Claude's, in your session. It needs no account, no API key and no GPU. Nothing is sent
to the maintainer or to any analytics service; mojulo's only log is a local record of its own tool
calls, which you can turn off.

This plugin starts the open-source mojulo MCP server (`npx -y mojulo@3.0.0`) and adds one skill
that tells Claude to start from mojulo's routing index. Nothing in this folder runs code of its
own: no hooks, no scripts. The server is the npm package built from
[github.com/zombico/mojulo](https://github.com/zombico/mojulo). It works in Claude Code and in
Cowork sessions on your computer, and needs Node.js 22.14 or newer.

The plugin build of mojulo leaves out the handoff tools for AI image, voice and mesh generators.

## Install

From the plugin directory: in the Claude app, open **Customize > Plugins**, find Mojulo and add
it. Claude Code sessions signed in with the same claude.ai account (Claude Code 2.1.273 or later)
load it as `mojulo@synced`.

From this repository, in Claude Code:

```
/plugin marketplace add zombico/mojulo
/plugin install mojulo@mojulo
```

If both are installed, Claude Code loads the marketplace copy and skips the synced one, so there is
only ever one mojulo server. Start a new session and ask "what is mojulo?".

If you already set mojulo up with `mojulo init` or `claude mcp add`, remove that registration so
you do not run two servers with every tool twice:

```
claude mcp remove mojulo -s user
```

## Where it runs

- **Claude Code**, in the terminal, the desktop app or an IDE.
- **Cowork sessions that run on your computer.** The server is a local process, so it starts
  wherever Claude runs on your machine.
- **Not in a plain claude.ai chat.** Chat does not start local MCP servers; the skill says so and
  installs nothing.

## Requirements

- **Node.js 22.14 or newer**, with `npx` on the `PATH` Claude sees.
- **About 370 MB of disk**: about 227 MB installed (the package, 21.3 MB unpacked, and its
  dependencies) and about 140 MB of npm cache. The first start downloads about 79 MB, the 6.7 MB
  package included. Measured for 3.0.0 on an Apple M1 Max with an empty cache, through a local
  stand-in for the npm registry (the real registry is slower), that first start answered in a median
  4.5 seconds, nearly all of it npm's install; later starts reuse the cache.
- **For renders** (motion, proving a game level can be finished, a PNG still): a Chrome, Chromium,
  Microsoft Edge or Brave you already have, or `MOJULO_CHROMIUM` naming one. **For MP4**: an ffmpeg
  you already have, or `MOJULO_FFMPEG`. The plugin never downloads either; without one, the tool
  that needs it says so and the rest of mojulo works.
- No account, no API key, no GPU. Game engines, Blender and slicers are optional, and mojulo never
  installs them.

## Try it

Each of these works on a fresh install. The result names the file it wrote under
`~/.mojulo/data/`.

- "Model a ceramic coffee mug about 9 cm tall with a handle, and export a print-ready STL."
  Claude mints a measured object study and exports `model.stl` at true scale (and `model.glb` if
  you ask).
- "Compose a small walkable harbour town and export it as one HTML page I can open offline."
  You get `world.html`, which opens from your disk with no server and no network.
- "Make a tiny level with a few coins to collect and export it as a Godot project."
  Claude mints the level as a world with a collect-then-exit rule, proves it can be finished by
  playing it through in your installed browser, and writes a Godot 4 project folder.

Then keep going in the same conversation: "make the handle thicker", "add a lighthouse", "move the
exit further away". Claude edits the stored recipe in place and re-exports.

## What it installs, fetches, runs and writes

Nothing is sent to the maintainer, to any analytics service or to any LLM provider: the plugin
build has no door that takes an API key. Starting the server makes no network call. Everything
below happens only on the action named.

| Kind | What | When |
|---|---|---|
| Installs | `mojulo@3.0.0` and its dependencies, from registry.npmjs.org, into the npm cache (`_npx`) | The first start, through `npx` |
| Fetches | A version lookup on registry.npmjs.org, anonymous | Only when Claude calls `check_for_updates` |
| Fetches | The dashboard, `mojulo-ui@3.0.0`, from registry.npmjs.org, once | Only when you open it yourself: `npx -y -p mojulo@3.0.0 mojulo-ui` announces the download first and refuses it under `MOJULO_UI_NO_FETCH=1` |
| Fetches | The search runtime (npm) and its model (about 130 MB, huggingface.co) | Only when you run `npx -y mojulo@3.0.0 install recall` in a terminal. The server never fetches it on its own; without it, search ranks by words |
| Never | Chrome for Testing, ffmpeg, three.js from a CDN | Renders use your installed browser, MP4 encodes your installed ffmpeg, and an exported page carries its own three.js |
| Runs | A headless browser (the one you have), ffmpeg (the one you have), `git` | Renders and encodes on the action that needs them; `git` only when you ask Claude to save a recipe (`save_recipe`): local commits in `~/.mojulo/data/cookbook`, with your git identity and no remote. It never pushes |
| Runs, only if you set it up | Blender, the `claude` CLI, app processes | Blender through `npx -y mojulo@3.0.0 script …` from a terminal; the `claude` CLI when `MOJULO_AGENT_RUNTIME=claude-code-headless` is set; apps inside the opt-in app runtime (`mojulo-app-runtime`), which the server never starts itself. Godot, Unity and Unreal are never started |
| Writes | `~/.mojulo/` (or `$MOJULO_HOME`) | The database, your recipes and cookbook, exports under `data/outcomes/` and `data/exports/`, preview caches, and the opt-in search runtime |
| Writes | The OS temp directory | While a headless browser or an MP4 encode runs, removed afterwards (a Blender bake leaves its `moj-bake-*` folders) |
| Writes | A folder you name | Only for `install_scaffold`, which writes an app there, `.env` included |
| Logs | The local tool-call log (below) | Every call, on your machine only |

The headless browser keeps its sandbox on macOS and Windows; on Linux it retries once without it if
a sandboxed launch fails with one of Chrome's sandbox errors (or starts without it as root), and
says so on stderr. Minting or editing a world, scene or solid renders a preview in the background
with an installed browser and skips when there is none; `MOJULO_DISABLE_SCENE_WARM=1` turns that
off.

On macOS, one dependency's install script (`sharp`) asks Homebrew, if you have it, where libvips
is, and Homebrew may refresh its own cache from formulae.brew.sh. Mojulo's code never runs `brew`.

Claude may write its own files through Claude: if you ask for a connected-service workflow, Claude
may write a skill under `.claude/skills/`, naming the path first, under Claude Code's permission
prompts. Mojulo never edits your Claude settings. `mojulo init`, which wires other MCP hosts, runs
only if you run it yourself; with the plugin installed it leaves Claude Code's config alone.

### The local tool-call log

Each tool call adds a row to the database in `~/.mojulo/`: the tool name, start time, duration,
status, the argument names and their size (never the values), truncated error text, and the MCP
client's name, version and session id, plus one line on the server's stderr, which Claude Code may
keep in its MCP log. Rows older than 30 days, or beyond 50,000, are deleted at startup. It never
leaves your machine; Claude can read it with `get_tool_ledger`. To turn it off, set
`MOJULO_MCP_TELEMETRY=off` in the environment Claude Code starts with. The values are stored only
if you set the debug flag `MOJULO_MCP_TELEMETRY_CAPTURE=full`, which also keeps each call's
arguments and result (up to 4 KB each) in the same local rows; it is off unless you set it.

### Code that runs with your privileges

- A recipe that carries a `program` (the code door: `mint_solid` with `kind: 'code'`, or a
  workbench `program`) is JavaScript that runs inside the server when it is minted, edited, rendered
  or exported. Its `node:vm` context keeps it deterministic; it is not a sandbox. Treat a recipe
  someone else wrote that carries a program as code.
- `MOJULO_RECIPE_BOOK`, if you set it, points at a local clone of a recipe book whose `builder.js`
  files are imported when the server starts. Point it only at a book you trust.

## Privacy policy

The privacy policy is at [mojulo.ai/privacy](https://mojulo.ai/privacy). In short: what you make,
and the tool-call log above, stay on your machine until you delete `~/.mojulo`; the log keeps 30
days or 50,000 rows. Nothing reaches the maintainer. The fetches in the table above carry none of
your content.

## Upgrading from 2.x

- The chatbot factory is no longer part of mojulo as of 3.0 and is moving to its own project.
  Earlier 2.x versions that include it are unmaintained and have known security issues. The 2.x
  line gets no more releases. Its old tool names answer with that notice instead of running.
- **Saved provider keys become unreadable to 2.x.** The first time mojulo 3.0 reads the provider
  keys a 2.x install saved (for example `mojulo-config list`, `mojulo init`'s key prompt, or the
  dashboard's key settings), it re-encrypts them under a per-install key at
  `~/.mojulo/secret.key`. 2.x cannot read them after that. Back up `secret.key` with the database;
  without it 3.0 cannot read them either.
- Your recipes, cookbook and exports carry over as they are. A home a 2.x install used may also hold
  `data/artifacts/`, where the chatbot factory kept each bot's `.env` with its provider key in plain
  text; 3.0 never reads it, and you can delete it.
- This plugin now pins `mojulo@3.0.0` instead of running whatever npm has newest. Plugin releases
  move that pin.

## Updating and removing

The plugin pins one mojulo version. To update, update the plugin (`/plugin`, then mojulo), then
restart the session; don't run a newer `npx mojulo` beside it. To remove everything: uninstall the
plugin, delete `~/.mojulo/`, and optionally clear the npm cache's `_npx` folder for
`mojulo@3.0.0`.

## If the first start times out

Claude Code gives a local server 30 seconds to start, and the first start downloads about 79 MB.
On a slow link, either start Claude Code with `MCP_TIMEOUT=60000` in its environment, or warm the
cache once from a terminal with `npx -y mojulo@3.0.0 --help` and reconnect in `/mcp`. If a desktop
or Cowork session reports `spawn npx ENOENT`, the Node on that session's `PATH` is missing; a system
install of Node from nodejs.org fixes it.

## Links

- Privacy policy: [mojulo.ai/privacy](https://mojulo.ai/privacy)
- Terms: [TERMS.md](https://github.com/zombico/mojulo/blob/main/TERMS.md)
- Security and reporting: [SECURITY.md](https://github.com/zombico/mojulo/blob/main/SECURITY.md)
- Source and issues: [github.com/zombico/mojulo](https://github.com/zombico/mojulo)
- Support: [GitHub issues](https://github.com/zombico/mojulo/issues), or hello@mojulo.ai
- Publisher: Franz Ombico
