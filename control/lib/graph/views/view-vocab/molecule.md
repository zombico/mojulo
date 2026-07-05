---
{
  "id": "molecule",
  "name": "Molecule",
  "family": "bio",
  "entry": "create_view",
  "summary": "Mint an interactive 3D BALL-AND-STICK MOLECULE — a science/education viewer: lit CPK atoms + bond rods, click-to-inspect popups, canonical principal-axis framing, served as a live orbit World.",
  "when": "Reach for this on framing like 'show this molecule in 3D / a ball-and-stick model of caffeine / visualize this chemical structure interactively'.",
  "retired_tool": "create_molecule_view"
}
---

Mint an interactive 3D BALL-AND-STICK MOLECULE — a science/education viewer for molecular structure. Atoms are lit spheres (CPK element colours + covalent radii by default); bonds render in one of three STYLES (`bond_style`): 'stick' (uniform rods, single/double/triple → one/two/three parallel rods), 'split' (each half coloured by its nearer atom), or 'line' (thin licorice). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom): CLICK any atom or bond to raise a metadata popup (element, charge, bond order/length, plus any custom `meta` you attach). You pass a tiny recipe (ATOMS with 3D positions + BONDS by index); the substrate stores ONLY the recipe (`manifest.kind === 'molecule-view'`, no geometry) and regenerates it on render. CANONICAL PLACEMENT: the molecule's principal axis (PCA of the atom cloud) is rotated to vertical (+Z) so every molecule is framed on the same spine; `chirality` (±1) fixes the in-plane mirror flip (a presentation choice — never alters bond geometry); set `orient:false` to render coordinates verbatim. Opt-in `axis` draws the principal-axis needle and `mandala` draws the graticule scaffold cage — educational overlays, off by default. THREE WAYS TO AUTHOR (cheapest first): (1) `library` — a named preset from the built-in library (a bad `library` value errors with the full preset list); (2) CONNECTIVITY — pass `atoms` as bare element symbols (e.g. ['O','H','H']) with `bonds` by index, and idealized geometry is generated for you — VSEPR shapes (tetrahedral/bent/pyramidal/linear/trigonal) for chains AND perceived rings (planar aromatic, chair for saturated 6-rings, coplanar ortho-fused bicyclics like naphthalene/purine); NOT energy-minimized, and stereochemistry is not resolved (sugars build constitutionally); (3) COORDINATES — pass `atoms` as objects with explicit `pos:[x,y,z]` (e.g. from an XYZ/MOL file). No SMILES parsing. ORBIT-ONLY: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show this molecule in 3D / a ball-and-stick model of caffeine / visualize this chemical structure interactively'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact (e.g. the molecule name).
- `library` (string) — Author by NAME: a built-in molecule preset. When set, `atoms`/`bonds` are not needed.
- `atoms` (array) — The atoms. Two forms: a bare element symbol string (CONNECTIVITY mode — VSEPR generates coordinates), or an object (COORDINATES mode — supply `pos`). Omit entirely when using `library`.
- `bonds` (array) — The bonds, by atom index. Optional (a bare atom cloud renders without rods).
- `bond_style` (string) — Bond rendering style: 'stick' (default, uniform rods; order → parallel rods), 'split' (each half coloured by its nearer atom), or 'line' (thin licorice).
- `orient` (boolean) — Canonically align the molecule's principal axis to vertical (+Z) (default true). Set false to render the supplied coordinates verbatim.
- `chirality` (number) — Mirror-flip selector for the canonical frame: +1 (default) or -1. Fixes which of the two enantiomeric framings is shown; does NOT change bond geometry.
- `axis` (boolean) — Draw a needle along the molecule's principal axis (educational scaffold; default false).
- `mandala` (boolean) — Draw the graticule mandala cage (rings + meridians) around the principal axis (educational scaffold; default false).
- `lod` (string) — Sphere/rod tessellation density: 'draft' / 'default' / 'hero' (default 'default').
- `ball_scale` (number) — Multiplier on the default covalent atom radii (default 0.42 — ball-and-stick spacing; raise toward 1 for space-filling).
- `bond_radius` (number) — Bond rod/tube radius in model units (default 0.08).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
