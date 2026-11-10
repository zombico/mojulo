/**
 * Example plates (book/drawn-plate.js): each is what an agent writes. No pixel is placed; a plate is forms standing
 * on the ground in metres (z up), where the draughtsman stands, and where the light is. Read by the tests and by
 * `scripts/drawn-plate.mjs`.
 */

const lathe = (id, base, heightM, profile, extra = {}) => ({
  id, op: 'add', ...extra,
  shape: { kind: 'lathe', axisFrom: base, axisTo: [base[0], base[1], base[2] + heightM], profile: profile.map(([t, radius]) => ({ t, radius })) },
});

/** A still life: a cup on a crate, a ball beside it. A box, a turned form and a sphere under one light. */
export const stillLife = {
  width: 480, height: 400,
  station: { turn: 32, eye: 1.25, distance: 3.4, lens: 38, look: [0.05, 0, 0.42] },
  light: { azimuth: -36, elevation: 46 },
  forms: [
    { id: 'crate', tint: '#b08a5a', terms: [{ op: 'add', shape: { kind: 'box', center: [0, 0, 0.25], size: [0.9, 0.6, 0.5], round: 0.012 } }] },
    {
      id: 'cup', tint: '#d9d2c2', gloss: true,
      terms: [
        lathe('wall', [-0.12, 0, 0.5], 0.3, [[0, 0.075], [0.08, 0.085], [1, 0.125]]),
        { op: 'round', radius: 0.004 },
        { ...lathe('bore', [-0.12, 0, 0.52], 0.3, [[0, 0.06], [1, 0.115]]), op: 'subtract' },
      ],
    },
    { id: 'ball', tint: '#d9765c', gloss: true, terms: [{ op: 'add', shape: { kind: 'sphere', center: [0.72, -0.28, 0.17], radius: 0.17 } }] },
  ],
};

/** A grimoire's plate: an alembic, a candle, a toadstool and a book. Turned and blended forms. */
export const alchemy = {
  width: 560, height: 420,
  station: { turn: 24, eye: 0.62, distance: 2.3, lens: 36, look: [0.02, 0, 0.26] },
  light: { azimuth: -62, elevation: 38 },
  forms: [
    {
      id: 'alembic', tint: '#9fb3a0', gloss: true,
      terms: [
        lathe('belly', [0, 0, 0], 0.56, [[0, 0.07], [0.04, 0.13], [0.2, 0.185], [0.36, 0.17], [0.52, 0.09], [0.62, 0.045], [0.9, 0.04], [0.96, 0.055], [1, 0.05]]),
        { op: 'round', radius: 0.006 },
        {
          op: 'add', blend: 0.03,
          shape: { kind: 'sweep', radius: 0.022, path: [[0, 0, 0.5], [0.09, 0.02, 0.56], [0.2, 0.04, 0.54], [0.32, 0.07, 0.44], [0.42, 0.09, 0.3]] },
        },
      ],
    },
    {
      id: 'candle', tint: '#e6d9b8',
      terms: [
        lathe('stick', [-0.36, 0.12, 0], 0.3, [[0, 0.036], [0.9, 0.034], [1, 0.02]]),
        { op: 'add', blend: 0.02, shape: { kind: 'ellipsoid', center: [-0.325, 0.1, 0.2], radii: [0.012, 0.012, 0.05] } },
        { op: 'add', blend: 0.03, shape: { kind: 'ellipsoid', center: [-0.36, 0.12, 0.01], radii: [0.07, 0.07, 0.014] } },
      ],
    },
    {
      id: 'flame', tint: '#f1c15a', tintOpacity: 0.9,
      terms: [{ op: 'add', shape: { kind: 'roundCone', a: [-0.36, 0.12, 0.325], b: [-0.36, 0.12, 0.375], ra: 0.016, rb: 0.004 } }],
    },
    {
      id: 'toadstool', tint: '#b5523c',
      terms: [
        { op: 'add', shape: { kind: 'roundCone', a: [0.34, -0.2, 0.0], b: [0.33, -0.2, 0.15], ra: 0.03, rb: 0.022 } },
        { op: 'add', blend: 0.012, shape: { kind: 'ellipsoid', center: [0.33, -0.2, 0.16], radii: [0.1, 0.1, 0.05] } },
        { op: 'subtract', blend: 0.02, shape: { kind: 'box', center: [0.33, -0.2, 0.09], size: [0.4, 0.4, 0.1] } },
        { op: 'add', blend: 0.01, shape: { kind: 'roundCone', a: [0.34, -0.2, 0.0], b: [0.33, -0.2, 0.15], ra: 0.03, rb: 0.022 } },
      ],
    },
    {
      id: 'book', tint: '#6f4a35',
      terms: [
        { op: 'add', shape: { kind: 'box', center: [-0.08, -0.34, 0.035], size: [0.34, 0.24, 0.07], round: 0.008 } },
        { op: 'transform', rotate: [0, 0, 18] },
      ],
    },
  ],
};

/** An organic mass: forms that melt into one another and are cut into (blended adds and subtracts). */
export const skull = {
  width: 480, height: 420,
  station: { turn: 28, eye: 0.3, distance: 1.25, lens: 34, look: [0, 0, 0.14] },
  light: { azimuth: -50, elevation: 48 },
  forms: [
    {
      id: 'skull', tint: '#ded3bb',
      terms: [
        { op: 'add', shape: { kind: 'ellipsoid', center: [0, 0.03, 0.17], radii: [0.1, 0.125, 0.105] } },
        { op: 'add', blend: 0.04, shape: { kind: 'box', center: [0, -0.06, 0.075], size: [0.11, 0.09, 0.09], round: 0.03 } },
        { op: 'add', blend: 0.03, shape: { kind: 'ellipsoid', center: [-0.07, -0.045, 0.12], radii: [0.03, 0.035, 0.02] } },
        { op: 'add', blend: 0.03, shape: { kind: 'ellipsoid', center: [0.07, -0.045, 0.12], radii: [0.03, 0.035, 0.02] } },
        { op: 'subtract', blend: 0.014, shape: { kind: 'ellipsoid', center: [-0.042, -0.1, 0.15], radii: [0.028, 0.045, 0.026] } },
        { op: 'subtract', blend: 0.014, shape: { kind: 'ellipsoid', center: [0.042, -0.1, 0.15], radii: [0.028, 0.045, 0.026] } },
        { op: 'subtract', blend: 0.008, shape: { kind: 'roundCone', a: [0, -0.115, 0.118], b: [0, -0.11, 0.092], ra: 0.006, rb: 0.016 } },
        { op: 'subtract', blend: 0.004, shape: { kind: 'box', center: [0, -0.11, 0.045], size: [0.09, 0.03, 0.006] } },
      ],
    },
  ],
};

export const PLATE_EXAMPLES = Object.freeze({ stillLife, alchemy, skull });
