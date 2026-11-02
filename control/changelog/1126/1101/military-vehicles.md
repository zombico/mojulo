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
  - **Slab:** armour, the convex solid inside its outline seen from the front, the side and above (the three prisms
    intersected, plane by plane), each face flat. Every edge sharper than a crease is chamfered by taking the same
    width off each face it joins, so a sharp edge's chamfer is broad and a shallow crease's a sliver, tagged `edge` for
    the wear. A face the body leaves off (inside another slab) is not drawn and its edges are not chamfered.
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
- **The wear** (`car-designer/mil-wear.js`). A field vehicle's history on its surface, after its livery. It is one word,
  the vehicle sheet's own: `pristine | used | battered`, or `{ level, soil? }`. A field vehicle is `used` unless the
  operator's word or its brief's (a beat-up jeep) says otherwise.
  - **Caked mud:** cut into the body as geometry, in its own rough `mud` slot. Its line runs about 0.15 m under the
    wear's mud top (a used vehicle's to its sills, a battered one's halfway up its flanks), broken up and down by the
    field's noise, and in a ring round each arch where the tyres throw it.
  - **Chips:** the paint off to bare steel (`worn`) cut into the top edges that are seen (the plates' rounds that face up
    or out on the upper body) and wherever a hand or a boot goes: the grab bars, the steps, the latches, the rim, the
    bumper and the carriers.
  - **Per corner** (`cornerAlbedo`, carried to the page, the GLB and now the studio grid's bake):
    - dust rising from the ground and settling on what faces up, broken by the field;
    - sun fade on what faces the sky;
    - grounding, laid at every wear, pristine too: the wells round the wheels, under the body, the tub's inside, and
      what faces down.
  - **The wheels:** the rubber darkened with the soil's mud (the tread most) and the rims dusted.
  - **The soil:** the setting's, read from the livery's camo (a desert's dust, the snow's slush, a city's ash-grey grit,
    a green land's mud), unless the wear names its own. The dried mud is lighter than the paint it cakes, so it reads on
    a dark camo.
  - **The doors:** `quick.wear` (a field vehicle's only), the loft's `wear`, and `mint_solid`'s `wear` beside the
    vehicle's word. A road car's wear stays its sheet's, and a wear's words on one are refused.
  - **The budget:** under 45k triangles at `used` (about 38k plain), under 55k in camo (woodland used about 47k,
    battered about 46k), and under 25k pristine.
  - **The packer:** `vehicle-rig.js` `packFormMesh` now takes a mesh's bounds by a loop, not by spreading every
    corner, which overflowed the stack on a large mesh. Its output is the same.
- **The light of the setting.** Until now a realistic vehicle carried noon's light, and the page lit it so (its key's
  colour and strength over the world's shadow lights). A jeep in a night world was lit at noon.
  - **The sky's light** (`car-designer/form-light.js` `skyMood`): a field vehicle a world draws is lit by that world's
    own sky (its zenith, horizon, day and sun), passed in by `world-scene.js` as the loft's `setting`:
    - by day, a full warm key;
    - as the sun sinks, the key toward the horizon's colour;
    - at night, a dim moonlight in the zenith's cool, an eighth of the day's;
    - the ambient the sky's share of it, the reflected sky the world's own, its travel the world's sun when it is up.
  - **Ground bounce:** the hemisphere bounces the soil's colour up under it (`formLight`'s `ground`; `groundOf`).
  - **Wet:** in a world whose weather is of the wet family (drizzle, rain, downpour, storm), its slots take the rain:
    the paint glossier under a thin coat of water, the rubber glossier, and the mud and canvas soaked darker
    (`wetMaterials`, `wetFaces`).
  - **Only the field's:** a road car and a supercar keep their noon or their race's mood, so no existing world's
    vehicle changes. With no world (the studio grid, an export), a field vehicle is lit at noon as before.
  - **The shadow's stripes:** the page's shadow lights now carry a normal bias for a physical body
    (`channels/controllable/index.js`). A flat plate turned from the sun wore its own shadow's stripes, the shadow map's
    depth steps laid on it; that is gone for every realistic vehicle.
- **The canvas truck** (`road-military.js` `cargo`; the six-wheeled class's realistic body, no longer waiting): the hull
  kit's second body, built on what the first taught.
  - **Underneath:** a ladder frame on three axles (the front under the bonnet, a tandem behind), each on stacked leaf
    springs, with its differentials.
  - **The front:**
    - a heavy bumper with a winch behind it, its cable wound and its fairlead in the bumper;
    - a long bonnet, louvred at its sides, its grille behind a tube guard;
    - flat fenders with round lamps on their noses, in wire guards, beside blackout markers.
  - **The cab:**
    - a steel box on the frame: its doors' shut lines, framed glass and the screen's two panes in rubber;
    - the wipers parked, the door handles and hinges, a round roof hatch, a small rear window;
    - an exhaust stack up its back corner, sooted, under its shield.
  - **The bed and the tilt:**
    - plank drop sides between stakes, a headboard and a chained tailgate, the floor on its bearers, the rear fenders
      over the tandem;
    - five bows, and the canvas tilt over them: its section a rounded box, sagging between the bows (the roof down, the
      sides in), smoothed as a cloth, roped and tied along its foot, its rear flap rolled and strapped.
  - **Its kit** (new card: `stowageBox`, a box hung on brackets, its lid latched):
    - the spare behind the cab and two cans on the bed's front corner;
    - a saddle tank and a stowage box on the rails;
    - the tools on the bed's side, and the whip on the cab;
    - grab bars and steps at the doors, mud flaps behind each axle group;
    - the D-rings, the pintle, and mirrors on both posts.
  - **Composed with the rest:**
    - the field's wheel on six bones;
    - its livery, with the camo's blotches as much bigger than the 4x4's as its wheels are, unless the operator names
      their size (`paintLivery`'s `size`);
    - its wear, its heights by the same size (`weather`'s `scale`: a truck's mud climbs as far up its wheels);
    - its setting's light;
    - its stencils on the doors, the bumper, the bonnet and the tailgate.
  - **The registry:** its realistic build is live, and `ride: 'a canvas truck'` drives it.
  - **The figure's wheelbase** runs to its rear axles' middle (the jeep's unchanged).
  - **The budget:** about 30k triangles kept, 60k used, 72k in woodland, six lugged wheels included.
  - **Robustness:** the census and the figure's height take their extremes by a loop (`realistic.js` `most`,
    `least`), the spread of a large mesh's corners having overflowed the stack. The output is the same.
- **The armoured carrier** (`road-military.js` `carrier`; the eight-wheeled class's realistic body, no longer waiting):
  the hull kit's third body, its hull three slabs.
  - **The hull:**
    - a narrow lower hull between the wheels, its belly a shallow V, its nose plate raked back under the glacis;
    - the troop compartment over it: sponsons out over the wheels, an upright band for the bins, the sides raked in to
      the roof;
    - ahead of it, a step lower, the driver's and the engine's roof and the glacis down to a nose with its corners cut;
    - welds at the step, the glacis's top and the rear corners.
  - **Underneath:** four axles in two pairs, each hub on its arms to the hull and a damper up to the sponson.
  - **Openings:**
    - the rear ramp on its hinges, the door in it with its vision block and handle;
    - the driver's hatch and its three blocks over the glacis;
    - the commander's cupola, six blocks round it, its lid, hinge and handle;
    - two troop hatches on the roof, their hinges, handles and the stops an open lid rests on;
    - a hatch in each raked side, its block, hinges and handle.
  - **On the hull:**
    - an empty mount ring, bolted, its well dark (weapons are mounts only);
    - bins along both sponsons, their lids lipped and latched;
    - the engine's grille deck, bolted;
    - an access plate bolted on the glacis, the lamps on their stems in wire guards, the blackout markers;
    - the exhaust's sooty louvred shield on the right, the tow cable looped and clamped on the left;
    - grab rails on the roof, tail lamps in their guards.
  - **Vision blocks** in their own slot (`MIL_MATERIALS.vision`: dark, deep, a small hard highlight).
  - **Its kit:**
    - a jerry can each side of the ramp, the tools on the right side;
    - two whips at the rear corners, grab bars by the driver;
    - steps at the nose, mud flaps behind the last axle;
    - four tow shackles and the pintle, mirrors at the front corners;
    - a rolled tarp on the roof (most carry one).
  - **Composed with the rest:** the field's wheel on eight bones, its livery, wear and setting's light; its stencils on
    the front bins, the ramp and the glacis.
  - **The registry:** its realistic build is live, and `ride: 'an apc'` drives it.
  - **The figure's wheelbase** is its first axle to its last, as its sheet quotes it.
  - **The budget:** about 30k triangles kept, 48k used, 63k in woodland, eight wheels included.
  - **The wear's cut** (`livery-cut.js`): a thin face of more than four corners (a chamfer whose ends are cut) is sliced
    along its length as a thin quad is, not shattered by bisection. The carrier's used hull went from 111k triangles to
    48k.
- **Parked, in a level** (`vehicle-registry/parked.js`):
  - A manifest's `parked: [{ vehicle, at, heading?, livery?, wear?, seed? }]` stands registry vehicles still. The world
    lowers each on read (`world-scene.js`) into its realistic loft as a static figure, and a box over its footprint
    (turned with its heading) added to the level's own colliders, so the walker goes round it. A livery and a wear are a
    field vehicle's; a road car's paint is its build's. Absent, byte-identical.
  - **A base parks its vehicles:** a building level's `building.parked` (true: a truck and a carrier; a list; or
    `{ vehicles?, livery?, wear? }`) lays them side by side in its hangar (else its largest room), noses to its doors,
    as many as it holds, stamped into the level's manifest.
  - **Painted by the faction:** its foes' crew colourway paints them (a camo it names, else its own colour flat), else
    the setting's camo, else the operator's `livery`. A crew in desert colours drives desert camo.
  - The walled-core dungeon card names the word beside a base's buildings (its ceiling re-pinned with the reason).
- **The engines:** each field body's GLB, in camo and worn, passes the Khronos glTF validator (`gltf-validator`, a
  devDependency) with no error and no warning: its camo and grime in `COLOR_0`, its slots its own materials (the
  paint, mud, worn steel, vision blocks). The Godot leg takes the same GLB; its own gate needs `MOJULO_GODOT`, absent
  here.
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
  - `preview-vehicle.test.js`: a field vehicle's livery and wear carried in its loft's recipe, refused on a road loft.
  - `mil-wear.test.js`:
    - the words and the soil read from a camo;
    - mud cut low and round the arch, more the harder the wear, the area kept;
    - chips only on seen edges and handled parts;
    - dust nearer the soil low than high, and grounding darker nearer the hub at every wear;
    - the same twice, another seed another way;
    - a wheel's rubber muddied.
  - `road-military.test.js`:
    - the wear a working vehicle's by default, a brief's word and the operator's over it, and refused on a road car;
    - in its setting: lit by its world's sky (full and warm by day, dim and cool at night, along the sun when it is up,
      noon with no world), its ground the soil's, wet in the rain (glossier, the mud darker, its size unchanged);
    - a road car keeps its noon;
    - a body on more than two axles: each axle's pair, its wheelbase to its rear axles' middle, at its class's size;
      its canvas sagging between its bows; within its budget; driven by its row;
    - the slab: the solid inside its outlines (its volume), closed and flat; its sharp edges chamfered narrow and a
      shallow crease nearly whole; a face left off not drawn, nor its edges chamfered;
    - the carrier: four pairs, its wheelbase first to last, at its class's size; a raked glacis and sides, chamfered;
      vision blocks in their slot, the mount ring empty; within its budget (40k kept, 60k used, 80k in camo); driven by
      its row.
  - `livery-cut.test.js`: a thin face of many corners sliced along its length, its area kept.
  - `parked.test.js`:
    - a word read through the registry, refused without a body that parks, a livery or wear refused on a road car;
    - laid in a room inside it, noses to +x, as many as it holds;
    - lowered: a static loft figure and a box over its footprint, turned with it; in a world its figure compiled and
      its box beside the level's own colliders; absent, nothing;
    - a faction's colourway to its paint; a base's word read; a hangar's vehicles in its setting's camo, or its foes'
      faction's; absent, the level as it was.
  - `scene-gltf.vehicle.test.js`: each field body's GLB valid by the Khronos validator, its colours and slots on.
  - The routing fixture: a muddy desert jeep to look at (`mint_solid`), a base with trucks and a carrier parked
    (`design_game`).
  - The form render in the page: each shadow light biased along the body's normals.
  - The quick game end to end: a night kit's jeep lit dimmer than the day valley's, under its world's own sky.
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
  - Its wear: woodland used and battered, desert battered, and battered in the page's own light, low. The first pass was
    too faint (the mud dark on a dark camo and under the body), so the dried mud was made lighter and its line raised:
    a battered 4x4 carries a ragged mud line up its flanks, cowl and bumper.
  - In the page's own light, with shadows. The stripes of self-shadow on the flat plates turned from the sun are gone
    with the normal bias.
  - Its settings, a battered woodland 4x4 in the page under four skies:
    - noon;
    - a golden low sun, warm and raking, with long shadows;
    - an overcast rain, darker and glossy, the sky in its wet paint;
    - the alien night, a dim purple moonlight.
  - The canvas truck plain, from the three-quarter, the rear quarter and the side (the sag's wave along its roof), in
    woodland worn, and in desert under a golden sun.
  - The carrier plain, from the three-quarter, the side, the rear quarter and the nose; woodland used at noon and under a
    golden sun, desert battered under a golden sun.
  - A hangar-bay with `parked: true`: the truck and the carrier side by side in woodland, noses to the doors.
- **Not built yet, said:**
  - Streaks under the fittings (rain and rust runs).
  - A race mood (`golden`, `dusk`…) named on a field vehicle's loft: its light is its world's sky, read.
  - Lamps lit at night: the head and blackout lamps are emissive slots as always, not yet switched by the hour.
  - A camo on the canvas: the tilt is plain canvas, as most are.
  - A base's outdoor yard: a base has no outdoor stage yet, so its vehicles park in its hangar.
  - Parked vehicles lit indoors: they take the world's sky as their light, as outdoors (a hangar's own lamps do not
    light them yet).
  - The Godot gate on a machine with Godot.
