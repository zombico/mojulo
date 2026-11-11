/**
 * MCP Ring 7 — runtime daemon lifecycle tools.
 *
 * Thin client over the unified daemon host (`mojulo-daemons`).
 */

import { registerTool } from '@/lib/mcp/server';
import { RuntimeDaemons } from '@/lib/daemons/client';

function requireDaemonName(input) {
  if (!input?.daemon_name || typeof input.daemon_name !== 'string') {
    throw new Error('daemon_name is required');
  }
  return input.daemon_name;
}

export async function listDaemonsHandler() {
  return { daemons: await RuntimeDaemons.list() };
}

export async function statusDaemonHandler(input) {
  const name = requireDaemonName(input);
  return RuntimeDaemons.status(name);
}

export async function startDaemonHandler(input) {
  const name = requireDaemonName(input);
  return RuntimeDaemons.start(name);
}

export async function stopDaemonHandler(input) {
  const name = requireDaemonName(input);
  return RuntimeDaemons.stop(name);
}

export async function restartDaemonHandler(input) {
  const name = requireDaemonName(input);
  return RuntimeDaemons.restart(name);
}

export function registerRuntimeDaemonTools() {
  registerTool({
    name: 'list_daemons',
    description:
      'List runtime daemons managed by the unified daemon host. Returns [{ name, status, detail? }].',
    inputSchema: { type: 'object', properties: {} },
    handler: listDaemonsHandler,
  });

  registerTool({
    name: 'status_daemon',
    description:
      "Read the current status of a runtime daemon (e.g. 'scheduler', 'app-runtime').",
    inputSchema: {
      type: 'object',
      properties: {
        daemon_name: { type: 'string', description: "Daemon name (e.g. 'scheduler', 'app-runtime')." },
      },
      required: ['daemon_name'],
    },
    handler: statusDaemonHandler,
  });

  registerTool({
    name: 'start_daemon',
    description: "Start a runtime daemon via the daemon host.",
    inputSchema: {
      type: 'object',
      properties: {
        daemon_name: { type: 'string', description: "Daemon name (e.g. 'scheduler', 'app-runtime')." },
      },
      required: ['daemon_name'],
    },
    handler: startDaemonHandler,
  });

  registerTool({
    name: 'stop_daemon',
    description: "Stop a runtime daemon via the daemon host.",
    inputSchema: {
      type: 'object',
      properties: {
        daemon_name: { type: 'string', description: "Daemon name (e.g. 'scheduler', 'app-runtime')." },
      },
      required: ['daemon_name'],
    },
    handler: stopDaemonHandler,
  });

  registerTool({
    name: 'restart_daemon',
    description: "Restart a runtime daemon via the daemon host.",
    inputSchema: {
      type: 'object',
      properties: {
        daemon_name: { type: 'string', description: "Daemon name (e.g. 'scheduler', 'app-runtime')." },
      },
      required: ['daemon_name'],
    },
    handler: restartDaemonHandler,
  });
}
