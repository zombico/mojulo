import { describe, expect, it } from 'vitest';

import {
  VEHICLE_FACE_NETS,
  resolveFaceNet,
  computePlateLayout,
  buildFaceNetPlateShapes,
  embedFaceOntoBox,
  buildFaceNetSceneShapes,
} from './vehicle-face-net.js';
import { getVehicleFaceCard, expectedAspectForKind, materializeCardParts, SEDAN_SEAM, SEDAN_CABIN, insetTowardCentroid } from './vehicle-face-cards.js';
import { makeVehicleFaceNetVariant, makeVehicleFaceNetVariants } from './vehicle-face-net-variants.js';

describe('resolveFaceNet', () => {
  it('resolves the five core slots (+ optional hood) with valid aspects, no warnings', () => {
    for (const id of Object.keys(VEHICLE_FACE_NETS)) {
      const r = resolveFaceNet(id);
      for (const core of ['face', 'back', 'top', 'left', 'right']) {
        expect(core in r.slots, `${id} missing ${core}`).toBe(true);
      }
      expect(r.warnings).toEqual([]);
      // every slot's card aspect matches what the slot kind expects
      for (const slot of Object.values(r.slots)) {
        expect(slot.card.aspect).toBe(expectedAspectForKind(slot.kind));
      }
    }
  });

  it('mirrors the right side from the canonical side by default', () => {
    const r = resolveFaceNet('bus');
    expect(r.sideMode).toBe('mirror');
    expect(r.slots.left.card.id).toBe('bus-side');
    expect(r.slots.right.card.id).toBe('bus-side');
    expect(r.slots.left.mirror).toBe(false);
    expect(r.slots.right.mirror).toBe(true);
  });

  it('honors a sideRight override instead of mirroring', () => {
    const net = {
      conceptId: 'vehicle.bus.side-slab',
      proportions: { length: 11, width: 2.5, height: 3.1 },
      faces: { front: 'bus-front', back: 'bus-back', top: 'bus-top', side: 'bus-side', sideRight: 'train-side' },
    };
    const r = resolveFaceNet(net);
    expect(r.sideMode).toBe('override');
    expect(r.slots.right.card.id).toBe('train-side');
    expect(r.slots.right.mirror).toBe(false);
  });

  it('throws when a slot gets a card of the wrong aspect class', () => {
    const net = {
      conceptId: 'x',
      proportions: { length: 11, width: 2.5, height: 3.1 },
      // bus-side is a rectangle card; the front slot wants a square
      faces: { front: 'bus-side', back: 'bus-back', top: 'bus-top', side: 'bus-side' },
    };
    expect(() => resolveFaceNet(net)).toThrow(/aspect-"square"/);
  });

  it('records a soft warning when a face-kind is reused in a different slot', () => {
    const net = {
      conceptId: 'x',
      proportions: { length: 11, width: 2.5, height: 3.1 },
      // bus-top is a rectangle (ok for the side slot) but a different faceKind
      faces: { front: 'bus-front', back: 'bus-back', top: 'bus-top', side: 'bus-top' },
    };
    const r = resolveFaceNet(net);
    expect(r.warnings.join(' ')).toMatch(/"top" face used in the "side" slot/);
  });
});

describe('computePlateLayout', () => {
  it('lays the cross out with shared edges (face/top/back column, side wings)', () => {
    const r = resolveFaceNet('bus');
    const { panels, bounds } = computePlateLayout(r, { scale: 10, gap: 4, originX: 0, originY: 0 });

    // center column shares one x and width
    expect(panels.face.x).toBe(panels.top.x);
    expect(panels.face.x).toBe(panels.back.x);
    expect(panels.face.w).toBe(panels.back.w);

    // wings align vertically with the face row
    expect(panels.left.y).toBe(panels.face.y);
    expect(panels.right.y).toBe(panels.face.y);
    expect(panels.left.h).toBe(panels.face.h);

    // face/back are square-ish (W×H), sides/top are length-elongated
    const { length: L, width: W, height: H } = r.proportions;
    expect(panels.face.w).toBeCloseTo(W * 10);
    expect(panels.face.h).toBeCloseTo(H * 10);
    expect(panels.left.w).toBeCloseTo(L * 10);
    expect(panels.top.h).toBeCloseTo(L * 10);

    // bounds enclose the whole cross
    expect(bounds.width).toBeGreaterThan(panels.face.w);
    expect(bounds.height).toBeGreaterThan(panels.face.h);
  });
});

describe('buildFaceNetPlateShapes', () => {
  it('emits a silhouette per panel plus decorator shapes, all five panels', () => {
    const plate = buildFaceNetPlateShapes('truck');
    expect(plate.panels.map((p) => p.slot)).toEqual(['back', 'top', 'face', 'left', 'right']);
    const silhouettes = plate.shapes.filter((s) => s.role?.endsWith(':silhouette'));
    expect(silhouettes).toHaveLength(5);
    // wheels on the side cards produce circles
    expect(plate.shapes.some((s) => s.type === 'circle' && s.role?.includes('wheel'))).toBe(true);
  });

  it('mirrors the right wing: a left-biased part lands on the opposite side', () => {
    const plate = buildFaceNetPlateShapes('bus', { scale: 12, gap: 5 });
    const left = plate.panels.find((p) => p.slot === 'left');
    const right = plate.panels.find((p) => p.slot === 'right');
    const routeLeft = plate.shapes.find((s) => s.role === 'bus-side:route-sign' && within(s, left.rect));
    const routeRight = plate.shapes.find((s) => s.role === 'bus-side:route-sign' && within(s, right.rect));
    expect(routeLeft).toBeTruthy();
    expect(routeRight).toBeTruthy();
    // route sign authored near the front (u≈0.88): un-mirrored sits near the
    // panel's right edge, mirrored sits near the left edge.
    const leftOffset = routeLeft.x - left.rect.x;
    const rightOffset = routeRight.x - right.rect.x;
    expect(leftOffset).toBeGreaterThan(left.rect.w * 0.5);
    expect(rightOffset).toBeLessThan(right.rect.w * 0.5);
  });
});

describe('embedFaceOntoBox', () => {
  it('maps face-local (u,v) onto the right world plane for each face', () => {
    const box = { x: 0, y: 0, z: 0, width: 2, length: 6, height: 3 };
    const id = (p) => ({ x: p[0], y: p[1], z: p[2] }); // identity "projection"
    const side = embedFaceOntoBox('side', box, 'y', id);
    // side: u runs along length (y), v along height (z), across pinned at origin
    expect(side(0, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(side(1, 1)).toEqual({ x: 0, y: 6, z: 3 });

    const top = embedFaceOntoBox('top', box, 'y', id);
    // top: u=width(x), v=length(y), z pinned to roof
    expect(top(1, 1)).toEqual({ x: 2, y: 6, z: 3 });
    expect(top(0, 0)).toEqual({ x: 0, y: 0, z: 3 });
  });
});

describe('registration rules (bands)', () => {
  it('bus & subway doors span floor to the top of the windows', () => {
    for (const sideId of ['bus-side', 'train-side']) {
      const parts = materializeCardParts(getVehicleFaceCard(sideId));
      const win = parts.find((p) => p.role === 'window-repeat');
      const windowTop = win.v + win.h;
      const doors = parts.filter((p) => p.kind === 'rect' && p.role.startsWith('door'));
      expect(doors.length).toBeGreaterThan(0);
      for (const d of doors) {
        expect(d.v + d.h).toBeCloseTo(windowTop); // door top === window top
        expect(d.v).toBeLessThan(0.1); // door bottom at the floor
      }
    }
  });

  it('truck (and every truck variant) side window === front windshield height', () => {
    const trucks = [
      ['truck-side', 'truck-front'],
      ['firetruck-side', 'firetruck-front'],
      ['dumptruck-side', 'dumptruck-front'],
      ['garbagetruck-side', 'garbagetruck-front'],
    ];
    for (const [sideId, frontId] of trucks) {
      const sideWin = materializeCardParts(getVehicleFaceCard(sideId)).find((p) => p.role === 'cab-window');
      const windshield = materializeCardParts(getVehicleFaceCard(frontId)).find((p) => p.role === 'front-windshield');
      expect(sideWin.v, sideId).toBeCloseTo(windshield.v);
      expect(sideWin.h, sideId).toBeCloseTo(windshield.h);
    }
  });

  it('conventional (nosed) truck splits hood + grille: grille rides the nose fascia', () => {
    const r = resolveFaceNet('conventional-truck');
    expect(r.slots.hood, 'has a hood slope facet').toBeTruthy();
    expect(r.form.hood.noseZ).toBeLessThan(r.form.hood.cowlZ); // hood slopes down to the nose
    // grille + headlights ride the vertical nose end-cap (plane:'fascia'), not the slope
    const front = materializeCardParts(getVehicleFaceCard('convtruck-front'));
    for (const role of ['grille', 'headlight-l', 'headlight-r', 'bumper']) {
      expect(front.find((p) => p.role === role)?.plane, role).toBe('fascia');
    }
    // the hood card is slope skin only — no grille
    expect(getVehicleFaceCard('convtruck-hood').parts.some((p) => p.role === 'grille')).toBe(false);
  });

  it('car fold-seam rule: the sedan side profile cowl/nose lie on the hood facet edges', () => {
    const profile = getVehicleFaceCard('sedan-side').silhouette.profile;
    const has = (u, v) => profile.some((p) => Math.abs(p.u - u) < 1e-6 && Math.abs(p.v - v) < 1e-6);
    // the side profile passes exactly through the shared seam points
    expect(has(SEDAN_SEAM.cowlAlong, SEDAN_SEAM.cowlZ)).toBe(true);
    expect(has(SEDAN_SEAM.noseAlong, SEDAN_SEAM.noseZ)).toBe(true);

    // and the net's hood facet uses those same seam values, so the cutouts line up
    const form = resolveFaceNet('sedan').form;
    expect(form.hood.back).toBeCloseTo(SEDAN_SEAM.cowlAlong);
    expect(form.hood.cowlZ).toBeCloseTo(SEDAN_SEAM.cowlZ);
    expect(form.hood.front).toBeCloseTo(SEDAN_SEAM.noseAlong);
    expect(form.hood.noseZ).toBeCloseTo(SEDAN_SEAM.noseZ);
  });

  it('car rule: the windshield-face spans (nearly) the full car width at the cowl', () => {
    const profile = getVehicleFaceCard('sedan-front').silhouette.profile;
    const base = profile.filter((p) => p.v < 0.65); // cowl-line points
    const width = Math.max(...base.map((p) => p.u)) - Math.min(...base.map((p) => p.u));
    expect(width).toBeGreaterThan(0.85); // ~full width, fully overlaps the opening
  });

  it('car rule: the primary hood profile is curved, not one angular segment', () => {
    const hoodRun = hoodProfileRun(getVehicleFaceCard('sedan-side').silhouette.profile, SEDAN_SEAM);
    expect(hoodRun.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < hoodRun.length; i += 1) {
      expect(hoodRun[i].u).toBeGreaterThan(hoodRun[i - 1].u);
      expect(hoodRun[i].v).toBeLessThanOrEqual(hoodRun[i - 1].v + 0.02);
    }
  });

  it('car rule: side glass is one mass duplicating the roof shape, bisected', () => {
    const side = getVehicleFaceCard('sedan-side');
    // the old separate panes are gone
    expect(side.parts.some((p) => p.role === 'window-front' || p.role === 'window-rear')).toBe(false);
    // one greenhouse mass shaped like the roof (SEDAN_CABIN), registered (inset)
    const gh = side.parts.find((p) => p.role === 'greenhouse');
    expect(gh).toBeTruthy();
    expect(gh.points).toHaveLength(SEDAN_CABIN.length);
    const expected = insetTowardCentroid(SEDAN_CABIN, 0.12);
    gh.points.forEach((p, i) => {
      expect(p.u, `greenhouse[${i}].u`).toBeCloseTo(expected[i].u);
      expect(p.v, `greenhouse[${i}].v`).toBeCloseTo(expected[i].v);
    });
    // the side silhouette's roofline uses the SAME cabin corners (registered)
    const profile = side.silhouette.profile;
    for (const corner of SEDAN_CABIN) {
      expect(profile.some((p) => Math.abs(p.u - corner.u) < 1e-9 && Math.abs(p.v - corner.v) < 1e-9), `roofline has ${corner.u},${corner.v}`).toBe(true);
    }
    // bisected down the middle by a b-pillar
    expect(side.parts.some((p) => p.role === 'b-pillar')).toBe(true);
  });

  it('car rule: front and rear glass panes are flush rectangles', () => {
    expectRectPane(getVehicleFaceCard('sedan-front').parts.find((p) => p.role === 'windshield-glass').points, 'sedan windshield');
    expectRectPane(getVehicleFaceCard('sedan-back').parts.find((p) => p.role === 'rear-glass').points, 'sedan rear glass');
  });

  it('a band-driven variant keeps the door rule when the window count changes', () => {
    // simulate "natural variation": clone bus-side, change window count + door u
    const base = getVehicleFaceCard('bus-side');
    const variant = {
      ...base,
      parts: base.parts.map((p) => {
        if (p.role === 'window-repeat') return { ...p, count: 8, u1: 0.6 };
        if (p.role === 'door') return { ...p, u: 0.66 };
        return p;
      }),
    };
    const parts = materializeCardParts(variant);
    const win = parts.find((p) => p.role === 'window-repeat');
    const door = parts.find((p) => p.role === 'door');
    expect(door.v + door.h).toBeCloseTo(win.v + win.h); // rule still holds
  });
});

describe('face-net seeded variants', () => {
  it('creates repeatable T-map variants for the same seed and different outcomes for another seed', () => {
    const a = makeVehicleFaceNetVariant('truck', { seed: 'freight-roll', variant: 2 });
    const b = makeVehicleFaceNetVariant('truck', { seed: 'freight-roll', variant: 2 });
    const c = makeVehicleFaceNetVariant('truck', { seed: 'freight-roll-other', variant: 2 });

    expect(a.variant).toEqual(b.variant);
    expect(a.faces.side.card.parts).toEqual(b.faces.side.card.parts);
    expect(a.variant).not.toEqual(c.variant);
  });

  it('resolves generated inline cards through the regular plate renderer', () => {
    const net = makeVehicleFaceNetVariant('bus', { seed: 'city-roll', variant: 1 });
    const plate = buildFaceNetPlateShapes(net, { scale: 8, gap: 3 });

    expect(plate.panels).toHaveLength(5);
    expect(plate.shapes.filter((s) => s.role?.endsWith(':silhouette'))).toHaveLength(5);
    expect(plate.resolved.slots.left.card.variantOf).toBe('bus-side');
  });

  it('keeps bus generated doors registered to the side window top', () => {
    const variants = makeVehicleFaceNetVariants('bus', { seed: 'door-rule-roll', count: 6 });
    for (const net of variants) {
      const side = net.faces.side.card;
      const parts = materializeCardParts(side);
      const window = parts.find((p) => p.role === 'window-repeat');
      const doors = parts.filter((p) => p.role.startsWith('door-') && p.kind === 'rect');
      expect(doors.length).toBeGreaterThan(0);
      for (const door of doors) {
        expect(door.v + door.h).toBeCloseTo(window.v + window.h);
      }
    }
  });

  it('keeps truck side cab-window and front windshield on the same generated band', () => {
    const variants = makeVehicleFaceNetVariants('truck', { seed: 'truck-band-roll', count: 6 });
    for (const net of variants) {
      const sideWindow = materializeCardParts(net.faces.side.card).find((p) => p.role === 'cab-window');
      const windshield = materializeCardParts(net.faces.front.card).find((p) => p.role === 'front-windshield');
      expect(sideWindow.v).toBeCloseTo(windshield.v);
      expect(sideWindow.h).toBeCloseTo(windshield.h);
    }
  });

  it('creates explicit tram/streetcar variants with low-floor registered doors', () => {
    const variants = [
      ...makeVehicleFaceNetVariants('train', { seed: 'tram-roll', count: 3, trainClass: 'tram' }),
      ...makeVehicleFaceNetVariants('train', { seed: 'streetcar-roll', count: 3, trainClass: 'streetcar' }),
    ];
    for (const net of variants) {
      expect(net.variant.segmentClass).toMatch(/tram|streetcar/);
      expect(net.proportions.length).toBeLessThan(VEHICLE_FACE_NETS.train.proportions.length);
      const parts = materializeCardParts(net.faces.side.card);
      const window = parts.find((p) => p.role === 'window-repeat');
      const doors = parts.filter((p) => p.role.startsWith('low-floor-door-') && p.kind === 'rect');
      expect(doors.length).toBeGreaterThanOrEqual(3);
      for (const door of doors) {
        expect(door.v + door.h).toBeCloseTo(window.v + window.h);
      }
    }
  });

  it('generates sedan and SUV car variants that keep the car principles', () => {
    const sedan = makeVehicleFaceNetVariant('sedan', { seed: 'car-roll', variant: 0 });
    const suv = makeVehicleFaceNetVariant('suv', { seed: 'car-roll', variant: 1 });

    for (const [net, cls] of [[sedan, 'sedan'], [suv, 'suv']]) {
      expect(net.variant.carClass).toBe(cls);
      const resolved = resolveFaceNet(net);
      // a hood facet + front/back/deck from the right first-class type
      expect(resolved.slots.hood).toBeTruthy();
      expect(resolved.slots.face.card.variantOf).toBe(`${cls}-front`);
      expect(resolved.slots.back.card.variantOf).toBe(`${cls}-back`);
      expect(resolved.form.deckCard.variantOf).toBe(`${cls}-deck`);

      // principle: front/back glass are flush rectangles
      expectRectPane(resolved.slots.face.card.parts.find((p) => p.role === 'windshield-glass').points, `${cls} windshield`);
      expectRectPane(resolved.slots.back.card.parts.find((p) => p.role === 'rear-glass').points, `${cls} rear glass`);

      // principle: side glass is ONE greenhouse mass bisected (no separate panes)
      const side = resolved.slots.left.card;
      const gh = side.parts.find((p) => p.role === 'greenhouse');
      expect(gh, `${cls} greenhouse`).toBeTruthy();
      expect(gh.points).toHaveLength(4);
      expect(side.parts.some((p) => p.role === 'window-front' || p.role === 'window-rear')).toBe(false);
      expect(side.parts.some((p) => p.role === 'b-pillar')).toBe(true);

      // principle: the windshield rake is registered to the roof shape
      expect(resolved.form.windshield.topAlong).toBeCloseTo(resolved.form.roofAlong[1]);
      expect(resolved.form.windshield.baseAlong).toBeCloseTo(resolved.form.faceAlong);

      // still renders through the plate (hood panel present)
      const plate = buildFaceNetPlateShapes(net, { scale: 8, gap: 3 });
      expect(plate.panels.map((p) => p.slot)).toContain('hood');
      expect(hoodProfileRun(resolved.slots.left.card.silhouette.profile, resolved.form.hood).length).toBeGreaterThanOrEqual(3);
    }

    // the two elevated types are distinct: the SUV is taller (2-box stance)
    expect(suv.proportions.height).toBeGreaterThan(sedan.proportions.height);
  });

  it('generates conventional (nosed) truck variants keeping the split hood + grille', () => {
    const v = makeVehicleFaceNetVariant('conventional-truck', { seed: 'rig-roll', variant: 0 });
    const r = resolveFaceNet(v);
    expect(r.slots.hood).toBeTruthy();
    expect(r.slots.face.card.variantOf).toBe('convtruck-front');
    expect(r.slots.face.card.parts.find((p) => p.role === 'grille').plane).toBe('fascia');
    expect(r.form.hood.noseZ).toBeLessThan(r.form.hood.cowlZ);
  });

  it('paints a body-colored 3D underlay behind folded car facets', () => {
    const suv = makeVehicleFaceNetVariant('sedan', { seed: 'city-car-roll', variant: 1, carClass: 'suv' });
    const scene = buildFaceNetSceneShapes(suv, {
      box: { x: 0, y: 0, z: 0, width: 8.8, length: 3.35, height: 3.45 },
      axis: 'x',
      projectPoint: ([x, y, z]) => ({ x: x + y * 0.2, y: z - y * 0.1 }),
      faces: ['body-underlay', 'side-far', 'deck', 'top', 'hood', 'side', 'front'],
    });
    const underlay = scene.shapes.filter((s) => s.role?.startsWith('body-underlay'));
    expect(underlay).toHaveLength(2);
    expect(underlay.every((s) => s.fill === suv.faces.side.card.silhouette.fill)).toBe(true);
  });

  it('creates nosed commercial variants with explicit hood panels', () => {
    const classes = ['ambulance', 'movingVan', 'deliveryTruck', 'tractorNosed', 'schoolbus'];
    for (const [variant, commercialClass] of classes.entries()) {
      const net = makeVehicleFaceNetVariant('truck', { seed: 'nosed-roll', variant, commercialClass });
      const resolved = resolveFaceNet(net);
      expect(net.variant.commercialClass).toBe(commercialClass);
      expect(resolved.slots.hood, commercialClass).toBeTruthy();
      expect(resolved.slots.left.card.silhouette.profile.length, commercialClass).toBeGreaterThan(6);
      expect(resolved.form.hood.front).toBeCloseTo(1.0);
      expect(resolved.form.hood.back).toBeGreaterThan(0.84);
      if (commercialClass === 'tractorNosed' || commercialClass === 'schoolbus') {
        expect(resolved.form.hoodLengthFrac, commercialClass).toBeGreaterThan(0.09);
      } else {
        expect(resolved.form.hoodLengthFrac, commercialClass).toBeLessThan(0.1);
      }
      expect(resolved.slots.face.card.parts.find((p) => p.role === 'windshield-glass'), commercialClass).toBeTruthy();
      expect(resolved.slots.face.card.parts.find((p) => p.role === 'grille')?.plane, commercialClass).toBe('fascia');
      const plate = buildFaceNetPlateShapes(net, { scale: 8, gap: 3 });
      expect(plate.panels.map((p) => p.slot)).toContain('hood');
    }

    const ambulance = makeVehicleFaceNetVariant('truck', { seed: 'nosed-roll', variant: 0, commercialClass: 'ambulance' });
    expect(ambulance.faces.side.card.parts.some((p) => p.role === 'medical-cross-h')).toBe(true);
    const movingVan = makeVehicleFaceNetVariant('truck', { seed: 'nosed-roll', variant: 1, commercialClass: 'movingVan' });
    expect(movingVan.faces.side.card.parts.some((p) => p.role === 'over-cab-cargo')).toBe(true);
    expect(movingVan.faces.front.card.parts.some((p) => p.role === 'over-cab-cargo-front')).toBe(true);
    const schoolbus = makeVehicleFaceNetVariant('truck', { seed: 'nosed-roll', variant: 4, commercialClass: 'schoolbus' });
    expect(schoolbus.faces.side.card.parts.some((p) => p.role === 'schoolbus-window')).toBe(true);
  });
});

function within(shape, rect, margin = 0.5) {
  const x = shape.x ?? shape.cx ?? shape.x1;
  return x >= rect.x - margin && x <= rect.x + rect.w + margin;
}

function expectRectPane(points, label) {
  const [bl, br, tr, tl] = points;
  expect(Math.abs(bl.u - tl.u), `${label} left edge`).toBeLessThan(0.03);
  expect(Math.abs(br.u - tr.u), `${label} right edge`).toBeLessThan(0.03);
  expect(Math.abs(bl.v - br.v), `${label} bottom`).toBeLessThan(0.03);
  expect(Math.abs(tl.v - tr.v), `${label} top`).toBeLessThan(0.03);
}

function hoodProfileRun(profile, seam) {
  const cowlU = seam.cowlAlong ?? seam.back;
  const cowlV = seam.cowlZ;
  const noseU = seam.noseAlong ?? seam.front;
  const noseV = seam.noseZ;
  return profile.filter((p) => (
    p.u >= cowlU - 1e-6
    && p.u <= noseU + 1e-6
    && p.v >= Math.min(cowlV, noseV) - 0.03
    && p.v <= Math.max(cowlV, noseV) + 0.08
  ));
}
