---
{
  "id": "explain-the-internet",
  "name": "Explain the internet (or any packet/message flow)",
  "summary": "Build a paced, animated explainer of how the internet works — and, by the same recipe, any networked / protocol / distributed-system topic. A concept ladder of sketch diagrams whose edges carry LIVE pulses (the 'A pings B' primitive), so every abstract idea is shown as something actually traveling: a packet hopping, a request and its reply, a handshake. Mints each rung with create_sketch, then optionally stitches them into one slideshow with forge_motion (deck).",
  "valueHook": "Turn 'explain the internet' into a six-slide animated deck where you watch the packets move — packets hop router to router, DNS asks and answers, TCP shakes hands — instead of staring at a static box-and-arrow diagram.",
  "version": 1,
  "category": "explainer",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "topic", "prompt": "What should the explainer cover? (default: how the internet works end to end. Also fits: 'how HTTPS works', 'what DNS does', 'how a CDN serves a page', 'how two services talk over a queue')", "default": "how the internet works, end to end" },
    { "name": "audience", "prompt": "Who is it for? Sets vocabulary and how much each rung assumes.", "default": "a curious beginner" },
    { "name": "output", "prompt": "slides (individual /sketches you step through) | deck (one forge_motion slideshow .svg/.gif) | both", "default": "both" }
  ],
  "mcpTools": { "mojulo": ["semantic_search", "get_sketch_vocab", "create_sketch", "forge_motion"] },
  "outputContract": { "summary": "An ordered set of animated sketch manifests (the concept ladder), each minted via create_sketch, and — when output includes deck — a single forge_motion deck slideshow that plays them in order.", "fields": ["slideRefs", "deckRef"] }
}
---

# Explain the internet (or any packet/message flow)

> **Sibling:** `explain-computing-from-first-principles` is the layer below — what a machine *is*,
> bottom-up, ending where this deck begins. Its last rung (two machines, packets leaving) is this
> deck's first rung. Run that one then this one for a continuous "from a switch to the web" arc.

The internet is **against mojulo's usual explainer grain**, and getting this right is the
whole point of the catalyst. The 21 science views (gravity waves, orbits, atoms) explain
*continuous spatial phenomena* — fields and forces rendered as a walkable 3D world. The
internet is the opposite kind of thing: **discrete** (packets, not fields), **relational**
(who connects to whom — physical distance barely matters), **layered** (a TCP segment inside
an IP packet inside a frame), and **conversational** (SYN → SYN-ACK → ACK is a dialogue over
time). Forcing it into a 3D "internet city" (datacenters-as-buildings, cables-as-roads) looks
impressive and teaches almost nothing — it imposes a fake geometry on something whose essence
is non-spatial.

So this explainer lives in the **diagram + pulse + deck** stack, not the 3D engine:

- **stations + edges** (the `pipeline` sketch vocabulary) are the natural home for topology —
  hosts, routers, resolvers, servers, and the connections between them.
- **`edge.pulse`** is the key primitive: a token (or several) that travels along an edge,
  rendered with native SVG `<animateMotion>`. It plays live in `/sketches` AND in the exported
  `.svg` with no bake. This is what lets you SHOW flow — a packet hopping, a request leaving and
  a reply returning — instead of describing it. Every abstract idea on the ladder becomes
  something moving.
- **`forge_motion` deck** stitches the rungs into one paced slideshow when you want a single
  artifact to play.

Retrieve the live grammar before authoring: `get_sketch_vocab('pipeline')` for stations/edges +
the full `pulse` spec (`{ count?, period?, size?, color?, dir? }`), and `semantic_search({ kinds:
['sketch_vocab'] })` if a rung needs a chart (e.g. a latency/bandwidth stat tile).

## The concept ladder (the default spine)

One idea per rung, each a topology whose edges pulse. This is the proven six-rung climb for
"how the internet works"; keep the shape, swap the rungs for a narrower `topic`.

1. **A connection** — two boxes, one edge, one packet. "The internet is computers sending each
   other messages." `pulse: { count: 1 }`.
2. **Packets** — same two boxes; the message splits into several numbered packets on the one
   edge. `pulse: { count: 4 }`. "A file is chopped into packets that each travel on their own."
3. **Routing / hops** — laptop → home router → ISP → server, every link pulsing. "There is no
   single wire; packets hop machine to machine." (This rung is the spine — most topics are a
   variation of it.)
4. **DNS** — laptop ↔ resolver as request/reply: `you→dns` "example.com ?" (teal, `via:'top'`)
   and `dns→you` "93.184.216.34" (amber, `via:'bottom'`). "Names become numbers first."
5. **TCP handshake** — laptop and server, three stacked lanes: `you→srv` "SYN" (`via:'top'`),
   `srv→you` "SYN-ACK" (default centre lane), `you→srv` "ACK" (`via:'bottom'`). "Both sides shake
   hands before any data."
6. **HTTPS** — `you→srv` "GET / · TLS" (top) and `srv→you` "200 OK · page" (bottom). "The real
   request flows, encrypted so nobody in between can read it."

Give every rung the same frame so the deck reads as one piece: a `text` mark title (size ~26,
weight 700) at the top-left, a muted one-line caption beneath it, and the topology below. Keep a
constant `viewBox` (≈ 920×360 works) across all rungs.

## Build it

1. **Outline the ladder** for `topic` + `audience` — one sentence per rung (idea + the caption
   the viewer reads). Adjust depth to the audience; drop or add rungs.
2. **Author each rung as a manifest** — stations for the machines, edges for the connections,
   `pulse` on the edges that carry the idea. Direction matters: `forward` (from→to), `reverse`
   (to→from), `pingpong` (out and back). A request/reply reads best as two edges on `via:'top'`
   and `via:'bottom'` so they don't overlap; a protocol dialogue (≤ 2 nodes, 3 messages) reads
   as top / centre / bottom lanes.
3. **Mint** each with `create_sketch` (bucket `diagram`) → collect the `sk_…` refs in ladder
   order. Each is a live `/sketches/<ref>` the operator can open.
4. **Stitch the deck** (if `output` includes deck): `forge_motion({ subject: { deck: [sk_1, …] },
   shot: { motion: 'deck', params: { theme: 'dark', seconds_per_slide: 4 } } })` → one `.svg`/`.gif`
   slideshow. Pick a theme that fits (`blueprint` reads as technical/schematic).

## Adapting to a narrower topic

The same recipe explains any message-flow system — keep "show the flow as a pulse," reshape the
ladder:
- **HTTPS deep-dive** — ClientHello / ServerHello / cert / key-exchange / Finished as stacked
  handshake lanes, then the encrypted GET/200.
- **A CDN serving a page** — browser → edge PoP (cache hit pulses straight back) vs. edge → origin
  on a miss; show both paths.
- **NAT / a home network** — many devices → one router → one public IP; pulses converging.
- **BGP / the backbone** — ASes as stations, routes as edges; a withdrawn route, traffic re-pulsing
  a new path.
- **Two services over a queue** — producer → queue → consumer; `count` up = backlog.
- **Congestion** — crank `pulse.count` and shorten `period` on a link to read as saturation.

## Pitfalls

- **Don't reach for the 3D engine.** "Internet as a city you fly through" is the seductive wrong
  answer — it adds geometry the subject doesn't have. The diagram+pulse stack is the right altitude.
  (The one fair use of a 3D view is a genuinely spatial sub-topic, e.g. signal-as-wave propagation.)
- **Reply on its own lane.** Antiparallel edges between the same two stations overlap on the default
  S-curve. Use `via:'top'` / `via:'bottom'` (or the centre default) so request and reply read apart.
- **`pulse` is an edge property, not a deck reveal.** Within-slide motion here is the traveling
  token, which plays in the static `.svg` itself. The `forge_motion` deck `reveal` system stages
  *marks* (not stations/edges) — use it to type-on a title or fly in a caption, not to move packets.
- **Keep each rung to one idea.** If a slide needs two captions, it is two rungs. The ladder's power
  is graduated disclosure — one new concept per beat.
- **Honest labels.** Edge labels are the narration (lowercase verbs / protocol names); the pulse is
  the motion. Don't over-decorate — a packet reads as a small dot, not a sprite.
