// Integration test for the three Ring 7 agent-tasks tools:
// pull_agent_task, submit_envelope_inference, cancel_agent_task.
// Goes through `dispatchMcpRequest` so we exercise tool registration +
// JSON-RPC shape + inputSchema enforcement + audit-principle write. No
// external HTTP, no provider calls — the agent (us) IS the inference
// engine.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import {
  MetaContextRepository,
  MetaNodeRepository,
  MetaPrincipleRepository,
} from '@/lib/db/repositories/meta-context';
import { dispatchMcpRequest, ensureToolsRegistered } from '@/lib/mcp/server';
import { parkRequest, _internals } from '@/lib/mcp/agent-tasks/queue';

function safePark(payload, opts) {
  const p = parkRequest(payload, opts);
  p.catch(() => {});
  return p;
}

async function rpc(method, params, id = 1) {
  return dispatchMcpRequest(
    { jsonrpc: '2.0', id, method, params },
    { mcpSessionId: 'test-envelope-session', userId: 'local' },
  );
}

async function callTool(name, args, id = 1) {
  const reply = await rpc('tools/call', { name, arguments: args }, id);
  if (reply.error) throw new Error(`JSON-RPC error: ${reply.error.message}`);
  if (reply.result?.isError) {
    throw new Error(`tool error: ${reply.result.content?.[0]?.text || 'unknown'}`);
  }
  return reply.result;
}

function seedAppArtifact({ ref = 'claude-code:/tmp/app-x', name = 'image-extractor' } = {}) {
  return MetaContextRepository.commit(() =>
    MetaNodeRepository.upsert({
      kind: 'artifact',
      ref,
      label: 'Test App',
      payload: {
        adapter_id: 'claude-code',
        locator: ref.split(':').slice(1).join(':'),
        app: { name, bindings: {} },
      },
    }),
  );
}

beforeEach(async () => {
  closeDb();
  _internals._resetForTests();
  await ensureToolsRegistered();
});

describe('Ring 7 inference tools — registered with the dispatcher', () => {
  it('tools/list includes the three inference tools after the runner tools', async () => {
    // Flat connect surface — packs mode (now the default) folds these into
    // pack_runtime; this test pins their presence and reading order in flat.
    const prevPacks = process.env.MOJULO_TOOL_PACKS;
    process.env.MOJULO_TOOL_PACKS = 'off';
    const reply = await rpc('tools/list', {});
    if (prevPacks === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prevPacks;
    const names = reply.result.tools.map((t) => t.name);
    expect(names).toContain('pull_agent_task');
    expect(names).toContain('submit_envelope_inference');
    expect(names).toContain('cancel_agent_task');
    const startIdx = names.indexOf('start_app');
    const pullIdx = names.indexOf('pull_agent_task');
    expect(pullIdx).toBeGreaterThan(startIdx);
    // Ring 7 reading order: lifecycle → pull → submit → cancel.
    expect(names.indexOf('submit_envelope_inference')).toBeGreaterThan(pullIdx);
    expect(names.indexOf('cancel_agent_task')).toBeGreaterThan(names.indexOf('submit_envelope_inference'));
  });

  it('submit_envelope_inference schema rejects malformed envelope at protocol layer', async () => {
    // Reads the member's inputSchema off the flat wire surface — force flat
    // since packs mode (now the default) lists pack_runtime, not its members.
    const prevPacks = process.env.MOJULO_TOOL_PACKS;
    process.env.MOJULO_TOOL_PACKS = 'off';
    const reply = await rpc(
      'tools/list',
      {},
    );
    if (prevPacks === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prevPacks;
    const submitTool = reply.result.tools.find((t) => t.name === 'submit_envelope_inference');
    // Envelope schema is embedded — required field 'answer' must be in the
    // properties.envelope.required list.
    expect(submitTool.inputSchema.properties.envelope.required).toContain('answer');
    expect(submitTool.inputSchema.required).toContain('request_id');
    expect(submitTool.inputSchema.required).toContain('envelope');
  });
});

describe('pull → submit happy path', () => {
  it('agent pulls, submits envelope, parked HTTP resolves, principle is recorded', async () => {
    const artifact = seedAppArtifact({ ref: 'claude-code:/tmp/app-happy', name: 'happy-app' });

    const httpPromise = parkRequest({
      inputs: { text: 'what color is the sky?' },
      caller_ref: 'claude-code:/tmp/app-happy',
    });

    const pulled = await callTool('pull_agent_task', { wait_ms: 100 });
    expect(Array.isArray(pulled.content)).toBe(true);
    const manifest = JSON.parse(pulled.content[0].text);
    expect(manifest.request_id).toBeTruthy();
    expect(manifest.inputs.text).toBe('what color is the sky?');
    expect(manifest.inputs.image_present).toBe(false);
    expect(manifest.caller_ref).toBe('claude-code:/tmp/app-happy');

    const submitResult = await callTool('submit_envelope_inference', {
      request_id: manifest.request_id,
      envelope: { answer: 'Blue.', suggestions: ['On a clear day, anyway.'] },
      model: 'sonnet-test',
    }, 2);
    const submitJson = JSON.parse(submitResult.content[0].text);
    expect(submitJson.accepted).toBe(true);
    expect(submitJson.request_id).toBe(manifest.request_id);
    expect(submitJson.principle_id).toBeGreaterThan(0);

    const httpResult = await httpPromise;
    expect(httpResult.envelope).toEqual({ answer: 'Blue.', suggestions: ['On a clear day, anyway.'] });
    expect(httpResult.meta.model).toBe('sonnet-test');

    const principles = MetaPrincipleRepository.listForScope('node', artifact.id);
    expect(principles).toHaveLength(1);
    expect(principles[0].sourceEvent).toBe('app_inference');
    expect(principles[0].bodyMd).toMatch(/agent-routed/);
    expect(principles[0].bodyMd).toMatch(/sonnet-test/);
    // The MCP /loop submit path stamps the fulfiller as `agent-mcp` so
    // the contextmap stays honest about who fulfilled the task.
    expect(principles[0].bodyMd).toMatch(/Fulfiller/);
    expect(principles[0].bodyMd).toMatch(/agent-mcp/);
  });

  it('image input is delivered as a native MCP image content block', async () => {
    const httpPromise = parkRequest({
      inputs: {
        text: 'what is in this image?',
        image_base64: 'aGVsbG8=',
        image_mime: 'image/jpeg',
      },
    });

    const pulled = await callTool('pull_agent_task', { wait_ms: 100 });
    expect(pulled.content).toHaveLength(2);
    expect(pulled.content[0].type).toBe('text');
    expect(pulled.content[1].type).toBe('image');
    expect(pulled.content[1].mimeType).toBe('image/jpeg');
    expect(pulled.content[1].data).toBe('aGVsbG8=');

    const manifest = JSON.parse(pulled.content[0].text);
    expect(manifest.inputs.image_present).toBe(true);

    await callTool('submit_envelope_inference', {
      request_id: manifest.request_id,
      envelope: { answer: 'A duck.' },
    }, 3);
    const httpResult = await httpPromise;
    expect(httpResult.envelope.answer).toBe('A duck.');
  });

  it('caller_ref that does not resolve still delivers the envelope, just no principle', async () => {
    const httpPromise = parkRequest({
      inputs: { text: 'orphan caller_ref' },
      caller_ref: 'claude-code:/tmp/does-not-exist',
    });
    const pulled = await callTool('pull_agent_task', { wait_ms: 100 });
    const manifest = JSON.parse(pulled.content[0].text);
    const submitResult = await callTool('submit_envelope_inference', {
      request_id: manifest.request_id,
      envelope: { answer: 'still works' },
    }, 4);
    const submitJson = JSON.parse(submitResult.content[0].text);
    expect(submitJson.accepted).toBe(true);
    expect(submitJson.principle_id).toBeNull();
    const httpResult = await httpPromise;
    expect(httpResult.envelope.answer).toBe('still works');
  });
});

describe('cancel flow', () => {
  it('cancel_agent_task releases the parked HTTP with a typed error', async () => {
    const httpPromise = safePark({ inputs: { text: 'cancel me' } });
    const pulled = await callTool('pull_agent_task', { wait_ms: 100 });
    const manifest = JSON.parse(pulled.content[0].text);
    await callTool('cancel_agent_task', {
      request_id: manifest.request_id,
      reason: 'image unreadable',
    }, 5);
    await expect(httpPromise).rejects.toMatchObject({
      code: 'INFERENCE_CANCELLED',
      message: 'image unreadable',
    });
  });

  it('no principle is written on cancel', async () => {
    const artifact = seedAppArtifact({ ref: 'claude-code:/tmp/app-cancel', name: 'cancel-app' });
    const httpPromise = safePark({
      inputs: { text: 'cancel' },
      caller_ref: 'claude-code:/tmp/app-cancel',
    });
    const pulled = await callTool('pull_agent_task', { wait_ms: 100 });
    const manifest = JSON.parse(pulled.content[0].text);
    await callTool('cancel_agent_task', { request_id: manifest.request_id, reason: 'no' }, 6);
    await expect(httpPromise).rejects.toThrow();
    const principles = MetaPrincipleRepository.listForScope('node', artifact.id);
    expect(principles).toHaveLength(0);
  });
});

describe('error surfaces', () => {
  it('pull_agent_task returns request:null on empty queue', async () => {
    const result = await callTool('pull_agent_task', { wait_ms: 0 });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.request).toBeNull();
  });

  it('submit_envelope_inference on unknown request_id is a tool error', async () => {
    const reply = await rpc(
      'tools/call',
      {
        name: 'submit_envelope_inference',
        arguments: {
          request_id: 'definitely-not-real',
          envelope: { answer: 'x' },
        },
      },
      7,
    );
    expect(reply.result?.isError).toBe(true);
    expect(reply.result.content[0].text).toMatch(/No in-flight request/);
  });

  it('cancel_agent_task on unknown request_id is a tool error', async () => {
    const reply = await rpc(
      'tools/call',
      { name: 'cancel_agent_task', arguments: { request_id: 'nope' } },
      8,
    );
    expect(reply.result?.isError).toBe(true);
  });

  it('submit_envelope_inference with missing envelope.answer is a tool error', async () => {
    const httpPromise = safePark({ inputs: { text: 'x' } });
    const pulled = await callTool('pull_agent_task', { wait_ms: 50 });
    const manifest = JSON.parse(pulled.content[0].text);
    const reply = await rpc(
      'tools/call',
      {
        name: 'submit_envelope_inference',
        arguments: {
          request_id: manifest.request_id,
          envelope: { suggestions: ['no answer here'] },
        },
      },
      9,
    );
    expect(reply.result?.isError).toBe(true);
    expect(reply.result.content[0].text).toMatch(/answer/);
    // Cleanup the parked request.
    await callTool('cancel_agent_task', { request_id: manifest.request_id, reason: 'cleanup' }, 10);
    await expect(httpPromise).rejects.toThrow();
  });
});
