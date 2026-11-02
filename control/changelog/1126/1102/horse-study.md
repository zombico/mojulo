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
  gaits; the folds (the armpit, the stifle, the throat) stretch most, and the jump's landing creases the quarters: the
  correctives are the next step.
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
- **The machine gate** (`mount/gates.js`): footfalls and duty, suspensions, slip, ground, the flight at g, the joints'
  ranges, reach, pops, rigid bones, brushing, the seams of a one-shot, the rail's clearance, a layer's loop. Every
  gait at both band ends, both leads, both registers; every one-shot; every realistic jump; every idle layer pass it.
  The stylized register's jump is a recorded gap (a centimetre or two short at the rail and the ground).
- **The eyes gate's contact sheets**: `node scripts/mount-study.mjs <dir> [--register stylized] [--view front]
  [--shots] [--jump] [--idle] [--body [--cells 96] [--coat bay] [--views side,front] [--big] [--crop head]] [--before] [--png]`, to
  lay beside Muybridge's plates; `--body` draws the shaded body from every view, in every coat, skinned in poses, with its mane and tail.
