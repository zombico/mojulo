# README outline: an agent game studio

Working outline for the README rewrite, reframed on `1026-consolidated` from the earlier "text-to-3D that compiles"
outline (`1014-readme-outcomes`). Its inventory of made assets, its install section and its wording sweep carry over.

**The frame.** Mojulo turns the person's agent into a game studio. The person directs; the agent works through the
studio's departments, each one a profession's craft held as rules. Every department writes into the same recipe, so a
game's bible, the level you play and the export agree, and one sentence changes them all. The outcomes (Play, Print,
Read, Hear, Observe) are what the departments' combinations make. The compiler is how it works, and it is told in How
it works, not sold in the headline.

**Reader.** Someone who already uses an AI agent and reads "game studio" knowing what a studio is: show me what it can
do. Game makers first (a hobbyist, a solo indie, a level designer who wants a playable greybox by Friday); makers who
print and people designing rooms arrive through the same studio's other outcomes (§4).

**The lift.** Someone who can only describe what they want can now design it, and the result is real: the craft of a
level designer, an animator, a tailor, an architect or a carpenter is built in; what they make plays through, prints at
true size and opens in Godot or Blender; and it stays theirs to change by asking. *You bring the taste; it brings the
craft.* (The two gates, said for the person: the machine checks the craft, only the director judges the look.)

**Source of truth.** `CLAUDE.md` names the `get_substrate` drawer (`SUBSTRATE_POSITIONING` in
`control/lib/mcp/tools/context.js`) as the canonical self-description; its one-breath answer is what the agent says to
the person, so it and the README agree. It now opens "it turns your agent into a game studio". The README and the
manifests follow it (Appendix A). The `initialize` preamble and `forward_context` speak to the agent and keep
"3D compiler".

**Words.**
- *Game studio* outward-facing; *departments* for what is inside it; *you direct, it builds*.
- *Compiler* only in How it works. Never *engine* for mojulo (that word belongs to Godot and Unity, which it feeds).
- *Simulation* only for the science worlds (§4), never in the headline: to a stranger it means The Sims or a flight
  sim, and to an engineer it promises physics mojulo does not claim (`verify_machina` is statics).
- *Design* is the capability; printing, playing and watching are outcomes of it.
- Tool names never in a heading or a card's body; one collapsed "for your agent" line per card at most.

**Showcase rule.** Every capability is shown as a pair: a bible page beside the screen it describes (the world bible's
map beside the level being played, the character sheet beside the hero mid-fight). Both are views of one recipe, so the
pair proves "what you wrote is what plays" without the words recipe or deterministic. Where it helps, a third panel: one
sentence, and both the page and the screen change. Captures are real sessions, unretouched, timed and costed, the way
the decor demo was made.

**Length target.** About 1,500 words, down from 3,900. Capability text should be roughly 75% of it.

Markers: `[verify]` = a claim to run or check before it ships. `[asset]` = something to make. `[choose]` = the
maintainer's call.

---

## 0. Title block

```
# Mojulo

Turn your agent into a game studio.

You direct. It builds: the levels, the cast, the feel, the look, the sound and the world's bible, all in one recipe
on your machine that plays in the browser and opens in Godot or Blender.
```

- Keep the badges (npm, license, node).
- Hero GIF: `wcd-demo.gif` (made; one real session: the pitch, the world's book approved, four levels built, costed) is the
  hero now. `[asset]` later: a played level changed by one sentence. The living room moved to §4.
- One-sentence install directly under the GIF: `npx mojulo init`, then the first ask, which makes a game. Link to the
  full install page (§8).

## 1. One game, start to finish

One real session, shown as bible-and-screen pairs, then the change, then where it goes. `[choose]` the game:

- **A walled-core dungeon** (a military base to infiltrate): grunt crews, a named hero, juice, a title card. The deepest
  stack; it replaces the stealth demo, which today ends on a drafted plan.
- **Race of Champions**: race machines in a stadium under the broadcast package. The most spectacular to capture.
- **A quest open world over a geocity**: the widest range of places.

The pairs, in order:
1. The pitch sentence → the world bible's cover and map.
2. The level's map page → the level being played.
3. The character bible's sheet → the hero in action.
4. The feel book → a jump or a swing, in motion.
5. The title card, carved in the game's look.
6. The change: one sentence; the bible page and the screen both update.
7. Where it goes: the Godot project open, with its `plays` stamp; the browser build as a desktop app.

`[asset]` all of it. `[verify]` each pair is one recipe's two views, captured from the same ref.

## 2. The departments

Each department is a card in the same three parts: the reader's question as the heading, a bible-and-screen pair as
the answer, and one sentence that changes it, with the result. Order: the first four answer "can it make a game?", the
next three "can it make *my* game?", QA and shipping "can I trust it and take it?", the trailer and production are for
the convinced.

| Department | The heading (the reader's question) | The proof | For your agent |
|---|---|---|---|
| Direction | Can I pitch it a game? | pitch → bible cover and map | `design_game` |
| Levels and worlds | Does it build real levels? | map page → the level played | `design_game` world keys (walled-core dungeon, quest open world), `compose_world`, `mint_building` as a level, `tune_ground` |
| Characters | Can I have my hero, my enemies? | character sheet → the hero mid-fight | `create_character`, `update_character`; foe classes, grunt crews; `mint_solid` for gear and vehicles |
| Gameplay and feel | Is it fun to control? | feel book → a jump or a swing | `create_game`; the game types; game feel, juice, weapon swings; local multiplayer |
| Art direction | Can it be my look? | one scene in three looks | `pick_palette`; the looks (anime, western, DCAU, realistic); the seventh generation's light; architectural style |
| Audio | Music, sound effects, voices? | a clip with sound; the score's MIDI in a DAW | `create_beats`, `create_voice` (an optional local speech worker renders it) |
| Writing and world | Is there a world behind it? | bible pages: civilizations, cast, the title card | the world, character and feel bibles; title words in the game's language; the table RPG's game book |
| QA | Will it actually work? | the audit stamp; the playtest run | `create_game` plays every level through to its win before it mints (waivable); the resonance check |
| Shipping | Can I take it to my engine? | the Godot project with its `plays` stamp | `export_game` (a folder or a desktop app), the engine packs, `export_model`, `bind_mesh_render` back from Blender |
| The trailer | Can I show it off? | a cut trailer and a cover | `forge_motion` (flythroughs, recorded runs, shoot plans), `stitch_motion`, `create_cover` |
| Production | Can it make many, try variants? | a grid of variants from one sweep | `run_experiment_sweep`, plans, stash and cook, catalysts, `save_recipe` |

Under the cards, one paragraph, the studio's real advantage: in a studio the handoffs between departments are where
things break (the map drifts from the art, the art from the build). Here every department writes into the same recipe,
which is why the bible and the screen agree, why one sentence changes both, and why QA can play the whole of it.

Then one plain line on what the studio does not have, so the word "studio" does not overpromise: painted concept art is
handed to image tools you bring; voices need an optional local speech worker; multiplayer is local, not online; Unreal
takes assets, not whole games; whether it looks good is the director's call, not a gate.

Audio and the trailer are thinner than a reader assumes (voices depend on a worker; the trailer records runs and joins
clips, no edit beyond that): show each with one modest artifact, not a hero card.

## 3. Change one word

The combinations, shown as a grid that holds everything but one department. `[choose]` which department varies:

- **Look** (the most legible to a stranger): the same base in anime, western and realistic.
- **Rules** (the most impressive): the same hero in a dungeon, an open city and on a race track.
- **Place and hour**: the same city at dawn, at night and under snow.

Under the grid, one paragraph: each department is a shelf, any row composes with any other, and the studio checks the
composition plays before you see it. `[choose]` whether to publish a hillclimb-style figure (how many rolled game worlds
play through); it would have to be generated, not written by hand (CLAUDE.md: no counts that drift).

`[asset]` the grid, from one `run_experiment_sweep` where possible, so the grid is itself a production card.

## 4. The same studio, other outcomes

Design is the capability; these are where it goes besides a game. One short block each; the same departments' laws
serve them (the circulation laws keep a livable profile beside the game one; architect mode builds the same house to
live in, for a game or for a show).

### 4.1 Rooms you can live in

- Hero: **`docs/images/interior-demo.gif`** (made; 900×500, 22 s, 2.5 MB). One room, generated and then changed:
  1. "Design my living room: 14 × 18 ft, window to the south, fireplace on the east wall. Japandi." →
     `design_interior` drafts the smallest house round the room and furnishes it (v1, 131-byte recipe).
  2. "Make it mid-century, and put the sofa in velvet." → same pieces by id, restyled (v2).
  3. "Lose the TV. It's a reading room now." → `brief: { tags: ['no-tv'] }`, the seating re-laid (v3, 229 bytes).
  4. "Give the house a roof and pot lights, and render it in Blender." → three fields on the house the room
     inherits, then three Cycles stills via `blender-bake --render` (roofed exterior, daylight, lights on).
  - Regenerate: `docs/images/src/interior-demo/run.mjs` (see `docs/images/src/README.md`).
  - Or the floor-plan GIF the README carries today (a homeowner's three asks, costed); `[choose]` one.
- **Knows:** an architect's drawing set in NCS discipline order; a decorator's clearances, each with its source (36 in
  walkways, a coffee table at ⅔ of the sofa); named styles decorators use today, each with a 60-30-10 palette. Name a
  few; don't count them.
- **You get:** a structure book (site, plan, rooms, structure, services, quantities, checks); a drawing set as it
  applies; an IFC4 model, a quantity takeoff, and a furnished room you can walk.
- **Layers:** the house is the floor plan; an interior designs one room over it and never draws a wall. An edit to the
  house flows into every scheme.
- **Status:** checks are advisory: the book flags a storey no stair reaches and names the field that adds one.

### 4.2 Things you print, cut and build

- **Knows:** standard parts (ISO fasteners with threads that mate, gears, GT2 pulleys); which job a part does (fasten,
  hinge, slide, drive, seal); how a print bends (walls, infill, layer direction).
- **You say:** "a Raspberry Pi case with a snap lid" · "a wall hook that holds 5 kg" · "a plywood chest of drawers, 900
  wide, four drawers" · "a U-channel bracket in 2 mm steel" · "my hero as a 120 mm miniature" (the studio's merch).
- **You get:** print-ready STL / 3MF at true scale and the `.scad` source back; a strength reading that names its
  assumptions and never says "safe"; a bill of materials, an exploded view and a wordless assembly manual; for
  furniture a cutting plan nested on standard sheets and tip-over checks after ASTM F2057-23; for sheet metal the flat
  pattern by bend allowance, as DXF.
- **Goes to:** a slicer; a panel saw or CNC router; a laser, waterjet or plasma cutter; a press brake; OpenSCAD;
  Blender. Not milling: no CAM toolpaths and no STEP.
- **Status:** a local slicer stamps layers, time and filament (PrusaSlicer and Bambu Studio verified); OpenSCAD
  re-renders the source and checks size and volume.
- **Images (made):** `dresser-shop-sheet.png` ("Not a mesh. A cutting plan."), `dresser-manual-flow.png` +
  `dresser-manual-viewer.png`, `sheet-metal-sheet.png` (say "slit or etch", not "etched").

### 4.3 Books

The press: a game's bible and its game book as a PDF; a table RPG module played in text. One image of a printed bible
spread. `[asset]`

### 4.4 Science simulations

The one place "simulation" is earned: worlds composed from a law table (classical, microscopic, quantum, relativistic),
each returning its solver's gates (conservation, the textbook answer, the regime), and naming a law its scale lacks as a
gap rather than approximating it. One image. `[asset]`

### 4.5 Cities

Planned on a named-cell board in the grammar of a real metro, with traffic and pedestrians at signals; at game scale a
city plays as levels (which is why it is also a §2 level). Keep `metro-new-york-aerial.jpg` until a geocity capture
replaces it.

## 5. How it works (for developers)

The compiler, told once, for the reader who asks "what's under it?":

```
DEPARTMENTS   direction · levels · characters · feel · look · audio · writing · QA · shipping · trailer
                 │  every department writes the same recipe
COMPILER      recipe → geometry · deterministic · true scale · diffable
                 │
DESTINATIONS  the browser · Godot · Unity · Roblox · Blender · glTF / USD · STL / 3MF · drawing set + IFC
```

- **The recipe is the source.** A few hundred bytes of JSON, or an OpenSCAD program. Edit it, diff it, keep it. Renders
  are disposable; the recipe re-compiles to the same geometry every read. A kernel fix improves every stored recipe
  without touching any of them.
- **Inference runs on your agent.** No model inside, no key, no account; that is also why it rebuilds the same.
- **Destinations are real tools**, each export carrying a ledger of what did not travel.
- **The recipe, shown once** `[choose]`: the oak-table workbench recipe beside `oak-table-exploded.jpg`, or the Pi tray's
  OpenSCAD (the README's current demo 1). Then: edit one field with `update_sketch` and the readout names what moved.
- The line developers repeat: *"your agent writes the source, mojulo compiles it."*
- **Not text-to-mesh.** A generated mesh is a blob you can't resize, rig or open a door in; a compiled recipe has real
  parts at real size. Keep it short and don't name competitors.

## 6. Destinations

- Keep the current "Where it goes" table almost as is: Browser, glTF / OpenUSD, Godot, Unity, Roblox, Unreal (assets),
  Blender, STL / 3MF, `.scad`.
- **Add a row:** **IFC4 + drawing set** · sheets, schedules, takeoff · gate: `[verify]` whether any IFC validator is
  wired in; if not, "advisory checks in the structure book".
- Keep the ladder honest: Godot the fullest engine translation, Roblox the young one, Unity a gated leg, Unreal an
  asset target. Every export works with nothing installed, and installing the tool adds the machine gate. Gates advise
  and stamp, none refuse, and none ever claims a human looked.

## 7. What stays on your machine (five bullets, kept in the README)

1. Recipes live in one SQLite file under `~/.mojulo/`; renders are derived.
2. No account, no API key, no external telemetry.
3. Your cookbook: `save_recipe` keeps recipes as plain folders in a local git repo.
4. Recipes with a `program` are code; treat a shared one like code.
5. Localhost-only by default → `SECURITY.md`, `TERMS.md`.

Everything else in the current section moves to `docs/privacy.md`.

## 8. Install (short)

Three doors, in this order, then the first ask, which makes a game (the current "what is this?" undersells it):

1. **Claude, from the plugin directory.** In the Claude app, Customize > Plugins, find Mojulo. It syncs to Claude Code
   on the same account as `mojulo@synced`. Say where it runs, not just where it is listed: wherever a local process can
   start (Claude Code, Cowork on your computer), not a plain claude.ai chat. No install or usage counts.
   - The same plugin from the repo's own marketplace: `/plugin marketplace add zombico/mojulo`.
   - Say plainly what the plugin build leaves out: the AI image, voice and mesh handoffs, and every automatic
     download (renders use your installed Chrome, MP4 your ffmpeg).
2. **Any MCP host:** `npx mojulo init` (Codex, Claude Desktop, others), which also opens the dashboard.
3. **The agent's own Linux box** (Claude app, ChatGPT, Grok, AI Studio, Meta Muse): one sentence; keep the recipe.

- One server only: the plugin, or `init`, not both (two registrations run two servers).
- Move out of the README into `docs/install.md`: the host matrix, the footprint numbers (`[verify]` re-measure them),
  the opt-in table, "wire it by hand", the 2.x upgrade note and the chatbot notice.

## 9. Where the defaults come from

Keep it, about 100 words. It supports the frame: the departments' craft comes from somewhere.

## 10. For contributors

Link block only: `CONTRIBUTING.md`, the recipe book, `AGENT-REFERENCE.md`, `MCP-ARCHITECTURE.md`, `AGENTS.md` (labelled
"working on mojulo with a non-Claude agent").

## 11. License

Unchanged.

---

## Appendix A — the wording sweep (same PR as the README, or the one after)

Every person-facing surface gets the same first sentence ("Turn your agent into a game studio", or the one-liner from
§0). Extend the existing `PARADIGMS` sweep test with a `POSITIONING` string check so the wording can't drift again.

| Surface | Now | To |
|---|---|---|
| `SUBSTRATE_POSITIONING` one-breath answer, `CLAUDE.md` "What this is" | — | **done**: the studio and its departments, the compiler underneath |
| `README.md` | "3D compiler for agents", decor-led | **done (first pass)**: the tagline, the stealth-base session as the hero, games first, the departments as a table, the other outcomes after, the compiler in How it works; the department cards with their pairs wait on the captures |
| `control/README.md` (the npm page) | "3D compiler", its own long copy | **lead done**: the stealth-base GIF and the studio paragraph; generating it from the root README is still open |
| `control/package.json` `description` | long "3D compiler…" | **done** |
| `server.json`, `glama.json` | "3D compiler…" | **done** |
| `plugins/mojulo/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | "3D compiler…" | **done** |
| `plugins/mojulo/README.md` | compiler wording | **done** |
| `control/app/layout.jsx` (dashboard meta) | "3D compiler" | **done** |
| `SERVER_INSTRUCTIONS`, `forward_context`, `docs/AGENT-REFERENCE.md` | "3D compiler" | **unchanged**: they speak to the agent |

## Appendix B — docs to retire or relabel

- `docs/tour.md` (a v2.0.4 snapshot): retire it; its content feeds the department pages.
- `docs/mcp-integration.md`, `mcp-orbit.md`, `meta-context.md`, `catalysts.md`, `app-runtime.md` describe retired
  office surfaces: move them to `docs/historic/` or add a "retired from the listed surface in 3.1" banner.
- `docs/examples/*`: label them as design logs.

## Appendix C — assets

Made, with sources in `docs/images/src/` (recipes, runners and templates; `README.md` there says how to regenerate):

1. `interior-demo.gif`: §4.1.
2. `dresser-shop-sheet.png`, `dresser-manual-flow.png`, `dresser-manual-viewer.png`, `sheet-metal-sheet.png`: §4.2.

To make:

3. The hero GIF: a played level changed by one sentence (§0).
4. The showcase session's pairs (§1), one game, from one ref.
5. One pair per department card (§2), reusing §1's where they fit.
6. The change-one-word grid (§3).
7. A printed bible spread (§4.3) and a science world (§4.4).
8. The departments → compiler → destinations diagram (SVG, light and dark): §5.
