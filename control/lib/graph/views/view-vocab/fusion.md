---
{
  "id": "fusion",
  "name": "Nuclear Fusion",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a NUCLEAR FUSION event — deuterium (²H) and tritium (³H) overcoming the Coulomb barrier and MERGING into an excited ⁵He* compound nucleus, which ejects a fast 14 MeV neutron while the He-4 alpha recoils (²H + ³H → ⁴He + n + 17.6 MeV),…",
  "when": "Reach for this on framing like 'show me nuclear fusion / how the sun makes energy / D-T fusion / two nuclei fusing'.",
  "retired_tool": "create_fusion_view"
}
---

Mint a NUCLEAR FUSION event — deuterium (²H) and tritium (³H) overcoming the Coulomb barrier and MERGING into an excited ⁵He* compound nucleus, which ejects a fast 14 MeV neutron while the He-4 alpha recoils (²H + ³H → ⁴He + n + 17.6 MeV), ray-marched as a time-evolving VOLUME. This is the release-mechanism counterpart of create_fission_view (which SPLITS a heavy nucleus): a MERGE is a topology change — the inverse of the split — so the whole event lives in one animated density field (an SDF metaball pair whose separation SHRINKS to zero, then re-emerges as the product alpha + a neutron spark). The two nuclei rush in along the axis, fuse in a white-hot flash, then the light neutron shoots off fast while the heavier alpha recoils slowly the other way (momentum conservation — the neutron is 4× faster and carries ~80% of the energy). Drag to ORBIT the camera, scroll to zoom; the event loops on its own. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'fusion-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me nuclear fusion / how the sun makes energy / D-T fusion / two nuclei fusing'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `density` (number) — Opacity/brightness of the nuclear-matter glow (1–30, default 6). Higher = denser, more opaque.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05060c" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
