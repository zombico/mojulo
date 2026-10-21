/**
 * THE DUMMY — a plain stand-in figure walking a meru's route, so a cube's trail (era/geocube.js show 'trail') is seen
 * walked: the protoform in plain clothes, unpainted (its baked colours greyed by their own light: a mannequin), on the
 * walkers channel (scene/channels/walkers.js), up the route to the top and back down to the seam, round and round, the
 * camera following it (`follow`) until the operator takes the walk. A geocube's micro-town and micro-city (show 'town',
 * 'city') are walked by it too: a street with a spur to each door, a city block's sidewalk round.
 *
 *   dummyWalker(route)     → the walker: the route out and back as one closed loop
 *   attachDummy(payload)   → the payload with its `route` (local-meru/scene.js, ctx.route) walked by the dummy
 *
 * The bake is the figure door's, the same for every trail, so it is made once and kept.
 */
export const DUMMY = Object.freeze({ speed: 1.4, grey: [0.74, 0.72, 0.68] });

// the protoform's colours as a mannequin's: each vertex's light kept (the walkers channel draws its colours unlit), its
// hue the dummy's grey
function greyed(rig) {
  let top = 1;
  const lums = rig.parts.map((p) => {
    if (!p?.col) return null;
    const u = Buffer.from(p.col, 'base64'), l = new Float32Array(u.length / 3);
    for (let i = 0; i < l.length; i++) { l[i] = 0.2126 * u[3 * i] + 0.7152 * u[3 * i + 1] + 0.0722 * u[3 * i + 2]; if (l[i] > top) top = l[i]; }
    return l;
  });
  const parts = rig.parts.map((p, k) => {
    if (!lums[k]) return p;
    const l = lums[k], u = new Uint8Array(l.length * 3);
    for (let i = 0; i < l.length; i++) for (let c = 0; c < 3; c++) u[3 * i + c] = Math.round(255 * DUMMY.grey[c] * (l[i] / top));
    return { ...p, col: Buffer.from(u.buffer).toString('base64') };
  });
  return { ...rig, parts };
}

let _rig = null;
function dummyRig() {
  if (!_rig) {
    _rig = (async () => {
      const { bakeProtoformRig } = await import('@/lib/graph/figures/rig-bake');
      const { GARMENTS } = await import('@/lib/graph/polygonizer/figure-garments');
      // in the city walkers' plain tee and trousers (worlds/world-kinds.js), so greyed it reads as one smooth form
      return greyed(await bakeProtoformRig({ proto: { sex: 'male' }, garment: [GARMENTS.tee, GARMENTS.trousers], motion: 'walk', keys: 8 }));
    })().catch((err) => { _rig = null; throw err; });   // a failed bake retries on the next render
  }
  return _rig;
}

/** The dummy's walk: the route to its top and back down, one closed loop (the channel's 'bumble'). `scale`: a world in
 * other units than metres (a city's) stands it a person's height; absent, the walker is as it was. */
export function dummyWalker(route, { scale } = {}) {
  // (a closed route, a city block's sidewalk, is walked round as it is)
  const [a, z] = [route[0], route[route.length - 1]], closed = a.every((v, i) => v === z[i]);
  return { figure: 'dummy', path: closed ? route : [...route, ...route.slice(0, -1).reverse()], style: 'bumble', speed: scale ? DUMMY.speed * scale : DUMMY.speed, follow: true, ...(scale ? { scale } : {}) };
}

export async function attachDummy(payload, { scale } = {}) {
  if (!Array.isArray(payload.route) || payload.route.length < 2) return payload;
  const { route, ...rest } = payload;
  return { ...rest, walkers: [dummyWalker(route, { scale })], figures: { ...(rest.figures || {}), dummy: await dummyRig() } };
}
