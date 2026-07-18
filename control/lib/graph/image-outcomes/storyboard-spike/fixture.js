/**
 * Storyboard spike fixture — "The Lantern and the Sea Wind" as a film
 * teaser sequence. Deliberately the SAME story and the SAME character as
 * the picture-book spike: NOA and the ink-brush Style Lock are imported,
 * not redeclared, so the spike demonstrates the character-sheet reuse
 * seam across artifact kinds (one bound sheet conditions book pages AND
 * storyboard frames).
 *
 * Frames are uniform 16:9 (1536×864). Board metadata (cameraMove, subject
 * move, dialogue, sfx, seconds, transition) is annotation — it reaches
 * the board overlay and bands, never the render instructions.
 *
 * Pure data — no Date, no dice. See storyboard.plan.md.
 */

import { NOA, BOOK_STYLE } from '../picture-book-spike/fixture.js';

const W = 1536;
const H = 864;

function noaFigure(x, y, scale, pose, move) {
  return { id: 'noa', x, y, scale, pose, character: 'noa', outfit: 'coat', ...(move ? { move } : {}) };
}

const BRIEF = {
  ...BOOK_STYLE,
  mayInvent: ['rock and water texture', 'gulls', 'village rooftops', 'mist', 'rope and grass details'],
  negative: [
    'no readable text anywhere',
    'no arrows, motion lines, or annotation graphics — motion is annotated by the board, never painted',
  ],
};

export function storyboardFixture() {
  return {
    kind: 'storyboard',
    title: 'The Lantern and the Sea Wind — teaser',
    intent: 'A six-shot teaser sequence for the picture-book story: the harbor light goes out, Noa carries the family lantern along the seawall, and the beacon burns again. Ink-brush frames; motion and timing live on the board.',
    frame: { width: W, height: H },
    characters: [NOA],
    renderBrief: BRIEF,
    shots: [
      {
        id: 's1',
        scene: 'Scene 1 — The dark harbor',
        beat: 'The harbor village at dusk. The beacon tower stands dark on the headland.',
        camera: { kind: 'wide-establishing', horizonY: 360 },
        horizonY: 360,
        cameraMove: 'push-in',
        seconds: 4,
        dialogue: 'VO: *The night the harbor light went out…*',
        forms: [
          { id: 'sea', role: 'open sea plane', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 280], [W, 280], [W, 480], [0, 480]], materialHint: 'flat indigo wash' },
          { id: 'headland-beacon', role: 'headland with dark beacon tower', depthBand: 'background', depthRank: 1, preserve: 'strict', polygon: [[1150, 200], [1300, 200], [1330, 440], [1120, 440]], materialHint: 'tower silhouette, lamp room DARK' },
          { id: 'village', role: 'harbor village mass', depthBand: 'midground', depthRank: 2, preserve: 'guided', polygon: [[60, 320], [620, 290], [680, 540], [40, 570]], materialHint: 'clustered rooftops' },
          { id: 'quay', role: 'foreground quay', depthBand: 'foreground', depthRank: 3, preserve: 'guided', polygon: [[0, 700], [W, 660], [W, H], [0, H]], materialHint: 'dry-brush stone' },
        ],
        figures: [],
      },
      {
        id: 's2',
        scene: 'Scene 1 — The dark harbor',
        beat: 'Inside the cottage doorway: Noa reaches up and takes the old lantern down from its hook.',
        camera: { kind: 'close-up' },
        cameraMove: 'static',
        seconds: 3,
        sfx: 'wind under the eaves',
        forms: [
          { id: 'doorframe', role: 'cottage doorframe', depthBand: 'background', depthRank: 0, preserve: 'guided', polygon: [[120, 40], [1420, 40], [1360, H], [180, H]], materialHint: 'heavy ink frame, warm interior dark' },
          { id: 'lantern-hook', role: 'the lantern on its high hook', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[880, 120], [1040, 120], [1040, 330], [880, 330]], materialHint: 'the family storm lantern, unlit' },
        ],
        figures: [noaFigure(700, 520, 1.4, 'reach')],
      },
      {
        id: 's3',
        scene: 'Scene 2 — The seawall',
        beat: 'Noa runs along the seawall toward the headland, scarf streaming, spray blowing across.',
        camera: { kind: 'wide-cinematic', horizonY: 340 },
        horizonY: 340,
        cameraMove: 'track-right',
        seconds: 5,
        sfx: 'sea spray, gusts',
        transition: 'cut',
        forms: [
          { id: 'sea-spray', role: 'wind-driven sea', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 220], [W, 260], [W, 520], [0, 470]], materialHint: 'wet-into-wet washes, flying-white spray' },
          { id: 'headland-beacon', role: 'headland with dark tower, nearer', depthBand: 'background', depthRank: 1, preserve: 'strict', polygon: [[1250, 150], [1420, 150], [1460, 470], [1220, 470]], materialHint: 'tower still dark' },
          { id: 'seawall', role: 'seawall top', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[0, 590], [W, 540], [W, 710], [0, 760]], materialHint: 'long dry-brush stones' },
        ],
        figures: [noaFigure(560, 500, 0.95, 'run', 'cross-right')],
      },
      {
        id: 's4',
        scene: 'Scene 2 — The seawall',
        beat: 'At the tower base, low angle: Noa reaches up to the stair hook and the lantern catches — first light.',
        camera: { kind: 'low-angle-hero', horizonY: 610 },
        horizonY: 610,
        cameraMove: 'tilt-up',
        seconds: 3,
        dialogue: 'VO: *Wind first, then flame.*',
        forms: [
          { id: 'tower', role: 'beacon tower rising out of frame', depthBand: 'midground', depthRank: 1, preserve: 'strict', polygon: [[880, 0], [1220, 0], [1280, 740], [840, 740]], materialHint: 'stone courses in ink' },
          { id: 'lantern-glow', role: 'the lit lantern at the hook', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[700, 250], [820, 250], [820, 400], [700, 400]], materialHint: 'FIRST LIGHT: warm ochre glow, unpainted-paper halo' },
        ],
        figures: [noaFigure(620, 640, 1.15, 'reach')],
      },
      {
        id: 's5',
        scene: 'Scene 3 — The light returns',
        beat: 'Noa climbs the dark spiral stair, crouched over the flame, warm glow on face and coat.',
        camera: { kind: 'close-up' },
        cameraMove: 'static',
        seconds: 3,
        sfx: 'boots on stone, wind muffled',
        forms: [
          { id: 'stairwell', role: 'spiral stair walls', depthBand: 'background', depthRank: 0, preserve: 'guided', polygon: [[100, 0], [1440, 0], [1360, H], [180, H]], materialHint: 'charged black ink, indigo night through a slit window' },
          { id: 'lantern-glow', role: 'the lit lantern held close', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[640, 470], [840, 470], [840, 700], [640, 700]], materialHint: 'warm ochre core' },
        ],
        figures: [noaFigure(760, 430, 1.35, 'crouch', 'toward-camera')],
      },
      {
        id: 's6',
        scene: 'Scene 3 — The light returns',
        beat: 'Full night, wide: the beacon lit, its beam over the dark sea, village windows warm below.',
        camera: { kind: 'wide-establishing', horizonY: 390 },
        horizonY: 390,
        cameraMove: 'pull-back',
        seconds: 6,
        transition: 'match',
        dialogue: 'VO: *…all the way out to sea.*',
        forms: [
          { id: 'night-sea', role: 'night sea under the beam', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 300], [W, 300], [W, 540], [0, 540]], materialHint: 'deep indigo wash' },
          { id: 'beacon-lit', role: 'the beacon tower, lamp room LIT', depthBand: 'midground', depthRank: 1, preserve: 'strict', polygon: [[1080, 100], [1270, 100], [1310, 520], [1050, 520]], materialHint: 'the s1 tower, now alight; beam of unpainted paper across the sea' },
          { id: 'village-lit', role: 'village below, windows warm', depthBand: 'midground', depthRank: 2, preserve: 'guided', polygon: [[40, 370], [540, 345], [600, 570], [20, 600]], materialHint: 'small ochre window lights' },
          { id: 'foreground-rocks', role: 'dark foreground rocks', depthBand: 'foreground', depthRank: 3, preserve: 'loose', polygon: [[0, 690], [W, 660], [W, H], [0, H]], materialHint: 'charged black ink' },
        ],
        figures: [noaFigure(1140, 260, 0.4, 'wave')],
      },
    ],
  };
}
