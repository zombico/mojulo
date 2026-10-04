# Sand on wave-field terrain

Isolated follow-up on `1003-particle-vacuum`. This couples an inexpensive granular layer to Mojulo's actual waveform geometry. It does not register production channels, kinds, MCP tools, or level contracts.

## Boundary between primitive and simulation

`terrain.mjs` calls `sampleWaveField` from the existing polygonizer over a 12×12 m quad, with explicit z-up displacement. Two component waves produce hills and troughs. It samples phase-zero and phase-quadrature bases; the browser reconstructs amplitude and phase from those bases. The verifier compares reconstruction against direct primitive samples at another amplitude/phase within 1e-12.

`kernel.mjs` owns integer mass counts on the 33×33 sample grid. A sample's top elevation is ground height plus count × grainHeight. Neighboring columns exchange mass when the combined top slope exceeds a prescribed repose threshold plus one height quantum. The receiver is chosen by steepest available drop. Both changed columns and their immediate neighbors wake; stable cells sleep.

Thus the waveform actually changes behavior. Flattening or changing phase redistributes the same sand mass. This is a composition of Mojulo waveform terrain and an ordinary local mass-relaxation method; the relaxation rule is not claimed as novel and does not arise from wave-manji.

## What 3D means here

Geometry uses x/y location and z height in world space. Orbit rendering projects the resulting 3D top surface. Simulation is a 2.5D thickness layer, not a volume of independently colliding 3D grains. It gives cheap heaps, trough accumulation, and terrain-driven redistribution. It cannot represent overhangs, caves, falling streams through open space, grain rotations, compaction, or inertial response to shaking. Phase animation changes supporting terrain quasi-statically and carries its sand columns with it.

Constant footprint and density make integer count conservation equivalent to volume conservation up to a constant cell-area factor. “Mass units” are discretized bulk amounts, not persistent particle identities. The four-neighbor repose check is grid-oriented rather than isotropic; rendered quads interpolate sample heights and can visually cover a cell whose corner has only a little sand.

## Cost and verification

The solver stores terrain and counts in typed arrays and operates on the active frontier, sorting it for deterministic order. A settled layer checks zero cells containing sand. A terrain change wakes all occupied columns because the support geometry changed globally. Long-running moving terrain therefore costs more than a frozen waveform.

Nine semantic checks pass: actual primitive reconstruction, mass conservation, sleeping behavior, height composition, repose equilibrium, different distribution on flat vs wavy ground, phase-change redistribution, deterministic replay, invalid terrain rejection. An illustrative 33×33 / 5,400-mass-unit sheet settled in 13 ticks in under 1 ms total in the recorded Node run; this small case excludes rendering and is not a general performance guarantee. See the delivered verification JSON for measured values.

The agent inspected a static generated 3D snapshot. Interactive browser controls and operator eyes acceptance remain unverified; automated local-file opening was previously blocked by browser security policy and was not retried or bypassed.

## Run from control/

```sh
node scripts/spikes/wave-sand/verify.mjs
node scripts/spikes/wave-sand/preview.mjs /absolute/output/wave-sand-3d.html
node scripts/spikes/wave-sand/snapshot.mjs /absolute/output/wave-sand-3d.svg
```

Drag to orbit. Set amplitude to zero, then increase it; change phase and observe sand move. Compare Ground only with Ground + sand. Pour adds bulk at the movable marker; Add sand sheet adds a uniform central patch. Animate ground changes the phase continuously. Pause stops relaxation and animation but allows authored terrain edits and deposits.

## Integration decision

This is a good low-cost boundary if levels need sand on a single-valued ground surface. A future opt-in layer could reference a wave-field/height-field and declare depth, repose and mass sources. Use the existing event bus for deposits and terrain changes. Preserve production compatibility and absent-channel output. Add a separate bounded airborne particle pool only if streams or falling grains are needed; choose volumetric occupancy only if holes and overhangs are required. The present spike has no exporter support and no production integration.
