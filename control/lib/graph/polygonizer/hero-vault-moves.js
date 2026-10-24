/** hero-vault-moves — the vaults' MOVES (hero-vault.js solves them): data only, a leaf module, so the door's motion
 * (hero-motion.js) can list them at load without the solver, which imports the gaits from it. */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ─── the moves ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each is written for the LEFT foot taking off (the right leading); the right foot's is its mirror. A move's keys are its
// authored states between the gait's own: `name`, `dt` (seconds from the state before; a flight's inner states take a
// share `at` of it instead), the pose words (the rig's: hinge, spine, hips, knees, shoulders, elbows, head, facing), the
// contacts it holds (`feet` / `hands`: { side: 'floor' | 'top' } where the limb comes to rest there, 'hold' keeping it),
// `air` (the span to the next state is a flight), the pelvis height rule (`z`: 'reach' — the hands just on the top — or
// { rise } metres over the state before, or { over } that share of the leg's length over the top; never lower than the
// pose clears the box) and `v` (its run speed, a share of the gait's). `push` is the take-off's words, `rise` the first
// flight's inner states, `flight` the last flight's, `fall` its seconds, `land` the landing's words over the gait's,
// `landing` the foot that lands ('L' the take-off foot), `station` where the hand lands past the near edge (metres, or of
// the depth), `band` per gait and `depth` where the gate holds it.
const arms = (pL, eL, pR, eR, more = {}) => ({ shL: { pitch: pL, ...(more.L || {}) }, elbowL: eL, shR: { pitch: pR, ...(more.R || {}) }, elbowR: eR });
const legs = (hL, kL, hR, kR) => ({ hipL: typeof hL === 'number' ? { pitch: hL } : hL, kneeL: kL, hipR: typeof hR === 'number' ? { pitch: hR } : hR, kneeR: kR });

export const VAULTS = Object.freeze({
  // THE HURDLE: the trail (left) foot drives off, the lead knee drives up and the lead leg reaches out straight over the
  // box, the trunk diving over it, the opposite arm reaching; the trail leg comes round turned out at the side, high, and
  // through to the front as the lead foot comes down. The air time is solved for the clearance.
  hurdle: {
    from: ['jog', 'sprint'], band: { jog: [0.2, 0.75], sprint: [0.2, 0.95] }, depth: [0, 0.2], station: null,
    push: { hinge: 28, ...legs(-22, 12, 72, 70), ...arms(85, 25, -40, 80), head: { pitch: 18 }, heelL: -35 },
    flight: [
      { name: 'over', at: 0.45, words: { hinge: 40, ...legs({ pitch: 10, yaw: 60 }, 100, 85, 8), ...arms(95, 10, -45, 85), head: { pitch: 26 } } },
      { name: 'reach', at: 0.78, words: { hinge: 24, ...legs({ pitch: 48, yaw: 35 }, 105, 38, 8), ...arms(40, 50, -10, 84), head: { pitch: 16 } } },
    ],
    landing: 'R',
    land: { hipL: { pitch: 58, yaw: 12 }, kneeL: 105 },
  },
  // THE STEP VAULT: off the left foot, the right hand onto the top and the right foot beside it (a step up onto the
  // box), the left leg swinging over beside the planted foot and down the far side; the left foot lands, the right comes
  // off the top behind.
  stepVault: {
    from: ['jog'], band: { jog: [0.65, 0.9] }, depth: [0.25, 0.4], station: 0.24,
    push: { hinge: 28, ...legs(-20, 15, 75, 105), ...arms(90, 40, 70, 20), head: { pitch: 20 }, heelL: -38 },
    keys: [
      { name: 'handOn', dt: 0.15, words: { hinge: 40, ...legs(-10, 45, 95, 148), ...arms(120, 30, 62, 20), head: { pitch: 42 } }, hands: { R: 'top' }, z: 'reach', v: 0.88 },
      { name: 'rise', dt: 0.08, words: { hinge: 40, ...legs(15, 115, 70, 110), ...arms(110, 30, 45, 15), head: { pitch: 30 } }, feet: { R: 'top' }, z: { over: 0.25 }, v: 0.86 },
      { name: 'through', dt: 0.1, words: { hinge: 18, ...legs({ pitch: 85, yaw: -8 }, 110, 48, 85), ...arms(100, 30, 60, 60), head: { pitch: 12 } }, feet: { R: 'hold' }, z: { over: 0.4 }, v: 0.9 },
      { name: 'off', dt: 0.09, words: { hinge: 14, ...legs(80, 100, -15, 115), ...arms(80, 30, 25, 30), head: { pitch: 10 } }, feet: { R: 'hold' }, z: { over: 0.48 }, v: 1, air: true },
    ],
    fall: 0.32,
    flight: [{ name: 'tuckTrail', at: 0.45, words: { hinge: 16, ...legs(65, 60, 10, 115), ...arms(70, 30, 40, 40), head: { pitch: 10 } } }],
    land: { hipR: { pitch: 15 }, kneeR: 115 },
    // on a leg set back (hero-form LEG_SET, laws 3) the trailing foot hangs further back and lower: tucked tighter, it
    // clears the far edge (heroVault's `legSet`)
    legSet: { flight: [{ name: 'tuckTrail', at: 0.45, words: { hinge: 16, ...legs(65, 60, 10, 125), ...arms(70, 30, 40, 40), head: { pitch: 10 } } }] },
  },
  // THE SPEED VAULT: off the left foot, the right knee driving, the body turning to the right and reclining onto the
  // left hand on the top; the legs go over together beside it, the hand pushes off, the right foot lands and runs out.
  speedVault: {
    // (the trailing knee tucked to 75 in the gather and on the hand, and the band topped at 0.65 of the hip: measured once a
    // seated leg's toes rode its own shin under the facing — before, a misplaced toe cleared boxes the leg could not)
    from: ['sprint'], band: { sprint: [0.45, 0.65] }, depth: [0.1, 0.3], station: 0.05,
    push: { hinge: 14, facing: -10, ...legs(-20, 15, 78, 85), ...arms(55, 20, 25, 45), head: { pitch: 14 }, heelL: -30 },
    rise: [{ name: 'tuckIn', at: 0.3, words: { hinge: 10, facing: -18, ...legs(30, 85, 88, 60), ...arms(20, 30, 45, 40), head: { pitch: 12 } }, roll: -4, pitch: -12 },
      { name: 'gather', at: 0.62, words: { hinge: 4, facing: -28, spine: { sagittal: -0.08, lateral: 0.06 }, ...legs(82, 75, 92, 35), ...arms(-10, 30, 60, 40), head: { pitch: 10 } }, roll: -12, pitch: -32 }],
    keys: [
      { name: 'handOn', dt: 0.22, words: { hinge: 0, facing: -35, spine: { sagittal: -0.12, lateral: 0.12 }, ...legs(90, 75, 92, 8), ...arms(-35, 30, 70, 40, { R: { yaw: 30 } }), head: { pitch: 6 } }, roll: -18, pitch: -30, hands: { L: 'top' }, z: 'reach', v: 0.95, air: false },
      { name: 'over', dt: 0.13, words: { hinge: -4, facing: -45, spine: { sagittal: -0.16, lateral: 0.16 }, ...legs(90, 8, 92, 6), ...arms(-60, 10, 80, 40, { R: { yaw: 35 } }), head: { pitch: 8 } }, roll: -28, pitch: -35, z: { over: 0.3 }, v: 0.92, air: true },
    ],
    fall: 0.2,
    flight: [{ name: 'unwind', at: 0.55, words: { hinge: 8, facing: -15, spine: { sagittal: -0.04, lateral: 0.04 }, ...legs(55, 60, 45, 15), ...arms(40, 30, 55, 40), head: { pitch: 10 } }, roll: -6, pitch: -4 }],
    landing: 'R',
    land: { hipL: { pitch: 50 }, kneeL: 90 },
  },
  // THE KONG VAULT: off the left foot in a dive, both hands onto the top, the knees tucked up through between the arms
  // as the hands push the body on, the right leg reaching down the far side to land and run out.
  kongVault: {
    from: ['sprint'], band: { sprint: [0.35, 0.8] }, depth: [0.5, 1.1], station: (d) => clamp(d - 0.5, 0.12, 0.6),
    push: { hinge: 22, ...legs(-22, 10, 50, 80), ...arms(100, 20, 100, 20), head: { pitch: 30 }, heelL: -35 },
    keys: [
      { name: 'handsOn', dt: 0.2, words: { hinge: 12, ...legs(-8, 35, 0, 45), ...arms(110, 35, 110, 35), head: { pitch: 45 } }, pitch: 62, hands: { L: 'top', R: 'top' }, z: 'reach', v: 0.96 },
      { name: 'press', dt: 0.04, words: { hinge: 18, ...legs(5, 80, 5, 80), ...arms(80, 15, 80, 15), head: { pitch: 40 } }, pitch: 58, hands: { L: 'hold', R: 'hold' }, z: { rise: 0.14 }, v: 0.95 },
      { name: 'pushOff', dt: 0.05, words: { hinge: 30, ...legs(40, 125, 40, 125), ...arms(40, 5, 40, 5), head: { pitch: 35 } }, pitch: 50, hands: { L: 'hold', R: 'hold' }, z: { rise: 0.04 }, v: 0.95, air: true },
    ],
    fall: 0.36,
    flight: [
      { name: 'tuck', at: 0.18, words: { hinge: 25, ...legs(62, 135, 62, 135), ...arms(10, 30, 10, 30), head: { pitch: 30 } }, pitch: 30 },
      { name: 'carry', at: 0.6, words: { hinge: 22, ...legs(62, 130, 60, 125), ...arms(50, 30, 50, 30), head: { pitch: 26 } }, pitch: 20 },
      { name: 'open', at: 0.78, words: { hinge: 26, ...legs(55, 100, 50, 60), ...arms(80, 30, 80, 30), head: { pitch: 20 } }, pitch: 2 },
      { name: 'reach', at: 0.88, words: { hinge: 20, ...legs(50, 95, 42, 18), ...arms(55, 40, 35, 60), head: { pitch: 14 } } },
    ],
    landing: 'R',
    land: { hipL: { pitch: 55 }, kneeL: 100 },
  },
});
export const VAULT_NAMES = Object.freeze(Object.keys(VAULTS).flatMap((n) => [n, `${n}Left`]));
