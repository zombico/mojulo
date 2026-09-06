/**
 * translate_modeler_lingo — a routing/translation index for 3D-modeler vocabulary,
 * the modeler-facing sibling of `forward_context` (user framing → entry tool).
 *
 * A 3D modeler speaks in pipeline operations — blockout, kitbash, retopo, UV unwrap,
 * high-poly bake, LOD, rig, set dressing. Mojulo executes in `create_*` verbs + a
 * baked-unlit `.glb` export. This tool maps the modeler's term to the mojulo
 * execution (which `create_*` tool, with what knobs, then `export_model`), AND — just
 * as important — tells the truth about what mojulo does NOT do, handing those steps
 * back to the modeler's DCC (Blender / Maya / ZBrush / Houdini).
 *
 * It is deterministic and curated, NOT an LLM round-trip, for the same reason
 * `forward_context` is: the value is honest, stable routing. The mapping that says
 * "mojulo can't retopologise — export and do it in your DCC" must never be a model's
 * guess about capability. The host agent reads the translation and drives the actual
 * `create_*` / `export_model` calls.
 *
 * Spirit parity with the regular-user path: where a regular user says "draw me a
 * foggy victorian" and `create_polygonized_sketch` / `sketch_what_possible` translate
 * that into manifests, a modeler says "I need a base mesh to retopo" and this tool
 * translates that into "generate with create_polygonized_sketch → export_model →
 * retopo in your DCC (mojulo emits triangle soup; clean topology is on you)."
 */

import { registerTool } from '@/lib/mcp/server';

// support levels:
//   native  — mojulo genuinely produces this; the generated geometry IS the thing.
//   partial — mojulo produces an approximation with a known ceiling (stated in `ceiling`).
//   handoff — mojulo does NOT do this; it belongs in the DCC after `export_model`.
const NATIVE = 'native';
const PARTIAL = 'partial';
const HANDOFF = 'handoff';

// The export step every generated asset passes through on its way into a DCC.
const EXPORT = { tool: 'export_model', when: 'hand the generated sketch off to your DCC', args: { ref: '<sk_ref>' } };

/**
 * The lexicon. Each entry maps a cluster of modeler terms to mojulo execution.
 *  - `routes`  — ordered `create_*` entry points (with the branch each one fits).
 *  - `then`    — what to do after generating (almost always export_model).
 *  - `dcc`     — the honest "do this in your own tool, not mojulo" note (handoff/partial).
 *  - `ceiling` — for partial: exactly where mojulo's version stops.
 */
const LEXICON = [
  {
    id: 'blockout',
    terms: ['blockout', 'block out', 'blocking', 'greybox', 'graybox', 'whitebox', 'massing', 'proxy geo', 'rough pass'],
    concept: 'A fast, low-detail massing pass to lock proportion, scale, and layout before real modelling.',
    support: NATIVE,
    routes: [
      { tool: 'compose_world', when: 'an urban / environment massing', args: { base: 'city', overrides: { depth: 1 } } },
      { tool: 'create_sketch', when: 'architectural massing (recipe: architecturalConstruction)' },
      { tool: 'create_polygonized_sketch', when: 'a single object or figure blockout', args: { prompt: '<subject>' } },
      { tool: 'create_workbench', when: 'an object study on a measured studio grid' },
    ],
    then: [EXPORT],
    note: 'Mojulo is strong here — a generated, deterministic, correctly-scaled massing IS a blockout. Model your detail over it.',
  },
  {
    id: 'set-dressing',
    terms: ['set dressing', 'set-dressing', 'environment art', 'level art', 'scatter', 'kitbash', 'kit bash', 'props', 'crowd', 'background geo', 'filler geo'],
    concept: 'Populating a scene with many supporting pieces — furniture, foliage, vehicles, buildings — rather than a single hero asset.',
    support: NATIVE,
    routes: [
      { tool: 'compose_world', when: 'streets of buildings, cars, trees, lampposts', args: { base: 'city' } },
      { tool: 'create_sketch', when: 'a furnished room (rooms generate furniture sets)' },
      { tool: 'compose_world', when: 'terrain to dress', args: { base: 'painted-landscape' } },
      { tool: 'preview_vehicle_instance', when: 'sampled vehicle instances for traffic' },
    ],
    then: [EXPORT],
    note: 'Seeds give deterministic variation — re-roll the seed for a different populated layout. Export brings the whole dressed set into your scene as named group nodes.',
  },
  {
    id: 'hero-asset',
    terms: ['hero asset', 'hero prop', 'asset', 'model a', 'make a', 'object', 'prop'],
    concept: 'A specific, foreground-quality object of a known category.',
    support: PARTIAL,
    routes: [
      { tool: 'create_polygonized_sketch', when: 'most objects/figures from a natural-language prompt', args: { prompt: '<subject>' } },
      { tool: 'create_workbench', when: 'an object study with face-card detailing' },
      { tool: 'preview_vehicle_instance', when: 'a vehicle from the meta-fabricator families' },
      { tool: 'create_figure', when: 'a human figure (posed protoform)' },
    ],
    then: [EXPORT],
    ceiling: 'Mojulo nails the silhouette and proportion of known categories, but offers ~1–2 degrees of art-direction per object — expect "a plausible X", not a precise bespoke design. Hero-level surface detail is a DCC job over the exported base.',
    dcc: 'Treat the export as a base; add bespoke detail, sculpt, and final shading in your DCC.',
  },
  {
    id: 'base-mesh',
    terms: ['base mesh', 'basemesh', 'base geo', 'starting mesh', 'sculpt base', 'block mesh'],
    concept: 'A clean starting form to sculpt or model detail onto.',
    support: PARTIAL,
    routes: [
      { tool: 'create_polygonized_sketch', when: 'an object/figure base from a prompt', args: { prompt: '<subject>' } },
      { tool: 'create_figure', when: 'a human base mesh (protoform, poseable)' },
    ],
    then: [EXPORT],
    ceiling: 'The export is a watertight-enough massing, but it is triangle soup (welded/indexed/quad output is on the roadmap), so it is a sculpt/blockout base — not subdiv-ready topology.',
    dcc: 'Sculpt on it (ZBrush/Blender) or use it as a shrink-wrap target for retopo; do not subdivide it directly.',
  },
  {
    id: 'lookdev-turntable',
    terms: ['turntable', 'lookdev', 'look dev', 'beauty shot', 'beauty render', 'presentation', 'preview render', 'orbit view', 'showcase'],
    concept: 'A lit, rotating presentation of an asset for review.',
    support: NATIVE,
    routes: [
      { tool: 'create_solid_turntable', when: 'a single convex solid spinning, lit' },
      { tool: 'forge_motion', when: 'a camera turntable/orbit around any sketch (→ SVG/GIF/MP4)', args: { 'shot.motion': 'turntable' } },
    ],
    then: [],
    note: 'This stays IN mojulo — it is a render, not geometry. Use the /world view for a live orbit, or forge_motion for a shareable clip. (mojulo lighting is baked/unlit, so it is presentation, not physical lookdev.)',
  },
  {
    id: 'usd-interchange',
    terms: ['usd', 'usda', 'usdz', 'openusd', 'universal scene description', 'quick look', 'ar quick look', 'omniverse', 'usd export'],
    concept: 'Hand the scene to the USD-speaking side (Blender, Houdini, Unreal, Omniverse) or to AR Quick Look on a phone at true scale.',
    support: NATIVE,
    routes: [
      { tool: 'export_model', when: 'OpenUSD — usdz is the one-file package Quick Look opens; usda is the text layer + texture sidecars', args: { ref: '<sk_ref>', format: 'usdz' } },
    ],
    then: [],
    ceiling: 'Static geometry only in v1: displayColor per vertex, PointInstancers for repeats, cameras, entity Xforms with moj: customData. Rig clips are not in USD yet (UsdSkel is roadmap). USD viewers LIGHT the surface — the baked colours read as albedo, not the unlit web look.',
    dcc: "Import the .usdz/.usda; upAxis is Z and metersPerUnit follows the recipe's units, so it lands upright at true scale. Textured groups arrive as UsdPreviewSurface + UsdUVTexture; everything else shows displayColor. Re-light and re-shade there.",
  },
  {
    id: 'low-poly',
    terms: ['low poly', 'low-poly', 'lowpoly', 'game res', 'game-res', 'real-time mesh', 'optimized mesh', 'poly count'],
    concept: 'Lean, game-ready geometry with a controlled triangle budget.',
    support: PARTIAL,
    routes: [
      { tool: 'create_polygonized_sketch', when: 'an object/figure', args: { prompt: '<subject>' } },
      { tool: 'compose_world', when: 'an environment (control density/depth to bound count)', args: { base: 'city' } },
    ],
    then: [EXPORT],
    ceiling: 'Mojulo geometry is already coarse, but it is unindexed triangle soup with no triangle budget control, no LODs, and no edge-flow discipline.',
    dcc: 'Decimate/retopo to your target budget and author LODs in your DCC; mojulo gives the form, not the optimisation.',
  },
  {
    id: 'modular-pieces',
    terms: ['modular', 'modular kit', 'modular pieces', 'tileable', 'snap pieces', 'separate objects', 'split by part'],
    concept: 'Geometry separated into reusable, individually-addressable pieces.',
    support: PARTIAL,
    routes: [
      { tool: 'create_sketch', when: 'a room — walls/floor/shell export as named group nodes' },
      { tool: 'create_assembler', when: 'several frozen parts arrayed into one studio worldspace' },
    ],
    then: [EXPORT],
    ceiling: 'Render groups (e.g. shell walls) export as separate named nodes, so the outliner has structure — but pieces are not grid-snapped, semantically named beyond their render group, or guaranteed to tile.',
    dcc: 'Rename, re-pivot, and snap the exported nodes into a true modular kit in your DCC.',
  },
  {
    id: 'materials-shading',
    terms: ['materials', 'shaders', 'shading', 'pbr', 'roughness', 'metalness', 'albedo', 'basecolor', 'base color', 'texturing', 'texture maps'],
    concept: 'Authoring surface response — albedo, roughness, metalness, etc.',
    support: HANDOFF,
    routes: [],
    then: [EXPORT],
    dcc: 'Mojulo bakes its lighting INTO per-vertex colour and exports UNLIT (glTF KHR_materials_unlit) — faithful to the depiction, but it is not a re-lightable PBR material. Build PBR materials in your DCC; use the baked vertex colour as a tint/AO reference if useful.',
  },
  {
    id: 'uv-unwrap',
    terms: ['uv', 'uvs', 'uv unwrap', 'unwrap', 'uv layout', 'uv map', 'texture coordinates', 'uv seams'],
    concept: 'Laying the surface out in 2D so textures map cleanly.',
    support: HANDOFF,
    routes: [],
    then: [EXPORT],
    dcc: 'Mojulo emits UVs only for its texture-wrap faces (label wraps), not a general unwrap. Unwrap the exported mesh in your DCC.',
  },
  {
    id: 'retopo',
    terms: ['retopo', 'retopology', 'clean topology', 'quad flow', 'quads', 'edge loops', 'edgeflow', 'edge flow', 'subdiv ready', 'subdivision surface', 'good topology'],
    concept: 'Rebuilding a surface with deliberate, animation/subdiv-friendly quad flow.',
    support: HANDOFF,
    routes: [],
    then: [EXPORT],
    dcc: 'Mojulo exports unindexed triangle soup with no edge-flow intent (welded/indexed/quad output is roadmap). Retopologise the exported mesh in your DCC — this is squarely a modeller-side step.',
  },
  {
    id: 'sculpt-detail',
    terms: ['high poly', 'high-poly', 'highpoly', 'sculpt', 'sculpting', 'zbrush', 'fine detail', 'micro detail', 'displacement detail', 'inflate', 'crease', 'clay brush', 'dent', 'bump'],
    concept: 'Adding surface detail by sculpting — form-level dabs and roughening, up to dense high-frequency micro detail.',
    support: PARTIAL,
    routes: [
      { tool: 'mint_solid', when: "FORM-level sculpting: the workbench `fields` monomer's `stroke` terms (strength > 0 adds a dab — a bump, a haunch, a jowl; < 0 carves one — a dent, a socket) and `displace` (seeded 3D noise for hide / pebble breakup). A list of strokes IS a recipe — deterministic, diffable, editable in place.", args: { kind: 'workbench', spec: { fields: [{ terms: [{ op: 'add', shape: { kind: 'ellipsoid', center: [0, 0, 1], radii: [2, 1.4, 1] } }, { op: 'stroke', at: [1.5, 0.4, 1.4], radius: 0.6, strength: 1 }, { op: 'displace', noise: { amplitude: 0.08, scale: 0.6, seed: 'skin' } }] }] } } },
      { tool: 'create_polygonized_sketch', when: 'generate the base form first (figures, animals, props)', args: { prompt: '<subject>' } },
    ],
    then: [EXPORT],
    ceiling: 'Form-level only: a stroke is a smooth-blended sphere and displace is low-octave value noise on a 16–128 cell grid (edges round to about one cell). Pores, wrinkles, and brush-stroke micro detail are beyond the grid.',
    dcc: 'Generate the form in mojulo (dabs and noise included), export, then sculpt the high-frequency detail in ZBrush/Blender.',
  },
  {
    id: 'boolean-cut',
    terms: ['boolean', 'booleans', 'boolean difference', 'boolean subtract', 'boolean union', 'boolean intersect', 'csg', 'cut hole', 'hole through', 'bore', 'drill', 'pocket', 'slot', 'carve out', 'hollow out'],
    concept: 'Combining solids by union / difference / intersection — a hole through a part, a pocket, a slot, a socket.',
    support: PARTIAL,
    routes: [
      { tool: 'mint_solid', when: "the workbench `fields` monomer: a term list read top-down — `add` a shape, `subtract` a shape (a bore is a `sweep` term cut from a `lathe` term), `blend` for a filleted rim. To cut INTO a lathe/extrude, author it as a `fields` term (its field twin), not in `lathes`/`extrudes`.", args: { kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 96, terms: [{ id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1.2], profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] } }, { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 3]], radius: 1.2 } }] }] } } },
    ],
    then: [
      { tool: 'export_model', when: 'print it as ONE solid — `union: true` runs a Manifold CSG union of every shell (3MF or STL)', args: { ref: '<sk_ref>', format: '3mf', union: true } },
    ],
    ceiling: 'Field-space booleans: exact sign, closed by construction, genus-correct — but every edge rounds to about one grid cell (`cells` 16–128; cost is cubic). A machined sharp edge is not on offer in the recipe; Manifold `union: true` unions shells sharply at export.',
    dcc: "For sharp booleans over an imported mesh, or a boolean between a mojulo part and your own geometry: export and use Blender's Boolean modifier (Exact solver) or OpenSCAD.",
  },
  {
    id: 'chamfer-fillet',
    terms: ['chamfer', 'fillet', 'bevel', 'round edges', 'rounded edges', 'edge bevel', 'bevel modifier', 'soften edges'],
    concept: 'Softening or breaking an edge with a rounded (fillet) or angled (chamfer) transition.',
    support: PARTIAL,
    routes: [
      { tool: 'mint_solid', when: "a FILLET: the `fields` monomer's `round` term inflates a solid and rounds every edge and corner; `blend` on an `add`/`subtract` fillets that one junction; `box` takes its own `round`.", args: { kind: 'workbench', spec: { fields: [{ terms: [{ op: 'add', shape: { kind: 'box', center: [0, 0, 1], size: [4, 3, 2], round: 0.3 } }] }] } } },
    ],
    then: [EXPORT],
    ceiling: 'Uniform fillets only (the whole solid, or one blended junction), rounded to the field grid. A sharp CHAMFER (a flat 45° break) and per-edge fillet selection are not on offer.',
    dcc: "Chamfers and per-edge bevels: export and use Blender's Bevel modifier with edge weights / bevel segments.",
  },
  {
    id: 'baking',
    terms: ['bake', 'baking', 'normal map', 'normal bake', 'ao bake', 'ambient occlusion', 'high to low', 'high-to-low', 'cage bake', 'curvature map'],
    concept: 'Transferring detail/lighting from a high-poly (or scene) onto maps for a low-poly.',
    support: HANDOFF,
    routes: [],
    then: [EXPORT],
    dcc: 'Mojulo has no high→low bake. Export both forms (or the single form) and bake normals/AO/curvature in your DCC or Marmoset/Substance.',
  },
  {
    id: 'rigging',
    terms: ['rig', 'rigging', 'skinning', 'skin weights', 'weight painting', 'armature', 'skeleton', 'bones', 'bind pose', 'ik'],
    concept: 'Building a deformation skeleton and binding the mesh to it.',
    support: HANDOFF,
    routes: [
      { tool: 'create_figure', when: 'a figure — it has an internal posing skeleton (vajra), but the EXPORT is static baked geometry, not a rig' },
    ],
    then: [EXPORT],
    dcc: 'The figure system poses analytically inside mojulo, but the .glb is a static pose with no joints/weights. Rig and skin the exported mesh in your DCC. (glTF skeletal export is roadmap.)',
  },
  {
    id: 'animation',
    terms: ['animation', 'animate', 'keyframe', 'walk cycle', 'walkcycle', 'skeletal animation', 'cloth sim', 'simulation', 'physics'],
    concept: 'Time-varying deformation or simulation.',
    support: PARTIAL,
    routes: [
      { tool: 'forge_motion', when: 'camera moves, deck slideshows, or carved-solid morphs (→ SVG/GIF/MP4)' },
    ],
    then: [],
    ceiling: 'Mojulo motion is baked frames — camera paths and morphs, NOT skeletal deformation, cloth, or physics. There is no animated geometry in the .glb (static pose only; glTF animation export is roadmap).',
    dcc: 'For character/skeletal/sim animation, rig and animate the exported mesh in your DCC.',
  },
  {
    id: 'lod',
    terms: ['lod', 'lods', 'level of detail', 'decimate', 'decimation', 'mesh reduction', 'impostor'],
    concept: 'Generating progressively cheaper versions of a mesh for distance.',
    support: HANDOFF,
    routes: [],
    then: [EXPORT],
    dcc: 'Mojulo emits a single density. Generate the LOD chain (decimate/impostor) in your DCC or engine.',
  },
  {
    id: '3d-print',
    terms: ['3d print', '3d printing', 'print', 'printable', 'stl', 'slicer', 'slicing', 'prusaslicer', 'cura', 'bambu', 'fdm', 'resin print', 'manifold', 'watertight', 'mesh repair'],
    concept: 'Turning a model into a physical object via a slicer and printer.',
    support: PARTIAL,
    routes: [
      { tool: 'create_polygonized_sketch', when: 'most objects/figures to print', args: { prompt: '<subject>' } },
      { tool: 'create_carved_solid', when: 'a sculptural solid — naturally print-friendly mass' },
      { tool: 'create_manji_tree', when: 'a turnable polygomer object' },
      { tool: 'create_figure', when: 'a posed human figure' },
    ],
    then: [
      { tool: 'export_model', when: 'the print handoff — 3MF (slicer-preferred: mm declared in-file, colours, instanced repeats as objects) or binary STL; z-up, scale maps world units → mm', args: { ref: '<sk_ref>', format: '3mf' } },
    ],
    ceiling: 'By default the print file is honest shells (the closure audit names open rims); `union: true` runs a Manifold CSG union so the parts arrive as ONE solid with a measured volume (optional dependency — absent, it ships plain and says why). STL is shape only (colour/groups dropped); 3MF keeps the baked colours as basematerials.',
    dcc: "Import into your slicer (PrusaSlicer/Bambu/Orca/Cura) — 3MF arrives at true millimetres; with `union: true` it is one body already, otherwise let the slicer merge the shells. Orient, hollow, and add supports there. For STL, set `scale` at export so the print lands at real millimetres.",
  },
  {
    id: 'sdf-expression',
    terms: ['gyroid', 'tpms', 'triply periodic', 'lattice', 'infill', 'lattice infill', 'schwarz', 'signed distance', 'sdf', 'distance field', 'implicit surface', 'shader shape', 'math shape', 'procedural surface', 'wavy surface', 'ripple'],
    concept: 'A shape written as MATH — a signed-distance expression over x y z (a gyroid, a lattice, a wavy plate, a twisted box) rather than picked from a primitive list.',
    support: NATIVE,
    routes: [
      { tool: 'mint_solid', when: "the workbench `fields` monomer's `expr` shape: `{ kind:'expr', d:'<expression over x y z>', vars?, bounds }` — a GLSL-like infix expression with a whitelist of pure functions (abs min max sqrt sin cos mod clamp mix smoothstep smin smax len3 noise3 …), `vars` as the dials `update_sketch` turns, `bounds` REQUIRED (it clips). Use it under add / subtract / intersect like any shape; grammar and five idioms are on the workbench card.", args: { kind: 'workbench', spec: { fields: [{ cells: 64, terms: [{ id: 'block', op: 'add', shape: { kind: 'box', center: [0, 0, 1], size: [2, 2, 2] } }, { id: 'gyroid', op: 'intersect', shape: { kind: 'expr', d: 'let g = sin(x*k)*cos(y*k) + sin(y*k)*cos(z*k) + sin(z*k)*cos(x*k); abs(g) / k - t', vars: { k: 6.2832, t: 0.12 }, reach: 2 } }] }] } } },
    ],
    then: [EXPORT],
    ceiling: 'An expression is a FIELD with the right sign; it is an exact distance only if you wrote one, so `round` / `shell` / `blend` over it are approximate by the same amount. Edges round to a grid cell like every field solid. No loops, no strings, no user functions — a shape that needs a program is the `code` kind.',
    dcc: 'For a shader-driven displacement or a texture-driven lattice at art fidelity, export the base and do it in Blender (Geometry Nodes / a displacement modifier).',
  },
  {
    id: 'array-pattern',
    terms: ['array', 'array modifier', 'radial array', 'circular array', 'polar array', 'linear array', 'pattern', 'bolt circle', 'bolt pattern', 'hole pattern', 'grille', 'grid of holes', 'colonnade', 'instances', 'repeat', 'mirror modifier', 'symmetry', 'twist', 'bend', 'taper', 'deform', 'simple deform', 'lattice deform'],
    concept: 'Repeating or deforming a piece of geometry — a linear/radial array of a feature, a mirror, a twist / bend / taper of a whole part.',
    support: NATIVE,
    routes: [
      { tool: 'mint_solid', when: "the `fields` monomer's DOMAIN ops, applied to a nested `terms` sub-solid and combined in: `repeat { polar:{ count, radius } }` or `repeat { spacing, count }` (a COUNTED array — the bolt circle is ONE bore repeated; every instance keeps the bore's `group`), `transform { translate, rotate, scale, mirror }`, `twist { axis, turns }`, `bend { axis, radius }`, `taper { axis, from, to }`, `elongate { by }`. Without a nested list an op warps the whole solid so far.", args: { kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 96, terms: [{ id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1.2], profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] } }, { op: 'repeat', polar: { count: 6, radius: 4.5 }, combine: 'subtract', terms: [{ id: 'bolt', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 3], radius: 0.45 } }] }] }] } } },
    ],
    then: [EXPORT],
    ceiling: 'Arrays are bounded (a count, not an infinite tile) and warps act about the origin / the axis through it — author the piece there, then `transform` it into place. After a twist / bend / taper the field is a bound, not an exact distance (raise `cells` or `round` less). Many DIFFERENT instances from a parts table is the `code` kind.',
    dcc: 'Instance-level variation, scattering over a surface, or an array following a curve: export and use Blender Geometry Nodes.',
  },
  {
    id: 'procedural-part',
    terms: ['script it', 'script', 'procedural', 'procedural part', 'procedural modeling', 'generate n parts', 'generate parts', 'parts table', 'parametric', 'parametric part', 'houdini', 'geometry nodes', 'openscad', 'code', 'program', 'python script', 'bpy script', 'for loop', 'many parts', 'kitbash generator'],
    concept: 'A part described by a PROGRAM — a loop over a parts table, a parametric family, geometry that is easier to compute than to list.',
    support: NATIVE,
    routes: [
      { tool: 'mint_solid', when: "the `code` kind: `spec.source` is the body of a function (params, ctx) that RETURNS a workbench spec (monomer arrays / an `assembly`) or a face list. It runs in a realm with no host reach (no fs / network / clock; Math.random is seeded by `seed`), `console.log` comes back on the result, `params` are the dials update_sketch turns, `budgetMs` is the one limit. Realm API + three worked programs: get_solid_vocab({ id: 'code' }).", args: { kind: 'code', spec: { units: 'mm', params: { n: 6, r: 40, pcd: 30, hole: 3, t: 6 }, source: "const bores = Array.from({ length: params.n }, (_, i) => { const a = i / params.n * Math.PI * 2; return { id: 'bore', op: 'subtract', shape: { kind: 'capsule', a: [params.pcd * Math.cos(a), params.pcd * Math.sin(a), -1], b: [params.pcd * Math.cos(a), params.pcd * Math.sin(a), params.t + 1], radius: params.hole } }; });\nreturn { fields: [{ cells: 96, terms: [{ id: 'disc', op: 'add', shape: { kind: 'lathe', profile: [{ t: 0, radius: params.r }, { t: 1, radius: params.r }], axisFrom: [0, 0, 0], axisTo: [0, 0, params.t] } }, ...bores] }] };" } } },
    ],
    then: [EXPORT],
    ceiling: 'Plain JavaScript over the workbench vocabulary — no bpy, no mesh editing, no host reach. What the program returns still pays every workbench gate (closure audit, honest ledger) and rounds like every field solid. A program is a recipe: same source + params + seed → the same faces forever.',
    dcc: 'For a script that drives a DCC (modifiers, simulation, render settings) the script belongs in the DCC; mint the part here and hand the .glb / .usd over.',
  },
];

// Normalise + tokenise for matching.
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Score an entry against the modeler's phrase. Exact term hit > phrase-contains-term >
// term-contains-phrase > token overlap. Returns 0 for no signal.
function scoreEntry(entry, phrase) {
  const p = norm(phrase);
  if (!p) return 0;
  const pTokens = new Set(p.split(' '));
  let best = 0;
  for (const term of entry.terms) {
    const t = norm(term);
    if (!t) continue;
    if (p === t) { best = Math.max(best, 100); continue; }
    if (p.includes(t)) { best = Math.max(best, 80 + t.length); continue; }
    if (t.includes(p) && p.length >= 3) { best = Math.max(best, 60); continue; }
    const tTokens = t.split(' ');
    const overlap = tTokens.filter((tok) => pTokens.has(tok)).length;
    if (overlap) best = Math.max(best, 20 + overlap * 5);
  }
  return best;
}

const PIPELINE_NOTE =
  "mojulo's role: generate the depiction deterministically from a recipe, then export_model (.glb, baked-unlit) hands it to your DCC where you finish — retopo, UV, bake, rig, PBR. It is a GENERATOR THAT FEEDS your pipeline, not a modeller. The .glb is faithful to what mojulo depicts (KHR_materials_unlit + vertex colour); treat it as upstream of your real modelling work.";

function publicEntry(entry, subject) {
  const fillArgs = (args) => {
    if (!args) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(args)) out[k] = v === '<subject>' && subject ? subject : v;
    return out;
  };
  return {
    id: entry.id,
    terms: entry.terms,
    concept: entry.concept,
    support: entry.support,
    mojulo_routes: (entry.routes || []).map((r) => ({ tool: r.tool, when: r.when, ...(r.args ? { args: fillArgs(r.args) } : {}) })),
    then: (entry.then || []).map((r) => ({ tool: r.tool, when: r.when, ...(r.args ? { args: r.args } : {}) })),
    ...(entry.ceiling ? { ceiling: entry.ceiling } : {}),
    ...(entry.dcc ? { do_in_dcc: entry.dcc } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  };
}

export async function translateModelerLingoHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('translate_modeler_lingo requires { lingo } (or { list: true })');
  }
  const { lingo, subject, list = false, limit = 3 } = input;

  if (list) {
    return {
      pipeline: PIPELINE_NOTE,
      lexicon: LEXICON.map((e) => ({ id: e.id, support: e.support, terms: e.terms, concept: e.concept })),
    };
  }

  if (typeof lingo !== 'string' || !lingo.trim()) {
    throw new Error('`lingo` is required (a modeler term/phrase, e.g. "base mesh to retopo"); or pass { list: true } to browse all terms');
  }
  const cap = Number.isInteger(limit) && limit >= 1 && limit <= 10 ? limit : 3;

  const ranked = LEXICON
    .map((e) => ({ e, score: scoreEntry(e, lingo) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);

  if (!ranked.length) {
    return {
      lingo,
      subject: subject ?? null,
      matches: [],
      pipeline: PIPELINE_NOTE,
      unmatched: {
        suggestion:
          'No curated mapping for that term. For most objects, describe the form and call create_polygonized_sketch, then export_model. Browse known terms with { list: true }.',
        known_terms: LEXICON.flatMap((e) => e.terms),
      },
    };
  }

  return {
    lingo,
    subject: subject ?? null,
    pipeline: PIPELINE_NOTE,
    matches: ranked.map((x) => publicEntry(x.e, subject)),
  };
}

export function registerModelerLingoTools() {
  registerTool({
    name: 'translate_modeler_lingo',
    description:
      "Translate 3D-modeler vocabulary into mojulo execution — the modeler-facing sibling of `forward_context`. A modeler speaks in pipeline ops (blockout, kitbash, set dressing, base mesh, low-poly, retopo, UV unwrap, high-poly sculpt, normal bake, rig, LOD, lookdev turntable); this maps each to the right `create_*` entry tool + knobs and the `export_model` (.glb) handoff, AND tells the truth about what mojulo does NOT do, handing those steps to the modeler's DCC (Blender/Maya/ZBrush/Houdini). Use it the same way `create_polygonized_sketch`/`sketch_what_possible` serve a regular user's natural-language ask: pass the modeler's phrase as `lingo` (and optionally the `subject` they want, e.g. \"spaceship\"), read the returned routes, then drive the actual create/export calls. Honest by design — for retopo/UV/bake/rig/PBR it returns a `do_in_dcc` note and no false capability, because mojulo is a generator that FEEDS the pipeline, not a modeller. Pass `{ list: true }` to browse the whole lexicon. Read-only; returns `{ lingo, subject, pipeline, matches }` where each match has `support` (native|partial|partial-with-`ceiling`|handoff), `mojulo_routes`, `then`, and `do_in_dcc`.",
    inputSchema: {
      type: 'object',
      properties: {
        lingo: {
          type: 'string',
          description: "The modeler's term or phrase, however they said it — e.g. \"I need a base mesh to retopo\", \"greybox an environment\", \"kitbash some props\", \"bake normals\", \"rig this\". Matched against a curated lexicon of modeler vocabulary.",
        },
        subject: {
          type: 'string',
          description: 'Optional: WHAT they want to make (e.g. "spaceship", "victorian house", "office"). Folded into the suggested create_* call args where relevant.',
        },
        list: {
          type: 'boolean',
          default: false,
          description: 'Return the full lexicon (every term cluster + support level) instead of matching a phrase. Ignores `lingo`.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 3,
          description: 'Max matching entries to return (default 3).',
        },
      },
    },
    handler: translateModelerLingoHandler,
  });
}
