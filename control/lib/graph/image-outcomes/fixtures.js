/**
 * Fixtures — the spike's worked examples, re-expressed as v1 manifests.
 * Used by the unit tests and as source material for the vocab cards
 * (plan I1). Not a runtime surface.
 */

const W = 1536;
const H = 1024;
const VP = [768, 405];

function streetBuilding(id, side, near, far, topNear, topFar, depthRank, preserve = 'guided') {
  const xEdge = side === 'left' ? 0 : W;
  const innerNear = side === 'left' ? near : W - near;
  const innerFar = side === 'left' ? far : W - far;
  return {
    id,
    role: 'street-wall building mass',
    depthBand: depthRank < 3 ? 'background' : depthRank < 7 ? 'midground' : 'foreground',
    depthRank,
    preserve,
    materialHint: 'rectangular urban mass with facade detail allowed',
    polygon: [
      [xEdge, topNear],
      [innerNear, topNear],
      [innerFar, topFar],
      [xEdge, topFar - 30],
    ],
    notes: 'Keep this as an ordered street-wall mass; facade style may change.',
  };
}

export function cityBlockoutFixture() {
  return {
    kind: 'image-outcome',
    title: 'City Blockout To Cinematic Street',
    intent: 'Turn a camera-correct blockout of rectangular masses along a street into a finished rainy neon city image while preserving road edges, skyline rhythm, and occlusion order.',
    mode: 'blockout',
    source: { type: 'inline-blockout', note: 'Simple rectangles are sufficient here; Mojulo owns perspective and object order.' },
    viewBox: { width: W, height: H },
    horizonY: VP[1],
    vanishingPoint: VP,
    forms: [
      {
        id: 'sky-opening',
        role: 'background sky corridor',
        depthBand: 'background',
        depthRank: 0,
        preserve: 'loose',
        materialHint: 'wet night sky, distant glow',
        polygon: [[470, 80], [1066, 80], [930, 405], [606, 405]],
      },
      streetBuilding('left-far', 'left', 520, 670, 280, 392, 1),
      streetBuilding('right-far', 'right', 520, 670, 280, 392, 2),
      streetBuilding('left-mid', 'left', 360, 600, 205, 372, 3),
      streetBuilding('right-mid', 'right', 360, 600, 205, 372, 4),
      streetBuilding('left-near', 'left', 210, 548, 115, 350, 5, 'strict'),
      streetBuilding('right-near', 'right', 210, 548, 115, 350, 6, 'strict'),
      {
        id: 'road',
        role: 'wet street plane',
        depthBand: 'foreground',
        depthRank: 7,
        preserve: 'strict',
        materialHint: 'reflective asphalt, lane lines may be stylized but edges stay fixed',
        polygon: [[384, H], [1152, H], [842, 405], [694, 405]],
      },
      {
        id: 'crosswalk-zone',
        role: 'foreground crosswalk/readable street detail',
        depthBand: 'foreground',
        depthRank: 8,
        preserve: 'guided',
        materialHint: 'white stripes reflected in rain',
        polygon: [[500, 884], [1036, 884], [960, 760], [576, 760]],
      },
    ],
    protectedZones: [{ x: 560, y: 42, w: 416, h: 88, label: 'optional title zone' }],
    overlayZones: [{ x: 1080, y: 780, w: 360, h: 150, label: 'caption/callout safe area' }],
    renderBrief: {
      style: 'cinematic rain-soaked neon street concept art',
      mood: 'night, reflective, atmospheric, readable silhouettes',
      lighting: 'cool ambient city light with warm shop spill and neon reflections',
      mayInvent: ['windows and signs without readable text', 'cars as small accents', 'rain streaks', 'facade materials', 'distant pedestrians as silhouettes'],
    },
  };
}

export function roomInteriorFixture() {
  return {
    kind: 'image-outcome',
    title: 'Interior Blockout To Finished Room',
    intent: 'Render a calm editorial interior from a two-point room blockout while preserving the back wall, floor plane, furniture positions, and text-safe art wall.',
    mode: 'blockout',
    source: { type: 'inline-room-shot', note: 'This mirrors Mojulo room shots: camera owns perspective, forms own occlusion.' },
    viewBox: { width: W, height: H },
    horizonY: 455,
    vanishingPoint: [770, 455],
    forms: [
      { id: 'back-wall', role: 'rear wall plane', depthBand: 'background', depthRank: 0, preserve: 'strict', materialHint: 'paint/plaster can change; rectangular wall stays', polygon: [[392, 190], [1144, 190], [1088, 650], [448, 650]] },
      { id: 'floor-plane', role: 'floor plane', depthBand: 'foreground', depthRank: 1, preserve: 'strict', materialHint: 'wood, stone, or rug detail allowed', polygon: [[0, H], [1536, H], [1088, 650], [448, 650]] },
      { id: 'window', role: 'left window light source', depthBand: 'background', depthRank: 2, preserve: 'guided', materialHint: 'large window, daylight source', polygon: [[160, 215], [378, 250], [410, 650], [130, 720]] },
      { id: 'sofa', role: 'main seating block', depthBand: 'midground', depthRank: 4, preserve: 'guided', materialHint: 'low modern sofa', polygon: [[472, 610], [922, 610], [1006, 790], [416, 800]] },
      { id: 'coffee-table', role: 'low table', depthBand: 'foreground', depthRank: 6, preserve: 'guided', materialHint: 'wood or glass, low rectangular form', polygon: [[614, 792], [952, 792], [1054, 912], [520, 920]] },
      { id: 'plant', role: 'foreground vertical accent', depthBand: 'foreground', depthRank: 7, preserve: 'loose', materialHint: 'plant/lamp/sculpture can vary', polygon: [[1092, 540], [1240, 560], [1284, 930], [1046, 925]] },
    ],
    protectedZones: [{ x: 602, y: 250, w: 348, h: 128, label: 'art/text-safe wall zone' }],
    overlayZones: [{ x: 56, y: 56, w: 380, h: 116, label: 'editorial headline overlay' }],
    renderBrief: {
      style: 'warm editorial interior photography',
      mood: 'quiet, tactile, lived-in, premium but not glossy',
      lighting: 'soft window light from left with gentle floor bounce',
      mayInvent: ['fabric texture', 'books', 'ceramics', 'subtle wall art without readable text', 'plant species', 'rug pattern'],
      negative: ['do not move the sofa or table', 'do not fill the text-safe wall zone with busy detail', 'do not warp the room envelope'],
    },
  };
}

export function mangaSignalPageFixture() {
  return {
    kind: 'sequential-art',
    title: 'Manga Signal Page',
    pageRecipe: 'manga-high-eye-control',
    readingFlow: 'left-to-right, top-to-bottom',
    viewBox: { width: 1536, height: 2048 },
    intent: 'A four-panel manga/comic page: a figure notices a signal, reaches for a glowing device, crouches in a close dramatic beat, then sees the city reveal. Bubbles remain blank for Mojulo lettering.',
    panels: [
      {
        id: 'p1',
        beat: 'Hero enters a narrow city corridor and notices something above.',
        bounds: { x: 80, y: 90, w: 620, h: 780 },
        camera: { kind: 'wide-establishing', horizonY: 360, vanishingPoint: [390, 360] },
        figures: [{ id: 'hero', x: 386, y: 630, scale: 1.25, pose: 'stand' }],
        forms: [
          { id: 'left-wall', polygon: [[80, 180], [275, 125], [326, 870], [80, 870]], preserve: 'strict' },
          { id: 'right-wall', polygon: [[700, 170], [490, 125], [450, 870], [700, 870]], preserve: 'strict' },
        ],
        bubbleZones: [{ x: 126, y: 130, w: 315, h: 110, label: 'blank speech', lettering: 'What is that light…?' }],
      },
      {
        id: 'p2',
        beat: 'Insert shot: the handheld device begins to glow.',
        bounds: { x: 760, y: 90, w: 696, h: 430 },
        camera: { kind: 'insert-close-up' },
        figures: [],
        forms: [
          { id: 'device', polygon: [[990, 230], [1234, 210], [1280, 385], [960, 405]], preserve: 'strict' },
          { id: 'hands', polygon: [[900, 320], [1320, 300], [1366, 500], [860, 500]], preserve: 'guided' },
        ],
        bubbleZones: [{ x: 816, y: 126, w: 300, h: 88, label: 'blank caption' }],
      },
      {
        id: 'p3',
        beat: 'Low-angle dramatic pose: the hero reaches toward the signal.',
        bounds: { x: 760, y: 580, w: 696, h: 820 },
        camera: { kind: 'low-angle-hero', horizonY: 980, vanishingPoint: [1108, 980] },
        figures: [{ id: 'hero', x: 1110, y: 1165, scale: 1.85, pose: 'reach' }],
        forms: [
          { id: 'signal-light', polygon: [[1090, 640], [1185, 670], [1162, 760], [1068, 738]], preserve: 'strict' },
        ],
        bubbleZones: [{ x: 1000, y: 622, w: 370, h: 118, label: 'blank shout' }],
      },
      {
        id: 'p4',
        beat: 'Wide reveal: city skyline opens beyond the rooftop edge.',
        bounds: { x: 80, y: 940, w: 620, h: 1018 },
        camera: { kind: 'wide-cinematic', horizonY: 1300, vanishingPoint: [386, 1300] },
        figures: [{ id: 'hero', x: 365, y: 1700, scale: 1.1, pose: 'crouch' }],
        forms: [
          { id: 'roof-edge', polygon: [[80, 1720], [700, 1660], [700, 1958], [80, 1958]], preserve: 'strict' },
          { id: 'skyline', polygon: [[120, 1220], [660, 1160], [660, 1600], [120, 1600]], preserve: 'guided' },
        ],
        bubbleZones: [{ x: 146, y: 1005, w: 430, h: 130, label: 'blank narration' }],
      },
    ],
    renderBrief: {
      style: 'clean painted manga page, cinematic ink-and-watercolor, cohesive cool dusk palette',
      preserve: [
        'panel staging and camera per panel',
        'blank bubble/caption reserves',
        'hero pose silhouette per panel',
        'device position',
        'low-angle panel 3 staging',
        'wide city reveal in panel 4',
      ],
      mayInvent: ['clothing design', 'city detail', 'speed lines', 'screen glow', 'rain or mist', 'facade texture'],
      negative: ['no readable text', 'do not fill blank bubbles', 'do not merge panels', 'do not crop out the hero'],
    },
  };
}

export function exampleFixtures() {
  return [cityBlockoutFixture(), roomInteriorFixture(), mangaSignalPageFixture()];
}
