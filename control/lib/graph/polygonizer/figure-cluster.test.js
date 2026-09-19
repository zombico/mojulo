/**
 * figure-cluster — the meru frame.
 *
 * The case that matters most is the last one: the SAME cluster spec on two casts produces gear that
 * is proportionally identical. That is the property an absolute `size` cannot have, and the reason
 * the Roman's gear took four passes to place.
 */
import { describe, it, expect } from 'vitest';
import { measureFigure, resolveCluster, validateCluster } from './figure-cluster.js';
import { planWorkbench } from '../worlds/workbench.js';

const CUBE = {
  kind: 'workbench',
  extrudes: [{ id: 'box', profile: { rect: { w: 2, h: 2 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, tint: '#888888' }],
};

const cluster = (over = {}) => ({
  identity: 'a test dummy — one grey cube on the crown',
  body: { cast: 'chibi' },
  roles: [{ id: 'hat', recipe: CUBE, mount: { at: 'headTop', span: 0.4 } }],
  ...over,
});

describe('measureFigure', () => {
  it('measures the POSED armature rather than assuming a height', () => {
    const chibi = measureFigure({ cast: 'chibi' });
    const adult = measureFigure({});
    expect(chibi.height).toBeGreaterThan(0);
    // Measured, not assumed: adult headTop ~0.93, chibi ~0.52. A chibi cast compresses the
    // skeleton and keeps the skull, so the ratio is ~1.8 — enough to make a guessed absolute wrong,
    // which is the whole reason `span` is a fraction.
    expect(adult.height).toBeGreaterThan(chibi.height * 1.5);
    expect(adult.height).toBeLessThan(chibi.height * 2.2);
    expect(chibi.node).toBe('headTop');
  });
});

describe('resolveCluster', () => {
  it('multiplies a fractional span by the measured height', () => {
    const { manifest, ledger } = resolveCluster(cluster());
    expect(manifest.attachments).toHaveLength(1);
    expect(manifest.attachments[0].size).toBeCloseTo(0.4 * ledger.unit.height, 6);
    expect(manifest.attachments[0].at).toBe('headTop');
  });

  it('SAME SPEC, TWO CASTS — gear stays proportionally identical', () => {
    const chibi = resolveCluster(cluster({ body: { cast: 'chibi' } }));
    const adult = resolveCluster(cluster({ body: {} }));
    const ratio = (r) => r.manifest.attachments[0].size / r.ledger.unit.height;
    expect(ratio(chibi)).toBeCloseTo(ratio(adult), 9);
    // …while the absolute sizes differ by exactly the figures' own ratio.
    expect(adult.manifest.attachments[0].size / chibi.manifest.attachments[0].size)
      .toBeCloseTo(adult.ledger.unit.height / chibi.ledger.unit.height, 9);
  });

  it('scales the offset fractionally too, so a whole cluster ports', () => {
    const r = resolveCluster(cluster({ roles: [{ id: 'hat', recipe: CUBE, mount: { at: 'headTop', span: 0.4, offset: [0, 0.1, -0.05] } }] }));
    expect(r.manifest.attachments[0].offset[1]).toBeCloseTo(0.1 * r.ledger.unit.height, 6);
  });

  it("spanOf:'head' measures against the SKULL, so headgear survives a cast change", () => {
    // The portability run found this: one figure-relative unit ported the spear and shield
    // perfectly and arrived with an oversized helmet, because a chibi's head is a far larger share
    // of its body than an adult's.
    const hat = (body) => resolveCluster({
      ...cluster({ body }),
      roles: [{ id: 'hat', recipe: CUBE, mount: { at: 'headTop', span: 1.1, spanOf: 'head' } }],
    });
    const chibi = hat({ cast: 'chibi', proto: { headScale: 1.35 } });
    const adult = hat({ proto: {} });
    expect(chibi.ledger.roles[0].spanOf).toBe('head');
    // Bigger head → bigger hat, even though the adult is the taller figure.
    expect(chibi.ledger.unit.height).toBeLessThan(adult.ledger.unit.height);
    expect(chibi.manifest.attachments[0].size).toBeGreaterThan(adult.manifest.attachments[0].size);
    // And each is the same multiple of ITS OWN head.
    expect(chibi.manifest.attachments[0].size / chibi.ledger.unit.head).toBeCloseTo(1.1, 6);
    expect(adult.manifest.attachments[0].size / adult.ledger.unit.head).toBeCloseTo(1.1, 6);
  });

  it('keeps offsets figure-relative even when the span is head-relative', () => {
    const r = resolveCluster({ ...cluster(), roles: [{ id: 'hat', recipe: CUBE, mount: { at: 'headTop', span: 1.1, spanOf: 'head', offset: [0, 0, 0.1] } }] });
    expect(r.manifest.attachments[0].offset[2]).toBeCloseTo(0.1 * r.ledger.unit.height, 6);
    expect(r.manifest.attachments[0].spanOf).toBeUndefined();   // resolved here, not passed through
  });

  it('carries the identity lock onto the recipe', () => {
    expect(resolveCluster(cluster()).manifest.identity).toMatch(/test dummy/);
  });

  it('gates each role on its OWN bounds when given a planner', () => {
    const { ledger } = resolveCluster(cluster(), planWorkbench);
    const row = ledger.roles[0];
    expect(row.closed).toBe(true);
    expect(row.bodies).toBe(1);
    expect(row.faces).toBeGreaterThan(0);
    // A role is seated by its mount, so the studio-floor lint must not leak into the cluster.
    expect(JSON.stringify(ledger.warnings || [])).not.toMatch(/sinks|floats/);
  });

  it('reports a role that fails to plan without losing the rest', () => {
    const { ledger } = resolveCluster(cluster({
      roles: [
        { id: 'bad', recipe: { kind: 'workbench' }, mount: { at: 'headTop', span: 0.3 } },
        { id: 'good', recipe: CUBE, mount: { at: 'headTop', span: 0.4 } },
      ],
    }), planWorkbench);
    expect(ledger.roles[0].error).toBeTruthy();
    expect(ledger.roles[1].closed).toBe(true);
    expect(ledger.warnings.join(' ')).toMatch(/role 'bad' failed to plan/);
  });

  it('resolves without a planner, so the frame carries no world imports of its own', () => {
    const { ledger } = resolveCluster(cluster());
    expect(ledger.roles[0].closed).toBeUndefined();
    expect(ledger.roles[0].size).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(resolveCluster(cluster())).toEqual(resolveCluster(cluster()));
  });
});

describe('validateCluster', () => {
  it('accepts a good cluster', () => {
    expect(validateCluster(cluster())).toEqual([]);
  });

  it('REFUSES an absolute size and says why', () => {
    const e = validateCluster(cluster({ roles: [{ id: 'hat', recipe: CUBE, mount: { at: 'headTop', size: 0.22 } }] }));
    expect(e.join(' ')).toMatch(/mount\.size: not allowed/);
    expect(e.join(' ')).toMatch(/FRACTION of figure height/);
  });

  it('requires the identity lock', () => {
    expect(validateCluster(cluster({ identity: '' })).join(' ')).toMatch(/identity: required/);
  });

  it('requires a positive span and catches a misplaced decimal', () => {
    expect(validateCluster(cluster({ roles: [{ id: 'a', recipe: CUBE, mount: { at: 'headTop' } }] })).join(' ')).toMatch(/span: required/);
    expect(validateCluster(cluster({ roles: [{ id: 'a', recipe: CUBE, mount: { at: 'headTop', span: 42 } }] })).join(' ')).toMatch(/misplaced decimal/);
  });

  it('names a bad span unit', () => {
    expect(validateCluster(cluster({ roles: [{ id: 'a', recipe: CUBE, mount: { at: 'headTop', span: 1, spanOf: 'torso' } }] })).join(' ')).toMatch(/spanOf: must be one of figure \| head/);
  });

  it('catches duplicate role ids and a bad landmark shape', () => {
    const e = validateCluster(cluster({
      roles: [
        { id: 'a', recipe: CUBE, mount: { at: 'headTop', span: 0.3 } },
        { id: 'a', recipe: CUBE, mount: { at: 'headTop', span: 0.3 } },
        { id: 'b', recipe: CUBE, mount: { span: 0.3 } },
      ],
    }));
    expect(e.join(' ')).toMatch(/duplicate role id 'a'/);
    expect(e.join(' ')).toMatch(/\.at: required/);
  });

  it('throws from resolveCluster rather than half-building', () => {
    expect(() => resolveCluster(cluster({ identity: '' }))).toThrow(/identity: required/);
  });
});
