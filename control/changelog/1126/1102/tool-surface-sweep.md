### The tool list, swept

A sweep of every registered tool for the ones nothing wires in: names an agent is told to call but cannot reach, doors
nothing points to, and aliases kept long past their release. This first wave fixes what agents were being sent to that
does not exist and deletes what was dead; it changes no door an agent can call. Built so far:

- **No dead pointers.** A tool registered unlisted and homed in no pack (a folded alias, a per-op name behind a door,
  a retired pack's member) cannot be called by a host that calls only what it lists, so a surface that names one sends
  the agent into a wall. A guard (`lib/mcp/no-dead-pointers.test.js`) reads what agents are handed (the catalysts, the
  routing cards, the vocab cards, and the prose the tools return: descriptions, `next` and `submit` hints, errors) and
  fails on any unreachable name; prose that says a name is retired is history and passes. What it found is fixed:
  - the doors' own hints: `mint_solid via:'packet'` handed back `submit_polygonizer_manifest`, the skin op handed back
    `skin_polygomer` and `get_skin_packet`, `capture_reference` and `semantic_search` named retired solid and world
    creators, and a sprite sheet, a scene forge and a keyframe card named the image handoff's per-op names. Each now
    names the door: `mint_solid` and its kind, `edit_solid` op `skin`, `compose_world` and its base, `render_handoff`
    and its op.
  - the catalysts, routing cards and sketch and view vocab cards that named them, and the plugin profile's edits of them;
  - the science views' and worlds' own errors, which still said `create_atom_view requires…` to a `create_view` caller;
  - the orientation gallery's lantern, minted live on a tour, now minted through `mint_solid` kind `workbench`;
  - the office wing's leftovers in live descriptions (the inventory, the catalyst shelf, plan mode, the stash's pointer
    type, the roles key), which pointed at the contextmap and the composer retired in 3.1.0.
  A few known pointers wait for their own change, listed in the guard and shrink-only: forward_context's office
  drawers, the Blender art pack's return step, and the figure-spec gate the character-from-dream catalyst runs on.
- **A cover takes its picture as a file.** `create_cover`'s `next` asked the operator to upload a picture on the
  dashboard, which is view only. `art: { path }` now takes a PNG, JPEG or WebP on this host, files it into a stash as
  an image item and maps it onto the illustration (the result's `art` says where); `art: { stash, item }` maps one
  already gathered, as before. And `capture_reference` no longer tells the agent to anchor a build with
  `bind_stash({ role: 'reference' })`: no build reads that link.
- **The pre-3.0 aliases are gone.** The per-kind names `mint_solid`, `edit_solid`, `compose_world` and `create_view`
  replaced in 1.0.0 and 1.1.0 (`create_figure`, `create_workbench`, `skin_polygomer`, `create_fractal_city`, the
  `create_*_view` family and the rest) were unlisted aliases for two majors; they are no longer registered,
  and a stored plan that names one compiles back to a draft that names it. With them go about a thousand lines of
  `register*Tools` functions nothing called. Every kind they made is made by its door, unchanged.
