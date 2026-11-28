# The movers

A removals job in a played city. The job is taken on Jobsified: the moving truck is had at the dock and driven to a house
on the block. Inside the house, any piece of it is lifted whole and carried in the hero's hands (a couch, a fridge, a box)
through any door, up and down any stair, out of the basement. Carried to the front door, it goes onto the truck. When the
truck is full, the job pays into the bag.

## In the city

- **The job** (`gameworld/jobsified.js` SHIFTS `movers`): a desk-style shift (`mode: 'desk'`) whose `door` is the
  house's, not the office tower's. Its truck is issued at its yard (`vehicles: 'moving'`, `MOVING_TRUCKS`, a box truck in
  the firm's livery), and its words are its own (`says`: the guide's first step, the clock-in, the work inside).
- **The house** (`geocity/walkins.js` `house`): a walk-in on a block of the district, a small porch on a painted house. Its
  door is a level's door into the house's own page (`gameworld/levels.js` `walkinDoor`, `interiorStage`).
- Hijack City keeps both (`HIJACK_ENTER`, `HIJACK_SHIFTS`). The walk-ins take the district's free blocks in order, and
  the house comes before the aquarium and the zoo: a downtown with few blocks keeps the job's house first.

## The house

`era/programs.js` `house`, a core plan of two storeys over a basement (`basement: true` on its door):

- **The ground floor:** a hall at the door with the stair, its kitchen-diners on one side of the corridor and its living
  rooms on the other.
- **Upstairs:** bedrooms, whatever its bays are called, and the main bedroom (`master`).
- **The basement:** storage under it all.

It is furnished as a home is (`era/stocking.js` `HOME_STOCK`, a room's part by `homeRole`, by its floor's height). The new
pieces are rows of `era/compose-dress.js` `PIECES`: the sofa, armchair, coffee and dining tables, bookcase, media console,
chest of drawers and nightstand are the furniture shelf's own styles (`furnishings/forms.js`); the fridge, the wardrobe
and the moving box are drawn there. The hall at the door holds nothing: it is where what is carried out is loaded.

Over a basement the way-in room stands a storey up, so its door, the walker's arrival and the drop zone are on that
floor (`structure/level.js` `stageDoor`).

## Lifting

`worlds/controllable/heave.js`, an opt-in runtime builder (emitted only into a page whose world carries `heave`):

- **The pieces:** a stage with `heave: { pieces: 'props' }` lifts every solid prop of its rooms, its plot's own find,
  prize and sign excepted (`worlds/world-scene.js`). Each piece is its collider's box, and its faces a render group of
  its own, `heave:<id>`.
- **E lifts** the nearest piece in reach that the hero faces, on the floor it stands on. While held, a piece is no thing in
  the world: its box is out of the colliders, so nothing it would hit stops it. It rides in the hands, its underside at the
  hands' height. **E again** sets it down on the ground before the hero, its box back where it was put.
- **The drop zone** is just inside the front door, where the walker comes in, clear of the door's own zone. A piece
  carried into it is loaded and gone.
- **The bus** hears `heave:lift`, `heave:set` and `heave:load`. The page moves each piece's drawing where the runtime has
  it and says what E does (`scene/channels/controllable/heave-view.js`).

## The move

`game/movers-mechanics.js`, the `movers` mechanic (its card `game/mechanic-cards/movers.md`): each `heave:load` counted,
the count on the HUD; the truck full at its `load` (12 by default, `gameworld/movers.js` `MOVERS`), the pay into the bag
and a banner, once.

## Gates

- **Machine:** `worlds/controllable/heave.test.js` (lift, a couch wider than the doorway carried through it, set down,
  loaded, a walker whose position is its eye); `gameworld/movers.test.js` (the house's floors, its furniture by room, each
  piece solid, its door and drop zone, the move on the bus); `jobsified.e2e.test.js` (the job laid at the house's door,
  its truck issued); `gameworld/movers.live.test.js` (in Chrome: E lifts a sofa, it is carried, loaded at the door, the
  truck's count goes up).
- **Eyes:** the person plays it: whether carrying a couch down the stairs feels right is theirs to say.

## Not yet

- The load drawn on the truck back in the street: the truck is loaded at the front door.
- Unloading at a second house; a piece's weight slowing the mover more than another's.
- A piece turned as the mover turns: it is carried as it stood.
