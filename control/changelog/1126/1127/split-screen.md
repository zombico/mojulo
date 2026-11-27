### Split screen: a view for each player

- A game whose players each need their own view (a first-person deathmatch, a chase) can now split the screen: two
  players side by side, three or four in quarters. Each player's view follows their own body with the level's camera,
  and in first person each player's own body is hidden in their view and seen in the others'.
- A game whose cube asks for a split screen lays it: each player's view is their own camera, the level's own kind of
  camera on their own body, and the shared camera that held every player in one shot steps aside. A first-person game
  now seats more than one player when the screen is split. The hill-climb marks split screen as built: split-screen
  deathmatch is makeable, and every couch genre probe is now makeable.
- Not yet: in players 2 to 4's views a third-person camera does not pull in against a wall, the HUD is the whole
  screen's rather than one a view, and post effects show in player 1's view only.
- Turns, the alternating two-player game: players take turns at one hero. Only the player whose turn it is drives; a
  fall, or the hero knocked down, spends that player's own life and passes the turn to the next player with lives left,
  and a game can also pass the turn on a clock. The chip strip marks whose turn it is. A game whose cube asks for turns
  lays it, and a turns game can open on the lobby. With turns built, every seat value in the hill-climb is built.
