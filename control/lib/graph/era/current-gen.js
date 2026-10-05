/**
 * CURRENT-ERA reference cards: the titles a stage can take its LOOK from while the sixth-gen era card (sixth-gen.js)
 * still sets its BUDGET (the frame, the tile sizes, light baked into vertex colour). The look of these titles is art
 * direction, not hardware: a locked palette, painted skies, cel bands, authored depth. That is what the composer reads
 * from them; the draw distance, the grass density and the real-time light are what it leaves behind.
 *
 * Data, not code paths, in the sixth-gen cards' shape. Numbers are starting points read off the games' frames by eye,
 * to be tuned at the eyes gate; none is a measured fact about a shipped game.
 */
export const CURRENT_GEN_REFERENCES = Object.freeze({
  genshin: Object.freeze({
    title: 'Genshin Impact',
    setting: 'anime open field',
    kit: 'isekai-meadow',
    surfaces: ['grass-field', 'cliff-strata', 'round-crown', 'grass-cap', 'painted-sky'],
    palette: { base: '#8cc63c', accent: '#f2c84a', warm: '#ffe6a0' },
    light: { ambient: '#9cc2e8', key: { color: '#fff2d0', elevation: 42, azimuth: 60 }, placed: [], contrast: 'cel-two-tone' },
    air: { fog: { color: '#b4d8f0', density: 0.004 }, sky: 'anime-day', dome: { zenith: [40, 108, 220], horizon: [186, 222, 244] } },
  }),
  botw: Object.freeze({
    title: 'The Legend of Zelda: Breath of the Wild',
    setting: 'painterly open field',
    kit: 'isekai-meadow',
    surfaces: ['grass-field', 'cliff-strata', 'broadleaf-crown', 'painted-sky'],
    palette: { base: '#9ab850', accent: '#d8a040', warm: '#f4e2b0' },
    light: { ambient: '#a6bcd6', key: { color: '#fff0d4', elevation: 38, azimuth: 70 }, placed: [], contrast: 'soft-cel' },
    air: { fog: { color: '#c4d6e2', density: 0.006 }, sky: 'painterly-day', dome: { zenith: [62, 120, 196], horizon: [200, 220, 232] } },
  }),
});

export const CURRENT_GEN_REFERENCE_IDS = Object.freeze(Object.keys(CURRENT_GEN_REFERENCES));
