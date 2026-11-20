### Start screens as a game's launcher: its cast as graphic design, type that performs

In progress. A game's start screen opens at once, before any of the game's engine loads, and today it shows little: a
title over the theme's ground, or a heading and a play button. The plan: a start screen made like a high-end motion
website, composed from the game's own characters, vehicles and props, never a level or a set.

- Two modes of one composition. The default draws stylized pictures of the game's subjects (cut out, duotone, halftone,
  inked) laid out with large type and motion, with no 3D on the screen. The high-end mode puts the same subjects in live
  3D, idling under the game's light, loaded only after the first picture has shown.
- A layout per kind of game, each a card: a hero posed, two fighters facing off, a car in a showroom, a gun or an
  operator as hardware, a party, pieces on a table.
- The game's name performs (letters that rise, slam or draw themselves on) while the menu stays plain words with
  no boxes, and a player who turns down motion gets fades.
- While the start screen is up, the first level starts loading, and the loading screen keeps the start screen's look.
- In the guided design, the start screen is offered near the end, once the first level plays; the person can ask for
  it at any time.
- **Begun: the recipe and the first layout.** A game's front takes a `stage`: which layout, which of its subjects stand
  on it (its hero, a friend, a foe, its vehicle, a prop, or a sketch named), pictures or 3D, and how a picture is made
  graphic. It is checked like the rest of the front and drawn by nothing yet, so every game's start screen is as it was.
  A game's subjects are read from what its design runs made and the hero it adopted, and a game with something to
  show can be offered a stage that suits its kind of game. The first layout is the hero pose: one figure large and off
  centre, the game's name huge behind it, the menu as words on the open side, laid out for a wide screen and an upright
  phone (`playscape/ui/front-cards/`).
- **The start screen drawn, in pictures.** Exporting a game whose front has a stage now pictures its subjects: each
  is posed a moment into its first animation, seen from the angle its layout asks, cut out cleanly (a soft edge, no
  floor, nothing behind it) and drawn in one of six looks in the game's own colours: cut out with a rim of the accent,
  a flat silhouette, two-tone, a few flat bands of its own colours, a dot screen, or inked lines. The game's start
  screen then shows the hero pose: the game's name set huge behind the figure and entering letter by letter, the
  figure rising in, the menu as plain words with no boxes, for a wide screen and an upright phone, whether its screens
  are the plain ones or drawn by the game UI. The pictures are kept between exports, so a second export takes no time,
  and a game whose subject could not be pictured (no browser where it is exported) still gets its name and its ground,
  with the reason said. A player who turns motion down gets fades. Only an export draws it: the game page in the
  dashboard is unchanged.
