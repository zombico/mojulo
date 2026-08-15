---
{
  "id": "connected-service",
  "name": "Wire a connected service — automate over installed MCPs, no chatbot",
  "summary": "A workflow over your installed MCPs (CRM, calendar, drive, ticketing, warehouse) with no conversational layer.",
  "when": "\"every Monday summarize X into Y\", \"sync submissions to our CRM / a sheet / the warehouse\", \"when an email arrives file a ticket\", \"a scheduled digest\", \"wire Gmail to Linear\", \"MCP-to-MCP automation with no bot\", \"post a weekly report to a channel\"",
  "entry": "meta_context_declare_inventory",
  "wing": "office"
}
---
→ THE TELL: NO chat and NO resident local process — just wiring installed MCPs together, once or on a schedule. Not this if end-users chat (→ Bot, `bot` card) or a process must stay running on your machine (→ App, `app` card). Flow: `meta_context_declare_inventory` first (include `inputSchema`s when readable). Then one rule picks the composer: schemas declared → `bind_primitives`; first encounter with a provider you lack schema knowledge for → `recommend_mcp_orbit_compositions`. A host-adapter Skill via `get_catalyst` is the other form. Mojulo is the deliberation anchor + audit trail, not the runtime. Schedule it → `bind_trigger`. First flight → `get_worked_example({ paradigm: 'connected-service' })`.
