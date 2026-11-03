# The test fighter

A fighting game's character from the hero door alone: the Toji muscular body (the `toji` codename and its muscle
shirt, on the anime frame it was drawn on), the realistic head (`head: 'relational'`, its rolled face, its skin painted
in the export), boxing trunks, gloves and boxing shoes, standing in the guard and throwing a boxer's basic punches
(`jab`, `cross` from hero-strike; `hook`, `uppercut`, `bodyHook` from hero-box, space boxer's strikes at an opponent's
chin and ribs) and taking a blow (`hitHigh`).

`test-fighter.json` is the spec, the door's own words. Play it as an engine gets it (the skinned GLB, every clip, the
face's morphs) under the viewer's key, fill and rim lights with shadows:

```bash
node .claude/skills/hero-live/live.mjs --hero "$(cat control/scripts/spikes/fighter/test-fighter.json)" --clips none --out /tmp/fighter
node .claude/skills/hero-live/live.mjs --out /tmp/fighter --reuse --serve      # http://127.0.0.1:8765/
# the punches at contact, side on (a punch's contact is its clip's `moj:move` contact over its seconds)
node .claude/skills/hero-live/shot.mjs --out /tmp/fighter \
     --shots '[{"variant":"bare","take":"jab","look":{"az":80,"el":5,"dist":3.4},"phase":0.44},{"variant":"bare","take":"hook","look":{"az":-30,"el":10,"dist":3.4},"phase":0.48}]'
```

A mint takes about two minutes (the realistic head and its face rig). The body alone, in its sections and girths:

```bash
node .claude/skills/body-study/body.mjs male --hero '{"head":"relational","animeBody":"toji","muscleShirt":{"definition":1},"face":{"seed":7}}' --crop arm
```

The machine gate is each punch's own (`heroBox(...).checks.laws`: landed within 5 mm, the knuckles square to the
approach, no servo past a stop, balanced) and the mint's warnings; the eyes gate is the operator's.
