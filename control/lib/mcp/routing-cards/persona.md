---
{
  "id": "persona",
  "name": "Cast a hero as a speaker who reads scripts (a news anchor, a briefing, a speech, a caller; captions and face takes)",
  "summary": "A persona is a record pointing at a hero, with a voice and a delivery register (anchor, briefing, speech, documentary, play-by-play), keeping the scripts it reads. Each read is a face take where the face is drawn (a gen-7 game, the realistic hero), and its captions and the body's gestures everywhere.",
  "when": "\"have my hero read the evening news\", \"a newsreader for the TV in my level\", \"a mission briefing read to camera\", \"narrate this script in a documentary voice\", \"a sports caster calling the play\", \"subtitles for my character's speech\", \"the same lines read slower and warmer\"",
  "entry": "create_character",
  "form": "character"
}
---
→ `create_character({ as: 'persona', spec: { hero: '<hero ref>', voice?: '<voice ref>', register: 'anchor', reads: { lead: { script } } } })`. The script is plain text: a blank line a new paragraph, `*word*` stressed, `[pause]` or `[pause 1.5]`, `(aside)`; numbers said as a reader says them. Registers: anchor, briefing, speech, documentary, play-by-play, or a tune `{ from: 'anchor', rate: 1.1 }`; a read's own `register` overrides. Revise with `update_character({ ref, spec: { reads: { <id>: … } } })` (merged by id, null removes). The hero is a hero first (card `hero`, `form: 'realistic'` for a face). Manual: `get_solid_vocab({ id: 'persona' })`. Family: `get_creative_toolset({ form: 'character' })`.
