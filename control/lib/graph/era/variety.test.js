import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry } from './stage.js';
import { placeThings, DOODAD_KINDS } from './props.js';
import { cryptTomb, ivyGrowth, accentWall } from './crypt.js';
import { normalizeTileSpec, tileFamilyOf } from './tile-specs.js';
import { surfaceTexture, BRICK_BONDS, FRIEZE_PATTERNS } from '../landscape/surface-textures.js';
import { resolveFire } from '../fire/fire.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { starter } from './entries.js';
import { DMC3_STUDY } from './stage.test.js';

const CRYPT = { ...DMC3_STUDY, reference: 'gothic-night' };
const B = { gen: 'stone-brick', stone: [150, 128, 104], mortar: [70, 60, 50], rows: 6, cols: 4 };

describe('variety: bonds, cells and bands are tiles of their own', () => {
  it('every bond paints its own tile; the running bond, asked for by name, is the old tile byte for byte', () => {
    const tiles = BRICK_BONDS.map((bond) => surfaceTexture(`${tileFamilyOf({ ...B, bond })}-a`));
    expect(new Set(tiles).size).toBe(BRICK_BONDS.length);
    expect(surfaceTexture(`${tileFamilyOf({ ...B, bond: 'running' })}-a`)).toBe(surfaceTexture(`${tileFamilyOf(B)}-a`));
    expect(() => normalizeTileSpec({ ...B, bond: 'zigzag' })).toThrow(/one of running/);
  });
  it('a frieze is a small pattern, one tile per pattern', () => {
    const t = FRIEZE_PATTERNS.map((pattern) => surfaceTexture(`${tileFamilyOf({ gen: 'frieze', pattern, ground: [90, 90, 90], figure: [160, 160, 160] })}-a`));
    expect(new Set(t).size).toBe(FRIEZE_PATTERNS.length);
  });
});

describe('variety: earth, ivy and the motif band on the stage', () => {
  it('earth blends dirt into the floor, more as the dial rises; none at 0', () => {
    const at = (earth) => assembleStageScene({ ...CRYPT, earth }).faces.filter((f) => f.group === 'stage:earth').length;
    expect(at(0)).toBe(0);
    expect(at(0.8)).toBeGreaterThan(at(0.2));
    expect(() => planStage({ ...CRYPT, earth: 2 })).toThrow(/earth is a number/);
  });
  it('ivy roots at the plinth and climbs, its mass at the foot; never on the accent wall', () => {
    const plan = planStage({ ...CRYPT, ivy: 1 }), geom = buildStageGeometry(plan), tomb = cryptTomb(plan);
    const tc = [tomb.corners.reduce((a, c) => a + c[0], 0) / 4, tomb.corners.reduce((a, c) => a + c[1], 0) / 4], acc = accentWall(plan, geom.pilasters, tc);
    const ivy = ivyGrowth(plan, geom.pilasters, acc, 1, [0.5, 0.6, 0.5]);
    expect(ivy.length).toBeGreaterThan(0);
    for (const f of ivy) {
      expect(f.texture).toBe('card:ivy');
      expect(f.corners[0][2]).toBeGreaterThan(f.corners[2][2]);   // laid upside down: the card's foot (its mass) is the low edge
      expect(f.normal[0] === acc.F.N[0] && f.normal[1] === acc.F.N[1] && Math.abs((f.corners[0][0] - acc.F.o[0]) * acc.F.N[0] + (f.corners[0][1] - acc.F.o[1]) * acc.F.N[1]) < 0.1).toBe(false);
    }
  });
  it('a kit\'s motif runs as a band on its plinth or cornice', () => {
    const bands = assembleStageScene(CRYPT).faces.filter((f) => f.group === 'stage:motif-band');
    expect(bands.length).toBeGreaterThan(0);
    expect(Math.max(...bands.flatMap((f) => f.corners.map((c) => c[2])))).toBeLessThan(planStage(CRYPT).kit.plinth.h);   // the crypt's own runs on the plinth
  });
});

describe('variety: doodads and set pieces', () => {
  it('two doodads never stand within 2.5 m unless a corner gathers them on purpose', () => {
    const plan = planStage({ ...starter('gothic-stone'), reference: 'gothic-night' }), geom = buildStageGeometry(plan);
    for (const clusters of [0, 2]) {
      const t = placeThings(plan, geom.pilasters, { kinds: ['crate', 'barrel', 'boulder', 'stones', 'debris'], share: 0.9, clusters }), dd = t.filter((x) => DOODAD_KINDS.includes(x.kind));
      for (let i = 0; i < dd.length; i++) for (let j = i + 1; j < dd.length; j++) {
        if (Math.hypot(dd[i].p[0] - dd[j].p[0], dd[i].p[1] - dd[j].p[1]) < 2.5) expect(dd[i].cluster && dd[i].cluster === dd[j].cluster).toBeTruthy();
      }
      expect(new Set(t.filter((x) => x.cluster).map((x) => x.cluster)).size).toBeLessThanOrEqual(clusters);
    }
  });
  it('each set piece stands in the last room and declares itself the focus', () => {
    for (const kind of ['tomb', 'open-tomb', 'altar', 'well']) {
      const plan = planStage(CRYPT), p2 = { ...plan, kit: { ...plan.kit, dress: { ...plan.kit.dress, tomb: { ...plan.kit.dress.tomb, kind } } } };
      const { faces } = cryptTomb(p2);
      expect(faces.length).toBeGreaterThan(10);
      expect(faces.every((f) => f.group.startsWith('stage:focus'))).toBe(true);
    }
  });
});

describe('variety: height and atmosphere', () => {
  it('lift raises every room to the half metre; out of range is refused', () => {
    expect(planStage({ ...CRYPT, lift: 1.3 }).rooms.map((r) => r.h)).toEqual([11.5, 6.5]);
    expect(() => planStage({ ...CRYPT, lift: 3 })).toThrow(/lift is a number/);
  });
  it('fog thickens the haze, dust adds motes, flicker paces the live torches; absent, none of it', () => {
    const plain = assembleStageScene({ ...CRYPT, fire: true }), A = assembleStageScene({ ...CRYPT, fire: true, atmosphere: { fog: 2, dust: 0.5, flicker: 0.3 } });
    expect(A.haze.density).toBeCloseTo(plain.haze.density * 2, 5);
    expect(plain.motes).toBeUndefined();
    expect(A.motes.count).toBeGreaterThan(0);
    expect(A.fireSources.every((s) => s.pace === 0.3)).toBe(true);
    expect(emitThreeWorld({ ...A, inline: true })).toContain('motes: dust hanging in the air');
    expect(emitThreeWorld({ ...plain, inline: true })).not.toContain('motes: dust hanging in the air');
    expect(() => planStage({ ...CRYPT, atmosphere: { dust: 4 } })).toThrow(/atmosphere.dust/);
  });
  it('a fire source takes a pace: its puff slows with it', () => {
    const F = resolveFire({ sources: [{ kind: 'torch', at: [0, 0, 0], pace: 0.4 }] });
    expect(F.sources[0].pace).toBe(0.4);
    expect(resolveFire({ sources: [{ kind: 'torch', at: [0, 0, 0] }] }).sources[0].pace).toBeUndefined();
  });
});
