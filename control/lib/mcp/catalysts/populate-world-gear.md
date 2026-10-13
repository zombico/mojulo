---
{
  "id": "populate-world-gear",
  "name": "Populate a world's starter gear: its hero's, its civilizations', their mirrors and shadows",
  "summary": "Fill a gameworld's starter gear from what it already says, dressed by the technology that makes it. Every functional model is technology: a civilization's gear speaks its technology direction's language (its motif picks the style card, its setting the metals, its element the stone, its team colour the grip and the shield's board). A world grows its stock by TRANSFORMS, not models: a MIRROR is a rival's answer to the hero's gear, a CONTRAST is an item's shadow in the opposite motif, an AUGMENT grows tiers by rule. Turn it on with `equipment.populate`, preview the stock on a shaded sheet, read the tasks it leaves, and let the run make it once the stats exist.",
  "valueHook": "Name your civilizations and your hero's gear once, and the world fills itself with equipment that belongs to it: each faction's weapons in its own language and colours, the enemy's answer to every item you carry, and a shadowed twin of each, ready to mint when the stats are set.",
  "version": 1,
  "category": "world-building",
  "tier": "fill",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "world", "prompt": "Which gameworld? (an example, a stored one, or a prompt to compose one)" },
    { "name": "transforms", "prompt": "Which transforms: mirrors, contrasts, augment (all by default)?", "default": "all" }
  ],
  "mcpTools": { "mojulo": ["compose_world", "design_game", "semantic_search"] },
  "outputContract": { "summary": "The world's equipment set to populate, its starter stock previewed and listed with what each came from, the tasks and requests it leaves, and the mints its run will make once ready.", "fields": ["entries", "tasks", "requests", "sheet"] }
}
---

# Populate a world's starter gear

`design-tech-family` grows the generators. This catalyst runs them over one world: it reads what the world already
says and fills its stock, so a world does not invent its loot, it derives it.

## 1. What the world must already say

Everything is read from the world, in `control/lib/graph/gameworld/world-gear.js`:

- **The hero's gear.** The equipment table's filled rows (`equipment.js`), seeded by the hero's adornment (an item
  exists because a power needs it).
- **Each civilization's technology direction** (`tech-direction.js`): its motif, its setting (what it is made of,
  `mech-kit.js`), its elements and its team colour. A civilization that makes no technology makes no gear.
- **Each civilization's crafted held weapons** (`technology.weapons`, the words a crafter reads). A held weapon
  carried as an equipment class (dagger, sword, greatsword, staff, bow, shield) is built. One the kernel has no class
  for (a carbine, a lance) becomes a TASK.
- **Its links' keys**, which become requests for a prop shelf.

If a civilization's gear should differ, change its direction, not the gear: the direction is the one place a
civilization's language is said.

## 2. Turn it on

```
equipment: { populate: true }                                       // every transform
equipment: { populate: { mirrors: true, contrasts: false } }       // choose
```

Absent, the world adds nothing: its bible, graph and run are byte-identical.

## 3. Read what it filled

The character bible's equipment section gains **Starter gear**: each entry with its class, slot and tiers, where
it came from (`hero`, `civilization`, `mirror` of an item, `contrast` of an item), its style card and why. Then
**held weapons with no class yet** (the tasks) and **props it asks for** (the keys).

- **Mirror:** a civilization's answer to the hero's item. The same class, slot and tiers, in its language.
- **Contrast:** an item's shadow. The opposite motif (smooth ↔ spiked, faceted ↔ organic, riveted ↔ ornate),
  made by the same civilization.
- **Augment:** tiers grown by rule (ornament, stylization, the stone's glow) for gear nothing tiered.

## 4. Look at it

```
node scripts/gear-sheet.mjs --example halden-reach
node scripts/gear-sheet.mjs --auto "a riveted steampunk frontier and a gilded elven court" --only mirror,contrast
```

The sheet draws each entry shaded, its metals in their measured colours. Look for:
- each civilization reading as one family across its gear;
- the team colour on the grip and the shield;
- each mirror recognisable as the same item;
- each contrast reading as its shadow.

This is the eyes gate: say what you saw.

## 5. Let the run make it

The stock is made with the equipment table, on the same readiness: once the game's stats exist. Until then the
run plans one `stock-<id>` mint per entry (`gearOrders`), and the bible says what it is waiting on.

## 6. Grow what it could not fill

- **A task** (a held weapon with no class) is `design-tech-family`'s code rung: a new class in the equipment kernel.
- **A request** (a key) waits for a prop shelf.
- **A look that is wrong for a whole civilization** is its direction's to change.
- **A look that is wrong for every civilization** is a rule's (`GEAR_MOTIFS`, `MADE_ROLES`, `CONTRAST_OF`):
  change the rule and every world follows.

## Pitfalls
- **Language at the source.** Don't author per-item styles for derived gear: the direction is the source. Author
  the hero's items and the civilizations' words, and let the transforms derive the rest.
- **Many mirrors.** Mirrors grow as hero classes × civilizations. A world with many civilizations may want
  `mirrors: false` until rivalries are said.
- **Stats come later.** The tiers say how an item looks at each stage, never what it raises. That is the
  systems' (`mechanics`).
