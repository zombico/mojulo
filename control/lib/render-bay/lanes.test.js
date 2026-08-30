import { describe, expect, it } from 'vitest';

import {
  BAKE_BLACK_FRAC_LIMIT,
  PER_REQUEST_STAGES,
  QUEUE_STAGES,
  RENDER_LANES,
  STALE_IN_FLIGHT_SECONDS,
  bakeGates,
  bakePrompt,
  bakeViewHref,
  classifyOutputFile,
  collapseByRef,
  formatBytes,
  groupQueueByStage,
  isStalled,
  queueGroupPrompt,
  queuePrompt,
  queueStatusMeta,
  queueTotals,
  tallyOutputKinds,
} from './lanes.js';

const req = (over = {}) => ({
  id: 'irq_0000000000000001',
  ref: 'sk_abc1234567',
  target: 'page',
  kind: 'image-outcome',
  status: 'pending',
  pulledAt: null,
  updatedAt: 1_700_000_000,
  ...over,
});

describe('queue statuses', () => {
  it('classifies every status the schema CHECK allows', () => {
    // If the CHECK constraint grows, this is the test that notices.
    const statuses = ['pending', 'in_flight', 'submitted', 'accepted', 'rejected', 'expired', 'cancelled'];
    for (const status of statuses) {
      const meta = queueStatusMeta(status);
      expect(QUEUE_STAGES).toContain(meta.stage);
      expect(meta.unknown).toBeUndefined();
    }
  });

  it('keeps the eyes gate as its own stage', () => {
    // The whole point of §5: a submitted render is where the machine is done and
    // nobody has looked. Folding it into in-flight would hide the gate.
    expect(queueStatusMeta('submitted').stage).toBe('gate');
    expect(queueStatusMeta('submitted').waitingOn).toBe('eyes');
    expect(queueStatusMeta('in_flight').stage).toBe('inFlight');
    expect(queueStatusMeta('in_flight').waitingOn).toBe('worker');
  });

  it('counts an unknown status instead of dropping it', () => {
    const meta = queueStatusMeta('teleported');
    expect(meta.unknown).toBe(true);
    expect(meta.stage).toBe('done');
    expect(groupQueueByStage([req({ status: 'teleported' })]).done).toHaveLength(1);
  });

  it('signals accepted teal, rejected fault, waiting amber', () => {
    expect(queueStatusMeta('accepted').signal).toBe('live');
    expect(queueStatusMeta('rejected').signal).toBe('fault');
    expect(queueStatusMeta('pending').signal).toBe('forge');
    expect(queueStatusMeta('submitted').signal).toBe('forge');
  });
});

describe('groupQueueByStage', () => {
  it('buckets by stage and always returns every stage key', () => {
    const grouped = groupQueueByStage([
      req({ status: 'pending' }),
      req({ status: 'submitted' }),
      req({ status: 'accepted' }),
    ]);
    expect(Object.keys(grouped)).toEqual(QUEUE_STAGES);
    expect(grouped.queued).toHaveLength(1);
    expect(grouped.gate).toHaveLength(1);
    expect(grouped.done).toHaveLength(1);
    expect(grouped.inFlight).toEqual([]);
  });

  it('preserves incoming order within a stage', () => {
    const grouped = groupQueueByStage([
      req({ id: 'a', status: 'pending' }),
      req({ id: 'b', status: 'pending' }),
    ]);
    expect(grouped.queued.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('collapseByRef', () => {
  // Without the fold the bay is unreadable on a real workshop: one keyframe clip
  // parks 25 requests and pushes the eyes gate off the screen.
  const clip = (target) => req({ id: `irq_${target}`, ref: 'sk_clip', target, kind: 'keyframe-animation' });

  it('folds one artifact\'s many targets into one row', () => {
    const [group] = collapseByRef([clip('key-0'), clip('key-1'), clip('key-2')]);
    expect(group.ref).toBe('sk_clip');
    expect(group.requests).toHaveLength(3);
    expect(group.targets).toEqual(['key-0', 'key-1', 'key-2']);
  });

  it('folds nothing away — every request stays reachable in the group', () => {
    const rows = [clip('a'), clip('b'), req({ ref: 'sk_other', target: 'page' })];
    const groups = collapseByRef(rows);
    expect(groups.flatMap((g) => g.requests)).toHaveLength(rows.length);
  });

  it('keeps the newest movement in the group', () => {
    const [group] = collapseByRef([
      { ...clip('a'), updatedAt: 100 },
      { ...clip('b'), updatedAt: 900 },
    ]);
    expect(group.updatedAt).toBe(900);
  });

  it('keeps the OLDEST pull, so a stall reading is the worst case', () => {
    // A sibling claimed a moment ago must not reset the group's stall reading.
    const now = 1_700_000_000;
    const [group] = collapseByRef([
      { ...clip('a'), status: 'in_flight', pulledAt: now - STALE_IN_FLIGHT_SECONDS - 60 },
      { ...clip('b'), status: 'in_flight', pulledAt: now - 5 },
    ]);
    expect(group.pulledAt).toBe(now - STALE_IN_FLIGHT_SECONDS - 60);
    expect(isStalled({ ...group, status: 'in_flight' }, now)).toBe(true);
  });

  it('orders artifacts by newest movement', () => {
    const groups = collapseByRef([
      { ...req({ ref: 'sk_old' }), updatedAt: 10 },
      { ...req({ ref: 'sk_new' }), updatedAt: 99 },
    ]);
    expect(groups.map((g) => g.ref)).toEqual(['sk_new', 'sk_old']);
  });

  it('never folds the eyes gate, which is per-render by nature', () => {
    // accept_image_render takes exactly one request_id and each PNG needs its
    // own look, so the gate stage keeps a row per render.
    expect(PER_REQUEST_STAGES).toEqual(['gate']);
  });
});

describe('queueGroupPrompt', () => {
  const clip = (target) => req({ id: `irq_${target}`, ref: 'sk_clip', target });

  it('asks by ref, because pull_image_render drains a ref', () => {
    const [group] = collapseByRef([clip('key-0'), clip('key-1')]);
    const prompt = queueGroupPrompt(group);
    expect(prompt).toContain('pull_image_render({ ref: "sk_clip" })');
    expect(prompt).toContain('key-0, key-1');
    expect(prompt).toContain('2 queued renders');
  });

  it('falls back to the single-request prompt when there is nothing folded', () => {
    const [group] = collapseByRef([clip('key-0')]);
    expect(queueGroupPrompt(group)).toBe(queuePrompt(clip('key-0')));
  });

  it('re-pulls rejected renders by request id, not by ref', () => {
    // A repaint must land back on the SAME row, which is per-request.
    const [group] = collapseByRef([
      { ...clip('a'), status: 'rejected' },
      { ...clip('b'), status: 'rejected' },
    ]);
    expect(queueGroupPrompt(group)).toContain('pull_image_render({ request_id })');
  });

  it('is silent on a settled group', () => {
    const [group] = collapseByRef([
      { ...clip('a'), status: 'accepted' },
      { ...clip('b'), status: 'accepted' },
    ]);
    expect(queueGroupPrompt(group)).toBeNull();
    expect(queueGroupPrompt(null)).toBeNull();
  });
});

describe('queueTotals', () => {
  it('rolls whole-table status counts into stages', () => {
    const totals = queueTotals({ pending: 66, in_flight: 6, accepted: 279 });
    expect(totals.total).toBe(351);
    expect(totals.stages.queued).toBe(66);
    expect(totals.stages.inFlight).toBe(6);
    expect(totals.stages.done).toBe(279);
    expect(totals.stages.gate).toBe(0);
  });

  it('is zero-filled for an empty queue', () => {
    expect(queueTotals({})).toEqual({ total: 0, stages: { queued: 0, inFlight: 0, gate: 0, done: 0 }, statuses: {} });
  });
});

describe('isStalled', () => {
  const now = 1_700_000_000;
  it('flags a pull that has sat past the reading', () => {
    expect(isStalled(req({ status: 'in_flight', pulledAt: now - STALE_IN_FLIGHT_SECONDS - 1 }), now)).toBe(true);
  });
  it('leaves a fresh pull alone', () => {
    expect(isStalled(req({ status: 'in_flight', pulledAt: now - 60 }), now)).toBe(false);
  });
  it('only ever reads in_flight rows', () => {
    // There is no lease in the schema; staleness is a reading, not a transition,
    // so nothing but a pulled row can be stale.
    expect(isStalled(req({ status: 'pending', pulledAt: 0 }), now)).toBe(false);
    expect(isStalled(req({ status: 'accepted', pulledAt: 1 }), now)).toBe(false);
    expect(isStalled(req({ status: 'in_flight', pulledAt: null }), now)).toBe(false);
  });
});

describe('queuePrompt', () => {
  it('names the accept AND reject tools on the eyes gate, with the request id', () => {
    const prompt = queuePrompt(req({ status: 'submitted' }));
    expect(prompt).toContain('accept_image_render');
    expect(prompt).toContain('reject_image_render');
    expect(prompt).toContain('irq_0000000000000001');
  });

  it('warns the accepting agent not to self-accept', () => {
    expect(queuePrompt(req({ status: 'submitted' }))).toMatch(/not the worker/i);
  });

  it('is silent on settled rows so nothing invites a resurrection', () => {
    expect(queuePrompt(req({ status: 'accepted' }))).toBeNull();
    expect(queuePrompt(req({ status: 'expired' }))).toBeNull();
    expect(queuePrompt(req({ status: 'cancelled' }))).toBeNull();
    expect(queuePrompt(null)).toBeNull();
  });

  it('offers a repaint against the same row after a rejection', () => {
    const prompt = queuePrompt(req({ status: 'rejected' }));
    expect(prompt).toContain('irq_0000000000000001');
    expect(prompt).toContain('submit_image_render');
  });
});

describe('bake gates', () => {
  const bake = { ref: 'sk_world_gi', from: 'sk_world', matchRate: 0.94, floorBlackFrac: 0.03 };

  it('reports the machine gate as passed with its measured numbers', () => {
    // The driver fails before it binds anything, so a row that exists passed.
    const gates = bakeGates(bake);
    expect(gates.machine.passed).toBe(true);
    expect(gates.machine.matchRate).toBe(0.94);
    expect(gates.machine.floorBlackFrac).toBe(0.03);
    expect(gates.machine.limit).toBe(BAKE_BLACK_FRAC_LIMIT);
  });

  it('never lends the machine verdict to the eyes gate', () => {
    // docs/bicycles.md: two gates, never conflated. Nothing records that the
    // operator looked, so the surface must not claim they did.
    expect(bakeGates(bake).eyes.recorded).toBe(false);
  });

  it('points the eyes gate at the artifact under its baked display mode', () => {
    expect(bakeViewHref(bake)).toBe('/sketches/sk_world_gi?display=baked');
    expect(bakeViewHref(null)).toBeNull();
  });

  it('re-bakes from the SOURCE world, not the baked variant', () => {
    expect(bakePrompt(bake)).toContain('--ref sk_world ');
  });

  it('falls back to the row itself when a bake recoloured in place', () => {
    expect(bakePrompt({ ref: 'sk_arena' })).toContain('--ref sk_arena ');
  });

  it('survives a bake row with no measurements', () => {
    const gates = bakeGates({ ref: 'sk_x' });
    expect(gates.machine.matchRate).toBeNull();
    expect(gates.machine.floorBlackFrac).toBeNull();
  });
});

describe('output file classification', () => {
  it('keeps an exported model apart from a mesh bound back in', () => {
    // Same extension, opposite direction of travel.
    expect(classifyOutputFile('model.glb')).toBe('model');
    expect(classifyOutputFile('model.stl')).toBe('model');
    expect(classifyOutputFile('mesh-3.glb')).toBe('mesh');
  });

  it('classifies the append-only render-store slots', () => {
    expect(classifyOutputFile('render-key-0-1.png')).toBe('render');
    expect(classifyOutputFile('skin-1.png')).toBe('skin');
    expect(classifyOutputFile('voice-2.wav')).toBe('voice');
    expect(classifyOutputFile('motion.gif')).toBe('motion');
    expect(classifyOutputFile('game.html')).toBe('game');
    expect(classifyOutputFile('plate-001.svg')).toBe('page');
    expect(classifyOutputFile('recipe.json')).toBe('recipe');
  });

  it('classifies beats renders by extension', () => {
    expect(classifyOutputFile('chip-pixel-alley-groove.wav')).toBe('audio');
    expect(classifyOutputFile('chip-pixel-alley-groove.mid')).toBe('score');
  });

  it('never drops a file it does not recognize', () => {
    expect(classifyOutputFile('mystery.bin')).toBe('other');
    expect(classifyOutputFile('')).toBe('other');
  });

  it('tallies in a stable order so identical folders chip identically', () => {
    const a = tallyOutputKinds(['render-1.png', 'model.glb', 'render-2.png']);
    const b = tallyOutputKinds(['model.glb', 'render-2.png', 'render-1.png']);
    expect(a).toEqual(b);
    expect(a).toEqual([{ kind: 'model', count: 1 }, { kind: 'render', count: 2 }]);
  });

  it('accepts either a filename or a scanned file record', () => {
    expect(tallyOutputKinds([{ name: 'model.stl', bytes: 12 }])).toEqual([{ kind: 'model', count: 1 }]);
  });
});

describe('formatBytes', () => {
  it('reads bytes up to a kilobyte plainly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });
  it('holds one decimal so the mono readout stays a stable width', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 ** 2 * 3.5)).toBe('3.5 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });
  it('says nothing rather than something wrong for a missing size', () => {
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });
});

describe('lane model', () => {
  it('names exactly the three lanes §5 asks for', () => {
    expect(RENDER_LANES).toEqual(['queue', 'bakes', 'outputs']);
  });
});
