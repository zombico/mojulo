import { describe, it, expect } from 'vitest';
import { measureFidelity, makeCamera, pngSize } from './fidelity.js';
import { SIXTH_GEN, SIXTH_GEN_REFERENCES, SIXTH_GEN_REFERENCE_IDS } from './sixth-gen.js';
import { buildDungeonFaces, planDungeon } from '../architecture/dungeon-designer.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { heroRecord, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';

const frame = { width: 160, height: 112 };
// a square wall of n×n quads facing −y at y = d, spanning x,z ∈ [−s, s]
function wall(n, s = 2, d = 4, uvPerM = 0.5, texture = null) {
  const faces = [], step = (2 * s) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -s + i * step, z0 = -s + j * step, x1 = x0 + step, z1 = z0 + step;
    const corners = [[x0, d, z0], [x0, d, z1], [x1, d, z1], [x1, d, z0]];   // wound to face the camera at the origin
    faces.push({ corners, ...(texture ? { texture, uv: corners.map((c) => [c[0] * uvPerM, c[2] * uvPerM]) } : {}) });
  }
  return faces;
}
const camera = { eye: [0, 0, 0], target: [0, 1, 0], fovY: 55 };

describe('measureFidelity', () => {
  it('the camera puts the target at the frame centre', () => {
    const c = makeCamera(camera, frame), p = c.project(c.view([0, 3, 0]));
    expect(p[0]).toBeCloseTo(80); expect(p[1]).toBeCloseTo(56); expect(p[2]).toBeCloseTo(3);
  });
  it('a finer mesh over the same pixels reads denser; the ratio is cast ÷ world', () => {
    const r = measureFidelity({ cast: [wall(8, 1, 3)], world: [wall(4)], camera, frame });
    expect(r.cast.pixels).toBeGreaterThan(0); expect(r.world.pixels).toBeGreaterThan(0);
    expect(r.cast.trianglesPerKpx).toBeGreaterThan(r.world.trianglesPerKpx);
    expect(r.ratio.triangles).toBeCloseTo(r.cast.trianglesPerKpx / r.world.trianglesPerKpx, 2);
  });
  it('the nearer layer owns the pixels it covers (z-buffer); faces draw double-sided', () => {
    const near = measureFidelity({ cast: [wall(2, 2, 3)], world: [wall(2, 2, 4)], camera, frame });
    const alone = measureFidelity({ cast: [], world: [wall(2, 2, 4)], camera, frame });
    expect(near.world.pixels).toBeLessThan(alone.world.pixels);
    const flipped = wall(2).map((f) => ({ corners: [...f.corners].reverse() }));
    expect(measureFidelity({ world: [flipped], camera, frame }).world.pixels).toBe(measureFidelity({ world: [wall(2)], camera, frame }).world.pixels);
  });
  it('texels per pixel doubles when the tile repeats twice as often', () => {
    const px = () => [128, 128];
    const a = measureFidelity({ world: [wall(1, 2, 4, 0.5, 't')], camera, frame, texturePx: px }).world.texelsPerPixel;
    const b = measureFidelity({ world: [wall(1, 2, 4, 1.0, 't')], camera, frame, texturePx: px }).world.texelsPerPixel;
    expect(b / a).toBeCloseTo(2, 1);
    expect(measureFidelity({ world: [wall(1)], camera, frame }).world.texelsPerPixel).toBeNull();
  });
  it('a part behind the camera is clipped, not mirrored', () => {
    expect(measureFidelity({ world: [wall(2, 2, -4)], camera, frame }).world.pixels).toBe(0);
  });
  it('is deterministic', () => {
    const run = () => JSON.stringify(measureFidelity({ cast: [wall(6, 1, 3)], world: [wall(3)], camera, frame }));
    expect(run()).toBe(run());
  });
  it('pngSize reads a tile size from its data URL', () => {
    expect(pngSize(surfaceTexture('rock-cave'))).toEqual([256, 256]);
    expect(pngSize('nope')).toBeNull();
  });
});

describe('the sixth-gen era card', () => {
  it('names the four reference titles, each with setting, kit, surfaces, light and air', () => {
    expect(SIXTH_GEN_REFERENCE_IDS).toEqual(['dmc3', 'colosseum', 'sunshine', 'mgs3']);
    for (const id of SIXTH_GEN_REFERENCE_IDS) {
      const r = SIXTH_GEN_REFERENCES[id];
      for (const k of ['title', 'setting', 'kit', 'surfaces', 'palette', 'light', 'air']) expect(r[k], `${id}.${k}`).toBeTruthy();
    }
    expect(SIXTH_GEN.frame).toEqual({ width: 640, height: 448, fovY: 55 });
  });
});

// The BASELINE (phase 1): an anime hero standing in the textured ps2 cave, seen from 2.4 m at the era's frame.
// It pins nothing about the ratio yet — the target is chosen from this readout and the eyes gate.
describe('baseline: hero in the ps2 cave', () => {
  it('reads out a cast-over-world ratio at 640×448', () => {
    const { faces } = buildDungeonFaces(planDungeon({
      chambers: [{ id: 'a', at: [0, 0], radius: 5, height: 5 }],
      tunnels: [],
      style: { texture: 'rock-cave' },
    }));
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', register: 'round' }) });
    const hero = planLayered(m).mesh;
    const r = measureFidelity({
      cast: [hero], world: [faces], frame: SIXTH_GEN.frame,
      camera: { eye: [0, -2.4, 1.3], target: [0, 0, 1.0], fovY: SIXTH_GEN.frame.fovY },
      texturePx: (k) => pngSize(surfaceTexture(k)),
    });
    console.log('[sixth-gen baseline]', JSON.stringify(r));
    expect(r.cast.pixels).toBeGreaterThan(1000);
    expect(r.world.pixels).toBeGreaterThan(1000);
    expect(r.ratio.triangles).toBeGreaterThan(1);
  }, 60000);
});
