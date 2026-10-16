// Characterization pin: a drawn track is a compatibility promise over minted rows (recipes, not renders). A step that
// changes what a circuit or stage emits re-pins here with a comment saying why.
// re-pinned 2026-10-13 (driving primitives D3): the payload carries the contract (stations, lines, checkpoints, grid,
// racing line, bands), and a stage's start line moved in to 30 m so a grid of eight stands behind it.
// re-pinned 2026-10-13 (driving primitives D4): the payload carries the barriers' colliders (the drive rule's walls).
// re-pinned 2026-10-13 (driving primitives D5): a ramp's landing band counts speed as the drive rule does (over the
// ground in plan, climbing at v·grade), so the stunt park's bands moved (its gap now 36–40 km/h, was 40–43).
// pinned per architecture 2026-10-16 (3.1.0 CI): the roads builders call Math, not dmath (util/math-scope.js), and
// V8 rounds their transcendentals one way on x64 and the other on arm64, so the faces and some cameras differ by CPU
// (the same on every Node major measured: 22, 22.14 and 24). The contract (`roadway`) is the same bytes everywhere and
// is held on every machine. Moving the roads onto dmath makes this one pin again.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { assembleRoadwayScene } from './roadway.js';

const h = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

const ROADWAY = {
  'kart-oval': 'c6e2d3184c9633225f4a36f068808e0a16a4b92fb9fdd3d4dd71b8d81b0fb1e3',
  'figure-eight': '7093b8bf4585da18f77b1f48063ce528478fe98cc37e009995f321b0ab11ff27',
  'stunt-park': 'a67ae28de526638eda81d6480626f4e11c885d956659b0e3db39b83c9e1159b0',
  'rally-stage': '043b3de43e3699304a34d406ea2c9405227c1ffe64b517d9602e238e18b5c511',
};
const DRAWN = {
  arm64: {
    'kart-oval': { faces: 'e6ca922e66fff42416209c981640b90d465f8e9aacdbaf31e636bb8b26b48d9e', cameras: '0a435bdb168d4a39f70036be74bde0168c3460bc52d9564dc646a032f89c4b80' },
    'figure-eight': { faces: '5fe081bbf00c7adb36d51e4cabe56ec139163911db6fcf6ca0ab45aee4cdf0c5', cameras: 'e3187bab92f5bfedbce7042315638be43e776df158929fe1d745d88660a7ae24' },
    'stunt-park': { faces: 'd19c23def084d5ff823c36a34fd2da0e63d79ded60726b301118090daa4edf00', cameras: 'eab8914bc368182557179d66287a93b2e0c06cf61425ea98016f30877b702978' },
    'rally-stage': { faces: 'da618cb041aa8b6e2c2b1e5c2238f6909027345e76eea6cc702f1fee76733f8d', cameras: 'dab7d9be1b01adc553679759613b772270f147fd241056dccf037110eb42b658' },
  },
  x64: {
    'kart-oval': { faces: 'c3ef48be745e993118b442160f542c4cf476bd2da088e65977176bb553bd72b2', cameras: '0a435bdb168d4a39f70036be74bde0168c3460bc52d9564dc646a032f89c4b80' },
    'figure-eight': { faces: 'b213ef1283d4a38dd284305711c25e3bb7e45081bc7921b63c5b53147921aada', cameras: 'e3187bab92f5bfedbce7042315638be43e776df158929fe1d745d88660a7ae24' },
    'stunt-park': { faces: 'd19c23def084d5ff823c36a34fd2da0e63d79ded60726b301118090daa4edf00', cameras: 'eab8914bc368182557179d66287a93b2e0c06cf61425ea98016f30877b702978' },
    'rally-stage': { faces: 'eeb59746e940c9ac084ff71970c3946d944e82c4b8381b8781977b7b6f78dc03', cameras: 'bea4f171271a98514128e8fb6d1f87a5052289cce6ba37ecacd234c3067316bb' },
  },
};

describe('tracks, pinned', () => {
  it('the kart oval, the figure of eight, the stunt park and the rally stage', () => {
    const pin = (m) => { const p = assembleRoadwayScene(m); return { faces: h(p.faces), roadway: h(p.roadway), cameras: h(p.cameras) }; };
    const got = {
      'kart-oval': pin({ form: 'circuit', course: 'kart-oval' }),
      'figure-eight': pin({ form: 'circuit', course: 'figure-eight' }),
      'stunt-park': pin({ form: 'circuit', course: 'stunt-park' }),
      'rally-stage': pin({ form: 'stage', course: 'rally-stage' }),
    };
    for (const [course, p] of Object.entries(got)) {
      expect(p.roadway, course).toBe(ROADWAY[course]);
      const drawn = DRAWN[process.arch]?.[course];
      if (drawn) expect({ faces: p.faces, cameras: p.cameras }, course).toEqual(drawn);
    }
  });
});
