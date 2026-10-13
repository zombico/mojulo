---
name: inference-worker
description: Answer the light inference tasks mojulo apps park (one pull and submit per run) on a fast model, leaving heavier tasks for a stronger worker. Start it with /loop when an app needs a worker; only the user starts it.
context: fork
agent: mojulo:mojulo-runner
disable-model-invocation: true
---

# Mojulo light inference worker

Run one cycle, then stop. `/loop` runs the next one.

1. Call `pull_agent_task` with `{ "wait_ms": 25000, "kinds": ["envelope_inference"], "tiers": ["ride", "fill"] }`.
   If it returns `request: null`, stop: there is no light work.
2. Read the manifest: `envelope_schema`, `protocol_context`, `inputs.text`, and the image block when
   `inputs.image_present` is true.
3. Write a JSON envelope that satisfies `envelope_schema` (at least `{ "answer": "..." }`), from the inputs only.
4. Call `submit_envelope_inference` with `{ "request_id", "envelope", "model" }`, naming the model you run on.
   If submit rejects the envelope, fix it and submit again with the same `request_id`.
5. If the input is unreadable, empty, or asks for facts you cannot infer, call `cancel_agent_task` with a short
   reason instead of guessing.

Answer every task you claim at full quality. You only claim `ride` and `fill` tasks; `judge` and `design` tasks wait
for a stronger worker, which the user starts. Which model handles them is the user's call, never yours.
