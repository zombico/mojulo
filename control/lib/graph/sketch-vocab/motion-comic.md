---
{ "id": "motion-comic", "name": "motion-comic — click-gated comic presentation (the powerpoint of comics)", "summary": "a comic pieced out click by click inside a fixed BOX: scenes (one per panel) whose events accrete balloons/elements/panels; two lettering modes (drawn bubbles or movie-style subtitles); played at /play, exported as ONE self-contained HTML file", "when": "make a motion comic, turn my comic into a click-through presentation, reveal panels one click at a time, each tap shows the next speech bubble, present my comic like a slideshow, kinetic novel, visual novel style comic, comic with movie subtitles, click to advance the story, a comic for my phone I tap through", "tier": "recipe" }
---

A `motion-comic` sketch is a **click-gated comic in the Turbomedia
grammar** (Balak's "about DIGITAL COMICS"; the lineage behind Marvel's
Infinite Comics): take one panel, piecemeal it out — a click per element —
until eventually the next element is a new panel, and so on until the
story is done. The click-gated slide mechanism is the MEANS; the comic
grammar — persistence of frame, closure between states, click-timed
surprise — is the medium. **A motion comic has no pages — it is bound by panels
only.** The PANEL is the showcase: each scene frames one panel crop into
the box; the sequential-art page is where panels come from, never what is
shown. There is no clock; **time is the click**, and state is a pure fold
`state(scene, i) = base ∘ events[0..i]`, so inserting or reordering events
never invalidates anything. The paradigm is the INFINITE COMIC: one camera
frame per scene, and the story moves by cuts *within* that frame — the
reader's mind interpolates the in-betweens (McCloud's closure, the key
principle of sequential art; the gutter lives between clicks). Minted with `create_sketch`
(kind `motion-comic`, no new tool); played at `/api/sketches/<ref>/play`;
`?download=1` exports **one self-contained HTML file** (small player + all
art inlined as data URIs — opens from disk, no server).

## The box comes first

Every motion comic is fully dependent on a deterministic **box** — the view
screen. Composition never reflows; the player letterboxes the whole box
(matte included) into whatever window it lands in.

```
box: {
  screen: 'phone-upright' | 'phone-wide' | 'square' | 'desktop' | { width, height },
  matte: '#000',            // what fills the box around the art — black-out /
}                           // white-out / any hex; the author's call
```

Presets (box coords, logical px): phone-upright 390×844, phone-wide 844×390,
square 900×900, desktop 1280×720. Want a small panel floating in darkness?
Place it small and let the matte hold the rest.

## Shape

```
{
  kind: 'motion-comic',
  title, intent,
  box: { screen: 'phone-upright', matte: '#000' },
  lettering: {
    mode: 'bubbles' | 'subtitles',          // per-scene override allowed
    subtitles?: { at?: 'bottom'|'top'|{y}, font?, size?, color?, bg?,
                  enter?: 'fade'|'type-on'|'cut', exit?: 'fade'|'cut' },
  },
  scenes: [{
    id: 's1', note?,                        // canonically ONE SCENE PER PANEL
    layout?: 'full-spread' | 'splash' | 'two-panel',   // named box regions:
      // full-spread = art bleeds to the whole screen; splash = the 80%
      // showcase floating in matte; two-panel divides along the LONG axis
      // (phone-upright stacks top/bottom). A placement then says slot: 1|2
      // instead of `at` — the slot is aspect-fitted at mint (explicit `at`
      // always wins).
    base: [                                 // on stage before the first click
      { id: 'panel',
        source: { pageRef: 'sk_…', panel: 'p1' }   // THE showcase: one panel crop
              | { ref: 'sk_…' },                   // or any sketch's whole face
        // face?: 'auto'|'svg'|'png'|'final' on either form
        at: { x, y, w, h },                 // box coords; matte fills the rest
        frame?: 'panel' | 'borderless' },   // 'panel' draws the comic border
    ],
    events: [                               // one click each; 1..n deltas per click
      { note?, do: [
        { say: { of: 'panel', zone: 0, tail?: 'down-left'|'down'|… },
          enter?: 'pop'|'fade'|'type-on'|'none' },   // tail = the foreshadow pointer
        //   ^ through a panel crop the panel is implicit; a whole-page
        //     placement must name it: { of, panel: 'p1', zone }
        { say: { text: '…', speaker?, carrier?: 'speech'|'thought'|'shout'|'narration',
                 at?: {x,y,w,h} }, style?: { font?, size?, color?, bg? } },
        { show: <placement>, enter?: 'pop'|'fade'|'slide'|'none' },
        { hide: '<placementId>', exit?: 'fade'|'none' },
        { focus: { on: '<placementId>' } | false },  // rack focus: all else dims
        { hold: true },                     // the held beat — an authored empty click
        { swap: { of: 'panel', to: <source> }, enter?: 'cut'|'fade' },
        //   ^ DIRECT SINGLE PANEL ACTION: same frame, same rect, new art —
        //     an action beat, a subtle motion, an impact frame. Default is
        //     the CUT (the mind interpolates); later zone says read the
        //     ACTIVE art. Author the variants as same-camera panels.
        { move: { of: 'panel', to: {x,y,w,h} }, enter?: 'ease'|'cut' },
        //   ^ the camera-cheat primitive: shrink = depth / falling away,
        //     grow = approach / coming in fast, translate = drift; 'cut'
        //     = jump-cut reframe. The full trick protocol (approach,
        //     recede, quick-cut beat, impact frame, expression swap,
        //     held flurry, …) is the `motion-comic-tricks` card.
        { letter: { text: 'CRASH!', at, of?, effect?: '3d'|'xmen-90s'|'none',
                    fill?, shadowFill?, stroke?, rotate? },
          enter?: 'slam-in'|'pop'|'fade'|'none' },
        //   ^ SFX LETTERING as a Z-INDEX OVERLAY: mojulo constructs the
        //     glyphs deterministically (the handwritten-bubble kernel) and
        //     composites them ABOVE the art — the image worker NEVER
        //     letters; placement and treatment are the composer's job.
        //     `of` anchors it to a placement (rides moves). ≤24 glyphs;
        //     dialogue goes through `say`.
        { clear: true },                    // wipe the box — a hard cut
      ]},
    ],
  }],
}
```

Rules that make it work:

- **The panel crop is the canonical placement.** `{ pageRef, panel }` cuts
  one panel out of a sequential-art page (scaffold crop when unbound,
  final.png crop when painted) — gate-checked at mint (page kind, panel
  exists). Companion sources are ANY sketch kind via `{ ref }`: `face:
  'auto'` prefers a finished `final.png`, falls back to the deterministic
  scaffold (the nēmu look is a legitimate fidelity — a worker-less page
  still plays); SVG/diagram kinds embed their SVG; heavy 3D kinds embed
  their baked PNG still. Match `at`'s aspect to the panel's bounds — art is
  drawn object-fit fill.
- **Zone says read the page's own lettering.** `{ of, panel: 'p1', zone: 0 }`
  resolves a sequential-art page's `panels[].bubbleZones[n]` — geometry AND
  text authored ONCE on the page, never duplicated. A dangling ref, missing
  panel, or letterless zone is a **mint error**, never a play-time one.
- **The art layer stays letterless.** Balloons AND SFX lettering are
  mojulo-drawn overlays stacked above the art (art < letters < balloons <
  subtitles) — nothing textual is ever asked of the image worker, so
  worker renders can never misspell, drift, or bake in lettering that a
  re-time would have to repaint.
- **Two lettering modes, one authored text.** `bubbles`: the say draws as a
  comic balloon (zone geometry, or inline `at` + `carrier` shape) and
  balloons ACCRETE in reading order. `subtitles`: no balloon — the line
  appears in a styled band (each click reads like a movie scene with subs,
  or a cut gif); a new say REPLACES the previous line; the author directs
  font/size/color/bg and the enter/exit transition directly. Mode is pure
  presentation — flip it (or override per scene) without touching an event.
- **Navigation is exactly four moves.** Forward: *next event* · *final page
  state* (the panel fully dressed). Back: *prev event* · *scene start* (the
  panel bare). Keyboard →/space/←/Home/End; tap zones on touch; deep-link
  `?s=<scene>&e=<event>` renders that exact fold.
- **Density restraint.** One or two deltas per click; stillness is a
  feature. Transitions are garnish (~0.4s, instant under
  prefers-reduced-motion) — the fold is the truth. The `swap` is where the
  restraint pays: because everything else holds still, a pose cut READS as
  motion.

## Worked example

Phone-upright, one scene per panel: scene 1's base places panel p1
(`{ pageRef, panel: 'p1' }`) floating in black matte. Click 1: `say` zone 0
(`pop`). Click 2: `say` zone 1. Advancing past the last event IS the next
panel — scene 2's base is p2. A mixed scene stacks a chart (`{ ref }`)
beside a panel; the last scene overrides `lettering.mode: 'subtitles'` for
a wordless stretch where narration runs as movie subs with `type-on`.

Mint → `/sketches/<ref>` (the player in an iframe) → iterate with
`update_sketch` (insert/reorder events is free — the fold recomputes) →
hand the story out as one HTML file via `/play?download=1`.

## Contrast (routing)

- an AUTO-PLAYING video of the subject → `forge_motion` (adds a clock; this
  kind deliberately has none).
- a PRINTED comic page / book → kind `sequential-art`, published via `cook`.
- a SCROLL webtoon → `cook` format `webtoon`.
- animated CHARACTERS (blinks, lip flaps, staged clips) → `keyframe-animation`
  / `scene-motion` — a motion comic moves the READER, not the drawing.
