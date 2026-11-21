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
- **Every game UI title performs.** A game whose screens the game UI draws now brings its name in letter by letter on
  its title and its attract screen, in its look's way: rising, slamming in, wiped on or tracking in. A look says which
  with a new word, `title` (`still` keeps the name whole), and one that says none rises. The entrance follows the look's
  own motion, so a look with none shows the name at once, and a player who turns motion down sees it fade. The name is
  still read aloud as one word. On a start screen drawn as a picture, the menu is now words with no window or band
  behind it, drawn so by the game UI itself. The wireframe board shows the entrance on its title and attract screens.
- **The high-end start screen: the figure comes alive.** A stage in `mode: '3d'` opens on its pictures as before;
  then, once they have shown, the page loads the 3D engine and each subject's model and fades the living figure in
  over its picture, framed by the very camera the picture was taken with and starting its idle where the picture
  caught it, so the picture seems to begin to breathe. The figure turns a little toward the pointer and sways, keeps
  its accent rim (or its silhouette), and stops drawing while a level is played. The engine comes beside the game in
  its folder, or from the pinned CDN when the game is exported with `cdn: true`. Without WebGL, with a model that will
  not load or is too heavy for a start screen, or for a player who turns motion down, the picture stays and nothing
  else changes. Looks that remake a picture's colours (two-tone, dot screen, posterize, ink) stay pictures, and the
  export says so.
- **From the start screen into the game.** While a staged start screen is up, the game quietly starts fetching its
  first level in the background (not on a connection that asks to save data, and not past 30 MB), so pressing start
  plays from what is already there. Pressing start then turns the start screen itself into the loading screen: the
  figure stays where it stood, the big name gives way to a small one in the corner, and the place being loaded is named
  over a thin bar, with a note if a big map is still being built. When the level's first frame is drawn, the loading
  screen fades away over it. Both screen kinds, the plain ones and those drawn by the game UI, hand over this way; a
  game without a staged start screen keeps its loading screen as it was.
- **Offered near the end of the guided design.** Once a game's first level is proved and it has something to show,
  `design_game` offers its start screen as a next move, `front`: the layout its kind of game suits, who stands on it,
  and the change that lays it, which the person takes or leaves (it is never a goalpost, and nothing is laid unasked).
  Before then it is theirs to ask for in the interface chapter. A start screen is reviewed there as its own part, the
  start screen: its layout, who stands on it, pictures or 3D and their look, and what it lacks. The interface card
  says what a start screen is, when it is offered, and its layouts and looks.
- **Two fighters squared up, and the other shells' starts.** A new layout, the face-off: two figures across a hard
  diagonal, each on its own colour and turned to the other, sliding in from their sides, the game's name huge across
  the cut. It is the start screen offered to fighting games, brawlers and arena shooters with a hero and a foe to
  show, and a layout can now say which way each figure turns. A versus game's title, drawn on its own canvas, is laid
  out by the same layout: its first two fighters squared up on their colours, the name entering letter by letter,
  press start as plain words, on a wide screen or an upright phone, and whole at once for a player who turns motion
  down. An arena game's start screen takes a stage too (`menu.stage`, its subjects named by sketch), pictured at
  export and drawn behind its start screen alone, its words moved where the layout puts them; one without a stage is
  as it was, byte for byte. A contest's start stays its broadcast's opening; the tabletop, the pen-and-paper game and
  the pixel games keep their own starts.
