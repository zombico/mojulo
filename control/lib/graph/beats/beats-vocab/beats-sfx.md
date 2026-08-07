---
{ "id": "beats-sfx", "name": "Sound effects (foley cues)", "summary": "Named foley cues built from six gestures — sweep, flutter, burst, thump (the chiptune four) plus grain (seeded stochastic noise-grain trains) and ring (modal material strikes). Pitch-and-volume choreography fired by an event, not a loop. The world-SFX primitive (pickup dings, lasers, impacts, charge-ups, footsteps, creaks, crackles).", "when": "a sound effect, foley, a pickup ding / laser zap / explosion / jump sound / charge-up, UI feedback sounds, game event stingers, 'make it go pew', footsteps on gravel/wood/grass/leaves, a door creak or slam, glass clink, metal tink, fire crackle, cloth rustle, rain, whoosh, forest ambience — birdsong, wind in the trees, twig snap, an owl at night, weapon sounds — gunfire / a gunshot / shotgun blast / silenced shot, lock and load — rack the slide / bolt / reload / mag in-out / a shell casing, dry fire, a safety click, sci-fi / fantasy weapons — a blaster pew / plasma bolt / charge shot / laser / an overheat vent" }
---

## Shape

```json
{
  "kind": "beats-sfx",
  "title": "Range Pack",
  "cues": {
    "pew":    [{ "type": "sweep", "wave": "square", "from": "A5", "to": "A4", "dur": 0.09 }],
    "ding":   [{ "type": "sweep", "wave": "sine", "from": "C6", "to": "E6", "dur": 0.06 },
               { "type": "burst", "at": 0.02, "decay": 0.08, "vol": 0.3, "highpass": 6000 }],
    "impact": [{ "type": "burst", "decay": 0.25 }, { "type": "thump", "from": "G2", "to": "G1", "decay": 0.3 }],
    "charge": [{ "type": "flutter", "rateHz": 30, "hold": 1.6,
                 "tiers": [
                   { "at": 0.0, "table": ["E4","G4","A4","B4"] },
                   { "at": 0.7, "table": ["A4","C5","D5","E5"] },
                   { "at": 1.2, "table": ["E5","G5","A5","E6"] } ] },
               { "type": "sweep", "at": 1.6, "wave": "square", "from": "E6", "to": "E4", "dur": 0.3 },
               { "type": "burst", "at": 1.6, "decay": 0.25 }]
  }
}
```

## The six gestures

The chiptune four (8-bit choreography):

- **sweep** — pitch ramp: `{ wave?, from, to, dur?, vol?, at? }`. Up = jump /
  power-up; down = laser / fall. This is the classic "pew".
- **flutter** — a pitch table retriggered at `rateHz` (20–30 Hz reads as
  texture, not melody) for `hold` seconds, with `tiers` swapping the table at
  offsets — the charge-up. A tier up is a table swap, never a filter.
  `jitter` (0–1, with `seed`) wobbles each retrigger's timing and pitch —
  0 is the machine-gun flutter, ~0.8 at a low `rateHz` (10–15) with a
  sawtooth wave is stick-slip: a door creak.
- **burst** — enveloped noise: `{ decay?, vol?, highpass?, lowpass?, at? }`.
  Impacts, explosions, scuffs, hats; `lowpass` gives it a material body
  (a slam's air, a fire's low bed) instead of white hiss.
- **thump** — pitch-swept sine: `{ from?, to?, decay?, vol?, at? }`. Kicks,
  landings, heavy hits.

The naturalistic two (the foley spike):

- **grain** — a seeded stochastic noise-grain train: `{ grains?, over?,
  decay? (seconds or [min, max] per grain), band?: { lo?, hi? }, vol?,
  spread?, seed?, at? }`. Scatters `grains` tiny band-shaped bursts over
  `over` seconds — gravel crunch, fire crackle, cloth rustle, rain, debris.
  Same seed = the same grit every play; change `seed` for a sibling texture.
  Layer two grains (a bright sparse one over a low dense one) for depth.
- **ring** — a modal material strike: `{ note?|hz?, material?:
  glass|metal|wood, partials?: [{ ratio, gain?, decay? }], decay?, vol?,
  at? }`. A stack of flat decaying sine partials at inharmonic ratios —
  brights die first, the fundamental sings on. Glass clink, metal tink,
  wood knock, a struck bottle; pass `partials` to voice a custom material.

A cue is a gesture LIST — layer them with `at` offsets (an impact = burst +
thump at the same instant; a charge = flutter, then a release sweep + burst at
the flutter's end; a footstep = thump body + a short grain scuff in the
material's band; a slam = thump + lowpassed burst + a metal ring for the
latch).

## Reference pack: foley-lab-2

Ref `foley-lab-2` is the standing naturalistic reference pack (B10) — twelve
worked cues, each carrying a cue-scoped annotation that says where it's used
and how to re-voice it (read them via `get_beats { ref: 'foley-lab-2' }` or
`annotate_beats { ref, action: 'list' }`):

| cue | reaches for | seam |
|---|---|---|
| `step-wood` | footsteps on wood/plank/interiors | gait channel |
| `step-gravel` | footsteps on gravel/dirt/sand/forest | gait channel |
| `step-grass` | footsteps on grass/lawn/meadow/moss | gait channel |
| `step-heels` | heels/hard soles on hard floors (heel-then-toe) | gait channel |
| `step-run` | running/sprinting stride (one footfall; cadence = caller) | gait channel |
| `door-creak` | door/chest/gate opening | bus `toggle` |
| `door-slam` | heavy closes, crates, impacts | bus event |
| `drip` | cave/sewer water drips | timer / zone event |
| `glass-clink` | pickups (potions/bottles/gems), UI confirm | bus `pickup` |
| `metal-tink` | hitConfirm on armor, coins, parries, machinery | bus event |
| `whoosh` | dashes, swings, thrown objects, transitions | bus / input |
| `fire-crackle` | torches, campfires (retrigger on a timer) | timer / ambience |
| `cloth-rustle` | inventory/equip, curtains, page turns | bus / UI event |

## Reference pack: foley-forest (themed)

Ref `foley-forest` is the first themed pack — a forest walk plus its
ambience, same annotation discipline:

| cue | reaches for | seam |
|---|---|---|
| `step-forest` | footsteps on leaf litter / forest floor | gait channel |
| `twig-snap` | underfoot crack, stealth tell | gait (every Nth step) / bus |
| `bird-chirp` | daytime songbird | ambience timer (~4–15s) |
| `bird-warble` | second bird voice, trill | ambience timer |
| `bird-peep` | soft high-pitched peeps — distant/small bird, dawn chorus | ambience timer (layer several) |
| `owl-hoot` | night forest, time-of-day tell | ambience timer (night) |
| `wind-gust` | a gust through the canopy | ambience timer (~8–20s) |
| `branch-creak` | trees working in the wind | ambience timer (night/storm) |
| `critter-rustle` | something unseen in the undergrowth | rare timer / stealth mechanic |

Ambience doctrine: cues are one-shots — a living forest is the caller
retriggering them on staggered timers with varied `seed`s; the continuous
bed (air, distant canopy) belongs to the world's `wind` channel or an
ambient soundtrack, never to a cue. Mood = density: birds + gusts by day;
owl + creaks by night.

## Reference pack: armory (themed)

Ref `armory` is the weapon pack — firearms, the lock-and-load mechanicals,
and sci-fi/fantasy energy weapons, same annotation discipline. Built entirely
from the existing six gestures (no new gesture earned its place): `burst`+`thump`
is the report + body, a **highpassed `burst` carries every metal clack**, `grain`
is the action grit, `sweep`/`flutter` are the energy shots.

**Metal is noise, not `ring`.** A `ring material:'metal'` is a stack of pure
sines — measured attack centroid ~509Hz at E4, which reads as a *bongo*, not a
slide. Sines can't be metallic (even at A6 a pure stack is only ~1900Hz). The
metallic clack is carried by a short **highpassed `burst`** (≈3.5–4.5kHz hp, ~10ms
decay — centroid ~7.5kHz on its own); `ring` is demoted to a quiet HIGH shimmer
(note ≥ A6, `vol` ~0.15) for the faintest ting, and any body `thump` is quiet and
a hair late so the bright contact leads. That recipe lands the mechanical cues at
~2.8–4kHz centroid (metal), vs ~0.5kHz (bongo) for a bare low `ring`.

| cue | reaches for | seam |
|---|---|---|
| `gunshot` | rifle/pistol crack | fire bus (full-auto = retrigger per shot) |
| `shot-suppressed` | silenced/suppressed shot | fire bus (suppressor equipped) |
| `shotgun-blast` | heavy shotgun report | fire bus |
| `dry-fire` | trigger on an empty chamber | fire input when ammo == 0 |
| `rack-slide` | rack the slide / chamber a round | reload / ready input |
| `bolt-action` | cycle a rifle bolt | between-shots reload |
| `pump-shotgun` | the "chk-chk" pump-action cock | ready input / pump between shots |
| `mag-insert` | seat a magazine | reload step 2 |
| `mag-eject` | drop the empty mag | reload step 1 |
| `shell-drop` | a spent casing hits the floor | timer ~0.3–0.6s after a shot |
| `safety-click` | safety / fire-mode selector | UI / weapon-mode input |
| `laser-pew` | blaster bolt | fire bus (energy weapon) |
| `charge-beam` | charge-up then fire (railgun) | hold-to-charge input → release |
| `plasma-bolt` | heavy plasma/ion shot | fire bus |
| `overheat-vent` | heat vent after sustained fire | cooldown event |

Weapon doctrine: one cue = one shot — full-auto fire is the caller
retriggering `gunshot` on a cadence timer with a varied grain `seed` (the same
call the forest pack makes for birdsong), never an "auto" cue. A full reload is
a cue *sequence*: `mag-eject` → `mag-insert` → `rack-slide`. And a **continuous
held beam/hum is deliberately out of reach** — `sweep` is a one-shot ramp and
`flutter` is retriggered grains, so a sustained beam belongs to a looped
`beats-ambient` bed, not a cue (`overheat-vent` is the closest one-shot the
gestures reach).

Copy cues out of any pack into the world/game's own `beats-sfx` mint (the
recipe is small); don't bind the pack refs. Vary `seed` on grain/jitter
cues for sibling textures; retune `ring` cues by `note`. `foley-lab-1` is the
pre-B10 A/B baseline — historical, not for use.

## Wiring into worlds

A world binds cues to its live runtime via `manifest.audio.sfx`: bus reactions
and inputs may carry `sound: '<cueId>'`, footsteps ride the gait channel, and
`pickup`/`hitConfirm`-style bus events map to cues by event type. Everything is
a pure function of (params, time) — muted capture runs are byte-identical.

## Revising

Revise with the domain tools, never re-mint: `get_beats` reads the cues +
revision index; `update_beats` validates like create and snapshots a revision;
`annotate_beats` marks a cue (`{ scope: 'cue', cue }`); `diff_beats` reports
added/removed/changed cues. The studio at `/beats/<ref>` fires cues live.
