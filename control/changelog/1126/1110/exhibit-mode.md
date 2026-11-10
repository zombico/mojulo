### Exhibits: interactive pieces for a museum, a classroom or an encyclopedia

Planned on this branch. The first three pieces are built (one door for exhibits, the tour, and rooms with a kiosk);
the lines after them are still plans, and each is rewritten as it lands.

- **One door for exhibits, arranged in halls.** The science, space, earth, life and mathematics study objects, the
  science demos built from laws and the historic cities at their period are all asked for in one place, by hall:
  `science/fission`, `earth/hydro`, `life/dna`, `math/derivative`, `history/pompeii`. A hall lists what it holds, an
  exhibit's card is its manual (a historic city's entry still says what is known, reconstructed or conjectured), and a
  made exhibit's measurements are read back in real units from the same place. The separate tools for making a study
  object and for measuring one give way to it, so the list of tools your agent reads gets shorter; their old names
  still work for a release. Kept setups in your cookbook are recalled by their hall too. Everything already made looks
  exactly as it did. The manuals for building a world (its bases, stage kits and looks) stay where they were.
- **A tour you step through.** An exhibit, or any world, can carry stops. At each one the camera glides to a view, a
  caption explains, and the part being talked about is lit while the rest dims; the stop can say how sure it is
  (known, reconstructed or conjectured for history; simulated, depicted or explained for science) and where its claim
  comes from. A panel along the bottom has the way back and on and a dot for each stop; the arrow keys and a swipe step
  it too, and a link can open on any stop. A toured page looks like an exhibit rather than a workbench: it fills the
  window, a phone's or a kiosk's, its title stands quietly in the corner, the camera and wireframe buttons step aside,
  and on a plain background the subject glows softly in the colour of the part each stop is about. Give the stops when you ask for the exhibit, or add them to one you have; a stop that names a
  camera or a part the exhibit does not have is refused, with the ones it does. A historic town is drawn as one piece
  for now, so its stops move the camera but do not light a building yet.
- **Rooms and a kiosk.** Several exhibits join into one gallery, with no score to win and no way to fail: a lobby
  with a card for each room (its hall, its title, how it opens, how many stops), and each room its exhibit, with the
  way back and on to the next. A gallery remembers its rooms, not copies of them, so improving an exhibit improves
  every gallery it stands in. On a kiosk, a single exhibit or a whole gallery plays itself when nobody is touching it,
  each stop held as long as its words take to read, a gallery walking from room to room, and it hands itself to the
  next visitor the moment they touch the screen, in large type with nothing to select by accident. A gallery saves as
  a folder that opens with no internet and no server, the form a kiosk wants.
- **A check made for exhibits.** An exhibit has nothing to win, so it is checked the way a label wall is: does it tell
  a story, does each stop say how sure it is, does a claim taken from the historical record say where it comes from
  (a warning when it does not), can each caption be read in the time a visitor gives it, and does every stop show its
  subject on the screen. It advises and never refuses; whether the exhibit looks right is yours to judge, and whether
  a claim is true is the expert's.
- **The expert's brief.** A curator or teacher says what a visitor should leave understanding, for a child, a general
  visitor or a specialist, and lists the claims with their sources. The exhibit's catalogue sets out every claim, where
  it comes from, and what is real and what is drawn. The expert signs off the claims. The agent never claims it has.
- **Prepared states.** Switch an exhibit between states it has ready, such as a dam's stages or a city in two different
  years, with a toggle or a slider.
- **Narration, when a voice is installed.** Each stop's caption can also be spoken. Without a voice, the captions
  carry the tour.
- **Two exhibits to start.** Pompeii in 79 CE, and how hydroelectric power works.
