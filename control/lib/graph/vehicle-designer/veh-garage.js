/**
 * veh-garage — the attach contract of the veh-* shelf (the vehicle analog of
 * ms-armory). The CHASSIS DERIVES SOCKETS; parts carry hardpoints; a
 * classifier matches them.
 *
 * The one rule inherited verbatim from the mobile-suit line: sides resolve
 * from POSITION, never from id suffixes. Axle stubs are found by axis
 * direction (the only x-axis lathes on a chassis), left/right from the sign
 * of x (+x = right in the +y-forward, +z-up frame), front/rear from y
 * against the axle midline. Ids are never trusted for meaning.
 *
 * Vehicle space: +y forward of travel, +z up, +x right.
 */

const round3 = (n) => Math.round(n * 1e3) / 1e3;

function isChassis(recipe) {
  return Boolean(recipe && recipe.garage && recipe.garage.kind === 'veh-chassis');
}

function assertChassis(recipe, fn) {
  if (!isChassis(recipe)) {
    throw new Error(`${fn} expects a veh-chassis recipe (garage.kind === 'veh-chassis'); received ${JSON.stringify(recipe && recipe.garage && recipe.garage.kind)}`);
  }
}

// An axle stub is an x-parallel lathe: the axis runs in x only.
function isAxleStub(latheSpec) {
  const a = latheSpec.axisFrom || {};
  const b = latheSpec.axisTo || {};
  return a.y === b.y && a.z === b.z && a.x !== b.x;
}

/**
 * Derive the four hub sockets from a chassis recipe's geometry.
 * Returns [{ side, axle, anchor, outboard, forward, up, source }] sorted
 * front-left, front-right, rear-left, rear-right.
 */
export function deriveAxleSockets(chassis) {
  assertChassis(chassis, 'deriveAxleSockets');
  const lathes = Array.isArray(chassis.lathes) ? chassis.lathes : [];
  const stubs = lathes.filter(isAxleStub);
  if (stubs.length !== 4) {
    throw new Error(`deriveAxleSockets found ${stubs.length} axle stubs (x-axis lathes); a chassis carries exactly 4`);
  }
  const midY = stubs.reduce((s, m) => s + m.axisFrom.y, 0) / stubs.length;
  const sockets = stubs.map((stub) => {
    // the hub is the outboard end — the endpoint with the larger |x|
    const ends = [stub.axisFrom, stub.axisTo];
    const hub = Math.abs(ends[0].x) >= Math.abs(ends[1].x) ? ends[0] : ends[1];
    const side = hub.x >= 0 ? 'right' : 'left';
    const axle = stub.axisFrom.y >= midY ? 'front' : 'rear';
    const sideSign = side === 'right' ? 1 : -1;
    return {
      side,
      axle,
      anchor: [round3(hub.x), round3(hub.y), round3(hub.z)],
      outboard: [sideSign, 0, 0],
      forward: [0, 1, 0],
      up: [0, 0, 1],
      source: stub.id,
    };
  });
  const order = { 'front-left': 0, 'front-right': 1, 'rear-left': 2, 'rear-right': 3 };
  return sockets.sort((p, q) => order[`${p.axle}-${p.side}`] - order[`${q.axle}-${q.side}`]);
}

/**
 * Derive the bay sockets (engine bay, cabin deck, dash rail, hitch) from a
 * chassis recipe. A `towedFrame` (nose:'tongue') has NO engine bay and no
 * dash rail — the missing socket is data, not an error; `planComponentFit`
 * throws only when a part actually asks for the missing bay.
 */
export function deriveBaySockets(chassis) {
  assertChassis(chassis, 'deriveBaySockets');
  const { dims, modules } = chassis.garage;
  const axles = deriveAxleSockets(chassis);
  const frontY = axles.find((s) => s.axle === 'front').anchor[1];
  const rearY = axles.find((s) => s.axle === 'rear').anchor[1];
  const deckZ = round3(dims.hubZ + dims.clearance + 0.15);
  const frame = { forward: [0, 1, 0], up: [0, 0, 1] };
  const bays = {
    cabinDeck: { anchor: [0, round3((frontY + rearY) / 2 - dims.wheelbase * 0.05), deckZ], ...frame },
    rearDeck: { anchor: [0, round3(rearY), deckZ], ...frame },
  };
  if (modules.nose === 'engine') {
    bays.engineBay = { anchor: [0, round3(frontY + dims.wheelbase * 0.02), deckZ], ...frame };
    bays.dashRail = { anchor: [0, round3(frontY - dims.wheelbase * 0.18), round3(deckZ + 1.1)], ...frame };
  }
  if (modules.nose === 'tongue') {
    const hitch = Array.isArray(chassis.lathes) ? chassis.lathes.find((m) => m.axisFrom.x === m.axisTo.x && m.axisFrom.y === m.axisTo.y && m.axisFrom.z !== m.axisTo.z) : null;
    if (hitch) bays.hitch = { anchor: [round3(hitch.axisTo.x), round3(hitch.axisTo.y), round3(hitch.axisTo.z)], ...frame };
  }
  return bays;
}

const BAY_BY_MOUNT = { 'bay-mount': 'engineBay', 'deck-mount': 'cabinDeck', 'rail-mount': 'dashRail', 'rear-mount': 'rearDeck' };

/**
 * Match a part's `garage.mountFamily` to the chassis sockets and return
 * concrete assembler placements.
 *
 * - `hub-mount` → 4 placements (one per axle socket); LEFT-side wheels get
 *   `flip:'x'` so the outboard face points away from the vehicle. `at` puts
 *   the part's hubCenter on the socket anchor — for a matched wheel radius
 *   that lands the contact patch on the ground (z=0).
 * - `bay-mount` / `deck-mount` / `rail-mount` → 1 placement on the bay
 *   anchor (superposed z; internals ride the chassis, not gravity).
 *
 * Returns { placements, warnings }.
 */
export function planComponentFit(part, chassis) {
  assertChassis(chassis, 'planComponentFit');
  const garage = part && part.garage;
  if (!garage || !garage.mountFamily) {
    throw new Error("planComponentFit expects a part with garage.mountFamily (e.g. 'hub-mount')");
  }
  const warnings = [];
  if (garage.mountFamily === 'hub-mount') {
    const hub = garage.hardpoints && garage.hardpoints.hubCenter;
    if (!hub) throw new Error('hub-mount part is missing garage.hardpoints.hubCenter');
    const wheelRadius = garage.dims && garage.dims.radius;
    if (Number.isFinite(wheelRadius) && Math.abs(wheelRadius - chassis.garage.dims.wheelRadius) > 0.2) {
      warnings.push(`wheel radius ${wheelRadius} differs from the chassis design radius ${chassis.garage.dims.wheelRadius}; the chassis will sit tilted off its ride height`);
    }
    const placements = deriveAxleSockets(chassis).map((socket) => ({
      socket: `${socket.axle}-${socket.side}`,
      side: socket.side,
      axle: socket.axle,
      ...(socket.side === 'left' ? { flip: 'x' } : {}),
      at: [
        round3(socket.anchor[0] - hub[0]),
        round3(socket.anchor[1] - hub[1]),
        round3(socket.anchor[2] - hub[2]),
      ],
    }));
    return { placements, warnings };
  }
  const bayKey = BAY_BY_MOUNT[garage.mountFamily];
  if (!bayKey) {
    throw new Error(`Unknown mountFamily '${garage.mountFamily}' - expected one of: hub-mount, ${Object.keys(BAY_BY_MOUNT).join(', ')}`);
  }
  const bays = deriveBaySockets(chassis);
  const bay = bays[bayKey];
  if (!bay) {
    throw new Error(`Chassis family '${chassis.garage.family}' has no ${bayKey} socket (nose: '${chassis.garage.modules.nose}') - a ${garage.mountFamily} part cannot seat on it`);
  }
  const mount = (garage.hardpoints && garage.hardpoints.mount) || [0, 0, 0];
  return {
    placements: [{
      socket: bayKey,
      at: [
        round3(bay.anchor[0] - mount[0]),
        round3(bay.anchor[1] - mount[1]),
        round3(bay.anchor[2] - mount[2]),
      ],
    }],
    warnings,
  };
}
