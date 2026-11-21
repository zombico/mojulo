---
name: direct
description: Direct the camera on a brief the way a director and a director of photography would — choose the camera style or the shots in words (size, angle, side, place, the named moves), say why shot by shot, write them as a world's shoot plan or a screenplay's coverage, read the frame read's advice and LOOK at the contact sheet (or the storyboard), adjust the WORDS (never hand-placed coordinates) at most three times, and show the person the sheet; the eyes gate is theirs. Use when asked to shoot, film, cover or frame something, "set up the cameras", "make this scene feel handheld / symmetrical / like one take", a trailer or a tour of a world, or to fix framing that reads wrong. Invoke as `/direct <brief>`.
---

# /direct

A shot here is WORDS: a key framed by `size`, `angle`, `side`, `place` on a subject (`shoot/framing.js`), a named move
(`shoot/moves.js`), a camera style for a scene's coverage (`actor/camera-styles.js`). This skill is the director's order
of moves over them. Read [docs/cinematics.md](../../../docs/cinematics.md) ("Coverage", "Camera styles", "The frame",
"The moves") before the first brief of a session: it is the why behind every choice below.

Never hand-place a camera in coordinates when a word says the shot, and never edit a kernel to land one brief. When the
words cannot say what a brief asks (a dutch on a film, a rack focus), name the missing word and stop there: that is a
change of its own, with its own plan.

## 1. Which surface

| the brief | the surface | where its words go |
|---|---|---|
| a world, a place, a thing that moves in it: a tour, a reveal, a chase, a trailer | the world's SHOOT PLAN | `forge_motion({ subject: { world_ref }, shoot: { plan \| ops, contact } })` |
| people talking or acting a scene | a SCREENPLAY's coverage | `forge_motion({ subject: { screenplay: { …, camera } } })` |
| several scenes, one film | a FILM | `forge_motion({ film: { write: { …, camera, scenes: [{ …, camera }] } } })` |

The manuals: `get_motion_vocab({ id: 'shoot' })`, `({ id: 'scene-film' })`, `({ id: 'film-studio' })`.

## 2. The brief, in words

Settle these with the person (propose; they correct):

| ask | word |
|---|---|
| the feel of the whole | a camera style (screenplay / film `camera`): `classical` · `verite` · `planimetric` · `still` · `oner` · `kinetic` · `observational` |
| what each shot is about | `on`: a subject (`walker:0`, `car:2`, `entity:hero`; `shoot: {}` lists them) or a point with a `heading` |
| how big | `size`: `ecu` · `cu` · `mcu` · `ms` · `mls` · `fs` · `ws` · `ews` |
| from where | `angle` (`eye` · `high` · `low` · `overhead` · `worm`), `side` (`front` · `three-quarter-left` · `profile-right` · `back` …) |
| where it sits | `place`: `lead` (the default) · `left` · `right` · `centre` |
| how it moves | a move: `push_in` · `pull_out` · `dolly_zoom` · `arc` · `crane_up` · `track` · `whip_pan` · `crash_zoom`; a hand: `handheld` · `steadicam` · `run` · `rumble` |
| the cut | shots and spans; overlapping spans are coverage of one action |

## 3. Say why, before writing

One line per shot, in the person's terms, each on a principle: why this size here (widen to establish, tighten to
land), the side that keeps the line, the room ahead of a mover, the move and what motivates it (a reveal, a turn), and
at each cut the 30° or two sizes that keeps it from jumping and the screen direction it keeps.

## 4. Write, read and LOOK

```bash
cd control
export MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes"
# a world: write the plan in words and ask for its contact sheet in the same call (1 | 2 | 3 frames a shot)
node scripts/mcp-stdio.mjs call forge_motion --json '{"subject":{"world_ref":"sk_…"},"shoot":{"contact":3,"plan":{"cameras":[{"id":"open","keys":[{"t":0,"move":{"kind":"crane_up","on":"walker:0","for":4}}]},{"id":"close","keys":[{"t":4,"frame":{"on":"walker:0","size":"mcu","side":"three-quarter-left"}}]}],"shots":[{"camera":"open","span":[0,4]},{"camera":"close","span":[4,7]}]}}}'
# a scene: its storyboard (the default form) in a camera style, or its contact sheet on the set (export 'film', a minute)
node scripts/mcp-stdio.mjs call forge_motion --json '{"title":"…","subject":{"screenplay":{"cast":{…},"script":"…","camera":"verite"}},"shot":{"motion":"coverage"}}'
node scripts/mcp-stdio.mjs call forge_motion --json '{"title":"…","export":"film","subject":{"screenplay":{…,"camera":"verite"}},"shot":{"motion":"coverage","params":{"contact":2}}}'
```

Read the answer first: `composition` (each shot's subject, size, headroom, eyes, place, facing) and its `notes`
(lost, head-cut, loose-head, eyes-low, joint-cut, short-sided, jump-cut, direction-flip, each with a fix); for a scene,
its `framing` (the same read of its coverage) and the director's notes. Then LOOK: Read the contact sheet's PNG (`contact.path`: a row a shot, start, middle and end, the
thirds over each frame) or the storyboard. The read measures where things land; only the picture shows whether the shot
says what the brief asked: what stands in front, what the background does, whether the eye goes where it should.

## 5. Adjust the words, at most three times

Each note names what moves it: a size, a side, a place, a move's `from` / `to` / `by`, a span, a style. Change the
words (`shoot: { ops: [{ op: 'frame', … }, { op: 'move', … }] , contact: 3 }`, or the screenplay's `camera`), read and
look again. Record each change and the principle behind it. Stop after three rounds, or when the notes are empty or only
say what the brief chose on purpose (a planimetric scene crosses the line by design; a whip pan leaves its subject).

## 6. Show it

Send the person the contact sheet (or the storyboard) with the shot list, the why, and what changed. Say which gate ran:
the machine gate (the frame read's notes, the clearance) line by line, and that the eyes gate is theirs: LOOK THROUGH
on the World page, or the animatic. Never claim it passed. Render the film (`shot: { motion: 'plan' }`, `export:
'mp4'`; a screenplay's `export: 'film'`) only once the person likes the sheet: the sheet is seconds, the film minutes.
