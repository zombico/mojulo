### The metro's industry: industrial neighbourhoods in its outskirts, their kit, the grid, and clad sheds

- **Industrial neighbourhoods.** A metro now builds a share of its outskirts' neighbourhoods as industry (`industry`,
  a new metro setting: `share`, its blocks' `segments` by weight, the `block` length; `false` none). The land's edge to the
  country and the shore are chosen first, far from the seat, and each next one is drawn toward those already chosen, so
  they gather into districts (`design.js` `industryOf`). Their blocks are big, their streets a collector's width for
  trucks. Each block is one of five new segments (`segments.js`):
  - a **works**: a corrugated-steel hall under a low gable with a lantern along its ridge, an office in block at its front,
    roller doors on its yard, trucks, a chimney on some, containers out back;
  - a **warehouse**: a long clad box, its docks down one side under a canopy, trucks backed in, its people's cars;
  - **storage**: shipping containers stacked two to four high in rows, in their own colours, a bank of silos and its
    headhouse on some;
  - a **tank farm** (`tanks`): storage tanks in bunded rows, a pipe rack down the middle, gas spheres on their legs at one
    end, or a gasholder in its guide frame where there is room;
  - a **substation**, one in each industrial neighbourhood (its civic block): outdoor transformers in a row, a gantry over
    each bay, breakers between, its control house in concrete block.

  Every block is fenced with chain-link and barbed wire, a gate's gap at its front. The `segments` and `pitch` laws read
  industry as its own ring, its substation as its civic block.
- **The industrial kit** (`geocity/industry.js` `industryTemplates`): a storage tank with its wind girder, cone roof,
  winding stair and roof rail; a gas sphere on braced legs; a gasholder; a silo bank; a shipping container with its ribs
  and doors; an outdoor transformer with its radiators, bushings and conservator; a substation gantry and a breaker with
  their insulators; a lattice pylon with three crossarms each side and its insulator strings; a banded chimney stack; a
  chain-link fence panel; a pipe rack. Each is baked under the scene's light, each way it lies its own template. The tall
  pieces are seen across their district, the rest near the camera.
- **The grid.** Each substation is fed by a high-voltage line on lattice pylons from beyond the land's edge, a pylon every
  85 m or so, stood clear of its halls and off its streets. Six conductors sag between each two pylons and come in to the
  switchyard's gantry. The wires are footless, so no walker or hover cast stands on them. The industrial streets keep the
  outskirts' wooden poles and their wires, and are planted with maples rather than cherries.
- **Clad sheds.** Four new material words (`era/arch-style.js`): `corrugated`, `cladding`, `cmu` and `standing-seam`,
  on the dressed tiles' made cuts, each with its matter for destruction (`rupa/look-matter.js`). A yard's shed is now
  corrugated steel under a standing-seam roof, an emergency station brick, and a works' or a warehouse's hall and its
  control house each its own. A works' yard is concrete, a tank farm's bund and a switchyard gravel.
- **Readout.** The page counts its `industry` (its blocks, its pieces by kind, its pylons and lines), and a neighbourhood
  built as industry says `industrial`.
