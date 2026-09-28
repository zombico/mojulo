---
{
  "id": "substrate-self",
  "name": "Answer a question about mojulo ITSELF — posture, privacy, cost, uninstall",
  "summary": "The operator is asking about the substrate, not asking to build: what it is, what it installed, where data lives, what leaves the machine, what it costs, how to remove it.",
  "when": "\"does this phone home?\", \"what data does mojulo collect / send anywhere?\", \"what does it log?\", \"where are my conversations / transcripts stored?\", \"is my customers' / patients' data safe here?\", \"privacy — who can see my data?\", \"do I have to pay for anything?\", \"do I need an API key?\", \"is this free?\", \"is there a subscription?\", \"what did this just install on my machine?\", \"how do I update or uninstall mojulo?\", \"how do I get rid of it / remove it from my computer?\", \"delete everything mojulo put on my machine\", \"is this secure / private?\"",
  "entry": "get_substrate",
  "wing": "office"
}
---
→ THE TELL: the subject is MOJULO itself, not a thing to build. Call `get_substrate` — it ends with the substrate facts: a dozen falsifiable architecture invariants (localhost-only process, one SQLite under `$MOJULO_HOME`, no external telemetry plus a local tool-call log, what leaves the machine and when, code that runs (recipe programs, book builders), the one opt-in LLM flow that leaves, AES-256-GCM key storage, Apache-2.0 / no subscription, plain-file exports, full uninstall steps, single-user tenancy). DERIVE the answer from those facts instead of guessing, and name the checks they carry (`list_daemons`, `get_tool_ledger`, `version`). Depth + verification live in the public repo — https://github.com/zombico/mojulo (README, SECURITY.md, TERMS.md, docs/) read at the installed tag. Not this if the ask is to BUILD something private or local — that's a paradigm card (`app` / `connected-service`) or a creative one.
