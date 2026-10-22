---
name: body-study
description: Render the HERO's body (the layered character create_character mints) as an engine gets it — the skinned cage, shaded smooth — from the front, the front ¾, the lateral, the back and below, posed (the bind, a gait at a phase, a stand gesture, a raw rig pose) as rows, cropped to a joint, with a sections panel (the trunk cut level, the limbs square to the bone, each girth as a tape reads it) and a measures table. The realistic register's body lane: use before and after changing the hero's shell, its bind or its skinning, beside the stretch audit (`control/scripts/hero-stretch.mjs`), which measures what this shows. Invoke as `/body-study [male] [female] [--acts '[…]'] [--crop <joint>] [--register <word>] [--laws <n>] [--form <build>] [--physique <word|json>] [--vitruvian]`.
---

# body-study

The hero's body is what the outfit, armour, stylism and equipment loops dress, and what an engine plays. This is its
**eyes gate**: the cage itself, skinned by its rig, so a joint's pinch or a seam opening shows where the stretch audit
says it is. Run it, then Read the sheet.

## Use it

```bash
node .claude/skills/body-study/body.mjs [male] [female] [--out /tmp/body-study]
```

Without `--acts`: each cast at the bind, from the front, the front ¾, the lateral, the back and below. Any figure cast
word works in place of `male` / `female` (heroic, brute, lithe, stout, child, chibi).

**Rows** (`--acts`): one row per entry per cast, at the front, the front ¾, the lateral and the back.

```bash
node .claude/skills/body-study/body.mjs female \
     --acts '[{}, {"gait":"sprint","phase":0.25}, {"gesture":"guard"}, {"gait":"sprint","phase":0.25,"crop":"knee"}]'
```

- `{}` the bind;
- `{ "gait": "walk" | "jog" | "sprint", "phase": 0 … 1 }` a studied gait at a phase of its cycle (the hero's own, as
  the door stamps it);
- `{ "gesture": "relaxed" | "guard" | "hand-on-hip" … }` a stand as the door mints it on that cast;
- `{ "pose": { … } }` a rig pose as `rigNodesAt` takes it (`{ "elbowR": 110 }`, `{ "support": "L", "kneeR": 90 }`).

Any entry may carry its own `"crop"`.

**Crops** (`--crop`, or per row): `torso`, `shoulder`, `hip`, `knee`, `shin` (over the knee to the floor: a tall boot
whole), `hand`, `foot` (the right side's), `neck` (the
seam where the head sits). Framed on the POSED joints, so a crop follows its joint through a gait.

**Laws** (`--laws <n>`): mint the hero under an earlier version of the hero laws (hero-form.js `HERO_LAWS_VERSION`;
default the current), so a change a laws bump carries can be seen against the hero as rows minted before it read
(`--laws 1`: the shoulder line before laws 2).

**The form field** (`--form norrin | shalla`): the realistic register's vertical slice. The torso, the neck and the
arms re-sampled onto a build of the body's form field (`body-relational.js` `BODY_BUILDS`: bone where it shows and the
muscle masses placed from the hero's rest joints, summed into one skin), denser than authored; bald, in a matte
silver-grey, wearing the RELATIONAL head (head-relational.js, the head-study field lane's) fitted to the hero's head and
carried by its head bone. A build may carry a tune of the hero's own (norrin's shoulders 0.9). A dev path: no minted
hero changes. The pelvis, the legs and the feet are on the field too.

**The physique** (`--physique athletic | skinny | heavyset | jacked`, or its dials as JSON, `'{"from":"jacked","height":0}'`,
each of `bulk`, `tone`, `weight`, `height` −1 to 1; with `--form`): the build under `body-relational.js` `physique`,
athletic the build itself. The hero is minted with the physique's tune (its stature, its shoulders).

**The Vitruvian rows** (`--vitruvian`, or a row's `{ "vitruvian": "square" | "circle" }`): the front alone, large, in
Leonardo's two figures, to tune the ratios against. The SQUARE: the arms level, the feet together, the square of the
stature drawn round the figure and its centre dashed; the margin reads the stature, the span (span / stature, Leonardo's
1) and the crotch against the square's centre. The CIRCLE as Leonardo's note sets it, on the figure's own joints: the
legs opened to an equilateral triangle between them (each 30° off the plumb, the figure lowered by the leg's
(1 − cos 30°), his 1/14 of the height), the arms raised till the middle fingertips are level with the head's top; the
circle centred on the navel, its radius the standing navel's height (his circle meets the square's base under the
standing figure, and the spread feet stand on it); the margin reads the drop against his 1/14, the navel's height of the
stature (his about 0.6) and how far the hands and the feet reach of the radius (on his figure, both touch it). On the
form field the navel and the crotch are the slice's own (`formSlice` `landmarks`), else the rig's navel joint.

**The skeleton** (`--bones`): the spine, and each side's collarbone (blue), shoulder blade (red, where the rig has
one), humerus (green) and forearm (amber), drawn over the shell at the posed joints (x-ray), so a skin that has left its
bone shows.

**Which shell shows** (`--tint`): each part in its own colour, so a handover between two shells (the torso and the
pelvis, the pelvis and the thigh, the arm and the shoulder) shows who is on top along it. `--parts '<regex>'` keeps
only the parts it names (`--parts '^pelvis$'`), to see one shell whole.

**The dress** (`--dress`): armour (`adorn.*`) in steel grey, garments (a field garment, or a segment piece `<id>_<body part>`) in cloth blue over
the clay body, so how close a shirt lies and which grooves it spans read at a glance. Footwear and plating in their own colours: the
shoes (`Shoes`), each footwear group (the sole, the overlays, the laces …) and a suit's (its plates, trim, undersuit,
reactor) by the recipe's palette.

**The dressed outline** (`--outline`): under each cast's sections, the front outline scanned every 5 mm, the bare body grey
and the dressed figure blue, the landmarks ticked and each division a red line, and the read beside it
(`polygonizer/dress-outline.js`, [docs/garment-principles.md](../../../docs/garment-principles.md)): the silhouette family
against the bare body's, each half's fit, where loose cloth returns to the body, the flair pieces, and the advice in the
western and the anime style.

**The sections panel and the measures table** come at the bind, per cast:

- the trunk cut level at the neck, the chest (six tenths of the way from the navel to the shoulder joints), the waist
  (the navel) and the seat (the hip joints);
- the right thigh (a fifth down the femur), knee, calf (three tenths down the shank), upper arm (mid) and forearm (a
  quarter down), each cut square to its bone;
- each outline drawn at one scale, the dashed loop its convex hull (what a tape measure reads), its girth below;
- stature, heads tall, the head's height (vertex to menton), the biacromial (the shoulder joints' span) and the
  shoulders' and hips' silhouette breadths.

`report.json` carries the table. The register's targets join it when the register has relations (the realistic
register's phase 3a); until then the table is the baseline.

## Read it with the stretch audit

`node control/scripts/hero-stretch.mjs --cast <cast>` names the worst ring, band and seam and the frame it happens
at (`sprint 3/12` is the sprint at phase 0.25). Render that frame here with the joint's crop to see it: the knee's
seam opening at the sprint, the elbow's at a hand-on-hip.
