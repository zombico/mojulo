---
{
  "id": "school",
  "name": "School Complex",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a generated K-12 school CAMPUS from a tiny RECIPE — the fractal-generation path, a sibling of the city/condo generators tuned to an education campus.",
  "when": "Reach for this on framing like 'make a school / a campus / an elementary / middle / high school / a schoolhouse with a playground and fields / a walkable school'."
}
---

Mint a generated K-12 school CAMPUS from a tiny RECIPE — the fractal-generation path, a sibling of the city / condo generators tuned to an education campus. You pass a seed plus a few knobs (`pattern` / `program` / `facade` / `floors`); the substrate stores ONLY the recipe (no geometry) and regenerates the whole campus deterministically on render, so it costs almost no tokens and the same seed always rebuilds the same school. The result is a walkable, dependency-free three.js World served at `/api/sketches/<ref>/world` (open it / embed it in an `<iframe>`) plus a `.glb` export; same artifact system as the other world mints (persists with `manifest.kind === 'school-complex'`).

The generator lays out a built CORE of classroom wings + specialty spaces around one of three campus patterns, wraps it in an athletic MANDALA, and populates the site — every piece is real geometry regenerated from the recipe:

- **Buildings** — classroom wings (single-loaded corridors of properly-proportioned classrooms, each with a doorway, a teaching CHALKBOARD/whiteboard on the glare-free wall, and a grid of desks WITH chairs), an admin/nurse/staff suite, a commons (library + cafeteria), and a GYMNASIUM (sprung court, center circle, a backboard/rim at each end, bleachers). A legible canopied main ENTRANCE with an open, walkable threshold; a visible stair core per building; multi-storey wings repeat floor grammar and roof with slabs + parapets.
- **Facades** — the shared detail-as-geometry facade cards: `brick-civic` / `timber-warm` read as a masonry body with punched windows; `glass-modern` as tinted glass panes in a curtain-wall frame; `concrete-frame` as an expressed pier rhythm. Floor-line trim bands articulate the storeys.
- **Athletics + site** — a soccer pitch (lines, goals), a baseball diamond (dirt infield, bases, backstop), a full basketball court (two hoops), and a playground (tower + slide + swing set), plus the close-in courts, courtyard garden, and outdoor classroom. Real branched TREES ring the core and line the paved walkways; PARKING lots (painted stalls) + driveways carry registry VEHICLES (cars/vans nosed into stalls, shuttle buses on the loop) at true scale — kept clear of every doorway.
- **Assessments** — every campus carries register-aware checks (reachability, geometry-level WALKABILITY from the entrance, daylight, egress, site, feng-shui) + a BIM schedule; the recipe is refused/flagged if a room can't be reached or a classroom is windowless.

Reach for this on framing like 'make a school / a campus / an elementary / middle / high school / a schoolhouse with a playground and fields / a walkable school'.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params. Everything defaults to `auto` (sampled deterministically from the seed), so a bare `{ base: 'school', seed }` already mints a complete campus.

- `seed` (integer) — Deterministic seed — the whole campus is a pure function of it. Same seed → same school.
- `pattern` (string) — Campus organization: `courtyard` (wings around a protected central court), `spine` (an academic bar with a lab wing + gym off a commons), or `cluster` (grade-level pods around a shared commons). Omit / `auto` samples one. (Named-but-unimplemented `campus` / `stacked-urban` / `barbell` fail loudly.)
- `program` (string) — Grade band, which sets the room grammar: `elementary` (classroom pods, small gym, playground), `middle` (grade clusters, science/art/music, gym), or `high-school` (departments, labs, media, shop, fieldhouse). Omit / `auto` samples one. (`mixed` / `vocational` are planned and fail loudly.)
- `facade` (string) — Cladding language, applied campus-wide: `brick-civic`, `glass-modern`, `concrete-frame`, or `timber-warm`. Omit / `auto` samples one.
- `floors` (integer | 'auto') — Storeys per building (`auto`, or an integer 1–8). Multi-storey wings repeat facade/floor grammar and furnish selected floors.
- `structure` (boolean) — Structural completion skin (roofs, parapets, mechanical blocks). Default on; pass `false` for a roof-off plan read that peers into the corridors and rooms.
- `shadows` (boolean) — Baked contact/cast ground shadows grounding the buildings + objects. Default on; pass `false` to drop them.
- `title` (string) — Title for the resulting sketch artifact.
- `viewBox` (object) — Optional render viewBox `{ width, height }`.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
