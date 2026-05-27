// Unit tests for the claude-code-headless adapter. We don't actually
// spawn `claude` (CI doesn't have it on PATH); we exercise the
// parseClaudeOutput + buildUserPrompt internals against the JSON shapes
// `claude --print --output-format json` produces, plus error paths.

import { describe, it, expect } from 'vitest';
import { claudeCodeHeadlessAdapter, _internals } from './claude-code.js';
import { AgentRuntimeError } from './errors.js';

const { parseClaudeOutput, buildUserPrompt } = _internals;

describe('adapter shape', () => {
  it('declares its id, capabilities, and supportedKinds', () => {
    expect(claudeCodeHeadlessAdapter.id).toBe('claude-code-headless');
    expect(claudeCodeHeadlessAdapter.capabilities.vision).toBe(true);
    expect(claudeCodeHeadlessAdapter.supportedKinds).toContain('envelope_inference');
  });
});

describe('buildUserPrompt', () => {
  it('embeds the envelope schema, protocol context, and user text', () => {
    const prompt = buildUserPrompt({
      taskPayload: {
        protocol_context: 'be terse',
        inputs: { text: 'hello' },
      },
      envelope_schema: { type: 'object', required: ['answer'] },
    });
    expect(prompt).toContain('Envelope schema');
    expect(prompt).toContain('"required"');
    expect(prompt).toContain('be terse');
    expect(prompt).toContain('hello');
  });

  it('encodes image inputs as a base64 data URL', () => {
    const prompt = buildUserPrompt({
      taskPayload: {
        inputs: { text: 'what is in this image?', image_base64: 'aGVsbG8=', image_mime: 'image/jpeg' },
      },
      envelope_schema: { type: 'object' },
    });
    expect(prompt).toContain('data:image/jpeg;base64,aGVsbG8=');
    expect(prompt).toContain('Reason over the image');
  });
});

describe('parseClaudeOutput — happy path', () => {
  it('extracts a JSON envelope from the result field', () => {
    const stdout = JSON.stringify({
      result: '{"answer":"blue"}',
      model: 'claude-opus-4-7',
    });
    const out = parseClaudeOutput(stdout);
    expect(out.envelope).toEqual({ answer: 'blue' });
    expect(out.model).toBe('claude-opus-4-7');
  });

  it('strips a JSON markdown fence before parsing', () => {
    const fenced = '```json\n{"answer":"ok"}\n```';
    const stdout = JSON.stringify({ result: fenced, model: 'm' });
    const out = parseClaudeOutput(stdout);
    expect(out.envelope.answer).toBe('ok');
  });

  it('falls back to null model when neither model nor modelId is present', () => {
    const stdout = JSON.stringify({ result: '{"answer":"x"}' });
    const out = parseClaudeOutput(stdout);
    expect(out.model).toBeNull();
  });
});

describe('parseClaudeOutput — failure paths', () => {
  it('throws RUNTIME_OUTPUT_INVALID on non-JSON outer payload', () => {
    expect(() => parseClaudeOutput('not json at all'))
      .toThrow(AgentRuntimeError);
    try { parseClaudeOutput('not json'); } catch (err) {
      expect(err.code).toBe('RUNTIME_OUTPUT_INVALID');
    }
  });

  it('throws RUNTIME_OUTPUT_INVALID when result is missing or non-string', () => {
    expect(() => parseClaudeOutput(JSON.stringify({})))
      .toThrow(/missing string 'result'/);
    expect(() => parseClaudeOutput(JSON.stringify({ result: 42 })))
      .toThrow(/missing string 'result'/);
  });

  it('throws RUNTIME_OUTPUT_INVALID when inner result is not valid JSON', () => {
    const stdout = JSON.stringify({ result: 'sure thing!' });
    try {
      parseClaudeOutput(stdout);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentRuntimeError);
      expect(err.code).toBe('RUNTIME_OUTPUT_INVALID');
    }
  });

  it('throws RUNTIME_REJECTS_INPUT when envelope is a cancel sentinel', () => {
    const stdout = JSON.stringify({
      result: JSON.stringify({ _cancel: 'image unreadable' }),
    });
    try {
      parseClaudeOutput(stdout);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentRuntimeError);
      expect(err.code).toBe('RUNTIME_REJECTS_INPUT');
      expect(err.message).toBe('image unreadable');
    }
  });
});
