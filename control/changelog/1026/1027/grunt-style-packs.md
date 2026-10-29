### Grunt style packs: the crews a hero fights through

- The comic hero pack's grunts (`cosmos/packs/comic-hero/grunts.js`). Each FACTION is a style pack in the hero door's
  own words: outfit cards and their language, outfit pieces, the pack's headgear and its item cards. Nothing new is
  modelled. A faction names:
  - its KINDS, each with a dress, the builds and ages it is cast from, its gear lists, its heads and its stands;
  - its COLOURWAYS, a crew's colours shared by a squad, with per-grunt `vary` so a crew is not a row of clones;
  - the hair each pole wears.
- The factions (`GRUNT_STYLES`):
  - the street gang: corner, bruiser, shooter;
  - the crime family: soldier, enforcer, gunner, in suits cut by pole (a woman's trouser or skirt suit);
  - the shadow clan: blade, scout, staff;
  - the motorcycle club: rider, patch;
  - private military: rifleman, breacher, sentry;
  - the cult: acolyte, priest;
  - street punks: brawler, leather, the hair dyed in the crew's colours;
  - corporate security: guard, agent, response.
- `squadOrders(style, look, { count, seed, ratio, colourway, kinds })` casts a crew. Of `count` grunts,
  round(`ratio` × count) are women (`GRUNT_RATIO`, 0.3 by default), and a seeded shuffle decides which.
  `gruntOrders(style, look, { seed, index, kind, pole, colourway })` gives one grunt; one asked with no pole draws at
  that ratio.
  - Everything else is seeded dice over the faction's lists, drawn in a fixed order, so naming one choice never moves
    the others.
  - The face and ancestry are the egocube's own roll.
  - A woman's guard opens its rear elbow, as the rival's does.
  - The heads are the tiered body's; on the realistic body a grunt goes bareheaded. Never cel shaded.
  - A sleeveless top (the bruiser's tank, the punks') bares the arms on the realistic body only: the tiered body paints
    its skin under the cloth in the top's colour.
- Two item cards for the grunts (`items.js`): the drawn knife (a dagger in the fist, `thrust`) and the machete (the
  brutal sword, `chop`). The weapons with no builder are `GRUNT_GAPS`: a bat or club, a pipe or crowbar, a chain,
  brass knuckles, nunchaku, shuriken, and a submachine gun (the carbine stands in).
- Every faction, kind and pole validates on both bodies in each colourway (the deep sweep). One grunt of every kind and
  pole was minted through the door on the tiered body: all mint, none drops a piece. The door reads back:
  - the hardsuit-style small studs and the dial-extreme clearance the heroes show;
  - a waist sash or pouch belt meeting the hanging arms at rest on lighter builds, the known lithe-build issue.
