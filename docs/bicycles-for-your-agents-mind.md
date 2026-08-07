# Bicycles for your Agent's Mind

*An introduction to mojulo.*

---

There's an old line that a computer is a *bicycle for the mind* — a machine
that doesn't make you stronger, it makes what you've already got go further.
The bicycle adds no muscle. It's pure drivetrain: it takes the power you
bring and turns it into range you couldn't reach on foot. You still pedal.
You still steer. It just gives the motion somewhere to go.

It's a good parallel, and mojulo rides on it. But a parallel is a door, not a
foundation — and this one snaps the moment you look closely, because the thing
doing the pedaling isn't a human mind. It's an agent. And that changes
everything about what the bicycle has to be.

---

## Where the parallel breaks

A human mind that gets on a bicycle remembers the ride. It keeps what it
learns, carries yesterday into today, knows why it turned left last time.

An agent has none of that. A language model is amnesiac by construction.
Every session is born fresh and dies when the context window fills. It has,
in the strong sense, no body: no place to keep a thing it made, no process
that keeps running after it stops attending, no ledger of why it did what it
did last time. It can reason brilliantly for the length of a conversation and
then lose all of it — a rider of enormous talent who wakes every morning with
yesterday erased.

So "amplify what you've got" means something different here. For a human, the
mind is the constant and the tool is the extension. For an agent, *the mind
is the ephemeral part* — the one thing guaranteed to vanish. The rider is
brilliant and gone by morning. If a bicycle for a human mind is a
drivetrain, a bicycle for an agent's mind has to be something stranger: a
drivetrain **and a body** — somewhere the work lives after the rider forgets
it ever happened.

That's the whole problem mojulo exists to solve. Not "make the agent
smarter." Make its thinking **keep existing** after the chat ends.

---

## The inversion

Most AI products put the intelligence in the software and let the human feed
it prompts. Mojulo does the opposite, on purpose. The agent is the only
intelligence in the loop, and mojulo is deliberately — almost aggressively —
*not* intelligent. It holds no model credentials on the paths that matter. It
doesn't summarize your documents; the agent does, with its own eyes. It
doesn't author your publications; the agent does. It doesn't run the inference
inside the apps it supervises; it parks that work back on the agent's own
queue.

Mojulo supplies exactly what a stateless mind lacks — persistence, runtime,
memory, an audit trail — and refuses to embed exactly what the mind already
has — judgment, vision, language. That's the division of labor. The agent
pedals and steers. Mojulo is the frame, the wheels, and the saddlebags that
still hold your cargo tomorrow.

The one-breath version, when someone asks what mojulo is: *a workshop the
agent works in — a local, stateful substrate that turns conversations into
things that keep existing after the chat ends.* Chatbots, connected services,
apps, playable games, and creative artifacts — worlds, diagrams, films, audio,
publications. They look like five different products until you notice they're
all the same move: **a durable binding minted from a conversation.** That's
the category. Everything else is an instance of it.

---

## A bicycle is a specific thing

Here the metaphor stops being a metaphor and becomes a part you can name.

In mojulo, a **bicycle** is a tool loop a worker can pick up *cold* and drive
to completion with no human relay. Four properties make a loop a bicycle:

- **It documents itself.** Every step names the next one. A worker needs no
  prior context — the tool hands it the job, the inputs, and the rules.
- **It audits itself, in two gates.** A *machine gate* that's deterministic
  (does this pass the checkable test?) and an *eyes gate* that's judgment. The
  tool is honest about which is which, and never claims the eyes gate passed
  on its own.
- **It's stateful and survives a restart.** There's a durable state you can
  re-read at any moment that says, per unit of work, what's done and what to
  do next. Kill the process, bring it back, and the ride resumes from the
  state, not from anyone's memory.
- **It's drivable cold.** The proof is a foreign worker, with nothing in
  context but what the tool hands it, completing the loop.

That's the whole idea. Not every tool is a bicycle — most are one-shot, and
that's fine. But when a task is worth doing over and over by workers who show
up with no memory of the last time, you build it as a bicycle, and then it
rides itself.

---

## A worked bicycle

Metaphors are cheap. Here's a real one, from the substrate.

Mojulo can *design* a picture — lay out a comic page, place the camera, write
the panel grammar, generate the scaffold a renderer conditions on. What it
can't do is *paint* it; that takes an image generator, which lives in the
agent's world, not in mojulo. So every finished image needs a handoff: pass a
well-specified job to a worker that can paint, get the result back, and check
it before it's trusted.

For a long time that handoff was improvised three different ways — one for
stills, one for character sheets, one for animation cels — and none survived a
restart. If the control plane bounced, a render in flight simply evaporated.
No record it had even been requested.

So it got rebuilt as a bicycle. Five verbs:

```
request_image_render  → park a durable job, one row per thing to paint
pull_image_render     → a worker claims the oldest job, gets the full brief
submit_image_render   → the worker hands back the PNG and what it attests
accept / reject       → a second pass verifies it — the painter can't self-approve
```

Pull a job and the reply doesn't just hand you a brief; it tells you, in
words, to invoke your generator, that the scaffold is *input and never the
deliverable*, and exactly which tool to call with the result. The job lives in
a database row, not in memory, moving through `pending → in_flight →
submitted → accepted`; kill the process and a pending render is still there,
still pullable. And the worker that painted the image *cannot* be the one that
accepts it — acceptance is a separate call with its own author.

Now weigh the two halves. **Building it once was genuinely hard** — a durable
table, a repository, five tools, an idempotency rule so a re-request doesn't
duplicate work, a two-author audit gate, restart survival. No amount of clever
prompting one-shots it, because it's a seam across the database, the file
store, the render packet, and the tool registry all at once.

But **riding it afterward is trivial.** `request → pull → paint → submit →
accept`. Any image-capable agent, any session, cold, no briefing, resumable
across a crash. Three tangled improvisations collapse into one loop a stranger
can drive.

That asymmetry — *expensive to forge, trivial to ride* — is the point. It's
what a bicycle is. You build the frame once, precisely, and then anyone gets
on and goes further than they could have walked.

---

## Why the whole workshop is shaped like this

The render handoff isn't a special case. The same commitments run through
every primitive, because they're all answers to the same question: how do you
build a body for a mind that forgets, without the body quietly becoming the
boss?

**Recipes, not renders.** Everything the workshop mints is a tiny, seeded,
deterministic recipe regenerated on demand — never a stored blob. A world, a
chart, a figure, a song: the manifest is the source of truth and the render is
disposable. Infrastructure-as-code, but for media. Every part is visible,
diffable, and re-buildable with simple tools — and because the dice are
seeded, taking a thing apart and reassembling it gives back the same object.

**Verify before you promote.** A game level is *refused* until a recorded
playthrough proves it's completable. A world's physics can be asserted tick by
tick. A skill dry-runs on one real input before it's allowed to materialize.
Nothing graduates from proposed to real on a promise. When someone asks
whether this is a toy, that's the answer — proof gates, not adjectives.

**It remembers why.** Beside every artifact, mojulo keeps an append-only
record of the *intent* that produced it. So a fresh session — a new amnesiac
morning — doesn't mint a stranger next to your work. It reconstructs the prior
decisions and improves the existing thing. This is the deepest answer to the
amnesia: not just persisted state, but persisted reasons. It's what lets a
hundred forgetful sessions compound into one coherent body of work. The
bicycle you get back on is the one you tuned last time.

**It stays yours.** Mojulo runs on your machine. The transport binds to
localhost. No telemetry, no phone-home, no remote kill switch, no account.
Inference runs on *your* provider key and bills to *your* account. The intent
never enters mojulo's process boundary — it lives in your prompt, gets
translated by an agent *you* connected, and arrives as a tool call. Amplifying
a mind and capturing it are separable choices, and mojulo makes the second one
by refusing it in code you can read.

---

## Its own thing

The old line gets you in the door: a machine that makes what you've already
got go further. But an agent's mind isn't a human's, and everything
interesting is downstream of that difference. The rider forgets. So the
machine has to remember — has to be a body as much as a drivetrain, has to
hold the work and the reasons and the proof that it's real, and hand all of it
to whichever forgetful worker shows up next.

That's what a bicycle for an agent's mind turns out to be: not a metaphor
about amplification, but a buildable thing — a loop you forge once, precisely,
so that anyone can ride it cold and get somewhere they couldn't have walked.

Now get on.
