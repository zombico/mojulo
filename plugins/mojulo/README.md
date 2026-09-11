# mojulo — Claude Code plugin

Wires the mojulo MCP server (`npx -y mojulo`) into Claude Code as a plugin. Nothing in this
directory runs code of its own: no hooks, no scripts, no symlinks — the manifest names the
npm package and Claude Code runs it over stdio.

```
/plugin marketplace add zombico/mojulo
/plugin install mojulo@mojulo
```

Then, in a fresh session: "what is this?" — mojulo orients itself. Requires Node.js 22.12+.
The first run downloads the package (~35 MB) and its dependencies (~970 MB on disk); see
https://mojulo.ai/start#requirements.
