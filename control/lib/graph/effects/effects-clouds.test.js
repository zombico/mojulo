import { describe, expect, it } from 'vitest';

import { composeCloudDeck, CLOUD_DECK_MODES } from './effects-clouds.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// a z-up town: three low blocks and one tower (top at 40)
const BOXES = [
  { cx: 0, cy: 0, cz: 4, hx: 3, hy: 3, hz: 4 },
  { cx: 12, cy: 0, cz: 5, hx: 3, hy: 3, hz: 5 },
  { cx: 0, cy: 12, cz: 20, hx: 2.5, hy: 2.5, hz: 20 },
  { cx: 12, cy: 12, cz: 3, hx: 3, hy: 3, hz: 3 },
];

describe('composeCloudDeck — the undershot plane deck (default)', () => {
  it('returns the overlay-layer shape with the band published in meta', () => {
    const d = composeCloudDeck(BOXES);
    expect(d.meta).toEqual({ mode: 'undershot', base: 52, top: 65 });     // ceil(40) + 12, + 13
    expect(typeof d.frag).toBe('string');
    expect(d.customUniforms).toEqual({ uMaxDist: 900, uFade: 420 });
    expect(d.dataTextures).toEqual({});
  });

  it('is a plane intersection, not a march, and speaks the host overlay contract', () => {
    const { frag } = composeCloudDeck(BOXES);
    expect(frag).toContain('uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime; uniform float uFov;');
    expect(frag).toContain('normalize(uCamBasis * vec3(uv.x * tanf, uv.y * tanf, 1.0))');   // same ray as buildVolumeFrag
    expect(frag).toContain('float t = ((below ? SV_BASE : SV_TOP) - hCam) / dU;');
    expect(frag).not.toContain('const int STEPS');
    expect(frag).not.toContain('sdfScene');                                              // no occluder above the tallest box
    expect(frag).toContain('gl_FragColor = vec4(SV_ALBEDO * L * a, a);');                // premultiplied
    expect(frag).toContain('float hCam = ro.z, dU = rd.z;');                             // z-up by default
  });

  it('bakes the tuning object into the shader as constants', () => {
    const { frag, meta } = composeCloudDeck(BOXES, { base: 80, top: 100, coverage: 0.25, density: 0.3, color: [0.9, 0.92, 1], sun: [0, 0, 1], scale: 0.02, drift: 0 });
    expect(meta).toEqual({ mode: 'undershot', base: 80, top: 100 });
    expect(frag).toContain('const float SV_BASE = 80.0000; const float SV_TOP = 100.0000; const float SV_THICK = 20.0000;');
    expect(frag).toContain('const float SV_DENS = 0.3000; const vec3 SV_ALBEDO = vec3(0.9000, 0.9200, 1.0000);');
    expect(frag).toContain('smoothstep(0.6200, 0.9000, b + 0.24 * puff)');              // coverage 0.25 = the spike's sparse deck
    expect(frag).toContain('const vec3 SV_SUN = vec3(0.0000, 0.0000, 1.0000);');
    expect(frag).toContain('vec3(uTime * 0.0000, uTime * 0.0000, 0.0)');                // drift 0 = still
    expect(frag).toContain('p * 0.0200 +');
  });

  it("swaps the height component for a y-up frame and defaults the sun for it", () => {
    const yBoxes = BOXES.map((b) => ({ cx: b.cx, cy: b.cz, cz: -b.cy, hx: b.hx, hy: b.hz, hz: b.hy }));
    const d = composeCloudDeck(yBoxes, { up: 'y' });
    expect(d.meta.base).toBe(52);
    expect(d.frag).toContain('float hCam = ro.y, dU = rd.y;');
    expect(d.frag).toContain('sunFlat.y = 0.0;');
    expect(d.frag).toContain('vec3(uTime * 0.0100, 0.0, uTime * 0.0060)');
  });

  it('works with no boxes at all (a bare stage): band from clearance alone', () => {
    const d = composeCloudDeck([]);
    expect(d.meta).toEqual({ mode: 'undershot', base: 12, top: 25 });
    expect(composeCloudDeck(undefined).meta.base).toBe(12);
  });

  it('a `floor` (the mesh\'s tallest vertex) lifts the default band when it beats the boxes', () => {
    expect(composeCloudDeck([], { floor: 30.2 }).meta).toEqual({ mode: 'undershot', base: 43, top: 56 });
    expect(composeCloudDeck(BOXES, { floor: 5 }).meta.base).toBe(52);      // the tower still wins
    expect(composeCloudDeck(BOXES, { floor: 5, base: 20 }).meta.base).toBe(20);   // an explicit base is the operator's
    expect(() => composeCloudDeck([], { floor: 'high' })).toThrow(/floor must be a number/);
  });

  it('is deterministic — same input, same bytes', () => {
    const a = composeCloudDeck(BOXES, { coverage: 0.5 });
    const b = composeCloudDeck(BOXES, { coverage: 0.5 });
    expect(a.frag).toBe(b.frag);
    expect(a.customUniforms).toEqual(b.customUniforms);
  });
});

describe('composeCloudDeck — the full volumetric band', () => {
  it('rides buildVolumeFrag as an overlay, clipped by the boxes that cross the band', () => {
    const d = composeCloudDeck(BOXES, { mode: 'full', base: 30, top: 45 });   // the tower (top 40) crosses it
    expect(d.meta).toMatchObject({ mode: 'full', base: 30, top: 45 });
    expect(d.meta.count).toBe(1);                                          // only the tower is baked
    expect(d.frag).toContain('const int STEPS = 160;');
    expect(d.frag).toContain('sdfScene');                                  // grid-culled scene-SDF occluder
    expect(d.frag).toContain('volSample(p, rd, emis, ext);');              // rayDirArg
    expect(d.frag).toContain('gl_FragColor = vec4(col, vrA);');            // overlay output
    expect(d.frag).toContain('od += densityShadow(q) * ds');               // cheap shadow twin in the light march
    expect(d.frag).toContain('vec3 L = svLight(p, rd, d, sigma, (p.z - SV_BASE) / SV_THICK, 0.60, 3.0);');
    expect(d.customUniforms.uMaxDist).toBe(260);
    expect(d.customUniforms.uBoxCount).toBe(1);
    expect(d.dataTextures.uBoxTex).toBeTruthy();
    expect(d.dataTextures.uCellTex).toBeTruthy();
  });

  it('carries no occluder when the band sits above every box (the default), nor with no boxes', () => {
    const above = composeCloudDeck(BOXES, { mode: 'full' });
    expect(above.meta).toEqual({ mode: 'full', base: 52, top: 65 });
    expect(above.frag).not.toContain('sdfScene');
    expect(above.customUniforms).toEqual({ uMaxDist: 260 });
    expect(above.dataTextures).toEqual({});
    const bare = composeCloudDeck([], { mode: 'full', steps: 64 });
    expect(bare.frag).not.toContain('sdfScene');
    expect(bare.frag).toContain('const int STEPS = 64;');
    expect(bare.meta).toEqual({ mode: 'full', base: 12, top: 25 });
  });
});

describe('composeCloudDeck — validation (compose_world unmints on throw)', () => {
  it('refuses a bad tuning object by name', () => {
    expect(() => composeCloudDeck(BOXES, { mode: 'baked' })).toThrow(/mode must be one of undershot \| full/);
    expect(() => composeCloudDeck(BOXES, { coverage: 1.5 })).toThrow(/coverage/);
    expect(() => composeCloudDeck(BOXES, { sun: '#fff' })).toThrow(/sun must be \[x, y, z\]/);
    expect(() => composeCloudDeck(BOXES, { color: '#fff' })).toThrow(/color/);
    expect(() => composeCloudDeck(BOXES, { base: 60, top: 50 })).toThrow(/top \(50\) must be above base \(60\)/);
    expect(() => composeCloudDeck(BOXES, { base: 'high' })).toThrow(/base must be a number/);
    expect(() => composeCloudDeck(BOXES, { density: -1 })).toThrow(/density/);
    expect(() => composeCloudDeck(BOXES, { up: 'x' })).toThrow(/up must be/);
  });

  it('exposes the mode list', () => {
    expect(CLOUD_DECK_MODES).toEqual(['undershot', 'full']);
  });
});

describe('composeCloudDeck — hosted by emitThreeWorld effects[]', () => {
  const floor = { corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]], fill: '#556655' };

  it('becomes a camera-fed premultiplied quad above fog, and the page is byte-identical without it', () => {
    const plain = emitThreeWorld({ faces: [floor] });
    const deck = composeCloudDeck(BOXES);
    const cloudy = emitThreeWorld({ faces: [floor], effects: [deck] });
    expect(plain).not.toContain('__eQuad0');
    expect(cloudy).toContain('__eQuad0');
    expect(cloudy).toContain('svDeckShape');
    expect(cloudy).toContain('uFade:{value:420}');
    expect(cloudy).toContain('blendDst: THREE.OneMinusSrcAlphaFactor');
    expect(emitThreeWorld({ faces: [floor] })).toBe(plain);
  });
});
