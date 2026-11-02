# Actor dailies: the scene actor's eyes gate

The review page for the scene actor (`lib/graph/actor/`). Each take is shown on one clock, side by side, with its
timeline and its readings law by law (`lib/graph/actor/readings.js`). The machine readings are advisory. Whether a
take reads as acting is the operator's call.

```sh
# from control/
node scripts/spikes/actor/dailies.mjs --out /abs/out/dir                 # index.html + takes.json, one self-contained page
node scripts/spikes/actor/dailies.mjs --out /abs/out/dir --hero /abs/hero-live/dir
#   with a hero minted by .claude/skills/hero-live/live.mjs: every take is also written to that hero as a face clip
#   (face.mjs --perform) and its body as <variant>.act.json (act-sidecar.mjs), so hero-live's viewer plays
#   face:<take> on the hero, its body under its face; re-write the viewer page with live.mjs --reuse after a change to it
```

Every take's body (`lib/graph/actor/body.js`) is played on the baseline hero's rig in its relaxed stand. The rig is
expanded once, which takes most of a minute, and cached in `--out` as `rig.json`.

## What it shows

- **Solo**: one speech (`BASELINE.solo`), one column per take. Phase 0 shows the persona's delivery registers, which
  stand in for the playing styles until phase 1.
- **Scene**: a two-hander (`BASELINE.scene`), one card per actor on the scene's clock, with the partner's turns shaded.
  Phase 0 shows the persona alone (`sceneReads`): each speaker reads its lines and the partner's turns are pauses.
- **Each timeline**:
  - the lines and their words, with stressed words in the accent colour;
  - the gaze (lens, notes, away, partner);
  - the body's gestures;
  - the face's motion (its action units' summed speed);
  - the blinks and the micro-expressions.
- **The body lane**: each gesture from its preparation to its let-go, with its apex marked. A chained gesture is
  dashed, a dropped cue is a cross, and the stand's shifts are ticks.
- **Each table**: the face, the delivery, and the seven laws, the body's read on its take.

## The baseline (phase 0)

| take | face motion /s | blinks /min | words /min | gestures | on the lens | regards the partner |
|---|---|---|---|---|---|---|
| solo · anchor | 6.1 | 26 | 179 | 2 | 0.88 | — |
| solo · briefing | 6.8 | 19 | 196 | 2 | 0.89 | — |
| solo · speech | 5.6 | 18 | 161 | 3 | 0.87 | — |
| solo · documentary | 5.5 | 25 | 161 | 1 | 0.92 | — |
| solo · play-by-play | 7.7 | 36 | 237 | 2 | 0.15 | — |
| scene · mara | 2.9 | 20 | 127 | 4 | 1.00 | 0 |
| scene · jon | 4.2 | 29 | 108 | 1 | 0.90 | 0 |

Read in the scene (what the actor fixes):

- **Neither actor ever regards the other, and neither is ever in the listening state.**
  - While the partner speaks, each holds its register's look at the lens.
  - The face moves at a fifth (mara) to two fifths (jon) of its speaking rate.
  - Mara's eyes make no saccade in 21 s.
- **The read's gestures are instants with no body.**
  - On mara's last line, the stress's `point` and the close's `nod` land 0.6 s apart.
  - Phase 2's scheduler has to chain or drop one of them.
