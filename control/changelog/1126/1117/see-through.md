### Glass and mesh: barriers a gaze goes through

Every wall stopped sight, so a guard was only ever read through a doorway. Glass and mesh now stand in a body's way and
not in a gaze's.

- **Barriers in the runtime** (`worlds/controllable/barrier.js`, opt-in): a world's `barriers` are kept apart from its
  colliders, so every sight test runs through them, and after each step every body standing in one is put back out of
  it, as a wall would hold it. A round goes through. Emitted only into a page whose world has barriers.
- **Inner windows** (`era/inner-windows.js`, a program's `windows`): glass between a room and its corridor, on the
  longest stretch its doorway leaves, sill to head, cut in both walls, glazed by the kit's own glazing with no daylight
  beyond it, its pane a barrier.
- **Mesh** (`compose-dress.js` `mesh-panel`, a piece that is `see`: its anchor a barrier, never a collider) and the
  **cage** layout (`era/room-layouts.js`): a ring of mesh inset from a room's walls, each side drawn in until it stands
  clear of the doorways' approaches and the vents' hatches, a gate in its long side, its stock in rows inside. A room's
  laws and the route search count mesh and glass as in the way and stopping no gaze.
- **The armoury** joins the facilities: its cage rooms and its vault caged, its magazine in crate clumps, its issue and
  cleaning rooms windowed onto the corridor; the research wing's labs and the field HQ's offices are windowed too.
- Each storey's crawl spaces, vents and barriers now reach the page lifted to their storey (the ground's alone did).
  The facility maps draw windows as pale bars and mesh as dashed grey lines.
- **Cages closed and roofed.** A piece can be stretched to a length of its own (`w`, `d` on an item: `footprintOf`
  and its parts follow), mesh abuts mesh, and the cage tiles each side edge to edge, its long sides run out over the
  corners and its end sides fitted between them, so the ring is closed but for its gate. A roof of mesh tiles
  (`mesh-roof`, laid overhead: an item's `over`, taking no floor and stopping no gaze) covers the whole ring at the
  panels' head, so no body climbs in over it.
