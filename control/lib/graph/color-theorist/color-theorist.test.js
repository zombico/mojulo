import { describe, it, expect } from 'vitest';
import { oklch, lchOf, hexToRgb, rgbToHex, rgbToOklab, oklabToRgb, contrast, deltaE, simulate, CVD_KINDS } from './oklab.js';
import { readPaletteSpec, solvePalette, rampOf, PALETTE_SCHEME_IDS, PALETTE_ROLES, PALETTE_LAWS } from './solve.js';
import { gameTheme, coverPalette, landSwatches } from './adapters.js';
import { paletteLook } from './look.js';
import { stampWorldPalette } from './stamp.js';
import { SWATCHES } from '../era/style/swatches.js';
import { lookOf } from '../era/style/looks.js';
import { STYLE_TOKENS } from '../game/hud-widgets.js';
import { readGameworld } from '../gameworld/world.js';
import { gameStages } from '../gameworld/levels.js';
import { MEADOWMARK } from '../gameworld/examples.js';

const L = (hex) => lchOf(hexToRgb(hex))[0];
const mid = (r) => r[Math.floor(r.length / 2)];
// a kit whose accent ramp is a made one (paint) and one whose accent is a land one (a glow): the two ways a kit names it
const kitsByAccent = () => {
  const ids = Object.keys(SWATCHES).filter((k) => SWATCHES[k].land?.grass);
  return [ids.find((k) => SWATCHES[k].made?.[SWATCHES[k].accent[0]]), ids.find((k) => SWATCHES[k].land[SWATCHES[k].accent[0]])];
};

describe('the colour space', () => {
  it('OKLab round-trips sRGB, and a colour asked for out of gamut is brought in by chroma at its lightness', () => {
    for (const hex of ['#8a5a38', '#5fb0ff', '#0b1220', '#f5f0e6']) expect(rgbToHex(oklabToRgb(rgbToOklab(hexToRgb(hex))))).toBe(hex);
    const c = oklch(0.7, 0.4, 145);   // far outside sRGB
    expect(c.every((v) => v >= 0 && v <= 255)).toBe(true);
    expect(Math.abs(lchOf(c)[0] - 0.7)).toBeLessThan(0.02);
  });
  it('contrast is WCAG 2 (black on white 21:1); a colour-blind simulation pulls red toward green', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(deltaE(simulate([200, 40, 40], 'deutan'), simulate([60, 140, 40], 'deutan'))).toBeLessThan(deltaE([200, 40, 40], [60, 140, 40]));
    expect(CVD_KINDS).toEqual(['protan', 'deutan', 'tritan']);
  });
});

describe('a palette spec', () => {
  it('is checked where it is written, and teaches', () => {
    expect(readPaletteSpec(false)).toBe(false);
    expect(readPaletteSpec('auto')).toBe('auto');
    expect(() => readPaletteSpec({ heat: 2 })).toThrow(/heat is −1 to 1 \(cool to warm\)/);
    expect(() => readPaletteSpec({ scheme: 'rainbow' })).toThrow(/scheme is one of analogous/);
    expect(() => readPaletteSpec({ hue: 'chartreuse-ish' })).toThrow(/colour word \(rust/);
    expect(() => readPaletteSpec({ lock: { far: '#112233' } })).toThrow(/lock.far is not a role/);
    expect(() => readPaletteSpec({ mood: 'sad' })).toThrow(/mood is not part of a palette spec/);
    // a contract handed back is read as its spec
    const K = solvePalette({ seed: 3 });
    expect(readPaletteSpec(K)).toEqual({ seed: 3 });
  });
});

describe('the solve', () => {
  it('is deterministic: the same spec solves the same contract', () => {
    const a = JSON.stringify(solvePalette({ seed: 11, heat: 0.4 }));
    expect(JSON.stringify(solvePalette({ heat: 0.4, seed: 11 }))).not.toBe('');
    expect(JSON.stringify(solvePalette({ seed: 11, heat: 0.4 }))).toBe(a);
  });

  it('every scheme solves to every role, checked by every law, the value laws holding', () => {
    for (const scheme of PALETTE_SCHEME_IDS) {
      const K = solvePalette({ seed: 5, scheme });
      expect(K.read.scheme).toBe(scheme);
      expect(Object.keys(K.roles).sort()).toEqual([...PALETTE_ROLES].sort());
      expect(K.checks.map((c) => c.law)).toEqual(PALETTE_LAWS.map((l) => l.law));
      for (const law of ['ramps-climb', 'shade-is-colour', 'sky-brightest', 'ui-contrast']) expect(K.checks.find((c) => c.law === law), `${scheme} ${law}`).toMatchObject({ ok: true });
    }
  });

  it('the key moves the values: a low key sits darker than a high one', () => {
    const lo = solvePalette({ seed: 8, key: 'low' }), hi = solvePalette({ seed: 8, key: 'high' });
    expect(L(mid(lo.roles.ground))).toBeLessThan(L(mid(hi.roles.ground)) - 0.1);
    // a high key turns the HUD over: dark ink on light panels
    expect(L(hi.ui.panel)).toBeGreaterThan(L(hi.ui.ink));
    expect(L(lo.ui.panel)).toBeLessThan(L(lo.ui.ink));
  });

  it('activity is the chroma ceiling; mono-accent spends it only on the accent', () => {
    const C = (hex) => lchOf(hexToRgb(hex))[1];
    expect(C(mid(solvePalette({ seed: 9, activity: -1, scheme: 'triad' }).roles.ground))).toBeLessThan(C(mid(solvePalette({ seed: 9, activity: 1, scheme: 'triad' }).roles.ground)));
    const M = solvePalette({ seed: 9, scheme: 'mono-accent', activity: 1 });
    expect(C(mid(M.roles.accent))).toBeGreaterThan(C(mid(M.roles.ground)) * 2);
  });

  it('a hue named holds; a locked role keeps its colour exactly at its middle', () => {
    const K = solvePalette({ seed: 4, hues: { sky: 'violet' }, lock: { ground: '#8a5a38' } });
    expect(mid(K.roles.ground)).toBe('#8a5a38');
    expect(Math.abs(((lchOf(hexToRgb(mid(K.roles.sky)))[2] - lchOf([118, 92, 168])[2] + 540) % 360) - 180)).toBeLessThan(25);
  });

  it('rampOf solves a role again at any length, the ends the same band', () => {
    const K = solvePalette({ seed: 2 }), r3 = rampOf(K, 'ground', 3), r7 = rampOf(K, 'ground', 7);
    expect(r3).toHaveLength(3); expect(r7).toHaveLength(7);
    expect(rgbToHex(r3[0])).toBe(rgbToHex(r7[0]));
    expect(() => rampOf(K, 'lava', 5)).toThrow(/not a role/);
  });
});

describe('the adapters', () => {
  it('a game theme is the HUD tokens; a cover is { bg, accent, ink } that read', () => {
    const K = solvePalette({ seed: 6 }), T = gameTheme(K), C = coverPalette(K);
    expect(Object.keys(T).sort()).toEqual(STYLE_TOKENS.filter((k) => k !== 'font').sort());
    expect(Object.keys(C).sort()).toEqual(['accent', 'bg', 'ink']);
    expect(contrast(hexToRgb(C.ink), hexToRgb(C.bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('a kit recoloured keeps every ramp at its length, its accent ramp the accent\'s', () => {
    const K = solvePalette({ seed: 12 });
    for (const kit of kitsByAccent()) {
      const sw = SWATCHES[kit], out = landSwatches(K, sw);
      for (const part of ['land', 'made']) for (const [k, r] of Object.entries(sw[part])) expect(Array.isArray(r) ? out[part][k].length : out[part][k], `${kit} ${part}.${k}`).toEqual(Array.isArray(r) ? r.length : r);
      const [ramp, stop] = sw.accent, acc = out.made[ramp] ?? out.land[ramp];
      expect(rgbToHex(acc[Math.min(stop, acc.length - 1)])).not.toBe(rgbToHex((sw.made[ramp] ?? sw.land[ramp])[stop]));
      expect(out.accent).toEqual(sw.accent);
    }
  });
});

describe('a palette on a kit', () => {
  it('registers a look the land laws hold for, under one id per spec and base', () => {
    const [kit] = kitsByAccent();
    const a = paletteLook({ seed: 21 }, { base: kit, name: 'test' }), b = paletteLook({ seed: 21 }, { base: kit, name: 'test' });
    expect(a.id).toBe(b.id);
    expect(lookOf(a.id).base).toBe(kit);
    expect(a.laws.filter((l) => !l.ok)).toEqual([]);
    expect(paletteLook({ seed: 22 }, { base: kit, name: 'test' }).id).not.toBe(a.id);
  });
  it('refuses a kit with no land ramps to start from', () => {
    const plain = Object.keys(SWATCHES).find((k) => !SWATCHES[k].land?.grass);
    expect(() => paletteLook({ seed: 1 }, { base: plain })).toThrow(/a palette recolours a kit with land ramps/);
  });
});

describe('a gameworld\'s palette', () => {
  it('recolours the world\'s kit, and every stage is drawn in it; absent, the world reads as it did', () => {
    const plain = readGameworld(MEADOWMARK);
    expect(plain.style.kit).toBe('isekai-meadow');
    expect(plain.style.colours).toBeUndefined();
    const W = { ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 42 } } }, G = readGameworld(W);
    expect(G.style.kit).not.toBe('isekai-meadow');
    expect(G.style.colours).toMatchObject({ base: 'isekai-meadow', look: G.style.kit });
    // the stages drawn in the world's kit are drawn in its recolouring (a level naming its own kit keeps it)
    const kits = gameStages(W).filter((s) => s.manifest?.kind === 'stage').map((s) => s.manifest.kit);
    expect(kits).toContain(G.style.kit);
    expect(kits).not.toContain('isekai-meadow');
    expect(readGameworld({ ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: false } }).style.kit).toBe('isekai-meadow');
    expect(() => readGameworld({ ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 0 } } })).toThrow(/gameworld: style.palette.seed is a whole number/);
  });
});

describe('the stamp', () => {
  const fresh = () => 777, world = { kind: 'gameworld', id: 'w', levels: {} };
  it('rolls a seed for a new world that names no kit or look, and for \'auto\' or a spec with none', () => {
    expect(stampWorldPalette(world, null, fresh).style.palette).toEqual({ seed: 777 });
    expect(stampWorldPalette({ ...world, style: { palette: 'auto' } }, null, fresh).style.palette).toEqual({ seed: 777 });
    expect(stampWorldPalette({ ...world, style: { palette: { heat: 1 } } }, null, fresh).style.palette).toEqual({ heat: 1, seed: 777 });
  });
  it('leaves what is named: a kit, a look, a geocube, a quick game, false, a seeded spec', () => {
    for (const style of [{ kit: 'isekai-meadow' }, { look: 'rust plains' }, { geocube: 'x' }, { palette: false }, { palette: { seed: 3 } }]) {
      const m = { ...world, style };
      expect(stampWorldPalette(m, null, fresh)).toBe(m);
    }
    const q = { ...world, quick: { goal: 'reach' } };
    expect(stampWorldPalette(q, null, fresh)).toBe(q);
  });
  it('an edit keeps the palette the world had, and never gives an old world one', () => {
    expect(stampWorldPalette(world, { style: { palette: { seed: 5 } } }, fresh).style.palette).toEqual({ seed: 5 });
    expect(stampWorldPalette(world, { id: 'w' }, fresh)).toBe(world);
  });
});
