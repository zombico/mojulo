// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as lib/mcp/packs.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import {
  parseArgv,
  parseCallFlags,
  firstLine,
  coerceFlags,
  resolveCallArguments,
  runCli,
} from './mcp-cli.mjs';
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
    expect(parseArgv(['call', 'version'])).toMatchObject({
      command: 'call',
      name: 'version',
      json: null,
      timeoutMs: null,
      quiet: false,
      flags: [],
    });
    expect(parseArgv(['call', 'cook', '--json', '{"a":1}'])).toMatchObject({
      command: 'call',
      name: 'cook',
      json: '{"a":1}',
    });
  });

  it('parses pack sugar: bare unveil and member dispatch', () => {
    expect(parseArgv(['pack_audio'])).toEqual({ command: 'pack', pack: 'pack_audio', name: null });
    expect(parseArgv(['pack_audio', 'create_beats', '--json', '{}'])).toMatchObject({
      command: 'pack',
      pack: 'pack_audio',
      name: 'create_beats',
      json: '{}',
    });
    expect(parseArgv(['pack_audio', '--json', '{}']).error).toMatch(/tool name before flags/);
  });

  it('rejects usage errors without exiting', () => {
    expect(parseArgv(['tools', 'a', 'b']).error).toMatch(/at most one/);
    expect(parseArgv(['packs', 'x']).error).toMatch(/no arguments/);
    expect(parseArgv(['help']).error).toMatch(/exactly one/);
    expect(parseArgv(['call']).error).toMatch(/requires a tool name/);
    expect(parseArgv(['call', '--json']).error).toMatch(/requires a tool name/);
    expect(parseArgv(['call', 'cook', '--json']).error).toMatch(/requires a value/);
    expect(parseArgv(['call', 'cook', '--json', '{}', '--json', '{}']).error).toMatch(/twice/);
    // The stdio-mode fallback in mcp-stdio.mjs never reaches parseArgv, but a
    // non-allowlisted word arriving here must be a usage error, not a crash.
    expect(parseArgv(['serve']).error).toMatch(/unknown command/);
  });
});

describe('parseCallFlags', () => {
  it('collects schema-property flags as raw pairs', () => {
    expect(parseCallFlags(['--theme', 'dungeon', '--seed', '7'])).toMatchObject({
      flags: [
        ['theme', 'dungeon'],
        ['seed', '7'],
      ],
    });
    // Bare flag (boolean-style) and negative-number values.
    expect(parseCallFlags(['--force', '--offset', '-5'])).toMatchObject({
      flags: [
        ['force', true],
        ['offset', '-5'],
      ],
    });
  });

  it('parses reserved flags and rejects bad shapes', () => {
    expect(parseCallFlags(['--timeout', '500', '--quiet'])).toMatchObject({
      timeoutMs: 500,
      quiet: true,
    });
    expect(parseCallFlags(['--timeout', 'soon']).error).toMatch(/positive integer/);
    expect(parseCallFlags(['--timeout']).error).toMatch(/positive integer/);
    expect(parseCallFlags(['stray']).error).toMatch(/unexpected argument/);
  });
});

describe('coerceFlags', () => {
  const schema = {
    type: 'object',
    properties: {
      msg: { type: 'string' },
      n: { type: 'number' },
      count: { type: 'integer' },
      on: { type: 'boolean' },
      cfg: { type: 'object' },
      anything: {},
    },
  };

  it('coerces primitives by schema type', () => {
    expect(
      coerceFlags(
        [
          ['msg', 'hello'],
          ['n', '2.5'],
          ['count', '7'],
          ['on', 'true'],
        ],
        schema
      )
    ).toEqual({ args: { msg: 'hello', n: 2.5, count: 7, on: true } });
    expect(coerceFlags([['on', true]], schema)).toEqual({ args: { on: true } });
  });

  it('takes JSON literals for nested/untyped properties', () => {
    expect(coerceFlags([['cfg', '{"a":1}']], schema)).toEqual({ args: { cfg: { a: 1 } } });
    expect(coerceFlags([['anything', '[1,2]']], schema)).toEqual({ args: { anything: [1, 2] } });
    expect(coerceFlags([['cfg', 'not-json']], schema).error).toMatch(/JSON literal/);
  });

  it('rejects unknown keys, bad values, and bare non-booleans', () => {
    expect(coerceFlags([['nope', 'x']], schema).error).toMatch(/unknown argument --nope/);
    expect(coerceFlags([['nope', 'x']], schema).error).toMatch(/msg, n, count/);
    expect(coerceFlags([['n', 'many']], schema).error).toMatch(/must be a number/);
    expect(coerceFlags([['on', 'yes']], schema).error).toMatch(/true or false/);
    expect(coerceFlags([['msg', true]], schema).error).toMatch(/requires a value/);
    expect(coerceFlags([['json', 'x']], schema).error).toMatch(/reserved/);
    expect(coerceFlags([['x', 'y']], { type: 'object' }).error).toMatch(/use --json/);
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

function capture(extra = {}) {
  const lines = { out: [], err: [] };
  return {
    lines,
    io: { out: (l) => lines.out.push(l), err: (l) => lines.err.push(l), ...extra },
  };
}

describe('runCli', () => {
  beforeAll(async () => {
    const server = await import('@/lib/mcp/server');
    await server.ensureToolsRegistered();
    // Deterministic test-only tools — invoking real tools' failure/slow
    // paths would couple the test to their internals.
    server.registerTool({
      name: '__cli_test_throws',
      description: 'test-only throwing tool',
      listed: false,
      handler: () => {
        throw new Error('deliberate test failure');
      },
    });
    server.registerTool({
      name: '__cli_test_echo',
      description: 'test-only echo tool',
      listed: false,
      inputSchema: {
        type: 'object',
        properties: {
          msg: { type: 'string' },
          n: { type: 'number' },
          on: { type: 'boolean' },
        },
      },
      handler: (input) => JSON.stringify(input),
    });
    server.registerTool({
      name: '__cli_test_slow',
      description: 'test-only slow tool',
      listed: false,
      handler: () => new Promise((resolve) => setTimeout(() => resolve('late'), 300)),
    });
  });

  it('tools lists the connect surface: spine then packs', async () => {
    const { lines, io } = capture();
    expect(await runCli(['tools'], io)).toBe(0);
    expect(lines.out.length).toBe(SPINE.length + PACKS.length);
    expect(lines.out[0].startsWith(`${SPINE[0]}\t`)).toBe(true);
    expect(lines.out.at(-1).startsWith(`${PACKS.at(-1).id}\t`)).toBe(true);
  });

  it('pads columns on a TTY, tabs when piped', async () => {
    const tty = capture({ isTTY: true });
    expect(await runCli(['packs'], tty.io)).toBe(0);
    expect(tty.lines.out.every((l) => !l.includes('\t'))).toBe(true);
    // All descriptions start at the same column.
    expect(new Set(tty.lines.out.map((l) => l.match(/^\S+\s+/)[0].length)).size).toBe(1);

    const piped = capture({ isTTY: false });
    expect(await runCli(['packs'], piped.io)).toBe(0);
    expect(piped.lines.out.every((l) => l.includes('\t'))).toBe(true);
  });

  it('tools <pack> lists members; unknown pack is a usage error', async () => {
    const { lines, io } = capture();
    expect(await runCli(['tools', 'pack_fleet'], io)).toBe(0);
    const names = lines.out.map((l) => l.split('\t')[0]);
    expect(names).toEqual(
      expect.arrayContaining(['fleet_query_conversations', 'fleet_analytics_summary', 'verify_fleet_chains'])
    );

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

  it('call coerces schema flags and merges them over --json (flags win)', async () => {
    const { lines, io } = capture();
    expect(
      await runCli(
        ['call', '__cli_test_echo', '--json', '{"msg":"base","n":1}', '--msg', 'hello', '--on', '--n', '2.5'],
        io
      )
    ).toBe(0);
    expect(JSON.parse(lines.out.join('\n'))).toEqual({ msg: 'hello', n: 2.5, on: true });

    const bad = capture();
    expect(await runCli(['call', '__cli_test_echo', '--nope', 'x'], bad.io)).toBe(2);
    expect(bad.lines.err.join('\n')).toMatch(/unknown argument --nope/);
  });

  it('--quiet suppresses output but keeps the exit code', async () => {
    const ok = capture();
    expect(await runCli(['call', 'version', '--quiet'], ok.io)).toBe(0);
    expect(ok.lines.out.length).toBe(0);

    const failed = capture();
    expect(await runCli(['call', '__cli_test_throws', '--quiet'], failed.io)).toBe(1);
  });

  it('--timeout exits 124 when the tool outlasts it, 0 when it answers', async () => {
    const slow = capture();
    expect(await runCli(['call', '__cli_test_slow', '--timeout', '50'], slow.io)).toBe(124);
    expect(slow.lines.err.join('\n')).toMatch(/did not answer within 50ms/);

    const fast = capture();
    expect(await runCli(['call', '__cli_test_slow', '--timeout', '5000'], fast.io)).toBe(0);
  });

  it('pack sugar: bare pack unveils; member dispatch runs through the pack', async () => {
    const unveil = capture();
    expect(await runCli(['pack_fleet'], unveil.io)).toBe(0);
    const text = unveil.lines.out.join('\n');
    expect(text).toMatch(/pack_fleet/);
    expect(text).toMatch(/Member manual/);

    const dispatch = capture();
    expect(await runCli(['pack_bot_operate', 'list_deployments'], dispatch.io)).toBe(0);

    // A tool that is not a dispatch target of this pack fails at the
    // dispatcher (tool-level error, not usage).
    const wrongPack = capture();
    expect(await runCli(['pack_fleet', 'list_deployments'], wrongPack.io)).toBe(1);

    const unknownPack = capture();
    expect(await runCli(['pack_nope', 'whatever'], unknownPack.io)).toBe(2);
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
