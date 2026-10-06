---
{
  "id": "foucault-pendulum",
  "name": "Foucault pendulum",
  "family": "science",
  "entry": "create_view",
  "summary": "A Foucault pendulum swinging over a compass floor — the swing plane precesses with latitude (Ω = 15.04°/h × sin lat) while the rosette trail accumulates beneath the bob.",
  "when": "show my student why a Foucault pendulum proves the Earth rotates; the pendulum in the Panthéon; why the swing plane turns at the pole but not the equator; demonstrate Coriolis precession"
}
---

A golden bob hangs from a ceiling anchor on a fine wire, swinging across a
dark compass floor ringed with sand pins. As it swings, the plane of the swing
slowly turns — clockwise seen from above in the northern hemisphere — and the
bob's trail builds the classic star-rosette. The floor ring and pins make the
precession legible: the plane sweeps past pin after pin, exactly as the 1851
Panthéon original knocked its pins down one by one.

The physics is kept honest: the precession rate is Ω = 15.04°/h × sin(latitude)
— the full sidereal rate at the pole, zero at the equator, reversed south of
it. Render time is compressed so a half-turn takes seconds; the readout carries
the true rate and the real days-per-circle figure. The loop is seamless (the
swing completes N + ½ cycles per half-turn of the plane).

Two cameras: a low 3/4 that reads the swing in relief, and a top-down that
reveals the rosette. Orbit-only object study; no walk.

## Parameters

- `scenario` — `paris` (48.86°, the Panthéon original — default) | `pole`
  (90°, one circle per sidereal day) | `equator` (0°, the control case: no
  precession at all).
- `latitude` — number, −90..90. Overrides the scenario preset; southern
  latitudes reverse the precession direction.
- `amplitude` — swing amplitude in render units (default 10, clamped to the
  wire's reach).
- `vectors` — boolean (default false). Adds live velocity/acceleration arrows
  on the bob plus a kinematic readout (finite-differenced from the true path).
- `scale` — 0.2..5 overall size multiplier (default 1).
- `viewBox` — `{ width, height }` (default 1120×780).
- `scene` — `{ bg }` background hex (default deep-space navy).
- `title`, `ref`, `folder_ref` — the standard sketch fields.

## Examples

- The Panthéon classic: `{ scenario: 'paris' }`
- The pole, arrows on: `{ scenario: 'pole', vectors: true }`
- Compare hemispheres: mint `{ latitude: 48.9 }` and `{ latitude: -48.9 }`
  side by side — same rate, opposite sweep.
- The null case for teaching: `{ scenario: 'equator' }` — the readout explains
  why nothing precesses.
