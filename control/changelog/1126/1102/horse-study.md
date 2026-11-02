### A horse study: the first mount, its gaits solved from mechanics (spike)

A realistic and stylized horse, the first mount (`graph/mount/`), for games, scenes and films, beside the fauna horse
rather than over it (the fauna horse's rows stay byte-identical). Solo; the saddle and the rider follow, their sockets
(`saddle`, `bit`) carried by every frame from the start.

Built so far, on a stick figure (the body comes after the eyes gate on the motion):

- **The reference table** (`mount/reference.js`): the footfalls, duty, stride and frequency against speed for the walk,
  trot, canter, gallop and rein back, the joints' ranges, the passive mechanics, each with its source (Muybridge,
  Hildebrand, Heglund, Hoyt & Taylor, Clayton, Back, Merkens, Witte, Back & Clayton).
- **The card and its registers** (`mount/cards.js`, `mount/build.js`): the horse's build at 16 hands; `realistic` as
  measured, `stylized` a bigger head and ears, shorter neck and legs, its motion exaggerated. Both run the same
  mechanics: every stride, speed and frequency is scaled to the build's hip height by dynamic similarity.
- **The legs from their passive mechanics** (`mount/limb.js`): the scapula rotating on the thoracic sling, the knee
  locked in the stance, the hock coupled to the stifle by the reciprocal apparatus, the fetlock sinking under its load,
  the hoof rolling over its toe in breakover; the standing pose solved, not authored.
- **The body from the hooves' forces** (`mount/load.js`): heave and pitch integrated from each hoof's vertical force
  (the walk's double hump), so a suspension is a fall at g; the girdles vault over stiff legs; the head and neck a damped
  pendulum on the withers; each hoof's landing placed where its leg reaches evenly fore and aft.
- **The gaits** (`mount/gait.js`): walk, trot, canter on either lead, gallop and rein back, at any speed in each gait's
  band; the swing leaves and lands C1 with the stance (no pop at lift-off or touchdown).
- **The machine gate** (`mount/gates.js`): footfalls and duty against the table, the suspensions counted, no planted
  hoof slipping, no hoof in the ground, the flight at g, the joints' ranges, no standing leg out of reach, no pop, rigid
  bones. Every gait passes at both ends of its band, on both leads, in both registers (`mount.deep.test.js`).
- **The eyes gate's contact sheet**: `node scripts/mount-study.mjs <dir> [--register stylized] [--before] [--png]`, each
  gait as poses at even phases over its footfall diagram, to lay beside Muybridge's plates; `--before` draws the fauna
  horse the same way.
