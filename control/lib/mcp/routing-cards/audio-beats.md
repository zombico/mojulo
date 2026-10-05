---
{
  "id": "audio-beats",
  "name": "Mint audio — music or sound",
  "summary": "Synthesized WebAudio from a deterministic recipe: soundtracks, scores, grooves, sfx.",
  "when": "\"give this world music / a soundtrack\", \"compose a tune / a jingle / a fanfare\", \"make a beat / a drum pattern / a house groove\", \"a pickup / laser / impact sound\", \"footsteps / a door creak / glass clink / fire crackle — foley for a world or game\", \"gunfire / a gunshot / shotgun / reload / rack the slide / a shell casing / dry fire — weapon sounds\", \"a blaster pew / plasma bolt / charge shot / laser — sci-fi weapon foley\", \"orchestral\", \"a string ensemble with pizzicato\", \"a 303 acid line\", \"a trance supersaw\", \"90s rave\", \"sidechain pumping\", \"a vocoder robot voice\", \"stadium rock drums\", \"an anime opening theme\", \"shonen rock\", \"J-rock\", \"energetic J-pop\", \"eurobeat\", \"trance pop\", \"nu-metal electronic\", \"a full song with verse, chorus and a key change\", \"country / honky-tonk / bluegrass\", \"a blues shuffle / a 12-bar / a slow blues\", \"a harmonica\", \"a guitar solo / shred / a guitar instrumental\", \"classical guitar\", \"flamenco\", \"gypsy jazz\"",
  "entry": "create_beats",
  "form": "audio"
}
---
→ `create_beats` — no media bytes; plays at `/beats/<ref>`. Kinds: `beats-ambient` (seeded loop, the world soundtrack), `beats-composition` (a score or a whole song), `beats-pattern` (step-sequencer groove), `beats-sfx` (foley; packs `foley-lab-2`, `foley-forest`, `armory`). Find a kind — or a ready-to-mint song from an attached recipe book, whose card carries `recipe: {kind, params}` — via `semantic_search({kinds:['beats_vocab']})`; read a kind's manual via `get_beats_vocab`, then pass `params`. Lead with the fidelity shelf (`grand-piano`, `-2` sections, `drum-kit`, `pan` + `room`); cards `beats-harmony`, `beats-grooves`, `beats-soloist`, `beats-orchestra`, `beats-articulations`, `beats-percussion`, `beats-synth`, `beats-effects`, `beats-field-orchestra` (game field and battle scores). Worlds: the manifest's `audio` channel. Full family → `get_creative_toolset({ form: 'audio' })`.
