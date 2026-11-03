/**
 * coats — a mount's coat as data: the base colour, the points (the lower legs, the mane, the tail, the ear's rim), the
 * hooves, the muzzle, and the markings. A new coat is a card; a new marking is a rule. The genetics are the record's
 * (the base colours black and chestnut; bay restricting black to the points; the dilutions and grey over them), kept to
 * their look here, not their inheritance.
 *
 *   COATS     { <word>: { body, points, mane, hoof, muzzle, line? } }
 *   MARKINGS  { star, blaze, snip, sock, stocking } as rules on a vertex's part and place
 *   coatColor(coat, part, p, { markings, stand }) → '#rrggbb'
 */
export const COATS = Object.freeze({
  bay: { body: '#7b4a2a', points: '#1e1714', mane: '#17110e', hoof: '#3a322d', muzzle: '#4a3020', note: 'a brown body, black points' },
  chestnut: { body: '#9a4f25', points: '#8a4520', mane: '#a2552a', hoof: '#6b5a48', muzzle: '#7a4224', note: 'red throughout, no black points' },
  black: { body: '#1d1a19', points: '#151312', mane: '#100e0d', hoof: '#2a2624', muzzle: '#252120', note: 'black throughout' },
  grey: { body: '#b9b6b1', points: '#8f8b86', mane: '#d6d3ce', hoof: '#4a4440', muzzle: '#5a5550', note: 'whitening with age over dark skin' },
  palomino: { body: '#d2a35c', points: '#c8954e', mane: '#efe3c6', hoof: '#6b5a48', muzzle: '#9a7346', note: 'a gold body, a flaxen mane and tail' },
  buckskin: { body: '#c9a063', points: '#1e1714', mane: '#17110e', hoof: '#3a322d', muzzle: '#6a4d30', note: 'a tan body, black points' },
});

/**
 * Markings: each a test on a vertex's part and place (`p` world at the stand, `ctx.stand` the stand's points/bones).
 * White, on the face's front (star, blaze, snip) or the legs from the hoof up (sock to the fetlock, stocking to the knee).
 */
export const MARKINGS = Object.freeze({
  star: (part, p, c) => part !== 'eye' && faceFront(p, c) && faceAlong(p, c) < 0.3,
  blaze: (part, p, c) => part !== 'eye' && faceFront(p, c) && faceAlong(p, c) < 0.95,
  snip: (part, p, c) => part === 'muzzle' && faceFront(p, c),
  sock: (part, p, c, leg) => part !== 'hoof' && onLeg(p, c, leg) && p[2] < c.fetlock(leg) + 0.03,
  stocking: (part, p, c, leg) => part !== 'hoof' && onLeg(p, c, leg) && p[2] < c.knee(leg),
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function faceFront(p, c) {
  const h = c.bones.head, d = sub(h.tail, h.head), L = Math.hypot(...d), u = d.map((x) => x / L), q = sub(p, h.head);
  const up = [0, -u[2], u[1]];                                     // the face's front: up out of the head's mid-plane
  return Math.abs(p[0]) < 0.035 && dot(q, up) > 0;
}
const faceAlong = (p, c) => { const h = c.bones.head, d = sub(h.tail, h.head), L2 = dot(d, d); return dot(sub(p, h.head), d) / L2; };
const onLeg = (p, c, leg) => { const hoof = c.bones[`hoof${leg[1]}${leg[0]}`]; return Math.abs(p[0] - hoof.tail[0]) < 0.12 && Math.abs(p[1] - hoof.tail[1]) < 0.25; };

/** the colour of a vertex: its part's in the coat, white where a marking holds */
export function coatColor(coat, part, p, { markings = {}, stand } = {}) {
  const C = typeof coat === 'string' ? COATS[coat] : coat;
  if (stand && markings) {
    const ctx = {
      bones: stand.bones,
      fetlock: (leg) => stand.bones[`cannon${leg[1]}${leg[0]}`].tail[2],
      knee: (leg) => stand.bones[`cannon${leg[1]}${leg[0]}`].head[2],
    };
    for (const [m, legs] of Object.entries(markings)) {
      if (!MARKINGS[m]) continue;
      if (Array.isArray(legs)) { for (const leg of legs) if (MARKINGS[m](part, p, ctx, leg)) return '#f2efe8'; }
      else if (legs && MARKINGS[m](part, p, ctx)) return '#f2efe8';
    }
  }
  switch (part) {
    case 'points': return C.points;
    case 'mane': case 'tail': return C.mane;
    case 'hoof': return C.hoof;
    case 'muzzle': return C.muzzle;
    case 'eye': return '#0d0b0a';
    case 'ear': return C.points === C.body ? C.body : C.points;
    default: return C.body;
  }
}
