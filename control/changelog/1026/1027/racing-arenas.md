### Racing arenas: the stadium's primitives at the circuit, the broadcast at the race

A racing venue's stands were one set piece of boxes and a panel roof. They are now built from the battle city stadium's
own parts, so a stand beside a track reads as a stadium's does; and the race has a referee whose calls and timing tower
the broadcast package can cover, as it covers a contest.

- **The stand** (`stadium/stand.js`): the bowl's section (`stadium/bowl.js`) swept along a straight instead of round a
  ring. From the front: a wall of hoardings, raked tiers two rows a step with aisles, the crowd a mosaic on the treads
  (never figures), a concourse and a band of glass boxes under an upper tier, a parapet, the back wall in a facade card
  between pilasters, a canopy cantilevered from the back with its truss and rafters, a screen on the rim facing the
  track. Both ends are closed by the section itself. A class's stand is fitted to the arena plan's stand zone: a
  circuit's two tiers under a canopy behind glass, a kart track's one covered tier, a rally's open bank.
  - **Painted in the track's kit:** the concrete and the steel are the kit's materials on its pole (material, banded,
    shaded). The seats, the crowd and the hoardings are a stadium livery's tints, lit as paint (a new `tint` on the
    track kit, and `paintPiece` honours a face's `tint`; a face without one is painted as before).
  - **In the local area** (`roads/local-area.js`): the stand zone's elements on every pole but the voxel's (its cubes
    keep the block), set back from the zone's front. A debris fence stands at that front, its posts painted and its mesh
    drawn translucent so the lower rows read from the track. A new law, `in-zone`: the stand stays on its zone's
    footprint.
  - **The word:** `scape.stands`: `'block'` (the set piece, when absent), `'bowl'`, or `{ rows?: [lower, upper?],
    roof?: none | canopy, facade?: none | glass | brick | metal, crowd?: 0..1, screens?: 0 | 1, livery? }` over the
    class's. A gameworld roadway level reads it too. A track from words (`composeTrack`) is stamped `stands: 'bowl'` at
    mint on every pole but the voxel's, so a row minted before keeps its bytes.
  - **Held:** the words read and refused; the section rises away from the track to its depth and eye, every face four
    corners at most and wound to its side, the ends closed, the canopy, facade and screen where the words say, the
    crowd's share; the stands on their footprints and off the road in a local area, the fence seen through; the voxel
    pole and a scape without the word byte-identical, every other zone unmoved. Every roadway, track and emit byte pin
    stands unchanged. Seen in machine screenshots on a realistic GT circuit, a cartoon kart track and a shaded one; the
    eyes gate is open.
- **Race control** (`roads/race-control.js`): the race's referee, the contest kernel's discipline (one self-contained
  closure, `buildRaceControl`, pure and seeded, a page runs it from its own source). It reads what the timing loops saw
  (a car crossed timing line j, only its next one counting) and calls every place:
  - the five red lights a second apart and out after a held beat the dice choose, or a rolling start; a car that rolls
    first a jump start and its penalty;
  - each sector and lap timed (purple the best of all, green a car's own), the fastest lap, the last lap when the
    leader begins it, an overtake on the line it was made, a yellow, a retirement;
  - the chequered flag at the full distance, every car after it home at its next crossing, a lapped car classified its
    laps down; the result with the penalties in it.
  - `display` is the timing tower: the running order, the gap to the leader and the interval at the same line (or a lap
    or more down), the last and best laps, the race clock, the leader's lap.
  - **Held** on written-out crossings: the lights, the jump start, the laps and the fastest, a pass, the gaps and a
    lapped car, the field home after the flag, a retirement, a line out of order ignored, the same facts the same race,
    no state mutated, the closure run from its own source.
- **Stopping point:** the race page. The broadcast does not yet cover a race: its cues (`CALL_CUES`) gain race control's
  calls, its client a `best` tone (the timing screens' purple) and the tower's feed, and the controllable page inlines
  both when a race carries `broadcast`, feeding race control the checkpoint zones' enters. Each re-pins the contest pages
  that inline the client, so it is its own step. The voxel pole's stands, a stadium section the track runs through and the
  pit building's suites are not built.
