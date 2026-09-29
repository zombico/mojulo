# Mojulo for ChatGPT — development package

A separate skills-only plugin for the ChatGPT workflow. It uses an existing Mojulo
MCP connection or runs a pinned package in a shell-enabled Work box. It does not
provision a box, register an MCP server, add hooks, or change the Claude plugin.

The package uses the supported `.codex-plugin/plugin.json` compatibility manifest.
`skills/mojulo/SKILL.md` is the entry point. The bundled Node runner provides read-only
preflight, explicit installation, CLI execution with isolated workspace storage, and
recipe checkpoints. Installation uses npm and its native dependency install scripts;
exports and runtime data stay in the selected workspace until transferred by the host.

Mojulo is pinned to 3.0.0 by default. While testing this branch, install its tarball:
the published package with the same version may not include this work. The runner
records and verifies the development tarball hash during checkpoint recovery.

Local machine checks do not certify ChatGPT's web/mobile download or preview behavior.
No public MCP endpoint or directory submission is included. Current official guidance:
[skills](https://developers.openai.com/plugins/build/skills),
[packaging](https://developers.openai.com/plugins/build/plugins), and
[submission](https://developers.openai.com/plugins/deploy/submission).
