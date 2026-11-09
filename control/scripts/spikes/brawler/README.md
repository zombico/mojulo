# The brawler

A brawl is the fight's sim opened up: many bodies down a street with depth (`lib/graph/brawl/`).

`belt.mjs` builds a greybox street (`brawlLevel`) and shoots it from its belt's locked angle at each screen's middle,
and from every other angle at the first held screen, with stand-ins a body's size for scale; then the belt laid in the indoor level's rooms (`kind: 'stage'`) on each kit, at
the first screen and where the camera holds at the first gate (`--only greybox|stage`, `--kits a,b`); `sheet.png` holds
them all.

```bash
node control/scripts/spikes/brawler/belt.mjs --out /tmp/brawler-belt
```

The machine gate is `lib/graph/brawl/brawl-belt.test.js`; the eyes gate is the operator's.
