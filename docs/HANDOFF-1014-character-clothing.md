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

## Open items, in order
1. **Failing:** `outfit.test.js` "the top drapes from what holds it out" — the shirt comes in 1.5 mm faster than its drape
   under the bust (0.0992 vs 0.1007). Likely the mid rings + per-ring proportional ease (the test assumes one ease);
   fix the test's expectation to use per-ring ease, or apply the drape constraint in `easeOf` terms. Do not loosen blindly.
2. **Male collar poke:** on the male `adventurer` 2 torso points at the shoulder line (x ±0.154, z 1.387, between
   `st3_st4_50` and the next ring) sit ~75 mm outside the top; the original base had 0. Probably the slab lift no longer
   reaching the deltoid/shoulder layer from the neighbouring ring — check `overs` there (the shoulder yoke) and whether the
   clearance pass sees those points (they are torso's OWN points, not `beneath`: the pass only clears `beneath`; consider
   adding the source part's own points beyond its ring, or keep the old isotropic lift at the collar rings).
3. Run before merge: `npm run test:critical`, `npm run test:deep:changed`, `npm run test:e2e`, the polygonizer/outfit/
   egocube/gameworld folders. Run them serially (in parallel the MCP suites time out at 30 s).
4. Changelog: add law 10, girth targets, slab lift + clearance, tape measure, mid rings to the Unreleased section.
   Card: add `girth` to the `layered` card's OUTFIT BUILD language line (`solid-vocab/layered.md`).
5. Not started: shoulder-hung panels (capes: `legHull` already takes any parts; needs a torso carrier in `blendAt` above
   the waist), cuff panels, shading channels. Eyes gate never run: look at anime casual / adventurer / traveler / warden.

Measurement spikes used (recreate under `control/lib/graph/polygonizer/zz-*.spike.gen.test.js`, run with
`npx vitest run -c vitest.spike.config.js <file> --silent=false --reporter=verbose`): girths per landmark via
`dressSilhouette({ parts })`; poke-through by interpolating the top's rings at each bust/torso point's z and a 2D
point-in-polygon test.
