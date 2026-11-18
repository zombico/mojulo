### An open city in gen 7: half the page, half the textures, its tiles read again

A town or city exported at `era: 'gen-7'` (the form render: its buildings lit by the sun's bake, each dressed tile a
material with a normal and an ORM beside its paint) was measured against the same city at gen 6, the commuter's story
city: the page was 51.5 MB against 4.8 MB, its textures on the GPU about 226 MB against 101 MB, its draw calls the same
(about 1,300) and its materials nearly double. Almost all of the difference was the dressed tiles' relief: 39 tiles, each
a normal and an ORM at 512, in pairs that were one tile at two seeds.

- **One reading of each tile** (`matte-paint/detail.js` `firstReading`): a town in the form render draws each dressed
  tile at its first seed (`-a`); its second (`-b`), a second seed of the same tile laid by where a face stands, is drawn
  as the first. The page's resampler (`scene/channels/resample.js`) already reads every tile again at seeded shifts, so the
  second seed added nothing the eye keeps, and on this page it doubled every tile's paint, normal and ORM.
- **The resampler kept under the form render** (`scene/channels/form.js`): the form's material took each mesh's paint
  over and dropped the resampler's patch, so on a gen-7 page a wall's tile repeated as it does nowhere else. It now reads
  the tile through the resampler where the parallax landed; the plans shift by whole courses, boards and units, so the
  joints stay where the relief has them. A room in the form render whose tiles carry plans is read the same way.
- **A town's relief at the smaller size** (`worlds/world-scene.js`, `form/room-form.js` `formRoomMaps({ reliefSize })`):
  the relief is drawn only near the eye (`pom` to 8 m, `relief` to 22 m), so a town reads it at `ROOM_MAPS.small` (256)
  outright, once.

Measured on the story city's district at gen 7 (headless Chrome, software GL): the page 51.5 → 25.4 MB (under the 25 MB
per-file note it carried before), the relief 29.8 → 3.7 MB of it, the textures on the GPU about 226 → 126 MB (gen 6:
101), textures 122 → 68, draw calls and triangles unchanged. A frame's time is not measured here: software GL varies by
two times from one frame to the next, so the frame rate on a real GPU is the person's to see. A gen-6 page is as it was.
