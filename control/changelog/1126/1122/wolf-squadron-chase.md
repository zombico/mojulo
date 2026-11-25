### Wolf Squadron flown close: an arcade chase camera, the gear up

A rail stage's craft was followed by the free flier's long chase: about a quarter of its top speed behind (about 100 m
for Wolf Squadron's fighter), plus the chase's lag at speed, so a 12 m starfighter filled a sliver of the screen. A rail
stage now has its own close chase (`skyscape/rail-stage.js` `RAIL.camera`, laid by `gameworld/levels.js`):
- 30 m behind and 7 m above the craft;
- looking 60 m down the way.

The ship sits large just under the sights, with the way ahead and what comes at it in view. It is flown in, never off a
runway, so its landing gear is up. Other flight levels keep their chase.
