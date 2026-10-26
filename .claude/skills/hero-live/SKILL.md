---
name: hero-live
description: Play the HERO as an engine gets it — the skinned GLB with every clip and the face's morph weights keyed into the body's — in a live three.js viewer (orbit, takes, a scrubber, every morph channel live or held by hand, wireframe, bones), with variants of the same hero side by side (bare, an armour, an armour round), and print what each mint read back (the adornment verdicts, the pieces left off, the clearance, the warnings). Use to debug or iterate the face rig, the clips, the skinning or the dress on a MOVING body, to run the adornment loop on the realistic body, or to put a live hero in front of the operator (an artifact). Invoke as `/hero-live [--hero '{…}'] [--armour knight,aka] [--variants '[…]'] [--clips '{…}'] [--publish]`.
---

# hero-live

The stills (`/body-study`, `/head-study`) show a pose; this shows the hero **playing**: the exported skinned GLB, the
same file Godot or Unity gets, its clips at their pace, the face's blend shapes moving on the body's beats. Each variant
is minted through the door (`create_character`) and exported (`export_model`, `skinned: true`, every clip), so what
plays is what ships. The machine read prints per variant; the eyes gate is the operator's.

## Use it

```bash
# mint, export and write the page (each variant its own process, --jobs at a time; a realistic mint is a few minutes)
node .claude/skills/hero-live/live.mjs --armour knight --out /tmp/hero-live
# serve it on loopback and open http://127.0.0.1:8765/
node .claude/skills/hero-live/live.mjs --out /tmp/hero-live --reuse --serve
# frames for an agent to Read: shots/sheet.png
node .claude/skills/hero-live/shot.mjs --out /tmp/hero-live \
     --shots '[{"variant":"knight","take":"greet","view":"vBody","phase":0.45},{"variant":"bare","view":"vFace","hold":{"smile":1}}]'
```

- `--hero` the spec every variant starts from (default: realistic female, seed 11, framed close at 1080p).
- `--armour` one variant per armour style (`lib/graph/armor/styles.js` `SEEDED_ARMOR`). The traditional ones are `knight`
  (plate) and `aka`, `kuro-kon` and `shiro` (lamellar).
- `--variants` more, each `{ id?, label, spec }` merged over `--hero`: an armour round, another face, another physique.
- `--clips` the door clips each variant carries. The default (greet, surprise, frown) keys the western face words and
  the jaw, which the landmark and relational heads take. The anime head takes its own words: pass `--clips`, or `none`.
- `--reuse` keeps variants already in `--out`, so a change to the page alone costs no mint.
- `--publish` packs each GLB as base64 JSON (an artifact host serves no `.glb`) and loads three from its pinned CDN
  build. Publish `index.html` with each `<id>.json` as a supporting file, as the run prints.

`shot.mjs` needs a Chromium: `lib/graph/scene/chromium.js` resolves and launches it, and `MOJULO_CHROMIUM` names one
it does not find (a Playwright build: `/opt/pw-browsers/chromium-*/chrome-linux/chrome`).

The page: variants (switching keeps the take and the moment), takes, play and pause, a scrubber, the speed, the Face,
Bust, Full body and Side views, the ambient blink layered as an engine would, wireframe, bones, every morph target as a meter
(or a slider under **Hold by hand**), and the mint's read per variant. `window.heroLive` drives it from a script.

## The adornment loop on it

The armour's machine read is the mint's `dress`, printed per variant:

- **verdicts**: each piece's signature (its studs, buckle or facing) `justified`, `reads, but small` or `unjustified`.
- **unworn**: pieces the body does not carry and so are not judged. On the realistic body the kit's trunk panels,
  hoops, feet and shoulders are its own field shells (a cuirass, a fauld, boots, caps: `body-relational-armour.js`),
  and the head's and the optional pieces (`wear`) are off.
- **sinking**: pieces that sink into the body or what it wears at some dial extreme (`station-loft-clearance.js`).

A round is a variant: change the build's WORDS (`dials`: `ornament` 0–3, `mass`, `coverage`, `stylize`; `wear`;
another style or `theme`), mint, read again, at most three rounds, as `/garment-design` does for cloth. When the words
cannot reach a finding (a signature on a piece the fit replaced), name the missing primitive and stop: that is a change
with its own plan, never a kernel edit to land one round. Then show the operator the page or the sheet. Say which
gate ran: the read's verdicts are the machine gate; the eyes gate is theirs. Never claim it passed.
