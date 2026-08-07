import { describe, expect, it } from 'vitest';

import { SketchRepository } from '../../db/repositories/sketches.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveWorldScene } from './world-scene.js';

// ── the DRIVE proving ground, resolved + emitted (drivable-vehicles.plan.md D4) ──────────────────
// Runs only when scripts/mint-drive-world.mjs has minted the refs into this DB — a fresh checkout
// skips instead of failing. Proves the REAL page path: vehicleRef → bakeVehicleRig → figure-rig
// delivery → the emitted controllable channel carrying the drive rule.

const WORLD_REF = 'sk_veh_drive_proving_ground';
const sketch = SketchRepository.getByRef(WORLD_REF);

describe.runIf(!!sketch?.manifest)('drive proving ground (minted world → emitted page)', () => {
  it('resolves the vehicleRef into a packed vehicle rig and emits the drivable page', async () => {
    const { payload, kind } = await resolveWorldScene(sketch);
    expect(kind).toBe('controllable');
    const fig = payload.figures?.sedan;
    expect(fig?.rig).toBe(true);
    expect(fig.model).toBe('vehicle');
    expect(fig.bones.map((b) => b.id)).toEqual(['root', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']);
    expect(fig.clips.roll?.k).toBeGreaterThan(0);
    expect(fig.yaw).toBeCloseTo(-Math.PI / 2, 6);       // authored +y nose → heading-forward

    const html = emitThreeWorld(payload);
    expect(html).toContain('__CW.createWorld');          // the controllable channel is live
    expect(html).toMatch(/"type":\s*"drive"/);           // the drive rule reached the page
    expect(html).toMatch(/"figure":\s*"sedan"/);         // bound to the figure-rig body
    expect(html).toMatch(/"pilotable":\s*true/);         // walk up, T to board
    expect(html).toMatch(/"type":\s*"fly"/);              // the plane is aboard too

    // TRIPWIRE: the emitted IN-PAGE script must PARSE — template-literal edits (the pad trigger
    // remap, the tilt sync) break inside the string where node --check of the emitter is blind.
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter((m) => !/type=/.test(m[1]) || /text\/javascript|module/.test(m[1]));
    expect(scripts.length).toBeGreaterThan(0);
    for (const m of scripts) {
      // module scripts: drop the import statements (syntax-only check; free identifiers are fine)
      const body = m[2]
        .replace(/^\s*import[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]*['"];?\s*$/gm, '');
      expect(() => new Function(body)).not.toThrow();
    }
  });
});
