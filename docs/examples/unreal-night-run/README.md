# Night Run — the Unreal worked example

A three-level run-and-collect game whose levels are mojulo recipes and whose player, light,
surfaces and effects are Unreal's own: Epic's Game Animation Sample character (motion matching,
Enhanced Input) walking levels minted by conversation. The recipe stays upstream: change a level
with `update_sketch`, re-export, re-import in place, and the Unreal-side dressing survives
because it never lived in the pack.

What is here:

- `recipes/` — the eight stored sketches as `{ ref, title, manifest }`: four `beats-ambient`
  soundtracks, a night `fractal-city` (the rooftop route), a `dungeon` (the cave descent), a
  furnished `floorplan` (the lounge), and the `game` that orders them with gates.
- `mint.mjs` — mints them into your local database in dependency order (re-run to update).
- `project/` — the project-side scripts and config lines that turn a copy of the Game Animation
  Sample into the Night Run project. They live in the Unreal project, never in the pack.

## Reproduce

Prerequisites: Unreal Engine 5.8 with the Python Editor Script plugin, the Game Animation Sample
from Fab (any 5.8 copy), and a mojulo checkout with `control/` installed.

1. **Mint.** From `control/`:

   ```bash
   MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes" node ../docs/examples/unreal-night-run/mint.mjs
   ```

2. **Export the lit pack** into the project folder you are about to make:

   ```bash
   MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes" \
     node scripts/export-unreal.mjs --ref night-run-demo --lit --no-gate --out <Project>/MojuloPack
   ```

   `--lit` resolves every level unshaded so vertex colour is albedo, carries each level's sky
   preset and local lights on the score, and lets Unreal light the world. Drop `--no-gate` to
   let the exporter run its own machine gate when it can find the engine.

3. **Make the project.** Copy the Game Animation Sample to `<Project>` (leave the original
   alone), then:
   - copy `<Project>/MojuloPack/MojuloKernel` to `<Project>/Plugins/MojuloKernel` and build it
     once (`Engine/Build/BatchFiles/Mac/Build.sh UnrealEditor Mac Development -Project=<Project>/GameAnimationSample.uproject`);
   - append `project/DefaultGame.ini.mojulo-section` to `Config/DefaultGame.ini` (the `MapRoot`
     that lets the kernel menu open your persistent wrapper maps);
   - set the two map lines from `project/DefaultEngine.ini.maps` in `Config/DefaultEngine.ini`;
   - copy `project/*.py` to `<Project>/Scripts/` and `project/MojuloDepiction.json` to
     `<Project>/Config/`.

4. **Wire it**, three commandlets in this order (`UnrealEditor-Cmd <uproject> -run=pythonscript -script=<Project>/Scripts/<file> -unattended -nullrhi -nosound`):
   - `setup_game_mode.py` — a Blueprint game mode derived from `MojuloGameMode` that borrows
     the sample's pawn and controller;
   - `setup_depiction.py` — one Niagara system from Epic's templates, bound to pickups, hazards
     and exits through `Config/MojuloDepiction.json` (edit the paths to your own effects);
   - `import_campaign.py` — imports the pack, gives the interior shells triangle collision,
     and makes one persistent wrapper map per level under `/Game/NightRun/Maps` with the
     generated map as an always-loaded sublevel and a project-side dressing light. Re-run it
     after every re-export; it never recreates dressing that already exists.
     `tune_dressing.py` is the one hand edit the demo made afterwards (a warm ember fill in the cave).

5. **Play.** Open the `.uproject` and press Play, or launch windowed:
   `UnrealEditor <uproject> -game -windowed -ResX=1600 -ResY=900`. The kernel menu lists the
   levels; Enter starts one, M returns; the sample character's own controls apply.

## The iteration beat

The rooftop gap in `night-run-city` is the demo's argument. Set `repeats[relay-rooftop-route-1]`
`transforms[0].pos[0]` to `-2.95` (gap 4.4 m, too wide), export, import, and run the probe:

```
UnrealEditor-Cmd <uproject> /Game/NightRun/Maps/night-run-city -game -windowed -MojuloAutoWalk -MojuloAutoJump=2.7 -MojuloShot=9
```

The pawn falls. Set it to `-3.7` (gap 1.65 m) with `update_sketch`, export, import, run the same
probe with `-MojuloShot=4`: the pawn lands on the far slab. The persistent lights, game mode and
Niagara binding are untouched both times; `verify_reimport.py` and `snapshot_campaign.py` are the
scripts that prove it.

## What this does not cover

The probes are machine gates; the operator's eyes gate is playing it. Not built here: PCG
scatter on tagged surfaces, a frame-time capture, packaging to a double-clickable app, and any
enemy. This machine (Apple Silicon M1 Max) runs software Lumen; Nanite and MegaLights are not
available on it, so the demo is conventional meshes under Lumen.
