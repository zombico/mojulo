# README outline: text-to-3D that compiles

Working outline for the README rewrite. Branch `1014-readme-outcomes`, cut from `1012-consolidate` at 820821b7.

**The frame.** Mojulo is a compiler. Designers sit on top of it, each one holding a profession's rules. Every designer
writes the same thing, a recipe, and the engine compiles that recipe to the tools people already ship with. The game
leads because it is where every designer's output meets.

**Reader.** People who ship 3D into real tools: game developers first, then makers who print, then people designing
buildings and rooms. Not "anyone".

**Source of truth.** `CLAUDE.md` names the `get_substrate` drawer (`SUBSTRATE_POSITIONING` in
`control/lib/mcp/tools/context.js`) as the canonical self-description that user-facing copy must match. So the reframe
starts there: change that one-breath answer first, then the README and the manifests follow it (Appendix A).
`CLAUDE.md`'s own "What this is" also says characters come "first among them"; it needs to change to game-first.

**Word.** *Compiler* everywhere outward-facing. Never *engine* (that word belongs to Godot and Unity, which mojulo
feeds), and not *factory* or *media studio*. Play / Print / Read / Hear / Observe stays as internal agent routing
(`PARADIGMS`, `get_substrate`) and leaves the pitch.

**Length target.** About 1,500 words, down from 3,900. Capability text should be roughly 75% of it, up from 53%.

Markers: `[verify]` = a claim to run or check before it ships. `[asset]` = something to make.

---

## 0. Title block

```
# Mojulo

Text-to-3D that compiles.

Your agent writes a few hundred bytes of source. Mojulo compiles it into a Godot project, a print-ready part,
or a builder's drawing set — identically, every time.
```

- Keep the badges (npm, license, node).
- Hero GIF: **`docs/images/interior-demo.gif`** (made; 900×500, 22 s, 2.5 MB). One room, generated and then changed:
  1. "Design my living room: 14 × 18 ft, window to the south, fireplace on the east wall. Japandi." →
     `design_interior` drafts the smallest house round the room and furnishes it (v1, 131-byte recipe).
  2. "Make it mid-century, and put the sofa in velvet." → same pieces by id, restyled (v2).
  3. "Lose the TV. It's a reading room now." → `brief: { tags: ['no-tv'] }`, the seating re-laid (v3, 229 bytes).
  4. "Give the house a roof and pot lights, and render it in Blender." → three fields on the house the room
     inherits, then three Cycles stills via `blender-bake --render` (roofed exterior, daylight, lights on).
  - The sidebar shows the stored recipe at each step with the changed lines marked.
  - Regenerate: `docs/images/src/interior-demo/run.mjs` (see `docs/images/src/README.md`).
  - Tried and cut for length: a floor-plan flash (A-101) and an eye-level walk-in.
  - This retires `lounge-handoff-demo.gif`.
- One-sentence install directly under the GIF: `npx mojulo init`. Link to the full install page (§7).

## 1. How it works, in one picture

The three layers, as a small diagram (SVG `[asset]` or a code block):

```
DESIGNERS     game · interior · building · part · character · city
                 │  every designer writes a recipe
COMPILER      recipe → geometry · deterministic · true scale · diffable
                 │
DESTINATIONS  Godot · Blender · glTF / USD · STL / 3MF · drawing set + IFC
```

Three short paragraphs under it, one per layer.

- **Designers know the trade.** A decorator's 36 in walkways, an architect's NCS sheet order, a joiner's mortise and
  tenon, a game designer's guarded reactions. You say what you want; the designer applies the rules and tells you
  what it could not fill instead of faking it.
- **The recipe is the source.** A few hundred bytes of JSON, or an OpenSCAD program. Edit it, diff it, keep it. Renders
  are disposable; the recipe re-compiles to the same geometry every read.
- **Destinations are real tools.** Not a viewer. A Godot 4 project, a slicer-ready 3MF, an IFC4 model. Each export
  carries a ledger of what did not travel.

The one line people repeat: *"It's like LaTeX for 3D: your agent writes the source, mojulo compiles it."*

**Not text-to-mesh.** One short paragraph setting it against generators. A generated mesh is a blob you can't
resize, rig or open a door in. A compiled recipe has real parts at real size, and you edit the sentence, not the
mesh. This is the contrast that makes "compiles" land; keep it short and don't name competitors.

## 2. Designers

Every designer gets the same four lines: **what it knows → what you say → what you get → where it goes**, plus one
status line in gate language. Tool names go on a single closing line in `code`, never in the heading.

### 2.1 Games — where everything meets *(leads)*

- **Knows:** a game as a design book: world, direction, characters, systems, levels, story. It asks before it
  derives, and every level must be walkable before the game mints.
- **You say:**
  - Quick: "a race through the old town" or "sneak past three guards to the exit". Quick goals span reach, race,
    sneak, rhythm, defend, farm, battle and more. Link to the goal list; don't count it (CLAUDE.md: no enumerable
    counts in docs).
  - Full: write the book page by page, approving or revising each one.
- **You get:** a playable `game.html` with a hero, gear, stats, HUD, inventory and menus, chapters, dialogue, a
  scored soundtrack and SFX, plus a world bible and a character bible as readable books.
- **Composes:** any building is a level with one field; a planned city plays as levels; a character is the hero; a
  score is the soundtrack. Improve a bound piece and the game inherits it.
- **Goes to:**
  - A real Godot 4 project. The event bus and the game store run as Godot scripts (`kernel/bus.gd`,
    `kernel/store.gd`), so behaviour travels as data.
  - Unity and Unreal data packs with importers.
- **Status:**
  - Machine gate: a two-level game plays through in a headless Godot, with chapters turning and a dialogue choice
    taking effect.
  - `[verify]` Godot parity per quick goal. Race, sneak and rhythm were web-only when added; the guard fix covered the
    goals whose reactions are guarded. State it as a table, or as "web first; Godot for …".
- **Line:** `design_game` · `create_game` · `export_game`
- `[asset]` Screenshot: a quick game running in the play shell next to the same level open in the Godot editor.

### 2.2 Things you make: printed, cut and built

- **Knows:**
  - Standard parts: ISO M2–M24 fasteners with threads that mate, involute spur, helical and planetary gears, GT2
    pulleys.
  - Which job a part does: fasten, hinge, slide, drive, seal. It reaches for the shelf before it models from scratch.
  - How a print actually bends: walls, infill and layer direction.
- **You say:** "a Raspberry Pi case with a snap lid" · "a wall hook that holds 5 kg" · "a plywood chest of drawers,
  900 wide, four drawers" · "a U-channel bracket in 2 mm steel".
- **You get:**
  - Print-ready STL / 3MF at true scale and the `.scad` source back.
  - A strength reading that names its assumptions and never says "safe".
  - A bill of materials, an exploded view with an assembly order, and a wordless assembly manual.
  - For furniture: a cutting plan nested onto standard sheets (kerf and trim allowed), tip-over checks after
    ASTM F2057-23, racking, shelf sag, the flat-pack carton.
  - For sheet metal: the folded part and its flat pattern by bend allowance, as DXF.
- **Goes to:** a slicer; a panel saw or CNC router (the cutting plan); a laser, waterjet or plasma cutter (DXF);
  a press brake (the flat pattern); OpenSCAD; Blender. Not milling: no CAM toolpaths and no STEP.
- **Status:**
  - Machine gate: a local slicer stamps layers, time and filament (PrusaSlicer and Bambu Studio verified).
  - OpenSCAD re-renders the source and checks size and volume.
  - Fidelity is set by the ask, `look → fit → function → engineered`, so a trinket is never walked toward a tensile
    coupon.
- **Line:** `mint_solid { kind: 'scad' | 'workbench' }` · `fabricate_solid` · `measure_solid`
- **The one recipe shown in the README lives here** (see §3).
- **Images:**
  - `docs/images/dresser-shop-sheet.png` (made): "Not a mesh. A cutting plan." The headline is the report's own
    finding that the chest tips with a child on the open top drawer, and says to fix it to the wall.
  - `docs/images/dresser-manual-flow.png` + `dresser-manual-viewer.png` (made, held): the same chest through
    `mint_stash → gather → cook { kind: 'instruction_manual' }`; the last page anchors it to the wall. Held until
    the inventory page's NaN row is fixed, then re-cut with the inventory page in it.
  - Sheet metal, "Cut it. Bend it." `[asset]`: the folded U-channel beside its dimensioned flat pattern, the
    bend-allowance sum written out (119.048 mm, verified). Waits on the bend-line fix (bend lines currently cut
    the DXF into three pieces).

### 2.3 Homes and rooms

- **Knows:**
  - An architect's drawing set in NCS discipline order.
  - A decorator's clearances, each with its source: 36 in walkways, a coffee table at ⅔ of the sofa, and so on.
  - Named styles decorators use today (Japandi, mid-century modern, …), each with a 60-30-10 palette. Name a few;
    don't count them.
- **You say:** "a two-storey house with a basement" · "do the living room in Japandi, focal wall on the fireplace" ·
  "a small café" (house, store, restaurant, mall, school, office).
- **You get:**
  - A structure book, one tabbed HTML view of the building: site, plan, rooms, structure, services, quantities,
    checks.
  - A drawing set as it applies: C-101 site, S-10x framing, A-10x plans, A-20x elevations, A-301 sections, A-60x
    schedules, P-101 drainage, E-10x electrical.
  - An IFC4 model, a quantity takeoff, and a furnished room you can walk.
- **Layers:** the house is the floor plan; an interior designs one room over it and never draws a wall. Several
  schemes can sit over one house, and an edit to the house flows into every scheme.
- **Goes to:** IFC, glTF, Blender, and Godot as a level.
- **Status:**
  - Checks are advisory: the book flags a storey no stair reaches and names the field that adds one.
  - The interior designer is new in this release. Name what's planned (placement scores, lamps and rugs as pieces,
    millwork) so readers aren't over-promised.
- **Line:** `mint_building` · `design_interior`
- **Image:** the hero GIF is this section's anchor; link back to it rather than repeat it.

### 2.4 More designers (one line each, linking to §5 pages)

- **Characters:**
  - A hero, an invented creature or a real animal.
  - Rigged GLB and VRM, a motion library (poses, stances, strikes, sit and rise, vaults), and a Blender fur bake.
  - It becomes the hero of a game, or a statue you print. `create_character`
- **Cities:**
  - Planned on a named-cell board in the grammar of New York, Paris, Tokyo and more.
  - Traffic and pedestrians at signals; at game scale it plays as levels. `compose_world { base: 'city' }`
- **Historic sites:** Thebes, Giza, Lindos, Pompeii, Xianyang, from an encyclopedia entry to a walkable world.
  `[verify]` These are marked "in progress"; consider leaving them out of the README until they settle.
- **Film:**
  - A shoot plan in After Effects terms.
  - Keyed cameras that land as `Camera3D` in Godot and as cameras in a Blender film pack. `create_shoot_plan`
- **Score:** seeded soundtracks and SFX, with no samples, written per level into the engine packs.

## 3. The recipe (shown once)

- A single short recipe that proves "source, not mesh". Pick one:
  - **Option A:** the oak-table workbench recipe (6 lines of JSON) beside `oak-table-exploded.jpg`. It is already in
    the README and visually strong.
  - **Option B:** a house plus interior recipe, which matches the hero GIF. `[verify]` It must stay short.
- Then three facts in one paragraph:
  - Byte for byte on the same platform, the same geometry anywhere.
  - Edit one field with `update_sketch` and the readout names what moved.
  - A kernel fix improves every stored recipe without touching any of them (the couch-facing story from the old GIF
    caption; it's the best illustration of compile versus generate).

## 4. Destinations

- Keep the current "Where it goes" table almost as is: Browser, glTF / OpenUSD, Godot, Unity / Unreal, Blender,
  STL / 3MF, `.scad`.
- **Add a row:** **IFC4 + drawing set** · sheets, schedules, takeoff · gate: `[verify]` whether any IFC validator is
  wired in; if not, "advisory checks in the structure book".
- Keep the closing line: every export works with nothing installed, and installing the tool adds the machine gate.
  Gates advise and stamp, none refuse, and none ever claims a human looked.

## 5. Go deeper (links out)

One line per page, each a new or renamed doc:

- `docs/designers/games.md` — the design book, quick goals, Godot parity table
- `docs/designers/parts.md` — the `mj_` library, fabricator, strength sensor, slicer gate
- `docs/designers/homes.md` — structure book, sheets, interior styles and laws
- `docs/designers/characters.md`, `cities.md`, `film.md`, `score.md`
- `docs/install.md` — every host, the agent-box path, the who-ran-it-where matrix, footprint
- `docs/privacy.md` — what stays on your machine, network posture, the tool-call log

## 6. What stays on your machine (five bullets, kept in the README)

1. Recipes live in one SQLite file under `~/.mojulo/`; renders are derived.
2. No account, no API key, no external telemetry.
3. Your cookbook: `save_recipe` keeps recipes as plain folders in a local git repo.
4. Recipes with a `program` are code; treat a shared one like code.
5. Localhost-only by default → `SECURITY.md`, `TERMS.md`.

Everything else in the current section moves to `docs/privacy.md`.

## 7. Install (short)

Three doors, in this order, then "ask: *make me a game*" (the current "what is this?" undersells it):

1. **Claude, from the plugin directory.** In the Claude app, Customize > Plugins, find Mojulo. It syncs to
   Claude Code on the same account as `mojulo@synced`. Lead with it: no terminal, and a listing in Claude's own
   directory is a trust signal. Confirmed live: published Oct 1, listed in Claude Code, Cowork and the Claude
   apps. Say where it runs, not just where it is listed: wherever a local process can start (Claude Code, Cowork on
   your computer), not a plain claude.ai chat. No install or usage counts in the README: they date the day after.
   - The same plugin from the repo's own marketplace: `/plugin marketplace add zombico/mojulo`.
   - Say plainly what the plugin build leaves out: the AI image, voice and mesh handoffs, and every automatic
     download (renders use your installed Chrome, MP4 your ffmpeg). Blender renders run from a terminal
     (`npx -y mojulo script blender-bake …`), not from the plugin.
2. **Any MCP host:** `npx mojulo init` (Codex, Claude Desktop, others), which also opens the dashboard.
3. **The agent's own Linux box** (Claude app, ChatGPT, Grok, AI Studio, Meta Muse): one sentence; keep the recipe.

- One server only: the plugin, or `init`, not both (two registrations run two servers).
- Move out of the README into `docs/install.md`: the host matrix, the footprint numbers (they were measured on
  3.0.0, so `[verify]` re-measure them), the opt-in table, "wire it by hand", and the upgrade note.

## 8. Where the defaults come from

Keep it: about 100 words. It supports the frame, since the designers' knowledge comes from somewhere.

## 9. For contributors

Link block only: `CONTRIBUTING.md`, the recipe book, `AGENT-REFERENCE.md`, `MCP-ARCHITECTURE.md`, `AGENTS.md` (labelled
"working on mojulo with a non-Claude agent").

Stop linking from the README: `POLYGONIZER-SYNTHESIS.md`, `bicycles.md`, and the `local-*-worker.md` pages (those
move under `docs/install.md`).

## 10. License

Unchanged.

---

## Appendix A — the wording sweep (same PR or the one after)

Every outward surface gets the same first sentence. Extend the existing `PARADIGMS` sweep test with a
`POSITIONING` string check so the wording can't drift again.

| Surface | Now | To |
|---|---|---|
| `README.md` | "3D factory with a media studio" | the headline and one-liner from §0 |
| `control/README.md` (the npm page) | "3D compiler", its own 3,000-word copy | generated from the root README, or a short pointer to it |
| `control/package.json` `description` | long "3D compiler…" | one-liner, ≤ 160 chars |
| `server.json`, `glama.json` | "A 3D compiler for coding agents…" | one-liner |
| `plugins/mojulo/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | "A 3D compiler for Claude Code" | one-liner |
| `plugins/mojulo/README.md` | factory wording | match the README |
| `plugins/mojulo/skills/mojulo/SKILL.md` | "play, print, read, hear and watch" | designer-led trigger list (agent-facing, so verbs are fine) |
| `control/app/layout.jsx` (dashboard meta) | "3D compiler" | one-liner |
| `SUBSTRATE_POSITIONING` → `SERVER_INSTRUCTIONS`, `CLAUDE.md` "What this is" | factory + verbs, characters first | **change first** (it is canonical): compiler + designers, game first. The verbs can stay below as agent routing |

## Appendix B — docs to retire or relabel

- `docs/tour.md` (a v2.0.4 snapshot): retire it. Its persona and catalog content feeds `docs/designers/*`.
- `docs/mcp-integration.md`, `mcp-orbit.md`, `meta-context.md`, `catalysts.md`, `app-runtime.md` describe retired
  office surfaces. Move them to `docs/historic/` or add a "retired from the listed surface in 3.1" banner.
- `docs/examples/*`: label them as design logs. Only `unreal-night-run` is a user worked example.
- The README's "Also in the box … local apps … workflows over the MCPs you already run" line: delete it.

## Appendix C — assets

Made, with sources in `docs/images/src/` (recipes, runners and templates; `README.md` there says how to regenerate):

1. `interior-demo.gif`: the hero (§0).
2. `dresser-shop-sheet.png`: §2.2.
3. `dresser-manual-flow.png`, `dresser-manual-viewer.png`: §2.2, held until the inventory fix.

To make:

4. Sheet metal, "Cut it. Bend it.": §2.2, after the bend-line fix.
5. Three-layer diagram (SVG, light and dark): §1.
6. Game screenshot: the play shell beside the Godot editor (§2.1).
7. Keep `metro-new-york-aerial.jpg` until a city image from the plan-first `city` kind replaces it.
   `oak-table-exploded.jpg` can retire: the chest of drawers took the carpentry slot.
