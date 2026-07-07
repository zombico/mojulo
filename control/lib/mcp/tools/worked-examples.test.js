import { describe, it, expect } from 'vitest';
import {
  ALL_TRACE_TEXT,
  WORKED_EXAMPLE_PARADIGMS,
  workedExampleHandler,
} from './worked-examples.js';

describe('get_worked_example — the transcript drawer', () => {
  it('no-arg call returns the index naming every paradigm', async () => {
    const { content } = await workedExampleHandler({});
    const text = content[0].text;
    for (const p of WORKED_EXAMPLE_PARADIGMS) {
      expect(text).toContain(`\`${p}\``);
    }
  });

  it('each paradigm returns its trace, and every trace carries a refusal + recovery moment', async () => {
    for (const p of WORKED_EXAMPLE_PARADIGMS) {
      const { content } = await workedExampleHandler({ paradigm: p });
      const text = content[0].text;
      expect(text).toContain('# Worked example');
      // Every trace must include one deliberate refusal so the first "no" an
      // agent meets in the wild is a recognized shape (orientation-ramp R2).
      expect(/refus|reject|fails/i.test(text)).toBe(true);
    }
  });

  it('unknown paradigm returns the available list plus a next: clause, never throws', async () => {
    const { content } = await workedExampleHandler({ paradigm: 'spaceship' });
    const text = content[0].text;
    expect(text).toContain('next:');
    expect(text).toContain('bot');
  });

  it('HONESTY GATE: every `tool_name(...)` mention in every trace resolves in the live registry', async () => {
    // Traces are hand-authored and must not rot into fiction when tools
    // rename. Convention (see the worked-examples.js header): every step that
    // is a real tool call is written backticked with parens — `tool_name({…})`
    // — and exactly that shape is swept here. Prose mentions without parens
    // are not checked.
    const { ensureToolsRegistered, listTools } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    const registered = new Set(listTools().map((t) => t.name));

    const mentioned = new Set();
    const re = /`([a-z][a-z0-9_]+)\(/g;
    let m;
    while ((m = re.exec(ALL_TRACE_TEXT)) !== null) mentioned.add(m[1]);

    // Sanity: the sweep actually found the traces' call mentions.
    expect(mentioned.size).toBeGreaterThan(20);

    const fictional = [...mentioned].filter((name) => !registered.has(name));
    expect(fictional).toEqual([]);
  });
});
