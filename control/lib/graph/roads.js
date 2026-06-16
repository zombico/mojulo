/**
 * roads — roads as a FIRST-CLASS ribbon primitive, equal footing for straight and
 * curvy. A road is a PATH (waypoints) + a profile (width, lift, lane line). Straight
 * is just the degenerate 2-point path; curves are sampled paths. They mix and match
 * (chainPaths), and ground vs elevated is one `lift` knob.
 *
 * Output is ribbon specs (+ pillar boxes for elevated decks) consumed by
 * scene-css3d's renderBoxCityToHtml — dependency-free.
 *
 * This is the canonical road builder: the cityscape/urban mandala draws its street
 * skeleton through here so straight grid streets and curved freeways share one path.
 */

const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A straight road segment, sampled n+1 points (n≥1). */
export function straightPath(a, b, n = 4) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(lerp2(a, b, i / n));
  return out;
}

/** A sine-curved road from a→b: sinusoidal offset PERPENDICULAR to the a→b axis. */
export function sinePath(a, b, { amplitude = 3, waves = 1.5, n = 28 } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;                 // unit perpendicular
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, base = lerp2(a, b, t), off = amplitude * Math.sin(t * Math.PI * waves);
    out.push([base[0] + px * off, base[1] + py * off]);
  }
  return out;
}

/** A circular-arc road. */
export function arcPath(center, radius, a0, a1, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius]); }
  return out;
}

/** Concatenate segments into one road, dropping duplicate join points. Mix straight + curve. */
export function chainPaths(...paths) {
  const out = [];
  for (const p of paths) for (const pt of p) {
    const last = out[out.length - 1];
    if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 1e-6) continue;
    out.push(pt);
  }
  return out;
}

/**
 * Turn a road (path + profile) into ribbon specs (+ pillar boxes for elevated decks).
 * @param {object} o
 * @param {number[][]} o.path     waypoints [[x,y],...]
 * @param {number} o.width        deck width (world units)
 * @param {number} o.lift         0 → ground road; >0 → elevated deck at this height
 * @param {number} o.deck         deck thickness (elevated only)
 * @param {boolean} o.laneLine    draw a center lane stripe
 * @param {'outer'|null} o.bikeLanes draw dedicated green bike lanes on road edges
 * @returns {{ ribbons, boxes }}
 */
// offset a path sideways by `off` (perpendicular per segment) — used for lane lines
export function offsetPath(path, off) {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] + (-dy / l) * off, p[1] + (dx / l) * off];
  });
}

export function roadRibbons({ path, width = 2.4, lift = 0, deck = 0.4, laneLine = true, edgeLines = false, asphalt = '#333a44', line = '#d9c468', pillars = true, pillarEvery = 5, lanes = 1, bikeLanes = null } = {}) {
  const z0 = lift > 0 ? lift : 0.03;
  const z1 = lift > 0 ? lift + deck : 0.05;
  const ribbons = [{ path, z0, z1, width, tint: asphalt }];
  if (bikeLanes === 'outer') {
    const laneW = Math.max(0.18, width * 0.13);
    const edge = width * 0.5 - laneW * 0.62;
    for (const off of [-edge, edge]) {
      ribbons.push({ path: offsetPath(path, off), z0: z1 + 0.012, z1: z1 + 0.022, width: laneW, tint: '#357a5b' });
      ribbons.push({ path: offsetPath(path, off * 0.86), z0: z1 + 0.024, z1: z1 + 0.032, width: Math.max(0.035, width * 0.022), tint: '#d7ead9' });
    }
  }
  if (laneLine && lanes >= 2) {                                  // 2-lane road: yellow centre (+ optional white edge lines)
    if (edgeLines) for (const off of [-width * 0.24, width * 0.24]) ribbons.push({ path: offsetPath(path, off), z0: z1 + 0.01, z1: z1 + 0.02, width: Math.max(0.08, width * 0.045), tint: '#d8d2bf' });
    ribbons.push({ path, z0: z1 + 0.01, z1: z1 + 0.02, width: Math.max(0.08, width * 0.045), tint: '#c9b85a' });
  } else if (laneLine) ribbons.push({ path, z0: z1 + 0.01, z1: z1 + 0.02, width: Math.max(0.12, width * 0.07), tint: line });
  const boxes = [];
  if (lift > 0 && pillars) {
    for (let i = pillarEvery; i < path.length - 1; i += pillarEvery) {
      const [x, y] = path[i];
      boxes.push({ x: x - 0.35, y: y - 0.35, w: 0.7, d: 0.7, z0: 0, z1: lift, kind: 'pillar', tint: '#666c73' });
    }
  }
  return { ribbons, boxes };
}

/** Convenience: a straight ground street (lanes:2 → a 2-lane main with lane markings). */
export const groundStreet = (a, b, opts = {}) => roadRibbons({ path: straightPath(a, b, opts.n || 4), width: opts.width || 1.6, lift: 0, laneLine: opts.laneLine ?? false, edgeLines: opts.edgeLines ?? false, lanes: opts.lanes || 1, asphalt: opts.asphalt || '#3a414b', bikeLanes: opts.bikeLanes || null });

/**
 * Airfield pavement — a DEDICATED airport surface primitive, deliberately NOT the urban
 * road (no lanes, kerbs, sidewalks, crosswalks). Path-based a→b like groundStreet; returns
 * { ribbons } for renderBoxCityToHtml. Two types:
 *   'tarmac' — a TAXIWAY: dark apron asphalt + a single CONTINUOUS yellow centerline.
 *   'runway' — dark asphalt + long, sparse white centerline STRIPES + a pair of bold
 *              aiming-point bars flanking the centerline near each end (clean aviation
 *              read; no dense piano-key threshold that scans as a zebra crosswalk).
 * @param {'tarmac'|'runway'} o.type
 */
export function airportStrip(a, b, { type = 'tarmac', width = 3, asphalt = '#363b42', n = 4 } = {}) {
  const path = straightPath(a, b, n);
  const z1 = 0.05;
  const ribbons = [{ path, z0: 0.03, z1, width, tint: asphalt }];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  if (type === 'runway') {
    const stripeLen = 2.1, step = stripeLen + 2.3;                                  // long stripes, big gaps
    for (let t = 3.4; t < len - 3.4; t += step) {
      const s = [a[0] + ux * t, a[1] + uy * t], e = [a[0] + ux * (t + stripeLen), a[1] + uy * (t + stripeLen)];
      ribbons.push({ path: [s, e], z0: z1 + 0.01, z1: z1 + 0.02, width: 0.16, tint: '#d9d4c4' });
    }
    const off = width * 0.34, barLen = 1.7;                                         // aiming-point bars near each end
    for (const t0 of [2.4, len - 2.4 - barLen]) for (const sgn of [-1, 1]) {
      const seg = [[a[0] + ux * t0, a[1] + uy * t0], [a[0] + ux * (t0 + barLen), a[1] + uy * (t0 + barLen)]];
      ribbons.push({ path: offsetPath(seg, sgn * off), z0: z1 + 0.01, z1: z1 + 0.02, width: 0.32, tint: '#e3ddcc' });
    }
  } else {
    ribbons.push({ path, z0: z1 + 0.01, z1: z1 + 0.02, width: Math.max(0.1, width * 0.05), tint: '#e8c24a' });   // continuous taxiway centerline
  }
  return { ribbons };
}

/**
 * A streetcar/tram line — a road primitive with TWO layers: a pair of steel rails
 * embedded in a paved deck on the ground, and an overhead contact WIRE carried down
 * the centreline on cantilever poles. Follows any path (straight or curved), same
 * as roadRibbons. Returns ribbons (deck + rails + wire) and boxes (poles, brackets,
 * hangers) for renderBoxCityToHtml.
 *
 * @param {object} o
 * @param {number[][]} o.path     waypoints [[x,y],...]
 * @param {number} o.gauge        rail-to-rail spacing
 * @param {number} o.deckWidth    paved running surface width
 * @param {number} o.wireZ        height of the overhead contact wire
 * @param {number} o.poleEvery    pole spacing (in path points)
 * @param {1|-1}   o.poleSide     which flank the poles stand on
 * @param {boolean} o.paved       lay an asphalt deck under the rails (tram-in-street)
 * @returns {{ ribbons, boxes }}
 */
export function streetcarTrack({
  path, gauge = 0.56, deckWidth = 1.8, wireZ = 3.2, poleEvery = 5, poleSide = 1, paved = true,
  asphalt = '#363b43', railTint = '#aab2bb', wireTint = '#26282c', poleTint = '#566069', tie = '#4a4136',
} = {}) {
  const ribbons = [], boxes = [];
  if (paved) ribbons.push({ path, z0: 0.03, z1: 0.05, width: deckWidth, tint: asphalt });
  // wooden-tie cross-hatch hint down the centre (a faint dark band between the rails)
  ribbons.push({ path, z0: 0.05, z1: 0.058, width: gauge + 0.12, tint: tie });
  // two steel rails, sitting just proud of the deck
  for (const off of [-gauge / 2, gauge / 2]) ribbons.push({ path: offsetPath(path, off), z0: 0.05, z1: 0.10, width: 0.06, tint: railTint });
  // overhead contact wire down the centreline (slim, with fascia so it reads side-on)
  ribbons.push({ path, z0: wireZ, z1: wireZ + 0.06, width: 0.045, tint: wireTint });
  // cantilever poles on one flank: mast → bracket arm over the track → hanger to the wire
  const mast = offsetPath(path, poleSide * (deckWidth / 2 + 0.35));
  for (let i = poleEvery; i < path.length - 1; i += poleEvery) {
    const [px, py] = mast[i], [cx, cy] = path[i];
    boxes.push({ kind: 'tram-pole', x: px - 0.07, y: py - 0.07, w: 0.14, d: 0.14, z0: 0, z1: wireZ + 0.28, tint: poleTint });
    boxes.push({ kind: 'tram-bracket', x: Math.min(px, cx) - 0.02, y: Math.min(py, cy) - 0.025, w: Math.abs(cx - px) + 0.04, d: Math.abs(cy - py) + 0.05, z0: wireZ + 0.16, z1: wireZ + 0.21, tint: poleTint });
    boxes.push({ kind: 'tram-hanger', x: cx - 0.012, y: cy - 0.012, w: 0.024, d: 0.024, z0: wireZ + 0.06, z1: wireZ + 0.17, tint: poleTint });
  }
  return { ribbons, boxes };
}

/**
 * A streetcar boarding PLATFORM beside a track: a raised slab with a yellow safety
 * strip along its track edge and a paneled back wall (frosted glass panels in a
 * frame). Built in track-local terms — `axis` is the track direction, `side` which
 * flank of `center` it stands on. A flat CANOPY roof is carried on the back wall +
 * a row of front posts (set `roof:false` to drop it). Returns boxes (slab / wall /
 * panels / posts / roof) + grounds (the yellow edge strip).
 *
 * @param {object} o
 * @param {[number,number]} o.center  a point on the track the platform runs beside
 * @param {'x'|'y'} o.axis            track direction
 * @param {1|-1} o.side               which flank the platform sits on
 * @param {number} o.length           platform length along the track
 * @param {number} o.width            platform depth (track edge → back wall)
 * @param {number} o.trackGap         track centre → platform edge clearance
 * @param {boolean} o.roof            cap the bay with a canopy roof on front posts
 * @returns {{ boxes, grounds }}
 */
export function streetcarPlatform({
  center, axis = 'y', side = 1, length = 6, width = 1.4, height = 0.26, trackGap = 1.0,
  wallHeight = 2.2, wallThick = 0.16, panelEvery = 1.5, scale = 1, roof = true,
  slabTint = '#8a8f95', edgeTint = '#e6c33a', wallTint = '#586069', panelTint = '#9fb4c2',
  roofTint = '#46505b', postTint = '#3f474f',
} = {}) {
  // `scale` shrinks the whole structure (length/depth/heights) so it reads at the
  // right weight in a scene; trackGap (clearance from the rails) is left intact.
  length *= scale; width *= scale; height *= scale; wallHeight *= scale; wallThick *= scale; panelEvery *= scale;
  const boxes = [], grounds = [];
  // a rect from along-range [a0,a1] (track axis) × across-range [c0,c1] (signed by side)
  const rect = (a0, a1, c0, c1) => {
    const cc0 = side * c0, cc1 = side * c1, cmin = Math.min(cc0, cc1), cmax = Math.max(cc0, cc1);
    return axis === 'y'
      ? { x: center[0] + cmin, y: center[1] + a0, w: cmax - cmin, d: a1 - a0 }
      : { x: center[0] + a0, y: center[1] + cmin, w: a1 - a0, d: cmax - cmin };
  };
  const a0 = -length / 2, a1 = length / 2;
  boxes.push({ kind: 'platform', ...rect(a0, a1, trackGap, trackGap + width), z0: 0, z1: height, tint: slabTint });
  grounds.push({ ...rect(a0, a1, trackGap + 0.06, trackGap + 0.24), z: height + 0.012, fill: edgeTint });   // yellow safety strip
  boxes.push({ kind: 'platform-wall', ...rect(a0, a1, trackGap + width - wallThick, trackGap + width), z0: height, z1: height + wallHeight, tint: wallTint });
  // frosted glass panels proud of the wall front, separated by mullion gaps
  const n = Math.max(2, Math.round(length / panelEvery)), seg = length / n, panelW = seg * 0.82;
  const fc0 = trackGap + width - wallThick - 0.04, fc1 = trackGap + width - wallThick;
  for (let i = 0; i < n; i++) {
    const pa0 = a0 + i * seg + (seg - panelW) / 2;
    boxes.push({ kind: 'platform-panel', ...rect(pa0, pa0 + panelW, fc0, fc1), z0: height + 0.18, z1: height + wallHeight - 0.18, tint: panelTint });
  }
  // canopy roof: a flat slab on the back wall + a row of front posts at the track edge,
  // cantilevered a touch past the platform edge so it reads as shelter over the bay
  if (roof) {
    const roofZ0 = height + wallHeight, roofThick = 0.12 * scale, eave = 0.3 * scale, postW = 0.13 * scale;
    boxes.push({ kind: 'platform-roof', ...rect(a0 - eave, a1 + eave, trackGap - eave, trackGap + width), z0: roofZ0, z1: roofZ0 + roofThick, tint: roofTint });
    const nPosts = Math.max(2, Math.round(length / 2.5));
    for (let i = 0; i < nPosts; i++) {
      const pa = a0 + postW / 2 + (nPosts > 1 ? i / (nPosts - 1) : 0.5) * (length - postW);
      boxes.push({ kind: 'platform-post', ...rect(pa - postW / 2, pa + postW / 2, trackGap + 0.04, trackGap + 0.04 + postW), z0: height, z1: roofZ0, tint: postTint });
    }
  }
  // footprint (slab extent + a small clearance pad) — a STRUCTURE reservation, like
  // an anchor: callers add it to `reserved` so roads clip around it and never cross it.
  const f = rect(a0, a1, trackGap, trackGap + width), pad = 0.25;
  const footprint = { x: f.x - pad, y: f.y - pad, w: f.w + 2 * pad, d: f.d + 2 * pad };
  return { boxes, grounds, footprint };
}
