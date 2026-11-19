---
{"id": "task", "name": "Task: a job from a phone app, subscribed to and taken there (emitter)", "summary": "A job no one gives: a phone app (TaskFu) lists it. The app is subscribed to on the phone and the task is taken there; taking it sets its flag, so its legs open and its quest begins. A task may be on several apps, by its tags.", "when": "a gig app, ride hailing work, delivery app jobs, take a task on the phone, no NPC to talk to, subscribe to an app for jobs, uber-like work in an open world"}
---

## Role

**emitter**. Beside the job it gives (its legs `after` its flag).

## Params

```json
{"kind": "task", "id": "fare", "app": "taskfu", "flag": "took-fare", "name": "TaskFu", "subscribe": true}
```

- `id`, `flag` — the task and the flag taking it sets.
- `app`, `apps` — the app that lists it, and every app its `tags` put it on.
- `subscribe` — true, or `[{ app, name? }]`: the apps whose subscribing this task carries (one task an app).
- `name` — what the app is called.

## Lowers to

- world: `app:sub:<app>` sets `flag-sub-<app>`; `app:take:<id>` with the flag down → `task:<id>`, the flag set, `flag:<flag>` said; toasts. The phone raises both events (scene/channels/phone-channel.js).
