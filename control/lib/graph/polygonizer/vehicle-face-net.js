/**
 * Vehicle face-net ("T-box" glyph) — vehicle-scoped.
 *
 * A face-net codifies a vehicle's identity as five orthographic faces laid out
 * as a cube unfold with the bottom panel removed:
 *
 *              ┌─────┐
 *              │ back│        □  W×H   (square)
 *              ├─────┤
 *              │ top │        ▭  L×W   (length runs up/away)
 *        ┌────┬┴─────┴┬────┐
 *        │left│ FACE  │right│  ▭ □ ▭   sides L×H · face W×H
 *        └────┴───────┴────┘
 *
 * The net owns the vehicle box (L, W, H); face cards (vehicle-face-cards.js) are
 * proportion-agnostic unit drawings. The net stretches a card onto a panel
 * (plate mode) or onto a 3D box face (production mode) — one card, two
 * embeddings. left/right are one canonical `side` card mirrored E-W by default,
 * with a `sideRight` override for asymmetric vehicles.
 *
 * See vehicle-face-net.plan.md for the design rationale.
 */

import {
  getVehicleFaceCard,
  expectedAspectForKind,
  materializeCardParts,
} from './vehicle-face-cards.js';
import { embedSurfaceQuad } from './box-net.js';

export const VEHICLE_FACE_NET_VERSION = 'vehicle-face-net-v0.1.0';

/**
 * Nets that re-express the existing bus / train / truck primitives as T-maps.
 * `proportions` are relative (L, W, H); only ratios matter to the plate.
 */
export const VEHICLE_FACE_NETS = {
  bus: {
    conceptId: 'vehicle.bus.side-slab',
    label: 'City bus T-map',
    proportions: { length: 11, width: 2.5, height: 3.1 },
    faces: { front: 'bus-front', back: 'bus-back', top: 'bus-top', side: 'bus-side' },
  },
  train: {
    conceptId: 'vehicle.rectangular-wheeled.payload',
    label: 'Rail car T-map',
    proportions: { length: 20, width: 2.8, height: 3.4 },
    faces: { front: 'train-front', back: 'train-back', top: 'train-top', side: 'train-side' },
  },
  truck: {
    conceptId: 'vehicle.truck.long-haul',
    label: 'Long-haul truck T-map',
    proportions: { length: 16, width: 2.6, height: 3.7 },
    faces: { front: 'truck-front', back: 'truck-back', top: 'truck-top', side: 'truck-side' },
  },
  firetruck: {
    conceptId: 'vehicle.truck.fire-engine',
    label: 'Fire engine T-map',
    proportions: { length: 11, width: 2.6, height: 3.6 },
    faces: { front: 'firetruck-front', back: 'firetruck-back', top: 'firetruck-top', side: 'firetruck-side' },
  },
  dumptruck: {
    conceptId: 'vehicle.truck.dump',
    label: 'Dump truck T-map',
    proportions: { length: 9, width: 2.7, height: 3.9 },
    faces: { front: 'dumptruck-front', back: 'dumptruck-back', top: 'dumptruck-top', side: 'dumptruck-side' },
  },
  garbagetruck: {
    conceptId: 'vehicle.truck.garbage',
    label: 'Garbage truck T-map',
    proportions: { length: 10, width: 2.6, height: 3.8 },
    faces: { front: 'garbagetruck-front', back: 'garbagetruck-back', top: 'garbagetruck-top', side: 'garbagetruck-side' },
  },
  // Car: not a box. The form is vector-space-only construction geometry; the
  // hood is a tilted facet (cowl -> nose) and the windshield-face sits back at
  // the cowl (faceAlong). hood seam points match SEDAN_SEAM in the cards.
  sedan: {
    conceptId: 'vehicle.car.sedan',
    label: 'Sedan T-map',
    proportions: { length: 9, width: 3.2, height: 2.9 },
    form: {
      faceAlong: 0.70, // windshield plane sits at the cowl
      backAlong: 0.24, // rear-glass plane sits at the rear cowl
      topZ: 0.90, // roof plane seats at the roofline
      roofAlong: [0.40, 0.60], // roof spans the cabin only
      hood: { back: 0.70, front: 1.0, cowlZ: 0.62, noseZ: 0.44 }, // front slope
      deck: { back: 0.24, front: 0.0, cowlZ: 0.60, tailZ: 0.52 }, // rear slope
      deckCard: 'sedan-deck',
      // raked glass so the windshield/backlight meet the roof (no float)
      windshield: { baseV: 0.62, topV: 0.90, baseAlong: 0.70, topAlong: 0.60 },
      backlight: { baseV: 0.60, topV: 0.86, baseAlong: 0.24, topAlong: 0.40 },
      hoodLengthFrac: 0.42,
    },
    faces: { front: 'sedan-front', back: 'sedan-back', top: 'sedan-top', side: 'sedan-side', hood: 'sedan-hood' },
  },
  // SUV: a second first-class car type — same car principles (vector-space form,
  // greenhouse = roof inset bisected, full-width windshield, fascia rule, slopes)
  // with a taller 2-box stance and a near-vertical liftgate.
  suv: {
    conceptId: 'vehicle.car.suv',
    label: 'SUV T-map',
    proportions: { length: 8.5, width: 3.4, height: 3.4 },
    form: {
      faceAlong: 0.80,
      backAlong: 0.06,
      topZ: 0.92,
      roofAlong: [0.12, 0.74],
      hood: { back: 0.80, front: 1.0, cowlZ: 0.66, noseZ: 0.50 },
      deck: { back: 0.06, front: 0.0, cowlZ: 0.66, tailZ: 0.62 },
      deckCard: 'suv-deck',
      windshield: { baseV: 0.66, topV: 0.92, baseAlong: 0.80, topAlong: 0.74 },
      backlight: { baseV: 0.20, topV: 0.90, baseAlong: 0.06, topAlong: 0.12 }, // near-vertical liftgate
      hoodLengthFrac: 0.30,
    },
    faces: { front: 'suv-front', back: 'suv-back', top: 'suv-top', side: 'suv-side', hood: 'suv-hood' },
  },
  // Conventional (hood-nosed) truck — NOT cab-over. Elevates the split hood +
  // grille capability to a truck: hood is a slope facet, grille/lights ride the
  // vertical nose fascia. Flat box rear (no deck slope).
  'conventional-truck': {
    conceptId: 'vehicle.truck.conventional',
    label: 'Conventional truck T-map',
    proportions: { length: 11, width: 2.8, height: 3.6 },
    form: {
      faceAlong: 0.80, // windshield plane at the cowl, behind the nose
      topZ: 0.80,
      roofAlong: [0.04, 0.80], // roof spans the box + cab
      hood: { back: 0.80, front: 1.0, cowlZ: 0.62, noseZ: 0.46 }, // front slope (the nose)
      windshield: { baseV: 0.62, topV: 0.80, baseAlong: 0.80, topAlong: 0.80 }, // near-vertical cab glass
      hoodLengthFrac: 0.20,
    },
    faces: { front: 'convtruck-front', back: 'convtruck-back', top: 'convtruck-top', side: 'convtruck-side', hood: 'convtruck-hood' },
  },
};

export function getVehicleFaceNet(id) {
  return VEHICLE_FACE_NETS[String(id || '').trim()] || null;
}

function resolveCard(ref, kind) {
  const id = typeof ref === 'string' ? ref : ref && ref.card;
  const card = typeof id === 'object' ? id : getVehicleFaceCard(id);
  if (!card) {
    throw new Error(`vehicle-face-net: no face card "${id}" for slot "${kind}"`);
  }
  const expected = expectedAspectForKind(kind);
  if (card.aspect !== expected) {
    throw new Error(
      `vehicle-face-net: slot "${kind}" expects an aspect-"${expected}" card but "${card.id}" is aspect-"${card.aspect}"`,
    );
  }
  const warnings = [];
  if (card.faceKind !== kind) {
    warnings.push(`card "${card.id}" is a "${card.faceKind}" face used in the "${kind}" slot`);
  }
  return { card, warnings };
}

/**
 * Resolve a net descriptor into five concrete slots with mirror/override
 * applied and aspect validated. Throws on aspect mismatch (square vs rectangle).
 */
export function resolveFaceNet(netOrId) {
  const net = typeof netOrId === 'string' ? getVehicleFaceNet(netOrId) : netOrId;
  if (!net) throw new Error(`vehicle-face-net: unknown net "${netOrId}"`);
  const { faces } = net;

  const front = resolveCard(faces.front, 'front');
  const back = resolveCard(faces.back, 'back');
  const top = resolveCard(faces.top, 'top');
  const left = resolveCard(faces.side, 'side');
  // right: mirror of `side` unless `sideRight` overrides it.
  const hasOverride = Boolean(faces.sideRight);
  const right = resolveCard(hasOverride ? faces.sideRight : faces.side, 'side');
  // hood: optional extra facet below the face (cars, not box vehicles).
  const hood = faces.hood ? resolveCard(faces.hood, 'hood') : null;

  const warnings = [...front.warnings, ...back.warnings, ...top.warnings, ...left.warnings, ...right.warnings, ...(hood?.warnings ?? [])];

  return {
    conceptId: net.conceptId,
    label: net.label,
    proportions: net.proportions,
    form: net.form ?? null, // vector-space construction params (cowl, nose, hood slope...)
    slots: {
      face: { slot: 'face', kind: 'front', card: front.card, mirror: false },
      back: { slot: 'back', kind: 'back', card: back.card, mirror: false },
      top: { slot: 'top', kind: 'top', card: top.card, mirror: false },
      left: { slot: 'left', kind: 'side', card: left.card, mirror: false },
      right: { slot: 'right', kind: 'side', card: right.card, mirror: !hasOverride },
      ...(hood ? { hood: { slot: 'hood', kind: 'hood', card: hood.card, mirror: false } } : {}),
    },
    sideMode: hasOverride ? 'override' : 'mirror',
    warnings,
  };
}

/**
 * Screen-space panel rects for the cross. `scale` is px per proportion-unit.
 * originX/originY is the top-left of the plate bounding box.
 */
export function computePlateLayout(net, { scale = 28, gap = 6, originX = 0, originY = 0 } = {}) {
  const { length: L, width: W, height: H } = net.proportions;
  const Lpx = L * scale;
  const Wpx = W * scale;
  const Hpx = H * scale;

  const colX = originX + Lpx + gap; // center column left edge
  const backRect = { x: colX, y: originY, w: Wpx, h: Hpx };
  const topRect = { x: colX, y: backRect.y + Hpx + gap, w: Wpx, h: Lpx };
  const faceRect = { x: colX, y: topRect.y + Lpx + gap, w: Wpx, h: Hpx };
  const leftRect = { x: originX, y: faceRect.y, w: Lpx, h: Hpx };
  const rightRect = { x: faceRect.x + Wpx + gap, y: faceRect.y, w: Lpx, h: Hpx };

  const panels = { face: faceRect, back: backRect, top: topRect, left: leftRect, right: rightRect };
  let totalHeight = Hpx + gap + Lpx + gap + Hpx;
  // hood: a facet below the face (cars). Its length is a fraction of L.
  if (net.slots && net.slots.hood) {
    const hoodH = Lpx * ((net.form && net.form.hoodLengthFrac) || 0.34);
    panels.hood = { x: faceRect.x, y: faceRect.y + faceRect.h + gap, w: Wpx, h: hoodH };
    totalHeight += gap + hoodH;
  }

  return {
    bounds: { width: Lpx + gap + Wpx + gap + Lpx, height: totalHeight },
    panels,
  };
}

// ---- (u, v) -> screen mapping ------------------------------------------

// vFlip is set for the top panel so its front edge (v=1) sits adjacent to the
// FACE panel below it — the unfold reads front-of-roof nearest the front face.
function mapPoint(rect, u, v, vFlip = false) {
  const y = vFlip ? rect.y + v * rect.h : rect.y + (1 - v) * rect.h;
  return { x: rect.x + u * rect.w, y };
}

function mirrorU(u, mirror) {
  return mirror ? 1 - u : u;
}

/** Silhouette outline polygon (screen points) for a panel + roof style. */
function silhouettePolygon(rect, roof) {
  const { x, y, w, h } = rect;
  if (roof === 'rounded') {
    const c = Math.min(w * 0.12, h * 0.18);
    return [
      { x, y: y + h },
      { x, y: y + c },
      { x: x + c, y },
      { x: x + w - c, y },
      { x: x + w, y: y + c },
      { x: x + w, y: y + h },
    ];
  }
  if (roof === 'arch') {
    return [
      { x, y: y + h },
      { x, y: y + h * 0.22 },
      { x: x + w * 0.5, y },
      { x: x + w, y: y + h * 0.22 },
      { x: x + w, y: y + h },
    ];
  }
  // flat
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function partStyle(part) {
  return {
    fill: part.fill ?? 'none',
    stroke: part.stroke ?? 'none',
    strokeWidth: part.strokeWidth ?? 0,
    opacity: part.opacity,
  };
}

/** Emit screen-space shapes for one decorator part inside a panel. */
function partShapes(part, rect, mirror, vFlip, rolePrefix) {
  const role = `${rolePrefix}:${part.role}`;
  const style = partStyle(part);
  // Axis-aligned rect from panel-local (u, v, w, h), honoring mirror + vFlip.
  const uvRect = (u, w, v, h) => {
    const a = mapPoint(rect, u, v, vFlip);
    const b = mapPoint(rect, u, v + h, vFlip);
    return { x: a.x, y: Math.min(a.y, b.y), w: w * rect.w, h: Math.abs(a.y - b.y) };
  };
  switch (part.kind) {
    case 'band':
      return [{ type: 'rect', ...uvRect(0, 1, part.v, part.h), role, ...style }];
    case 'rect': {
      const u0 = mirror ? 1 - part.u - part.w : part.u;
      return [{ type: 'rect', ...uvRect(u0, part.w, part.v, part.h), role, ...style }];
    }
    case 'repeat': {
      const span = part.u1 - part.u0;
      const gap = part.gap ?? 0;
      const w = part.w ?? (span - gap * (part.count - 1)) / part.count;
      const step = part.count > 1 ? (span - w) / (part.count - 1) : 0;
      const out = [];
      for (let i = 0; i < part.count; i += 1) {
        const uStart = part.u0 + i * step;
        const u0 = mirror ? 1 - uStart - w : uStart;
        out.push({ type: 'rect', ...uvRect(u0, w, part.v, part.h), role: `${role}:${i}`, ...style });
      }
      return out;
    }
    case 'poly': {
      const pts = part.points.map((pp) => mapPoint(rect, mirrorU(pp.u, mirror), pp.v, vFlip));
      return [{ type: 'poly', points: pts, role, ...style }];
    }
    case 'circle': {
      const c = mapPoint(rect, mirrorU(part.u, mirror), part.v, vFlip);
      return [{ type: 'circle', cx: c.x, cy: c.y, r: part.r * rect.h, role, ...style }];
    }
    case 'wheels': {
      const out = [];
      for (const [i, frac] of part.fractions.entries()) {
        const c = mapPoint(rect, mirrorU(frac, mirror), part.v, vFlip);
        const r = part.r * rect.h;
        out.push({ type: 'circle', cx: c.x, cy: c.y, r, role: `${role}:${i}`, fill: part.fill, stroke: part.stroke ?? 'none', strokeWidth: part.strokeWidth ?? 0 });
        if (part.hub) {
          out.push({ type: 'circle', cx: c.x, cy: c.y, r: r * part.hub, role: `${role}:${i}:hub`, fill: part.hubFill ?? '#cbd5e1', stroke: 'none', strokeWidth: 0 });
        }
      }
      return out;
    }
    case 'line': {
      const a = mapPoint(rect, mirrorU(part.u0, mirror), part.v0, vFlip);
      const b = mapPoint(rect, mirrorU(part.u1, mirror), part.v1, vFlip);
      return [{ type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, role, stroke: part.stroke ?? '#475569', strokeWidth: part.strokeWidth ?? 1, dash: part.dash }];
    }
    default:
      return [];
  }
}

/** Shapes for a single resolved slot inside its panel. */
function slotShapes(slotEntry, rect) {
  const { card, mirror, slot } = slotEntry;
  const vFlip = slot === 'top' || slot === 'hood';
  const rolePrefix = `${card.id}`;
  // A car face declares an explicit `profile` cutout; a box face uses a roof shape.
  const silPoints = card.silhouette?.profile
    ? card.silhouette.profile.map((pp) => mapPoint(rect, mirrorU(pp.u, mirror), pp.v, vFlip))
    : silhouettePolygon(rect, card.silhouette?.roof ?? 'flat');
  const shapes = [
    {
      type: 'poly',
      points: silPoints,
      fill: card.silhouette?.fill ?? '#e2e8f0',
      stroke: card.silhouette?.stroke ?? '#475569',
      strokeWidth: 1.4,
      role: `${rolePrefix}:silhouette`,
    },
  ];
  for (const part of materializeCardParts(card)) {
    shapes.push(...partShapes(part, rect, mirror, vFlip, rolePrefix));
  }
  return shapes;
}

/**
 * Full plate (model-sheet) for a net: resolves it, lays out the cross, and
 * returns screen-space shapes ready to serialize. Render-agnostic.
 */
export function buildFaceNetPlateShapes(netOrId, opts = {}) {
  const resolved = typeof netOrId === 'object' && netOrId.slots ? netOrId : resolveFaceNet(netOrId);
  const layout = computePlateLayout(resolved, opts);
  const order = ['back', 'top', 'face', 'left', 'right', ...(resolved.slots.hood ? ['hood'] : [])];
  const shapes = [];
  const panels = [];
  for (const slot of order) {
    const rect = layout.panels[slot];
    const entry = resolved.slots[slot];
    panels.push({ slot, kind: entry.kind, cardId: entry.card.id, mirror: entry.mirror, rect });
    shapes.push(...slotShapes(entry, rect));
  }
  return { resolved, bounds: layout.bounds, panels, shapes };
}

/**
 * Production embedding: map a face card's (u, v) onto a real 3D box face so the
 * same card that drew the plate drives the projected scene vehicle. Returns a
 * function (u, v) -> projected screen point. `projectPoint` is the scene camera.
 *
 * face kinds map onto box faces of `box` = { x, y, z, width(=W along x),
 * length(=L along y), height(=H along z) }, with `axis` selecting which world
 * axis the vehicle length runs along ('x' or 'y').
 */
export function embedFaceOntoBox(faceKind, box, axis, projectPoint, { acrossPlane = 0 } = {}) {
  const along = axis === 'y' ? 'y' : 'x'; // world axis for vehicle length
  const across = along === 'x' ? 'y' : 'x';
  const L = along === 'x' ? box.width : box.length;
  const W = across === 'x' ? box.width : box.length;
  const originAlong = along === 'x' ? box.x : box.y;
  const originAcross = across === 'x' ? box.x : box.y;

  // Car form params (a box is the degenerate case: faceAlong=1, backAlong=0,
  // no hood). For a car the windshield-face sits back at the cowl, and the hood
  // is a tilted facet from cowl (back/high) to nose (front/low).
  const faceAlong = box.faceAlong ?? 1;
  const backAlong = box.backAlong ?? 0;
  const hood = box.hood || { back: faceAlong, front: 1, cowlZ: 1, noseZ: 1 };

  const pt = (worldAlong, worldAcross, worldZ) => {
    const p = [0, 0, worldZ];
    p[along === 'x' ? 0 : 1] = worldAlong;
    p[across === 'x' ? 0 : 1] = worldAcross;
    return p;
  };

  const worldAt = (u, v) => {
    const z = box.z + v * box.height;
    switch (faceKind) {
      case 'side': // u = length, v = height; acrossPlane picks near (1) / far (0) face
        return pt(originAlong + u * L, originAcross + acrossPlane * W, z);
      case 'front': // u = width, v = height; cabin-front plane (cowl for a car)
        return pt(originAlong + faceAlong * L, originAcross + u * W, z);
      case 'back': // u = width, v = height; rear plane
        return pt(originAlong + backAlong * L, originAcross + (1 - u) * W, z);
      case 'top': { // u = width, v = length; roof plane. Cars seat it at the
        // roofline (topZ) and span only the cabin (roofAlong), so it doesn't
        // float over the lower hood / trunk.
        const top = box.z + box.height * (box.topZ ?? 1);
        const ra = box.roofAlong || [0, 1];
        return pt(originAlong + L * (ra[0] + v * (ra[1] - ra[0])), originAcross + u * W, top);
      }
      case 'hood': { // u = width, v = cowl(0) -> nose(1); tilted plane sloping down-forward
        const a = originAlong + L * (hood.back + v * (hood.front - hood.back));
        const hz = box.z + box.height * (hood.cowlZ + v * (hood.noseZ - hood.cowlZ));
        return pt(a, originAcross + u * W, hz);
      }
      case 'deck': { // rear slope (trunk lid): u = width, v = rear-cowl(0) -> tail(1)
        const d = box.deck || { back: backAlong, front: 0, cowlZ: 1, tailZ: 1 };
        const a = originAlong + L * (d.back + v * (d.front - d.back));
        const dz = box.z + box.height * (d.cowlZ + v * (d.tailZ - d.cowlZ));
        return pt(a, originAcross + u * W, dz);
      }
      case 'windshield': { // raked glass: v's own height, but along rakes base->top
        const w = box.windshield || { baseV: 0, topV: 1, baseAlong: faceAlong, topAlong: faceAlong };
        const t = (v - w.baseV) / ((w.topV - w.baseV) || 1);
        const a = originAlong + L * (w.baseAlong + t * (w.topAlong - w.baseAlong));
        return pt(a, originAcross + u * W, box.z + v * box.height);
      }
      case 'backlight': { // raked rear glass (mirrors across like 'back')
        const b = box.backlight || { baseV: 0, topV: 1, baseAlong: backAlong, topAlong: backAlong };
        const t = (v - b.baseV) / ((b.topV - b.baseV) || 1);
        const a = originAlong + L * (b.baseAlong + t * (b.topAlong - b.baseAlong));
        return pt(a, originAcross + (1 - u) * W, box.z + v * box.height);
      }
      default:
        return pt(originAlong + u * L, originAcross + acrossPlane * W, z);
    }
  };
  // Each face-kind is multilinear in (u,v), so a bilinear quad over its four
  // corners reproduces it exactly. Delegate to the shared surface-quad embed so
  // furniture box-nets, room walls, and vehicles all ride one primitive.
  const corners = [worldAt(0, 0), worldAt(1, 0), worldAt(1, 1), worldAt(0, 1)];
  return embedSurfaceQuad(corners, projectPoint, {
    uLen: faceKind === 'side' ? L : W,
    vLen: faceKind === 'top' ? L : box.height,
  });
}

// ---- production scene (cards embedded on a real box, projected) ----------

function quadShape(embed, u0, v0, u1, v1, attrs) {
  return {
    type: 'poly',
    points: [embed(u0, v0), embed(u1, v0), embed(u1, v1), embed(u0, v1)],
    ...attrs,
  };
}

function discShape(embed, u, v, r, attrs, samples = 22) {
  // r is a fraction of the face's v-extent; correct u so the disc stays round.
  const du = (r * embed.vLen) / embed.uLen;
  const points = [];
  for (let i = 0; i < samples; i += 1) {
    const t = (Math.PI * 2 * i) / samples;
    points.push(embed(u + du * Math.cos(t), v + r * Math.sin(t)));
  }
  return { type: 'poly', points, ...attrs };
}

function projectedPartShapes(part, embed, mirror, rolePrefix) {
  const role = `${rolePrefix}:${part.role}`;
  const style = partStyle(part);
  const fill = { fill: style.fill, stroke: style.stroke, strokeWidth: style.strokeWidth, opacity: style.opacity };
  switch (part.kind) {
    case 'band':
      return [quadShape(embed, 0, part.v, 1, part.v + part.h, { role, ...fill })];
    case 'rect': {
      const u0 = mirror ? 1 - part.u - part.w : part.u;
      return [quadShape(embed, u0, part.v, u0 + part.w, part.v + part.h, { role, ...fill })];
    }
    case 'repeat': {
      const span = part.u1 - part.u0;
      const gap = part.gap ?? 0;
      const w = part.w ?? (span - gap * (part.count - 1)) / part.count;
      const step = part.count > 1 ? (span - w) / (part.count - 1) : 0;
      const out = [];
      for (let i = 0; i < part.count; i += 1) {
        const uStart = part.u0 + i * step;
        const u0 = mirror ? 1 - uStart - w : uStart;
        out.push(quadShape(embed, u0, part.v, u0 + w, part.v + part.h, { role: `${role}:${i}`, ...fill }));
      }
      return out;
    }
    case 'poly': {
      const pts = part.points.map((pp) => embed(mirrorU(pp.u, mirror), pp.v));
      return [{ type: 'poly', points: pts, role, ...fill }];
    }
    case 'circle':
      return [discShape(embed, mirrorU(part.u, mirror), part.v, part.r, { role, ...fill })];
    case 'wheels': {
      const out = [];
      for (const [i, frac] of part.fractions.entries()) {
        const u = mirrorU(frac, mirror);
        out.push(discShape(embed, u, part.v, part.r, { role: `${role}:${i}`, fill: part.fill, stroke: part.stroke ?? 'none', strokeWidth: part.strokeWidth ?? 0 }));
        if (part.hub) {
          out.push(discShape(embed, u, part.v, part.r * part.hub, { role: `${role}:${i}:hub`, fill: part.hubFill ?? '#cbd5e1', stroke: 'none', strokeWidth: 0 }));
        }
      }
      return out;
    }
    case 'line': {
      const a = embed(mirrorU(part.u0, mirror), part.v0);
      const b = embed(mirrorU(part.u1, mirror), part.v1);
      return [{ type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, role, stroke: part.stroke ?? '#475569', strokeWidth: part.strokeWidth ?? 1, dash: part.dash }];
    }
    default:
      return [];
  }
}

/**
 * Render a vehicle in 3/4 view by embedding the net's face cards onto a real
 * world box and projecting them — the same cards that draw the plate. `faces`
 * is the visible-face paint order (back-to-front). `box` is
 * { x, y, z, width(=W along x), length(=L along y), height(=H) }; `axis` is the
 * world axis the vehicle length runs along.
 */
export function buildFaceNetSceneShapes(netOrId, {
  box,
  axis = 'x',
  projectPoint,
  faces = ['top', 'side', 'front'],
  mirrorSide = false,
  dropWheels = false,
} = {}) {
  const resolved = typeof netOrId === 'object' && netOrId.slots ? netOrId : resolveFaceNet(netOrId);
  const SLOT_FOR_FACE = { top: 'top', side: 'left', front: 'face', back: 'back', hood: 'hood' };
  // Fold the net's vector-space form params (cowl, hood/deck slope) onto the box
  // so the windshield-face, hood and deck embed correctly. A box vehicle has none.
  const form = resolved.form || {};
  const embedBox = { ...box, faceAlong: form.faceAlong, backAlong: form.backAlong, hood: form.hood, deck: form.deck, topZ: form.topZ, roofAlong: form.roofAlong, windshield: form.windshield, backlight: form.backlight };
  const shapes = [];

  // Draw one card facet onto its (already-built) primary embed. `fasciaEmbed`,
  // when present, is the vertical end-cap of a slope: parts tagged
  // `plane:'fascia'` go there (grille, lights, plate) while the glass/silhouette
  // stays on the primary plane.
  const renderFacet = (card, embed, { mirror = false, fasciaEmbed = null } = {}) => {
    const silPoints = card.silhouette?.profile
      ? card.silhouette.profile.map((pp) => embed(mirrorU(pp.u, mirror), pp.v))
      : [embed(0, 0), embed(1, 0), embed(1, 1), embed(0, 1)];
    shapes.push({
      type: 'poly', points: silPoints, role: `${card.id}:silhouette`,
      fill: card.silhouette?.fill ?? '#e2e8f0', stroke: card.silhouette?.stroke ?? '#475569', strokeWidth: 0.8,
    });
    for (const part of materializeCardParts(card)) {
      if (dropWheels && part.kind === 'wheels') continue;
      const e = part.plane === 'fascia' && fasciaEmbed ? fasciaEmbed : embed;
      shapes.push(...projectedPartShapes(part, e, mirror, card.id));
    }
  };

  for (const face of faces) {
    if (face === 'body-underlay') {
      const card = resolved.slots.left.card;
      const nearEmbed = embedFaceOntoBox('side', embedBox, axis, projectPoint, { acrossPlane: 1 });
      const farEmbed = embedFaceOntoBox('side', embedBox, axis, projectPoint, { acrossPlane: 0 });
      const nearSil = card.silhouette?.profile
        ? card.silhouette.profile.map((pp) => nearEmbed(pp.u, pp.v))
        : [nearEmbed(0, 0), nearEmbed(1, 0), nearEmbed(1, 1), nearEmbed(0, 1)];
      const farSil = card.silhouette?.profile
        ? card.silhouette.profile.map((pp) => farEmbed(pp.u, pp.v))
        : [farEmbed(0, 0), farEmbed(1, 0), farEmbed(1, 1), farEmbed(0, 1)];
      shapes.push({
        type: 'poly',
        points: farSil,
        role: 'body-underlay:far',
        fill: card.silhouette?.fill ?? '#e2e8f0',
        stroke: 'none',
        strokeWidth: 0,
      });
      shapes.push({
        type: 'poly',
        points: nearSil,
        role: 'body-underlay:near',
        fill: card.silhouette?.fill ?? '#e2e8f0',
        stroke: 'none',
        strokeWidth: 0,
      });
      continue;
    }
    if (face === 'deck') { // rear-slope trunk lid (cars); not a slot, drawn from form
      const deckCard = typeof form.deckCard === 'object' ? form.deckCard : form.deckCard && getVehicleFaceCard(form.deckCard);
      if (deckCard) renderFacet(deckCard, embedFaceOntoBox('deck', embedBox, axis, projectPoint));
      continue;
    }
    if (face === 'side-far') { // far-side body silhouette only, so the roof/glass
      // don't overhang empty space (the near side + details paint over it later)
      const farEmbed = embedFaceOntoBox('side', embedBox, axis, projectPoint, { acrossPlane: 0 });
      const card = resolved.slots.left.card;
      const sil = card.silhouette?.profile
        ? card.silhouette.profile.map((pp) => farEmbed(pp.u, pp.v))
        : [farEmbed(0, 0), farEmbed(1, 0), farEmbed(1, 1), farEmbed(0, 1)];
      shapes.push({ type: 'poly', points: sil, role: 'side-far:silhouette', fill: card.silhouette?.fill ?? '#e2e8f0', stroke: card.silhouette?.stroke ?? '#475569', strokeWidth: 0.8 });
      continue;
    }
    const entry = resolved.slots[SLOT_FOR_FACE[face]];
    if (!entry) continue;
    const mirror = face === 'side' ? mirrorSide : false;
    // front/back glass rides a raked plane (windshield/backlight) that meets the
    // roof; their fascia parts ride the vertical nose/tail end-cap.
    let primary;
    let fasciaEmbed = null;
    if (face === 'front') {
      primary = embedFaceOntoBox('windshield', embedBox, axis, projectPoint);
      fasciaEmbed = embedFaceOntoBox('front', { ...embedBox, faceAlong: 1 }, axis, projectPoint);
    } else if (face === 'back') {
      primary = embedFaceOntoBox('backlight', embedBox, axis, projectPoint);
      fasciaEmbed = embedFaceOntoBox('back', { ...embedBox, backAlong: 0 }, axis, projectPoint);
    } else {
      primary = embedFaceOntoBox(face, embedBox, axis, projectPoint, { acrossPlane: face === 'side' ? 1 : 0 });
    }
    renderFacet(entry.card, primary, { mirror, fasciaEmbed });
  }
  return { resolved, shapes };
}

// ---- serialization helper (shared by spikes / renderers) ----------------

function fmt(n) {
  return Number(n).toFixed(2);
}

function roleAttr(role) {
  return role ? ` data-role="${role}"` : '';
}

/** Serialize one plate shape to an SVG element string. */
export function serializePlateShape(shape) {
  const op = shape.opacity != null ? ` opacity="${shape.opacity}"` : '';
  switch (shape.type) {
    case 'rect':
      return `<rect x="${fmt(shape.x)}" y="${fmt(shape.y)}" width="${fmt(shape.w)}" height="${fmt(shape.h)}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"${op}${roleAttr(shape.role)}/>`;
    case 'circle':
      return `<circle cx="${fmt(shape.cx)}" cy="${fmt(shape.cy)}" r="${fmt(shape.r)}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"${op}${roleAttr(shape.role)}/>`;
    case 'line': {
      const dash = shape.dash ? ` stroke-dasharray="${shape.dash}"` : '';
      return `<line x1="${fmt(shape.x1)}" y1="${fmt(shape.y1)}" x2="${fmt(shape.x2)}" y2="${fmt(shape.y2)}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"${dash}${roleAttr(shape.role)}/>`;
    }
    case 'poly': {
      const pts = shape.points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
      return `<polygon points="${pts}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"${roleAttr(shape.role)}/>`;
    }
    case 'text':
      return `<text x="${fmt(shape.x)}" y="${fmt(shape.y)}" font-size="${shape.fontSize ?? 12}" fill="${shape.fill ?? '#475569'}"${shape.fontWeight ? ` font-weight="${shape.fontWeight}"` : ''}${roleAttr(shape.role)}>${shape.text}</text>`;
    default:
      return '';
  }
}
