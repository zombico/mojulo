# Fabricator provenance: the review packet

This is what a reviewer needs to judge how `fabricate_solid` treats other people's products and names. It describes the
rules as the code enforces them, lists every row that names someone else's product or system, and ends with the
questions mojulo has not had answered. **No lawyer has reviewed this yet.** Nothing here is legal advice, and the rules
are mojulo's own reading, written to be conservative.

The rules live in [provenance.js](../control/lib/graph/fabricator/provenance.js), and the rows in
[inventory.js](../control/lib/graph/fabricator/inventory.js). [fabricator.test.js](../control/lib/graph/fabricator/fabricator.test.js)
enforces them: a row that breaks a rule fails the test suite.

## The tiers

Every inventory row has one tier, and the tier decides which routes a plan may take with that part:

| Tier | Buy it | Fit its interface into your part | Print the part itself |
| --- | --- | --- | --- |
| `standard`: a published standard (ISO, DIN, IEC, NEMA, VESA), cited by number, its text never copied | yes | yes | yes |
| `commodity`: a generic part sold under a generic name by many makers and owned by none | yes | yes | yes |
| `open`: an openly licensed system, built to with its licence and attribution kept | yes | yes | yes |
| `own`: mojulo's own parametric design | no (not sold) | yes | yes |
| `reference`: one owner's product or system | yes | only when the owner publishes the interface drawing | never |

What the code holds to:

- **Names:** a reference row's owner's name appears only in that row's `label`, `owner` and `notice`, to say what a
  bought part fits (nominative use). A test fails when any other row's `label` or `buy` text carries a listed mark.
- **Notices:** every plan that uses a reference row carries its notice, and the bill-of-materials export prints it.
  An open row's licence line travels the same way.
- **Refusals:** a strategy that would print a reference part is refused, and the refusal is reported. The plan moves
  on to buying an adapter, or to a from-scratch design.
- **Buy text:** it is the generic search term, never a brand: "three-prong action camera mount adapter", not a
  maker's product name.

## Rows that name someone else's product

The test at the bottom of this file keeps this table in step with the inventory: every `reference` and `open` row
must appear here by id.

| Row id | Tier | Owner | Allowed | What is done |
| --- | --- | --- | --- | --- |
| `board-raspberry-pi` | reference | Raspberry Pi Ltd | buy, fit (published drawing) | Standoffs at the board's published hole pattern; the board is bought. |
| `board-arduino` | reference | Arduino | buy, fit (published drawing) | Standoffs at the board's published hole pattern; the board is bought. |
| `action-cam-mount` | reference | GoPro, Inc. | buy | A bought three-prong adapter; the mount is never printed (the print strategy exists only to be refused). |
| `brick-studs` | reference | the LEGO Group | buy | A bought plate, bonded or screwed on; studs are not reproduced. |
| `skadis-pegboard` | reference | Inter IKEA Systems B.V. | buy | A bought accessory; the slot geometry is not vendored. Chosen only when the need asks for the `hidden` tag; otherwise generic 1/4 in pegboard. |
| `camera-dovetail` | reference | Arca-Swiss | buy | A bought quick-release plate on a 1/4-20 screw; the dovetail is not reproduced. |
| `gridfinity` | open | Zack Freedman (MIT licence) | buy, fit, print | Bins printed by the library; the MIT attribution is carried in the plan's notices. |

## Identifiers that still carry a trade name

These are code identifiers, not product names shown as ours. They are kept because stored recipes and hardware codes
depend on them byte for byte, and renaming them would break rows already minted. A reviewer should say whether that
is enough.

- `mj_gt2_pulley`: the mechanical library's timing-pulley module. The fabricator labels the part a "2 mm pitch timing
  pulley", carries a notice that "GT2" is a manufacturer's trade name, and the bill of materials names printed parts
  by their generic row. The module's name still appears as the OpenSCAD call.
- `nyloc-M6` and the like: construction-hardware codes for nylon-insert lock nuts (ISO 7040). The label is generic.
- Construction hardware labels that say "Pozidriv" for the drive of chipboard screws. The fabricator's own `buy`
  text says "cross-recess (PZ)".

## Questions for counsel

1. **Hole patterns:** is fitting a board's published hole pattern, with the board named nominatively and its notice
   carried, acceptable for a tool that publishes the resulting design?
2. **Printing profiles:** may a printed part follow a commercial belt profile (a 2 mm pitch timing pulley) when the
   part is labelled generically? Is the module name `mj_gt2_pulley` a problem in itself?
3. **Notice wording:** is the notice wording ("X is a trademark of Y. Named only to identify …") sufficient, and
   must it appear on the exported bill of materials, which it does today?
4. **Gridfinity:** does the MIT licence's attribution requirement reach a bin printed from mojulo's own
   re-implementation of the system's dimensions, and is the attribution line enough?
5. **Owner names:** two rows name their owner as "its owner" (Arduino, Arca-Swiss). Should they name the legal
   entity?
6. **Mark list:** which further marks should the generic-name test check for?
