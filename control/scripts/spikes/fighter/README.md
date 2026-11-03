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

## Against each other: the bout

`test-opponent.json` is a second fighter (Satoru, the slim codename, another face, blue trunks) who takes blows in his
guard (`guardHitHigh`, `guardHitBody`, …). `bout.mjs` squares the two GLBs up on one page; each exchange is one of the
attacker's punches into the defender's reaction, the defender stepped in until the glove's travel into contact meets
the first of his skin (his guard included), holding his stand until then and reacting from that frame. `bout-shot.mjs`
prints what each punch lands on, the range, the glove off his head's height and its speed, and shoots a sheet.

```bash
node .claude/skills/hero-live/live.mjs --hero "$(cat control/scripts/spikes/fighter/test-opponent.json)" --clips none --out /tmp/opponent
node control/scripts/spikes/fighter/bout.mjs --a /tmp/fighter/bare.glb --b /tmp/opponent/bare.glb --out /tmp/bout --serve
node control/scripts/spikes/fighter/bout-shot.mjs --out /tmp/bout --views side,close --at '[-0.06,0,0.05,0.2]'
```

What it reads today: every punch connects (jab and cross on his raised gloves at 1.3 m, the hook and the uppercut on his
gloves closer in, the body hook on his chest); no reaction yet tells a blocked punch from a clean one, and nothing keeps
the two bodies apart (folding over the body hook, his head goes into the attacker's shoulder).
