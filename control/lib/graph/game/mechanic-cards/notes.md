---
{ "id": "notes", "name": "Notes to cut on the beat (terminal)", "summary": "A rhythm chart played by note bodies minted asleep: each note walks in down its lane to arrive on its beat, and a swing in a headset that cuts it in its direction (and with its hand) scores it. One that passes the line is a miss. Every note scored or missed wins; enough misses lose. The saber rhythm game's loop.", "when": "saber rhythm game, cut the blocks on the beat, slash the notes, swing in time with the music, VR rhythm, beat cutting, block slashing" }
---

## Role

**terminal** (ends in `success` when every note is scored or missed, `fail` at `misses` misses when it names them).

## Params

```json
{ "kind": "notes", "bpm": 120, "lead": 4, "lanes": { "l": { "from": [14, 0.3], "to": [1, 0.3], "pool": ["note-l-1", "note-l-2"] }, "r": { "from": [14, -0.3], "to": [1, -0.3], "pool": ["note-r-1", "note-r-2"] } }, "chart": [{ "beat": 8, "lane": "l", "dir": "down", "hand": "left" }, { "beat": 9, "lane": "r", "dir": "up", "hand": "right" }], "misses": 10 }
```

- `lanes`: each a straight path toward the player, `from` its far end and `to` the cutting line ([x, y]), and its
  `pool`: ids of note bodies minted `dormant: true`, `hittable`, each floating at the lane's height (its rule's `eye`;
  a lane per height, so a chart's rows are lanes). A lane's notes take its pool's bodies in turn; a pool too small for
  its chart is refused, naming the lane.
- `chart`: { `beat` (whole, `lead` or later), `lane`, `dir` (`up` | `down` | `left` | `right` | `any`), `hand`
  (`left` | `right` | `any`) }.
- `bpm` (or `every`, seconds a beat): the music's tempo; `lead` (4): the beats a note walks in for; `beyond` (2 m):
  how far it walks past the line before it is a miss; `early` (0.15 s): how early the music's clock says a beat.
- `misses`: notes missed that end the level in `fail` (none: no limit).

## Lowers to

- world: per note, reactions on `beat` (n = its beat − lead) that set its body's cut and hand, `spawn` it at its lane's
  `from` and `walk` it through the line and past (the `ctrl` verb); per body, reactions on `cut` (worlds/controllable/
  sweep.js: a headset's swing, its direction in the player's view and its hand) guarded by its cut and hand → `note:hit`,
  and on `arrive` (past the line) → `note:miss`; each sends the body away. Watches: every note accounted for →
  `notes:done`; `misses` → `notes:failed`. HUD: the notes scored, the misses, a toast per miss.
- contract: `on: { "notes:done": { end: "success" }, "notes:failed": { end: "fail" } }`.

## The beat and the cut

The beat is the level's music's (`audio: { soundtrack, beat: true }`, as `on-beat`'s). The cut comes from a headset:
on a game level played with `xr` (or `?xr=` on its live page), each hand's held blade, or its fist, strikes what it
crosses at a swing's pace, and the bus hears `cut` with its direction. A wrong direction or hand leaves the note
walking; it becomes a miss at the end of its lane.
