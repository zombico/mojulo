# A game's flow: what plays when

A game's flow says what plays when, from the first screen to the credits: its screens, its cinematics, its levels and
the beats between them, and where each one leads. It is one designed thing, the way a studio's flow diagram is, and it
is run by one piece of code, the flow runner in the play shell. Code: `control/lib/graph/game/flow.js` (the shape, the
reader, the default, the kernel), `control/lib/graph/game/play-shell.js` (the runner),
`control/lib/graph/gameworld/game-flow.js` (the studio's side).

## Who owns what

| Studio role | Here |
|---|---|
| Creative director: the final say | The person: approves or revises the flow chapter |
| Game director: the end-to-end flow | The main agent. The flow chapter (production) reads every department's page, so it is never handed to a subagent |
| Narrative designer: which beats, where | The story chapter: its moments, and the game's slots (opening, prologue, ending) |
| UX designer: the screens | The interface chapter: the front, the screen, the look |
| Level designers | The levels chapter |
| Engine programmers: the framework | The flow runner and the scene runner, core code |

"Director" names the role; the code is the flow runner.

## The shape

```js
flow: {
  start: 'title' | [{ when: 'unseen', go: 'opening' }, 'title'],
  home?: 'title',                       // where quitting a level and resetting progress go
  steps: {
    opening:  { kind: 'cinematic', scene: 'dawn', stage: 'vale', next: 'title' },
    title:    { kind: 'screen', screen: 'title', on: { play: 'prologue', continue: '$continue' }, idle: { after: 45, go: 'opening' } },
    prologue: { kind: 'cinematic', scene: 'setting-out', stage: 'vale', next: 'play', keep: true },
    play:     { kind: 'level', level: '$any', on: { won: [{ when: 'complete', go: 'ending' }, 'result'], lost: 'result' } },
    ending:   { kind: 'cinematic', scene: 'home-again', stage: 'keep', next: 'end' },
    result:   { kind: 'screen', screen: 'result', on: { next: '$next', again: '$again', home: 'title' } },
    end:      { kind: 'screen', screen: 'end', on: { done: 'title' } },
  },
}
```

- **Steps.** A `screen` is left by what the player picks there (each screen's events are `SCREEN_EVENTS`), or by its
  `idle` when it is left alone. A `cinematic` plays a scene on a level's page with control held and is left as the
  scene ends. A `cutscene` is a sequence made elsewhere and played whole, the affordance an opening is handed to: a
  `video` the shell plays over itself, or a directed `scene` on its `stage`, and with neither yet an empty slot the
  game passes at once; it is left as it ends, or at a skip (`skip: false`, unskippable). A `level` is left by its
  outcome (`won`, `lost`, `left`) or a door. A `hold` waits some seconds or for an event.
- **Targets.** A step, a special that resolves to a level (`$first`, `$next`, `$again`, `$continue`, `$picked`,
  `$travel`, `$door`, `$run`, `$run-next`), or a list of alternatives tried in order, one of which may carry a guard
  (`complete`: this win first completed the game; `unseen`: that step has never played in this save).
- **The reader** (`readFlow`) teaches each fault: an event a screen does not have, a step nothing reaches, a step with
  no way out, a special where it cannot stand, a cinematic staged on a level the game lacks, a kept cinematic not
  followed by its level, a cutscene that says both a video and a scene, and a loop of cinematics, cutscenes and holds
  with nothing for the player to press.

## A level step is a turn

One level session is a turn, in named phases (`control/lib/graph/game/turn.js`). The names are internal; the agent and
the person read set up, loading, play, pause and results.

| Phase | Who acts | What happens |
|---|---|---|
| untap | the player | the picks the level asks for, one at a time; back unwinds one |
| upkeep | the app | the picks checked, the seed, the load, the level started; its only screen is the loading one |
| main | the game | an optional start trigger, play, an optional end trigger |
| cleanup | the app | the outcome applied to the store, the save written, the unlocks worked out |
| end | the player | the results, and what next |

The pause is an interrupt: legal in play only, never a phase. A quit from it is a level left, through cleanup.

A level step says its turn in three optional keys; a step that says none plays as it always has:

```js
play: { kind: 'level', level: 'vale', on: { won: 'result', lost: 'result' },
  picks: [{ id: 'difficulty', from: { options: ['easy', 'normal', 'hard'] } },
          { id: 'squad', from: { slice: 'party' }, max: 2 }],
  start: { scene: 'arrival' },                 // as play starts, control held; once a save, never on a retry
  end:   { scene: 'farewell', when: 'won' } }  // once the outcome is known, before cleanup
```

- **Picks.** Each lands in the turn's session under its `id`. From `options` it is the game's own words (a
  difficulty, a mode). From a `slice` it is which members of a slice the level consumes go in; what is there, and
  what is locked and why, is the store's answer, never the screen's.
- **Triggers.** A `scene` the level has (scripted motion, talking) or a `video`. `skip: false` makes one
  unskippable. The end trigger plays on the outcomes its `when` names (won and lost when not said).
- **Exits.** A retry loads again with the same picks. A load that fails goes back to the last pick with its reason.
- **The kernel** (`buildTurnKernel`: `beginTurn`, `stepTurn`, `walkTurn`) is self-contained, to be inlined in a shell
  beside the flow kernel. It draws nothing: a shell draws each phase.

**The play shell runs it** (`play-shell.js`). A game whose steps say no turn carries no key and none of the kernel.

- The picks are drawn by mana-ui, one screen a pick, in the game's `ui` (the greybox when it says none). Back unwinds
  one pick, then leaves the turn the way it was come into. A pick of several is marked row by row and confirmed.
- The level is handed the game's own words as `params.__picks`, and of a consumed slice the members picked and no
  others.
- A retry (`$again`) and the pause's restart load again with the same picks.
- A start trigger that is a scene is staged on the level's page (`params.__stage`); a video plays over the held
  level. The pause does nothing while it plays. A save that has seen it does not see it again.
- An end trigger that is a video plays after the level's own end card, before the flow goes on; the store's write is
  already made by then, so closing the page mid-video loses nothing.

Not yet: an end trigger that is a scene is passed (a level cannot be told to play a scene after it has started); a
row is never locked (the store has no word for it yet); a quit from the pause is not recorded.

## How a game starts

Three things, in this order, each in its own place:

1. **The opening sequence** is the flow's, never the level's: ONE step before play, a `cutscene`, whatever it is made
   of (a video, a directed scene, nothing yet). A level does not open on a look at the world or a line of story; it
   assumes the cutscene has said what it had to. A game laid from a sentence starts IN PLAY (`flow: 'play'`,
   `startInPlay`): that cutscene, then straight into the game with no attract, title or prologue between, the save's
   level on a later boot. While the slot is empty the game boots into its first page; the title is still there, where
   quitting goes.
2. **The controls, with the hero in hand.** The first page a player walks starts by explaining the body's controls
   (moving, looking, the jump, the sprint), one at a time, each staying up until the player does it or its patience
   runs out, so nobody is held there. The arrival beat that teaches several verbs is that explanation
   (`level/guide.js` `lessons`; the page watches the pilot, `scene/channels/guide.js`). The camera is the hero's from
   the first frame.
3. **The enemy trail.** Then fights ON the way, in the walk's order, each where a fight's own controls are taught: one
   foe and the blow, then two with the lock-on and the dodge. The way out is HELD until they are won (a beat that
   `opens`: `gameworld/levels.js`), so the trail is fought, never walked round. Its foes COME to the hero (a hunting
   band's rank and file are pursuers: `docs/foes.md`), one fight at a time: the first is posted at the far end of the
   way, beyond its sight of the start, so the controls have their room and it comes down the trail once the hero
   heads up it; the next comes only when it has fallen (a beat's `after`: its foes are minted asleep and woken by the
   falls before it). The guide follows a fight by its falls, so its keys show where it is fought, not where its mark
   is; and the controls lessons give way the moment a foe is within a few strides.

The sentence door lays this as a world map's OPENING: its first block alone, a page of its own and no bigger than
those tasks (`gameworld/world-map.js`). The first zone after it tests what was taught and teaches nothing new.

## The default, and the story's cinematics

A game that says no flow has the one its front, levels, run, map and final level have always made (`defaultFlow`), so
it plays as it did. The story's moments in the game's slots are placed in it (story.js `GAME_SLOTS`):

- **opening:** before the first screen on a first boot, and again as that screen's attract loop when it is left alone;
- **prologue:** after New Game; staged on the first level, play goes on from the same page (`keep`);
- **ending:** after the game's first full clear, before the end card (a game with no end card: before its result).

The main quest's ending, when its beat is played as a story moment (`as: { scene }`), is the game's ending unless the
story has one of its own. A gameworld's own `flow` names its levels by the world's level ids; the game made of it plays
each as the ref of that level's first stage, and a cinematic whose scene is a bound story moment plays on the stage the
moment is bound to. The review shows either flow as a storyboard (`flow:sequence`).

A gameworld's `flow: 'play'` is the default started in play (above): its `opening` step a cutscene that plays the
story's opening moment where the story has one, and is an empty slot where it has none; the prologue and the attract
are left out (the opening is the one sequence before play), and the ending stays where a game plays it.

A cinematic's scene may be written as a screenplay: the cinematics department blocks it on its stage, shoots it by
the director's rules, has its cast act it and plays its slow motion on the world clock (docs/cinematics.md, "The scene
in a game"); the storyboard says which cinematics are scripts, and the story's report carries their director's notes.

## How it runs

The flow kernel (`buildFlowKernel`) is inlined in the play shell beside the store kernel. Every screen's buttons and
every level's end are events the runner steps on. Hand-offs wait on events, never on timers alone:

- `game-shown`: the level's first frame is drawn, so the loading veil lifts on a picture;
- `game-card-done`: the level's own end card is read (or put away, or it has none), so the flow goes on;
- `game-scene-end`: the scene a cinematic step staged has ended (or the level has no such scene).

A cinematic step launches its stage level with `game-init` params `__stage: { scene, skip? }`. Hosted, a level's scenes
wait for those params before any starts, and scenes heard together play one after another. The shell keeps which
cinematics a save has seen beside it, so an opening plays on a first boot, and forgets them only on a reset.

## Not yet

- Holding the world through a scene: the world freeze stops the clock the scene itself runs on, so a hold needs a
  narrower freeze (foes and hazards still, the scene's cast and camera moving).
- The arena shell and versus do not run a turn (above): their set-up screens are still their own.
- The arena shell, versus, tabletop, table-rpg and pixelizer keep their own screen machines.
- The play shell's screens are drawn by mana-ui only for a game with a `ui` (play-shell-mana.js: the look resolved,
  the game's languages; design_game writes it from a world's `ui`); without one they stay the shell's own DOM and the
  front's. Under mana-ui the pause panel is still the shell's, the theme's UI sounds are not played, and the title's
  key art is mana-ui's placeholder (its image component draws no picture yet, so the front's cover does not reach it).
