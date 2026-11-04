### Destructible physics: metal panels on objects dent, hole and come off

- **Panels**: an entity under `destruction: 'physical'` can carry `panels`, thin metal plates on its faces (a car's
  doors and bonnet, a mech's armour, a locker, a drum): each a face, a place, a size, a thickness and a metal.
  `panels: true` on a box body plates every face but the bottom.
- They take the world's blows by the same law the blocks do: a round dents a thick plate and holes a thin one, a bat
  dishes a car-thin panel and rings off a plate, a blast pushes the whole panel in, and a panel worn out by its dents
  comes off and falls.
- The page draws each panel as the sheet it is, riding its object: the bowls, the dishes and the holes in its colour,
  lit as the dented blocks are.
- A world with no panels changes no byte.
