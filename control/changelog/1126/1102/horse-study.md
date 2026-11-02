### A horse study: the first mount, its motion solved from mechanics (spike)

A realistic and stylized horse, the first mount (`graph/mount/`), for games, scenes and films, beside the fauna horse
rather than over it (the fauna horse's rows stay byte-identical). Solo; the saddle and the rider follow, their sockets
(`saddle`, `bit`) carried by every frame from the start. 

- **The reference table** (`mount/reference.js`): footfalls, duty, stride and frequency against speed for the walk,
  trot, canter, gallop and rein back, the joints' ranges, the passive mechanics, the track's width, each with its
  source (Muybridge, Hildebrand, Heglund, Hoyt & Taylor, Clayton, Back, Merkens, Witte, Back & Clayton).
- **The card and its registers** (`mount/cards.js`, `mount/build.js`): the horse at 16 hands; `realistic` as measured,
  `stylized` a bigger head and ears, shorter neck and legs, its motion exaggerated. Both run the same mechanics:
  strides, speeds and frequencies scale to the build's hip by dynamic similarity.
- **The legs from their passive mechanics** (`mount/limb.js`, `mount/legs.js`): the scapula on the thoracic sling, the
  knee locked in the stance, the hock coupled to the stifle (the reciprocal apparatus), the fetlock sinking under its
  load, breakover over the toe; each leg in the plane through its girdle and its hoof's line; the standing pose solved.
- **The body from the hooves' forces** (`mount/load.js`): heave and pitch integrated from each hoof's vertical force,
  so a suspension is a fall at g; the girdles vault over stiff legs; the sway toward the weighted side and each
  girdle's roll toward its unloaded one (the walk rolls, the trot twists); the neck a damped pendulum, nodding and
  swinging.
- **The gaits** (`mount/gait.js`): walk, trot, canter on either lead, gallop and rein back, at any speed in each
  gait's band; the track narrowing toward the gallop's near single file; the swing C1 with the stance at both ends.
- **The one-shots** (`mount/motion.js` on `mount/schedule.js`): a change between any two neighbouring gaits, a halt
  from the walk or trot, a move off from the stand, by phase warping (the footfalls fall out of it; the stance length
  eases between the gaits and a stance ends once it has covered it), each clip opening and closing on the cycles' poses
  and carrying its root's travel.
- **The jump** (`mount/jump.js`): from the canter over an upright or an oxer and back to the canter: the fence sets
  the flight, a shortened take-off stride, a two-push rise and a two-part landing, a ballistic flight with the
  forelimbs folded tight and the hinds tucked forward over the rail.
- **At rest** (`mount/idle.js`): resting a hind on its toe, grazing (the neck lowered at its base to the grass), and
  layers each an exact loop (breathing, the tail's swish, the ears, the head's drift, the weight shifting) whose
  periods step by the golden ratio so the layered idle does not repeat; a herd offset by the golden fraction.
- **The body** (`mount/body.js`, `mount/skin.js`, `mount/coats.js`): a form field of bone and muscle masses placed from
  the solved stand (the barrel, girth, breast, withers, croup, quarters, buttocks; the scapula's and triceps' masses,
  the thigh and stifle; the neck between its crest and its underline, the throatlatch; the cranium, forehead, jowls,
  face, muzzle with its nostrils cut, eyes, ears; the forearm, knee, gaskin, hock and its point, the lean cannons, the
  fetlocks, the pasterns, the hooves cut flat), the trunk and neck blended soft, the head and each leg tight; one closed
  skin by surface nets. Each vertex weighted to the bones by the blend that formed it (never across to the other
  side's limbs, a limb bone only within its reach, smoothed over the folds), skinned by linear blend into any frame of
  the cycles, the one-shots, the jump and the rest. Coats as cards (bay, chestnut, black, grey, palomino, buckskin)
  with markings as rules (star, blaze, snip, sock, stocking). The skin keeps its volume within a few percent in the
  gaits; the folds (the armpit, the stifle, the throat) stretch most, and the jump's landing creases the quarters.
- **The head and neck** (`mount/body.js`): the head lofted from a profile of stations from poll to lip (the forehead's
  flat, the dished or straight face, the nasal bone, the muzzle's lift and the chin), the jowls deep and round under the
  cheek, the throatlatch clean between them and the neck; the neck set on the withers by its crest's arch and its
  underline's taper.
- **The mane, the forelock and the tail** (`mount/hair.js`): guide strands rooted on the crest, the poll and the dock,
  each a chain of fixed segments run by Verlet at 240 Hz with gravity, damping and a gentle pull toward its rest hang,
  each joint's bend limited (a lock is a stiff bundle), kept out of the skin (the blended field, in the rest frame of the
  bone nearest each point) and above the ground. A
  gait's loop runs warm periods and closes exactly (the residual drawn back through the period and every segment's
  length re-imposed); a one-shot settles at its first frame. Each guide becomes a two-sided ribbon of cards in the coat's
  mane colour: the mane falls in locks on the off side, the forelock down the face, the tail streams in the gallop.
- **The folds** (`mount/correctives.js`): the skin where joints bend far (the armpit, the stifle, the throat, the
  neck's base). The truth is the body's own masses carried by their bones into the pose and re-blended (implicit
  skinning: the linear-blend skin drawn onto that field and relaxed in its tangent plane); muscles that cross a joint
  (the hamstrings, the triceps, the neck's segments and its crest over the withers) are SPANS, rebuilt between their
  origin's bone and their insertion's with their volume kept, thinning as they stretch and bulging as they shorten.
  What ships is corrective shapes an engine plays as morph targets: sixteen drivers (per side the withers, shoulder,
  elbow, knee, hip, stifle, hock; the neck's base and the poll), keys at the angles the clips reach each way, made one
  joint at a time and then refit together over the clips' poses, stored in bind space, weighted piecewise by the joint's
  angle. On poses the fit never saw the corrected skin stands a quarter as far from the truth as linear blend at the
  folds, its volume no worse; with no correctives the skin is linear blend exactly. `--correctives` on the study sheet
  shows linear blend, corrected and the truth side by side, close up at each fold.
- **The hip's range** (`HIP` in `mount/reference.js`): the femur against the pelvis held to some 45° of flexion and
  55° of extension from the stand, as a horse's hip moves. A swing that would flex it further keeps the femur at the
  range and folds the stifle and the hock to keep the hoof as high as it was to be (the jump's tuck over the rail folds
  there now, where it had swung the femur level with the back); a jump's footfall is placed where the hip stays in
  range; the body flies a little higher over the rail for the hip it no longer tucks. The gaits never reach the range
  and are unchanged. Every clip's gate checks the hip.
- **The export** (`mount/export.js`, `node scripts/export-mount.mjs <dir>`): the mount as one skinned GLB an engine
  imports as it is, through the hero's writer. The rig's bones as joints, the body on its own weights, the corrective
  shapes as morph targets, the mane, forelock and tail as two-faced cards on short chains of joints along their
  strands (`mount/hair-bake.js`) whose keys are the hair's own simulation through each clip (a cycle's closed on
  itself; a transition's warmed through the gait it leaves, so the hair is already swinging as it starts), and every
  clip: the gaits' cycles in place with their ground speed, the
  transitions between them and the halt, the jump, the idle, its layers and grazing, each with its shapes' weights. A
  README says how Godot, Unity, Unreal and Blender take it. Re-skinned from its own buffers the file is the solver's
  skin to a fraction of a millimetre. `node scripts/mount-live.mjs <glb> <dir> [--local]` plays it in a live viewer
  (three.js): the clips by family, the shapes on or off, the skeleton, the ground passing at the gait's speed.
- **The tack** (`mount/tack.js`): an all-purpose saddle on its pad (the pommel behind the withers, the seat's dip, the
  cantle; the flaps cut forward), the girth in the girth groove, the stirrup leathers and irons (run up, or hung to a
  length), and a snaffle bridle (crownpiece, browband, cheekpieces, cavesson noseband, throatlash, the bit's rings at
  the corners of the mouth) with its reins over the neck, each fitted to this horse's own body (rays into its form
  field, a few millimetres proud). The bridle rides the head; the rest rides the skin under it, its weights and its
  corrective shapes, so it lifts where a fold lifts the skin. Its gate: no piece under the rendered skin in any pose
  the clips make. On the study sheet (`--tack`) and in the export (`--tack`).
- **The rider** (`mount/rider.js`, `node scripts/mount-rider.mjs <dir>`): the realistic hero in the saddle, its pose
  solved every frame from where the horse puts the seat, the irons and the bit. The classical seat: the sit bones on
  the seat's middle, the stirrup leathers the rider's own (the knee at 118° at the halt), the irons hung round the
  barrel, the knees out over the flaps. Its seat as the horse asks it: following the saddle at the walk and the canter,
  rising on the diagonal at the trot (out of the saddle while the left fore stands, from the horse's own footfalls),
  two-point at the gallop (the seat held steady while the legs take the heave), folded over the fence with the hands
  released on the crest; a transition blends the seat it leaves into the one it reaches. The arms by the riding rule:
  the upper arm set against the trunk, the forearm aimed at the bit, the fists closed and the wrists straight. The head
  held up in every seat, the neck and head extending against the trunk's lean within what the neck holds, so the rider
  sees where it is going. The tack's anchors (the seat, the stirrup bars, the bit's rings, the crest) are where it meets
  the horse.
- **Riding as a function** (`mount/ridden.js`): what riding asks, with no character in it. The seat for each moment of
  each clip; the ridden head carriage, with the neck raised at the withers and the face flexed at the poll toward the
  vertical (free over the fence and when grazing); and the riding targets: where the sit bones go, the pelvis's tilt,
  the trunk's lean, the irons' treads, the arms' setting. The reins are a fixed length from the bit to the fist, taut
  or looping. Any character the studio makes is solved to those targets by its own posing words (`rideCharacter`).
- **The ridden export** (`node scripts/export-mount.mjs <dir> --ride`, or `--rider '<character>'`): the horse in its
  ridden carriage and tacked, carrying the riding interface. Sockets keyed through every clip (the seat, the stirrup
  bars, the irons, the bit's rings) and each clip's seat in its extras, so an engine can seat its own characters by IK.
  With `--rider` (a hero spec minted once and cached, or `@recipe.json`) the character rides in the same GLB as its own
  skinned figure, its clips named and keyed as the horse's (`rider:trot` plays with `mount:trot`), the reins on chains
  from the bit to its fists. The correctives are fit over the ridden carriage too. The live viewer plays the horse and
  its rider together.
- **The machine gate** (`mount/gates.js`): footfalls and duty, suspensions, slip, ground, the flight at g, the joints'
  ranges and the hip's, reach, pops, rigid bones, brushing, the seams of a one-shot, the rail's clearance, a layer's loop. Every
  gait at both band ends, both leads, both registers; every one-shot; every realistic jump; every idle layer pass it.
  The stylized register's jump is a recorded gap (its hooves a centimetre or two under the ground, its spread jump's
  push past the hip's extension); it clears the rail now.
- **The eyes gate's contact sheets**: `node scripts/mount-study.mjs <dir> [--register stylized] [--view front]
  [--shots] [--jump] [--idle] [--body [--cells 96] [--coat bay] [--views side,front] [--big] [--crop head]] [--correctives] [--before] [--png]`, to
  lay beside Muybridge's plates; `--body` draws the shaded body from every view, in every coat, skinned in poses, with its mane and tail.
- **Getting on and off** (`mount/rider.js` `mountKeys`, `mountPose`): from the near side as riders do it. The rider
  faces the horse at its shoulder, puts the left foot in the let-down iron, the left hand at the withers and the right
  on the pommel, springs up to stand in that iron, swings the right leg over the croup as the body turns to face
  forward, and settles into the halt's riding pose exactly, the reins taken up. The dismount runs the other way: both
  feet out, leaning on the withers, the leg over the croup, sliding down the near side to land facing the horse. Each is
  a keyframed path of the character's targets, scaled to the character and to this horse and solved on its own rig.
  The ridden export carries them as `mount` and `dismount`, with the horse standing and its carriage taken up or let
  go; the live viewer lists them.
- **Horses in games** (a controllable world's `mounts`, or a `design_game` world's for every walking level: `mounts: 2`
  or `[{ coat?, at?, heading? }]`; card `gameworld-mounts`): horses the hero gets on and rides.
  - With interact in reach (the prompt says "ride"), the hero walks to the near side and gets on, and the horse becomes
    the pilot, followed by the camera.
  - W urges it up through walk, trot, canter and gallop. Its legs keep time with the ground, each gait's stride a cycle,
    and a hysteresis keeps a speed between two gaits from flickering.
  - Letting go halts it; S checks it and, halted, reins it back. A/D turn it, wider at speed and on the forehand at a
    halt.
  - Space jumps at a trot or faster, playing the jump's own take-off, flight and landing; a low wall is cleared in the
    air.
  - Interact at a walk or a halt ("get off") sets the rider down beside it, the pilot again.
  - The rider plays the horse's clip of the same name at the same phase. Its riding clips are solved on its own rig to
    this horse's saddle, irons and bit when the world is resolved (`mount/game.js`, once per hero and kept), so any hero
    rides.
  - The runtime is an opt-in builder (`worlds/controllable/mount.js`: the `ride` rule and the getting on and off), with
    the reach prompt in `scene/channels/mount-ride.js`. A page without a horse keeps every byte.
  - The bus hears `mounting`, `mounted` and `dismounted`.
- **The skinned rig on the World page**: a figure with `skin` binds one skinned mesh to its bones instead of a rigid mesh
  per bone. The horse is one welded skin and would tear at every joint otherwise. Its colours are lit at the pack; a
  figure without `skin` is drawn as before, byte for byte.
- **Engines**: riding is the World page's, as every game is since the engine handoff; the horse and its rider go to an
  engine as assets, the ridden GLB (`node scripts/export-mount.mjs <dir> --rider '<character>'`).
- **A slimmer neck**: the neck's masses blend among themselves more tightly than the trunk's, joined to the trunk by a
  wider blend so it still flows into the withers and the breast. The trunk's wide blend over the neck's overlapping
  masses had swelled it by a hand on every side. Mid-neck it now measures about 1.05 m round (0.42 m deep, 0.23 m
  wide), a riding horse's, where it was 1.36 m.
- **The mane and the tail as masses**: drawn by the hair principles (a few major flows, detail as shape, one colour, a
  tied tail a separate mass) as closed lofts rather than fibre cards. The mane is five flows along the crest, each a
  lofted lock lying down the off side and drawn to a point. Each shares its end lock with the next, so they overlap as
  shingles and no neck shows between them. The forelock is one flow between the ears. The tail is a single mass. It grows from a ring round the dock where the tail
  leaves the croup, about 17 cm across from behind, grooved by its flows, hanging close to the buttocks and drawing to a
  point at its end. Five simulated locks carry its swing, each keeping its place across the tail, and every vertex rides
  the lock nearest it, so it lifts and streams as one over a jump. It is one-sided, with smooth normals. The dock blends
  tightly, joined to the quarters by a narrower blend, so it hangs as a dock rather than swelling into the buttocks. The
  study sheet crops the quarters and the tail (`--crop tail`).
