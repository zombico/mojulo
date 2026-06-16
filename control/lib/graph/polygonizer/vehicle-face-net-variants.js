/**
 * Vehicle face-net variants.
 *
 * Takes the authored T-map principles (face-local cards, shared registration
 * bands, mirrorable side slots) and rolls seeded outcomes into inline cards.
 * Same `(netId, seed, variant)` returns the same net; different seeds produce
 * different readable vehicle sheets while keeping card contracts intact.
 */

import { VEHICLE_FACE_NETS } from './vehicle-face-net.js';
import { getVehicleFaceCard, SEDAN_CABIN, SUV_CABIN, cabinGreenhouse } from './vehicle-face-cards.js';

export const VEHICLE_FACE_NET_VARIANTS_VERSION = 'vehicle-face-net-variants-v0.1.0';

const TRUCK_PALETTES = [
  { cab: '#2b6cb0', cabStroke: '#1a4971', body: '#e2e8f0', bodySide: '#d0d9e4', roof: '#eef3f8', accent: '#94a3b8' },
  { cab: '#b5331f', cabStroke: '#7c241a', body: '#d7dee5', bodySide: '#c5d0dc', roof: '#e7edf3', accent: '#f4d03f' },
  { cab: '#357050', cabStroke: '#255038', body: '#d9e1df', bodySide: '#c8d6d2', roof: '#edf3f1', accent: '#8bb7a0' },
  { cab: '#e08a2c', cabStroke: '#9c5a12', body: '#d8dde4', bodySide: '#c5ccd6', roof: '#edf0f4', accent: '#9aa3ad' },
];

const BUS_PALETTES = [
  { body: '#e6b66f', stroke: '#6f5430', window: '#9bd0df', livery: '#bd7f3f', roof: '#f4d8a9' },
  { body: '#c2ccd6', stroke: '#5b6776', window: '#7fb0c4', livery: '#d24d3e', roof: '#d3dbe2' },
  { body: '#3f7d5a', stroke: '#255038', window: '#bcd8e6', livery: '#f2b705', roof: '#2f6147' },
];

const TRAIN_PALETTES = [
  { body: '#c2ccd6', stroke: '#5b6776', window: '#7fb0c4', livery: '#d24d3e', roof: '#d3dbe2' },
  { body: '#e2e8f0', stroke: '#475569', window: '#9bd0df', livery: '#2f6fb0', roof: '#d7dee5' },
  { body: '#8b97a4', stroke: '#475569', window: '#bcd8e6', livery: '#f2b705', roof: '#aeb9c4' },
];

const STREETCAR_PALETTES = [
  { body: '#f1d38a', stroke: '#7a5a22', window: '#9bd0df', livery: '#a94438', roof: '#d9b56a', bumper: '#6b7280' },
  { body: '#d9e2ea', stroke: '#53616f', window: '#93c7d8', livery: '#2f6fb0', roof: '#c5d0dc', bumper: '#53616f' },
  { body: '#b5331f', stroke: '#7c241a', window: '#bcd8e6', livery: '#f4d03f', roof: '#9c2e1d', bumper: '#64748b' },
  { body: '#357050', stroke: '#255038', window: '#bcd8e6', livery: '#f2b705', roof: '#2f6147', bumper: '#475569' },
];

const CAR_PALETTES = [
  { body: '#3b6ea5', stroke: '#24486b', roof: '#33608f', glass: '#bcd8e6', fascia: '#1c2a38', trim: '#9aa3ad' },
  { body: '#8d3f3f', stroke: '#5e2727', roof: '#773333', glass: '#b7d5df', fascia: '#2b1d1d', trim: '#8b97a4' },
  { body: '#3f7d5a', stroke: '#255038', roof: '#356b4e', glass: '#bcd8e6', fascia: '#1f3f2f', trim: '#94a3b8' },
  { body: '#d8dde4', stroke: '#53616f', roof: '#c5ccd6', glass: '#93c7d8', fascia: '#293241', trim: '#64748b' },
];

const NOSED_COMMERCIAL_STYLES = {
  ambulance: {
    label: 'Ambulance',
    conceptId: 'vehicle.emergency.ambulance',
    proportions: { length: 8.8, width: 2.55, height: 3.25 },
    palette: { body: '#f4f7f8', stroke: '#475569', cab: '#f8fbfc', roof: '#e7eef2', glass: '#9bd0df', accent: '#c0392b', trim: '#64748b', fascia: '#293241' },
    boxStart: 0.06,
    boxEnd: 0.66,
    cabStart: 0.70,
    cowl: 0.94,
    roofTop: 0.86,
    noseZ: 0.50,
    rearKind: 'doors',
    sideRole: 'medical-box',
    sign: 'cross',
    wheels: [0.18, 0.78],
  },
  movingVan: {
    label: 'Moving van',
    conceptId: 'vehicle.freight.moving-van',
    proportions: { length: 9.4, width: 2.65, height: 3.35 },
    palette: { body: '#f8fafc', stroke: '#475569', cab: '#d9e2ea', roof: '#e7edf3', glass: '#9bd0df', accent: '#2f6fb0', trim: '#94a3b8', fascia: '#293241' },
    boxStart: 0.05,
    boxEnd: 0.68,
    cabStart: 0.72,
    cowl: 0.94,
    roofTop: 0.84,
    noseZ: 0.50,
    overCab: true,
    rearKind: 'rollup',
    sideRole: 'moving-box',
    sign: 'stripe',
    wheels: [0.18, 0.74],
  },
  deliveryTruck: {
    label: 'Delivery truck',
    conceptId: 'vehicle.freight.delivery-truck',
    proportions: { length: 8.7, width: 2.48, height: 3.15 },
    palette: { body: '#d8dde4', stroke: '#53616f', cab: '#c8d3df', roof: '#e7edf3', glass: '#93c7d8', accent: '#f2b705', trim: '#64748b', fascia: '#293241' },
    boxStart: 0.07,
    boxEnd: 0.66,
    cabStart: 0.70,
    cowl: 0.94,
    roofTop: 0.82,
    noseZ: 0.50,
    rearKind: 'rollup',
    sideRole: 'delivery-box',
    sign: 'parcel',
    wheels: [0.20, 0.78],
  },
  tractorNosed: {
    label: 'Nosed tractor trailer',
    conceptId: 'vehicle.truck.conventional-tractor-trailer',
    proportions: { length: 15.6, width: 2.7, height: 3.6 },
    palette: { body: '#e2e8f0', stroke: '#475569', cab: '#2b6cb0', roof: '#d7dee5', glass: '#9bd0df', accent: '#94a3b8', trim: '#64748b', fascia: '#1a4971' },
    boxStart: 0.06,
    boxEnd: 0.62,
    cabStart: 0.70,
    cowl: 0.88,
    roofTop: 0.78,
    noseZ: 0.46,
    rearKind: 'trailer-doors',
    sideRole: 'trailer-box',
    sign: 'ribs',
    wheels: [0.12, 0.42, 0.54, 0.86],
    couplingGap: true,
  },
  schoolbus: {
    label: 'Nosed school bus',
    conceptId: 'vehicle.bus.schoolbus-conventional',
    proportions: { length: 11.5, width: 2.55, height: 3.2 },
    palette: { body: '#e6b66f', stroke: '#6f5430', cab: '#e6b66f', roof: '#f4d8a9', glass: '#9bd0df', accent: '#293241', trim: '#6f5430', fascia: '#475569' },
    boxStart: 0.06,
    boxEnd: 0.72,
    cabStart: 0.76,
    cowl: 0.89,
    roofTop: 0.82,
    noseZ: 0.48,
    rearKind: 'bus-back',
    sideRole: 'schoolbus-body',
    sign: 'schoolbus-windows',
    wheels: [0.18, 0.80],
  },
};

function hashSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed || 'vehicle-face-net')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(netId, seed, variant) {
  return mulberry32(hashSeed(`${netId}:${seed}:${variant}`));
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseCard(id) {
  const card = getVehicleFaceCard(id);
  if (!card) throw new Error(`vehicle-face-net-variants: missing base card "${id}"`);
  return deepClone(card);
}

function variantCard(id, suffix) {
  const card = baseCard(id);
  card.id = `${id}--${suffix}`;
  card.variantOf = id;
  return card;
}

function recolorSilhouette(card, fill, stroke) {
  card.silhouette = { ...(card.silhouette || {}), fill, stroke };
}

function replaceParts(card, mapper) {
  card.parts = card.parts.flatMap((part) => mapper({ ...part }));
}

function resolveBaseNet(netOrId) {
  const net = typeof netOrId === 'string' ? VEHICLE_FACE_NETS[netOrId] : netOrId;
  if (!net) throw new Error(`vehicle-face-net-variants: unknown net "${netOrId}"`);
  return net;
}

function makeBusVariant(net, rng, suffix) {
  const palette = pick(rng, BUS_PALETTES);
  const roof = pick(rng, ['flat', 'rounded', 'arch']);
  const windowCount = intBetween(rng, 4, 8);
  const doorMode = pick(rng, ['front', 'middle', 'front-and-middle']);
  const livery = pick(rng, ['none', 'single-stripe', 'low-stripe']);

  const side = variantCard(net.faces.side, suffix);
  const front = variantCard(net.faces.front, suffix);
  const back = variantCard(net.faces.back, suffix);
  const top = variantCard(net.faces.top, suffix);
  for (const card of [side, front, back]) recolorSilhouette(card, palette.body, palette.stroke);
  recolorSilhouette(top, palette.roof, palette.stroke);
  side.silhouette.roof = roof;
  front.silhouette.roof = roof === 'arch' ? 'rounded' : roof;

  replaceParts(side, (part) => {
    if (part.role === 'window-repeat') return [{ ...part, count: windowCount, u0: 0.10, u1: doorMode === 'front' ? 0.66 : 0.88, fill: palette.window, stroke: '#315969' }];
    if (part.role === 'livery-band') {
      if (livery === 'none') return [];
      return [{ ...part, v: livery === 'low-stripe' ? 0.24 : 0.34, h: 0.08, fill: palette.livery }];
    }
    if (part.role === 'door' || part.role === 'door-split') return [];
    return [part];
  });
  const doorSpecs = [];
  if (doorMode === 'front' || doorMode === 'front-and-middle') doorSpecs.push({ role: 'door-front', u: 0.72 });
  if (doorMode === 'middle' || doorMode === 'front-and-middle') doorSpecs.push({ role: 'door-mid', u: 0.44 });
  for (const spec of doorSpecs) {
    side.parts.push({ kind: 'rect', role: spec.role, u: spec.u, w: 0.082, vFrom: 'floor', vTo: 'windowTop', fill: '#d8eef4', stroke: '#315969', strokeWidth: 0.8 });
    side.parts.push({ kind: 'line', role: `${spec.role}-split`, u0: spec.u + 0.041, v0: 'floor', u1: spec.u + 0.041, v1: 'windowTop', stroke: '#315969', strokeWidth: 0.6 });
  }
  replaceParts(front, (part) => {
    if (part.role === 'front-windshield') return [{ ...part, fill: palette.window }];
    if (part.role === 'front-bumper') return [{ ...part, fill: '#64748b' }];
    return [part];
  });

  return {
    ...deepClone(net),
    label: `${net.label} variant`,
    variant: { seed: suffix, roof, windowCount, doorMode, livery, palette },
    faces: { front: { card: front }, back: { card: back }, top: { card: top }, side: { card: side } },
  };
}

function makeTrainVariant(net, rng, suffix, { trainClass = null } = {}) {
  const segmentClass = trainClass || pick(rng, ['passenger', 'subway', 'cargo', 'tram']);
  const streetcarLike = segmentClass === 'tram' || segmentClass === 'streetcar';
  const palette = streetcarLike ? pick(rng, STREETCAR_PALETTES) : pick(rng, TRAIN_PALETTES);
  const windowCount = segmentClass === 'cargo' ? intBetween(rng, 2, 4) : streetcarLike ? intBetween(rng, 5, 8) : intBetween(rng, 6, 10);
  const doorCount = segmentClass === 'cargo' ? 1 : streetcarLike ? intBetween(rng, 3, 5) : intBetween(rng, 2, 4);
  const roofGear = streetcarLike ? pick(rng, ['pantograph', 'trolley-pole', 'dual-hvac']) : 'pantograph';
  const lowFloor = streetcarLike ? pick(rng, [true, true, false]) : false;

  const side = variantCard(net.faces.side, suffix);
  const front = variantCard(net.faces.front, suffix);
  const back = variantCard(net.faces.back, suffix);
  const top = variantCard(net.faces.top, suffix);
  for (const card of [side, front, back]) recolorSilhouette(card, palette.body, palette.stroke);
  recolorSilhouette(top, palette.roof, palette.stroke);
  if (streetcarLike) {
    side.silhouette.roof = 'rounded';
    front.silhouette.roof = 'rounded';
    side.bands = { floor: lowFloor ? 0.02 : 0.04, beltline: 0.48, windowTop: 0.76 };
  }

  replaceParts(side, (part) => {
    if (part.role === 'window-repeat') {
      return [{
        ...part,
        count: windowCount,
        u0: streetcarLike ? 0.08 : part.u0,
        u1: streetcarLike ? 0.92 : part.u1,
        fill: palette.window,
      }];
    }
    if (part.role === 'livery-band') {
      return [{ ...part, fill: palette.livery, v: streetcarLike ? 0.28 : part.v, h: segmentClass === 'cargo' ? 0.10 : streetcarLike ? 0.075 : 0.06 }];
    }
    if (part.role.startsWith('door')) return [];
    if (streetcarLike && part.role === 'bogie') {
      return [{ ...part, fractions: [0.18, 0.34, 0.66, 0.82], r: 0.07 }];
    }
    return [part];
  });
  for (let i = 0; i < doorCount; i += 1) {
    const u = streetcarLike
      ? 0.10 + i * (0.78 / Math.max(1, doorCount - 1))
      : 0.14 + (i + 0.5) * (0.72 / doorCount);
    side.parts.push({
      kind: 'rect',
      role: streetcarLike ? `low-floor-door-${i + 1}` : `door-${i + 1}`,
      u,
      w: streetcarLike ? 0.065 : 0.055,
      vFrom: 'floor',
      vTo: 'windowTop',
      fill: streetcarLike ? '#d8eef4' : '#aeb9c4',
      stroke: palette.stroke,
      strokeWidth: 0.8,
    });
    if (streetcarLike) {
      side.parts.push({ kind: 'line', role: `low-floor-door-split-${i + 1}`, u0: u + 0.0325, v0: 'floor', u1: u + 0.0325, v1: 'windowTop', stroke: palette.stroke, strokeWidth: 0.55 });
    }
  }
  if (segmentClass === 'cargo') {
    side.parts.push({ kind: 'repeat', role: 'cargo-panel', u0: 0.10, u1: 0.90, count: 5, v: 0.18, h: 0.50, w: 0.01, fill: palette.stroke, opacity: 0.45 });
  }
  if (streetcarLike) {
    side.parts.push({ kind: 'rect', role: 'destination-sign-side', u: 0.80, w: 0.12, v: 0.80, h: 0.07, fill: '#293241' });
    side.parts.push({ kind: 'band', role: 'low-floor-skirt', v: 0.03, h: 0.075, fill: palette.bumper, opacity: 0.92 });
  }

  replaceParts(front, (part) => {
    if (!streetcarLike) return [part];
    if (part.role === 'number-board') return [{ ...part, role: 'destination-sign-front', u: 0.24, w: 0.52, v: 0.83, h: 0.08 }];
    if (part.role === 'front-windshield') return [{ ...part, u: 0.10, w: 0.80, v: 0.45, h: 0.35, fill: palette.window, stroke: palette.stroke }];
    if (part.role === 'headlight-l') return [{ ...part, u: 0.24, v: 0.26, r: 0.045, stroke: palette.stroke }];
    if (part.role === 'headlight-r') return [{ ...part, u: 0.76, v: 0.26, r: 0.045, stroke: palette.stroke }];
    if (part.role === 'coupler') return [{ ...part, u: 0.38, w: 0.24, v: 0.04, h: 0.07, fill: palette.bumper }];
    if (part.role === 'skirt') return [{ ...part, v: 0.02, h: 0.06, fill: palette.bumper }];
    return [part];
  });

  replaceParts(top, (part) => {
    if (!streetcarLike) return [part];
    if (part.role === 'pantograph-base') {
      if (roofGear === 'dual-hvac') return [
        { kind: 'rect', role: 'hvac-front', u: 0.28, w: 0.44, v: 0.58, h: 0.10, fill: '#cbd5e1', stroke: '#94a3b8', strokeWidth: 0.7 },
        { kind: 'rect', role: 'hvac-rear', u: 0.28, w: 0.44, v: 0.28, h: 0.10, fill: '#cbd5e1', stroke: '#94a3b8', strokeWidth: 0.7 },
      ];
      return [{ ...part, role: roofGear === 'trolley-pole' ? 'trolley-pole-base' : 'pantograph-base', u: 0.36, w: 0.28, v: 0.42, h: 0.12, fill: '#aeb9c4', stroke: palette.stroke }];
    }
    if (part.role === 'pantograph-arm-a' || part.role === 'pantograph-arm-b') {
      if (roofGear === 'dual-hvac') return [];
      if (roofGear === 'trolley-pole') {
        return part.role === 'pantograph-arm-a'
          ? [{ kind: 'line', role: 'trolley-pole', u0: 0.50, v0: 0.47, u1: 0.72, v1: 0.88, stroke: palette.stroke, strokeWidth: 1.2 }]
          : [];
      }
      return [{ ...part, stroke: palette.stroke }];
    }
    if (part.role === 'roof-vent') return [{ ...part, count: 2, u0: 0.32, u1: 0.68, v: 0.18, h: 0.06 }];
    return [part];
  });

  return {
    ...deepClone(net),
    label: streetcarLike ? `${segmentClass === 'streetcar' ? 'Streetcar' : 'Tram'} T-map variant` : `${net.label} variant`,
    proportions: streetcarLike
      ? { length: 9.5 + rng() * 2.2, width: 2.35 + rng() * 0.25, height: 3.0 + rng() * 0.25 }
      : net.proportions,
    variant: { seed: suffix, segmentClass, windowCount, doorCount, roofGear, lowFloor, palette },
    faces: { front: { card: front }, back: { card: back }, top: { card: top }, side: { card: side } },
  };
}

function makeTruckVariant(net, rng, suffix) {
  const palette = pick(rng, TRUCK_PALETTES);
  const trailerProfile = pick(rng, ['box-trailer', 'reefer-trailer', 'flatbed-trailer']);
  const cabType = pick(rng, ['day-cab', 'sleeper-cab']);
  const cargoDensity = pick(rng, ['light', 'standard', 'dense']);
  const axleCount = pick(rng, [3, 4, 5]);
  const cabWidth = cabType === 'day-cab' ? 0.18 + rng() * 0.03 : 0.23 + rng() * 0.035;
  const cabU = 1 - cabWidth;
  const windowBottom = 0.46 + rng() * 0.05;
  const windowTop = windowBottom + 0.22 + rng() * 0.04;
  const cabRoof = Math.min(0.84, windowTop + 0.08);
  const bands = { floor: 0, windowBottom, windowTop, cabRoof };
  const ribCount = cargoDensity === 'light' ? 4 : cargoDensity === 'dense' ? 8 : 6;
  const wheelFractions = axleCount === 3 ? [0.12, 0.52, 0.88] : axleCount === 5 ? [0.10, 0.38, 0.50, 0.62, 0.88] : [0.10, 0.42, 0.56, 0.88];

  const side = variantCard(net.faces.side, suffix);
  const front = variantCard(net.faces.front, suffix);
  const back = variantCard(net.faces.back, suffix);
  const top = variantCard(net.faces.top, suffix);
  for (const card of [side, front, back, top]) card.bands = { ...bands };
  recolorSilhouette(side, trailerProfile === 'flatbed-trailer' ? palette.bodySide : palette.body, '#475569');
  recolorSilhouette(front, palette.cab, palette.cabStroke);
  recolorSilhouette(back, palette.body, '#475569');
  recolorSilhouette(top, palette.roof, '#475569');

  replaceParts(side, (part) => {
    if (part.role === 'cab-volume') return [{ ...part, u: cabU, w: cabWidth, fill: palette.cab, stroke: palette.cabStroke }];
    if (part.role === 'cab-window') return [{ ...part, u: cabU + cabWidth * 0.18, w: cabWidth * (cabType === 'day-cab' ? 0.55 : 0.68), fill: '#9bd0df', stroke: palette.cabStroke }];
    if (part.role === 'coupling-gap') return [{ ...part, u0: cabU - 0.018, u1: cabU - 0.018 }];
    if (part.role === 'cargo-rib') {
      if (trailerProfile === 'flatbed-trailer') return [{ kind: 'band', role: 'flatbed-deck-rail', v: 0.16, h: 0.08, fill: palette.accent, stroke: '#475569', strokeWidth: 0.6 }];
      return [{ ...part, count: ribCount, u0: 0.08, u1: cabU - 0.10, fill: palette.accent }];
    }
    if (part.role === 'wheel') return [{ ...part, fractions: wheelFractions }];
    return [part];
  });
  if (trailerProfile === 'reefer-trailer') {
    side.parts.push({ kind: 'rect', role: 'reefer-unit-side', u: cabU - 0.10, w: 0.07, v: 0.58, h: 0.13, fill: '#cbd5e1', stroke: '#64748b', strokeWidth: 0.6 });
    top.parts.push({ kind: 'rect', role: 'reefer-unit-top', u: 0.22, w: 0.56, v: cabU - 0.18, h: 0.08, fill: '#cbd5e1', stroke: '#64748b', strokeWidth: 0.6 });
  }
  replaceParts(front, (part) => {
    if (part.role === 'front-windshield') return [{ ...part, fill: '#9bd0df', stroke: palette.cabStroke }];
    if (part.role === 'grille') return [{ ...part, fill: palette.cabStroke }];
    if (part.role === 'front-bumper') return [{ ...part, fill: palette.accent }];
    return [part];
  });
  replaceParts(top, (part) => {
    if (part.role === 'cab-roof') return [{ ...part, fill: palette.cab, stroke: palette.cabStroke, v: cabU, h: cabWidth * 0.82 }];
    if (part.role === 'coupling-gap') return [{ ...part, v0: cabU - 0.018, v1: cabU - 0.018 }];
    if (part.role === 'roof-rib') {
      if (trailerProfile === 'flatbed-trailer') return [];
      return [{ ...part, count: Math.max(4, ribCount + 1), fill: palette.accent, v: 0.08, h: Math.max(0.20, cabU - 0.18) }];
    }
    return [part];
  });

  return {
    ...deepClone(net),
    label: `${net.label} variant`,
    proportions: {
      length: net.proportions.length * (0.96 + rng() * 0.10),
      width: net.proportions.width,
      height: net.proportions.height * (0.96 + rng() * 0.08),
    },
    variant: { seed: suffix, trailerProfile, cabType, cargoDensity, axleCount, cabWidth: Number(cabWidth.toFixed(3)), bands },
    faces: { front: { card: front }, back: { card: back }, top: { card: top }, side: { card: side } },
  };
}

function makeNosedCommercialVariant(net, rng, suffix, { commercialClass = null } = {}) {
  const classId = commercialClass || pick(rng, Object.keys(NOSED_COMMERCIAL_STYLES));
  const style = NOSED_COMMERCIAL_STYLES[classId] || NOSED_COMMERCIAL_STYLES.deliveryTruck;
  const p = style.palette;
  const boxEnd = style.boxEnd;
  const cabStart = style.cabStart;
  const cowl = style.cowl;
  const hoodTop = style.noseZ;
  const beltline = 0.54;
  const windshieldBase = 0.64;
  const sideWindowTop = style.overCab ? 0.70 : style.roofTop - 0.035;
  const frontWindowTop = style.overCab ? 0.78 : 0.84;
  const side = variantCard(net.faces.side, suffix);
  const front = variantCard(net.faces.front, suffix);
  const back = variantCard(net.faces.back, suffix);
  const top = variantCard(net.faces.top, suffix);
  const hood = variantCard('sedan-hood', suffix);

  side.label = `${style.label} side`;
  side.silhouette = {
    fill: p.body,
    stroke: p.stroke,
    profile: [
      { u: style.boxStart, v: 0.16 },
      { u: style.boxStart, v: style.roofTop },
      { u: boxEnd, v: style.roofTop },
      { u: cabStart, v: style.roofTop },
      { u: cowl, v: style.roofTop },
      { u: cowl, v: windshieldBase },
      { u: cowl + (1 - cowl) * 0.58, v: 0.60 },
      { u: 1.0, v: hoodTop },
      { u: 1.0, v: 0.16 },
    ],
  };
  const sideParts = [
    {
      kind: 'rect',
      role: style.sideRole,
      u: style.boxStart,
      w: Math.max(0.01, boxEnd - style.boxStart),
      v: 0.18,
      h: style.roofTop - 0.20,
      fill: p.body,
      stroke: p.stroke,
      strokeWidth: 0.9,
    },
    { kind: 'poly', role: 'nosed-cab', points: [{ u: cabStart, v: 0.16 }, { u: cabStart, v: style.roofTop }, { u: cowl, v: style.roofTop }, { u: cowl, v: windshieldBase }, { u: 1.0, v: hoodTop }, { u: 1.0, v: 0.16 }], fill: p.cab, stroke: p.stroke, strokeWidth: 0.9 },
    ...(style.overCab ? [
      { kind: 'rect', role: 'over-cab-cargo', u: boxEnd - 0.01, w: Math.max(0.08, cowl - boxEnd + 0.01), v: 0.72, h: style.roofTop - 0.72, fill: p.body, stroke: p.stroke, strokeWidth: 0.9 },
      { kind: 'line', role: 'over-cab-bottom-seam', u0: boxEnd, v0: 0.72, u1: cowl, v1: 0.72, stroke: p.stroke, strokeWidth: 0.7 },
    ] : []),
    { kind: 'rect', role: 'cab-window', u: cabStart + 0.025, w: Math.max(0.06, cowl - cabStart - 0.05), v: beltline, h: sideWindowTop - beltline, fill: p.glass, stroke: p.stroke, strokeWidth: 0.7 },
    { kind: 'line', role: 'cab-windshield-post', u0: cowl, v0: beltline, u1: cowl, v1: style.roofTop, stroke: p.stroke, strokeWidth: 0.9 },
    { kind: 'line', role: 'cab-hood-seam', u0: cowl, v0: 0.18, u1: cowl, v1: windshieldBase, stroke: p.stroke, strokeWidth: 0.8 },
    { kind: 'line', role: 'cab-door-cut', u0: cabStart + 0.02, v0: 0.18, u1: cabStart + 0.02, v1: style.roofTop - 0.02, stroke: p.stroke, strokeWidth: 0.7 },
    { kind: 'rect', role: 'cab-door-handle', u: cabStart + 0.07, w: 0.035, v: 0.43, h: 0.018, fill: p.fascia },
    { kind: 'wheels', role: 'wheel', fractions: style.wheels, v: 0.13, r: 0.105, fill: '#1f2937', stroke: '#111827', strokeWidth: 1, hub: 0.4, hubFill: '#cbd5e1' },
  ];
  if (style.sign === 'cross') {
    sideParts.push({ kind: 'rect', role: 'medical-cross-h', u: style.boxStart + 0.20, w: 0.14, v: 0.46, h: 0.035, fill: p.accent });
    sideParts.push({ kind: 'rect', role: 'medical-cross-v', u: style.boxStart + 0.255, w: 0.035, v: 0.405, h: 0.14, fill: p.accent });
    sideParts.push({ kind: 'band', role: 'emergency-stripe', v: 0.32, h: 0.05, fill: p.accent, opacity: 0.86 });
  } else if (style.sign === 'stripe') {
    sideParts.push({ kind: 'band', role: 'moving-van-stripe', v: 0.35, h: 0.08, fill: p.accent, opacity: 0.84 });
  } else if (style.sign === 'parcel') {
    sideParts.push({ kind: 'rect', role: 'parcel-mark', u: style.boxStart + 0.20, w: 0.20, v: 0.40, h: 0.16, fill: p.accent, stroke: p.stroke, strokeWidth: 0.5 });
    sideParts.push({ kind: 'line', role: 'parcel-diagonal', u0: style.boxStart + 0.20, v0: 0.40, u1: style.boxStart + 0.40, v1: 0.56, stroke: p.stroke, strokeWidth: 0.7 });
  } else if (style.sign === 'ribs') {
    sideParts.push({ kind: 'repeat', role: 'trailer-rib', u0: style.boxStart + 0.08, u1: boxEnd - 0.08, count: 5, v: 0.24, h: 0.56, w: 0.008, fill: p.accent });
  } else if (style.sign === 'schoolbus-windows') {
    sideParts.push({ kind: 'repeat', role: 'schoolbus-window', u0: style.boxStart + 0.08, u1: boxEnd - 0.06, count: 6, v: 0.52, h: 0.18, gap: 0.015, fill: p.glass, stroke: p.stroke, strokeWidth: 0.6 });
    sideParts.push({ kind: 'rect', role: 'schoolbus-door', u: boxEnd - 0.055, w: 0.05, v: 0.18, h: 0.52, fill: '#d8eef4', stroke: p.stroke, strokeWidth: 0.7 });
    sideParts.push({ kind: 'rect', role: 'schoolbus-stop-sign', u: boxEnd - 0.16, w: 0.055, v: 0.40, h: 0.055, fill: '#c0392b', stroke: '#7c241a', strokeWidth: 0.5 });
  }
  if (style.couplingGap) {
    sideParts.push({ kind: 'line', role: 'coupling-gap', u0: boxEnd + 0.02, v0: 0.16, u1: boxEnd + 0.02, v1: 0.58, stroke: p.stroke, strokeWidth: 1, dash: '4 3' });
  }
  side.parts = sideParts;

  front.label = `${style.label} front`;
  front.silhouette = {
    fill: p.cab,
    stroke: p.stroke,
    profile: [{ u: 0.06, v: 0.60 }, { u: 0.94, v: 0.60 }, { u: 0.94, v: 0.88 }, { u: 0.06, v: 0.88 }],
  };
  front.bands = { floor: 0, windowBottom: 0.62, windowTop: 0.84 };
  front.parts = [
    ...(style.overCab ? [
      { kind: 'rect', role: 'over-cab-cargo-front', u: 0.06, w: 0.88, v: 0.82, h: 0.08, fill: p.body, stroke: p.stroke, strokeWidth: 0.8 },
    ] : []),
    { kind: 'poly', role: 'windshield-glass', points: [{ u: 0.12, v: 0.62 }, { u: 0.88, v: 0.62 }, { u: 0.88, v: frontWindowTop }, { u: 0.12, v: frontWindowTop }], fill: p.glass, stroke: p.stroke, strokeWidth: 0.8 },
    { kind: 'line', role: 'wiper-l', u0: 0.38, v0: 0.635, u1: 0.47, v1: 0.70, stroke: p.stroke, strokeWidth: 0.7 },
    { kind: 'line', role: 'wiper-r', u0: 0.53, v0: 0.635, u1: 0.62, v1: 0.70, stroke: p.stroke, strokeWidth: 0.7 },
    { kind: 'rect', role: 'fascia-panel', plane: 'fascia', u: 0.06, w: 0.88, v: 0.18, h: 0.26, fill: p.cab, stroke: p.stroke, strokeWidth: 0.8 },
    { kind: 'rect', role: 'grille', plane: 'fascia', u: 0.26, w: 0.48, v: 0.26, h: 0.12, fill: p.fascia, stroke: p.stroke, strokeWidth: 0.6 },
    { kind: 'circle', role: 'headlight-l', plane: 'fascia', u: 0.17, v: 0.34, r: 0.045, fill: '#f8d36b', stroke: p.stroke, strokeWidth: 0.6 },
    { kind: 'circle', role: 'headlight-r', plane: 'fascia', u: 0.83, v: 0.34, r: 0.045, fill: '#f8d36b', stroke: p.stroke, strokeWidth: 0.6 },
    { kind: 'band', role: 'front-bumper', plane: 'fascia', v: 0.07, h: 0.07, fill: p.trim },
  ];
  if (classId === 'ambulance') {
    front.parts.push({ kind: 'rect', role: 'lightbar-red', u: 0.20, w: 0.30, v: 0.82, h: 0.06, fill: '#c0392b' });
    front.parts.push({ kind: 'rect', role: 'lightbar-blue', u: 0.50, w: 0.30, v: 0.82, h: 0.06, fill: '#2f6fb0' });
  } else if (classId === 'schoolbus') {
    front.parts.push({ kind: 'rect', role: 'schoolbus-sign-front', u: 0.26, w: 0.48, v: 0.82, h: 0.07, fill: '#293241' });
  }

  back.label = `${style.label} back`;
  back.silhouette = { roof: 'flat', fill: p.body, stroke: p.stroke };
  back.parts = [
    { kind: 'rect', role: 'rear-panel', u: 0.08, w: 0.84, v: 0.12, h: 0.76, fill: p.body, stroke: p.stroke, strokeWidth: 0.8 },
    { kind: 'band', role: 'rear-bumper', v: 0.05, h: 0.07, fill: p.trim },
  ];
  if (style.rearKind === 'rollup') {
    back.parts.push({ kind: 'repeat', role: 'rollup-slat', u0: 0.12, u1: 0.88, count: 7, v: 0.22, h: 0.018, fill: p.stroke, opacity: 0.45 });
  } else if (style.rearKind === 'doors' || style.rearKind === 'trailer-doors') {
    back.parts.push({ kind: 'line', role: 'rear-door-split', u0: 0.50, v0: 0.12, u1: 0.50, v1: 0.88, stroke: p.stroke, strokeWidth: 0.9 });
    back.parts.push({ kind: 'rect', role: 'tail-light-l', u: 0.10, w: 0.07, v: 0.14, h: 0.08, fill: '#c0392b' });
    back.parts.push({ kind: 'rect', role: 'tail-light-r', u: 0.83, w: 0.07, v: 0.14, h: 0.08, fill: '#c0392b' });
  } else if (style.rearKind === 'bus-back') {
    back.parts.push({ kind: 'rect', role: 'rear-window', u: 0.18, w: 0.64, v: 0.56, h: 0.22, fill: p.glass, stroke: p.stroke, strokeWidth: 0.7 });
    back.parts.push({ kind: 'rect', role: 'tail-light-l', u: 0.10, w: 0.08, v: 0.22, h: 0.12, fill: '#c0392b' });
    back.parts.push({ kind: 'rect', role: 'tail-light-r', u: 0.82, w: 0.08, v: 0.22, h: 0.12, fill: '#c0392b' });
  }

  top.label = `${style.label} top`;
  top.silhouette = { roof: 'flat', fill: p.roof, stroke: p.stroke };
  top.parts = [
    { kind: 'rect', role: 'box-roof', u: 0.10, w: 0.80, v: style.boxStart, h: Math.max(0.08, boxEnd - style.boxStart), fill: p.roof, stroke: p.stroke, strokeWidth: 0.7 },
    ...(style.overCab ? [
      { kind: 'rect', role: 'over-cab-roof', u: 0.10, w: 0.80, v: boxEnd - 0.01, h: Math.max(0.08, cowl - boxEnd + 0.01), fill: p.roof, stroke: p.stroke, strokeWidth: 0.7 },
    ] : []),
    { kind: 'rect', role: 'cab-roof', u: 0.18, w: 0.64, v: cabStart, h: Math.max(0.06, cowl - cabStart), fill: p.cab, stroke: p.stroke, strokeWidth: 0.7 },
    { kind: 'line', role: 'centerline', u0: 0.5, v0: 0.05, u1: 0.5, v1: 0.92, stroke: p.stroke, strokeWidth: 0.7, dash: '6 5' },
  ];
  if (classId === 'ambulance') {
    top.parts.push({ kind: 'rect', role: 'roof-lightbar', u: 0.24, w: 0.52, v: cabStart + 0.02, h: 0.055, fill: p.accent });
  }

  hood.label = `${style.label} hood`;
  hood.silhouette = {
    fill: p.cab,
    stroke: p.stroke,
    profile: [{ u: 0.12, v: 0.0 }, { u: 0.88, v: 0.0 }, { u: 0.84, v: 1.0 }, { u: 0.16, v: 1.0 }],
  };
  hood.parts = [
    { kind: 'line', role: 'hood-crease', u0: 0.5, v0: 0.08, u1: 0.5, v1: 0.92, stroke: p.stroke, strokeWidth: 0.7 },
    { kind: 'line', role: 'hood-front-edge', u0: 0.18, v0: 0.90, u1: 0.82, v1: 0.90, stroke: p.stroke, strokeWidth: 0.7 },
  ];

  return {
    ...deepClone(net),
    conceptId: style.conceptId,
    label: `${style.label} T-map variant`,
    proportions: style.proportions,
    form: {
      faceAlong: cowl,
      topZ: style.roofTop,
      roofAlong: [style.boxStart, cowl],
      hood: { back: cowl, front: 1.0, cowlZ: windshieldBase, noseZ: hoodTop },
      windshield: { baseV: 0.60, topV: 0.88, baseAlong: cowl, topAlong: cowl },
      hoodLengthFrac: 1 - cowl,
    },
    variant: { seed: suffix, commercialClass: classId, palette: p },
    faces: { front: { card: front }, back: { card: back }, top: { card: top }, side: { card: side }, hood: { card: hood } },
  };
}

const CAR_CABIN = { sedan: SEDAN_CABIN, suv: SUV_CABIN };
const roundHundredth = (n) => Math.round(n * 100) / 100;

function recolorStroke(part, palette) {
  const out = { ...part };
  if (out.stroke && out.stroke !== 'none') out.stroke = palette.stroke;
  return out;
}

// PRINCIPLE-PRESERVING variation: jitter the roof shape (corners 1 & 2), keep
// the cowl / rear-beltline fixed. Everything registered to the cabin follows.
function perturbCabin(cabin, rng) {
  const lenJ = (rng() * 2 - 1) * 0.03; // roof grows / shrinks
  const htJ = (rng() * 2 - 1) * 0.025; // roof higher / lower
  return [
    { ...cabin[0] },
    { u: cabin[1].u - lenJ, v: cabin[1].v + htJ },
    { u: cabin[2].u + lenJ, v: cabin[2].v + htJ },
    { ...cabin[3] },
  ];
}

// Replace the cabin corners in a side profile with the perturbed ones — the
// roofline re-registers to the new roof shape.
function reseatCabin(profile, baseCabin, newCabin) {
  return profile.map((p) => {
    const i = baseCabin.findIndex((c) => Math.abs(c.u - p.u) < 1e-9 && Math.abs(c.v - p.v) < 1e-9);
    return i >= 0 ? { ...newCabin[i] } : p;
  });
}

// Generate a sedan or SUV variant from its first-class type, applying every car
// principle: the greenhouse, side roofline, and windshield rake are re-derived
// from one (perturbed) roof shape so they stay registered.
function makeCarVariant(net, rng, suffix, { carClass = null } = {}) {
  const cls = CAR_CABIN[carClass] ? carClass : pick(rng, ['sedan', 'suv']);
  const typeNet = VEHICLE_FACE_NETS[cls];
  const baseCabin = CAR_CABIN[cls];
  const cabin = perturbCabin(baseCabin, rng);
  const palette = pick(rng, CAR_PALETTES);

  const side = variantCard(typeNet.faces.side, suffix);
  const front = variantCard(typeNet.faces.front, suffix);
  const back = variantCard(typeNet.faces.back, suffix);
  const top = variantCard(typeNet.faces.top, suffix);
  const hood = variantCard(typeNet.faces.hood, suffix);
  const deck = variantCard(typeNet.form.deckCard, suffix);
  for (const card of [side, front, back, hood, deck]) recolorSilhouette(card, palette.body, palette.stroke);
  recolorSilhouette(top, palette.roof, palette.stroke);

  // re-register the roof shape -> roofline + single greenhouse mass + B-pillar
  side.silhouette.profile = reseatCabin(side.silhouette.profile, baseCabin, cabin);
  const gh = cabinGreenhouse(cabin, 0.10 + rng() * 0.04);
  const wheelScale = 0.92 + rng() * 0.16;
  replaceParts(side, (part) => {
    if (part.role === 'greenhouse') return [{ ...part, points: gh.points, fill: palette.glass, stroke: palette.stroke }];
    if (part.role === 'b-pillar') return [{ ...part, u0: gh.bPillarBottom.u, v0: gh.bPillarBottom.v, u1: gh.bPillarTop.u, v1: gh.bPillarTop.v, stroke: palette.stroke }];
    if (part.role === 'wheel') return [{ ...part, r: roundHundredth(part.r * wheelScale) }];
    return [recolorStroke(part, palette)];
  });
  replaceParts(front, (part) => {
    if (part.role === 'windshield-glass') return [{ ...part, fill: palette.glass, stroke: palette.stroke }];
    if (part.role === 'grille') return [{ ...part, fill: palette.fascia, stroke: palette.stroke }];
    if (part.role === 'fascia-panel') return [{ ...part, fill: palette.body, stroke: palette.stroke }];
    if (part.role === 'bumper' || part.role === 'skid-plate') return [{ ...part, fill: palette.trim }];
    return [recolorStroke(part, palette)];
  });
  replaceParts(back, (part) => {
    if (part.role === 'rear-glass') return [{ ...part, fill: palette.glass, stroke: palette.stroke }];
    if (part.role === 'fascia-panel') return [{ ...part, fill: palette.body, stroke: palette.stroke }];
    if (part.role === 'bumper') return [{ ...part, fill: palette.trim }];
    return [recolorStroke(part, palette)];
  });
  replaceParts(top, (part) => (part.role === 'sunroof' ? [{ ...part, fill: palette.fascia, stroke: palette.stroke }] : [recolorStroke(part, palette)]));
  replaceParts(hood, (part) => [recolorStroke(part, palette)]);
  replaceParts(deck, (part) => [recolorStroke(part, palette)]);

  // form re-derived from the (perturbed) roof shape so windshield/roof register
  const baseForm = typeNet.form;
  const form = {
    ...deepClone(baseForm),
    faceAlong: cabin[3].u,
    roofAlong: [cabin[1].u, cabin[2].u],
    topZ: Math.max(cabin[1].v, cabin[2].v),
    hood: { ...baseForm.hood, back: cabin[3].u, cowlZ: cabin[3].v },
    windshield: { baseV: cabin[3].v, topV: cabin[2].v, baseAlong: cabin[3].u, topAlong: cabin[2].u },
    deckCard: deck,
  };

  const baseProp = typeNet.proportions;
  const proportions = {
    length: roundHundredth(baseProp.length * (0.94 + rng() * 0.12)),
    width: baseProp.width,
    height: roundHundredth(baseProp.height * (0.97 + rng() * 0.06)),
  };

  return {
    ...deepClone(typeNet),
    conceptId: `vehicle.car.${cls}`,
    label: `${cls === 'suv' ? 'SUV' : 'Sedan'} T-map variant`,
    proportions,
    form,
    variant: { seed: suffix, carClass: cls, palette },
    faces: { front: { card: front }, back: { card: back }, top: { card: top }, side: { card: side }, hood: { card: hood } },
  };
}

// Conventional (hood-nosed) truck variant — recolors + varies the first-class
// type, keeping the split hood + grille (hood slope facet, fascia on the nose).
function makeConventionalTruckVariant(net, rng, suffix) {
  const palette = pick(rng, TRUCK_PALETTES);
  const side = variantCard(net.faces.side, suffix);
  const front = variantCard(net.faces.front, suffix);
  const back = variantCard(net.faces.back, suffix);
  const top = variantCard(net.faces.top, suffix);
  const hood = variantCard(net.faces.hood, suffix);
  recolorSilhouette(side, palette.body, palette.stroke);
  recolorSilhouette(back, palette.body, palette.stroke);
  recolorSilhouette(top, palette.roof, palette.stroke);
  recolorSilhouette(front, palette.cab, palette.cabStroke);
  recolorSilhouette(hood, palette.cab, palette.cabStroke);
  const axles = pick(rng, [[0.16, 0.74], [0.16, 0.70, 0.82]]);
  replaceParts(side, (part) => {
    if (part.role === 'cargo-box') return [{ ...part, fill: palette.body, stroke: palette.stroke }];
    if (part.role === 'cab-volume') return [{ ...part, fill: palette.cab, stroke: palette.cabStroke }];
    if (part.role === 'box-rib') return [{ ...part, fill: palette.bodySide, count: intBetween(rng, 4, 7) }];
    if (part.role === 'wheel') return [{ ...part, fractions: axles }];
    return [part];
  });
  replaceParts(front, (part) => {
    if (part.role === 'fascia-panel') return [{ ...part, fill: palette.cab, stroke: palette.cabStroke }];
    if (part.role === 'grille') return [{ ...part, fill: palette.cabStroke }];
    if (part.role === 'bumper') return [{ ...part, fill: palette.accent }];
    return [part];
  });
  replaceParts(back, (part) => (part.role === 'rear-bumper' ? [{ ...part, fill: palette.accent }] : [part]));
  const baseProp = net.proportions;
  return {
    ...deepClone(net),
    conceptId: 'vehicle.truck.conventional',
    label: 'Conventional truck T-map variant',
    proportions: {
      length: roundHundredth(baseProp.length * (0.9 + rng() * 0.25)),
      width: baseProp.width,
      height: roundHundredth(baseProp.height * (0.96 + rng() * 0.08)),
    },
    form: deepClone(net.form),
    variant: { seed: suffix, truckClass: 'conventional', palette },
    faces: { front: { card: front }, back: { card: back }, top: { card: top }, side: { card: side }, hood: { card: hood } },
  };
}

export function makeVehicleFaceNetVariant(netOrId, {
  seed = 'vehicle-face-net',
  variant = 0,
  trainClass = null,
  carClass = null,
  commercialClass = null,
} = {}) {
  const net = resolveBaseNet(netOrId);
  const baseId = Object.entries(VEHICLE_FACE_NETS).find(([, value]) => value === net)?.[0]
    || String(net.conceptId || 'custom-net').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const suffix = `${String(seed).replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'seed'}-${variant}`;
  const rng = rngFor(baseId, seed, variant);

  if (baseId === 'bus') return makeBusVariant(net, rng, suffix);
  if (baseId === 'train') return makeTrainVariant(net, rng, suffix, { trainClass });
  if (commercialClass) return makeNosedCommercialVariant(net, rng, suffix, { commercialClass });
  if (baseId === 'conventional-truck') return makeConventionalTruckVariant(net, rng, suffix);
  if (baseId.includes('truck')) return makeTruckVariant(net, rng, suffix);
  if (baseId === 'sedan' || baseId === 'suv' || baseId.includes('vehicle-car')) {
    return makeCarVariant(net, rng, suffix, { carClass: carClass || (baseId === 'suv' ? 'suv' : baseId === 'sedan' ? 'sedan' : null) });
  }
  return makeBusVariant(net, rng, suffix);
}

export function makeVehicleFaceNetVariants(netOrId, {
  seed = 'vehicle-face-net',
  count = 4,
  variantOffset = 0,
  trainClass = null,
  carClass = null,
  commercialClass = null,
} = {}) {
  return Array.from({ length: count }, (_, index) => (
    makeVehicleFaceNetVariant(netOrId, { seed, variant: variantOffset + index, trainClass, carClass, commercialClass })
  ));
}
