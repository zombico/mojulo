### A ground world's sky: the flight sky's cumulus over a walker

A walked world's gen-7 sky (the form channel's dome, and a geocity's) drew its clouds as one flat noise sheet. On a
clear, fair or hazy day it now carries the flight sky's own cumulus: domed and flat-based, the humilis, mediocris,
congestus and fractus mixed, in streets along the wind, lit as one body by the sun.

- **The weather** (`skyscape/sky.js` `groundCumulus`, `GROUND_SKY`): the land's `clouds` (`clear`, `fair`, `haze`, with
  its `cover` and `seed`) read as the flight sky's cumulus layer at a ground world's cover. A world with painted clouds and
  no weather is fair, else clear. Overcast, storm and high skies keep the sheet alone.
- **The puffs** (`scene/channels/cumulus-puffs.js`): the flight sky's puff layout, moved out of `flight-sky.js` so both
  pages inline the same function.
- **Sky space** (`scene/channels/sky-cumulus.js`): the clouds stand kilometres off, so each puff is drawn scaled toward
  the eye (its place and its size alike) inside the dome. It is drawn after the dome and before the land, so terrain,
  buildings and trees always stand in front. The clouds wrap round the eye, drift with the wind, and fade into the
  horizon's air. The canvas stays opaque under their rims.
- **The sheet** goes high and thin under them (`alt` 6000, a lighter cover), so it reads as cirrus over the heaps.
- Opt-in: the land's (or the geocity's sky's) `cumulus`. A page without it emits not one byte of the block, and the form
  sky's script is unchanged. `window.__formSky.cumulus` gives the puffs' count.
