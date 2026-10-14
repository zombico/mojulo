import { describe, it, expect } from 'vitest';
import { normalizeShoot, lowerShoot } from './plan.js';
import { compileCamera, cameraAt } from './sample.js';
import { posePiece, cameraBasis } from './pieces.js';
import { transitionPieces } from './transitions.js';

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// rotate local axis v by quaternion q [x,y,z,w]
const qrot = ([x, y, z, w], v) => {
  const u = [x, y, z], uv = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
  const uuv = [y * uv[2] - z * uv[1], z * uv[0] - x * uv[2], x * uv[1] - y * uv[0]];
  return [v[0] + 2 * (w * uv[0] + uuv[0]), v[1] + 2 * (w * uv[1] + uuv[1]), v[2] + 2 * (w * uv[2] + uuv[2])];
};

const TWO = {
  cameras: [
    { id: 'a', keys: [{ t: 0, pos: [0, -10, 2], poi: [0, 0, 2] }, { t: 4, pos: [10, -10, 2], poi: [10, 0, 2] }] },
    { id: 'b', keys: [{ t: 0, pos: [20, 0, 3], poi: [0, 0, 0] }] },
  ],
  shots: [{ name: 'one', camera: 'a', span: [0, 4] }, { name: 'two', camera: 'b', span: [0, 3] }],
};

describe('set pieces', () => {
  it('a piece riding a camera keeps its place in the camera frame as the camera moves', () => {
    const { plan } = normalizeShoot({ ...TWO, pieces: [{ id: 'w', kind: 'wall', attach: 'a', keys: [{ t: 0, at: [3, 0.5, 0] }] }] });
    const cam = compileCamera(plan.cameras[0]);
    for (const t of [0, 1.3, 4]) {
      const c = cameraAt(cam, t), b = cameraBasis(c), s = posePiece(plan.pieces[0], t, cam);
      const rel = [s.pos[0] - c.pos[0], s.pos[1] - c.pos[1], s.pos[2] - c.pos[2]];
      expect(dot(rel, b.f)).toBeCloseTo(3, 9);
      expect(dot(rel, b.l)).toBeCloseTo(0.5, 9);
      expect(dist(qrot(s.quat, [1, 0, 0]), b.f)).toBeLessThan(1e-9);   // its forward is the lens's
    }
  });

  it('a world piece turns from the world axes; keyed values ease like camera keys', () => {
    const { plan } = normalizeShoot({ ...TWO, pieces: [{ kind: 'floor', keys: [{ t: 0, at: [0, 0, 0], rot: [90, 0, 0], opacity: 0, ease: 'easy ease' }, { t: 2, at: [4, 0, 0], opacity: 1, ease: 'easy ease' }] }] });
    const p = plan.pieces[0];
    expect(p.attach).toBe('world');
    expect(dist(qrot(posePiece(p, 0).quat, [1, 0, 0]), [0, 1, 0])).toBeLessThan(1e-9);   // yaw 90: forward → +y
    expect(posePiece(p, 1).pos[0]).toBeCloseTo(2, 6);
    expect(posePiece(p, 0.1).opacity).toBeLessThan(0.05);                                  // eased out of its first key
  });

  it('a camera roll banks the frame clockwise: up swings to frame right', () => {
    const b = cameraBasis({ pos: [0, 0, 0], look: [1, 0, 0], roll: 90 });
    expect(dist(b.u, [0, -1, 0])).toBeLessThan(1e-9);   // looking +x, frame right is −y
  });

  it('pieces of one camera stay out of another camera\'s shots', () => {
    const { plan } = normalizeShoot({ ...TWO, pieces: [{ id: 'w', kind: 'wall', attach: 'a' }, { id: 'g', kind: 'floor' }] });
    const low = lowerShoot(plan);
    expect(low.pieces.find((p) => p.id === 'w').shots).toEqual([0]);
    expect(low.pieces.find((p) => p.id === 'g').shots).toEqual([0, 1]);
    expect(normalizeShoot(plan).plan).toEqual(plan);   // idempotent with pieces
  });
});

describe('transitions are pieces', () => {
  const at = (type, extra = {}) => normalizeShoot({ ...TWO, shots: [TWO.shots[0], { ...TWO.shots[1], in: { type, duration: 1, ...extra } }] }).plan;

  it('fade: the outgoing camera goes to black over its last half second, the incoming comes back over its first', () => {
    const plan = at('fade');
    expect(plan.shots[1].in).toEqual({ type: 'fade', duration: 1 });
    const pieces = normalizeShoot({ ...plan, pieces: transitionPieces(plan) }).plan.pieces;
    const [out, inn] = pieces;
    expect([out.attach, inn.attach]).toEqual(['a', 'b']);
    expect(out.keys.map((k) => [k.t, k.opacity])).toEqual([[3.5, 0], [4, 1]]);
    expect(inn.keys.map((k) => [k.t, k.opacity])).toEqual([[0, 1], [0.5, 0]]);
    // the flat covers the frame at the lens's field of view
    const h = cameraAt(compileCamera(plan.cameras[0]), 4).hfov;
    expect(out.size[0]).toBeGreaterThan(2 * out.keys[0].at[0] * Math.tan(h * Math.PI / 360));
  });

  it('wipe: on the lens at the cut, off the far side after it', () => {
    const [out, inn] = normalizeShoot({ ...at('wipe'), pieces: transitionPieces(at('wipe')) }).plan.pieces;
    expect(out.keys[1].at[1]).toBe(0);
    expect(out.keys[0].at[1]).toBeGreaterThan(0);   // entered from frame left
    expect(inn.keys[1].at[1]).toBeLessThan(0);      // left by frame right
  });

  it('pipe: the camera ends the outgoing shot inside the tube, and starts the next inside one', () => {
    const [out, inn] = normalizeShoot({ ...at('pipe'), pieces: transitionPieces(at('pipe')) }).plan.pieces;
    expect(Math.abs(out.keys[1].at[0])).toBeLessThan(out.length / 2);
    expect(Math.abs(inn.keys[0].at[0])).toBeLessThan(inn.length / 2);
    expect(inn.keys[1].at[0] + inn.length / 2).toBeLessThan(0);   // its open mouth has passed behind the lens
  });

  it('the first shot plays only its incoming half; lowering carries the expanded pieces', () => {
    const plan = normalizeShoot({ ...TWO, shots: [{ ...TWO.shots[0], in: 'iris' }, TWO.shots[1]] }).plan;
    const low = lowerShoot(plan);
    expect(low.pieces.map((p) => [p.kind, p.shots])).toEqual([['frame', [0]]]);
    expect(low.pieces[0].track.t1).toBeCloseTo(0.4, 6);
  });
});

describe('pieces swept along a camera path: the round pipe and the box', () => {
  // a camera that turns a corner: east 10, then north 10
  const BEND = { cameras: [{ id: 'c', path: 'linear', keys: [
    { t: 0, pos: [0, 0, 2], poi: [10, 0, 2] }, { t: 2, pos: [10, 0, 2], poi: [10, 10, 2] }, { t: 4, pos: [10, 10, 2], poi: [10, 20, 2] },
  ] }] };

  it('a pipe along a camera runs through every place the camera passes, and on past the ends', () => {
    const { plan } = normalizeShoot({ ...BEND, pieces: [{ id: 'tube', kind: 'pipe', along: 'c', radius: 1, extend: [0, 3], cap: 'far' }] });
    const tube = lowerShoot(plan).pieces[0];
    expect(tube.path[0]).toEqual([0, 0, 2]);
    expect(tube.path.at(-1)).toEqual([10, 13, 2]);   // 3 past the last key, straight on
    const near = (q) => Math.min(...tube.path.map((p) => dist(p, q)));
    for (const t of [0.7, 2, 3.3]) expect(near(cameraAt(compileCamera(plan.cameras[0]), t).pos)).toBeLessThan(0.2);
    expect(tube.rings).toBeGreaterThan(4);
    expect(tube.track.pos.slice(0, 3)).toEqual([0, 0, 0]);   // world geometry: the path is the place, the pose stays home
  });

  it('a wall along a path is the box pipe with its sides; the box stays level round the corner', () => {
    const { plan } = normalizeShoot({ ...BEND, pieces: [{ id: 'walls', kind: 'wall', along: 'c', side: 'both', size: [4, 3] }, { id: 'deck', kind: 'floor', along: 'c' }] });
    expect(plan.pieces.map((p) => [p.kind, p.profile, p.sides])).toEqual([['pipe', 'box', ['left', 'right']], ['pipe', 'box', ['floor']]]);
    expect(normalizeShoot(plan).plan).toEqual(plan);
    const walls = lowerShoot(plan).pieces[0];
    walls.rails.right.forEach((r, i) => {
      expect(r[2]).toBeCloseTo(0, 6);                              // level
      expect(Math.hypot(...walls.rails.up[i])).toBeCloseTo(1, 3);
    });
    expect(walls.rails.right[0]).toEqual([0, -1, 0]);              // heading east, right is south
    expect(walls.rails.right.at(-1)).toEqual([1, 0, 0]);           // heading north, right is east
  });

  it('the pipe transition lays its tube along a camera that travels, on the lens of one that does not', () => {
    const plan = normalizeShoot({ cameras: [BEND.cameras[0], { id: 'still', keys: [{ t: 0, pos: [0, 0, 1], poi: [5, 0, 1] }] }],
      shots: [{ name: 'go', camera: 'c', span: [0, 4] }, { name: 'stop', camera: 'still', span: [0, 2], in: { type: 'pipe', duration: 2, profile: 'box' } }] }).plan;
    const [out, inn] = normalizeShoot({ ...plan, pieces: transitionPieces(plan) }).plan.pieces;
    expect([out.along, out.profile, out.cap]).toEqual(['c', 'box', 'far']);
    expect(inn.along).toBeUndefined();
    expect(inn.attach).toBe('still');
  });
});

describe('portals: a frame whose hole looks out of another camera', () => {
  it('a portal into a shot looks out of that shot\'s camera at its first instant, every frame', () => {
    const { plan } = normalizeShoot({ ...TWO, pieces: [{ id: 'door', kind: 'frame', shape: 'square', size: [2, 1.6], border: 0.1, portal: 'two', shots: ['one'], keys: [{ t: 0, at: [5, -5, 2] }] }] });
    expect(plan.pieces[0].portal).toEqual({ shot: 'two' });
    const door = lowerShoot(plan).pieces[0];
    const b = cameraBasis(cameraAt(compileCamera(plan.cameras[1]), 0));
    expect(door.portal.pos.slice(0, 3)).toEqual(b.pos);
    expect(door.portal.pos.slice(-3)).toEqual(b.pos);       // a fixed instant: the same far camera at every frame
    expect(door.portal.pos).toHaveLength(door.track.n * 3);
  });

  it('a live portal follows its camera through time; one into nothing is dropped with a warning', () => {
    const { plan } = normalizeShoot({ ...TWO, pieces: [{ id: 'live', kind: 'frame', portal: { camera: 'a' } }, { id: 'nowhere', kind: 'frame', portal: 'three' }] });
    const [live, nowhere] = lowerShoot(plan).pieces;
    expect(live.portal.pos.slice(0, 3)).not.toEqual(live.portal.pos.slice(-3));   // camera a moves
    expect(nowhere.portal).toBeUndefined();
    expect(normalizeShoot({ ...TWO, pieces: [{ kind: 'frame', portal: 'three' }] }).warnings.some((w) => /shot 'three'/.test(w))).toBe(true);
  });

  it('the portal transition stands a door where a travelling camera will be at the cut, looking into the next shot', () => {
    const plan = normalizeShoot({ ...TWO, shots: [TWO.shots[0], { ...TWO.shots[1], in: { type: 'portal', duration: 2 } }] }).plan;
    const pieces = normalizeShoot({ ...plan, pieces: transitionPieces(plan) }).plan.pieces;
    expect(pieces).toHaveLength(1);                         // all on the outgoing side
    const [door] = pieces;
    expect([door.attach, door.kind, door.portal]).toEqual(['world', 'frame', { shot: 'two' }]);
    expect(door.keys[0].t).toBe(2);                         // the whole duration before the cut
    const cut = cameraAt(compileCamera(plan.cameras[0]), 4);
    expect(dist(door.keys[0].at, cut.pos)).toBeCloseTo(0.25, 6);   // just past the lens at the cut
  });
});

describe('cued shots: a shot that plays when an event fires', () => {
  const CUED = { ...TWO, shots: [...TWO.shots, { name: 'goal', camera: 'b', span: [0, 2], on: ['goal:*'], in: 'fade' }] };

  it('reads `on` as the cue and leaves the shot out of the running order', () => {
    const { plan } = normalizeShoot(CUED);
    expect(plan.shots[2].cue).toEqual(['goal:*']);
    expect(normalizeShoot(plan).plan).toEqual(plan);
    const low = lowerShoot(plan);
    expect(low.total).toBe(7);                                 // 4 + 3: the cued shot adds nothing
    expect(low.shots.map((s) => s.name)).toEqual(['one', 'two']);
    expect(low.cues).toEqual([{ i: 2, name: 'goal', camera: 'b', on: ['goal:*'], length: 2, span: [0, 2] }]);
  });

  it('its transition plays only its incoming half, scoped to it by its index after the running order', () => {
    const low = lowerShoot(normalizeShoot(CUED).plan);
    expect(low.pieces.map((p) => [p.kind, p.shots])).toEqual([['wall', [2]]]);
  });

  it('every shot cued: the first camera holds the running order until one fires', () => {
    const { plan, warnings } = normalizeShoot({ ...TWO, shots: [{ name: 'only', camera: 'b', span: [0, 1], on: 'door:*' }] });
    expect(plan.shots.map((s) => [s.name, !!s.cue])).toEqual([['a', false], ['only', true]]);
    expect(warnings.some((w) => /waits for an event/.test(w))).toBe(true);
  });
});
