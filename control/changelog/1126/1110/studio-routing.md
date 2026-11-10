### The game studio says what a first session needs before the gate

One brief run through `design_game` twice showed the door let a game of several departments be built with no intent
on record, refused wrong words without naming the page's manual, and kept a run's advice inside each step. Three
changes to what the door says; nothing refuses that did not refuse before.

- **A book that stands on an intent says when it has none.** A gameworld with a hero, a main quest or a bestiary a
  hand wrote, and no ask on its ledger, carries `advice.intent` and leads `next` with `{ step: 'ask' }`. The call
  that cuts the ask answers it at once. A quick game and a composed world are one call by design and are left alone.
- **A game built with no ask is stamped.** A run that makes the game with no ask on record writes `unasked: true` on
  the game's entry in the gameworld's build ledger (`made.game`), and a run an ask links lifts it. The stamp is the
  ledger's alone: the game's row, its levels and everything that renders or exports are byte for byte what they were,
  and no game made before this is touched.
- **A refusal ends with the card its page is written from.** A refused gameworld page (`characters: hero.actions…`,
  `gameworld: foes.<id>…`) now ends `read first: get_game_vocab({ id: '<card>' })`, the card of the chapter that owns
  the path (`chapters.js`); a path inside a level names the level page's cards; a refusal that already names a manual
  is unchanged. The guide card says the book starts from a ticket (its ceiling re-pinned for the one line).
- **A run's advice is read whole.** Each distinct line a run's steps advised is lifted into `advice.run` as
  `{ says, steps }`, in the full and the changed readout; each step keeps its own.

New: `lib/graph/gameworld/routing.js` (pure). Still to come on this theme: a beat's words reaching the level laid for
it, a beat's foes offered to the level it names, and the plan verified before any level is walked.
