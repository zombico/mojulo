---
{
  "id": "audio-beats",
  "name": "Mint audio — music or sound",
  "summary": "Synthesized WebAudio from a deterministic recipe: soundtracks, scores, grooves, sfx.",
  "when": "\"give this world music / a soundtrack\", \"compose a tune / a jingle / a fanfare\", \"make a beat / a drum pattern / a house groove\", \"a pickup / laser / impact sound\"",
  "entry": "create_beats"
}
---
→ `create_beats` — no media bytes stored; plays at `/sketches/<ref>`. Four kinds: `beats-ambient` (seeded generative loop — the world-soundtrack primitive), `beats-composition` (explicit score), `beats-pattern` (step-sequencer groove), `beats-sfx` (chiptune foley gestures). Find a kind by intent via `semantic_search({kinds:['beats_vocab']})`, read its manual via `get_beats_vocab`, then pass `params`. Wire into a world via the world manifest's `audio` channel (soundtrack / wind / gait footsteps / event-bus `sound:` cues).
