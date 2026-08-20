/**
 * mojulo CLI — the second front door over the same tool registry
 * (P1+P2 of [mojulo-cli.plan.md]).
 *
 * Reached via the subcommand branch in mcp-stdio.mjs (`npx mojulo tools|
 * packs|help|call|pack_* …`), which has already registered the `@/` loader,
 * resolved MOJULO_HOME paths, chdir'd to control/, and pinned stray
 * console.log output to stderr. This module owns real stdout: results go
 * through `out()`, diagnostics through `err()`, so `mojulo call … | jq`
 * stays clean.
 *
 * Invocation is in-process — no HTTP, no bearer token, no running dashboard
 * required. `call` dispatches a synthetic `tools/call` through
 * dispatchMcpRequest with mcpSessionId 'cli', so serialization, telemetry,
 * timeout handling, and deprecated-alias resolution are byte-identical to
 * the MCP surface, and telemetry rows carry the surface marker. The
 * `mojulo <pack_id> <tool>` form dispatches THROUGH the pack tool — the
 * exact packs-mode path, including server-side membership validation.
 *
 * Help text and flag names are GENERATED from the registry (tool
 * descriptions, input schemas, the pack partition) — the CLI authors no
 * prose of its own.
 *
 * Exit codes: 0 success, 1 tool-level error, 2 usage/parse error,
 * 124 --timeout elapsed (coreutils convention).
 */

export const USAGE = `Usage:
  mojulo tools                 list the connect surface (spine + packs)
  mojulo tools <pack_id>       list one pack's members
  mojulo packs                 list pack ids with their recognizers
  mojulo help <tool|pack>      full description + input schema
  mojulo call <tool> [args]    invoke a tool
  mojulo <pack_id>             open a pack (orientation + member manual)
  mojulo <pack_id> <tool> [args]   invoke a member through its pack

  [args] forms (combinable; flags win over --json):
    --json <v>       arguments as inline JSON object, @file.json, or - (stdin)
    --<prop> <val>   any top-level schema property of the tool
                     (bare --<prop> for booleans; JSON literal for nested)
    --timeout <ms>   give up waiting after <ms> (exit 124; long-poll tools)
    --quiet          suppress result output; exit code only
  (no subcommand)              run as a stdio MCP server`;

const RESERVED_FLAGS = new Set(['--json', '--timeout', '--quiet']);

/**
 * Parse the arg tokens that follow a tool name in `call` / pack-dispatch
 * forms. Pure. Collects schema-property flags as raw [key, value|true]
 * pairs — coercion needs the tool's schema and happens in coerceFlags().
 */
export function parseCallFlags(tokens) {
  const result = { json: null, timeoutMs: null, quiet: false, flags: [] };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('--')) return { error: `unexpected argument: ${token}` };
    if (token === '--json') {
      if (result.json !== null) return { error: '--json given twice' };
      if (i + 1 >= tokens.length) return { error: '--json requires a value (inline JSON, @file, or -)' };
      result.json = tokens[++i];
    } else if (token === '--timeout') {
      const raw = tokens[++i];
      const ms = Number(raw);
      if (!raw || !Number.isInteger(ms) || ms <= 0) return { error: '--timeout requires a positive integer (milliseconds)' };
      result.timeoutMs = ms;
    } else if (token === '--quiet') {
      result.quiet = true;
    } else {
      const key = token.slice(2);
      if (!key) return { error: 'empty flag name' };
      const next = tokens[i + 1];
      // A following token is this flag's value unless it is itself a flag;
      // bare flags carry `true` and are only valid for boolean properties
      // (enforced against the schema in coerceFlags).
      if (next !== undefined && !next.startsWith('--')) {
        result.flags.push([key, tokens[++i]]);
      } else {
        result.flags.push([key, true]);
      }
    }
  }
  return result;
}

/**
 * Parse `process.argv.slice(2)` for the CLI subcommands. Pure — returns
 * either a command descriptor or { error } for usage problems; never exits,
 * never touches the registry.
 */
export function parseArgv(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'tools': {
      if (rest.length > 1) return { error: `tools takes at most one pack id, got: ${rest.join(' ')}` };
      return { command: 'tools', pack: rest[0] ?? null };
    }
    case 'packs': {
      if (rest.length > 0) return { error: `packs takes no arguments, got: ${rest.join(' ')}` };
      return { command: 'packs' };
    }
    case 'help': {
      if (rest.length !== 1) return { error: 'help takes exactly one tool or pack name' };
      return { command: 'help', name: rest[0] };
    }
    case 'call': {
      const [name, ...tokens] = rest;
      if (!name || name.startsWith('--')) return { error: 'call requires a tool name' };
      const parsed = parseCallFlags(tokens);
      if (parsed.error) return parsed;
      return { command: 'call', name, ...parsed };
    }
    default: {
      // `mojulo pack_audio [create_beats --seed 7]` — pack unveil / dispatch
      // sugar. The pack_ prefix is a reserved word on the bin (see the
      // allowlist in mcp-stdio.mjs).
      if (command?.startsWith('pack_')) {
        const [name, ...tokens] = rest;
        if (name === undefined) return { command: 'pack', pack: command, name: null };
        if (name.startsWith('--')) return { error: `pack dispatch needs a tool name before flags` };
        const parsed = parseCallFlags(tokens);
        if (parsed.error) return parsed;
        return { command: 'pack', pack: command, name, ...parsed };
      }
      return { error: `unknown command: ${command}` };
    }
  }
}

/** First line of a description, truncated for one-row listings. Pure. */
export function firstLine(text, max = 96) {
  const line = String(text || '').split('\n', 1)[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Coerce raw [key, value|true] flag pairs against a tool's input schema.
 * Pure. Primitive properties coerce from the flag string; anything nested
 * (object/array/untyped) takes a JSON literal. Unknown keys are usage
 * errors — `--json` stays the escape hatch for exotic schemas.
 * Returns { args } or { error }.
 */
export function coerceFlags(pairs, schema) {
  const props = schema?.properties || {};
  const args = {};
  for (const [key, raw] of pairs) {
    if (RESERVED_FLAGS.has(`--${key}`)) return { error: `--${key} is reserved` };
    const prop = props[key];
    if (!prop) {
      const known = Object.keys(props);
      return {
        error:
          `unknown argument --${key} for this tool` +
          (known.length ? ` (schema properties: ${known.join(', ')})` : ' (schema lists no properties — use --json)'),
      };
    }
    const type = prop.type;
    if (raw === true) {
      if (type !== 'boolean') return { error: `--${key} requires a value` };
      args[key] = true;
    } else if (type === 'boolean') {
      if (raw !== 'true' && raw !== 'false') return { error: `--${key} must be true or false` };
      args[key] = raw === 'true';
    } else if (type === 'number' || type === 'integer') {
      const n = Number(raw);
      if (Number.isNaN(n)) return { error: `--${key} must be a number` };
      args[key] = n;
    } else if (type === 'string') {
      args[key] = raw;
    } else {
      try {
        args[key] = JSON.parse(raw);
      } catch {
        return { error: `--${key} takes a JSON literal (schema type: ${type || 'unspecified'})` };
      }
    }
  }
  return { args };
}

/**
 * Resolve the `--json` value to an arguments object. `@path` reads a file,
 * `-` reads stdin, anything else parses inline; null (flag omitted) is {}.
 * Throws with a usage-worthy message on bad JSON or non-object payloads.
 */
export async function resolveCallArguments(json, { readFile, readStdin }) {
  let raw;
  if (json === null) raw = '{}';
  else if (json === '-') raw = await readStdin();
  else if (json.startsWith('@')) raw = await readFile(json.slice(1));
  else raw = json;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`--json is not valid JSON: ${e.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--json must be a JSON object of tool arguments');
  }
  return parsed;
}

async function readStdinText() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

const CONTEXT = { mcpSessionId: 'cli', userId: 'local' };
let rpcId = 0;

/**
 * Run the CLI and return the process exit code. Registry imports live here
 * (not module top) so the pure parsers above stay importable without the
 * `@/` loader or a database.
 */
export async function runCli(argv, io = {}) {
  const out = io.out ?? ((line) => process.stdout.write(line + '\n'));
  const err = io.err ?? ((line) => process.stderr.write(line + '\n'));
  const isTTY = io.isTTY ?? Boolean(process.stdout.isTTY);

  const parsed = parseArgv(argv);
  if (parsed.error) {
    err(`mojulo: ${parsed.error}`);
    err(USAGE);
    return 2;
  }

  const server = await import('@/lib/mcp/server');
  const packs = await import('@/lib/mcp/packs');
  await server.ensureToolsRegistered();

  // Tab-separated when piped (stable for cut/awk); padded columns on a TTY.
  const listRow = (rows) => {
    if (!isTTY) return rows.map(([name, desc]) => `${name}\t${desc}`);
    const width = Math.max(...rows.map(([name]) => name.length));
    return rows.map(([name, desc]) => `${name.padEnd(width + 2)}${desc}`);
  };

  // Dispatch one tools/call and render the result. Shared by `call` and
  // pack dispatch. Returns the exit code.
  const invoke = async ({ name, args, timeoutMs, quiet }) => {
    const dispatch = server.dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: ++rpcId,
        method: 'tools/call',
        params: { name, arguments: args },
      },
      CONTEXT
    );

    let timer;
    let resp;
    try {
      resp = await (timeoutMs
        ? Promise.race([
            dispatch,
            new Promise((resolve) => {
              timer = setTimeout(() => resolve('__timeout__'), timeoutMs);
            }),
          ])
        : dispatch);
    } finally {
      clearTimeout(timer);
    }

    if (resp === '__timeout__') {
      err(`mojulo: ${name} did not answer within ${timeoutMs}ms`);
      return 124;
    }
    if (resp?.error) {
      err(`mojulo: ${resp.error.message || 'call failed'}`);
      return 1;
    }
    const result = resp?.result || {};
    if (!quiet) {
      for (const item of result.content || []) {
        if (item?.type === 'text') out(item.text);
      }
    }
    return result.isError ? 1 : 0;
  };

  const resolveArgs = async () => {
    const base = await resolveCallArguments(parsed.json, {
      readFile: async (p) => (await import('node:fs/promises')).readFile(p, 'utf8'),
      readStdin: io.readStdin ?? readStdinText,
    });
    const tool = server.getRegisteredTool(parsed.name);
    if (!tool) {
      const e = new Error(`unknown tool: ${parsed.name} (run \`mojulo tools\`)`);
      e.usage = true;
      throw e;
    }
    const coerced = coerceFlags(parsed.flags, tool.inputSchema);
    if (coerced.error) {
      const e = new Error(coerced.error);
      e.usage = true;
      throw e;
    }
    return { ...base, ...coerced.args };
  };

  switch (parsed.command) {
    case 'tools': {
      if (parsed.pack) {
        const pack = packs.PACKS.find((p) => p.id === parsed.pack);
        if (!pack) {
          err(`mojulo: unknown pack: ${parsed.pack} (run \`mojulo packs\`)`);
          return 2;
        }
        const memberSet = new Set(pack.members);
        const rows = packs.dispatchTargets(pack).map((name) => {
          const tool = server.getRegisteredTool(name);
          const shared = memberSet.has(name) ? '' : ' (shared)';
          return [`${name}${shared}`, firstLine(tool?.description)];
        });
        for (const line of listRow(rows)) out(line);
        return 0;
      }
      const rows = [
        ...packs.SPINE.map((name) => [name, firstLine(server.getRegisteredTool(name)?.description)]),
        ...packs.PACKS.map((pack) => [pack.id, firstLine(pack.description)]),
      ];
      for (const line of listRow(rows)) out(line);
      return 0;
    }

    case 'packs': {
      const rows = packs.PACKS.map((pack) => [pack.id, firstLine(pack.description)]);
      for (const line of listRow(rows)) out(line);
      return 0;
    }

    case 'help': {
      const tool = server.getRegisteredTool(parsed.name);
      if (!tool) {
        err(`mojulo: unknown tool: ${parsed.name} (run \`mojulo tools\`)`);
        return 2;
      }
      const home = packs.homePackForTool(parsed.name);
      out(`# ${tool.name}${home ? `  (pack: ${home.id})` : ''}`);
      if (tool.description) out(`\n${tool.description}`);
      out(`\ninputSchema:`);
      out(JSON.stringify(tool.inputSchema || { type: 'object', properties: {} }, null, 2));
      return 0;
    }

    case 'call': {
      let args;
      try {
        args = await resolveArgs();
      } catch (e) {
        err(`mojulo: ${e.message}`);
        return 2;
      }
      return invoke({ name: parsed.name, args, timeoutMs: parsed.timeoutMs, quiet: parsed.quiet });
    }

    case 'pack': {
      if (!server.hasRegisteredTool(parsed.pack)) {
        err(`mojulo: unknown pack: ${parsed.pack} (run \`mojulo packs\`)`);
        return 2;
      }
      if (parsed.name === null) {
        // Bare pack → unveil: orientation body + member manual.
        return invoke({ name: parsed.pack, args: {}, timeoutMs: null, quiet: false });
      }
      let args;
      try {
        args = await resolveArgs();
      } catch (e) {
        err(`mojulo: ${e.message}`);
        return 2;
      }
      // Dispatch THROUGH the pack — the packs-mode path; the dispatcher
      // validates membership server-side.
      return invoke({
        name: parsed.pack,
        args: { tool: parsed.name, args },
        timeoutMs: parsed.timeoutMs,
        quiet: parsed.quiet,
      });
    }
  }
  // Unreachable — parseArgv covers every command — but a changed enum
  // should fail loudly as usage, not fall through as success.
  err(`mojulo: ${USAGE}`);
  return 2;
}
