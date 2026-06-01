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
    expect(dummySpace.projection.localToOverall).toBe('fit-local-mandala-to-node-bounds');
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
    expect(leftBottom.points[1][0]).toBeCloseTo(lineXAtY(leftGuide, leftBottom.points[1][1]), 2);
    expect(leftBottom.points[2][0]).toBeCloseTo(lineXAtY(leftGuide, leftBottom.points[2][1]), 2);
    expect(rightBottom.points[0][0]).toBeCloseTo(lineXAtY(rightGuide, rightBottom.points[0][1]), 2);
    expect(rightBottom.points[3][0]).toBeCloseTo(lineXAtY(rightGuide, rightBottom.points[3][1]), 2);
    expect(leftTop.solidUpperGuideLine[0][0]).toBeCloseTo(leftGuide[0][0], 2);
    expect(rightTop.solidUpperGuideLine[0][0]).toBeCloseTo(rightGuide[0][0], 2);
    expect(leftTop.solidUpperGuideLine[0][1]).toBeLessThan(leftGuide[0][1]);
    expect(rightTop.solidUpperGuideLine[0][1]).toBeLessThan(rightGuide[0][1]);
    expect(leftTop.solidUpperGuideLine[1][0]).toBeLessThan(leftTop.solidUpperGuideLine[0][0]);
    expect(leftTop.solidUpperGuideLine[1][1]).toBeGreaterThan(leftTop.solidUpperGuideLine[0][1]);
    expect(rightTop.solidUpperGuideLine[1][0]).toBeGreaterThan(rightTop.solidUpperGuideLine[0][0]);
    expect(rightTop.solidUpperGuideLine[1][1]).toBeGreaterThan(rightTop.solidUpperGuideLine[0][1]);
    expect(leftTop.points[1][0]).toBeCloseTo(lineXAtY(leftTop.solidUpperGuideLine, leftTop.points[1][1]), 2);
    expect(leftTop.points[2][0]).toBeCloseTo(lineXAtY(leftTop.solidUpperGuideLine, leftTop.points[2][1]), 2);
    expect(rightTop.points[0][0]).toBeCloseTo(lineXAtY(rightTop.solidUpperGuideLine, rightTop.points[0][1]), 2);
    expect(rightTop.points[3][0]).toBeCloseTo(lineXAtY(rightTop.solidUpperGuideLine, rightTop.points[3][1]), 2);
    expect(leftTop.points[1][0] - leftTop.points[0][0]).toBeCloseTo(leftBottom.points[1][0] - leftBottom.points[0][0], 2);
    expect(leftTop.points[2][0] - leftTop.points[3][0]).toBeCloseTo(leftBottom.points[2][0] - leftBottom.points[3][0], 2);
    expect(rightTop.points[1][0] - rightTop.points[0][0]).toBeCloseTo(rightBottom.points[1][0] - rightBottom.points[0][0], 2);
    expect(rightTop.points[2][0] - rightTop.points[3][0]).toBeCloseTo(rightBottom.points[2][0] - rightBottom.points[3][0], 2);
    expect(leftTop.points[1][0]).toBeCloseTo(leftBottom.points[1][0], 2);
    expect(rightTop.points[0][0]).toBeCloseTo(rightBottom.points[0][0], 2);
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
});
