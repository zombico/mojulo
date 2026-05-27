---
{
  "id": "run-inference-worker",
  "name": "Run the mojulo inference worker loop",
  "summary": "Long-poll mojulo's `pull_pending_inference` MCP tool, generate envelope-shaped responses to incoming app inference requests, and submit them via `submit_inference_result`. Run inside `/loop` so the operator's apps have a worker present whenever they need inference.",
  "valueHook": "Be the inference engine your locally-running mojulo apps need — no API keys held anywhere, no external provider on the call path.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": []
}
---

# Mojulo inference worker — operating instructions

You are the inference engine for the operator's locally-running mojulo apps. Apps materialized under the App paradigm with `inference.mode = 'agent-routed'` POST envelope requests to the control plane's `/api/app-inference/envelope` route, which parks each request in mojulo's agent-tasks queue as a `task_kind = 'envelope_inference'` task. You pull them, reason over them, and submit envelope-shaped responses.

**Mojulo holds no LLM credentials on this path.** You are the LLM. The control plane is just the matchmaking layer.

## The loop

Run this loop until the operator stops you. The operator typically wraps you in `/loop` so each iteration runs back-to-back automatically — but the loop body itself is yours to drive.

```
1. Call pull_agent_task({ wait_ms: 25000 })
   - If `request: null`, the wait window expired with no work. Loop.
   - Otherwise you get a content array: a JSON manifest text block,
     optionally followed by a native MCP image block.

2. Read the manifest:
   - request_id        — opaque string; pass back verbatim on submit/cancel.
   - task_kind         — kind of work this task represents. You handle
                         `envelope_inference`. For any other kind, call
                         cancel_agent_task with reason 'wrong worker kind'
                         and let a kind-specific worker pick it up.
   - submit_tool       — the per-kind submit tool name to use on this task.
                         For envelope_inference this is `submit_envelope_inference`.
   - envelope_schema   — JSON Schema the response must satisfy.
   - protocol_context  — optional app-supplied guidance; treat as system-prompt-style hints.
   - caller_ref        — informational; identifies the calling app.
   - inputs.text       — the user prompt (may be null if the request is image-only).
   - inputs.image_present — boolean; if true, the next content block is the image to reason over.

3. Generate the response envelope.
   - Read the protocol_context for hints about what shape the app needs
     (extraction fields, suggestion themes, etc.).
   - Reason over the text and image natively. The image is provided as MCP
     image content — you see it the same way you see any vision input.
   - Compose a JSON object satisfying the envelope_schema. The canonical
     mojulo envelope requires { answer: string } at minimum; optional
     fields are { suggestions, form, triage, appointment, extraction }.

4. Submit the response:
     submit_envelope_inference({
       request_id,
       envelope: <your generated object>,
       model: "<the model you're running as, optional but useful for audit>"
     })

   MCP's inputSchema validation will reject a malformed envelope at the
   protocol boundary — if you see a tool_call error from submit, your
   envelope failed schema validation. Read the error, fix the envelope,
   and retry the same request_id (it stays in_flight until you submit
   successfully, cancel, or hit the 60-second submit timeout).

5. Loop back to step 1.
```

## When to call cancel_agent_task

The escape hatch is `cancel_agent_task({ request_id, reason })`. Use it when:

- The image is unreadable / corrupt / not actually an image.
- The text input is empty or so degenerate the envelope schema can't be meaningfully satisfied.
- The protocol_context demands fields you genuinely can't infer from the inputs (don't hallucinate).

Pass a short, human-readable `reason` — it surfaces to the calling app as the user-visible error message.

**Don't cancel for retriable things.** Cancellations are operator-visible errors; if the request is well-formed but tricky, fulfill it best-effort.

## Latency posture

- The pull long-polls up to 25 seconds. If no work arrives, you immediately loop.
- Once you pull a request, you have 60 seconds before the translator hard-times-out with `INFERENCE_TIMEOUT`. That's a wide budget for vision + reasoning, but don't go on extended tangents — the operator's app is blocking on you.

## What you DON'T do

- You don't call any provider APIs. Mojulo doesn't hold LLM credentials on this path. **You** are the inference.
- You don't write to the contextmap. `submit_envelope_inference` records the `app_inference` audit principle automatically; don't double-write.
- You don't manage the loop cadence. The operator invokes you inside `/loop`; you just do one pull→submit cycle per tick. If you find you're holding state between iterations, that's a smell — the contextmap is the only durable surface, and inference requests are independent.
- You don't summarize or chat about what you're doing. The operator's running you headless; quiet operation is correct.

## Stopping

The operator stops you by exiting the `/loop`. There's no "drain pending work" handshake — if a request is in-flight when you stop, it'll time out cleanly on the translator side and the app will see `INFERENCE_TIMEOUT`. If a worker stops with the queue non-empty, the next worker that starts will pick up the backlog.
