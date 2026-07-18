---
{ "id": "z-series", "name": "Z-series mobile suit (mono-eye rounded real-robot design language)", "summary": "a sibling mobile-suit language to g-series: the same functional workbench + assembler core, but with a practical real-robot shell - rounded helmet heads built around ONE mono-eye in circular helmet enclosures, rounded arms and limb housings, field-service livery roles, and visible maintenance hardware. Head-first doctrine: prove the mono-eye sphere/cut vocabulary before minting the rest of the frame.", "when": "build a z-series unit / a real-robot mobile suit sibling to g-series / a mono-eye rounded-head practical mobile suit / iterate the z-series head or rounded limb language - when the functional frame should stay close to g-series but the outer shell should read utilitarian, rounded, and fielded rather than heroic box-chamfer armor", "tier": "recipe", "marks": ["lathe", "extrude", "sweep"], "phase": "p1" }
---

The z-series is a **sibling design language** to [[g-series]], not a new
functional substrate. Keep the same inner contract - workbench segment studies,
assembler stations, mirrored limbs, fixed humanoid frame, swappable loadouts -
but replace the g-series shell with a **mono-eye rounded real-robot shell**.

The first proof starts at the head, because the head carries the risk: the
language needs rounded craniums with one unmistakable mono-eye nested inside
circular helmet enclosures. Segment trail:

- `sk_zseries_head_v0_rounded_visor_cut` - lathed rounded helmet with implied
  front visor cut, dark inset shell, collar drum, cheek sensor pods, and service
  mouth rail.
- `sk_zseries_head_v1_mono_slit_sphere_cut` - transitional wider mono-slit cut
  study with stronger brow rim, cheek pods, lower service bands, and a rounder
  real-robot cranium.
- `sk_zseries_head_v2_porthole_mono_eye` - clean porthole branch: one glowing
  eye bead inside a circular cup/boss.
- `sk_zseries_head_v3_orbital_track_mono_eye` - track branch: single eye on a
  rounded horizontal/circular sensor bay, useful for "eye can slide" variants.
- `sk_zseries_head_v4_hooded_mono_eye_dome` - hooded branch: heavier dome lip
  and smaller circular socket for a more armored field-machine read.
- `sk_zseries_head_v5_recessed_mono_eye_inside` - recessed branch: enlarged
  rounded helmet shell with a dark horizontal bay and the mono-eye set back
  inside the cavity. This is the closest branch to the `____ / [_O_]` target.
- `sk_zsocket_study_a_open_shell_eye_behind` - primitive decomposition A:
  rounded-rect open shell + eye placed behind the opening plane.
- `sk_zsocket_study_a2_recessed_black_red_eye` - revised A branch: black bay
  pushed behind the upper/lower armor bars, blue removed, single red mono-eye.
- `sk_zsocket_study_a3_deep_flush_black_red_eye` - deeper A branch: smaller red
  eye, darker flush bay, stronger armor-bar occlusion.
- `sk_zsocket_study_a4_unified_forward_frame_red_eye` - operator-selected A4
  base: rounded helmet sphere, unified forward visor frame, recessed black bay,
  and a single red mono-eye. Use this as the base instead of cone-head forks.
- `sk_zsocket_study_a4_forward_unified_visor_frame` - forward-frame A branch:
  side visors stop angling back, top/bottom bars move toward camera, and the
  side/top/bottom armor superposes into one flatter visor frame over the deep
  black bay.
- `sk_zsocket_study_a5_simplified_sphere_flush_recess` - simplified A branch:
  rounder non-conical helmet, fewer monomers, no decorative sweeps, and the
  black bay/red mono-eye recessed back to the sphere's face layer. Superseded
  as the main base by `sk_zsocket_study_a4_unified_forward_frame_red_eye`;
  preserve the A4 helmet silhouette instead.
- `sk_zsocket_study_a5_from_a4_base_flush_recess` - current derived pass from
  the operator-selected A4 base: same broad rounded helmet and unified frame,
  but the black bay and red mono-eye are pulled inward so they stop projecting
  past the main sphere's front layer.
- `sk_zsocket_study_a6_magenta_filled_bay` - current eye/bay correction:
  keeps the A5-from-A4 silhouette, replaces the small red bead with a wider
  fully colored magenta capsule, and changes the black recess to a solid filled
  panel so the whole visor opening reads dark.
- `sk_zsocket_study_a7_round_magenta_lens_no_moustache` - current clean read:
  keeps the A6 filled black bay, replaces the magenta slab with a rounded
  capped lens, and removes the lower black sweep that read as a moustache.
- `sk_zsocket_study_a8_round_mono_eye_lens` - current mono-eye correction:
  keeps the filled black bay and no-moustache silhouette, replaces the pill/slot
  eye with a true round magenta lathe lens, and uses no sweeps.
- `sk_zsocket_study_a9_oversphere_eats_visor` - current recess illusion:
  enlarges the helmet sphere around the A8 visor so the shell visually eats the
  frame edges, keeps the bay solid black and deeper, and keeps the mono-eye a
  true round magenta lens.
- `sk_zsocket_study_a10_a8_visor_big_sphere_only` - corrected recess illusion:
  returns to the exact A8 visor/bay/mono-eye structure and scales only the
  helmet sphere upward, so the shell can eat the visor without redesigning the
  face.
- `sk_zsocket_study_a11_flat_front_chord_visible_eye` - flat-face cut illusion:
  keeps the A10/A8 visor and round mono-eye structure, then adds one shallow
  armor-color flat chord behind the black bay so the sphere reads shaved flat at
  the visor and the eye stays fully visible from the front.
- `sk_zsocket_study_a12_front_axis_flat_cap` - true flat-front cap test:
  rotates the helmet lathe onto the front/back `y` axis so the front endpoint
  can use the lathe's real flat cap behavior. This is the honest workbench
  primitive for flattening the front; it preserves A8 visor/eye coordinates but
  needs proportion tuning because a y-axis lathe changes the shell silhouette.
- `sk_zslice_study_flatcap_orange_slices` - flatcap slice vocabulary:
  demonstrates lentil/orange-slice armor volumes made by front/back-axis lathes
  with nonzero cap radii. Use these for flattened helmet faces, cheek caps,
  shoulder pods, and rounded armor shells. They are spherical slices, not true
  angular citrus wedges.
- `sk_zslice_study_potato_wedge_three_caps` - three-cap wedge vocabulary:
  demonstrates potato/orange-wedge armor using D-section polygon extrudes. The
  center form stacks scaled D slices to approximate a sphere cut by front, back,
  and chord/bottom planes; the side forms show cleaner single-extrude wedge
  profiles.
- `sk_zsocket_study_a13_arc_chord_brow_cap` - arced brow-cap test:
  keeps the A12 flat-front helmet and A8 visor/mono-eye stack, then adds an
  armor-color D-section brow canopy extruded across the head width. Its side
  profile follows a circular-ish arc on the outside and a flat chord where it
  meets the visor/flat-face layer.
- `sk_zsocket_study_a14_brow_traces_shell_arc` - shell-matched brow cap:
  keeps A13's D-section brow idea but changes the top polyline so it follows
  the helmet shell's front-axis arc more closely. The underside stays a flat
  chord matched to the visor plane.
- `sk_zsocket_study_a15_tilted_brow_arc_visible` - tilted brow visibility test:
  keeps A14's shell/visor/eye stack, then rotates the D-section brow profile
  forward/down so the curved top surface is visible from the current camera
  angle instead of reading edge-on.
- `sk_zsocket_study_a16_tapered_egg_brow_cap` - tapered egg-brow test:
  keeps the A15 shell/visor/eye stack, but replaces the single brow extrude
  with seven crosswise D-section slices. The cap is widest/highest at center and
  shrinks at the sides so it tapers into the helmet while its top half reads as
  an egg-like shell around the flat face.
- `sk_zsocket_study_a17_raised_flush_egg_brow` - raised egg-brow test:
  keeps A16's seven tapered brow slices and lifts them upward so the cap sits
  flush against the helmet's upper shell rather than reading as a separate brow
  shelf above the visor.
- `sk_zsocket_study_a18_depth_sliced_potato_brow` - depth-sliced potato-brow
  test: flips the A16/A17 taper direction from left/right to front/back. The
  brow is built from short D-section wedges that are smaller at the visor/front
  and larger toward the back/top of the helmet, aiming for a rounded sphere
  read from above.
- `sk_zsocket_study_a19_dense_depth_sphere_brow` - dense depth-sliced brow:
  extends A18 from six to ten front/back wedge slices. The first slice just
  clears the visor thickness below; each later slice grows wider/taller toward
  the back of the head so the brow reads more like a sphere from top view.
- `sk_zsocket_study_a20_wide_forward_depth_brow` - widened/forward depth brow:
  keeps A19's ten front/back wedges, widens their left/right profiles, and
  pushes the whole brow stack forward so the first slice begins closer to the
  visor face while the larger wedges still build toward the back of the head.
- `sk_zsocket_study_a21_visor_width_front_brow` - visor-width front brow:
  keeps A20's forward depth stack but widens the first/front wedge to match the
  top visor bar width, then grows gradually toward the rear shell.
- `sk_zsocket_study_a22_three_forward_brow_wedges` - extended forward brow:
  keeps A21's visor-width front rule and adds three more brow wedges toward the
  face/front, so the cap projects forward as a broad helmet brow before growing
  into the larger rear shell.
- `sk_zsocket_study_a23_tapered_forward_snout` - tapered snout test:
  keeps A22's brow/visor/mono-eye stack, then adds a centered lower snout below
  the mono-eye. The snout projects forward about twice the top visor depth,
  tapers narrower toward the front, and ends in a rectangular face.
- `sk_zsocket_study_a24_short_snout_box_lathe_tip` - short snout with lathed
  box tip: shortens the A23 snout by about 20%, replaces the final rectangular
  taper segment with a small front/back-axis lathe, and uses 4-fold harmonics
  so the tip reads as a squared respirator cap rather than a round button.
- `sk_zsocket_study_a25_wide_curved_snout_rect_end` - wider curved snout with
  rectangular end: removes A24's gasket-like lathe tip, widens the snout root,
  uses seven eased taper slices for a softer curve, and finishes with a plain
  rectangular extrude at the front.
- `sk_zsocket_study_a26_lower_double_height_snout` - lower double-height snout:
  keeps A25's width taper and rectangular front end, lowers the snout centers,
  and nearly doubles the vertical heights so the respirator volume hangs below
  the face instead of reading as a shallow nose strip.
- `sk_zsocket_study_a27_side_hoses_rear_skull_pack` - side hoses to rear skull
  pack: keeps A26's lower respirator snout, adds a rectangular block jutting
  from the lower rear skull, and runs mirrored rubber sweep tubes from the side
  tips of the snout around the helmet into that rear pack.
- `sk_zsocket_study_a28_thick_segmented_inward_hoses_snout_cylinders` - thick
  segmented inward hoses: keeps A27's rear pack, thickens the rubber tubes,
  pulls their side route closer to the helmet, adds short rib/collar lathes
  along each hose, and adds cylinder ports where the tubes meet the snout.
- `sk_zsocket_study_b_circular_cup_eye_back` - primitive decomposition B:
  circular cup made from front/back-axis lathes, eye at the back wall.
- `sk_zsocket_study_c_overhang_recessed_cup` - primitive decomposition C:
  circular recessed cup plus foreground brow/lower lip occluders. Current best
  recipe for "eye inside" without boolean cuts.
- `sk_zseries_head_lineup_v2_v4` - comparison lineup of the three mono-eye
  enclosure families.

## 1. Functional Core - Inherited From G-Series

Hold these from the g-series library:

- Segment-first workflow: head / torso / arms / legs as separate workbench
  sketches before full assembly.
- One assembler unit with station names preserved across versions.
- Left/right symmetry by placement, not unique geometry.
- Loadout slots: backpack, shoulders, hands, skirts, feet.
- Version titles as changelog: one named decision per iteration.

The z-series is therefore **functionally similar** to g-series: it can reuse the
same skeleton, station plan, loadout slots, and assembly cadence. The variation
lives in shell language.

## 2. Shell Distinction - Rounded Real Robot

Where g-series says box-chamfer heroic armor, z-series says rounded field
machine:

- **Mono-eye head first.** Every unit has exactly one eye: a glowing lens,
  track, or camera bead enclosed by circular helmet geometry. A wide slit may
  frame it, but must not read as two eyes.
- **Circular helmet enclosures.** The head is a sphere/egg/dome mass with a
  nested eye cup, ring socket, recessed circular bay, or sliding circular track.
- **Rounded arms.** Shoulders, upper arms, forearms, fists, and optional shields
  are barrels, capsules, domes, and soft-corner housings, not box crosses.
- **Inset cuts over color doodads.** Detail comes from dark recesses, service
  grooves, shallow rails, and same-role panel bands.
- **Practical asymmetry allowed.** Antennae, single shoulder sensor pods, shield
  mounts, exposed cabling, or backpack tools may vary by unit.
- **Real-robot posture.** Less parade silhouette, more field equipment: compact
  head, broad sensor brow, maintenance seams, chunked but rounded limbs.

## 3. Palette - Roles Stay Fixed, Colors May Shift

The palette should feel deployed and maintainable rather than ceremonial.
Suggested starting roles:

| Role | Hexes | Where it is allowed |
|---|---|---|
| Field armor | `#d7d2c4`, `#c8c1b5`, `#b9b2a5` | rounded shell masses: head, limbs, skirts, armor caps |
| Inner frame | `#111315`, `#151719`, `#1b1e20` | joints, sockets, vents, cut interiors |
| Mono-eye glow | `#ff2bd6`, `#d414b8`, `#ff66e8` | the single main eye plus tiny status lenses only |
| Service red | `#b13b28`, `#8f2c22` | mouth rail, warning tabs, soles, emergency handles |
| Utility marking | `#d59a19`, `#8a6721` | unit mark, caution blocks, one or two waist/head emblems |

Rule: the rounded shell must stay calm. Small signal colors are punctuation;
the form language should be legible in cream/graphite alone.

## 4. Head Doctrine - Sphere Plus Cuts

Start every z-series run by proving the head. The head is the language's
keystone: if it does not read as **one eye in a circular enclosure**, it is not
z-series yet.

Current workbench vocabulary can make **true rounded masses** with lathe
profiles:

```js
{
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo:   { x: 0, y: 0, z: 2.45 },
  profile: [
    { t: 0,    radius: 0.18 },
    { t: 0.08, radius: 0.82 },
    { t: 0.24, radius: 1.18 },
    { t: 0.52, radius: 1.32 },
    { t: 0.78, radius: 1.12 },
    { t: 0.94, radius: 0.72 },
    { t: 1,    radius: 0.18 }
  ],
  tint: "#d8d2c4"
}
```

True subtractive sphere cuts are not yet a general workbench primitive. Until
that lands, use three honest approximations:

- **Profile cuts:** flatten or band the sphere by changing the lathe radius
  profile at the top, bottom, brow, or collar.
- **Inset cut plates:** place dark rounded-rect shell extrudes into the sphere
  where an eye socket, visor recess, cheek recess, or service slot would be cut.
- **Superposed rim geometry:** add same-role raised rails around the cut so the
  eye reads the inset as intentional hard-surface machining.

Do not let the helmet become a cone while chasing depth. The default head
silhouette should be a simple sphere/egg with a broad middle radius and rounded
top/bottom closures; the visor work should happen at the face layer, not by
stacking a tall pointed cap over the socket.

The v0/v1 heads use all three. They are valid segment studies, but the library
should not pretend it has true boolean carving yet. The next passes should push
the mono-eye harder: a circular cup, domed lens, orbital ring, or recessed
helmet track.

## 4b. Mono-Eye Enclosure Families

Three head branches are currently proven as workbench segments:

- **Recessed bar bay** (`study a2/a3/a4/a5`) - the current target branch. This follows
  the operator sketch: a black horizontal recess sitting under cream armor bars,
  with a single red mono-eye set back inside. Best for the iconic z-series read.
  Use `sk_zsocket_study_a4_unified_forward_frame_red_eye` as the base branch,
  not the cone-head direction. The derived
  `sk_zsocket_study_a5_from_a4_base_flush_recess` keeps that silhouette while
  recessing the black bay/red eye to the shell face layer. The current
  correction is `sk_zsocket_study_a12_front_axis_flat_cap`: it preserves the A8
  visor/bay/eye coordinates, rotates the helmet lathe onto the front/back axis,
  and uses a nonzero front radius so the lathe produces a real flat cap behind
  the visor. This is preferable to the A11 overlaid chord once the proportions
  are tuned.
- **Porthole cup** (`v2`) - the strongest "one eye in a circular enclosure"
  read. Use this as the default z-series head until a better branch wins.
- **Orbital track** (`v3`) - keeps the mono-eye but implies the camera can slide
  laterally across a rounded sensor bay. Good for scout/recon units.
- **Hooded dome** (`v4`) - heavier brow and smaller socket. Good for armored,
  ground-combat, or harsh-environment units.
- **Recessed bay** (`v5`) - the eye is visibly inside the helmet opening rather
  than sitting on the surface. Use this when the target shape is
  `____ / [_O_]`: a rounded outer shell, a dark inner bay, and a single eye set
  back behind the armor lip.

All three share the invariant: one visible main eye, not a pair, not a general
visor. The circular enclosure can be a protruding cup, recessed bay, or helmet
hood, but it should always frame the mono-eye as the head's center of agency.

## 4c. How To Make The Eye Read As Inside

The workbench does not yet subtract a real hole from the helmet sphere, so
"inside" has to be composed from depth cues. The current best construction is
`sk_zsocket_study_c_overhang_recessed_cup`:

1. **Outer helmet shell** - a vertical lathe sphere/egg, larger than the
   previous z-series heads so it can overhang the sensor bay.
2. **Circular front cup** - one front/back-axis lathe in armor color, placed on
   the helmet face. Its axis runs along camera depth (`y`), not vertical `z`.
3. **Dark inner tunnel** - a smaller front/back-axis lathe behind the cup,
   graphite/black, set deeper on `y`.
4. **Mono-eye at back wall** - a tiny glowing sphere/short lathe even deeper on
   `y`, smaller than the tunnel so it cannot read as pasted on the surface.
5. **Foreground occluders** - armor-color brow and lower lip, closer to camera
   than the eye. This is the critical cue: some helmet geometry must overlap the
   socket before the eye appears.

Minimal coordinate pattern:

```js
// Cup / tunnel / eye all share x,z; y increases in depth.
cup:    axisFrom { x:0, y:-0.86, z:1.38 }, axisTo { x:0, y:-1.22, z:1.38 }
tunnel: axisFrom { x:0, y:-1.22, z:1.38 }, axisTo { x:0, y:-1.68, z:1.38 }
eye:    axisFrom { x:0, y:-1.74, z:1.38 }, axisTo { x:0, y:-1.98, z:1.38 }
```

If the eye reads outside, push it farther back on `y`, shrink its radius, and
move the brow/lower lip toward camera. If it disappears, widen the cup/tunnel
or move the foreground lips away from the opening.

For the flatter `____ / [_O_]` branch, use `sk_zsocket_study_a4_unified_forward_frame_red_eye`
as the base recipe and `sk_zsocket_study_a5_from_a4_base_flush_recess` as the
depth correction. Use `sk_zsocket_study_a12_front_axis_flat_cap` when the eye
and bay need a real flattened front rather than an overlaid chord. The key is
lathe orientation: a vertical `z`-axis helmet can only flat-cap top/bottom, but
a front/back `y`-axis helmet can flat-cap the face. Keep the A8 visor, bay, side
bars, and mono-eye coordinates fixed, then tune the y-axis shell profile around
them. The black rounded-rect bay remains a solid filled panel, and the magenta
mono-eye remains a true round lathe lens inside that bay rather than a small
bead, flat slab, pill slot, or protruding appliance. Avoid lower black sweeps
under the visor; they read as facial hair. Do not add a second center dot or
blue sensor highlight; the magenta mono-eye is the only active lens.

Flat caps also unlock **orange-slice armor**: a front/back-axis lathe with
nonzero radius at both ends forms a curved shell with flat faces. Use
`sk_zslice_study_flatcap_orange_slices` as the vocabulary card for those
volumes. This makes lentils, domed plates, flattened caps, and short rounded
pods. It does not make true angular citrus wedges with two radial side cuts;
those need polygon extrudes or a future clipping/boolean primitive.

For a **potato wedge** or orange wedge, use `sk_zslice_study_potato_wedge_three_caps`.
The practical workbench approximation is a D-section polygon extrude:

- front cap = extrusion start;
- back cap = extrusion end;
- third cap = the flat chord in the D profile;
- curved skin = the arced side of the D profile.

To make it more sphere-like, stack several short D extrudes along the depth axis
and scale their profiles larger near the middle, smaller near the ends. That
approximates "sphere capped three times" without a boolean clipper. A true
sphere intersected with three half-spaces still requires a future clipping
primitive.

The same D-section rule works for a z-series **brow canopy**. Use
`sk_zsocket_study_a17_raised_flush_egg_brow`: stack several short side-profile
polygon extrudes across the head width, scaling the D-section smaller at the
sides and larger at the center. Keep the top edge visually matched to the
helmet shell's front-axis arc, keep a flat underside/chord matched to the visor
plane, and tilt the D-section forward/down so the curved brow surface is
visible. This creates the "full egg on the top half" read while tapering the
cap into the helmet sides. If the cap reads like a separate shelf, lift the brow
slices until the center top nearly kisses the upper helmet shell.

If the top view should look more spherical than side-tapered, flip the stacking
direction as in `sk_zsocket_study_a19_dense_depth_sphere_brow`: stack many short
D-section wedges front-to-back instead of left-to-right. The first wedge should
just clear the top visor thickness below, then each wedge should increase
width/height toward the back/top of the helmet. This uses the potato-wedge
recipe to build a brow that rounds out from above while preserving the A8
mono-eye/visor coordinates.

If the brow reads too narrow or too far back, use
`sk_zsocket_study_a20_wide_forward_depth_brow`: keep the same depth-ramp rule,
but widen the D-section profiles left/right and shift the y-bands forward toward
the visor. Preserve the ordering: smallest slices at the visor/front, largest
slices toward the back of the head.

If the front still reads pinched, use `sk_zsocket_study_a21_visor_width_front_brow`:
make the first/front wedge at least as wide as the top visor bar, then continue
the depth ramp from that width toward the back. This keeps the brow tied to the
visor instead of starting as a narrow nose.

If the brow needs more forward projection, use
`sk_zsocket_study_a22_three_forward_brow_wedges`: prepend three visor-width
D-section wedges in front of the A21 stack. The added wedges should keep the
same top/bottom clearance as the visor-width wedge, then the older ramp can grow
toward the rear shell.

For a lower snout / respirator nose, use
`sk_zsocket_study_a23_tapered_forward_snout`: stack short rounded-rect extrudes
front-to-back below the mono-eye, starting near the lower visor plane and
tapering width/height forward. Keep it below the black bay so it does not cover
the mono-eye. The forward end should be a small rectangular cap; in A23 it runs
from `y=-1.48` to `y=-2.86`, roughly twice the top visor forward reach, and
narrows from `w=1.22` to `w=0.66`.

If the snout reads too long, use `sk_zsocket_study_a24_short_snout_box_lathe_tip`:
keep the same lower placement but compress the tapered extrude stack to
`y=-1.48 -> -2.46`, then add a short y-axis lathe at the front
(`y=-2.46 -> -2.584`). A 4-fold harmonic (`n=4`) on that tip lathe turns the
round cap into a boxier respirator form while staying lathe-native.

If that lathed tip reads like a gasket, use
`sk_zsocket_study_a25_wide_curved_snout_rect_end`: remove the tip lathe, widen
the snout root, and use seven short extrude slices whose widths ease from
`1.52 -> 0.78` and heights from `0.38 -> 0.27`. Lower the slice centers very
slightly (`z=0.77 -> 0.72`) so the side silhouette gets a gentle curve. Leave
the final profile as a plain rectangle with no corner radius.

If the snout needs to become a lower respirator block, use
`sk_zsocket_study_a26_lower_double_height_snout`: preserve the A25 y-span and
width curve (`1.52 -> 0.78`), lower the slice centers to about `z=0.58`, and
nearly double the heights (`0.76 -> 0.54`). This keeps the top near the lower
face while the added mass extends downward. The front remains a plain
rectangular extrude, not a lathe/gasket.

For external respirator plumbing, use
`sk_zsocket_study_a27_side_hoses_rear_skull_pack`: add one rear lower skull pack
as a rectangular extrude (`y=1.02 -> 1.62`, `z=0.58`, `w=0.82`, `h=0.62`), then
run two mirrored rubber sweep tubes from the snout tip sides
(`x=+/-0.45`, `y=-2.52`, `z=0.58`) outward around the helmet and back into the
pack sides (`x=+/-0.43`, `y=1.46`, `z=0.58`). Keep the hose radius small
(`0.055`) so they read as plumbing rather than new cheek armor.

If the hoses need to read heavier and more mechanical, use
`sk_zsocket_study_a28_thick_segmented_inward_hoses_snout_cylinders`: increase
the sweep radius to `0.088`, pull the side path inward so its outer reach is
about `x=+/-1.32` instead of `+/-1.78`, and add seven short collar lathes per
side along the hose tangent. At the snout, add one x-axis cylinder port per
side (`x=-0.66 -> -0.40` and `x=0.40 -> 0.66`, `y=-2.50`, `z=0.58`) so the
tube meets a real cylindrical socket rather than disappearing into the snout
wall.

## 5. Variant Knobs

Hold fixed:

- Rounded cranium / helmet mass.
- One mono-eye in a circular enclosure.
- Dark inset eye socket / track.
- Collar socket below the head.
- Rounded arms and limb housings.
- Functional station plan inherited from g-series.

Swap freely:

- eye enclosure type: cup, ring, track, porthole, or domed socket;
- antenna count and side;
- mouth/service rail pattern;
- cheek pods vs smooth cheeks;
- shoulder module shape;
- backpack loadout;
- armor livery inside the same role placement.

## Do / Don't

- DO start with the head before the whole body.
- DO use lathes for domes, capsules, cheeks, collars, arm barrels, and rounded
  shoulder pods.
- DO use dark inset extrudes as cut language while true spherical cuts are
  missing.
- DON'T use g-series cross overlays on limbs; z-series limb detail should be
  grooves, bands, sockets, and service rails.
- DON'T color the rounded limbs just to create interest; shape and inset detail
  should carry the read.
- DON'T call an inset plate a real cut when exporting or documenting the recipe.

Pairs with [[g-series]] for the inherited functional frame, [[mobile-suit]] for
the parent segment-first method, and [[mobile-worker]] when the concept becomes
job-first instead of mobile-suit-first.
