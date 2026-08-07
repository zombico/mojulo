---
{
  "id": "parallel-transport",
  "name": "Parallel Transport",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive HOLONOMY demonstrator — a tangent arrow carried (parallel-transported) around a closed loop on a surface, rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'parallel transport / holonomy / geometric phase / Berry phase / Foucault pendulum / curvature of a surface / Gauss-Bonnet'.",
  "retired_tool": "create_parallel_transport_view"
}
---

Mint an interactive HOLONOMY demonstrator — a tangent arrow carried (parallel-transported) around a closed loop on a surface, rendered in the traversable three.js World. Carry an arrow around a loop without ever actively turning it: on a FLAT surface it returns pointing exactly as it started; on a CURVED surface it returns ROTATED, and that rotation (the holonomy) EQUALS the curvature enclosed by the loop — the Gauss–Bonnet theorem, checked live on screen (for the unit sphere the enclosed curvature is just the enclosed solid angle). A green START arrow and a red RETURNED arrow at the start point make the gap visible, with a fan of breadcrumb arrows showing the rotation accumulate around the trip. This single idea is the Foucault pendulum, the quantum Berry phase, and spacetime curvature. Four scenarios: 'sphere-triangle' (the textbook 90° proof — a triangle with three right angles), 'foucault' (a circle of latitude; the swing-plane precession, with a `latitude` knob), 'berry' (a loop on the Bloch sphere; geometric phase = ½ the solid angle), 'flat-plane' (the control: holonomy = 0). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'parallel-transport-view'`, no geometry) and recomputes the transport on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'parallel transport / holonomy / geometric phase / Berry phase / Foucault pendulum / curvature of a surface / Gauss-Bonnet'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which framing (default 'sphere-triangle'): 'sphere-triangle', 'foucault', 'berry', 'flat-plane'.
- `latitude` (number) — For foucault/berry: the latitude (deg) of the transport loop (default 48 foucault / 35 berry).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#070b16" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
