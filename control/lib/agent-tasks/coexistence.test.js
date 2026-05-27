// Coexistence test — verifies the agent-tasks queue's FIFO single-claim
// semantics hold when both the Node fulfiller and a simulated MCP /loop
// puller race for the same parked task. Each task is fulfilled by
// exactly one puller; no double-submit.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import {
  parkRequest,
  pullNext,
  deliverResult,
  _internals as queueInternals,
} from '@/lib/mcp/agent-tasks/queue';
import {
  registerAdapter,
  _internals as adapterInternals,
} from '@/lib/runtime-adapters';
import { startNodeFulfiller, stopNodeFulfiller } from './node-fulfiller.js';

beforeEach(async () => {
  closeDb();
  queueInternals._resetForTests();
  adapterInternals._clearForTests();
  delete process.env.MOJULO_AGENT_RUNTIME;
});

afterEach(async () => {
  delete process.env.MOJULO_AGENT_RUNTIME;
  await stopNodeFulfiller();
});

describe('Node fulfiller + simulated /loop puller coexistence', () => {
  it('a single parked task is claimed by exactly one fulfiller', async () => {
    // Slow Node fulfiller so the MCP puller has a chance to win the race.
    const fake = {
      id: 'fake-slow',
      capabilities: { vision: false, streaming: false },
      supportedKinds: ['envelope_inference'],
      invoke: async ({ taskPayload }) => {
        await new Promise((r) => setTimeout(r, 30));
        return { envelope: { answer: `node:${taskPayload.inputs.text}` }, model: 'fake' };
      },
    };
    registerAdapter(fake);
    process.env.MOJULO_AGENT_RUNTIME = 'fake-slow';
    startNodeFulfiller({ pullWaitMs: 100 });

    // Simulated MCP /loop puller: long-poll directly via pullNext (no
    // kindsFilter — represents the /loop run-inference-worker catalyst).
    const loopPuller = pullNext({ waitMs: 100 });

    // Park the task; both pullers race.
    const parked = parkRequest({ inputs: { text: 'race' } });

    const claimedByLoop = await loopPuller;
    if (claimedByLoop) {
      // The /loop puller won. Submit the envelope so the parked HTTP
      // resolves before assertion. Node fulfiller's loop will then
      // long-poll, find no work, and stay idle.
      deliverResult(claimedByLoop.id, { answer: `loop:${claimedByLoop.payload.inputs.text}` });
      const result = await parked;
      expect(result.envelope.answer).toBe('loop:race');
    } else {
      // The Node fulfiller won. The /loop's pullNext returned null after
      // its wait expired (no work left); parked HTTP resolves via the
      // Node fulfiller's deliverResult.
      const result = await parked;
      expect(result.envelope.answer).toBe('node:race');
    }
  });

  it('two parked tasks split cleanly — one per fulfiller, no double-submit', async () => {
    const fake = {
      id: 'fake-coexist',
      capabilities: { vision: false, streaming: false },
      supportedKinds: ['envelope_inference'],
      invoke: async ({ taskPayload }) => {
        await new Promise((r) => setTimeout(r, 10));
        return { envelope: { answer: `node:${taskPayload.inputs.text}` }, model: 'fake' };
      },
    };
    registerAdapter(fake);
    process.env.MOJULO_AGENT_RUNTIME = 'fake-coexist';
    startNodeFulfiller({ pullWaitMs: 100 });

    const a = parkRequest({ inputs: { text: 'one' } });
    const b = parkRequest({ inputs: { text: 'two' } });

    // Simulated /loop puller drains the queue alongside the Node fulfiller.
    // The Node fulfiller is serial; the /loop puller acts in parallel.
    const loopPulled = await pullNext({ waitMs: 200 });
    if (loopPulled) {
      deliverResult(loopPulled.id, { answer: `loop:${loopPulled.payload.inputs.text}` });
    }

    const [resA, resB] = await Promise.all([a, b]);
    const answers = new Set([resA.envelope.answer, resB.envelope.answer]);
    // Both finished; no answer is duplicated; each comes from exactly one
    // fulfiller (single-claim FIFO held).
    expect(answers.size).toBe(2);
    for (const ans of answers) {
      expect(ans).toMatch(/^(loop|node):(one|two)$/);
    }
  });
});
