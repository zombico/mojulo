/**
 * The spike's hand-authored motion-outcome manifest (pan-cel-motion.plan.md,
 * spike build step 1). No validator yet — the fixture IS the contract sketch
 * the eventual normalizer will be written against.
 *
 * Shot: a lone walker crossing a dusk esplanade, left to right. Frame-anchored
 * 6-cel walk cycle + an ease-in-out window pan over an oversized plate — the
 * classic walk illusion. One directional light (low sun from frame-left),
 * stated in every brief and locked by the plate → key → cels chain.
 */

export const FRAME = { width: 1536, height: 1024 };
export const PLATE_VIEW = { width: 3072, height: 1280 };

// Figure staging (frame coordinates): mid-torso anchor, feet on the road.
// scale 2.8 → figure spans ~560px, ~55% of frame height (wide-cinematic band).
export const FIGURE = { x: 768, y: 600, scale: 2.8 };

// The cel hotspot in frame coordinates — the only per-frame generative surface.
// Sized to the widest stride plus shadow-throw margin toward frame-right
// (light from the left throws contact shadow right).
export const CEL_RECT = { x: 508, y: 292, w: 520, h: 648 };

/**
 * The sub-cel fixture (plan: "Sub-cels — the talking-mouth + blink
 * primitive"). A HELD close-up of the same character delivering a line:
 * one base cel + 2 mouth states + 2 eyelid states = 5 generations for an
 * 8-second shot. Base states (mouth closed, eyes open) are painted INTO
 * the held cel; tracks are deterministic (speech spans + seeded blinks).
 */
export function talkingHeadFixture() {
  return {
    kind: 'motion-outcome',
    contractVersion: 'motion-outcome/v0-spike',
    variant: 'held-shot',
    title: 'Esplanade Walk — she speaks',
    intent:
      'A held close-up of the walker pausing at the seawall to deliver a line, dusk light from frame-left; only her mouth and eyes move.',
    frame: { width: 1024, height: 768 },
    fps: 6,
    durationSec: 8,
    loop: true,

    heldCel: {
      description:
        'Close-up bust of the character from the key sheet, three-quarter-right, at the seawall with the dusk sky behind; mouth CLOSED, eyes OPEN — these are the base states the sub-cels swap against.',
      camera: { kind: 'close-up' },
    },

    // RECT CALIBRATION (sub-cel round 1 lesson): these rects are MEASURED
    // from the accepted held cel (renders/held-cel.png), not guessed at
    // authoring time — the face exists first, then the regions. Her face
    // is three-quarter-right: eyes span x≈475–630 at y≈345–385, mouth
    // centers at ≈(580, 461).
    subCels: [
      {
        id: 'mouth',
        vocab: 'mouth',
        rect: { x: 516, y: 420, w: 128, h: 84 },
        track: {
          kind: 'speech',
          spans: [{ from: 0.6, to: 2.4 }, { from: 3.2, to: 5.4 }, { from: 6.0, to: 7.2 }],
          flapsPerSec: 8,
        },
      },
      {
        id: 'eyes',
        vocab: 'blink',
        rect: { x: 456, y: 332, w: 212, h: 72 },
        track: { kind: 'blink', seed: 7, meanGapSec: 3 },
      },
    ],
  };
}

export function walkCycleFixture() {
  return {
    kind: 'motion-outcome',
    contractVersion: 'motion-outcome/v0-spike',
    title: 'Esplanade Walk',
    intent:
      'A lone walker crosses a quiet seaside esplanade at dusk, left to right, as the camera pans with the light low behind frame-left.',
    frame: { ...FRAME },
    fps: 6,
    // GAIT LOCK (round 3 — see the plan retrospective): pan speed must equal
    // the cycle's planted-foot regression or the figure skates. The stick
    // vocab regresses ~23 units/frame × scale 2.8 ≈ 64px/frame; the plate's
    // 1536px of pan room buys 23 intervals at ~67px — a 4-second shot of
    // honest walking (4 clean 6-cel cycles). A longer walk needs a wider
    // plate, not a slower pan.
    durationSec: 4,
    loop: true,

    plate: {
      // an image-outcome manifest, oversized relative to the frame
      kind: 'image-outcome',
      title: 'Esplanade Walk — plate',
      intent:
        'The full panning background for a walk shot: a long seaside esplanade at dusk — road, seawall, distant headland, open sky. No figures anywhere.',
      viewBox: { ...PLATE_VIEW },
      camera: { kind: 'wide-cinematic' },
      horizonY: 660,
      vanishingPoint: [2400, 660],
      forms: [
        { id: 'sky', role: 'dusk sky corridor', depthBand: 'background', depthRank: 0, preserve: 'loose',
          polygon: [[0, 0], [3072, 0], [3072, 660], [0, 660]] },
        { id: 'headland', role: 'distant headland silhouette', depthBand: 'background', depthRank: 1, preserve: 'guided',
          polygon: [[1900, 560], [3072, 520], [3072, 660], [1900, 660]] },
        { id: 'seawall', role: 'low seawall running with the road', depthBand: 'midground', depthRank: 2, preserve: 'guided',
          polygon: [[0, 620], [3072, 648], [3072, 760], [0, 780]] },
        { id: 'road', role: 'esplanade road plane, edges stay fixed', depthBand: 'midground', depthRank: 3, preserve: 'strict',
          polygon: [[0, 780], [3072, 760], [3072, 1130], [0, 1180]] },
        { id: 'verge', role: 'foreground verge / paving band', depthBand: 'foreground', depthRank: 4, preserve: 'guided',
          polygon: [[0, 1130], [3072, 1090], [3072, 1280], [0, 1280]] },
      ],
      renderBrief: {
        style: 'painterly ink-and-gouache animation background, cel-animation plate',
        mood: 'quiet, end-of-day calm',
        lighting: 'single low sun from frame-left, warm key, long soft shadows falling toward frame-right',
        mustPreserve: [
          'horizon height and vanishing point',
          'road plane edges (strict)',
          'seawall line and occlusion order',
          'even paintability across the full width — every crop of this plate is a valid frame background',
        ],
        mayInvent: ['paving texture', 'railings', 'distant lamps (unlit)', 'clouds', 'sea surface'],
        negative: [
          'no people, animals, or vehicles anywhere',
          'no readable text or signage',
          'do not vignette or darken the edges — the frame window pans across the full plate',
        ],
      },
    },

    characterKey: {
      // cel 0 — the pre-scene render; tooling, never footage
      character:
        'A young woman in a knee-length coat and flat boots, hands loose, short dark hair, a small crossbody bag; unhurried posture.',
      facings: ['front', 'three-quarter-right', 'right', 'back'],
      scaffold: 'stick', // rig-scaffold A/B is a stretch goal (plan step 2)
    },

    cels: [
      { id: 'c1', pose: 'walk-contact-a', facing: 'right' },
      { id: 'c2', pose: 'walk-down-a', facing: 'right' },
      { id: 'c3', pose: 'walk-passing-a', facing: 'right' },
      { id: 'c4', pose: 'walk-contact-b', facing: 'right' },
      { id: 'c5', pose: 'walk-down-b', facing: 'right' },
      { id: 'c6', pose: 'walk-passing-b', facing: 'right' },
    ],

    window: {
      keyframes: [
        { t: 0, x: 0, y: 128, scale: 1 },
        { t: 1, x: 1536, y: 128, scale: 1 },
      ],
      // LINEAR, not eased: cadence is constant, so ground speed must be too
      // (the gait-camera doctrine — phase advances by distance, not by time).
      // Eased pans read as the character being dragged and accelerating.
      easing: 'linear',
    },

    schedule: {
      cycle: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
      anchor: 'frame', // figure holds frame position; the world slides past
      figure: { ...FIGURE },
      celRect: { ...CEL_RECT },
    },
  };
}
