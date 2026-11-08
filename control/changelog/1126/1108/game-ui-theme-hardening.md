### Game UI that reads as a game, not an app: the frame, the type, the legend bar and the UI's sounds

- **Research behind it: how game UI differs from app UX.** `docs/game-ui-research.md` sets game UI against the SaaS look
  generated UIs default to (a 4 px rhythm, gentle type steps, grey hierarchy, one radius on everything). It covers the
  style schools, how each kind of screen is built, the type, hierarchy, spacing, motion and sound, and what studios
  hold to, then maps it onto the game UI runtime (internal name mana-ui) as a sequence of work. This is the first step
  of that sequence.
- **A screen is a frame, sized by the screen and by how far away the player sits.** Every length in the runtime's sheet
  is now in units of 1px at a 1080p reference, scaled by the stage's height, so a screen keeps its proportions at any
  resolution instead of reflowing like a page. A theme's new `distance` word says where the player sits: `desk` (the
  default), `couch` (everything larger by the ratio of Xbox's console and PC text minimums) or `hand` (a phone, in CSS
  px). Screens and the HUD's places sit inside a title-safe frame, 5% in from each side. The player can set text up to
  twice its size.
- **Fewer type sizes, bigger jumps between them.** Captions and labels sit at the floor, body text a step above it,
  titles at twice the body and the display role near four times. Headings are in the main ink colour instead of small
  grey uppercase labels, and an option's own name is body text.
- **Text over the world keeps a halo.** Text with no window behind it (a title screen's menu, a screen's own title, a
  banner) gets a halo in the panel's colour so it reads over any scene. A theme's new `halo` word picks an outline (the
  default), a glow, a hard shadow, a plate behind it, or none. Subtitles sit on their own plate, and the player sets its
  opacity. A theme's ornaments are no longer drawn on transparent (ghost) windows.
- **What the buttons do is a bar at the foot of every screen.** A screen's legend is pinned to the bottom right of the
  safe frame. A screen that names none gets one drawn from what it holds: select, change, tabs, and back where back
  leaves something.
- **The UI makes sounds, as effects.** The runtime now emits a sound effect when the cursor moves, a pick is made, a
  value turns, a screen opens or closes, a tab turns, or a disabled row is pressed. The host plays them; the runtime
  ships no audio. A theme's new `cues` word says how many: none (the default), the cursor's only, or all. A world's UI
  guide carries its register's sound setting across, and the wireframe board logs each sound.
- **The focus is the console's ▶ by default, and a highlight bar is a new focus.** The default focus (the greybox)
  marks the focused item with a ▶ at its left, a shape rather than a colour, and it pops as it lands under a theme that
  moves. A theme can still choose a ring, or the new `bar`: a solid block at the item's leading edge with the accent
  fading behind the words.
- **Title and attract screens look like a game's.** The title screen puts key art behind, the game's name and a large
  menu in the left third, and the version in a corner. The attract screen puts key art behind and a "press start"
  prompt that breathes slowly; any face or shoulder button starts the game, and the effect says which player pressed.
