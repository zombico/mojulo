### The home's producer: a house or a room offered as a start, produced before it is made

- **A fifth start.** A visitor with no ask is offered five starts: a character, a game, an object, a 3D exhibit, and a
  home or a room. The `initialize` preamble and `forward_context`'s line for a visitor with no ask say it; for
  someone's own home the agent is its producer first, and a plan or a photo they send is read, never asked for.
- **The rails** (`home/rails.js`): what a home starts from, one row each, least first: a room redone, the home you
  have (your plan built to the inch, every room you name designed, walked through), a house from nothing, the set to
  build from (drawings, frame, schedules, IFC), and a shop or a café fitted out. A row names into what is built (its
  doors, the house's outcomes, its vocab cards, the questions it asks, the first look the person approves) and copies
  no number. What no rail does is said before anything is made: no prices, no permit or code sign-off, no structural
  engineering. Where a made home can go next (a game level, a piece made to build, an engine) is offered once, after
  the first look.
- **The start** (`home/producer.js`; the door: `mint_building({ start: { what?, place?, living?, look?, brought? } })`,
  asked alone). It builds and stores nothing. First what they want to make (the agent reads their words as the rail),
  then the rail's own questions in its order, one a turn, each dropped once answered: their place (a plan,
  measurements, a photo, or a house already made here), who lives there and how (bedrooms, a room's jobs, the rooms
  that matter), what it should feel like (their words; the agent names the style card), and what else they bring. A
  café's question is who comes, not who lives there. A plain ask (a rail and a look, nothing of their place, their
  household or their material) is made at once. When the rail's questions are answered, `make`: said back first, then
  the steps.
- **The hand-off** (`homeHandOff`, the `make` step's `steps`): the calls that make it, in order, with what was said
  filled in: the house from their plan (never a room the plan does not have), its `next` read as its machine gate,
  each room they named by `design_interior` in the style read from their words, the review's refusals and gaps
  mended by piece id, the walkthrough (`forge_motion` a room each, then `stitch_motion`), their look, and the offers.
  It proposes and runs nothing. The home you have is the README's decor session: a test holds the hand-off's calls to
  the calls that session made.
- **The intake** (`home/intake.js`): what the person brought, read before they are asked anything it says. Each kind
  (`HOME_INTAKE`: a floor plan, measurements, a photo of the room, pictures they love, furniture they keep, what
  cannot change, a budget) says what takes it and the questions it usually answers; a new kind is a row. Each thing
  is recorded with where it went or why it has no place; nothing brought is dropped. A budget has no place: mojulo
  prices nothing, and the furniture schedule is what they price from.
- **Said where a house is chosen.** A routing card of its own, `home-producer`, takes the phrasing of someone with a
  home of their own ("we just moved in, here is our floor plan", "I want to redo our bedroom but don't know where to
  start"); the plain asks stay the `interior` and `house` cards' and are made at once. `mint_building`'s description
  and its line in the tool index name the start; the interior card and the HOUSE row send someone's own home to it;
  the building form says it.
- The tool list's payload pin is raised for `start` (an argument on the door that owns the house intent, `required`
  emptied so it may be asked alone), and `forward_context`'s body ceiling for the fifth start, each with its reason
  beside the pin.
