/**
 * Shoot plan — the worked example: a small fractal city and three shots in After Effects words. One camera per
 * procedure the kernel has: a two-node crane down with Easy Ease, a two-node street dolly that racks the lens from
 * 35 to 50 mm, a one-node camera that holds and then pans and tilts, and a camera that pans with a car, then eases
 * from its fixed place onto the car's tail and rides along (`car:3` drives east on the y ≈ 13.6 lane and stops at the
 * light near x ≈ 29.3 by 6 s). The fixture the tests and
 * `scripts/shoot-plan-demo.mjs` share; also the shape the vocabulary card teaches.
 *
 * Positions are in the world's own units, like every other world point: this city's are 3.66 m (its
 * `metersPerUnit`), its blocks span x 0–40 and y 0–28, the avenue runs up x ≈ 13.5, the tallest roof is z ≈ 11.
 */
export const EXAMPLE_CITY = { kind: 'fractal-city', region: { x: 0, y: 0, w: 40, d: 28 }, depth: 2, seed: 1, walkers: true, traffic: true };

export const EXAMPLE_SHOOT = {
  fps: 24,
  cameras: [
    {
      id: 'crane', name: 'Crane down', type: 'two-node', lens: '24mm',
      keys: [
        { t: 0, pos: [-16, -20, 24], poi: [20, 14, 0], ease: 'easy ease' },
        { t: 4, pos: [6, -7, 4], poi: [20, 12, 2], ease: 'easy ease' },
      ],
    },
    {
      id: 'dolly', name: 'Up the avenue', type: 'two-node', lens: '35mm',
      keys: [
        { t: 0, pos: [13.5, -4, 0.9], poi: [13.5, 8, 1.5], ease: 'easy ease out' },
        { t: 3, pos: [13.5, 12, 0.9], poi: [16.5, 24, 2.5] },
        { t: 5, pos: [14.5, 30, 1.4], poi: [24, 36, 4], lens: '50mm', ease: 'easy ease in' },
      ],
    },
    {
      id: 'reveal', name: 'Hold, then reveal', type: 'one-node', lens: '50mm',
      keys: [
        { t: 0, pos: [46, 6, 3], yaw: 165, pitch: -6, ease: 'hold' },
        { t: 1.5, pos: [46, 6, 3], yaw: 165, pitch: -6, ease: 'easy ease' },
        { t: 4.5, pos: [56, 40, 22], yaw: 216, pitch: -25, lens: '85mm', ease: 'easy ease' },
      ],
    },
    {
      id: 'pickup', name: 'Pick up the car', type: 'two-node', lens: '28mm',
      keys: [
        { t: 0, pos: [19, 9, 3.5], poi: { follow: 'car:3', offset: [0, 0, 0.3] }, ease: 'easy ease out' },
        { t: 3, pos: { follow: 'car:3', offset: [-3.5, 0.4, 1.3], frame: 'subject' }, poi: { follow: 'car:3', offset: [4, 0, 0.3], frame: 'subject' }, ease: 'easy ease in' },
        { t: 6, pos: { follow: 'car:3', offset: [-3.5, 0.4, 1.3], frame: 'subject' }, poi: { follow: 'car:3', offset: [4, 0, 0.3], frame: 'subject' } },
      ],
    },
  ],
  shots: [
    { name: 'Establishing', camera: 'crane', span: [0, 4] },
    { name: 'Up the avenue', camera: 'dolly', span: [0, 5] },
    { name: 'Reveal', camera: 'reveal', span: [0, 4.5] },
    { name: 'Pick up the car', camera: 'pickup', span: [0, 6] },
  ],
};
