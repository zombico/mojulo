/**
 * historic/skin-art — what a carved and painted wall shows, drawn onto a wall skin's overlay
 * (./ground.js): filled shapes cut in sunk relief and painted, and the Egyptian temple's figures and
 * writing drawn as the New Kingdom drew them. Still a big read, but drawn to the canon rather than as
 * generic people:
 *  - figures on the 18-square grid (sole to hairline); seated figures 14, kneeling ones lower. They are
 *    drawn in composite view: the head and legs in profile, the eye and shoulders frontal, the far leg
 *    striding forward. Men are red-brown, women yellow, Amun blue.
 *  - the king wears the blue crown with uraeus, the straight false beard, the pleated kilt with gold
 *    apron, and the bull's tail.
 *  - each god carries their emblems:
 *    - Amun: two tall plumes on a flat cap and a curved beard, with was-sceptre and ankh;
 *    - Mut: the vulture cap and double crown;
 *    - Khonsu: mummiform, with sidelock and moon disc;
 *    - Ra-Horakhty: falcon-headed under the sun disc.
 *  - each scene is one ritual: wine, incense and libation, the heaped offering table, the god leading
 *    the king by the hand, or the king kneeling to offer Maat. The king faces INTO the temple and the
 *    gods face out to meet him. Captions run in columns, their signs facing the way their figure faces.
 *    Above the king, the vulture hovers.
 *
 * Every scene is drawn facing +x, into the temple. The wall that wears it mirrors the tile when its run
 * points the other way (ground.js `skinFace`, `toward`).
 */

export const PIG = { blue: [47, 95, 158], red: [168, 68, 46], skin: [150, 78, 48], yellow: [210, 162, 60], white: [236, 230, 214], green: [63, 122, 90], black: [40, 34, 30] };
const SKIN = { man: [150, 78, 48], woman: [214, 172, 96], amun: [52, 92, 160], nubian: [78, 48, 34], asiatic: [206, 160, 104], libyan: [218, 182, 132] };

export const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
export const quad = (pts) => (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
// a filled shape on the overlay: `inside(x, y)` over a box; sunk relief cuts its outline in (a shadow
// on the upper-left edge, light on the lower-right), then the paint lies in the cut
export function relief(o, [x0, y0, x1, y1], inside, col, al, { cut = 0.32 } = {}) {
  for (let y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++) for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
    if (!inside(x, y)) continue;
    const edgeUL = !inside(x - 1, y) || !inside(x, y - 1), edgeLR = !inside(x + 1, y) || !inside(x, y + 1);
    if (edgeUL) o.add(x, y, -cut); else if (edgeLR) o.add(x, y, cut * 0.4);
    if (col) o.paint(x, y, col, al);
  }
}

// a pen in grid squares: x forward along the figure's facing `dir`, y up from its sole at `base` px
function pen(o, cx, base, g, dir, al) {
  const X = (x) => cx + dir * x * g, Y = (y) => base - y * g;
  const bbox = (P) => { const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const poly = (pts, col, opt = {}) => { const P = pts.map(([x, y]) => [X(x), Y(y)]); relief(o, bbox(P), quad(P), col, opt.al ?? al, opt); };
  const disc = (x, y, rx, ry, col, opt = {}) => { const Rx = Math.max(0.7, rx * g), Ry = Math.max(0.7, ry * g); relief(o, [X(x) - Rx, Y(y) - Ry, X(x) + Rx, Y(y) + Ry], ell(X(x), Y(y), Rx, Ry), col, opt.al ?? al, opt); };
  const ring = (x, y, rx, ry, t, col, opt = {}) => { const Rx = rx * g, Ry = ry * g, a = ell(X(x), Y(y), Rx, Ry), b = ell(X(x), Y(y), Math.max(0.1, Rx - t * g), Math.max(0.1, Ry - t * g)); relief(o, [X(x) - Rx, Y(y) - Ry, X(x) + Rx, Y(y) + Ry], (px, py) => a(px, py) && !b(px, py), col, opt.al ?? al, opt); };
  // a limb or rod from a to b, w0 wide at a and w1 at b (never thinner than a pixel)
  const limb = (a, b, w0, w1 = w0, col, opt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, m = 1.1 / g;
    const h0 = Math.max(w0, m) / 2, h1 = Math.max(w1, m) / 2;
    poly([[a[0] + nx * h0, a[1] + ny * h0], [b[0] + nx * h1, b[1] + ny * h1], [b[0] - nx * h1, b[1] - ny * h1], [a[0] - nx * h0, a[1] - ny * h0]], col, opt);
  };
  const dot = (x, y, col, a = 0.85) => o.paint(X(x), Y(y), col, a);
  // a pen offset (dx, dy squares) and scaled by k: the upper body of a seated or kneeling figure
  const sub = (dx, dy, k = 1) => pen(o, X(dx), Y(dy), g * k, dir, al);
  return { o, X, Y, g, dir, al, poly, disc, ring, limb, dot, sub };
}

// ── the figure, in grid squares (facing +x; x = 0 is the line through the ear, y = 0 the sole) ──

const LEG = {   // striding: the far (front) leg forward, both feet flat, both shown from the inside
  rear: [[-1.7, 9.6], [-1.9, 7.2], [-2.2, 6], [-2.75, 4.3], [-2.6, 1.3], [-3.2, 0.35], [-3.2, 0], [-0.3, 0], [-0.4, 0.35], [-1.1, 0.75], [-1.55, 1.35], [-1.5, 4.4], [-1.3, 6], [-0.7, 8], [-0.3, 9.6]],
  front: [[-0.6, 9.6], [0, 7.4], [0.6, 6], [0.8, 4.3], [1.55, 1.3], [1.55, 0], [4.6, 0], [4.5, 0.35], [3.4, 0.8], [2.8, 1.35], [2.25, 4.2], [2, 6], [1.6, 8], [1.2, 9.6]],
  // a woman stands with a shorter step
  rearF: [[-1.4, 9.6], [-1.5, 6], [-1.9, 4.3], [-1.8, 1.3], [-2.3, 0.3], [-2.3, 0], [0.3, 0], [0.2, 0.35], [-0.4, 0.8], [-0.8, 1.4], [-0.8, 4.4], [-0.6, 6], [-0.2, 9.6]],
  frontF: [[-0.4, 9.6], [0.2, 6], [0.4, 4.3], [0.8, 1.3], [0.8, 0], [3.4, 0], [3.3, 0.35], [2.4, 0.8], [2, 1.35], [1.6, 4.2], [1.4, 6], [1.2, 9.6]],
};
// the torso as the canon shows it: both shoulders square to us, the chest and belly in profile
const TORSO = [[-1.3, 10.6], [-1.6, 12.6], [-2.6, 14.6], [-2.9, 15.5], [-2.5, 16.1], [-0.6, 16.35], [0.6, 16.35], [2.5, 16.1], [2.9, 15.5], [2.2, 14.3], [1.9, 13.4], [2.05, 13], [1.7, 12.4], [1.4, 11.4], [1.5, 10.6]];
const TORSO_F = [[-1.2, 10.6], [-1.3, 12.6], [-2, 14.8], [-2.3, 15.5], [-2, 16.1], [-0.5, 16.3], [0.5, 16.3], [2, 16.1], [2.3, 15.5], [1.7, 14.4], [1.4, 12.6], [1.3, 10.6]];
const HEAD = [[1.05, 16.45], [1.5, 16.6], [1.65, 17], [1.55, 17.25], [1.95, 17.45], [1.6, 17.85], [1.5, 18.3], [1, 18.9], [0, 19.1], [-1.2, 18.6], [-1.45, 17.6], [-0.9, 16.9], [0.1, 16.6]];

function eye(p, x = 1, y = 17.85) {   // the eye drawn frontal in the profile face, lined with kohl
  p.disc(x, y, 0.3, 0.13, PIG.white, { cut: 0, al: 0.75 });
  p.dot(x + 0.06, y, PIG.black);
  p.limb([x - 0.25, y + 0.03], [x - 0.8, y - 0.02], 0.09, 0.06, PIG.black, { cut: 0, al: 0.7 });
}
function collar(p, w = 1) {   // the broad collar: bands of faience beads round the neck, lying on the chest
  const c = [0.1, 16.25], bands = [[2.75, PIG.blue], [2.3, PIG.red], [1.85, PIG.green], [1.4, PIG.yellow]];
  for (const [r, col] of bands) {
    const rx = r * w * p.g, ry = r * 0.62 * p.g, cx = p.X(c[0]), cy = p.Y(c[1]), inE = ell(cx, cy, rx, ry);
    relief(p.o, [cx - rx, cy, cx + rx, cy + ry], (x, y) => y >= cy && inE(x, y), col, p.al, { cut: r === 2.75 ? 0.32 : 0.12 });
  }
}
function head(p, skin, { ear = true } = {}) {
  p.limb([-0.45, 16.1], [0.1, 16.95], 1.2, 1.1, skin);   // the neck
  p.poly(HEAD, skin);
  if (ear) p.disc(0, 17.5, 0.3, 0.45, skin, { cut: 0.2 });
  eye(p);
}
// headdresses
const HAT = {
  // the blue crown (khepresh): the king's war-and-ritual helmet, blue sewn with gold discs, a uraeus at the brow
  blue(p) {
    const C = [[1.25, 17.95], [1.55, 18.6], [1.6, 19.5], [1.3, 20.6], [0.4, 21.4], [-0.9, 21.6], [-1.9, 21], [-2.1, 20], [-1.8, 18.9], [-1.3, 18], [-0.5, 17.75], [0.35, 18.2]];
    p.poly(C, PIG.blue);
    if (p.g >= 4) { const inC = quad(C); for (let y = 18.4; y < 21.3; y += 0.62) for (let x = -1.8; x < 1.4; x += 0.62) if (inC(x, y)) p.dot(x + ((y * 3) % 0.6), y, PIG.yellow, 0.7); }
    p.limb([-1.9, 18.7], [-2.7, 16.4], 0.3, 0.22, PIG.red);   // the streamers
    p.poly([[1.45, 18.45], [1.85, 18.7], [2, 19.35], [1.75, 19.55], [1.6, 19]], PIG.yellow);   // the uraeus
  },
  // Amun: a flat-topped cap, two tall plumes banded in colour, a ribbon falling behind
  amun(p) {
    p.limb([-1.3, 19.1], [-2.1, 13], 0.35, 0.3, PIG.red);
    p.poly([[-1.35, 18.7], [1.3, 18.7], [1.25, 19.65], [-1.3, 19.65]], PIG.red);
    const plume = [[-0.9, 19.6], [0.7, 19.6], [0.75, 25.6], [0.1, 25.9], [-0.85, 25.6]];
    p.poly(plume, PIG.yellow, { al: p.al * 0.6 });
    const cols = [PIG.red, PIG.green, PIG.blue];
    for (let i = 0, y = 19.9; y < 25.3; i++, y += 0.75) p.poly([[-0.85, y], [0.7, y], [0.72, y + 0.5], [-0.85, y + 0.5]], cols[i % 3], { cut: 0.08 });
    p.limb([-0.08, 19.6], [-0.08, 25.8], 0.12, 0.12, PIG.black, { cut: 0.2, al: 0.4 });   // two plumes, side by side
  },
  // a falcon's head (Ra-Horakhty) in a striped wig, the sun disc with its uraeus above
  falcon(p) {
    p.poly([[0.9, 18.6], [0.4, 19.3], [-1, 19.2], [-1.85, 18.2], [-1.95, 15.4], [-1, 15.3], [-0.7, 16.6], [0.4, 17]], PIG.blue);
    p.poly([[0.4, 17], [1.05, 17.2], [1.1, 15.3], [0.35, 15.3]], PIG.blue);
    p.disc(1, 18, 0.95, 0.8, PIG.white, { al: p.al * 0.9 });
    p.poly([[1.6, 18.4], [2.35, 18.15], [2.45, 17.55], [2.15, 17.35], [1.75, 17.75]], PIG.black);
    p.limb([1.05, 17.75], [0.8, 17], 0.22, 0.18, PIG.black, { cut: 0 });   // the falcon's cheek stripe
    p.dot(1.15, 18.05, PIG.black, 0.95);
    p.disc(0, 20.6, 1.25, 1.25, PIG.red);
    p.ring(0, 20.6, 1.25, 1.25, 0.2, PIG.yellow, { cut: 0 });
    p.poly([[1.1, 19.4], [1.5, 19.6], [1.55, 20.4], [1.3, 20.5]], PIG.yellow);
  },
  // Mut: the long wig, the vulture cap, the double crown — the red crown of Lower Egypt round the white of Upper
  mut(p) {
    p.poly([[1.2, 18.2], [0.6, 19.2], [-0.8, 19.2], [-1.8, 18.4], [-2, 15.4], [-1, 15.3], [-0.6, 16.6], [0.2, 17], [0.8, 17.2]], PIG.blue);
    p.poly([[0.5, 17], [1, 17.3], [1, 14.9], [0.3, 14.9]], PIG.blue);
    p.poly([[1.35, 18.55], [0.8, 19.3], [-1, 19.3], [-1.9, 18.5], [-1.3, 17.75], [0.3, 18.2]], PIG.yellow, { cut: 0.15 });   // the vulture's wings
    p.poly([[1.3, 18.5], [1.8, 18.8], [1.7, 18.3]], PIG.red);
    p.poly([[-1.25, 19.25], [1.2, 19.25], [1.2, 20.4], [-0.4, 20.4], [-0.4, 22.4], [-1.25, 22.4]], PIG.red);
    p.poly([[-0.4, 20.4], [0.9, 20.4], [0.8, 22], [0.3, 23.4], [-0.1, 23.6], [-0.4, 23.2]], PIG.white);
    p.limb([0.9, 20.3], [1.6, 21.3], 0.15, 0.12, PIG.red);
  },
  // Khonsu: the close cap and the sidelock of youth, the full moon on the crescent
  khonsu(p) {
    p.poly([[1.2, 18], [0.6, 18.95], [-1, 18.95], [-1.5, 18], [-1.2, 17.4], [0.2, 17.9]], PIG.blue);
    p.limb([-0.9, 17.6], [-0.7, 15.4], 0.5, 0.42, PIG.blue);
    p.disc(-0.45, 15.3, 0.35, 0.3, PIG.blue);
    const a = ell(p.X(0), p.Y(20), 1.3 * p.g, 1.1 * p.g), b = ell(p.X(0), p.Y(20.45), 1.15 * p.g, 1 * p.g);
    relief(p.o, [p.X(0) - 1.4 * p.g, p.Y(21.2), p.X(0) + 1.4 * p.g, p.Y(18.8)], (x, y) => a(x, y) && !b(x, y), PIG.yellow, p.al);
    p.disc(0, 20.8, 0.95, 0.95, PIG.yellow);
  },
  // captives: hair and beard name the people the king subdues
  nubian(p) { p.poly([[1.3, 18.2], [0.6, 19.2], [-1, 19.2], [-1.5, 18.2], [-1.3, 17.4], [0.4, 18]], PIG.black); p.ring(-0.1, 17, 0.35, 0.35, 0.12, PIG.yellow, { cut: 0 }); },
  asiatic(p) { p.poly([[1.3, 18.3], [0.6, 19.3], [-1.1, 19.2], [-1.7, 17.6], [-1.5, 16.2], [-0.6, 16.6], [-0.5, 17.6], [0.4, 18.1]], PIG.black); p.limb([-1.6, 18.4], [1.4, 18.6], 0.25, 0.25, PIG.white, { cut: 0 }); p.poly([[1.2, 16.7], [1.6, 16.6], [1.3, 15.4], [0.6, 16.2]], PIG.black); },
  libyan(p) { p.poly([[1.3, 18.2], [0.6, 19.2], [-1, 19.2], [-1.4, 18.2], [-1, 17.6], [0.4, 18]], PIG.black); p.limb([0.6, 17.6], [1.1, 15.6], 0.3, 0.25, PIG.black); p.limb([-0.4, 19.1], [-0.9, 21.2], 0.35, 0.2, PIG.white); p.limb([0.1, 19.1], [-0.1, 21.4], 0.35, 0.2, PIG.white); },
};
const BEARD = {
  king: [[1, 16.55], [1.38, 16.5], [1.48, 15.3], [1.08, 15.3]],     // the straight false beard on its strap
  god: [[1, 16.5], [1.35, 16.45], [1.6, 15.4], [1.9, 15.25], [1.75, 15], [1.2, 15.2]],   // the gods' beard, curling forward at its tip
};

// what the hands hold
function ankh(p, x, y, s = 1) {   // hanging from the fist by its loop
  p.ring(x, y - 0.35 * s, 0.38 * s, 0.5 * s, 0.17 * s, PIG.yellow);
  p.limb([x - 0.55 * s, y - 0.95 * s], [x + 0.55 * s, y - 0.95 * s], 0.25 * s, 0.25 * s, PIG.yellow);
  p.limb([x, y - 0.9 * s], [x, y - 2.3 * s], 0.25 * s, 0.25 * s, PIG.yellow);
}
function was(p, x, y0, y1) {   // the was-sceptre: a forked foot, a long shaft, an animal's head
  p.limb([x, y0 + 0.5], [x, y1], 0.3, 0.3, PIG.yellow);
  p.limb([x, y0 + 0.6], [x - 0.35, y0], 0.22, 0.22, PIG.yellow); p.limb([x, y0 + 0.6], [x + 0.35, y0], 0.22, 0.22, PIG.yellow);
  p.poly([[x - 0.2, y1 - 0.1], [x + 0.75, y1 + 0.55], [x + 0.85, y1 + 0.25], [x + 0.25, y1 - 0.25]], PIG.yellow);
}
function papyrusSceptre(p, x, y0, y1) { p.limb([x, y0], [x, y1], 0.28, 0.28, PIG.green); p.poly([[x, y1 - 0.2], [x - 0.65, y1 + 1], [x + 0.65, y1 + 1]], PIG.green); }
function jar(p, x, y) { p.disc(x, y, 0.42, 0.42, PIG.white); p.limb([x - 0.3, y + 0.4], [x + 0.3, y + 0.4], 0.18, 0.18, PIG.yellow, { cut: 0.1 }); }

// arms by pose, from the shoulders at (±sh, 15.5); `fy` is the floor in these squares (a staff stands on it)
const ARM = (p, skin, a, b, c) => { p.limb(a, b, 1, 0.85, skin); p.limb(b, c, 0.85, 0.6, skin); p.disc(c[0], c[1], 0.38, 0.32, skin, { cut: 0.15 }); };
const POSE = {
  // two round wine jars held out
  offer: { front(p, S, sh) { ARM(p, S, [-sh, 15.5], [0.4, 13.1], [3.5, 14.3]); jar(p, 3.7, 15.05); ARM(p, S, [sh, 15.5], [3.6, 13.3], [5.4, 14.5]); jar(p, 5.6, 15.25); } },
  // a censer held out, its bowl smoking; the other hand pours water from a libation vase
  censer: { front(p, S, sh) {
    ARM(p, S, [-sh, 15.5], [0.2, 12.9], [2.7, 12.1]);
    p.poly([[2.6, 12.4], [3.4, 12.95], [3.7, 12.4], [3.1, 11.65]], PIG.yellow);
    p.limb([3.7, 12.45], [4.5, 7.4], 0.14, 0.14, PIG.blue, { cut: 0.1 }); p.limb([3.5, 12.2], [4.1, 7.4], 0.14, 0.14, PIG.blue, { cut: 0.1 });
    ARM(p, S, [sh, 15.5], [3.6, 13.6], [5.1, 14.3]);
    p.limb([4.7, 14.35], [9.2, 14.6], 0.3, 0.3, PIG.yellow); p.disc(7.3, 14.8, 0.42, 0.26, PIG.yellow); p.poly([[7.05, 15], [7.55, 15], [7.4, 15.95]], PIG.red); p.disc(9.25, 14.65, 0.3, 0.3, PIG.yellow);
  } },
  // both hands raised before the god, palms out: adoration
  adore: { front(p, S, sh) { ARM(p, S, [-sh, 15.5], [0.9, 14.9], [3.15, 17.6]); ARM(p, S, [sh, 15.5], [3.8, 16], [4.65, 18.6]); } },
  // led by the hand: the near arm hangs, the far one reaches forward to the god's
  led: { back(p, S, sh) { ARM(p, S, [-sh, 15.5], [-2.6, 12.3], [-2.3, 9.7]); }, front(p, S, sh) { ARM(p, S, [sh, 15.5], [3.3, 13.2], [5.6, 12.3]); } },
  // a god leading: the near hand reaches back for the king's, the far one holds the ankh
  lead: { back(p, S, sh) { ARM(p, S, [-sh, 15.5], [-3, 12.8], [-4.8, 12.3]); }, front(p, S, sh) { ARM(p, S, [sh, 15.5], [3, 12.6], [3.5, 10.3]); ankh(p, 3.5, 10.1); } },
  // a god receiving: the was-sceptre in the forward hand, the ankh hanging from the other
  god: {
    back(p, S, sh, fy, seated) { if (seated) return; ARM(p, S, [-sh, 15.5], [-2.6, 12.3], [-2.3, 9.7]); ankh(p, -2.3, 9.5); },
    front(p, S, sh, fy, seated) { ARM(p, S, [sh, 15.5], [3.3, 13.1], [5.1, 13.3]); was(p, 5.2, fy, 19); if (seated) { ARM(p, S, [-sh, 15.5], [-1, 12.6], [1.9, 11.7]); ankh(p, 2.4, 12.2, 0.8); } },
  },
  goddess: {
    back(p, S, sh) { ARM(p, S, [-sh, 15.5], [-2.2, 12.3], [-1.9, 9.8]); ankh(p, -1.9, 9.6); },
    front(p, S, sh, fy) { ARM(p, S, [sh, 15.5], [2.9, 13.1], [4.6, 13.3]); papyrusSceptre(p, 4.7, fy, 18.6); },
  },
  // kneeling, the king holds out Maat: the small seated goddess with her feather
  maat: { front(p, S, sh) {
    ARM(p, S, [-sh, 15.5], [0.6, 13.1], [3.6, 14]); ARM(p, S, [sh, 15.5], [3.6, 13.4], [5.2, 14.1]);
    p.disc(4.6, 14.9, 0.55, 0.42, PIG.yellow); p.disc(5, 15.6, 0.28, 0.28, PIG.yellow); p.limb([4.85, 15.85], [4.65, 17], 0.22, 0.12, PIG.white);
  } },
  // the smiting king: the mace raised behind his head, the forward fist gripping the captives' hair
  smite: { back(p, S, sh) { ARM(p, S, [-sh, 15.5], [-3.9, 17.7], [-2.7, 20.4]); p.limb([-2.7, 20.4], [-4.5, 21.5], 0.3, 0.3, PIG.yellow); p.disc(-4.7, 21.65, 0.6, 0.5, PIG.white); },
    front(p, S, sh) { ARM(p, S, [sh, 15.5], [4.2, 13], [6, 10.6]); } },
  // Amun holding out the curved sword of victory to the king
  khepesh: { back(p, S, sh) { ARM(p, S, [-sh, 15.5], [-2.6, 12.3], [-2.3, 9.7]); ankh(p, -2.3, 9.5); },
    front(p, S, sh) { ARM(p, S, [sh, 15.5], [3.3, 13.6], [5.4, 14.3]); p.limb([5.4, 14.3], [6.6, 15.2], 0.25, 0.25, PIG.yellow); p.poly([[6.5, 15.1], [7.8, 16.6], [8.6, 16.4], [7.6, 15.6], [6.8, 14.9]], PIG.yellow); } },
  // captives: both arms raised, pleading
  plead: { front(p, S, sh) { ARM(p, S, [-sh, 15.5], [0.8, 16.4], [1.9, 18.6]); ARM(p, S, [sh, 15.5], [3.9, 16.8], [4.2, 19]); } },
};

/**
 * One figure: `who` = { skin, hat, beard, female, kilt, pose, seated, kneel, mummy, tail, captive }, drawn at
 * (cx, base) px, `g` px a square, facing `dir`.
 */
export function figure(o, cx, base, g, dir, who, al = 0.6) {
  const p = pen(o, cx, base, g, dir, al), S = who.skin, sh = who.female ? 1.95 : 2.4, pose = POSE[who.pose] || {};
  if (who.mummy) return mummy(p, who);
  // legs (and throne) in this pen; the upper body in `u`, lowered for seated and kneeling figures
  let u = p, fy = 0;
  if (who.seated) {
    u = p.sub(0, -4); fy = 4;
    p.poly([[-3.4, 0], [1, 0], [1, 5.8], [-3.4, 5.8]], PIG.yellow, { al: al * 0.8 });   // the block throne
    p.poly([[-3, 0.5], [-1.5, 0.5], [-1.5, 2], [-3, 2]], PIG.blue, { cut: 0.15 });
    for (let y = 3; y < 5.6; y += 0.7) p.limb([-3.2, y], [0.8, y], 0.25, 0.25, PIG.red, { cut: 0.06 });
    p.poly([[-3.4, 5.8], [-2.8, 5.8], [-2.8, 8.4], [-3.4, 8.2]], PIG.yellow);
    p.limb([-1.6, 6.6], [2.6, 6.6], 1.6, 1.4, S); p.limb([2.4, 6.4], [2.3, 0.7], 1.1, 0.75, S);
    p.poly([[1.6, 0], [4.5, 0], [4.4, 0.4], [2.9, 0.8], [1.9, 0.9]], S);
    u.poly([[-1.6, 11.2], [1.6, 11.2], [2.9, 11.4], [2.9, 9.8], [-1.6, 9.8]], PIG.white);   // the kilt over the lap
  } else if (who.kneel) {
    u = p.sub(0, -5.8); fy = 5.8;
    p.limb([-1, 4.2], [1.5, 0.9], 1.8, 1.2, S); p.poly([[-3, 0], [1.9, 0], [1.9, 1], [-1.8, 1.4], [-2.8, 1]], S);
    p.limb([0, 4.4], [2.8, 5.6], 1.6, 1.1, S); p.limb([2.8, 5.4], [2.6, 0.8], 1, 0.7, S); p.poly([[2, 0], [4.6, 0], [4.4, 0.4], [2.6, 0.9]], S);
  } else {
    p.poly(who.female ? LEG.rearF : LEG.rear, S); p.poly(who.female ? LEG.frontF : LEG.front, S);
  }
  pose.back?.(u, S, sh, fy, who.seated);
  if (who.tail) u.limb([-1.5, 10.9], [-2.4, who.seated ? 7 : 4], 0.35, 0.25, PIG.yellow);   // the bull's tail
  u.poly(who.female ? TORSO_F : TORSO, S);
  if (who.female) {
    u.disc(1.75, 13.9, 0.55, 0.5, S); u.dot(2.2, 13.8, PIG.black, 0.6);
    // the sheath dress, fine linen the legs show through, on its straps
    u.poly([[-1.5, 13.3], [1.6, 13.3], [1.35, 11], [1.5, 9], [2, fy + 1], [-2, fy + 1], [-1.6, 8], [-1.25, 11]], PIG.white, { al: al * 0.5, cut: 0.2 });
    u.limb([1.2, 13.3], [0.9, 16.1], 0.3, 0.3, PIG.white); u.limb([-1.2, 13.3], [-0.9, 16.1], 0.3, 0.3, PIG.white);
  } else if (!who.seated) {
    u.poly([[-1.55, 11], [1.6, 11], [1.75, 10], [2.5, 7.7], [-1.9, 8], [-1.75, 9.6]], PIG.white);   // the pleated kilt
    if (who.kilt === 'royal') u.poly([[0.3, 10.6], [1.7, 10.4], [2.5, 7.7], [1, 7.7]], PIG.yellow, { cut: 0.15 });   // the gold apron
    u.poly([[-1.45, 11.3], [1.55, 11.3], [1.55, 10.75], [-1.45, 10.75]], PIG.yellow, { cut: 0.12 });
  }
  if (!who.female) u.dot(2, 13.1, PIG.black, 0.5);
  if (who.straps) { u.limb([2.2, 15.8], [-0.3, 11.6], 0.3, 0.3, PIG.yellow, { cut: 0.1 }); u.limb([-2.2, 15.8], [0.8, 11.8], 0.3, 0.3, PIG.yellow, { cut: 0.1 }); }   // Amun's corselet
  if (!who.captive) collar(u, who.female ? 0.82 : 1);   // a captive wears no Egyptian collar
  if (who.hat === 'falcon') u.limb([-0.45, 16.1], [0.1, 16.95], 1.2, 1.1, S); else head(u, S, { ear: !['mut', 'asiatic'].includes(who.hat) });
  if (who.hat) HAT[who.hat](u);
  if (who.beard) u.poly(BEARD[who.beard], PIG.black, { al: al * 0.9 });
  pose.front?.(u, S, sh, fy, who.seated);
}
function mummy(p, who) {   // Khonsu: wrapped, the hands free at the breast holding crook, flail and a staff
  const S = who.skin;
  p.poly([[-1.7, 16], [1.8, 16], [1.9, 13.5], [1.4, 6], [1.7, 1], [2.9, 0.4], [2.9, 0], [-1.4, 0], [-1.3, 5], [-1.9, 11]], PIG.white);
  collar(p, 0.75);
  p.limb([2.6, 0.2], [2.6, 15], 0.35, 0.35, PIG.yellow);
  for (const y of [12.4, 12.9, 13.4]) p.limb([2.15, y], [3.05, y], 0.22, 0.22, PIG.blue, { cut: 0.1 });   // the djed's bars
  p.ring(2.6, 15.5, 0.38, 0.5, 0.17, PIG.yellow);
  p.disc(1.9, 13.4, 0.45, 0.4, S); p.disc(1.7, 12.6, 0.45, 0.4, S);
  p.limb([1.6, 13.5], [1.6, 16.6], 0.25, 0.25, PIG.blue); p.limb([1.6, 16.6], [1.1, 17], 0.25, 0.25, PIG.blue);   // the crook
  p.limb([1.4, 12.7], [0.4, 14.8], 0.2, 0.2, PIG.red); p.limb([1.4, 12.7], [0.1, 14.5], 0.2, 0.2, PIG.red);   // the flail
  head(p, S); HAT.khonsu(p); p.poly(BEARD.god, PIG.black, { al: p.al * 0.9 });
}

// the figures of a temple scene
const WHO = {
  king: { skin: SKIN.man, hat: 'blue', beard: 'king', kilt: 'royal', tail: true },
  amun: { skin: SKIN.amun, hat: 'amun', beard: 'god', straps: true, tail: true },
  mut: { skin: SKIN.woman, hat: 'mut', female: true },
  khonsu: { skin: SKIN.man, mummy: true },
  horakhty: { skin: SKIN.man, hat: 'falcon', tail: true },
};

// ── writing ──

// signs as small bitmaps facing right ('#' cut and painted); a flat sign is a short one, two stack in a cell
const GLYPH = {
  bird: ['.....##.', '....####', '....##..', '..####..', '.#####..', '######..', '..#..#..', '..#..#..'],
  owl: ['..###...', '.#.#.#..', '.#####..', '..####..', '..#####.', '..#####.', '...###..', '...#.#..'],
  man: ['...##...', '...##...', '..###...', '..####..', '..#.##..', '..###...', '..######', '..######'],
  ankh: ['..###...', '.#...#..', '.#...#..', '..###...', '#######.', '...#....', '...#....', '...#....'],
  reed: ['....##..', '...###..', '...##...', '..###...', '..##....', '..##....', '..#.....', '.##.....'],
  djed: ['.######.', '...##...', '.######.', '...##...', '.######.', '...##...', '...##...', '..####..'],
  neter: ['...####.', '...#....', '...###..', '...#....', '...#....', '...#....', '...#....', '..###...'],
  sun: ['..####..', '.#....#.', '#..##..#', '#..##..#', '.#....#.', '..####..'],
  water: ['#..#..#.', '.##.##.#'],
  mouth: ['.######.', '########', '.######.'],
  loaf: ['..####..', '.######.', '########'],
  viper: ['.#......', '#####...', '.#######'],
  basket: ['########', '.######.', '..####..'],
  arm: ['#.......', '#######.', '.######.'],
  house: ['########', '#......#', '#......#', '###..###'],
};
const GLYPH_COL = { bird: 'green', owl: 'yellow', man: 'red', ankh: 'blue', reed: 'green', djed: 'blue', neter: 'yellow', sun: 'red', water: 'blue', mouth: 'red', loaf: 'yellow', viper: 'yellow', basket: 'green', arm: 'red', house: 'blue' };
const TALL = ['bird', 'owl', 'man', 'ankh', 'reed', 'djed', 'neter', 'sun', 'reed', 'bird'], FLAT = ['water', 'mouth', 'loaf', 'viper', 'basket', 'arm', 'house', 'water'];
function glyph(o, x0, y0, cell, name, dir, al) {
  const rows = GLYPH[name], s = cell / 8, w = 8;
  const inside = (x, y) => { let c = Math.floor((x - x0) / s); const r = Math.floor((y - y0) / s); if (dir < 0) c = w - 1 - c; return rows[r]?.[c] === '#'; };
  relief(o, [x0, y0, x0 + cell, y0 + rows.length * s], inside, PIG[GLYPH_COL[name]], al, { cut: 0.26 });
  return rows.length * s;
}
/** A column of writing between ruled lines, from y0 to y1 px, its signs facing `dir`; a cartouche first if `cart`. */
export function caption(o, x, y0, y1, w, dir, rng, al = 0.55, { cart = false } = {}) {
  for (const xx of [x, x + w]) for (let y = Math.floor(y0); y < y1; y++) o.add(xx, y, -0.16);
  const cell = w * 0.8, gx = x + w * 0.1;
  let y = y0 + 1;
  if (cart && y1 - y > w * 2.6) { cartouche(o, x + w / 2, y, y + w * 2.1, w * 0.82, dir, rng, al); y += w * 2.3; }
  while (y + cell <= y1) {
    if (rng() < 0.4) {   // two flat signs stacked
      const a = FLAT[Math.floor(rng() * FLAT.length)], b = FLAT[Math.floor(rng() * FLAT.length)];
      const ha = glyph(o, gx, y, cell, a, dir, al); glyph(o, gx, y + ha + cell * 0.14, cell, b, dir, al);
    } else glyph(o, gx, y, cell, TALL[Math.floor(rng() * TALL.length)], dir, al);
    y += cell * 1.12;
  }
}
// the king's name in its ring, the sun disc (Ra) at the head of it
function cartouche(o, cx, y0, y1, w, dir, rng, al) {
  const cy = (y0 + y1) / 2, ry = (y1 - y0) / 2 - 1, rx = w / 2, a = ell(cx, cy, rx, ry), b = ell(cx, cy, rx - 1.3, ry - 1.3);
  relief(o, [cx - rx, y0, cx + rx, y1], (x, y) => a(x, y) && !b(x, y), PIG.blue, al);
  for (let x = Math.floor(cx - rx * 0.7); x <= cx + rx * 0.7; x++) for (const yy of [y1 - 1, y1]) o.add(x, yy, -0.3);
  const cell = w * 0.62; let y = y0 + 2.5;
  for (const name of ['sun', TALL[Math.floor(rng() * TALL.length)], FLAT[Math.floor(rng() * FLAT.length)]]) { if (y + cell > y1 - 2) break; y += glyph(o, cx - cell / 2, y, cell, name, dir, al) + 1; }
}
/** The vulture goddess hovering over the king, wings spread, the shen ring of eternity in her talons. */
export function vulture(o, cx, cy, span, dir, al = 0.55) {
  const h = span * 0.15, cols = [PIG.blue, PIG.red, PIG.green];
  for (let i = 0; i < 3; i++) {
    const t = cy + (i * h) / 3, b = cy + ((i + 1) * h) / 3, P = [[cx - span / 2, t], [cx, t - h * 0.45], [cx + span / 2, t], [cx + span * 0.47, b], [cx, b - h * 0.45], [cx - span * 0.47, b]];
    relief(o, [cx - span / 2, t - h, cx + span / 2, b], quad(P), cols[i], al, { cut: i ? 0.12 : 0.3 });
  }
  relief(o, [cx - h, cy - h, cx + h, cy + h * 1.6], ell(cx, cy + h * 0.4, span * 0.07, h * 0.9), PIG.blue, al);
  const hx = cx + dir * span * 0.1;
  relief(o, [hx - h, cy - h * 1.2, hx + h, cy + h * 0.4], ell(hx, cy - h * 0.35, span * 0.04, h * 0.45), PIG.skin, al);
  relief(o, [cx - h, cy + h, cx + h, cy + h * 2.4], (x, y) => ell(cx, cy + h * 1.75, h * 0.42, h * 0.42)(x, y) && !ell(cx, cy + h * 1.75, h * 0.24, h * 0.24)(x, y), PIG.yellow, al);
}
/** A tall offering stand heaped with loaves, meat, greens, a lotus. */
function offeringTable(p, x) {
  p.limb([x, 0], [x, 6.6], 0.6, 0.45, PIG.yellow); p.poly([[x - 1, 0], [x + 1, 0], [x + 0.4, 0.6], [x - 0.4, 0.6]], PIG.yellow);
  p.poly([[x - 2, 6.6], [x + 2, 6.6], [x + 1.8, 7.1], [x - 1.8, 7.1]], PIG.yellow);
  p.disc(x - 1.2, 7.6, 0.6, 0.45, PIG.yellow); p.disc(x, 7.7, 0.7, 0.5, PIG.red); p.disc(x + 1.2, 7.6, 0.6, 0.45, PIG.yellow);
  p.disc(x - 0.6, 8.5, 0.6, 0.4, PIG.green); p.disc(x + 0.7, 8.5, 0.55, 0.45, PIG.yellow);
  p.limb([x, 8.7], [x + 0.2, 10.4], 0.15, 0.15, PIG.green); p.poly([[x + 0.2, 10.3], [x - 0.5, 11.2], [x + 0.2, 10.9], [x + 0.9, 11.2]], PIG.blue);
}

// ── scenes: each `w` squares wide, the king on the left facing +x, the gods facing him ──
const SCENES = {
  wine: { w: 26, figs: [[3.4, 'king', 'offer'], [16, 'amun', 'god', -1], [21.6, 'mut', 'goddess', -1]], text: [[6, 10.4, 16.6, 1, true], [17.4, 19.8, 19, -1]], vulture: 3.6 },
  incense: { w: 28, figs: [[3.4, 'king', 'censer'], [19, 'amun', 'god', -1, { seated: true }], [24.6, 'khonsu', null, -1]], text: [[6.2, 12.2, 16.6, 1, true]], table: 8.4, vulture: 3.6 },
  table: { w: 25, figs: [[3.4, 'king', 'adore'], [16.6, 'amun', 'god', -1], [21.8, 'khonsu', null, -1]], text: [[5.8, 11, 19.6, 1, true]], table: 9.6, vulture: 3.2 },
  led: { w: 34, figs: [[3.4, 'king', 'led'], [13.8, 'horakhty', 'lead'], [26.4, 'amun', 'god', -1, { seated: true }], [31.4, 'mut', 'goddess', -1]], text: [[5.6, 11.4, 17.6, 1, true], [16.8, 20.6, 16.4, 1]], vulture: 3.4 },
  maat: { w: 20, figs: [[3.4, 'king', 'maat', 1, { kneel: true }], [15.6, 'amun', 'god', -1, { seated: true }]], text: [[0.8, 9.8, 16.6, 1, true]] },
};
const SCENE_ORDER = ['wine', 'incense', 'table', 'led', 'maat'];
function drawScene(o, x0, base, g, top, kind, rng, al) {
  const sc = SCENES[kind];
  if (sc.table) offeringTable(pen(o, x0, base, g, 1, al), sc.table);
  for (const [at, name, pose, dir = 1, extra = {}] of sc.figs) figure(o, x0 + at * g, base, g, dir, { ...WHO[name], pose, ...extra }, al);
  for (const [a, b, y, dir, cart] of sc.text) {
    const n = Math.max(1, Math.round((b - a) / 2.3)), cw = ((b - a) * g) / n;
    for (let i = 0; i < n; i++) caption(o, x0 + a * g + i * cw, top, base - y * g, cw, dir, rng, al * 0.95, { cart: cart && i === 0 });
  }
  if (sc.vulture) vulture(o, x0 + (sc.vulture + 1) * g, base - 24.6 * g, 6 * g, 1, al);
}

/**
 * A register of temple scenes across a wall tile `W` px wide (it wraps): scenes picked from the
 * repertory, no two alike side by side, spread to fill the width exactly; on a ground line at `base`,
 * under a border at `top`.
 */
export function sceneRegister(o, rng, { base, top, al = 0.6 }) {
  const g = (base - top) / 26.8, total = o.W / g, picks = [];
  let used = 0;
  for (let t = 0; t < 40; t++) {
    const left = SCENE_ORDER.filter((k) => k !== picks.at(-1) && k !== picks[0] && used + SCENES[k].w <= total - 1);
    if (!left.length) break;
    const k = left[Math.floor(rng() * left.length)]; picks.push(k); used += SCENES[k].w;
  }
  const gap = (total - used) / picks.length;
  let x = gap / 2;
  for (const k of picks) { drawScene(o, x * g, base, g, top, k, rng, al); x += SCENES[k].w + gap; }
}

/**
 * A pylon tower's colossal scene: the king, many times a man's height, smiting a knot of foreign
 * captives (a Nubian, an Asiatic, a Libyan) whom he grips by the hair, before Amun, who holds out the
 * curved sword of victory; the vulture over the king; columns of text above.
 */
export function smitingScene(o, rng, { base, textTop, al = 0.6 }) {
  const g = (base - textTop) / 26.5, x0 = o.W * 0.5 - 20 * g;
  vulture(o, x0 + 11 * g, base - 25 * g, 6.5 * g, 1, al);
  figure(o, x0 + 11 * g, base, g, 1, { ...WHO.king, pose: 'smite' }, al);
  const caps = [['nubian', SKIN.nubian], ['asiatic', SKIN.asiatic], ['libyan', SKIN.libyan], ['nubian', SKIN.nubian], ['asiatic', SKIN.asiatic]];
  caps.forEach(([hat, skin], i) => figure(o, x0 + (17.4 + i * 1.7) * g, base - (i % 2) * 1.4 * g, g * 0.8, -1, { skin, hat, pose: 'plead', kneel: true, captive: true }, al * 0.95));
  figure(o, x0 + 33 * g, base, g, -1, { ...WHO.amun, pose: 'khepesh' }, al);
  const cw = 2.4 * g;
  for (let i = 0; i < 4; i++) caption(o, x0 + 19.6 * g + i * cw, textTop - 0.5 * g, base - 17.2 * g, cw, i < 2 ? 1 : -1, rng, al * 0.95, { cart: i === 0 });
}

/** A column shaft's scene, small, low on the drum: the king offering wine to Amun. */
export function columnScene(o, rng, { base, top, al = 0.55 }) {
  const g = (base - top) / 26.5, x0 = o.W / 2 - 9.5 * g;
  figure(o, x0 + 3.4 * g, base, g, 1, { ...WHO.king, pose: 'offer' }, al);
  figure(o, x0 + 15.6 * g, base, g, -1, { ...WHO.amun, pose: 'god' }, al);
  caption(o, x0 + 6.4 * g, top, base - 16.6 * g, 2.6 * g, 1, rng, al, { cart: true });
}
