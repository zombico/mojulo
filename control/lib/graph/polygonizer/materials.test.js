/**
 * materials + vexar shadeHexMat — the material-response contract
 * (material-response.plan.md, Phase 1).
 *
 * Pins the three load-bearing properties:
 *   1. IDENTITY — no material → byte-equal to plain shadeHex (the opt-in
 *      invariant every baked channel holds: vao, audio, fog, now mat).
 *   2. SPEC GATING — the Blinn-Phong term fires only when viewFrom+at declare
 *      a fixed camera; face-payload callers (no camera) never get a baked
 *      highlight.
 *   3. PARITY — shadeHexMat reproduces carved-solid's proven matRgb math, so
 *      the promotion changed the shelf's address, not its look.
 */

import { describe, it, expect } from 'vitest';

import { MATERIALS, MATERIAL_NAMES, resolveMaterial } from './materials.js';
import {
  shadeHex, shadeHexMat, shadeFace, shadeFaceMat,
  makeLight, hexToRgb, rgbToHex, norm3, sub3, dot3, DEFAULT_LIGHT,
} from './vexar.js';

const N_UP = [0, 0, 1];
const N_TILT = norm3([0.3, -0.4, 0.85]);
const N_AWAY = norm3([-0.4, -0.5, 0.76]); // roughly opposite the default light
const HEX = '#b06a3c';

describe('material shelf', () => {
  it('resolves names, hex tints, and preset-override objects', () => {
    expect(resolveMaterial('gold')).toBe(MATERIALS.gold);
    expect(resolveMaterial()).toBe(MATERIALS.steel);            // default finish
    expect(resolveMaterial('nonsense')).toBe(MATERIALS.steel);  // unknown name → steel
    const tinted = resolveMaterial('#ff0044');                  // hex → satin tint
    expect(tinted.base).toBe('#ff0044');
    expect(tinted.specular).toBe(MATERIALS.satin.specular);
    const overridden = resolveMaterial({ preset: 'chrome', shininess: 64 });
    expect(overridden.specular).toBe(MATERIALS.chrome.specular);
    expect(overridden.shininess).toBe(64);
  });

  it('every row carries the response params the shade consumes', () => {
    for (const name of MATERIAL_NAMES) {
      const m = MATERIALS[name];
      expect(typeof m.base).toBe('string');
      expect(m.ambient).toBeGreaterThan(0);
      expect(m.diffuse).toBeGreaterThan(0);
    }
  });

  it('carved-solid still serves the shelf (re-export unbroken)', async () => {
    const carved = await import('../effects/carved-solid.js');
    expect(carved.resolveMaterial('gold')).toBe(MATERIALS.gold);
    expect(carved.MATERIAL_NAMES).toEqual(MATERIAL_NAMES);
  });
});

describe('shadeHexMat', () => {
  it('IDENTITY: absent material is byte-equal to shadeHex, at every normal', () => {
    for (const n of [N_UP, N_TILT, N_AWAY]) {
      expect(shadeHexMat(HEX, n, null)).toBe(shadeHex(HEX, n));
      expect(shadeHexMat(HEX, n, undefined)).toBe(shadeHex(HEX, n));
    }
    const light = makeLight({ direction: [0.1, 0.8, -0.6], ambient: 0.3, diffuse: 0.7 });
    expect(shadeHexMat(HEX, N_TILT, null, { light })).toBe(shadeHex(HEX, N_TILT, light));
  });

  it('IDENTITY: shadeFaceMat without a material matches shadeFace', () => {
    const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0.2], [0, 1, 0.2]];
    const plain = shadeFace(corners, HEX, { inside: [0.5, 0.5, -2] });
    const mat = shadeFaceMat(corners, HEX, null, { inside: [0.5, 0.5, -2] });
    expect(mat.fill).toBe(plain.fill);
    expect(mat.normal).toEqual(plain.normal);
  });

  it("a material's own ambient/diffuse replace the light's", () => {
    const m = MATERIALS.stone; // ambient 0.40 vs DEFAULT_LIGHT's 0.46
    const lam = Math.max(0, dot3(N_TILT, DEFAULT_LIGHT.toLight));
    const expected = rgbToHex(hexToRgb(HEX).map((v) => v * (m.ambient + m.diffuse * lam)));
    expect(shadeHexMat(HEX, N_TILT, m)).toBe(expected);
    expect(shadeHexMat(HEX, N_TILT, m)).not.toBe(shadeHex(HEX, N_TILT));
  });

  it('SPEC GATING: no highlight without a declared camera, highlight with one', () => {
    const m = MATERIALS.chrome;
    const at = [0, 0, 0];
    // camera along toLight → half-vector = toLight; normal = toLight puts the
    // face dead in the highlight (dot = 1, spec at full strength)
    const n = DEFAULT_LIGHT.toLight;
    const viewFrom = [n[0] * 8, n[1] * 8, n[2] * 8];
    const noCam = shadeHexMat(HEX, n, m);
    const cam = shadeHexMat(HEX, n, m, { viewFrom, at });
    // camera-independent path = pure curve reshape (no additive white term)
    const lam = Math.max(0, dot3(n, DEFAULT_LIGHT.toLight));
    expect(noCam).toBe(rgbToHex(hexToRgb(HEX).map((v) => v * (m.ambient + m.diffuse * lam))));
    // fixed-camera path is strictly brighter (the additive specular term)
    const sum = (h) => hexToRgb(h).reduce((a, v) => a + v, 0);
    expect(sum(cam)).toBeGreaterThan(sum(noCam));
    // half of a camera declaration is not a declaration
    expect(shadeHexMat(HEX, n, m, { viewFrom })).toBe(noCam);
    expect(shadeHexMat(HEX, n, m, { at })).toBe(noCam);
  });

  it('PARITY: reproduces carved-solid matRgb math (Lambert + Blinn-Phong + cel + emissive)', () => {
    const light = makeLight({ direction: [0.4, 0.5, -0.76], ambient: 0.26, diffuse: 0.7 });
    const at = [1.2, -3, 0.8];
    const viewFrom = [-3.2, -16, 3.0]; // carved-solid's hero CAM
    for (const name of ['gold', 'chrome', 'stone', 'neon', 'cel']) {
      const m = MATERIALS[name];
      // carved-solid's matRgb, verbatim (effects/carved-solid.js)
      let lam = Math.max(0, dot3(N_TILT, light.toLight));
      if (m.cel) lam = Math.round(lam * m.cel) / m.cel;
      const base = hexToRgb(m.base);
      let rgb = base.map((v) => v * (m.ambient + m.diffuse * lam));
      if (m.specular) {
        const toView = norm3(sub3(viewFrom, at));
        const half = norm3([light.toLight[0] + toView[0], light.toLight[1] + toView[1], light.toLight[2] + toView[2]]);
        const s = m.specular * Math.pow(Math.max(0, dot3(N_TILT, half)), m.shininess || 16);
        rgb = rgb.map((v) => v + 255 * s);
      }
      if (m.emissive) rgb = rgb.map((v, i) => v * (1 - m.emissive) + base[i] * m.emissive);
      expect(shadeHexMat(m.base, N_TILT, m, { light, viewFrom, at })).toBe(rgbToHex(rgb));
    }
  });

  it('cel quantization bands the Lambert term', () => {
    const m = { ambient: 0.5, diffuse: 0.5, cel: 4 };
    // two normals inside the same cel band shade identically
    const nA = norm3([0.05, 0.02, 0.999]);
    const nB = norm3([0.06, 0.03, 0.998]);
    expect(shadeHexMat(HEX, nA, m)).toBe(shadeHexMat(HEX, nB, m));
    // ...but differently WITHOUT cel (continuous Lambert separates them)
    const smooth = { ambient: 0.5, diffuse: 0.5 };
    expect(shadeHexMat(HEX, nA, smooth)).not.toBe(shadeHexMat(HEX, N_AWAY, smooth));
  });
});
