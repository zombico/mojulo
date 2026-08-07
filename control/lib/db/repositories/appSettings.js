import { getDb } from '../index.js';

// Single-user app preferences (key/value). Reads are synchronous + cheap;
// callers on hot paths (the builder stream route) can hit getValue directly.

export const BUILDER_DRIVER_MODES = Object.freeze({
  AGENT: 'agent',
  SELF_HOSTED: 'self-hosted',
});

// Fresh installs default to agent-routed: the operator's local Claude Code
// agent is the brain, so no control-plane LLM key is required for chat. The
// absence of a stored row IS this default. See agent-routed-chat.md.
const DEFAULT_BUILDER_DRIVER_MODE = BUILDER_DRIVER_MODES.AGENT;

const BUILDER_DRIVER_MODE_KEY = 'builder_driver_mode';

function isValidDriverMode(value) {
  return value === BUILDER_DRIVER_MODES.AGENT || value === BUILDER_DRIVER_MODES.SELF_HOSTED;
}

export const AppSettingsRepository = {
  getValue(key) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },

  setValue(key, value) {
    const db = getDb();
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value, Date.now());
    return value;
  },

  // The builder's brain: 'agent' (local agent fulfills turns via the
  // agent-tasks queue) or 'self-hosted' (control plane runs its own Claude
  // loop). Unset → DEFAULT_BUILDER_DRIVER_MODE.
  getBuilderDriverMode() {
    const stored = this.getValue(BUILDER_DRIVER_MODE_KEY);
    return isValidDriverMode(stored) ? stored : DEFAULT_BUILDER_DRIVER_MODE;
  },

  setBuilderDriverMode(mode) {
    if (!isValidDriverMode(mode)) {
      throw new Error(`Invalid builder driver mode: ${mode}`);
    }
    return this.setValue(BUILDER_DRIVER_MODE_KEY, mode);
  },
};
