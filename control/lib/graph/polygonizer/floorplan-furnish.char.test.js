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
 *     narrow" pass; CHANGELOG "Room livability"): the house planners' defaults rose —
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
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { structurizeFloorplan, structurizeHouse } from './floorplan-structure.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('floorplan furnish characterization (legacy paths byte-identical)', () => {
  it('generated seed plan, furnish:true', () => {
    const s = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true });
    expect(s.faces.length).toBe(12051);
    expect(sha(s.faces)).toBe('d6d30cf6cbd9c6f7077fae77d82b7ca658c85fdd48b95fd2a860ad8bfaf85bc3');
  });

  it('explicit two-cell plan with an interior door, furnish:true', () => {
    const s = structurizeFloorplan({
      width: 30, height: 12,
      rooms: [{ x: 0, y: 0, w: 15, h: 12, glyph: 'L' }, { x: 15, y: 0, w: 15, h: 12, glyph: 'B' }],
      doors: [{ x: 15, y: 6, room: 1, edge: 'W' }],
    }, { furnish: true });
    expect(s.faces.length).toBe(3164);
    expect(sha(s.faces)).toBe('8cff9cc18e739aac79cdc9b01ba161651de6b1c1a918649b1ea9ede9e1b8834a');
  });

  it('stacked house, cutaway (furnish defaults on)', () => {
    const s = structurizeHouse({ seed: 7, width: 40, height: 30 }, { view: 'cutaway' });
    expect(s.faces.length).toBe(238);
    expect(sha(s.faces)).toBe('4a03a70310fb79ffff2faefb85fd9e3fa9d34cb344e228a82966845a8e322e54');
  });
});
