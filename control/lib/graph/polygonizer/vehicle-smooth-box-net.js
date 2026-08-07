/**
 * Back-compat shim. The smooth-box vehicles now live in the unified
 * swept-cross-section module `vehicle-swept-net.js` (cars + boxes share one
 * builder — see vehicle-car-net.plan.md "Merge"). The box-family symbols are
 * re-exported here so existing consumers keep importing from this path.
 */

export {
  VEHICLE_SMOOTH_BOX_NET_VERSION,
  SMOOTH_BOX_DEFAULT_LIGHT,
  BUS_BODY, BUS_FRONT, BUS_REAR,
  VAN_BODY, VAN_FRONT, VAN_REAR,
  TRUCK_BODY, TRUCK_FRONT, TRUCK_REAR,
  STREETCAR_BODY, STREETCAR_FRONT, STREETCAR_REAR,
  getSmoothBoxCard,
  SMOOTH_BOX_NETS, getSmoothBoxNet,
  resolveSmoothBoxNet,
  buildSmoothBoxNetSceneShapes,
} from './vehicle-swept-net.js';
