### The exhibit's producer: a concept fitted to its people and its time before anything is made

In progress. Each line is added as its phase lands.

- **The producer faces the person with a concept to display** (an educator, a curator) and asks only what they alone
  can answer, one question a turn: what people should leave understanding, who it is for and at what degrees of
  learning, how long they have with it, and what material they bring.
- **The fit, said back before anything is made**: what their time and people hold (one exhibit, a toured one, one at
  several settings, a gallery of rooms; how many stops). A plain request to see something is still made at once.
- **Their knowledge stays theirs**: the producer records what they said and lists what is open; it never writes a
  claim or a source for them.
- **The fit** (`exhibit/fit.js`, `exhibitFit({ time, people, wants })`): what a span of time and its people hold, as
  the size of what is made and a budget of stops. Time is a word a person says (`TIMES`: a glance, a visit, a sitting)
  or seconds or minutes. The size is the least the time holds: one exhibit with one sentence, a toured exhibit, or a
  gallery of rooms once the time is longer than one room holds a visitor (`ROOM_SECONDS`); an exhibit at several
  settings rides beside it when they want to show what changes. People (`AUDIENCES`) are a caption each at every
  stop: words to write, no time added. It names three depths of attention it serves (the glance, the visit, the
  study) and says the fit in a line. Its arithmetic is the tour's own (`holdSeconds`), so a fit's stops played as the
  exhibit's audit plays them fit the time they were called for: a test holds that. A stop count is a ceiling, read
  end to end. Advice, never a refusal.
- **The start** (`exhibit/producer.js`; the door: `create_exhibit({ start: { concept?, people?, time?, brought?,
  scales?, wants? } })`, asked alone). A person with a concept to display is answered before anything is made: the four
  questions only they can answer, in order (what people should leave understanding, who it is for, how long they have
  with it, what material they bring), each dropped once answered, and `producer.ask`, the one to ask this turn. With
  their time, the fit. When all four are answered, `make`: the fit's door, said back first, the stops and claims
  written from what they said and never for them. A plain request to see something (a concept and nothing of people,
  time or material) is marked `plain` and made at once. It builds and stores nothing; without `start` the door reads
  as it always did.
- **The exhibit is made new.** The agent composes it from the primitives a world is made of, for this person's
  concept. The halls' exhibits are samples of what one is like (how a tour steps, how a part is lit, how a claim is
  graded), read for their form (`like`) and never offered as the thing to make: nothing matches a concept's words to
  the catalog. A fit's sizes say how each rides a world made new: a tour and a curation are opt-in keys of any
  world's recipe, a prepared state and a gallery's room are any world.
- **The intake** (`exhibit/intake.js`): what the person brought, read before they are asked anything it already
  says. Each thing is recorded with what it says and where it went (`EXHIBIT_PLACES`: the aims, the claims, the
  stops, the rooms, reference) or why it has no place yet; nothing brought is dropped. Its kinds (`EXHIBIT_INTAKE`:
  learning goals or a lesson plan, label text, sources, a list of topics, pictures, a programme) each say what takes
  it and the questions it usually answers; a new kind of material is a row. The start reads it as `brought`: a
  question their own material answered is never asked, its step says `read` (the agent writes the answer from the
  item and calls again), and `intake` reads back what was placed, what was set aside and what is still open. A
  source is never a claim until they say what it shows. It records and never authors.
- **Kept with the exhibit**: a curation may carry `brought`, the record as read, so the next session knows what was
  brought. A curation without one is as it always was.
- **The scales** (`exhibit/scales.js`): the first primitive of an exhibit, the size of the thing it shows. The human
  point of view is the base (what a person could stand beside); below it the micro, the atomic and molecular, the
  subatomic; above it the macro (the bigger view from above), the geo (a geocube: terrain modelled), the planetary
  (its own views), outer space. The two ends are conceptual. Two things stand beside the ladder with no rung: a
  place in history (the historical views: a real place at its period, where the historic cultures are the primitives
  of what can be shown, Pompeii and Sumer among them) and an idea, which has no size. Each
  rung says what it shows naturally (the tour's own shapes: a structure, a process, a quantity), how a world at it is
  made new, the law tables that can compose it where there are any, and the samples in the halls that are like it.
- **The exhibit determines its scale.** The agent reads the concept and names the rungs it lives at (`start.scales`,
  its home first): never a question for the person. A concept that spans rungs is a room a rung, and the fit's rooms
  are the rungs unless they asked for a number of their own.
- **The map** (`map` on the start, once there is a fit): a spine and its sequences. One page stepped through, or a
  lobby of rooms each stepped through in order, each room's scale and stops, and between rooms at different scales
  the way the visitor zooms (in, out, or aside to an idea). Nothing branches.
- The tool list's payload pin is raised for `start` (an argument on the door that owns the exhibit intent), with its
  reason beside the pin.
- **The camera's own words** (after the camera work landed). A rung says how a room at it opens (`view`: a size by
  how much of the frame the thing fills, an angle: the macro is the wide view from above, the geo a map of the place
  from overhead), and the zoom between two rooms names the camera's move for it (a push in, a pull out; a crane up to
  a view from above, a crane down from one; aside is a cut). The words are the shoot plan's own tables; a test holds
  them to those tables.
- **The hand-off** (`exhibitHandOff`, the `make` step's `steps`). Once the four are answered and the fit is said
  back: the steps that make it, a room at a time. A room's world made new at its scale (how it is made, how it
  opens, the samples like it, its parts named so a stop can light them); its tour and curation set on it (how many
  stops the time holds, the first standing alone, each caption said again for each audience); the states where they
  want to compare; the rooms joined, with the move between each two; then the machine gate and the person's look. It
  proposes and runs nothing. The curation it carries is what was said (the audiences, what was brought); the aims
  and the claims are marked theirs: none is written for them.
- **Said where the exhibit option is chosen.** The start is an argument of `create_exhibit`, the door that owns the
  intent of making an exhibit (it began on `get_exhibit`): its first call builds nothing and says what to ask, as
  `design_game`'s does. `forward_context`'s WORLD row sends someone's own people to its `start` first; the exhibit
  form says an exhibit is made new at its scale and that the halls hold samples; `create_exhibit`'s line in the tool
  index says the start. A routing card of its own, `exhibit-producer`, takes the exhibitor's phrasing (a class, a
  gallery's visitors, a lesson plan brought) and carries the producer's steps: ask, scale, fit, make. The plain
  "show me" ask stays the `exhibit` card's and is made at once. `forward_context`'s body ceiling is grown for the
  row, with its reason beside the pin.
- **`CLAUDE.md` kept light**: a pointer to the exhibit producer's modules, and the game producer's paragraph and
  architecture entry cut to pointers. The steps live in the routing cards and the readouts.
- **A tour's contact sheet** (`create_exhibit({ contact: '<ref>' })`; `exhibit/contact.js`, `motion/tour-contact.js`):
  every stop of a made exhibit's tour as a visitor meets it, a row a stop, on one PNG in the exhibit's outcome folder.
  The exhibit's own page is opened, each stop seated and photographed (its view, the part it lights, its caption on
  the plate), the rule of thirds over each frame, and under it how long the stop is held and how much of the view its
  lit part fills, in the camera's own words; the page audit's findings ride beside the stop they are about. The page
  is the truth: it already seats and measures each stop, so nothing is solved a second time. It is what the agent
  looks at first and what the person with the concept is shown before the tour is finished; whether it reads is the
  eyes gate, theirs. The hand-off carries it as a step (`sheet`) between the machine gate and the person's look.
  A gallery or a states page is asked for a room at a time.
