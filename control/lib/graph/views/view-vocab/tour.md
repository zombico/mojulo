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
