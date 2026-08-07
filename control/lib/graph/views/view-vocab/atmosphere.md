---
{
  "id": "atmosphere",
  "name": "Atmosphere",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint ATMOSPHERIC SCATTERING — the textbook-correct reason the SKY IS BLUE and SUNSETS ARE RED — as a per-pixel VOLUME raymarcher that integrates sunlight scattering along each view ray (this is the honest physics, NOT a colour gradient or…",
  "when": "Reach for this on framing like 'why is the sky blue / show me atmospheric scattering / a sunset / the blue marble / Earth from space / the atmosphere limb'.",
  "retired_tool": "create_atmosphere_view"
}
---

Mint ATMOSPHERIC SCATTERING — the textbook-correct reason the SKY IS BLUE and SUNSETS ARE RED — as a per-pixel VOLUME raymarcher that integrates sunlight scattering along each view ray (this is the honest physics, NOT a colour gradient or a painted sky). You orbit a planet lit by the sun; Rayleigh scattering ∝ λ⁻⁴ makes blue scatter ~5× more than red (→ the blue day disk), the long slant path at the terminator scatters the blue OUT leaving red (→ sunset reddening), forward Mie scattering puts a white halo around the sun, and the backlit night side shows the thin blue limb glow seen from orbit. Three lighting looks: 'day' (sun behind the camera → the full blue marble), 'sunset' (sun to the side → the day/night terminator with a reddened limb), and 'limb' (sun behind the planet → the backlit airglow ring, 'sunrise from the ISS'). A `brightness` knob tunes the sun intensity. Drag to ORBIT, scroll to zoom. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'atmosphere-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'why is the sky blue / show me atmospheric scattering / a sunset / the blue marble / Earth from space / the atmosphere limb'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The lighting look (default 'day'): 'day' (full lit blue marble), 'sunset' (the day/night terminator, reddened limb), 'limb' (backlit night-side airglow ring).
- `brightness` (number) — Sun intensity (4–60). Higher = brighter, more saturated scattering. Overrides the scenario default.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#01030a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
