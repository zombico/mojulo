---
{ "id": "on-beat", "name": "Press on the music's beat (emitter)", "summary": "Each beat of the level's music opens a short window; a press inside it is beat:hit (once a beat), one outside it beat:miss. Pair with score (points on beat:hit) for a rhythm game; misses can end it. The beat comes from the music itself: the level's audio.beat.", "when": "rhythm game, jump on the beat, press in time with the music, keep the rhythm, music game, timing challenge" }
---

## Role

**emitter** (with `misses`, it can also end the level in `fail`). It needs a success terminal (`reach-exit`).

## Params

```json
{ "kind": "on-beat", "window": 0.3, "key": " ", "misses": 5 }
```

- `window`: seconds the window stays open from each `beat` (0.3). A beat arrives `lead` early, so it straddles the beat.
- `key`: the press (Space, which is also the jump). Held keys do not repeat.
- `misses`: presses off the beat that end the level (none: no limit).

## Lowers to

- world: an input (`key`, once) emitting `__press_<i>`; a sequence per `beat` that opens `__win_<i>` and shuts it
  after `window`; guarded reactions (`if`) turning a press into `beat:hit` or `beat:miss`; HUD toasts.
- contract: with `misses`, `on: { "offbeat": { end: "fail" } }`.

## The beat

The level's music says it: `audio: { soundtrack: <a steady composition or pattern, or 'field:<mood>'>, beat: true }`
puts `{ type: 'beat', n }` on the bus from the music's own clock, `lead` (0.15 s) before each beat (a quarter, a
dotted quarter in 6/8). No music playing (not yet started by a click, or muted), no beat.
