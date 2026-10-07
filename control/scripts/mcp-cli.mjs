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
  mojulo orient                read this first: what mojulo is, and how to read its
                               tool bodies from a shell (the CLI's initialize)
  mojulo tools                 list the connect surface (spine + packs)
  mojulo tools <pack_id>       list one pack's members
  mojulo packs                 list pack ids with their recognizers
  mojulo help <tool|pack>      full description + input schema
  mojulo call <tool> [args]    invoke a tool
  mojulo <pack_id>             open a pack (orientation + member menu)
  mojulo <pack_id> --manual <name>[,<name>]   read members' manuals
  mojulo <pack_id> --json <v>   call the pack with pack-level args, as the MCP call
                               takes them ({"manual": …} or {"tool": …, "args": {…}})
  mojulo <pack_id> <tool> [args]   invoke a member through its pack
  mojulo script <name> [args]  run a shipped worker script from the package root
                               (bake-world-gi | blender-bake | export-blender; needs Blender)

  [args] forms (combinable; flags win over --json):
    --json <v>       arguments as inline JSON object, @file.json, or - (stdin)
    --<prop> <val>   any top-level schema property of the tool
                     (bare --<prop> for booleans; JSON literal for nested)
    --timeout <ms>   give up waiting after <ms> (exit 124; long-poll tools)
    --quiet          suppress result output; exit code only
  mojulo --help | -h           this text
  mojulo --version | -v        print the package version
  (no subcommand)              run as a stdio MCP server`;

/**
 * USAGE for the command this caller types. The text is written once with `mojulo`; a caller who reaches the CLI
 * another way (`node scripts/mcp-stdio.mjs` in a checkout, `npx -y mojulo@<version>`) is told which word stands for
 * it, so every line still reads as typed. Pure.
 */
export const usage = (cmd = 'mojulo') => (cmd === 'mojulo' ? USAGE : USAGE.replace('Usage:', `Usage (type \`${cmd}\` where it says \`mojulo\`):`));

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
    case 'orient': {
      if (rest.length > 0) return { error: `orient takes no arguments, got: ${rest.join(' ')}` };
      return { command: 'orient' };
    }
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
      // `mojulo pack_audio [create_beats --seed 7 | --manual create_beats]` — pack unveil / manual / dispatch
      // sugar. The pack_ prefix is a reserved word on the bin (see the
      // allowlist in mcp-stdio.mjs).
      if (command?.startsWith('pack_')) {
        const [name, ...tokens] = rest;
        if (name === undefined) return { command: 'pack', pack: command, name: null };
        // `--manual a,b` on its own is the dedicated form; with other flags beside it, it rides the
        // pack-level form below (same comma spelling, see packManualFlag).
        if (name === '--manual' && tokens.length <= 1) {
          const names = (tokens[0] || '').split(',').map((t) => t.trim()).filter(Boolean);
          if (names.length === 0 || tokens.length !== 1) return { error: '--manual takes one argument: a member name or a comma-separated list' };
          return { command: 'pack', pack: command, name: null, manual: names };
        }
        if (name.startsWith('--')) {
          // `mojulo pack_x --json '{"manual":[…]}'` — flags straight after the pack id are the
          // PACK's own arguments (tool / args / manual), the same object `pack_x({…})` takes over
          // MCP. Coerced against the pack dispatcher's schema in runCli.
          const parsed = parseCallFlags([name, ...tokens]);
          if (parsed.error) return parsed;
          return { command: 'pack', pack: command, name: null, packArgs: true, ...parsed };
        }
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
 * `--manual` on the pack-level form keeps the comma-list spelling of the dedicated
 * `--manual a,b` form; a JSON literal (`'["a","b"]'`, `'"a"'`) passes through as one. Pure.
 */
export function packManualFlag(pairs) {
  return pairs.map(([key, raw]) => {
    if (key !== 'manual' || typeof raw !== 'string') return [key, raw];
    try {
      JSON.parse(raw);
      return [key, raw];
    } catch {
      const names = raw.split(',').map((t) => t.trim()).filter(Boolean);
      return [key, JSON.stringify(names.length === 1 ? names[0] : names)];
    }
  });
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
// The one line the CLI authors about orientation. `mojulo tools` is the
// natural first command on a shell, and an MCP client would already have been
// told to call forward_context by the initialize preamble; this footer is that
// pointer for a caller that never sent initialize. stdout, like the
// uninstalled note: an agent reading the listing must see it.
const orientFooter = (cmd) => ['', `new here? \`${cmd} orient\` first, then \`${cmd} call forward_context\` (the routing index)`];

/**
 * The command a shell caller should type to reach this CLI again, read from how this process was
 * launched (`argv1` is process.argv[1], which keeps the bin's symlink name). Pure.
 *   - the repo script itself (`node scripts/mcp-stdio.mjs …`) in a source checkout → that, run from control/
 *   - the bin through npx (its copy under the npm cache's `_npx`, or npm_command=exec) → `npx -y mojulo@<version>`
 *   - anything else (a global or project install's `mojulo` on PATH) → `mojulo`
 */
export function cliInvocation({ argv1 = '', env = {}, isSource = false, npx = () => 'npx -y mojulo' } = {}) {
  const file = String(argv1).replace(/\\/g, '/');
  if (file.endsWith('/mcp-stdio.mjs') || file === 'mcp-stdio.mjs') {
    if (isSource) return 'node scripts/mcp-stdio.mjs';
  } else if (file.includes('/_npx/') || env.npm_command === 'exec') {
    return npx();
  }
  return 'mojulo';
}

// Capability that EXISTS but is not installed here. The iron wall is about
// execution, not information hiding — the operator should know a gated pack
// is one command away, without it cluttering the surface as if it were live.
// A host that still carries the retired chatbot group (its marker, or the token
// in MOJULO_PACKS) is told it is ignored, once, so the leftover explains itself.
function uninstalledNote(packs, profile) {
  const lines = [];
  // A pack the Claude plugin profile leaves out is absent, not "not installed".
  const missing = packs.PACKS.filter((p) => !packs.isPackInstalled(p) && !profile.hiddenInPluginProfile(p.id));
  if (missing.length) {
    const groups = [...new Set(missing.map((p) => p.installGroup).filter(Boolean))];
    lines.push(
      '',
      `not installed: ${missing.map((p) => p.id).join(', ')}`,
      `  to add them: ${groups.map((g) => packs.installAdvice(g)).join(' / ')}`,
    );
  }
  const retired = packs.retiredInstallTokens();
  if (retired.length) {
    // `install chatbot` prints the approved moved notice, which names no destination: promise none.
    lines.push('', `ignored: ${retired.join(', ')} (the chatbot pack left mojulo in 3.0.0 and is ignored; \`mojulo install chatbot\` explains)`);
  }
  return lines;
}

// A name the chatbot factory took with it answers with the moved notice, not "unknown" — or, for a
// removed pack dispatcher asked to run a tool 3.0 kept (`member`), the redirect to its live home.
function removedMessage(moved, packs, name, member) {
  if (!moved.isRemovedBotTool(name)) return null;
  const redirect = moved.removedPackRedirect(name, member, {
    homeOf: (tool) => packs.homePackForTool(tool)?.id ?? null,
    isSpine: (tool) => packs.SPINE.includes(tool),
  });
  return redirect ?? moved.botToolMovedNotice(name);
}
function unknownToolMessage(moved, packs, name, member, cmd = 'mojulo') {
  return removedMessage(moved, packs, name, member) ?? `unknown tool: ${name} (run \`${cmd} tools\`)`;
}
function unknownPackMessage(moved, packs, name, member, cmd = 'mojulo') {
  return removedMessage(moved, packs, name, member) ?? `unknown pack: ${name} (run \`${cmd} packs\`)`;
}

export async function runCli(argv, io = {}) {
  const out = io.out ?? ((line) => process.stdout.write(line + '\n'));
  const err = io.err ?? ((line) => process.stderr.write(line + '\n'));
  const isTTY = io.isTTY ?? Boolean(process.stdout.isTTY);
  // How the caller reached us — orient and the tools footer name this, not a bin it may not have.
  const cliCmd = async () => {
    if (io.cmd) return io.cmd;
    const dist = await import('@/lib/version/distribution');
    return cliInvocation({
      argv1: process.argv[1],
      env: process.env,
      isSource: dist.distribution() === 'source',
      npx: () => dist.npxMojulo(''),
    });
  };

  const parsed = parseArgv(argv);
  if (parsed.error) {
    err(`mojulo: ${parsed.error}`);
    err(usage(await cliCmd()));
    return 2;
  }

  const server = await import('@/lib/mcp/server');
  const packs = await import('@/lib/mcp/packs');
  const moved = await import('@/lib/mcp/bot-factory-moved');
  // The Claude plugin profile (lib/mcp/plugin-profile.js): hidden names leave every listing, and a
  // tool's profile face replaces its own there. Every check is false outside that distribution.
  const profile = await import('@/lib/mcp/plugin-profile');
  await server.ensureToolsRegistered();
  const listedPacks = () => packs.installedPacks().filter((pack) => !profile.hiddenInPluginProfile(pack.id));
  const packLine = (pack) => firstLine(packs.packToolEntry(pack, { profile: profile.pluginProfileActive() }).description);

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

  const resolveArgs = async (name = parsed.name, flags = parsed.flags) => {
    const base = await resolveCallArguments(parsed.json, {
      readFile: async (p) => (await import('node:fs/promises')).readFile(p, 'utf8'),
      readStdin: io.readStdin ?? readStdinText,
    });
    const tool = server.getRegisteredTool(name);
    if (!tool) {
      const e = new Error(unknownToolMessage(moved, packs, name, base?.tool, await cliCmd()));
      e.usage = true;
      throw e;
    }
    const coerced = coerceFlags(flags, profile.toolFace(tool).inputSchema);
    if (coerced.error) {
      const e = new Error(coerced.error);
      e.usage = true;
      throw e;
    }
    return { ...base, ...coerced.args };
  };

  switch (parsed.command) {
    case 'orient': {
      // The CLI's stand-in for `initialize`: the same preamble an MCP client
      // gets at connect, the packs mechanic (the CLI listing is the packs
      // shape), and the shell translation of the call grammar. No prose of
      // the CLI's own — all three blocks live in server.js.
      const { listHostProfiles } = await import('@/lib/mcp/hosts/registry');
      out(
        server.serverInstructions() +
          server.PACKS_INSTRUCTIONS_ADDENDUM +
          server.cliInstructionsAddendum({ hostIds: listHostProfiles().map((p) => p.id), cmd: await cliCmd() })
      );
      return 0;
    }
    case 'tools': {
      if (parsed.pack) {
        const pack = packs.PACKS.find((p) => p.id === parsed.pack);
        if (!pack) {
          err(`mojulo: ${unknownPackMessage(moved, packs, parsed.pack, undefined, await cliCmd())}`);
          return 2;
        }
        const hiddenPack = profile.pluginProfileToolNotice(pack.id);
        if (hiddenPack) {
          err(`mojulo: ${hiddenPack}`);
          return 2;
        }
        const memberSet = new Set(pack.members);
        const rows = packs.dispatchTargets(pack).filter((name) => !profile.hiddenInPluginProfile(name)).map((name) => {
          const tool = server.getRegisteredTool(name);
          const shared = memberSet.has(name) ? '' : ' (shared)';
          return [`${name}${shared}`, firstLine(profile.toolFace(tool).description)];
        });
        for (const line of listRow(rows)) out(line);
        return 0;
      }
      // Only INSTALLED packs — the CLI must agree with tools/list, which gates
      // on install state. Listing a pack whose every tool refuses to run is the
      // worst of both worlds: it advertises a capability the host does not have.
      const rows = [
        ...packs.SPINE.filter((name) => !profile.hiddenInPluginProfile(name))
          .map((name) => [name, firstLine(profile.toolFace(server.getRegisteredTool(name)).description)]),
        ...listedPacks().map((pack) => [pack.id, packLine(pack)]),
      ];
      for (const line of listRow(rows)) out(line);
      for (const line of uninstalledNote(packs, profile)) out(line);
      for (const line of orientFooter(await cliCmd())) out(line);
      return 0;
    }

    case 'packs': {
      const rows = listedPacks().map((pack) => [pack.id, packLine(pack)]);
      for (const line of listRow(rows)) out(line);
      for (const line of uninstalledNote(packs, profile)) out(line);
      return 0;
    }

    case 'help': {
      const tool = server.getRegisteredTool(parsed.name);
      if (!tool) {
        err(`mojulo: ${unknownToolMessage(moved, packs, parsed.name, undefined, await cliCmd())}`);
        return 2;
      }
      const hidden = profile.pluginProfileToolNotice(parsed.name);
      if (hidden) {
        err(`mojulo: ${hidden}`);
        return 2;
      }
      const home = packs.homePackForTool(parsed.name);
      const face = profile.toolFace(tool);
      out(`# ${tool.name}${home ? `  (pack: ${home.id})` : ''}`);
      if (face.description) out(`\n${face.description}`);
      out(`\ninputSchema:`);
      out(JSON.stringify(face.inputSchema || { type: 'object', properties: {} }, null, 2));
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
        err(`mojulo: ${unknownPackMessage(moved, packs, parsed.pack, parsed.name, await cliCmd())}`);
        return 2;
      }
      if (parsed.manual) {
        return invoke({ name: parsed.pack, args: { manual: parsed.manual.length === 1 ? parsed.manual[0] : parsed.manual }, timeoutMs: null, quiet: false });
      }
      if (parsed.packArgs) {
        // Pack-level args (`--json`, `--manual`, `--tool`, `--args`) go to the pack call as-is,
        // coerced against the dispatcher's own schema — exactly what `pack_x({…})` sends over MCP.
        let args;
        try {
          args = await resolveArgs(parsed.pack, packManualFlag(parsed.flags));
        } catch (e) {
          err(`mojulo: ${e.message}`);
          return 2;
        }
        return invoke({ name: parsed.pack, args, timeoutMs: parsed.timeoutMs, quiet: parsed.quiet });
      }
      if (parsed.name === null) {
        // Bare pack → unveil: orientation body + member menu.
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
  err(`mojulo: ${usage(await cliCmd())}`);
  return 2;
}
