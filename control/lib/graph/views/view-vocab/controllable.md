---
{
  "id": "controllable",
  "name": "Controllable",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a LIVE, INTERACTIVE world the user can DRIVE — the unified 'control a thing in a world' primitive (a person you walk, a drone you fly, a self-playing figure).",
  "when": "Reach for this on framing like 'let me walk a character through X', 'fly a drone through the city', 'a controllable / playable / first-person world', 'move a thing around a scene'.",
  "retired_tool": "create_controllable_world"
}
---

Mint a LIVE, INTERACTIVE world the user can DRIVE — the unified 'control a thing in a world' primitive (a person you walk, a drone you fly, a self-playing figure). Stores ONLY a tiny recipe (`kind: 'controllable'`); the traversable world regenerates deterministically on render at `/api/sketches/<ref>/world` (open it / embed it). Reach for this on framing like 'let me walk a character through X', 'fly a drone through the city', 'a controllable / playable / first-person world', 'move a thing around a scene'. NOT for a static look-at scene — that's create_fractal_city / create_sketch.

The world is a list of ENTITIES. An entity = a transform + a RULE (how it moves each frame) + a BODY (what it looks like). The CAMERA is just an entity too.
Rules: `glide` (free flight, momentum, no gravity — drones/spectator), `walk` (ground-locked, W/S move + A/D turn, drives a walk-cycle gait), `platform` (a tuned PLATFORMER character controller — gravity + jump with variable height, coyote time, jump buffering, air control; Space jumps. 3D-native, so a 2.5D side-scroller is just this with `strafe:0` + a fixed heading), `follow` (a chase camera slaved to a target entity), `clock` (autonomous frame playback — a self-walking figure), `static`.
Bodies: `mesh` ({shape:'box'|'sphere', size|radius, color}), `figure-frames` ({figure:<name>} — a baked human figure declared in `figures`), `none` (invisible — e.g. a first-person camera entity).
Controls in the rendered world: W/S move, A/D turn, Q/E strafe, Space/Shift up-down (glide) or Space to jump (platform), mouse-drag to look; a clock world plays itself under orbit.
Because input makes it path-dependent the world is non-bakeable (the /svg + /scene tiers show only its initial frame); /world is the live tier.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `title` (string) — Title for the resulting sketch artifact.
- `entities` (array) — The things in the world (at least one). Each: { id, transform:{ pos:[x,y,z], heading?, pitch? }, rule:{ type, ...params }, body:{ type, ...} }. z is up; heading is yaw in radians. Rule params — walk: { speed, turn, stride }; glide: { accel, maxSpeed, damping }; platform: { speed, jumpSpeed, gravity, fallGravity, jumpCut (release-to-shorten cap), coyote, buffer, airControl, turnMode:'tank'|'look', strafe }; follow: { target:<entity id>, dist, height, shoulder, lead, lerp }; clock: { rate } (cycles/sec). Body — mesh: { shape:'box'|'sphere', size:[w,d,h] or radius, color }; figure-frames: { figure:<name declared in figures> }.
- `camera` (object) — Optional camera entity (sugar). { rule:'follow'|'glide'|'orbit', target?:<entity id>, dist?, height?, shoulder?, lead?, lerp? }. With a `follow` rule + target it trails that entity (over-the-shoulder); omit entirely to keep the default mouse OrbitControls (good for a `clock` turntable).
- `figures` (object) — Optional map of name → baked-figure SPEC, e.g. { male: { motion:'walk', proto:'male', frames:24 } }. A `figure-frames` body references one by name. Baked at render time via renderFigureWorldFrames, so the manifest stays a recipe (no geometry stored). `proto`: 'male'|'female'; `motion`: e.g. 'walk'.
- `faces` (array) — Optional explicit static world geometry as baked face quads ({ corners:[[x,y,z]×4], fill, doubleSided? }). Omit to get the default checker floor (see `ground`).
- `ground` (object) — Optional default-floor spec when `faces` is omitted: { size, cell, colorA, colorB }. Builds a 2-tone checker plane at z=0.
- `worldFraming` (object) — Optional initial camera framing { cameraPosition:[x,y,z], lookAt:[x,y,z], horizontalFov }. A follow/orbit camera then takes over each frame.
- `viewBox` (object) — Optional render viewBox { width, height } (default 1120×780).
- `bg` (string) — Optional background color (default #0b1220).
- `game` (object) — Optional GAME level channel: mint this world as a game level. Either mechanics-authored ({ levelRef, mechanics:[{ kind:'reach-exit'|'survive'|'collect'|'hazard-damage'|'fail-on-death', … }], fall? } — verbs lower into world behavior + a synthesized contract; manuals via get_game_vocab, kits via get_game_vocab({scope:'kit'})) or a hand-authored contract ({ levelRef, consumes?, produces, on? }). Validated at mint; create_game re-validates against the game's actual store.
- `match` (object) — Optional "MAKE IT A MATCH" channel (pairs with `mapRef`, requires an explicit `ref`): mint this world AS a scored match level over a stored map with pilotable entities. `{ mode, space?, killTarget?, rivals?, teamNames?, allyCount?, foeCount?, side? }`. Modes: `solo` (1v1 — every roster body a pilot option + one enemy seat each), `practice` (solo, non-destructive drill, AI opens passive), `ffa` (a rival pool, everyone hunts nearest), `team` (allies vs foes, team victory), `watch_solo`/`watch_team`/`watch_ffa` (no pilot — all-AI bouts under a glide spectator camera). The mode AUTHORS the level: seats derived from the map's own pilotable roster ("never count suits"), spawn ring/arcs from the map's geometry (honoring its `arena`/`arenaSpawns` hints), the engine match layer (kill scoring, respawns, drop-in, fire-guard), and the `game:` contract with presets — so don't pass `entities`/`game`/`camera`/`faces` alongside it. `space:true` for maps with no floor (3D seek + z-spread spawns). Set `killTarget` (solo/ffa default 3, team 6, watch 5), `rivals` (ffa pool, default 5), `teamNames` (default BLUE/RED). Promote the minted levels via `create_game`; the pre-level pick screens come from the contract's slices (suits / duel_enemy / ffa_rivals / team_allies / team_foes / watch_*).
- `mapRef` (string) — Optional TERRAIN INHERITANCE: the ref of a stored controllable world whose terrain this level rides. The minted manifest stays LIGHT — only this level's own keys (entities, game, camera, …) plus the ref; faces/colliders/lighting/arena hints merge in from the map at resolve time (this level's keys win, wholesale). THE way to mint N level variants over ONE map — one map row, N light levels, and a map re-mint flows terrain to every variant automatically. Don't pass `faces`/`ground` alongside it (they'd shadow the inherited terrain). Validated at mint (ref must exist, kind 'controllable'); the renderability check runs on the merged form.
- `audio` (object) — Optional world AUDIO channel (generic across every base; resolved on the live /world path): { soundtrack?: { beatsRef: '<stored beats ref>' } or an inline beats recipe (compositions loop), sfx?: { beatsRef? | cues?, on? }, footsteps?: true|{ step, jump, land }, wind?: true|{ level, freq }, bindings? (soundtrack channel macros) }. Validated at mint — an unknown beats ref or invalid recipe REFUSES the mint rather than storing a world that fails to render. Vocabulary: get_beats_vocab({ id: 'audio-beats' }).
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
