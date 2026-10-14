/**
 * Shoot plan — the worked example: a small fractal city and three shots in After Effects words. One camera per
 * procedure the kernel has: a two-node crane down with Easy Ease, a two-node street dolly that racks the lens from
 * 35 to 50 mm, a one-node camera that holds and then pans and tilts, and a camera that pans with a car, then eases
 * from its fixed place onto the car's tail and rides along (`car:3` drives east on the y ≈ 13.6 lane and stops at the
 * light near x ≈ 29.3 by 6 s). The cuts are a wipe, a portal, a pipe and a fade; the wormhole opens behind two
 * flats that ride its camera like stage doors. A wormhole tube is laid along the last camera's path and two neon walls along the
 * dolly's: pieces swept along a path, round or box. The cut into the reveal is a portal: a door stood where the dolly
 * ends, through which the reveal camera's first frame shows; a window by the avenue looks live into the wormhole. The fixture the tests and
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
      // 2.3 units up (≈ 8.4 m): lower, the clearance gates find it passing through a signal's wires and the
      // southbound truck (car:17) at 3.7 s
      id: 'dolly', name: 'Up the avenue', type: 'two-node', lens: '35mm',
      keys: [
        { t: 0, pos: [13.5, -4, 2.3], poi: [13.5, 8, 1.5], ease: 'easy ease out' },
        { t: 3, pos: [13.5, 12, 2.3], poi: [16.5, 24, 2.5] },
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
    {
      id: 'worm', name: 'Wormhole', type: 'two-node', lens: '24mm',
      keys: [
        { t: 0, pos: [-12, 14, 14], poi: [10, 0, 16], ease: 'easy ease out' },
        { t: 1.5, pos: [10, 0, 16], poi: [30, 14, 14] },
        { t: 3, pos: [30, 14, 14], poi: [50, 28, 18] },
        { t: 4.4, pos: [50, 28, 18], poi: [70, 30, 18], ease: 'easy ease in' },
      ],
    },
  ],
  shots: [
    { name: 'Establishing', camera: 'crane', span: [0, 4] },
    { name: 'Up the avenue', camera: 'dolly', span: [0, 5], in: { type: 'wipe', duration: 0.8 } },
    { name: 'Reveal', camera: 'reveal', span: [0, 4.5], in: { type: 'portal', duration: 1.6 } },
    { name: 'Pick up the car', camera: 'pickup', span: [0, 6], in: { type: 'pipe', duration: 1.6 } },
    { name: 'Wormhole', camera: 'worm', span: [0, 4.4], in: 'fade' },
  ],
  pieces: [
    // a window by the avenue into the wormhole camera, live: walk past it and the view through it shifts
    { id: 'window', kind: 'frame', shape: 'square', size: [3, 2.2], border: 0.18, color: '#5be0ff', portal: { camera: 'worm' },
      shots: ['Up the avenue'], keys: [{ t: 0, at: [17, 22, 2.2], rot: [270, 0, 0] }] },
    // a ringed tube laid along the wormhole camera's own path, which it flies the length of
    { id: 'wormhole', kind: 'pipe', along: 'worm', span: [0.6, 3.8], radius: 2.4, color: '#0f1a3a', color2: '#5be0ff' },
    // the same idea in a box: two neon walls along the avenue dolly's path (a corridor with no floor or ceiling)
    { id: 'neon', kind: 'wall', along: 'dolly', side: 'both', size: [3.4, 2.4], span: [0.4, 3.2], color: '#ff3fa4', color2: '#2a0b25' },
    // two flats riding the wormhole camera, closed like stage doors as it fades up, drawn apart as it flies
    { id: 'door-left', kind: 'wall', attach: 'worm', size: [1.2, 2], color: '#101218',
      keys: [{ t: 0.2, at: [1, 0.3, 0], ease: 'easy ease' }, { t: 1.1, at: [1, 1.6, 0], ease: 'easy ease' }] },
    { id: 'door-right', kind: 'wall', attach: 'worm', size: [1.2, 2], color: '#101218',
      keys: [{ t: 0.2, at: [1, -0.3, 0], ease: 'easy ease' }, { t: 1.1, at: [1, -1.6, 0], ease: 'easy ease' }] },
  ],
};
