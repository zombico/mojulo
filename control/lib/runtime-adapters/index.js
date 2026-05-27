/**
 * Runtime adapter registry — picks the headless-agent runtime the Node
 * fulfiller spawns subprocesses against.
 *
 * Runtime adapters answer "who fulfills tasks?" — sibling to host
 * adapters ([../mcp/adapters/]) which answer "where do artifacts live?".
 * The two layers don't compete; they describe different axes of the
 * operator's environment.
 *
 * Adapters all conform to a small contract:
 *   - id: string                          — registry key.
 *   - capabilities: { vision, streaming } — what the adapter can do.
 *   - supportedKinds: string[]            — task_kinds this adapter
 *                                           knows how to fulfill.
 *   - invoke({ taskPayload, envelope_schema, timeoutMs })
 *       → Promise<{ envelope, model }>    — throws AgentRuntimeError on
 *                                           any failure.
 *
 * The active adapter is chosen by the MOJULO_AGENT_RUNTIME env var. If
 * unset or set to `disabled`, the Node fulfiller stays off and the
 * /loop path is the only fulfiller. Operators opt in explicitly; today's
 * behavior is byte-for-byte preserved when the env var is absent.
 *
 * See AGENT_TASKS_NODE_DRIVEN_PLAN.md.
 */

import { claudeCodeHeadlessAdapter } from './claude-code.js';

// Registry is module-scoped. Tests use registerAdapter / clearTestAdapters
// to inject fakes without spawning real subprocesses.
const adapters = new Map();

function defaultRegister() {
  registerAdapter(claudeCodeHeadlessAdapter);
}

defaultRegister();

export function registerAdapter(adapter) {
  if (!adapter || typeof adapter.id !== 'string') {
    throw new Error('registerAdapter requires an adapter with a string id');
  }
  if (typeof adapter.invoke !== 'function') {
    throw new Error(`Adapter '${adapter.id}' must export an invoke() function`);
  }
  adapters.set(adapter.id, adapter);
}

export function resolveAdapter(name) {
  if (!name || name === 'disabled') return null;
  return adapters.get(name) || null;
}

export function listAdapters() {
  return Array.from(adapters.keys());
}

/**
 * Reads MOJULO_AGENT_RUNTIME and returns the resolved adapter (or null).
 * Centralized so the Node fulfiller and any future status surfaces agree
 * on what "configured" means.
 */
export function resolveConfiguredAdapter() {
  const name = process.env.MOJULO_AGENT_RUNTIME;
  return resolveAdapter(name);
}

export const _internals = {
  _clearForTests() {
    adapters.clear();
    defaultRegister();
  },
};
