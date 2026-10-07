import { describe, it, expect } from 'vitest';

import { worldMotionCameras } from './world-motion.js';
import { cameraPathFor } from './camera-path.js';
import {
  BLENDER_FILM_VERSION, filmShot, filmAtmosphere, emitBlenderFilm, filmShotsPy, filmLightPy, filmRenderPy,
} from './blender-film.js';
import { FOG_DEFAULTS } from '@/lib/graph/effects/effects-fog';

// A world with an authored bookmark, so the base shot is known exactly.
const PAYLOAD = {
  cameras: [{ worldFraming: { cameraPosition: [-7, 31, 9], lookAt: [16, 8, 5], horizontalFov: 82 } }],
  faces: [],
};

describe('motion/world-motion — worldMotionCameras', () => {
  it('is cameraPathFor over the world base shot, with the render defaults', () => {
    const { cameras, width, height, frameCount } = worldMotionCameras({ payload: PAYLOAD, motion: 'orbit', params: { from: 0, to: 120 }, frames: 36 });
    expect([width, height, frameCount]).toEqual([720, 540, 36]);
    const manifest = { camera: { worldFraming: PAYLOAD.cameras[0].worldFraming, viewBox: { width, height } } };
    expect(cameras).toEqual(cameraPathFor('orbit', { manifest, frames: 36, params: { from: 0, to: 120 } }).cameras);
  });

  it('defaults the frame count per motion', () => {
    expect(worldMotionCameras({ payload: PAYLOAD, motion: 'push_in' }).frameCount).toBe(24);
    expect(worldMotionCameras({ payload: PAYLOAD, motion: 'flythrough', params: { keyframes: [{ pos: [0, 0, 1], lookAt: [1, 0, 1] }, { pos: [1, 0, 1], lookAt: [2, 0, 1] }] } }).frameCount).toBe(36);
  });
});

describe('motion/blender-film — the shot file', () => {
  const { cameras, width, height } = worldMotionCameras({ payload: PAYLOAD, motion: 'dolly_zoom', params: { end_scale: 0.7 }, frames: 12 });
  const shot = filmShot({ motionRef: 'mo_test', worldRef: 'sk_test', title: 'T', motion: 'dolly_zoom', fps: 12, width, height, cameras: cameras.map((c) => c.worldFraming) });

  it('carries every rendered camera, frame for frame', () => {
    expect(shot.frame_count).toBe(12);
    expect(shot.cameras).toHaveLength(12);
    cameras.forEach((c, i) => {
      expect(shot.cameras[i].pos).toEqual(c.worldFraming.cameraPosition.map((v) => Math.round(v * 1e6) / 1e6));
      expect(shot.cameras[i].look_at).toEqual(c.worldFraming.lookAt);
      expect(shot.cameras[i].hfov_deg).toBeCloseTo(c.worldFraming.horizontalFov, 5);
    });
    // a dolly-zoom widens the FOV as it tracks in — the zoom rides the file
    expect(shot.cameras[11].hfov_deg).toBeGreaterThan(shot.cameras[0].hfov_deg);
  });

  it('names its source and frame for the Blender side', () => {
    expect(shot).toMatchObject({ source: 'mojulo', film_version: BLENDER_FILM_VERSION, world_ref: 'sk_test', motion_ref: 'mo_test', up: 'z', fps: 12, width: 720, height: 540 });
  });

  it('refuses an empty camera list', () => {
    expect(() => filmShot({ worldRef: 'sk_x', motion: 'orbit', fps: 12, width: 1, height: 1, cameras: [] })).toThrow(/no cameras/);
  });

  it('adds atmosphere.json after the shot when one is given', () => {
    const atmosphere = filmAtmosphere({ payload: { faces: [] }, manifest: {} });
    const files = emitBlenderFilm({ shot, title: 'T', atmosphere }).files.map((f) => f.file);
    expect(files.slice(0, 2)).toEqual(['shot.json', 'atmosphere.json']);
  });

  it('emits the film layer deterministically', () => {
    const a = emitBlenderFilm({ shot, title: 'T' });
    const b = emitBlenderFilm({ shot, title: 'T' });
    expect(a).toEqual(b);
    expect(a.files.map((f) => f.file)).toEqual(['shot.json', 'film_shots.py', 'film_light.py', 'film_render.py', 'FILM.md']);
    expect(JSON.parse(a.files[0].text)).toEqual(shot);
    expect(a.files[4].text).toContain('mo_test');
  });
});

describe('motion/blender-film — the Blender scripts', () => {
  const scripts = { film_shots: filmShotsPy(), film_light: filmLightPy(), film_render: filmRenderPy() };

  it('are constant text carrying the film version', () => {
    for (const [name, text] of Object.entries(scripts)) {
      expect(text, name).toContain(`v${BLENDER_FILM_VERSION}`);
      expect(text, name).not.toContain('${');
      expect(text, name).toMatch(/^"""\n/);
      expect(text, name).toMatch(/\nmain\(\)\n$/);
    }
  });

  it('end with a done marker the CLI waits on', () => {
    expect(scripts.film_shots).toContain('MOJ_FILM_SHOTS_DONE');
    expect(scripts.film_light).toContain('MOJ_FILM_LIGHT_DONE');
    expect(scripts.film_render).toContain('MOJ_FILM_RENDER_DONE');
  });


  it('write renders beside the .blend, never into the working directory by default', () => {
    expect(scripts.film_shots).toContain("os.path.join(beside, 'check')");
    expect(scripts.film_render).toContain("os.path.join(here, 'film')");
  });
});

describe('motion/blender-film — the declared atmosphere', () => {
  const lamp = (i) => ({ name: `lamp-${i}`, type: 'point', position: [i, 2, 2.06], color: [1, 0.78, 0.44], intensity: 390 });
  const water = { kind: 'canal-water', water: true, liquid: 'canal', alpha: 0.9, fill: '#3c524e', corners: [[2, 13.9, -0.3], [50.933712, 13.9, -0.3], [50.933712, 21.3, -0.3], [2, 21.3, -0.3]] };

  it('carries the sky preset, every lamp by name, the water faces and the units', () => {
    const atm = filmAtmosphere({
      payload: { sky: { preset: 'night', stars: true, moon: true }, lights: [lamp(0), lamp(1)], faces: [water, { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }], metersPerUnit: 3.66 },
      manifest: { time: 'night' },
    });
    expect(atm).toMatchObject({ film_version: BLENDER_FILM_VERSION, preset: 'night', sky: { preset: 'night', stars: true, moon: true }, meters_per_unit: 3.66, fog: null });
    expect(atm.lamps).toEqual([{ name: 'lamp-0', intensity: 390 }, { name: 'lamp-1', intensity: 390 }]);
    expect(atm.water).toEqual([{ corners: water.corners, fill: '#3c524e', alpha: 0.9, liquid: 'canal' }]);
  });

  it('falls back to the manifest time when the payload declares no sky', () => {
    expect(filmAtmosphere({ payload: { faces: [] }, manifest: { time: 'day' } }).preset).toBe('day');
    expect(filmAtmosphere({ payload: { faces: [] }, manifest: {} }).preset).toBeNull();
  });

  it('reads fog as the world composes it: the recipe knobs over the shared defaults', () => {
    const composed = { faces: [], fog: { frag: '…' } };
    expect(filmAtmosphere({ payload: composed, manifest: { fog: true } }).fog).toEqual({
      height: FOG_DEFAULTS.height, density: FOG_DEFAULTS.density, color: [...FOG_DEFAULTS.color], reach: FOG_DEFAULTS.maxDist,
    });
    expect(filmAtmosphere({ payload: composed, manifest: { fog: { height: 4, density: 0.24, color: [1, 0.9, 0.8], maxDist: 80 } } }).fog)
      .toEqual({ height: 4, density: 0.24, color: [1, 0.9, 0.8], reach: 80 });
  });

  it('carries no fog when the kind composed none, whatever the recipe says', () => {
    expect(filmAtmosphere({ payload: { faces: [] }, manifest: { fog: true } }).fog).toBeNull();
  });

  it('the light script performs each declaration, and keeps an operator\'s own lights', () => {
    const py = filmLightPy();
    for (const word of ['atmosphere.json', "'night'", "'dawn'", "'interior'", 'film-moon', 'film-fog', 'film-water']) {
      expect(py, word).toContain(word);
    }
    expect(py).toContain("o.name.startswith('light:')");      // mojulo's imported lamps are not the operator's lights
    expect(py).toMatch(/if yours and not force:/);
  });
});
