### Wolf Squadron's stages designed whole: the holo table, arcade score and medals, mana-ui

Wolf Squadron's game now runs like Rebel Storm's: on mana-ui in its own look, each stage designed whole, told on the
holo table as it loads, and approved there. It is tuned for arcade play, not a sim.

- **Its look** (`playscape/ui/theme-cards/squadron.json`, a new card in the `party` family). Night-blue plates cut at
  the corner, a cyan hairline, an amber call for what matters, capitals, menus that slam in on chevrons. Nothing is
  drawn across the way ahead during a stage. The rail's starter dresses its game in it (`ui: { theme: 'squadron' }`);
  the creator's own `ui` wins.
- **A stage's design** (`campaign/stage.js`), the arcade sibling of a mission's. It says:
  - its place;
  - its route (a canyon on a moon or rocks over it, its speed, its hazards `none` to `many`);
  - its waves (up to eight, each 1 to 6 fighters at a share of the way, in a `line`, `vee`, `echelon` or `swarm`);
  - its boss (1 to 6 guns round a core, light or heavy armour, a capital class for its miniature);
  - its medals (in points; by default shares of all the stage holds);
  - its briefing's steps.

  `readStage` says each fault by its field. `stageLaws` (advisory) checks five things: every wave and the boss shown
  before launch, the waves spaced, gold reachable, and a briefing short enough. `compileStage` lays its level.
- **The designer takes stages** (`campaign/designer.js`). A design that names a `route` is a stage, and a world's
  `missions` hold both kinds. Both are read, held to their laws, compiled and approved the same way. `design_game`'s
  readout names each one's kind, and its briefing is served at the game's books
  (`?book=briefing&mission=<id>`). A stage has no table editor: its table follows from its design.
- **The rail stage lays a design** (`skyscape/rail-stage.js`, `airspace.rail.plan`). The plan does four things:
  - puts its waves at their marks in their formations (a vee trails back from its point, an echelon steps back and up,
    a swarm is loose and weaving);
  - sets its hazards' spacing (or none);
  - rings its boss's guns round its core, heavy armour taking more;
  - carries its score.

  A stage without a plan is laid as before.
- **Arcade score and medals** (`gameworld/flight-goal.js`). A designed stage scores every fighter, gun and core it
  downs (the `score` mechanic, on the HUD). Its medal is read off the score as the boss goes down (the `grade`
  mechanic), and the shell remembers the best.
- **Told on the holo table** (`stageBriefingData`, the table's own data shape). It opens on the orrery (the system, the
  cluster, the moon), then the theatre: the route as a ribbon, the waves at their marks with their formations, the boss
  past the route's end, the orders with the points and the medals. It is held until Launch.
- **A level's briefing takes the keyboard as it opens** (Rebel Storm's too), so Enter steps the table from inside the
  game's shell without clicking into it.
- **Wolf Squadron's two stages are designed and approved** (`STAGE_DESIGNS`), so the rail lays them from their designs:
  - the Canyon run, down Red Canyon to a gunship;
  - the Debris field, through the Varn Shoals to a carrier.

  Both are won by the flight proof's attentive pilot and lost by a still one (the machine gate).
