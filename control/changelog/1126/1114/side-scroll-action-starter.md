### Side-scroll action starter: the beat 'em up

A beat 'em up as a game, on the brawl library's own kit (`lib/graph/brawl`, over the fighting game's fighters: the
chain and its finisher, the strong blows, grabs and throws, the running blow, the desperation, weapon arts, thugs
from the fight's archetypes). The library's street (screens held by a gate until their wave is beaten, a boss's
screen) is now played on a page; before, only its practice yard was.

- A street fought down on the World page. A brawl level's `street` (`{ players?, roster?, waves: [{ screen, crowd,
  boss? }], things? }`, `brawlLevel(level, { street })`) is played by the brawl channel in the yard's place: the room
  a street (`brawl-crowd.js` streetOf / stepStreet), the players' buttons read by the brawler's own reader, the camera
  scrolled on and held at each uncleared gate by the belt. A level is a yard or a street, not both.
- Its screen (`brawl-street.js`, on mana-ui in the brawler's look): the player's name and health, the held screens as
  pips, the crowd left on this one or the boss's bar while it stands, GO as a screen is beaten and the boss's name as
  it comes in, and the two ends (the street cleared, the player down) with the time, the health left and a button
  that fights it again. What it reads is `brawl-street-read.js` streetRead, pure off the street's state.
- Measured with no page: `scripts/spikes/brawler/street-sim.mjs` plays a street on the brawl's sim with a bot on the
  native kit. On the page: `scripts/spikes/brawler/street.mjs` (a virtual clock, the keyboard): a lighter street is
  cleared through its boss to its end screen, a full one beats a button-masher on its second screen; fight it again
  returns to the start; no page errors.
- Its sound, from the SFX shelf by word (`brawl-sfx.js` BRAWL_SOUNDS, brawlAudio): the brawler's sound sheet. The
  cues a blow already played (a fist by its weight, a foot, a blade, a grab, a throw, a body landing, a knockout) are
  voiced by shelf word in the sheet's style, the newest voices first (`mouth`, falling back to realistic where the
  mouth voices none; `brawl.sound.style` says another), over the fight's family cues. And what a brawl never
  sounded: a blow thrown (a fist's swing, a strong blow's whoosh, a blade's), a jump, a thug's shout as it attacks
  (one in three, so a crowd is not a chorus), its grunt on a heavy blow and its cry as it goes down. The practice
  yard hears the same sheet. A probe reads what was asked for (`window.__mojBrawl.heard`): on a street played
  through, every cue asked for has a sound on the page.
- `brawl` re-pinned: the one fixture whose page inlines the brawl's client.
- A world that is a brawler: the quick goal `brawl` (`design_game({ quick: { goal: 'brawl', roster?, streets?, register? } })`).
  Its players are made as a fight's are (each a character through the character loop; the first plays), its streets
  are its levels (`quick.js` brawlStreets: a brawl level with its waves, and the hosted level's contract), and the
  game runs them in the play shell, its screens the game UI runtime's in the brawler's look unless the world says
  its own. Unsaid, one greybox street: a crowd a held screen, each a body more than the last, a knife among them from
  the second, a boss on the boss's screen. The agent's card for the goal says its levers; the character roll has a
  `brawl` genre (street fighters, never a bystander).
- A street in a game's shell: it says it is ready, takes the keyboard's focus as it starts, and sends its end up the
  level wire (cleared or down, the seconds and the health kept) in place of its own end screen, so the shell shows
  the result and what comes next. The greybox kind takes the level's contract (`game`).
- Through the doors and Chrome (`scripts/spikes/brawler/game.mjs`): design_game makes the player's character, the
  street and the game; export_game writes it; in the shell the title starts the street, the keyboard plays it, a
  masher beaten on its second screen is shown the shell's FAILED with try again, and a street cleared its CLEARED
  with the time and the health; no page errors.
- A street's rank: S, A, B or C by the health it is cleared with (three quarters, a half, a quarter), sent with its
  end and stamped on the shell's result; a result with no rank shows no rank row (the results idiom drew an empty
  one). The boss's bar runs along the foot, clear of the corners' readouts. The keys go back to the shell as a street
  ends, so its result is driven from the keyboard, and "play again" fights the street from its start.
- Not yet (sound): footsteps, a street's bed, the score and its stingers (the cue sheet), the screen's own sounds.
- Not yet: the crowd as a world's own bestiary (it is the library's thugs, stick figures), the street's dress (the
  stage kits), lives and continues, a rank on the result, two players checked on a page, a brawler from a composed
  (non-quick) world.
