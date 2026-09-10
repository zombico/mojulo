import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRefusal, isToolRefusal, refExistsRefusal } from './tool-refusal.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { dispatchMcpRequest, ensureToolsRegistered } from '@/lib/mcp/server';

describe('ToolRefusal — a no that carries its next move', () => {
  it('renders as an isError JSON tool result and keeps a readable message', () => {
    const err = new ToolRefusal({ code: 'X', reason: 'No.', hint: 'Do Y.', extra: 1 });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('No. Do Y.');
    expect(isToolRefusal(err)).toBe(true);
    expect(isToolRefusal(new Error('plain'))).toBe(false);
    const res = err.toToolResult();
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text)).toEqual({ code: 'X', reason: 'No.', extra: 1 });
  });

  it('refExistsRefusal routes by kind: beats → update_beats, voice → create_voice, else update_sketch', () => {
    const beats = refExistsRefusal({ ref: 'r', kind: 'beats-ambient' }).payload;
    expect(beats.code).toBe('REF_EXISTS');
    expect(beats.next_action.tool).toBe('update_beats');
    expect(beats.read_first.tool).toBe('get_beats');
    const voice = refExistsRefusal({ ref: 'r', kind: 'voice-register' }).payload;
    expect(voice.next_action.tool).toBe('create_voice');
    expect(voice.read_first.tool).toBe('get_voice');
    const view = refExistsRefusal({ ref: 'r', kind: 'black-hole' }).payload;
    expect(view.next_action).toEqual(expect.objectContaining({ tool: 'update_sketch', args: { ref: 'r' } }));
    expect(view.read_first.url).toBe('/sketches/r');
    expect(view.alternative).toMatch(/Omit `ref`/);
  });
});

describe('SketchRepository.create on a taken ref', () => {
  it('throws the REF_EXISTS refusal instead of a bare UNIQUE message', () => {
    const ref = `refusal-${Date.now()}`;
    SketchRepository.create({ title: 't', manifest: { kind: 'flow' }, ref });
    let caught;
    try {
      SketchRepository.create({ title: 't', manifest: { kind: 'flow' }, ref });
    } catch (err) {
      caught = err;
    }
    expect(isToolRefusal(caught)).toBe(true);
    expect(caught.code).toBe('REF_EXISTS');
    expect(caught.message).toMatch(/already exists\. Revise it in place with update_sketch/);
    expect(caught.message).not.toMatch(/UNIQUE constraint/);
  });
});

describe('dispatchMcpRequest renders a refusal as its JSON body', () => {
  beforeEach(async () => {
    await ensureToolsRegistered();
  });

  it('create_sketch twice with one ref → REF_EXISTS with next_action update_sketch', async () => {
    const ref = `dispatch-refusal-${Date.now()}`;
    const call = (id) =>
      dispatchMcpRequest(
        {
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {
            name: 'create_sketch',
            arguments: {
              ref,
              title: 'twice',
              manifest: {
                kind: 'flow',
                title: 'twice',
                viewBox: { width: 400, height: 200 },
                stations: [{ id: 'a', kind: 'input', label: 'A', x: 0, y: 0, w: 120, h: 48 }],
                edges: [],
              },
            },
          },
        },
        {},
      );
    const first = await call(1);
    expect(first.result.isError, first.result.content?.[0]?.text).toBeFalsy();
    const second = await call(2);
    expect(second.result.isError).toBe(true);
    const body = JSON.parse(second.result.content[0].text);
    expect(body).toMatchObject({
      code: 'REF_EXISTS',
      ref,
      next_action: { tool: 'update_sketch', args: { ref } },
    });
  });
});
