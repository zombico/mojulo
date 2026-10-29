# Garment principles: what makes a dressed silhouette read

The principles a garment is chosen and checked by, on the realistic body and on the authored game body alike (the hero's
readout carries the read for both; the game body's bare outline is its own, a broader shoulder, so its family is read
against that and the bands that are ratios of the body hold as they are), each as a MEASURE of the dressed figure with
a starting BAND in two styles: WESTERN (fashion design and tailoring) and ANIME/GAME (character costume for games and
animation), the canon's word as `hero-style-critic.js` has it (not the hero's `register`, which is how far it heightens). The bands live as data beside the read that applies them, `control/lib/graph/polygonizer/dress-outline.js`;
this note is why they are what they are. The wearable libraries (footwear, handwear, plating) have no canon of their
own: each reads in the outfit's, by these principles (a boot, a gauntlet's cuff, a pauldron among the flair pieces, the
feet in the value gradient), as each library's last law says.

Gate: machine only. Every band is a starting point read off the sources below, to be tuned at the eyes gate (the
operator's), as the canon bands of `hero-style-critic.js` are. The read advises; it never refuses
([bicycles.md](bicycles.md)).

Source tags, as in [character-clothing-gap.md](character-clothing-gap.md): **[spec]** the primary read in full;
**[snippet]** seen only in search results; **[practice]** a taught convention with no primary found. The research box
could not reach any outside host, so nothing here is [spec] yet. Read the primaries (FFIT, Thompson & Mikellidou 2011,
the TF2 slides first) before leaning on a band.

## How to read a figure

Measured on the dressed figure at rest, against the bare figure under it, both from the compiled mesh:

- `S` stature; `W·` a dressed front-outline width, `B·` the bare one, at the landmarks: `sh` shoulder (deltoid to
  deltoid, sleeves and pads included), `ch` chest, `wa` waist, `hp` hip, `cr` crotch, `mt` mid-thigh, `kn` knee, `cf`
  the calf's widest, `an` ankle, `hem` the outermost garment's lowest edge;
- `e· = W·/B· − 1`, the ease share: the cloth's width gain over the body there;
- `f(z) = (S − z)/S`, a height as a share of the stature down from the crown;
- a DIVISION: a height where a garment ends, a belt sits, or the value steps by `ΔL* ≥ 20` (CIELAB lightness);
- `Aup`, `Adn`: the dressed outline's area above and below the waist.

A family is read twice: by its absolute ratios, and as a SHIFT from the bare body's (a bare western male is already a
V; what the clothes did is the difference).

## The principles

**Silhouette families.** An outfit is named by its outline's shoulder : waist : hip : hem. Starting rules on the dressed
widths [snippet: Dior's H, A and Y lines, the V&A and the Met; the cut-offs derived from FFIT and the suit drop, not
from any fashion text]:

| family | rule (the research's) | as read on the realistic body | note |
|---|---|---|---|
| X, hourglass | `Wwa/Wsh ≤ 0.80`, `Wwa/Whp ≤ 0.80`, `0.9 ≤ Whp/Wsh ≤ 1.1` | the same, `Whp/Wsh ≥ 0.8` | anime ≤ 0.70 |
| H, rectangle | `Wwa/max(Wsh, Whp) ≥ 0.85`, `Whp/Wsh` and `Whem/Wsh` in 0.9–1.1 | `Whp/Wsh ≥ 0.75`, `Whem/Wsh` in 0.75–1.1 | the waist unmarked |
| I, column | H with every `e ≤ 0.10`, `Whem/Wsh ≤ 0.9`, the hem at or below the knee | not read yet | long, narrow |
| A | `Whem/Wsh ≥ 1.2`, widening from the waist down | `Whem/Whp ≥ 1.15`, `Whem/Wsh ≥ 0.9` | |
| trapeze | A with no waist marked, `Whem/Wsh ≥ 1.4` | A, the waist unmarked, `Whem/Wsh ≥ 1.1` | widens from the shoulder |
| V, Y | `Wsh/Whp ≥ 1.2`, the hem no wider than the hip | the same | |
| T | `Wsh/Whp ≥ 1.3`, straight below the chest | the same, `Whp/Wwa` in 0.92–1.08 | |
| O, cocoon | `Wwa ≥ max(Wsh, Whp)`, `Whem/Wwa ≤ 0.9` | the same | the hem returns |

The read measures the shoulder deltoid to deltoid with the arms hanging in the A pose, wider against the hip than a
fashion figure's (a bare athletic man reads 0.79 hip over shoulder, a woman 0.83), so the cut-offs were moved to where
this body's dressed figures fall: a gi and a straight coat read H, a long coat and a gown A, a cinched bodice over a
flared skirt X, the bare man V and the bare woman X.

A deliberate shift is `|Δ| ≥ 0.10` on a ratio; following the body is `|Δ| ≤ 0.05`; between reads as neither
[practice]. FFIT's classes are unreliable at the margins (Parker et al. 2021 [snippet]) and leave out the shoulder, so the
read reports the ratios, never a class name alone.

**Waist suppression.** A tailored garment is cut in at the waist by a set amount: menswear's DROP, chest girth minus
waist girth, 6 inches standard, 7 slim, 8 athletic [snippet: suit makers]; the women's ideal waist 8–10 inches under
bust and hip [snippet: Threads]. `Wwa/Wch` of the outer garment: western male tailored 0.80–0.87, boxy ≥ 0.92; western
female fitted 0.72–0.80; anime male hero 0.70–0.80, anime female 0.62–0.75 [practice, as `STYLE_BANDS`].
`dress-silhouette.js`'s waist read is this one, without the registers.

**Fit class.** Each half (top: chest and waist; bottom: hip, thigh, knee, a skirt's hem) by its mean ease share: skin ≤
0.02, fitted 0.03–0.11 (the published minimum wearing ease: bust 2½–4 in, waist 1–1.5, hip 2–4 [snippet: Threads, NMSU
C-228]), semi 0.11–0.20, loose 0.20–0.35, oversized above [practice].

**A waistband has no ease.** Trousers (and any bottom with a waistband) sit on what they are worn over at the waist: the
skin, or a tail tucked under them, which the band presses flat with it; the cloth takes its own ease back by the hips'
widest. On both bodies, whatever the fit: the fit is the seat's and the leg's, never the waist's (outfit law 2; the game
body's kernel `waistband`, body-garment.js; the realistic tailor's `cinchWaist`). Ease at the waist reads as bulk, and a
belt over it as a ledge.

**One volume, one fitted; or the outline returns.** A loose half reads as a shape over a fitted one. Loose above AND
below still reads as a figure when the cloth comes back to the body at RETURN POINTS (`e ≤ 0.10`): the waist under a
sash or belt, the cuffs, the ankles; without them it is a sack. At least two, one of them the waist; anime/game at least
three [snippet: style writing on mixed volume; the gi and hakama reading is [practice], no martial-arts design source
found]. The martial artist's trousers and the gi are this rule's case.

**Mass above, mass below.** `ρ = (Aup/Adn)dressed / (Aup/Adn)bare`: a deliberate up-shift (the heroic V: shoulders,
collars, big sleeves) `ρ ≥ 1.15`, a down-shift (the grounded A: a skirt, a hakama, a coat skirt) `ρ ≤ 0.87` [practice].

**The dominant division on thirds, never at halves.** The strongest division (the outer layer's hem, the largest value
step) at `f` 0.33–0.42 (high to natural waist) or 0.60–0.70 (a tunic's or coat's hem) western; warn at 0.46–0.56, the
figure cut in half (a hip-length top over the crotch line); anime/game 0.28–0.38, long coats 0.70–0.85 [snippet: style
writing on the rule of thirds and the golden mean; the bands [practice]].

**The leg line.** The leg reads as long as the unbroken run from the ground to the first division above mid-thigh:
western ≥ 0.55 S good, ≤ 0.50 short; anime/game ≥ 0.60 [snippet: NMSU C-312, "the longer your eye can travel upward
without being interrupted by a horizontal line, the taller the figure will appear"]. Read against the hero's own crotch,
never a fashion croquis (9 heads; this body is about 7).

**A hem never lands on a limb's widest.** A hem draws a horizontal; at the calf's widest or the thigh's top it widens
and shortens. Its place on the segment's own profile, `pos = (Bhem − Bmin)/(Bmax − Bmin)`: good ≤ 0.35, warn ≥ 0.80
[snippet: hem-length guides; [practice]]. This conflicts with the outfit laws' "mid calf" length words (capri, midi),
which can land on the calf's widest: resolve them below the calf belly.

**Divisions are few; stripes are not divisions.** Hard divisions below the shoulder: western ≤ 3, warn at 5; anime/game
≤ 4. Repeated horizontal stripes do NOT widen: a horizontally striped figure reads taller and narrower (the Helmholtz
square; Thompson & Mikellidou 2011 measured 7.1 % and 4.5 %, on a dress and a mannequin too [snippet]), so a stripe
texture is not counted. A vertical run (an open front, a placket, a column of one value) of ≥ 0.35 S lengthens.

**One focal, framing the face or the action.** The strongest contrast at `f ≤ 0.40`, no rival within 10 `ΔL*`;
anime/game also lighter at the chest than at the feet (TF2's value gradient, dark feet to a light chest where the
weapon reads [snippet: Mitchell, GDC 2008]; read as `gradient`, the shoe's L* against the chest's front). A belt may be the focal, and is then the only strong division at the waist.

**Values in a few masses, layers a step apart.** A clear step between layers is `ΔL* ≥ 20` (one step of five), a
strong one ≥ 40; value masses over 5 % of the outline, western 2–4, anime/game 3–5 [snippet: notan; the 20 L* mapping
[practice]]. This gives the outfit laws' "one clear value step" its number.

**The shoulder line.** Natural `esh ≤ 0.04`; extended or padded 0.04–0.12; armour, pauldrons, capes ≥ 0.15; a dropped
shoulder read by its slope, not its width [snippet: tailors on soft, roped and natural shoulders].

**Fabric sets standoff, fold size and fold count.** On a stiffness scale `k` (drape coefficient about 30 % limp to 90 %
stiff [snippet: Cusick, via ScienceDirect]): chiffon 0.1 (falls to the body, many small folds); jersey, satin 0.25;
shirting, poplin 0.45; wool suiting, twill 0.6 (holds the cut's planes); denim, gabardine 0.75 (stands off, few large
folds stacking at the ankle); canvas, leather, felt 0.9 (holds its own shape, creases). Stiffer stands further off below
a support, folds bigger and fewer [snippet]. A stiff cloth clinging, or a fluid one standing off unsupported, is
incoherent. Knit sits near 0.25, woven 0.45–0.6.

**Exaggeration lives in a few pieces (anime/game).** One to three FLAIR pieces (`e > 0.25`: an oversized sleeve, a
flared trouser, a coat skirt, a cape, a sash), with ≥ 60 % of the trunk's and limbs' length at `e ≤ 0.10`. The outfit
laws' "drawn figure" (law 10) says this; this is its measure. A shared base still gives distinct silhouettes when each
wearer's flair differs (Jujutsu Kaisen's customised uniforms [snippet]).

**Readable in solid black at thumbnail size (anime/game).** The front and side masks at about 64 px tall: the costume's
share outside the bare mask (western 0.05–0.25, anime/game 0.15–0.45), concentrated in its three largest regions
(≥ 0.7), and distinct from the rest of a cast (1 − IoU ≥ 0.15) [snippet: TF2's distinct class silhouettes; Street
Fighter 6, "the silhouette of the character is very important"; Guilty Gear Strive's designs simplified to be easy to
remember]. The gaps between the arms and the body kept open at rest (≥ 0.6), so the pose reads.

## Dressing the figure

Each rule reads the bare figure and sets a dressed target; advice, western unless marked [practice; the frame from
Threads' self-evaluation worksheet and "sew for your shape", UKY FCS2848, Seamwork, all [snippet]]:

- hips wider than shoulders: add at the shoulder (`esh` 0.04–0.10) or above the waist (`ρ ≥ 1.1`), the bottom darker or
  plainer, A or straight from the hip, never tight below a wide hip;
- broad shoulders: no extension (`esh ≤ 0.02`), volume or value below the waist, a V or crossed neckline to break the
  width; on the anime male, keep the V (it is the canon);
- a short torso: the waist division lowered or hidden (a dropped waist, top and bottom one value, no wide belt);
- short legs: the division raised (`f ≤ 0.38`), bottom and shoes one value, hems at the ankle or the floor;
- heavyset: medium-stiff cloth (`k` 0.45–0.6) standing off a little (`e` 0.05–0.15), never clinging or ballooning, one
  long vertical run, hems at narrow points, no loose-and-loose without return points;
- skinny or lithe: width by structure and layers (`k ≥ 0.45`, `e` 0.1–0.2);
- jacked or athletic: the garment follows the drop (the athletic band), no padding, ease over the upper arm (`e ≥ 0.05`)
  or the sleeve reads as strain.

## The realistic register (seventh-generation costume)

The realistic body is not the game body, and its clothes are not cut the same way [practice: the costume of
seventh-generation console characters, close garments with real wearing ease over a realistic figure]. On the game
body volume reads at a distance and on few polygons; on the realistic body volume reads as puff. So, there:

- the cloth follows the body at a WEARING EASE, not a stand-off: about a sixth of a garment's extra girth each side
  (a shirt's 8–10 cm of girth over the chest, a jacket's 10–13, a coat's 15–20), the order of the layers kept;
- the silhouette comes from the CUT (a waist taken in, a shoulder line), the BELT, the COAT'S SKIRT and the LAYERS, not
  from the ease;
- a trench or a long coat is fitted through the body and an A from the waist: it falls from the hips' widest, never
  back in round the legs, and its sweep is modest (a few centimetres past the hip each side at the knee, more on a long
  coat);
- a sleeve tapers to its cuff and the shoulder is the body's own, unpadded unless the design names a shoulder;
- a suit is read by its FRONT first: the V onto the shirt from the top button to the collar, the lapels lying along it
  (a notch for day, a peak for a double-breasted or a stronger line, a shawl for evening), the buttons at the stance
  (two a little above the waist; one lower, which lengthens the V; three higher, which shortens it), and its jacket
  long enough to cover the seat; then by its SHAPE: a structured shoulder's straight line from the neck to a pad just
  past the shoulder (the business and the evening suit; a natural shoulder for a softer or a woman's jacket), the waist
  suppressed toward an X, or straight from the chest to the hip in a sack cut.

Measured as the dressed outline's standoff per side over the bare body (`dress-outline.js`): close cloth at the chest
within its ease and 1.5 cm, a waist within a few centimetres, a coat's knee well under 10 cm. The game body keeps its
own eases; the compression is the realistic adapter's (`body-relational-wear.js`).

## The kit as pieces, the cloth as it folds (realistic laws 8)

On the realistic body the kit and the cloth are made by these rules, in core, for every hero whatever its outfit
(`control/lib/graph/polygonizer/body-relational-kit.js`, `body-relational-folds.js`; their measures beside them as data:
`KIT`, `POUCH`, `HOLSTER`, `FOLD_CLOTH`). Each holds at the eyes gate first: a thing reads as what it is at a glance,
and keeps reading as the body moves.

- **A piece is the thing it is.** A belt is one mass: one section top to bottom, its edges rounded, a buckle that is a
  frame (bars, a tongue, the tail through it, a keeper). A pouch is a body with rounded corners, a lid flap folded over
  its top, a closure (a tab and its snap) and seams. A strap is a flat strip of webbing. A holster carries its pistol,
  the slide and the grip out of its mouth, a retention strap over the frame. Never a slab with a signature on it.
- **It is fitted over what is under it, and only that.** A belt is cinched over the piece it is on, the trunk's cloth
  inside that, the belts before it and the skin, spanning the hollows (the small of the back) as a belt under tension
  does; a garment wider than it there is worn over it and clears it. Webbing lies on the outermost layer it crosses. A
  pouch's back is pressed flat to whatever stands out most under it. A piece on the trunk lies on the trunk: an arm
  hanging beside it is no surface.
- **Everything is fastened to something.** A strap that runs to a belt ends on it: a ladder lock just over it and a tab
  round it. Straps whose ends meet at the waist (a harness's X) end on a waist strap of the same webbing round the body.
  A pouch hangs from its own belt; a thigh rig hangs from the belt by a strap down the hip; a holster from the harness.
  Nothing hangs open at the sides.
- **One of a thing.** Belts at nearly one height share it, the later cinched over the earlier (a duty belt over the
  trousers' belt). A strap along a path one is already laid on is that strap.
- **Sized as the real thing**, by what it carries: a magazine pouch, a utility pouch, a pistol's holster.
- **Folds as a game draws them, not a simulation's.** A few broad ridges where cloth gathers (crescents inside the
  elbows and behind the knees, stacked rolls over the boots and at the cuffs, a shirt bloused over its belt with
  gathers under it), each standing out from the cloth, never into it; the crease side sharp, the other side soft; the
  size the cloth's weight (a knit small, canvas sharper, a heavy layer broad, leather broadest). They ride the cloth's
  own weights, so a bend closes the crescents it shows and they read in motion. None where a belt cinches the cloth flat,
  none on a piece a garment is worn over (the outer one carries the fold), and only cloth that runs under a belt blouses
  over it.

- **A jacket opens.** An opening is cut, never painted: the jacket's body is a C in section (its inner face round to a
  front edge, the edge turned, its outer face back), so its two fronts are real edges with a real gap between them, and
  what is under it shows through the gap itself. Its collar opens with it. Closed, it closes on a zip in the gap; open,
  the fronts hang apart. Its pieces lie on its own face and stay inside their own front: the pockets clear of the edge
  and short of the side, the collar's points from the edge out over the chest.
- **A knit rib gathers.** A rib waistband or cuff is a band cinched round what is under it, tighter than the cloth it
  finishes, and the body or the sleeve blouses over it.

The game body (the authored and the tiered hero) wears the same kit by the same rules (`polygonizer/authored-kit.js`:
its weights read by ring, its sparse rings read with rings put between them, a belt sampled round at its own density, no
lower than the hips' widest). A pouch on a leg rides the leg and hangs below a pouch above it, never through it. Not yet:
the kneepads on either body, and every piece the kit does not make (a panel, a cape, a hood, a plate) are still the
authored kernel's, laid on the body's envelope; the jacket's construction and the folds are the realistic body's alone
so far, and the folds are geometry only (no fold normal map, no weave).

## Against the outfit laws

The ten laws in `control/lib/graph/outfit/principles.js` hold most of these as words; this note gives them measures.
New, with no law yet: the families and their shift, the division height and count, the leg line, the hem off the
widest, volume balance and return points, the shoulder line, the waist bands by register, the body-type rules, and the
game register's thumbnail, flair and negative-space reads. One conflict: law 3's "mid calf" (see above).

Measured first (the widths the mesh gives): the family and its shift, waist suppression, fit class, the hem off the
widest, the dominant division, return points, the flair budget, the shoulder line. Later: value steps and masses (need
the palette per face), the thumbnail masks, a neckline's depth and diagonal, outline curvature for shape language,
anything in motion.

## Sources

All [snippet]; URLs as found.

- Thompson & Mikellidou, "Applying the Helmholtz illusion to fashion", *i-Perception* 2(1), 2011:
  https://journals.sagepub.com/doi/10.1068/i0405
- Koutsoumpis, Economou & van der Burg, *Perception*, 2021 (stripes and luminance on photographs of a model)
- FFIT (Simmons, Istook & Devarajan 2004; Lee, Istook, Nam & Park 2007), as quoted by body-type calculators; Parker et
  al., *Ergonomics*, 2021 (its reliability): https://e-space.mmu.ac.uk/627583/
- Threads, "Self-Evaluation Worksheet", "Sew for your shape", "Learn about garment ease"; NMSU Guides C-228 and C-312;
  UKY Extension FCS2848; USU Extension, "Elements of Design for Clothing and Textiles"
- Dior's lines: Encyclopedia.com "A-Line Dress"; V&A O1516134 (the Y-line); the Met, "Cristóbal Balenciaga"
- Tailoring: michaelandrews.com, mond.com and alanflusser.com on shoulders; blacklapel.com and angelico.it on the drop
- Drape: ScienceDirect Topics, "Drape Coefficient" (Cusick); Hamdi et al., *Fibres & Textiles*, 2021
- Mitchell, Francke & Eng, "Illustrative Rendering in Team Fortress 2", NPAR 2007; Mitchell, "Stylization with a
  Purpose", GDC 2008
- Street Fighter 6: Game Informer, 2022-11-23; PlayStation Blog on Kimberly, Juri and Cammy
- Guilty Gear Strive: EventHubs, Ishiwatari interview, 2019
- Thomas & Johnston, *The Illusion of Life* (follow-through), via Wikipedia
- Kutt et al., "Art-Directed Costumes at Pixar", SIGGRAPH Asia 2018 course
- Not reached, so nothing is attributed to them: Jenkyn Jones, *Fashion Design*; Joseph-Armstrong, *Patternmaking for
  Fashion Design*; Davis, *Visual Design in Dress*; Bancroft, *Creating Characters with Personality*
