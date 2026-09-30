/**
 * floorplan-furnish characterization net (room-realism.plan.md, phase 0 gate).
 *
 * Hash-pins the furnished output of every LEGACY floorplan path that the
 * room-realism phases must leave byte-identical: a generated (seed) plan, an
 * explicit multi-cell plan with an interior door, and the stacked house. The
 * one-cell furnished plan is deliberately NOT pinned here — it is the case the
 * phases change on purpose (see floorplan-onecell.test.js for its behaviour).
 *
 * Re-pinning is legitimate ONLY alongside a plan phase that says the legacy
 * output changes (the emit-channels.char.test.js contract).
 *
 * Re-pin log:
 *   - phase 2 (2026-09-05): the planner (room-scene-elements.js normalizeElement)
 *     dropped an element's `asset`, so a lounge's `asset: 'modern-couch'` sofa
 *     had always rendered as its box-net card. Carrying `asset` through is the
 *     fix that lets phase 2's meshes dispatch at all; as a side effect every
 *     feet-mode lounge now gets the workbench couch its arranger has asked for
 *     since day one. Pins A and B (both hold a lounge) re-based; C unchanged.
 *   - living-room pass (2026-09-05): sofa metre-caps removed so a feet-scale
 *     lounge sofa keeps arm/back thickness; club chairs instance-named; a floor
 *     lamp added to the L arranger. Pins A and B re-based; C unchanged.
 *   - phase 3 (2026-09-05): every box-net furniture face now carries `outNormal`
 *     (export-only — the GLB NORMAL attribute + the Blender bake's facing; no
 *     shading reads it), and a local asset's authored normals turn with the
 *     piece; sweep tubes (the couch's wrinkle lines) author theirs too. Same face
 *     counts, new JSON. A and B re-based; C unchanged.
 *   - couch facing (2026-09-06, lit-handoff.plan.md log): the lounge sofa faces the
 *     television — the L arranger stamps `facing: 'S'` and `modern-couch` becomes a
 *     `local: true` maker (built centred / front +y, mapped through localToFootprint)
 *     so the planner's spin reaches it. Unspun placement is the same geometry to
 *     ~1e-15 (the builder now adds the centre last), so the JSON differs by float
 *     ordering as well as by the turned sofa. A and B re-based; C unchanged.
 *   - sweep start cap (2026-09-08, print-loop-demo): a sweep's START cap was wound
 *     inside-out (both lids shared one winding); `sweep-faces.js` now flips it like
 *     the extrude does. Same face counts, the cap corners of every capped sweep
 *     (the lamp, the couch's wrinkle lines) in the corrected order. A and B re-based;
 *     C unchanged.
 *   - one quadrant of trig (2026-09-18): these two pins held on Apple silicon and
 *     failed on x86 CI, and the whole difference was five `outNormal` components one
 *     ULP apart. V8's argument reduction for Math.sin/cos past π/2 is not bit-identical
 *     across CPU targets — Math.sin(π + π/8) differs between arm64 and x64 on one V8
 *     build — and `roundedRectPath` (extrude-faces.js) asked for all four corner arcs
 *     by absolute angle. It now takes one quadrant and turns it by exact sign swaps,
 *     so the rounded-rect profile, and these pins, are the same bytes on either
 *     architecture (verified arm64 + x64). Same face counts. A and B re-based;
 *     C unchanged.
 *   - room livability defaults (2026-09-25, the operator's "rooms and corridors feel
 *     narrow" pass; CHANGELOG-2.x.md "Room livability"): the house planners' defaults rose —
 *     MIN_ROOM 9→10 ft with the BSP cut clamped so no room falls under it, corridor and
 *     landing halls 3.5/3.75→4.5 ft, bedroom band 10→11 ft, stair 3→3.5 ft, door
 *     approach 2.5→3 ft — and the furnish pass changed on purpose: the command-position
 *     door edge is read off the geometry, a quarter-turned room is arranged at its
 *     swapped dims with its seat facings turned the right way (E/W doors used to turn
 *     every sofa and chair away from its table), the kitchen run takes a door-free wall,
 *     dining end chairs need pull-out room, the lounge sofa clears the door approach,
 *     rugs survive door approaches, and an interior door leaf swings into a room (never
 *     out across a hall; between rooms, into the smaller). A: seed 7 now tiles a kitchen (4166→12051 faces,
 *     the kitchen assets). B: the lounge finds its door and takes command position
 *     (3134→3164). C: the stacked house's wider hall and stair (same count, new bytes).
 *   - furniture audit (2026-09-26, CHANGELOG-2.x.md "Furniture audit"): an interior door leaf now
 *     stands open flat against the wall beside its jamb, with two panels and a lever handle
 *     (three more boxes, +15 faces per hinged interior door: A +75 for five doors, B +15, C +30);
 *     and a wall-hung piece's anchor keeps its height through the layout spin (its along
 *     fraction mirrors, its height no longer flips). A, B and C re-based.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { structurizeFloorplan, structurizeHouse } from './floorplan-structure.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('floorplan furnish characterization (legacy paths byte-identical)', () => {
  it('generated seed plan, furnish:true', () => {
    const s = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true });
    expect(s.faces.length).toBe(12126);
    // The kitchen sink's faucet is a 16-sided sweep (sweep-faces.js).
    // Output of a 2.1.0 generator that differs by CPU: V8 rounds sin(9π/8) one way on x64 and the other on arm64, and 2.1.0 builders keep
    // Math so their bytes do not move (util/math-scope.js); so this pin is per architecture (none recorded elsewhere).
    const PIN = { x64: 'ad42369be44405af4a739ac58c50cbcc23c823ae1595d93f1c02014bf6d35fd8', arm64: '4e11a2645c36277369527b368356109361eefa0ff7945b4770bb985fed63da22' };
    if (PIN[process.arch]) expect(sha(s.faces)).toBe(PIN[process.arch]);
  });

  it('explicit two-cell plan with an interior door, furnish:true', () => {
    const s = structurizeFloorplan({
      width: 30, height: 12,
      rooms: [{ x: 0, y: 0, w: 15, h: 12, glyph: 'L' }, { x: 15, y: 0, w: 15, h: 12, glyph: 'B' }],
      doors: [{ x: 15, y: 6, room: 1, edge: 'W' }],
    }, { furnish: true });
    expect(s.faces.length).toBe(3179);
    expect(sha(s.faces)).toBe('34934227a462203a3f2590aedd273abdcd5017fec1cbf88e8d61d4c52ecfae66');
  });

  it('stacked house, cutaway (furnish defaults on)', () => {
    const s = structurizeHouse({ seed: 7, width: 40, height: 30 }, { view: 'cutaway' });
    expect(s.faces.length).toBe(268);
    expect(sha(s.faces)).toBe('0b5c211bebc9256d7d8edc253d730460247e47a25b8eac0ac27754b1582bf35f');
  });
});
