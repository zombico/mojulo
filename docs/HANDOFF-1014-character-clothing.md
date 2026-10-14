# Handoff: 1014 character clothing (branch `1014-character-enhancements`)

Analysis and rationale: `docs/character-clothing-gap.md`. Changelog: the Unreleased section
"Character clothing: the anime silhouette" in `control/CHANGELOG.md` (update it for the second commit's items below).

## Committed and green (first commit, f765f0c..)
Proportional + dense garment rings, ring-only lift, trouser `cut`, waist-returning drape, drape panels
(`language.panels`, `fit: 'panel'`), cards `traveler` / `warden`, `hero.dress.silhouette`, the update law and its pin
(`outfit/outfit-laws.char.test.js`), the hero-flow reach fix, card text. Full critical + e2e ran green then (hero-gesture's
6 pins fail on the base too — not ours).

## In this second commit (work in progress, mostly green)
- **Law 10, the drawn figure** (`outfit/principles.js`, `expand.js` `drawnFit`): on an anime hero a top/trousers with no
  `fit` lie close (knit `skin`, woven `fitted`); trousers cut `straight`/`wide` keep their fall. `trace.fits` in the readout.
  Wired via `humanoid-plan.js` → `dressPlan` `figure.anime` → `expandOutfit` ctx `drawn`.
- **Girth targets** (`body-garment.js` `GIRTH_LANDMARKS`, `landmarkRings`; language `top|bottom|outer.girth: { waist: cm … }`
  validated in `styles.js`): cm of girth over the body WITH its layers at landmarks found on the body's own rings; a
  pinned ring is cinched (its drape lift dropped). Measured: waist +2 → +1.8 cm, hip +4 → +3.5; 0 → ~1.2 cm (the hair gap)
  plus the dense ring's rounding.
- **Slab lift** (replaces the isotropic 6 cm `hullHeight`): each ring clears only what lies in its own slab along the part.
- **Clearance between rings**: a bilinear pass raising the 4 patch corners by the least that clears each beneath point,
  with the chord sag of the bracket's real angular span. Bust poke-through went 12/side → 0.
- **Dense also inserts a ring halfway between stations.**
- `dress-silhouette.js` measures the body by TAPE (convex hull incl. navel/bust/pectoral layers).
- Pins re-pinned: `outfit-laws.char.test.js`, `statue.char.test.js` (headers say why).

## Third pass (merged 1012-consolidate; robes and cloaks)
- Merged `origin/1012-consolidate` (conflicts: the changelog's Unreleased head, `layered.js` imports; both sides kept).
  The outfit-laws and statue pins did not move.
- **Round robes:** `outfit-plan.js` `gownOf` (robe, gown, tunic) emits garment-kernel pieces: a bodice on dense,
  proportional rings and a `fit: 'skirt'` hull; the four-ring loft cone is gone. `flare` is m per m of fall.
- **Cloaks:** new kernel piece `fit: 'cape'` (`body-garment.js` `capePart`): the shoulder-hung panel item 5 below
  asked for, a hull round the trunk, arms and legs with a torso carrier above the waist and `legHull`'s blend below.
  The catalogue's `cloak` uses it (`wrap`, `hem`, `rigidity`). Pinned in `body-garment.test.js` (clears what it
  covers, wraps, root at the nape); creatures' explorer/outlaw cloaks build on every lineage.
- **The male collar poke does not reproduce.** Paired ring-for-ring (same station, same ring12 slot), every torso and
  pelvis point on the male `adventurer` lies under its cloth by ≥ 3.5 mm. The two shoulder-line points (x ±0.154,
  z 1.387) read 4 mm "outside" only when the top's rings are interpolated by their mean height: those rings are not
  planar at the shoulder, and the same points' own cloth points lie 8 mm outside them. What changed in the second
  commit is the stand-off there: 6–9 cm (first commit) to ~8 mm. A paired check on limbs must not match slots by
  name: limb6 and ring12 reuse names at different angles.
- **Arms, hoods, wizard robes:** the cape drapes on the arms (`capePart` blend by nearness to the arm's skin; hero-flow
  keeps a flowing vertex's own arm-chain weight, `DRAPE_BONE`), and hangs as a curtain (no `root`). New kernel piece
  `fit: 'hood'` (`hoodPart`, head volume from `bodyMap` `head`). `sleeve` on robes, kind `wizardRobe`. Pinned in
  `body-garment.test.js`, `hero-flow.test.js` (a cloak in a jog: joints out of the arms; sleeves showing < 2.5 %) and
  `outfit-plan.test.js`.
- Changelog and the `layered` card cover law 10, girth, the slab lift and clearance pass, the tape, mid rings, robes
  and cloaks.

## Open items, in order
1. **Failing:** `outfit.test.js` "the top drapes from what holds it out" — the shirt comes in 1.5 mm faster than its drape
   under the bust (0.0992 vs 0.1007). Likely the mid rings + per-ring proportional ease (the test assumes one ease);
   fix the test's expectation to use per-ring ease, or apply the drape constraint in `easeOf` terms. Do not loosen blindly.
2. Eyes gate on the cloak in motion (a curtain, draping on the arms); nobody has watched a jog or a turn yet. An arm
   swinging back still enters cloth behind it (machine: 1.7 % of sleeve points a frame on the male): that is collision,
   which the flow rig does only at string joints.
3. A designed robe over an outfit card that has its own belt buries that belt (`warnings`); the robe's sash sits over it.
4. Not started: cuff panels, shading channels. Eyes gate never run: anime casual / adventurer / traveler / warden.
5. Hoods over flowing hair: the hair's strands are not kept inside the hood; long hair may push through it in motion.
   Wizard sleeves are a symmetric bell (a trumpet), not a hanging droop.
