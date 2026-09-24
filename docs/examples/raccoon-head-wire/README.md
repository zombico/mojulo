# Raccoon head: spatial wire SVG study

A head-only output study, preserving the existing detailed head geometry.
The primary deliverable is `head-three-quarter.svg`, the one render kept here.
The generator also writes front, profile and back views, `head-construction.svg`
(faint dashed hidden edges; the clean drawings show only visible runs) and, with
`--turntable`, a GIF of 48 views of the same source, all into the gitignored
`lite-template/integration/0924/spike-output/``raccoon-head-wire/` (override with `MOJULO_SPIKE_OUT`).
Docs keep the code, the source and the canonical SVG; renders are regenerated, not stored.

## Output rules

- Darker/heavier contours distinguish silhouette edges.
- Facial feature edges are medium weight; supporting planes are lighter.
- Edges between nearly coplanar faces (under seven degrees) are suppressed unless
  they separate named regions or form a silhouette.
- Visibility is evaluated against projected triangle depths at exact edge-sample
  positions, with perspective-correct depth interpolation. No filled surfaces
  appear in the drawing. Invisible occluder geometry is used only for visibility.
- Each path retains its original pair of spatial vertex indices. All SVGs embed
  the complete identical head source in metadata. Camera changes never redraw the
  head independently. The JSON and SVG metadata are standalone study data, not a
  registered native Mojulo manifest.

The geometry is unchanged from the previous detailed raccoon head. This study
raises the rendering standard; it does not yet redesign the face's topology.
Visibility transitions are sampled at half-pixel spacing, not computed as exact
analytic segment intersections, so subpixel gaps and small features have that
precision limit. Thresholds and stroke choices are explicit in `build-wire.py`.

Rebuild with Python 3, NumPy and Pillow: `python3 build-wire.py`.
Validation regenerates the five SVGs in memory, checks unique path IDs and
preservation of the source metadata. Agent inspected the preview; human visual acceptance is pending.

## Reproduce and test

From this directory, use an isolated environment (Python 3.12 or newer):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python test_wire.py
.venv/bin/python build-wire.py --turntable
```

Without `--turntable`, the generator writes only fixed views and their PNG previews.
The pinned versions record the environment used for this reference. No Blender,
network access, repository database or Mojulo server is needed after dependencies
are installed. Python dependencies are example-only, not core runtime dependencies.

The SVG also records the full camera and visibility convention in separate
projection metadata. Every path carries its spatial endpoint indices, clipped
3D parameter interval and line role, so a visible run maps back onto the source
edge. Indices remain stable in this frozen source; native editable recipes need
IDs stable across topology changes.

The tests cover front/quarter/profile/back determinism, metadata preservation,
known occlusion cases, perspective depth, degenerate occluders, orbit bounds and
reprojection of clipped runs. Native primitive adaptation and automatic skill/tool
exposure are not implemented by this example.
