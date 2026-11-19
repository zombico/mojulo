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

**What a frame draws, with the shadows and the light kept.** Gen 7's look is its sun (a shadow map over the land, drawn
once), the actors' live shadows, the static world's hour map, the baked sun and sky on every building, the relief near the
eye, tone mapping and contact occlusion; all of it stays. What it drew around them was counted per draw on the same
district (two frames, by shader): about 3,700 draw calls and 7.4 M triangles a frame, against gen 6's 2,200 and 2.5 M.

- **Passers-by culled and one draw each** (`scene/channels/walkers.js`, `WALKER_DRAW`): a walker is drawn only in the
  camera's view within 80 of its own heights, or within 12 all round (where its shadow may fall into view); one unseen
  walks on but is not posed. A blended walker's parts are one mesh (one skin, one material, its bones the material's), so
  a passer-by is one draw and one shadow draw. A capture draws them all, as before. Walkers' draws: about 910 a frame,
  and as many again into the shadow map, to 5 and 6. Every era's page takes this.
- **The occlusion's prepass leaves out what it cannot show** (`scene/channels/creases.js`, `OCCLUSION_FAR`): a mesh wholly
  past 240 reaches of the camera (120 m at the default half metre), where a contact spans under two pixels of the pass,
  is not drawn into it again. Only a page with occlusion alone; the creases' ink and outline read the far.
- **A town's flora** (`form/land-read.js` `TOWN_FLORA`): a geotown's or a metro's lawn draws its blades to 0.4 of the view
  cone's reach (about 12 m), its impression past that; its street trees lay no litter.

The district at gen 7 now: about 950 draw calls and 5.5 M triangles a frame, the walkers 5 of the calls, the grass about
0.6 M triangles (was 1.26 M), the litter none (was 0.28 M), the prepass about 300 calls (was about 940).
