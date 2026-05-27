/**
 * AgentRuntimeError — typed error class for runtime adapter failures.
 *
 * Sits parallel to AgentTaskError ([../mcp/agent-tasks/queue.js]) but is
 * specific to the headless-subprocess invocation path: timeouts, malformed
 * adapter output, the adapter refusing to handle the request, generic
 * invocation failures (spawn errors, missing binary). The Node fulfiller
 * catches these and translates them into queue cancellations with the
 * adapter's reason carried in the message.
 *
 * Codes:
 *   - RUNTIME_TIMEOUT        — subprocess didn't return within timeoutMs.
 *   - RUNTIME_INVOCATION_FAILED — spawn failed, missing binary, non-zero exit.
 *   - RUNTIME_OUTPUT_INVALID — stdout could not be parsed into an envelope.
 *   - RUNTIME_REJECTS_INPUT  — adapter explicitly cannot handle the task
 *                              (e.g. vision-disabled adapter sees an image).
 */
export class AgentRuntimeError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message);
    this.code = code || 'RUNTIME_ERROR';
    if (cause) this.cause = cause;
  }
}
