import { describe, expect, it } from 'vitest';
import { expandNeoRembrandt } from './index.js';
import { withConstellationGrid } from '../polygonizer/constellation.js';

function eggPoints(cx = 240, cy = 220, rx = 72, ry = 104, n = 24) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

function markMatchesRoleForTest(mark, role) {
  return [mark.role, mark.solidRole, mark.vectorRole]
    .filter(Boolean)
    .some((value) => value === role || String(value).startsWith(`${role}:`) || String(value).startsWith(`${role}-`));
}

function testBbox(points) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { w: maxX - minX, h: maxY - minY };
}

function p0Manifest() {
  return {
    title: 'P0 egg',
    viewBox: { width: 480, height: 420 },
    scene: {
      light: { direction: [-0.58, -0.82], warmth: 0.6 },
      ground: { y: 340 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'polygon',
        closed: true,
        role: 'egg-body',
        z: 10,
        points: eggPoints(),
        fill: '#c7a36f',
        shade: { algorithm: 'convex-value-stack', intensity: 0.9 },
        highlights: { algorithm: 'simple-highlight', intensity: 0.4 },
      },
    ],
  };
}

function blobFieldManifest(viewDirection = [-1, -1]) {
  return {
    title: 'Blob field',
    viewBox: { width: 360, height: 360 },
    scene: {
      view: { direction: viewDirection, baseZ: 20, blobZStep: 2 },
      light: { direction: [-0.58, -0.82] },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'blob',
        role: 'top-left',
        anchor: [100, 100],
        rx: 42,
        ry: 54,
        shade: { algorithm: 'form-light-stack', intensity: 0.9 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.4 },
      },
      {
        kind: 'blob',
        role: 'bottom-right',
        anchor: [230, 230],
        rx: 48,
        ry: 58,
        shade: { algorithm: 'form-light-stack', intensity: 0.9 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.4 },
      },
    ],
  };
}

function adjacentBlobManifest() {
  const manifest = blobFieldManifest([-1, -1]);
  manifest.marks[0].anchor = [150, 140];
  manifest.marks[0].rx = 58;
  manifest.marks[0].ry = 66;
  manifest.marks[1].anchor = [190, 190];
  manifest.marks[1].rx = 62;
  manifest.marks[1].ry = 70;
  return manifest;
}

function gestureManifest() {
  return {
    title: 'Gesture figure',
    viewBox: { width: 360, height: 460 },
    gesture: {
      kind: 'body-line',
      points: [
        [220, 80],
        [220, 360],
      ],
    },
    scene: {
      view: { direction: [0, -1], baseZ: 20, blobZStep: 2 },
      light: { direction: [-0.58, -0.82] },
      palette: 'warm-low-key',
      interBlobShadows: false,
    },
    marks: [
      {
        kind: 'blob',
        role: 'head',
        gestureT: 0,
        rx: 34,
        ry: 42,
        shade: { algorithm: 'form-light-stack', intensity: 0.9 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.4 },
      },
      {
        kind: 'blob',
        role: 'chest',
        gestureT: 0.25,
        offset: [20, 10],
        rx: 58,
        ry: 76,
        shade: { algorithm: 'form-light-stack', intensity: 0.9 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.4 },
      },
      {
        kind: 'blob',
        role: 'pelvis',
        gestureT: 0.6,
        rotation: 0.5,
        rx: 54,
        ry: 50,
        shade: { algorithm: 'form-light-stack', intensity: 0.9 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.4 },
      },
    ],
  };
}

function dynamicSkeletonGestureManifest() {
  return {
    title: 'Dynamic skeleton cross gesture figure',
    viewBox: { width: 420, height: 480 },
    gesture: {
      kind: 'body-line',
      points: [
        [210, 78],
        [204, 190],
        [224, 332],
      ],
      anchors: [
        { role: 'head', gestureT: 0.08 },
        { role: 'torso-center', gestureT: 0.44 },
        { role: 'pelvis', gestureT: 0.78 },
      ],
      crossGesture: {
        kind: 'active-arm-line',
        role: 'active-right-arm',
        points: [
          [180, 178],
          [265, 154],
          [334, 116],
        ],
      },
      dynamicSkeleton: {
        role: 'figure-dynamic-skeleton',
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
        anchors: [
          { role: 'head', axis: 'main', gestureT: 0.06, kind: 'core', radius: 22, zRole: 'head' },
          { role: 'torso-center', axis: 'main', gestureT: 0.42, kind: 'core', rx: 42, ry: 58, zRole: 'torso' },
          { role: 'pelvis', axis: 'main', gestureT: 0.78, kind: 'core', rx: 38, ry: 44, zRole: 'pelvis' },
          { role: 'active-shoulder', axis: 'cross', gestureT: 0.08, kind: 'joint', radius: 13, zRole: 'shoulder', connects: ['torso-center', 'active-elbow'] },
          { role: 'active-elbow', axis: 'cross', gestureT: 0.52, kind: 'joint', radius: 12, zRole: 'elbow', connects: ['active-shoulder', 'active-hand'] },
          { role: 'active-hand', axis: 'cross', gestureT: 0.92, kind: 'joint', radius: 11, zRole: 'hand', connects: ['active-elbow'] },
        ],
        connections: [
          { from: 'active-shoulder', to: 'active-elbow', role: 'active-upper-arm', kind: 'limb' },
          { from: 'active-elbow', to: 'active-hand', role: 'active-forearm', kind: 'limb' },
          { from: 'torso-center', to: 'pelvis', role: 'torso-carry', kind: 'core-span', thickness: 24 },
        ],
      },
    },
    scene: {
      view: { direction: [0, -1], baseZ: 20, blobZStep: 2 },
      light: { direction: [-0.58, -0.82] },
      palette: 'warm-low-key',
      interBlobShadows: false,
    },
    marks: [],
  };
}

function pastamakerRingManifest() {
  return {
    title: 'Pastamaker ring',
    viewBox: { width: 360, height: 360 },
    marks: [
      {
        kind: 'circle',
        role: 'black-hole-shadow',
        cx: 180,
        cy: 180,
        r: 62,
        fill: '#010102',
        z: 20,
      },
      {
        kind: 'stickerField',
        role: 'annular-plasma',
        z: 10,
        die: {
          family: 'arcPatch',
          arc: [0.035, 0.09],
          thickness: [8, 22],
          wobble: 0.18,
        },
        field: {
          kind: 'aroundRing',
          center: [180, 180],
          radius: [48, 128],
          count: 18,
          bias: [{ from: 0.32, to: 0.72, weight: 3 }],
        },
        valueBudget: {
          targetOpacity: 0.72,
          expectedOverlapCount: 9,
          mode: 'inverse-count',
        },
        constraints: {
          occludeBy: 'black-hole-shadow',
          preserveVoid: true,
        },
      },
      {
        kind: 'stickerField',
        role: 'spike-banana-plasma',
        z: 18,
        die: {
          family: 'spikeBanana',
          arc: [0.035, 0.085],
          thickness: [10, 28],
          spike: 0.28,
          spikeJitter: 0.4,
          rotationJitter: 0.12,
          blur: 1.2,
          taper: 'fat-head-tail',
          wobble: 0.22,
        },
        field: {
          kind: 'aroundRing',
          center: [180, 180],
          radius: [72, 132],
          count: 10,
          bias: [{ from: 0.32, to: 0.72, weight: 2.5 }],
        },
        valueBudget: {
          targetOpacity: 0.5,
          expectedOverlapCount: 5,
          mode: 'inverse-count',
        },
        constraints: {
          occludeBy: 'black-hole-shadow',
          preserveVoid: true,
        },
      },
      {
        kind: 'stickerField',
        role: 'fuzzy-peach-glow',
        z: 16,
        die: {
          family: 'fuzzyPeach',
          radius: [5, 16],
          aspect: [0.82, 1.18],
          fuzz: 0.24,
          blur: 1.6,
          rotationJitter: 0.4,
        },
        field: {
          kind: 'aroundRing',
          center: [180, 180],
          radius: [82, 138],
          count: 16,
          bias: [{ from: 0.28, to: 0.72, weight: 2.2 }],
        },
        valueBudget: {
          targetOpacity: 0.4,
          expectedOverlapCount: 8,
          mode: 'inverse-count',
        },
        constraints: {
          occludeBy: 'black-hole-shadow',
          preserveVoid: true,
        },
      },
      {
        kind: 'stickerField',
        role: 'rim-highlight-strokes',
        z: 40,
        die: {
          family: 'line',
          length: [16, 38],
          strokeWidth: 2,
          wobble: 0.12,
          orientation: 'tangent',
        },
        field: {
          kind: 'aroundRing',
          center: [180, 180],
          radius: [66, 124],
          count: 12,
          bias: [{ from: 0.35, to: 0.75, weight: 2.5 }],
        },
        valueBudget: {
          targetOpacity: 0.48,
          expectedOverlapCount: 6,
          mode: 'inverse-count',
        },
        constraints: {
          occludeBy: 'black-hole-shadow',
          preserveVoid: true,
        },
      },
      {
        kind: 'stickerField',
        role: 'jet-stream-strokes',
        z: 30,
        die: {
          family: 'line',
          length: [10, 34],
          strokeWidth: 1.4,
          wobble: 0.2,
          orientation: 'tangent',
        },
        field: {
          kind: 'alongPath',
          points: [
            [218, 145],
            [270, 118],
            [330, 106],
          ],
          count: 14,
          lateralJitter: [-12, 12],
          alongJitter: 0.18,
        },
        valueBudget: {
          targetOpacity: 0.35,
          expectedOverlapCount: 7,
          mode: 'inverse-count',
        },
      },
    ],
  };
}

function bubblingPatternManifest() {
  return {
    title: 'Pastamaker bubbling and King krispies',
    viewBox: { width: 420, height: 320 },
    marks: [
      {
        kind: 'stickerField',
        role: 'bubbling-fill',
        z: 18,
        die: {
          family: 'bubbling',
          radius: [2, 12],
          sizingScaleRamp: [0.8, 1.35],
          consistencySize: 0.58,
          strokeWidth: 1,
        },
        field: {
          kind: 'fillBox',
          bounds: { x: 42, y: 54, width: 164, height: 184 },
          generations: 4,
          lanes: 4,
          count: 42,
          noise: 8,
          laneNoise: 10,
        },
        valueBudget: {
          targetOpacity: 0.72,
          expectedOverlapCount: 8,
          mode: 'inverse-count',
        },
        fill: '#f7ead1',
        stroke: '#2d2230',
      },
      {
        kind: 'stickerField',
        role: 'king-krispies-path',
        z: 22,
        die: {
          family: 'kingKrispies',
          radius: [1.4, 9],
          sizingScaleRamp: [0.65, 1.5],
          consistencySize: 0.42,
          strokeWidth: 0.9,
        },
        field: {
          kind: 'alongPath',
          points: [
            [230, 230],
            [276, 150],
            [334, 118],
            [382, 76],
          ],
          generations: 5,
          count: 33,
          lateralJitter: [-18, 18],
        },
        valueBudget: {
          targetOpacity: 0.6,
          expectedOverlapCount: 6,
          mode: 'inverse-count',
        },
        fill: '#fdf4c9',
        stroke: '#111426',
      },
      {
        kind: 'stickerField',
        role: 'outward-bubbling-fill',
        z: 20,
        die: {
          family: 'bubbling',
          radius: [2, 10],
          sizingScaleRamp: [0.72, 1.28],
          consistencySize: 0.5,
          strokeWidth: 1,
        },
        field: {
          kind: 'outwardFill',
          bounds: { x: 52, y: 44, width: 156, height: 198 },
          seeds: [[72, 144], [188, 144]],
          generations: 5,
          count: 34,
          outwardness: 0.9,
          noise: 9,
        },
        valueBudget: {
          targetOpacity: 0.62,
          expectedOverlapCount: 7,
          mode: 'inverse-count',
        },
        fill: '#ddefff',
        stroke: '#121827',
      },
      {
        kind: 'stickerField',
        role: 'king-krispies-anchors',
        z: 24,
        die: {
          family: 'kingKrispies',
          radius: [1.2, 7.4],
          sizingScaleRamp: [0.7, 1.35],
          consistencySize: 0.36,
          anchorScale: [1.8, 3.1],
          strokeWidth: 0.9,
        },
        field: {
          kind: 'alongPath',
          points: [
            [226, 246],
            [266, 174],
            [326, 128],
            [392, 70],
          ],
          generations: 5,
          count: 42,
          anchorCount: 4,
          anchorSeparation: [0.1, 0.32],
          lateralJitter: [-24, 24],
          noise: 18,
        },
        valueBudget: {
          targetOpacity: 0.62,
          expectedOverlapCount: 7,
          mode: 'inverse-count',
        },
        fill: '#ffffff',
        stroke: '#05050a',
      },
    ],
  };
}

function iguanaPatternManifest() {
  return {
    title: 'Pastamaker Iguana bubbles',
    viewBox: { width: 460, height: 320 },
    marks: [
      { kind: 'rect', role: 'iguana-dark-bg', x: 0, y: 0, w: 460, h: 320, fill: '#101418', stroke: 'none', z: 0 },
      {
        kind: 'stickerField',
        role: 'iguana-fixed-r',
        z: 18,
        die: {
          family: 'iguana',
          r: 6,
          strokeWidth: 0.8,
        },
        field: {
          kind: 'fillBox',
          bounds: { x: 32, y: 42, width: 178, height: 220 },
          corner: 'top-left',
          count: 90,
          spacing: 0,
        },
        valueBudget: {
          targetOpacity: 0.78,
          expectedOverlapCount: 6,
          mode: 'inverse-count',
        },
        fill: '#a7e68b',
        stroke: '#07120a',
      },
      {
        kind: 'stickerField',
        role: 'iguana-noisy-r',
        z: 20,
        die: {
          family: 'iguana',
          r: 7,
          rNoise: 0.28,
          strokeWidth: 0.8,
        },
        field: {
          kind: 'fillBox',
          bounds: { x: 246, y: 42, width: 178, height: 220 },
          corner: 'top-left',
          count: 72,
          spacing: 0.03,
        },
        valueBudget: {
          targetOpacity: 0.82,
          expectedOverlapCount: 6,
          mode: 'inverse-count',
        },
        fill: '#d7f5a8',
        stroke: '#09120a',
      },
    ],
  };
}

function bookshelfManifest() {
  return {
    title: 'Bookshelf wireframe',
    viewBox: { width: 520, height: 420 },
    scene: {
      view: { direction: [-0.45, -0.35] },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'object',
        ref: 'bookshelf-wireframe',
        role: 'study-shelf',
        x: 110,
        y: 60,
        w: 260,
        h: 300,
        depth: 54,
        shelves: 4,
        columns: 2,
      },
    ],
  };
}

function bookshelfPlaneManifest() {
  return {
    title: 'Bookshelf plane field',
    viewBox: { width: 520, height: 420 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10, blobZStep: 0.05 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'planePreset',
        ref: 'bookshelf',
        role: 'study-shelf',
        x: 110,
        y: 60,
        width: 260,
        height: 300,
        depth: 54,
        shelves: 4,
      },
    ],
  };
}

function bookshelfSolidManifest() {
  return {
    title: 'Bookshelf solid field',
    viewBox: { width: 560, height: 460 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solidPreset',
        ref: 'bookshelf',
        role: 'study-shelf',
        x: 140,
        y: 80,
        width: 260,
        height: 300,
        depth: 64,
        shelves: 4,
      },
    ],
  };
}

function bookshelfVanishingManifest() {
  const manifest = bookshelfSolidManifest();
  manifest.scene.perspective = {
    mode: 'one-point',
    horizonY: 210,
    vanishingPoint: [280, 210],
    depthScale: 220,
  };
  return manifest;
}

function tableLaptopManifest() {
  return {
    title: 'Table laptop solid field',
    viewBox: { width: 620, height: 460 },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: 190,
        vanishingPoint: [310, 190],
        depthScale: 240,
      },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      { kind: 'solid', role: 'tabletop', x: 150, y: 250, width: 320, height: 24, depth: 135, fill: '#9b6a48', z: 10 },
      { kind: 'solid', role: 'left-front-leg', x: 170, y: 270, width: 20, height: 128, depth: 22, fill: '#6e4731', z: 11 },
      { kind: 'solid', role: 'right-front-leg', x: 430, y: 270, width: 20, height: 128, depth: 22, fill: '#6e4731', z: 11 },
      { kind: 'solid', role: 'left-back-leg', x: 198, y: 236, width: 16, height: 112, depth: 18, fill: '#5c3a2a', z: 9 },
      { kind: 'solid', role: 'right-back-leg', x: 406, y: 236, width: 16, height: 112, depth: 18, fill: '#5c3a2a', z: 9 },
      { kind: 'solid', role: 'laptop-base', x: 245, y: 218, width: 134, height: 12, depth: 82, fill: '#5f686a', z: 13 },
      { kind: 'solid', role: 'laptop-screen', x: 258, y: 142, width: 108, height: 82, depth: 8, fill: '#303a3f', z: 14 },
    ],
  };
}

function apartmentFacePatternManifest({ perspective = true, targetFace = 'front' } = {}) {
  return {
    title: 'Apartment facade mandala miniature pattern',
    viewBox: { width: 620, height: 460 },
    scene: {
      ...(perspective ? {
        perspective: {
          mode: 'one-point',
          horizonY: 188,
          vanishingPoint: [512, 188],
          depthScale: 230,
        },
      } : {}),
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'apartment-block',
        x: 190,
        y: 86,
        width: 220,
        height: 310,
        depth: 72,
        faceCull: 'hide-back',
        fill: '#8f7462',
        stroke: '#34261d',
        z: 12,
      },
      {
        kind: 'facePattern',
        role: 'apartment-front-miniatures',
        target: { solidRole: 'apartment-block', face: targetFace },
        pattern: {
          kind: 'mandalaFractal',
          basis: 'facade-bays',
          subdivide: { cols: 4, rows: 5 },
          edgeBands: ['top-cornice', 'lower-balcony-band'],
          verticalAccent: { col: 3, role: 'stairwell' },
        },
        language: 'architectural-miniature',
        motifs: {
          cell: 'french-window',
          lowerBand: 'balcony',
          topBand: 'cornice',
          verticalAccent: 'stairwell',
        },
      },
    ],
  };
}

function sharedManjiLevelRepeaterManifest() {
  return {
    title: 'Shared manji facade repeater',
    viewBox: { width: 760, height: 480 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'tower-a',
        x: 120,
        y: 112,
        width: 180,
        height: 280,
        depth: 54,
        standing: true,
        fill: '#8f7462',
        stroke: '#34261d',
        z: 12,
      },
      {
        kind: 'solid',
        role: 'tower-b',
        x: 420,
        y: 70,
        width: 180,
        height: 322,
        depth: 54,
        standing: true,
        fill: '#826d61',
        stroke: '#34261d',
        z: 12,
      },
      {
        kind: 'facePattern',
        role: 'shared-apartment-rhythm',
        target: { solidRole: 'tower-a', face: 'front' },
        pattern: {
          kind: 'manjiLevelRepeater',
          ref: 'window-window-balcony',
          sequence: ['french-window', 'french-window', 'balcony'],
          xRepeat: 2,
          yStacks: 3,
        },
        motifs: { cell: { fromPattern: true } },
      },
      {
        kind: 'facePattern',
        role: 'shared-apartment-rhythm',
        target: { solidRole: 'tower-b', face: 'front' },
        pattern: {
          kind: 'manjiLevelRepeater',
          ref: 'window-window-balcony',
          sequence: ['french-window', 'french-window', 'balcony'],
          xRepeat: 2,
          yStacks: 5,
        },
        motifs: { cell: { fromPattern: true } },
      },
    ],
  };
}

function cupVolumeManifest() {
  return {
    title: 'Cup volumizer',
    viewBox: { width: 420, height: 420 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'volume',
        primitive: 'cup',
        role: 'cup',
        anchor: [210, 230],
        height: 170,
        rimWidth: 128,
        footWidth: 72,
        wallThickness: 10,
        rings: 12,
        openTop: true,
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
      },
    ],
  };
}

function animatedBipedFormManifest(massTuning = 'stocky') {
  return {
    title: 'Animated biped form primitive',
    viewBox: { width: 420, height: 460 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
      interBlobShadows: false,
    },
    marks: [
      {
        kind: 'form',
        role: 'hero',
        mode: 'animated',
        stock: 'bipedal',
        speciesStock: 'humanlike',
        massTuning,
        anchor: [210, 250],
        scale: 1,
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
      },
    ],
  };
}

function lowerBodyDummyFormManifest() {
  return {
    title: 'Lower body form dummy primitive',
    viewBox: { width: 420, height: 500 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
      interBlobShadows: false,
    },
    marks: [
      {
        kind: 'form',
        role: 'pose-dummy',
        mode: 'dummy',
        stock: 'lower-body-dummy',
        anchor: [210, 210],
        scale: 1,
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
      },
    ],
  };
}

function fullBodyDummyFormManifest({ gesture = false } = {}) {
  return {
    title: gesture ? 'Gesture full body form dummy primitive' : 'Full body form dummy primitive',
    viewBox: { width: 460, height: 560 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
      interBlobShadows: false,
    },
    marks: [
      {
        kind: 'form',
        role: 'full-dummy',
        mode: 'dummy',
        stock: 'full-body-dummy',
        anchor: [230, 250],
        scale: 1,
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
        ...(gesture ? {
          gesture: {
            kind: 'body-line',
            points: [[218, 82], [202, 194], [238, 338]],
            crossGesture: {
              kind: 'active-arm-line',
              points: [[262, 174], [324, 132], [372, 88]],
            },
          },
          leftArmGesture: {
            kind: 'support-arm-line',
            points: [[174, 178], [142, 226], [166, 282]],
          },
        } : {}),
      },
    ],
  };
}

function xyzCcaSolidManifest() {
  return {
    title: 'XYZ CCA solid mandala skinning',
    viewBox: { width: 420, height: 320 },
    polygonizer: {
      subject: 'server cabinet xyz cca',
      impactPoint: [210, 180],
      elements: [
        { role: 'server-cabinet', importance: 'primary', footprint: 'single cabinet', depthBand: 'midground', blockingNeeded: 'cca', mandala: { width: 3, length: 6 } },
      ],
      constellation: {
        kind: 'cca-constellation-grid',
        generated: false,
        source: 'test',
        axisMundi: { anchor: [210, 180], vertical: [[210, 60], [210, 280]], horizontal: [[80, 180], [340, 180]] },
        horizonY: 160,
        vanishingPoint: [210, 160],
        baselineY: 280,
        depthBands: { foreground: [220, 300], midground: [120, 220], background: [40, 120] },
        nodes: [
          {
            role: 'server-cabinet',
            renderOrder: 30,
            parent: null,
            depthBand: 'midground',
            anchor: [210, 180],
            bounds: { x: 150, y: 70, width: 120, height: 210 },
            cca: {
              center: [210, 175],
              lengthAxis: [[150, 175], [270, 175]],
              heightAxis: [[210, 280], [210, 70]],
              depthAxis: { toward: [210, 160] },
            },
            scale: { pictureShare: 0.03, childBudget: 0.62 },
            childRegion: { x: 164, y: 96, width: 92, height: 158 },
          },
        ],
      },
    },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'server-cabinet',
        xyz: [0, 0, 0],
        sizeXYZ: [3, 6, 6],
        fill: '#334556',
        stroke: '#111827',
        z: 20,
      },
    ],
  };
}

function inventoryAtomMandalaManifest() {
  const nodes = [0, 1, 2, 3].map((index) => {
    const y = 500 - index * 88;
    return {
      role: `server-cabinet-${index + 1}`,
      renderOrder: 30 + index,
      parent: null,
      depthBand: 'midground',
      anchor: [220, y],
      bounds: { x: 170, y: y - 76, width: 100, height: 142 },
      cca: {
        center: [220, y - 5],
        lengthAxis: [[170, y - 5], [270, y - 5]],
        heightAxis: [[220, y + 66], [220, y - 76]],
        depthAxis: { toward: [220, 170] },
      },
      scale: { pictureShare: 0.01, childBudget: 0.62 },
      childRegion: { x: 182, y: y - 59, width: 76, height: 108 },
    };
  });
  return {
    title: 'Inventory atom mandala proof',
    viewBox: { width: 440, height: 620 },
    polygonizer: {
      subject: 'inventory atom mandala proof',
      impactPoint: [220, 500],
      elements: nodes.map((node) => ({
        role: node.role,
        importance: 'primary',
        footprint: 'one server cabinet atom',
        depthBand: 'midground',
        blockingNeeded: 'cca',
        mandala: { width: 6, length: 12 },
      })),
      constellation: {
        kind: 'cca-constellation-grid',
        generated: false,
        source: 'test-inventory-atoms',
        axisMundi: { anchor: [220, 500], vertical: [[220, 80], [220, 560]], horizontal: [[80, 500], [360, 500]] },
        horizonY: 170,
        vanishingPoint: [220, 170],
        baselineY: 560,
        depthBands: { foreground: [430, 580], midground: [210, 430], background: [80, 210] },
        nodes,
      },
    },
    scene: {
      view: { direction: [0, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      { kind: 'rect', role: 'proof-anchor', x: 0, y: 0, w: 1, h: 1, fill: 'transparent', stroke: 'none' },
    ],
  };
}

function datacenterInventoryAtomManifest() {
  const cabinetSpecs = [
    { side: 'left', x: 168, y: 510, width: 142, height: 188 },
    { side: 'right', x: 272, y: 510, width: 142, height: 188 },
    { side: 'left', x: 188, y: 392, width: 112, height: 152 },
    { side: 'right', x: 252, y: 392, width: 112, height: 152 },
    { side: 'left', x: 204, y: 306, width: 86, height: 118 },
    { side: 'right', x: 242, y: 306, width: 86, height: 118 },
  ];
  const nodes = cabinetSpecs.map((spec, index) => {
    const role = `${spec.side}-server-cabinet-${Math.floor(index / 2) + 1}`;
    return {
      role,
      renderOrder: 30 + index,
      parent: null,
      depthBand: index < 2 ? 'foreground' : index < 4 ? 'midground' : 'background',
      anchor: [spec.x, spec.y],
      bounds: {
        x: spec.x - spec.width / 2,
        y: spec.y - spec.height,
        width: spec.width,
        height: spec.height,
      },
      cca: {
        center: [spec.x, spec.y - spec.height / 2],
        lengthAxis: [[spec.x - spec.width / 2, spec.y - spec.height / 2], [spec.x + spec.width / 2, spec.y - spec.height / 2]],
        heightAxis: [[spec.x, spec.y], [spec.x, spec.y - spec.height]],
        depthAxis: { toward: [220, 170] },
        genesisAxis: [[220, 170], [spec.x, spec.y - spec.height / 2]],
        genesisAxisMode: 'toward-camera',
      },
      scale: { pictureShare: 0.01, childBudget: 0.62 },
      childRegion: {
        x: spec.x - spec.width * 0.38,
        y: spec.y - spec.height * 0.88,
        width: spec.width * 0.76,
        height: spec.height * 0.76,
      },
    };
  });
  return {
    title: 'Datacenter inventory atom proof',
    viewBox: { width: 440, height: 620 },
    polygonizer: {
      subject: 'datacenter inventory atom proof',
      impactPoint: [220, 510],
      elements: nodes.map((node) => ({
        role: node.role,
        importance: 'primary',
        footprint: 'one 6uH 6uL 3uW server cabinet atom doubled for visual prominence',
        depthBand: node.depthBand,
        blockingNeeded: 'cca',
        mandala: { width: 6, length: 12 },
      })),
      constellation: {
        kind: 'cca-constellation-grid',
        generated: false,
        source: 'test-datacenter-inventory-atoms',
        axisMundi: { anchor: [220, 510], vertical: [[220, 140], [220, 560]], horizontal: [[70, 510], [370, 510]] },
        horizonY: 170,
        vanishingPoint: [220, 170],
        baselineY: 560,
        depthBands: { foreground: [430, 580], midground: [290, 430], background: [140, 290] },
        nodes,
      },
    },
    scene: {
      view: { direction: [0, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: nodes.map((node, index) => ({
      kind: 'solid',
      role: node.role,
      xyz: [0, 0, 0],
      sizeXYZ: [6, 12, 12],
      solidDepthProjection: 'constellation-grid-line',
      solidDepthAnchor: 'far',
      solidFaceWidthMode: 'length',
      solidProjectionMode: 'perspective-corner',
      fill: index % 2 === 0 ? '#304455' : '#3b5061',
      stroke: '#101820',
      z: 30 + index,
    })),
  };
}

function planeObjectFormManifest() {
  return {
    title: 'Plane object form primitive',
    viewBox: { width: 420, height: 320 },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: 130,
        vanishingPoint: [300, 130],
        depthScale: 220,
      },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'form',
        role: 'sign',
        mode: 'animated',
        stock: 'plane-object',
        anchor: [210, 160],
        width: 150,
        height: 86,
        depth: 22,
        fill: '#b1845e',
        stroke: '#4f3928',
      },
    ],
  };
}

function mandalaFieldPathManifest() {
  return {
    title: 'Mandala field path combinator',
    viewBox: { width: 600, height: 420 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'mandalaField',
        role: 'city-field',
        screenOrigin: [300, 350],
        unitScale: 18,
        depthScale: 0.94,
        paths: [
          {
            role: 'avenue',
            basis: 'ray',
            from: [0, -8],
            to: [0, 6],
            samples: 5,
            spread: { x: [-5, 5], mode: 'paired' },
            scaleFrom: 0.55,
            scaleTo: 1.1,
            scaleWobble: 0.04,
            heightRange: [42, 104],
            widthRange: [18, 36],
            depthRange: [12, 24],
            spawn: {
              kind: 'solid',
              fill: '#40586a',
              stroke: '#101820',
              faceCull: 'hide-back',
              solidDepthProjection: [0.45, -0.28],
            },
          },
        ],
      },
    ],
  };
}

function mandalaFieldPinnedConstellationManifest() {
  return {
    title: 'Mandala field pinned constellation units',
    viewBox: { width: 600, height: 420 },
    scene: {
      perspective: { mode: 'one-point', horizonY: 150, vanishingPoint: [300, 150], depthScale: 240 },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      subject: 'planned city units pinned to real constellation cells',
      constellation: {
        kind: 'cca-constellation-grid',
        layout: { kind: 'relative-grid', cols: 3, rows: 1, pad: 72, gap: 28 },
        vanishingPoint: [300, 150],
        nodes: [
          { role: 'tower-left', cell: { col: 0, row: 0 }, depthBand: 'midground', renderOrder: 10 },
          { role: 'tower-mid', cell: { col: 1, row: 0 }, depthBand: 'midground', renderOrder: 20 },
          { role: 'tower-right', cell: { col: 2, row: 0 }, depthBand: 'midground', renderOrder: 30 },
        ],
      },
    },
    marks: [
      {
        kind: 'mandalaField',
        role: 'planned-map',
        paths: [
          {
            role: 'context-units',
            basis: 'ray',
            from: [0, -1],
            to: [0, 1],
            pinTo: {
              kind: 'constellation-node',
              roles: ['tower-left', 'tower-mid', 'tower-right'],
              fit: 'bounds',
              anchor: 'bottom-center',
              widthRatio: 0.42,
              heightRatio: 0.72,
              depthRatio: 0.2,
            },
            heightRange: [40, 120],
            spawn: {
              kind: 'solid',
              fill: '#536f7d',
              stroke: '#13222a',
              faceCull: 'hide-back',
              fit: 'bounds',
            },
          },
        ],
      },
    ],
  };
}

function contactValidationManifest() {
  return {
    title: 'Contact validation',
    viewBox: { width: 360, height: 260 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      contactChecks: [
        {
          role: 'upright-sits-on-ground',
          fromRole: 'upright',
          fromRegion: 'baseContact',
          toRole: 'ground-plane',
          toRegion: 'polygon',
          mode: 'inside',
          tolerance: 1.5,
        },
      ],
    },
    marks: [
      {
        kind: 'polygon',
        role: 'ground-plane',
        points: [[80, 200], [280, 200], [300, 226], [60, 226]],
        fill: '#d8c9aa',
        stroke: '#947d5b',
        z: 1,
      },
      {
        kind: 'solid',
        role: 'upright',
        x: 160,
        y: 130,
        width: 36,
        height: 70,
        depth: 18,
        fill: '#8f8371',
        stroke: '#392f25',
        faceCull: 'hide-back',
        z: 10,
      },
    ],
  };
}

function metamandalaSurfaceManifest() {
  const manifest = contactValidationManifest();
  manifest.title = 'Metamandala surface derivation';
  manifest.polygonizer.metamandala = {
    basis: 'L',
    debugVisible: true,
    surfaces: [
      {
        role: 'upright-top-local-floor',
        kind: 'fromContact',
        fromRole: 'upright',
        fromRegion: 'topContact',
        z: 1,
        pad: 12,
        debugLaser: true,
      },
    ],
  };
  return manifest;
}

function metamandalaRelaxationManifest() {
  return {
    title: 'Metamandala relaxation',
    viewBox: { width: 360, height: 300 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      metamandala: {
        basis: 'L',
        debugVisible: false,
        surfaces: [
          {
            role: 'table-local-floor',
            kind: 'fromContact',
            fromRole: 'table-top',
            fromRegion: 'topContact',
            face: 'top',
            pad: 8,
          },
        ],
        relaxation: {
          enabled: true,
          clearance: 0,
          rules: [
            {
              role: 'object-on-table',
              targetRole: 'cup',
              surfaceRole: 'table-local-floor',
              includeRoles: ['cup'],
              targetRegion: 'baseContact',
            },
          ],
        },
      },
      contactChecks: [
        {
          role: 'cup-base-on-table-after-relaxation',
          fromRole: 'cup',
          fromRegion: 'baseContact',
          toRole: 'table-top',
          toRegion: 'topContact',
          mode: 'touches',
          tolerance: 1.5,
        },
      ],
    },
    marks: [
      {
        kind: 'solid',
        role: 'table-top',
        x: 80,
        y: 160,
        width: 180,
        height: 28,
        depth: 34,
        fill: '#83684e',
        stroke: '#2f251c',
        faceCull: 'hide-back',
        z: 5,
      },
      {
        kind: 'polygon',
        role: 'cup',
        points: [[145, 120], [195, 120], [190, 178], [150, 178]],
        fill: '#8aa7bb',
        stroke: '#18313d',
        z: 12,
      },
    ],
  };
}

function constellationHitboxRelaxationManifest() {
  const manifest = metamandalaRelaxationManifest();
  manifest.title = 'Constellation hitbox relaxation';
  manifest.polygonizer.constellation = {
    kind: 'cca-constellation-grid',
    vanishingPoint: [180, 100],
    nodes: [
      {
        role: 'table',
        renderOrder: 10,
        parent: null,
        depthBand: 'foreground',
        anchor: [170, 174],
        bounds: { x: 80, y: 139, width: 180, height: 49 },
        cca: {
          center: [170, 164],
          lengthAxis: [[80, 164], [260, 164]],
          heightAxis: [[170, 188], [170, 139]],
        },
        hitboxes: [
          {
            role: 'tabletop-support',
            kind: 'support-plane',
            bounds: { x: 92, y: 139.13, width: 156, height: 22 },
            supportRail: 'safe-standing',
          },
        ],
      },
    ],
  };
  manifest.polygonizer.metamandala.surfaces = [
    {
      role: 'table-hitbox-floor',
      kind: 'fromHitbox',
      nodeRole: 'table',
      hitboxRole: 'tabletop-support',
      rail: 'safe-standing',
      debugLaser: false,
    },
  ];
  manifest.polygonizer.metamandala.relaxation.rules[0] = {
    role: 'object-on-hitbox-table',
    targetRole: 'cup',
    surfaceRole: 'table-hitbox-floor',
    includeRoles: ['cup'],
    targetRegion: 'baseContact',
    align: 'center',
  };
  manifest.polygonizer.contactChecks[0] = {
    role: 'cup-base-on-hitbox-rail-after-relaxation',
    fromRole: 'cup',
    fromRegion: 'baseContact',
    toSurfaceRole: 'table-hitbox-floor',
    mode: 'touches',
    tolerance: 1.5,
  };
  manifest.marks[1].points = [[120, 120], [170, 120], [165, 178], [125, 178]];
  return manifest;
}

function metamandalaRelaxationPaintManifest() {
  const manifest = metamandalaRelaxationManifest();
  manifest.title = 'Metamandala relaxation paint order';
  manifest.polygonizer.metamandala.relaxation.rules[0] = {
    ...manifest.polygonizer.metamandala.relaxation.rules[0],
    paintAboveSupport: true,
    paintAboveRole: 'table-top',
    paintOffset: 0.5,
  };
  manifest.marks[1].z = 1;
  return manifest;
}

function gravityBowlOnTableManifest() {
  return {
    title: 'Gravity bowl on table',
    viewBox: { width: 360, height: 260 },
    scene: {
      view: { direction: [-0.35, -0.25], baseZ: 10 },
      light: { direction: [-0.55, -0.78], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      constellation: {
        kind: 'cca-constellation-grid',
        vanishingPoint: [180, 92],
        nodes: [
          {
            role: 'table',
            renderOrder: 20,
            parent: null,
            depthBand: 'foreground',
            anchor: [180, 216],
            bounds: { x: 10, y: 170, width: 340, height: 78 },
            cca: {
              center: [180, 209],
              lengthAxis: [[38, 193], [322, 193]],
              heightAxis: [[180, 248], [180, 170]],
              depthAxis: { toward: [180, 92] },
            },
            hitboxes: [
              {
                role: 'tabletop-support',
                kind: 'support-plane',
                bounds: { x: 52, y: 170, width: 256, height: 46 },
                supportRail: 'safe-standing',
              },
            ],
          },
        ],
      },
      metamandala: {
        basis: 'L',
        debugVisible: false,
        gravity: {
          enabled: true,
          supports: [
            {
              role: 'tabletop-support',
              kind: 'fromHitbox',
              nodeRole: 'table',
              hitboxRole: 'tabletop-support',
              rail: 'safe-standing',
            },
          ],
          bodies: [
            {
              role: 'bowl-body',
              supportRole: 'tabletop-support',
              includeRoles: ['bowl-rim', 'bowl-interior', 'bowl-highlight', 'bowl-shadow'],
              shadowRoles: ['bowl-shadow'],
            },
          ],
        },
      },
      contactChecks: [
        {
          role: 'bowl-base-on-tabletop-support',
          fromRole: 'bowl-body',
          fromRegion: 'baseContact',
          toSurfaceRole: 'tabletop-support',
          mode: 'touches',
          tolerance: 1.5,
        },
      ],
    },
    marks: [
      {
        kind: 'polygon',
        role: 'tabletop',
        points: [[38, 170], [322, 170], [350, 216], [10, 216]],
        fill: '#7d644c',
        stroke: '#30251c',
        z: 20,
      },
      {
        kind: 'polygon',
        role: 'table-front',
        points: [[10, 216], [350, 216], [338, 248], [22, 248]],
        fill: '#5f4938',
        stroke: '#2a2119',
        z: 19,
      },
      {
        kind: 'polygon',
        role: 'bowl-shadow',
        points: [[112, 200], [248, 200], [264, 212], [238, 221], [126, 221], [96, 212]],
        fill: '#2a2119',
        stroke: 'none',
        opacity: 0.22,
        z: 20.1,
      },
      {
        kind: 'polygon',
        role: 'bowl-body',
        points: [[126, 116], [234, 116], [248, 132], [218, 170], [142, 170], [112, 132]],
        fill: '#8fa6aa',
        stroke: '#23383c',
        z: 1,
      },
      { kind: 'oval', role: 'bowl-rim', anchor: [180, 116], rx: 58, ry: 17, fill: '#b7c7c8', stroke: '#23383c', z: 1 },
      { kind: 'oval', role: 'bowl-interior', anchor: [180, 118], rx: 47, ry: 11, fill: '#405b61', stroke: 'none', opacity: 0.58, z: 1 },
      { kind: 'polyline', role: 'bowl-highlight', points: [[136, 126], [158, 135], [184, 137]], stroke: '#e8f1ec', strokeWidth: 2.2, fill: 'none', z: 1 },
    ],
  };
}

function blockedGravityBowlManifest() {
  const manifest = gravityBowlOnTableManifest();
  manifest.title = 'Blocked gravity bowl';
  manifest.polygonizer.spatialPlanning = {
    mode: 'plan-before-skin',
    materializationGate: 'planning-valid',
  };
  manifest.polygonizer.metamandala.gravity.supports = [];
  manifest.polygonizer.metamandala.gravity.bodies[0].supportRole = 'missing-tabletop-support';
  manifest.polygonizer.contactChecks = [];
  return manifest;
}

function horizontalStackGravityManifest() {
  return {
    title: 'Horizontal gravity stack',
    viewBox: { width: 420, height: 280 },
    scene: {
      view: { direction: [-0.35, -0.25], baseZ: 10 },
      light: { direction: [-0.55, -0.78], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      spatialPlanning: {
        mode: 'plan-before-skin',
        materializationGate: 'planning-valid',
      },
      constellation: {
        kind: 'cca-constellation-grid',
        vanishingPoint: [210, 100],
        nodes: [
          {
            role: 'counter',
            renderOrder: 20,
            bounds: { x: 30, y: 172, width: 360, height: 70 },
            anchor: [210, 220],
            cca: {
              center: [210, 207],
              lengthAxis: [[60, 196], [360, 196]],
              heightAxis: [[210, 242], [210, 172]],
            },
            hitboxes: [
              {
                role: 'countertop-support',
                kind: 'support-plane',
                bounds: { x: 64, y: 172, width: 292, height: 40 },
                supportRail: 'safe-standing',
              },
            ],
          },
        ],
      },
      metamandala: {
        gravity: {
          enabled: true,
          supports: [
            {
              role: 'countertop-support',
              kind: 'fromHitbox',
              nodeRole: 'counter',
              hitboxRole: 'countertop-support',
              rail: 'safe-standing',
            },
          ],
        },
      },
    },
    marks: [
      {
        kind: 'polygon',
        role: 'countertop',
        points: [[60, 172], [360, 172], [390, 220], [30, 220]],
        fill: '#74614c',
        stroke: '#2f241b',
        z: 12,
      },
      {
        kind: 'horizontalStack',
        role: 'counter-stack',
        mode: 'gravity',
        x: 94,
        y: 238,
        spacing: 18,
        supportRole: 'countertop-support',
        members: [
          { kind: 'solid', width: 34, height: 52, depth: 26, fill: '#8aa7bb', stroke: '#1d3540' },
          { kind: 'solid', width: 46, height: 38, depth: 32, fill: '#b1845e', stroke: '#4f3928' },
          { kind: 'sphere', r: 22, fill: '#c47d45', stroke: '#55301f' },
        ],
        z: 4,
      },
    ],
  };
}

function horizontalStackSuperpositionManifest() {
  return {
    title: 'Horizontal superposition stack',
    viewBox: { width: 420, height: 260 },
    scene: {
      view: { direction: [-0.35, -0.25], baseZ: 10 },
      light: { direction: [-0.55, -0.78], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      spatialPlanning: {
        mode: 'plan-before-skin',
        materializationGate: 'planning-valid',
      },
    },
    marks: [
      {
        kind: 'horizontalStack',
        role: 'cloud-bank',
        mode: 'superposition',
        x: 96,
        y: 160,
        overlap: 0.46,
        skinPolicy: 'join',
        fill: '#aeb9bd',
        stroke: '#4a5559',
        members: [
          { kind: 'blob', rx: 44, ry: 24, fill: '#bec9cb', stroke: '#526066' },
          { kind: 'blob', rx: 52, ry: 30, fill: '#aebabe', stroke: '#526066' },
          { kind: 'blob', rx: 40, ry: 22, fill: '#c6d0d1', stroke: '#526066' },
        ],
        z: 14,
      },
    ],
  };
}

function mandalaArrangementGravityManifest() {
  const manifest = horizontalStackGravityManifest();
  manifest.title = 'Mandala arrangement gravity stack';
  manifest.marks[1] = {
    kind: 'mandalaArrangement',
    role: 'counter-stack',
    profile: 'horizontal-stack',
    mode: 'gravity',
    basis: {
      kind: 'local-lateral-support',
      localSpace: 'cca-local',
      origin: [94, 238],
      xAxis: [1, 0],
      supportAxis: [0, -1],
    },
    spacing: 18,
    supportRole: 'countertop-support',
    members: [
      { kind: 'solid', role: 'cup-left', width: 34, height: 52, depth: 26, fill: '#8aa7bb', stroke: '#1d3540' },
      { kind: 'solid', role: 'box-middle', width: 46, height: 38, depth: 32, fill: '#b1845e', stroke: '#4f3928' },
      { kind: 'sphere', role: 'orange-right', r: 22, fill: '#c47d45', stroke: '#55301f' },
    ],
    z: 4,
  };
  return manifest;
}

function rayContactArrangementManifest() {
  const manifest = horizontalStackGravityManifest();
  manifest.title = 'Ray contact stack';
  manifest.marks[1] = {
    kind: 'mandalaArrangement',
    role: 'market-stalls',
    profile: 'ray-contact-stack',
    activeRay: 'east-west',
    mode: 'gravity',
    basis: {
      kind: 'local-support-basis',
      localSpace: 'cca-local',
      origin: [80, 230],
      rays: {
        east: [1, 0],
        north: [0.55, -0.72],
        zenith: [0, -1],
      },
    },
    overlap: 0.55,
    spacing: 0,
    supportRole: 'countertop-support',
    collisionPolicy: 'repel-until-contact',
    floaterPolicy: 'allow-superposition',
    members: [
      { kind: 'solid', role: 'stall-a', width: 54, height: 72, depth: 30, fill: '#8aa7bb', stroke: '#1d3540' },
      { kind: 'solid', role: 'stall-b', width: 48, height: 68, depth: 28, fill: '#b1845e', stroke: '#4f3928' },
    ],
    z: 4,
  };
  return manifest;
}

function rayContactFloaterManifest() {
  const manifest = rayContactArrangementManifest();
  manifest.title = 'Ray contact floater stack';
  manifest.marks[1].role = 'sign-and-stall';
  manifest.marks[1].members = [
    { kind: 'solid', role: 'stall', width: 54, height: 72, depth: 30, fill: '#8aa7bb', stroke: '#1d3540' },
    { kind: 'solid', role: 'floating-sign', gravity: false, width: 48, height: 28, depth: 8, fill: '#d9c177', stroke: '#6a5520' },
  ];
  return manifest;
}

function northSouthRayContactManifest() {
  const manifest = rayContactArrangementManifest();
  manifest.title = 'North south ray contact';
  manifest.marks[1].role = 'street-depth-buildings';
  manifest.marks[1].activeRay = 'north-south';
  manifest.marks[1].basis.origin = [220, 240];
  manifest.marks[1].basis.rays.north = [0.55, -0.72];
  manifest.marks[1].members = [
    { kind: 'solid', role: 'near-building', width: 52, height: 96, depth: 34, fill: '#8aa7bb', stroke: '#1d3540' },
    { kind: 'solid', role: 'far-building', width: 52, height: 82, depth: 38, fill: '#b1845e', stroke: '#4f3928' },
  ];
  return manifest;
}

function pyramidRayBounceManifest() {
  const manifest = horizontalStackGravityManifest();
  manifest.title = 'Three pyramid ray bounce';
  manifest.viewBox = { width: 720, height: 420 };
  manifest.scene = {
    perspective: {
      mode: 'one-point',
      horizonY: 120,
      vanishingPoint: [360, 120],
    },
    view: { direction: [-0.35, -0.25], baseZ: 10 },
    light: { direction: [-0.62, -0.74], z: 0.78 },
    palette: 'warm-low-key',
  };
  manifest.polygonizer.constellation.nodes[0].bounds = { x: 90, y: 260, width: 540, height: 74 };
  manifest.polygonizer.constellation.nodes[0].anchor = [360, 318];
  manifest.polygonizer.constellation.nodes[0].hitboxes[0].bounds = { x: 120, y: 254, width: 480, height: 52 };
  manifest.polygonizer.metamandala.gravity.supports[0].role = 'desert-floor-support';
  manifest.polygonizer.metamandala.gravity.supports[0].hitboxRole = 'countertop-support';
  manifest.marks = [
    {
      kind: 'polygon',
      role: 'desert-floor',
      points: [[80, 255], [640, 255], [700, 380], [20, 380]],
      fill: '#d7bf87',
      stroke: '#8f7441',
      z: 8,
    },
    {
      kind: 'mandalaArrangement',
      role: 'pyramid-cluster',
      profile: 'ray-contact-stack',
      activeRay: 'east-west',
      mode: 'gravity',
      basis: {
        kind: 'desert-floor-support-basis',
        localSpace: 'cca-local',
        origin: [318, 302],
        rays: {
          east: [1, 0],
          north: [0.42, -0.62],
          zenith: [0, -1],
        },
      },
      supportRole: 'desert-floor-support',
      collisionPolicy: 'repel-until-contact',
      members: [
        { kind: 'solid', role: 'pyramid-north', local: [0, -1], width: 86, height: 114, depth: 62, fill: '#caa45c', stroke: '#5e4525', faceCull: 'hide-back-bottom' },
        { kind: 'solid', role: 'pyramid-east', local: [1, 0], width: 86, height: 114, depth: 62, fill: '#d3b06b', stroke: '#5e4525', faceCull: 'hide-back-bottom' },
        { kind: 'solid', role: 'pyramid-south', local: [0, 1], width: 86, height: 114, depth: 62, fill: '#b98f4d', stroke: '#5e4525', faceCull: 'hide-back-bottom' },
      ],
      z: 12,
    },
  ];
  return manifest;
}

function prefixShadowGravityManifest() {
  const manifest = gravityBowlOnTableManifest();
  manifest.title = 'Gravity prefix shadow exclusion';
  manifest.polygonizer.metamandala.gravity.bodies = [
    {
      role: 'lamp',
      supportRole: 'tabletop-support',
      includeRoles: ['lamp-shade', 'lamp-shadow'],
      shadowRoles: ['lamp-shadow'],
    },
  ];
  manifest.polygonizer.contactChecks = [
    {
      role: 'lamp-base-on-tabletop-support',
      fromRole: 'lamp',
      fromRegion: 'baseContact',
      toSurfaceRole: 'tabletop-support',
      mode: 'touches',
      tolerance: 1.5,
    },
  ];
  manifest.marks = [
    ...manifest.marks.slice(0, 3),
    {
      kind: 'polygon',
      role: 'lamp-shadow',
      points: [[160, 202], [224, 202], [236, 212], [154, 214]],
      fill: '#2a2119',
      stroke: 'none',
      opacity: 0.18,
      z: 20.1,
    },
    {
      kind: 'polygon',
      role: 'lamp',
      points: [[186, 142], [206, 142], [204, 170], [188, 170]],
      fill: '#c8a978',
      stroke: '#3a2a1d',
      z: 1,
    },
    {
      kind: 'polygon',
      role: 'lamp-shade',
      points: [[166, 124], [226, 124], [214, 144], [178, 144]],
      fill: '#d9bd7c',
      stroke: '#3a2a1d',
      z: 1,
    },
  ];
  return manifest;
}

function stackedHitboxAdjacencyPaintManifest() {
  return {
    title: 'Stacked hitbox adjacency paint order',
    viewBox: { width: 360, height: 260 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    polygonizer: {
      metamandala: {
        basis: 'L',
        debugVisible: false,
        surfaces: [
          {
            role: 'surface-top',
            kind: 'fromContact',
            fromRole: 'support-surface',
            fromRegion: 'topContact',
            pad: 0,
          },
          {
            role: 'bottom-cube-top',
            kind: 'fromContact',
            fromRole: 'bottom-cube',
            fromRegion: 'topContact',
            pad: 0,
          },
          {
            role: 'top-cube-top',
            kind: 'fromContact',
            fromRole: 'top-cube',
            fromRegion: 'topContact',
            pad: 0,
          },
        ],
        relaxation: {
          enabled: true,
          rules: [
            {
              role: 'bottom-cube-on-surface',
              targetRole: 'bottom-cube',
              surfaceRole: 'surface-top',
              targetRegion: 'baseContact',
            },
            {
              role: 'top-cube-on-bottom-cube',
              targetRole: 'top-cube',
              surfaceRole: 'bottom-cube-top',
              targetRegion: 'baseContact',
            },
            {
              role: 'sphere-on-top-cube',
              targetRole: 'top-sphere',
              surfaceRole: 'top-cube-top',
              targetRegion: 'baseContact',
            },
          ],
        },
      },
    },
    marks: [
      {
        kind: 'polygon',
        role: 'support-surface',
        points: [[70, 190], [310, 190], [328, 222], [52, 222]],
        fill: '#6d5b48',
        stroke: '#2c241c',
        z: 30,
      },
      {
        kind: 'polygon',
        role: 'bottom-cube',
        points: [[150, 150], [230, 150], [250, 190], [170, 190]],
        fill: '#8a765a',
        stroke: '#2d261e',
        z: 1,
      },
      {
        kind: 'polygon',
        role: 'top-cube',
        points: [[176, 110], [236, 118], [224, 150], [164, 142]],
        fill: '#6f8c9b',
        stroke: '#1f3138',
        z: 1,
      },
      {
        kind: 'sphere',
        role: 'top-sphere',
        anchor: [200, 94],
        r: 16,
        fill: '#b58d52',
        stroke: '#3e2b18',
        z: 1,
      },
    ],
  };
}

function suspendedCubieLatticeManifest() {
  return {
    title: 'Suspended cubie lattice',
    viewBox: { width: 620, height: 520 },
    polygonizer: {
      subject: '27 suspended cubies forming a cube',
      impactPoint: [320, 280],
      realityFacts: ['27 separate cubies', 'gaps create negative space'],
      minimalAbstractions: ['parent lattice CCA emits 3x3x3 cubies'],
    },
    scene: {
      perspective: { mode: 'one-point', horizonY: 182, vanishingPoint: [500, 182], depthScale: 260 },
      view: { direction: [-0.5, -0.28], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'cubieLattice',
        role: 'suspended-cube-lattice',
        anchor: [320, 280],
        cols: 3,
        rows: 3,
        layers: 3,
        cellSize: 42,
        gap: 12,
        depth: 36,
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
      },
    ],
  };
}

function floorMandalaCubieLatticeManifest() {
  const manifest = suspendedCubieLatticeManifest();
  manifest.marks[0] = {
    ...manifest.marks[0],
    depthMode: 'floor-plane',
    floorDepth: 170,
  };
  return manifest;
}

function pureMandalaCubieLatticeManifest() {
  const manifest = suspendedCubieLatticeManifest();
  manifest.polygonizer.pureMandala = {
    kind: 'top-down-scene-blockout',
    unit: 'relative',
    genesisPoint: [0, 0],
    camera: {
      screenOrigin: [320, 380],
      east: [1, -0.06],
      north: [0.62, -0.78],
      zenith: [0, -1],
      unitScale: 52,
      depthScale: 0.82,
    },
    blocks: [
      {
        role: 'suspended-cube-lattice',
        worldXY: [0, -1.2],
        sizeXY: [3, 3],
        altitude: 1.1,
        height: 2.4,
        base: 'projected-to-floor',
      },
    ],
  };
  manifest.marks[0] = {
    ...manifest.marks[0],
    mandalaRole: 'suspended-cube-lattice',
  };
  return manifest;
}

function polygonizerBookshelfManifest() {
  return {
    title: 'Polygonizer bookshelf',
    viewBox: { width: 620, height: 460 },
    polygonizer: {
      subject: 'bookshelf',
      impactPoint: [260, 250],
      realityFacts: ['4 shelf rows', 'side walls', 'back panel', 'book spines'],
      minimalAbstractions: ['cabinet = solid volume', 'shelf rows = partition cabinet volume into 4 bands'],
    },
    scene: {
      perspective: {
        mode: 'one-point',
        vanishingPoint: [460, 190],
        depthScale: 230,
      },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'cabinet-body',
        x: 150,
        y: 82,
        width: 260,
        height: 300,
        depth: 62,
        fill: '#8a654a',
        stroke: '#3f2f24',
        z: 9,
      },
      {
        kind: 'partition',
        target: 'cabinet-body',
        axis: 'y',
        count: 4,
        role: 'shelf-row',
        thickness: 13,
        fill: '#b1845e',
      },
      {
        kind: 'array',
        role: 'book-spines',
        count: 12,
        from: [190, 156],
        to: [360, 156],
        item: { kind: 'solid', width: 10, height: 48, depth: 18, fill: '#6d7c74', stroke: '#3f2f24' },
      },
    ],
  };
}

function polygonizerBridgeManifest() {
  return {
    title: 'Polygonizer bridge',
    viewBox: { width: 860, height: 430 },
    polygonizer: {
      subject: 'golden gate bridge',
      impactPoint: [260, 290],
      cameraIntent: 'angled span receding right',
      realityFacts: [
        'two main towers',
        'long deck',
        'main suspension cable arcs',
        'vertical suspenders repeat along span',
        'international orange color',
      ],
      minimalAbstractions: [
        'deck = long receding solid',
        'tower = paired vertical solids plus cross beams',
        'suspenders = repeated vertical lines along deck path',
      ],
    },
    scene: {
      perspective: {
        mode: 'one-point',
        vanishingPoint: [760, 190],
        depthScale: 260,
      },
      view: { direction: [-0.6, -0.25], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      { kind: 'solid', role: 'deck', x: 150, y: 278, width: 520, height: 22, depth: 120, fill: '#c9572d', z: 10 },
      { kind: 'solid', role: 'near-tower', x: 238, y: 116, width: 46, height: 178, depth: 42, fill: '#d46f42', z: 14 },
      { kind: 'solid', role: 'far-tower', x: 548, y: 142, width: 34, height: 128, depth: 34, fill: '#bd512c', z: 12 },
      {
        kind: 'polyline',
        role: 'main-cable',
        points: [
          [142, 206],
          [260, 124],
          [565, 150],
          [704, 206],
        ],
        stroke: '#e08a5c',
        strokeWidth: 5,
        z: 24,
      },
      {
        kind: 'array',
        role: 'suspenders',
        count: 14,
        from: [170, 278],
        to: [670, 250],
        upperFrom: [170, 204],
        upperTo: [670, 198],
        item: { kind: 'line', stroke: '#f1a06b', strokeWidth: 2, scaleTo: 0.7 },
        z: 23,
      },
    ],
  };
}

function vectorSmokeSwirlFieldManifest() {
  return {
    title: 'Vector smoke swirl field',
    viewBox: { width: 720, height: 520 },
    polygonizer: {
      subject: 'chimney vector smoke',
      impactPoint: [320, 300],
      realityFacts: ['smoke rises from a source', 'swirls repeat with varied scale', 'wisps become softer with depth'],
      minimalAbstractions: [
        'plume = seeded 3d swirl glyph population',
        'glyph = hooked curl line plus soft puff mass',
        'smoke opacity = deterministic overlap budget',
      ],
      mandalaPatternLayer: {
        patterns: [
          {
            id: 'hook-cloud-swirl-field',
            family: 'motion-glyph-field',
            topology: { axes: 'spiral', handedness: 'clockwise-or-counterclockwise' },
            boundaryContract: {
              slots: ['curl-head', 'inner-spiral', 'tail-flow', 'dissolve-edge'],
              collisionGroups: ['smoke-body', 'inner-negative-space'],
              depthBands: ['near-puff', 'mid-wisp', 'far-haze'],
            },
          },
        ],
      },
    },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'chimney',
        x: 304,
        y: 326,
        width: 70,
        height: 96,
        depth: 28,
        fill: '#76543e',
        stroke: '#332318',
        z: 8,
      },
      {
        kind: 'swirlField',
        role: 'chimney-vector-smoke',
        stroke: '#d9d4c6',
        fill: '#d9d4c6',
        z: 34,
        basis: {
          origin: [0, 0, 0],
          flow: [0.15, -1, 0.2],
          lift: [0, 0, 1],
          cross: [1, 0.08, 0],
          screenOrigin: [337, 330],
          east: [1, -0.05],
          north: [0.45, -0.74],
          zenith: [0, -1],
          unitScale: 30,
          depthScale: 0.9,
          length: 8.4,
          spread: 2.8,
          liftAmount: 3.6,
        },
        population: {
          count: 14,
          seed: 'chimney-smoke-proof',
          scale: [0.52, 1.18],
          opacity: [0.18, 0.52],
          handedness: 'alternate-biased',
        },
        glyph: {
          id: 'hook-cloud-swirl',
          turns: [0.72, 1.32],
          radius: [0.34, 0.86],
          tailLength: [0.7, 1.7],
          points: 30,
          strokeWidth: 4.4,
          wobble: 0.09,
        },
      },
    ],
  };
}

function fluidWallpaperSwishManifest() {
  return {
    title: 'Fluid wallpaper swish field',
    viewBox: { width: 720, height: 520 },
    polygonizer: {
      subject: 'abstract free-space fluid wallpaper swishes',
      impactPoint: [360, 260],
      realityFacts: ['curved swishes cross open space', 'ribbons vary by scale and opacity', 'motion reads as fluid rather than smoke'],
      minimalAbstractions: [
        'wallpaper swish = seeded free-space fluid field',
        'glyph = long curl ribbon with no soft puff mass',
        'variation = deterministic handedness, scale, opacity, and drift',
      ],
      mandalaPatternLayer: {
        patterns: [
          {
            id: 'free-space-swish-field',
            family: 'fluid-dynamics-glyph-field',
            topology: { axes: 'curved-flow', handedness: 'clockwise-or-counterclockwise' },
            boundaryContract: {
              slots: ['flow-origin', 'primary-swish', 'secondary-swish', 'negative-channel'],
              collisionGroups: ['fluid-ribbon', 'open-negative-space'],
              depthBands: ['near-ribbon', 'mid-ribbon', 'far-ribbon'],
            },
          },
        ],
      },
    },
    scene: {
      view: { direction: [-0.25, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'fluidField',
        role: 'default-wallpaper-fluid-swishes',
        medium: 'wallpaper-swirl',
        stroke: '#89b8d8',
        fill: '#89b8d8',
        z: 16,
        basis: {
          origin: [-2.2, 0.8, 0],
          flow: [0.9, -0.55, 0.05],
          lift: [0, 0, 1],
          cross: [0.4, 1, 0],
          screenOrigin: [300, 332],
          east: [1, -0.03],
          north: [0.3, -0.66],
          zenith: [0, -1],
          unitScale: 34,
          depthScale: 0.94,
          length: 10,
          spread: 5.6,
          liftAmount: 0.8,
        },
        population: {
          count: 9,
          seed: 'phone-wallpaper-swish-proof',
          scale: [1.1, 2.4],
          opacity: [0.38, 0.76],
          handedness: 'seeded',
        },
        glyph: {
          id: 'free-space-swish',
          turns: [0.35, 0.95],
          radius: [0.78, 1.65],
          tailLength: [1.9, 3.8],
          points: 46,
          strokeWidth: 6.8,
          softMass: false,
        },
      },
    ],
  };
}

function noisySpaghettiStreamManifest() {
  return {
    title: 'Noisy spaghetti stream field',
    viewBox: { width: 760, height: 460 },
    polygonizer: {
      subject: 'shared-current noisy spaghetti stream',
      impactPoint: [360, 270],
      realityFacts: ['clustered strands flow mostly downstream', 'individual wires are not perfectly aligned', 'fractal splits create river-like braided detail'],
      minimalAbstractions: [
        'stream = fluidField macro current',
        'noisy spaghetti = Pastamaker clustered strand die',
        'density controls strand count per current glyph',
        'length controls how much of each current path a strand occupies',
      ],
    },
    scene: {
      view: { direction: [-0.35, -0.25], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'fluidField',
        role: 'braided-stream-current',
        medium: 'stream',
        stroke: '#5fb6c3',
        fill: '#5fb6c3',
        z: 22,
        basis: {
          origin: [-3.6, 0.8, 0],
          flow: [1, -0.28, 0.04],
          lift: [0, 0, 1],
          cross: [0.2, 1, 0],
          screenOrigin: [250, 315],
          east: [1, -0.04],
          north: [0.42, -0.48],
          zenith: [0, -1],
          unitScale: 35,
          depthScale: 0.86,
          length: 8.8,
          spread: 2.2,
          liftAmount: 0.5,
        },
        population: {
          count: 5,
          seed: 'shared-fluid-dynamics-noisy-spaghetti',
          scale: [1.1, 1.7],
          opacity: [0.24, 0.48],
          handedness: 'seeded',
        },
        glyph: {
          id: 'current-carrier',
          turns: [0.18, 0.42],
          radius: [0.28, 0.62],
          tailLength: [2.8, 4.2],
          points: 34,
          strokeWidth: 1.2,
          softMass: false,
          effects: {
            pastamaker: [
              {
                role: 'braided-noisy-spaghetti',
                die: { family: 'noisySpaghetti', strokeWidth: 1.2 },
                field: {
                  kind: 'alongFluidGlyph',
                  density: 7,
                  length: [0.58, 0.94],
                  lateralJitter: [-16, 16],
                  alignment: 0.72,
                  fractalOctaves: 4,
                  fractalSplit: 2,
                  samples: 20,
                },
                valueBudget: { targetOpacity: 0.5, expectedOverlapCount: 7, mode: 'inverse-count' },
                stroke: '#9be1d5',
              },
            ],
          },
        },
      },
    ],
  };
}

function bulbSeaweedFireManifest() {
  return {
    title: 'Bulb seaweed flame field',
    viewBox: { width: 520, height: 420 },
    polygonizer: {
      subject: 'deterministic glyph fire',
      impactPoint: [260, 315],
      realityFacts: [
        'fire rises from a source',
        'bulbous seaweed flame glyphs flare near the base and point at the top',
        'red core texture sits inside the flame envelope',
      ],
      minimalAbstractions: [
        'fire = fluidField heat population',
        'bulb-seaweed-flame = deterministic flame glyph',
        'Pastamaker spikes and fuzz garnish the glyph envelope',
      ],
    },
    scene: {
      view: { direction: [-0.25, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'fluidField',
        role: 'hearth-flame-field',
        medium: 'fire',
        fill: '#ff8a1f',
        stroke: '#8d1c10',
        z: 24,
        basis: {
          origin: [-1.8, 0.4, 0],
          flow: [0.12, -0.2, 0.02],
          lift: [0, 0, 1],
          cross: [1, 0, 0],
          screenOrigin: [250, 318],
          east: [1, -0.03],
          north: [0.28, -0.46],
          zenith: [0, -1],
          unitScale: 42,
          depthScale: 0.9,
          length: 3.2,
          spread: 2.1,
          liftAmount: 0.3,
        },
        population: {
          count: 5,
          seed: 'bulb-seaweed-fire-proof',
          scale: [0.82, 1.28],
          opacity: [0.68, 0.94],
          handedness: 'alternate-biased',
        },
        glyph: {
          id: 'bulb-seaweed-flame',
          profile: 'flare-source-waist-point-bulb',
          height: [1.8, 2.7],
          radius: [0.34, 0.68],
          points: 24,
          curveAmount: [-0.3, 0.3],
          wobble: 0.16,
          coreFill: '#d71920',
          effects: {
            pastamaker: [
              {
                role: 'red-core-spikes',
                die: { family: 'spikeBanana', radius: [6, 16], thickness: [4, 8], spike: 0.45 },
                field: { kind: 'insideFluidEnvelope', count: 3, radius: [5, 18], envelopeT: 0.42 },
                valueBudget: { targetOpacity: 0.72, expectedOverlapCount: 4, mode: 'inverse-count' },
                fill: '#ff3724',
                stroke: '#83120c',
              },
              {
                role: 'source-ember-fuzz',
                die: { family: 'fuzzyPeach', radius: [3, 7], fuzz: 0.28 },
                field: { kind: 'aroundGlyphBase', count: 2, radius: [4, 12] },
                valueBudget: { targetOpacity: 0.36, expectedOverlapCount: 5, mode: 'inverse-count' },
                fill: '#7a1010',
              },
            ],
          },
        },
      },
    ],
  };
}

function rBrushFireManifest(overrides = {}) {
  return {
    title: 'rBrush fire matter proof',
    viewBox: { width: 520, height: 420 },
    polygonizer: {
      subject: 'rBrush smart 3D pen fire proof',
      impactPoint: [260, 315],
      realityFacts: [
        'rBrush is vector matter before elemental readout',
        'fire phase rises from a source and glows independent of scene lighting',
      ],
      minimalAbstractions: [
        'rBrush = smart 3D pen for deterministic vector matter',
        'fire readout = soft envelope + loaded strings + reasoned color',
      ],
    },
    marks: [
      {
        kind: 'rBrush',
        role: 'match-flame-rbrush',
        seed: 'rbrush-fire-proof',
        z: 18,
        matter: {
          phase: 'fire',
          basis: {
            origin: [0, 0, 0],
            flow: [0.04, -0.16, 0.08],
            lift: [0, 0, 1],
            cross: [1, 0, 0],
            screenOrigin: [260, 320],
            east: [1, 0],
            north: [0.42, -0.62],
            zenith: [0, -1],
            unitScale: 43,
            depthScale: 0.82,
            perspectiveSizing: false,
          },
          envelope: {
            profile: 'fat-lick',
            sourceRadius: 0.32,
            height: [1.85, 2.15],
            width: [0.55, 0.72],
            pointiness: 0.82,
            wobble: 0.12,
            points: 28,
          },
        },
        load: [
          {
            role: 'yellow-core-strings',
            die: { family: 'noisySpaghetti', stroke: '#fff3b0', strokeWidth: 0.7 },
            field: { kind: 'insideEnvelope', count: 12, length: 0.9, lateralJitter: 10, alignment: 0.78, samples: 14, fractalOctaves: 2, fractalSplit: 0 },
          },
        ],
        color: {
          reasoning: 'combustion',
          independentLighting: true,
          stops: [
            { role: 'source-white', color: '#fff8cc' },
            { role: 'hot-yellow', color: '#ffd36a' },
            { role: 'body-orange', color: '#ff8a1f' },
            { role: 'cool-red', color: '#d71920' },
          ],
        },
        edge: { atmosphere: 'same-color-soft-glow', outline: false, blur: 20 },
        ...overrides,
      },
    ],
  };
}

function rBrushInk2DManifest() {
  return {
    title: 'rBrush 2D ink pen proof',
    viewBox: { width: 520, height: 320 },
    marks: [
      {
        kind: 'rBrush',
        role: 'ink-signature-stroke',
        seed: 'rbrush-ink-2d-proof',
        mode: '2d',
        points: [
          [72, 188],
          [142, 168],
          [218, 174],
          [302, 132],
          [412, 118],
        ],
        matter: {
          phase: 'ink',
          mode: '2d',
          envelope: {
            profile: 'ink-pen',
            width: 11,
            noise: 0.22,
            taper: 0.42,
            pressure: [0.82, 1.08],
            points: 34,
          },
        },
        load: [
          {
            role: 'ink-fiber-lines',
            die: { family: 'noisySpaghetti', stroke: '#211711', strokeWidth: 0.8 },
            field: { kind: 'insideStroke', count: 6, length: 0.98, lateralJitter: 2.4, alignment: 0.92, samples: 18, fractalOctaves: 1, fractalSplit: 0 },
            valueBudget: { targetOpacity: 0.18, expectedOverlapCount: 5, mode: 'inverse-count' },
          },
        ],
        fill: '#1f1712',
        z: 10,
      },
    ],
  };
}

function rBrush2DBrushProfilesManifest() {
  const profiles = ['ink-pen', 'brush-pen', 'dry-brush', 'marker', 'calligraphy'];
  return {
    title: 'rBrush 2D brush profile proof',
    viewBox: { width: 760, height: 420 },
    marks: profiles.map((profile, index) => ({
      kind: 'rBrush',
      role: `brush-profile-${profile}`,
      seed: `rbrush-profile-${profile}`,
      mode: '2d',
      points: [
        [90, 78 + index * 62],
        [190, 58 + index * 62],
        [330, 84 + index * 62],
        [510, 52 + index * 62],
        [648, 70 + index * 62],
      ],
      matter: {
        phase: 'ink',
        mode: '2d',
        envelope: { profile },
      },
      fill: profile === 'marker' ? '#315a8c' : '#211711',
      z: 10 + index,
    })),
  };
}

function rBrush2DPrintTraceManifest() {
  return {
    title: 'rBrush 2D print trace proof',
    viewBox: { width: 760, height: 360 },
    marks: [
      {
        kind: 'rBrush',
        role: 'merged-brush-print-line',
        seed: 'rbrush-print-trace-proof',
        mode: '2d',
        points: [[82, 214], [156, 178], [238, 205], [332, 146], [454, 170], [620, 118], [690, 140]],
        matter: {
          phase: 'ink',
          mode: '2d',
          envelope: { profile: 'dry-brush', width: 18, points: 36 },
        },
        print: {
          die: { family: 'bristleFan' },
          mergeMode: 'trace',
          tracePolicy: 'stripHull',
          spacing: 0.34,
          scatter: 6,
          scale: [0.75, 1.2],
          renderBudget: { maxDabs: 64, maxTracePoints: 72 },
          smoothing: 0.42,
        },
        load: [
          {
            role: 'trace-texture-lines',
            die: { family: 'noisySpaghetti', stroke: '#352419', strokeWidth: 0.7 },
            field: { kind: 'insideStroke', count: 8, length: 0.94, lateralJitter: 5, alignment: 0.8, samples: 18, fractalOctaves: 1, fractalSplit: 0 },
          },
        ],
        fill: '#3a2618',
        opacity: 0.7,
        z: 10,
      },
    ],
  };
}

function rBrush2DStampDoubleDotManifest() {
  return {
    title: 'rBrush 2D double dot stamp proof',
    viewBox: { width: 760, height: 520 },
    marks: [
      {
        kind: 'rBrush',
        role: 'linked-double-dot-s',
        seed: 'rbrush-linked-double-dot-s-proof',
        mode: '2d',
        points: [
          [382, 118],
          [258, 166],
          [382, 238],
          [512, 310],
          [382, 428],
        ],
        matter: {
          phase: 'ink',
          mode: '2d',
          envelope: { profile: 'ink-pen', width: 14 },
        },
        print: {
          mode: 'stamp',
          die: { family: 'doubleDot', radius: 7.2, gap: 2 },
          frequencyFactor: 0.62,
          linkage: 'stroke-object',
          renderBudget: { maxStamps: 180 },
        },
        fill: '#231812',
        z: 10,
      },
    ],
  };
}

function rBrush2DStampComponentTraceManifest() {
  const manifest = rBrush2DStampDoubleDotManifest();
  manifest.title = 'rBrush 2D double dot component trace proof';
  manifest.marks[0].role = 'component-trace-double-dot-s';
  manifest.marks[0].print = {
    ...manifest.marks[0].print,
    mergeMode: 'component-trace',
    tracePolicy: 'stripHull',
    smoothing: 0.38,
    renderBudget: { maxStamps: 180, maxTracePoints: 96 },
  };
  return manifest;
}

function primitiveElementTableManifest() {
  return {
    title: 'Primitive element table',
    viewBox: { width: 720, height: 420 },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10, blobZStep: 0.1 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
      interBlobShadows: false,
    },
    marks: [
      { kind: 'text', x: 70, y: 54, value: 'primitive element table', size: 20, color: '#303737' },
      {
        kind: 'sphere',
        role: 'sphere-sample',
        anchor: [120, 170],
        r: 46,
        fill: '#b1845e',
        shade: { algorithm: 'form-light-stack', intensity: 0.75 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.25 },
      },
      {
        kind: 'oval',
        role: 'oval-sample',
        anchor: [270, 170],
        rx: 58,
        ry: 34,
        fill: '#8f5f45',
        shade: { algorithm: 'form-light-stack', intensity: 0.75 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.25 },
      },
      {
        kind: 'cylinder',
        role: 'cylinder-sample',
        anchor: [430, 174],
        rx: 42,
        height: 108,
        depth: 17,
        fill: '#6d7c74',
        shade: { algorithm: 'form-light-stack', intensity: 0.55 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.18 },
      },
      {
        kind: 'egg',
        role: 'egg-sample',
        anchor: [590, 170],
        rx: 42,
        ry: 58,
        fill: '#c8a978',
        shade: { algorithm: 'form-light-stack', intensity: 0.75 },
        highlights: { algorithm: 'form-light-stack', intensity: 0.25 },
      },
    ],
  };
}

function twoPointRoomManifest() {
  return {
    title: 'Two-point room person floor ceiling',
    viewBox: { width: 980, height: 620 },
    cameraPrimitive: {
      kind: 'two-point',
      anchor: 'room-figure',
      canonicalAngle: 'adult-eye-room-3q',
      eyeHeight: 'regular-adult',
      horizonY: 245,
      vanishingPoints: {
        left: [-220, 245],
        right: [1180, 245],
      },
      verticalAxis: [0, -1],
      cropBox: { x: 180, y: 90, width: 620, height: 430 },
      showFullMandala: false,
      keepWorldStable: true,
    },
    polygonizer: {
      subject: 'two point room with standing person',
      pureMandala: {
        kind: 'top-down-room-blockout',
        unit: 'dimensional',
        room: {
          floor: { x: [-18, 18], y: [8, -28], z: 0 },
          ceilingZ: 11,
          walls: {
            leftX: -18,
            rightX: 18,
            backY: -28,
          },
        },
        pinnedElements: [
          { role: 'figure', worldXYZ: [0, -8, 0], height: 6.2 },
          { role: 'door', wall: 'back', x: [5, 10], z: [0, 7.2] },
          { role: 'ceiling-light', worldXYZ: [-6, -12, 11] },
        ],
      },
    },
    scene: {
      palette: 'warm-low-key',
      light: { direction: [-0.55, -0.8] },
    },
    marks: [],
  };
}

function twoPointInRoomManifest() {
  const manifest = twoPointRoomManifest();
  manifest.title = 'Two-point camera inside room with hallway and scale objects';
  manifest.cameraPrimitive.cropBox = { x: 120, y: 60, width: 760, height: 500 };
  manifest.polygonizer.subject = 'two point camera fully inside room with hallway and furniture';
  manifest.polygonizer.pureMandala.pinnedElements = [
    { role: 'figure', worldXYZ: [-3, -7, 0], height: 6.2 },
    { role: 'hallway', wall: 'back', x: [1, 8], z: [0, 10.4], toY: -46 },
    { role: 'ceiling-light', worldXYZ: [-5, -13, 11] },
    { role: 'shelf', worldXYZ: [-15.5, -14, 0], sizeXYZ: [3, 10, 7.4] },
    { role: 'bar', worldXYZ: [7, -3, 0], sizeXYZ: [9, 3.5, 3.2] },
    { role: 'table', worldXYZ: [-4, 0, 0], sizeXYZ: [5, 3.4, 2.7] },
  ];
  return manifest;
}

function twoOpposingHallwaysManifest() {
  const manifest = twoPointRoomManifest();
  manifest.title = 'Two-point room with opposing side hallways';
  manifest.cameraPrimitive.anchor = 'near-right-hallway';
  manifest.cameraPrimitive.constraint = 'standing-in-side-hallway';
  manifest.cameraPrimitive.cropBox = { x: 210, y: 185, width: 470, height: 330 };
  manifest.polygonizer.subject = 'room shaped by two opposite side hallways';
  manifest.polygonizer.pureMandala.pinnedElements = [
    { id: 'near-hallway', role: 'hallway', wall: 'right', y: [-2, 8], z: [0, 10.5], toX: 36 },
    { id: 'opposite-hallway', role: 'hallway', wall: 'left', y: [-28, -18], z: [0, 10.5], toX: -36 },
    { role: 'figure', worldXYZ: [14, 4, 0], height: 6.2 },
    { role: 'ceiling-light', worldXYZ: [-1, -10, 11] },
    { role: 'table', worldXYZ: [0, -6, 0], sizeXYZ: [5, 3.4, 2.6] },
    { role: 'shelf', worldXYZ: [-14.8, -8, 0], sizeXYZ: [2.6, 7, 6.4] },
  ];
  return manifest;
}

function twoOpposingHallwaysCameraViewManifest() {
  const manifest = twoOpposingHallwaysManifest();
  manifest.title = 'Two-point opposing hallways from figure eye level';
  manifest.cameraPrimitive.anchor = 'camera-figure';
  manifest.cameraPrimitive.eyeWorldXYZ = [14, 4, 5.6];
  manifest.cameraPrimitive.cropBox = { x: 250, y: 190, width: 430, height: 315 };
  manifest.polygonizer.subject = 'room seen from the figure standing in the near hallway';
  const figure = manifest.polygonizer.pureMandala.pinnedElements.find((el) => el.role === 'figure');
  figure.id = 'camera-figure';
  figure.visible = false;
  figure.camera = true;
  return manifest;
}

function twoPointDoorwayBoxRoomManifest() {
  const manifest = twoPointRoomManifest();
  manifest.title = 'Two-point box room from doorway eye level';
  manifest.cameraPrimitive.anchor = 'camera-figure';
  manifest.cameraPrimitive.constraint = 'doorway-eye-box-room';
  manifest.cameraPrimitive.cropBox = { x: 120, y: 210, width: 590, height: 300 };
  manifest.cameraPrimitive.roomBasis = { verticalUnit: 22 };
  manifest.cameraPrimitive.debugDots = false;
  manifest.polygonizer.subject = 'plain box room seen from doorway eye level';
  manifest.polygonizer.pureMandala.pinnedElements = [
    { id: 'camera-figure', role: 'figure', worldXYZ: [0, 8, 0], height: 6.2, visible: false, camera: true },
  ];
  return manifest;
}

function twoPointCenteredDoorSquareRoomManifest() {
  const manifest = twoPointDoorwayBoxRoomManifest();
  manifest.title = 'Two-point square room from centered door camera point';
  manifest.cameraPrimitive.anchor = 'center-door-camera';
  manifest.cameraPrimitive.cameraPoint = {
    kind: 'doorway-entry-eye',
    doorWall: 'front',
    doorCenter: [0, 8, 5.6],
    lookAt: [0, -7, 3.2],
  };
  manifest.cameraPrimitive.constraint = 'walking-into-square-room';
  manifest.cameraPrimitive.cropBox = { x: 205, y: 230, width: 350, height: 245 };
  manifest.cameraPrimitive.vanishingPoints = {
    left: [-260, 245],
    right: [1220, 245],
  };
  manifest.cameraPrimitive.roomBasis = { verticalUnit: 24 };
  manifest.polygonizer.subject = 'square room seen while walking in from a centered door';
  manifest.polygonizer.pureMandala.room.floor = { x: [-14, 14], y: [8, -20], z: 0 };
  manifest.polygonizer.pureMandala.room.ceilingZ = 10;
  manifest.polygonizer.pureMandala.room.walls = { leftX: -14, rightX: 14, backY: -20 };
  manifest.polygonizer.pureMandala.pinnedElements = [
    { id: 'center-door-camera', role: 'figure', worldXYZ: [0, 8, 0], height: 6.2, visible: false, camera: true },
  ];
  return manifest;
}

function condoLivingRoomManifest() {
  const manifest = twoPointCenteredDoorSquareRoomManifest();
  manifest.title = 'Two-point condo living room from entry camera';
  manifest.polygonizer.subject = 'basic condo living room from centered entry';
  manifest.cameraPrimitive.constraint = 'condo-living-room-entry-eye';
  manifest.polygonizer.pureMandala.room.floor = { x: [-15, 15], y: [8, -22], z: 0 };
  manifest.polygonizer.pureMandala.room.ceilingZ = 9.5;
  manifest.polygonizer.pureMandala.room.walls = { leftX: -15, rightX: 15, backY: -22 };
  manifest.polygonizer.pureMandala.pinnedElements = [
    { id: 'entry-camera', role: 'figure', worldXYZ: [0, 8, 0], height: 6.2, visible: false, camera: true },
    { role: 'sofa', worldXYZ: [-6.2, -15.5, 0], sizeXYZ: [8.6, 3.2, 2.6] },
    { role: 'coffee-table', worldXYZ: [-1.2, -7, 0], sizeXYZ: [4.8, 2.5, 1.2] },
    { role: 'media-console', worldXYZ: [9.5, -15.8, 0], sizeXYZ: [6.8, 1.5, 2.1] },
    { role: 'side-table', worldXYZ: [-11.2, -11.8, 0], sizeXYZ: [2, 2, 1.7] },
    { role: 'ceiling-light', worldXYZ: [0, -8.5, 9.5], fromCeiling: true },
  ];
  return manifest;
}

function straightCondoLivingRoomManifest() {
  const manifest = condoLivingRoomManifest();
  manifest.title = 'Straight doorway condo living room';
  manifest.cameraPrimitive.cameraPoint.kind = 'doorway-straight-eye';
  manifest.cameraPrimitive.canonicalAngle = 'doorway-straight-room';
  manifest.cameraPrimitive.constraint = 'straight-entry-square-room';
  manifest.cameraPrimitive.cropBox = { x: 240, y: 120, width: 500, height: 430 };
  manifest.cameraPrimitive.straightFrame = {
    backWall: { left: 360, right: 620, top: 180, bottom: 360 },
    floorFront: { left: [160, 585], right: [820, 585] },
    ceilingFront: { left: [220, 90], right: [760, 90] },
  };
  manifest.polygonizer.subject = 'straight-on substantial square condo living room from doorway';
  manifest.polygonizer.pureMandala.pinnedElements = [
    { id: 'entry-camera', role: 'figure', worldXYZ: [0, 8, 0], height: 6.2, visible: false, camera: true },
    { role: 'rug', worldXYZ: [0, -6.5, 0], sizeXYZ: [9.5, 6, 0], fill: '#855f4a' },
    { role: 'coffee-table', worldXYZ: [0, -6.5, 0], sizeXYZ: [4.6, 2.4, 1.15], fill: '#7a5538' },
    { id: 'back-left-figure', role: 'figure', worldXYZ: [-8.5, -15.8, 0], height: 6.2, zOrder: 4.2 },
    { id: 'front-right-figure', role: 'figure', worldXYZ: [8.2, 2.5, 0], height: 6.2, zOrder: 7.2 },
    { role: 'sofa', worldXYZ: [-7, -16.5, 0], sizeXYZ: [8.4, 3.1, 2.5], fill: '#6d6f59' },
    { role: 'media-console', worldXYZ: [8.5, -17, 0], sizeXYZ: [6.4, 1.4, 2], fill: '#8b6642' },
    { role: 'ceiling-light', worldXYZ: [0, -8, 9.5], fromCeiling: true },
  ];
  return manifest;
}

function fullFrameRoomConceptManifest() {
  const manifest = straightCondoLivingRoomManifest();
  manifest.title = 'Full frame room concept through doorway camera';
  manifest.polygonizer.spatialPlanning = {
    mode: 'plan-before-skin',
    materializationGate: 'planning-valid',
    planningStages: [
      'room-concept',
      'camera-window',
      'cca-local-spaces',
      'hitboxes',
      'gravity',
      'shadow-receivers',
      'z-adjacency',
    ],
  };
  manifest.polygonizer.roomConcept = {
    kind: 'interior-room',
    localSpace: 'cca-local-space',
    normalization: 'project-after-planning',
    camera: {
      mode: 'predetermined-vector',
      primitive: 'two-point-straight-doorway',
      subjectFraming: 'full-frame-room',
    },
    placementSpace: {
      gravityAxis: 'camera-floor-depth',
      supportPlane: 'room:floor-plane',
      fullFrameBounds: 'room-envelope',
    },
    requiredRoles: ['sofa', 'coffee-table', 'media-console', 'front-right-figure'],
  };
  return manifest;
}

function personEyeBowlingRoomManifest() {
  const manifest = twoPointCenteredDoorSquareRoomManifest();
  manifest.title = 'Person-eye bowling room with bed and closet';
  manifest.cameraPrimitive.anchor = 'person-eye-camera';
  manifest.cameraPrimitive.cameraPoint = {
    kind: 'doorway-straight-eye',
    doorWall: 'front',
    doorCenter: [0, 8, 5.6],
    lookAt: [0, -7, 3.2],
  };
  manifest.cameraPrimitive.canonicalAngle = 'doorway-straight-room';
  manifest.cameraPrimitive.constraint = 'person-eye-full-room';
  manifest.cameraPrimitive.cropBox = { x: 240, y: 120, width: 500, height: 430 };
  manifest.cameraPrimitive.straightFrame = {
    backWall: { left: 360, right: 620, top: 180, bottom: 360 },
    floorFront: { left: [160, 585], right: [820, 585] },
    ceilingFront: { left: [220, 90], right: [760, 90] },
  };
  manifest.polygonizer.subject = 'person eye perspective of a bowling room with a bed and closet';
  manifest.polygonizer.spatialPlanning = {
    mode: 'plan-before-skin',
    materializationGate: 'planning-valid',
    planningStages: [
      'room-concept',
      'camera-window',
      'cca-local-spaces',
      'hitboxes',
      'gravity',
      'shadow-receivers',
      'z-adjacency',
    ],
  };
  manifest.polygonizer.roomConcept = {
    kind: 'interior-room',
    localSpace: 'cca-local-space',
    normalization: 'project-after-planning',
    camera: {
      mode: 'predetermined-vector',
      primitive: 'two-point-straight-doorway',
      subjectFraming: 'full-frame-room',
    },
    placementSpace: {
      gravityAxis: 'camera-floor-depth',
      supportPlane: 'room:floor-plane',
      fullFrameBounds: 'room-envelope',
    },
    requiredRoles: ['bed', 'closet'],
  };
  manifest.polygonizer.pureMandala.room.floor = { x: [-12, 12], y: [8, -19], z: 0 };
  manifest.polygonizer.pureMandala.room.ceilingZ = 9.5;
  manifest.polygonizer.pureMandala.room.walls = { leftX: -12, rightX: 12, backY: -19 };
  manifest.polygonizer.pureMandala.pinnedElements = [
    { id: 'person-eye-camera', role: 'figure', worldXYZ: [0, 8, 0], height: 6.2, visible: false, camera: true },
    { role: 'bed', worldXYZ: [-4.2, -9.5, 0], sizeXYZ: [7.4, 6.2, 2.15], fill: '#7b7183' },
    { role: 'closet', worldXYZ: [7.2, -15.6, 0], sizeXYZ: [5.6, 1.5, 7.3], fill: '#7c654f' },
    { role: 'ceiling-light', worldXYZ: [0, -7.8, 9.5], fromCeiling: true },
  ];
  return manifest;
}

function shotGlyphPersonEyeRoomManifest() {
  return {
    title: 'Shot glyph person-eye bedroom',
    viewBox: { width: 980, height: 620 },
    polygonizer: {
      subject: 'person-eye perspective room via shot glyph',
      spatialPlanning: {
        mode: 'plan-before-skin',
        materializationGate: 'planning-valid',
      },
      mandalaPatternLayer: {
        shotGlyph: {
          id: 'person-eye-room-window-light',
          roomConcept: {
            requiredRoles: ['bed', 'window'],
          },
        },
      },
      pureMandala: {
        kind: 'top-down-room-blockout',
        unit: 'dimensional',
        room: {
          floor: { x: [-12, 12], y: [8, -19], z: 0 },
          ceilingZ: 9.5,
          walls: { leftX: -12, rightX: 12, backY: -19 },
        },
        pinnedElements: [
          { id: 'person-eye-camera', role: 'figure', worldXYZ: [0, 8, 0], height: 6.2, visible: false, camera: true },
          { role: 'bed', worldXYZ: [-4, -8.5, 0], sizeXYZ: [7.5, 6.1, 2.1], fill: '#7b7183' },
          { id: 'window', role: 'wall-feature', worldXYZ: [4.8, -19, 4.4], spawnDirection: 'wall-out' },
          { role: 'ceiling-light', worldXYZ: [0, -7.8, 9.5], fromCeiling: true },
        ],
      },
    },
    scene: {
      palette: 'warm-low-key',
    },
    marks: [],
  };
}

function shotGlyphTabletopManifest() {
  return {
    title: 'Shot glyph tabletop proof',
    viewBox: { width: 360, height: 260 },
    polygonizer: {
      subject: 'tabletop shot via shot glyph',
      spatialPlanning: {
        mode: 'plan-before-skin',
      },
      mandalaPatternLayer: {
        shotGlyph: 'tabletop-three-quarter-key',
      },
    },
    scene: {
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'polygon',
        role: 'tabletop',
        points: [[38, 170], [322, 170], [350, 216], [10, 216]],
        fill: '#7d644c',
        stroke: '#30251c',
        z: 20,
      },
    ],
  };
}

function shotGlyphCornerEyeRoomManifest() {
  return {
    title: 'Shot glyph corner-eye bedroom',
    viewBox: { width: 980, height: 620 },
    polygonizer: {
      subject: 'corner-eye diagonal room shot via shot glyph',
      spatialPlanning: {
        mode: 'plan-before-skin',
        materializationGate: 'planning-valid',
      },
      mandalaPatternLayer: {
        shotGlyph: {
          id: 'corner-eye-room-diagonal-window-light',
          roomConcept: {
            requiredRoles: ['bed', 'window', 'side-table'],
          },
        },
      },
      pureMandala: {
        kind: 'top-down-room-blockout',
        unit: 'dimensional',
        room: {
          floor: { x: [-16, 16], y: [8, -26], z: 0 },
          ceilingZ: 10,
          walls: { leftX: -16, rightX: 16, backY: -26 },
        },
        pinnedElements: [
          { id: 'corner-eye-camera', role: 'figure', worldXYZ: [-14, 8, 0], height: 6.2, visible: false, camera: true },
          { role: 'bed', worldXYZ: [-6, -10.5, 0], sizeXYZ: [7.8, 6.2, 2.15], fill: '#7b7183' },
          { role: 'side-table', worldXYZ: [0.5, -8.4, 0], sizeXYZ: [2, 2, 1.6], fill: '#7a5538' },
          { id: 'window', role: 'wall-feature', worldXYZ: [13.8, -14, 4.6], spawnDirection: 'wall-out' },
          { role: 'ceiling-light', worldXYZ: [-3, -12, 10], fromCeiling: true },
        ],
      },
    },
    scene: {
      palette: 'warm-low-key',
    },
    marks: [],
  };
}

function schoolOfAthensGlyphManifest({ arbitrary = false } = {}) {
  return {
    title: arbitrary ? 'School glyph arbitrary subjects' : 'School of Athens civic hall glyph',
    viewBox: { width: 980, height: 620 },
    polygonizer: {
      subject: arbitrary
        ? 'central one point hall with arbitrary subject clusters'
        : 'school of athens central one point civic hall',
      spatialPlanning: {
        mode: 'plan-before-skin',
        materializationGate: 'planning-valid',
      },
      mandalaPatternLayer: {
        shotGlyph: 'school of athens',
      },
    },
    scene: {
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'visionPane',
        role: 'hall-floor',
        mode: 'civic-hall-floor',
        vanishingPoint: [490, 220],
        nearEdge: { left: [110, 570], right: [870, 570] },
        horizonBoundary: { y: 220, leftX: 430, rightX: 550 },
        fill: '#6f5c43',
        z: 8,
        features: { depthRows: 7, centerline: true },
      },
      {
        kind: 'polygon',
        role: 'back-arch-aperture',
        points: [[410, 320], [570, 320], [570, 184], [540, 142], [490, 124], [440, 142], [410, 184]],
        fill: '#2b2119',
        stroke: '#b99b68',
        strokeWidth: 2,
        z: 12,
      },
      {
        kind: 'line',
        role: 'axis-mundi-vertical',
        x1: 490,
        y1: 120,
        x2: 490,
        y2: 570,
        stroke: '#dbc28a',
        strokeWidth: 1.4,
        opacity: 0.42,
        z: 15,
      },
      {
        kind: 'line',
        role: 'axis-mundi-horizon',
        x1: 110,
        y1: 220,
        x2: 870,
        y2: 220,
        stroke: '#dbc28a',
        strokeWidth: 1.1,
        opacity: 0.3,
        z: 15,
      },
      {
        kind: 'circle',
        role: 'axis-mundi-asterisk',
        cx: 490,
        cy: 220,
        r: 5,
        fill: '#f1d28b',
        stroke: '#3e2b1d',
        strokeWidth: 1,
        z: 16,
      },
      {
        kind: 'solid',
        role: arbitrary ? 'central-orb-plinth' : 'central-thesis-plinth',
        x: 455,
        y: 360,
        width: 70,
        height: 46,
        depth: 48,
        fill: '#8b6642',
        z: 22,
      },
      {
        kind: 'array',
        role: arbitrary ? 'left-robots' : 'left-figures',
        count: 4,
        from: [205, 430],
        to: [365, 382],
        item: { kind: 'solid', width: 26, height: 64, depth: 28, fill: arbitrary ? '#6d7c74' : '#8f694c' },
        z: 24,
      },
      {
        kind: 'array',
        role: arbitrary ? 'right-fruit-statues' : 'right-figures',
        count: 4,
        from: [620, 382],
        to: [780, 430],
        item: { kind: 'solid', width: 26, height: 64, depth: 28, fill: arbitrary ? '#9a7753' : '#7b7183' },
        z: 24,
      },
    ],
  };
}

function dot([ax, ay], [bx, by]) {
  return ax * bx + ay * by;
}

function cross([ax, ay], [bx, by]) {
  return ax * by - ay * bx;
}

function distance([ax, ay], [bx, by]) {
  return Math.hypot(ax - bx, ay - by);
}

function normalize([x, y]) {
  const len = Math.hypot(x, y);
  return len < 1e-9 ? [0, -1] : [x / len, y / len];
}

function projectionMax(points, axis) {
  return Math.max(...points.map((p) => dot(axis, p)));
}

function projectionMin(points, axis) {
  return Math.min(...points.map((p) => dot(axis, p)));
}

describe('expandNeoRembrandt', () => {
  it('keeps highlights as a separate optional pass', () => {
    const shadowOnly = expandNeoRembrandt(p0Manifest(), { includeHighlights: false });
    const withHighlights = expandNeoRembrandt(p0Manifest(), { includeHighlights: true });

    expect(shadowOnly.neoRembrandt.expanded).toBe(true);
    expect(shadowOnly.marks.some((m) => m.algorithm === 'convex-value-stack')).toBe(true);
    expect(shadowOnly.marks.some((m) => m.algorithm === 'simple-highlight')).toBe(false);
    expect(shadowOnly.marks.find((m) => m.source)?.stroke).toBe('none');

    expect(withHighlights.marks.some((m) => m.algorithm === 'convex-value-stack')).toBe(true);
    expect(withHighlights.marks.some((m) => m.algorithm === 'simple-highlight')).toBe(true);
    expect(withHighlights.marks.filter((m) => m.algorithm === 'simple-highlight').length).toBeGreaterThan(1);
    expect(withHighlights.marks.some((m) => /terminator/.test(m.role || ''))).toBe(false);
    expect(JSON.stringify(expandNeoRembrandt(p0Manifest()))).toBe(JSON.stringify(expandNeoRembrandt(p0Manifest())));
  });

  it('expands compact blobs into concrete polygons with form-light-stack stickers', () => {
    const expanded = expandNeoRembrandt(blobFieldManifest());
    const sources = expanded.marks.filter((m) => m.source);

    expect(sources).toHaveLength(2);
    expect(sources.every((m) => m.kind === 'polygon')).toBe(true);
    expect(sources.every((m) => m.sourceShape === 'blob')).toBe(true);
    expect(sources.every((m) => m.stroke === 'none')).toBe(true);
    expect(expanded.marks.filter((m) => m.pass === 'shadow' && m.blobRole === 'top-left')).toHaveLength(6);
    expect(expanded.marks.filter((m) => m.pass === 'highlight' && m.blobRole === 'bottom-right')).toHaveLength(4);
    expect(JSON.stringify(expandNeoRembrandt(blobFieldManifest()))).toBe(
      JSON.stringify(expandNeoRembrandt(blobFieldManifest())),
    );
  });

  it('uses the eye line to assign blob z order', () => {
    const upperLeftView = expandNeoRembrandt(blobFieldManifest([-1, -1]));
    const lowerRightView = expandNeoRembrandt(blobFieldManifest([1, 1]));

    const upperLeftSources = upperLeftView.marks.filter((m) => m.source);
    const lowerRightSources = lowerRightView.marks.filter((m) => m.source);
    const topLeftUpper = upperLeftSources.find((m) => m.role === 'top-left');
    const bottomRightUpper = upperLeftSources.find((m) => m.role === 'bottom-right');
    const topLeftLower = lowerRightSources.find((m) => m.role === 'top-left');
    const bottomRightLower = lowerRightSources.find((m) => m.role === 'bottom-right');

    expect(topLeftUpper.z).toBeGreaterThan(bottomRightUpper.z);
    expect(bottomRightLower.z).toBeGreaterThan(topLeftLower.z);
  });

  it('casts receiver-clipped shadows from adjacent higher-z blobs that are closer to light', () => {
    const expanded = expandNeoRembrandt(adjacentBlobManifest());
    const sources = expanded.marks.filter((m) => m.source);
    const caster = sources.find((m) => m.role === 'top-left');
    const receiver = sources.find((m) => m.role === 'bottom-right');
    const cast = expanded.marks.find((m) => m.pass === 'inter-blob-shadow');

    expect(cast).toBeTruthy();
    expect(cast.casterBlobRole).toBe('top-left');
    expect(cast.receiverBlobRole).toBe('bottom-right');
    expect(cast.z).toBeGreaterThan(receiver.z);
    expect(cast.z).toBeLessThan(caster.z);

    const axis = normalize([1, 1]);
    expect(projectionMin(cast.points, axis)).toBeGreaterThanOrEqual(projectionMin(receiver.points, axis) - 0.01);
    expect(projectionMax(cast.points, axis)).toBeLessThanOrEqual(projectionMax(receiver.points, axis) + 0.01);
  });

  it('can disable inter-blob cast shadows at scene level', () => {
    const manifest = blobFieldManifest([-1, -1]);
    manifest.scene.interBlobShadows = false;
    const expanded = expandNeoRembrandt(manifest);

    expect(expanded.marks.some((m) => m.pass === 'inter-blob-shadow')).toBe(false);
  });

  it('resolves gestureT into concrete blob anchors before polygon expansion', () => {
    const expanded = expandNeoRembrandt(gestureManifest());
    const sources = expanded.marks.filter((m) => m.source);
    const head = sources.find((m) => m.role === 'head');
    const chest = sources.find((m) => m.role === 'chest');

    expect(expanded.neoRembrandt.gestureResolved).toBe(true);
    expect(head.kind).toBe('polygon');
    expect(head.depthAnchor).toEqual([220, 80]);
    expect(head.gestureResolved).toBe(true);
    expect(chest.depthAnchor).toEqual([200, 160]);
    expect(chest.gesturePoint).toEqual([220, 150]);
    expect(chest.gestureTangent).toEqual([0, 1]);
    expect(chest.gestureRotation).toBe(0);
    expect(chest.gestureRotationSource).toBe('tangent');
  });

  it('keeps explicit blob rotation while still resolving gesture anchors', () => {
    const expanded = expandNeoRembrandt(gestureManifest());
    const pelvis = expanded.marks.find((m) => m.source && m.role === 'pelvis');

    expect(pelvis.depthAnchor).toEqual([220, 248]);
    expect(pelvis.gestureRotation).toBe(0);
    expect(pelvis.gestureRotationSource).toBe('explicit');
  });

  it('keeps eye-line z sorting after gesture resolution', () => {
    const expanded = expandNeoRembrandt(gestureManifest());
    const head = expanded.marks.find((m) => m.source && m.role === 'head');
    const pelvis = expanded.marks.find((m) => m.source && m.role === 'pelvis');

    expect(head.z).toBeGreaterThan(pelvis.z);
  });

  it('generates a dynamic skeleton from main and cross gestures with joint mediation', () => {
    const expanded = expandNeoRembrandt(dynamicSkeletonGestureManifest());
    const skeleton = expanded.marks.filter((m) => m.source && m.dynamicSkeleton);
    const joints = skeleton.filter((m) => m.formPart === 'joint');
    const connections = skeleton.filter((m) => m.dynamicSkeletonConnection);
    const elbow = skeleton.find((m) => m.dynamicSkeletonRole === 'active-elbow');
    const hand = skeleton.find((m) => m.dynamicSkeletonRole === 'active-hand');
    const torso = skeleton.find((m) => m.dynamicSkeletonRole === 'torso-center');
    const upperArm = connections.find((m) => m.dynamicSkeletonRole === 'active-upper-arm');

    expect(expanded.neoRembrandt.dynamicSkeletonGenerated).toBe(true);
    expect(expanded.neoRembrandt.dynamicSkeletonMarkCount).toBe(9);
    expect(joints).toHaveLength(3);
    expect(connections).toHaveLength(3);
    expect(elbow.sourceShape).toBe('sphere');
    expect(elbow.dynamicSkeletonAxis).toBe('cross');
    expect(elbow.jointPlacement).toBe('between-segments');
    expect(hand.z).toBeGreaterThan(torso.z);
    expect(upperArm.connects).toEqual(['active-shoulder', 'active-elbow']);
    expect(upperArm.terminatesIntoJoints).toBe(true);
    expect(upperArm.jointMediated).toBe(true);
  });

  it('expands a bookshelf object into concrete wireframe marks', () => {
    const expanded = expandNeoRembrandt(bookshelfManifest());

    expect(expanded.marks.some((m) => m.kind === 'object')).toBe(false);
    expect(expanded.marks.some((m) => m.role === 'study-shelf:front-frame')).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'study-shelf:back-frame')).toBe(true);
    expect(expanded.marks.filter((m) => /shelf-front/.test(m.role || ''))).toHaveLength(3);
    expect(expanded.marks.filter((m) => /divider-/.test(m.role || ''))).toHaveLength(1);
    expect(expanded.marks.filter((m) => /book-/.test(m.role || '')).length).toBeGreaterThan(8);
    expect(expanded.marks.every((m) => m.sourceShape === 'object')).toBe(true);
    expect(expanded.neoRembrandt.expandedSourceMarkCount).toBeGreaterThan(1);
  });

  it('expands a bookshelf plane preset into filled plane polygons', () => {
    const expanded = expandNeoRembrandt(bookshelfPlaneManifest());

    expect(expanded.marks.some((m) => m.kind === 'planePreset')).toBe(false);
    expect(expanded.marks.some((m) => m.kind === 'line')).toBe(false);
    expect(expanded.marks.every((m) => m.kind === 'polygon')).toBe(true);
    expect(expanded.marks.every((m) => m.sourceShape === 'plane')).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'study-shelf:left-wall-front')).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'study-shelf:left-wall-depth')).toBe(true);
    expect(expanded.marks.filter((m) => /shelf-\d+-top/.test(m.role || ''))).toHaveLength(5);
    expect(expanded.marks.filter((m) => /shelf-\d+-front/.test(m.role || ''))).toHaveLength(5);
    expect(expanded.marks.filter((m) => /book-/.test(m.role || '')).length).toBeGreaterThan(12);
    expect(expanded.marks.find((m) => m.role === 'study-shelf:back-plane').z).toBeLessThan(
      expanded.marks.find((m) => m.role === 'study-shelf:left-wall-front').z,
    );
  });

  it('expands a bookshelf solid preset into projected lit plane faces', () => {
    const expanded = expandNeoRembrandt(bookshelfSolidManifest());
    const sourceFaces = expanded.marks.filter((m) => m.source);

    expect(expanded.marks.some((m) => m.kind === 'solidPreset')).toBe(false);
    expect(expanded.marks.some((m) => m.kind === 'line')).toBe(false);
    expect(sourceFaces.every((m) => m.kind === 'polygon')).toBe(true);
    expect(sourceFaces.every((m) => m.sourceShape === 'plane')).toBe(true);
    expect(sourceFaces.every((m) => m.formFamily === 'vector')).toBe(true);
    expect(sourceFaces.every((m) => m.vectorKind === 'solid-face')).toBe(true);
    expect(sourceFaces.some((m) => m.role === 'study-shelf:shelf-1:top')).toBe(true);
    expect(sourceFaces.some((m) => m.role === 'study-shelf:shelf-1:front')).toBe(true);
    expect(sourceFaces.some((m) => m.role === 'study-shelf:left-wall:left')).toBe(true);
    expect(sourceFaces.filter((m) => /book-/.test(m.role || '')).length).toBeGreaterThan(24);

    const shelfFront = sourceFaces.find((m) => m.role === 'study-shelf:shelf-1:front');
    const shelfBack = sourceFaces.find((m) => m.role === 'study-shelf:shelf-1:back');
    const shelfTop = sourceFaces.find((m) => m.role === 'study-shelf:shelf-1:top');

    expect(shelfFront.z).toBeGreaterThan(shelfBack.z);
    expect(shelfFront.planeDepth).toBeGreaterThan(shelfBack.planeDepth);
    expect(shelfTop.faceLight).toBeGreaterThan(0);
    expect(new Set(sourceFaces.map((m) => m.fill)).size).toBeGreaterThan(3);
  });

  it('locks solid depth edges to a one-point vanishing frame when provided', () => {
    const expanded = expandNeoRembrandt(bookshelfVanishingManifest());
    const shelfTop = expanded.marks.find((m) => m.source && m.role === 'study-shelf:shelf-1:top');
    const vp = expanded.scene.perspective.vanishingPoint;

    expect(shelfTop.perspectiveMode).toBe('one-point');
    expect(shelfTop.vanishingPoint).toEqual(vp);

    const backLeft = shelfTop.points[0];
    const frontLeft = shelfTop.points[3];
    const toBack = [backLeft[0] - frontLeft[0], backLeft[1] - frontLeft[1]];
    const toVp = [vp[0] - frontLeft[0], vp[1] - frontLeft[1]];

    expect(Math.abs(cross(toBack, toVp))).toBeLessThan(1);
  });

  it('expands generic solids for a table and laptop under a shared perspective frame', () => {
    const expanded = expandNeoRembrandt(tableLaptopManifest());
    const sources = expanded.marks.filter((m) => m.source);
    const tabletopTop = sources.find((m) => m.role === 'tabletop:top');
    const laptopScreen = sources.find((m) => m.role === 'laptop-screen:front');

    expect(expanded.marks.some((m) => m.kind === 'solid')).toBe(false);
    expect(sources.every((m) => m.kind === 'polygon')).toBe(true);
    expect(sources.every((m) => m.sourceShape === 'plane')).toBe(true);
    expect(sources.every((m) => m.formFamily === 'vector')).toBe(true);
    expect(sources.every((m) => m.perspectiveMode === 'one-point')).toBe(true);
    expect(tabletopTop.solidKind).toBe('solid');
    expect(laptopScreen.z).toBeGreaterThan(tabletopTop.z);

    const vp = expanded.scene.perspective.vanishingPoint;
    const backLeft = tabletopTop.points[0];
    const frontLeft = tabletopTop.points[3];
    expect(Math.abs(cross([backLeft[0] - frontLeft[0], backLeft[1] - frontLeft[1]], [vp[0] - frontLeft[0], vp[1] - frontLeft[1]]))).toBeLessThan(1);
  });

  it('can hide construction-only back faces on generic vector solids', () => {
    const manifest = tableLaptopManifest();
    manifest.marks = manifest.marks.map((mark) => (
      mark.kind === 'solid' ? { ...mark, faceCull: 'hide-back' } : mark
    ));
    const expanded = expandNeoRembrandt(manifest);
    const sources = expanded.marks.filter((mark) => mark.source && mark.solidKind === 'solid');
    const facesByRole = new Map();
    for (const face of sources) {
      const names = facesByRole.get(face.solidRole) || new Set();
      names.add(face.face);
      facesByRole.set(face.solidRole, names);
    }

    expect(sources.every((mark) => mark.formFamily === 'vector')).toBe(true);
    expect(sources.every((mark) => mark.vectorFacePolicy === 'solve-complete-render-visible')).toBe(true);
    expect(sources.every((mark) => mark.faceCull === 'hide-back')).toBe(true);
    expect([...facesByRole.values()].every((faces) => !faces.has('back'))).toBe(true);
    expect([...facesByRole.values()].every((faces) => faces.has('front'))).toBe(true);
    expect([...facesByRole.values()].every((faces) => faces.has('top'))).toBe(true);
  });

  it('skins mandala-fractal facade motifs onto a solved visible face', () => {
    const expanded = expandNeoRembrandt(apartmentFacePatternManifest());
    const details = expanded.marks.filter((mark) => mark.faceAttachment?.patternRole === 'apartment-front-miniatures');
    const windows = details.filter((mark) => mark.faceAttachment?.motif === 'french-window');
    const balcony = details.filter((mark) => mark.faceAttachment?.motif === 'balcony');
    const stairwell = details.filter((mark) => mark.faceAttachment?.motif === 'stairwell');
    const cornice = details.filter((mark) => mark.faceAttachment?.motif === 'cornice');

    expect(expanded.marks.some((mark) => mark.kind === 'facePattern')).toBe(false);
    expect(details.length).toBeGreaterThan(24);
    expect(details.every((mark) => ['polygon', 'polyline', 'line'].includes(mark.kind))).toBe(true);
    expect(details.every((mark) => mark.sourceShape === 'face-detail')).toBe(true);
    expect(details.every((mark) => mark.faceAttachment.solidRole === 'apartment-block')).toBe(true);
    expect(details.every((mark) => mark.faceAttachment.face === 'front')).toBe(true);
    expect(windows.some((mark) => /center-mullion/.test(mark.role))).toBe(true);
    expect(balcony.some((mark) => /rail/.test(mark.role))).toBe(true);
    expect(balcony.some((mark) => /baluster/.test(mark.role))).toBe(true);
    expect(stairwell.some((mark) => /switchback/.test(mark.role))).toBe(true);
    expect(cornice.some((mark) => /undershadow/.test(mark.role))).toBe(true);
  });

  it('does not render face-pattern doodads when the target face is culled', () => {
    const expanded = expandNeoRembrandt(apartmentFacePatternManifest({ targetFace: 'back' }));

    expect(expanded.marks.some((mark) => mark.kind === 'facePattern')).toBe(false);
    expect(expanded.marks.some((mark) => mark.faceAttachment?.patternRole === 'apartment-front-miniatures')).toBe(false);
    expect(expanded.marks.some((mark) => mark.solidRole === 'apartment-block' && mark.face === 'back')).toBe(false);
  });

  it('projects face-pattern doodads through the parent face perspective', () => {
    const flat = expandNeoRembrandt(apartmentFacePatternManifest({ perspective: false }));
    const projected = expandNeoRembrandt(apartmentFacePatternManifest({ perspective: true }));
    const flatWindow = flat.marks.find((mark) => mark.role === 'apartment-block:front:french-window-1-1:dark-glass');
    const projectedWindow = projected.marks.find((mark) => mark.role === 'apartment-block:front:french-window-1-1:dark-glass');
    const maxPointShift = Math.max(...flatWindow.points.map((point, index) => (
      Math.hypot(point[0] - projectedWindow.points[index][0], point[1] - projectedWindow.points[index][1])
    )));

    expect(flatWindow.faceAttachment.uvBox).toEqual(projectedWindow.faceAttachment.uvBox);
    expect(projectedWindow.points).not.toEqual(flatWindow.points);
    expect(maxPointShift).toBeGreaterThan(1);
  });

  it('skins shared manji level repeaters with per-building meru stack counts', () => {
    const expanded = expandNeoRembrandt(sharedManjiLevelRepeaterManifest());
    const details = expanded.marks.filter((mark) => mark.faceAttachment?.patternRole === 'shared-apartment-rhythm');
    const towerFaces = expanded.marks.filter((mark) => ['tower-a', 'tower-b'].includes(mark.solidRole));
    const towerATop = towerFaces.find((mark) => mark.solidRole === 'tower-a' && mark.face === 'top');
    const towerAFront = towerFaces.find((mark) => mark.solidRole === 'tower-a' && mark.face === 'front');
    const towerARight = towerFaces.find((mark) => mark.solidRole === 'tower-a' && mark.face === 'right');
    const towerBTop = towerFaces.find((mark) => mark.solidRole === 'tower-b' && mark.face === 'top');
    const towerBFront = towerFaces.find((mark) => mark.solidRole === 'tower-b' && mark.face === 'front');
    const towerBRight = towerFaces.find((mark) => mark.solidRole === 'tower-b' && mark.face === 'right');
    const towerA = details.filter((mark) => mark.faceAttachment?.solidRole === 'tower-a');
    const towerB = details.filter((mark) => mark.faceAttachment?.solidRole === 'tower-b');
    const towerAWindows = towerA.filter((mark) => mark.faceAttachment?.motif === 'french-window' && /:dark-glass$/.test(mark.role));
    const towerBWindows = towerB.filter((mark) => mark.faceAttachment?.motif === 'french-window' && /:dark-glass$/.test(mark.role));
    const towerABalconies = towerA.filter((mark) => mark.faceAttachment?.motif === 'balcony' && /:slab$/.test(mark.role));
    const towerBBalconies = towerB.filter((mark) => mark.faceAttachment?.motif === 'balcony' && /:slab$/.test(mark.role));

    expect(expanded.marks.some((mark) => mark.kind === 'facePattern')).toBe(false);
    expect(towerFaces.some((mark) => mark.face === 'top')).toBe(true);
    expect(towerFaces.some((mark) => mark.face === 'bottom')).toBe(false);
    expect(towerFaces.every((mark) => mark.faceCull === 'hide-back-bottom')).toBe(true);
    expect(towerFaces.every((mark) => mark.hiddenConstructionFaces.includes('bottom'))).toBe(true);
    expect(towerFaces.every((mark) => mark.solidOrientationFrame === 'nadir-zenith')).toBe(true);
    expect(towerFaces.every((mark) => mark.solidBottomFaceOrientation === 'nadir')).toBe(true);
    expect(towerFaces.every((mark) => mark.solidTopFaceOrientation === 'zenith')).toBe(true);
    expect(towerFaces.every((mark) => mark.solidCapVisibility === 'zenith-visible')).toBe(true);
    expect(towerAFront.points[0]).toEqual(towerATop.points[0]);
    expect(towerAFront.points[1]).toEqual(towerATop.points[1]);
    expect(towerBFront.points[0]).toEqual(towerBTop.points[0]);
    expect(towerBFront.points[1]).toEqual(towerBTop.points[1]);
    expect(towerAFront.z).toBeGreaterThan(towerARight.z);
    expect(towerAFront.z).toBeGreaterThan(towerATop.z);
    expect(towerBFront.z).toBeGreaterThan(towerBRight.z);
    expect(towerBFront.z).toBeGreaterThan(towerBTop.z);
    expect(towerAWindows).toHaveLength(12);
    expect(towerBWindows).toHaveLength(20);
    expect(towerABalconies).toHaveLength(6);
    expect(towerBBalconies).toHaveLength(10);
    expect(details.every((mark) => mark.facePatternBasis === 'manjiLevelRepeater')).toBe(true);
    expect(details.every((mark) => mark.manjiPatternRef === 'window-window-balcony')).toBe(true);
    expect(new Set(towerA.map((mark) => mark.manjiYStacks))).toEqual(new Set([3]));
    expect(new Set(towerB.map((mark) => mark.manjiYStacks))).toEqual(new Set([5]));
  });

  it('uses horizon-relative cap visibility for nadir-anchored solids in one-point perspective', () => {
    const expanded = expandNeoRembrandt({
      title: 'Eye-relative standing caps',
      viewBox: { width: 420, height: 320 },
      scene: {
        view: { direction: [-0.45, -0.35], baseZ: 10 },
        perspective: { mode: 'one-point', horizonY: 150, vanishingPoint: [210, 150], depthScale: 260 },
      },
      marks: [
        { kind: 'solid', role: 'low-tower', x: 72, y: 180, width: 92, height: 76, depth: 40, standing: true },
        { kind: 'solid', role: 'high-tower', x: 238, y: 42, width: 92, height: 76, depth: 40, standing: true },
      ],
    });
    const lowFaces = expanded.marks.filter((mark) => mark.solidRole === 'low-tower');
    const highFaces = expanded.marks.filter((mark) => mark.solidRole === 'high-tower');

    expect(lowFaces.some((mark) => mark.face === 'top')).toBe(true);
    expect(lowFaces.some((mark) => mark.face === 'bottom')).toBe(false);
    expect(highFaces.some((mark) => mark.face === 'top')).toBe(false);
    expect(highFaces.some((mark) => mark.face === 'bottom')).toBe(false);
    expect(lowFaces.every((mark) => mark.solidCapVisibility === 'eye-relative')).toBe(true);
    expect(highFaces.every((mark) => mark.solidCapVisibility === 'eye-relative')).toBe(true);
  });

  it('expands a cup volume into a hollow tapered ring stack', () => {
    const expanded = expandNeoRembrandt(cupVolumeManifest());
    const ringMarks = expanded.marks.filter((mark) => mark.volumeRole === 'cup' && /:ring-/.test(mark.role || ''));
    const outerRings = ringMarks.filter((mark) => mark.volumeSurface === 'outer-ring');
    const innerRings = ringMarks.filter((mark) => mark.volumeSurface === 'inner-ring');
    const firstOuter = outerRings.find((mark) => mark.volumeRingIndex === 0);
    const lastOuter = outerRings.find((mark) => mark.volumeRingIndex === 11);
    const firstInner = innerRings.find((mark) => mark.volumeRingIndex === 0);

    expect(expanded.marks.some((mark) => mark.kind === 'volume')).toBe(false);
    expect(outerRings).toHaveLength(12);
    expect(innerRings).toHaveLength(12);
    expect(new Set(ringMarks.map((mark) => mark.volumeRingIndex)).size).toBe(12);
    expect(firstOuter.ring.outerRx).toBeGreaterThan(lastOuter.ring.outerRx);
    expect(firstInner.ring.innerRx).toBe(firstOuter.ring.outerRx - 10);
    expect(expanded.marks.some((mark) => mark.role === 'cup:rim-band')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'cup:foot-band')).toBe(true);
    expect(expanded.marks.filter((mark) => /contour$/.test(mark.role || ''))).toHaveLength(2);
  });

  it('compiles an animated biped form primitive through volumizer body grammar', () => {
    const expanded = expandNeoRembrandt(animatedBipedFormManifest('stocky'));
    const torsoRings = expanded.marks.filter((mark) => mark.volumeRole === 'hero:torso' && mark.volumeSurface === 'outer-ring');
    const head = expanded.marks.find((mark) => mark.role === 'hero:head');
    const limbs = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'hero' && mark.formPart === 'limb');
    const joints = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'hero' && mark.formPart === 'joint');
    const firstRing = torsoRings.find((mark) => mark.volumeRingIndex === 0);
    const lastRing = torsoRings.find((mark) => mark.volumeRingIndex === 9);

    expect(expanded.marks.some((mark) => mark.kind === 'form')).toBe(false);
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(torsoRings).toHaveLength(10);
    expect(firstRing.ring.outerRx).toBeGreaterThan(lastRing.ring.outerRx);
    expect(head?.kind).toBe('polygon');
    expect(limbs).toHaveLength(4);
    expect(joints).toHaveLength(5);
    expect(joints.every((mark) => mark.jointVisible === true)).toBe(true);
  });

  it('lets mass tuning change the animated biped torso volume', () => {
    const lean = expandNeoRembrandt(animatedBipedFormManifest('lean'));
    const stocky = expandNeoRembrandt(animatedBipedFormManifest('stocky'));
    const leanTorso = lean.marks.find((mark) => mark.volumeRole === 'hero:torso' && mark.volumeSurface === 'outer-ring' && mark.volumeRingIndex === 0);
    const stockyTorso = stocky.marks.find((mark) => mark.volumeRole === 'hero:torso' && mark.volumeSurface === 'outer-ring' && mark.volumeRingIndex === 0);

    expect(stockyTorso.ring.outerRx).toBeGreaterThan(leanTorso.ring.outerRx);
  });

  it('expands a lower-body form dummy into joint-mediated pelvis and legs', () => {
    const expanded = expandNeoRembrandt(lowerBodyDummyFormManifest());
    const dummy = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'pose-dummy');
    const joints = dummy.filter((mark) => mark.formPart === 'joint');
    const limbs = dummy.filter((mark) => mark.formPart === 'limb');
    const pelvis = dummy.find((mark) => mark.role === 'pose-dummy:pelvis');
    const leftKnee = dummy.find((mark) => mark.role === 'pose-dummy:left-knee-joint');
    const leftUpperLeg = dummy.find((mark) => mark.role === 'pose-dummy:left-upper-leg');

    expect(expanded.marks.some((mark) => mark.kind === 'form')).toBe(false);
    expect(pelvis).toMatchObject({ kind: 'polygon', formPart: 'pelvis', formDummyPrimitive: true });
    expect(joints).toHaveLength(6);
    expect(limbs).toHaveLength(4);
    expect(leftKnee.jointPlacement).toBe('between-segments');
    expect(leftKnee.jointConnects).toEqual(['left-upper-leg', 'left-lower-leg']);
    expect(leftUpperLeg.terminatesIntoJoints).toBe(true);
    expect(leftUpperLeg.jointMediated).toBe(true);
    expect(dummy.every((mark) => mark.formDummyJointsStick === true)).toBe(true);
  });

  it('expands a full-body form dummy with head, torso, arms, pelvis, and legs', () => {
    const expanded = expandNeoRembrandt(fullBodyDummyFormManifest());
    const dummy = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'full-dummy');
    const head = dummy.find((mark) => mark.role === 'full-dummy:head');
    const torso = dummy.find((mark) => mark.role === 'full-dummy:torso');
    const pelvis = dummy.find((mark) => mark.role === 'full-dummy:pelvis');
    const joints = dummy.filter((mark) => mark.formPart === 'joint');
    const limbs = dummy.filter((mark) => mark.formPart === 'limb');
    const coreSpan = dummy.find((mark) => mark.role === 'full-dummy:torso-carry');
    const rightForearm = dummy.find((mark) => mark.role === 'full-dummy:right-forearm');

    expect(expanded.marks.some((mark) => mark.kind === 'form')).toBe(false);
    expect(head).toMatchObject({ sourceShape: 'egg', formPart: 'head', formDummyPrimitive: true });
    expect(torso).toMatchObject({ sourceShape: 'blob', formPart: 'torso' });
    expect(pelvis).toMatchObject({ sourceShape: 'blob', formPart: 'pelvis' });
    expect(joints).toHaveLength(13);
    expect(limbs).toHaveLength(8);
    expect(coreSpan).toMatchObject({ formPart: 'core-span', jointMediated: true });
    expect(rightForearm.jointMediated).toBe(true);
    expect(dummy.every((mark) => mark.formDummyJointsStick === true)).toBe(true);
  });

  it('authors forms through a flat eye-level constellation by default', () => {
    const expanded = expandNeoRembrandt(fullBodyDummyFormManifest());
    const constellation = expanded.polygonizer.constellation;
    const dummy = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'full-dummy');

    expect(expanded.neoRembrandt.formConstellationAuthored).toBe(true);
    expect(constellation.kind).toBe('cca-constellation-grid');
    expect(constellation.flatEyeLevel).toBe(true);
    expect(constellation.nodes.some((node) => node.role === 'full-dummy' && node.formConstellation)).toBe(true);
    expect(dummy.every((mark) => mark.constellationRole === 'full-dummy')).toBe(true);
    expect(new Set(dummy.map((mark) => mark.constellationFit))).toEqual(new Set(['inside']));
  });

  it('generates local top-down mandalas for constellation-authored elements', () => {
    const manifest = fullBodyDummyFormManifest();
    manifest.polygonizer = {
      subject: 'full body dummy element mandala',
      impactPoint: [230, 250],
      elements: [
        { role: 'full-dummy', importance: 'primary', footprint: 'center figure', depthBand: 'midground', blockingNeeded: 'form-dummy' },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const elementMandala = expanded.polygonizer.elementMandala;
    const dummySpace = elementMandala.elements.find((element) => element.role === 'full-dummy');

    expect(expanded.neoRembrandt.elementMandalaGenerated).toBe(true);
    expect(elementMandala.kind).toBe('generated-element-mandala');
    expect(dummySpace.boundTo.role).toBe('full-dummy');
    expect(dummySpace.topDown.kind).toBe('local-top-down-math-space');
    expect(dummySpace.projection.localToOverall).toBe('shared-meru-unit-scale');
  });

  it('proves inventory maps to one vertical constellation atom before element mandalas', () => {
    const expanded = expandNeoRembrandt(inventoryAtomMandalaManifest());
    const elementMandala = expanded.polygonizer.elementMandala;
    const atoms = elementMandala.inventoryAtoms;
    const spaces = elementMandala.elements;

    expect(expanded.neoRembrandt.elementMandalaGenerated).toBe(true);
    expect(atoms).toHaveLength(4);
    expect(spaces).toHaveLength(4);
    expect(atoms.map((atom) => atom.role)).toEqual([
      'server-cabinet-1',
      'server-cabinet-2',
      'server-cabinet-3',
      'server-cabinet-4',
    ]);
    expect(new Set(atoms.map((atom) => atom.boundTo.role)).size).toBe(4);
    expect(new Set(spaces.map((space) => space.topDown.camera.screenOrigin.join(','))).size).toBe(4);
    expect(atoms.map((atom) => atom.verticalMap.anchorY)).toEqual([500, 412, 324, 236]);
    expect(atoms.every((atom) => atom.verticalMap.kind === 'constellation-node-vertical-mapping')).toBe(true);
    expect(spaces.every((space) => space.inventoryAtom.kind === 'one-atom-per-inventory-element')).toBe(true);
  });

  it('keeps datacenter CCA solids bound to one cabinet atom each', () => {
    const expanded = expandNeoRembrandt(datacenterInventoryAtomManifest());
    const elementMandala = expanded.polygonizer.elementMandala;
    const atoms = elementMandala.inventoryAtoms;
    const faces = expanded.marks.filter((mark) => mark.solidKind === 'solid' && mark.ccaSkinSource === 'xyz-element-mandala');
    const frontFaces = faces.filter((mark) => mark.role.endsWith(':front'));
    const anchors = frontFaces.map((mark) => mark.depthAnchor.join(','));
    const leftFront = frontFaces.find((mark) => mark.solidRole === 'left-server-cabinet-1');
    const rightFront = frontFaces.find((mark) => mark.solidRole === 'right-server-cabinet-1');
    const leftBack = faces.find((mark) => mark.role === 'left-server-cabinet-1:back');
    const rightBack = faces.find((mark) => mark.role === 'right-server-cabinet-1:back');
    const leftTop = faces.find((mark) => mark.role === 'left-server-cabinet-1:top');

    expect(expanded.neoRembrandt.elementMandalaGenerated).toBe(true);
    expect(atoms).toHaveLength(6);
    expect(new Set(atoms.map((atom) => atom.boundTo.role)).size).toBe(6);
    expect(new Set(elementMandala.elements.map((space) => space.topDown.camera.screenOrigin.join(','))).size).toBe(6);
    expect(frontFaces).toHaveLength(6);
    expect(new Set(frontFaces.map((mark) => mark.solidRole)).size).toBe(6);
    expect(new Set(anchors).size).toBe(6);
    expect(frontFaces.every((mark) => mark.ccaBlock === true)).toBe(true);
    expect(frontFaces.every((mark) => mark.ccaSizeXYZ.join(',') === '6,12,12')).toBe(true);
    expect(frontFaces.every((mark) => mark.solidDepthAnchor === 'far')).toBe(true);
    expect(frontFaces.every((mark) => mark.solidProjectionMode === 'perspective-corner')).toBe(true);
    expect(leftFront.points[1][0] - leftFront.points[0][0]).toBeGreaterThan(100);
    expect(leftFront.perspectiveMode).toBe('perspective-corner-projection');
    expect(leftFront.cornerPerspectiveStrength).toBeGreaterThan(0);
    expect(leftTop.points[2][1]).toBeGreaterThan(leftTop.points[1][1]);
    expect(leftTop.points[2][0] - leftTop.points[3][0]).toBeGreaterThan(leftTop.points[1][0] - leftTop.points[0][0]);
    expect(leftFront.solidDepthProjection[0]).toBeLessThan(0);
    expect(leftFront.solidDepthProjection[1]).toBeGreaterThan(0);
    expect(rightFront.solidDepthProjection[0]).toBeGreaterThan(0);
    expect(rightFront.solidDepthProjection[1]).toBeGreaterThan(0);
    expect(leftFront.depthAnchor[0]).toBeLessThan(leftBack.depthAnchor[0]);
    expect(leftFront.depthAnchor[1]).toBeGreaterThan(leftBack.depthAnchor[1]);
    expect(rightFront.depthAnchor[0]).toBeGreaterThan(rightBack.depthAnchor[0]);
    expect(rightFront.depthAnchor[1]).toBeGreaterThan(rightBack.depthAnchor[1]);
  });

  it('can bind CCA cuboid depth to a structural guide line instead of side labels', () => {
    const manifest = datacenterInventoryAtomManifest();
    manifest.polygonizer.constellation.nodes = manifest.polygonizer.constellation.nodes.map((node) => {
      const left = node.role.startsWith('left-');
      return {
        ...node,
        cca: {
          ...node.cca,
          guideLine: left ? [[220, 170], [140, 560]] : [[220, 170], [300, 560]],
          guideLineMode: 'toward-camera',
          guideEdge: left ? 'right' : 'left',
          guideUpperMode: 'height-layer',
        },
      };
    });
    manifest.marks = manifest.marks.map((mark) => ({
      ...mark,
      solidDepthProjection: 'constellation-guide-line',
      solidGuideEdge: mark.role.startsWith('left-') ? 'right' : 'left',
    }));
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.solidKind === 'solid' && mark.ccaSkinSource === 'xyz-element-mandala');
    const leftFront = faces.find((mark) => mark.role === 'left-server-cabinet-1:front');
    const rightFront = faces.find((mark) => mark.role === 'right-server-cabinet-1:front');
    const leftBottom = faces.find((mark) => mark.role === 'left-server-cabinet-1:bottom');
    const rightBottom = faces.find((mark) => mark.role === 'right-server-cabinet-1:bottom');
    const leftTop = faces.find((mark) => mark.role === 'left-server-cabinet-1:top');
    const rightTop = faces.find((mark) => mark.role === 'right-server-cabinet-1:top');
    const lineXAtY = ([[x0, y0], [x1, y1]], y) => x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
    const leftGuide = [[220, 170], [140, 560]];
    const rightGuide = [[220, 170], [300, 560]];

    expect(leftFront.solidDepthProjection[0]).toBeLessThan(0);
    expect(leftFront.solidDepthProjection[1]).toBeGreaterThan(0);
    expect(rightFront.solidDepthProjection[0]).toBeGreaterThan(0);
    expect(rightFront.solidDepthProjection[1]).toBeGreaterThan(0);
    expect(Math.abs(leftFront.solidDepthProjection[0])).toBeLessThan(0.25);
    expect(Math.abs(rightFront.solidDepthProjection[0])).toBeLessThan(0.25);
    expect(leftFront.solidGuideEdge).toBe('right');
    expect(rightFront.solidGuideEdge).toBe('left');
    // Precision 1 (within 0.05 px) — the corner sits on the guide line at
    // sub-pixel accuracy; the meru-shared unitScale gives slightly smaller
    // cuboid dimensions for this fixture than the old per-element fit, and
    // the compounded rounding through roundPoint shifts the rounded corner
    // by ~0.01 px from the guide line. Still well below render resolution.
    expect(leftBottom.points[1][0]).toBeCloseTo(lineXAtY(leftGuide, leftBottom.points[1][1]), 1);
    expect(leftBottom.points[2][0]).toBeCloseTo(lineXAtY(leftGuide, leftBottom.points[2][1]), 1);
    expect(rightBottom.points[0][0]).toBeCloseTo(lineXAtY(rightGuide, rightBottom.points[0][1]), 1);
    expect(rightBottom.points[3][0]).toBeCloseTo(lineXAtY(rightGuide, rightBottom.points[3][1]), 1);
    expect(leftTop.solidUpperGuideLine[0][0]).toBeCloseTo(leftGuide[0][0], 2);
    expect(rightTop.solidUpperGuideLine[0][0]).toBeCloseTo(rightGuide[0][0], 2);
    expect(leftTop.solidUpperGuideLine[0][1]).toBeLessThan(leftGuide[0][1]);
    expect(rightTop.solidUpperGuideLine[0][1]).toBeLessThan(rightGuide[0][1]);
    expect(leftTop.solidUpperGuideLine[1][0]).toBeLessThan(leftTop.solidUpperGuideLine[0][0]);
    expect(leftTop.solidUpperGuideLine[1][1]).toBeGreaterThan(leftTop.solidUpperGuideLine[0][1]);
    expect(rightTop.solidUpperGuideLine[1][0]).toBeGreaterThan(rightTop.solidUpperGuideLine[0][0]);
    expect(rightTop.solidUpperGuideLine[1][1]).toBeGreaterThan(rightTop.solidUpperGuideLine[0][1]);
    expect(leftTop.points[1][0]).toBeCloseTo(lineXAtY(leftTop.solidUpperGuideLine, leftTop.points[1][1]), 1);
    expect(leftTop.points[2][0]).toBeCloseTo(lineXAtY(leftTop.solidUpperGuideLine, leftTop.points[2][1]), 1);
    expect(rightTop.points[0][0]).toBeCloseTo(lineXAtY(rightTop.solidUpperGuideLine, rightTop.points[0][1]), 1);
    expect(rightTop.points[3][0]).toBeCloseTo(lineXAtY(rightTop.solidUpperGuideLine, rightTop.points[3][1]), 1);
    expect(leftTop.points[1][0] - leftTop.points[0][0]).toBeCloseTo(leftBottom.points[1][0] - leftBottom.points[0][0], 2);
    expect(leftTop.points[2][0] - leftTop.points[3][0]).toBeCloseTo(leftBottom.points[2][0] - leftBottom.points[3][0], 2);
    expect(rightTop.points[1][0] - rightTop.points[0][0]).toBeCloseTo(rightBottom.points[1][0] - rightBottom.points[0][0], 2);
    expect(rightTop.points[2][0] - rightTop.points[3][0]).toBeCloseTo(rightBottom.points[2][0] - rightBottom.points[3][0], 2);
    expect(leftTop.points[1][0]).toBeCloseTo(leftBottom.points[1][0], 1);
    expect(rightTop.points[0][0]).toBeCloseTo(rightBottom.points[0][0], 1);
  });

  it('skins CCA cuboids from constellation hit points before drawing faces', () => {
    const manifest = datacenterInventoryAtomManifest();
    manifest.polygonizer.constellation.nodes = manifest.polygonizer.constellation.nodes.map((node) => {
      const left = node.role.startsWith('left-');
      return {
        ...node,
        cca: {
          ...node.cca,
          guideLine: left ? [[220, 170], [140, 560]] : [[220, 170], [300, 560]],
          guideLineMode: 'toward-camera',
          guideEdge: left ? 'right' : 'left',
          upperGuideLine: left ? [[220, 120], [140, 510]] : [[220, 120], [300, 510]],
        },
      };
    });
    manifest.marks = manifest.marks.map((mark) => ({
      ...mark,
      solidDepthProjection: 'constellation-guide-line',
      solidGuideEdge: mark.role.startsWith('left-') ? 'right' : 'left',
      solidProjectionMode: 'constellation-hit-cuboid',
    }));
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.solidKind === 'solid' && mark.ccaSkinSource === 'xyz-element-mandala');
    const leftTop = faces.find((mark) => mark.role === 'left-server-cabinet-1:top');
    const leftBottom = faces.find((mark) => mark.role === 'left-server-cabinet-1:bottom');
    const leftBack = faces.find((mark) => mark.role === 'left-server-cabinet-1:back');
    const hit = leftTop.ccaHitPoints;
    const lineXAtY = ([[x0, y0], [x1, y1]], y) => x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);

    expect(leftTop.perspectiveMode).toBe('constellation-hit-cuboid');
    expect(Object.keys(hit).sort()).toEqual([
      'floorBackLeft',
      'floorBackRight',
      'floorFrontLeft',
      'floorFrontRight',
      'topBackLeft',
      'topBackRight',
      'topFrontLeft',
      'topFrontRight',
    ].sort());
    expect(leftBottom.points).toEqual([
      hit.floorBackLeft,
      hit.floorBackRight,
      hit.floorFrontRight,
      hit.floorFrontLeft,
    ]);
    expect(leftTop.points).toEqual([
      hit.topBackLeft,
      hit.topBackRight,
      hit.topFrontRight,
      hit.topFrontLeft,
    ]);
    expect(leftBack.points).toEqual([
      hit.floorBackLeft,
      hit.floorBackRight,
      hit.topBackRight,
      hit.topBackLeft,
    ]);
    expect(hit.floorBackRight[0]).toBeCloseTo(lineXAtY([[220, 170], [140, 560]], hit.floorBackRight[1]), 1);
    expect(hit.floorFrontRight[0]).toBeCloseTo(lineXAtY([[220, 170], [140, 560]], hit.floorFrontRight[1]), 1);
    expect(hit.topBackRight[0]).toBeCloseTo(lineXAtY([[220, 120], [140, 510]], hit.topBackRight[1]), 1);
    expect(hit.topFrontRight[0]).toBeCloseTo(lineXAtY([[220, 120], [140, 510]], hit.topFrontRight[1]), 1);
  });

  it('can keep guide-bound CCA cuboid uprights absolute vertical', () => {
    const manifest = datacenterInventoryAtomManifest();
    manifest.polygonizer.constellation.nodes = manifest.polygonizer.constellation.nodes.map((node) => {
      const left = node.role.startsWith('left-');
      return {
        ...node,
        cca: {
          ...node.cca,
          guideLine: left ? [[220, 170], [140, 560]] : [[220, 170], [300, 560]],
          guideLineMode: 'toward-camera',
          guideEdge: left ? 'right' : 'left',
          upperGuideLine: left ? [[220, 120], [140, 510]] : [[220, 120], [300, 510]],
        },
      };
    });
    manifest.marks = manifest.marks.map((mark) => ({
      ...mark,
      solidDepthProjection: 'constellation-guide-line',
      solidGuideEdge: mark.role.startsWith('left-') ? 'right' : 'left',
      solidProjectionMode: 'constellation-hit-cuboid',
      solidVerticalMode: 'absolute-90',
    }));
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.solidKind === 'solid' && mark.ccaSkinSource === 'xyz-element-mandala');
    const leftTop = faces.find((mark) => mark.role === 'left-server-cabinet-1:top');
    const hit = leftTop.ccaHitPoints;

    expect(leftTop.perspectiveMode).toBe('constellation-hit-cuboid');
    expect(hit.topBackLeft[0]).toBeCloseTo(hit.floorBackLeft[0], 2);
    expect(hit.topBackRight[0]).toBeCloseTo(hit.floorBackRight[0], 2);
    expect(hit.topFrontLeft[0]).toBeCloseTo(hit.floorFrontLeft[0], 2);
    expect(hit.topFrontRight[0]).toBeCloseTo(hit.floorFrontRight[0], 2);
    expect(hit.topBackLeft[1]).toBeLessThan(hit.floorBackLeft[1]);
    expect(hit.topFrontRight[1]).toBeLessThan(hit.floorFrontRight[1]);
  });

  it('can keep absolute vertical uprights while locking top points to the upper guide', () => {
    const manifest = datacenterInventoryAtomManifest();
    manifest.polygonizer.constellation.nodes = manifest.polygonizer.constellation.nodes.map((node) => {
      const left = node.role.startsWith('left-');
      return {
        ...node,
        cca: {
          ...node.cca,
          guideLine: left ? [[220, 170], [140, 560]] : [[220, 170], [300, 560]],
          guideLineMode: 'toward-camera',
          guideEdge: left ? 'right' : 'left',
          upperGuideLine: left ? [[220, 120], [140, 510]] : [[220, 120], [300, 510]],
        },
      };
    });
    manifest.marks = manifest.marks.map((mark) => ({
      ...mark,
      solidDepthProjection: 'constellation-guide-line',
      solidGuideEdge: mark.role.startsWith('left-') ? 'right' : 'left',
      solidProjectionMode: 'constellation-hit-cuboid',
      solidVerticalMode: 'absolute-90-top-guide',
    }));
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.solidKind === 'solid' && mark.ccaSkinSource === 'xyz-element-mandala');
    const leftTop = faces.find((mark) => mark.role === 'left-server-cabinet-1:top');
    const hit = leftTop.ccaHitPoints;
    const lineYAtX = ([[x0, y0], [x1, y1]], x) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);

    expect(hit.topBackRight[0]).toBeCloseTo(hit.floorBackRight[0], 2);
    expect(hit.topFrontRight[0]).toBeCloseTo(hit.floorFrontRight[0], 2);
    expect(hit.topBackRight[1]).toBeCloseTo(lineYAtX([[220, 120], [140, 510]], hit.topBackRight[0]), 1);
    expect(hit.topFrontRight[1]).toBeCloseTo(lineYAtX([[220, 120], [140, 510]], hit.topFrontRight[0]), 1);
  });

  it('honors front depth anchors when skinning CCA hit cuboids', () => {
    const manifest = datacenterInventoryAtomManifest();
    manifest.polygonizer.constellation.nodes = manifest.polygonizer.constellation.nodes.map((node) => {
      const left = node.role.startsWith('left-');
      return {
        ...node,
        cca: {
          ...node.cca,
          guideLine: left ? [[220, 170], [140, 560]] : [[220, 170], [300, 560]],
          guideLineMode: 'toward-camera',
          guideEdge: left ? 'right' : 'left',
          upperGuideLine: left ? [[220, 120], [140, 510]] : [[220, 120], [300, 510]],
        },
      };
    });
    const backAnchored = expandNeoRembrandt({
      ...manifest,
      marks: manifest.marks.map((mark) => ({
        ...mark,
        solidDepthProjection: 'constellation-guide-line',
        solidGuideEdge: mark.role.startsWith('left-') ? 'right' : 'left',
        solidProjectionMode: 'constellation-hit-cuboid',
        solidDepthAnchor: 'far',
      })),
    });
    const frontAnchored = expandNeoRembrandt({
      ...manifest,
      marks: manifest.marks.map((mark) => ({
        ...mark,
        solidDepthProjection: 'constellation-guide-line',
        solidGuideEdge: mark.role.startsWith('left-') ? 'right' : 'left',
        solidProjectionMode: 'constellation-hit-cuboid',
        solidDepthAnchor: 'front',
      })),
    });
    const backHit = backAnchored.marks.find((mark) => mark.role === 'left-server-cabinet-1:top').ccaHitPoints;
    const frontHit = frontAnchored.marks.find((mark) => mark.role === 'left-server-cabinet-1:top').ccaHitPoints;

    expect(frontHit.floorFrontRight).toEqual(backHit.floorBackRight);
    expect(frontHit.floorFrontLeft).toEqual(backHit.floorBackLeft);
    expect(frontHit.floorBackRight[1]).toBeLessThan(frontHit.floorFrontRight[1]);
    expect(frontHit.floorBackLeft[1]).toBeLessThan(frontHit.floorFrontLeft[1]);
  });

  it('can derive constellation paint order from back-to-front depth', () => {
    const manifest = datacenterInventoryAtomManifest();
    manifest.polygonizer.constellation.paintOrder = 'back-to-front';
    manifest.marks = manifest.marks.map((mark) => {
      const foreground = /-1$/.test(mark.role);
      const background = /-3$/.test(mark.role);
      return {
        ...mark,
        z: background ? 99 : foreground ? 1 : 50,
      };
    });
    const expanded = expandNeoRembrandt(manifest);
    const frontNear = expanded.marks.find((mark) => mark.role === 'left-server-cabinet-1:front');
    const frontMid = expanded.marks.find((mark) => mark.role === 'left-server-cabinet-2:front');
    const frontFar = expanded.marks.find((mark) => mark.role === 'left-server-cabinet-3:front');

    expect(frontFar.constellationPaintOrder).toBe('back-to-front');
    expect(frontFar.z).toBeLessThan(frontMid.z);
    expect(frontMid.z).toBeLessThan(frontNear.z);
    expect(frontFar.constellationPaintRank).toBeLessThan(frontMid.constellationPaintRank);
    expect(frontMid.constellationPaintRank).toBeLessThan(frontNear.constellationPaintRank);
  });

  it('can hide vanishing-facing back faces on CCA cuboids', () => {
    const manifest = xyzCcaSolidManifest();
    manifest.marks = manifest.marks.map((mark) => ({
      ...mark,
      solidProjectionMode: 'constellation-hit-cuboid',
      faceCull: 'hide-back',
    }));
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.solidRole === 'server-cabinet');
    const faceNames = new Set(faces.map((mark) => mark.face));

    expect(faceNames.has('back')).toBe(false);
    expect(faceNames).toEqual(new Set(['front', 'left', 'right', 'top', 'bottom']));
    expect(faces.every((face) => face.vectorFacePolicy === 'solve-complete-render-visible')).toBe(true);
    expect(faces.every((face) => face.hiddenConstructionFaces.includes('back'))).toBe(true);
  });

  it('skins xyz solids through element-local CCA mandala space by default', () => {
    const expanded = expandNeoRembrandt(xyzCcaSolidManifest());
    const faces = expanded.marks.filter((mark) => mark.solidRole === 'server-cabinet');
    const front = faces.find((mark) => mark.role === 'server-cabinet:front');

    expect(expanded.neoRembrandt.elementMandalaGenerated).toBe(true);
    expect(faces.length).toBeGreaterThanOrEqual(3);
    expect(faces.every((mark) => mark.ccaBlock === true)).toBe(true);
    expect(faces.every((mark) => mark.ccaSkinDefault === true)).toBe(true);
    expect(faces.every((mark) => mark.ccaSkinSource === 'xyz-element-mandala')).toBe(true);
    expect(faces.every((mark) => mark.elementMandalaRole === 'server-cabinet')).toBe(true);
    expect(front.elementMandalaPerspectiveScale).toBeGreaterThan(0);
    expect(front.elementMandalaPerspectiveScale).toBeLessThanOrEqual(1);
    expect(front.ccaWorldXYZ).toEqual([0, 0, 0]);
    expect(front.ccaSizeXYZ).toEqual([3, 6, 6]);
    expect(front.constellationRole).toBe('server-cabinet');
  });

  it('lets full-body form dummies follow per-mark gesture paths', () => {
    const expanded = expandNeoRembrandt(fullBodyDummyFormManifest({ gesture: true }));
    const dummy = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'full-dummy');
    const head = dummy.find((mark) => mark.role === 'full-dummy:head');
    const pelvis = dummy.find((mark) => mark.role === 'full-dummy:pelvis');
    const rightWrist = dummy.find((mark) => mark.role === 'full-dummy:right-wrist-joint');
    const leftWrist = dummy.find((mark) => mark.role === 'full-dummy:left-wrist-joint');
    const pointOf = (mark) => mark.anchor || mark.depthAnchor || mark.center || mark.points?.[0];

    expect(pointOf(head)[0]).toBeLessThan(pointOf(pelvis)[0]);
    expect(pointOf(rightWrist)[1]).toBeLessThan(pointOf(head)[1] + 30);
    expect(pointOf(leftWrist)[1]).toBeGreaterThan(pointOf(head)[1] + 150);
    expect(dummy.every((mark) => mark.gestureBasedDummy === true)).toBe(true);
    expect(dummy.some((mark) => mark.formDummyAnchorMap?.rightWrist)).toBe(true);
  });

  it('compiles a plane-object form primitive into solid and plane renderer marks', () => {
    const expanded = expandNeoRembrandt(planeObjectFormManifest());
    const formMarks = expanded.marks.filter((mark) => mark.formPrimitiveRole === 'sign');
    const solidPlanes = formMarks.filter((mark) => mark.solidKind === 'solid');
    const frontPlane = formMarks.find((mark) => mark.role === 'sign:front-plane');

    expect(expanded.marks.some((mark) => mark.kind === 'form')).toBe(false);
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(solidPlanes.length).toBeGreaterThan(0);
    expect(frontPlane?.sourceShape).toBe('plane');
    expect(new Set(formMarks.map((mark) => mark.formPrimitiveStock))).toEqual(new Set(['plane-object']));
  });

  it('compiles pure mandala path fields into deterministic visible vector solids', () => {
    const manifest = mandalaFieldPathManifest();
    manifest.marks[0].debugInset = { origin: [46, 52], scale: 4, label: 'mandala z=0' };
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.source && mark.solidKind === 'solid' && mark.mandalaFieldRole === 'city-field');
    const insetMarks = expanded.marks.filter((mark) => mark.mandalaDebugInset);
    const sampleIds = new Set(faces.map((mark) => mark.mandalaSampleIndex));
    const widths = faces
      .filter((mark) => mark.face === 'front')
      .map((mark) => Math.abs(mark.points[1][0] - mark.points[0][0]));

    expect(expanded.marks.some((mark) => mark.kind === 'mandalaField')).toBe(false);
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.neoRembrandt.constructionResolvedMarkCount).toBeGreaterThan(5);
    expect(sampleIds).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(faces.every((mark) => mark.mandalaPathRole === 'avenue')).toBe(true);
    expect(faces.every((mark) => Array.isArray(mark.mandalaWorldXY))).toBe(true);
    expect(faces.some((mark) => mark.face === 'back')).toBe(false);
    expect(faces.every((mark) => mark.vectorFacePolicy === 'solve-complete-render-visible')).toBe(true);
    expect(insetMarks.length).toBeGreaterThanOrEqual(6);
    expect(insetMarks.some((mark) => mark.role?.includes(':label'))).toBe(true);
    expect(new Set(widths).size).toBeGreaterThan(1);
    expect(JSON.stringify(expandNeoRembrandt(manifest))).toBe(JSON.stringify(expanded));
  });

  it('can pin mandala contemplation samples onto resolved constellation grid units', () => {
    const manifest = withConstellationGrid(mandalaFieldPinnedConstellationManifest());
    const expanded = expandNeoRembrandt(manifest);
    const faces = expanded.marks.filter((mark) => mark.source && mark.mandalaFieldRole === 'planned-map');
    const frontFaces = faces.filter((mark) => mark.face === 'front');
    const pinRoles = new Set(faces.map((mark) => mark.mandalaPinRole));

    expect(expanded.marks.some((mark) => mark.kind === 'mandalaField')).toBe(false);
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.neoRembrandt.constructionResolvedMarkCount).toBe(3);
    expect(pinRoles).toEqual(new Set(['tower-left', 'tower-mid', 'tower-right']));
    expect(faces.every((mark) => mark.mandalaPinned === true)).toBe(true);
    expect(faces.every((mark) => Array.isArray(mark.mandalaPinAnchor))).toBe(true);
    expect(faces.every((mark) => mark.constellationRole === mark.mandalaPinRole)).toBe(true);
    expect(frontFaces.map((mark) => mark.depthAnchor[0])).toEqual([...frontFaces].map((mark) => mark.depthAnchor[0]).sort((a, b) => a - b));
    expect(faces.some((mark) => mark.face === 'back')).toBe(false);
  });

  it('passes shot terminator vectors into renderer gridding metadata', () => {
    const expanded = expandNeoRembrandt({
      title: 'Shot terminator wedge',
      viewBox: { width: 500, height: 360 },
      polygonizer: {
        subject: 'terminator wedge proof',
        mandalaPatternLayer: {
          kind: 'metaconcept-mandala-pattern-layer',
          cameraWindow: {
            origin: [0, 0, 0],
            terminatorVectors: {
              left: [-0.6, -1, 0],
              right: [0.6, -1, 0],
            },
            screenOrigin: [250, 310],
            unitScale: 120,
            depthSteps: 4,
            laneSteps: 4,
            debug: true,
          },
        },
      },
      scene: { palette: 'warm-low-key' },
      marks: [
        { kind: 'rect', role: 'visible-slice-anchor', x: 220, y: 250, w: 60, h: 30, fill: '#9c7756', z: 2 },
      ],
    });
    const window = expanded.neoRembrandt.mandalaCameraWindow;
    const debugMarks = expanded.marks.filter((mark) => mark.mandalaCameraWindowDebug);

    expect(window.kind).toBe('shot-terminator-wedge');
    expect(window.terminatorVectors.left).toEqual([-0.6, -1]);
    expect(window.terminatorVectors.right).toEqual([0.6, -1]);
    expect(window.grid.rows).toHaveLength(4);
    expect(window.grid.lanes).toHaveLength(5);
    expect(expanded.neoRembrandt.mandalaCameraWindowDebugMarkCount).toBe(debugMarks.length);
    expect(debugMarks.map((mark) => mark.role)).toEqual(expect.arrayContaining([
      'mandala-camera-window:left-terminator',
      'mandala-camera-window:right-terminator',
      'mandala-camera-window:depth-row-1',
      'mandala-camera-window:lane-1',
    ]));
  });

  it('lowers visionPane roads into vanishing-point aligned geometry', () => {
    const manifest = {
      title: 'Vision pane road',
      viewBox: { width: 500, height: 360 },
      polygonizer: {
        subject: 'vision pane road proof',
        spatialPlanning: { mode: 'plan-before-skin' },
      },
      scene: {
        perspective: { mode: 'one-point', vanishingPoint: [250, 80] },
        palette: 'warm-low-key',
      },
      marks: [
        {
          kind: 'visionPane',
          role: 'street-floor',
          mode: 'road',
          vanishingPoint: [250, 80],
          nearEdge: { left: [120, 340], right: [380, 340] },
          farT: 0.9,
          fill: '#4c5151',
          features: {
            curbs: true,
            centerline: true,
            depthRows: 4,
            crosswalk: { rows: 3, at: 0.35, span: 0.12 },
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const floor = expanded.marks.find((mark) => mark.role === 'street-floor');
    const rows = expanded.marks.filter((mark) => mark.role?.startsWith('street-floor:depth-row-'));
    const crosswalk = expanded.marks.filter((mark) => mark.role?.startsWith('street-floor:crosswalk-'));
    const leftCurb = expanded.marks.find((mark) => mark.role === 'street-floor:left-curb');
    const rightCurb = expanded.marks.find((mark) => mark.role === 'street-floor:right-curb');
    const centerline = expanded.marks.find((mark) => mark.role === 'street-floor:centerline');
    const leftAt = (t) => [120 + (250 - 120) * t, 340 + (80 - 340) * t];
    const rightAt = (t) => [380 + (250 - 380) * t, 340 + (80 - 340) * t];

    expect(expanded.marks.some((mark) => mark.kind === 'visionPane')).toBe(false);
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(floor.kind).toBe('polygon');
    expect(floor.constructionKind).toBe('visionPane');
    expect(floor.points[0]).toEqual([120, 340]);
    expect(floor.points[1]).toEqual([380, 340]);
    expect(floor.points[2][0]).toBeCloseTo(rightAt(0.9)[0], 2);
    expect(floor.points[2][1]).toBeCloseTo(rightAt(0.9)[1], 2);
    expect(floor.points[3][0]).toBeCloseTo(leftAt(0.9)[0], 2);
    expect(floor.points[3][1]).toBeCloseTo(leftAt(0.9)[1], 2);
    expect(rows).toHaveLength(4);
    expect(crosswalk).toHaveLength(3);
    expect(leftCurb.x2).toBeCloseTo(leftAt(0.9)[0], 2);
    expect(rightCurb.x2).toBeCloseTo(rightAt(0.9)[0], 2);
    expect(centerline.x1).toBe(250);
    expect(centerline.x2).toBe(250);
    for (const row of rows.concat(crosswalk)) {
      const t = row.visionPaneT;
      expect(row.x1).toBeCloseTo(leftAt(t)[0], 1);
      expect(row.y1).toBeCloseTo(leftAt(t)[1], 1);
      expect(row.x2).toBeCloseTo(rightAt(t)[0], 1);
      expect(row.y2).toBeCloseTo(rightAt(t)[1], 1);
    }
  });

  it('can lower visionPane roads only up to a map-derived horizon boundary', () => {
    const expanded = expandNeoRembrandt({
      title: 'Vision pane horizon boundary',
      viewBox: { width: 500, height: 360 },
      polygonizer: {
        subject: 'horizon boundary proof',
        spatialPlanning: { mode: 'plan-before-skin' },
      },
      scene: { palette: 'warm-low-key' },
      marks: [
        {
          kind: 'visionPane',
          role: 'street-slice',
          mode: 'road',
          nearEdge: { left: [120, 340], right: [380, 340] },
          horizonBoundary: { y: 120, centerX: 250, width: 80 },
          fill: '#4c5151',
          features: {
            curbs: true,
            centerline: true,
            depthRows: 3,
            crosswalk: { rows: 2, at: 0.42, span: 0.08 },
          },
        },
      ],
    });
    const floor = expanded.marks.find((mark) => mark.role === 'street-slice');
    const rows = expanded.marks.filter((mark) => mark.role?.startsWith('street-slice:depth-row-'));
    const crosswalk = expanded.marks.filter((mark) => mark.role?.startsWith('street-slice:crosswalk-'));
    const leftAt = (t) => [120 + (210 - 120) * t, 340 + (120 - 340) * t];
    const rightAt = (t) => [380 + (290 - 380) * t, 340 + (120 - 340) * t];

    expect(floor.visionPaneProjectionMode).toBe('horizon-boundary');
    expect(floor.visionPaneFarEdge).toEqual({ left: [210, 120], right: [290, 120] });
    expect(floor.points).toEqual([
      [120, 340],
      [380, 340],
      [290, 120],
      [210, 120],
    ]);
    expect(rows).toHaveLength(3);
    expect(crosswalk).toHaveLength(2);
    for (const row of rows.concat(crosswalk)) {
      const t = row.visionPaneT;
      expect(row.x1).toBeCloseTo(leftAt(t)[0], 1);
      expect(row.y1).toBeCloseTo(leftAt(t)[1], 1);
      expect(row.x2).toBeCloseTo(rightAt(t)[0], 1);
      expect(row.y2).toBeCloseTo(rightAt(t)[1], 1);
    }
  });

  it('keeps road furniture scoped to road-like vision panes', () => {
    const expanded = expandNeoRembrandt({
      title: 'Terrain pane without road furniture',
      viewBox: { width: 500, height: 360 },
      polygonizer: {
        subject: 'terrain pane proof',
        spatialPlanning: { mode: 'plan-before-skin' },
      },
      scene: { palette: 'warm-low-key' },
      marks: [
        {
          kind: 'visionPane',
          role: 'terrain-depth-field',
          mode: 'terrain',
          nearEdge: { left: [70, 340], right: [430, 340] },
          horizonBoundary: { y: 130, centerX: 250, width: 110 },
          fill: '#6f7454',
          features: { depthRows: 3 },
        },
      ],
    });
    const pane = expanded.marks.find((mark) => mark.role === 'terrain-depth-field:depth-row-1');

    expect(pane.visionPaneVisualFamily).toBe('terrain-pane');
    expect(expanded.marks.some((mark) => mark.role === 'terrain-depth-field' && mark.kind === 'polygon')).toBe(false);
    expect(expanded.marks.some((mark) => /curb|centerline|crosswalk/.test(mark.role || ''))).toBe(false);
    expect(expanded.marks.filter((mark) => mark.role?.startsWith('terrain-depth-field:depth-row-'))).toHaveLength(3);
  });

  it('resolves metamandala light sources into deterministic renderer rays', () => {
    const expanded = expandNeoRembrandt({
      title: 'Metamandala light source',
      viewBox: { width: 500, height: 360 },
      polygonizer: {
        subject: 'metamandala light proof',
        metamandala: {
          lightSources: [
            {
              role: 'key-light',
              kind: 'spot',
              origin: [0, 0, 0],
              screenOrigin: [250, 310],
              angleDegrees: -135,
              spreadDegrees: 30,
              intensity: 1.2,
              debug: true,
            },
          ],
        },
      },
      scene: { palette: 'warm-low-key' },
      marks: [
        { kind: 'rect', role: 'lit-anchor', x: 220, y: 250, w: 60, h: 30, fill: '#9c7756', z: 2 },
      ],
    });
    const lighting = expanded.neoRembrandt.metamandalaLighting;
    const debugMarks = expanded.marks.filter((mark) => mark.metamandalaLightDebug);

    expect(expanded.scene.light.source).toBe('metamandala-light');
    expect(expanded.scene.light.role).toBe('key-light');
    expect(expanded.scene.light.direction[0]).toBeCloseTo(-0.707, 2);
    expect(expanded.scene.light.direction[1]).toBeCloseTo(-0.707, 2);
    expect(lighting.kind).toBe('metamandala-lighting');
    expect(lighting.sources[0].kind).toBe('spot');
    expect(lighting.sources[0].spreadDegrees).toBe(30);
    expect(expanded.neoRembrandt.metamandalaLightDebugMarkCount).toBe(debugMarks.length);
    expect(debugMarks.map((mark) => mark.role)).toEqual(expect.arrayContaining([
      'metamandala-light:key-light:ray',
      'metamandala-light:key-light:origin',
      'metamandala-light:key-light:cone-left',
      'metamandala-light:key-light:cone-right',
    ]));
  });

  it('simulates pure vector light diffusion over polygon faces', () => {
    const expanded = expandNeoRembrandt({
      title: 'Metamandala light diffusion',
      viewBox: { width: 500, height: 360 },
      polygonizer: {
        subject: 'pure vector light diffusion proof',
        metamandala: {
          lightSources: [
            {
              role: 'left-window',
              kind: 'directional',
              screenOrigin: [80, 214],
              angleDegrees: 0,
              intensity: 1,
              diffusion: {
                enabled: true,
                rays: 5,
                bounces: 1,
                falloff: 0.55,
                originSpread: 90,
                length: 360,
                debug: true,
              },
            },
          ],
        },
      },
      scene: {
        view: { direction: [-0.35, -0.22], baseZ: 10 },
        palette: 'warm-low-key',
      },
      marks: [
        {
          kind: 'solid',
          role: 'diffusion-block',
          x: 240,
          y: 154,
          width: 92,
          height: 92,
          depth: 44,
          fill: '#8f6d50',
          stroke: '#33251a',
          z: 10,
        },
      ],
    });
    const report = expanded.neoRembrandt.metamandalaLightDiffusion;
    const activated = expanded.marks.filter((mark) => mark.lightDiffusionActivated);
    const debugRays = expanded.marks.filter((mark) => mark.metamandalaLightDiffusionDebug);
    const blockFace = activated.find((mark) => mark.solidRole === 'diffusion-block');

    expect(expanded.neoRembrandt.metamandalaLightDiffusionApplied).toBe(true);
    expect(report).toMatchObject({
      kind: 'metamandala-light-diffusion',
      mode: 'pure-vector',
      sourceCount: 1,
      rayCount: 5,
    });
    expect(report.hitCount).toBeGreaterThan(0);
    expect(activated.length).toBeGreaterThan(0);
    expect(blockFace.lightActivation).toBeGreaterThan(0);
    expect(blockFace.lightHits).toBeGreaterThan(0);
    expect(blockFace.lightSourceRoles).toContain('left-window');
    expect(debugRays.length).toBeGreaterThanOrEqual(report.hitCount);
    expect(debugRays.some((mark) => mark.metamandalaLightBounce === 1)).toBe(true);
    expect(expanded.neoRembrandt.spatialPlan.lightDiffusion.hitCount).toBe(report.hitCount);
  });

  it('lets mandala skin transparency transmit light rays independently of SVG opacity', () => {
    const expanded = expandNeoRembrandt({
      title: 'Metamandala skin transparency',
      viewBox: { width: 460, height: 260 },
      polygonizer: {
        subject: 'skin transparency proof',
        metamandala: {
          lightSources: [
            {
              role: 'left-ray',
              kind: 'directional',
              screenOrigin: [48, 130],
              angleDegrees: 0,
              intensity: 1,
              diffusion: {
                enabled: true,
                rays: 1,
                bounces: 0,
                length: 360,
                effects: ['tone'],
              },
            },
          ],
        },
      },
      marks: [
        {
          kind: 'polygon',
          role: 'visible-glass-pane',
          points: [[128, 72], [178, 72], [178, 188], [128, 188]],
          fill: '#8cc6d8',
          stroke: '#2b6f88',
          opacity: 0.92,
          skinTransparency: 1,
          z: 8,
        },
        {
          kind: 'polygon',
          role: 'opaque-back-panel',
          points: [[250, 78], [332, 78], [332, 184], [250, 184]],
          fill: '#8f6d50',
          stroke: '#33251a',
          z: 9,
        },
      ],
    });
    const activated = expanded.marks.filter((mark) => mark.lightDiffusionActivated);
    const pane = activated.find((mark) => mark.role === 'visible-glass-pane');
    const back = activated.find((mark) => mark.role === 'opaque-back-panel');

    expect(expanded.neoRembrandt.metamandalaLightDiffusionApplied).toBe(true);
    expect(pane).toBeUndefined();
    expect(back?.lightActivation).toBeGreaterThan(0);
    expect(expanded.marks.find((mark) => mark.role === 'visible-glass-pane')?.opacity).toBe(0.92);
  });

  it('uses negative skin transparency as a reflective light surface', () => {
    const expanded = expandNeoRembrandt({
      title: 'Metamandala reflective skin transparency',
      viewBox: { width: 360, height: 240 },
      polygonizer: {
        subject: 'skin transparency reflection proof',
        metamandala: {
          lightSources: [
            {
              role: 'left-ray',
              kind: 'directional',
              screenOrigin: [40, 180],
              angleDegrees: 0,
              intensity: 1,
              diffusion: {
                enabled: true,
                rays: 1,
                bounces: 1,
                length: 260,
                effects: ['tone'],
                debug: true,
              },
            },
          ],
        },
      },
      marks: [
        {
          kind: 'polygon',
          role: 'mirror-skin',
          points: [[196, 150], [224, 150], [224, 210], [196, 210]],
          fill: '#9bb8c7',
          stroke: '#2b5363',
          opacity: 0.94,
          skinTransparency: -1,
          faceNormal: [-0.707, -0.707],
          z: 8,
        },
        {
          kind: 'polygon',
          role: 'reflected-target',
          points: [[158, 78], [262, 78], [262, 110], [158, 110]],
          fill: '#8f6d50',
          stroke: '#33251a',
          z: 9,
        },
      ],
    });
    const activated = expanded.marks.filter((mark) => mark.lightDiffusionActivated);
    const mirror = activated.find((mark) => mark.role === 'mirror-skin');
    const target = activated.find((mark) => mark.role === 'reflected-target');
    const debugRays = expanded.marks.filter((mark) => mark.metamandalaLightDiffusionDebug);

    expect(expanded.neoRembrandt.metamandalaLightDiffusionApplied).toBe(true);
    expect(mirror).toMatchObject({
      lightTransmissionMode: 'reflect',
      lightSkinTransparency: -1,
    });
    expect(target?.lightActivation).toBeGreaterThan(0);
    expect(debugRays.some((mark) => mark.metamandalaLightBounce === 0 && mark.metamandalaLightHitTransmissionMode === 'reflect')).toBe(true);
    expect(debugRays.some((mark) => mark.metamandalaLightBounce === 1 && mark.metamandalaLightHitRole === 'reflected-target')).toBe(true);
  });

  it('records pinhole beam impact brightness from ambient plus ray energy', () => {
    const expanded = expandNeoRembrandt({
      title: 'Metamandala pinhole beam',
      viewBox: { width: 460, height: 260 },
      polygonizer: {
        subject: 'pinhole light proof',
        metamandala: {
          lightSources: [
            {
              role: 'pinhole-laser',
              kind: 'directional',
              screenOrigin: [48, 130],
              angleDegrees: 0,
              intensity: 0.18,
              diffusion: {
                enabled: true,
                beam: { mode: 'pinhole', widthPx: 1, profile: 'laser', sampleBudget: 1 },
                rays: 1,
                bounces: 0,
                length: 360,
                effects: ['tone'],
                debug: true,
              },
            },
          ],
        },
      },
      scene: { ambientLight: { intensity: 0 } },
      marks: [
        {
          kind: 'polygon',
          role: 'pinhole-target',
          points: [[250, 78], [332, 78], [332, 184], [250, 184]],
          fill: '#8f6d50',
          stroke: '#33251a',
          z: 9,
        },
        {
          kind: 'polygon',
          role: 'unhit-panel',
          points: [[250, 20], [332, 20], [332, 54], [250, 54]],
          fill: '#4f6684',
          stroke: '#21324c',
          z: 9,
        },
      ],
    });
    const target = expanded.marks.find((mark) => mark.role === 'pinhole-target' && mark.lightDiffusionActivated);
    const unhit = expanded.marks.find((mark) => mark.role === 'unhit-panel' && mark.lightDiffusionActivated);
    const debugRay = expanded.marks.find((mark) => mark.metamandalaLightDiffusionDebug);

    expect(expanded.neoRembrandt.metamandalaLightDiffusion).toMatchObject({
      kind: 'metamandala-light-diffusion',
      ambientIntensity: 0,
      beamWidths: [1],
    });
    expect(target?.lightRayBrightness).toBeGreaterThan(0);
    expect(target?.lightImpactBrightness).toBeGreaterThan(0);
    expect(target?.lightAmbientIntensity).toBe(0);
    expect(target?.lightBeamWidthPx).toBe(1);
    expect(target?.lightBeamProfile).toBe('laser');
    expect(target?.lightFluence).toBeGreaterThan(0);
    expect(unhit).toBeUndefined();
    expect(debugRay).toMatchObject({
      metamandalaLightBeamWidthPx: 1,
      metamandalaLightBeamProfile: 'laser',
      metamandalaLightAmbientIntensity: 0,
    });
  });

  it('increases pinhole impact brightness as ray intensity rises', () => {
    const manifest = (intensity) => ({
      title: 'Metamandala pinhole intensity',
      viewBox: { width: 420, height: 240 },
      polygonizer: {
        subject: 'pinhole intensity proof',
        metamandala: {
          lightSources: [
            {
              role: 'pinhole-laser',
              kind: 'directional',
              screenOrigin: [48, 130],
              angleDegrees: 0,
              intensity,
              diffusion: {
                enabled: true,
                beam: { mode: 'pinhole', widthPx: 1, profile: 'laser' },
                rays: 1,
                bounces: 0,
                length: 320,
              },
            },
          ],
        },
      },
      scene: { ambientLight: { intensity: 0.04 } },
      marks: [
        {
          kind: 'polygon',
          role: 'pinhole-target',
          points: [[230, 78], [310, 78], [310, 184], [230, 184]],
          fill: '#8f6d50',
          stroke: '#33251a',
          z: 9,
        },
      ],
    });
    const dim = expandNeoRembrandt(manifest(0.12)).marks.find((mark) => mark.role === 'pinhole-target' && mark.lightDiffusionActivated);
    const bright = expandNeoRembrandt(manifest(0.42)).marks.find((mark) => mark.role === 'pinhole-target' && mark.lightDiffusionActivated);

    expect(dim?.lightAmbientIntensity).toBe(0.04);
    expect(bright?.lightImpactBrightness).toBeGreaterThan(dim?.lightImpactBrightness);
    expect(bright?.lightRayBrightness).toBeGreaterThan(dim?.lightRayBrightness);
  });

  it('scales pinhole fluence with beam width while preserving impact brightness', () => {
    const manifest = (widthPx) => ({
      title: 'Metamandala pinhole fluence',
      viewBox: { width: 420, height: 240 },
      polygonizer: {
        subject: 'pinhole fluence proof',
        metamandala: {
          lightSources: [
            {
              role: 'pinhole-laser',
              kind: 'directional',
              screenOrigin: [48, 130],
              angleDegrees: 0,
              intensity: 0.24,
              diffusion: {
                enabled: true,
                beam: { mode: 'pinhole', widthPx, profile: 'laser' },
                rays: 1,
                bounces: 0,
                length: 320,
              },
            },
          ],
        },
      },
      scene: { ambientLight: { intensity: 0 } },
      marks: [
        {
          kind: 'polygon',
          role: 'pinhole-target',
          points: [[230, 78], [310, 78], [310, 184], [230, 184]],
          fill: '#8f6d50',
          stroke: '#33251a',
          z: 9,
        },
      ],
    });
    const narrow = expandNeoRembrandt(manifest(1)).marks.find((mark) => mark.role === 'pinhole-target' && mark.lightDiffusionActivated);
    const wide = expandNeoRembrandt(manifest(12)).marks.find((mark) => mark.role === 'pinhole-target' && mark.lightDiffusionActivated);

    expect(wide?.lightBeamWidthPx).toBe(12);
    expect(wide?.lightFluence).toBeGreaterThan(narrow?.lightFluence);
    expect(wide?.lightImpactBrightness).toBeCloseTo(narrow?.lightImpactBrightness, 6);
  });

  it('widens vector light into activation effect marks from a beam preset', () => {
    const expanded = expandNeoRembrandt({
      title: 'Metamandala soft window activation',
      viewBox: { width: 560, height: 380 },
      polygonizer: {
        subject: 'wide beam activation proof',
        metamandala: {
          lightSources: [
            {
              role: 'wide-window',
              kind: 'directional',
              screenOrigin: [70, 220],
              angleDegrees: 0,
              intensity: 1,
              color: '#ffe8a3',
              diffusion: {
                enabled: true,
                beam: 'soft-window',
                length: 420,
                effects: ['tone', 'rim', 'aura'],
              },
            },
          ],
        },
      },
      scene: {
        view: { direction: [-0.35, -0.22], baseZ: 10 },
        palette: 'warm-low-key',
      },
      marks: [
        {
          kind: 'solid',
          role: 'soft-window-block',
          x: 260,
          y: 162,
          width: 108,
          height: 96,
          depth: 42,
          fill: '#87644b',
          stroke: '#33251a',
          z: 10,
        },
      ],
    });
    const report = expanded.neoRembrandt.metamandalaLightDiffusion;
    const effectMarks = expanded.marks.filter((mark) => mark.lightActivationEffect);
    const rimMarks = effectMarks.filter((mark) => mark.lightActivationEffect === 'rim');
    const auraMarks = effectMarks.filter((mark) => mark.lightActivationEffect === 'aura');
    const activated = expanded.marks.filter((mark) => mark.lightDiffusionActivated);

    expect(report).toMatchObject({
      kind: 'metamandala-light-diffusion',
      mode: 'pure-vector',
      rayCount: 24,
    });
    expect(report.beams).toContain('soft-window');
    expect(report.effects).toEqual(expect.arrayContaining(['tone', 'rim', 'aura']));
    expect(report.effectMarkCount).toBe(effectMarks.length);
    expect(activated.length).toBeGreaterThan(0);
    expect(rimMarks.length).toBeGreaterThan(0);
    expect(auraMarks.length).toBeGreaterThan(0);
    expect(effectMarks.every((mark) => mark.lightSourceRoles.includes('wide-window'))).toBe(true);
  });

  it('derives polygon contact regions and validates declared hitbox relationships', () => {
    const expanded = expandNeoRembrandt(contactValidationManifest());
    const uprightFaces = expanded.marks.filter((mark) => mark.solidRole === 'upright');
    const ground = expanded.marks.find((mark) => mark.role === 'ground-plane');
    const check = expanded.neoRembrandt.contactChecks.find((item) => item.role === 'upright-sits-on-ground');

    expect(uprightFaces.every((mark) => mark.contactRegions?.baseContact)).toBe(true);
    expect(ground.contactRegions?.polygon).toHaveLength(4);
    expect(expanded.neoRembrandt.contactCheckCount).toBe(1);
    expect(expanded.neoRembrandt.contactCheckPassedCount).toBe(1);
    expect(check.ok).toBe(true);
  });

  it('derives metamandala L-basis floors from solved contact regions', () => {
    const expanded = expandNeoRembrandt(metamandalaSurfaceManifest());
    const surface = expanded.neoRembrandt.metamandalaSurfaces.find((item) => item.role === 'upright-top-local-floor');
    const lasers = expanded.marks.filter((mark) => mark.metamandalaSurfaceRole === 'upright-top-local-floor');

    expect(expanded.neoRembrandt.metamandalaSurfaceCount).toBe(1);
    expect(surface.kind).toBe('fromContact');
    expect(surface.fromRole).toBe('upright');
    expect(surface.fromRegion).toBe('topContact');
    expect(surface.xAxis).toHaveLength(2);
    expect(surface.yAxis).toHaveLength(2);
    expect(lasers.map((mark) => mark.role)).toEqual(expect.arrayContaining([
      'metamandala:upright-top-local-floor:x-laser',
      'metamandala:upright-top-local-floor:y-laser',
      'metamandala:upright-top-local-floor:origin',
      'metamandala:upright-top-local-floor:label',
    ]));
    expect(lasers.every((mark) => mark.metamandalaDebug === true)).toBe(true);
  });

  it('can relax dependent marks onto post-solved metamandala support floors', () => {
    const expanded = expandNeoRembrandt(metamandalaRelaxationManifest());
    const cup = expanded.marks.find((mark) => mark.role === 'cup');
    const check = expanded.neoRembrandt.contactChecks.find((item) => item.role === 'cup-base-on-table-after-relaxation');
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments[0];

    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(true);
    expect(adjustment.targetRole).toBe('cup');
    expect(adjustment.surfaceRole).toBe('table-local-floor');
    expect(adjustment.delta[1]).toBeLessThan(0);
    expect(cup.metamandalaRelaxed).toBe(true);
    expect(cup.contactRegions.baseContact[0][1]).toBeLessThan(178);
    expect(check.ok).toBe(true);
  });

  it('does not pull a behind-surface object forward when mandala space has no collision', () => {
    const manifest = metamandalaRelaxationManifest();
    manifest.polygonizer.contactChecks = [];
    manifest.marks[1].points = [[145, 82], [195, 82], [190, 132], [150, 132]];
    const originalPoints = JSON.stringify(manifest.marks[1].points);
    const expanded = expandNeoRembrandt(manifest);
    const cup = expanded.marks.find((mark) => mark.role === 'cup');

    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(false);
    expect(JSON.stringify(cup.points)).toBe(originalPoints);
    expect(cup.metamandalaRelaxed).not.toBe(true);
  });

  it('can relax dependent marks onto constellation-owned hitbox floors', () => {
    const expanded = expandNeoRembrandt(constellationHitboxRelaxationManifest());
    const cup = expanded.marks.find((mark) => mark.role === 'cup');
    const surface = expanded.neoRembrandt.metamandalaSurfaces.find((item) => item.role === 'table-hitbox-floor');
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments[0];
    const cupCenter = (cup.contactRegions.baseContact[0][0] + cup.contactRegions.baseContact[1][0]) / 2;
    const supportMax = Math.max(...expanded.marks
      .filter((mark) => markMatchesRoleForTest(mark, 'table'))
      .map((mark) => mark.z ?? 0));

    expect(surface.source).toBe('constellation-hitbox');
    expect(surface.hitboxRole).toBe('tabletop-support');
    expect(surface.supportBounds).toEqual({ x: 92, y: 139.13, width: 156, height: 22 });
    expect(surface.supportRail).toEqual({ mode: 'safe-standing', t: 0.72, y: 154.97 });
    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(true);
    expect(adjustment.delta[0]).not.toBe(0);
    expect(adjustment.delta[1]).toBeLessThan(0);
    expect(adjustment.paintZ).toBeCloseTo(supportMax + 1, 1);
    expect(cup.z).toBeCloseTo(supportMax + 1, 1);
    expect(cupCenter).toBeCloseTo(170, 1);
    expect(expanded.neoRembrandt.contactCheckPassedCount).toBe(1);
  });

  it('can raise relaxed marks above their support paint layer deterministically', () => {
    const expanded = expandNeoRembrandt(metamandalaRelaxationPaintManifest());
    const cup = expanded.marks.find((mark) => mark.role === 'cup');
    const supportMax = Math.max(...expanded.marks
      .filter((mark) => markMatchesRoleForTest(mark, 'table-top'))
      .map((mark) => mark.z ?? 0));
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments[0];

    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(true);
    expect(adjustment.paintZ).toBeCloseTo(supportMax + 0.5, 1);
    expect(cup.z).toBeGreaterThan(supportMax);
    expect(cup.metamandalaRelaxed).toBe(true);
  });

  it('applies gravity from support hitboxes without lifting vector shadows', () => {
    const expanded = expandNeoRembrandt(gravityBowlOnTableManifest());
    const bowl = expanded.marks.find((mark) => mark.role === 'bowl-body');
    const rim = expanded.marks.find((mark) => mark.role === 'bowl-rim');
    const shadow = expanded.marks.find((mark) => mark.role === 'bowl-shadow');
    const plan = expanded.neoRembrandt.spatialPlan;
    const surface = expanded.neoRembrandt.metamandalaSurfaces.find((item) => item.role === 'tabletop-support');
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments[0];
    const tableMax = Math.max(...expanded.marks
      .filter((mark) => markMatchesRoleForTest(mark, 'table'))
      .map((mark) => mark.z ?? 0));

    expect(plan.contract.mode).toBe('plan-before-skin');
    expect(plan.materializationGate.status).toBe('open');
    expect(plan.hitboxes.map((item) => item.role)).toEqual(['tabletop-support']);
    expect(plan.gravityEdges[0]).toMatchObject({
      bodyRole: 'bowl-body',
      supportRole: 'tabletop-support',
      resolved: true,
      shadowRoles: ['bowl-shadow'],
    });
    expect(plan.zAdjacency[0]).toMatchObject({
      topRole: 'bowl-body',
      bottomRole: 'tabletop-support',
      rule: 'there is only one bottom',
    });
    expect(plan.validation.ok).toBe(true);
    expect(surface.source).toBe('constellation-hitbox');
    expect(surface.supportRail.y).toBeCloseTo(203.12, 1);
    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(true);
    expect(adjustment.role).toBe('bowl-body-gravity-on-tabletop-support');
    expect(adjustment.reason).toBe('gravity-support-adjacency');
    expect(adjustment.delta[1]).toBeGreaterThan(0);
    expect(bowl.contactRegions.baseContact[0][1]).toBeCloseTo(surface.supportRail.y, 1);
    expect(bowl.z).toBeCloseTo(tableMax + 1, 1);
    expect(bowl.spatialPlanMaterialized).toBe(true);
    expect(bowl.materializationGate).toBe('open');
    expect(rim.z).toBeCloseTo(bowl.z, 1);
    expect(shadow.z).toBe(20.1);
    expect(shadow.metamandalaRelaxed).not.toBe(true);
    expect(plan.validation.checks.find((check) => check.role === 'bowl-shadow:shadow-stays-receiver-owned').ok).toBe(true);
    expect(expanded.neoRembrandt.contactCheckPassedCount).toBe(1);
  });

  it('blocks normal materialization when plan-before-skin gravity cannot resolve support', () => {
    const expanded = expandNeoRembrandt(blockedGravityBowlManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const diagnostics = expanded.marks.filter((mark) => mark.spatialPlanDiagnostic);

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(false);
    expect(plan.materializationGate.status).toBe('blocked');
    expect(plan.validation.checks.some((check) => check.role === 'gravity-has-support-surface' && check.ok === false)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'bowl-body-gravity-on-missing-tabletop-support:gravity-resolved' && check.ok === false)).toBe(true);
    expect(diagnostics.length).toBeGreaterThan(1);
    expect(expanded.marks.some((mark) => mark.role === 'bowl-body')).toBe(false);
    expect(expanded.marks.every((mark) => mark.materializationGate === 'blocked')).toBe(true);
  });

  it('keeps prefix-matched vector shadows out of gravity body movement', () => {
    const expanded = expandNeoRembrandt(prefixShadowGravityManifest());
    const lamp = expanded.marks.find((mark) => mark.role === 'lamp');
    const shade = expanded.marks.find((mark) => mark.role === 'lamp-shade');
    const shadow = expanded.marks.find((mark) => mark.role === 'lamp-shadow');
    const plan = expanded.neoRembrandt.spatialPlan;
    const shadowCheck = plan.validation.checks.find((check) => check.role === 'lamp-shadow:shadow-stays-receiver-owned');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(plan.gravityEdges[0].shadowRoles).toEqual(['lamp-shadow']);
    expect(plan.gravityEdges[0].includeRoles).toEqual(['lamp-shade']);
    expect(shadowCheck.ok).toBe(true);
    expect(lamp.metamandalaRelaxed).toBe(true);
    expect(shade.metamandalaRelaxed).toBe(true);
    expect(shadow.metamandalaRelaxed).not.toBe(true);
    expect(shadow.z).toBe(20.1);
    expect(expanded.marks.some((mark) => mark.spatialPlanDiagnostic)).toBe(false);
  });

  it('repairs z order for already-adjacent constellation hitboxes', () => {
    const manifest = constellationHitboxRelaxationManifest();
    manifest.marks[1].points = [[145, 96.97], [195, 96.97], [190, 154.97], [150, 154.97]];
    manifest.marks[1].z = 0;
    const expanded = expandNeoRembrandt(manifest);
    const cup = expanded.marks.find((mark) => mark.role === 'cup');
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments[0];
    const supportMax = Math.max(...expanded.marks
      .filter((mark) => markMatchesRoleForTest(mark, 'table'))
      .map((mark) => mark.z ?? 0));

    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(true);
    expect(adjustment.delta).toEqual([0, 0]);
    expect(adjustment.paintZ).toBeCloseTo(supportMax + 1, 1);
    expect(cup.z).toBeCloseTo(supportMax + 1, 1);
    expect(cup.metamandalaRelaxed).toBe(true);
  });

  it('repairs adjacency z through a surface cube cube sphere stack', () => {
    const expanded = expandNeoRembrandt(stackedHitboxAdjacencyPaintManifest());
    const surface = expanded.marks.find((mark) => mark.role === 'support-surface');
    const bottomCube = expanded.marks.find((mark) => mark.role === 'bottom-cube');
    const topCube = expanded.marks.find((mark) => mark.role === 'top-cube');
    const sphere = expanded.marks.find((mark) => mark.role === 'top-sphere');
    const adjustments = expanded.neoRembrandt.metamandalaRelaxationAdjustments;

    expect(expanded.neoRembrandt.metamandalaRelaxationApplied).toBe(true);
    expect(adjustments.map((item) => item.role)).toEqual([
      'bottom-cube-on-surface',
      'top-cube-on-bottom-cube',
      'sphere-on-top-cube',
    ]);
    expect(adjustments.every((item) => item.delta[0] === 0 && item.delta[1] === 0)).toBe(true);
    expect(bottomCube.z).toBeCloseTo(surface.z + 1, 1);
    expect(topCube.z).toBeCloseTo(bottomCube.z + 1, 1);
    expect(sphere.z).toBeCloseTo(topCube.z + 1, 1);
    expect(bottomCube.contactRegions.baseContact[0][1]).toBeCloseTo(surface.contactRegions.topContact[0][1], 1);
    expect(topCube.contactRegions.baseContact[0][1]).toBeCloseTo(bottomCube.contactRegions.topContact[0][1], 1);
    expect(sphere.contactRegions.baseContact[0][1]).toBeCloseTo(topCube.contactRegions.topContact[0][1], 1);
  });

  it('lowers a gravity horizontal stack and lets push-lock place it on support', () => {
    const manifest = horizontalStackGravityManifest();
    manifest.marks[1].members[0].role = 'cup-left';
    manifest.marks[1].members[1].role = 'box-middle';
    manifest.marks[1].members[2].role = 'orange-right';
    const expanded = expandNeoRembrandt(manifest);
    const plan = expanded.neoRembrandt.spatialPlan;
    const stack = plan.horizontalStacks.find((item) => item.role === 'counter-stack');
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments.find((item) => item.role === 'counter-stack-gravity-on-countertop-support');
    const support = expanded.neoRembrandt.metamandalaSurfaces.find((item) => item.role === 'countertop-support');
    const members = expanded.marks.filter((mark) => mark.horizontalStackRole === 'counter-stack' && mark.horizontalStackMemberRole);
    const solidFaces = members.filter((mark) => mark.solidRole);
    const memberRoles = new Set(members.map((mark) => mark.horizontalStackMemberRole));
    const memberBaseY = Math.max(...members.flatMap((mark) => mark.contactRegions?.baseContact || []).map((point) => point[1]));

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(stack).toMatchObject({
      mode: 'gravity',
      memberCollision: 'avoid',
      supportRole: 'countertop-support',
      skinPolicy: 'separate',
    });
    expect(memberRoles).toEqual(new Set(['cup-left', 'box-middle', 'orange-right']));
    expect(solidFaces.some((mark) => mark.face === 'bottom' || mark.face === 'back')).toBe(false);
    expect(adjustment).toMatchObject({
      reason: 'horizontal-stack-gravity-push-lock',
      surfaceRole: 'countertop-support',
    });
    expect(adjustment.delta[1]).toBeLessThan(0);
    expect(memberBaseY).toBeCloseTo(support.supportRail.y, 1);
    expect(plan.gravityEdges.some((edge) => edge.bodyRole === 'counter-stack' && edge.resolved)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'counter-stack:gravity-stack-has-support-role' && check.ok)).toBe(true);
  });

  it('lowers direct mandalaArrangement through a local lateral support basis', () => {
    const expanded = expandNeoRembrandt(mandalaArrangementGravityManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const arrangement = plan.mandalaArrangements.find((item) => item.role === 'counter-stack');
    const stack = plan.horizontalStacks.find((item) => item.role === 'counter-stack');
    const member = expanded.marks.find((mark) => mark.horizontalStackMemberRole === 'cup-left');
    const adjustment = expanded.neoRembrandt.metamandalaRelaxationAdjustments.find((item) => item.role === 'counter-stack-gravity-on-countertop-support');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(arrangement).toMatchObject({
      profile: 'horizontal-stack',
      activeRay: 'east-west',
      basisKind: 'local-lateral-support',
      localSpace: 'cca-local',
      members: ['cup-left', 'box-middle', 'orange-right'],
    });
    expect(arrangement.basis.origin).toEqual([94, 238]);
    expect(arrangement.memberDetails[0]).toMatchObject({
      role: 'cup-left',
      interval: [0, 34],
      contactPolicy: 'repel-until-contact',
      floater: false,
    });
    expect(stack.basisKind).toBe('local-lateral-support');
    expect(stack.activeRay).toBe('east-west');
    expect(member.mandalaArrangementSlot.local).toEqual([0, 0]);
    expect(member.mandalaArrangementBasis.origin).toEqual([94, 238]);
    expect(member.mandalaArrangementActiveRay).toBe('east-west');
    expect(adjustment.reason).toBe('horizontal-stack-gravity-push-lock');
    expect(plan.validation.checks.some((check) => check.role === 'counter-stack:mandala-arrangement-has-basis' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'counter-stack:mandala-arrangement-has-active-ray' && check.ok)).toBe(true);
  });

  it('reports ray contact overlaps for gravity members on the active east-west ray', () => {
    const expanded = expandNeoRembrandt(rayContactArrangementManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const arrangement = plan.mandalaArrangements.find((item) => item.role === 'market-stalls');
    const first = arrangement.memberDetails.find((item) => item.role === 'stall-a');
    const second = arrangement.memberDetails.find((item) => item.role === 'stall-b');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(arrangement).toMatchObject({
      profile: 'ray-contact-stack',
      activeRay: 'east-west',
      rayVector: [1, 0],
    });
    expect(first.interval).toEqual([0, 54]);
    expect(second.intervalBefore[0]).toBeLessThan(first.intervalBefore[1]);
    expect(second.interval[0]).toBe(first.interval[1]);
    expect(second.displacement).toBeGreaterThan(0);
    expect(arrangement.rayOverlaps).toEqual([
      expect.objectContaining({
        roles: ['stall-a', 'stall-b'],
        policy: 'repel-until-contact',
        floater: false,
        resolved: true,
        overlap: 0,
      }),
    ]);
    expect(plan.validation.checks.some((check) => check.role === 'market-stalls:stall-a+stall-b:ray-overlap-policy' && check.policy === 'repel-until-contact')).toBe(true);
  });

  it('keeps non-gravity floaters in floater policy instead of forcing ray contact', () => {
    const expanded = expandNeoRembrandt(rayContactFloaterManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const arrangement = plan.mandalaArrangements.find((item) => item.role === 'sign-and-stall');
    const floater = arrangement.memberDetails.find((item) => item.role === 'floating-sign');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(floater).toMatchObject({
      floater: true,
      floaterPolicy: 'allow-superposition',
      contactPolicy: 'floater',
    });
    expect(arrangement.rayOverlaps).toEqual([
      expect.objectContaining({
        roles: ['stall', 'floating-sign'],
        policy: 'floater-policy',
        floater: true,
      }),
    ]);
  });

  it('treats north-south ray movement as floor-depth rather than vertical stacking', () => {
    const expanded = expandNeoRembrandt(northSouthRayContactManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const arrangement = plan.mandalaArrangements.find((item) => item.role === 'street-depth-buildings');
    const near = expanded.marks.find((mark) => mark.horizontalStackMemberRole === 'near-building');
    const far = expanded.marks.find((mark) => mark.horizontalStackMemberRole === 'far-building');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(arrangement.activeRay).toBe('north-south');
    expect(arrangement.rayVector).toEqual([0.607, -0.795]);
    expect(arrangement.memberDetails[0].interval).toEqual([0, 34]);
    expect(arrangement.memberDetails[1].intervalBefore[0]).toBeLessThan(arrangement.memberDetails[0].intervalBefore[1]);
    expect(arrangement.memberDetails[1].interval[0]).toBe(arrangement.memberDetails[0].interval[1]);
    expect(far.mandalaArrangementSlot.baselineY).toBeLessThan(near.mandalaArrangementSlot.baselineY);
    expect(far.mandalaArrangementActiveRay).toBe('north-south');
  });

  it('pushes three nearly co-located pyramid subjects sideways on a shared floor ray', () => {
    const expanded = expandNeoRembrandt(pyramidRayBounceManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const arrangement = plan.mandalaArrangements.find((item) => item.role === 'pyramid-cluster');
    const details = arrangement.memberDetails;
    const pyramidFaces = expanded.marks.filter((mark) => mark.horizontalStackRole === 'pyramid-cluster' && mark.solidRole);
    const bases = pyramidFaces.filter((mark) => mark.face === 'front').map((mark) => mark.contactRegions?.baseContact?.[0]?.[1]).filter(Number.isFinite);

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(arrangement.activeRay).toBe('east-west');
    expect(details.map((item) => item.intervalBefore)).toEqual([[0, 86], [1, 87], [0, 86]]);
    expect(details.map((item) => item.interval)).toEqual([[0, 86], [86, 172], [172, 258]]);
    expect(details.map((item) => item.displacement)).toEqual([0, 85, 172]);
    expect(arrangement.rayOverlaps).toEqual([
      expect.objectContaining({ roles: ['pyramid-north', 'pyramid-east'], overlapBefore: 85, overlap: 0, resolved: true }),
      expect.objectContaining({ roles: ['pyramid-north', 'pyramid-south'], overlapBefore: 86, overlap: 0, resolved: true }),
      expect.objectContaining({ roles: ['pyramid-east', 'pyramid-south'], overlapBefore: 85, overlap: 0, resolved: true }),
    ]);
    expect(new Set(pyramidFaces.map((mark) => mark.mandalaArrangementActiveRay))).toEqual(new Set(['east-west']));
    expect(Math.max(...bases) - Math.min(...bases)).toBeLessThanOrEqual(2);
  });

  it('lowers a superposition horizontal stack into overlapping members and a joined skin', () => {
    const expanded = expandNeoRembrandt(horizontalStackSuperpositionManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const stack = plan.horizontalStacks.find((item) => item.role === 'cloud-bank');
    const members = expanded.marks.filter((mark) => mark.horizontalStackRole === 'cloud-bank' && mark.horizontalStackMemberRole);
    const joined = expanded.marks.find((mark) => mark.role === 'cloud-bank:joined-skin');
    const firstBounds = members[0].contactRegions.bounds;
    const secondBounds = members[1].contactRegions.bounds;
    const overlapWidth = Math.min(firstBounds.x + firstBounds.width, secondBounds.x + secondBounds.width) - Math.max(firstBounds.x, secondBounds.x);

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(stack).toMatchObject({
      mode: 'superposition',
      memberCollision: 'allow',
      skinPolicy: 'join',
      hasJoinedSkin: true,
      joinedSkinRole: 'cloud-bank:joined-skin',
    });
    expect(members).toHaveLength(3);
    expect(overlapWidth).toBeGreaterThan(0);
    expect(joined).toMatchObject({
      horizontalStackJoinedSkin: true,
      skinMapJoin: true,
      compoundSkin: true,
      sourceShape: 'horizontal-stack-joined-skin',
    });
    expect(plan.validation.checks.some((check) => check.role === 'cloud-bank:superposition-stack-allows-overlap' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'cloud-bank:superposition-stack-has-joined-skin' && check.ok)).toBe(true);
  });

  it('expands a cubie lattice into suspended cubie solids without drawing cut lines', () => {
    const expanded = expandNeoRembrandt(suspendedCubieLatticeManifest());
    const cubieFaces = expanded.marks.filter((mark) => mark.source && mark.cubieLatticeRole === 'suspended-cube-lattice');
    const cubieIds = new Set(cubieFaces.map((mark) => mark.solidRole));

    expect(expanded.marks.some((mark) => mark.kind === 'cubieLattice')).toBe(false);
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.neoRembrandt.constructionResolvedMarkCount).toBe(27);
    expect(cubieIds).toHaveLength(27);
    expect(new Set(cubieFaces.map((mark) => mark.cubieCol))).toEqual(new Set([0, 1, 2]));
    expect(new Set(cubieFaces.map((mark) => mark.cubieRow))).toEqual(new Set([0, 1, 2]));
    expect(new Set(cubieFaces.map((mark) => mark.cubieLayer))).toEqual(new Set([0, 1, 2]));
    expect(cubieFaces.every((mark) => mark.cubieCount === 27)).toBe(true);
    expect(expanded.marks.some((mark) => /cut|void/i.test(mark.role || ''))).toBe(false);
  });

  it('can crawl cubie lattice depth layers along the floor plane toward the vanishing point', () => {
    const expanded = expandNeoRembrandt(floorMandalaCubieLatticeManifest());
    const faces = expanded.marks.filter((mark) => mark.source && mark.cubieLatticeRole === 'suspended-cube-lattice');
    const centersByLayer = [0, 1, 2].map((layer) => {
      const layerFaces = faces.filter((mark) => mark.cubieLayer === layer && mark.face === 'front');
      const anchors = layerFaces.map((mark) => mark.depthAnchor);
      return [
        anchors.reduce((sum, point) => sum + point[0], 0) / anchors.length,
        anchors.reduce((sum, point) => sum + point[1], 0) / anchors.length,
      ];
    });
    const sizes = [0, 1, 2].map((layer) => {
      const face = faces.find((mark) => mark.cubieLayer === layer && mark.face === 'front');
      return face.cubieCellSize;
    });
    const vp = expanded.scene.perspective.vanishingPoint;

    expect(new Set(faces.map((mark) => mark.cubieDepthMode))).toEqual(new Set(['floor-plane']));
    expect(sizes[2]).toBeLessThan(sizes[0]);
    expect(distance(centersByLayer[2], vp)).toBeLessThan(distance(centersByLayer[0], vp));
    expect(centersByLayer[2][1]).toBeLessThan(centersByLayer[0][1]);
  });

  it('can generate cubie lattice positions from pure mandala world coordinates', () => {
    const expanded = expandNeoRembrandt(pureMandalaCubieLatticeManifest());
    const faces = expanded.marks.filter((mark) => mark.source && mark.cubieLatticeRole === 'suspended-cube-lattice');
    const frontFaces = faces.filter((mark) => mark.face === 'front');
    const cubieIds = new Set(faces.map((mark) => mark.solidRole));
    const rowCenters = [0, 2].map((row) => {
      const rowFaces = frontFaces.filter((mark) => mark.cubieRow === row);
      return rowFaces.reduce((sum, mark) => sum + mark.depthAnchor[1], 0) / rowFaces.length;
    });
    const layerCenters = [0, 2].map((layer) => {
      const layerFaces = frontFaces.filter((mark) => mark.cubieLayer === layer);
      return [
        layerFaces.reduce((sum, mark) => sum + mark.depthAnchor[0], 0) / layerFaces.length,
        layerFaces.reduce((sum, mark) => sum + mark.depthAnchor[1], 0) / layerFaces.length,
      ];
    });

    expect(cubieIds).toHaveLength(27);
    expect(new Set(faces.map((mark) => mark.cubieDepthMode))).toEqual(new Set(['pure-mandala']));
    expect(frontFaces.every((mark) => Array.isArray(mark.cubieWorldXYZ))).toBe(true);
    expect(rowCenters[0]).toBeLessThan(rowCenters[1]);
    expect(layerCenters[1][1]).toBeLessThan(layerCenters[0][1]);
  });

  it('projects a pure mandala room through a two-point camera primitive', () => {
    const expanded = expandNeoRembrandt(twoPointRoomManifest());
    const floorX = expanded.marks.find((mark) => mark.role === 'floor:grid-x-y-28');
    const floorY = expanded.marks.find((mark) => mark.role === 'floor:grid-y-x-18');
    const ceilingX = expanded.marks.find((mark) => mark.role === 'ceiling:grid-x-y-28');
    const door = expanded.marks.find((mark) => mark.role === 'room:back-door');
    const fixture = expanded.marks.find((mark) => mark.role === 'ceiling-light');
    const feet = expanded.marks.find((mark) => mark.role === 'figure:floor-pin');
    const vpLeft = [-220 - 180, 245 - 90];
    const vpRight = [1180 - 180, 245 - 90];

    expect(expanded.viewBox).toEqual({ width: 620, height: 430 });
    expect(expanded.scene.perspective.mode).toBe('two-point');
    expect(expanded.polygonizer.twoPointCamera.generated).toBe(true);
    expect(expanded.polygonizer.twoPointCamera.cropApplied).toBe(true);
    expect(floorX).toBeTruthy();
    expect(floorY).toBeTruthy();
    expect(ceilingX).toBeTruthy();
    expect(door?.kind).toBe('polygon');
    expect(fixture?.kind).toBe('circle');
    expect(feet?.kind).toBe('line');

    expect(Math.abs(cross([floorX.x2 - floorX.x1, floorX.y2 - floorX.y1], [vpRight[0] - floorX.x1, vpRight[1] - floorX.y1]))).toBeLessThan(1);
    expect(Math.abs(cross([ceilingX.x2 - ceilingX.x1, ceilingX.y2 - ceilingX.y1], [vpRight[0] - ceilingX.x1, vpRight[1] - ceilingX.y1]))).toBeLessThan(1);
    expect(Math.abs(cross([floorY.x2 - floorY.x1, floorY.y2 - floorY.y1], [vpLeft[0] - floorY.x1, vpLeft[1] - floorY.y1]))).toBeLessThan(1);
    expect(door.points[2][1]).toBeLessThan(door.points[1][1]);
  });

  it('normalizes grid-render style to 1px grid strokes and borderless filled surfaces', () => {
    const expanded = expandNeoRembrandt(twoPointRoomManifest());
    const floorGrid = expanded.marks.find((mark) => mark.role === 'floor:grid-x-y-28');
    const door = expanded.marks.find((mark) => mark.role === 'room:back-door');
    const floor = expanded.marks.find((mark) => mark.role === 'room:floor-plane');

    expect(floorGrid?.strokeWidth).toBe(1);
    expect(door?.stroke).toBe('none');
    expect(door?.strokeWidth).toBe(0);
    expect(floor?.stroke).toBe('none');
    expect(floor?.strokeWidth).toBe(0);
  });

  it('does not flatten stylized sticker stroke widths in grid-render context', () => {
    const manifest = pastamakerRingManifest();
    manifest.polygonizer = {
      pureMandala: { kind: 'style-contract-test' },
    };
    const expanded = expandNeoRembrandt(manifest);
    const rimStrokes = expanded.marks.filter((mark) => mark.stickerFieldRole === 'rim-highlight-strokes');
    const blackHole = expanded.marks.find((mark) => mark.role === 'black-hole-shadow');

    expect(blackHole?.stroke).toBe('none');
    expect(blackHole?.strokeWidth).toBe(0);
    expect(rimStrokes.length).toBeGreaterThan(0);
    expect(rimStrokes.every((mark) => mark.algorithm === 'pastamaker')).toBe(true);
    expect(new Set(rimStrokes.map((mark) => mark.strokeWidth))).toEqual(new Set([2]));
  });

  it('keeps an inside-room hallway and static scale objects on the two-point camera basis', () => {
    const expanded = expandNeoRembrandt(twoPointInRoomManifest());
    const hallway = expanded.marks.find((mark) => mark.role === 'room:back-hallway-opening');
    const hallwayFloor = expanded.marks.find((mark) => mark.role === 'hallway:floor-run');
    const shelfFace = expanded.marks.find((mark) => mark.role === 'shelf:front-face');
    const shelfLine = expanded.marks.find((mark) => mark.role === 'shelf:shelf-line-2');
    const barTop = expanded.marks.find((mark) => mark.role === 'bar:top-face');
    const tableContact = expanded.marks.find((mark) => mark.role === 'table:floor-contact');
    const feet = expanded.marks.find((mark) => mark.role === 'figure:floor-pin');

    expect(expanded.viewBox).toEqual({ width: 760, height: 500 });
    expect(hallway?.kind).toBe('polygon');
    expect(hallwayFloor?.kind).toBe('polygon');
    expect(shelfFace?.kind).toBe('polygon');
    expect(shelfLine?.kind).toBe('line');
    expect(barTop?.kind).toBe('polygon');
    expect(tableContact?.kind).toBe('line');
    expect(feet?.kind).toBe('line');
    expect(expanded.polygonizer.twoPointCamera.projectedPins.map((pin) => pin.role)).toEqual(
      expect.arrayContaining(['hallway', 'shelf', 'bar', 'table', 'figure']),
    );
  });

  it('projects opposing side hallways from one hallway viewpoint', () => {
    const expanded = expandNeoRembrandt(twoOpposingHallwaysManifest());
    const nearOpening = expanded.marks.find((mark) => mark.role === 'room:near-hallway-opening');
    const nearFloor = expanded.marks.find((mark) => mark.role === 'near-hallway:floor-run');
    const oppositeOpening = expanded.marks.find((mark) => mark.role === 'room:opposite-hallway-opening');
    const oppositeFloor = expanded.marks.find((mark) => mark.role === 'opposite-hallway:floor-run');
    const tableTop = expanded.marks.find((mark) => mark.role === 'table:top-face');
    const shelfFace = expanded.marks.find((mark) => mark.role === 'shelf:front-face');
    const pins = expanded.polygonizer.twoPointCamera.projectedPins.map((pin) => pin.role);

    expect(expanded.viewBox).toEqual({ width: 470, height: 330 });
    expect(nearOpening?.kind).toBe('polygon');
    expect(nearFloor?.kind).toBe('polygon');
    expect(oppositeOpening?.kind).toBe('polygon');
    expect(oppositeFloor?.kind).toBe('polygon');
    expect(tableTop?.kind).toBe('polygon');
    expect(shelfFace?.kind).toBe('polygon');
    expect(pins).toEqual(expect.arrayContaining(['near-hallway', 'opposite-hallway', 'figure']));
  });

  it('can use a hidden figure pin as the camera eye without rendering the body', () => {
    const expanded = expandNeoRembrandt(twoOpposingHallwaysCameraViewManifest());
    const pins = expanded.polygonizer.twoPointCamera.projectedPins.map((pin) => pin.role);

    expect(expanded.viewBox).toEqual({ width: 430, height: 315 });
    expect(pins).toEqual(expect.arrayContaining(['camera-figure', 'near-hallway', 'opposite-hallway']));
    expect(expanded.marks.some((mark) => /figure/.test(mark.role || ''))).toBe(false);
    expect(expanded.marks.some((mark) => mark.role === 'room:near-hallway-opening')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'room:opposite-hallway-opening')).toBe(true);
  });

  it('renders a plain box room from a hidden doorway camera pin', () => {
    const expanded = expandNeoRembrandt(twoPointDoorwayBoxRoomManifest());
    const roles = expanded.marks.map((mark) => mark.role);

    expect(expanded.viewBox).toEqual({ width: 590, height: 300 });
    expect(expanded.polygonizer.twoPointCamera.projectedPins.map((pin) => pin.role)).toContain('camera-figure');
    expect(expanded.marks.some((mark) => /figure/.test(mark.role || ''))).toBe(false);
    expect(roles).toEqual(expect.arrayContaining([
      'room:floor-plane',
      'room:ceiling-plane',
      'room:left-wall-plane',
      'room:right-wall-plane',
      'room:back-wall-plane',
    ]));
    expect(expanded.marks.some((mark) => /hallway|door/.test(mark.role || ''))).toBe(false);
  });

  it('uses a centered doorway camera point to zoom into a square room interior', () => {
    const expanded = expandNeoRembrandt(twoPointCenteredDoorSquareRoomManifest());
    const floor = expanded.marks.find((mark) => mark.role === 'room:floor-plane');
    const ceiling = expanded.marks.find((mark) => mark.role === 'room:ceiling-plane');
    const grammar = expanded.polygonizer.twoPointCamera.cameraGrammar;

    expect(expanded.viewBox).toEqual({ width: 350, height: 245 });
    expect(expanded.cameraPrimitive.cameraPoint.kind).toBe('doorway-entry-eye');
    expect(expanded.polygonizer.twoPointCamera.projectedPins.map((pin) => pin.role)).toContain('center-door-camera');
    expect(expanded.polygonizer.twoPointCamera.projectedPins[0].spawnDirection).toBe('floor-up');
    expect(grammar.kind).toBe('axis-mundi-eye-line');
    expect(grammar.frameCenter).toEqual([380, 352.5]);
    expect(grammar.axisMundi.directEyeLine).toBe(true);
    expect(grammar.topPlane.spawnDirection).toBe('ceiling-down');
    expect(grammar.bottomPlane.spawnDirection).toBe('floor-up');
    expect(grammar.bottomPlane.arcTension).toBeGreaterThan(0.3);
    expect(grammar.mandalaFlow).toContain('spawn floor objects upward and ceiling/sky objects downward');
    expect(expanded.marks.some((mark) => /figure|hallway|door/.test(mark.role || ''))).toBe(false);
    expect(Math.max(...floor.points.map((p) => p[1]))).toBeGreaterThan(240);
    expect(Math.min(...ceiling.points.map((p) => p[1]))).toBeLessThan(25);
  });

  it('stress tests camera grammar with a basic condo living room scene', () => {
    const expanded = expandNeoRembrandt(condoLivingRoomManifest());
    const pins = expanded.polygonizer.twoPointCamera.projectedPins;
    const pinByRole = new Map(pins.map((pin) => [pin.role, pin]));

    expect(expanded.polygonizer.twoPointCamera.cameraGrammar.kind).toBe('axis-mundi-eye-line');
    expect(expanded.marks.some((mark) => mark.role === 'sofa:front-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'coffee-table:top-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'media-console:front-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'side-table:top-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'ceiling-light')).toBe(true);
    expect(pinByRole.get('sofa')?.spawnDirection).toBe('floor-up');
    expect(pinByRole.get('coffee-table')?.spawnDirection).toBe('floor-up');
    expect(pinByRole.get('ceiling-light')?.spawnDirection).toBe('ceiling-down');
    expect(expanded.marks.some((mark) => /figure/.test(mark.role || ''))).toBe(false);
  });

  it('renders a substantial condo living room from a straight doorway camera', () => {
    const expanded = expandNeoRembrandt(straightCondoLivingRoomManifest());
    const backWall = expanded.marks.find((mark) => mark.role === 'room:back-wall-plane');
    const rug = expanded.marks.find((mark) => mark.role === 'rug');

    expect(expanded.viewBox).toEqual({ width: 500, height: 430 });
    expect(expanded.cameraPrimitive.cameraPoint.kind).toBe('doorway-straight-eye');
    expect(backWall.points[0][1]).toBe(backWall.points[1][1]);
    expect(backWall.points[2][1]).toBe(backWall.points[3][1]);
    expect(rug?.kind).toBe('polygon');
    expect(expanded.marks.some((mark) => mark.role === 'coffee-table:top-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'sofa:front-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'media-console:front-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'back-left-figure:floor-pin')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'front-right-figure:floor-pin')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'entry-camera:floor-pin')).toBe(false);
    const backHead = expanded.marks.find((mark) => mark.role === 'back-left-figure:head');
    const frontHead = expanded.marks.find((mark) => mark.role === 'front-right-figure:head');
    expect(frontHead.r).toBeGreaterThan(backHead.r);
  });

  it('promotes the straight doorway camera into a full-frame room concept plan', () => {
    const expanded = expandNeoRembrandt(fullFrameRoomConceptManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const room = plan.roomConcept;

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(plan.contract.mode).toBe('plan-before-skin');
    expect(plan.stages.map((stage) => stage.id)).toContain('room-concept');
    expect(room.kind).toBe('interior-room');
    expect(room.source).toBe('declared');
    expect(room.localSpace).toBe('cca-local-space');
    expect(room.normalization).toBe('project-after-planning');
    expect(room.camera).toMatchObject({
      mode: 'predetermined-vector',
      primitive: 'two-point-straight-doorway',
      predeterminedVector: 'doorway-straight-eye',
      subjectFraming: 'full-frame-room',
    });
    expect(room.frame.floorPlane).toBe(true);
    expect(room.frame.leftWall).toBe(true);
    expect(room.frame.rightWall).toBe(true);
    expect(room.frame.backWall).toBe(true);
    expect(room.frame.coverage.width).toBeGreaterThanOrEqual(0.92);
    expect(room.frame.coverage.height).toBeGreaterThanOrEqual(0.9);
    expect(room.pinnedElements.map((pin) => pin.role)).toEqual(expect.arrayContaining([
      'sofa',
      'coffee-table',
      'media-console',
      'front-right-figure',
    ]));
    expect(plan.validation.checks.some((check) => check.role === 'room-full-frame-envelope' && check.ok)).toBe(true);
    expect(expanded.marks.some((mark) => mark.spatialPlanDiagnostic)).toBe(false);
    expect(expanded.marks.find((mark) => mark.role === 'sofa:front-face')?.spatialPlanMaterialized).toBe(true);
  });

  it('renders a person-eye room with a bed and closet through the full-frame room concept', () => {
    const expanded = expandNeoRembrandt(personEyeBowlingRoomManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const room = plan.roomConcept;
    const bed = expanded.marks.find((mark) => mark.role === 'bed:top-face');
    const closet = expanded.marks.find((mark) => mark.role === 'closet:front-face');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(expanded.viewBox).toEqual({ width: 500, height: 430 });
    expect(expanded.cameraPrimitive.cameraPoint.kind).toBe('doorway-straight-eye');
    expect(room.camera).toMatchObject({
      mode: 'predetermined-vector',
      primitive: 'two-point-straight-doorway',
      predeterminedVector: 'doorway-straight-eye',
      subjectFraming: 'full-frame-room',
    });
    expect(room.placementSpace.supportPlane).toBe('room:floor-plane');
    expect(room.pinnedElements.map((pin) => pin.role)).toEqual(expect.arrayContaining([
      'person-eye-camera',
      'bed',
      'closet',
      'ceiling-light',
    ]));
    expect(plan.validation.checks.some((check) => check.role === 'bed:room-pin-projected' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'closet:room-pin-projected' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'room-full-frame-envelope' && check.ok)).toBe(true);
    expect(bed?.kind).toBe('polygon');
    expect(closet?.kind).toBe('polygon');
    expect(expanded.marks.some((mark) => mark.role === 'person-eye-camera:floor-pin')).toBe(false);
    expect(expanded.marks.some((mark) => mark.spatialPlanDiagnostic)).toBe(false);
    expect(bed.spatialPlanMaterialized).toBe(true);
    expect(closet.spatialPlanMaterialized).toBe(true);
  });

  it('lowers a person-eye room shot glyph into camera, room envelope, light, and window wedge facts', () => {
    const expanded = expandNeoRembrandt(shotGlyphPersonEyeRoomManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const glyph = plan.shotGlyphs[0];
    const room = plan.roomConcept;

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(glyph).toMatchObject({
      id: 'person-eye-room-window-light',
      family: 'interior-shot-glyph',
      cameraVector: 'doorway-straight-eye',
      lightEntry: 'back-right-wall-window',
      support: 'floor-depth',
    });
    expect(expanded.cameraPrimitive.cameraPoint.kind).toBe('doorway-straight-eye');
    expect(expanded.polygonizer.twoPointCamera.generated).toBe(true);
    expect(plan.cameraWindow.terminatorVectors.left).toEqual([-0.62, -1]);
    expect(expanded.scene.light.source).toBe('metamandala-light');
    expect(expanded.scene.light.role).toBe('window-key-light');
    expect(room.camera.subjectFraming).toBe('full-frame-room');
    expect(room.pinnedElements.map((pin) => pin.role)).toEqual(expect.arrayContaining(['bed', 'window']));
    expect(plan.validation.checks.some((check) => check.role === 'person-eye-room-window-light:shot-glyph-has-camera-vector' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'room-full-frame-envelope' && check.ok)).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'bed:top-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.spatialPlanDiagnostic)).toBe(false);
  });

  it('lowers a tabletop shot glyph into a camera wedge and key light without needing a room concept', () => {
    const expanded = expandNeoRembrandt(shotGlyphTabletopManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const glyph = plan.shotGlyphs[0];

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(glyph).toMatchObject({
      id: 'tabletop-three-quarter-key',
      family: 'object-shot-glyph',
      cameraVector: 'three-quarter-down',
      lightEntry: 'upper-left-key',
      support: 'tabletop-plane',
    });
    expect(expanded.scene.perspective.mode).toBe('one-point');
    expect(plan.cameraWindow.terminatorVectors.right).toEqual([0.75, -1]);
    expect(expanded.scene.light.role).toBe('upper-left-key');
    expect(plan.roomConcept).toBe(null);
    expect(plan.validation.checks.some((check) => check.role === 'tabletop-three-quarter-key:shot-glyph-has-support' && check.ok)).toBe(true);
  });

  it('lowers a different corner-eye room shot glyph into an asymmetric room profile', () => {
    const expanded = expandNeoRembrandt(shotGlyphCornerEyeRoomManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const glyph = plan.shotGlyphs[0];
    const room = plan.roomConcept;

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(glyph).toMatchObject({
      id: 'corner-eye-room-diagonal-window-light',
      family: 'interior-shot-glyph',
      cameraVector: 'corner-eye-diagonal',
      lightEntry: 'side-wall-window',
      support: 'floor-depth',
    });
    expect(expanded.cameraPrimitive.cameraPoint.kind).toBe('corner-eye');
    expect(room.camera.primitive).toBe('two-point-corner-eye');
    expect(room.camera.subjectFraming).toBe('diagonal-room-profile');
    expect(plan.cameraWindow.terminatorVectors.left).toEqual([-0.84, -1]);
    expect(plan.cameraWindow.terminatorVectors.right).toEqual([0.48, -1]);
    expect(expanded.scene.light.role).toBe('side-window-key-light');
    expect(room.pinnedElements.map((pin) => pin.role)).toEqual(expect.arrayContaining(['bed', 'window', 'side-table']));
    expect(plan.validation.checks.some((check) => check.role === 'corner-eye-room-diagonal-window-light:shot-glyph-has-light-entry' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'room-full-frame-envelope')).toBe(false);
    expect(expanded.marks.some((mark) => mark.role === 'bed:top-face')).toBe(true);
    expect(expanded.marks.some((mark) => mark.role === 'side-table:top-face')).toBe(true);
  });

  it('lowers a School of Athens shot glyph into a central one-point hall mandala and Meru basis', () => {
    const expanded = expandNeoRembrandt(schoolOfAthensGlyphManifest());
    const plan = expanded.neoRembrandt.spatialPlan;
    const glyph = plan.shotGlyphs[0];
    const floor = expanded.marks.find((mark) => mark.role === 'hall-floor');
    const meruSurface = expanded.neoRembrandt.metamandalaSurfaces.find((surface) => surface.role === 'hall-floor-meru');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(glyph).toMatchObject({
      id: 'school-of-athens-central-hall',
      family: 'civic-interior-shot-glyph',
      cameraVector: 'central-one-point',
      vanishingHub: 'axis-mundi-center',
      lightEntry: 'high-side-ambient',
      support: 'floor-depth-grid',
      staging: 'symmetrical-depth-bands',
    });
    expect(expanded.scene.perspective).toMatchObject({
      mode: 'one-point',
      horizonY: 220,
      vanishingPoint: [490, 220],
    });
    expect(plan.cameraWindow.terminatorVectors.left).toEqual([-0.9, -1]);
    expect(plan.cameraWindow.terminatorVectors.right).toEqual([0.9, -1]);
    expect(plan.hallMandala.kind).toBe('central-one-point-civic-hall');
    expect(plan.hallMandala.axisMundi.role).toBe('central-asterisk');
    expect(plan.hallMandala.slots).toEqual(expect.arrayContaining(['central-thesis', 'left-cluster', 'right-cluster', 'back-arch']));
    expect(plan.meru.basis).toBe('central-hall-meru');
    expect(plan.validation.checks.some((check) => check.role === 'school-of-athens-central-hall:shot-glyph-has-vanishing-hub' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'hall-mandala-has-axis-mundi' && check.ok)).toBe(true);
    expect(plan.validation.checks.some((check) => check.role === 'meru-normalized-to-metamandala' && check.ok)).toBe(true);
    expect(expanded.scene.light.role).toBe('high-side-ambient');
    expect(meruSurface?.kind).toBe('axisFloor');
    expect(floor?.visionPaneProjectionMode).toBe('horizon-boundary');
    expect(expanded.marks.some((mark) => mark.role === 'axis-mundi-asterisk')).toBe(true);
  });

  it('uses the School of Athens glyph as a general grid for arbitrary subject clusters', () => {
    const expanded = expandNeoRembrandt(schoolOfAthensGlyphManifest({ arbitrary: true }));
    const plan = expanded.neoRembrandt.spatialPlan;
    const leftSubjects = expanded.marks.filter((mark) => mark.constructionRole === 'left-robots');
    const rightSubjects = expanded.marks.filter((mark) => mark.constructionRole === 'right-fruit-statues');

    expect(expanded.neoRembrandt.spatialPlanValid).toBe(true);
    expect(plan.hallMandala.symmetry).toBe('bilateral-around-axis-mundi');
    expect(plan.hallMandala.depthBands).toEqual(['foreground-steps', 'mid-figures', 'back-arch']);
    expect(leftSubjects.length).toBeGreaterThan(0);
    expect(rightSubjects.length).toBeGreaterThan(0);
    expect(expanded.marks.some((mark) => mark.role === 'central-orb-plinth:front')).toBe(true);
    expect(expanded.marks.some((mark) => mark.spatialPlanDiagnostic)).toBe(false);
  });

  it('resolves polygonizer partition marks into shelf-board solids without a bookshelf preset', () => {
    const expanded = expandNeoRembrandt(polygonizerBookshelfManifest());
    const sources = expanded.marks.filter((m) => m.source);
    const partitionFaces = sources.filter((m) => m.constructionKind === 'partition');
    const internalBoards = partitionFaces.filter((m) => m.face === 'front' && m.partitionBoundary === 'internal');

    expect(expanded.polygonizer.subject).toBe('bookshelf');
    expect(expanded.neoRembrandt.polygonizerSubject).toBe('bookshelf');
    expect(expanded.neoRembrandt.constructionMarkCount).toBe(2);
    expect(expanded.marks.some((m) => ['solidPreset', 'partition', 'array'].includes(m.kind))).toBe(false);
    expect(sources.some((m) => m.solidPresetRef === 'bookshelf')).toBe(false);
    expect(new Set(partitionFaces.map((m) => m.partitionBoardIndex))).toHaveLength(5);
    expect(internalBoards).toHaveLength(3);
    expect(partitionFaces.every((m) => m.partitionCount === 4)).toBe(true);
  });

  it('resolves polygonizer arrays into repeated bridge suspenders and keeps tower facts auditable', () => {
    const expanded = expandNeoRembrandt(polygonizerBridgeManifest());
    const suspenders = expanded.marks.filter((m) => m.source && m.constructionKind === 'array' && m.constructionRole === 'suspenders');
    const towers = expanded.marks.filter((m) => m.source && /(?:near|far)-tower:front/.test(m.role || ''));

    expect(expanded.polygonizer.subject).toBe('golden gate bridge');
    expect(expanded.polygonizer.realityFacts).toEqual(expect.arrayContaining(['two main towers', 'vertical suspenders repeat along span']));
    expect(towers).toHaveLength(2);
    expect(suspenders).toHaveLength(14);
    expect(suspenders.every((m) => m.kind === 'line')).toBe(true);
    expect(suspenders.every((m) => m.y1 < m.y2)).toBe(true);
    expect(expanded.marks.some((m) => m.kind === 'array')).toBe(false);

    const deckTop = expanded.marks.find((m) => m.source && m.role === 'deck:top');
    const vp = expanded.scene.perspective.vanishingPoint;
    const backLeft = deckTop.points[0];
    const frontLeft = deckTop.points[3];
    expect(Math.abs(cross([backLeft[0] - frontLeft[0], backLeft[1] - frontLeft[1]], [vp[0] - frontLeft[0], vp[1] - frontLeft[1]]))).toBeLessThan(1);
  });

  it('lowers a seeded swirl field into deterministic vector smoke glyph marks', () => {
    const expanded = expandNeoRembrandt(vectorSmokeSwirlFieldManifest());
    const smoke = expanded.marks.filter((mark) => mark.vectorSmoke);
    const lines = smoke.filter((mark) => mark.kind === 'polyline');
    const masses = smoke.filter((mark) => mark.sourceShape === 'blob');
    const repeated = expandNeoRembrandt(vectorSmokeSwirlFieldManifest());
    const repeatedLines = repeated.marks.filter((mark) => mark.vectorSmoke && mark.kind === 'polyline');

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.marks.some((mark) => mark.kind === 'swirlField')).toBe(false);
    expect(lines).toHaveLength(14);
    expect(masses).toHaveLength(14);
    expect(lines[0].points).toHaveLength(30);
    expect(lines[0].swirlGlyphSeed).toBe('chimney-smoke-proof:0');
    expect(new Set(lines.map((mark) => mark.swirlGlyphHandedness))).toEqual(new Set(['counterclockwise', 'clockwise']));
    expect(lines.every((mark) => mark.opacity > 0 && mark.opacity <= 1)).toBe(true);
    expect(lines.map((mark) => mark.points)).toEqual(repeatedLines.map((mark) => mark.points));
  });

  it('applies mandala perspective sizing to fluid glyphs before lowering', () => {
    const manifest = vectorSmokeSwirlFieldManifest();
    manifest.marks[1].basis.depthScale = 0.82;
    manifest.marks[1].population.count = 6;
    manifest.marks[1].population.scale = [1, 1];
    manifest.marks[1].population.opacity = [0.5, 0.5];
    const expanded = expandNeoRembrandt(manifest);
    const lines = expanded.marks
      .filter((mark) => mark.vectorSmoke && mark.kind === 'polyline')
      .sort((a, b) => a.swirlGlyphIndex - b.swirlGlyphIndex);

    expect(lines).toHaveLength(6);
    expect(lines.every((mark) => mark.swirlGlyphBaseScale === 1)).toBe(true);
    expect(lines[0].swirlGlyphPerspectiveScale).toBeGreaterThan(lines[5].swirlGlyphPerspectiveScale);
    expect(lines[0].swirlGlyphScale).toBeGreaterThan(lines[5].swirlGlyphScale);
    expect(lines[0].swirlGlyphOpacity).toBeGreaterThan(lines[5].swirlGlyphOpacity);
  });

  it('abstracts swirl fields into free-space fluid wallpaper swishes', () => {
    const expanded = expandNeoRembrandt(fluidWallpaperSwishManifest());
    const fluid = expanded.marks.filter((mark) => mark.vectorFluid);
    const lines = fluid.filter((mark) => mark.kind === 'polyline');

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.marks.some((mark) => mark.kind === 'fluidField')).toBe(false);
    expect(lines).toHaveLength(9);
    expect(fluid.some((mark) => mark.kind === 'polygon' && mark.sourceShape === 'blob')).toBe(false);
    expect(lines.every((mark) => mark.fluidMedium === 'wallpaper-swirl')).toBe(true);
    expect(lines.every((mark) => mark.vectorSmoke !== true)).toBe(true);
    expect(lines[0].points).toHaveLength(46);
    expect(new Set(lines.map((mark) => mark.sourceShape))).toEqual(new Set(['fluidField']));
  });

  it('uses Pastamaker effects as deterministic garnish over fluid glyph paths', () => {
    const manifest = vectorSmokeSwirlFieldManifest();
    manifest.marks[1].population.count = 4;
    manifest.marks[1].effects = {
      pastamaker: [
        {
          role: 'path-spark-strokes',
          die: { family: 'line', length: [8, 18], strokeWidth: 1.4, orientation: 'tangent' },
          field: { kind: 'alongFluidGlyph', count: 3, lateralJitter: [-3, 3] },
          valueBudget: { targetOpacity: 0.36, expectedOverlapCount: 3, mode: 'inverse-count' },
          stroke: '#f1e7ce',
        },
        {
          role: 'soft-turbulence-grain',
          die: { family: 'fuzzyPeach', radius: [3, 8], fuzz: 0.22, blur: 1.1 },
          field: { kind: 'aroundGlyphHead', count: 2 },
          valueBudget: { targetOpacity: 0.28, expectedOverlapCount: 4, mode: 'inverse-count' },
          fill: '#d9d4c6',
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const garnish = expanded.marks.filter((mark) => mark.fluidEffectKind === 'pastamaker');
    const strokes = garnish.filter((mark) => mark.fluidEffectRole === 'path-spark-strokes');
    const grains = garnish.filter((mark) => mark.fluidEffectRole === 'soft-turbulence-grain');

    expect(expanded.marks.some((mark) => mark.kind === 'stickerField')).toBe(false);
    expect(strokes).toHaveLength(12);
    expect(grains).toHaveLength(8);
    expect(strokes.every((mark) => mark.kind === 'line')).toBe(true);
    expect(grains.every((mark) => mark.kind === 'polygon')).toBe(true);
    expect(strokes.every((mark) => mark.pastamaker?.fieldKind === 'alongPath')).toBe(true);
    expect(grains.every((mark) => mark.pastamaker?.dieFamily === 'fuzzyPeach')).toBe(true);
    expect(garnish.every((mark) => mark.vectorFluid && mark.vectorSmoke)).toBe(true);
    expect(garnish.every((mark) => mark.opacity > 0 && mark.opacity <= 1)).toBe(true);
  });

  it('uses Pastamaker noisy spaghetti for dense shared-current fluid strands', () => {
    const expanded = expandNeoRembrandt(noisySpaghettiStreamManifest());
    const repeated = expandNeoRembrandt(noisySpaghettiStreamManifest());
    const strands = expanded.marks.filter((mark) => mark.pastamaker?.dieFamily === 'noisySpaghetti');
    const repeatedStrands = repeated.marks.filter((mark) => mark.pastamaker?.dieFamily === 'noisySpaghetti');
    const primary = strands.filter((mark) => mark.pastamaker?.splitOf === undefined);
    const splits = strands.filter((mark) => mark.pastamaker?.splitOf !== undefined);

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.marks.some((mark) => mark.kind === 'fluidField')).toBe(false);
    expect(strands).toHaveLength(105);
    expect(primary).toHaveLength(35);
    expect(splits).toHaveLength(70);
    expect(strands.every((mark) => mark.kind === 'polyline')).toBe(true);
    expect(strands.every((mark) => mark.vectorFluid)).toBe(true);
    expect(strands.every((mark) => mark.fluidMedium === 'stream')).toBe(true);
    expect(strands.every((mark) => mark.pastamaker?.density === 7)).toBe(true);
    expect(strands.every((mark) => mark.pastamaker?.fractalOctaves === 4)).toBe(true);
    expect(primary.every((mark) => mark.points.length === 20)).toBe(true);
    expect(splits.every((mark) => mark.points.length === 12)).toBe(true);
    expect(strands.every((mark) => mark.opacity > 0 && mark.opacity <= 1)).toBe(true);
    expect(strands.map((mark) => mark.points)).toEqual(repeatedStrands.map((mark) => mark.points));
  });

  it('deterministically bends noisy spaghetti strands around declared obstacles', () => {
    const manifest = noisySpaghettiStreamManifest();
    manifest.marks[0].population.count = 2;
    manifest.marks[0].glyph.effects.pastamaker[0].field.density = 3;
    manifest.marks[0].glyph.effects.pastamaker[0].field.fractalSplit = 0;
    manifest.marks[0].glyph.effects.pastamaker[0].field.avoid = [
      { kind: 'circle', role: 'midstream-rock', center: [320, 265], radius: 26, padding: 8, falloff: 28, strength: 1.4 },
    ];
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const strands = expanded.marks.filter((mark) => mark.pastamaker?.dieFamily === 'noisySpaghetti');
    const repeatedStrands = repeated.marks.filter((mark) => mark.pastamaker?.dieFamily === 'noisySpaghetti');
    const minDistance = Math.min(
      ...strands.flatMap((mark) =>
        mark.points.map(([x, y]) => Math.hypot(x - 320, y - 265)),
      ),
    );

    expect(strands).toHaveLength(6);
    expect(strands.every((mark) => mark.pastamaker?.collisionPolicy === 'deterministic-avoidance')).toBe(true);
    expect(strands.every((mark) => mark.pastamaker?.obstacleCount === 1)).toBe(true);
    expect(minDistance).toBeGreaterThan(34);
    expect(strands.map((mark) => mark.points)).toEqual(repeatedStrands.map((mark) => mark.points));
  });

  it('lowers spark/shower fields into reusable emission glyph modes', () => {
    const manifest = {
      title: 'Spark and shower glyph library',
      viewBox: { width: 640, height: 420 },
      scene: { view: { direction: [-0.35, -0.25], baseZ: 10 }, palette: 'warm-low-key' },
      marks: [
        {
          kind: 'sparkField',
          role: 'rain-curtain',
          mode: 'falling',
          medium: 'rain',
          basis: { origin: [0, -4, 0], flow: [0.12, 1, 0], cross: [1, 0, 0], screenOrigin: [320, 120], unitScale: 20, depthScale: 0.9 },
          emitter: { width: 14, height: 5 },
          population: { count: 8, seed: 'rain-proof', length: [1.2, 2.1], opacity: [0.35, 0.55] },
          glyph: { id: 'rain-streak' },
        },
        {
          kind: 'sparkField',
          role: 'welder-burst',
          mode: 'from-center',
          medium: 'spark',
          basis: { origin: [-2, 0, 0], flow: [1, -0.2, 0], cross: [0, 1, 0], lift: [0, 0, 1], screenOrigin: [260, 250], unitScale: 18, depthScale: 0.92 },
          population: { count: 7, seed: 'welder-proof', length: [1, 2.4] },
          glyph: { id: 'spark-streak' },
        },
        {
          kind: 'sparkField',
          role: 'impact-shower',
          mode: 'surface-collision',
          medium: 'comic',
          basis: { origin: [0, 0, 0], flow: [0.8, -0.35, 0], cross: [1, 0, 0], screenOrigin: [330, 286], unitScale: 17, depthScale: 0.9 },
          emitter: { from: [-3, 0, 0], to: [3, 0, 0], spreadDegrees: 42 },
          population: { count: 6, seed: 'impact-proof', length: [1.2, 2.6] },
          glyph: { id: 'comic-impact' },
        },
        {
          kind: 'sparkField',
          role: 'floor-bounce-sparks',
          mode: 'bounce-then-drop',
          medium: 'spark',
          basis: { origin: [0, 0, 0], flow: [0.75, -0.35, 0], cross: [1, 0, 0], lift: [0, 0, 1], screenOrigin: [315, 335], unitScale: 16, depthScale: 0.9 },
          emitter: { from: [-3, 0, 0], to: [3, 0, 0] },
          gravity: [0, 1, 0],
          population: { count: 5, seed: 'bounce-proof', length: [1.4, 2.8] },
          glyph: { id: 'spark-streak' },
        },
        {
          kind: 'sparkField',
          role: 'tree-leaf-shower',
          mode: 'falling',
          medium: 'leaf',
          basis: { origin: [0, -3, 0], flow: [0.08, 1, 0], cross: [1, 0, 0], screenOrigin: [470, 145], unitScale: 18, depthScale: 0.9 },
          emitter: { width: 6, height: 4 },
          population: { count: 5, seed: 'leaf-proof', length: [0.5, 1.1] },
          glyph: { id: 'leaf-dash' },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const sparks = expanded.marks.filter((mark) => mark.sparkFieldRole);
    const rain = sparks.filter((mark) => mark.sparkFieldRole === 'rain-curtain');
    const center = sparks.filter((mark) => mark.sparkFieldRole === 'welder-burst');
    const collision = sparks.filter((mark) => mark.sparkFieldRole === 'impact-shower');
    const bounce = sparks.filter((mark) => mark.sparkFieldRole === 'floor-bounce-sparks');
    const leaves = sparks.filter((mark) => mark.sparkFieldRole === 'tree-leaf-shower');
    const repeatedRain = repeated.marks.filter((mark) => mark.sparkFieldRole === 'rain-curtain');

    expect(expanded.marks.some((mark) => mark.kind === 'sparkField')).toBe(false);
    expect(rain).toHaveLength(8);
    expect(center).toHaveLength(7);
    expect(collision).toHaveLength(6);
    expect(bounce).toHaveLength(5);
    expect(leaves).toHaveLength(5);
    expect(rain.every((mark) => mark.kind === 'line' && mark.sparkGlyphId === 'rain-streak')).toBe(true);
    expect(center.every((mark) => mark.kind === 'line' && mark.sparkMode === 'from-center')).toBe(true);
    expect(collision.every((mark) => mark.kind === 'line' && mark.sparkMode === 'surface-collision')).toBe(true);
    expect(bounce.every((mark) => mark.kind === 'polyline' && mark.points.length === 3)).toBe(true);
    expect(leaves.every((mark) => mark.kind === 'polygon' && mark.sparkGlyphId === 'leaf-dash')).toBe(true);
    expect(rain.every((mark) => mark.sparkPerspectiveScale > 0 && mark.sparkScale > 0)).toBe(true);
    expect(rain.map((mark) => [mark.x1, mark.y1, mark.x2, mark.y2])).toEqual(repeatedRain.map((mark) => [mark.x1, mark.y1, mark.x2, mark.y2]));
  });

  it('lowers radial-fractal spark fields into firework branch generations', () => {
    const manifest = {
      title: 'Radial fractal firework',
      viewBox: { width: 520, height: 380 },
      marks: [
        {
          kind: 'sparkField',
          role: 'firework-burst',
          mode: 'radial-fractal',
          medium: 'firework',
          basis: { origin: [0, 0, 0], flow: [1, 0, 0], cross: [0, 1, 0], screenOrigin: [260, 190], unitScale: 34, depthScale: 0.94 },
          emitter: { spreadDegrees: 360 },
          population: { count: 4, seed: 'firework-proof', length: [1.8, 2.8], opacity: [0.48, 0.9] },
          fractal: { generations: 3, branching: [2, 2], lengthFalloff: 0.5, opacityFalloff: 0.68, angleJitter: 28 },
          glyph: { id: 'spark-streak' },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const sparks = expanded.marks.filter((mark) => mark.sparkFieldRole === 'firework-burst');
    const generations = new Set(sparks.map((mark) => mark.sparkGeneration));

    expect(expanded.marks.some((mark) => mark.kind === 'sparkField')).toBe(false);
    expect(sparks.length).toBeGreaterThan(4);
    expect(generations).toEqual(new Set([0, 1, 2]));
    expect(sparks.every((mark) => mark.kind === 'line' && mark.sparkMode === 'radial-fractal')).toBe(true);
    expect(sparks.some((mark) => mark.sparkBranchIndex > 0)).toBe(true);
    expect(sparks.map((mark) => [mark.x1, mark.y1, mark.x2, mark.y2])).toEqual(
      repeated.marks.filter((mark) => mark.sparkFieldRole === 'firework-burst').map((mark) => [mark.x1, mark.y1, mark.x2, mark.y2]),
    );
  });

  it('lowers will-o-wisp fields into aura body and mote components', () => {
    const expanded = expandNeoRembrandt({
      title: 'Will-o-wisp composite field',
      viewBox: { width: 520, height: 380 },
      marks: [
        {
          kind: 'wispField',
          role: 'marsh-wisp',
          color: '#78e6ff',
          glow: '#dcfbff',
          seed: 'wisp-proof',
          basis: { origin: [0, 0, 0], flow: [0.2, -0.36, 0.12], cross: [1, 0.2, 0], lift: [0, 0, 1], screenOrigin: [260, 210], unitScale: 30, depthScale: 0.92 },
          body: { count: 4, scale: [0.7, 1.2], opacity: [0.2, 0.42] },
          motes: { count: 9, length: [0.12, 0.5], opacity: [0.3, 0.78] },
        },
      ],
    });
    const body = expanded.marks.filter((mark) => mark.wispFieldRole === 'marsh-wisp' && mark.wispComponent === 'body');
    const motes = expanded.marks.filter((mark) => mark.wispFieldRole === 'marsh-wisp' && mark.wispComponent === 'motes');

    expect(expanded.marks.some((mark) => mark.kind === 'wispField')).toBe(false);
    expect(body.length).toBeGreaterThan(0);
    expect(motes).toHaveLength(9);
    expect(body.some((mark) => mark.vectorFluid)).toBe(true);
    expect(motes.every((mark) => mark.sparkFieldRole === 'marsh-wisp:motes')).toBe(true);
    expect(expanded.marks.filter((mark) => mark.wispFieldRole === 'marsh-wisp').every((mark) => ['body', 'motes'].includes(mark.wispComponent))).toBe(true);
  });

  it('lowers fire fluid fields into deterministic bulb seaweed flame glyphs with Pastamaker heat garnish', () => {
    const expanded = expandNeoRembrandt(bulbSeaweedFireManifest());
    const repeated = expandNeoRembrandt(bulbSeaweedFireManifest());
    const fire = expanded.marks.filter((mark) => mark.vectorFire);
    const repeatedFire = repeated.marks.filter((mark) => mark.vectorFire);
    const outer = fire.filter((mark) => mark.role.endsWith(':outer-body'));
    const cores = fire.filter((mark) => mark.role.endsWith(':red-core'));
    const spikes = fire.filter((mark) => mark.pastamaker?.dieFamily === 'spikeBanana');
    const fuzz = fire.filter((mark) => mark.pastamaker?.dieFamily === 'fuzzyPeach');

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.marks.some((mark) => mark.kind === 'fluidField')).toBe(false);
    expect(outer).toHaveLength(5);
    expect(cores).toHaveLength(5);
    expect(spikes).toHaveLength(15);
    expect(fuzz).toHaveLength(10);
    expect(outer.every((mark) => mark.kind === 'polygon' && mark.flameGlyph)).toBe(true);
    expect(cores.every((mark) => mark.fill === '#d71920')).toBe(true);
    expect(fire.every((mark) => mark.vectorFluid && mark.fluidMedium === 'fire')).toBe(true);
    expect(spikes.every((mark) => mark.fluidEffectRole === 'red-core-spikes')).toBe(true);
    expect(fuzz.every((mark) => mark.fluidEffectRole === 'source-ember-fuzz')).toBe(true);
    expect(outer.map((mark) => mark.points)).toEqual(repeatedFire.filter((mark) => mark.role.endsWith(':outer-body')).map((mark) => mark.points));
  });

  it('spawns deterministic flame licks from explicit flame sources and skins lit outer edges', () => {
    const manifest = bulbSeaweedFireManifest();
    manifest.marks[0].population.count = 99;
    manifest.marks[0].flameSources = [
      { role: 'left-wick-point', origin: [-2.2, 0.38, 0], lickCount: 3, spread: 0.34, radius: 0.18 },
      { role: 'right-wick-point', origin: [-1.34, 0.42, 0], lickCount: 2, spread: 0.28, radius: 0.12 },
    ];
    manifest.marks[0].glyph.outline = false;
    manifest.marks[0].glyph.swirlAmount = 0.62;
    manifest.marks[0].glyph.swirlTurns = 1.8;
    manifest.marks[0].glyph.volumetricFill = { enabled: true, opacity: 0.2, blur: 0.7 };
    manifest.marks[0].glyph.edgeSkin = {
      stroke: '#ffe7a3',
      strokeWidth: 1.45,
      insideStroke: '#ff5b24',
      insideStrokeWidth: 3.4,
      insideBlur: 1.4,
      valueBudget: { targetOpacity: 0.72, expectedOverlapCount: 3, mode: 'inverse-count' },
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const outer = expanded.marks.filter((mark) => mark.role.endsWith(':outer-body'));
    const hardEdges = expanded.marks.filter((mark) => mark.flameEdgeSide === 'outside-lit');
    const fuzzyEdges = expanded.marks.filter((mark) => mark.flameEdgeSide === 'inside-fuzzy');
    const volumeFills = expanded.marks.filter((mark) => mark.flameVolumeFill);
    const sourceRoles = new Set(outer.map((mark) => mark.flameSourceRole));

    expect(outer).toHaveLength(5);
    expect(hardEdges).toHaveLength(5);
    expect(fuzzyEdges).toHaveLength(5);
    expect(volumeFills).toHaveLength(10);
    expect(sourceRoles).toEqual(new Set(['left-wick-point', 'right-wick-point']));
    expect(outer.filter((mark) => mark.flameSourceRole === 'left-wick-point')).toHaveLength(3);
    expect(outer.filter((mark) => mark.flameSourceRole === 'right-wick-point')).toHaveLength(2);
    expect(outer.every((mark) => mark.stroke === 'none')).toBe(true);
    expect(hardEdges.every((mark) => mark.kind === 'polyline' && mark.stroke === '#ffe7a3')).toBe(true);
    expect(fuzzyEdges.every((mark) => mark.kind === 'polyline' && mark.blur === 1.4)).toBe(true);
    expect(volumeFills.every((mark) => mark.kind === 'polygon' && mark.stroke === 'none')).toBe(true);
    expect(hardEdges.every((mark) => mark.flameValueBudget?.mode === 'inverse-count')).toBe(true);
    expect(outer.map((mark) => mark.points)).toEqual(repeated.marks.filter((mark) => mark.role.endsWith(':outer-body')).map((mark) => mark.points));
  });

  it('can generate exactly two gradient flame licks from opposed parts of a source radius', () => {
    const manifest = bulbSeaweedFireManifest();
    manifest.marks[0].population.count = 42;
    manifest.marks[0].population.scale = [1, 1];
    manifest.marks[0].population.opacity = [0.34, 0.34];
    manifest.marks[0].basis.perspectiveSizing = false;
    manifest.marks[0].flameSources = [
      {
        role: 'single-combustion-point',
        origin: [-2.2, 0.38, 0],
        radius: 0.28,
        lickCount: 2,
        spread: 0,
        alongJitter: 0,
        liftJitter: 0,
        radiusJitter: 0,
        coverageScale: 2.2,
      },
    ];
    manifest.marks[0].glyph.outline = false;
    manifest.marks[0].glyph.height = [1.8, 1.8];
    manifest.marks[0].glyph.radius = [0.2, 0.2];
    manifest.marks[0].glyph.sourceCoverageScale = 2.2;
    manifest.marks[0].glyph.gradientFill = {
      enabled: true,
      kind: 'radial',
      stops: [
        { offset: 0, color: '#fff7c8', opacity: 0.96 },
        { offset: 0.36, color: '#ff9a24', opacity: 0.62 },
        { offset: 1, color: '#d71920', opacity: 0.12 },
      ],
    };
    manifest.marks[0].glyph.coreFillGradient = {
      enabled: true,
      kind: 'linear',
      stops: [
        { offset: 0, color: '#fff0a3', opacity: 0.72 },
        { offset: 1, color: '#d71920', opacity: 0.24 },
      ],
    };

    const expanded = expandNeoRembrandt(manifest);
    const outer = expanded.marks.filter((mark) => mark.role.endsWith(':outer-body'));
    const cores = expanded.marks.filter((mark) => mark.role.endsWith(':red-core'));
    const centers = outer.map((mark) => mark.swirlGlyphCenterXYZ);
    const centerDistance = Math.hypot(centers[0][0] - centers[1][0], centers[0][1] - centers[1][1], centers[0][2] - centers[1][2]);

    expect(outer).toHaveLength(2);
    expect(cores).toHaveLength(2);
    expect(outer.every((mark) => mark.stroke === 'none')).toBe(true);
    expect(outer.every((mark) => mark.fillGradient?.kind === 'radial')).toBe(true);
    expect(cores.every((mark) => mark.fillGradient?.kind === 'linear')).toBe(true);
    expect(outer.every((mark) => mark.fillGradient?.independentLighting === true)).toBe(true);
    expect(outer.every((mark) => mark.flameSourceRadius === 0.28 && mark.flameSourceCoverageScale === 2.2)).toBe(true);
    expect(centerDistance).toBeGreaterThan(0.32);
  });

  it('lowers rBrush fire matter into ordinary smart-pen painting marks', () => {
    const expanded = expandNeoRembrandt(rBrushFireManifest());
    const body = expanded.marks.find((mark) => mark.role === 'match-flame-rbrush:soft-fat-lick-body');
    const inner = expanded.marks.find((mark) => mark.role === 'match-flame-rbrush:yellow-inner-breath');
    const heat = expanded.marks.filter((mark) => mark.rBrushHeatRisen);
    const strings = expanded.marks.filter((mark) => mark.rBrushLoadRole === 'yellow-core-strings');

    expect(expanded.marks.some((mark) => mark.kind === 'rBrush')).toBe(false);
    expect(body?.kind).toBe('polygon');
    expect(inner?.kind).toBe('polygon');
    expect(body?.fillGradient?.role).toBe('fire-body-gradient');
    expect(inner?.fillGradient?.role).toBe('fire-inner-gradient');
    expect(body?.stroke).toBe('none');
    expect(heat).toHaveLength(4);
    expect(strings).toHaveLength(12);
    expect(expanded.marks.filter((mark) => mark.rBrushMatter).every((mark) => mark.rBrushPhase === 'fire')).toBe(true);
  });

  it('emits deterministic bounded rBrush noisySpaghetti load strings', () => {
    const expanded = expandNeoRembrandt(rBrushFireManifest());
    const repeated = expandNeoRembrandt(rBrushFireManifest());
    const strings = expanded.marks.filter((mark) => mark.rBrushLoadRole === 'yellow-core-strings');
    const repeatedStrings = repeated.marks.filter((mark) => mark.rBrushLoadRole === 'yellow-core-strings');

    expect(strings).toHaveLength(12);
    expect(strings.every((mark) => mark.pastamaker?.dieFamily === 'noisySpaghetti')).toBe(true);
    expect(strings.every((mark) => mark.rBrushLoadIndex === 0)).toBe(true);
    expect(strings.map((mark) => mark.points)).toEqual(repeatedStrings.map((mark) => mark.points));
  });

  it('preserves rBrush fat-lick coverage when source radius widens the basal bulb', () => {
    const narrow = expandNeoRembrandt(rBrushFireManifest({
      matter: {
        ...rBrushFireManifest().marks[0].matter,
        envelope: { ...rBrushFireManifest().marks[0].matter.envelope, sourceRadius: 0.05 },
      },
    }));
    const wide = expandNeoRembrandt(rBrushFireManifest({
      matter: {
        ...rBrushFireManifest().marks[0].matter,
        envelope: { ...rBrushFireManifest().marks[0].matter.envelope, sourceRadius: 0.52 },
      },
    }));
    const narrowBody = narrow.marks.find((mark) => mark.role === 'match-flame-rbrush:soft-fat-lick-body');
    const wideBody = wide.marks.find((mark) => mark.role === 'match-flame-rbrush:soft-fat-lick-body');
    const narrowBox = testBbox(narrowBody.points);
    const wideBox = testBbox(wideBody.points);

    expect(wideBody.rBrushEnvelopeWidth).toBeGreaterThan(narrowBody.rBrushEnvelopeWidth);
    expect(wideBody.rBrushEnvelopeHeight).toBeGreaterThan(narrowBody.rBrushEnvelopeHeight);
    expect(wideBox.w).toBeGreaterThan(narrowBox.w);
    expect(wideBox.h).toBeGreaterThan(narrowBox.h);
  });

  it('does not invent implicit black negative-space cutouts for rBrush fire', () => {
    const expanded = expandNeoRembrandt(rBrushFireManifest());
    const negativeCutouts = expanded.marks.filter((mark) => String(mark.role || '').startsWith('negative-space'));
    const darkOutlines = expanded.marks.filter((mark) => mark.rBrushMatter && mark.kind === 'polygon' && mark.stroke && mark.stroke !== 'none');

    expect(negativeCutouts).toHaveLength(0);
    expect(darkOutlines).toHaveLength(0);
  });

  it('lowers rBrush 2D ink pen strokes into natural noisy lateral stroke matter', () => {
    const expanded = expandNeoRembrandt(rBrushInk2DManifest());
    const repeated = expandNeoRembrandt(rBrushInk2DManifest());
    const body = expanded.marks.find((mark) => mark.role === 'ink-signature-stroke:ink-body');
    const strings = expanded.marks.filter((mark) => mark.rBrushInkString);
    const repeatedBody = repeated.marks.find((mark) => mark.role === 'ink-signature-stroke:ink-body');
    const repeatedStrings = repeated.marks.filter((mark) => mark.rBrushInkString);

    expect(expanded.marks.some((mark) => mark.kind === 'rBrush')).toBe(false);
    expect(body?.kind).toBe('polygon');
    expect(body?.rBrushPhase).toBe('ink');
    expect(body?.rBrushMode).toBe('2d');
    expect(body?.stroke).toBe('none');
    expect(body?.points.length).toBeGreaterThan(20);
    expect(strings).toHaveLength(6);
    expect(strings.every((mark) => mark.pastamaker?.dieFamily === 'noisySpaghetti')).toBe(true);
    expect(body.points).toEqual(repeatedBody.points);
    expect(strings.map((mark) => mark.points)).toEqual(repeatedStrings.map((mark) => mark.points));
  });

  it('supports distinct deterministic rBrush 2D brush glyph profiles', () => {
    const expanded = expandNeoRembrandt(rBrush2DBrushProfilesManifest());
    const repeated = expandNeoRembrandt(rBrush2DBrushProfilesManifest());
    const bodies = expanded.marks.filter((mark) => mark.rBrushInkBody);
    const strings = expanded.marks.filter((mark) => mark.rBrushInkString);
    const repeatedBodies = repeated.marks.filter((mark) => mark.rBrushInkBody);

    expect(bodies).toHaveLength(5);
    expect(new Set(bodies.map((mark) => mark.rBrushBrushProfile))).toEqual(new Set(['ink-pen', 'brush-pen', 'dry-brush', 'marker', 'calligraphy']));
    expect(strings.filter((mark) => mark.rBrushBrushProfile === 'dry-brush')).toHaveLength(18);
    expect(strings.filter((mark) => mark.rBrushBrushProfile === 'marker')).toHaveLength(3);
    expect(bodies.map((mark) => mark.points)).toEqual(repeatedBodies.map((mark) => mark.points));
    expect(bodies.find((mark) => mark.rBrushBrushProfile === 'brush-pen').rBrushStrokeWidth)
      .toBeGreaterThan(bodies.find((mark) => mark.rBrushBrushProfile === 'ink-pen').rBrushStrokeWidth);
  });

  it('can merge rBrush 2D brush printing into one map trace body', () => {
    const expanded = expandNeoRembrandt(rBrush2DPrintTraceManifest());
    const repeated = expandNeoRembrandt(rBrush2DPrintTraceManifest());
    const traces = expanded.marks.filter((mark) => mark.rBrushPrintTrace);
    const strings = expanded.marks.filter((mark) => mark.rBrushInkString);
    const dabMarks = expanded.marks.filter((mark) => mark.rBrushTemporaryDab || mark.rBrushPrintDab);

    expect(expanded.marks.some((mark) => mark.kind === 'rBrush')).toBe(false);
    expect(traces).toHaveLength(1);
    expect(traces[0].role).toBe('merged-brush-print-line:merged-trace');
    expect(traces[0].kind).toBe('polygon');
    expect(traces[0].rBrushMergeMode).toBe('trace');
    expect(traces[0].rBrushTemporaryDabCount).toBeGreaterThan(8);
    expect(traces[0].points.length).toBeLessThanOrEqual(72);
    expect(dabMarks).toHaveLength(0);
    expect(strings).toHaveLength(8);
    expect(traces[0].points).toEqual(repeated.marks.find((mark) => mark.rBrushPrintTrace).points);
  });

  it('retains high-frequency linked double-dot rBrush stamp strokes in vector space', () => {
    const expanded = expandNeoRembrandt(rBrush2DStampDoubleDotManifest());
    const repeated = expandNeoRembrandt(rBrush2DStampDoubleDotManifest());
    const stamps = expanded.marks.filter((mark) => mark.rBrushStampBrush);
    const repeatedStamps = repeated.marks.filter((mark) => mark.rBrushStampBrush);
    const strokeIds = new Set(stamps.map((mark) => mark.rBrushStrokeId));
    const stampPositions = new Set(stamps.map((mark) => mark.rBrushStampIndex));

    expect(expanded.marks.some((mark) => mark.kind === 'rBrush')).toBe(false);
    expect(expanded.marks.some((mark) => mark.rBrushInkBody)).toBe(false);
    expect(expanded.marks.some((mark) => mark.rBrushPrintTrace)).toBe(false);
    expect(stamps.length).toBeGreaterThan(160);
    expect(stampPositions.size).toBeGreaterThan(80);
    expect(stamps.length).toBe(stampPositions.size * 2);
    expect(new Set(stamps.map((mark) => mark.rBrushStampLane))).toEqual(new Set(['a', 'b']));
    expect(strokeIds).toEqual(new Set(['linked-double-dot-s']));
    expect(stamps.every((mark) => mark.rBrushLinkedStroke && mark.rBrushLinkage === 'stroke-object')).toBe(true);
    expect(stamps.every((mark) => mark.rBrushStampGapPx === 2 && mark.rBrushStampDotRadius === 7.2)).toBe(true);
    expect(stamps.map((mark) => [mark.cx, mark.cy, mark.r])).toEqual(repeatedStamps.map((mark) => [mark.cx, mark.cy, mark.r]));
  });

  it('can merge double-dot rBrush stamp lanes into two linked component traces', () => {
    const expanded = expandNeoRembrandt(rBrush2DStampComponentTraceManifest());
    const repeated = expandNeoRembrandt(rBrush2DStampComponentTraceManifest());
    const traces = expanded.marks.filter((mark) => mark.rBrushComponentTrace);
    const circleStamps = expanded.marks.filter((mark) => mark.rBrushStampBrush && mark.kind === 'circle');
    const repeatedTraces = repeated.marks.filter((mark) => mark.rBrushComponentTrace);

    expect(expanded.marks.some((mark) => mark.kind === 'rBrush')).toBe(false);
    expect(traces).toHaveLength(2);
    expect(circleStamps).toHaveLength(0);
    expect(new Set(traces.map((mark) => mark.rBrushStampLane))).toEqual(new Set(['a', 'b']));
    expect(new Set(traces.map((mark) => mark.rBrushStrokeId))).toEqual(new Set(['component-trace-double-dot-s']));
    expect(traces.every((mark) => mark.rBrushMergeMode === 'component-trace')).toBe(true);
    expect(traces.every((mark) => mark.rBrushTemporaryStampCount > 80)).toBe(true);
    expect(traces.every((mark) => mark.points.length <= 96)).toBe(true);
    expect(traces.map((mark) => mark.points)).toEqual(repeatedTraces.map((mark) => mark.points));
  });

  it('expands round primitives and closes cylinder tops by default', () => {
    const expanded = expandNeoRembrandt(primitiveElementTableManifest());
    const sourcePolygons = expanded.marks.filter((m) => m.source && m.kind === 'polygon');
    const cylinderTop = sourcePolygons.find((m) => m.role === 'cylinder-sample:top-cap');
    const cylinderBody = sourcePolygons.find((m) => m.role === 'cylinder-sample:body');

    expect(expanded.marks.some((m) => ['sphere', 'oval', 'cylinder', 'egg'].includes(m.kind))).toBe(false);
    expect(sourcePolygons.some((m) => m.sourceShape === 'sphere')).toBe(true);
    expect(sourcePolygons.some((m) => m.sourceShape === 'oval')).toBe(true);
    expect(sourcePolygons.some((m) => m.sourceShape === 'egg')).toBe(true);
    expect(cylinderBody).toBeTruthy();
    expect(cylinderTop).toBeTruthy();
    expect(cylinderTop.coherenceRole).toBe('top-closure');
    expect(cylinderTop.cylinderTopClosed).toBe(true);
    expect(cylinderTop.z).toBeGreaterThan(cylinderBody.z);
  });

  it('preserves explicit source z values over eye-line auto-z', () => {
    const manifest = blobFieldManifest([-1, -1]);
    manifest.marks[0].z = 100;
    const expanded = expandNeoRembrandt(manifest);
    const topLeft = expanded.marks.find((m) => m.source && m.role === 'top-left');

    expect(topLeft.z).toBe(100);
    expect(topLeft.autoZ).toBeUndefined();
  });

  it('holds highlights back from the lit rim by default', () => {
    const expanded = expandNeoRembrandt(p0Manifest());
    const source = expanded.marks.find((m) => m.source && m.role === 'egg-body');
    const highlights = expanded.marks.filter((m) => m.pass === 'highlight');
    const light = normalize(expanded.scene.light.direction);
    const sourceLitEdge = projectionMax(source.points, light);
    const brightestHighlightEdge = Math.max(...highlights.map((m) => projectionMax(m.points, light)));

    expect(sourceLitEdge - brightestHighlightEdge).toBeGreaterThan(4);
  });

  it('tags form-light stickers as Pastamaker v0 and honors inverse-count budgets', () => {
    const manifest = p0Manifest();
    manifest.marks[0].shade = {
      algorithm: 'form-light-stack',
      intensity: 1,
      valueBudget: { targetOpacity: 0.6, expectedOverlapCount: 6, mode: 'inverse-count' },
    };
    manifest.marks[0].highlights = {
      algorithm: 'form-light-stack',
      intensity: 1,
      valueBudget: { targetOpacity: 0.4, expectedOverlapCount: 4, mode: 'inverse-count' },
    };
    const expanded = expandNeoRembrandt(manifest);
    const shadows = expanded.marks.filter((m) => m.pass === 'shadow');
    const highlights = expanded.marks.filter((m) => m.pass === 'highlight');

    expect(shadows).toHaveLength(6);
    expect(highlights).toHaveLength(4);
    expect(shadows.every((m) => m.opacity === 0.1)).toBe(true);
    expect(highlights.every((m) => m.opacity === 0.1)).toBe(true);
    expect(shadows.every((m) => m.pastamaker?.dieFamily === 'softPatch')).toBe(true);
    expect(highlights.every((m) => m.pastamaker?.fieldKind === 'formContour')).toBe(true);
  });

  it('expands Pastamaker aroundRing arcPatch fields into concrete stickers', () => {
    const expanded = expandNeoRembrandt(pastamakerRingManifest());
    const stickers = expanded.marks.filter((m) => m.algorithm === 'pastamaker' && m.pastamaker?.dieFamily === 'arcPatch');
    const center = [180, 180];
    const minRadius = Math.min(
      ...stickers.flatMap((mark) =>
        mark.points.map(([x, y]) => Math.hypot(x - center[0], y - center[1])),
      ),
    );

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(5);
    expect(expanded.marks.some((m) => m.kind === 'stickerField')).toBe(false);
    expect(stickers).toHaveLength(18);
    expect(stickers.every((m) => m.kind === 'polygon')).toBe(true);
    expect(stickers.every((m) => m.closed === true)).toBe(true);
    expect(stickers.every((m) => m.opacity === 0.08)).toBe(true);
    expect(stickers.every((m) => m.opacity <= 1)).toBe(true);
    expect(stickers.every((m) => m.pastamaker?.dieFamily === 'arcPatch')).toBe(true);
    expect(stickers.every((m) => m.pastamaker?.fieldKind === 'aroundRing')).toBe(true);
    expect(minRadius).toBeGreaterThanOrEqual(63.9);
  });

  it('expands Pastamaker aroundRing line fields into high-z highlight strokes', () => {
    const expanded = expandNeoRembrandt(pastamakerRingManifest());
    const strokes = expanded.marks.filter((m) => m.stickerFieldRole === 'rim-highlight-strokes');
    const arcPatches = expanded.marks.filter((m) => m.algorithm === 'pastamaker' && m.pastamaker?.dieFamily === 'arcPatch');

    expect(strokes).toHaveLength(12);
    expect(strokes.every((m) => m.kind === 'line')).toBe(true);
    expect(strokes.every((m) => m.pass === 'highlight-stroke')).toBe(true);
    expect(strokes.every((m) => m.opacity === 0.08)).toBe(true);
    expect(Math.min(...strokes.map((m) => m.z))).toBeGreaterThan(Math.max(...arcPatches.map((m) => m.z)));
    expect(strokes.every((m) => m.pastamaker?.fieldKind === 'aroundRing')).toBe(true);
  });

  it('expands Pastamaker spike bananas as filled value-bearing contour stickers', () => {
    const expanded = expandNeoRembrandt(pastamakerRingManifest());
    const bananas = expanded.marks.filter((m) => m.stickerFieldRole === 'spike-banana-plasma');
    const first = bananas[0];

    expect(bananas).toHaveLength(10);
    expect(bananas.every((m) => m.kind === 'polygon')).toBe(true);
    expect(bananas.every((m) => m.closed === true)).toBe(true);
    expect(bananas.every((m) => m.fill && m.fill !== 'none')).toBe(true);
    expect(bananas.every((m) => m.opacity === 0.1)).toBe(true);
    expect(bananas.every((m) => m.blur === 1.2)).toBe(true);
    expect(bananas.every((m) => m.pastamaker?.dieFamily === 'spikeBanana')).toBe(true);
    expect(first.points.length).toBeGreaterThan(10);
  });

  it('expands Pastamaker fuzzy peaches as soft filled circular stickers', () => {
    const expanded = expandNeoRembrandt(pastamakerRingManifest());
    const peaches = expanded.marks.filter((m) => m.stickerFieldRole === 'fuzzy-peach-glow');

    expect(peaches).toHaveLength(16);
    expect(peaches.every((m) => m.kind === 'polygon')).toBe(true);
    expect(peaches.every((m) => m.closed === true)).toBe(true);
    expect(peaches.every((m) => m.fill && m.fill !== 'none')).toBe(true);
    expect(peaches.every((m) => m.opacity === 0.05)).toBe(true);
    expect(peaches.every((m) => m.blur === 1.6)).toBe(true);
    expect(peaches.every((m) => m.pastamaker?.dieFamily === 'fuzzyPeach')).toBe(true);
  });

  it('expands Pastamaker alongPath line fields into stream strokes', () => {
    const expanded = expandNeoRembrandt(pastamakerRingManifest());
    const strokes = expanded.marks.filter((m) => m.stickerFieldRole === 'jet-stream-strokes');

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(5);
    expect(strokes).toHaveLength(14);
    expect(strokes.every((m) => m.kind === 'line')).toBe(true);
    expect(strokes.every((m) => m.pass === 'path-stroke')).toBe(true);
    expect(strokes.every((m) => m.opacity === 0.05)).toBe(true);
    expect(strokes.every((m) => m.pastamaker?.dieFamily === 'line')).toBe(true);
    expect(strokes.every((m) => m.pastamaker?.fieldKind === 'alongPath')).toBe(true);
  });

  it('expands Pastamaker stringSpawn dies into strings with spawned glyphs', () => {
    const manifest = {
      title: 'Pastamaker string spawn',
      viewBox: { width: 420, height: 300 },
      marks: [
        {
          kind: 'stickerField',
          role: 'vine-string-spawn',
          z: 22,
          die: {
            family: 'stringSpawn',
            stroke: '#6f5a36',
            strokeWidth: 1.2,
            glyph: {
              id: 'leaf',
              count: 3,
              size: [4, 9],
              fill: '#789a43',
              stroke: '#334820',
              offsetJitter: 5,
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [52, 220],
              [128, 142],
              [226, 160],
              [348, 72],
            ],
            count: 4,
            samples: 18,
            lateralJitter: [-14, 14],
            wobble: 0.44,
          },
          valueBudget: {
            targetOpacity: 0.62,
            expectedOverlapCount: 4,
            mode: 'inverse-count',
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const strings = expanded.marks.filter((m) => m.stringSpawnKind === 'string');
    const glyphs = expanded.marks.filter((m) => m.stringSpawnKind === 'glyph');
    const repeatedStrings = repeated.marks.filter((m) => m.stringSpawnKind === 'string');

    expect(expanded.marks.some((m) => m.kind === 'stickerField')).toBe(false);
    expect(strings).toHaveLength(4);
    expect(glyphs).toHaveLength(12);
    expect(strings.every((m) => m.kind === 'polyline')).toBe(true);
    expect(glyphs.every((m) => m.kind === 'polygon')).toBe(true);
    expect(strings.every((m) => m.pastamaker?.dieFamily === 'stringSpawn')).toBe(true);
    expect(glyphs.every((m) => m.pastamaker?.glyphId === 'leaf')).toBe(true);
    expect(strings.map((m) => m.points)).toEqual(repeatedStrings.map((m) => m.points));
  });

  it('coheres Pastamaker stringSpawn clusters into a deterministic skin polygon', () => {
    const manifest = {
      title: 'Pastamaker string skin',
      viewBox: { width: 420, height: 300 },
      marks: [
        {
          kind: 'stickerField',
          role: 'shawl-string-skin',
          z: 30,
          die: {
            family: 'stringSpawn',
            stroke: '#6d543a',
            strokeWidth: 1,
            glyph: { id: 'dash', count: 2, size: [2, 5], stroke: '#d8c49d' },
            cohere: {
              enabled: true,
              mode: 'skin',
              envelope: 'convexHull',
              padding: 7,
              smoothing: 0.2,
              skin: { fill: '#7b5842', opacity: 0.34, stroke: '#b28b62' },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [70, 220],
              [138, 148],
              [218, 166],
              [326, 92],
            ],
            count: 6,
            samples: 22,
            lateralJitter: [-18, 18],
            fractalOctaves: 3,
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const strings = expanded.marks.filter((m) => m.stringSpawnKind === 'string');
    const glyphs = expanded.marks.filter((m) => m.stringSpawnKind === 'glyph');
    const skins = expanded.marks.filter((m) => m.stringSpawnSkin);
    const repeatedSkins = repeated.marks.filter((m) => m.stringSpawnSkin);

    expect(expanded.marks.some((m) => m.kind === 'stickerField')).toBe(false);
    expect(strings).toHaveLength(6);
    expect(glyphs).toHaveLength(12);
    expect(skins).toHaveLength(1);
    expect(skins[0].kind).toBe('polygon');
    expect(skins[0].stringSpawnSkinRole).toBe('shawl-string-skin');
    expect(skins[0].stringSpawnSkinEnvelope).toBe('convexHull');
    expect(skins[0].volumeSurface).toBe('cohered-string-skin');
    expect(skins[0].z).toBeLessThan(Math.min(...strings.map((m) => m.z)));
    expect(skins[0].points.length).toBeGreaterThanOrEqual(3);
    expect(skins[0].points).toEqual(repeatedSkins[0].points);
  });

  it('applies the fernCurl natural stringSpawn preset deterministically', () => {
    const baseManifest = {
      title: 'Pastamaker fern curl string spawn',
      viewBox: { width: 420, height: 300 },
      marks: [
        {
          kind: 'stickerField',
          role: 'fern-curl-threads',
          z: 22,
          die: {
            family: 'stringSpawn',
            preset: 'fernCurl',
            stroke: '#56713a',
            strokeWidth: 1.1,
            glyph: { count: 2, fill: '#8db45a', stroke: '#314924' },
          },
          field: {
            kind: 'alongPath',
            points: [
              [58, 234],
              [128, 176],
              [230, 168],
              [346, 88],
            ],
            count: 5,
            samples: 24,
            lateralJitter: [-12, 12],
          },
        },
      ],
    };
    const flatManifest = structuredClone(baseManifest);
    delete flatManifest.marks[0].die.preset;
    const curled = expandNeoRembrandt(baseManifest);
    const repeated = expandNeoRembrandt(baseManifest);
    const flat = expandNeoRembrandt(flatManifest);
    const curledStrings = curled.marks.filter((m) => m.stringSpawnKind === 'string');
    const repeatedStrings = repeated.marks.filter((m) => m.stringSpawnKind === 'string');
    const flatStrings = flat.marks.filter((m) => m.stringSpawnKind === 'string');
    const glyphs = curled.marks.filter((m) => m.stringSpawnKind === 'glyph');

    expect(curledStrings).toHaveLength(5);
    expect(glyphs).toHaveLength(10);
    expect(curledStrings.every((m) => m.pastamaker?.stringSpawnPreset === 'fernCurl')).toBe(true);
    expect(curledStrings.every((m) => m.pastamaker?.spiralEnabled === true)).toBe(true);
    expect(glyphs.every((m) => m.kind === 'polygon' && m.pastamaker?.glyphId === 'leaf')).toBe(true);
    expect(curledStrings.map((m) => m.points)).toEqual(repeatedStrings.map((m) => m.points));
    expect(curledStrings.map((m) => m.points)).not.toEqual(flatStrings.map((m) => m.points));
  });

  it('supports stripHull and alphaHull coherent string skin envelopes', () => {
    const base = {
      title: 'Pastamaker phase 2 string skins',
      viewBox: { width: 520, height: 360 },
      marks: [
        {
          kind: 'stickerField',
          role: 'strip-sleeve',
          z: 28,
          die: {
            family: 'stringSpawn',
            stroke: '#778fb8',
            strokeWidth: 1,
            glyph: { id: 'dash', count: 1, stroke: '#dbe8ff' },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'stripHull',
              padding: 9,
              bins: 10,
              smoothing: 0.1,
              skin: { fill: '#415a82', opacity: 0.38 },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [72, 244],
              [132, 174],
              [224, 190],
              [292, 126],
              [396, 142],
            ],
            count: 9,
            samples: 24,
            lateralJitter: [-16, 16],
            fractalOctaves: 3,
          },
        },
        {
          kind: 'stickerField',
          role: 'alpha-canopy',
          z: 30,
          die: {
            family: 'stringSpawn',
            preset: 'fernCurl',
            stroke: '#6f8c45',
            glyph: { count: 2, fill: '#98bd5f', stroke: '#2f4825' },
            cohere: {
              enabled: true,
              mode: 'skin',
              envelope: 'alphaHull',
              padding: 6,
              sectors: 14,
              alpha: 0.66,
              smoothing: 0.15,
              skin: { fill: '#4e6d36', opacity: 0.32 },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [88, 292],
              [154, 248],
              [208, 292],
              [282, 212],
              [394, 246],
            ],
            count: 7,
            samples: 24,
            lateralJitter: [-20, 20],
          },
        },
      ],
    };
    const repeated = expandNeoRembrandt(base);
    const expanded = expandNeoRembrandt(base);
    const convexBase = structuredClone(base);
    convexBase.marks[0].die.cohere.envelope = 'convexHull';
    convexBase.marks[1].die.cohere.envelope = 'convexHull';
    const convex = expandNeoRembrandt(convexBase);
    const strip = expanded.marks.find((m) => m.stringSpawnSkinRole === 'strip-sleeve');
    const alpha = expanded.marks.find((m) => m.stringSpawnSkinRole === 'alpha-canopy');
    const repeatedStrip = repeated.marks.find((m) => m.stringSpawnSkinRole === 'strip-sleeve');
    const repeatedAlpha = repeated.marks.find((m) => m.stringSpawnSkinRole === 'alpha-canopy');
    const convexStrip = convex.marks.find((m) => m.stringSpawnSkinRole === 'strip-sleeve');
    const convexAlpha = convex.marks.find((m) => m.stringSpawnSkinRole === 'alpha-canopy');

    expect(strip.stringSpawnSkinEnvelope).toBe('stripHull');
    expect(alpha.stringSpawnSkinEnvelope).toBe('alphaHull');
    expect(strip.points.length).toBeGreaterThan(6);
    expect(alpha.points.length).toBeGreaterThan(6);
    expect(strip.points).toEqual(repeatedStrip.points);
    expect(alpha.points).toEqual(repeatedAlpha.points);
    expect(strip.points).not.toEqual(convexStrip.points);
    expect(alpha.points).not.toEqual(convexAlpha.points);
    expect(strip.volumeSurface).toBe('cohered-string-skin');
    expect(alpha.volumeSurface).toBe('cohered-string-skin');
  });

  it('emits depth-aware fabric ridge and valley creases from coherent string skins', () => {
    const manifest = {
      title: 'Pastamaker fabric crease physics',
      viewBox: { width: 520, height: 360 },
      scene: {
        light: { direction: [-0.7, -0.45] },
      },
      marks: [
        {
          kind: 'stickerField',
          role: 'fabric-scarf',
          z: 34,
          die: {
            family: 'stringSpawn',
            stroke: '#8e6f55',
            strokeWidth: 1.2,
            glyph: { id: 'dash', count: 1, stroke: '#e8d2ad' },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'stripHull',
              padding: 10,
              bins: 11,
              skin: { fill: '#76533f', opacity: 0.36 },
              fabric: {
                enabled: true,
                mode: 'drape',
                stiffness: 0.22,
                depthScale: 0.9,
                pleats: { count: 6, amplitude: 0.42 },
                avoid: [{ kind: 'circle', center: [260, 176], radius: 24, strength: 0.8 }],
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [72, 248],
              [132, 178],
              [224, 194],
              [306, 136],
              [426, 158],
            ],
            count: 8,
            samples: 24,
            lateralJitter: [-18, 18],
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const skin = expanded.marks.find((m) => m.stringSpawnSkinRole === 'fabric-scarf');
    const creases = expanded.marks.filter((m) => m.fabricPhysics);
    const repeatedCreases = repeated.marks.filter((m) => m.fabricPhysics);
    const roles = new Set(creases.map((m) => m.fabricRole));

    expect(skin).toBeTruthy();
    expect(creases).toHaveLength(6);
    expect(roles.has('ridge')).toBe(true);
    expect(roles.has('valley')).toBe(true);
    expect(creases.every((m) => m.kind === 'polyline')).toBe(true);
    expect(creases.every((m) => m.stringSpawnKind === 'fabric-crease')).toBe(true);
    expect(creases.every((m) => m.fabricEnvelope === 'stripHull')).toBe(true);
    expect(creases.every((m) => Number.isFinite(m.fabricDepthT))).toBe(true);
    expect(creases.every((m) => Number.isFinite(m.fabricPerspectiveScale))).toBe(true);
    expect(creases.every((m) => Array.isArray(m.fabricNormalHint))).toBe(true);
    expect(creases.some((m) => m.lightResponse === 'highlight')).toBe(true);
    expect(creases.some((m) => m.lightResponse === 'shadow')).toBe(true);
    expect(creases.map((m) => m.points)).toEqual(repeatedCreases.map((m) => m.points));
  });

  it('maps fabric patterns through the coherent fabric flow field', () => {
    const manifest = {
      title: 'Pastamaker fabric pattern mapping',
      viewBox: { width: 520, height: 360 },
      scene: { light: { direction: [-0.6, -0.5] } },
      marks: [
        {
          kind: 'stickerField',
          role: 'patterned-scarf',
          z: 34,
          die: {
            family: 'stringSpawn',
            stroke: '#6d543a',
            strokeWidth: 1,
            glyph: { id: 'dash', count: 1, stroke: '#ead2a5' },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'stripHull',
              padding: 10,
              bins: 12,
              skin: { fill: '#654737', opacity: 0.4 },
              fabric: {
                enabled: true,
                mode: 'drape',
                stiffness: 0.18,
                pleats: { count: 5, amplitude: 0.36 },
                pattern: {
                  enabled: true,
                  kind: 'tartan-lite',
                  count: 6,
                  density: 1,
                  distortion: 0.42,
                  stroke: '#f0d4a8',
                  strokeWidth: 0.7,
                },
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [66, 246],
              [138, 168],
              [224, 192],
              [306, 132],
              [424, 154],
            ],
            count: 7,
            samples: 24,
            lateralJitter: [-16, 16],
          },
        },
        {
          kind: 'stickerField',
          role: 'dotted-cape',
          z: 36,
          die: {
            family: 'stringSpawn',
            stroke: '#637b9a',
            glyph: { id: 'dash', count: 0 },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'alphaHull',
              padding: 8,
              sectors: 16,
              skin: { fill: '#3d4d65', opacity: 0.38 },
              fabric: {
                enabled: true,
                mode: 'drape',
                stiffness: 0.28,
                pleats: { count: 4, amplitude: 0.28 },
                pattern: {
                  enabled: true,
                  kind: 'dot',
                  count: 12,
                  density: 1,
                  radius: 2.2,
                  fill: '#d8e8ff',
                  opacity: 0.72,
                },
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [108, 292],
              [174, 226],
              [238, 286],
              [318, 206],
              [410, 250],
            ],
            count: 6,
            samples: 24,
            lateralJitter: [-18, 18],
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const stripePatterns = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'patterned-scarf' && m.fabricPattern);
    const repeatedStripePatterns = repeated.marks.filter((m) => m.stringSpawnSkinRole === 'patterned-scarf' && m.fabricPattern);
    const dotPatterns = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'dotted-cape' && m.fabricPattern);
    const repeatedDotPatterns = repeated.marks.filter((m) => m.stringSpawnSkinRole === 'dotted-cape' && m.fabricPattern);

    expect(stripePatterns.length).toBeGreaterThan(4);
    expect(dotPatterns).toHaveLength(12);
    expect(stripePatterns.every((m) => m.kind === 'polyline')).toBe(true);
    expect(dotPatterns.every((m) => m.kind === 'circle')).toBe(true);
    expect(stripePatterns.every((m) => m.fabricPatternKind === 'tartan-lite')).toBe(true);
    expect(dotPatterns.every((m) => m.fabricPatternKind === 'dot')).toBe(true);
    expect(stripePatterns.every((m) => Number.isFinite(m.fabricPatternStress))).toBe(true);
    expect(dotPatterns.every((m) => Number.isFinite(m.fabricFlowT) && Number.isFinite(m.fabricFlowN))).toBe(true);
    expect(stripePatterns.map((m) => m.points)).toEqual(repeatedStripePatterns.map((m) => m.points));
    expect(dotPatterns.map((m) => [m.cx, m.cy, m.r])).toEqual(repeatedDotPatterns.map((m) => [m.cx, m.cy, m.r]));
  });

  it('supports configurable brush-pressure taper profiles on fabric creases and patterns', () => {
    const manifest = {
      title: 'Pastamaker fabric pressure taper',
      viewBox: { width: 520, height: 360 },
      marks: [
        {
          kind: 'stickerField',
          role: 'pressure-cloth',
          z: 34,
          die: {
            family: 'stringSpawn',
            stroke: '#6d543a',
            strokeWidth: 1.1,
            glyph: { id: 'dash', count: 0 },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'stripHull',
              padding: 10,
              bins: 10,
              skin: { fill: '#674b3b', opacity: 0.38 },
              fabric: {
                enabled: true,
                mode: 'drape',
                stiffness: 0.2,
                pleats: {
                  count: 3,
                  amplitude: 0.4,
                  pressure: { enabled: true, profile: 'bell', min: 0.35, max: 1.7 },
                },
                pattern: {
                  enabled: true,
                  kind: 'stripe',
                  count: 3,
                  density: 1,
                  stroke: '#f0d4a8',
                  strokeWidth: 0.8,
                  pressure: { enabled: true, profile: 'front-heavy', min: 0.4, max: 1.6 },
                },
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [66, 246],
              [138, 168],
              [224, 192],
              [306, 132],
              [424, 154],
            ],
            count: 6,
            samples: 22,
            lateralJitter: [-16, 16],
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const pressureCreases = expanded.marks.filter((m) => m.fabricPressure);
    const repeatedPressureCreases = repeated.marks.filter((m) => m.fabricPressure);
    const pressurePatterns = expanded.marks.filter((m) => m.fabricPatternPressure);

    expect(pressureCreases.length).toBeGreaterThan(3);
    expect(pressurePatterns.length).toBeGreaterThan(3);
    expect(pressureCreases.every((m) => m.fabricPressureProfile === 'bell')).toBe(true);
    expect(pressurePatterns.every((m) => m.fabricPressureProfile === 'front-heavy')).toBe(true);
    expect(new Set(pressureCreases.map((m) => m.strokeWidth)).size).toBeGreaterThan(1);
    expect(new Set(pressurePatterns.map((m) => m.strokeWidth)).size).toBeGreaterThan(1);
    expect(pressureCreases.every((m) => Number.isFinite(m.fabricPressureValue))).toBe(true);
    expect(pressureCreases.map((m) => [m.points, m.strokeWidth])).toEqual(
      repeatedPressureCreases.map((m) => [m.points, m.strokeWidth]),
    );
  });

  it('emits armor plates as hard-surface clothing variants on coherent string skins', () => {
    const manifest = {
      title: 'Pastamaker fabric armor variants',
      viewBox: { width: 620, height: 360 },
      marks: [
        {
          kind: 'stickerField',
          role: 'cast-breastplate-cloth',
          z: 36,
          die: {
            family: 'stringSpawn',
            stroke: '#5f6670',
            strokeWidth: 1,
            glyph: { id: 'dash', count: 0 },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'stripHull',
              padding: 10,
              bins: 10,
              skin: { fill: '#3d4652', opacity: 0.34 },
              fabric: {
                enabled: true,
                mode: 'drape',
                armor: {
                  enabled: true,
                  fit: 'volumizer-cast',
                  type: 'breastplate',
                  panels: 4,
                  material: 'shiny-metal',
                  fill: '#737d8e',
                  stroke: '#e4edf8',
                  surface: {
                    enabled: true,
                    curvature: 'convex',
                    reflectivity: 0.78,
                    roughness: 0.2,
                  },
                  texture: {
                    enabled: true,
                    kind: 'basketball',
                    count: 6,
                    radius: 2.4,
                    spacing: 0.08,
                  },
                },
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [72, 244],
              [138, 168],
              [226, 190],
              [314, 126],
              [438, 154],
            ],
            count: 7,
            samples: 24,
            lateralJitter: [-16, 16],
          },
        },
        {
          kind: 'stickerField',
          role: 'blobpla-hero-shell-cloth',
          z: 38,
          die: {
            family: 'stringSpawn',
            stroke: '#7f3042',
            strokeWidth: 1,
            glyph: { id: 'dash', count: 0 },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'alphaHull',
              padding: 8,
              sectors: 16,
              skin: { fill: '#452b37', opacity: 0.34 },
              fabric: {
                enabled: true,
                mode: 'drape',
                armor: {
                  enabled: true,
                  fit: 'blobpla',
                  type: 'hero-shell',
                  count: 3,
                  material: 'chrome',
                  fill: '#9a3f55',
                  stroke: '#ffd8df',
                  surface: {
                    enabled: true,
                    curvature: 'radial',
                    reflectivity: 0.9,
                    roughness: 0.12,
                  },
                  texture: {
                    enabled: true,
                    kind: 'grass',
                    count: 5,
                    height: 8,
                    spacing: 0.36,
                  },
                },
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [110, 292],
              [174, 224],
              [242, 284],
              [318, 208],
              [426, 248],
            ],
            count: 6,
            samples: 24,
            lateralJitter: [-18, 18],
          },
        },
        {
          kind: 'stickerField',
          role: 'raised-basketball-armor',
          z: 40,
          die: {
            family: 'stringSpawn',
            stroke: '#5f6670',
            strokeWidth: 1,
            glyph: { id: 'dash', count: 0 },
            cohere: {
              enabled: true,
              mode: 'clothing',
              envelope: 'stripHull',
              padding: 9,
              bins: 9,
              skin: { fill: '#34404b', opacity: 0.3 },
              fabric: {
                enabled: true,
                armor: {
                  enabled: true,
                  fit: 'volumizer-cast',
                  type: 'breastplate',
                  panels: 2,
                  material: 'steel',
                  fill: '#697482',
                  stroke: '#edf5ff',
                  texture: {
                    enabled: true,
                    kind: 'basketball',
                    lowering: 'sphere',
                    count: 7,
                    radius: 2.7,
                    surfaceCellHeight: 0.42,
                    surfaceLighting: true,
                  },
                },
              },
            },
          },
          field: {
            kind: 'alongPath',
            points: [
              [86, 316],
              [146, 246],
              [228, 264],
              [296, 212],
              [388, 234],
            ],
            count: 6,
            samples: 22,
            lateralJitter: [-14, 14],
          },
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const repeated = expandNeoRembrandt(manifest);
    const cast = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'cast-breastplate-cloth' && m.fabricArmor && !m.fabricArmorTexture && !m.fabricArmorSurface);
    const repeatedCast = repeated.marks.filter((m) => m.stringSpawnSkinRole === 'cast-breastplate-cloth' && m.fabricArmor && !m.fabricArmorTexture && !m.fabricArmorSurface);
    const blobpla = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'blobpla-hero-shell-cloth' && m.fabricArmor && !m.fabricArmorTexture && !m.fabricArmorSurface);
    const repeatedBlobpla = repeated.marks.filter((m) => m.stringSpawnSkinRole === 'blobpla-hero-shell-cloth' && m.fabricArmor && !m.fabricArmorTexture && !m.fabricArmorSurface);
    const castTexture = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'cast-breastplate-cloth' && m.fabricArmorTexture);
    const repeatedCastTexture = repeated.marks.filter((m) => m.stringSpawnSkinRole === 'cast-breastplate-cloth' && m.fabricArmorTexture);
    const blobplaTexture = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'blobpla-hero-shell-cloth' && m.fabricArmorTexture);
    const raisedTexture = expanded.marks.filter((m) => m.stringSpawnSkinRole === 'raised-basketball-armor' && m.fabricArmorTexture);
    const repeatedRaisedTexture = repeated.marks.filter((m) => m.stringSpawnSkinRole === 'raised-basketball-armor' && m.fabricArmorTexture);
    const metalSurface = expanded.marks.filter((m) => m.fabricArmorSurface);
    const repeatedMetalSurface = repeated.marks.filter((m) => m.fabricArmorSurface);

    expect(cast).toHaveLength(4);
    expect(blobpla).toHaveLength(3);
    expect(cast.every((m) => m.kind === 'polygon')).toBe(true);
    expect(blobpla.every((m) => m.kind === 'polygon')).toBe(true);
    expect(cast.every((m) => m.fabricArmorFit === 'volumizer-cast')).toBe(true);
    expect(cast.every((m) => m.armorCastSource === 'cohered-string-skin')).toBe(true);
    expect(cast.every((m) => m.volumizerReattribution === 'cohered-envelope-fit')).toBe(true);
    expect(blobpla.every((m) => m.fabricArmorFit === 'blobpla')).toBe(true);
    expect(blobpla.every((m) => m.blobPlaAdapter === true)).toBe(true);
    expect(blobpla.every((m) => typeof m.blobPlaPart === 'string')).toBe(true);
    expect(cast.every((m) => m.volumeSurface === 'cohered-string-skin')).toBe(true);
    expect(blobpla.every((m) => m.volumeSurface === 'cohered-string-skin')).toBe(true);
    expect(cast.every((m) => m.metalSurface === true && m.fillGradient?.role === 'armor-metal-base-gradient')).toBe(true);
    expect(blobpla.every((m) => m.metalSurface === true && m.fillGradient?.role === 'armor-metal-base-gradient')).toBe(true);
    expect(cast.map((m) => [m.points, m.fabricArmorPanelIndex])).toEqual(
      repeatedCast.map((m) => [m.points, m.fabricArmorPanelIndex]),
    );
    expect(blobpla.map((m) => [m.points, m.blobPlaPart])).toEqual(
      repeatedBlobpla.map((m) => [m.points, m.blobPlaPart]),
    );
    expect(castTexture.length).toBeGreaterThan(4);
    expect(blobplaTexture.length).toBeGreaterThan(4);
    expect(castTexture.every((m) => m.kind === 'circle')).toBe(true);
    expect(castTexture.every((m) => m.fabricArmorTextureKind === 'basketball')).toBe(true);
    expect(castTexture.every((m) => m.fabricArmorTextureLowering === 'circle')).toBe(true);
    expect(castTexture.every((m) => m.pastamaker?.packingMode === 'iguana-surface-grouping')).toBe(true);
    expect(raisedTexture.length).toBeGreaterThan(3);
    expect(raisedTexture.every((m) => m.sourceShape === 'sphere')).toBe(true);
    expect(raisedTexture.every((m) => m.kind === 'polygon')).toBe(true);
    expect(raisedTexture.every((m) => m.fabricArmorTextureLowering === 'sphere')).toBe(true);
    expect(raisedTexture.every((m) => m.surfaceCell === true && m.raisedSurfaceTexture === true)).toBe(true);
    expect(raisedTexture.every((m) => m.stroke === 'none' && m.strokeWidth === 0)).toBe(true);
    expect(raisedTexture.every((m) => m.surfaceCellZPolicy === 'lower-paints-over-upper')).toBe(true);
    expect(raisedTexture.every((m) => m.shade?.algorithm === 'form-light-stack')).toBe(true);
    expect(raisedTexture.every((m) => m.highlights?.algorithm === 'form-light-stack')).toBe(true);
    expect(raisedTexture.every((m) => m.fillGradient?.role === 'armor-texture-sphere-gradient')).toBe(true);
    const sortedRaised = raisedTexture
      .map((m) => ({ cy: m.cy, z: m.z }))
      .sort((a, b) => a.cy - b.cy);
    expect(sortedRaised[sortedRaised.length - 1].z).toBeGreaterThan(sortedRaised[0].z);
    expect(blobplaTexture.every((m) => m.kind === 'polyline')).toBe(true);
    expect(blobplaTexture.every((m) => m.fabricArmorTextureKind === 'grass')).toBe(true);
    expect(blobplaTexture.every((m) => m.armorTextureEmanatesOut === true)).toBe(true);
    expect(castTexture.map((m) => [m.cx, m.cy, m.r, m.fabricArmorTextureGroupIndex])).toEqual(
      repeatedCastTexture.map((m) => [m.cx, m.cy, m.r, m.fabricArmorTextureGroupIndex]),
    );
    expect(raisedTexture.map((m) => [m.cx, m.cy, m.r, m.surfaceCellHeight, m.fabricArmorTextureGroupIndex])).toEqual(
      repeatedRaisedTexture.map((m) => [m.cx, m.cy, m.r, m.surfaceCellHeight, m.fabricArmorTextureGroupIndex]),
    );
    expect(metalSurface.length).toBeGreaterThanOrEqual((cast.length + blobpla.length) * 2);
    expect(metalSurface.some((m) => m.metalHighlightRole === 'specular-band')).toBe(true);
    expect(metalSurface.some((m) => m.metalHighlightRole === 'shadow-rim')).toBe(true);
    expect(metalSurface.some((m) => m.metalHighlightRole === 'glint')).toBe(true);
    expect(metalSurface.every((m) => Number.isFinite(m.metalLightDot))).toBe(true);
    expect(metalSurface.map((m) => [m.role, m.points || [m.cx, m.cy, m.r], m.metalHighlightRole])).toEqual(
      repeatedMetalSurface.map((m) => [m.role, m.points || [m.cx, m.cy, m.r], m.metalHighlightRole]),
    );
  });

  it('expands bubbling fill fields into deterministic fractal bubble circles', () => {
    const expanded = expandNeoRembrandt(bubblingPatternManifest());
    const repeated = expandNeoRembrandt(bubblingPatternManifest());
    const bubbles = expanded.marks.filter((m) => m.stickerFieldRole === 'bubbling-fill');
    const repeatedBubbles = repeated.marks.filter((m) => m.stickerFieldRole === 'bubbling-fill');

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(4);
    expect(expanded.marks.some((m) => m.kind === 'stickerField')).toBe(false);
    expect(bubbles).toHaveLength(42);
    expect(bubbles.every((m) => m.kind === 'circle')).toBe(true);
    expect(bubbles.every((m) => m.pastamaker?.dieFamily === 'bubbling')).toBe(true);
    expect(bubbles.every((m) => m.pastamaker?.fieldKind === 'fillBox')).toBe(true);
    expect(new Set(bubbles.map((m) => m.pastamaker?.generation)).size).toBeGreaterThan(2);
    expect(Math.max(...bubbles.map((m) => m.r))).toBeGreaterThan(Math.min(...bubbles.map((m) => m.r)));
    expect(bubbles.map((m) => [m.cx, m.cy, m.r])).toEqual(repeatedBubbles.map((m) => [m.cx, m.cy, m.r]));
  });

  it('expands King krispies path bubbling into recursive midpoint bubble chains', () => {
    const expanded = expandNeoRembrandt(bubblingPatternManifest());
    const krispies = expanded.marks.filter((m) => m.stickerFieldRole === 'king-krispies-path');

    expect(krispies).toHaveLength(33);
    expect(krispies.every((m) => m.kind === 'circle')).toBe(true);
    expect(krispies.every((m) => m.pastamaker?.dieFamily === 'kingKrispies')).toBe(true);
    expect(krispies.every((m) => m.pastamaker?.fieldKind === 'alongPath')).toBe(true);
    expect(krispies[0].cx).toBeLessThan(krispies[krispies.length - 1].cx);
    expect(Math.max(...krispies.map((m) => m.r))).toBeGreaterThan(7);
    expect(krispies.every((m) => m.opacity > 0 && m.opacity <= 1)).toBe(true);
  });

  it('expands outward bubbling from two seed bubbles without a path line', () => {
    const expanded = expandNeoRembrandt(bubblingPatternManifest());
    const outward = expanded.marks.filter((m) => m.stickerFieldRole === 'outward-bubbling-fill');
    const seeds = outward.filter((m) => m.pastamaker?.anchorRole === 'seed');
    const generated = outward.filter((m) => m.pastamaker?.anchorRole === 'outward-midpoint');
    const minY = Math.min(...outward.map((m) => m.cy));
    const maxY = Math.max(...outward.map((m) => m.cy));

    expect(outward).toHaveLength(34);
    expect(seeds).toHaveLength(2);
    expect(generated).toHaveLength(32);
    expect(outward.every((m) => m.kind === 'circle')).toBe(true);
    expect(outward.every((m) => m.pastamaker?.fieldKind === 'outwardFill')).toBe(true);
    expect(maxY - minY).toBeGreaterThan(120);
  });

  it('uses larger anchor circles to shape King krispies constellations', () => {
    const expanded = expandNeoRembrandt(bubblingPatternManifest());
    const constellation = expanded.marks.filter((m) => m.stickerFieldRole === 'king-krispies-anchors');
    const anchors = constellation.filter((m) => m.pastamaker?.anchorRole === 'large-anchor');
    const satellites = constellation.filter((m) => m.pastamaker?.anchorRole === 'satellite');
    const minAnchorRadius = Math.min(...anchors.map((m) => m.r));
    const medianSatelliteRadius = satellites.map((m) => m.r).sort((a, b) => a - b)[Math.floor(satellites.length / 2)];

    expect(constellation).toHaveLength(42);
    expect(anchors).toHaveLength(4);
    expect(satellites).toHaveLength(38);
    expect(constellation.every((m) => m.pastamaker?.dieFamily === 'kingKrispies')).toBe(true);
    expect(minAnchorRadius).toBeGreaterThan(medianSatelliteRadius);
    expect(new Set(anchors.map((m) => `${m.cx},${m.cy}`))).toHaveLength(4);
  });

  it('expands Iguana bubbling into deterministic continuous tangent circle fields', () => {
    const expanded = expandNeoRembrandt(iguanaPatternManifest());
    const repeated = expandNeoRembrandt(iguanaPatternManifest());
    const fillManifest = structuredClone(iguanaPatternManifest());
    delete fillManifest.marks.find((m) => m.role === 'iguana-fixed-r').field.count;
    const fillExpanded = expandNeoRembrandt(fillManifest);
    const fixed = expanded.marks.filter((m) => m.stickerFieldRole === 'iguana-fixed-r');
    const noisy = expanded.marks.filter((m) => m.stickerFieldRole === 'iguana-noisy-r');
    const repeatedFixed = repeated.marks.filter((m) => m.stickerFieldRole === 'iguana-fixed-r');
    const filled = fillExpanded.marks.filter((m) => m.stickerFieldRole === 'iguana-fixed-r');

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(2);
    expect(expanded.marks.some((m) => m.kind === 'stickerField')).toBe(false);
    expect(fixed).toHaveLength(90);
    expect(noisy).toHaveLength(72);
    expect(fixed.every((m) => m.kind === 'circle')).toBe(true);
    expect(noisy.every((m) => m.kind === 'circle')).toBe(true);
    expect(fixed.every((m) => m.pastamaker?.dieFamily === 'iguana')).toBe(true);
    expect(fixed.every((m) => m.pastamaker?.packingMode === 'continuous-tangent-field')).toBe(true);
    expect(fixed.every((m) => m.pastamaker?.collisionIndex === 'spatial-grid')).toBe(true);
    expect(fixed.every((m) => m.pastamaker?.glyphCircleCount === 3)).toBe(true);
    expect(new Set(fixed.map((m) => m.r))).toEqual(new Set([6]));
    expect(new Set(noisy.map((m) => m.r)).size).toBeGreaterThan(1);
    expect(fixed.map((m) => [m.cx, m.cy, m.r])).toEqual(repeatedFixed.map((m) => [m.cx, m.cy, m.r]));
    expect(filled.length).toBeGreaterThan(fixed.length);

    let nearestDistance = Infinity;
    for (let i = 0; i < fixed.length; i++) {
      for (let j = i + 1; j < fixed.length; j++) {
        const distance = Math.hypot(fixed[i].cx - fixed[j].cx, fixed[i].cy - fixed[j].cy);
        nearestDistance = Math.min(nearestDistance, distance);
        expect(distance).toBeGreaterThanOrEqual(fixed[i].r + fixed[j].r - 0.08);
      }
    }
    expect(nearestDistance).toBeLessThanOrEqual(12.08);
  });

  it('lowers BlobPla adapters into ordinary connector marks without changing source masses', () => {
    const manifest = {
      title: 'BlobPla adapter proof',
      viewBox: { width: 360, height: 260 },
      marks: [
        { kind: 'blob', role: 'torso-mass', anchor: [178, 86], rx: 54, ry: 42, fill: '#c8d8ef', z: 10 },
        { kind: 'blob', role: 'pelvis-mass', anchor: [178, 168], rx: 62, ry: 36, fill: '#d8c7ef', z: 12 },
        {
          kind: 'blobPla',
          role: 'torso-pelvis-adapter',
          sourceRole: 'torso-mass',
          receiverRole: 'pelvis-mass',
          joint: { radius: 13, fill: '#efe0b8' },
          socket: { radius: 17, stroke: '#493a59' },
          stem: { radius: 5, stroke: '#6b6473' },
          gravity: { lowerUnit: true },
          z: 18,
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const adapters = expanded.marks.filter((m) => m.blobPlaAdapter);
    const parts = new Set(adapters.map((m) => m.blobPlaPart));

    expect(expanded.neoRembrandt.constructionMarkCount).toBe(1);
    expect(expanded.marks.some((m) => m.kind === 'blobPla')).toBe(false);
    expect(expanded.marks.some((m) => m.role === 'torso-mass')).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'pelvis-mass')).toBe(true);
    expect(adapters).toHaveLength(3);
    expect(parts).toEqual(new Set(['stem', 'socket', 'joint']));
    expect(adapters.every((m) => m.blobPlaRole === 'torso-pelvis-adapter')).toBe(true);
    expect(adapters.every((m) => m.supportBehavior === 'lower-unit')).toBe(true);
    expect(adapters.find((m) => m.blobPlaJoint)?.sourceShape).toBe('sphere');
  });
});

describe('expandNeoRembrandt consensus chain metadata', () => {
  const minimalManifest = () => ({
    viewBox: { width: 240, height: 240 },
    marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
  });

  const stageIds = [
    'intent',
    'authorship-preview',
    'abstract-constellation',
    'shot-contract',
    'meru-basis',
    'physical-hitboxes',
    'material-contracts',
    'construction-adapters',
    'visible-skin',
    'preflight-verdict',
    'budget',
    'reconciliation',
  ];

  it('emits a chain stage list in consensus order', () => {
    const expanded = expandNeoRembrandt(minimalManifest());
    const chain = expanded.neoRembrandt.chain;
    expect(chain).toBeDefined();
    expect(Array.isArray(chain.stages)).toBe(true);
    expect(chain.stages.map((stage) => stage.id)).toEqual(stageIds);
    for (const stage of chain.stages) {
      expect(typeof stage.id).toBe('string');
      expect(typeof stage.status).toBe('string');
    }
  });

  it('emits a passed authorshipPreview for legacy-open manifests with no planning gate', () => {
    const expanded = expandNeoRembrandt(minimalManifest());
    const ap = expanded.neoRembrandt.authorshipPreview;
    expect(ap.immutable).toBe(true);
    expect(ap.phase).toBe('pre-expansion');
    expect(ap.verdict).toBe('passed');
    expect(ap.gateActive).toBe(false);
    expect(ap.materializationGate).toBe('legacy-open');
    expect(Array.isArray(ap.checks)).toBe(true);
    expect(typeof ap.blockingCount).toBe('number');
    expect(typeof ap.advisoryCount).toBe('number');

    const chainSummary = expanded.neoRembrandt.chain.authorshipPreview;
    expect(chainSummary.immutable).toBe(true);
    expect(chainSummary.verdict).toBe('passed');
    expect(chainSummary.phase).toBe('pre-expansion');
    expect(chainSummary.gateActive).toBe(false);
    expect(chainSummary.materializationGate).toBe('legacy-open');
  });

  it('blocks authorshipPreview when planning-valid manifest declares gravity body without support', () => {
    const manifest = {
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        metamandala: {
          gravity: {
            enabled: true,
            bodies: [{ targetRole: 'orb' }], // no supportRole / surfaceRole / on
          },
        },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    const ap = expanded.neoRembrandt.authorshipPreview;
    expect(ap.verdict).toBe('blocked');
    expect(ap.gateActive).toBe(true);
    expect(ap.materializationGate).toBe('planning-valid');
    expect(ap.blockingCount).toBeGreaterThan(0);
    expect(ap.checks.some((c) => c.role === 'orb:declared-gravity-has-support' && c.ok === false)).toBe(true);

    const stage = expanded.neoRembrandt.chain.stages.find((s) => s.id === 'authorship-preview');
    expect(stage?.status).toBe('blocked');
    expect(stage?.gateActive).toBe(true);
  });

  it('passes authorshipPreview when planning-valid manifest declares gravity body WITH support', () => {
    const manifest = {
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        metamandala: {
          gravity: {
            enabled: true,
            bodies: [{ targetRole: 'orb', supportRole: 'ground' }],
          },
        },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    const ap = expanded.neoRembrandt.authorshipPreview;
    expect(ap.verdict).toBe('passed');
    expect(ap.gateActive).toBe(true);
    const supportCheck = ap.checks.find((c) => c.role === 'orb:declared-gravity-has-support');
    expect(supportCheck?.ok).toBe(true);
    expect(supportCheck?.supportRole).toBe('ground');
  });

  it('blocks authorshipPreview when shotGlyph lacks required topology fields under planning-valid', () => {
    const manifest = {
      viewBox: { width: 360, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        shotGlyphs: [{ id: 'lead-shot', topology: { cameraVector: 'low-angle' } }], // missing lightEntry + support
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [180, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    const ap = expanded.neoRembrandt.authorshipPreview;
    expect(ap.verdict).toBe('blocked');
    expect(ap.checks.some((c) => c.role === 'lead-shot:shot-glyph-light-entry' && c.ok === false)).toBe(true);
    expect(ap.checks.some((c) => c.role === 'lead-shot:shot-glyph-support' && c.ok === false)).toBe(true);
    expect(ap.checks.find((c) => c.role === 'lead-shot:shot-glyph-camera-vector')?.ok).toBe(true);
  });

  it('refuses expansion under planning-valid: blocked authorshipPreview emits diagnostic marks only', () => {
    const manifest = {
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        metamandala: { gravity: { enabled: true, bodies: [{ targetRole: 'orb' }] } },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    expect(expanded.neoRembrandt.authorshipPreview.verdict).toBe('blocked');
    expect(expanded.neoRembrandt.expanded).toBe(false);
    expect(expanded.neoRembrandt.expansionRefused).toBe(true);
    expect(expanded.neoRembrandt.refusalReason).toBe('authorship-preview-blocked');
    // The author's blob should NOT appear — only diagnostic marks.
    expect(expanded.marks.some((m) => m.kind === 'blob' && m.role === 'orb')).toBe(false);
    expect(expanded.marks.every((m) => m.authorshipPreviewDiagnostic === true)).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'authorship-preview:blocked-panel')).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'authorship-preview:blocked-title')).toBe(true);
    expect(expanded.marks.filter((m) => /^authorship-preview:blocked-check-/.test(m.role)).length).toBeGreaterThan(0);
  });

  it('does NOT refuse expansion when materializationGate is not planning-valid (legacy-open)', () => {
    const manifest = {
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        // No spatialPlanning declared → materializationGate is 'legacy-open'.
        metamandala: { gravity: { enabled: true, bodies: [{ targetRole: 'orb' }] } },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    // gate is not active, so verdict is 'passed' even though gravity has no support
    expect(expanded.neoRembrandt.authorshipPreview.gateActive).toBe(false);
    expect(expanded.neoRembrandt.authorshipPreview.verdict).toBe('passed');
    expect(expanded.neoRembrandt.expansionRefused).toBeUndefined();
    expect(expanded.neoRembrandt.expanded).toBe(true);
    expect(expanded.marks.some((m) => m.role === 'orb')).toBe(true);
  });

  it('refusal short-circuits downstream chain stages to not-evaluated', () => {
    const manifest = {
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        metamandala: { gravity: { enabled: true, bodies: [{ targetRole: 'orb' }] } },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    const stages = expanded.neoRembrandt.chain.stages;
    const authorshipStage = stages.find((s) => s.id === 'authorship-preview');
    const preflightStage = stages.find((s) => s.id === 'preflight-verdict');
    const visibleSkinStage = stages.find((s) => s.id === 'visible-skin');
    expect(authorshipStage?.status).toBe('blocked');
    expect(preflightStage?.status).toBe('not-evaluated');
    expect(visibleSkinStage?.status).toBe('not-evaluated');
    expect(expanded.neoRembrandt.preflight.verdict).toBe('not-evaluated');
    expect(expanded.neoRembrandt.reconciliation.applied).toBe(false);
  });

  it('derives preflight from the existing spatialPlan verdict', () => {
    const expanded = expandNeoRembrandt(minimalManifest());
    const { preflight, spatialPlan } = expanded.neoRembrandt;
    expect(preflight.immutable).toBe(true);
    expect(preflight.phase).toBe('post-expansion');
    expect(['passed', 'blocked', 'not-evaluated']).toContain(preflight.verdict);
    expect(preflight.validation).toBe(spatialPlan.validation);
    expect(preflight.materializationGate).toBe(spatialPlan.materializationGate);
    if (spatialPlan.materializationGate?.status === 'blocked') {
      expect(preflight.verdict).toBe('blocked');
    } else if (spatialPlan.validation?.ok) {
      expect(preflight.verdict).toBe('passed');
    }
  });

  it('declares no back-edge from reconciliation to either gate', () => {
    const expanded = expandNeoRembrandt(minimalManifest());
    expect(expanded.neoRembrandt.reconciliation.invalidatesPreflight).toBe(false);
    expect(expanded.neoRembrandt.reconciliation.invalidatesAuthorshipPreview).toBe(false);
    expect(typeof expanded.neoRembrandt.reconciliation.applied).toBe('boolean');
    expect(expanded.neoRembrandt.chain.reconciliation).toEqual({
      invalidatesPreflight: false,
      invalidatesAuthorshipPreview: false,
    });
  });

  it('leaves the existing spatialPlan field untouched (back-compat alias deferred)', () => {
    const expanded = expandNeoRembrandt(minimalManifest());
    expect(expanded.neoRembrandt.spatialPlan).toBeDefined();
    expect(expanded.neoRembrandt.spatialPlanValid).toBe(expanded.neoRembrandt.spatialPlan.validation.ok);
    expect(expanded.neoRembrandt.spatialPlanMaterializationGate).toBe(expanded.neoRembrandt.spatialPlan.materializationGate);
  });

  it('marks the preflight-verdict stage blocked when the underlying gate blocks', () => {
    const manifest = {
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        metamandala: {
          gravity: {
            enabled: true,
            bodies: [{ targetRole: 'orb', supportRole: 'missing-floor' }],
          },
        },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    if (expanded.neoRembrandt.spatialPlan.materializationGate.status === 'blocked') {
      expect(expanded.neoRembrandt.preflight.verdict).toBe('blocked');
      const stage = expanded.neoRembrandt.chain.stages.find((s) => s.id === 'preflight-verdict');
      expect(stage?.status).toBe('blocked');
    }
  });
});

describe('expandNeoRembrandt Phase 3 constellation split', () => {
  const ccaOnlyManifest = () => ({
    viewBox: { width: 360, height: 260 },
    polygonizer: {
      constellation: {
        kind: 'cca-constellation-grid',
        vanishingPoint: [180, 92],
        horizonY: 92,
        baselineY: 220,
        axisMundi: { anchor: [180, 130] },
        nodes: [
          {
            role: 'subject',
            renderOrder: 10,
            depthBand: 'midground',
            anchor: [180, 130],
            bounds: { x: 120, y: 80, width: 120, height: 120 },
            cca: {
              center: [180, 140],
              lengthAxis: [[120, 140], [240, 140]],
              heightAxis: [[180, 200], [180, 80]],
              depthAxis: { toward: [180, 92] },
            },
          },
        ],
      },
    },
    marks: [
      { kind: 'polygon', role: 'subject', points: [[150, 100], [210, 100], [210, 180], [150, 180]], fill: '#777' },
    ],
  });

  it('exposes abstractConstellation with no physical hitboxes when only CCA nodes are declared', () => {
    const expanded = expandNeoRembrandt(ccaOnlyManifest());
    const { abstractConstellation, physicalHitboxes, chain } = expanded.neoRembrandt;
    expect(abstractConstellation).toBeTruthy();
    expect(abstractConstellation.nodeCount).toBe(1);
    expect(abstractConstellation.nodes[0].role).toBe('subject');
    expect(abstractConstellation.nodes[0].hitboxCount).toBe(0);
    expect(physicalHitboxes.declaredHitboxCount).toBe(0);
    expect(physicalHitboxes.collisionBodyCount).toBe(0);
    expect(physicalHitboxes.contactRegionCount).toBe(0);
    const abstractStage = chain.stages.find((s) => s.id === 'abstract-constellation');
    const meruStage = chain.stages.find((s) => s.id === 'meru-basis');
    const physicalStage = chain.stages.find((s) => s.id === 'physical-hitboxes');
    expect(abstractStage.status).toBe('resolved');
    expect(meruStage.status).toBe('not-declared');
    expect(physicalStage.status).toBe('not-declared');
  });

  it('resolves physical hitboxes after Meru when gravity supports are declared', () => {
    const manifest = {
      viewBox: { width: 360, height: 260 },
      polygonizer: {
        constellation: {
          kind: 'cca-constellation-grid',
          vanishingPoint: [180, 92],
          nodes: [
            {
              role: 'table',
              renderOrder: 20,
              depthBand: 'foreground',
              anchor: [180, 216],
              bounds: { x: 10, y: 170, width: 340, height: 78 },
              cca: {
                center: [180, 209],
                lengthAxis: [[38, 193], [322, 193]],
                heightAxis: [[180, 248], [180, 170]],
                depthAxis: { toward: [180, 92] },
              },
              hitboxes: [
                {
                  role: 'tabletop-support',
                  kind: 'support-plane',
                  bounds: { x: 52, y: 170, width: 256, height: 46 },
                  supportRail: 'safe-standing',
                },
              ],
            },
          ],
        },
        meru: { basis: 'L' },
        metamandala: {
          basis: 'L',
          gravity: {
            enabled: true,
            supports: [
              {
                role: 'tabletop-support',
                kind: 'fromHitbox',
                nodeRole: 'table',
                hitboxRole: 'tabletop-support',
                rail: 'safe-standing',
              },
            ],
            bodies: [
              { role: 'bowl-body', supportRole: 'tabletop-support' },
            ],
          },
        },
      },
      marks: [
        { kind: 'polygon', role: 'tabletop', points: [[38, 170], [322, 170], [350, 216], [10, 216]], fill: '#7d644c', z: 20 },
        { kind: 'polygon', role: 'bowl-body', points: [[126, 140], [234, 140], [220, 170], [140, 170]], fill: '#8fa6aa', z: 1 },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const { abstractConstellation, physicalHitboxes, chain } = expanded.neoRembrandt;
    expect(abstractConstellation.nodeCount).toBe(1);
    expect(abstractConstellation.nodes[0].hitboxCount).toBe(1);
    expect(physicalHitboxes.declaredHitboxCount).toBeGreaterThan(0);
    expect(physicalHitboxes.collisionBodyCount).toBeGreaterThan(0);
    expect(physicalHitboxes.collisionBodies[0].role).toBe('bowl-body');
    expect(physicalHitboxes.collisionBodies[0].supportRole).toBe('tabletop-support');
    const meruStage = chain.stages.find((s) => s.id === 'meru-basis');
    const physicalStage = chain.stages.find((s) => s.id === 'physical-hitboxes');
    expect(meruStage.status).toBe('resolved');
    expect(physicalStage.status).toBe('resolved');
  });

  it('keeps polygonizer.constellation untouched for back-compat', () => {
    const manifest = ccaOnlyManifest();
    const expanded = expandNeoRembrandt(manifest);
    expect(expanded.polygonizer.constellation.nodes.length).toBe(1);
    expect(expanded.polygonizer.constellation.nodes[0].role).toBe('subject');
  });

  it('exposes abstractConstellation for a form-authored figure even without gravity', () => {
    const manifest = {
      viewBox: { width: 360, height: 460 },
      scene: { palette: 'warm-low-key', light: { direction: [-0.58, -0.82] } },
      marks: [
        {
          kind: 'form',
          role: 'figure',
          mode: 'dummy',
          stock: 'full-body-dummy',
          anchor: [180, 240],
          scale: 1,
          fill: '#b1845e',
          stroke: '#4f3928',
          z: 20,
        },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const { abstractConstellation, physicalHitboxes, chain } = expanded.neoRembrandt;
    expect(abstractConstellation).toBeTruthy();
    expect(abstractConstellation.formConstellationAuthored).toBe(true);
    expect(abstractConstellation.nodeCount).toBeGreaterThan(0);
    expect(physicalHitboxes.declaredHitboxCount).toBe(0);
    expect(physicalHitboxes.collisionBodyCount).toBe(0);
    const abstractStage = chain.stages.find((s) => s.id === 'abstract-constellation');
    const physicalStage = chain.stages.find((s) => s.id === 'physical-hitboxes');
    expect(abstractStage.status).toBe('resolved');
    expect(physicalStage.status).toBe('not-declared');
  });
});

describe('expandNeoRembrandt Phase 4 shot contract', () => {
  const minimalShotManifest = () => ({
    viewBox: { width: 480, height: 320 },
    marks: [{ kind: 'blob', role: 'orb', anchor: [240, 160], rx: 40, ry: 40, fill: '#999' }],
  });

  it('freezes a shotContract that preserves the declared viewBox', () => {
    const expanded = expandNeoRembrandt(minimalShotManifest());
    const { shotContract } = expanded.neoRembrandt;
    expect(shotContract).toBeTruthy();
    expect(shotContract.frozen).toBe(true);
    expect(shotContract.viewBox).toEqual({ x: 0, y: 0, width: 480, height: 320 });
    expect(shotContract.viewport).toEqual({ width: 480, height: 320 });
    expect(shotContract.cropPolicy).toBe('no-crop');
    expect(shotContract.preserveAspectRatio).toBe('xMidYMid meet');
    expect(shotContract.source).toBe('manifest');
    expect(Object.isFrozen(shotContract)).toBe(true);
    expect(Object.isFrozen(shotContract.viewBox)).toBe(true);
  });

  it('exposes the same frozen shotContract on the chain stage and preflight', () => {
    const expanded = expandNeoRembrandt(minimalShotManifest());
    const { shotContract, chain, preflight, spatialPlan } = expanded.neoRembrandt;
    expect(preflight.shotContract).toBe(shotContract);
    expect(spatialPlan.shotContract).toBe(shotContract);
    const stage = chain.stages.find((s) => s.id === 'shot-contract');
    expect(stage.status).toBe('frozen');
    expect(stage.viewBox).toEqual(shotContract.viewBox);
  });

  it('preflight adds a shot-contract-frozen check when planning is enabled', () => {
    const manifest = {
      viewBox: { width: 320, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [160, 120], rx: 32, ry: 32, fill: '#999' }],
    };
    const expanded = expandNeoRembrandt(manifest);
    const frozen = expanded.neoRembrandt.spatialPlan.validation.checks.find(
      (check) => check.role === 'shot-contract-frozen',
    );
    expect(frozen).toBeTruthy();
    expect(frozen.ok).toBe(true);
    expect(frozen.viewBox).toEqual(expanded.neoRembrandt.shotContract.viewBox);
  });

  it('reports mark overflow on reconciliation without mutating the shotContract', () => {
    const declaredViewBox = { width: 240, height: 160 };
    const manifest = {
      viewBox: { ...declaredViewBox },
      marks: [
        { kind: 'rect', role: 'oversized', x: -40, y: -20, w: 360, h: 240, fill: '#999' },
      ],
    };
    const expanded = expandNeoRembrandt(manifest);
    const { shotContract, reconciliation, shotContractFit } = expanded.neoRembrandt;
    expect(shotContract.viewBox.width).toBe(240);
    expect(shotContract.viewBox.height).toBe(160);
    expect(shotContractFit).toBeTruthy();
    expect(shotContractFit.ok).toBe(false);
    expect(shotContractFit.overflow).toBeTruthy();
    expect(shotContractFit.overflow.left).toBeGreaterThan(0);
    expect(shotContractFit.overflow.right).toBeGreaterThan(0);
    expect(reconciliation.shotContractMutated).toBe(false);
    expect(reconciliation.shotContractOverflow).toEqual(shotContractFit.overflow);
  });

  it('shotContract.viewBox is immune to direct mutation attempts', () => {
    const expanded = expandNeoRembrandt(minimalShotManifest());
    const { shotContract } = expanded.neoRembrandt;
    const originalWidth = shotContract.viewBox.width;
    try {
      shotContract.viewBox.width = 9999;
    } catch (_err) {
      // strict mode throws on frozen mutation; non-strict silently fails
    }
    try {
      shotContract.frozen = false;
    } catch (_err) {
      // same
    }
    expect(shotContract.viewBox.width).toBe(originalWidth);
    expect(shotContract.frozen).toBe(true);
  });
});

describe('expandNeoRembrandt Phase 6 material contracts', () => {
  it('emits an empty materialContracts array for a manifest with no tagged marks or adapters', () => {
    const expanded = expandNeoRembrandt({
      viewBox: { width: 240, height: 240 },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    });
    expect(expanded.neoRembrandt.materialContracts).toEqual([]);
    expect(expanded.neoRembrandt.materialContractsSummary).toEqual({
      count: 0, familyCounts: {}, phaseCounts: {}, families: [], phases: [],
    });
    const stage = expanded.neoRembrandt.chain.stages.find((s) => s.id === 'material-contracts');
    expect(stage?.status).toBe('not-declared');
    expect(stage?.count).toBe(0);
  });

  it('classifies recipe-tagged marks (Phase 4) into materialContracts with the empirical family names', () => {
    const expanded = expandNeoRembrandt({
      viewBox: { width: 400, height: 500 },
      marks: [
        { kind: 'rect', role: 'background', x: 0, y: 0, w: 400, h: 500, fill: '#111',
          generatedMass: 'flat-backdrop', materialContractFamily: 'backdrop' },
        { kind: 'polygon', role: 'shoulders-mass', points: [[100, 300], [300, 300], [380, 500], [20, 500]],
          fill: '#3f2620', generatedMass: 'peach-profile-shoulders', materialContractFamily: 'peach-profile' },
        { kind: 'blob', role: 'head-mass', anchor: [200, 180], rx: 60, ry: 80, fill: '#c69b78',
          generatedMass: 'inverted-egg-head', materialContractFamily: 'peach-profile' },
        { kind: 'oval', role: 'eye-left', cx: 178, cy: 178, rx: 6, ry: 4, fill: '#111',
          generatedMass: 'eye-oval', materialContractFamily: 'face-feature' },
      ],
    });
    const contracts = expanded.neoRembrandt.materialContracts;
    expect(contracts).toHaveLength(4);
    const byRole = Object.fromEntries(contracts.map((c) => [c.role, c]));
    expect(byRole.background).toMatchObject({ family: 'backdrop', adapter: 'flat-backdrop', phase: 'visible-skin', source: 'recipe-tag' });
    expect(byRole['shoulders-mass']).toMatchObject({ family: 'peach-profile', adapter: 'peach-profile-shoulders', phase: 'visible-skin' });
    expect(byRole['head-mass']).toMatchObject({ family: 'peach-profile', adapter: 'inverted-egg-head' });
    expect(byRole['eye-left']).toMatchObject({ family: 'face-feature', adapter: 'eye-oval' });

    const summary = expanded.neoRembrandt.materialContractsSummary;
    expect(summary.count).toBe(4);
    expect(summary.familyCounts).toEqual({ backdrop: 1, 'peach-profile': 2, 'face-feature': 1 });
    expect(summary.phaseCounts).toEqual({ 'visible-skin': 4 });
    expect(summary.families).toEqual(['backdrop', 'face-feature', 'peach-profile']);

    const stage = expanded.neoRembrandt.chain.stages.find((s) => s.id === 'material-contracts');
    expect(stage?.status).toBe('resolved');
    expect(stage?.count).toBe(4);
    expect(stage?.families).toEqual(['backdrop', 'face-feature', 'peach-profile']);
    expect(stage?.phases).toEqual(['visible-skin']);
  });

  it('classifies blobPla adapter marks as joinery (a-priori) with sourceRole + receiverRole as targets', () => {
    const expanded = expandNeoRembrandt({
      viewBox: { width: 400, height: 400 },
      marks: [
        { kind: 'blob', role: 'torso-mass', anchor: [200, 130], rx: 54, ry: 42, fill: '#c8d8ef', z: 10 },
        { kind: 'blob', role: 'pelvis-mass', anchor: [200, 240], rx: 62, ry: 36, fill: '#d8c7ef', z: 12 },
        {
          kind: 'blobPla',
          role: 'torso-pelvis-adapter',
          sourceRole: 'torso-mass',
          receiverRole: 'pelvis-mass',
          joint: { radius: 13, fill: '#efe0b8' },
          socket: { radius: 17, stroke: '#493a59' },
          stem: { radius: 5, stroke: '#6b6473' },
          gravity: { lowerUnit: true },
          z: 18,
        },
      ],
    });
    const contracts = expanded.neoRembrandt.materialContracts;
    const joinery = contracts.filter((c) => c.family === 'joinery');
    expect(joinery.length).toBeGreaterThan(0);
    expect(joinery.every((c) => c.adapter === 'blobPla')).toBe(true);
    expect(joinery.every((c) => c.phase === 'construction-adapter')).toBe(true);
    expect(joinery.every((c) => c.source === 'a-priori')).toBe(true);
    expect(joinery.every((c) => c.targetRoles.includes('torso-mass') && c.targetRoles.includes('pelvis-mass'))).toBe(true);
    expect(joinery.every((c) => ['stem', 'socket', 'joint'].includes(c.part))).toBe(true);

    const summary = expanded.neoRembrandt.materialContractsSummary;
    expect(summary.families).toContain('joinery');
    expect(summary.phaseCounts['construction-adapter']).toBeGreaterThan(0);
  });

  it('does not classify diagnostic marks (spatialPlan / authorshipPreview) as contracts', () => {
    const expanded = expandNeoRembrandt({
      viewBox: { width: 240, height: 240 },
      polygonizer: {
        spatialPlanning: { mode: 'plan-before-skin', materializationGate: 'planning-valid' },
        metamandala: { gravity: { enabled: true, bodies: [{ targetRole: 'orb' }] } },
      },
      marks: [{ kind: 'blob', role: 'orb', anchor: [120, 120], rx: 24, ry: 24, fill: '#999' }],
    });
    // This manifest is blocked by authorship preview (no support role) → diagnostic marks only.
    expect(expanded.neoRembrandt.expansionRefused).toBe(true);
    // Even with diagnostic marks present, no material contracts should be derived.
    expect(expanded.neoRembrandt.materialContracts || []).toEqual([]);
  });

  it('de-dupes per (role, adapter) so shadow/highlight derivatives do not emit duplicate contracts', () => {
    const expanded = expandNeoRembrandt({
      viewBox: { width: 240, height: 240 },
      marks: [
        // Two marks share role + adapter — should yield one contract.
        { kind: 'polygon', role: 'shoulders', points: [[0, 0], [10, 0], [10, 10]],
          generatedMass: 'peach-profile-shoulders', materialContractFamily: 'peach-profile' },
        { kind: 'polygon', role: 'shoulders', points: [[20, 20], [30, 20], [30, 30]],
          generatedMass: 'peach-profile-shoulders', materialContractFamily: 'peach-profile' },
      ],
    });
    const contracts = expanded.neoRembrandt.materialContracts;
    expect(contracts).toHaveLength(1);
    expect(contracts[0].role).toBe('shoulders');
  });
});
