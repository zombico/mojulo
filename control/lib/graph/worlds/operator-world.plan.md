# operator-world — walking the operator's own state

## Why this exists

mojulo's worlds have, until now, *resisted talking to the main MCP*. Every world started from an
invented recipe (a seed → a city, a list of entities → a controllable stage). None of them read the
substrate's own persisted state.

`operator-world` is the first bridge the other way: **the main MCP hands mojulo's own context to a
world.** The source is the Connected Services union view — the persisted representation of what the
operator has actually built (skills + materialized mcp-orbit solutions, each with the MCP servers it
calls and the capabilities it still `needs`). That graph is projected into a place you can walk.

## The two-layer split (matches the substrate invariant)

The manifest is a tiny recipe; geometry regenerates on render. So the work splits cleanly:

1. **`projectOperatorWorld(services)` — the WIRING.** Live state → a semantic graph `{ nodes, edges }`
   with 2D positions. Pure (takes the already-loaded list; no DB). This is baked into the manifest by
   the mint tool — the moment context crosses from the main MCP into a world.
2. **`assembleOperatorWorldScene(manifest)` — the GEOMETRY.** The stored graph → ground + sky + blocks,
   in the same `{ faces, cameras, viewBox, bg }` payload every other `assemble*Scene` returns. Pure.

`create_operator_world` (in `lib/mcp/tools/scene-operator-world.js`) reads
`listConnectedServices().services`, runs the projection, stores a `kind: 'operator-world'` sketch, and
returns the `/world` URL. Registered in `world-scene.js` dispatch + `WALK_KINDS`, and in `server.js`.

## v1 vocabulary (deliberately basic)

The point of v1 is to **prove the data wires end-to-end**, not to nail the look — so it reuses the
original world's "ground and sky" framing with the simplest possible marks:

- **ground** — a two-tone checker floor, sized to the layout.
- **sky** — the background color.
- **service node** — a teal block on the front row (`y < 0`). Always present.
- **mcp node** — a block on the back row (`y > 0`). A wired server stands tall and amber; an unwired
  server or an unbound `need` is the short, dim block — the operator's **integration gaps, made
  walkable**.
- **edge** — a flat ribbon on the ground from a service to a target it calls: lit when wired, dim when
  it dangles.

Snapshot semantics: the tool reads live state at mint time and bakes it in; re-run to re-snapshot.

## Roadmap (iterate the visualization)

- **Labels / signage.** Wire node labels through the existing `signage` channel (world-anchored) so
  you can read which service / server you're standing at. (Skipped in v1 to stay basic.)
- **Layout.** Two straight rows is the crudest possible layout. Next: cluster services with the servers
  they share, or a radial/force layout keyed off node refs (still deterministic, no seed).
- **Districts by form.** Colour/segregate skills vs mcp_solutions; group by provider.
- **Live mode.** An optional non-snapshot manifest (`{ kind, source:'connected-services' }`) whose
  assembler re-reads live state at render time — always-current, at the cost of a render-time dependency
  from `graph/` into the connected-services loader. Deferred until the snapshot path proves out.
- **Other sources.** The contextmap provenance graph (`meta_nodes` / `meta_edges` / `meta_principles`)
  is the richer graph and the obvious second source — principles become wall signage (the audit trail,
  walked). The projection layer is source-shaped, so a second `project*` fn slots in beside this one.
- **Walk affordances.** Standing near a gap block could surface "wire this up" copy; a service block
  could deep-link back to `/mcp-skills`.
