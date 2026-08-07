# HTML/CSS-Native Rendering

A 3D rendering engine that emits nothing but what a browser already speaks: positioned
elements carrying CSS 3D transforms, and SVG vector paths. No WebGL, no canvas, no scene
library, no dependency of any kind. This doc is the engine's design model in ordinary
3D-graphics terms — written for a 3D practitioner sizing it up, and for anyone learning
to drive it. It sits *above* the mechanics docs
([POLYGONIZER-SYNTHESIS.md](POLYGONIZER-SYNTHESIS.md) is the geometry,
[scene-css3d-lighting.md](scene-css3d-lighting.md) is the lighting) and answers the
question those don't: **what kind of renderer is this, and what does authoring for it
actually mean?**

**You drive it by intent, not by an API.** You never call the engine's tools yourself — you
describe the form, the staging, the variation you want in natural language, and an LLM agent
composes the scene graph and picks the renderer for you. The doc forks to match the two
things you'll want to know. **Part I — The Principles** states the engine's model in standard
rendering terms: read it to know *what the engine can do and how it thinks*. **Part II — What
You Can Ask For** is a catalogue of *requests*: for each capability, when to reach for it,
what comes back, and — most usefully — what you should decide before you ask, so the agent
isn't guessing. The two parts join on the principle a capability *realizes*.

Internal names — the engine's own coined vocabulary, glyph registries, function names —
appear **only** in the Glossary, which maps each standard term used above to the code that
implements it. Parts I and II stay in conventional language; the Glossary is the one door
into the source.

---

## Preface

The output is markup; it runs anywhere a `<div>` runs. A composition is authored once as a
**scene graph of world-space geometry** and rendered through one of two back ends:

- A **still render** — the geometry projected to a fixed-camera image (SVG paths, lighting
  baked in). One viewpoint, portable as a picture, prints and embeds anywhere.
- A **real-time scene** — the geometry emitted as depth-carrying CSS-3D elements with a
  free camera. Forms keep their real volume, the camera travels, and the browser composites
  near over far on its own.

Same geometry, two render targets: you author the form once and choose the back end.

One fact makes the free camera possible: **shading is baked in world space from the
geometry and the light alone — it is view-independent, never computed per camera.** Every
face knows how it faces the light the moment it is placed (Lambertian diffuse, baked
per-face), so a scene is lit once and then navigated. Most constraints in this document
descend from that choice and from the zero-dependency stance — they are not arbitrary
rules, they are what the renderer is made of.

The geometry is uniform: a column, a tram, and a human thigh are the same kind of object —
a profile lofted into a closed, pre-shaded mesh. Master one and you can author the others,
which is why the catalogue of what you can render keeps growing while the underlying
representation stays fixed.

**Reading this while exploring.** Part I is the map of *what the engine can do* — read it
to get oriented. Part II is what to settle in your head *before you ask the agent for it*.
The Glossary is the door *into the code*. The [Frontier](#frontier) names the open seams
worth pushing on. This doc is meant to grow: as spikes fold new capability into the engine,
their principle and tool entries are updated here (see
[Keeping this current](#keeping-this-current)).

---

# Part I · The Principles

Standard 3D-graphics terms throughout; the engine's own coinages live in the Glossary. You
already know what a scene graph or the painter's algorithm *is* — so each principle leads
with where this engine **deviates** from the default a 3D person assumes, not with the
textbook definition. The news is in the first sentence. Each closes with the tool that
realizes it — the hinge into Part II.

### I. One scene graph, two render targets.
Geometry first, image second. The same world-space geometry renders either as a
fixed-camera **still** or as a free-camera **real-time scene**. You do not model a picture
and a scene separately — you author the geometry and pick the back end. Render still when
the result will hang or print; render to the scene when the camera should move.
*Realized by* → `create_sketch` (still), `create_manji_tree` (either), `create_fractal_city` · `create_solid_turntable` · `create_transportation_hub` (scene)

### II. Lighting is baked and view-independent — there are no view-dependent terms.
Do not reach for a specular highlight, a reflection, or fresnel: the shading model has no
handle for them. Shading is Lambertian diffuse, baked per-face from how each face is
oriented to the light — computed once, in world space, never per camera. That is the
trade: you give up everything that depends on where the eye is, and in return the camera
can move through a lit scene with no re-lighting. You set the light rig and the time of day
for the world; you never hand-paint a highlight, and a glossy read comes from value and
finish, not a live highlight.
*Realized by* → the lighting / time-of-day controls shared across the scene tools

### III. Solids are lofted from a swept profile — not modelled vertex by vertex.
There is no mesh you push points around on, and no open shells: every solid — a column, a
vehicle, a limb, a vase — is one cross-section profile swept along a path and capped into a
closed, watertight manifold. You author the profile and the sweep, not the geometry. Closure
is not optional polish — a manifold is the cost of admission to the real-time scene, because
only a closed shell reads correctly from every angle (Principle XI).
*Realized by* → `create_manji_tree`, `create_carved_solid`, `create_solid_turntable`

### IV. Surface detail is real displaced geometry, not a map.
There are no normal, bump, or displacement *maps* — nothing is faked in a shader, because
there is no shader. An open surface is a sheet over a parametric grid, displaced as actual
geometry by a function — rippled, spiralled, tightened, raised into a heightfield. The same
mechanism yields a radial fan, a vortex, a cathedral spin, or a range of hills. You author
the grid and the displacement field; the surface follows. Detail you want has to be in the
geometry, not painted onto a flat face.
*Realized by* → `create_manji_tree` (fields), `create_painted_landscape` (terrain, sky)

### V. The composition is a scene graph.
A composition is not a flat pile of shapes — it is a tree of named, transform-nested
nodes, each a lofted solid or a displaced surface, validated as a whole before it renders.
You author by naming and nesting, the way a sentence nests clauses, not by placing
primitives one at a time on a blank canvas.
*Realized by* → `create_manji_tree`, `create_polygonized_sketch`

### VI. A figure is posed by forward kinematics — there is no IK.
You do not drag a hand or foot to a target and let a solver fill in the chain; you set the
pose from the joints out (forward kinematics), or name a pose. Beyond that, a figure is the
familiar rig-and-skin: a jointed skeleton with mass skinned over it — musculature, limb
volume, naturalized hands and feet, garments — where the pose lives on the joints and the
look lives on the skin. Feet have real heel, arch, ball, and a bending toe; the body carries
weight that settles onto a planted foot.
*Realized by* → `create_figure`

### VII. Animation is a looping parametric cycle, not a keyframe timeline.
Motion is not a free timeline you scrub and ease by hand — it is a procedural cycle (a phase
from zero to one that returns to where it began) sampled into frames. A walk is a phase
machine over foot placement and weight transfer; a run is its sibling with a flight moment;
you can also key named poses into a custom cycle. Two limits a 3D person will hit fast: the
cycle loops **in place** — the root does not yet translate through world space — and there
are no per-keyframe easing handles; you describe the cycle or shot, not a bezier curve (see
[Frontier](#frontier)).
*Realized by* → `create_figure` (motion), `forge_motion`, `stitch_motion`

### VIII. Staging is a light rig and a time of day.
To stage a scene you lay down ground, raise forms on it, then set the **light rig and the
time of day** — warm noon, dusk, moonlight — and the whole scene takes that lighting
together, with soft ambient-occlusion pools where light gathers and cast/contact shadows
where one form blocks another. For a diagram you set *no* time of day: flat, even shading
with the atmospheric layers dropped. The handle is *intent, not subject* — the one control
spans a chart, a room, and a city.
*Realized by* → `create_fractal_city`, `create_transportation_hub`, `create_painted_landscape`

### IX. The world is procedurally generated, not hand-placed.
You do not position every building, tree, or car. You give a rule — a seed, a density, a
scatter field, an opt-in element — and the world is instanced from it, identically every
time (deterministic from the seed). "Run a tram line down the main street" is one
decision; the trams instance along the median. You author at the level of *generating a
world* and reach in to place individuals only where the rule isn't enough.
*Realized by* → `create_fractal_city`, `create_painted_landscape`

### X. Models are parametric, not redrawn.
A model is a starting point with parameters, not a fixed mesh. One car hull becomes coupe,
chopped, widened, lowered, lifted; one body takes a whole palette of finishes; one figure
slouches into an amble or braces into a sprint. You do not re-model to get a variant — you
turn the parameters on a model you already have.
*Realized by* → `create_figure`, `create_manji_tree`, `create_carved_solid`

### XI. Depth comes from the painter's algorithm, not a z-buffer.
The real-time scene has no per-pixel depth buffer; the browser composites whole faces
**back-to-front** (painter's algorithm) and the faces must be flat, separated, and closed.
A form earns its place in a scene by being a closed manifold of planar faces under a face
budget (Principle III). Organic, self-intersecting, or per-pixel-shaded-while-rotating
forms cannot be depth-sorted as whole primitives, so they route to the still render or to
a baked animation instead. Knowing which side of that line a form falls on is half of
authoring for the scene.
*Realized by* → the real-time scene generally (`create_fractal_city`, `create_solid_turntable`, `create_transportation_hub`)

### XII. The render is your only feedback signal — so the loop is ask → look → adjust.
You drive by intent and you cannot read the scene graph the agent built; the render is the
only thing that tells you what happened. So multi-view inspection is doing double duty. It
is *geometry* QA — with no depth buffer as a safety net, a form that looks right head-on can
be hollow or missing a flank, so you render it still from several cameras (front
three-quarter, side, rear three-quarter) and turntable around it before trusting it in a
scene. And it is *prompt* QA — the same several views are how you confirm the agent built
what you meant, not just that the geometry closed. When a render is wrong, you adjust the
ask, not the mesh. The still render is the inspection bench for both the engine's output and
your own intent.
*Realized by* → `create_solid_turntable`, `diff_sketches`, `update_sketch`

---

# Part II · What You Can Ask For

You never call these tools — you describe what you want and the agent reaches for the right
one. So this is a catalogue of *requests*, not an API: what each capability is for, what
comes back, and — the line to read closely — **what you should decide before you ask**, so
the agent isn't guessing the parts only you know. Some entries also flag **what won't take**
— a lever your instincts will reach for that this capability has no handle for; the full map
of those is in [What isn't here](#what-isnt-here--and-the-nearest-lever-that-is). Each entry
names the tool the agent reaches for and the principles it leans on (the hinges back to Part
I and the code). Standard terms throughout, as in Part I.

The authoring loop is **ask → look → adjust the ask**: you can't see the scene graph the
agent built, only the render, so you read the render against your intent and re-prompt
(Principle XII). The lists below are how you make the first ask land close.

### Still diagrams & charts
*Agent reaches for `create_sketch` · Principles I, V.*
- *Ask when:* the result will hang still — a flow of boxes and arrows, a chart, a marked-up
  illustration. A fixed camera is fine; depth is incidental.
- *You get back:* a still render.
- *Decide first:* the diagram's content and structure; layout and layering are handled for
  you. If the camera must move, ask for a scene instead.

### A built form or scene
*Agent reaches for `create_manji_tree` · Principles III, IV, V, I.*
- *Ask when:* you want a *closed form or scene* assembled from solids and surfaces — not a
  flat billboard — whether it ends up as a picture or something to move around.
- *You get back:* either render target — the real-time scene when the faces qualify
  (Principle XI), otherwise a still render.
- *Decide first:* the form as a named, nested hierarchy, and one lighting choice for the
  whole scene rather than part by part.
- *Won't take:* reflective, glassy, or specular materials, and forms that interpenetrate or
  fuse in the scene (Principles II, XI). Compose parts as separated closed shells; a glossy
  look comes from value and finish.

### An atmospheric landscape
*Agent reaches for `create_painted_landscape` · Principles IV, VIII, IX.*
- *Ask when:* you want an evocative scene — depth-banded terrain, sky, water, structures —
  built from a curated recipe rather than placed by hand.
- *You get back:* a still render (atmospheric), with real-time-scene support where eligible.
- *Decide first:* a small brief — the mood/seed, a colour direction, a camera, roughly how
  much of each depth band. The curated recipes carry the heavy detail, so keep the ask
  short.
- *Won't take:* reflective water, specular sun glint, or volumetric haze as lit effects
  (Principle II). Atmosphere is baked into face value and the sky layer — ask for the *mood*,
  not the optical effect.

### A human figure
*Agent reaches for `create_figure` · Principles VI, VII, X.*
- *Ask when:* you want a person — posed, or animated through a walk or run.
- *You get back:* a still render; a looping flipbook for animation.
- *Decide first:* the pose or the named motion (walk / run / a custom sequence), and any
  performance quality (an amble, a sprint). Animation loops in place — it does not yet carry
  the figure across the frame ([Frontier](#frontier)).
- *Won't take:* IK targeting (drag a hand to a point), a facial rig, or a gait that turns or
  changes stance width (Principles VI, VII). Pose from the joints out; keep motion
  fore-and-aft.

### A generated city
*Agent reaches for `create_fractal_city` · Principles IX, VIII, XI.*
- *Ask when:* you want a whole city grown from a rule — streets, blocks, buildings,
  sidewalks, optional extras — reproducible every time from the same seed.
- *You get back:* a real-time scene.
- *Decide first:* the seed and feel (a starting point, how far it extends, how dense), the
  time of day, and any opt-in elements (a tram line, etc.). Ask to place a specific thing
  only where the rule isn't enough.
- *Won't take:* hand-placing every building, or a person walking the street (Principles IX;
  [Frontier](#frontier)). Drive the rule; the figure and the world haven't met yet.

### Transit infrastructure
*Agent reaches for `create_transportation_hub` · Principles IX, VIII, XI.*
- *Ask when:* you want multi-zone infrastructure around a transit spine, built from the same
  world machinery as the city.
- *You get back:* a real-time scene.
- *Decide first:* the same kind of brief as the city, scoped to the hub's zones.

### A solid on a turntable
*Agent reaches for `create_solid_turntable` · Principles III, XI, XII.*
- *Ask when:* you want a single solid you can inspect from all sides — it spins live in the
  scene.
- *You get back:* a real-time scene (a self-contained spinning view).
- *Decide first:* the shape, the colour, the surface finish. The form has to close cleanly
  (Principle XI) to spin without sorting artifacts — which is the whole point of inspecting
  it this way.

### A carved wordmark or logo
*Agent reaches for `create_carved_solid` · Principles III, X.*
- *Ask when:* you want text or a shape carved from a solid material, optionally with a
  reveal effect.
- *You get back:* a still render; a flipbook for the effect.
- *Decide first:* the text or shape, the material, and the style of the effect.

### Direct, low-level geometry
*Agent reaches for `create_polygonized_sketch` · Principles V, IV.*
- *Ask when:* you (or the agent on your behalf) want to compose in the engine's low-level
  primitive vocabulary directly, beneath the curated recipes.
- *You get back:* a still render.
- *Decide first:* that you really want this door — it is the close-to-the-metal access to
  Part I's geometry and assumes fluency in the primitive vocabulary. Most requests are
  better served by the capabilities above.

### Animation & camera moves
*Agent reaches for `forge_motion` / `stitch_motion` · Principle VII.*
- *Ask when:* you want something that already renders — a figure, a built form, a terrain, a
  carved solid — set in motion, or a camera moved across it.
- *You get back:* a looping clip; `stitch_motion` joins two or more motions end to end.
- *Decide first:* that the subject already stands on its own — motion is a layer over it,
  not a re-build — plus the move or sequence you want.
- *Won't take:* a keyframe timeline with eased curves, or a dolly with hand-tuned
  ease-in/out (Principle VII). Describe the cycle or shot; per-frame easing isn't a handle.

### Revising & comparing
*Agent reaches for `update_sketch` / `diff_sketches` · Principle XII.*
- *Ask when:* you have prior work to revise, or two versions to compare — not a fresh build.
- *You get back:* the same render target as the source.
- *Decide first:* which prior result you mean; use these to iterate and to confirm a change
  did what you intended.

---

## What isn't here — and the nearest lever that is

This is the most useful page in the doc for someone coming from 3D, because most failed
prompts aren't badly phrased — they ask for a capability the engine has no handle for. Your
instincts will reach for things that don't exist here. Below is the map.

The split matters: **absent by design** means the architecture rules it out — stop asking,
use the nearest lever. **Not built yet** means it's on the [Frontier](#frontier) — reasonable
to want, just not here today; the nearest lever is the stopgap until it lands.

**Absent by design** *(consequences of baked, view-independent, painter's-order, dependency-free rendering)*

| You'll reach for… | Why it's absent | Nearest lever here |
|---|---|---|
| Specular highlights, reflections, fresnel, gloss | Shading is baked and view-independent — no view-dependent terms (II) | Set light direction + a material finish; a glossy read comes from value, not a live highlight |
| Normal / bump / displacement *maps*, UV textures, PBR material graphs | No shaders; detail is real geometry and look is per-face value + tint (IV) | Push the detail into the displacement geometry; pick a material, finish, and tint |
| Lighting *to* the camera, per-view highlights | The scene is lit once in world space (II) | Set the world light and time of day, then move the camera freely |
| Interpenetrating or boolean-fused geometry, true per-pixel depth | Painter's algorithm, no z-buffer (XI) | Compose separated closed shells; route intersecting or organic forms to the still render |
| IK posing — drag a hand or foot to a target | Pose is forward kinematics (VI) | Set the pose from the joints out, or name a pose |
| A keyframe timeline with eased curves; a hand-tuned camera ease | Motion is a sampled parametric cycle/shot, not a scrubbable timeline (VII) | Describe the cycle or the shot; choose the camera move at the shot level |

**Not built yet** *(on the [Frontier](#frontier) — wanted, just not here today)*

| You'll reach for… | Status | Nearest lever here |
|---|---|---|
| A figure — or anything — that travels through world space | Animation loops in place (VII) | Animate in place; move the camera to imply travel |
| A gait that turns, corners, or changes stance width | Gait is sagittal (fore-and-aft) only | Keep the walk going straight |
| A character standing or walking in the generated world | The figure and the world haven't met (IX, VII) | Stage the figure and the world as separate renders |
| Organic, curved, or soft forms inside the real-time scene | The swept-net family doesn't yet absorb all organics (XI) | Route organic forms to the still render |

When a prompt lands in the left column, that's not a phrasing problem — re-asking won't fix
it. Move to the nearest lever, or (for the second table) check the [Frontier](#frontier) in
case it has since shipped.

---

## Glossary / Index

The only place internal names and code appear. Each entry maps a conventional term used
above to the part of the engine that implements it. Terms are the join from the prose;
the code paths are the join into the source.

**Render targets & lighting**
- **Still render** *(prose: "still render", "flat surface")* — two-point projection of world geometry to vector paths. → `projectTwoPoint` in [polygonizer/pure-mandala.js](../control/lib/graph/polygonizer/pure-mandala.js); [polygonizer/manji-svg.js](../control/lib/graph/polygonizer/manji-svg.js).
- **Real-time scene** *(prose: "real-time scene", "scene surface")* — depth-preserving emission of world geometry as transform-carrying CSS-3D elements, composited back-to-front. → `renderBoxCityToHtml` in [scene-css3d.js](../control/lib/graph/scene-css3d.js).
- **View-independent shading** *(Lambertian diffuse)* — directional diffuse shading, baked per face, camera-independent. → `makeLight` in [polygonizer/vexar.js](../control/lib/graph/polygonizer/vexar.js).
- **Light rig + time of day** *(the baked lighting stack)* — sun, soft ambient-occlusion pools, traced diffusion, cast and contact shadows, moonlight, sky; baked from world geometry only. → [scene-css3d.js](../control/lib/graph/scene-css3d.js) and [docs/scene-css3d-lighting.md](scene-css3d-lighting.md).

**Geometry**
- **Lofted solid / closed manifold** *(prose: "lofted/swept solid")* — a solid lofted from a capped profile swept along a path. → [polygonizer/vehicle-swept-net.js](../control/lib/graph/polygonizer/vehicle-swept-net.js), [polygonizer/vehicle-smooth-box-net.js](../control/lib/graph/polygonizer/vehicle-smooth-box-net.js), [vehicles-swept.js](../control/lib/graph/vehicles-swept.js).
- **Displaced parametric surface** *(the wave families)* — open and closed displacement waves at 1D and 2D over a parametric grid. → [polygonizer/line-between.js](../control/lib/graph/polygonizer/line-between.js), [polygonizer/wave-field.js](../control/lib/graph/polygonizer/wave-field.js), [polygonizer/wave-manji.js](../control/lib/graph/polygonizer/wave-manji.js), [polygonizer/lathe.js](../control/lib/graph/polygonizer/lathe.js); model in [docs/POLYGONIZER-SYNTHESIS.md](POLYGONIZER-SYNTHESIS.md).
- **Scene graph** *(prose: "scene graph", "named tree")* — the composite-geometry IR, validated at build time. → [polygonizer/manji-program.js](../control/lib/graph/polygonizer/manji-program.js), [polygonizer/manji-svg.js](../control/lib/graph/polygonizer/manji-svg.js).
- **Expansion pipeline** — resolving a composition into paint-ordered marks (cameras, light scenes, construction, gesture, shadow, paint order). → [neo-rembrandt/index.js](../control/lib/graph/neo-rembrandt/index.js).
- **Still-render manifest vocabulary** — what the still render validates and rasterizes (stations/edges + marks). → [sketch-manifest.js](../control/lib/graph/sketch-manifest.js).

**Figure**
- **Skeletal rig** *(prose: "rig", "armature")* — the jointed skeleton and its symmetry/chains/ground frame. → [polygonizer/figure-rig.js](../control/lib/graph/polygonizer/figure-rig.js); clamped forward kinematics in [polygonizer/figure-vajra.js](../control/lib/graph/polygonizer/figure-vajra.js).
- **Balance / ground / vault** — the inverted-pendulum solvers that plant feet and vault the pelvis. → [polygonizer/figure-balance.js](../control/lib/graph/polygonizer/figure-balance.js).
- **Pose & animation vocabulary** — the pose words, the gait and sprint cycles, keyframe and performance layers, one motion front door. → [polygonizer/figure-posing.js](../control/lib/graph/polygonizer/figure-posing.js); renderer wiring in [polygonizer/figure-render.js](../control/lib/graph/polygonizer/figure-render.js).
- **Skinned mesh** *(prose: "skin", "flesh")* — musculature, limb volume, naturalized hands/feet, garments. → [polygonizer/figure-musculature.js](../control/lib/graph/polygonizer/figure-musculature.js), [polygonizer/figure-proto.js](../control/lib/graph/polygonizer/figure-proto.js), [polygonizer/figure-garments.js](../control/lib/graph/polygonizer/figure-garments.js).

**Scenes & procedural generation**
- **Scene director / procedural world** *(prose: "procedurally generated")* — the procedural city: anchors, quadrants, street grid, opt-in elements, deterministic from a seed. → [fractal-city.js](../control/lib/graph/fractal-city.js).
- **Interior layout** — connected rooms and hallways with derived doorways. → [suite-layout.js](../control/lib/graph/suite-layout.js).
- **Vehicle family** — the parameterized swept-net vehicles, the streetcar corridor, roads. → [vehicles-css3d.js](../control/lib/graph/vehicles-css3d.js), [roads.js](../control/lib/graph/roads.js), [transportation-hub.js](../control/lib/graph/transportation-hub.js).
- **Carved solid / turntable** — wordmarks and single spinning solids. → [carved-solid.js](../control/lib/graph/carved-solid.js), [solid-turntable.js](../control/lib/graph/solid-turntable.js).
- **Curated recipe cards** — token-small briefs for landscapes, charts, palettes. → [painted-landscape-cards/](../control/lib/graph/painted-landscape-cards/), [sketch-vocab/](../control/lib/graph/sketch-vocab/), [geo/palette.js](../control/lib/graph/geo/palette.js).
- **Placer glyphs & apocrypha** — façade glyphs, furniture cards, room-scene elements, the architecture planner. → [polygonizer/architecture-glyph-registry.js](../control/lib/graph/polygonizer/architecture-glyph-registry.js), [polygonizer/furniture-cards.js](../control/lib/graph/polygonizer/furniture-cards.js), [polygonizer/room-scene-elements.js](../control/lib/graph/polygonizer/room-scene-elements.js), [polygonizer/architecture-mandala-planner.js](../control/lib/graph/polygonizer/architecture-mandala-planner.js).
- **Map illustrator** — place queries to polygon marks. → [geo/](../control/lib/graph/geo/).

**Tools**
- The MCP render tools named in Part II are registered from [control/lib/mcp/tools/](../control/lib/mcp/tools/): sketches, manji-trees, painted-landscape, figure, scene-city, scene-transport-hub, solid-turntable-tool, carved-solid, motion.

### A note on the naming

The standard 3D-graphics terms in Parts I and II are the shared-language surface of this
engine. Its internal vocabulary — the names you meet in this Glossary and the code — comes
from the author's own lineage: figure drawing and draughtsmanship, classical perspective,
the closed-form, flat-shaded look of 1990s 3D animation, and a decade of front-end CSS. That
lineage is not decoration; it is why the engine is shaped the way it is — construction before
flesh and inspection from every angle (figure drawing), two-point projection (perspective),
painter's-order whole-face compositing (the 90s pipeline), and a scene built from nothing but
`<div>`s and transforms (CSS). The original names are kept out of the body on purpose: the
engine is meant to be reachable in ordinary rendering language, and the canonical terms above
are the faithful translation, not a retrofit. They remain in the source because that
worldview is how the thing was built in the first place.

---

## Frontier

The open seams — kept honest and current so exploration has a live edge to push on. These
are *not yet* true; treat them as the next things on the bench, not capabilities.

- **The figure animates in place.** A walk or run loops on a treadmill; the root does not
  translate through world space. *Characters that move* exist; *characters that go
  somewhere* do not yet (Principle VII).
- **The figure and the world have not met.** Vehicles instance into scenes; no character is
  yet placed on a street. Joining the animated figure (VII) to the procedural world (IX) is
  the milestone that makes "peopled world" literal.
- **Gait is sagittal only.** Legs swing fore-and-aft; turning, toe-out, and stance width
  are not yet parameters. The walk can't round a corner.
- **One representation, not yet one primitive.** Lofted solids (III) and the displacement
  waves (IV) compose in a scene, but organic forms still route around the painter's-order
  scene (XI) more often than they pass through it. How far the swept-net family can absorb
  organic forms — so the real-time scene admits more of what the still render can draw — is
  an open question.

---

## Keeping this current

This doc is the synthesis layer above the spike plans, the way
[POLYGONIZER-SYNTHESIS.md](POLYGONIZER-SYNTHESIS.md) supersedes its integration files. It
grows by **import from spikes**, not by being rewritten.

Spikes land as `plan.md` under `lite-template/integration/<date>/` and prove a capability
in `spike-output/`. When a spike *folds a capability into the engine* — typically when
it deletes a predecessor and the new thing becomes a shared primitive — reflect it here:

1. **Principle.** If the spike enacts an existing principle better, leave Part I alone. If
   it establishes a genuinely new *kind* of authoring move, add a principle (next Roman
   numeral) in standard 3D-graphics terms — no internal coinages.
2. **Driving the Tools.** Update or add the Part II entry for the tool it lands behind:
   what it now enacts, assumes, emits, and what the caller should decide first.
3. **Glossary.** Add the canonical term (and the prose alias, if any) and point it at the
   new code. This is the only place the spike's internal names enter the doc.
4. **Frontier.** Move what the spike closed out of the Frontier; add the new seam it
   opened.
5. **Log it below**, with the source plan, so the provenance is traceable.

Keep the churning detail in the spike `plan.md` and the mechanics docs; this doc links to
them, it does not absorb them.

### Imported from spikes

| Date | Spike | What it imported here |
|------|-------|-----------------------|
| 2026-06-15 | [0615/figure-walk.plan.md](../lite-template/integration/0615/figure-walk.plan.md) | Principles VI–VII, X (figure as rig + skinned mesh, animation as a parametric cycle, parametric variation); `create_figure`, `forge_motion`/`stitch_motion` entries; figure glossary block; in-place / sagittal-only / figure-meets-world frontier seams. |
| 2026-06-15 | 0615/vehicles-css3d, 0615/streetcar | Principle X (parametric models) evidence; vehicle-family glossary; procedural element opt-in (IX). |
