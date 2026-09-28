# Mojulo

Mojulo is a 3D compiler for your coding agent. You describe an object, a walkable world, a game or
a piece of music, and Claude builds it through mojulo's tools as a small deterministic recipe: a
few hundred bytes of JSON that compile back to the same geometry, byte for byte, every time. From
the recipe mojulo exports print-ready STL and 3MF at true scale, glTF, OpenUSD, a self-contained
HTML page you can walk through, Godot, Unity, Unreal and Blender packs, WAV and MIDI. The recipes
and every export stay on your machine.

This plugin starts the mojulo MCP server, `npx -y mojulo@2.2.0`, and adds one skill that tells
Claude to start from mojulo's routing index. Nothing in this folder runs code of its own: no
hooks, no scripts. The server is the open-source npm package built from
[github.com/zombico/mojulo](https://github.com/zombico/mojulo).

**Uses your Claude subscription: no API keys; inference stays with your agent.** Mojulo holds the
recipes and does the geometry; the thinking is Claude's, in your session.

## Install

In Claude Code:

```
/plugin marketplace add zombico/mojulo
/plugin install mojulo@mojulo
```

Then start a new session and ask "what is mojulo?".

If you already set mojulo up with `mojulo init` or `claude mcp add`, remove that registration
so you do not run two servers with every tool twice:

```
claude mcp remove mojulo -s user
```

## Where it runs

- **Claude Code**, in the terminal, the desktop app or an IDE.
- **Cowork sessions that run on your computer.** The server is a local process, so it starts
  wherever Claude runs on your machine.
- **Not in a plain claude.ai chat.** Chat does not start local MCP servers; the skill says so and
  installs nothing.

The same npm package also runs headless inside an agent's own sandbox, with no MCP client: the
Claude app and web, ChatGPT and Codex, Grok, Meta Muse and Google AI Studio have each installed it
in their Linux box and minted and exported from the shell (`npx -y mojulo@2.2.0 orient`). That path
does not use this plugin.

## Requirements

- **Node.js 22.12 or newer**, with `npx` on the `PATH` Claude sees.
- **About 290 MB of disk.** The first start downloads the package (about 6 MB) and its
  dependencies, about 110 MB in all, into the npm cache. Measured for 2.2.0 on an Apple Silicon Mac,
  that first start answered in 7 to 10 seconds; later starts reuse the cache.
- No account, no API key, no GPU. Game engines, Blender and slicers are optional, and mojulo never
  installs them.

## Try it

Each of these works on a fresh install, with no dashboard and nothing extra installed. The result
names the file it wrote under `~/.mojulo/data/`.

- "Model a ceramic coffee mug about 9 cm tall with a handle, and export a print-ready STL."
  Claude mints a measured object study and exports `model.stl` at true scale (and `model.glb` if you
  ask).
- "Compose a small walkable harbour town and export it as one HTML page I can open offline."
  You get `world.html`, which opens from your disk with no server and no network.
- "Write a slow 84 bpm groove with a kick and minor-seventh keys, and export it as MIDI." You get a
  `.mid` file for your DAW; ask for WAV to hear it.

Then keep going in the same conversation: "make the handle thicker", "add a lighthouse", "swing
the hats more". Claude edits the stored recipe in place and re-exports.

## What it runs, sends and fetches

Nothing is sent to the maintainer or to any analytics service, and starting the server makes no
network call. Everything below happens only on the action named.

### Network

| Destination | When | Notes |
|---|---|---|
| registry.npmjs.org | Starting the server through `npx` (the full download on the first start); `install recall` | Standard npm. |
| storage.googleapis.com (Chrome for Testing, about 500 MB, once) | Only an explicit render that needs a browser (a world `forge_motion`, `export_game` hangar portraits, `create_game` with `auto_audit`, the dashboard's PNG download) on a machine with no Chrome, Chromium, Edge or Brave | The result says `browser_download` when it happened. Previews made while minting never download it. |
| github.com (ffmpeg-static, 20 to 30 MB, once) | The first MP4 encode when no ffmpeg is installed | SHA-256 pinned per platform and checked before it runs. |
| huggingface.co (the search model, about 130 MB, once) | Only after you run `npx -y mojulo@2.2.0 install recall` | Without it, search ranks by words and nothing is fetched. |
| registry.npmjs.org (the `mojulo-ui` dashboard, once per version) | Only when you open the dashboard (`npx -y mojulo-ui@2.2.0`) | `MOJULO_UI_NO_FETCH=1` refuses the download. |
| registry.npmjs.org and ghcr.io | Only when Claude calls `check_for_updates` | An anonymous version lookup. |
| cdn.jsdelivr.net | Only when an exported page was built with `cdn: true`, as it opens | The default page carries its own three.js. |
| The LLM provider you name (OpenAI, Anthropic, or a local Ollama) | Only for `mint_solid` with `via: 'prompt'` and an explicit `provider` | Sends that prompt with your key for that provider. Every other tool uses Claude, in your session. |
| Docker registries, Fly.io, your LLM provider, public URLs you give | Only with the opt-in chatbot pack (`install chatbot`): building and deploying a bot, the bot builder, `upload_document_from_url` (private addresses refused), reading your deployed bots | Off on a default install. |

On macOS, one dependency's install script (`sharp`) asks Homebrew, if you have it, where libvips
is, and Homebrew may refresh its own cache from formulae.brew.sh. Mojulo's code never runs `brew`.

### Processes it may start

- **A headless browser** for PNG stills, turntables and motion: a Chrome, Chromium, Edge or Brave
  you already have (or `MOJULO_CHROMIUM`), otherwise the Chrome for Testing above. It keeps its
  sandbox on macOS and Windows; on Linux it retries once without it if a sandboxed launch fails
  with one of Chrome's sandbox errors (or starts without it as root), and says so on stderr.
  Minting or editing a world, scene or solid renders a preview in the background with an
  installed browser, and skips when there is none; `MOJULO_DISABLE_SCENE_WARM=1` turns that off.
- **An archive tool, once, when Chrome for Testing is downloaded:** the download is unpacked with
  the system `unzip` (Windows: `tar.exe`, then PowerShell's `Expand-Archive`).
- **ffmpeg** for MP4 encodes (yours on the `PATH`, `MOJULO_FFMPEG`, or the pinned download).
- **git**, when you ask Claude to save a recipe (`save_recipe`): local commits in your cookbook
  under `~/.mojulo/data/cookbook`, with your git identity and no remote. It never pushes.
- **npm**, only for `install recall` and the dashboard download.
- **Only when you set them up yourself:** Blender, through `npx -y mojulo@2.2.0 script …` from a
  terminal; the `claude` CLI, when `MOJULO_AGENT_RUNTIME=claude-code-headless` is set; app
  processes, inside the opt-in app runtime (`mojulo-app-runtime`) the server never starts itself.
  Godot, Unity and Unreal are never started by the server.

### Files it writes

- **`~/.mojulo/`** (or `$MOJULO_HOME`): the database, your recipes and cookbook, exports under
  `data/outcomes/` and `data/exports/`, preview caches, a downloaded browser or ffmpeg,
  `secret.key` (created the first time a provider key is saved, and used to encrypt it), and
  the opt-in recall runtime.
- **The OS temp directory**, while an MP4 encode, a document parse or a headless browser runs,
  removed afterwards (Blender bakes leave their `moj-bake-*` folders).
- **A folder you name**, only for `install_scaffold`, which writes an app there, `.env` included.
- **Claude's own files, only through Claude:** if you ask for a connected-service workflow, Claude
  may write a skill under `.claude/skills/`, naming the path first, under Claude Code's permission
  prompts. Mojulo never edits your Claude settings; if you ask how to keep agents away from bot
  secrets, Claude shows you a deny rule to add yourself.
- **Other MCP hosts' configs** (Codex, Claude Desktop, Grok) only if you run `mojulo init`
  yourself and say yes, each with a backup. The plugin never runs it. With the plugin installed,
  init finds it, leaves Claude Code's config alone, and wires the other hosts to the plugin's
  version.

### The local tool-call log

Each tool call adds a row to the database in `~/.mojulo/`: the tool name, start time, duration,
status, the argument names and their size (never the values), truncated error text, and the MCP
client's name, version and session id, plus one line on the server's stderr, which Claude Code may
keep in its MCP log. Rows older than 30 days, or beyond 50,000, are deleted at startup. It never
leaves your machine; Claude can read it with `get_tool_ledger`. To turn it off, set
`MOJULO_MCP_TELEMETRY=off` in the environment Claude Code starts with.

### Code that runs with your privileges

- A recipe that carries a `program` (the code door: `mint_solid` with `kind: 'code'`, or a
  workbench `program`) is JavaScript that runs inside the server when it renders or exports. Its
  `node:vm` context keeps it deterministic; it is not a sandbox. Treat a recipe someone else wrote
  that carries a program as code.
- `MOJULO_RECIPE_BOOK`, if you set it, points at a local clone of a recipe book whose `builder.js`
  files are imported when the server starts. Point it only at a book you trust.

Mojulo reads no provider API keys from your environment. A key exists only if you save one with
`npx -y -p mojulo@2.2.0 mojulo-config` for the optional paths above.

## Updating and removing

The plugin pins one mojulo version. To update, update the plugin (`/plugin`, then mojulo), then
restart the session; don't run a newer `npx mojulo` beside it. To remove everything: uninstall the
plugin, delete `~/.mojulo/`, and optionally clear the npm cache's `_npx` folder for
`mojulo@2.2.0`.

## If the first start times out

Claude Code gives a local server 30 seconds to start, and the first start downloads about 110 MB.
On a slow link, either start Claude Code with `MCP_TIMEOUT=60000` in its environment, or warm the
cache once from a terminal with `npx -y mojulo@2.2.0 --help` and reconnect in `/mcp`. If a desktop
or Cowork session reports `spawn npx ENOENT`, the Node on that session's `PATH` is missing; a system
install of Node from nodejs.org fixes it.

## Links

- Privacy: [mojulo.ai/privacy](https://mojulo.ai/privacy)
- Terms: [TERMS.md](https://github.com/zombico/mojulo/blob/main/TERMS.md)
- Security and reporting: [SECURITY.md](https://github.com/zombico/mojulo/blob/main/SECURITY.md)
- Source and issues: [github.com/zombico/mojulo](https://github.com/zombico/mojulo)
- Support: [GitHub issues](https://github.com/zombico/mojulo/issues), or hello@mojulo.ai
