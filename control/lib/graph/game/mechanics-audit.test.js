// M3: mechanic-derived audits auto-run through the gate. The compile step is pure; the gate
// orchestration is tested with an INJECTED traversal runner (the real one is headless/browser,
// exercised in production — same discipline as motion.js's render path).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { compileMechanicAudit, auditLevel } from './game-audit.js';
import { mintGame } from '@/lib/mcp/tools/create-game.js';

beforeEach(() => { closeDb(); });

// a mechanics-authored level: the resolve synthesizes the contract + audits, so a stored level
// carries game.audits. Here we author the game channel with mechanics; resolveGame lowers it.
const reachExitLevel = (ref, target = [20, 0, 0]) => ({
  kind: 'controllable',
  entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [0, 0, 2] } }],
  camera: { rule: 'follow', target: 'hero' },
  game: { levelRef: ref, mechanics: [{ kind: 'reach-exit', at: target, radius: 2 }] },
});

describe('compileMechanicAudit — audits → traversal plan', () => {
  it('reach-exit walkto → a waypoint route to the exit', () => {
    const c = { audits: [{ mechanic: 'reach-exit', kind: 'walkto', target: [20, 4, 0] }] };
    const r = compileMechanicAudit(c);
    expect(r.ok).toBe(true);
    expect(r.plan).toMatchObject({ motion: 'traversal', waypoints: [[20, 4]], expect: 'success', via: 'reach-exit' });
  });

  it('survive idle → idle ticks past the timer', () => {
    const c = { audits: [{ mechanic: 'survive', kind: 'idle', seconds: 5 }] };
    const r = compileMechanicAudit(c, { fps: 10 });
    expect(r.ok).toBe(true);
    expect(r.plan.ticks.length).toBe(5 * 10 + 10);   // duration + a margin
    expect(r.plan.ticks.every((t) => Object.keys(t).length === 0)).toBe(true);   // all idle
    expect(r.plan.via).toBe('survive');
  });

  it('a level with no auto-auditable mechanic returns not-ok', () => {
    expect(compileMechanicAudit({ audits: [] }).ok).toBe(false);
    expect(compileMechanicAudit({}).ok).toBe(false);
  });
});

describe('auditLevel — auto-run via an injected runner', () => {
  const store = { slices: [{ name: 'bag', kind: 'inventory' }] };
  const contract = { levelRef: 'lv', audits: [{ mechanic: 'reach-exit', kind: 'walkto', target: [20, 0, 0] }], produces: { events: [] } };

  it('a winning auto-run makes the level promotable with no motion_ref', async () => {
    const runner = async ({ plan }) => ({ game: { ended: true, result: 'success' }, _plan: plan });
    const a = await auditLevel({ ref: 'lv', store, contract, autoRun: runner });
    expect(a.promotable).toBe(true);
    expect(a.completable).toBe(true);
    expect(a.reason).toMatch(/auto-audit \(reach-exit\)/);
  });

  it('a losing auto-run blocks promotion', async () => {
    const runner = async () => ({ game: { ended: true, result: 'fail' } });
    const a = await auditLevel({ ref: 'lv', store, contract, autoRun: runner });
    expect(a.promotable).toBe(false);
    expect(a.completable).toBe(false);
  });

  it('a runner that throws is caught as a failed audit, not a crash', async () => {
    const runner = async () => { throw new Error('headless boom'); };
    const a = await auditLevel({ ref: 'lv', store, contract, autoRun: runner });
    expect(a.promotable).toBe(false);
    expect(a.reason).toMatch(/auto-audit failed to run: headless boom/);
  });

  it('without a runner, the refusal names the auto-auditable path + carries the compiled plan', async () => {
    const a = await auditLevel({ ref: 'lv', store, contract });
    expect(a.promotable).toBe(false);
    expect(a.reason).toMatch(/auto-auditable \(reach-exit\): set auto_audit:true/);
    expect(a.autoAuditPlan).toMatchObject({ waypoints: [[20, 0]] });
  });
});

describe('create_game — auto_audit through the real mint (injected runner)', () => {
  it('a mechanics crawler passes the gate with auto_audit and NO hand-authored traversal', async () => {
    SketchRepository.create({ ref: 'crypt-1', title: 'crypt-1', manifest: reachExitLevel('crypt-1') });
    const runTraversal = async ({ levelRef, plan }) => {
      expect(levelRef).toBe('crypt-1');
      expect(plan.waypoints).toEqual([[20, 0]]);       // the compiled walk-to-exit
      return { game: { ended: true, result: 'success' } };
    };
    const out = await mintGame({
      title: 'Auto Crawler', store: { slices: [{ name: 'campaign', kind: 'progression' }] },
      levels: [{ ref: 'crypt-1' }], ref: 'auto-game', autoAudit: true, runTraversal,
    });
    expect(out.ok).toBe(true);
    expect(out.audits[0]).toMatchObject({ ref: 'crypt-1', audited: true, result: 'success' });
    expect(out.audits[0].note).toMatch(/auto-audit/);
  });

  it('auto_audit still refuses a level whose auto-run loses', async () => {
    SketchRepository.create({ ref: 'crypt-1', title: 'crypt-1', manifest: reachExitLevel('crypt-1') });
    const runTraversal = async () => ({ game: { ended: true, result: 'fail' } });
    await expect(mintGame({
      title: 'Bad', store: { slices: [{ name: 'campaign', kind: 'progression' }] },
      levels: [{ ref: 'crypt-1' }], autoAudit: true, runTraversal,
    })).rejects.toThrow(/verification gate/);
  });
});
