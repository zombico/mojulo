### Handoff powers: a hero's powers and arms in the level record

The engine handoff carries a level's contract, markers and seats as data, and its rules (cues, HUD) stay the web's. A
hero's powers are cues, so a team's developer saw a power's move granted and nothing of when it is gained, what it
costs or what it hits for, and the pilot's marker said its rule's type alone. This theme carries them as data.

- **The level record's `powers`** (`scene/handoff.js` `levelRecord`, read by `gameworld/power-record.js`): each power
  the level's holder carries, as the web build plays it. Each row has:
  - its key and holder;
  - when it is gained (the start, or its node in the stats: `hero.<power>` at a rank);
  - its spend and the toast it refuses with;
  - its look;
  - its attack (a beam at the nearest foe in front: its reach, its cone and its hurt);
  - its move, with what grants it (the held slice, a pickup, the stats).
  Absent where the level has none. It rides `handoff.json` and the GLB's `moj:handoff` extras into every engine (Godot's
  and Blender's `mojulo_level`), and the ledger counts it (`carried.level.powers`).
- **A pilot's and a seat's moves and arms on its marker**: its moves (speed, jump speed, air jumps, glide, the wall),
  the contact window of its strike, and the weapon it fires. A starting power's move is already the pilot's rule, so it
  is read there.
