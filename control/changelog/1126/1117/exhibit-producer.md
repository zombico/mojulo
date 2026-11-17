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
- **The start** (`exhibit/producer.js`; the door: `get_exhibit({ start: { concept?, people?, time?, brought?,
  wants? } })`, read-only). A person with a concept to display is answered before anything is made: the four
  questions only they can answer, in order (what people should leave understanding, who it is for, how long they have
  with it, what material they bring), each dropped once answered, and `producer.ask`, the one to ask this turn. With a
  concept, `place`: the exhibits whose own words it uses, most first, the one it names ahead of a hub that mentions
  it (a heuristic over words, said to be one: the agent picks, or searches); where none matches, `uncovered` says to
  search, to compose a demo from laws, or to say that nothing makes it before anything is built. With their time,
  the fit. When all four are answered, `make`: the fit's door, said back first, the stops and claims written from
  what they said and never for them. A plain request to see something (a concept and nothing of people, time or
  material) is marked `plain` and made at once. It builds and stores nothing; without `start` the door reads as it
  always did.
