# Sleeping sand: lightweight granular spike

A follow-up on branch `1003-particle-vacuum`, isolated from production levels and exporters. This establishes a workable low-cost sand approximation; it does not establish a physical wave theory of sand.

## Behavior and representation

A bounded 2D grid stores air, sand, and terrain in a Uint8Array. Each grain carries a little integer state that moves with it (fall speed, a sub-cell remainder, slide energy, slide direction), all in fixed point at 1/256 cell, so a replay is exact on any host. The rules are written out in the kernel, with no physics library:

- **Gravity.** An unsupported grain accelerates by `gravity` cells/tick² to a `terminal` speed. Multi-cell falls march cell by cell, so a fast grain stops on the first support instead of skipping it. A grain falling behind a slower one queues at its speed, so a released column peels apart into a thinning stream instead of dropping as a block.
- **Inelastic impact.** On landing, a grain keeps `restitution` of its fall energy (h = v²/2g) as slide energy. Sand impacts lose most of it.
- **Sliding (Coulomb) friction as work–energy.** A sliding grain gains one cell of energy per cell dropped and pays μ per cell travelled horizontally. Friction work on any incline is μ·m·g·Δx, so a flow speeds up on slopes steeper than atan(μ) and stops on shallower ones. The heap angle comes from μ, not from the grid's 45° diagonal.
- **Static friction.** Before a grain sleeps, it walks the clear row ahead up to 8 cells and gives way if the surface falls away more steeply than μs. A long baseline matters: a grid slope between ½ and 1 is a mix of 1- and 2-cell steps, and a one-cell probe flattens every heap to ½. Having two angles (μs to start sliding, μ to stop) gives hysteresis. A heap built near its static angle avalanches when friction drops, and the avalanche travels uphill as each yielding grain wakes the ones above it.
- **Sleep and wake.** A grain with no move and no energy leaves the active set. When a cell empties, it wakes every grain whose rule reads that cell: the 3×3 around it, plus grains with an open side in the static probe's footprint. Filling a cell only adds support, so arrivals wake the 3×3. This keeps sleep sound, and the verifier checks it: waking every grain on a settled heap moves nothing.

Seeded mulberry32 breaks left/right ties, and row traversal alternates direction to avoid a consistent bias. Terrain corners block diagonal tunnelling. The optional depiction reuses Mojulo's wave-manji mandala printer as a cached glyph stamp. Both depictions use identical sand behavior.

The grid defines grain diameter and empty space. Cells are mass occupancy plus the moving grain's state, not persistent identities. There is no all-pairs collision calculation or per-grain waveform evaluation during playback.

## Cost

For A pending cells, a tick sorts integer keys in O(A log A) and does bounded local work per grain: a fall march of at most `terminal` cells, a static probe of at most 8 + ⌊8μs⌋ reads, and a wake scan of 17 × (⌊8μs⌋ + 1) cells when a cell empties. Settled frames return before sorting and check zero grains. Storage is width × height × 18 bytes, plus the queue. Dimensions are bounded to 512 per axis.

The recorded host benchmark is in `verify.mjs` output: a 240×160 grid with 3,840 grains, filling, holding, discharging and settling over 1,600 ticks. On repeated standalone runs it took about 0.23 ms per tick averaged over active and idle ticks, against about 0.13 ms for the one-cell-per-tick kernel. Discharge also takes longer in ticks, because grains leave the opening from rest, as in an hourglass. This is Node simulation only, excludes drawing, and is not a browser or mobile performance guarantee.

## Run from control/

```sh
node scripts/spikes/sand/verify.mjs
node scripts/spikes/sand/preview.mjs /absolute/output/sleeping-sand.html
node scripts/spikes/sand/snapshot.mjs /absolute/output/sand-before-after.svg
```

In the preview: open the hopper gate, add sand with a pointer brush, dig away support, or build terrain. Sliding μ and static μs change live, and lowering them under a settled heap starts an avalanche. Continuous pour adds sand until cells fill. Pausing stops simulation but permits edits. Reset restores the hopper with the current friction. Closing a gate occupied by grains leaves those grains intact and closes available gate cells; click again after the remaining opening clears.

A fixed 60 Hz simulation tick with a bounded catch-up loop separates rules from rendering. Speed increases the requested simulation tick rate. Long stalls slow simulated time rather than running an unbounded backlog.

## Verification

Machine checks pass: mass conservation, zero settled grain checks, local support wake, terrain placement preserving grains, explicit erasure accounting, pile spreading, hopper hold and release, identical seeded replay, dimension validation, terrain corner blocking. The physics checks also pass:
- Free fall tracks ½gt² to terminal speed and never jumps further than terminal speed in a tick.
- Poured heaps sit between atan(μ) − 4° and atan(μs) + 1° and steepen monotonically with friction. Measured: 21.5°, 29.1°, 36.2° for μ 0.4, 0.58, 0.75.
- Lowering friction slumps a 36° heap to about 25°, inside the new band.
- Waking every grain on the slumped heap moves nothing (sleep is sound).
- Digging the flank moves some grains, never the whole pile.

The snapshot regenerates byte-identically. The agent inspected the static snapshot and ran the preview script under a stubbed DOM; interactive browser controls and the human eyes gate remain unverified.

## Limits and next step

This is a 2D cross-section. Grains do not exchange momentum with each other, so an impact does not splash bed grains. There is no cohesion or moisture, compression, or rotation. Friction is one pair of numbers for sand on sand and sand on terrain alike, so hopper wall friction cannot differ from internal friction. Slopes are quantised by the 8-cell probe baseline, and a heap that is only a few grains tall reads its angle noisily. Explicit digging changes grain count; closed-boundary motion does not.

For a level, the cheapest generalization is still a 2.5D height grid for settled bulk, with a small active grain pool for pouring and disturbed surfaces. The same μ/μs pair should govern both: the bulk relaxes to atan(μs) and avalanches down to atan(μ), and grains ejected from the bulk run this kernel and deposit back into it. Render the bulk as a surface or vector contour and use wave-manji glyphs only where grains are visible. A height grid sacrifices caves and overhangs; use sparse 3D occupancy only if those behaviors matter. Decide required interactions and visual scale before integrating any channel into production.
