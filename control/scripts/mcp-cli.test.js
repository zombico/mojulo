// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as lib/mcp/packs.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { parseArgv, firstLine, resolveCallArguments, runCli } from './mcp-cli.mjs';
import { PACKS, SPINE } from '@/lib/mcp/packs';

// ---------------------------------------------------------------------------
// Pure parsers — no registry, no DB.
// ---------------------------------------------------------------------------

describe('parseArgv', () => {
  it('parses each command shape', () => {
    expect(parseArgv(['tools'])).toEqual({ command: 'tools', pack: null });
    expect(parseArgv(['tools', 'pack_fleet'])).toEqual({ command: 'tools', pack: 'pack_fleet' });
    expect(parseArgv(['packs'])).toEqual({ command: 'packs' });
    expect(parseArgv(['help', 'cook'])).toEqual({ command: 'help', name: 'cook' });
    expect(parseArgv(['call', 'version'])).toEqual({ command: 'call', name: 'version', json: null });
    expect(parseArgv(['call', 'cook', '--json', '{"a":1}'])).toEqual({
      command: 'call',
      name: 'cook',
      json: '{"a":1}',
    });
  });

  it('rejects usage errors without exiting', () => {
    expect(parseArgv(['tools', 'a', 'b']).error).toMatch(/at most one/);
    expect(parseArgv(['packs', 'x']).error).toMatch(/no arguments/);
    expect(parseArgv(['help']).error).toMatch(/exactly one/);
    expect(parseArgv(['call']).error).toMatch(/requires a tool name/);
    expect(parseArgv(['call', '--json']).error).toMatch(/requires a tool name/);
    expect(parseArgv(['call', 'cook', '--json']).error).toMatch(/requires a value/);
    expect(parseArgv(['call', 'cook', '--nope']).error).toMatch(/unknown argument/);
    expect(parseArgv(['call', 'cook', '--json', '{}', '--json', '{}']).error).toMatch(/twice/);
    // The stdio-mode fallback in mcp-stdio.mjs never reaches parseArgv, but a
    // non-allowlisted word arriving here must be a usage error, not a crash.
    expect(parseArgv(['serve']).error).toMatch(/unknown command/);
  });
});

describe('firstLine', () => {
  it('takes the first line and truncates long ones', () => {
    expect(firstLine('one\ntwo')).toBe('one');
    expect(firstLine('  padded  \nrest')).toBe('padded');
    expect(firstLine(null)).toBe('');
    const long = 'x'.repeat(200);
    expect(firstLine(long).length).toBe(96);
    expect(firstLine(long).endsWith('…')).toBe(true);
  });
});

describe('resolveCallArguments', () => {
  const io = {
    readFile: async (p) => (p === 'args.json' ? '{"fromFile":true}' : Promise.reject(new Error('no such file'))),
    readStdin: async () => '{"fromStdin":true}',
  };

  it('resolves the four --json forms', async () => {
    expect(await resolveCallArguments(null, io)).toEqual({});
    expect(await resolveCallArguments('{"inline":1}', io)).toEqual({ inline: 1 });
    expect(await resolveCallArguments('@args.json', io)).toEqual({ fromFile: true });
    expect(await resolveCallArguments('-', io)).toEqual({ fromStdin: true });
  });

  it('rejects invalid JSON and non-object payloads', async () => {
    await expect(resolveCallArguments('{nope', io)).rejects.toThrow(/not valid JSON/);
    await expect(resolveCallArguments('[1,2]', io)).rejects.toThrow(/JSON object/);
    await expect(resolveCallArguments('"str"', io)).rejects.toThrow(/JSON object/);
    await expect(resolveCallArguments('null', io)).rejects.toThrow(/JSON object/);
  });
});

// ---------------------------------------------------------------------------
// runCli end-to-end against the real registry (in-memory DB). Vitest resolves
// `@/` via its own alias, so no loader registration is needed here.
// ---------------------------------------------------------------------------

function capture() {
  const lines = { out: [], err: [] };
  return {
    lines,
    io: { out: (l) => lines.out.push(l), err: (l) => lines.err.push(l) },
  };
}

describe('runCli', () => {
  beforeAll(async () => {
    const server = await import('@/lib/mcp/server');
    await server.ensureToolsRegistered();
    // Deterministic tool-level failure for the exit-code contract — invoking
    // a real tool's failure path would couple the test to that tool's
    // internals.
    server.registerTool({
      name: '__cli_test_throws',
      description: 'test-only throwing tool',
      listed: false,
      handler: () => {
        throw new Error('deliberate test failure');
      },
    });
  });

  it('tools lists the connect surface: spine then packs', async () => {
    const { lines, io } = capture();
    expect(await runCli(['tools'], io)).toBe(0);
    expect(lines.out.length).toBe(SPINE.length + PACKS.length);
    expect(lines.out[0].startsWith(`${SPINE[0]}\t`)).toBe(true);
    expect(lines.out.at(-1).startsWith(`${PACKS.at(-1).id}\t`)).toBe(true);
  });

  it('tools <pack> lists members; unknown pack is a usage error', async () => {
    const { lines, io } = capture();
    expect(await runCli(['tools', 'pack_fleet'], io)).toBe(0);
    const names = lines.out.map((l) => l.split('\t')[0]);
    expect(names).toEqual(expect.arrayContaining(['fleet_query_conversations', 'fleet_analytics_summary', 'verify_fleet_chains']));

    const bad = capture();
    expect(await runCli(['tools', 'pack_nope'], bad.io)).toBe(2);
    expect(bad.lines.err.join('\n')).toMatch(/unknown pack/);
  });

  it('help prints description + schema; unknown tool exits 2', async () => {
    const { lines, io } = capture();
    expect(await runCli(['help', 'version'], io)).toBe(0);
    const text = lines.out.join('\n');
    expect(text).toMatch(/^# version/);
    expect(text).toMatch(/inputSchema:/);

    const bad = capture();
    expect(await runCli(['help', 'no_such_tool'], bad.io)).toBe(2);
  });

  it('call invokes a tool and prints its content to stdout', async () => {
    const { lines, io } = capture();
    expect(await runCli(['call', 'version'], io)).toBe(0);
    expect(lines.out.length).toBeGreaterThan(0);
    expect(lines.err.length).toBe(0);
  });

  it('call exit codes: 1 for tool errors, 2 for usage', async () => {
    const threw = capture();
    expect(await runCli(['call', '__cli_test_throws'], threw.io)).toBe(1);
    expect(threw.lines.out.join('\n')).toMatch(/deliberate test failure/);

    const unknown = capture();
    expect(await runCli(['call', 'no_such_tool'], unknown.io)).toBe(2);

    const badJson = capture();
    expect(await runCli(['call', 'version', '--json', '{nope'], badJson.io)).toBe(2);
    expect(badJson.lines.err.join('\n')).toMatch(/not valid JSON/);
  });

  it('usage errors print USAGE to stderr and exit 2', async () => {
    const { lines, io } = capture();
    expect(await runCli(['bogus'], io)).toBe(2);
    expect(lines.err.join('\n')).toMatch(/Usage:/);
    expect(lines.out.length).toBe(0);
  });
});
