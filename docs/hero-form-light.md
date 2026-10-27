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
- **Nothing lights a hero live.** The live light gives actors shadows and occlusion. The fills are MeshBasic, and the
  rim is the rig preview's fresnel patch, never written to an export.
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

- **Day looks hold.** On `comic-day` and `painted-dusk` the key is about 2.6× the shade side. Every pack emblem holds
  its step lit and in shade, and the figure stands well off the sky.
- **Night looks read flat.** On `comic-night` and `gritty-night` the city-night reference's light is mostly fill: the
  key side is 1.36× and 1.12× the shade side, against a wanted 1.6×. The figure's shade side is within 0.02 to 0.08 L
  of the night horizon, so the rim carries the outline. Gen-6 hides this, because the bake's ambient floor lifts the
  shade. A live rig shows it. The theorist's move at night is a deeper fill and a stronger moon key, or a rim as the
  key light.
- **Very dark groups are holes in any shade.** Black hair, and the Modern and Movie eras' near-black boots and gloves,
  fall under the crush floor. That is the rim's job, or a lifted albedo.
- **The realistic body's plating has no material row.** The Movie Hero on the realistic body wears the plating library
  by word (`powerSuit`, `sleekSuit`). Its groups (`Alloy`, `Joint`) are absent from `dress-materials.js`, so gen-7
  would light the alloy as cloth.

## The spike

`node control/scripts/spikes/form/hero-three-ways.mjs [--member hero] [--look comic-day] [--era silver] [--out f.html]`
mints a pack member through the door, wearing its look's cube with materials named. It shows the hero three ways:

- (a) the paint, gen-6 as the GLB draws it;
- (b) the form with one response, which is the `lit` export today;
- (c) the form by response, the static export's material buckets.

(b) and (c) are lit by the theorist's rig, with the key's azimuth and the rim on sliders, and the reads printed beside
them. The look is the operator's.

## Before a mint or the World page can draw it

1. **Material by response on the skinned GLB.** A primitive per material bucket, as the static export already splits
   them, so a rigged hero keeps its metal and its cloth apart.
2. **The rig as a page channel.** At `era: 'gen-7'`, the World page lights a hero's fills with a lit material and the
   rig in place of the bake. The era marks move `figures` from approximated toward built.
3. **The rim written out.** A rim the page and the exports carry, not only the rig preview's patch.
4. **The theorist's light kept.** `worldSkin` carries `skinDirection`'s light beside its shade, so a world's palette
   sets the rig's hues.
5. **Material rows for the plating groups** (`Alloy`, `Joint`, the plating suits' plates), so the realistic body's
   suits answer the light as metal.
6. **Night cubes at gen-7.** A fill-dominated reference needs its own gen-7 balance, the cube's to decide: the bake's
   ambient floor is a gen-6 device.

Each of these changes a render, so each is its own step, with its own pins and laws.
