### Merge fixes: the seams the 10/25 to 10/28 merges left open

An audit of the four days of merges onto `1026-consolidated` found these; each is fixed with a test that fails without
it.

- **A race reaches GLB and the engine packs.** A racer or supercar minted now is drawn in the form render, its parts
  packed `{ form: { o, s, n, q, nrm, col, idx, groups, mats } }` (`vehicle-rig.js` `packFormMesh`). The rig export read
  every part as a painted one and threw on its colours, so any engine pack of a race (`clips: '_all'`) crashed and a
  plain GLB left the cars out. `scene-gltf.js` `decodeRigPart` reads the form mesh one level down: the same quantized
  positions and linear colours. Its material slots and normals stay the page's; a GLB carries the albedo.
- **A genre level in a building routes to `design_game`.** The `game` routing card and three fixture rows sent "a
  stealth level through an office" to a `create_game` argument that does not exist. The building level is
  `design_game`'s (`quick.building`, or a world level's `building`; card `game-building`): the phrasing moves to the
  `game-design` card, and the rows expect `design_game` in its quick mode.
- **The realistic hero keeps the door's hair and expression.** The record stored `hair` and `expression` only for the
  landmark and anime heads, so on the realistic body (the relational head) both were dropped without a word: every
  realistic crew wore its rolled ancestry's cut and a neutral face, and the pack-v2 wavy fall never landed there. The
  record now reads the landmark hair as the face's `scalp` (`layered.js` `scalpOfHair`: the same name where both
  libraries have one, the nearest cut where not, the `wave` as the curl), unless the face names its own, and stores the
  expression the relational face rig already reads. An explicit `head: 'relational'` takes both. Absent, nothing.
- **The roof a metal sheet is judged by is the one the render draws.** The mint rolled a house's family at look 1, the
  render at the house's look, tradition and form, so a townhouse or a block could be refused a sheet its roof would wear,
  or granted one its flat deck then dropped. Both read `floorplan-styles.js` `homeLook`.
- **`update_sketch` holds a house to the mint's gate.** An edit ran none of the mint's house checks and never re-derived
  the game/show purpose. The mint's block is `sketch-mint.js` `houseGate`, called at both: on an update a stamp fills
  only what the stored row carried, so a row minted before a stamp keeps its bytes; a purpose the row's level derived is
  derived again (a level added makes the house a game's), and a purpose the edit names stands.
- **A wide stair keeps to its zone.** The flight takes its own width since the stair-width fix, but the zone kept for it
  was still sized by the default, so a wide flight spilled out of a program house's zone and through a townhouse's party
  wall. The zone, a form's hall and the mint's footprint check take the widest flight asked for (`house-forms.js`
  `stairWidthOf`, `floorplan-structure.js` `stairSpanOf`). A house that names no wider flight is planned as before.
- **The table RPG export never fetches a browser, by construction.** The portrait shoot runs inside
  `withoutChromiumFetch`, so a caller's consent to the download no longer reaches it.
- **No plan citations from the seats and live-light work.** Sixteen comments cited plan files; three sat inside the
  controllable rules every World page serializes, so the sixteen controllable fixtures in `emit-channels.char.test.js`
  are re-pinned (three comment lines, nothing else).
- **The lockfile is back in step with `package.json`.** `npm ci` refused it (it lacked `esbuild-wasm`, listed `sharp`
  among the regular dependencies, and recorded the old Node floor).

Machine gate: the new and touched tests, then `npm run test:changed --since 1026-consolidated`. Eyes gate not run: no
one has looked at an exported race in an engine, a realistic crew's hair, or a wide stair in a townhouse.
