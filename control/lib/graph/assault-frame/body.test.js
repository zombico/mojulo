// The assault frame's body (body.js), its clips (clips.js) and its figure (figure.js): one case per concept, the
// builds picked from the stock by what they exercise (a light frame, a heavy one, a headless fuselage on reverse-joint
// legs, a biped with a head, a shoulder left empty), never the whole catalogue.
import { describe, it, expect } from 'vitest';
import { frameBody, FRAME_SLOTS, frameFaceCount } from './body.js';
import { frameClips, posedBones, placeOn } from './clips.js';
import { frameFigure } from './figure.js';
import { STOCK, partOf } from './parts.js';

const stockBy = (cls) => Object.keys(STOCK).find((k) => partOf('legs', STOCK[k].legs).class === cls);
const stockWhere = (fn) => Object.keys(STOCK).find((k) => fn(STOCK[k]));
const corners = (body) => [...body.faces.values()].flatMap((fs) => fs.flatMap((f) => f.corners));
const medium = frameBody(stockBy('medium'));
// (a headless core on reverse-joint legs, and a biped carrying a head)
const reverse = frameBody(stockWhere((b) => partOf('legs', b.legs).joint === 'reverse' && partOf('core', b.core).headless));
const biped = frameBody(stockWhere((b) => !partOf('legs', b.legs).joint && b.head));
/** How far a knee stands ahead of (+) or behind (−) the line from its hip to its ankle. */
const kneeAhead = (hip, knee, ankle) => {
  const u = [ankle[0] - hip[0], ankle[1] - hip[1], ankle[2] - hip[2]], l = Math.hypot(...u), d = [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]];
  const t = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (l * l);
  return knee[1] - (hip[1] + u[1] * t);
};

describe('the assault frame\'s body', () => {
  it('stands on its soles at z = 0, a frame of seven to ten metres, its hips the legs\' height', () => {
    const zs = corners(medium).map((c) => c[2]);
    expect(Math.min(...zs)).toBeCloseTo(0, 3);
    // (a crouched reverse-joint frame stands lowest)
    expect(medium.height).toBeGreaterThan(7);
    expect(medium.height).toBeLessThan(12);
    expect(medium.hips).toBe(partOf('legs', medium.build.legs).height);
    expect(medium.bones.find((b) => b.id === 'root').head[2]).toBeCloseTo(medium.hips, 6);
  });

  it('puts faces on every bone, each face in one of the material slots, planar and wound out', () => {
    for (const { id } of medium.bones) expect(medium.faces.get(id)?.length, id).toBeGreaterThan(0);
    expect([...medium.faces.keys()].sort()).toEqual(medium.bones.map((b) => b.id).sort());
    for (const fs of medium.faces.values()) for (const f of fs) {
      expect(FRAME_SLOTS).toContain(f.material);
      expect(f.albedo).toMatch(/^#[0-9a-f]{6}$/);
      expect(f.fill).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.hypot(...f.outNormal)).toBeCloseTo(1, 3);
      // (every corner in the face's plane, within a chamfer's warp)
      const p0 = f.corners[0], d = (c) => (c[0] - p0[0]) * f.outNormal[0] + (c[1] - p0[1]) * f.outNormal[1] + (c[2] - p0[2]) * f.outNormal[2];
      for (const c of f.corners) expect(Math.abs(d(c))).toBeLessThan(0.02);
    }
    // (a live page's budget)
    expect(frameFaceCount(medium)).toBeLessThan(9000);
  });

  it('has a muzzle for each armed slot and none, nor its bone, for an empty one', () => {
    const armed = Object.keys(medium.mounts).sort();
    expect(armed).toEqual(['armL', 'armR', 'backL', 'backR'].filter((s) => medium.build[s]).sort());
    for (const m of Object.values(medium.mounts)) { expect(m.dir).toEqual([0, 1, 0]); expect(medium.bones.some((b) => b.id === m.bone)).toBe(true); }
    // (a muzzle ahead of the hand that holds it)
    expect(medium.mounts.armR.at[1]).toBeGreaterThan(medium.bones.find((b) => b.id === 'armLowR').head[1]);
    const bare = frameBody({ from: stockBy('medium'), backL: null });
    expect(bare.mounts.backL).toBeUndefined();
    expect(bare.bones.some((b) => b.id === 'backL')).toBe(false);
    expect(bare.mounts.backR).toBeDefined();
  });

  it('points its booster\'s bells back and down, and carries verniers on its shins', () => {
    const main = medium.thrusters.filter((t) => t.kind === 'main');
    expect(main.length).toBeGreaterThan(0);
    for (const t of medium.thrusters) expect(Math.hypot(...t.dir)).toBeCloseTo(1, 3);
    for (const t of main) { expect(t.bone).toBe('booster'); expect(t.dir[1]).toBeLessThan(-0.5); expect(t.dir[2]).toBeLessThan(0); }
    expect(medium.thrusters.some((t) => t.kind === 'vernier' && t.bone === 'shinR')).toBe(true);
    expect(medium.thrusters.some((t) => t.kind === 'vernier' && t.bone === 'shinL')).toBe(true);
  });

  it('drops the head bone with the head: a headless fuselage has none, a frame with a head keeps it', () => {
    expect(reverse.build.head).toBeNull();
    expect(reverse.bones.some((b) => b.id === 'head')).toBe(false);
    expect(reverse.faces.has('head')).toBe(false);
    expect(biped.bones.some((b) => b.id === 'head')).toBe(true);
    // (its guns and its shoulder weapons all still carried)
    expect(Object.keys(reverse.mounts).sort()).toEqual(['armL', 'armR', 'backL', 'backR'].filter((s) => reverse.build[s]).sort());
    // (its cockpit ahead of its shoulders: the fuselage's glass forward of the arms' pivots)
    const glass = reverse.faces.get('core').filter((f) => f.material === 'lens').flatMap((f) => f.corners);
    expect(Math.max(...glass.map((c) => c[1]))).toBeGreaterThan(reverse.bones.find((b) => b.id === 'armUpR').head[1] + 1);
  });

  it('bends a reverse joint\'s knee back behind the hip-to-ankle line, a biped\'s ahead of it', () => {
    const L = (b) => b.rig.legs;
    expect(L(reverse).joint).toBe('reverse');
    // (its crouched stance: the rest hip where the legs' row says it stands, the ankle raked ahead of it)
    expect(Math.abs(L(reverse).hip[2] - partOf('legs', reverse.build.legs).height)).toBeLessThan(0.2);
    expect(L(reverse).ankle[1]).toBeGreaterThan(L(reverse).hip[1] + 0.2);
    expect(kneeAhead(L(reverse).hip, L(reverse).knee, L(reverse).ankle)).toBeLessThan(-0.5);
    expect(kneeAhead(L(biped).hip, L(biped).knee, L(biped).ankle)).toBeGreaterThan(0.2);
  });

  it('draws a light frame leaner than a heavy one', () => {
    const light = frameBody(stockBy('light')), heavy = frameBody(stockBy('heavy'));
    expect(heavy.footprint.W).toBeGreaterThan(light.footprint.W);
    const sole = (b) => { const zs = b.faces.get('footR').flatMap((f) => f.corners).filter((c) => c[2] < 0.02); return Math.max(...zs.map((c) => c[0])) - Math.min(...zs.map((c) => c[0])); };
    expect(sole(heavy)).toBeGreaterThan(sole(light));
  });
});

describe('the assault frame\'s clips', () => {
  const clips = frameClips(medium), n = medium.bones.length;
  const rest = Object.fromEntries(medium.bones.map((b) => [b.id, b.head]));

  it('names the clips the game selects, each packed per key and bone in unit turns; the landing once', () => {
    expect(Object.keys(clips).sort()).toEqual(['boost', 'boost_back', 'boost_left', 'boost_right', 'fall', 'forward', 'hover', 'idle', 'land']);
    expect(clips.idle.k).toBe(1);
    expect(clips.forward.k).toBe(8);
    expect(clips.land).toMatchObject({ k: 6, once: true });
    for (const [name, c] of Object.entries(clips)) {
      expect(c.b.length, name).toBe(c.k * n * 7);
      for (let i = 0; i < c.b.length; i += 7) expect(Math.hypot(c.b[i], c.b[i + 1], c.b[i + 2], c.b[i + 3])).toBeCloseTo(1, 3);
      if (name !== 'land') expect(c.once).toBeUndefined();
    }
  });

  it('keeps each chain joined: the knee where the thigh carries it, the elbow where the upper arm does', () => {
    for (const [name, c] of Object.entries(clips)) for (let k = 0; k < c.k; k++) {
      const P = posedBones(medium, c, k);
      for (const [a, b] of [['thighR', 'shinR'], ['shinL', 'footL'], ['armUpR', 'armLowR'], ['core', 'booster']]) {
        const at = placeOn(rest[a], P.get(a), rest[b]), want = P.get(b).head;
        for (let i = 0; i < 3; i++) expect(Math.abs(at[i] - want[i]), `${name}[${k}] ${a}→${b}`).toBeLessThan(0.01);
      }
    }
  });

  it('holds the guns level and forward in every clip, and plants the walk\'s standing foot', () => {
    for (const c of Object.values(clips)) for (let k = 0; k < c.k; k++) {
      const q = posedBones(medium, c, k).get('armLowR').q;
      const fwd = placeOn([0, 0, 0], { q, head: [0, 0, 0] }, [0, 1, 0]);
      expect(Math.abs(fwd[2])).toBeLessThan(0.02);
      expect(fwd[1]).toBeGreaterThan(0.95);
    }
    // (key 0: the right foot down ahead, at the ankle's height over the ground)
    expect(posedBones(medium, clips.forward, 0).get('footR').head[2]).toBeCloseTo(rest.footR[2], 2);
    // (airborne: the feet tucked up off the ground)
    expect(posedBones(medium, clips.hover, 0).get('footR').head[2]).toBeGreaterThan(rest.footR[2] + 0.5);
  });

  it('keeps a reverse joint\'s knee bent back in every clip, and the head out of a headless frame\'s', () => {
    const C = frameClips(reverse), R = Object.fromEntries(reverse.bones.map((b) => [b.id, b.head]));
    for (const [name, c] of Object.entries(C)) {
      expect(c.b.length, name).toBe(c.k * reverse.bones.length * 7);
      for (let k = 0; k < c.k; k++) {
        const P = posedBones(reverse, c, k);
        for (const s of ['R', 'L']) {
          const hip = P.get(`thigh${s}`).head, knee = P.get(`shin${s}`).head, ankle = P.get(`foot${s}`).head;
          // (the knee behind the line, in the pelvis's own lean: measured square to its forward)
          expect(kneeAhead(hip, knee, ankle), `${name}[${k}] ${s}`).toBeLessThan(-0.2);
          const at = placeOn(R[`thigh${s}`], P.get(`thigh${s}`), R[`shin${s}`]);
          for (let i = 0; i < 3; i++) expect(Math.abs(at[i] - knee[i])).toBeLessThan(0.01);
        }
      }
    }
  });
});

describe('the assault frame\'s figure', () => {
  it('is the same figure from the same spec, in the form render, with the page\'s thrusters and the frame\'s readout', () => {
    const spec = { build: stockBy('light'), palette: 'mars', wear: 'battered' };
    const a = frameFigure(spec), b = frameFigure(spec);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toMatchObject({ rig: true, facing: '+y', yaw: -Math.PI / 2 });
    expect(a.parts.every((p) => p && p.form)).toBe(true);
    expect(a.form.materials.chrome).toMatchObject({ metalness: 1 });
    expect(a.form.materials.glow.emissive).toMatch(/^#[0-9a-f]{6}$/);
    // (each a burning mouth on a bone it has: the page's drive or the frame's own layered flame)
    expect(a.thrusters.every((t) => ['drive', 'flame'].includes(t.kind) && a.bones.some((bn) => bn.id === t.bone))).toBe(true);
    expect(a.frame).toMatchObject({ hips: partOf('legs', STOCK[spec.build].legs).height, palette: 'mars', wear: 'battered' });
    expect(Object.keys(a.clips)).toContain('hover');
  });

  it('refuses a word it has not, teaching', () => {
    expect(() => frameFigure({ build: 'vanguard', palette: 'tartan' })).toThrow(/palette is one of/);
    expect(() => frameFigure({ build: 'vanguard', colour: 'red' })).toThrow(/not a frame's word/);
  });
});
