### An RPG made one level at a time: what its vertical slice needed

- **The core loop reads the battles.** A world that fights in battles (written, or a `jrpg` or `tactics` world's, laid
  at the run) read its loop as a platformer's: move and jump to the level's exit, the next level its reward. Its
  encounter is now the battle (a pack met on the trail, a boss at the end; a tactics battle on a board), its reward the
  battle's spoils (experience, gold and gear for the party), and its moment gains `fight`. Every remit carries the loop.
- **A beat's crew brings the battles.** A beat asked for with `crew: true` in a world that fights in battles brings the
  battles chapter beside its level, as it brings the foes a beat fields: a jrpg's level is fought with its packs and boss.
- **A critic reads the crew's work whole.** A critic's seat (`as`) on a crew's req was held to the req's own unit, so a
  critic of a level never saw the battles its crew wrote beside it. Its view may now be any unit of the req, as the
  assistant director's is; an author's stays its own.
- **The play probe loads a page from a file.** It pushed each stage's whole page through one DevTools message, and a
  party RPG's stage (its figure bank inlined: the hero and three party members, past 100 MB) closed the target before
  it loaded: the stage was said not to load. It writes the page to a temporary file and opens it.
- **A party's figures weigh a sixth of what they did on a level's page.** A party RPG's stage inlined four layered
  figures and its foes at 73 MB (90 to 124 MB a page). The page's bank now leaves out what the page never reads (a
  layered figure's skin joints and weights, kept for the engine exports, which read the figure's own row), packs a layered
  part as unit rigs' are (shared corners, positions on a uint16 grid, `packRigMesh`), writes its clips' frames on 16 bits
  (decoded once to a Float32Array), and names a figure byte-identical to an earlier one again instead of writing it
  twice: 11 MB, pages of 33 to 37 MB. A bank with none of these is emitted byte for byte as before.
- **A brief names the patch's ops.** An author's submit shape said `op` without its words; both authors of the slice's
  first round sent `replace` and were refused. It says `set | add | remove`.
- **A refused report writes nothing.** An author's patch was applied before the world was read, so one the door then
  refused (a level node given an `hour`) was stored and its job marked kept: the job could not report again, and the
  world read refused until the patch was undone by hand. The patch is now read first, every level's walk with it
  (`gameworldGraph`), and a refused one leaves the recipe and the job as they were, the job issued to report again.
- **A rework names the authors it sends back.** `req: { id, direct: 'rework', jobs: ['j2'] }` sends back only those
  authors, the rest of the crew's work kept as it stands (every author without it); the critics and the assistant read
  again only once an author has gone back. A req's `reissues` budget counts its authors sent back: a critic or the
  assistant reissued to read the work again had spent it, so one rework round left none.
- **The battles card says what a foe's row does.** A row in `battles.foes` replaces its preset whole, its skills and
  drops with it unless named again: the slice's battles author wrote a shaman's stats alone and lost its `mend`, the
  skill its boss taught by. (The battles card's ceiling is 5120.)
- **A packed page carries its plain groups packed too.** A page laid with `pack: true` (an isekai level, a stage) packed
  only its textured groups; its plain ones (the ground chips, the rocks, the land's core) rode as float32 positions and
  float32 colours, 18 MB of a party RPG's stage. Their positions now ride a uint16 grid over each group's own bounds and
  their colours sRGB bytes (`packGroupArrays`, packTex's colours), decoded by the page to the same Float32Arrays, the
  same triangles in the same order: 8.8 MB, a stage's page without its figures about 15 MB. A page laid without `pack`
  is as before.
- **No NUL byte in a page.** The event bus joined a saga's id and scope with a raw NUL byte written into its source, so
  every page carrying the bus held one, and an artifact host refused the page. It is written `'\x00'`, the same string
  at run time.
- **A beaten pack leaves the map.** A won fight's foes were felled where they stood (`kill`: they lie down, held), so a
  pack the party had beaten still stood on the trail, fallen, as one to fight. They leave in a puff of smoke (`vanish`,
  `with: 'smoke'`).
- **A party that fights but does not walk the map** (`battles.followers: false`). A party RPG stood every member of its
  casting's party on the map behind the hero, each a rigged figure as heavy as the hero's; with `followers: false` the
  hero walks alone, as a classic party RPG's leader does, and the party still fights beside it (the battles' party is the
  cast who join, as before). A member who joins on a story flag still stands where the story puts it. The default is
  unchanged.
- **A party joins one a chapter.** A party RPG's rolled party (its casting page) stood with the hero from the first
  level; by default now, when its book gives none of it a `joins` flag, the first member joins as the first chapter (an
  act of the main quest, at its first level played) starts, the second as the second does, and so on: one a level where
  the world has no main quest (`casting.js` laidJoins: each its flag `join-<id>`, carried on; said as a toast). A member
  past the game's chapters waits for its flag; a book that writes its own `joins` keeps them. With
  `battles.followers: false` a member who has joined fights and does not walk the map.- **A fight on its own stage** (`battles.rules.stage: 'backdrop'`; `'live'`, the default, as before). A party battle was
  staged on the map where it was met, a camera fitted round the fighters wherever the ground let it stand. On the
  backdrop stage the fighters are moved to an arena of their own, seen from the side with the party on the left, before
  the map drawn once from that view where they met (`__mojCtrl.backdrop`, the controllable channel's, emitted only for a
  page whose fights ask for it), and put back where they stood when it ends: a party RPG's battle background, the way
  the genre has drawn them. The encounter, its transition in and its scene out stay the same on either stage, so an
  action game keeps its fights live on the same map.
