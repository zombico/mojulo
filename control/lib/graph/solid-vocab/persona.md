---
{
  "id": "persona",
  "name": "Persona (a hero who reads)",
  "family": "figure",
  "entry": "create_character",
  "summary": "A hero cast as a SPEAKER, the actor: a record pointing at a hero, with a voice, a delivery register, a playing style and a role, and the scripts it reads (a newscast, a briefing, a speech, a call, a character's lines), each a face take, captions and a body track.",
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
  style?:    'thespian' | 'action-star' | 'anime-mocap' | 'extra' | { from: 'thespian', face?, gaze?, gesture?, voice?, body? },
  role?:     { emote?, face?, status?: 'high' | 'even' | 'low' },
  reads?:    { <id>: { script, register?, style?, role?, seed? } }   // id a word: it names the face:<id> clip
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

## The actor: a style and a role

A persona is the actor: one kind of actor, a hero playing a role from a script. Its register is its role of speech. A
STYLE says how much it does and when, whatever the role. A ROLE says who the character is under the lines. With neither,
a read is the persona's as it always was.

Styles:

- `thespian`: big and readable, every stressed word carried by the hands, lines opened with the brows, the eyes held;
  crisp and unhurried.
- `action-star`: economy and stillness, little on the face but a tell (one brow, an appraising squint), the eyes
  steady, hardly a gesture.
- `anime-mocap`: a big clear face that snaps into place, a gesture a line, every line lifted.
- `extra`: small and quiet, never the lens, eyes wandering, no gesture to draw the eye.

A style sets the face's intensity and onset (`spontaneous` eases in, `posed` snaps), the share of lines opened by a brow
flash or showing a tell, how often a line is broken by a glance off and back, which moments a gesture marks and from
which words, and the voice's rate and articulation as factors on the register's. A tune is `{ from: 'thespian', face: {
intensity: 1 } }`.

A read played in a style is also ACTED by the body. Its gestures are played on the hero's rig from the actor's stand
(the arms hanging at the sides, found on that hero):
- each gesture peaks just before its stressed word;
- it is wound up and let go at the style's pace, each joint within its speed;
- the shoulder, then the elbow, the wrist and the fingers arrive in turn;
- the stand shifts its weight between gestures.

A skinned export (`export_model({ ref, format: 'glb', skinned: true, clips: '_all' })`) writes the body's take as
`act:<read>` beside the face's `face:<read>`, on the same clock. It carries the joints alone (no morph weights), and
`moj:act` names its gestures. Play it as the body clip under the face take, with the face's breath and head layers
added over it. The cue sheet names both clips. A read with no style is not acted, and the World page plays neither
clip.

The gestures, which a style's vocabulary names:
- `beat`: the baton on a stressed word;
- `offer`: the open palm;
- `point`;
- `shrug`;
- `cheer`;
- `clap`;
- `think`: the hand to the chin;
- `nod`, `headshake` and `bow`.

A role is `{ emote?, face?, status? }`: `emote` a held state under every beat (`rest`, `absorbed`, `waiting`,
`listening`, `wary` and the rest of the face's held states), `face` a resting emotion over the register's, `status` `high` (head up and still,
fewer glances), `even` or `low` (head down, more glances). A read's own `style` and `role` override the persona's.

## On a screen in a world

A world's `broadcasts` key stands screens in it, each playing one read on a loop: the news broadcast, a briefing on the
wall of a base, a scoreboard's caller. Set it on any world (a game's level, a room, a city) with update_sketch:

```
broadcasts: [{ persona: '<ref>', read: 'lead', at: [x, y, z], yaw?: 0, size?: [1.6, 0.9],
               title?: 'Evening news', strap?: 'Halden Bay', package?: 'network' | 'stadium' | 'arcade' | 'table',
               loop?: true, gap?: 2 }]
```

`at` is the screen's centre (metres, z up); at `yaw` 0 it faces −y. The screen draws the set in the package's glass, the
channel's bug, the reader as the body plays the read (a nod, a point, a bow on its gestures, its mouth on its words), the
lower third (its hero's name and the strap) for the first seconds, and the captions, on the read's own clock. The page
draws no talking face yet: the face's take is the persona's export (`face:<id>`); each screen says the fidelity its
world's era gives it (`face` in a gen-7 world with the realistic hero, else `body`).

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
