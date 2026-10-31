---
{
  "id": "persona",
  "name": "Persona (a hero who reads)",
  "family": "figure",
  "entry": "create_character",
  "summary": "A hero cast as a SPEAKER: a record pointing at a hero, with a voice and a delivery register, and the scripts it reads (a newscast, a briefing, a speech, a call), each a face take, captions and a body track.",
  "when": "Reach for this on 'a news anchor reads this', 'a narrator', 'a briefing before the level', 'a caster calls the play', 'have my hero read a script', 'subtitles for a line'."
}
---

A PERSONA is a hero cast as a speaker: its own record (kind `persona`) that points at a hero, carries a voice and a
delivery REGISTER (how it reads), and keeps the scripts it READS. One hero can be an anchor on one persona and a caller
on another; an edit to the hero's face shows on every persona that points at it. Made with
`create_character({ as: 'persona', spec })`, revised with `update_character({ ref, spec })` (reads merge by id).

Each read is a recipe: the script is kept, its timing regenerates. A read gives:

- a FACE take, the hero's `face:<id>` clip, where the face is drawn: a `gen-7` game and the realistic hero
  (`form: 'realistic'`, its relational head);
- its CAPTIONS (SRT and WebVTT, two rows of at most 42 characters, on the read's own clock), everywhere;
- a BODY track (nod, point, bow, shrug, think, cheer on stressed words, asides and the sign-off), everywhere. A gen-6
  game, or a hero that is not the realistic head, plays the audio, the captions and the body: never a face.

## Spec shape

```
spec: {
  hero:      '<a hero's ref>',                 // create_character { as: 'hero' }
  voice?:    '<a voice register's ref>',       // absent, the mouth is timed from the text
  register?: 'anchor' | { from: 'anchor', rate?, articulation?, gap?, stress?, gaze?, head?, body?, voice? },
  reads?:    { <id>: { script, register?, seed? } }   // id a word: it names the face:<id> clip
}
```

## The script

Plain text. A blank line starts a PARAGRAPH (a new story: a breath and the register's look, down to the notes or out to
the room). A sentence is a LINE (the mouth's unit and a caption's). `*word*` stresses a word; `[pause]` holds the
register's silence, `[pause 1.5]` so many seconds; `(…)` is an ASIDE, read lower in its own gaze. Numbers are said as a
reader says them: 4,000 "four thousand", 1984 "nineteen eighty four", 7:30 "seven thirty", 3-2 "three to two",
21st "twenty first", 3.5% "three point five percent". Nothing else is markup.

## Registers

- `anchor`: the newsreader: measured and clear, to the lens, leaning on the names and the numbers; a look down to the
  notes between stories. A nod on a stressed word and to close.
- `briefing`: the briefing officer: clipped and certain, to the lens, every number marked; short gaps, no smile.
- `speech`: the speaker at a podium: slow, every sentence given its room, a look out across the hall between paragraphs;
  a bow to close.
- `documentary`: the documentary narrator: unhurried and warm, little stressed, the lens held.
- `play-by-play`: the caller: quick, on the play and not the lens, the names hit hard, hardly a breath between calls; a
  cheer to close.

A tune is a register with its own dials: `{ from: 'anchor', rate: 1.1, gaze: { para: 'away' } }`. `rate` (1 about five
syllables a second) and `articulation` (0.6 mumbled to 1.4 enunciated) are more than 0 and at most 2; a gaze is `lens`,
`notes` or `away`. A read's own `register` overrides the persona's for that read.

## Worked example

```
create_character({ as: 'persona', title: 'Evening news', spec: {
  hero: 'anchor-hero', register: 'anchor',
  reads: { lead: { script: "Good evening. The storm that crossed Halden Bay left 4,000 homes without power.\n\nIn sport, the Harbor Kings won *again*, 3-2 at home." } }
} })
update_character({ ref: '<persona>', spec: { reads: { lead: { register: { from: 'anchor', rate: 1.05 } }, sport: { script: '…', register: 'play-by-play' } } } })
```

The door answers each read in short: its seconds, lines, words, the words it stressed, its caption count and gestures,
and where its face is drawn.
