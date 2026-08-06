import { describe, it, expect } from 'vitest';

import {
  validateCutsceneRecipe,
  resolveCutsceneFrame,
  cutsceneSceneAt,
  cutsceneTotalFrames,
  emitCutsceneFrameSvg,
  emitCutscenePlayerHtml,
} from './cutscene.js';
import { PIXEL_DAWN_RECIPE } from './test-fixtures/pixel-dawn.recipe.js';
import { QUIET_CALL_RECIPE } from './test-fixtures/quiet-call.recipe.js';
import { PILOT_WAVE_RECIPE } from './test-fixtures/pilot-wave.recipe.js';
import { HANA_WAVE_RECIPE } from './test-fixtures/hana-wave.recipe.js';
import { HANA_CLOSEUP_RECIPE } from './test-fixtures/hana-closeup.recipe.js';
import { NEON_GP_RECIPE } from './test-fixtures/neon-gp.recipe.js';

// A minimal fixture for track semantics: 8x8 viewport, two 1x1 sprites
// so any pixel probe reads which variant painted where.
const tinyScene = (over = {}) => ({
  kind: 'pixel-cutscene',
  register: '8bit',
  viewport: [8, 8],
  fps: 4,
  sprites: {
    dotA: { size: [1, 1], palette: ['#aa0000'], cells: ['1'] },
    dotB: { size: [1, 1], palette: ['#00bb00'], cells: ['1'] },
  },
  fonts: { micro: { size: [3, 5], glyphs: { A: ['.1.', '1.1', '111', '1.1', '1.1'] } } },
  scenes: [
    {
      id: 'only',
      duration: 8,
      background: null,
      placements: [{ id: 'dot', sprite: 'dotA', cell: [0, 4] }],
      tracks: [
        { target: 'dot', prop: 'cell', keys: [{ at: 0, value: [0, 4] }, { at: 4, value: [4, 4] }] },
      ],
    },
  ],
  ...over,
});

describe('validateCutsceneRecipe — the mint gate', () => {
  it('accepts the tiny fixture and the pixel-dawn intro', () => {
    expect(validateCutsceneRecipe(tinyScene())).toEqual([]);
    expect(validateCutsceneRecipe(PIXEL_DAWN_RECIPE)).toEqual([]);
  });

  it('the register IS the budget: pixel-dawn refuses to mint under 8bit (the sun is 6 colors)', () => {
    const demoted = { ...PIXEL_DAWN_RECIPE, register: '8bit' };
    expect(validateCutsceneRecipe(demoted).some((e) => e.includes('sprite "sun"') && e.includes('1-3'))).toBe(true);
  });

  it('the 32bit register holds 61 colors and refuses 62 — the cell alphabet is the ceiling', () => {
    const mk = (n) => ({
      ...tinyScene({ register: '32bit' }),
      sprites: {
        dot: {
          size: [1, 1],
          palette: Array.from({ length: n }, (_, i) => `#00${i.toString(16).padStart(4, '0')}`),
          cells: ['Z'], // palette slot 61
        },
      },
      scenes: [{ id: 'only', duration: 4, background: null, placements: [{ id: 'd', sprite: 'dot', cell: [0, 0] }], tracks: [] }],
    });
    expect(validateCutsceneRecipe(mk(61))).toEqual([]);
    expect(validateCutsceneRecipe(mk(62)).some((e) => e.includes('1-61'))).toBe(true);
    expect(resolveCutsceneFrame(mk(61), 0).grid[0][0]).toBe('#00003c'); // slot 61 resolves
  });

  it('refuses a 16-color raster even under 16bit — 15 + transparent is the 4bpp ceiling', () => {
    const r = structuredClone(PIXEL_DAWN_RECIPE);
    r.sprites.over = {
      size: [1, 1],
      palette: Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`),
      cells: ['1'],
    };
    expect(validateCutsceneRecipe(r).some((e) => e.includes('sprite "over"') && e.includes('1-15'))).toBe(true);
  });

  it('refuses unsorted keys and keys at/past the scene duration', () => {
    const unsorted = tinyScene();
    unsorted.scenes[0].tracks[0].keys = [{ at: 4, value: [0, 4] }, { at: 2, value: [4, 4] }];
    expect(validateCutsceneRecipe(unsorted).some((e) => e.includes('sort ascending'))).toBe(true);

    const past = tinyScene();
    past.scenes[0].tracks[0].keys = [{ at: 0, value: [0, 4] }, { at: 8, value: [4, 4] }];
    expect(validateCutsceneRecipe(past).some((e) => e.includes('[0, 8)'))).toBe(true);
  });

  it('refuses a track holding both keys and values, or neither', () => {
    const both = tinyScene();
    both.scenes[0].tracks[0].values = [[0, 4]];
    expect(validateCutsceneRecipe(both).some((e) => e.includes('exactly one of keys'))).toBe(true);
  });

  it('refuses dangling targets: unknown placement, unknown layer, off-grammar prop', () => {
    const ghost = tinyScene();
    ghost.scenes[0].tracks = [{ target: 'nobody', prop: 'cell', keys: [{ at: 0, value: [0, 0] }] }];
    expect(validateCutsceneRecipe(ghost).some((e) => e.includes('matches no placement'))).toBe(true);

    const layer = tinyScene();
    layer.scenes[0].tracks = [{ target: '@layer:ghost', prop: 'scroll', keys: [{ at: 0, value: [0, 0] }] }];
    expect(validateCutsceneRecipe(layer).some((e) => e.includes('matches no layer'))).toBe(true);

    const prop = tinyScene();
    prop.scenes[0].tracks = [{ target: '@camera', prop: 'reveal', keys: [{ at: 0, value: 0 }] }];
    expect(validateCutsceneRecipe(prop).some((e) => e.includes('prop must be one of cell'))).toBe(true);
  });

  it('refuses fade levels past 8 and reveals past the caption length', () => {
    const fade = tinyScene();
    fade.scenes[0].tracks = [{ target: '@fade', prop: 'level', keys: [{ at: 0, value: 9 }] }];
    expect(validateCutsceneRecipe(fade).some((e) => e.includes('0-8'))).toBe(true);

    const reveal = tinyScene();
    reveal.scenes[0].captions = [{ id: 'cap', font: 'micro', text: 'AAA', cell: [0, 0], color: '#ffffff' }];
    reveal.scenes[0].tracks = [{ target: 'cap', prop: 'reveal', keys: [{ at: 0, value: 4 }] }];
    expect(validateCutsceneRecipe(reveal).some((e) => e.includes('0-3'))).toBe(true);
  });

  it('refuses a caption char with no glyph — text coverage is validated, not discovered at render', () => {
    const r = tinyScene();
    r.scenes[0].captions = [{ id: 'cap', font: 'micro', text: 'AB', cell: [0, 0], color: '#ffffff' }];
    expect(validateCutsceneRecipe(r).some((e) => e.includes('"B"') && e.includes('no glyph'))).toBe(true);
  });
});

describe('timeline tracks — keyframes with integer lerp', () => {
  it('lerps cell keys one integer step per frame, holds before the first and after the last key', () => {
    const r = tinyScene();
    for (const [t, x] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [7, 4]]) {
      const { grid } = resolveCutsceneFrame(r, t);
      expect(grid[4][x]).toBe('#aa0000');
      if (x > 0) expect(grid[4][x - 1]).toBe(null);
    }
  });

  it('steps sprite cycle tracks by `every`: dotA for 3 frames, then dotB', () => {
    const r = tinyScene();
    r.scenes[0].tracks = [{ target: 'dot', prop: 'sprite', values: ['dotA', 'dotB'], every: 3 }];
    expect(resolveCutsceneFrame(r, 2).grid[4][0]).toBe('#aa0000');
    expect(resolveCutsceneFrame(r, 3).grid[4][0]).toBe('#00bb00');
    expect(resolveCutsceneFrame(r, 6).grid[4][0]).toBe('#aa0000');
  });
});

describe('the pixel-dawn intro — scenes, camera, parallax, fade, text', () => {
  it('runs 576 frames over four scenes; the global clock resolves to (scene, local)', () => {
    expect(cutsceneTotalFrames(PIXEL_DAWN_RECIPE)).toBe(576);
    expect(cutsceneSceneAt(PIXEL_DAWN_RECIPE, 95).scene.id).toBe('presents');
    const boundary = cutsceneSceneAt(PIXEL_DAWN_RECIPE, 96);
    expect(boundary.scene.id).toBe('dawn-pan');
    expect(boundary.local).toBe(0);
    expect(cutsceneSceneAt(PIXEL_DAWN_RECIPE, 575).scene.id).toBe('credits');
  });

  it('is byte-identical across calls: same recipe + same t → same SVG', () => {
    expect(emitCutsceneFrameSvg(PIXEL_DAWN_RECIPE, 216)).toBe(emitCutsceneFrameSvg(PIXEL_DAWN_RECIPE, 216));
  });

  it('clamps past the end: any t beyond the last frame resolves the last frame', () => {
    expect(emitCutsceneFrameSvg(PIXEL_DAWN_RECIPE, 99999)).toBe(emitCutsceneFrameSvg(PIXEL_DAWN_RECIPE, 575));
  });

  it('pans the camera: at mid-pan the world-coordinate hero lands at the lerped screen cell', () => {
    // local t=120: camera x = floor(160*120/239) = 80; hero world x =
    // 20 + floor(210*120/239) = 125 → screen x 45. Head row 0 spans
    // sprite cols 5-10 → outline pixel at (50, 64).
    const { grid } = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 96 + 120);
    expect(grid[64][50]).toBe('#101018');
  });

  it('pins fixed placements to the screen: the sun ignores the pan', () => {
    const start = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 96);
    const mid = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 96 + 120);
    // sun core at cell (122+10, 34+10), identical under both camera positions
    expect(start.grid[44][132]).toBe('#fff4d0');
    expect(mid.grid[44][132]).toBe('#fff4d0');
  });

  it('types the studio card: 9 of 15 chars at local 48, first glyph painted, eleventh not yet', () => {
    // reveal = ilerp(0→15 over keys 12→72) at 48 = 9 ('MOJULO PR')
    const { grid } = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 48);
    expect(grid[44][21]).toBe('#e8e4f0'); // 'M' col 0 row 0
    expect(grid[44][101]).toBe('#0c0a16'); // 11th char cell still background
  });

  it('fades with exact palette math: level 8 IS the fade color — the flash frame is uniform white', () => {
    const black = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 0); // presents f0, fade 8 to bg
    expect(black.grid[0][0]).toBe('#0c0a16');
    expect(black.grid[44][21]).toBe('#0c0a16'); // caption swallowed by the fade

    const flash = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 336); // title f0, fade 8 to white
    expect(flash.grid[0][0]).toBe('#fcf8f0');
    expect(flash.grid[48][80]).toBe('#fcf8f0');
  });

  it('scrolls the credits as a camera move: the closing line rises from below the viewport into it', () => {
    const early = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 432); // camera y 0 — line at world y 204, off-screen
    const late = resolveCutsceneFrame(PIXEL_DAWN_RECIPE, 432 + 120); // camera y 140 → screen y 64
    const rowHasInk = (frame, y) => frame.grid[y].some((c) => c === '#e8e4f0');
    expect(rowHasInk(early, 64)).toBe(false);
    expect(rowHasInk(late, 64)).toBe(true);
  });
});

describe('quiet-call — sub-cel acting: the body holds, the face swaps', () => {
  it('mints', () => {
    expect(validateCutsceneRecipe(QUIET_CALL_RECIPE)).toEqual([]);
  });

  it('blinks by step-hold keys: iris pixel at f40 open, skin at f61 mid-blink', () => {
    // eyes overlay at [108,59]; open row 1 col 1 is iris, closed rows 0-1 empty
    expect(resolveCutsceneFrame(QUIET_CALL_RECIPE, 40).grid[60][109]).toBe('#5a78b8');
    expect(resolveCutsceneFrame(QUIET_CALL_RECIPE, 61).grid[60][109]).toBe('#f2dcc4');
  });

  it('flaps the mouth in the call: interior pixel open at burst frame, bare skin when closed', () => {
    // mouth overlay at [110,65]; scene 2 local 24 = mouth-open, local 0 = closed
    expect(resolveCutsceneFrame(QUIET_CALL_RECIPE, 168 + 24).grid[65][111]).toBe('#5e2a34');
    expect(resolveCutsceneFrame(QUIET_CALL_RECIPE, 168).grid[65][111]).toBe('#f2dcc4');
  });

  it('buzzes the sill phone: the jitter track moves it a cell off its resting spot', () => {
    // at rest (x89) the sprite's transparent corner leaves (89,64) as wall;
    // at f130 the jitter shifts the phone to x88 and its outline lands there
    expect(resolveCutsceneFrame(QUIET_CALL_RECIPE, 118).grid[64][89]).toBe('#241e33');
    expect(resolveCutsceneFrame(QUIET_CALL_RECIPE, 130).grid[64][89]).toBe('#0e0b16');
  });
});

describe('palette cycling — animation with zero pixel data per frame', () => {
  const rampScene = () => ({
    kind: 'pixel-cutscene',
    register: '8bit',
    viewport: [4, 1],
    fps: 4,
    sprites: { ramp: { size: [3, 1], palette: ['#aa0000', '#00bb00', '#0000cc'], cells: ['123'] } },
    fonts: {},
    scenes: [{
      id: 'only',
      duration: 6,
      background: null,
      placements: [{ id: 'r', sprite: 'ramp', cell: [0, 0] }],
      tracks: [{ target: 'r', prop: 'palette', range: [1, 3], values: [0, 1, 2], every: 1 }],
    }],
  });

  it('rotates the range: the same cell shows each ramp color in turn, then wraps', () => {
    const r = rampScene();
    expect(resolveCutsceneFrame(r, 0).grid[0][0]).toBe('#aa0000');
    expect(resolveCutsceneFrame(r, 1).grid[0][0]).toBe('#00bb00');
    expect(resolveCutsceneFrame(r, 2).grid[0][0]).toBe('#0000cc');
    expect(resolveCutsceneFrame(r, 3).grid[0][0]).toBe('#aa0000');
  });

  it('refuses a range outside the sprite palette and a negative offset', () => {
    const wide = rampScene();
    wide.scenes[0].tracks[0].range = [1, 4];
    expect(validateCutsceneRecipe(wide).some((e) => e.includes('palette range'))).toBe(true);

    const neg = rampScene();
    neg.scenes[0].tracks[0].values = [0, -1];
    expect(validateCutsceneRecipe(neg).some((e) => e.includes('non-negative integer rotation'))).toBe(true);
  });
});

describe('pilot-wave — the ripple tank carried by palette rotation', () => {
  it('mints, and the 12-color field is a 16-bit-budget raster', () => {
    expect(validateCutsceneRecipe(PILOT_WAVE_RECIPE)).toEqual([]);
    expect(PILOT_WAVE_RECIPE.sprites.field.palette).toHaveLength(12);
  });

  it('the carrier travels but the envelope stands: byte-equal at the 12-frame cycle, different between', () => {
    // window f20-f39 has no other track motion — pure palette rotation
    expect(emitCutsceneFrameSvg(PILOT_WAVE_RECIPE, 24)).toBe(emitCutsceneFrameSvg(PILOT_WAVE_RECIPE, 36));
    expect(emitCutsceneFrameSvg(PILOT_WAVE_RECIPE, 24)).not.toBe(emitCutsceneFrameSvg(PILOT_WAVE_RECIPE, 26));
  });

  it('hits accumulate on the screen: the first dot is bare early and landed late', () => {
    // hit-0 rests at (97,111), switches on at f150
    expect(resolveCutsceneFrame(PILOT_WAVE_RECIPE, 100).grid[111][97]).toBe('#141020');
    expect(resolveCutsceneFrame(PILOT_WAVE_RECIPE, 250).grid[111][97]).toBe('#ffd98a');
  });
});

describe('hana-wave — the keyframe-animation channels transposed to tracks', () => {
  it('mints', () => {
    expect(validateCutsceneRecipe(HANA_WAVE_RECIPE)).toEqual([]);
  });

  it('the wave channel: the gloved hand is up during the cel cycle, sky at rest', () => {
    // wave-b hand occupies (77,14); at f20 the arm still rests
    expect(resolveCutsceneFrame(HANA_WAVE_RECIPE, 20).grid[14][77]).toBe('#a9c9e9');
    expect(resolveCutsceneFrame(HANA_WAVE_RECIPE, 36).grid[14][77]).toBe('#35323e');
  });

  it('the speech channel: mouth interior open inside a span, bare skin between spans', () => {
    expect(resolveCutsceneFrame(HANA_WAVE_RECIPE, 34).grid[22][59]).toBe('#5e2a34');
    expect(resolveCutsceneFrame(HANA_WAVE_RECIPE, 50).grid[22][59]).toBe('#f2d6bc');
  });

  it('the blink channel: the lash pixel yields to skin mid-blink', () => {
    expect(resolveCutsceneFrame(HANA_WAVE_RECIPE, 20).grid[17][56]).toBe('#262130');
    expect(resolveCutsceneFrame(HANA_WAVE_RECIPE, 33).grid[17][56]).toBe('#f2d6bc');
  });
});

describe('hana-closeup — the dialogue-portrait register', () => {
  it('mints, painter-generated base included', () => {
    expect(validateCutsceneRecipe(HANA_CLOSEUP_RECIPE)).toEqual([]);
  });

  it('the eye highlight is white when open and becomes the smile arc on the warm beat', () => {
    expect(resolveCutsceneFrame(HANA_CLOSEUP_RECIPE, 20).grid[51][53]).toBe('#ffffff');
    expect(resolveCutsceneFrame(HANA_CLOSEUP_RECIPE, 130).grid[51][53]).toBe('#262130');
  });

  it('speech flaps: mouth interior open on a span frame, bare skin after the span closes', () => {
    expect(resolveCutsceneFrame(HANA_CLOSEUP_RECIPE, 48).grid[67][60]).toBe('#5e2a34');
    expect(resolveCutsceneFrame(HANA_CLOSEUP_RECIPE, 96).grid[67][60]).toBe('#f2d6bc');
  });
});

describe('neon-gp — the 32-bit attract mode, motion by rotation alone', () => {
  it('mints under 32bit, palette carrying the post-era neons', () => {
    expect(validateCutsceneRecipe(NEON_GP_RECIPE)).toEqual([]);
    const pal = NEON_GP_RECIPE.sprites.world.palette;
    expect(pal).toContain('#00ffe7');
    expect(pal).toContain('#ff2bd6');
  });

  it('the road rushes: adjacent frames differ, and a road cell replays at the ramp period', () => {
    expect(emitCutsceneFrameSvg(NEON_GP_RECIPE, 20)).not.toBe(emitCutsceneFrameSvg(NEON_GP_RECIPE, 22));
    // (100,170) sits inside the road, clear of rails/dashes/ship/HUD;
    // the road ramp cycles 6 values every 2 frames → period 12
    expect(resolveCutsceneFrame(NEON_GP_RECIPE, 20).grid[170][100]).toBe(resolveCutsceneFrame(NEON_GP_RECIPE, 32).grid[170][100]);
    expect(resolveCutsceneFrame(NEON_GP_RECIPE, 20).grid[170][100]).not.toBe(resolveCutsceneFrame(NEON_GP_RECIPE, 22).grid[170][100]);
  });
});

describe('the player — one serialized resolver, playback as presentation', () => {
  it('embeds the engine source and the recipe, deterministically', () => {
    const html = emitCutscenePlayerHtml(PIXEL_DAWN_RECIPE, { title: 'pixel dawn' });
    expect(html).toContain('function createCutsceneEngine');
    expect(html).toContain('"pixel-cutscene"');
    expect(html).toContain('image-rendering: pixelated');
    expect(html).toBe(emitCutscenePlayerHtml(PIXEL_DAWN_RECIPE, { title: 'pixel dawn' }));
  });
});
