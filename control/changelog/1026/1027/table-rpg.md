### Table RPG: a pen-and-paper game played in text, its game book, its cast and its arms

#### Table RPG: a pen-and-paper game played in text first
A tabletop role-playing game as a recipe, the concept layer: a module (a rules card, a party rolled from it, a world, its
dungeons, foes, items, tables, beats and a goal) played fully in text, every die rolled in the open, before any page
or picture. The map, the research behind it and what each part is composed from: [docs/table-rpg.md](../docs/table-rpg.md).
No MCP surface changes in this theme; the game type it becomes is the next theme.

- **Rules as procedures** (`lib/graph/table-rpg/table-rpg-systems.js`): a rules card is a resolution procedure and its
  numbers (a d20 against a target, a d20 rolled under, 2d6 in bands, fudge dice for shifts, d100 under a score, a d6
  against two d10), with its abilities, generation methods (rolled in order, rolled and placed by the class, an array,
  points bought), modifiers, hit points, foe ranks, progression and classes. Mojulo ships one generic starter per
  procedure, in its own words and numbers, and no published game: one the person names is written out as a card by
  their model from the rules they supply, checked by the kernel, its `attribution` (if it carries one) printed by the
  referee packet.
- **The kernel** (`table-rpg-kernel.js`): one closure a page can emit by `toString()` (held equal by a test), pure and
  seeded. Dice notation (NdS, d%, dF, keep and drop, exploding), every procedure read as one band, character sheets
  on their own stream per member, the point-crawl world and its days of road, dungeon rooms and links (locked, secret,
  one way, forced), traps, searches, fights (the system's initiative; foes that roll, or players who roll every die and
  take harm on the bands the system says cost), experience, marks on a miss or milestones, rests, tables, a yes/no
  oracle and a dice tape. `legal` / `parse` / `apply` give a typed game its moves; the command list is the save.
- **Portable words**: a module names a faculty, a difficulty word, a foe's rank and a member's role, and the card
  says each in its own numbers, so one scenario plays under every card. The test module (`fixtures/sunken-chapel.js`:
  a village, a road, a chapel with a loop, a lock and its key, a hidden way, a trap, a wandering table) is played to
  its goal under each procedure.
- **Composed with the rest of mojulo**: a member's persona from the egocube (the sheet `create_character { egocube }`
  draws a body from), the party lowered to the live RPG's `play.rpg` and fought by its battle kernel
  (`table-rpg-party.js`), a dungeon drawn from a building's program (`table-rpg-program.js`), the world lowered to the
  epoch map (`table-rpg-world.js`), a dungeon read for whether it plays (`table-rpg-dungeon.js`: reach with keys, a
  key behind its own lock, a lock with no key, the goal, the way back, loops and dead ends, advisory), and the referee
  packet an agent runs a game from in prose (`table-rpg-module.js`).
- **`scripts/table-rpg.mjs`**: the module at a terminal prompt, its referee packet, or a command list's transcript.

Machine gate: the table RPG suites (the dice, each generation method, each procedure's bands, the whole module under
each procedure, the closure against the live copy, the dungeon findings on sound and broken graphs, a program's
dungeon per plan shape, the epoch map through `readMapSpec`, the live party through `readRpg` and a round of the
battle kernel). Eyes gate not run: the author read the transcripts and the packet under every system.

#### Books: a press, a style library, and the game book printed to PDF
A book mojulo makes is one self-contained page that reads on a screen and prints as a book, and headless Chromium
prints it to PDF: the first PDF the export stack writes. The table RPG's game book is the first book on it. The map:
[docs/books.md](../docs/books.md).

- **The style library** (`lib/graph/book/book-style.js`): a style is a look (a presentation theme token, the words
  decks and charts already use; recoloured by a `palette`), a format (one column held in the hand, two columns on a
  full page, one landscape sheet in three panels, a form a page), a paper, and faces for text, titles and tables (font
  shelf keys); presets compose them (`tome`, `zine`, `dossier`, `pamphlet`, `screen`). A dark look printed is advised
  against, never refused.
- **The press** (`book-press.js`): `@page` sets the paper, margins, running title and page numbers; text flows in the
  format's columns; keyed entries, stat blocks, roll tables, boxed notes and figures stay whole across a break; the
  faces the style uses are inlined as `@font-face`, only theirs (a style's page carries no other face's bytes). Pure.
- **The printer** (`book-pdf.js`): `printPdf(html)` through `scene/chromium.js` (consent to fetch, never under the
  plugin profile): the page's own paper, the colours printed, tagged, the headings as the outline.
- **Faces on the shelf**: Crimson Text (a book's text), Courier Prime (its typewriter) and IM Fell English vendored
  from google/fonts, unmodified, each beside its OFL text, in `fonts/LICENSES.md` and `NOTICE`; `fontFaceCss(key,
  styles)` gives a book a vendored face. IM Fell English was already a shelf face falling back to the host's: a cover
  naming `im-fell` (the novel cover's title) now carves in it everywhere, its letters changing once, to the face the
  recipe always meant.
- **The game book** (`lib/graph/table-rpg/table-rpg-book.js`, `table-rpg-maps.js`): a module as a book — the title
  page, how the rules run in the card's numbers, the world and its point-crawl map, each dungeon's flowchart map and
  its rooms keyed by the map's own numbers, the foes as stat blocks, the tables, the party's sheets a page each, the
  dice tape, the colophon (a card's attribution when it carries one). A one-sheet format keeps what the table needs in
  play: the one-page adventure. `scripts/table-rpg.mjs --book out.html --pdf out.pdf --style <preset>`.

Machine gate: the press and style suites (presets, formats, refusals, the faces inlined per role and only the used
ones, the blocks kept whole), the maps (every room once with its key's number, every link by its kind, every road with
its days), the book (keys, sheets, the tape, a card's own words, the one-sheet cut), and the live suite in the e2e tier
printing a book and a one-sheet pamphlet (the pages, the faces embedded). Eyes gate not run: the author printed every
preset and read the pages (fixing four column and map faults on the way); the operator has not.

#### Table RPG: the game type, its page, its export and character creation
The table game becomes a game type beside the board games: `create_game({ table_rpg })`, engine `table-rpg`, its own
page and its own book, no store and no levels. One property on the door, no new tool; the flat tools/list payload's
pin rises 212,300 → 212,500 for it (measured 212,353). The map: [docs/table-rpg.md](../docs/table-rpg.md).

- **The row** (`lib/graph/table-rpg/table-rpg-manifest.js`): `{ kind: 'game', engine: 'table-rpg', title, tableRpg }`,
  the module's keys and a `book` style; the page, the book and the sheets regenerate from it; `update_sketch` plays an
  edit through the kernel first (refused, `Invalid table game`, when it cannot play).
- **The starter** (`table-rpg-starter.js`): `starter: { use: 'crypt' }` makes a whole game from a building's program —
  a town, the road and its table, the dungeon with its loop, lock and key, minions and the boss guarding the prize, a
  wandering table, the goal; what the module writes itself wins.
- **Character creation**: the party rolled by the card's method, each member on its own dice, `egocube` rolling who
  they are (a persona, a name rolled from syllables when none, the role when none); three rolled when no party is
  named. The mint's answer says every sheet as rolled and how it was made, and the checks' findings (advice).
- **The page** (`table-rpg-page.js`): the kernel's own closure on one self-contained page in the book's look and
  faces, the transcript, the moves offered as buttons and typed, every die in the open; the moves kept in the player's
  browser are the save, replayed on load.
- **Where it is**: `/api/sketches/<ref>/game` the page; `/bible` the game book (`?parts=party` the characters' sheets
  alone, `?style=`); the game rail's exits play, book and characters; playtest refuses (no levels to open).
- **Export**: `export_game` writes `game.html`, `book.html`, `characters.html`, and `book.pdf` and `characters.pdf`
  through a browser already on the machine (an export never fetches one: without it the pages print from any browser,
  and the answer says so), with the recipe and a README.
- **Cards**: `get_game_vocab({ id: 'table-rpg' })` (the grammar, every starter, character creation and the book's
  styles, read from their tables); the routing card `table-rpg` with pen-and-paper phrasings and collision rows
  against the live RPG. `scripts/table-rpg.mjs --parts party` prints the characters alone.

Machine gate: the door's suite (a starter's mint and its sheets, the page and the book from the row, a module written
out, refusals, the checks advising, the update gate, the export with a printer injected and without one, the card),
the starter and naming tests, the routing-card and tool-description suites, and two live suites in the e2e tier (the
page in a browser playing Node's game line for line and replaying its kept moves on reload; the book printed). Eyes
gate not run: the author looked at the page and a characters print; the operator has not.

#### Table RPG: the party made characters, photographed into the book
- **The character loop at mint**: `create_game({ table_rpg })` makes each party member rolled on the egocube a real
  character — an egocube row from the very roll its persona came from, then `create_character { egocube }`, children
  of the game's ref, as the fight goal makes its fighters — and records it on the member (`character: <ref>`, the roll
  kept as `egocube: { roll }` so the stored party reads back the same persona). `characters: false` skips it; a member
  may name a character already made. The answer names each member's character
  (`lib/mcp/tools/table-rpg-portraits.js`).
- **Portraits**: the book photographs each character's World page in headless Chromium (the character bible's colour
  turnaround: its palette, its light), a three-quarter figure framed by its height and a bust at the head and
  shoulders, on the book's own paper, kept per character revision; the party lined up on the title page, each bust
  heading its sheet (`tableRpgBook`'s `portraits`). The `/bible` route and `export_game` take them; without a browser
  the sheets print without, and the export names who was not photographed.
- A persona now rolls on the member's own seed (`memberSeed`) with the default path, the roll an egocube row stores.

Machine gate: the door's suite (a member made a character: its sheet and body rows, the member recording it, the stored
roll reading back the persona; the export with photographs injected), the book's (the line-up and the busts placed,
none without), and a live suite in the e2e tier photographing a made character (a figure and a bust, read again from
memory). Eyes gate not run: the author read a starter game's printed book with its three characters; the operator has
not.

#### Table RPG: factioned encounters from the egocube's cast
- **Factions, standing and talk in the kernel**: a module's `factions` (standing −2 hostile … 2 allied, allies,
  rivals) and a foe's `faction`, `heeds` and `scorns`. A fight is spoken to through its leader, the highest-ranked
  foe standing: `parley` (presence), `threaten` (might) or `bribe <treasure>` (presence), once a fight, the standing
  setting the difficulty and what the leader heeds or scorns a step. Talked aside, the foes stand aside and their
  experience is earned; a parley or a bribe warms the faction, a threat cools it, a fumble cools it. Beaten, a
  faction's foes cool it and its allies and warm its rivals. Allied foes stand aside unasked. The `factions` move says
  where the party stands (`table-rpg-kernel.js`).
- **The cast** (`table-rpg-cast.js`): `cast: true | { seed?, as? }` rolls the journey's antagonists on the egocube
  (`rollCast`) and writes them as the mastermind's faction (leader, lieutenant, troops; wary) and the rival's (the
  rival and its hands; neutral), rivals of each other, each foe a persona with what it listens to read from its
  motivation and order. `as` lays the parts on the module's own foes, a starter's boss, minions and bandits unasked;
  what the module writes wins. A foe's `egocube: true` rolls it a persona alone.
- **In print and in the answer**: the book's Factions chapter (a diagram of the party and the factions, the talk and
  the standing ladder in the card's numbers, each faction's people by rank), the referee packet's Factions section,
  and `create_game`'s answer naming the factions and their people, advising on any placed in no room and on no table.

Machine gate: the factions suite (a faction it cannot read refused; the difficulty by standing and by what the leader
heeds or scorns, hostile unheard; a parley, a threat and a bribe that land, each on a seed found in code; standing after
a fight won across allies and rivals; allied foes standing aside; no factions move without factions; the cast's parts,
ranks, factions and determinism; `as` and the starter; the chapter, the diagram and the packet) and the door's (a cast
on a starter: the factions named, the unplaced advised). Eyes gate not run: the author looked at the chapter's page;
the operator has not.

#### Table RPG: the cast's leaders made characters, human or not, photographed into the book
- **Any body**: `cast.people: { <part>: { body?, species?, brief?, facets?, mascot? } }` says what a part of the cast
  is, in the egocube cast's own member words: a person (the default), a beast-kin, a beast (a real species) or a
  mascot. Each foe's persona is read from its body and its temperament (`persona.body`, `persona.species`).
- **Made at mint**: the cast is stored as an egocube cast row (`castRequestOf`: the very request the game reads), and
  the mastermind, the lieutenant and the rival are made characters by their member paths through `create_character`
  (the hero, creature and animal doors, a mascot as a creature), as is a foe rolled alone on the egocube; each
  recorded as its foe's `character: <ref>`, named in the answer's factions. A body the loop cannot make is advised and
  the game goes on (`makeTableCharacters`, formerly `makePartyCharacters`). The game writes its egocube rows from the
  roll or the cast it has already rolled (checked by the kind and rolled where they are written), not resolved as a world
  at mint: a cast's line-up preview mints every member, a minute's work, and is drawn when the row is opened.
- **Photographed**: the foes that are characters are photographed as the party is, framed by the body's own extent (a
  long body by its length between its 2nd and 98th percentiles, a mascot's bust its whole head); the Factions chapter
  lines the leaders up and puts each bust in its entry, a foe of no faction gets its bust over its stat block. The
  `/bible` route and `export_game` take them (`foePortraits`).

Machine gate: the factions suite (each body's persona; an unknown body word refused; the chapter's line-up and busts
placed, none without), the door's (a cast row, the three leaders made with a beast among them, recorded on their foes,
the game reading the beast as its lieutenant), and the live suite photographing a beast-kin, a wolf and a mascot (a
figure and a bust each). Eyes gate not run: the author looked at the six photographs and a beast-kin's; the operator
has not.

#### Table RPG: the cast's beasts made game creatures by the mutagen
- **The egocube cast carries an ooze**: a beast member (`body: 'beast'`) takes `ooze`, the mutagen's words, carried to
  the animal door when it is made (`egocube/cast.js`, `egocube/kind.js`): the species made a game creature, its limbs
  and rig its own. Absent, the animal as it was.
- **The table game uses it**: a beast among the cast's leaders is a creature unless it says otherwise: its own `ooze`,
  else `LEADER_OOZE` (the mastermind mythical, the lieutenant and the rival dire) with the cast's `ooze` theme over all;
  a starter lends its building's (a crypt skeletal, a tomb zombie, a lab techno); `ooze: null` keeps the animal. Any
  foe may be `beast: { species, ooze? }`, made on the animal door at mint, photographed over its stat block and said in
  it ('a zombie rat'); the Sunken Chapel's grave rat is one (`table-rpg-cast.js`, `table-rpg-portraits.js`).
- **A beast's bust at its head**: framed where its plan seats the head (forward of `neckTop`), not at its highest
  point, which a wing or a horn can be.

Machine gate: the cast and kind suites (an ooze refused off a beast and unknown; carried to the animal door's spec, none
without), the factions suite (the part's fantasy, the theme, null, the starter's; a beast foe's words and its refusals),
the door's (a wolf lieutenant made dire, its row carrying the ooze), and the live suite (a crypt's wolf mastermind
mythical and skeletal, a zombie rat, each photographed). Eyes gate not run: the author looked at the bone wolf and the
zombie rat; the operator has not.

#### Table RPG: arms and artifacts, made by the equipment kernel
- **In the rules**: items of kind `weapon` and `armour` are artifacts with a portable `bonus` (1 to 3; a weapon's
  `faculty` the one it strikes with), taken up with `equip <item> [by <member>]` (the arm replaced goes back to the
  bag), or held from the start (`arms` on a member). A weapon's bonus rides the attack and the harm under every
  resolution procedure; an armour's the defence where the card counts one, else it turns that much of each blow.
- **In the look** (`table-rpg-gear.js`): an item's `build` is the equipment kernel's words, checked by it; `gear: {
  style, foes }` the game's arms language. At mint each item with a build is minted as an equipment item (`artifact:
  <ref>`); a member made a character holds its class's weapon as the kernel makes it (`WEAPON_GEAR`) or the artifact it
  starts with, in the game's style; a person of the cast its role's arms (`ROLE_ARMS`) in the foes' style.
- **The starter** arms its people in its building's style and leaves an artifact with its key (a crypt's barrow blade,
  a keep's warden's shield, a temple's rite staff …). Its foes and items now sit beside the module's, merged by id (a
  character recorded on the starter's boss no longer drops the starter's other foes).
- **The book's Arms and artifacts chapter**: each artifact photographed as an object, its rules, its look in words and
  where it is found; the Sunken Chapel's ossuary hides the bone knife.

Machine gate: the arms suite (artifacts refused that cannot be read; equip, its swap and its words; the weapon's bonus
in the roll under three procedures; the armour on the defence and turning a blow; the builds checked by the equipment
kernel, the class weapon and the starting artifact held, the cast's role arms; the starter's relic with the key, its
style and the merge by id; the chapter), the door's (a member holding a celestial sword, the relic minted as an
equipment item), and the live suite (the armed member and the relic photographed). Eyes gate not run: the author
looked at the armed member and the relic; the operator has not.

#### Table RPG: loot, arms of every kind, and the equipment kernel's hafts and blade heads
- **The equipment kernel** (`equipment/items.js`): the staff takes three blade heads, `spear` (a point, the sword's
  own blade loft in the `blade` word's outline), `axe` (a bearded blade and a poll at the haft's top) and `halberd`
  (the axe's blade low on the head, a point through it, a spike behind), none carrying a stone, and a `reach`: `long`
  (the staff as it was, byte for byte), `arm` (a haft: an axe, a mace, a warhammer, a sceptre) and `wand`. The hero
  holds a staff of the `arm` or `wand` reach as a blade (`polygonizer/hero-gear.js`); a long staff keeps its hold. The
  equipment card names them.
- **Loot** (`table-rpg-loot.js`): a table written as loot words (`n`, `rank`, `era`, `style`, `forms`) is rolled out
  into its rows and its artifacts, arms of every kind the kernel makes (`LOOT_FORMS`), each in a style, its bonus by
  the rank and its look rising with it (ornament, stylize, a glowing stone). A foe's `loot` table is rolled in the
  kernel when it is beaten (once a kind of foe a fight). A starter's boss keeps a hoard and its bandits their spoils
  (a lab's of the future). The mender's mace and the warrior's axe are hafts now (`WEAPON_GEAR`).

Machine gate: the equipment suite (each blade head closed, deterministic, stoneless and seated on its haft; a reach's
length; every existing pin unchanged), the hero gear suite (a haft held as a blade), the arms suite (loot words refused
by name; the rows and artifacts, the same every time, the rank's bonus and look, distinct forms; the era, the forms and
the style; the module's own item winning; a beaten foe's drop, rolled once a kind; a loot table that calls up foes
refused; the starter's hoard and spoils, a lab's of the future; the hoard in the Arms chapter), and the live suite (a
crypt's hoard photographed, a mender holding its mace). Eyes gate not run: the author looked at the new heads, a hoard
and the mender's hold; the operator has not.
