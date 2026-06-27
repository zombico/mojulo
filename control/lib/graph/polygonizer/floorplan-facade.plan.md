# floorplan-facade — selectable house facade styles

Status: DESIGN (door work landed; facade styles proposed). The house exterior today is
a single hard-coded treatment: `facadeDecor` in floorplan-structure.js paints clapboard
SIDING (water-table plinth → horizontal lap courses with shadow lips → corner boards +
frieze) on every `shell:exterior` run. We want the operator to choose a facade STYLE.

## Doors (DONE — context)

Opening KIND added to the door pipeline (`placeOpenings` → `openingAssemblyFaces`):
  - `hinged` (default) — the swung leaf (unchanged).
  - `cased` — an open archway, no leaf. Used for the stair BAY mouth and the bedroom-hall
    WING mouth, so a circulation threshold no longer reads as a "door into nowhere."
  - `sliding` — a panel parked in the wall plane (glass for an exterior slider). The
    terrace/patio door defaults to this.
Door audit: every interior door connects two real cells; every exterior door is an
entrance or terrace (0/1008 lead to literal nowhere).

## The style selector

Add `facadeStyle` to the structurize options (default `siding` = today's look), threaded
into `facadeDecor` which dispatches per style. Three styles to start:

| style | reads as | body | openings | trim/cap |
|---|---|---|---|---|
| `siding` (today) | clapboard cottage | horizontal lap courses | punched, cased | corner boards + frieze |
| `brick` | old-school masonry | RUNNING-BOND courses | recessed, brick sills/lintels | water table + soldier course cap |
| `tofu` | modern high-ceiling | clean flat block panels | large flush glazing | minimal reveal, parapet cap |

`facadeStyle` is a per-house parameter (operator picks; falls back to a tier/seed default).

## Brick — running bond (the operator's pattern)

```
_ _ _      course n+1:  |  brick  |  brick  |  brick |
 _ _       course n:    half | brick | brick | half        ← offset ½ brick
_ _ _      course n-1:  |  brick  |  brick  |  brick |
```

- Body = horizontal courses (course height ~2.7 in incl. bed joint) drawn like
  `facadeDecor`'s lap loop, BUT each course is subdivided into brick units along the run,
  and alternate courses shift the unit phase by ½ a brick — the running-bond overlap.
- Render economy: don't emit a quad per brick (thousands of faces). Emit one body quad per
  course + a thin recessed MORTAR grid (head joints offset per course, bed joints between
  courses) as proud/!proud lines — the offset joints are what read as bond. (Mirror the
  card-layer anti-z-fight lift already used in `interiorWallDecor`/`facadeDecor`.)
- Leverage existing brick palette + recessed-window read from `facade-card.js`
  (`BRICK_WINDOW`, brick spandrel/pier logic) rather than reinventing colors.
- Cap: a water-table plinth (exists) + a soldier course (verticals) at the head line.

## Tofu — modern block

- Body = large flat panels (concrete/stucco), few seams: a tall plinth + 1–2 broad field
  panels per storey with a deep reveal at floor lines, no lap texture. The "tofu block"
  read is clean planar mass with crisp shadow reveals at edges.
- High ceiling: honor a taller `wallHeight` for this style (the modern look is vertical),
  and prefer large flush glazing (wider window runs, glass to the head line) over punched
  cottage windows.
- Cap: a thin parapet band (flat-roof read), corners get a shadow-line reveal, not a board.

## Ground level — signal, not a drawn ground

Operator note: the house view should SIGNAL ground level, not draw a ground surface.
`groundDatumFaces` already emits a z=0 frame + a faint meru axis (terrain stays OUT) — tune
it to a pure thin datum line/glow at the footprint perimeter (drop any filled frame), so the
house reads as sitting ON grade without a drawn slab/plane competing with the building.

## Build order

1. DONE — `facadeStyle` option + dispatch in `facadeDecor` (`siding` kept byte-identical).
2. DONE — `brick` running-bond: water-table plinth + brick body field + offset mortar grid
   (head joints shift ½ a brick every course) + soldier course at the head line. Window
   sizing COUPLED (brick → 0.72× punched openings). Stylized ~2× brick unit (`brickUnit`)
   so the bond reads at house scale (~1640 facade faces/floor). Verified in the World.
3. DONE — `tofu` modern block: clean planar body + crisp shadow reveals (floor line, corners,
   under a thin parapet cap) + HIGH CEILING (structurizeHouse raises storey heights to
   12.5/11 ft for tofu) + flush glazing (placeOpenings: tofu → 1.45× width, 0.5× sill).
   Cheap (few seams). Verified in the World.
4. TODO — Ground-datum tune to a pure signal.
5. Spike render: one house per style (World, x-ray off) for visual review.

## Windows scale with the room (DONE)

`placeOpenings` now iterates CELLS, not runs: each room's EXTERIOR wall gets a window sized
to that wall's length — unit width `clamp(L·0.38, 2.2, 6) ft`, and a long wall gets a ROW
(`1 per ~9 ft`, max 4). So a bathroom gets one small window, a great room a run of large
ones; corner rooms get windows on both exterior walls. Circulation (halls/bay) gets none.
Facade style still nudges the unit (brick ·0.72 smaller-punched, tofu ·1.45 + half sill).
This also fixed the old "a wall spanning two rooms gets a single centred window" bug —
each room now gets its own.

### Window STYLE concepts (the divided-light pattern)

`windowStyle` (or per-opening `op.style`) draws muntins over the glass:
`picture` (clean pane) · `casement` (paired, centre mullion) · `double-hung` (2-over-2) ·
`colonial` (divided-light grid, lite count scales with size) · `transom` (a transom lite
over the sash) · `french` (full-height divided-light doors — drops to the floor, paired) ·
`german`/european (tall, large panes + a top transom/Oberlicht over two sashes). french &
german also run taller (lower sill) and a touch wider. Defaults coupled to the facade:
siding→colonial, brick→double-hung, tofu→picture. `renderWindowSampler({styles})` renders a
face-on concept board (elevation, per-style sills).

ENTRY: `doubleEntry: true` → a paired double-leaf front door (wider opening + meeting
mullion + two swung leaves). Rendered via doorLeafFaces' double-leaf path.

## Exterior adjacents — site elements

Built structures anchored to a DOOR and projecting OUTWARD from the footprint (built in
along/perp space → any façade orientation). Each keys off a door, so the right floor builds
its own. `exteriorAdjacents` in floorplan-structure.js:
  - `stoop: true` — a raised stone landing + steps up to the entry (no roof).
  - `porch: true` — a covered front porch: deck slab + 3 posts + flat roof + steps. (entry door)
  - `deck: true` — a railed wood deck off the TERRACE slider (boards + 3-sided railing + steps
    to grade). Needs `terrace: true` so the slider exists. (terrace door)
  - `balcony: true` — cuts a glazed balcony door on a bedroom's exterior wall (front row
    preferred, else back) + builds a cantilevered slab + 3-sided railing + corbels at the upper
    floor level. The upper floor is single-loaded at house-tier footprints, so it lands on the
    back row (a rear balcony) — fine; deeper footprints / a front-row bedroom put it street-side.
Shared `railAlong`/`railPerp` helpers draw posts + balusters + top rail.

Fast-follow: a sloped/shed porch roof, ground-plane site work (walkway, driveway, fence), and
a front balcony when the upper floor goes double-loaded (deep footprint).

## Open questions

- (resolved) Per-style window treatment — facade style nudges the unit size; room size
  drives the base size + count.
- Roof: tofu implies a flat parapet, brick/siding a pitched roof — out of scope here, but
  the cap treatment should not contradict a future roof pass.
