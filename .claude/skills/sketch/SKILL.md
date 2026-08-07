---
name: sketch
description: Mint a diagram via the control plane's `create_sketch` MCP tool, returning a `/sketches/<ref>` URL the user can open. Use for quick visuals ("draw me X", "show how Y works", "diagram of Z") — flow charts (boxes + arrows) AND data charts (stacked bar, donut/ring, KPI tiles, etc.). The chart vocabulary is retrieved on demand from `semantic_search` (kinds: ['sketch_vocab']), not memorized. Push back if the request needs a real diagram editor (sequence/UML, swimlanes) or an interactive/spreadsheet artifact, or if the answer is words. Invoke as `/sketch <one-line intent>`.
---

# /sketch

Turn a user's "show me this visually" request into a `create_sketch` MCP call against the mojulo control plane and hand back the URL. The renderer is hand-positioned SVG. Two vocabularies share one manifest:

- **Flow** — `stations[]` (typed boxes) + `edges[]` (labeled arrows). For workflows, data flows, decision chains, architectures.
- **Charts** — `marks[]` (low-level primitives: rect, circle, wedge, line, polyline, text) that compose into stacked bars, donuts/rings, KPI tiles, etc. The chart layout vocabulary is **retrieved on demand** from `semantic_search` (kinds: `['sketch_vocab']`), then read in full via `get_sketch_vocab` — it is *not* memorized here, so you read intent first and pull only the paradigm that fits. See Step 1.5.

Both can coexist in one manifest (a flow on one side of a `grid`, a chart on the other). Your job is to map intent onto the right vocabulary, position things so the result reads at a glance, and — for charts — follow the retrieved card's layout math so it looks composed, not freehanded.

The control plane must be running at `http://localhost:3001` (or wherever the user has it) and the mojulo MCP must be connected. If `create_sketch` isn't in `tools/list`, stop and tell the user to start the control plane.

## Read these first

- [control/lib/mcp/tools/sketches.js](control/lib/mcp/tools/sketches.js) — the tool's schema (`create_sketch` + `get_sketch_vocab`). The description block names what each station kind is for and how `marks`/`grid`/`z` work; don't drift from it.
- [control/lib/graph/sketch-manifest.js](control/lib/graph/sketch-manifest.js) — the validator + `expandGridLayout`. Your manifest must pass validation; if you violate it the call errors with field-specific feedback.
- [control/components/graph/CreationMap.jsx](control/components/graph/CreationMap.jsx) — the renderer. Read `STATION_STYLES` for station looks; `edgePath` for `via` routing; `MarkNode` + `wedgePath` for how the chart primitives render.
- [control/lib/graph/sketch-vocab/](control/lib/graph/sketch-vocab/) — the chart vocabulary cards (the source of truth for chart layout). You normally reach these via `semantic_search` + `get_sketch_vocab`, not by reading the dir — but the files are here if you want the full catalog.
- [control/lib/graph/creation-map.js](control/lib/graph/creation-map.js) — the curated reference sketch. Study its positioning, lane structure, label voice. Flow output should feel of-a-piece with this one.

The plan that established this surface: [lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md](lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md).

## Step 1 — Posture-check (push back before drafting)

A sketch is the **wrong tool** in these cases:

1. **The user wants a table.** Tables aren't diagrams — they're tables. Render them as markdown.
2. **The user wants a sequence diagram with timing/swimlanes.** The 4-kind palette has no actor lane, no temporal ordering primitive. Suggest Mermaid in a markdown response instead.
3. **The user wants something interactive** (clickable nodes, expandable groups, live data overlays). Sketches are static SVG.
4. **The topology is too dense to hand-position.** Flow: > ~12 stations or > ~20 edges. Chart: more series/segments than read clearly (a donut past ~6 slices, a stacked bar past ~6 series). The renderer doesn't auto-layout; past those densities the result is unreadable on a single screen.
5. **The answer is a paragraph.** If the structure isn't visual ("how does auth work" can be 4 boxes; "why did this design win" cannot), write the paragraph.
6. **The user wants a permanent reference doc.** Sketches are scratch. If they need the diagram to live somewhere durable, point them at writing a curated manifest under `control/lib/graph/sketches/` (future, see plan §10 Phase 3).

Charts (bar / donut / KPI tile / etc.) are now **in scope** — they were not in v1. A table is still not a chart; a request for tabular data is still §1.

When pushing back, name the specific failure and suggest the right alternative (Mermaid, markdown table, prose). Don't try to bend a sketch into shapes it doesn't fit.

## Step 1.5 — Chart or flow? (retrieve the chart vocabulary first)

Decide what the user is really asking to see:

- **A quantity, comparison, proportion, KPI, trend, or overlap** → it's a **data chart**. Build it from `marks[]`, and you MUST retrieve the layout first:
  1. `semantic_search({ query: "<the user's intent, phrased naturally>", kinds: ["sketch_vocab"], limit: 4 })` — returns ranked card refs.
  2. Read the top 1–3 with `get_sketch_vocab({ id })` (call it with no `id` to list the catalog).
  3. Compose your marks from the card's **layout math** — don't freehand a paradigm you didn't retrieve. Pull `grid-layout` and `z-layering` too when you're laying out a multi-panel board.
- **A flow / structure** (steps, components, who-calls-what) → it's the station/edge vocabulary. Skip to Step 2.
- **A board** (KPI row + a chart + maybe a flow) → retrieve `grid-layout` + the relevant chart cards, lay the `grid`, then place stations and chart marks into cells / absolute coords per the cards.

The point of retrieval: the cards carry the discipline that makes a chart look composed. Reading intent and pulling the matching card beats guessing pixel math. For a pure flow, there's nothing to retrieve — continue below.

## Step 2 — Decompose the intent (flow vocabulary)

Before drafting any coordinates, on a scratch list:

1. **List the entities** the diagram shows (3-10 typical).
2. **Map each to a station kind** using this rubric:

   | Concept | Kind | Notes |
   |---|---|---|
   | A user, an operator, an agent, an external system | `input` | Dashed neutral — anything that *enters* the system from outside |
   | A parameter or precondition | `input` | Same kind; just label it descriptively |
   | An MCP tool, an API endpoint, a function, a black-box process | `mcp_tool` | Accent border — the actor side of the flow |
   | A file, a message, a payload, a queue item, anything in motion | `filesystem` | Slate fill — data passing *through* |
   | A DB row, a durable record, persistent state, a config blob | `db_row` | Purple — things that *stay* |

   Common miscategorizations:
   - A queue is `filesystem` (messages in motion), not `db_row` (even if backed by SQLite).
   - A user-facing UI surface is `input` if it's where the user *enters* the system; `filesystem` if it's an artifact rendered for them.
   - An MCP server is `mcp_tool` (a callable); the tools it exposes are also `mcp_tool` — unless you mean specifically the registry row, in which case `db_row`.

3. **List the directed edges** (A → B) and pick a verb per edge: typically one of `creates`, `writes`, `reads`, `triggers`, `inserts`, `returns`, `calls`, `references`, `links`, `shown to`, `hands off`. Use lowercase action verbs. If you can't pick a verb, the edge probably doesn't belong.

If after decomposition you have 1-2 stations, push back — the user didn't need a sketch.

## Step 3 — Pick a layout pattern

Don't invent layouts. Pick the closest match and adapt. Coordinates are in pixels inside the viewBox.

### A) Left-right pipeline (3-5 stations, single lane)

Best for: a linear flow, no branching.

```
viewBox: { width: 960, height: 200 }
station w=200, h=110, y=45, x = 24, 250, 476, 702, 736-end
```

5 stations evenly: x = `24, 200, 376, 552, 728`. 4 stations: `24, 250, 476, 702`. 3 stations: `24, 350, 676`.

### B) Two-lane vertical (creation-map shape)

Best for: parallel branches, paired input/output, "left side does X, right side does Y". This is what the canonical `/graph` uses.

```
viewBox: { width: 960, height: 480 }
left lane:  x=24,  w=400
right lane: x=456, w=400 (or 380 if you need a `via: 'right'` channel)
row 1 y=24, h=110
row 2 y=180, h=110
row 3 y=320, h=80     (optional)
row 4 y=420, h=80     (optional)
```

Edges that skip a row in the same lane need `via: 'right'` so they route around interior stations.

### C) Hub-and-spoke (one central, 3-6 satellites)

Best for: "this tool does N things". Central station in the middle, satellites around it.

```
viewBox: { width: 800, height: 480 }
hub:        x=300, y=190, w=200, h=100
satellite N: x=300, y=24,  w=200, h=80   (top)
satellite E: x=556, y=190, w=220, h=100  (right)
satellite S: x=300, y=380, w=200, h=80   (bottom)
satellite W: x=24,  y=190, w=220, h=100  (left)
```

### D) Top-down stack (3-4 layers)

Best for: a layered architecture (UI → API → DB), or a decision flowing through stages.

```
viewBox: { width: 600, height: 600 }
layer y=24, 160, 296, 432 (each ~h=110), w=552 spanning, x=24
```

If none of these fit, sketch is probably the wrong tool — see Step 1 §4.

## Step 4 — Pick `via` on edges that would otherwise pierce a station

The default S-curve doesn't know about other stations. If the straight line between `from` and `to` passes through any non-endpoint station's rect, the curve will slice right through it — that's the failure mode you're routing around.

Set `via` to one of `'right' | 'left' | 'top' | 'bottom'`. The edge will exit the source on that side, run along a channel just outside both stations' extents on that side, and re-enter the target from the same side.

**Rule for picking the side**:

1. Eyeball the edge — does it run mostly vertical or mostly horizontal? Vertical lanes use `right` / `left`; horizontal lanes use `top` / `bottom`.
2. Pick the side **opposite** to whatever's in the way. If the obstacle is to the left of the source/target column, route `right`. If it's above the row, route `bottom`.
3. Prefer the side with the most empty viewBox space. The channel sits 24px outside the further station's edge; it'll be clipped if there isn't room.

If the straight line is clear, omit `via`. The default S-curve handles diagonal hops cleanly.

### Tuning the default curve with `curvature`

When the default S-curve looks awkward — typically because the two stations are close together and the curve flattens into something near-straight that grazes a third station — set `curvature` (number, 0.2–3, default 1):

- `> 1` swoops the arc wider. Use when an edge needs a *little* extra clearance from a station nearby but a full `via` channel would be overkill.
- `< 1` pulls the arc closer to a straight line. Use for short hops where the default S looks like a wiggle.

`curvature` is ignored when `via` is set (channels are L-shapes, not curves). Don't reach for it when you really need `via` — they solve different problems.

## Step 5 — Write the manifest

Build the manifest object in your head (or on a scratch line), then call the tool. Required shape:

```js
{
  title: "<short title — shown in page header>",
  viewBox: { width: <number>, height: <number> },
  stations: [
    {
      id: "<unique kebab-case id>",
      kind: "input" | "mcp_tool" | "filesystem" | "db_row",
      label: "<headline>",
      sublabel: "<one short clarifier>",   // optional
      items: ["<bullet>", "<bullet>"],     // optional; 1-3 bullets max
      x: <number>, y: <number>,
      w: <number>, h: <number>,
    },
    // ...
  ],
  edges: [
    { from: "<src-id>", to: "<dst-id>", label: "<verb>", via: "right", curvature: 1 },  // via + curvature both optional
    // ...
  ],
}
```

For **charts**, add `marks: [ ... ]` (and optionally a top-level `grid` + per-node `z`) using the exact shapes from the `sketch_vocab` card you retrieved in Step 1.5 — the card's example fragments ARE the shapes. `stations`/`edges` are optional when the manifest is marks-only; `marks` is optional when it's a pure flow. At least one of the two must be non-empty. Don't hand-write chart marks from memory — copy the card's layout math.

Label voice:
- **Station `label`**: noun phrase, sentence case ("User", "Create sketch", "sketches table", "Operator inputs"). Avoid all-caps. Avoid trailing punctuation.
- **Station `sublabel`**: one short clarifying line ("MCP tool", "DB row", "Claude Code"). Don't repeat the kind.
- **Station `items`**: 1-3 bullets. Each ≤ 8 words. These show as `• item` lines under the label. If you have 4+ candidate bullets, you're trying to do too much in one station — split it.
- **Edge `label`**: one verb, lowercase ("creates", "writes", "triggers", "shown to"). Two words OK ("hands url", "writes to"). No periods.

Size heuristics:
- Station `w` ≥ 160 unless the label is one short word.
- Station `h`: 70 if just label, 90 if label+sublabel, 110+ if 2-3 items.
- ViewBox margins: 20-24px on all sides minimum.

## Step 6 — Self-check before calling

Before you call `create_sketch`, walk through:

1. **Validator parity.** Every `from`/`to` resolves to a station id. Station ids are unique. Every station's `kind` is in `{input, mcp_tool, filesystem, db_row}`; every mark's `kind` is in `{rect, circle, wedge, line, polyline, text}`. Every required coord is a finite number (or the box uses a `cell` with a top-level `grid`). `wedge` `start`/`end` are fractions in `[0,1]` with `end ≥ start`. ViewBox width/height positive. (See [sketch-manifest.js](control/lib/graph/sketch-manifest.js) — these are the rules the server enforces.)
2. **Layout sanity.** No two stations overlap. Everything is inside the viewBox (`x + w ≤ viewBox.width`, etc.). For charts, the marks sit inside their intended panel/zone.
3. **Edge clarity.** No edge crosses through a station that isn't its endpoint without a `via` route around it. If the path is close-but-not-piercing, a `curvature > 1` is the lighter fix.
4. **Fidelity to the card.** For charts: the marks match the retrieved `sketch_vocab` card's layout math (cumulative wedge fractions sum to 1, stacked-segment heights computed from a consistent scale, etc.). You didn't freehand a paradigm.
5. **Label voice consistency.** All edge labels are lowercase verbs. All station labels are sentence-case noun phrases.
6. **Density.** Flow: 3–12 stations, 1–20 edges. Chart: segments/series within the readable band (Step 1 §4).

## Step 7 — Call `create_sketch`

Call the MCP tool with:

```json
{
  "title": "<same title you put in the manifest>",
  "manifest": <the manifest object>
}
```

The tool returns `{ ok: true, ref: "sk_...", url: "/sketches/sk_..." }`.

If the call errors with `Invalid manifest:\n - ...`, the validator caught something — read the error, fix the manifest, call again. Don't retry with the same input.

## Step 8 — Hand off

Reply to the user with the full URL (prefix with the control-plane origin — usually `http://localhost:3001`):

> Sketch ready: http://localhost:3001/sketches/sk_xxxxxxxxxx

One sentence is enough. The diagram speaks for itself. Don't restate the contents.

If you want to iterate (the user says "make X bigger" or "move Y to the left"), re-mint with a new ref. Updates aren't supported on the v1 surface — re-minting is the loop.

## Final reminders

- **Static is a feature.** No animation, no interactivity, no click handlers. If the user asks for those, push back to Step 1.
- **Position math is your job.** The agent burden is intentional — auto-layout is a future stretch (see plan §11). Don't apologize for hand-positioning; just be careful with it.
- **The viewBox is your canvas, not your CSS.** It scales to fit the page. Pick proportions that match the topology (wide-and-short for left-right pipelines, tall-and-narrow for top-down stacks). Don't pick a square out of habit.
- **Resist embellishment.** Don't add `note`-shaped annotation stations to explain the diagram — the diagram should explain itself. If it needs annotation to be understood, it's not the right diagram.
