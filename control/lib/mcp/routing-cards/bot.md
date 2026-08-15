---
{
  "id": "bot",
  "name": "Build a chatbot — a deployed conversational surface",
  "summary": "A chatbot end-users talk to, deployed as its own process.",
  "when": "\"build me a bot\", \"a chatbot for my website\", \"a customer-facing assistant\", \"an FAQ / intake / booking / support bot\", \"deploy this for my customers\", \"collect leads in a conversation\", \"answer questions on my site\", \"extract fields from uploaded receipts / invoices / documents\", \"read the totals off a scanned receipt or invoice photo (optical-read intake)\"",
  "entry": "start_new_bot",
  "wing": "office"
}
---
→ THE TELL: end-users hold a CONVERSATION with it (a chat surface you deploy). Not a bot if nobody chats — a resident local watcher is an App (`app` card), silent MCP-to-MCP wiring is a Connected Service (`connected-service` card). Underdetermined ("triage support emails" — a chat widget, or a background inbox job?) → ask who touches it; that answer routes the session. Flow: `start_new_bot` → shape it (`infer_intent`, then `generate_*` / `compose_identity` as the form firms up) → deploy (`save_modular_bot` → `poll_job`, hand the user `artifactPath`) → the bot phones home → operate (`recommend_catalysts`, `query_conversations`). First flight → `get_worked_example({ paradigm: 'bot' })`.
