---
{ "id": "mash", "name": "Mash: a contest of presses (terminal)", "summary": "A contest read over a window of every seat's presses: each seat's fresh presses (its jump or A) counted for a number of seconds, each in its corner in its colour, the clock between; at the horn the most wins, a tie for the most a draw. Or a race to a count, the first to it the winner. With one seat, a count against the clock or a mash to break free. The winner is kept as the seat's number.", "when": "party game, button mash, mash, most presses wins, minigame, tap race, break free, quick time, couch, four players, who presses fastest" }
---

## Role

**terminal** (ends in `success` when the round is done: the window shut at the horn, or a race to a count won). Who won
is `__mash_winner_<i>`: the seat's number (1 to 4), 0 for a draw. A contest of the seats' inputs alone
(docs/local-multiplayer-principles.md principle 12): no physics, no camera, the same presses the same result.

## Params

```json
{ "kind": "mash", "seconds": 10 }
```

- `seconds`: the window (10). Each seat's fresh presses inside it are `presses:<n>`; at the horn the most wins.
- `to`: a race instead: the first seat to that many presses wins and the window shuts at once.

## Seats

A level with seats (soul.seats two or four) counts every seat: seat 1's presses and each other seat's, each its own
count in its corner (bottom left, bottom right, top right, bottom) in its colour. The page says a seat's fresh jump to
the bus as `press:<n>` only on a level whose bus listens for them. Without seats the round is the player's alone.
