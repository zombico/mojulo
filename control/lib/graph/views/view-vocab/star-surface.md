---
{
  "id": "star-surface",
  "name": "Star Surface",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a star's SURFACE (the photosphere) — a self-luminous sphere whose colour is a Planck blackbody map of a live temperature field (granulation + cool spots + limb darkening), as an orbit-able three.js World. The solid-body counterpart to mojulo's raymarched gas stars.",
  "when": "Reach for this on framing like 'the Sun / a star's surface / photosphere / granulation / sunspots / starspots / what does a red dwarf / blue giant look like'.",
  "retired_tool": "create_star_surface_view"
}
---

Mint a star's SURFACE (the photosphere) as a live, orbit-able three.js World — a self-luminous sphere whose appearance is GENERATED FROM A TEMPERATURE FIELD, which is physically what a real star's look is: blackbody radiation off the surface, mottled by convection and cool spots. This is the solid-body counterpart to mojulo's raymarched gas stars (star-birth / plasma-globe / fusion), which render glowing volumes rather than a surface. The temperature field is evaluated live: T = Tbase + granulation (a boiling Worley convection-cell texture: bright hot cell interiors, dark cooler lanes) + starspots (cool patches with umbra + penumbra, placed in the active latitude bands), then mapped to colour by the PLANCK blackbody locus (Kelvin → true RGB) and dimmed toward the disc edge by LIMB DARKENING (a view-dependent term — the reason a real disc reads as a solid sphere even though a star is self-luminous). Differential rotation shears the surface (equator faster than the poles). Four scenarios, one idea worn many ways — the star's CLASS sets its surface temperature, and the blackbody map turns that into the star's TRUE colour, so these are physically distinct stars, not a palette swap: 'sun' (a G star, ~5772 K, shown as the familiar golden-yellow — a declared artistic grade over the true near-white photosphere — with crisp granulation and spots in the ±15–30° bands), 'red-dwarf' (an M star, ~3200 K, deep orange, big lazy granules, heavily spotted), 'blue-giant' (an O/B star, ~25000 K, blue-white, faint fine granulation, spotless), 'spotted' (a cool magnetically active star, ~4800 K, blotched with large starspots). The colour physics and ingredient list are honest; the granulation is a phenomenological convection-cell model, not a magnetoconvection simulation (the same stance as ocean-view's waves). Corona and prominences are NOT part of this view — they belong to a raymarch overlay composited on top (a follow-on). Part of mojulo's science views. Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'star-surface-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'the Sun / a star's surface / photosphere / granulation / sunspots / red dwarf / blue giant'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which star (default 'sun'): 'sun' (G star ~5772 K, warm white), 'red-dwarf' (M star ~3200 K, orange, big granules, spotty), 'blue-giant' (O/B star ~25000 K, blue-white, spotless), 'spotted' (cool ~4800 K star heavily starspotted).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#05060a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
