# The hero under the seventh generation's light

Gen-7 is the form render: a surface carries its material and its form, and the renderer lights it (`era/eras.js`,
the changelog's *Gen 7: form, not light*). Gen-6 is paint, with the light held in the colour. This page records how
far a HERO already gets under gen-7, how the colour theorist sets its light there, and what is missing before a mint or
the World page can draw it. It is an exploration. The module and the spike below change no stored row and no default
render.

## What a hero is lit by today

- **The World page and the default GLB draw a hero as gen-6 paint.**
  - With a cube (`hero.geocube`), the cube's cast light is baked into the vertex colour per corner: the key, a tinted
    ambient, a bounce off the floor, and the horizon as a fresnel rim (`era/cast-light.js` `geocubeCastLight`).
  - Without a cube, the studio key is baked instead.
  - The character light (the two-tone step) is the anime head's and the creature's. A landmark hero never gets it.
- **The `lit` GLB export is nearly the form primitive already.** It writes the albedo under no light and a
  metal-rough material for the renderer to light. Two limits:
  - On the skinned GLB it is one matte material for the whole figure.
  - On the static GLB it is split by response (`body:metal`, `body:pbr0` …), but only when the hero's `geocube` names
    `materials`. A hero's groups take their materials from `materials/dress-materials.js` `dressSurfaces`, written to
    `recipe.surfaces`.
- **Until the cast rig, nothing lit a hero live** (see "What draws it now" below). The live light gives actors shadows
  and occlusion; a painted hero's fills are MeshBasic, and its rim is the rig preview's fresnel patch, never written to
  an export.
- **The era conventions say the same.** `albedo-unlit` and `material-by-response` are planned, and `relief-in-normal`
  is partial: the realistic head only (`era/eras.js`).

## The theorist's light: `color-theorist/hero-light.js`

`heroFormLight(cube, { palette, surfaces, K })` draws the cube's cast light as a rig instead of a bake:

- the key from its sun or moon;
- a hemisphere of the sky's fill over the floor's bounce;
- the horizon as a rim from behind.

A solved palette `K` lends the rig its hues, through `adapters.js` `skinDirection`'s light: the key, fill, rim and
exposure. It never changes the cube's levels. Today `gameworld/hero-looks.js` `worldSkin` keeps only the shade from
that solve and drops the light. Under gen-7 the light is what the solve is for.

The theorist's job moves from painting value into colour to checking value as lit. The reads (`HERO_LIGHT_LAWS`; the
thresholds are the eyes gate's to move):

- **form**: the rig's key-to-fill ratio on a three-quarter face. Under it, the figure reads flat.
- **shade**: no group's shade side falls under the crush floor. A near-black group is a hole, not a colour.
- **focal**: the emblem and its trim hold a clear value step from the base on both sides of the light. A step the
  paint held and the light closes is named.
- **separation**: the figure's shade side against the horizon. Too close, and the rim must carry the outline. The rig's
  rim is raised to do so, and the read says it was.

The values are a proxy: a Lambert key, a hemisphere fill, and a metal reflecting its sky. They are deterministic. They
are the machine gate, never a render.

## What the reads found on the comic hero pack

The pack's looks, read at gen-7 on the pack's own cast (`hero-light.test.js` holds the concepts):

- **Day looks hold.** On `anime-day` the key is about 2.6× the shade side, and on `dcau-golden` (a low warm sun)
  about 2×. Every pack emblem holds its step lit and in shade, and the figure stands well off the sky.
- **The night look reads flat.** On `realistic-night` the city-night reference's light is mostly fill: the key side is
  1.36× the shade side, against a wanted 1.6×, and the figure's shade side is within 0.08 L of the night horizon, so the
  rim carries the outline. Gen-6 hides this, because the bake's ambient floor lifts the shade. A live rig shows it. The
  theorist's move at night is a deeper fill and a stronger moon key, or a rim as the key light.
- **Very dark groups are holes in any shade.** Black hair, and the Modern and Movie eras' near-black boots and gloves,
  fall under the crush floor. That is the rim's job, or a lifted albedo.
- **The realistic body's plating has no material row.** The Movie Hero on the realistic body wears the plating library
  by word (`powerSuit`, `sleekSuit`). Its groups (`Alloy`, `Joint`) are absent from `dress-materials.js`, so gen-7
  would light the alloy as cloth.

## The spike

`node control/scripts/spikes/form/hero-three-ways.mjs [--member hero] [--look dcau-golden] [--era silver] [--out f.html]`
mints a pack member through the door, wearing its look's cube with materials named. It shows the hero three ways:

- (a) the paint, gen-6 as the GLB draws it;
- (b) the form with one response, which is the `lit` export today;
- (c) the form by response, the static export's material buckets.

(b) and (c) are lit by the theorist's rig, with the key's azimuth and the rim on sliders, and the reads printed beside
them. The look is the operator's.

## What draws it now: the cast rig

The steps this page listed are the cast rig's (`control/lib/graph/color-theorist/cast-rig.js` `castRig`, and the page's
material in `control/lib/graph/scene/channels/cast-rig.js`). What is built, and what is not:

- **The rig, solved from the world's own light.** The key is the cube's solved sun at the level's hour (the light the
  land is lit by, `era/cube-light.js`), the fill is that solve's sky light over what the floor throws back, and the rim
  is the horizon's hue. It is built on the solved light, not on the gen-6 cast levels `heroFormLight` reads above, so a
  body and the land share one sun.
- **A body's own gains.** As a fight lights its fighters: the body's key is raised where a sky-lit level would not turn
  it, its fill where a moon over a dark sky would leave its shade a hole, its rim where its shade side sits on the
  horizon's value. The world's light is never changed. The night finding above is answered here, on the body, and not
  by rebalancing the cube.
- **Only the key is a light.** The sky over the ground and the rim are in the body's own shader, so they light nothing
  else; a page has one key, the land's sun on a form page.
- **Who is drawn under it.** A fight game's and a brawl's bodies under a register; the hero a player pilots, on every
  World page that draws it; a vehicle's form body (its own setting's sky, its physical slots kept). Walkers, foes and
  crowds stay paint under the live light. A model made elsewhere (`modelRef`) and the exports (`paint`, `unshaded`) carry
  no rig.
- **The piloted hero's cube** (`worlds/world-scene.js`, `heroCastSource`), the first that holds: the page's form land
  (its cube and hour; the rig as it was); the land's own cube drawn as paint (a geocube, a map's `level.geocube`) at the
  recipe's hour; the hero's own `geocube` (its spec's or its stored row's); else the rig's card (`CAST_CARD`). The hero is
  read lit (its colour under no light and its normals), so the rig replaces the baked light on the page and is never
  stacked on it. The register is the game's `fxStyle`.
- **Off a form land the body makes its own key.** The figure's rig says `surface: 'paint'` (the body tones itself; a
  form room's or town's page, which the renderer tones, says `'form'`) and `sun: false`: the page has no sun a body can
  take, so the kit's `key()` takes the page's shadow-casting light, gives it the rig's colour and level, and puts the
  other directional lights out; with none, it adds a light along the rig's key. A form land's page is as it was.
- **Two registers of the body**, the light the same: `western` lit as an engine lights it, `anime` cel.

Not built:

1. **Material by response on a hero.** Skin, cloth and metal each their own material on the page and on the skinned
   GLB; the realistic body's plating groups (`Alloy`, `Joint`) still have no material row.
2. **A palette's hues on the rig** (`skinDirection`'s light), and the per-group reads (the emblem's step, a group's
   shade a hole) on the solved light: they are still `heroFormLight`'s, on the gen-6 levels.
3. **A second body that wants the page's light.** The key the kit makes off a form land is the page's one shadow
   light: a vehicle's form body on the same painted page sets that light too, and the last to set it wins.
4. **A lamp in the palette.** A night cube whose brightest colour is a neon sets its light's level by it.
