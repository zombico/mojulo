---
{
  "id": "mascot",
  "name": "Make a cartoon mascot (a promise on a head-heavy, round, big-eyed body that animates)",
  "summary": "A mascot rolled from a few words into a sheet (promise, form, accent, eyes, hook, extremities, energy, hue) and compiled to a rigged body: one to three heads tall, a round core with a spiky, round or blocky accent, big eyes, big hands and feet, an owned palette, an idle that never stands still.",
  "when": "\"a mascot for my game\", \"something cartoony like Sonic\", \"a Kirby-like round guy\", \"a cute platformer hero\", \"a team mascot\", \"a toon critter that bounces\", \"a plushie character that can animate\"",
  "entry": "create_character",
  "form": "character"
}
---
→ `create_character({ as: 'mascot', spec: { brief: 'a sonic-like mascot', facets?, seed? } })`. The facets (all optional; the brief and the seed decide the rest): promise (speed, cheer, mischief, might, comfort, pride, wonder), form (orb, sprout, toon), accent (round, spike, block: harmony or contrast), eyes (pair, joined, dots), hook (ears, quills, snout, tuft, antenna, tail, spines, none), extremities (nubs, gloves, paws), energy (bouncy, zippy, floaty, sturdy, swaying), hue. It mints a creature with clips idle, hop, cheer and wave, and the lean and tilt dials; revise it with `update_character` patch ops. To keep the design across games, `create_sketch({ kind: 'egocube', roll: { tuning: 'mascot', brief } })`, then `create_character({ egocube })`. A person in RPG proportions is card `hero`. Family: `get_creative_toolset({ form: 'character' })`.
