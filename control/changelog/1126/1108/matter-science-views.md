### Matter in the science views: one ladder from a walkable place down to a cited sentence

- **A science page is a ladder of scales, and each rung says what it is.** A rung is simulated (a model the solver
  runs and the gates examine), depicted (drawn at true proportions from sourced numbers and held to them) or explained
  (a cited sentence, where nothing can be drawn honestly). What is too far out of scale to show gets its own rung, never
  a silent approximation. A classical body made of a matter carries its ladder, from the body down through its grains
  and its crystal cell to its atoms and its nuclei, each rung with its size, its step from the one above and its
  source; where nothing below is sourced, the last rung says so. A demo standing at true size in a world has the place
  above its bodies. `dress.ladder: '<body>'` draws a body's depicted rung beside the demo (steel's iron cell, aluminium's,
  lead's), its atoms where the lattice puts them, and the `ladder-depicted` gate holds the drawing to the lattice
  constant.
- **A classical body can say what it is made of.** `matter: 'steel'` (any row of the destructible-physics matter table,
  or `{ is, …overrides }`) gives a body with a radius its mass from the matter's density, and a collision or a plane
  with no `e` its bounce: each pair takes the lower of its two, as the games' impact law does. A plane can name its own
  `matter`; drag and buoyancy can name a `medium` (`'water'`, `'honey'`, `'air'`) for its viscosity and density. The
  table is read, never changed, so a ball on a bench and a brick in a level have one source for their numbers.
- **The readout says what each contact did.** A model with matter reports, body by body, its mass and where it came
  from, the energy it holds before it fails, and the worst any contact did to it (holds, dents, breaks), by the games'
  own impact law: the lost energy shared inversely to stiffness. The `bodies-intact` gate advises when a body would
  have broken, because the run keeps every body whole. A model that names no matter is unchanged, byte for byte.
- **A science world's page is one picture.** The classical, microscopic, quantum and relativistic pages no longer show
  the view-camera and wireframe buttons or the corner hint; the readout and the honesty panel stay, and `?hud=1` brings
  the buttons back. Every other page is unchanged.
- **Heat in the classical worlds.** A body can start at a `temperature` (kelvin, `'20 °C'` or `'68 °F'`), and the
  `heat` law moves it: each body with a matter is one temperature, losing heat to the air or water round it
  (convection), to its surroundings (radiation, each surface's emissivity from the matter table) and through a contact
  spot to the bodies and the planes with matter it touches; a plane with a `temperature` is a hot plate. A body takes
  its latent heat at its melting point before it rises past it. The checks: every joule lost is a joule that leaves
  (`heat-conserved`), one temperature is fair for each body (`lumped-holds`, its Biot number), cooling by convection
  alone matches Newton's law (`closed-form:cooling`), and an advisory when a body would melt (`bodies-solid`). A hot
  body struck is weaker, by the games' own heat factor. The page's readout shows each body's temperature, and
  `temperature` can be observed. The destructible-physics matter table gains a `TRANSPORT` table beside it
  (conductivity and emissivity), read only by the science worlds: no game page changes. Heat is stepped along the run
  after the motion, so a model with no heat law is unchanged, byte for byte.
- **Spin and rolling in the classical worlds.** A body given `spin` (`[x, y, z]` in rad/s, or `'300 rpm'`, `'8 rev/s'`)
  is a sphere that turns, its moment of inertia a solid ball's or, when its matter fills less than all of it, a shell's.
  On a plane with friction it rolls: a ball rolls down a ramp at 5/7 of the slide, a skid settles into a roll, a
  backspun ball comes back, and a rough bounce trades speed for spin. The new `magnus` law lifts a spinning ball in the
  air (topspin dips, backspin floats, sidespin curves). The checks: `closed-form:rolling` against the textbook ramp, and
  `spin-held` (nothing in flight turns a spin); `spin` can be observed and shown on the page. `rpm`, `rev/s` and `rad/s`
  join the units, and `'Hz'` is refused for a spin as ambiguous. A body without `spin` slides as before: every existing
  model runs the same steps, byte for byte.
- **A liquid that sets.** The classical `gelling` law puts bodies in a liquid from the matter table whose viscosity and
  yield stress move along a `curve` the recipe writes (`[{ at, viscosity?, yield? }]`). A body in it sinks at Stokes's
  speed, stepped exactly so a near-set liquid needs no tiny step, and is held once the yield carries it (Beris et al.'s
  sphere criterion, τy ≥ 0.048·Δρ·g·D): a falling-ball viscometer slows and stops as the liquid sets. A `layer` of it
  on a `slope` flows as a Bingham film and holds once its yield passes ρ·g·h·sinθ (the tube-tilt test). The checks:
  `yield-holds`, `closed-form:bingham-film`, and `closed-form:viscometer` for a liquid that does not set; the page shows
  η and τy along the run.
- **Aggregation in the microscopic worlds.** The `aggregation` law counts a species binding to itself: nucleated growth
  (Oosawa: a nucleus, then one monomer at a time), whose S-curve's lag shortens as the monomer gets richer, or
  coalescence (any two clusters merge, Smoluchowski's constant kernel, held to its closed form). The readout gives the
  share aggregated over time, the lag and half time, and the sizes at the end; the page shows the free monomer and the
  share aggregated, and says the spheres stay single because the aggregation is counted, not placed.
- **A classical demo under a tenth of a metre is drawn magnified** by a power of ten, with the magnification on the
  panel: at its true size it sat inside the camera's near plane and could not be seen. Larger demos draw as before.
- **One scale feeds the next.** A setting liquid's state can be read from a lower rung instead of written: the classical
  `gelling` law's `from` runs a microscopic model and reads the share its aggregation assembles, and `relations` turns
  the share into the liquid's yield and viscosity through cited rows, never a formula of the recipe's own: `percolation`
  (the yield grows from the gel point with the percolation exponent, de Gennes 1976) and `krieger-dougherty` (the
  viscosity of a liquid filling with assembled matter, Krieger & Dougherty 1959). A glass bead in water is held once a
  protein assembling in it has made a gel that carries it. The checks: `handoff-held` (the lower rung held its own),
  and `stokes-regime`, which now advises whenever a body in the liquid moves too fast for Stokes's drag. The panel says
  what was read and through which rows; the page shows the share assembled beside η and τy.
- **The experiment is the page's name.** A science page that names only its scale (a mint's default) is titled by its
  experiment instead, from its subjects and what acts on them ("Bead of glass: gravity, buoyancy and a setting
  liquid"), and the panel cites the matter table plainly rather than by an internal name.
- **A ladder of scales on one page.** `create_view` with kind `ladder` lays rungs top down, each at its own scale and
  saying what it is: simulated (any science world's model, run and checked), depicted (a metal's crystal cell, drawn
  from its lattice constant and held to it) or explained (a sentence that cites a work and its year). Each rung stands in
  its own case, magnified and saying by how much; a breadcrumb across the top steps the camera from one rung to the next
  and shows each rung's size, its step from the rung above and its source. `below: { rung, body }` expands a body into
  its matter's ladder, down to its nuclei, and a lower rung can feed the one above (a gelling law's `from: { rung }`).
  The checks: every simulated rung's own, `ladder-depicted`, `ladder-cited` and `ladder-ordered`. The derived matter
  ladder's sources now carry their years, and one that has none is marked unsourced.
