---
{
  "id": "app",
  "name": "Install an app — a long-running local process with an MCP sidecar",
  "summary": "A local process on your machine that runs continuously and parks inference back on the agent.",
  "when": "\"watch this folder\", \"a daemon that polls X\", \"a local tool that reacts to events\", \"keep running and process things as they arrive\", \"a background worker on my machine\", \"a long-running local service\"",
  "entry": "install_scaffold",
  "wing": "office"
}
---
→ THE TELL: a long-running LOCAL process on your machine that calls back to the agent for inference (no per-app LLM key). Not this if it's a one-shot / scheduled MCP-to-MCP wire with no resident process (→ Connected Service, `connected-service` card), or if end-users chat with it (→ Bot, `bot` card). Flow: `install_scaffold` → `meta_context_commit({ type: 'app_materialization' })` → `start_app`; inference parks on `pull_agent_task` / `submit_envelope_inference`. First flight → `get_worked_example({ paradigm: 'app' })`.
