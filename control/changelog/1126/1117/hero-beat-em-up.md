### Superhero beat-em-ups: a team of heroes, each with a power, against an army and its villain

- **Ask for a superhero beat-em-up and you get one.** A team of heroes fights down a street seen from the side.
  Each hero has one signature power on its own button and a few uses of it each life. The street throws an army at
  them that drops in from above and comes out of doors as well as walking on. More of them come at once, and each
  falls to a few blows. At the end waits a villain who has a power of its own and fights in stages. You have five
  falls. "A superhero beat em up in a port town" now lays its streets this way. A plain "beat em up" is unchanged.
- **Eight powers, each a card.** A beam from the eyes or the hands that passes through everyone lined up on it. A
  great slow ball of force. A barrage of darts. A gout of flame. Lightning called down all round you. A berserk
  rush through the crowd. A step through space. A strongman's grip that slams a body down. Each is drawn in its own
  colour as it flies, and each hero's uses left show as pips under its health. Using one spends one; falling fills
  them again. A new power is a new card.
- **The team and the villain come from the comic hero pack.** Unless you say otherwise, the team is the pack's
  leader with the beam, the rival with the storm, the sidekick with the phase and a strongman with the grip. Each is
  rolled as a character from its member's sheet and drawn in its own body. You can name the powers, swap in another
  of the pack's cast or rename a hero. The villain is the pack's mastermind with the ball of force unless you pick
  another (the brute with the grip, the rival with the beam). It is made as a character too and stands at the end
  of every street. The army is the pack's shadow clan, with blades and a staff, unless you name another crew.
- **Design your own heroes and powers.** When you ask for this game, the studio now asks first who your heroes
  are and what each one's power is, and offers the defaults if you have none in mind. A hero can be your own,
  described in a sentence with its build, age and whether it is a man or a woman. It is rolled from your words and
  made as a character. It can also be a character you have already made, or another of the comic pack's cast. A
  power is one of the eight kinds made yours: give it a name and a look (any beam, a laser or lightning or a ball
  of fire), how many uses it has each life, and how strong it is. A power thrown down the street also takes how
  fast it flies, how big it is and how many enemies it passes through. Each setting has limits. The villain can be
  chosen too, with a name and a power of its own. The hero picker shows each hero's power by name. A power far
  stronger or weaker than the ones the street was tuned with is pointed out for you to decide on, never refused.
  A designed power is not measured by the studio's simple player.
- **A designed game's street can be a superhero one.** Give a street level `tuning: 'heroes'`. Your game's hero
  then plays its own power: the first attack its actions page throws is played as the street power of that kind and
  drawn in that beam. The cast who join the party and any stand-ins take the team's powers in seat order. A street
  can also name each seat's power itself, one of the eight or one you designed. The street's enemies are still your
  game's own.
- **A power is a super moment.** When a hero calls up a power, the whole street holds still for an instant, as a
  fighting game's super does: longest for the ball of force and the storm, a blink for the phase. While it holds,
  the screen marks the hero. The air round them goes to its negative like a comic's impact frame (the ball of force,
  the storm), lights up (the beam, the flame, the barrage), bends (the phase) or darkens (the frenzy, the grip). The
  hero's own body is left alone; the effect is in the air round it. A villain calling up its power gets the same
  moment against you, and so does a fighting-game super thrown on the street. You can choose a designed power's
  moment (`screen`: lift, ring, shade, ink or none). Only a street whose heroes have powers carries this layer.
  Every other street's page is unchanged. Measured with the freeze in: one hero still wins the default street alone
  with each power, losing two or three of five falls, and four heroes lose one. Seen in headless Chrome: the street
  held, and the air round the hero inked as the ball of force was called up.
- **Powers throw bodies by their weight.** Some powers now carry energy as well as damage, by the studio's own
  destruction physics: a blow is measured in joules and a body holds by its footing. What gets past the footing
  throws it, so a light grunt flies and a heavy brute only staggers under the same blast. The beam and the flame shove
  whoever they hit along the line. The ball of force and the storm strike the ground: the ground takes most of the
  blow, shown as a ring of dust where it landed, and the rest throws everyone near, harder the nearer they stand. A
  body thrown down flies, lands and slides to a stop. An enemy a power has just finished off is thrown with the rest.
  A villain's power throws your heroes the same way. The motion plays at a beat-em-up's pace, so nobody is thrown
  off the screen. The other powers move bodies as before. Measured: each power still wins the default street alone,
  losing two or three of five falls, and four heroes lose none.
- **An earth power: summon a wall, then push it.** A new power, the wall. The first press wrenches a slab of the
  street up out of the ground in front of the hero, rising in a ring of dust. It stands as cover: enemy fire stops on
  it, and nobody walks through it. Press again while it stands and the hero shoves it down the street. It is a few
  tonnes of stone, so the shove's force gives it its speed, and the ground's friction slows it. Every enemy it meets
  is floored and thrown ahead of it. It slows a little with each, so it bowls through a line until the ground and the
  bodies have taken its speed. A slab that has nearly stopped only nudges. It crumbles into dust when it stops, or
  after a few seconds if nobody shoves it. It has three uses a life, and only raising the slab spends one; the shove
  is free. A designed wall's strength makes both the shove and the blow harder. Measured: one hero with the wall wins
  the default street alone, losing two of five falls (with two uses a life it lost four, so it has three). Seen on the
  page in headless Chrome: the slab standing between the hero and two enemies, then sliding into them and throwing
  them.
- **Heroes who float, and a wind power.** A weather hero is carried on the air instead of walking, as the weather
  witch of the comics rarely touches the ground. It hovers off the street with a slow bob, never walking, in the
  comics' pose of power: carried upright with the chin up, one knee drawn up near level with its shin tucked back under
  it and the foot drawn in by the other knee, the other leg let down long and straight with the toe pointed, the fists
  clenched at the waist with the elbows bent. Gliding, it leans into the way it goes and the long leg trails back. It drifts rather than walks: it eases up to speed and glides on for a moment after you let go, by the same law the studio uses for a
  hero's air dash. With no footing under it, a blow knocks it further than a hero standing on the ground. The storm
  power's hero now floats, and so does the new gale power. The gale calls a hurricane of wind down the street. How hard
  it pushes each enemy is the wind's drag against that enemy's footing: a grunt is blown off its feet and carried away,
  a heavy brute braces and holds, and a floating body is swept away hardest. Enemy fire caught in the gale is blown out
  of the air. The gale is drawn as streaks of air down the street. A designed power can carry its hero too
  (`float: true`), and its strength makes its wind stronger. Measured: one hero with the gale wins the default street
  alone, losing three of five falls. The four-hero team now loses two falls (it lost none before its storm hero
  floated, since a floating hero is easier to knock about). Seen on the page in headless Chrome: the hero hovering,
  the streaks of the gale, and the enemies in it braced and pushed back.
- **Long hair and loose cloth move with the air.** On a street, a character's long hair (what hangs below its neck)
  and its loose cloth (a skirt, a coat's tails or a cape's hem hanging below its hips) now swing with the air it moves
  through. Walk or run forward and the hair streams back, more the faster you go. Stop and it swings forward past
  where it hangs, then settles. A floating hero is borne up on its own updraft, so its hair and cape billow and stream
  behind it even while it hovers still, and further as it glides. In a gale the wind blows them the way it blows, hard
  enough to stand the hair out level. A knocked-down body's hair rests. Cloth swings less than hair for the same
  air. How far it hangs is the air's drag against its weight, eased by a spring, so a strand swings and settles
  rather than snapping. A bent strand keeps its length. This is drawn only: the fight itself never sees it. Hair
  that ends at the neck and trousers do not move. The street's bodies carry no hair bones yet, so the whole lock
  bends as one about its root rather than strand by strand. A cape on the street hangs from the shoulders only: its
  edges no longer follow the arms, so it is not pinched in to the fists while the arms strike or hold them at the
  waist. Seen on the page in headless Chrome on a hero made with long hair and a cloak: the cloak and the hair swept
  back as it glided, the cloak blown across it in a gale at its back, and a slow billow as it hovered still.
- **Describe how your hero looks, and it looks that way.** A hero you design used to take only who it is from your
  sentence: its hair and clothes were rolled, so "long white hair and a flowing cape" could come out a short brown
  bun. Your sentence now sets the hair and what hangs loose on the hero. That covers the hair's style (long, a
  ponytail, a braid, a bun, a bob, a buzz cut, bald), how far it falls ("down to her waist", "to the shoulders") and
  its colour ("white hair", "silver-haired"). It also covers a cape or cloak, a gown, dress or skirt, and a robe, each
  falling as you say ("a long cape", "a short skirt"). You can also say it outright: `look: { hair, length, colour,
  cape, gown, robe }`, whose words win over the sentence's. Everything else (the face, the build, the rest of the
  clothes) is still rolled. A cape or gown is added to the hero's rolled outfit, so nothing it was wearing is taken off.
  The look is laid in the words each head wears, the anime one or the western one. A hero you made already keeps its
  own look, and a look given with one is turned down: change it with the character's own edits. The studio now asks
  for each hero's hair and cape along with who it is. A hero whose look nobody described is made as before.
- **A power's round can floor what it hits.** A special's projectile now knocks down when its move says so, and a
  power's round passes through as many bodies as its card says. Before, a projectile knocked nobody down and
  stopped at the first body.
- **Projectiles are seen on a street.** A fighter's thrown special (a fireball, a villain's power) used to be
  invisible on a street's page. It is now drawn as a glowing shape the size of its hit box, in its thrower's power
  colour. A hero calling up a power flashes in that colour.
- **Measured, by a simple player that presses its power.** The studio's simple player now has a `hero` version.
  It uses its power when two or more enemies are lined up with room before the nearest, or three are around it.
  On the default street with the heroes tuning, one hero won alone with each of the eight powers, losing two to four
  of its five falls (two or three with the super moment in). The plain player, which never uses a power, lost four.
  Four heroes together won with no falls (one with the super moment in),
  and a player that does nothing cleared no stop. On the street a superhero sentence makes, the hero player won with
  one fall. The plain player won there with none, so on that street the power is not yet shown to make the game
  easier. Seen on the page in headless Chrome: the beam flew in its colour down the line and hit, the storm flashed
  around the hero, the pips went from three to two, the heroes card's five hearts showed, and the page had no
  errors.
- **Fixed: a beat-em-up in the anime look could not be made.** Its heroes were drawn from an anime character
  sheet (anime hair, face and expressions) and then given the western head, which turned those words down, so making
  the game stopped with an error. An anime beat-em-up's heroes now keep the anime head on the brawler's body. A
  western one is unchanged.
- **Not yet:** the coin-op's foot soldiers were robots, and only a person's body stands on a street, so the army
  is people. The team is four, the street's seats, not six. A power has no fallback when its uses run out (it
  simply does not fire). Nobody has played it: the simple player shows a street can be won, not that it is fun.
