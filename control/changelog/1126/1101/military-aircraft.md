### Military aircraft: the field's visual language on the craft shelf

In progress. The craft shelf's aircraft drawn in the field's language:
- the form render's material slots and the setting's light;
- camo, panel lines and markings cut in as geometry;
- wear (soot, streaks, chipped edges, patched panels);
- kit as cards.

New military aircraft on new flight primitives (a helicopter's rotors, a reconnaissance drone), parked in a base and
exported to a valid GLB.

- **The craft in the form render** (`craft-shelf/craft-form.js`): the shelf's own craft, the same faces and size,
  handed to the page instead of baked.
  - **From the lowered build:** the assembler lowered under the flat light (raw albedo), each face kept with its item
    (the hull, each wing, the engine, the canopy, the gear, the stores) as its part.
  - **Its slot:**
    - its palette role where its colour is one;
    - else its material's signature: a light rough and lit, glass smooth, bare metal metallic, rubber dark and rough;
    - else the nearer of paint and trim.

    A light is told by its hue: port red, starboard green, an exhaust's glow.
  - **`AIR_MATERIALS`:** a semi-gloss paint and its trim, bare and hot metal, a canopy's tinted glass, the rubber, the
    nav lights and the glow.
  - **Its form:** corner normals smoothed within each item and slot at a crease, so a lofted hull reads round and a
    trailing edge stays sharp.
  - **The figure** (`craftFormFigure`, and `craftFigure(archetype, { light: 'form' })`): one bone per item, still,
    lit by its world's sky (`skyMood`) or noon. Without the word, the baked figure as it always was.
  - **Held** (`craft-form.test.js`):
    - the shelf's size and items;
    - every face a slot, an albedo, unit normals; the slots an aircraft has, nav lights both sides;
    - the hull round;
    - a bone per item, in the form render, dimmer at night;
    - the same twice; the baked figure unchanged;
    - its GLB valid by the Khronos validator.
  - **Seen** (machine gate only; the eyes gate is open): the multirole fighter at noon and under a golden sun, and the
    close-support jet at noon, in the page's own light and shadows.

- **The study** (after the craft in the form render): the aircraft, close up, were nowhere near the vehicles' made
  detail.
  - **What they lacked:** smooth lofts with ring seams only; an opaque canopy; a smooth scoop; hinge lines that barely
    read; box petals; a torus tyre; a plastic sheen; the mirrored half of every pair shading as its underside.
  - **The breakdown:** what each part kind must carry, the recomposition's order (the plan).
- **The aircraft detail kit:**
  - **The skin** (`craft-shelf/air-kit.js`). Panel lines laid on each item's own faces along the planes they lie on:
    - a ribbon a centimetre and a half wide, a millimetre proud, a quad on each face a line crosses;
    - darker than the paint and in its slot, so a livery's cut passes it by.

    By part kind:
    - **A tube** (a fuselage, a nacelle, an intake, a store): its frames round it, closer over its forward third; its
      longerons (the spine, the chines, the waterline, the keel); its access panels outlined, their fasteners set on
      the skin where a ray from the axis meets it.
    - **A wing or a tailplane:** its ribs across the span, its front and rear spars.
    - **A fin:** the same, up its span.

    `craftForm(archetype, { made: true })` lays them. The fighter's made skin costs about 7.5k triangles.
  - **The parts** (`craft-shelf/air-kit-parts.js`), the shelf's own monomers for the builders' made finish (the
    recomposition, next):
    - a rolled lip;
    - a hinge line and its knuckles;
    - a door with its hinge and actuator;
    - a gear's well (boxed, ribbed, its plumbing);
    - a treaded tyre on its hub and brake disc;
    - a petal nozzle (petals with gaps, their rods, the flameholder's rings and spray bars inside, a heat-tinted
      throat);
    - a light in its clear cover;
    - a blister;
    - a raked blade.

    Their tints give their materials through the shelf's own finish.
  - **The light:**
    - the paint's sheen lowered;
    - the canopy's glass seen into (transparent);
    - a big figure's own shadow bias (the form's `normalBias`, the page taking the deeper of its own and the
      figure's);
    - every form face wound to agree with its normal. The page draws both sides and turns a back face's normal round,
      so a mirrored part's faces, wound against theirs, shaded as their underside.
  - **Held** (`air-kit.test.js`):
    - the seams laid on the hull, the wings and the fin, darker, in their slot, on the skin;
    - the fasteners;
    - every face wound to its normal;
    - the made fighter within 40k triangles, the same twice;
    - each kit part lowering in its tints at its size (a tyre's tread ribbed, a nozzle's petals);
    - the light's materials and bias.
  - **Seen** (machine gate only; the eyes gate is open): the made fighter whole and from above (the spine's bay and its
    fasteners, the wing's ribs and spars, the mirrored wing lit), and the nose.
- **The cockpit** (the operator saw the glass empty). A fighter's cockpit under its canopy (`air-kit-parts.js`
  `cockpit`), the hull's own under the made finish, so it stays put when the canopy opens.
  - **Built up from a dark deck over the hull's top:** the hull is a closed skin, and what is under it is never seen.
  - **Fitted to the canopy's own section where each piece stands.** The layout hands the hull the canopy it sets on
    it, and a bubble narrows and drops toward its nose.
  - **Its pieces:**
    - the coaming and its glare shield over the instrument panel, its two displays and its dials;
    - the HUD's combiner on its posts;
    - low side consoles;
    - the stick;
    - the ejection seat: its pan, its raked back, its headrest under the roof, the yellow pull handle, its rails.
  - **The canopy's own glass,** made, the smoky gold of its coating.
  - **Threaded:** `made` runs through `assembleCraft`, the layout and `resolveCraftPart` to a builder (absent, its
    recipe as it was).
  - **Held** (`air-kit.test.js`): the seat, its handle, the HUD's glass, all inside the canopy and under its roof; the
    gold glass when made; none without the word or on a craft with no canopy.
  - **Seen** (machine gate only; the eyes gate is open): from the side and from over the nose.
- **The fighter recomposed, part by part** (`craft-shelf/air-made.js`). The made finish each of the shelf's builders adds
  under the word, drawn with the kit's parts. Earth craft only: a spacecraft's language is its own. By part kind:
  - **The hull:**
    - the radome's dark break ring;
    - the angle-of-attack vanes and the IFF blades;
    - the bands the engine's heat leaves over its end (straw, blue, brown, a tint over the paint).
  - **The gear's wells and doors, the airframe's:**
    - The layout hands the hull the parts set on its hardpoints. Each retracting leg's well is laid on the hull's own
      skin: its roof in primer, ribbed, its plumbing. Its doors hang open with the leg down and lie shut with it up.
    - A leg standing in a chin intake's duct has its well under the duct.
    - A well lies the way its leg folds where the belly (or the duct) stays flat over it. Where it would run off the
      nose or the duct, it lies the other way.
  - **The canopy's frame:** its sill rails, the windscreen's bow (where the row names none), its aft frame, moving with
    it as it opens.
  - **The intake:**
    - a polished rolled lip;
    - its duct opened and lined dark back to a deep face, so the mouth reads deep;
    - a side intake's splitter plate on its struts.
  - **The afterburning engine:** the petal nozzle (its petals, rods, flameholder and spray bars) in place of the turned
    one, the engine's face dark behind it.
  - **The gear:** treaded tyres on hubs that show inside the sidewall, the brake disc, a brake line down each leg, the
    nose leg's taxi light.
  - **The wings and the tail:**
    - each control surface's hinge gap on both faces;
    - actuator fairings under a wing's surfaces;
    - the leading-edge flap's line;
    - the nav light in its clear cover;
    - a fin's cap and its beacon.
  - **A missile:** its warhead's and motor's bands, its seeker's dome, its canards.
  - **Fittings, not skin.** Every made piece carries its monomer's group to its faces (`fitting`), so the skin's panel
    lines, its fasteners and a livery pass it by.
  - **Budget:** the made fighter about 43k triangles, within the plan's 80k.
  - **Held** (`air-made.test.js`):
    - each part kind's pieces on the fighter;
    - the wells on the hull, not the swinging leg;
    - the doors open down and shut up;
    - the nose well under the chin duct;
    - a spacecraft's parts and the fighter without the word carrying none of it;
    - a folding-wing fighter made, within budget, the same twice.

    `air-kit.test.js` holds a seam to the made hull's own skin of its slot.
  - **Seen** (machine gate only; the eyes gate is open): the fighter close up before and after (the nose, the intake,
    the canopy, the wing, the tail, the gear and their wells from below), and the other military rows made.
- **The surface: camo, markings and wear** (`craft-shelf/air-surface.js`). `craftForm(archetype, { livery, wear })`, each
  absent adding nothing, all of it geometry and slots.
  - **The livery:** a pattern word or `{ pattern, colours?, scale?, seed?, marks? }`.
    - **Graded** (counterShaded, naval): by the hull's height, the line softened by noise; a wing by its face, darker
      above.
    - **Blotched** (wraparound, desert, arctic): a warped field cut into the paint (`cutByField`), each band its share
      of the craft's painted area.
    - **Splinter:** plan-view lines across the craft, each face split exactly where one crosses it, a shard's colour
      from its side of every line.

    A control surface keeps its shade in its band's colour. A store keeps its own paint. The camo is cut before the
    made skin's seams, so a seam is the camo's colour darkened. The heat's bands tint the camo under them.
  - **The marks** (generic, never a nation's), low-visibility against the paint: a tail number on both sides of each
    fin, a side number on the nose, a disc or bar emblem on the fuselage's sides and the wings (one up, one down), the
    red ejection warning by the canopy, the walkways by the wing roots.
    - Each is a conforming decal (`decal`): convex shapes clipped onto every skin face turned toward them, on its plane,
      a millimetre or two proud.
    - `marks: { number?, emblem?, warnings? }`, or false.
  - **The wear** (`pristine | used | battered`, the field's words): the sun's fade on what faces up and the engine's soot
    over the hull's end, per corner; as decals, the gun's soot plume beside its muzzle, repainted panels, grime streaks
    running aft, and chips to bare metal along the leading edges and the intake's lip.
  - **Fixed in the kernel** (`worlds/workbench-assembler.js`): an item turned or mirrored was relit without the flat
    light's `flat` marker. Under the unshaded light a mirrored part (a left wing, its stabilizer, its gear, its missile)
    lowered shaded where its twin was raw albedo, and the form render slotted it as trim. Now the marker is kept.
  - **Budget:** every military row in any pattern, battered, under 130k triangles (the fighter about 46k to 53k).
  - **Held** (`air-surface.test.js`):
    - a pair's two sides alike;
    - the livery's words;
    - graded darker on top and on a wing's upper face;
    - blotched in every band, the first the most;
    - splinter's shards, the stores spared;
    - seams the camo darkened;
    - the marks on the skin's planes, both sides of the fin, low-visibility, the warning red;
    - a decal only on faces turned toward it;
    - wear more battered than used, chips on what faces ahead, soot over the engine's end;
    - pristine and absent words adding nothing;
    - within budget, wound, the same twice.
  - **Seen** (machine gate only; the eyes gate is open): the fighter in each pattern from above and the side, and
    battered close up (the tail, the wing's leading edge, the gun).
