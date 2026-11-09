# Sword arts

How a hero swings a blade: the same verbs (`polygonizer/hero-swing.js`: the chop, the rising cut, the cleave, the thrust,
the upswing) and the same body layer over them (`polygonizer/hero-swing-body.js` `swingBody`: the hips lead the chest,
the weight moves, the rear foot pivots, the off hand counters), performed in one of three registers. An arsenal names its
register (`gameworld/combos.js`, an arsenal's `art`), and its moveset's clips are baked in it.

| art | what it is |
|---|---|
| `realistic` | the game type's own swing (the default): the realistic law, an economical arc, the elbow never over the head |
| `inspired` | real technique performed for the camera: kenjutsu's and the long sword's chambers, a deep stance, a held finish |
| `freestyle` | the anime sword: anything goes, the sword's weight and the stance's balance no law |

## The study: what the realistic swing holds back

The realistic swing is built to read as a body that could do it: the arm's arc capped at a level raise (110°, so the
elbow stays under the shoulder line), the hips turned at most about 40°, the weight shifted a few centimetres, the
timing even. The action game type's style (`SWING_STYLES.action`) widens the stance and the wind-up within those caps.
What makes a swing read as dramatic is everything those caps hold back:

- **The chamber.** A cut reads from how far the blade is taken back before it: over the head (jodan), beside the head
  (hasso), far behind the hip. Capped at a level arm, every cut starts from the same place.
- **The held anticipation.** The coiled body held still for a beat, then the cut near-instant: the hold sells the speed.
- **The line at the blow.** The arm straight and the blade its extension, reaching as far as the body can.
- **The turn through.** The hips spun on past the target, the back half-turned to it after a big cut (the pass-through).
- **The counterweight.** The off hand flung wide or overhead against the cut.
- **The gaze.** The eyes held on the target while the body coils away from it and spins past it.
- **The finish (zanshin).** The follow-through's pose held before the recovery.

## The registers, dial by dial

Each art is a style of the body layer (`SWING_STYLES.inspired`, `.freestyle`) and a timing of its own (`artTiming`):

| dial | realistic (action) | inspired | freestyle |
|---|---|---|---|
| the arm's raise (`raise`, degrees) | 110 | 140: an elbow up to a forearm over the shoulder line | 172: fully overhead |
| the wind-up and follow-through (`wind`, `after`, × the key's reach from ready) | 1.6, 1.45 | 1.85, 1.7 | 2.4, 2.2 |
| the stance (`stance`, `crouch`) | 1.8, +0.06 | 2.05, +0.1 | 2.4, +0.16 |
| the hips through the follow (`turn`, degrees) | 42 | 58 | 88: the pass-through |
| the arm straightened at the blow (`extend`) | none | 55 % of the elbow's bend | 85 % |
| the off hand (`off`) | 1.6 | 2.0 | 2.5 |
| the gaze (`gaze`, the turn's share the head turns back) | none | 60 % | 85 % |
| the anticipation held (`timing.hold`, a normal cut) | 0.3 | 0.6 | 0.7 |
| the cut (`timing.act`) | 0.45 | 0.34 | 0.22 |
| the finish held (`timing.finish`) | none | 1.2 | 2.0 |

(Timing values are each segment's weight against the others; a move's own length and contact window stay the game's.)

## The laws each register keeps

Every register, measured on the rig (`hero-swing-body.test.js`, "the sword arts"):

- both planted legs reach their feet at every key and every moment between (the body sinks, or an art's wide stance is
  drawn in, until they do: `reachGuard`);
- the blade passes clear of the head and above the floor, at every key and through every moment of the clip;
- the trunk's bend is capped (`bend`) so a deep blow's blade stays off the floor.

`realistic` keeps the elbow under the shoulder line. `inspired` keeps a chamber's discipline: the elbow at most a
forearm (25 cm) over it. `freestyle` keeps no elbow law.

## Using one

- An arsenal: `{ art: 'inspired', weapons: [...] }` (`readArsenal` refuses any other word). The templates' kits
  (`gameworld/combos.js` `TEMPLATE_ARSENALS`) carry theirs: Fallen Angel's `freestyle`, Fable of Artesia's `inspired`.
  The practice room takes its kit's, `--art realistic | inspired | freestyle` over it.
- A game: its `arsenal` key (`gameworld/arsenal.js`), a kit by name, `{ from: <kit>, art: 'realistic', … }` (a kit with
  edits), `'auto'` (the feel template's kit) or a whole arsenal, laid on every level's hero that strikes.
- A new register is a style in `SWING_STYLES` with a `timing`, and its row in this table. Whether it reads as intended
  is the eyes gate: these are machine gates only.
