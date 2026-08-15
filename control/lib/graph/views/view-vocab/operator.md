---
{
  "id": "operator",
  "name": "Operator",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a WALKABLE world from the operator's OWN state — the first tool that hands mojulo's context to a world.",
  "when": "Reach for this on framing like 'show me my services as a world', 'walk my connected services', 'visualize what I've wired up', 'where are my integration gaps'.",
  "retired_tool": "create_operator_world"
}
---

Mint a WALKABLE world from the operator's OWN state — the first tool that hands mojulo's context to a world. It reads the Connected Services union view (the skills + materialized mcp-orbit solutions the operator has built, each with the MCP servers it calls and the capabilities it still needs) and lays it out as a place you walk: each service and each MCP server is a block on a ground plane, wired calls are lit ribbons, and the servers/capabilities that AREN'T wired yet are the short, dim blocks — the operator's integration gaps, made walkable.

Snapshot: the live state is read and baked into a tiny `kind: 'operator-world'` recipe at mint time; re-run after wiring up more services to re-snapshot. Served live at `/api/sketches/<ref>/world` (first-person WASD). v1 vocabulary is deliberately basic (blocks on a checker floor) — a substrate to iterate the visualization on, not the final look.
Reach for this on framing like 'show me my services as a world', 'walk my connected services', 'visualize what I've wired up', 'where are my integration gaps'.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `title` (string) — Title for the resulting sketch artifact (default "operator world").
- `audio` (object) — Optional world AUDIO channel (generic across every base; resolved on the live /world path): { soundtrack?: { beatsRef: '<stored beats ref>' } or an inline beats recipe (compositions loop), sfx?: { beatsRef? | cues?, on? }, footsteps?: true|{ step, jump, land }, wind?: true|{ level, freq }, bindings? (soundtrack channel macros) }. Validated at mint — an unknown beats ref or invalid recipe REFUSES the mint rather than storing a world that fails to render. Vocabulary: get_beats_vocab({ id: 'audio-beats' }).
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
