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
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { structurizeFloorplan, structurizeHouse } from './floorplan-structure.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('floorplan furnish characterization (legacy paths byte-identical)', () => {
  it('generated seed plan, furnish:true', () => {
    const s = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true });
    expect(s.faces.length).toBe(4166);
    expect(sha(s.faces)).toBe('556dd37c41d9e8f996b8839ba5d34a204e3ac6d82dd7e8fdad2b2121034bffb3');
  });

  it('explicit two-cell plan with an interior door, furnish:true', () => {
    const s = structurizeFloorplan({
      width: 30, height: 12,
      rooms: [{ x: 0, y: 0, w: 15, h: 12, glyph: 'L' }, { x: 15, y: 0, w: 15, h: 12, glyph: 'B' }],
      doors: [{ x: 15, y: 6, room: 1, edge: 'W' }],
    }, { furnish: true });
    expect(s.faces.length).toBe(3134);
    expect(sha(s.faces)).toBe('5a81b3793079b782b944ca07c2e6494231cce367b62439e79cee7f47ed915859');
  });

  it('stacked house, cutaway (furnish defaults on)', () => {
    const s = structurizeHouse({ seed: 7, width: 40, height: 30 }, { view: 'cutaway' });
    expect(s.faces.length).toBe(238);
    expect(sha(s.faces)).toBe('212698d927e276571dd366a828b138f81a941bde05c9854aa5c9824fc6852030');
  });
});
