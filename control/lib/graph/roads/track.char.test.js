// Characterization pin: a drawn track is a compatibility promise over minted rows (recipes, not renders). A step that
// changes what a circuit or stage emits re-pins here with a comment saying why.
// re-pinned 2026-10-13 (driving primitives D3): the payload carries the contract (stations, lines, checkpoints, grid,
// racing line, bands), and a stage's start line moved in to 30 m so a grid of eight stands behind it.
// re-pinned 2026-10-13 (driving primitives D4): the payload carries the barriers' colliders (the drive rule's walls).
// re-pinned 2026-10-13 (driving primitives D5): a ramp's landing band counts speed as the drive rule does (over the
// ground in plan, climbing at v·grade), so the stunt park's bands moved (its gap now 36–40 km/h, was 40–43).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { assembleRoadwayScene } from './roadway.js';

const h = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('tracks, pinned', () => {
  it('the kart oval, the figure of eight, the stunt park and the rally stage', () => {
    const pin = (m) => { const p = assembleRoadwayScene(m); return { faces: h(p.faces), roadway: h(p.roadway), cameras: h(p.cameras) }; };
    expect({
      'kart-oval': pin({ form: 'circuit', course: 'kart-oval' }),
      'figure-eight': pin({ form: 'circuit', course: 'figure-eight' }),
      'stunt-park': pin({ form: 'circuit', course: 'stunt-park' }),
      'rally-stage': pin({ form: 'stage', course: 'rally-stage' }),
    }).toMatchInlineSnapshot(`
      {
        "figure-eight": {
          "cameras": "e3187bab92f5bfedbce7042315638be43e776df158929fe1d745d88660a7ae24",
          "faces": "5fe081bbf00c7adb36d51e4cabe56ec139163911db6fcf6ca0ab45aee4cdf0c5",
          "roadway": "7093b8bf4585da18f77b1f48063ce528478fe98cc37e009995f321b0ab11ff27",
        },
        "kart-oval": {
          "cameras": "0a435bdb168d4a39f70036be74bde0168c3460bc52d9564dc646a032f89c4b80",
          "faces": "e6ca922e66fff42416209c981640b90d465f8e9aacdbaf31e636bb8b26b48d9e",
          "roadway": "c6e2d3184c9633225f4a36f068808e0a16a4b92fb9fdd3d4dd71b8d81b0fb1e3",
        },
        "rally-stage": {
          "cameras": "dab7d9be1b01adc553679759613b772270f147fd241056dccf037110eb42b658",
          "faces": "da618cb041aa8b6e2c2b1e5c2238f6909027345e76eea6cc702f1fee76733f8d",
          "roadway": "043b3de43e3699304a34d406ea2c9405227c1ffe64b517d9602e238e18b5c511",
        },
        "stunt-park": {
          "cameras": "eab8914bc368182557179d66287a93b2e0c06cf61425ea98016f30877b702978",
          "faces": "d19c23def084d5ff823c36a34fd2da0e63d79ded60726b301118090daa4edf00",
          "roadway": "a67ae28de526638eda81d6480626f4e11c885d956659b0e3db39b83c9e1159b0",
        },
      }
    `);
  });
});
