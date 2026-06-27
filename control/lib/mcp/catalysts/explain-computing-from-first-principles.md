---
{
  "id": "explain-computing-from-first-principles",
  "name": "Explain computing from first principles (up to the network)",
  "summary": "Build a paced, animated bottom-up explainer of how a computer works — from a single switch up to the moment two machines must talk. A concept ladder of sketch diagrams where FLOW ideas carry LIVE pulses (the 'A pings B' primitive — signals through gates, the fetch–decode–execute loop, compilation, the OS scheduler) and STRUCTURAL ideas (bits, encoding) are static marks. Mints each rung with create_sketch, then optionally stitches them into one slideshow with forge_motion (deck). The final rung hands off directly to explain-the-internet.",
  "valueHook": "Turn 'how does a computer actually work?' into a nine-slide animated deck — watch signals flow through gates, the CPU loop fetch and execute, the OS hand each program a slice — that ends exactly where the internet explainer begins.",
  "version": 1,
  "category": "explainer",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "topic", "prompt": "What should the explainer cover? (default: a computer from first principles, switch to network. Also fits: 'how a CPU works', 'how code becomes something a machine runs', 'what an operating system does')", "default": "how a computer works, from a switch up to the network" },
    { "name": "audience", "prompt": "Who is it for? Sets vocabulary and how much each rung assumes.", "default": "a curious beginner" },
    { "name": "depth", "prompt": "How far up the stack to climb: hardware (bits → CPU) | full (bits → OS → the network handoff) | custom (you pick the rungs)", "default": "full" },
    { "name": "output", "prompt": "slides (individual /sketches you step through) | deck (one forge_motion slideshow .svg/.gif) | both", "default": "both" }
  ],
  "mcpTools": { "mojulo": ["semantic_search", "get_sketch_vocab", "create_sketch", "forge_motion"] },
  "outputContract": { "summary": "An ordered set of animated sketch manifests (the concept ladder), each minted via create_sketch, and — when output includes deck — a single forge_motion deck slideshow that plays them in order.", "fields": ["slideRefs", "deckRef"] }
}
---

# Explain computing from first principles (up to the network)

The **sibling of `explain-the-internet`**, one layer down. That catalyst explains how machines
*talk*; this one explains what a machine *is*, bottom-up, and stops exactly where the networking
story starts — so the two chain into one continuous "from a switch to the web" curriculum. Run
this one, then run `explain-the-internet`: this ladder's last rung (two machines, packets leaving)
is that ladder's first rung.

## The grain — flow vs. structure

Same stack as the internet explainer (**stations + edges + `edge.pulse`**, optionally stitched
with **`forge_motion` deck**) and the same discipline: *show motion only where motion is real.*
Computing-from-first-principles has both kinds of idea, and the honesty is in matching them:

- **FLOW ideas → pulses.** Signals propagating through a gate, the fetch–decode–execute cycle,
  source lowering through a compiler, the OS handing time to each process — these genuinely move,
  so they are stations + edges with `pulse` tokens traveling.
- **STRUCTURAL ideas → static marks.** A bit is a state, not a journey; an encoding is a mapping,
  not a flow. Draw these with `rect` / `text` marks and *no* pulse. Faking motion on a static idea
  is the failure mode — a bit does not "travel" from 0 to 1.

Retrieve the live grammar before authoring: `get_sketch_vocab('pipeline')` for stations/edges + the
full `pulse` spec (`{ count?, period?, size?, color?, dir? }`); `semantic_search({ kinds:
['sketch_vocab'] })` if a rung wants a chart.

## The concept ladder (the default climb)

One idea per rung, bottom-up. This is the proven nine-rung climb; `depth: hardware` stops after
rung 5, `full` runs all nine, `custom` lets the operator pick.

1. **Everything is bits** (structural) — two cells, ON/OFF · 1/0. "At the bottom it's just switches."
2. **Gates make decisions** (flow) — `A`, `B` inputs → an `AND gate` (an `mcp_tool` station — a gate
   *is* a function) → `out`; pulses are the signals. "Switches wired together decide."
3. **Gates build arithmetic** (flow) — two bit inputs → `adder` → `sum` + `carry`. "Chained gates add: 1 + 1 = 10."
4. **Memory holds state** (flow) — `write` → `memory cell` (`db_row`) → `read`. "Some circuits latch a bit and keep it."
5. **The CPU: fetch–decode–execute** (flow) — `memory → fetch → decode → execute` across the top, and
   an `execute → memory` edge on `via:'bottom'` labeled "next instruction" closing the LOOP. A violet
   pulse circling the loop is the program counter. "A processor loops billions of times a second."
6. **Bits mean things** (structural) — `A` = `65` = `01000001`, with "letter / number / bits" beneath
   (use a `mono` family for the binary). "The same eight bits are a letter, a number, or a color — by an agreed code."
7. **Code becomes instructions** (flow) — `source code → compiler → machine code → CPU`, a pipeline of pulses.
8. **The OS runs many programs** (flow) — an `operating system` hub with processes (browser, editor, …)
   around it; `pingpong` pulses out to each read as time-slicing. "One CPU, many programs."
9. **Now two machines must talk** (the handoff) — `This computer` → `Another computer`, the message as
   `pulse: { count: 4 }` packets leaving on `via:'top'`, a "the internet" label above the link. This
   rung deliberately mirrors `explain-the-internet` rung 1–2 — it IS the seam between the two decks.

Give every rung the same frame: a `text` title (size ~26, weight 700) top-left, a muted one-line
caption beneath, topology below, constant `viewBox` (≈ 920×360). Keep the topology out of the header
band (start it at y ≈ 150) so captions never collide with the first row of boxes.

## Build it

1. **Outline the ladder** for `topic` + `audience` + `depth` — one sentence per rung (idea + caption).
2. **Author each rung** — flow rungs as stations + edges with `pulse`; structural rungs as marks only.
   For a LOOP (the CPU), route the return edge with `via:'bottom'`. For a HUB (the OS), one central
   station with edges fanning out. Vary pulse `color` to separate roles (e.g. teal = signal in,
   amber = result out, violet = the loop).
3. **Mint** each with `create_sketch` (bucket `diagram`) → collect `sk_…` refs in ladder order.
4. **Stitch the deck** (if `output` includes deck): `forge_motion({ subject: { deck: [sk_1, …] },
   shot: { motion: 'deck', params: { theme: 'dark', seconds_per_slide: 4 } } })`. For the full arc,
   concatenate this deck's refs with `explain-the-internet`'s into one slideshow.

## Adapting

- **`depth: hardware`** — rungs 1–5 only (a switch to a working CPU); good for a chip / digital-logic talk.
- **A CPU deep-dive** — expand rung 5: registers, ALU, the clock, pipelining stages as stacked lanes.
- **The toolchain** — expand rung 7: source → preprocessor → compiler → assembler → linker → loader.
- **Concurrency** — expand rung 8: threads, context switches, a lock as a contended `db_row`.

## Pitfalls

- **Don't pulse a structural idea.** Bits and encodings are states/mappings — static marks. The
  pulse is for genuine flow (signals, the loop, scheduling). This is the one discipline that keeps
  the deck honest.
- **Keep the topology below the header.** Start boxes at y ≈ 150; a process box up at y ≈ 55 will
  overlap the caption (a real bug caught in the first render of this ladder).
- **The CPU loop needs the return edge.** Without the `via:'bottom'` `execute → memory` edge it reads
  as a pipeline, not a cycle — and the cycle is the whole point.
- **One idea per rung.** Two captions = two rungs. The power is graduated disclosure.
- **End on the seam.** The last rung must visually match `explain-the-internet`'s opening (two
  machines, packets leaving) or the two decks won't feel like one story.
