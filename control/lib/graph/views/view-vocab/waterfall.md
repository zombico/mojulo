---
{
  "id": "waterfall",
  "name": "Waterfall",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a WATERFALL — a river running off a cliff, falling, and plunging into a pool — three kinds (veil / curtain / horsetail), rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'a waterfall / falls / a cascade off a cliff / a plunge pool / a thin ribbon falling / a wide curtain of water / water shooting out of a notch in the rock'."
}
---

Mint a WATERFALL: a river runs along a plateau, pours off the cliff edge, falls, and plunges into a pool that drains away as a second river, rendered in the traversable three.js World. The fall is the falling-water primitive drawn on the GPU along its real ballistic path. Over the lip it is glassy and pours at the critical depth. It thins as it speeds up, whitens as air works into it, and past its break-up length (about 30 critical depths) it frays into streaks and fingers and spreads. A soft mist boils up at its foot. The plunge pool is a simulated surface that the fall churns into foam and rings, with leaves floating on it.

Three KINDS — one primitive at different points in its parameter space (lip width, flow, height):
- `veil` — a tall, thin ribbon from a narrow lip that frays to streaks long before it reaches the pool.
- `curtain` — a broad, heavy block of water off a wide ledge, solid and glassy most of the way down.
- `horsetail` — a round spout shot through a slot in the rock, white and flaring from partway down.

The page carries a flow slider (a trickle of the fall's own flow up to five times it): turn it down and the water hugs the cliff and frays sooner; turn it up and it throws farther and holds together longer. Stored manifest IS the recipe (`manifest.kind === 'waterfall-view'`, no geometry), regenerated deterministically on render. Served at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). 1 unit = 1 m at scale 1.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which kind (default 'veil'): 'veil', 'curtain', 'horsetail'.
- `seed` (integer) — Same (scenario, seed, scale, flow) → byte-identical scene; a new seed reshapes the cliff, hills and pool.
- `flow` (number) — The fall's discharge in m³/s (default per kind: veil 1.6, curtain 45, horsetail 3).
- `scale` (number) — Overall size multiplier (default 1; 0.4–3).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#cfe3ee" } for the sky colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
