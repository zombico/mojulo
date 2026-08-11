---
{
  "id": "motion-comic",
  "name": "Motion comic — click-gated comic presentation",
  "summary": "A comic pieced out click by click in a fixed box — the powerpoint of comics; bubbles or movie-style subtitles; exports as one HTML file.",
  "when": "\"make a motion comic\", \"turn my comic into a click-through presentation\", \"reveal the panels one click at a time\", \"each tap shows the next speech bubble\", \"present my comic like a slideshow\", \"present the graphic novel like a slideshow I click through\", \"a slideshow of my comic pages\", \"a graphic novel I click through\", \"a kinetic novel\", \"a visual novel style comic\", \"comic with subtitles like a movie scene\", \"click to advance the story\", \"piece the panel out element by element\", \"a comic for my phone screen I tap through\"",
  "entry": "create_sketch",
  "form": "motion-comic"
}
---
→ `create_sketch` kind `'motion-comic'` (read the `motion-comic` sketch_vocab card first via `get_sketch_vocab`). The BOX comes first (`box.screen`: `phone-upright` / `phone-wide` / `square` / `desktop` / `{width,height}` + `matte`) — composition never reflows. NO pages — bound by PANELS: one panel crop (`{pageRef, panel}`) per scene is the showcase; each click applies deltas: `show` (a panel crop, or any sketch's face), `say` (the panel's bubbleZone or inline text), `hide`, `clear`. Lettering `mode`: `bubbles` (drawn balloons accrete) or `subtitles` (movie-style band, direct styling + `fade`/`type-on`/`cut`). Plays at `/api/sketches/<ref>/play` (next event / final page state / prev event / scene start); `?download=1` = ONE self-contained HTML file. FORKS: an auto-playing video → `forge_motion`; a printed comic page → kind `'sequential-art'`; a scroll webtoon → `cook` format `webtoon`. Edit with `update_sketch` — the fold makes insert/reorder free. Full family → `get_creative_toolset({ form: 'motion-comic' })`.
