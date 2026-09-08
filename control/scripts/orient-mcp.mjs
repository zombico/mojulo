#!/usr/bin/env node
/**
 * mojulo-orient — practical orientation as a gallery of RECIPES.
 *
 * A separate, tiny stdio MCP beside the control-plane server
 * (lite-template/integration/0720/practical-orientation.plan.md). It mints
 * nothing itself and duplicates no substrate state. What it owns is a curated
 * catalog of founding works — each carried as the RECIPE that mints it, with
 * a pinned stable ref, so the gallery is portable to any mojulo host — and
 * the LOOP:
 *
 *   get_work    → the next untoured work: its recipe, what it shows is
 *                 possible, how it was made, and the one-line asks that make
 *                 that kind of thing.
 *   mark_toured → records that the tour happened and whether the operator
 *                 accepted or declined the mint.
 *   add_work    → the gallery grows from real sessions (operator-blessed).
 *   list_works  → the whole gallery + toured state.
 *
 * Two kinds of work. An EXHIBIT carries `recipe` (a finished thing, minted on
 * consent). A BRIEF carries `brief` instead (chariot.plan.md, 2026-09-08): an
 * exercise the host agent drives cold — intent, phases with a machine exit
 * and an eyes exit each, the rules, and a filing convention. What a brief
 * produces is a SIGNATURE: an added work whose `answersBrief` names the brief,
 * so signatures from different agents and hosts group under it, and touring a
 * signature ends by deconstructing a stranger's recipe. Briefs mint nothing
 * themselves either; the substrate is untouched.
 *
 * The tour's first beat is EXPLICIT CONSENT: orientation creates a real
 * artifact to show the loop — a tiny recipe row minted into the operator's
 * own sketches DB, live, by the host agent through the real mojulo MCP.
 * The operator may accept or reject. On reject, nothing is minted: the
 * agent just explains what would have happened, hands over the asks, and
 * stops — it is the operator's workshop from there. The theory: the act of
 * creating IS the explanation. A finished render proves such things can
 * exist; watching one get minted proves the distance from ask to artifact.
 *
 * Posture: parallel to forward_context (which orients *recognition* by
 * index), this orients *possibility* by exhibit. Never pushed — reach for
 * it when the operator wants to know what mojulo can do.
 *
 * Zero dependencies: newline-delimited JSON-RPC 2.0 over stdio.
 * State (toured + added works): control/data/orientation.json (gitignored).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const STATE_PATH = join(DATA_DIR, 'orientation.json');

// The founding series: "what mojulo is to Claude" (2026-07-19), plan +
// static outputs in lite-template/integration/0719/. Each entry is one
// capability family, shown through a finished thing rather than a doc —
// and carried as the recipe that mints it. Refs are pinned to the original
// pilot rows, so on the pilot host the mint finds them already existing and
// on a fresh host the same refs mint byte-equivalent works.
const WORKS = [
  {
    id: 'the-seam',
    title: 'The Seam',
    ref: 'sk_r8znq88juo',
    urls: { page: '/sketches/sk_r8znq88juo', png: '/api/sketches/sk_r8znq88juo/png' },
    shows: 'Diagrams from conversation — and mojulo’s core doctrine drawn as one: words become a tiny sovereign recipe; renders are disposable derivations; a machine gate and an eyes gate stand between draft and kept.',
    madeWith: ['create_sketch (stations + labeled edges)'],
    story: 'Authored as six stations and six verbs; accepted on first render because the layout itself says the thing.',
    sampleAsks: [
      'draw me a diagram of how our deploy pipeline works',
      'sketch the flow of a customer ticket through the team',
      'chart these numbers as a donut with a headline stat',
    ],
    recipe: {
      tool: 'create_sketch',
      input: {
        ref: 'sk_r8znq88juo',
        title: 'The Seam - what mojulo is to Claude, 1 of 4',
        manifest: {
          title: 'The Seam — words become things that keep existing',
          viewBox: { width: 1520, height: 820 },
          stations: [
            { id: 'talk', kind: 'input', label: 'A conversation', sublabel: 'the only raw material', items: ['words and intent', 'no files, no coordinates'], x: 60, y: 320, w: 280, h: 170 },
            { id: 'recipe', kind: 'db_row', label: 'The recipe — sovereign', sublabel: 'what mojulo actually keeps', items: ['tiny JSON, seeded dice', 'same seed, same thing, forever', 'never contains pixels'], x: 420, y: 310, w: 310, h: 190 },
            { id: 'renders', kind: 'filesystem', label: 'Derived renders — disposable', sublabel: 'depictions, not the thing itself', items: ['/png · /world · .glb · .stl · .wav', 'regenerate any time', 'bound back with provenance'], x: 810, y: 310, w: 310, h: 190 },
            { id: 'machineGate', kind: 'mcp_tool', label: 'Machine gate', sublabel: 'deterministic audits', items: ['completability, BOM, unit nets'], x: 810, y: 60, w: 310, h: 150 },
            { id: 'eyesGate', kind: 'mcp_tool', label: 'Eyes gate', sublabel: 'someone actually looks', items: ['Claude reads the PNG', 'the operator blesses'], x: 810, y: 610, w: 310, h: 150 },
            { id: 'kept', kind: 'db_row', label: 'It keeps existing', sublabel: 'after the chat ends', items: ["a URL on the operator's host", 'diffable, exportable, re-mintable'], x: 1200, y: 310, w: 280, h: 190 },
          ],
          edges: [
            { from: 'talk', to: 'recipe', label: 'mints' },
            { from: 'recipe', to: 'renders', label: 'derives' },
            { from: 'renders', to: 'machineGate', label: 'audited by' },
            { from: 'renders', to: 'eyesGate', label: 'looked at by' },
            { from: 'machineGate', to: 'kept', label: 'passes' },
            { from: 'eyesGate', to: 'kept', label: 'blesses' },
          ],
        },
      },
    },
  },
  {
    id: 'complex-from-simple',
    title: 'Complex from Simple (the lantern)',
    ref: 'sk_jon77cn4ud',
    urls: { page: '/sketches/sk_jon77cn4ud', png: '/api/sketches/sk_jon77cn4ud/png', world: '/api/sketches/sk_jon77cn4ud/world' },
    shows: 'Real-scale 3D objects from a closed vocabulary — seven stacked lathe profiles and one swept handle become a 40cm brass-and-glass hurricane lantern, placed by declared relations (on/gap/radial), never coordinates.',
    madeWith: ['create_workbench (assembly + one sweep)'],
    story: 'Took two mints: v1’s handle hoop floated (ends at ±6.5cm over a 3.6cm collar) — the eyes gate caught it, v2 seats it. The iteration IS the method.',
    sampleAsks: [
      'model a hurricane lantern at real scale I can orbit in 3D',
      'build a candlestick / vase / mug from primitives',
      'block out this product idea as a measured object',
    ],
    recipe: {
      tool: 'create_workbench',
      input: {
        ref: 'sk_jon77cn4ud',
        title: 'Complex from Simple v2 - what mojulo is to Claude, 2 of 4',
        units: 'cm',
        lathes: [
          { profile: [{ t: 0, radius: 1 }, { t: 1, radius: 0.8 }], material: 'bronze', axisFrom: { x: 6, y: 0, z: 0 }, axisTo: { x: 6, y: 0, z: 1 } },
          { profile: [{ t: 0, radius: 1 }, { t: 1, radius: 0.8 }], material: 'bronze', axisFrom: { x: 0, y: 6, z: 0 }, axisTo: { x: 0, y: 6, z: 1 } },
          { profile: [{ t: 0, radius: 1 }, { t: 1, radius: 0.8 }], material: 'bronze', axisFrom: { x: -6, y: 0, z: 0 }, axisTo: { x: -6, y: 0, z: 1 } },
          { profile: [{ t: 0, radius: 1 }, { t: 1, radius: 0.8 }], material: 'bronze', axisFrom: { x: 0, y: -6, z: 0 }, axisTo: { x: 0, y: -6, z: 1 } },
          { profile: [{ t: 0, radius: 8 }, { t: 0.7, radius: 7 }, { t: 1, radius: 5.5 }], material: 'bronze', axisFrom: { x: 0, y: 0, z: 1 }, axisTo: { x: 0, y: 0, z: 4 } },
          { profile: [{ t: 0, radius: 1.6 }, { t: 1, radius: 1.8 }], material: 'bronze', axisFrom: { x: 0, y: 0, z: 4 }, axisTo: { x: 0, y: 0, z: 9 } },
          { profile: [{ t: 0, radius: 3 }, { t: 0.45, radius: 6 }, { t: 1, radius: 3.2 }], material: 'copper', axisFrom: { x: 0, y: 0, z: 9 }, axisTo: { x: 0, y: 0, z: 18 } },
          { profile: [{ t: 0, radius: 3.6 }, { t: 1, radius: 2.8 }], material: 'bronze', axisFrom: { x: 0, y: 0, z: 18 }, axisTo: { x: 0, y: 0, z: 20 } },
          { profile: [{ t: 0, radius: 3.4 }, { t: 0.25, radius: 4.4 }, { t: 0.75, radius: 3.2 }, { t: 1, radius: 2.4 }], material: 'glass', axisFrom: { x: 0, y: 0, z: 20 }, axisTo: { x: 0, y: 0, z: 33 } },
          { profile: [{ t: 0, radius: 3 }, { t: 1, radius: 0.8 }], material: 'bronze', axisFrom: { x: 0, y: 0, z: 33 }, axisTo: { x: 0, y: 0, z: 34.6 } },
        ],
        sweeps: [
          {
            path: [
              [3.4, 0, 20.6], [7, 0, 24.5], [7.1, 0, 29.25], [5.8, 0, 32.67], [4.1, 0, 35.29], [2.12, 0, 36.94],
              [0, 0, 37.5], [-2.12, 0, 36.94], [-4.1, 0, 35.29], [-5.8, 0, 32.67], [-7.1, 0, 29.25], [-7, 0, 24.5], [-3.4, 0, 20.6],
            ],
            radius: 0.5,
            material: 'bronze',
          },
        ],
      },
    },
  },
  {
    id: 'it-keeps-existing',
    title: 'It Keeps Existing (the seed-719 city)',
    ref: 'sk_kjmh49mw7p',
    urls: { page: '/sketches/sk_kjmh49mw7p', png: '/api/sketches/sk_kjmh49mw7p/png', world: '/api/sketches/sk_kjmh49mw7p/world', glb: '/api/sketches/sk_kjmh49mw7p/model.glb', stl: '/api/sketches/sk_kjmh49mw7p/model.stl?scale=0.1' },
    shows: 'Walkable worlds minted from a seed, and the persistence ladder: the same recipe serves a browsable world, a .glb model, and a printable .stl — the chat ends, the city doesn’t, and it can leave the screen entirely.',
    madeWith: ['compose_world (base city, seed 719 — the mint date)', 'export_model (.glb / .stl)'],
    story: 'Seed = the date it was made. Same seed, same city, forever — that sentence is the whole recipes-not-renders doctrine. This recipe is 5 lines; the city it mints has streets.',
    sampleAsks: [
      'make me a little city I can walk around',
      'compose a campus / airport / drivable world',
      'give me an STL of that world so I can 3D print it',
    ],
    recipe: {
      tool: 'compose_world',
      input: {
        ref: 'sk_kjmh49mw7p',
        title: 'It Keeps Existing - what mojulo is to Claude, 3 of 4',
        base: 'city',
        theme: 'earth-temperate',
        seed: 719,
      },
    },
  },
  {
    id: 'borrowed-eyes',
    title: 'Borrowed Eyes (The Workshop, Lit)',
    ref: 'sk_mzhxi5742w',
    urls: { page: '/sketches/sk_mzhxi5742w', png: '/api/sketches/sk_mzhxi5742w/png' },
    shows: 'Directed AI images: mojulo stages the geometry (strict bench and lantern, guided window, loose tool wall) and an image worker paints it — design stays sovereign, paint is borrowed, the render binds back with provenance.',
    madeWith: ['create_sketch (kind image-outcome)', 'get_image_render_packet', 'an image-worker rung', 'bind_image_render'],
    story: 'The staging quotes the other three works: the lantern on the bench, the city outside the window. The workshop painting its own portrait.',
    // The recipe mints the SCAFFOLD deterministically. The PAINT needs a live
    // worker rung (the host agent's own image generation, or the local worker)
    // and is offered as a follow-up, never required — an unpainted scaffold
    // teaches the seam honestly: design sovereign, paint borrowed.
    paintNote: 'This recipe mints the deterministic scaffold. Painting it needs an image-worker rung (your own image generation, else the local worker) — if one resolves, offer to run the request → paint → audit → bind loop; if none does, the unpainted scaffold IS the lesson.',
    sampleAsks: [
      'direct an AI image of X with the composition locked',
      'turn this world screenshot into a finished cinematic image',
      'make concept art where the product cannot move but the style can',
    ],
    recipe: {
      tool: 'create_sketch',
      input: {
        ref: 'sk_mzhxi5742w',
        title: 'Borrowed Eyes - what mojulo is to Claude, 4 of 4',
        manifest: {
          kind: 'image-outcome',
          contractVersion: 'image-outcome/v1',
          title: 'The Workshop, Lit',
          intent: "Paint the agent's workshop at night: the lantern the agent assembled glowing on the workbench, the small city it minted visible through the window. The agent owns the geometry; the borrowed eye owns the paint.",
          mode: 'blockout',
          source: { type: 'inline-blockout', note: 'Self-portrait staging: bench and lantern strict, window guided, walls loose.' },
          viewBox: { width: 1536, height: 1024 },
          camera: { kind: 'wide-establishing' },
          horizonY: 480,
          vanishingPoint: [768, 480],
          forms: [
            { id: 'back-wall', role: 'rear workshop wall', label: 'rear workshop wall', depthBand: 'background', depthRank: 0, preserve: 'strict', materialHint: 'aged plaster or wood planks, warm in lantern light', mayRestyle: true, polygon: [[300, 180], [1236, 180], [1236, 700], [300, 700]], bbox: { x: 300, y: 180, w: 936, h: 520 }, notes: '' },
            { id: 'window', role: 'night window with a small city outside', label: 'night window with a small city outside', depthBand: 'background', depthRank: 1, preserve: 'guided', materialHint: 'cool night glass, tiny distant city lights and rooftops, faint blue', mayRestyle: true, polygon: [[880, 240], [1150, 240], [1150, 560], [880, 560]], bbox: { x: 880, y: 240, w: 270, h: 320 }, notes: '' },
            { id: 'tool-wall', role: 'left wall of hanging hand tools', label: 'left wall of hanging hand tools', depthBand: 'midground', depthRank: 2, preserve: 'loose', materialHint: 'pegboard of tool silhouettes, no readable labels', mayRestyle: true, polygon: [[0, 120], [300, 180], [300, 700], [0, 820]], bbox: { x: 0, y: 120, w: 300, h: 700 }, notes: '' },
            { id: 'floor', role: 'workshop floor plane', label: 'workshop floor plane', depthBand: 'foreground', depthRank: 3, preserve: 'strict', materialHint: 'worn wood boards, shavings allowed, edges stay fixed', mayRestyle: true, polygon: [[0, 1024], [1536, 1024], [1236, 700], [300, 700]], bbox: { x: 0, y: 700, w: 1536, h: 324 }, notes: '' },
            { id: 'bench-top', role: 'workbench top surface', label: 'workbench top surface', depthBand: 'midground', depthRank: 4, preserve: 'strict', materialHint: 'heavy scarred wood slab, small parts scattered', mayRestyle: true, polygon: [[340, 640], [1100, 640], [1180, 760], [280, 760]], bbox: { x: 280, y: 640, w: 900, h: 120 }, notes: '' },
            { id: 'bench-front', role: 'workbench front face with drawers', label: 'workbench front face with drawers', depthBand: 'foreground', depthRank: 5, preserve: 'strict', materialHint: 'wood face, drawer shadows, no readable labels', mayRestyle: true, polygon: [[280, 760], [1180, 760], [1180, 940], [280, 940]], bbox: { x: 280, y: 760, w: 900, h: 180 }, notes: '' },
            { id: 'lantern', role: 'brass hurricane lantern on the bench - the light source', label: 'brass hurricane lantern on the bench - the light source', depthBand: 'midground', depthRank: 6, preserve: 'strict', materialHint: 'brass base and cap, glass chimney, carry hoop, warm flame, halo of light', mayRestyle: true, polygon: [[655, 420], [765, 420], [775, 638], [645, 638]], bbox: { x: 645, y: 420, w: 130, h: 218 }, notes: '' },
          ],
          characters: [],
          figures: [],
          protectedZones: [],
          overlayZones: [{ x: 56, y: 56, w: 380, h: 100, label: 'title safe area' }],
          renderBrief: {
            styleId: 'custom#ipms63',
            style: 'warm painterly workshop interior concept art, lantern-lit',
            mood: "quiet night, a maker's room mid-project, inviting and a little magical",
            lighting: 'single warm lantern glow pooling on the bench, cool blue night light from the window',
            lock: [],
            mustPreserve: ['camera angle', 'horizon and vanishing point', 'relative object positions', 'occlusion order', 'protected text/overlay zones'],
            mayInvent: ['wood grain, shavings and clamps', 'jars of small parts on shelves', 'tool silhouettes without readable labels', 'dust motes in the lantern halo', 'city bokeh outside the window'],
            negative: ['no readable text anywhere', 'do not move the bench or the lantern', 'do not block the window', 'no people'],
          },
        },
      },
    },
  },
];

// Briefs: exercises, not exhibits. The first is the assembler's own doctrine sentence made
// literal — "assembler makes a chariot; workbench makes chariot parts". The brief withholds the
// vocabulary on purpose: the agent pulls the cards and reads mint errors as the manual, which is
// the retrieval loop being practised. Nothing here is a solution.
const BRIEFS = [
  {
    id: 'the-chariot',
    title: 'The Chariot',
    kind: 'brief',
    shows:
      'The whole substrate in one object. A chariot is a composition of named parts: building one meets part-vs-whole, ' +
      'relations over coordinates, superposition as the honest exception, arraying, the two gates and iterate-in-place; ' +
      'taking it apart proves every piece was known; handing it on meets the persistence ladder and the borrowed-hands seam.',
    madeWith: [
      'mint_solid kind workbench — one mint per part (or one kind code program for repeated pieces)',
      'mint_solid kind assembler — the chariot, every item carrying an id',
      'update_sketch — the one fix, the exploded variant, the subtractions',
      'export_model — .glb and .stl',
      'optional rungs: scripts/export-godot.mjs (engine), request_mesh_render → pull → submit → accept (upscaler)',
    ],
    brief: [
      'A Roman racing biga at real scale a person could stand in. units: cm. What makes it read Roman: a D-shaped floor ' +
        'and breastwork open at the back, a rear-set axle, a draft pole ending in a two-horse yoke.',
      'Minimum pieces, each its own named part: two wheels, an axle, a bed, a breastwork or rail, a draft pole, a yoke. ' +
        'Hubs, spokes, felloes, tyre bands, a floor lattice are yours to add.',
      'Wheels seated on the ground by gravity. The bed bridges by superposition or seats on the axle — you decide, and say which.',
      'The chariot stands on the grid with stats.warnings empty.',
      'FIXED: the named pieces, the relations between them, real scale, and the Roman reading above.',
      'YOURS: proportion, spoke count, materials and tints, ornament, how the breastwork is built (loft, sweep, extrude), ' +
        'what bridges by superposition and what seats. Two signatures are MEANT to differ here; the expressiveness is the model\'s.',
    ],
    rules: [
      'Pull the vocabulary yourself: get_solid_vocab({ id: "workbench" }) and get_solid_vocab({ id: "assembler" }). This brief carries no solution. ' +
        'The composition principles live on those cards (the workbench\'s "Composition moves" and "Frames and arrays", the assembler\'s "Placement principles") — they are the whole doctrine, and the brief adds nothing to them.',
      'Read mint errors as the manual. A loud refusal is one call of cost; a silent guess is never corrected.',
      'stats is the MACHINE gate; the turntable (/api/sketches/<ref>/turntable.png or /world) is the EYES gate. Never claim the eyes gate from stats.',
      'The recipe is the artifact. Every render derives from it and can be thrown away.',
      'Signatures are compared on STRUCTURE, never on geometry: the same pieces present and named, wheels at base zero, ' +
        'the bed\'s placement mode declared, no warnings, a closed union, one flaw named in numbers and fixed in place. ' +
        'Nothing byte-for-byte; a different loft or a different ornament is a different model, not a different answer.',
      'One run-log line per phase: what you did, what the gate said, what you changed.',
    ],
    phases: [
      {
        id: 'C1', title: 'Parts on the bench',
        do: 'One mint_solid kind workbench per part, or one kind code program for the repeated pieces. A part is one subject; the chariot is not a part.',
        machine: 'Each part mints; its stats.warnings is empty.',
        eyes: 'None yet. Parts are not judged alone.',
      },
      {
        id: 'C2', title: 'Assemble',
        do: 'One mint_solid kind assembler with an id on EVERY item. Seat by relation (on / gap); superpose only what bridges.',
        machine: 'stats.parts[] names every brief piece; the wheels report baseZ 0; the bed reports its placement mode; stats.warnings is empty.',
        eyes: 'Look at the turntable. Name ONE flaw in numbers. Fix it with one update_sketch on the same ref.',
      },
      {
        id: 'C3', title: 'Deconstruct',
        do: '(a) Narrate the bill of materials from the recipe and stats.parts[]: id, monomer kind, size, support. ' +
          '(b) Mint an EXPLODED side-by-side variant LAST, from the recipe you will file, changing only placement fields (at / gap). ' +
          'If you touch the chariot afterwards, re-mint the variants: a variant of an earlier chariot deconstructs nothing. ' +
          '(c) Subtract: remove the pole and re-render, then the wheels; say what each remainder is.',
        machine: 'Every variant\'s item sources match the filed recipe by id; only at / gap differ (list the changed fields; ' +
          'diff_sketches reads assembler manifests as too_different by design, so compare the rows). An `on` relation seats z only — ' +
          'an exploded part still `on` its support but moved away in x hovers; give it its own ground.',
        eyes: 'The exploded view reads as the same pieces, separated.',
      },
      {
        id: 'C4', title: 'Hand it on',
        do: 'export_model as glb and as stl. Optional rung: an engine pack (scripts/export-godot.mjs --ref). Optional rung: the mesh upscaler ' +
          '(request_mesh_render → pull_mesh_render → an external sculptor → submit_mesh_render → accept_mesh_render by a DIFFERENT source). ' +
          'A missing binary or sculptor degrades the rung, never the exercise — say which rungs ran.',
        machine: 'Bytes and triangle count; the closure advisory; the size gate on any sculpted mesh.',
        eyes: 'The sculpted mesh keeps the silhouette and the wheel count.',
      },
      {
        id: 'C5', title: 'File the signature',
        do: 'add_work with answersBrief "the-chariot", id chariot-<host>-<YYYYMMDD>, the recipe { tool: "mint_solid", input: { kind: "assembler", ref, title, spec } } ' +
          'with the ref pinned, the story (the flaw you named and the fix), a `shows` line that names the STYLE CHOICES you made ' +
          '(how the breastwork is built, the ornament, the materials) since that is the part meant to differ between signatures, ' +
          'and 2-3 asks an operator could say tomorrow.',
        machine: 'The filed recipe re-mints under its pinned ref on any mojulo host.',
        eyes: 'A different host\'s agent tours your signature and names every piece cold. That is the agent-agnostic proof.',
      },
    ],
    filing: { idPattern: 'chariot-<host>-<YYYYMMDD>', answersBrief: 'the-chariot' },
    sampleAsks: [
      'build me a chariot from parts and then take it apart',
      'assemble a <complex thing> from workbench parts, every piece named',
      'explode this assembly so I can see every piece on its own',
    ],
  },
  {
    id: 'the-v8',
    title: 'The V8',
    kind: 'brief',
    shows:
      'The chariot brief with the dial turned up: a machine whose parts REPEAT (eight of everything), MIRROR (two banks), and ' +
      'meet on TILTED faces (bolted, not stacked). Building one meets the code kind, field-space cuts, flip, and superposition ' +
      'as the rule rather than the exception; blowing it apart proves every piece; the hand-on rung is a lit Blender frame with real metals.',
    madeWith: [
      'mint_solid kind workbench — the block as a field solid (banks by transform, bores by repeat + subtract), pan, manifold, damper, flywheel',
      'mint_solid kind code — one program for the pistons and rods, one for the crankshaft (a loop, not a list)',
      'mint_solid kind assembler — one bank authored, the second placed with flip; every item carrying an id',
      'update_sketch — the fix, the blow-apart variant',
      'export_model glb; scripts/export-blender.mjs (pack + gate); scripts/blender-bake.mjs --render (a Cycles frame with the named metals)',
    ],
    brief: [
      'A V8 engine at real scale — a small block, roughly 10 cm bore, 9 cm stroke, 90-degree banks. units: cm.',
      'Minimum pieces, each its own named part: block, crankshaft, pistons, connecting rods, two cylinder heads, two valve covers, intake manifold, ' +
        'two exhaust headers, oil pan, a front damper, a flywheel. Pistons and rods may share one part when a program makes them.',
      'Repeated pieces come from a PROGRAM (kind code) or a field repeat, never from a list typed eight times.',
      'The banks are mirror images: author one bank, place it twice — the second with flip. Never re-author a bank.',
      'Bolted, not stacked: most engine joints meet tilted faces. Superpose those with a jut, and say which joints you seated by gravity.',
      'Give every part a named metal (steel, gunmetal, chrome, aluminium-toned tint …) so the lit frame can tell them apart.',
      'The engine stands on the grid with stats.warnings empty.',
    ],
    rules: [
      'Pull the vocabulary yourself: get_solid_vocab({ id: "workbench" }), { id: "code" }, { id: "assembler" }. The composition principles on those cards are the whole doctrine; this brief adds nothing to them.',
      'Read mint errors as the manual; read a code program\'s captured log the same way.',
      'stats is the MACHINE gate; the turntable is the EYES gate. Never claim the eyes gate from stats. Only the eyes gate checks contact at a joint.',
      'The recipe is the artifact. Every render derives from it and can be thrown away.',
      'One run-log line per phase: what you did, what the gate said, what you changed.',
    ],
    phases: [
      {
        id: 'V1', title: 'Parts on the bench',
        do: 'One workbench per part. The block as a field solid. A code program for the pistons and rods (position each piston from its crank angle), another for the crankshaft (journals and webs from one loop).',
        machine: 'Each part mints with warnings empty; each program\'s log reads clean.',
        eyes: 'Look at the block and the crank alone before assembling — a program that returns nonsense renders nonsense.',
      },
      {
        id: 'V2', title: 'Assemble',
        do: 'One assembler with an id on EVERY item. One bank of heads, covers and headers placed twice, the second with flip.',
        machine: 'stats.parts[] names every brief piece; the pan reports baseZ 0; superposed items say so; warnings empty.',
        eyes: 'Turntable. Name ONE flaw in numbers (a head not meeting its deck, a rod missing its journal). Fix it with one update_sketch.',
      },
      {
        id: 'V3', title: 'Blow it apart',
        do: 'Mint a side-by-side variant whose only differences are placement fields: heads and covers out along their bank axes, the pan down, the crank out the front. Then subtract: remove the heads and re-render; remove the crank.',
        machine: 'The blown-apart variant differs only in at / gap; list the changed fields.',
        eyes: 'The blown-apart view reads as the same pieces, separated, each still named.',
      },
      {
        id: 'V4', title: 'Hand it on, lit',
        do: 'export_model glb. Then the Blender rung: scripts/export-blender.mjs --ref (pack + machine gate), and scripts/blender-bake.mjs --ref --render for a Cycles frame of the assembled engine and one of the blown-apart variant. No Blender resolves → the pack and the guide are the product; say so.',
        machine: 'glb bytes and triangles; the Blender gate report; a frame written under outcomes/<ref>/.',
        eyes: 'In the lit frame every named metal is distinguishable and every joint reads as a joint.',
      },
      {
        id: 'V5', title: 'File the signature',
        do: 'add_work with answersBrief "the-v8", id v8-<host>-<YYYYMMDD>, the recipe { tool: "mint_solid", input: { kind: "assembler", ref, title, spec } } with the ref pinned, the story (the flaw and the fix), and 2-3 asks.',
        machine: 'The filed recipe re-mints under its pinned ref on any mojulo host.',
        eyes: 'A different host\'s agent tours your signature and names every piece cold.',
      },
    ],
    filing: { idPattern: 'v8-<host>-<YYYYMMDD>', answersBrief: 'the-v8' },
    sampleAsks: [
      'build me a V8 from parts, then blow it apart',
      'script the pistons and rods instead of listing them eight times',
      'render this assembly in Blender with real metals',
    ],
  },
];

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { toured: [], addedWorks: [] };
  }
}

function saveState(state) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function allWorks(state) {
  return [...WORKS, ...BRIEFS, ...(state.addedWorks || [])];
}

const isBrief = (work) => work && work.kind === 'brief';
const signaturesOf = (works, briefId) => works.filter((w) => w.answersBrief === briefId);

function briefSteps(work, signatures) {
  const asks = work.sampleAsks.map((a) => `"${a}"`).join(', ');
  const phaseLines = work.phases.map(
    (p) => `   ${p.id} — ${p.title}. DO: ${p.do} MACHINE EXIT: ${p.machine} EYES EXIT: ${p.eyes}`
  );
  const filed = signatures.length
    ? `Signatures already filed: ${signatures.map((s) => `${s.id} (${s.title})`).join(', ')}. ` +
      `To run the cross-agent proof on one, get_work with its id and perform C3 on THAT recipe.`
    : 'No signatures filed yet — yours would be the first.';
  return [
    `Run this brief for the operator — consent, then build, deconstruct, hand on, file:`,
    ``,
    `1. CONSENT FIRST — be explicit: "This is an exercise, not an exhibit. It mints SEVERAL real rows into YOUR sketches DB — ` +
      `each part, the chariot, an exploded variant — yours to keep or delete. The recipes are the point; every render is disposable. OK to begin?" ` +
      `Respect the answer; do not re-ask. IF DECLINED — mint nothing; hand over the asks (step 5) and stop. It is the operator's workshop from there.`,
    `2. THE BRIEF — intent only, never a solution:`,
    ...work.brief.map((b) => `   • ${b}`),
    `3. THE RULES:`,
    ...work.rules.map((r) => `   • ${r}`),
    `4. THE PHASES, in order — each borrows a hand the previous one earned. Say which gate ran and what it saw; never claim the eyes gate passed on the operator's behalf.`,
    ...phaseLines,
    `5. THE ASKS THAT MAKE THIS — hand over the request patterns, e.g. ${asks} — phrased so the operator could say one tomorrow with no context.`,
    `6. FILE — ${work.phases[work.phases.length - 1].do} ${filed}`,
    ``,
    `Then call mark_toured with outcome 'minted' (the exercise ran) or 'declined'. A brief run without the teach-back oriented nobody.`,
  ].join('\n');
}

function tourSteps(work) {
  const asks = work.sampleAsks.map((a) => `"${a}"`).join(', ');
  const recipeBytes = work.recipe ? JSON.stringify(work.recipe.input).length : null;
  const mintLine = work.recipe
    ? `mint it NOW: call ${work.recipe.tool} with the carried recipe.input exactly as given (the ref is pinned — ` +
      `an "already exists" error means a previous session minted it; that is success, just fetch it). Narrate the ` +
      `one call as it happens — the operator watching ask become artifact is the exhibit.`
    : `this work carries no recipe (session-added) — fetch ${work.urls.page} and show it.`;
  return [
    `Tour this work for the operator — consent, then create, then teach:`,
    ``,
    `1. CONSENT FIRST — be explicit: "To show you this, I'll create a real artifact: this recipe` +
      (recipeBytes ? ` (${recipeBytes} bytes of JSON)` : '') +
      ` mints into YOUR sketches DB as ${work.ref} — a tiny row, yours to keep or delete. Watching the loop happen is the point. OK to mint?" Then respect the answer; do not re-ask.`,
    `2. IF ACCEPTED — ${mintLine} Then fetch the render (${work.urls.png || work.urls.page}) and SHOW it. A gallery is looked at, not described.`,
    `3. IF DECLINED — mint NOTHING. Just explain what would have happened: this recipe would become a row at ${work.urls.page}; renders (${Object.keys(work.urls).join(', ')}) derive from it on demand; it would persist after this chat and re-mint identically on any mojulo host. Then go to step 5, skip step 6, and stop — it is the operator's workshop from there.`,
    `4. WHAT IT SHOWS IS POSSIBLE — ${work.shows}`,
    `5. THE ASKS THAT MAKE THIS — hand over the request patterns, e.g. ${asks} — phrased so the operator could say one tomorrow with no context. How it was made, one line each, no internals: ${work.madeWith.join('; ')}.${work.story ? ` If the story helps, use it: ${work.story}` : ''}`,
    `6. OFFER (accepted path only) — ask if they want one of these made from something of THEIRS, right now. If yes, do that with the real mojulo tools; that artifact is theirs, not an exercise.`,
    ...(work.paintNote ? [``, `Paint seam: ${work.paintNote}`] : []),
    ...(work.answersBrief
      ? [
          ``,
          `Signature: this work answers the brief '${work.answersBrief}'. After showing it, run that brief's DECONSTRUCT phase on THIS recipe — ` +
            `name every piece from the recipe and stats.parts[] (id, monomer kind, size, support), then say what an exploded variant would move. ` +
            `A piece you cannot name is the finding. That is the cross-agent proof: the recipe travelled, and every part of a stranger's chariot was knowable. ` +
            `Set it beside its sibling signatures on STRUCTURE alone (the pieces, the relations, the gates), never on geometry: the expressiveness is each model's own.`,
        ]
      : []),
    ``,
    `Then call mark_toured with outcome 'minted' or 'declined'. A work toured without the asks handed over oriented nobody.`,
  ].join('\n');
}

const TOOLS = [
  {
    name: 'get_work',
    description:
      'Get the next untoured work from the orientation gallery (or a specific one by id). An EXHIBIT is carried as the ' +
      'RECIPE that mints it (pinned stable ref, deterministic on any mojulo host) plus what it shows is possible and the ' +
      'one-line asks that make that kind of thing. A BRIEF (e.g. "the-chariot") is an exercise instead: intent, phases with ' +
      'machine and eyes exits, rules, and how to file the resulting SIGNATURE. Both are consent-first: orientation CREATES ' +
      'real artifacts to show the loop — the operator may accept (mint live, show the render) or reject (mint nothing; ' +
      'explain what would happen, hand over the asks, and stop — it is their workshop from there).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Work id (e.g. "the-seam"). Omit for the next untoured work.' },
      },
    },
  },
  {
    name: 'mark_toured',
    description:
      'Record that a work was toured: consent asked, minted or declined, asks handed over. The loop’s output is an ' +
      'operator who knows how to ask.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Work id.' },
        outcome: { type: 'string', enum: ['minted', 'declined'], description: 'Did the operator accept the mint?' },
        note: { type: 'string', description: 'Optional: operator reaction / what they asked for next.' },
      },
      required: ['id', 'outcome'],
    },
  },
  {
    name: 'add_work',
    description:
      'Grow the gallery: add a notable finished work (operator-blessed) to the orientation corpus so future sessions tour it. ' +
      'Provide the same shape the built-in works carry: what it shows is possible, how it was made, and the asks that make it. ' +
      'Optionally include the recipe { tool, input } (with a pinned ref in input) so the work stays re-mintable on any host.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Short kebab-case id.' },
        title: { type: 'string' },
        ref: { type: 'string', description: 'The sketch ref (sk_…).' },
        urls: { type: 'object', description: 'At least { page }; add png/world/glb routes when they exist.' },
        shows: { type: 'string', description: 'One sentence: the capability family this work proves.' },
        madeWith: { type: 'array', items: { type: 'string' } },
        story: { type: 'string', description: 'One line of make-of, including any instructive failure.' },
        sampleAsks: { type: 'array', items: { type: 'string' }, description: '2-3 operator-phrased asks.' },
        recipe: { type: 'object', description: 'Optional { tool, input } — the exact mint call, input carrying the pinned ref, so the work re-mints deterministically.' },
        answersBrief: { type: 'string', description: "Optional: the brief this work is a SIGNATURE of (e.g. 'the-chariot'). Signatures group under their brief and are toured with its deconstruction phase." },
      },
      required: ['id', 'title', 'ref', 'shows', 'madeWith', 'sampleAsks'],
    },
  },
  {
    name: 'list_works',
    description: 'The whole gallery with toured state — founding series plus session-added works.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function callTool(name, args = {}) {
  const state = loadState();
  const schema = TOOLS.find((t) => t.name === name)?.inputSchema.properties || {};
  const unknown = Object.keys(args).filter((k) => !schema[k]);
  // Silence teaches nothing (the 0719 lesson): always name ignored params.
  const note = unknown.length ? `\n\n(note: ignored unknown param(s): ${unknown.join(', ')})` : '';
  const works = allWorks(state);
  const touredIds = new Set(state.toured.map((t) => t.id));

  if (name === 'get_work') {
    const work = args.id ? works.find((w) => w.id === args.id) : works.find((w) => !touredIds.has(w.id));
    if (!work && args.id) return `No work "${args.id}". Ids: ${works.map((w) => w.id).join(', ')}` + note;
    if (!work)
      return (
        'Gallery fully toured. list_works has the record; add_work grows the corpus when a new piece earns a place.' + note
      );
    const progress = `${touredIds.size}/${works.length} toured`;
    if (isBrief(work)) {
      const signatures = signaturesOf(works, work.id).map((s) => ({ id: s.id, title: s.title, ref: s.ref, story: s.story }));
      return JSON.stringify({ work, signatures, progress, tour: briefSteps(work, signatures) }, null, 2) + note;
    }
    return JSON.stringify({ work, progress, tour: tourSteps(work) }, null, 2) + note;
  }

  if (name === 'mark_toured') {
    const work = works.find((w) => w.id === args.id);
    if (!work) return `No work "${args.id}". Ids: ${works.map((w) => w.id).join(', ')}` + note;
    state.toured.push({ id: args.id, outcome: args.outcome, note: args.note || null, at: new Date().toISOString() });
    saveState(state);
    const remaining = works.filter((w) => !new Set(state.toured.map((t) => t.id)).has(w.id)).map((w) => w.id);
    return `Recorded (${args.outcome}). Remaining untoured: ${remaining.length ? remaining.join(', ') : 'none.'}` + note;
  }

  if (name === 'add_work') {
    if (works.some((w) => w.id === args.id)) return `A work with id "${args.id}" already exists.` + note;
    if (args.answersBrief && !BRIEFS.some((b) => b.id === args.answersBrief)) {
      return `No brief "${args.answersBrief}". Briefs: ${BRIEFS.map((b) => b.id).join(', ')}` + note;
    }
    const work = {
      id: args.id, title: args.title, ref: args.ref, urls: args.urls || { page: `/sketches/${args.ref}` },
      shows: args.shows, madeWith: args.madeWith, story: args.story || '', sampleAsks: args.sampleAsks,
      ...(args.recipe && typeof args.recipe === 'object' ? { recipe: args.recipe } : {}),
      ...(args.answersBrief ? { answersBrief: args.answersBrief } : {}),
    };
    state.addedWorks = [...(state.addedWorks || []), work];
    saveState(state);
    const signed = args.answersBrief
      ? ` Filed as a signature answering '${args.answersBrief}' (${signaturesOf(allWorks(state), args.answersBrief).length} so far).`
      : '';
    return `Added "${args.title}" to the gallery (${allWorks(state).length} works). Future sessions will tour it.${signed}` + note;
  }

  if (name === 'list_works') {
    return (
      JSON.stringify(
        {
          works: works.map((w) => ({
            id: w.id, title: w.title, kind: isBrief(w) ? 'brief' : 'exhibit', ...(w.ref ? { ref: w.ref } : {}), shows: w.shows,
            remintable: !!w.recipe, ...(w.answersBrief ? { answersBrief: w.answersBrief } : {}), toured: touredIds.has(w.id),
          })),
          signatures: Object.fromEntries(BRIEFS.map((b) => [b.id, signaturesOf(works, b.id).map((s) => s.id)])),
          toured: state.toured,
        },
        null,
        2
      ) + note
    );
  }

  throw new Error(`unknown tool: ${name}`);
}

// ---- newline-delimited JSON-RPC 2.0 over stdio ----

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    handle(msg);
  }
});

function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    respond(id, {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'mojulo-orient', version: '0.4.0' },
      instructions:
        'The mojulo orientation gallery — practical orientation by exhibit, the doing-sibling of forward_context. ' +
        'A curated catalog of founding works, each carried as the RECIPE that mints it deterministically on any host. ' +
        'Touring a work is consent-first: tell the operator plainly that orientation will CREATE a real artifact in ' +
        'their sketches DB to show the loop, and let them accept or reject. Accepted: mint it live through the real ' +
        'mojulo MCP, show the render, teach the asks, offer to make one of their own. Rejected: mint nothing — explain ' +
        'what would have happened, hand over the asks, and stop; it is the operator’s workshop from there. Never ' +
        'pushed — reach for get_work when the operator wants to know what mojulo can do.',
    });
  } else if (String(method || '').startsWith('notifications/')) {
    // notifications carry no id and expect no response
  } else if (method === 'ping') {
    respond(id, {});
  } else if (method === 'tools/list') {
    respond(id, { tools: TOOLS });
  } else if (method === 'tools/call') {
    try {
      const text = callTool(params.name, params.arguments || {});
      respond(id, { content: [{ type: 'text', text }] });
    } catch (err) {
      respond(id, { content: [{ type: 'text', text: `error: ${err.message}` }], isError: true });
    }
  } else if (id !== undefined) {
    respondError(id, -32601, `method not found: ${method}`);
  }
}
