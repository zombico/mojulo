### The industrial and waterfront materials: rust, sheet piling, decking, membranes, and finishes by family

- **New cuts in the dressed tiles** (`matte-paint/dressed.js`, made class):
  - `sheetpile`: steel sheet piling, deep trapezoid pans interlocked at their clutches, a heavy coat chalked by the
    weather, rust run down through it at grit;
  - `decking` (a floor): timber boards, gapped, a butt joint each, a screw pair at every joist, the grain along them,
    gone silver at grit;
  - `membrane` (a floor): a flat roof's pale sheets welded at their laps, rings where ponds dried at grit.

  Corrugated sheet takes an opt-in `rust` (0 to 1): its coat failing, rust run down from the lap's fasteners and bloomed
  through it, heaviest in the troughs. Absent, not one byte of an existing sheet changes. The tile-spec rails, the form
  render's roughness and the matter each new cut breaks as (`rupa/look-matter.js`) carry them.
- **New material words** (`era/arch-style.js`), each with its matter:
  - walls: corrugated sheet in red oxide (a little rust at its laps), works green, cream, works blue and let go to rust
    (`corrugated-red`, `-green`, `-cream`, `-blue`, `-rusted`); cladding in grey and logistics blue (`cladding-grey`,
    `cladding-blue`); `tilt-up` concrete; `factory-brick` (an old works' darker, sooted brick); `sheet-pile`;
  - roofs: `membrane`;
  - grounds: `granite` pavers, `hardstanding` (a yard's big saw-cut slabs, oil-stained), `ballast` (a switchyard's
    crushed stone), `decking`, `armour-stone`.
- **Finishes by family** (`geocity/industry.js` `INDUSTRY_FINISHES`, `finishOf`). Each industrial building draws its
  wall's word and its roof's from its family by its block's dice, so no two neighbours need match:
  - a works: sheet in one of its paints, rusted, or brick, under standing seam;
  - a warehouse: cladding or tilt-up under a membrane;
  - a control house: block or brick;
  - a shed (a yard's, storage's, a pier's): sheet in its paints or rusted.

  Each variant is its own group, `geocity:<family>-<variant>`, with its finish.
- **The grounds re-laid.** A works' yard is hardstanding, a switchyard ballast, a warehouse's roof a membrane. On the
  waterfront the quays are granite, the decks and the park and step promenades timber decking, the revetments armour
  stone, and a marina's and a pier's quay wall steel sheet piling.
