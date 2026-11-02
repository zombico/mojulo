### Military vehicles: the field's 4x4, truck and carrier, drawn realistic from a hull kit

Field vehicles a realistic game can put beside a realistic soldier. A field vehicle is made, not styled: flat plates with
rolled edges, bent tube, a frame you can see under it, fittings bolted and welded on. This theme builds them in the form
render, from a kit of those solids, at their classes' true numbers.

- **The rows** (`vehicle-registry/roster.js`):
  - `utility-4x4`, the military utility vehicle. People say "jeep" for any light military 4x4, so the word is kept
    here, the one maker's name the roster keeps. Its role is a new one, `scout`.
  - `cargo-truck`, the military cargo truck (canvas truck, troop truck, six by six), role `transport`.
  - `apc` relabelled the armoured personnel carrier, its old words kept, and now parked as well as driven.
- **The classes** (`roads/vehicles.js`):
  - `utility4x4`, `cargo6x6` and `apc8x8`, from public spec ranges, rounded.
  - Each has all-wheel drive on cross-country tyres (less grip on asphalt, more rolling) and is governed as its manual
    says.
  - The vehicle sheet takes them as classes (`car-designer/facets.js`, `channels.js`). The truck and the carrier are
    `UNBUILT` until their bodies are (`sheet.js`): named, searchable and drawn as their concept, never rolled.
- **The hull kit** (`car-designer/mil-hull.js`):
  - **Plate:** a convex section extruded along an axis, every edge rounded: the Minkowski sum of a smaller prism and a
    sphere. Its corner normals are worked out, not averaged. A big flat panel keeps its own normal to the corner, so it
    reads flat, and its round turns through the exact normals, so the edge catches a line of light as a real plate's
    rolled edge does. A round is tagged `edge` for the wear to come.
  - **Tube:** a polyline swept by a circle and carried without twisting, its bends rounded (`bend`), its normals radial.
  - **Bolts:** hex heads.
  - **Weld:** a bead rippled as a run of tacks is.
- **The utility 4x4** (`car-designer/road-military.js`, compiled by `car-designer/military.js` in the realistic
  compile's shape):
  - **Underneath:** a ladder frame, its axles and differentials.
  - **Bumpers:** channel beams bolted to the frame.
  - **Bonnet:** a flat bonnet on a piano hinge, held by rubber latches. Its face is a slotted grille between round lamps
    in wire guards, over blackout markers.
  - **Fenders:** flat over open wheels, with a turned-down flange and a lip, welded to the cowl.
  - **Windscreen:** a split pane in its frame, its fold hinges, the wipers hung from the top.
  - **Tub:** open, its sides and doorways rimmed by a rolled edge, the rear wheels in wheelhouses under rimmed openings.
    Rivets run along its foot, welds up its rear corners, and the rear panel carries its lamps.
  - **Inside:** canvas seats, a dash and its gauges, the wheel on its column.
  - **Roll bar:** braced to the rear, its feet bolted down.
  - **Wheels:** the field's own (below).
  - **Materials:** the field's own slots (`MIL_MATERIALS`): matte paint with no clearcoat, canvas, bare steel, weld, and
    the frame's dark steel.
- **The field's wheel** (`car-designer/mil-wheel.js` `milWheel`):
  - **The tyre:** a cross-country tyre. Its carcass is lathed and sits a lug's depth under the tread. Its tread lugs
    are geometry: chevron blocks proud of the crown, two rows offset half a pitch and angled opposite, running out over
    the shoulder.
  - **The rim:** a split steel rim in the vehicle's paint. A flange and its ring, a pressed dish, the beadlock bolts
    round it, the wheel nuts, and the tyre-inflation hub's cap and valve.
  - **Any axis:** it faces along the axis asked, so the same wheel is a spare on a panel or lying on a bonnet
    (`mil-hull.js` `place`).
- **The fittings as cards** (`car-designer/mil-fittings.js`). A card builds in the frame of an anchor a body declares
  (its point, its outward normal, its up), and refuses an anchor of a kind it does not fit. A new fitting is a card.
  - **What it carries:** the spare on its carrier; jerry cans (each with its pressed X, three handles and a spout) in a
    rack with its tray, posts, strap and buckle; a shovel and an axe in their clips; a saddle fuel tank, strapped on its
    cradle, its filler capped.
  - **On its ends:** a D-ring through its tab, painted red; the pintle hook on its block, its latch red.
  - **On its sides:** a whip antenna on a sprung base; grab bars; a holed tread step; mud flaps on their bars; a round
    mirror on its arm; a rolled tarp, strapped.
- **The 4x4's kit** (`road-military.js` `KITS`):
  - **On the hull:** the spare on the bonnet, a can racked each side of the rear panel, the shovel and axe along the
    left flank, the whip at the right rear, grab bars beside the doorways, the steps under them.
  - **On the ends and underneath:** red D-rings on the front bumper, the pintle behind, mud flaps behind the rear
    wheels, a saddle tank under the right doorway.
  - **At the top:** a mirror on the screen post, and a rolled tarp on the rear panel, which most carry.
  - **The seed's dice:** a can's tone (olive or sand), the whip's length, and whether it carries the tarp.
  - **The census:** it measures the hull against the class, since the fittings hang off it as a mirror does a car. The
    rear panel stands short of the tail, so the cans and the pintle hang inside the class's length.
  - **The budget:** about 21.6k triangles with its kit and its four lugged wheels and the spare.
- **The livery, cut** (`car-designer/livery-cut.js`). A field vehicle's paint as words, the pattern cut into its painted
  faces as geometry, with no texture, so every engine gets it as drawn. It is the supercar's livery idea
  (`vehicle-livery.js`, cut at planes), cut at contours too.
  - **The words:** `livery: '<pattern>' | { pattern, colours?, scale?, angle?, seed?, marks? }`.
    - `pattern` is `mono` or a camo: woodland, desert, tiger stripe, winter, urban or digital (`CAMO`).
    - `colours` go over the pattern's own in band order, the base first; `scale` is the blotch's size in metres.
    - `marks` are a stencilled number (from the seed by default) and an emblem, a chevron or a bar.
  - **The camo:**
    - **The field:** a seeded two-octave field over the vehicle's own space, warped, stretched per pattern (a tiger's
      stripes long along the hull).
    - **The cut:** each painted face is divided finely only where a band's edge crosses it; a thin strip (a tube's side,
      a plate's round) is sliced along its length only. Each piece is cut exactly where the field crosses a band's
      level, and one edge is cut at one point from either face.
    - **The bands:** each band's level is set from this vehicle's own painted area, so each colour takes its share.
    - **Seams:** the pattern runs on over seams, plates and fittings, as a sprayed one does.
    - **Exceptions:** what faces the ground is one colour, unseen. Digital is cut exactly at its cells' planes, each
      cell one colour.
  - **On the 4x4:**
    - The camo is cut into the hull and its fittings at once, so the spare's carrier, the grab bars and the tools'
      clips are painted with it.
    - The rims take the base colour, and the frame a shade of it.
    - Stencils go on its mark anchors: the number on each side and on the front bumper, the emblem on the rear panel and
      the bonnet's sides. They are dark on a pale camo and pale on a dark one, and read left to right as one faces them.
    - Its size is unchanged.
  - **Camo by setting:**
    - **At mint:** a new quick world whose ride is a field vehicle is stamped with its setting's camo when the operator
      names none (`vehicle-registry/ride.js` `settingLivery`). It is read from the world's kit and words: a jungle's
      tiger stripe, a desert's sand, the snow's white wash, a city's greys, an alien world's cells, a green land's
      woodland (`camoForSetting`).
    - **Before:** a world minted before carries none and stays olive.
  - **The doors:**
    - **The quick game:** `quick.livery` (a field vehicle's only; another build is refused, naming the rows it paints).
    - **The level:** the figure's `loft.livery`.
    - **The grid:** `mint_solid({ kind: 'vehicle', spec: { vehicle: 'jeep', livery: 'desert' } })`.
  - **Not yet moved:** the road cars' sheet liveries and the supercar's keep their own words, unchanged.
  - **The budget:** under 40k triangles in camo (woodland about 30k for the body and its kit, digital about 24k), and
    under 25k plain.
- **Composed:**
  - The quick race's card says a ride takes a registry vehicle (`'a jeep'`), its wording trimmed to keep the card
    under its ceiling now that the physics classes it lists have grown.
  - The class's realistic build is live: a quick game's `ride: 'a jeep'` drives it, `mint_solid({ kind: 'vehicle',
    spec: { vehicle: 'jeep' } })` shows it on the studio grid, and a world draws it in the form render or baked.
  - The registry says what the truck and the carrier need (`upscaleOf`).
- **Held:**
  - `road-military.test.js`:
    - a plate flat to its edge and round at it, its area the rounded box's;
    - a round shrunk to fit;
    - a tube's normals, a bolt's flats, a weld's ripple;
    - the wheel's lugs proud of the crown (two rows, five faces a block), its rim's materials, its face along the axis
      asked;
    - each fitting card built outward of an anchor it fits, and refusing one it does not;
    - a body's kit on the anchors it declares, its dice choosing among it;
    - the compile true to its class, every face a material the figure carries with unit normals, within its budget
      (25k triangles), the same twice, and the baked figure the same rig;
    - the word, the build, the ride, and a waiting class refused with what it needs;
    - in its livery: the camo cut into the hull and the fittings alike, the rims in the base, the stencils on, the size
      unchanged, within its budget.
  - `livery-cut.test.js`:
    - the words read whole and refused naming what they take;
    - a setting read to its camo;
    - a camo cut into the base paint only, each band its share, the area kept, the same twice, another seed another
      pattern;
    - a digital pattern cut at its cells;
    - mono a recolour;
    - the stencils read left to right.
  - `tier-ride.test.js`: the setting's camo stamped at mint, nothing where the setting says none, the operator's word
    kept, a livery refused on a ride it does not paint.
  - `preview-vehicle.test.js`: a field vehicle's livery carried in its loft's recipe, refused on a road loft.
  - The form render in the page (`form-render.live.test.js`, e2e): the 4x4's shaders compile, it is drawn and lit, and
    its shadows are cast.
  - The quick game end to end (`design-game.quick.test.js`, e2e): `ride: 'a jeep'` written as its row, its level's
    figure the 4x4's in the field's materials.
- **Seen** (machine gate only; the eyes gate is open):
  - The 4x4 in a review sheet: the three-quarter, the side, the rear quarter, from above and from the front. With its
    kit, the spare on the bonnet, the racked cans, the red D-rings, the tools along the flank, the whip and the lugged
    tyres all read.
  - Its camos: woodland, tiger, desert, winter, urban and digital in the review sheet, and woodland in the page's own
    light. A desert 4x4 from behind shows its chevron between the cans, and from the front its bumper number.
  - In the page's own light, with shadows. The page's moving-actor shadows lay stripes of self-shadow on the flat plates
    that face away from the sun. They are the page's shadow channel's, shared by every world, and are left for the light
    phase.
- **Not built yet, said:**
  - Wear and grime.
  - The light of the setting.
  - The canvas truck and the APC's bodies.
  - Composition: the military game's faction painting them, the base's yards, the engines.
