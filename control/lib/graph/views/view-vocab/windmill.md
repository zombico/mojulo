---
{
  "id": "windmill",
  "name": "Windmill",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive WINDMILL turned by the wind — air moving a rotor, rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'show me a wind turbine / how a windmill works / air turning a rotor / wind power / a spinning windmill in the wind'.",
  "retired_tool": "create_windmill_view"
}
---

Mint an interactive WINDMILL turned by the wind — air moving a rotor, rendered in the traversable three.js World. It depicts the whole chain from first principles: the blades are AIRFOILS, the wind makes LIFT on them, lift's tangential component is a TORQUE, and the rotor SPINS. Wind streamlines stream past as flowing particles; the rotor turns live. Two types: 'turbine' (a modern 3-blade horizontal-axis wind turbine — tower, nacelle, airfoil blades, tip-speed ratio λ = ωR/V) and 'classic' (a Dutch 4-sail tower windmill). The `wind` knob (m/s) drives the rotation rate and the particle speed. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK the rotor/tower for facts. You pass a tiny recipe (a windmill type + wind speed); the substrate stores ONLY the recipe (`manifest.kind === 'windmill-view'`, no geometry) and regenerates it on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a wind turbine / how a windmill works / air turning a rotor / wind power / a spinning windmill in the wind'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Windmill type (default 'turbine'): 'turbine' (modern 3-blade wind turbine), 'classic' (Dutch 4-sail windmill).
- `wind` (number) — Wind speed in m/s (default 10 for turbine, 8 for classic). Higher → faster rotation and faster streaming particles.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#9cc4e8" } for the sky colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
