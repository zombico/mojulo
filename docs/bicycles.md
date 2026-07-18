# Bicycles — self-drivable tool loops

Status: doctrine note (2026-07-12). Names a pattern that already exists in
the substrate so new work can aim at it deliberately. NOT a claim that
everything is or should be a bicycle — most tools are one-shot, and that
is fine.

## What a bicycle is

A **bicycle** is a tool loop a worker agent can pick up *cold* and drive to
completion with no human relay. The name is the old "a bicycle for the
mind" sense: the rider supplies the intent and the pedaling; the machine
supplies the structure, the feedback, and — crucially — **the next step**.
A bicycle never leaves its rider guessing what to do next.

Four properties make a loop a bicycle:

1. **Self-documenting.** It emits its own handoff. The worker does not need
   prior context — the tool hands it the job description, the inputs, and
   the rules (the keyframe bicycle writes `JOB.md`; a bicycle-shaped MCP
   tool returns the instructions in its response).
2. **Self-auditing, two-gate.** It states what "done" means and checks what
   it can. The **machine gate** is deterministic (geometry, schema,
   completability); the **eyes gate** is the rider's judgment against a
   written checklist. The tool is honest about which is which — it never
   claims the eyes gate passed. (See the animation-cheats "two-gate
   doctrine": geometric compliance and register compliance are separate
   gates.)
3. **Stateful and resumable.** There is a state you can re-read at any time
   (`status.json`, or a durable row) that says, per unit of work,
   `pending | in-progress | pass | retry | done` and *what to do next*. A
   restart, a new session, or a different worker resumes from the state,
   not from memory.
4. **Drivable cold.** The validation of a bicycle is a foreign agent
   completing the loop with zero in-context knowledge beyond what the tool
   hands it. This is exactly the image-outcomes I3 exit criterion ("a
   foreign agent completes the loop cold") and the keyframe bicycle's
   design goal.

## The loop shape

Every bicycle is some spelling of:

```
init/request → read job → do work → submit → audit → (retry per gate | done)
```

The rider drives the pedals (do work); the machine holds the frame (state,
audit, next-step). Retries are per-unit and per-gate: only the failing
piece redoes, and the state names which gate it failed.

## Instances already in the substrate

- **The keyframe bicycle** —
  [control/lib/graph/image-outcomes/keyframe-spike/bicycle.mjs](../control/lib/graph/image-outcomes/keyframe-spike/bicycle.mjs).
  `init → paint cels → audit → fix retries → done`, over meru guides and a
  `status.json`. The first thing named a bicycle here; this note
  generalizes from it.
- **The game completability gate** — a level is refused until proven
  completable (auto-audit compiled traversals). Machine gate as a hard
  promotion condition.
- **Beats' listen → mark → revise → compare loop** — annotations +
  revisions as durable state a rider iterates against.
- **Plan / research modes** — accretive drawers with their own re-readable
  state driving a deliberation loop.

## The next bicycle: the render handoff

The durable render handoff — [render-handoff.plan.md](../control/lib/graph/image-outcomes/render-handoff.plan.md)
— is the render-worker seam built as a bicycle: `request_image_render`
parks durable rows, a worker pulls a self-documenting packet, paints,
submits, and an audit gate accepts. It replaces three improvised handoffs
(stills out-of-band, comics via bind, cels via the file-based keyframe
bicycle) with **one** durable, drivable-cold loop — the keyframe bicycle's
`status.json` promoted to DB rows, its `JOB.md` promoted to a pull payload,
its geometric gate promoted to a submit-time worker audit.

**This is a bicycle.** When you build a render-worker, deliberation, or
generate-and-verify tool, aim for the four properties above.
