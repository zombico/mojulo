// Track kit laws: a track drawn in its world's look. One banded kit (the first written kit on that pole, chosen in code)
// and one material look composed from words, and the procedures: the materials derived from the kit (its values, its
// hue); each pole's drawing (the band's window as it is; the centred window × light); the tiles resolving to PNGs; a
// planned track laid in the kit, worn on its racing line; absent, the roadway's own.
import { describe, it, expect } from 'vitest';
import { trackKit, TRACK_MATERIALS, resample } from './track-kit.js';
import { planTrack } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';
import { composeLook } from '../gameworld/tunnel-land.js';
import { surfaceTexture } from '../landscape/surface-textures.js';

const BANDED = SWATCH_KITS.find((k) => poleOf(k) === 'banded');
const REAL = composeLook('realistic green grassland').id;
const LAP = Object.keys(COURSE_PRESETS).find((k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; });
const luma = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const hexOf = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

describe('the track\'s materials in a kit\'s terms', () => {
  it('derives each material from the kit: its values set, darkest to lightest; asphalt under concrete; the hue the kit\'s', () => {
    const K = trackKit(BANDED), R = trackKit(REAL);
    expect(R.pole).toBe('material');
    expect(K.pole).toBe('banded');
    for (const [m, M] of Object.entries(TRACK_MATERIALS)) {
      const L = K.ramps[m].map((c) => luma(hexOf(c)));
      for (let i = 1; i < 5; i++) expect(L[i]).toBeGreaterThanOrEqual(L[i - 1] - 1);
      if (M.lumas) L.forEach((v, i) => expect(Math.abs(v - M.lumas[i])).toBeLessThan(3));
    }
    expect(luma(hexOf(K.ramps.asphalt[2]))).toBeLessThan(luma(hexOf(K.ramps.concrete[2])));
    // the same material in two kits differs by the kits' own colour, not by its values
    expect(JSON.stringify(K.ramps.asphalt)).not.toBe(JSON.stringify(R.ramps.asphalt));
    expect(resample([[0, 0, 0], [200, 200, 200]]).length).toBe(5);
  });
  it('draws by the pole: the material pole a centred tile × light, the banded pole the band\'s window as it is', () => {
    const quad = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const m = trackKit(REAL).surface('asphalt', quad, uv), b = trackKit(BANDED).surface('asphalt', quad, uv);
    expect(m.textureLit).toBe(true);
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(m.fill.slice(i, i + 2), 16));
    expect(r === g && g === bl).toBe(true);                         // the light only: the texel is the colour
    expect(b.textureLit).toBeUndefined();
    expect(b.texture).not.toBe(m.texture);
    // asphalt's grain: finer than the uv it was handed
    expect(m.uv[1][0]).toBeGreaterThan(1);
    for (const f of [m, b]) expect(surfaceTexture(f.texture)).toMatch(/^data:image\/png;base64,/);
    // paint is a mark: never tiled
    expect(trackKit(REAL).paint('kerbRed', quad).texture).toBeUndefined();
  });
  it('lays a planned track in the kit, its racing line rubbered through the corners; absent, the roadway\'s own tiles', () => {
    const own = planTrack({ form: 'circuit', course: LAP }), kitted = planTrack({ form: 'circuit', course: LAP, kit: REAL });
    const keys = (p) => new Set(p.faces.map((f) => f.texture).filter(Boolean));
    expect([...keys(own)].some((k) => k.startsWith('track:'))).toBe(false);
    expect([...keys(kitted)].every((k) => k.startsWith('track:'))).toBe(true);
    expect([...keys(kitted)].some((k) => k.includes(':rubber:'))).toBe(true);
    expect(kitted.faces.length).toBeGreaterThan(own.faces.length);
    expect(JSON.stringify(planTrack({ form: 'circuit', course: LAP, kit: REAL }).faces)).toBe(JSON.stringify(kitted.faces));
  });
});
