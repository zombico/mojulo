/**
 * Aircraft fuselage wrap-net SVG output generator.
 *
 * Output:
 *   lite-template/integration/0609/spike-output/aircraft-fuselage-wrap-net/
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveAircraftFuselageWrapNet,
} from './aircraft-fuselage-wrap-net.js';
import { buildAircraftSpineManji } from './vehicle-manji.js';
import { projectTwoPoint } from './pure-mandala.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUTPUT_DIR = path.join(
  REPO_ROOT,
  'lite-template',
  'integration',
  '0609',
  'spike-output',
  'aircraft-fuselage-wrap-net',
);

const PASSENGER_JET = {
  role: 'passenger-jet-fuselage',
  stations: 34,
  seam: 'belly',
  bands: [
    { id: 'top', sectors: 2, label: 'top crown' },
    { id: 'starboard-upper', sectors: 2, label: 'starboard windows' },
    { id: 'starboard-lower', sectors: 2, label: 'starboard lower skin' },
    { id: 'belly', sectors: 2, label: 'belly seam' },
    { id: 'port-lower', sectors: 2, label: 'port lower skin' },
    { id: 'port-upper', sectors: 2, label: 'port windows' },
  ],
  profile: [
    { t: 0.00, radius: 0.04 },
    { t: 0.08, radius: 0.82 },
    { t: 0.16, radius: 1.00 },
    { t: 0.72, radius: 1.00 },
    { t: 0.90, radius: 0.52 },
    { t: 1.00, radius: 0.12 },
  ],
  rhythm: ['skin'],
  zones: [
    { id: 'nose', stations: [0, 4], motif: 'nose-skin' },
    { id: 'cabin', stations: [5, 25], rhythm: ['window', 'skin'] },
    { id: 'tail-cone', stations: [27, 33], motif: 'tail-skin' },
  ],
  markings: [
    { id: 'cockpit-glass', band: 'top', sectors: [0, 1], stations: [2, 4], motif: 'cockpit' },
    { id: 'forward-door', band: 'starboard-upper', sector: 0, stations: [6, 6], motif: 'door' },
    { id: 'aft-door', band: 'starboard-upper', sector: 0, stations: [25, 25], motif: 'door' },
    { id: 'blue-cheatline', band: 'starboard-lower', sectors: [0, 1], stations: [5, 27], motif: 'livery' },
    { id: 'tail-mark', band: 'port-upper', sectors: [0, 1], stations: [28, 32], motif: 'tail-mark' },
  ],
  voids: [
    { id: 'wing-root-keepout', band: 'starboard-lower', sectors: [0, 1], stations: [13, 20] },
    { id: 'opposite-wing-root-keepout', band: 'port-lower', sectors: [0, 1], stations: [13, 20] },
  ],
  appendages: {
    wings: 'swept-wing-card',
    tailplane: 'tailplane-card',
    fin: 'vertical-fin-card',
  },
  motifs: {
    skin: 'warm-white-skin',
    'nose-skin': 'rounded-nose-skin',
    'tail-skin': 'tapered-tail-skin',
    window: 'passenger-window',
    cockpit: 'cockpit-glass',
    door: 'plug-door',
    livery: 'blue-cheatline',
    'tail-mark': 'tail-logo-panel',
  },
};

const VIEW = { width: 1120, height: 680 };
const ROOM_BASIS = {
  worldExtent: { width: 34, depth: 22, height: 18 },
  xRange: [0, 34],
  yRange: [0, 22],
  frontY: 22,
  backY: 0,
  verticalUnit: 18,
};
const CAMERA = {
  kind: 'two-point',
  viewBox: VIEW,
  worldFraming: {
    cameraPosition: [38, 30, 10],
    lookAt: [16, 10, 3],
    horizontalFov: 78,
    pictureCenter: [560, 372],
  },
};
const APPROACH_CAMERA = {
  kind: 'two-point',
  viewBox: VIEW,
  worldFraming: {
    cameraPosition: [15.4, 33, 9.5],
    lookAt: [15.3, 10.6, 3.2],
    horizontalFov: 74,
    pictureCenter: [560, 372],
  },
};
const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / ((1 + Math.sqrt(5)) / 2));

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[ch]));
}

function fmt(n) {
  return Number(n).toFixed(2);
}

function rect(x, y, w, h, attrs = '') {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs}/>`;
}

function text(x, y, copy, attrs = '') {
  return `<text x="${fmt(x)}" y="${fmt(y)}" ${attrs}>${esc(copy)}</text>`;
}

function polygon(points, attrs = '') {
  return `<polygon points="${points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' ')}" ${attrs}/>`;
}

function line(x1, y1, x2, y2, attrs = '') {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" ${attrs}/>`;
}

function projectWorld(point, camera = CAMERA) {
  return projectTwoPoint(point, camera, ROOM_BASIS);
}

function worldPoint({ origin, axis, along, across, z }) {
  if (axis === 'y') return [origin[0] + across, origin[1] + along, z];
  return [origin[0] + along, origin[1] + across, z];
}

function framePoint(frame, along, across, z) {
  const resolvedAlong = frame.alongDirection < 0 ? frame.length - along : along;
  return worldPoint({ origin: frame.origin, axis: frame.axis, along: resolvedAlong, across, z });
}

function screenPoint(point, camera = CAMERA) {
  const [x, y] = projectWorld(point, camera);
  return [x, y];
}

function worldPolygon(points, attrs = '', camera = CAMERA) {
  return polygon(points.map((point) => screenPoint(point, camera)), attrs);
}

function worldLine(from, to, attrs = '', camera = CAMERA) {
  const [x1, y1] = screenPoint(from, camera);
  const [x2, y2] = screenPoint(to, camera);
  return line(x1, y1, x2, y2, attrs);
}

function polyline(points, attrs = '') {
  return `<polyline points="${points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' ')}" ${attrs}/>`;
}

function svg(title, width, height, marks) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${esc(title)}</title>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f6f4ed"/>
  ${marks.join('\n  ')}
</svg>`;
}

function renderUnwrapPlate(input) {
  const net = resolveAircraftFuselageWrapNet(input);
  const stationCount = net.stations;
  const sheet = { width: 1040, height: 760 };
  const bodyLength = 760;
  const radiusScale = 42;
  const halfCircumference = (t) => Math.PI * walkRadius(net, t) * radiusScale;
  const stationX = (x0, station) => x0 + (station / Math.max(1, stationCount - 1)) * bodyLength;
  const stickerShell = ({ id, label, x, y, fill, stroke, side }) => {
    const centerY = y + 72;
    const top = [];
    const bottom = [];
    for (let station = 0; station < stationCount; station += 1) {
      const t = station / Math.max(1, stationCount - 1);
      const xPos = stationX(x, station);
      const halfH = halfCircumference(t) * 0.5;
      top.push([xPos, centerY - halfH]);
      bottom.unshift([xPos, centerY + halfH]);
    }
    const marks = [
      text(x, y - 18, label, 'font-size="13" fill="#243040" font-weight="700"'),
      polygon([...top, ...bottom], `fill="${fill}" stroke="${stroke}" stroke-width="1.6" opacity="0.92" data-sticker="${id}"`),
      line(x, centerY, x + bodyLength, centerY, `stroke="${stroke}" stroke-width="1" opacity="0.32" stroke-dasharray="4 5"`),
    ];
    for (let station = 0; station < stationCount; station += 2) {
      const t = station / Math.max(1, stationCount - 1);
      const xPos = stationX(x, station);
      const halfH = halfCircumference(t) * 0.5;
      marks.push(line(xPos, centerY - halfH, xPos, centerY + halfH, `stroke="${stroke}" stroke-width="0.55" opacity="0.22"`));
    }
    for (const v of [-0.5, 0, 0.5]) {
      const lane = [];
      for (let station = 0; station < stationCount; station += 1) {
        const t = station / Math.max(1, stationCount - 1);
        lane.push([stationX(x, station), centerY + halfCircumference(t) * 0.5 * v]);
      }
      marks.push(polyline(lane, `fill="none" stroke="${stroke}" stroke-width="0.75" opacity="0.22"`));
    }
    const windowY = centerY - 18;
    for (let station = 6; station <= 25; station += 2) {
      const xPos = stationX(x, station);
      marks.push(rect(xPos - 4, windowY - 4, 8, 8, 'fill="#24576b" opacity="0.62" rx="2"'));
    }
    const cheatY = centerY + (side === 'starboard' ? 12 : -12);
    marks.push(rect(stationX(x, 5), cheatY - 2, stationX(x, 27) - stationX(x, 5), 4, `fill="${stroke}" opacity="0.44" rx="2"`));
    if (side === 'starboard') {
      marks.push(rect(stationX(x, 6) - 6, centerY - 4, 12, 30, 'fill="none" stroke="#475569" stroke-width="1" opacity="0.7" rx="2"'));
      marks.push(rect(stationX(x, 25) - 6, centerY - 4, 12, 30, 'fill="none" stroke="#475569" stroke-width="1" opacity="0.7" rx="2"'));
    }
    const finRootX = stationX(x, 28);
    marks.push(polygon([
      [finRootX, centerY - halfCircumference(28 / (stationCount - 1)) * 0.48],
      [stationX(x, 32), centerY - halfCircumference(32 / (stationCount - 1)) * 0.45],
      [stationX(x, 30), centerY - halfCircumference(30 / (stationCount - 1)) * 0.45 - 82],
    ], `fill="#b9a56c" stroke="#6f5430" stroke-width="1.2" opacity="0.82" data-sticker="${id}:vertical-fin-side"`));
    return marks;
  };
  const card = ({ id, label, points, fill, stroke }) => [
    polygon(points, `fill="${fill}" stroke="${stroke}" stroke-width="1.6" opacity="0.9" data-sticker="${id}"`),
    text(Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])) - 8, label, 'font-size="12" fill="#475569" font-weight="700"'),
    polyline([...points, points[0]], `fill="none" stroke="${stroke}" stroke-width="0.7" opacity="0.36" stroke-dasharray="5 5"`),
  ];
  const marks = [
    text(34, 40, 'Aircraft fuselage sticker sheet - half-shell unwrap', 'font-size="24" fill="#243040" font-weight="700"'),
    text(34, 62, 'two fuselage stickers each cover exactly half the circumference; wing and elevator stickers are separate top-down cards', 'font-size="13" fill="#64748b"'),
    ...stickerShell({
      id: 'starboard-fuselage-half-shell',
      label: 'starboard fuselage half + fin side',
      x: 120,
      y: 116,
      fill: '#dff0f4',
      stroke: '#2f6f9f',
      side: 'starboard',
    }),
    ...stickerShell({
      id: 'port-fuselage-half-shell',
      label: 'port fuselage half + fin side',
      x: 120,
      y: 330,
      fill: '#f4e7be',
      stroke: '#9a6a2f',
      side: 'port',
    }),
    ...card({
      id: 'starboard-wing-top',
      label: 'starboard wing top',
      points: [[160, 630], [430, 548], [444, 630]],
      fill: '#dff0f4',
      stroke: '#2f6f9f',
    }),
    ...card({
      id: 'port-wing-top',
      label: 'port wing top',
      points: [[160, 668], [430, 748], [444, 668]],
      fill: '#f4e7be',
      stroke: '#9a6a2f',
    }),
    ...card({
      id: 'starboard-elevator-top',
      label: 'starboard elevator top',
      points: [[560, 632], [688, 594], [696, 632]],
      fill: '#dff0f4',
      stroke: '#2f6f9f',
    }),
    ...card({
      id: 'port-elevator-top',
      label: 'port elevator top',
      points: [[560, 670], [688, 708], [696, 670]],
      fill: '#f4e7be',
      stroke: '#9a6a2f',
    }),
  ];
  return svg('Aircraft fuselage half-shell sticker sheet', sheet.width, sheet.height, marks);
}

function bodyEnvelope3D(net, frame) {
  const top = [];
  const bottom = [];
  for (let i = 0; i < net.stations; i += 1) {
    const t = i / Math.max(1, net.stations - 1);
    const along = frame.length * t;
    const r = walkRadius(net, t);
    top.push(screenPoint(framePoint(frame, along, frame.centerAcross, frame.centerZ + r * frame.radiusZ), frame.camera));
    bottom.unshift(screenPoint(framePoint(frame, along, frame.centerAcross, frame.centerZ - r * frame.radiusZ), frame.camera));
  }
  return [...top, ...bottom];
}

function walkRadius(net, t) {
  const profile = net.profile;
  if (t <= profile[0].t) return profile[0].radius;
  for (let i = 1; i < profile.length; i += 1) {
    const a = profile[i - 1];
    const b = profile[i];
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1e-9, b.t - a.t);
      return a.radius + (b.radius - a.radius) * u;
    }
  }
  return profile[profile.length - 1].radius;
}

function fuselageRingPoints(net, frame, stationIndex, samples = 36) {
  const t = stationIndex / Math.max(1, net.stations - 1);
  const along = frame.length * t;
  const radius = walkRadius(net, t);
  const phase = stationIndex * GOLDEN_ANGLE;
  const points = [];
  for (let i = 0; i <= samples; i += 1) {
    const theta = (Math.PI * 2 * i) / samples + phase;
    const harmonic = 1
      + Math.cos(theta + phase * 0.5) * 0.018
      + Math.cos(theta * 2 - phase) * 0.010;
    const across = frame.centerAcross + Math.cos(theta) * radius * frame.radiusAcross * harmonic;
    const z = frame.centerZ + Math.sin(theta) * radius * frame.radiusZ * harmonic;
    points.push(screenPoint(framePoint(frame, along, across, z), frame.camera));
  }
  return points;
}

function fuselageGoldenRingMarks(net, frame) {
  const marks = [];
  for (let station = 0; station < net.stations; station += 1) {
    const t = station / Math.max(1, net.stations - 1);
    const radius = walkRadius(net, t);
    if (radius < 0.055) continue;
    const points = fuselageRingPoints(net, frame, station, 40);
    const opacity = 0.20 + Math.min(0.42, radius * 0.34);
    const width = station % 5 === 0 ? 1.45 : 0.9;
    const stroke = station % 5 === 0 ? '#9a6a2f' : '#c09a55';
    marks.push(polyline(points, `fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" opacity="${opacity.toFixed(2)}"`));
  }
  return marks;
}

function fuselageLongitudinalWaveMarks(net, frame) {
  const marks = [];
  const lanes = [
    { theta: -0.52, stroke: '#2f6f9f', width: 4.8, opacity: 0.76 },
    { theta: 0.36, stroke: '#b98c3c', width: 1.2, opacity: 0.46 },
    { theta: Math.PI - 0.28, stroke: '#d6b36a', width: 0.9, opacity: 0.30 },
  ];
  for (const lane of lanes) {
    const points = [];
    for (let station = 0; station < net.stations; station += 1) {
      const t = station / Math.max(1, net.stations - 1);
      const along = frame.length * t;
      const radius = walkRadius(net, t);
      const phase = station * GOLDEN_ANGLE;
      const theta = lane.theta + Math.sin(phase) * 0.035;
      const across = frame.centerAcross + Math.cos(theta) * radius * frame.radiusAcross;
      const z = frame.centerZ + Math.sin(theta) * radius * frame.radiusZ;
      points.push(screenPoint(framePoint(frame, along, across, z), frame.camera));
    }
    marks.push(polyline(points, `fill="none" stroke="${lane.stroke}" stroke-width="${lane.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${lane.opacity}"`));
  }
  return marks;
}

function fuselageHalfShellStickerMarks(net, frame, { opacity = 0.18, strokeWidth = 0.55 } = {}) {
  const marks = [];
  const shells = [
    {
      id: 'starboard-half-shell',
      theta0: -Math.PI / 2,
      theta1: Math.PI / 2,
      fill: '#7fb8c9',
      stroke: '#2f6f9f',
    },
    {
      id: 'port-half-shell',
      theta0: Math.PI / 2,
      theta1: Math.PI * 1.5,
      fill: '#d7b35f',
      stroke: '#9a6a2f',
    },
  ];
  const stationStep = 2;
  const thetaStep = 4;
  for (const shell of shells) {
    for (let station = 0; station < net.stations - stationStep; station += stationStep) {
      const t0 = station / Math.max(1, net.stations - 1);
      const t1 = Math.min(1, (station + stationStep) / Math.max(1, net.stations - 1));
      const along0 = frame.length * t0;
      const along1 = frame.length * t1;
      const r0 = walkRadius(net, t0);
      const r1 = walkRadius(net, t1);
      if (r0 < 0.12 && r1 < 0.12) continue;
      for (let thetaIndex = 0; thetaIndex < thetaStep; thetaIndex += 1) {
        const u0 = thetaIndex / thetaStep;
        const u1 = (thetaIndex + 1) / thetaStep;
        const theta0 = shell.theta0 + (shell.theta1 - shell.theta0) * u0;
        const theta1 = shell.theta0 + (shell.theta1 - shell.theta0) * u1;
        const point = (along, radius, theta) => framePoint(
          frame,
          along,
          frame.centerAcross + Math.cos(theta) * radius * frame.radiusAcross,
          frame.centerZ + Math.sin(theta) * radius * frame.radiusZ,
        );
        marks.push(worldPolygon([
          point(along0, r0, theta0),
          point(along1, r1, theta0),
          point(along1, r1, theta1),
          point(along0, r0, theta1),
        ], `fill="${shell.fill}" stroke="${shell.stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" data-sticker="${shell.id}"`, frame.camera));
      }
    }
  }
  return marks;
}

function interpolatePoint(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function triangleSineMarks(points, {
  count = 9,
  samples = 32,
  amplitude = 0.10,
  cycles = 1.5,
  phase = 0,
  stroke = '#6f8fa1',
  strokeWidth = 1,
  opacity = 0.56,
  camera = CAMERA,
} = {}) {
  const [rootLead, tip, rootTrail] = points;
  const marks = [
    worldPolygon(points, 'fill="#dbe3ea" stroke="#8b99a8" stroke-width="1.6" opacity="0.76"', camera),
  ];
  for (let i = 1; i <= count; i += 1) {
    const v = i / (count + 1);
    const lead = interpolatePoint(rootLead, tip, v);
    const trail = interpolatePoint(rootTrail, tip, v);
    const lane = [];
    for (let s = 0; s <= samples; s += 1) {
      const u = s / samples;
      const base = interpolatePoint(lead, trail, u);
      const alongBias = Math.sin((u * cycles + v * 0.35) * Math.PI * 2 + phase) * amplitude * (1 - v * 0.55);
      lane.push(screenPoint([base[0] + alongBias, base[1], base[2] + alongBias * 0.12], camera));
    }
    marks.push(polyline(lane, `fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"`));
  }
  return marks;
}

function insetTriangle(points, amount = 0.18) {
  const center = [
    (points[0][0] + points[1][0] + points[2][0]) / 3,
    (points[0][1] + points[1][1] + points[2][1]) / 3,
    (points[0][2] + points[1][2] + points[2][2]) / 3,
  ];
  return points.map((point) => interpolatePoint(point, center, amount));
}

function appendageStickerMarks({ wing, elevator, camera, opacityScale = 1 }) {
  return [
    worldPolygon(insetTriangle(wing.far), `fill="#7fb8c9" stroke="#2f6f9f" stroke-width="1.25" opacity="${Math.min(0.9, 0.42 * opacityScale)}" data-sticker="starboard-wing-top"`, camera),
    worldPolygon(insetTriangle(wing.near), `fill="#d7b35f" stroke="#9a6a2f" stroke-width="1.25" opacity="${Math.min(0.9, 0.46 * opacityScale)}" data-sticker="port-wing-top"`, camera),
    worldPolygon(insetTriangle(elevator.far, 0.16), `fill="#7fb8c9" stroke="#2f6f9f" stroke-width="1" opacity="${Math.min(0.9, 0.36 * opacityScale)}" data-sticker="starboard-stabilizer-top"`, camera),
    worldPolygon(insetTriangle(elevator.near, 0.16), `fill="#d7b35f" stroke="#9a6a2f" stroke-width="1" opacity="${Math.min(0.9, 0.40 * opacityScale)}" data-sticker="port-stabilizer-top"`, camera),
    worldPolygon(insetTriangle(elevator.vertical, 0.12), `fill="#b9a56c" stroke="#6f5430" stroke-width="1" opacity="${Math.min(0.9, 0.38 * opacityScale)}" data-sticker="vertical-fin-side"`, camera),
  ];
}

function aircraftWingTriangles(frame, variant) {
  const wp = (along, across, z) => framePoint(frame, along, across, z);
  const ringRoot = (along, side, zOffset = 0) => wp(
    along,
    frame.centerAcross + side * frame.radiusAcross * 0.92,
    frame.centerZ + zOffset,
  );
  const wingAlong = frame.length * frame.wingFraction;
  const defs = {
    swept: {
      label: 'swept wing',
      rootChord: 2.6,
      tipInset: 0,
      span: 3.4,
      wave: { cycles: 1.45, amplitude: 0.10 },
    },
    delta: {
      label: 'delta wing',
      rootChord: 4.6,
      tipInset: 0,
      span: 3.8,
      wave: { cycles: 1.05, amplitude: 0.13 },
    },
    glider: {
      label: 'high-aspect wing',
      rootChord: 2.1,
      tipInset: 0,
      span: 6.0,
      wave: { cycles: 2.1, amplitude: 0.07 },
    },
  };
  const def = defs[variant] || defs.swept;
  const nosePoint = variant === 'delta' ? 1.75 : variant === 'glider' ? 0.8 : 1.15;
  const bowAlong = frame.view === 'departing'
    ? wingAlong + nosePoint
    : wingAlong - frame.alongDirection * nosePoint;
  const rootLift = variant === 'delta' ? 0.42 : 0.34;
  return {
    label: def.label,
    near: [
      ringRoot(wingAlong, -1, rootLift),
      wp(bowAlong, -def.span * 0.58, frame.centerZ + 0.02),
      ringRoot(wingAlong, -1, -rootLift),
    ],
    far: [
      ringRoot(wingAlong + 0.08, 1, rootLift * 0.82),
      wp(bowAlong, frame.width + def.span * 0.58, frame.centerZ - 0.02),
      ringRoot(wingAlong + 0.08, 1, -rootLift * 0.82),
    ],
    wave: def.wave,
  };
}

function aircraftElevatorTriangles(frame, variant) {
  const wp = (along, across, z) => framePoint(frame, along, across, z);
  const root = (along, zOffset = 0) => wp(along, frame.centerAcross, frame.centerZ + zOffset);
  const ringRoot = (along, side, zOffset = 0) => wp(
    along,
    frame.centerAcross + side * frame.radiusAcross * 0.72,
    frame.centerZ + zOffset,
  );
  const spanScale = variant === 'glider' ? 1.25 : variant === 'delta' ? 0.85 : 1;
  const tailAlong = frame.length * frame.tailFraction;
  const tailSpan = frame.width * frame.tailplaneWidthScale * spanScale;
  const nearAcross = frame.centerAcross - tailSpan * 0.5;
  const farAcross = frame.centerAcross + tailSpan * 0.5;
  const nosePoint = variant === 'delta' ? 0.48 : 0.58;
  const bowAlong = frame.view === 'departing'
    ? tailAlong + nosePoint
    : tailAlong - frame.alongDirection * nosePoint;
  return {
    near: [
      ringRoot(tailAlong, -1, 0.16),
      wp(bowAlong, nearAcross, frame.centerZ),
      ringRoot(tailAlong, -1, -0.16),
    ],
    far: [
      ringRoot(tailAlong + 0.05, 1, 0.13),
      wp(bowAlong, farAcross, frame.centerZ),
      ringRoot(tailAlong + 0.05, 1, -0.13),
    ],
    vertical: [root(tailAlong - 0.45, 0.25), wp(tailAlong, frame.centerAcross, frame.centerZ + 3.9), root(tailAlong + 0.45, 0.42)],
    wave: { cycles: variant === 'delta' ? 0.9 : 1.35, amplitude: 0.055 },
  };
}

function renderProjectedAircraft(input, { wingVariant = 'swept', fileIndex = 2, view = 'side', wrapped = false } = {}) {
  const net = resolveAircraftFuselageWrapNet(input);
  const frame = view === 'approach' || view === 'departing'
    ? {
      origin: [10.8, 4.2],
      view,
      axis: 'y',
      alongDirection: view === 'approach' ? -1 : 1,
      length: 16.2,
      width: 8.4,
      centerAcross: 4.2,
      centerZ: 3.9,
      radiusAcross: 0.78,
      radiusZ: 1.28,
      wingFraction: 0.48,
      tailFraction: 0.88,
      tailplaneWidthScale: 0.34,
      camera: APPROACH_CAMERA,
    }
    : {
      origin: [6.2, 7.7],
      view,
      axis: 'x',
      alongDirection: 1,
      length: 18,
      width: 8.4,
      centerAcross: 4.2,
      centerZ: 3.9,
      radiusAcross: 0.78,
      radiusZ: 1.28,
      wingFraction: 0.48,
      tailFraction: 0.88,
      tailplaneWidthScale: 0.34,
      camera: CAMERA,
    };
  const projectManji = (point) => projectWorld(point, frame.camera);
  const manji = buildAircraftSpineManji({
    project: projectManji,
    origin: frame.origin,
    axis: frame.axis,
    length: frame.length,
    width: frame.width,
    spineZ: frame.centerZ,
    alongDirection: frame.alongDirection,
    wingFraction: frame.wingFraction,
    tailFraction: frame.tailFraction,
    tailplaneWidthScale: frame.tailplaneWidthScale,
    role: 'passenger-jet-manji',
  });
  const wp = (along, across, z) => framePoint(frame, along, across, z);
  const wing = aircraftWingTriangles(frame, wingVariant);
  const elevator = aircraftElevatorTriangles(frame, wingVariant);
  const viewLabel = view === 'approach'
    ? 'approach'
    : view === 'departing'
      ? 'departing'
      : 'side-pass';
  const viewDescription = view === 'approach'
    ? 'nose faces the camera'
    : view === 'departing'
      ? 'tail faces the camera'
      : 'side-pass projection';
  const stickerOpacity = wrapped ? 0.42 : 0.18;
  const stickerStrokeWidth = wrapped ? 0.9 : 0.55;
  const appendageOpacityScale = wrapped ? 1.55 : 1;
  const constructionOpacity = wrapped ? 0.18 : 0.34;
  const lineworkOpacity = wrapped ? 0.58 : 0.88;
  const marks = [
    text(42, 46, `Aircraft fuselage wrap-net - ${wing.label} ${viewLabel}${wrapped ? ' wrapped' : ''}`, 'font-size="24" fill="#243040" font-weight="700"'),
    text(42, 70, `mandala-frame wing triangles use sine traces; ${viewDescription}; fuselage is a golden ring stack`, 'font-size="13" fill="#64748b"'),
    worldPolygon([
      [3.8, 4.6, 0],
      [29.6, 4.6, 0],
      [31.2, 17.4, 0],
      [2.4, 17.4, 0],
    ], 'fill="#dce3ea" stroke="#9fb0c0" stroke-width="1" opacity="0.72"', frame.camera),
    ...fuselageHalfShellStickerMarks(net, frame, { opacity: stickerOpacity, strokeWidth: stickerStrokeWidth }),
    ...appendageStickerMarks({ wing, elevator, camera: frame.camera, opacityScale: appendageOpacityScale }),
    ...triangleSineMarks(wing.far, { ...wing.wave, phase: GOLDEN_ANGLE * 0.5, stroke: '#7890a0', opacity: 0.42, camera: frame.camera }),
    ...triangleSineMarks(wing.near, { ...wing.wave, phase: GOLDEN_ANGLE, stroke: '#55748a', strokeWidth: 1.1, opacity: 0.62, camera: frame.camera }),
    ...manji.shapes.map((shape) => line(shape.from.x, shape.from.y, shape.to.x, shape.to.y, `stroke="${shape.stroke}" stroke-width="${shape.strokeWidth + 2}" stroke-linecap="round" opacity="0.22"`)),
    polygon(bodyEnvelope3D(net, frame), `fill="#f7f3e8" stroke="#6f5430" stroke-width="1.2" opacity="${constructionOpacity}"`),
    ...fuselageGoldenRingMarks(net, frame),
    ...fuselageLongitudinalWaveMarks(net, frame),
    ...manji.shapes.map((shape) => line(shape.from.x, shape.from.y, shape.to.x, shape.to.y, `stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" opacity="${lineworkOpacity}"`)),
    ...triangleSineMarks(elevator.far, { ...elevator.wave, count: 5, phase: GOLDEN_ANGLE * 0.2, stroke: '#71879a', strokeWidth: 0.9, opacity: 0.42, camera: frame.camera }),
    ...triangleSineMarks(elevator.near, { ...elevator.wave, count: 5, phase: GOLDEN_ANGLE * 0.7, stroke: '#536b80', strokeWidth: 1, opacity: 0.56, camera: frame.camera }),
    ...triangleSineMarks(elevator.vertical, { cycles: 1.1, amplitude: 0.035, count: 6, phase: GOLDEN_ANGLE, stroke: '#667b8d', strokeWidth: 0.95, opacity: 0.52, camera: frame.camera }),
  ];

  marks.push(text(42, 646, `variant ${fileIndex}: ${wingVariant}/${view}${wrapped ? '/wrapped' : ''}; appendages aligned in plane mandala frame`, 'font-size="12" fill="#64748b"'));
  marks.push(text(42, 624, 'stickers: port/starboard radial half-shells; wings and stabilizers use top-down cards', 'font-size="12" fill="#64748b"'));
  return svg('Aircraft fuselage wrap-net projected aircraft', VIEW.width, VIEW.height, marks);
}

describe('aircraft fuselage wrap-net spike SVG output', () => {
  it('writes aircraft wrap-net review SVGs', async () => {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const files = [
      ['1-passenger-fuselage-unwrap.svg', renderUnwrapPlate(PASSENGER_JET)],
      ['2-passenger-aircraft-projected.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'swept', fileIndex: 2 })],
      ['2-passenger-aircraft-swept-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'swept', fileIndex: 2 })],
      ['3-passenger-aircraft-delta-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'delta', fileIndex: 3 })],
      ['4-passenger-aircraft-glider-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'glider', fileIndex: 4 })],
      ['5-passenger-aircraft-swept-approach-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'swept', view: 'approach', fileIndex: 5 })],
      ['6-passenger-aircraft-delta-approach-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'delta', view: 'approach', fileIndex: 6 })],
      ['7-passenger-aircraft-swept-departing-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'swept', view: 'departing', fileIndex: 7 })],
      ['8-passenger-aircraft-delta-departing-wave.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'delta', view: 'departing', fileIndex: 8 })],
      ['9-passenger-aircraft-swept-approach-wrapped.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'swept', view: 'approach', wrapped: true, fileIndex: 9 })],
      ['10-passenger-aircraft-swept-departing-wrapped.svg', renderProjectedAircraft(PASSENGER_JET, { wingVariant: 'swept', view: 'departing', wrapped: true, fileIndex: 10 })],
    ];
    for (const [file, body] of files) {
      await fs.writeFile(path.join(OUTPUT_DIR, file), body, 'utf8');
    }
    const summary = [
      '# Aircraft Fuselage Wrap-Net Spike Outputs',
      '',
      ...files.map(([file]) => `- ${file}`),
      '',
      'These studies use station x angular-band addressing for a tapered cylindrical aircraft body.',
      'The projected variants use port/starboard fuselage half-shell stickers, plus separate top-down wing and stabilizer stickers.',
    ].join('\n');
    await fs.writeFile(path.join(OUTPUT_DIR, 'summary.md'), summary, 'utf8');
    expect(files).toHaveLength(11);
  });
});
