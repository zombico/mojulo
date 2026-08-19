/**
 * mojulo CLI — the second front door over the same tool registry
 * (P1 of [mojulo-cli.plan.md]).
 *
 * Reached via the subcommand branch in mcp-stdio.mjs (`npx mojulo tools|
 * packs|help|call …`), which has already registered the `@/` loader,
 * resolved MOJULO_HOME paths, chdir'd to control/, and pinned stray
 * console.log output to stderr. This module owns real stdout: results go
 * through `out()`, diagnostics through `err()`, so `mojulo call … | jq`
 * stays clean.
 *
 * Invocation is in-process — no HTTP, no bearer token, no running dashboard
 * required. `call` dispatches a synthetic `tools/call` through
 * dispatchMcpRequest with mcpSessionId 'cli', so serialization, telemetry,
 * timeout handling, and deprecated-alias resolution are byte-identical to
 * the MCP surface, and telemetry rows carry the surface marker.
 *
 * Help text is GENERATED from the registry (tool descriptions, input
 * schemas, the pack partition) — the CLI authors no prose of its own.
 *
 * Exit codes: 0 success, 1 tool-level error, 2 usage/parse error.
 */

export const USAGE = `Usage:
  mojulo tools                 list the connect surface (spine + packs)
  mojulo tools <pack_id>       list one pack's members
  mojulo packs                 list pack ids with their recognizers
  mojulo help <tool|pack>      full description + input schema
  mojulo call <tool> --json <args>   invoke a tool

  <args> forms: an inline JSON object, @file.json, or - (read stdin).
  (no subcommand)              run as a stdio MCP server`;

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
      const [name, ...flags] = rest;
      if (!name || name.startsWith('--')) return { error: 'call requires a tool name' };
      let json = null;
      for (let i = 0; i < flags.length; i++) {
        if (flags[i] === '--json') {
          if (json !== null) return { error: '--json given twice' };
          if (i + 1 >= flags.length) return { error: '--json requires a value (inline JSON, @file, or -)' };
          json = flags[++i];
        } else {
          return { error: `unknown argument: ${flags[i]}` };
        }
      }
      return { command: 'call', name, json };
    }
    default:
      return { error: `unknown command: ${command}` };
  }
}

/** First line of a description, truncated for one-row listings. Pure. */
export function firstLine(text, max = 96) {
  const line = String(text || '').split('\n', 1)[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
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

  const parsed = parseArgv(argv);
  if (parsed.error) {
    err(`mojulo: ${parsed.error}`);
    err(USAGE);
    return 2;
  }

  const server = await import('@/lib/mcp/server');
  const packs = await import('@/lib/mcp/packs');
  await server.ensureToolsRegistered();

  switch (parsed.command) {
    case 'tools': {
      if (parsed.pack) {
        const pack = packs.PACKS.find((p) => p.id === parsed.pack);
        if (!pack) {
          err(`mojulo: unknown pack: ${parsed.pack} (run \`mojulo packs\`)`);
          return 2;
        }
        const memberSet = new Set(pack.members);
        for (const name of packs.dispatchTargets(pack)) {
          const tool = server.getRegisteredTool(name);
          const shared = memberSet.has(name) ? '' : ' (shared)';
          out(`${name}${shared}\t${firstLine(tool?.description)}`);
        }
        return 0;
      }
      for (const name of packs.SPINE) {
        const tool = server.getRegisteredTool(name);
        out(`${name}\t${firstLine(tool?.description)}`);
      }
      for (const pack of packs.PACKS) {
        out(`${pack.id}\t${firstLine(pack.description)}`);
      }
      return 0;
    }

    case 'packs': {
      for (const pack of packs.PACKS) {
        out(`${pack.id}\t${firstLine(pack.description)}`);
      }
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
        args = await resolveCallArguments(parsed.json, {
          readFile: async (p) => (await import('node:fs/promises')).readFile(p, 'utf8'),
          readStdin: io.readStdin ?? readStdinText,
        });
      } catch (e) {
        err(`mojulo: ${e.message}`);
        return 2;
      }

      if (!server.hasRegisteredTool(parsed.name)) {
        err(`mojulo: unknown tool: ${parsed.name} (run \`mojulo tools\`)`);
        return 2;
      }

      const resp = await server.dispatchMcpRequest(
        {
          jsonrpc: '2.0',
          id: ++rpcId,
          method: 'tools/call',
          params: { name: parsed.name, arguments: args },
        },
        CONTEXT
      );

      if (resp?.error) {
        err(`mojulo: ${resp.error.message || 'call failed'}`);
        return 1;
      }
      const result = resp?.result || {};
      for (const item of result.content || []) {
        if (item?.type === 'text') out(item.text);
      }
      return result.isError ? 1 : 0;
    }
  }
  // Unreachable — parseArgv covers every command — but a changed enum
  // should fail loudly as usage, not fall through as success.
  err(`mojulo: ${USAGE}`);
  return 2;
}
