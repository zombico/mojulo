---
{
  "id": "tour",
  "name": "A tour: stops a visitor steps through, each a camera, a caption and the part it is about",
  "family": "world",
  "entry": "compose_world",
  "summary": "Stops on any world, an exhibit's above all: at each the camera eases to a view, a caption explains, the part talked about is lit while the rest dims, and the stop can say where its claim comes from and how sure it is. A plate along the bottom with the way back and on, a crumb a stop, the arrow keys and a swipe; the page fills the window.",
  "when": "Reach for this on framing like 'walk the visitor through it step by step', 'a guided tour of the cell', 'stops that each explain one part', 'show the turbine, then the generator, then the lines', 'an exhibit you click through', 'a museum interactive with captions', 'highlight each part as you explain it', 'say where this comes from on each step', 'a step-by-step explainer of the dam'."
}
---

A tour is a key on the recipe, not a kind: give it with `create_exhibit({ id, params, tour })`, or set it on any stored world
and patch it in place (`update_sketch` `set /tour`, `set /tour/stops/1/caption`). It is checked against the world it rides
before anything is stored: a stop's camera must be one the world has, a lit group one it draws, and a refusal names
what it has. Nothing renders without it. With it the page is an exhibit, not the editor: it fills its window (a phone's,
a kiosk's), the tour's title stands as a quiet label, the camera buttons and the wireframe toggle give way to the
crumbs, and a world on the plain studio ground gets a ground of its own, a glow behind the subject in the colour of what
each stop lights (a world with a sky keeps it).

## The recipe

```
tour: {
  title?,                         the plate's heading
  start?,                         the stop the page opens on: its index or its id (default the first)
  stops: [{                       one stop or more, up to 24
    id?,                          lowercase, digits and dashes (default s1, s2 …): the crumb's handle, ?stop=<id>
    title?,                       the stop's heading
    caption,                      what it says: a sentence or three, plain words (up to 700 characters)
    camera,                       where it looks from, one of:
                                    '<name>'            a camera the world already has (the page's buttons)
                                    { pos, target, vfov? }   placed, in world units, z up
                                    { frame: '<group>' | ['<group>', …], from?: threeQuarter | front | side | top }
                                                        fit to those groups from that side
    highlight?,                   '<group>' or a list: lit; the rest dims ('body' lights 'body:hair' too)
    shape?,                       how it explains (the deck's grammar): ladder | process | structure | stratified |
                                  quantity | formal
    cite?,                        where its claim comes from: a source or several (up to 6)
    grade?,                       how sure it is: attested | reconstructed | conjectural (a record's words) or
                                  simulated | depicted | explained (a science scale's words)
  }]
}
```

The groups and cameras a world has are in the refusal when a stop names one it lacks; a study object names its parts
(`org:mitochondria`, `dam`, `turbine`). A historic town draws as one group today: tour it by camera and frame, not by
highlight. A shader exhibit (raymarched) takes no tour yet.

## Telling it well

- One idea a stop. The caption says what the visitor is looking at and why it matters; the next stop builds on it.
- Light what the caption names, and only that. Frame what is small; a world camera for the whole.
- Grade what you claim, and cite it: a museum's visitor may ask how we know. Never grade above the record: a
  reconstructed street is `reconstructed`, a drawn ion channel is `depicted`.
- A stop is opened by `?stop=<id>` (or its number); `window.__mojTour` steps it on the page.

## A kiosk

The same page is a kiosk when its address says `?kiosk=1` (or `?kiosk=<seconds>` for the idle time; 90 by default):
large type and touch targets, nothing to select, and the attract loop. Left alone, it goes back to its start and plays
itself, each stop held as long as its caption takes to read (7 to 20 seconds), with "Touch to explore" over it; a touch
hands it to the visitor. Never in a capture.

## A gallery

Several made exhibits, joined as the rooms of one: `create_exhibit({ rooms: ['<ref>', …], title, params: { intro,
kiosk } })` (`kiosk: true`, or `{ idle: seconds }`). It stores refs only, so improving an exhibit improves every gallery
it stands in. Its page (`/api/sketches/<ref>/gallery`) is a lobby, a card a room (its hall, its title, its first
caption, its stops), and each room its exhibit's page framed, with the way back and on. As a kiosk the gallery walks
itself when left alone: the lobby a moment, then each room's tour played to its end, room after room. Change its rooms
with `update_sketch` (`set /rooms`). `export_model({ ref, format: 'html' })` writes it as a folder that opens offline
(index.html, and rooms/<ref>.html each a self-contained page): the kiosk's form.

## Prepared states

One exhibit at several settings, switched in one page: a dam at three water levels, a cell before and after it divides,
a city in two years. `create_exhibit({ id, title, params, states: { label, control?, of: [{ label, params, caption? }] } })`
makes one exhibit a state (its `params` over the shared ones) and one recipe over them (kind `exhibit-states`), served
at `/api/sketches/<ref>/states`. `label` names what changes ("Head"); each state's label is its value ("30 m") and its
caption what is different about it. The control is a toggle for two or three states and a slider for more, unless
`control` says (`carousel` steps round). Switching keeps the camera where the visitor left it; the arrow keys step it,
a kiosk (`?kiosk=1`, or `kiosk` in `states`) steps through them on its own. Nothing is computed live: each state is a
made exhibit, deterministic. It exports as a folder (`export_model`), and a gallery can stand it as a room. The check
asks for the axis's label, a caption a state, one exhibit throughout (a mixed set warns: the kept camera may look at
nothing), and a control that suits the count.

## The brief: the expert's half

The studio owns the craft; the expert (a curator, a teacher, a museum's educator) owns what the exhibit claims and whom
it is for. Write it with them as `curation` on the exhibit (`create_exhibit({ id, tour, curation })`, or `update_sketch`
`set /curation`) or on a gallery (`params: { curation }`, the whole wing's aims):

```
curation: {
  aims: ['…'],                         what a visitor should leave understanding (one to six)
  audiences?: ['child', 'specialist'],  who it is told for besides everyone
  claims?: [{ id, text, cite, grade }], what it states as fact, each with its sources and how sure it is
  expert?: { name, role? },             who answers for the claims, as the operator names them
}
```

A stop says a claim with `claims: ['<id>']`; when it gives no grade or cite of its own it takes the least sure grade
and the sources of its claims. A stop says its caption for another audience with `captions: { child?, specialist? }`
(the caption is everyone's); the page then offers the switch ("Everyone · Young visitors · In depth", `?audience=`),
a gallery carries the choice room to room, and a kiosk's next visitor starts with everyone's words.

**The accuracy gate** is the third gate, beside the machine's and the eyes': whether a claim is TRUE. It is the
expert's alone. When, and only when, the operator says the expert has signed, record it:
`update_sketch` `set /curation/signoff` `{ by, on: 'YYYY-MM-DD', claims: 'all' }`; it is stamped at write with a copy of
each claim as it stood. The audit reads that copy against the claims now: unsigned, signed, or changed since (an edited
or added claim). Never sign on the expert's behalf, never write a sign-off the operator did not report, and never say
the gate passed: say what the record shows.

## The catalogue

The exhibit's book: its aims, whom it is told for, each stop in every audience's words with its grade and sources,
every claim with its sources and its sign-off, and the grades explained. `/api/sketches/<ref>/bible?book=exhibit` (a
gallery's `/bible`), one printable page; `create_exhibit` returns its address. It records the sign-off; it does not
establish it.

## The check

An exhibit has no win to prove; its machine gate asks what a curator asks of a label wall. `create_exhibit` returns it
with a tour, a brief (`curation`) or a gallery, and `get_exhibit({ ref, audit: true })` reads it again: a tour at all, a brief, each
claim graded, a record's claims cited and every claim in the brief sourced (warnings when not), each claim said by
some stop, a caption for every audience the brief writes for, captions short enough to read, each stop showing
something; and beside it the accuracy gate's reading. Every stop
framed (its lit parts on screen above the panel) is measured in a browser: `node scripts/exhibit-audit.mjs <page.html>`.
It advises and never refuses. The eyes gate is the operator's, and whether a claim is TRUE is the expert's: never say
either passed.

## Worked example

```
create_exhibit({ id: 'life/cellular', title: 'Inside a cell', tour: { title: 'Inside an animal cell', stops: [
  { title: 'The whole cell', caption: 'A cell is a crowded city in a membrane: each part does one job.',
    camera: 'angle', shape: 'structure', grade: 'depicted' },
  { id: 'power', title: 'Mitochondria', caption: 'They burn sugar with oxygen and store the energy as ATP.',
    camera: { frame: 'org:mitochondria', from: 'front' }, highlight: 'org:mitochondria', shape: 'process',
    grade: 'depicted', cite: 'Alberts, Molecular Biology of the Cell (6th ed.), ch. 14' },
  { title: 'The nucleus', caption: 'It keeps the DNA, the instructions for every protein.', camera: 'top',
    highlight: 'org:nucleus' } ] } })
```
