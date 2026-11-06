# Mojulo

[![npm](https://img.shields.io/npm/v/mojulo)](https://www.npmjs.com/package/mojulo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522.14-brightgreen)](control/package.json)

**Turn your agent into a game studio.** Describe the game you want. You approve the plan, and you get a game you can play: its levels lit and dressed, its hero and its enemies, how it plays and sounds, its cutscenes. It runs in the browser or as a desktop app, and a team gets its levels and assets in Godot, Unity, Unreal or Blender.

![One real chat with an agent that has mojulo connected. A game maker asks for a multi-level military base for a stealth game, from the hangar through the barracks and a fortified armoury down to the reactor plant at its core, each section unlike the last, and to see the plan and the looks first. The agent drafts the world without building it and points to its book: the way in drawn as rings to the core, each layer's look with its wall, base, floor and paint, and a level's finishes board, its materials as the build will paint them and its light. On "Looks good, approved. Build it." it builds the four levels, shown one after another. The last slide shows the session's time, tokens and API cost](docs/images/wcd-demo.gif)

<sub>One real Claude Code session on Sonnet 5.5: a stealth game's base asked for, its plan and looks approved, four levels built. Under four minutes, 63 cents at API list price.</sub>

You talk to the agent you already use (Claude Code, Codex, the Claude app, ChatGPT, or any MCP host). You bring the taste; it brings the craft. Change your mind and say so: the plan, the levels and the export all change together. It runs on your machine with no API key, no account and no telemetry.

The same studio makes more than games: ideas for the rooms in your floor plan, furniture with its cutting plan, a part to 3D-print at true size, a city to walk through.

## Get started

```bash
npx mojulo init
```

You need **Node 22.14+** and an agent that speaks MCP. `init` finds the agents on your machine, asks once for each, and opens the dashboard at `http://localhost:3001`. Then start a fresh agent session and ask for a game: **"make me a kart racer"**. Or ask **"what is this?"** for a tour.

In Claude Code you can install the plugin instead: `/plugin marketplace add zombico/mojulo`, then `/plugin install mojulo@mojulo` ([plugins/mojulo](plugins/mojulo/README.md)). Use the plugin or `init`, not both. In ChatGPT: [Mojulo for ChatGPT](plugins/mojulo-chatgpt/README.md).

No install on your machine at all? In the Claude app, Grok chat, Google AI Studio or Meta Muse, tell the agent: *Open a Linux box and install the mojulo npm package in it.* In ChatGPT, say the same in work mode. You get the same results, handed back as files. [More on where it runs.](#where-it-runs)

<details>
<summary>Wire it by hand, and what the install takes</summary>

```bash
# Claude Code (--scope user makes mojulo available in every project):
claude mcp add --scope user mojulo -- npx -y mojulo

# Codex: add to ~/.codex/config.toml
[mcp_servers.mojulo]
command = "npx"
args = ["-y", "mojulo"]
```

```jsonc
// Claude Desktop: add under "mcpServers" in claude_desktop_config.json, then restart.
// If it fails with "spawn npx ENOENT", replace "npx" with the absolute path from `which npx`.
"mojulo": { "command": "npx", "args": ["-y", "mojulo"] }
```

Open the dashboard on its own with `npx -y mojulo-ui`.

The first install is about 251 MB on disk plus about 152 MB of npm cache (measured for 3.1.1 on Linux x64: 11 s from an empty cache). Everything lands in `~/.mojulo/`. The plugin build never downloads a browser, ffmpeg or the search model on its own, and leaves out the handoffs to AI image, voice and mesh generators. The per-dependency sheet: [docs/tech-requirements.md](docs/tech-requirements.md).

**Upgrading from 2.x?** Read [Upgrading from 2.x](control/CHANGELOG.md#upgrading-from-2x) first: an unpinned `npx mojulo` moves to 3.x on its next start, and 3.x re-encrypts saved provider keys so 2.x can no longer read them. The chatbot factory left mojulo in 3.0; the 2.x versions that carry it are unmaintained and have known security issues ([SECURITY.md](SECURITY.md#known-issues-in-2x)).

</details>

---

## What the studio makes for you

| Department | What you get | Read more |
|---|---|---|
| **Worlds and levels** | Places to play, with a look and a light that carry through the whole game: a base to infiltrate on the way to its core, an open world across a city's districts, caverns, buildings from a brief, an island at any hour of the day, rock, sand or snow underfoot and forests and grass growing on it. | [walled-core dungeons](docs/walled-core-dungeon.md), [quest open worlds](docs/quest-open-world.md) |
| **Characters, props and vehicles** | Heroes in a realistic, cartoon or anime look, with faces that act; hair, clothes, armour, shoes and the gear they carry, fitted to the body; named heroes; race machines and aircraft. | [the realistic body](docs/realistic-body.md), [garments](docs/garment-principles.md), [armour](docs/plating.md), [flight](docs/flight-games.md) |
| **Play modes, animation and sound** | The game itself: stealth, racing, shooters, flight, fighting, rhythm, sports, board and strategy games, a pen-and-paper RPG; controls that feel right, moves and hit effects, two to four players on one screen, and its music and sound effects. | [local multiplayer](docs/local-multiplayer-principles.md), [the table RPG](docs/table-rpg.md) |
| **Foes and bosses** | Who stands in each level and how hard they fight: grunts, elites and a boss at the end, enemy crews, beasts and oozes in the game's look. | [foes](docs/foes.md) |
| **Cinematics** | Cutscenes and films: actors who play a role from a script, talk to each other and hit their marks; a boss's entrance; shots a director would take; flythroughs and recorded runs joined into a video; a picture of anything you are building, from any angle. | [cinematics](docs/cinematics.md) |
| **Game design and production** | The game's bible (its world, cast, levels and feel) drafted from your pitch for you to approve, each step built on your yes, and a record of what is done and what is left. | [the stealth base, below](#im-making-a-stealth-game-build-me-a-multi-level-military-base-to-infiltrate) |

All six work on the same game, so a place, a cast, a way to play, its enemies and its cutscenes come out as one game, not six pieces.

What it does not do: paint art (bring your image tools), voice lines without an optional local speech worker, online multiplayer (games are local, one screen), or run your game's rules inside an engine (the web build is the game; an engine gets its levels and assets). Whether it looks good is your call as director: nothing in mojulo claims a person has looked.

## What you can ask for

Each of these is one sentence to your agent. All of them run offline, with no API key.

### "I'm making a stealth game. Build me a multi-level military base to infiltrate"

That is the GIF at the top. You see the plan first: the way in, drawn as rings down to the reactor at the core, and each level's walls, floors, paint and light before anything is built. Say yes, and you get four levels, each one unlike the last:

| | |
|---|---|
| ![The hangar: a vaulted steel shed with an orange gantry crane, a yellow-hatched parking box and jersey barriers on the floor](docs/images/wcd-demo-hangar-room.jpg) | ![The hangar's corridor: riveted steel columns banded orange, braced plate walls, hazard stripes at the door frames](docs/images/wcd-demo-hangar-corridor.jpg) |
| ![A barracks bunk room: wood-veneer walls, bunks along both sides, footlockers between them, carpet tile underfoot](docs/images/wcd-demo-barracks-room.jpg) | ![The armoury's corridor in the bunker look: board-formed concrete, yellow and green steel on its columns, a cable bent along the wall under its tray, hazard stripes at a doorway](docs/images/wcd-demo-armoury-corridor.jpg) |
| ![The reactor plant's generator hall: a white-panelled hall with a catwalk and two stairs, the generator on its plinth between jersey barriers](docs/images/wcd-demo-reactor-room.jpg) | ![The reactor plant's corridor: white panels over a teal tiled dado, a terrazzo floor, deep blue on the frames](docs/images/wcd-demo-reactor-corridor.jpg) |

Every building is stocked for what it is: bunks and footlockers in the barracks, weapon racks in the armoury's cages, sandbags at the guard posts, an extinguisher by every door. This is the plan you approve, and one level's finishes before it is built:

![The world's book, its "To the core" page: the four levels as rings with the reactor at the centre, each stair or door on its join with the keycard that opens it, beside each layer's look, its wall, base, floor and paint, and the design rules it holds](docs/images/wcd-demo-book.png)

![A level's finishes in the book, before it is built: the armoury's wall, base, floor, column, crown, ceiling, paint and band tiles, each named by its cut and the metres it is laid at, its light's colours, and the note that its palette does not colour a bay building](docs/images/wcd-demo-finishes.png)

Two asks, under four minutes, 63 cents at API list price. The whole session, every call and reply: [session.json](docs/images/src/wcd-demo/session.json).

### "Make me a kart racer, then let me play it as an app"

You get a game you can play: tracks, rival drivers, a score, and the rule that you have to win the race. Before you get it, every level is driven to its finish line, so you never receive a race that cannot be won. It plays in the browser as it is, or as a desktop app that runs offline.

Kart racing is one of many: arena shooters with bots, supercar racers, flight, stealth and rhythm games, fighting games, sports on a stadium under a TV broadcast ([docs/broadcast.md](docs/broadcast.md)), board and strategy games against the computer, and a table RPG with its printed game book ([docs/table-rpg.md](docs/table-rpg.md)). Any of them can seat two to four players on one screen.

Building it out with a team? Ask for it in Godot, Unity, Unreal or Blender and you get a project the engine opens: the levels, their materials and light, the spawn points, racers and cameras. Hand it off again after a change and your team's own work in the scene stays put.

### "Build a New York-style city at real scale"

![An aerial view of a generated New York-style metro: brick walk-ups with wooden water tanks on their roofs, glass and Art Deco towers, and avenues with traffic](docs/images/metro-new-york-aerial.jpg)

You get a city about 0.8 × 0.5 km in proportion: brick walk-ups with fire escapes and water tanks, Art Deco towers, avenues with traffic. Ask for Paris, London or Tokyo for a different architecture, for night to light it up, or for the Eiffel Tower to stand one at its real size. Walk it in the browser, or jump between street, aerial and skyline views. Ask for the same city again and you get the same city, on any machine.

Not just cities: a transport hub, a school campus, a torch-lit dungeon, a planet, a painted landscape, real-scale terrain.

## Beyond games

The same studio designs rooms to live in, furniture to build and parts to print.

!["Build a plywood chest of drawers, 900 wide, four drawers", as mojulo reports it: the piece exploded into its parts, the panels nested on full sheets with the saw kerf, the hardware list, a tip-over finding that tells you to fix it to the wall, and the build order](docs/images/dresser-shop-sheet.png)

### "We just moved in, here's our floor plan! Some ideas for how we could live in it?"

![One real chat with an agent that has mojulo connected. A homeowner uploads their floor plan and asks, in their own words, for ideas for living in it: the agent builds the house from the picture and designs the living room, the dining room and the big bedroom; asked for sage green walls and the sofa facing the windows, it repaints the living room and rearranges it, shown from eye level as a before and after; then it films a walkthrough of the three rooms. The last slide shows the session's own time, tokens and API cost](docs/images/decor-demo.gif)

Send a picture of your floor plan and say what you want in your own words. You get your house, built to the inch from the drawing, and your rooms designed: "warm, natural and a bit cozy" becomes a style, a palette, finishes and furniture at true size, with the walkways kept clear and a note on anything that would not fit. Ask for sage green walls and the sofa facing the windows, and you see the room before and after from the same spot. Ask for a walkthrough and you get a video of all three rooms.

Three asks, just over two minutes, 30 cents at API list price. Every room can be walked in the browser, opened in 3D tools, or rendered in Blender. The whole session: [session.json](docs/images/src/decor-demo/session.json).

### "Build an oak dining table and show me how it goes together"

![An oak dining table in an exploded view: the top lifted clear, the four aprons pulled out of the legs with their tenons showing, and the angle brackets and screws floating where they fasten](docs/images/oak-table-exploded.jpg)

You get the table pulled apart so you can see how it goes together: legs and aprons joined by mortise and tenon, the top on angle brackets. With it come the cut list, the hardware list, the order to assemble it in, and a check on whether it could tip. Ask for wordless assembly pages like a flat-pack manual, or a flat sheet to print as a model kit. Cabinets with doors and drawers, sofas, and steel or masonry frames work the same way.

### "Write me a Raspberry Pi 4 case tray in OpenSCAD"

You get a tray that fits the board, with standoffs on the Pi's mounting holes and cutouts for its ports, ready to print at 91 × 62 × 14 mm, with sharp edges. You also get the OpenSCAD program back, unchanged, to keep editing. Ask for taller walls and you are told exactly which part moved.

**Also from a sentence:** a stylized or realistic hero with face, hair, clothes and armour ([docs/realistic-body.md](docs/realistic-body.md)); an animal mid-stride, rigged; a six-storey building with a penthouse; a townhouse, an office, a lab or a warehouse from a brief; a historic city in its period ([docs/historic/README.md](docs/historic/README.md)); a science world; an ambient loop or a full score; a room's layout from a photo. More in [docs/tour.md](docs/tour.md).

---

## What you can do with it

| | What you get |
|---|---|
| **Play it** | A whole game in a folder you can put on any web host, or run as a desktop app offline. Any world opens in the browser to walk around. |
| **Hand it to your engine** | A Godot 4, Unity 6, Unreal 5 or Blender project with each level's materials, light, sky, markers and cameras, plus a pointer to the web build it was played in. Re-hand it after a change and your team's work in the scene is kept. |
| **Take it to 3D tools** | `.glb` (with rigs and animation clips) and OpenUSD at true scale; a single character or prop for Unreal; a Blender pack for an art pass or a Cycles render. |
| **Print it** | STL or 3MF at true size in millimetres, with notes for FDM, SLA, SLS and MJF printers. With PrusaSlicer or Bambu Studio installed, it reports layers, time and filament. |
| **Keep it as code** | A `.scad` program that opens in OpenSCAD. |
| **Watch and hear it** | Flythroughs, turntables, recorded runs and films as video; a score and sound effects as audio. |

Every export works with nothing else installed. Each one says plainly what did not make the trip. Install Blender, a slicer, OpenSCAD or a game engine and it also checks the result in that tool; those checks only advise, and never refuse.

## Where it runs

On your machine (macOS, Windows, Linux), you get the whole thing: the dashboard at `localhost:3001`, everything kept under `~/.mojulo/`, and any local tools you have (Blender, a slicer, OpenSCAD, the game engines) picked up automatically.

In a chat app's own Linux box, nothing touches your machine. Ask for the bundle (one zip with the playable page, the 3D model, a print file for real-size objects, and the recipe) and keep it: on most hosts the box is gone when the session ends, and the recipe rebuilds the same thing at home. Meta Muse keeps its box across conversations. A box with no MCP client: tell the agent to run `npx mojulo orient` first.

Where it has been run. <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> keeps your work (your machine, or a box that keeps `~/.mojulo/`) · <img alt="ephemeral" title="ephemeral" src="docs/images/tick-blue.svg" width="14"> a throwaway box (keep the bundle). Blank means not verified yet, not "does not work".

| agent | macOS | Windows | Web agent's Linux box |
|---|:-:|:-:|:-:|
| Claude Code | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> | |
| Claude app (macOS, Windows, web, iOS) | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> | <img alt="ephemeral" title="ephemeral" src="docs/images/tick-blue.svg" width="14"> |
| ChatGPT (work mode; Codex) | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> Codex | | <img alt="ephemeral" title="ephemeral" src="docs/images/tick-blue.svg" width="14"> |
| Hermes Agent | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> | | |
| Grok (Build; chat) | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> Build | | <img alt="ephemeral" title="ephemeral" src="docs/images/tick-blue.svg" width="14"> |
| Meta Muse (iOS, web, macOS app; one session across them) | | | <img alt="persistent" title="persistent" src="docs/images/tick-green.svg" width="14"> |
| Google AI Studio | | | <img alt="ephemeral" title="ephemeral" src="docs/images/tick-blue.svg" width="14"> |

<details>
<summary>Optional extras</summary>

| add | with | what you get |
|---|---|---|
| **creative** (installed by default) | plain `npm install` | worlds, audio, fonts for wordmarks, exact booleans, OpenSCAD in-process, skins and sprite sheets. `npm install --omit=optional` saves about 115 MB; a call that needs a missing helper says so. |
| **recall** | `mojulo install recall` | smarter search over your saved recipes (about 480 MB plus a 130 MB model, under `~/.mojulo/`). Without it, search still works by matching your words. Most sessions never need it. |

`mojulo install` with no argument says which are present.

</details>

## Your work stays yours

- **Everything is on your machine**, in `~/.mojulo/`. Exports are plain files you open in anything.
- **Keep what you like.** Ask to save a recipe and it goes into your own cookbook, a local folder you can find again months later by describing it. A recipe book of starting points ships with mojulo.
- **No telemetry.** Nothing is sent to the maintainer or to an analytics service. The network is used for the npm install, a few one-time downloads on first use (a browser to take a picture if you have none, ffmpeg for the first video, the dashboard, the search model if you add it), and an update check when your agent asks. Full list: [docs/tech-requirements.md](docs/tech-requirements.md#network-posture).
- **A local log of tool calls** (names, timing, sizes, never values) stays on your machine for 30 days. `MOJULO_MCP_TELEMETRY=off` turns it off.
- **Recipes can carry code.** A recipe with a `program` runs JavaScript with your privileges; treat a shared one like code.
- **Provider keys**, if you ever save one, are encrypted at rest.

It is for one person on their own machine, reachable only from localhost; don't expose it to the internet. Threat model: [SECURITY.md](SECURITY.md). Terms: [TERMS.md](TERMS.md), [docs/responsibility-model.md](docs/responsibility-model.md). The open-source mojulo is and stays Apache-2.0 with no external telemetry.

---

## How it works

Underneath the studio, mojulo is a **3D compiler for agents**. Your agent does the thinking and writes a small **recipe**, a few hundred bytes of JSON or an OpenSCAD program; mojulo turns it into the real thing, the same way every time. That is why the plan, the levels and the export always agree, why one sentence can change them all, and why a recipe made in a throwaway box rebuilds the same at home. You can diff, edit and keep a recipe like code; renders are disposable.

- [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md): the tools, workflows and data layout
- [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md): transport, sessions, deliberation
- [docs/tech-requirements.md](docs/tech-requirements.md): footprint, engines, slicers, optional workers, platform notes
- [docs/bicycles.md](docs/bicycles.md): what the checks measure and what they never claim
- [AGENTS.md](AGENTS.md): for non-Claude hosts

## Where the defaults come from

Mojulo's runners, functions and capabilities come from the creator's own study of game development: research drawn from interviews, and years of personal study of art direction and of how game systems are made. Claude helped translate that study and integrate it into mojulo's systems, so it works smoothly for the people using it. Everything mojulo makes is generated by its own code from the parameters in a recipe. It does not decompile games or take their assets, and it ships none. The defaults are a starting point: going beyond them takes iteration, by tuning the recipe, bringing your own references, looking at the result and revising.

## Contributing

One maintainer, no SLA. The easy contribution is a [recipe book](control/book/) entry: a folder with a card and a recipe, or a builder for a whole new kind, with no change to core. In core, bug reports with a pasted recipe (they reproduce exactly), correctness fixes, translations and tests are welcome; concept PRs that change how mojulo works will likely sit, and forks are the open door. Straight up: the maintainer is one person and most read passes are AI-assisted. Full stance: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE). The name is a trademark: fork freely, under your own name ([TRADEMARKS.md](TRADEMARKS.md)).
