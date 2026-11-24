### A mixed fair-weather sky: wide cumulus with volume (not popcorn), of several kinds, altocumulus patches under the cirrus

The flight sky's cumulus read as popcorn: heaped clusters of small round puffs, about as tall as they were wide. Seen
from under them, their bellies stacked into horizontal slabs. They now read as fair-weather cumulus, wide and flat-based
with a heaped dome, across every game under the flight sky (Wolf Squadron's ground stages, Pilot School, any airspace
level).

- **Wider, still deep** (`skyscape/sky.js`): fair weather's are 900–2200 m across and 450–1100 m deep, where they were
  450–1300 and 350–800, so there are fewer, broader clouds for the same cover, each with its height. A hazy day's small
  cumulus are widened alike.
- **One domed body, not a heap** (`scene/channels/flight-sky.js`):
  - each cloud is a dome: a broad low body over its base, then puffs heaped toward its middle as it climbs, a rounded
    crown;
  - it is drawn out a quarter longer along the wind;
  - its puffs are larger and overlapping, and softer at the rim;
  - it is lit as one body by the sun and its height (bright up its sunward tops, shaded under its belly), so the volume
    reads and the puffs do not read as balls.
- **No slabs under them.** Each puff is a camera-facing card, and the flat base cut each card where it crossed the base
  height. Seen from below, the tilted cards met the base at different heights on screen and stacked into slabs. A fair
  cloud's low puffs now sit higher over the base and fade into it over 45 m, and the belly's shade is the cloud's own
  depth, not each puff's.
- **Of several kinds** (`skyscape/sky.js` `CUMULUS_KINDS`): each fair cloud is one kind, by its own dice, so the sky is
  mixed rather than one cloud repeated:
  - humilis: flat and wide;
  - mediocris: the domed heap;
  - congestus: the odd one climbing, kept under a thunderhead's height for its width;
  - fractus: small ragged bits.

  Each kind is the same builder at its own proportions.
- **Altocumulus at mid level** (fair weather's new middle layer, the deck primitive's altocumulus at 4200 m). A few
  fields of small cells sit between the cumulus and the cirrus. An altocumulus deck is now one sheet at its middle, not a
  base and a top 180 m apart that showed its pattern twice from under it. From below it is pale with the sun through it,
  each cell's middle a little darker, not a thick deck's dark belly (a high-cloud day's too). A fair day's report says
  it: `FEW036 SCT138`.
- A storm's towering cumulonimbus keeps its shape: its puffs stay round, its foot cut flat.
