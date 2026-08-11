# motion-comic — the click-gated comic presentation

Status: **M0 LANDED in-tree** (uncommitted) 2026-08-08; M1+ open. Build log at
the bottom.

## Mojulo's posture

A motion comic here is a click-gated comic in the **Turbomedia** grammar
(Balak's "about DIGITAL COMICS", 2009 — the Balak alignment section
below): take one panel from the comic and **piecemeal it out** — trigger
the next element with a click. A balloon, a caption, an onomatopoeia
flight, a camera nudge. Eventually the next element is a **new panel**.
And so on until the story is done. The reader owns the pace (McCloud's
closure stays with the reader); the author owns the order and the deltas.
State accretes or edits cheaply.

**The "glorified powerpoint" is the MEANS, not the end.** The click-gated
slide mechanism is the delivery vehicle; the comic grammar — persistence
of frame, closure between states, click-timed surprise — is what makes it
a MEDIUM rather than a deck (the community's own named failure mode:
"stacked like a PowerPoint slideshow"). We are aligned with the
Turbomedia school; this kind is that medium given a substrate.

Explicitly NOT the posture: an auto-playing video (that confiscates the
gutter), a scroll-driven webtoon (different medium), character animation
(camera > puppetry; no lip sync, no puppet limbs). Audio is **out of the
first spike entirely**.

The art form's quality doctrine still binds the defaults (from the spike
research): preserve comic-ness (borders, drawn SFX lettering), balloons
in reading order, density restraint (one or two deltas per click),
stillness is a feature.

## The box — the first authored fact

**Every motion comic is fully dependent on a deterministic box** (the
view screen). The author sets it first and everything is composed against
it — there is no responsive reflow of the composition, ever; a different
box is a different artifact.

```
box: {
  screen: 'phone-upright' | 'phone-wide' | 'square' | 'desktop'
          | { width, height },          // freeform ratio allowed
  matte: '#000' | '#fff' | any hex,     // what fills the box around art
}
```

Phone upright is one kind of screen; phone sideways is another. How the
author wields the camera inside that box is up to them: fill it edge to
edge, or float a small panel in the middle and let the matte (black-out /
white-out — their call) hold the rest. The player letterboxes the whole
box into whatever physical window it lands in, matte and all, so the
composition is preserved pixel-proportionally everywhere — the box is the
determinism boundary, the device is not.

## The document model: panels pieced out, state as a fold

The manifest is a timeless, seeded recipe (house invariants unchanged).
There is no clock. Time is the click.

**A motion comic has no pages — it is bound by panels only.** The PANEL is
the showcase: the spine is a sequence of **scenes, canonically one scene
per panel**, each base framing its panel CROP (`source: {pageRef, panel}`)
into the box. The sequential-art page is where panels come from, never
what is shown. A scene's events piecemeal the panel's elements out click
by click; advancing past the last event brings the next scene — the next
panel. (The model permits a scene to stage more than one placement — an
inset, a companion chart — but one-panel-per-scene is the taught default.)

```
{
  kind: 'motion-comic',
  title, intent,
  box: { screen, matte },
  lettering: {
    mode: 'bubbles' | 'subtitles',     // per-scene override allowed
    subtitles?: {                      // the direction, when mode is subtitles
      at?: 'bottom' | 'top' | { y },   // band position in the box (matte or art)
      font?, size?, color?, bg?,       // direct styling — author's call
      enter?: 'fade' | 'type-on' | 'cut',
      exit?:  'fade' | 'cut',
    },
  },
  scenes: [{
    id, note?,
    base?: [placement...],             // usually: this scene's panel, framed
    events: [{
      id?, note?,                      // note = the author's beat phrasing
      do: [delta, ...],                // 1..n deltas applied by this click
    }],
  }],
}

// A placement puts a SOURCE in the box (box coordinates):
{ id, source: { pageRef: 'sk_…', panel: 'p2' }    // THE showcase: one panel crop
            | { ref: 'sk_…' },                    // or any sketch's whole face
      // face?: 'auto'|'svg'|'png'|'final' on either form
  at: { x, y, w, h },                  // where in the box; matte fills the rest
  frame?: 'panel' | 'borderless' }

// Deltas (closed vocabulary, validated at mint; the v1 set):
{ show:    placement, enter?: 'pop'|'fade'|'slide'|'none' }   // incl. the next panel
{ hide:    'placementId', exit?: 'fade'|'none' }
{ say:     { of: 'placementId', zone: 'b1' } |      // text from the page's bubbleZone
           { text: '…', speaker? },                 // or authored inline
           enter?, exit?, style? }                  // mode decides the presentation
{ window:  { of: 'placementId', to: {x,y,w,h}, ease? } }   // push/pan inside the box
{ letter:  { text: 'CRASH', at, profile?, flight?: 'slam-in'|'drift' } }
{ fx:      'speed-lines'|'impact-frame'|'shake', at? }
{ clear:   true }                       // wipe the box (a hard cut)
```

**State is a pure fold**: `state(scene, i) = base ∘ events[0..i]`. Any
state is recomputable from the recipe alone — this is what makes the four
navigation moves and cheap editing free. Transitions (`enter`, `window`
easing) are presentation garnish, ~0.3–0.8 s CSS, honoring
`prefers-reduced-motion` (reduced = states swap instantly).

**Panel sources are ANY sketch kind.** A placement resolves through the
same faces every UI surface already uses (`sketchRenderMode`): an
illustration's SVG, an image-outcome/sequential-art `final.png` (or its
scaffold when unbound — the nēmu look is a legitimate fidelity), a
figure, a diagram, a cover. `{pageRef, panel}` crops one panel out of a
sequential-art page's composite using the page's own `bounds`. The player
never cares where the pixels came from.

## Two lettering modes — bubbles and subtitles

The SAME `say` deltas render two ways, chosen by `lettering.mode`
(per-scene override allowed):

- **`bubbles` — traditional.** The line draws as a comic balloon in the
  art: a page-sourced `say` re-uses the page's authored `bubbleZones`
  (zone geometry + lettering live on the source page, never duplicated);
  an inline `say` lowers through the same carrier grammar the
  deterministic pipeline already owns (`letteringMarks` shapes:
  speech/thought/shout/narration + tails, seeded wobble). The frame reads
  as a comic panel accreting its balloons.
- **`subtitles` — the movie read.** No balloon is drawn; the line appears
  in a subtitle band of the box (bottom by default — over the matte or
  over the art, author's call via `at`). Each click then reads like a
  small movie scene with subs enabled — or, with no active line, like a
  cut gif. The author directs the text directly: font, size, color,
  background, and the enter/exit transition (`fade` / `type-on` / `cut`),
  globally in `lettering.subtitles` with per-delta `style`/`enter`/`exit`
  overrides. A new `say` replaces the previous line by default (subtitle
  discipline: one line on screen); `exit` on the old line and `enter` on
  the new compose the handoff.

Text is authored ONCE (on the page's zones, or inline on the delta);
the mode is pure presentation. The same manifest can flip modes — or a
scene can override to subtitles for a wordless-art stretch — without
touching a single event. Bubble mode keeps the page's drawn lettering
discipline; subtitles mode is where the author gets direct type styling
and transition control.

## The player (small, and the artifact people actually touch)

A self-contained, dependency-free HTML page — the css3d-scene discipline:
no CDN, no framework, emitted from the recipe. Served per-sketch (new
render mode alongside `svg|world|scene|beats|…`; `/sketches/<ref>`
iframes it like worlds and beats do).

Navigation — exactly four moves, two of each kind:

- **forward:** `next event` (apply one click) · `final page state` (jump
  to the current scene fully accreted — the panel as the comic reader
  would hold it)
- **back:** `prev event` (unwind one) · `scene start` (jump to the
  scene's base state)

Scene boundaries: advancing past a scene's last event enters the next
scene at its base; `prev event` at base steps into the previous scene's
final state. Keyboard: →/space, ←, End/Home per scene; tap zones on
touch (the phone screens are first-class). A thin progress rail shows
scenes and the event index. Deep-link `?s=2&e=5` renders that exact
fold — also the headless-capture seam for thumbnails and any future
derived renders.

Because state is a fold, the implementation is: render each event's
deltas as pre-laid-out DOM/SVG groups sized in box coordinates, and
navigation toggles/animates visibility — the flipbook trick applied to
accretion. No canvas, no per-frame compositing in v1.

## Export — one HTML file

`export` produces **a single .html file containing the small player and
the whole story**: player JS/CSS inlined, every placement's art inlined
as data URIs at the resolution the box needs, matte and box baked in.
Opens from disk, no server, no network. (Precedents: the self-contained
flipbook SVG, the dependency-free css3d pages, snapshot-at-build in
stitch_motion.) Large stories WARN on size, never refuse — the operator
owns the call. The served player and the exported file share one emitter
so they never drift.

## What the substrate already supplies (spike findings, retained)

- Page grammar, panel bounds, bubbleZones with deterministically-imposed
  lettering: `sequential-art` + `final-page.js` + `depiction-layout.js`
  (`letteringMarks`, `handwrittenBubbleLetterMarks`, speed lines).
- Reveal grammar precedent: the deck family's `reveal: {step, enter}` —
  motion-comic events are that idea promoted to a document spine.
- Faces for any-kind sources: `sketchRenderMode` + the per-kind
  `/api/sketches/[ref]/*` routes; `resolveSketchItem` precedent for
  preferring `final.png` with scaffold fallback.
- Character continuity, style presets, render handoff: unchanged,
  upstream, on the source pages.

Deliberately NOT built for this: no fps timeline, no frame compositor,
no mo_ outcome, no audio plan. (A derived auto-advance GIF/MP4 render
and an audio channel remain plausible later phases; they must not shape
v1.)

## Phasing

- **M0 — the spike.** Manifest + validation + vocab card; the box (screen
  presets + freeform + matte); the fold; **both lettering modes** (bubbles
  from page zones + inline carriers; subtitles with fade/cut and direct
  styling); the player with `show/hide/say/clear` deltas, `pop|fade|none`
  enters, the four-move navigation, progress rail, deep-link; **the
  one-file HTML export**. One demo artifact over a deterministic
  (worker-less) page plus one mixed-source scene (a figure + a diagram as
  placements) to prove any-kind sources — authored twice, phone-upright
  and phone-wide, to prove the box principle, with at least one scene
  flipped to subtitles mode.
- **M1 — the camera and the letters.** `window` deltas (push/pan inside
  the box, eased, settles), `type-on` for balloons, `letter` flights over
  the handwritten-bubble glyph constructor, `fx` beats.
- **M2 — authoring ergonomics.** The accrete-cheaply promise: event-level
  edit affordances (insert/reorder free by construction), a
  `diff`-friendly manifest shape, maybe a domain layer (the beats
  revisions precedent) if editing volume earns it.
- **Later, unscheduled:** derived auto-advance render (headless capture
  over `?s&e` → mo_), the audio channel (score/cues/narration + MP4
  mux), parallax layer separation, webtoon/scroll re-skin of the same
  fold.

## Integration (own FORM row — operator's call)

Motion-comic is a **new creative FORM**, not a sub-kind row:

- `CREATIVE_FORMS` entry in `control/lib/mcp/creative-forms.js` (say
  `motion-comic`, seated between `motion` and `audio` so the studio reads
  picture → motion → motion-comic → sound).
- `FORM_TOOLSETS['motion-comic']` body in context.js (deep-equal pin with
  CREATIVE_FORMS is test-enforced).
- One `STUDIO_ROUTING_INDEX` recognizer row ("a comic that advances as I
  click", "presentation of my comic", "slideshow comic", "kinetic
  novel").
- Routing card `routing-cards/motion-comic.md` carrying `form:` (coverage
  lint) + routing-eval fixture rows.
- Tier-1 kind plumbing: manifest module beside this plan; kind-set +
  `classifyBucket` + `sketchRenderMode` rows in sketch-manifest.js;
  player route under `app/api/sketches/[ref]/`; export via the shared
  emitter (download affordance on the player route, `?download=1`
  precedent from worlds); mint through `create_sketch` dispatch (a new
  kind costs a vocab card, not a tool) unless authoring ergonomics later
  earn a dedicated tool; server.js touch only in that case. Tests that
  police it: context.test.js registry sweep + FORM pin + row lint + body
  ceilings, routing-cards lint, routing-eval, plus gen-tests asserting
  the fold is byte-stable.

Game cutscenes still ride free (`bind_to_game_project`, role
`animation`) — a click-gated comic is arguably the *ideal* cutscene form
for the substrate's games.

## The Balak alignment (researched 2026-08-10)

Yves Bigerel ("Balak") — "about DIGITAL COMICS" (DeviantArt 2009), coiner
of **Turbomedia**, storyboarder of Marvel's Infinite Comics (Waid called
the manifesto "the foundation for [his] entire mindset and mission").
His grammar and this kind are the same medium; the mapping, clause by
clause:

| Balak / Turbomedia doctrine | motion-comic |
|---|---|
| "No longer a page but a screen" — no scrolling, no layout to travel | the BOX; "no pages — bound by panels" |
| The click is the unit of time; the reader manages temporality | the fold; time is the click |
| The reader/spectator frontier — it is NOT animation | no clock; transitions are garnish; audio deliberately out |
| In-frame state change via appearance/disappearance | `show` / `hide` / `say` accretion / `clear` |
| Expression/pose micro-cuts under retinal persistence | `swap` (direct single panel action) |
| Additive balloons over a persistent drawing | `say` accretion in bubbles mode |
| Bidirectional navigation (advance/retreat) | the four-move nav |
| Animation as dosage, never structure (Groensteen's "right dosage") | density restraint; one trick per click |
| Marvel's "you can't peek ahead" | reveals gated per click |
| His known technical debt: the fixed 640×480 Flash frame vs viewport reality | SOLVED — the box letterboxes whole; composition never reflows |
| Authored panel delivery ≠ guided-view retrofit (Goodbrey: "reductive") | deltas are authored; nothing is derived from a page |

Useful community constant: **one turbomedia ≈ 80 vignettes ≙ one 24-page
comic** (~3.3 clicks per print-page equivalent) — pacing guidance for the
cards.

### Gaps the research surfaces (candidate M0.5 / M1 work)

1. **The held beat.** Balak's grammar uses an IDENTICAL frame repeated
   across clicks as suspended time — comic timing where the wait is the
   beat. Our validation actively forbids it ("the click must change
   something"). Add a `hold` delta (an authored empty click, optionally
   with a `note` — the beat is the point).
2. **Rack focus.** THE signature Infinite Comics tool: attention shifts
   between elements of one persistent image (focus pull, no camera move).
   We have nothing. Add a `focus` delta — `{ focus: { on: <placementId> } }`
   dims/desaturates every other placement (CSS filter, cheap),
   `{ focus: false }` restores.
3. **Balloon tails.** The canonical Insufferable foreshadow (balloon with
   an off-frame tail → the next click reveals what it points at) needs
   tails; our player draws tail-less carriers. Add `tail` (a direction or
   target) to bubble-mode says — comics grammar 101 that we're missing.
4. **Build-and-collapse (subtractive focus).** Build a panel cluster
   click by click, then REMOVE all but one and grow it to close-up —
   expressible TODAY (`show`×n → `hide`×(n−1) + `move`), but untaught.
   Tricks-card recipe, no code.
5. **More teaching, less machinery** for the rest: black-frame beat
   (`clear` is the black frame), match cut on click (`swap` across pages
   with rhyming compositions), evolving-light (same-camera variants),
   click-density pacing (many small clicks = fast; one big delta = a
   landed beat), panel delivery into negative space (free placement).
   All expressible; all belong in `motion-comic-tricks`.
6. **Frontier, recorded not scheduled:** Rageul's "endogenous click" —
   the click as diegetic action (reader action coinciding with narrative
   revelation). Adjacent to the game seam; a Later.

## Resolved decisions (operator, 2026-08-08)

1. Posture: click-gated presentation — neither video-first nor
   scroll-first. Forward = next event / final page state; back = prev
   event / scene start.
2. Audio: out of the first spike entirely.
3. Panel sources: any sketch kind.
4. Routing: its own FORM row.
5. **The box is the first authored fact** — a deterministic view screen
   (phone-upright / phone-wide / square / desktop / freeform) with an
   author-chosen matte; composition never reflows; the player letterboxes
   the box, not the art.
6. **The grain is panel-piecemeal**: one panel pieced out element by
   element per click; the next element is eventually the next panel;
   repeat until the story is done.
7. **Export is one HTML file** with the small player and all art inlined
   (data URIs), openable from disk with no server.
8. **Two lettering modes over one authored text**: `bubbles` (traditional
   drawn balloons — page zones or inline carriers) and `subtitles` (a
   directed subtitle band: each click reads like a movie scene with subs,
   or a cut gif; the author controls type styling and text transitions
   directly). Mode is presentation only; per-scene override allowed.

## Build log

- **M0 (2026-08-08, in-tree).** Shipped: `motion-comic-manifest.js`
  (normalize/validate — box presets + freeform, lettering modes,
  show/hide/say/clear deltas, fold-referential integrity, store gate
  `validateMotionComicRefs`), `motion-comic-resolve.js` (any-kind face
  resolution → data URIs; auto = final.png → scaffold fallback; zones +
  viewBox for sequential-art), `motion-comic-player.js` (pure emitter: one
  self-contained HTML page = live route AND export; fold in client JS,
  four-move nav, progress rail, deep-link `?s=&e=`, tap zones,
  prefers-reduced-motion, balloon font solved to FIT the carrier, subtitle
  band with fade/type-on/cut), `/api/sketches/[ref]/play` (+`?download=1`
  attachment), kind plumbing (render mode `play`, bucket `illustration`,
  `create_sketch`/`update_sketch` dispatch), the FORM row (creative-forms +
  FORM_TOOLSETS drawer with kind-qualified call-form bullets so the Ring 10
  partition stays clean + studio routing row + routing card + eval fixtures
  + sketch-vocab card), tests (16 unit + demo gen-test
  `motion-comic-demo.spike.gen.test.js` writing both box variants to
  spike-output), studio body ceiling consciously 7 400 → 7 750, forms pin
  11 → 12. Verified: full suite green (6 173), player screenshotted at six
  fold states (both boxes, both lettering modes, mixed sources).
- **Learned in the build:** bubbleZones are PAGE-ABSOLUTE coords — an
  author using `pageRecipe` auto-layout authors zones blind to panel
  bounds (the demo hit this); an M1 nicety would be a zone-bounds echo in
  the mint response or panel-relative zone authoring. CSS %-padding is
  width-relative — balloon fit must use px padding. The subtitle element
  is per-scene (class, not id).
- **M0.1 (2026-08-08, in-tree): panels are the showcase.** Operator
  doctrine call: **a motion comic has no pages — bound by panels only**.
  The `{pageRef, panel}` panel-crop source promoted from M1 into core:
  manifest accepts it (panel implicit in zone says through a crop;
  cross-panel zone reads refused; store gate checks page kind + panel
  existence), the resolver cuts panel faces (scaffold/`?panel=` SVG crop,
  rasterized crop, sharp-extract from final.png), the player maps zones
  through panel-crop space, and the demo is reauthored panel-first (five
  scenes, one panel each; balloons verified aligned to their zone guides
  in screenshots). Whole-sketch `{ ref }` faces remain for companions.
- **M0.2 (2026-08-08, in-tree): layouts + direct single panel action.**
  Operator refinements. (1) **Layouts**: scene `layout: 'full-spread' |
  'two-panel'` names regions of the box (two-panel divides along the LONG
  axis — phone-upright stacks top/bottom); placements take `slot: 1|2` and
  `resolveMotionComicLayout` (tool layer, mint-time) aspect-fits the
  source into the slot so art never stretches; explicit `at` always wins.
  (2) **`swap` delta** — "direct single panel action": `{ swap: { of, to:
  <source> }, enter?: 'cut'|'fade' }` replaces a placement's art IN PLACE
  (same rect, same camera) — action beats, subtle motions, impact frames.
  CUT is the default: the reader's mind interpolates the in-between
  (closure) — the infinite-comic paradigm, one frame per scene, the story
  moves by cuts within it. Variants are authored as same-camera panels;
  later zone says resolve against the ACTIVE art; each variant is its own
  asset (`<placement>#v<n>`), stacked in the player and toggled by the
  fold. (3) Doctrine recorded: the breakdown is the SCENE — a motion comic
  is composed of scenes, never pages. Demo re-authored: full-spread piecing,
  a two-panel exchange, a reach→brace impact cut with a post-cut shout —
  all verified in screenshots; 24 unit tests.
- **M0.3 (2026-08-08, in-tree): splash + the trick protocol.** Operator
  additions. (1) **`splash` layout** — the 80% showcase panel floating in
  matte; `full-spread` corrected to a TRUE bleed (edge to edge, no pad).
  (2) **`move` delta** — the camera-cheat primitive: reposition/resize in
  place (`enter: 'ease'` default | `'cut'` jump-reframe); shrink = depth /
  falling away, grow = approach / coming in fast; later zone says map
  through the moved rect. (3) **The tricks protocol** — the
  keyframe-animation CHEAT SHELF (animation-cheats.plan.md §3) ADOPTED as
  vocabulary, not imported as code (the shelf is a proposed vocabulary
  whose body-path implementation its own Addendum 4 reversed): camera
  cheats → `move` recipes (approach / recede / drift / splash-reveal),
  body cheats → `swap` recipes + variant-authoring guidance (quick-cut
  beat, impact frame, expression swap, held flurry, waist-up hold),
  effect cheats → in the variant art until M1's `fx` overlay. Shipped as
  the `motion-comic-tricks` sketch-vocab card — the scene-directing
  protocol, retrievable by intent. Demo: the grab scene is now a splash
  with a recede beat after the impact; 27 unit tests.
- **M0.4 (2026-08-08, in-tree): SFX lettering as composer-owned overlays.**
  Operator primitive: sound effects / word lettering as Z-INDEX overlays on
  the art, so the image worker NEVER paints text — placement and treatment
  are the COMPOSER's job (the sequential-art "no readable text from the
  generative layer, ever" doctrine, carried into the time dimension). The
  `letter` delta (promoted from M1): `{ letter: { text, at, of?, effect:
  '3d'|'xmen-90s'|'none', fill/shadowFill/stroke?, rotate? }, enter:
  'slam-in' (default)|'pop'|'fade'|'none' }`. Glyphs are constructed
  server-side at emit by the deterministic handwritten-bubble kernel
  (`handwrittenBubbleLetterMarks`, now exported from depiction-layout.js;
  seeded per key+text — byte-stable) into an inline SVG data URI; the
  player stacks art (z1) < letters (z2) < balloons (z3) < subtitles (z4),
  letters accrete like balloons, `clear` wipes them, and `of`-anchored
  letters ride their placement's moves (the same fraction re-projection as
  anchored balloons — added this batch after the recede shot showed
  lettering left behind). Consequence worth naming: the same painted panel
  serves any language / re-word / re-time with zero repaints. Demo: the
  impact cut now lands with a rotated xmen-90s "KRAKOOM!" slam; 29 unit
  tests; tricks card gains `sfx-slam`.
- **M0.5 (2026-08-10, in-tree): the Balak gaps closed + posture sealed.**
  Operator call after the Balak research: "the powerpoint is the means,
  not the end goal — we are aligned with them" — posture rewritten in
  plan + cards (the kind IS Turbomedia given a substrate). The three
  machinery gaps built: (1) **`hold`** — the held beat, an authored empty
  click (validation previously forbade it); (2) **`focus`** — rack focus,
  `{ focus: { on } } | false`: every other placement + non-anchored
  overlays dim (CSS filter, 0.35s), no camera move — the Infinite Comics
  signature; (3) **say `tail`s** — 8-direction foreshadow pointers hung
  on the carrier edge (stroked SVG triangle; rides anchored re-projection).
  Teaching gaps shipped as tricks-card recipes: held beat, rack focus,
  foreshadow tail, build-and-collapse, black-frame beat, match cut,
  evolving light, click-density pacing + the 80-vignette≙24-page
  constant. 32 unit tests; demo gains a tail on the first balloon, a
  rack-focus beat on the chart, and a held beat before dawn's clear.
- **M1+ unchanged** (camera windows + fx overlays; authoring ergonomics;
  derived renders / audio / parallax / scroll skin stay unscheduled).
