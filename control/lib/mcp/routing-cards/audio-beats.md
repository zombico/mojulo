---
{
  "id": "audio-beats",
  "name": "Mint audio — music or sound",
  "summary": "Synthesized WebAudio from a deterministic recipe: soundtracks, scores, grooves, sfx.",
  "when": "\"give this world music / a soundtrack\", \"compose a tune / a jingle / a fanfare\", \"make a beat / a drum pattern / a house groove\", \"a pickup / laser / impact sound\", \"footsteps / a door creak / glass clink / fire crackle — foley for a world or game\", \"gunfire / a gunshot / shotgun / reload / rack the slide / a shell casing / dry fire — weapon sounds\", \"a blaster pew / plasma bolt / charge shot / laser — sci-fi weapon foley\"",
  "entry": "create_beats",
  "form": "audio"
}
---
→ `create_beats` — no media bytes stored; plays at `/sketches/<ref>`. Four kinds: `beats-ambient` (seeded generative loop — the world-soundtrack primitive), `beats-composition` (explicit score), `beats-pattern` (step-sequencer groove), `beats-sfx` (foley gestures — chiptune four + naturalistic grain/ring; worked reference packs `foley-lab-2` general, `foley-forest` outdoor ambience, `armory` weapons/gunfire/energy). Find a kind by intent via `semantic_search({kinds:['beats_vocab']})`, read its manual via `get_beats_vocab`, then pass `params`. Wire into a world via the world manifest's `audio` channel (soundtrack / wind / gait footsteps / event-bus `sound:` cues). Full family → `get_creative_toolset({ form: 'audio' })`.
