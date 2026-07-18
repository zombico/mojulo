# L1 — nero-airfist: a new character + new motion, ridden on the local rung

Status: DONE 2026-07-13 (local rung, 11 generations). See
[l1-nero-airfist/keys/DELIVERED.md](../../../../../lite-template/integration/0712/spike-output/animation-cheats/l1-nero-airfist/keys/DELIVERED.md).
Both seams opened: `.json` keyframe-motion specs (emit-keys + bicycle init,
copied as `motion.json`) and a from-scratch local-rung character bootstrap
(Nero, accepted first identity roll). GIF at `l1-nero-airfist/composite/motion.gif`.
Originally MINTED 2026-07-12. Written for a fresh agent.
Parent doctrine: [animation-cheats.plan.md](../animation-cheats.plan.md)
(Addendum 4 + the bicycle sections) — read those first. The goal is a
**6-key fist-pump GIF in the spirit of k1-nera-wave, painted entirely by
the LOCAL image worker** (ComfyUI — no Codex), for a NEW male character:
`l1-nero-airfist`. This is the bicycle's first ride with BOTH a new
character and a new motion, so it exercises the two extension seams the
existing rides never touched.

## What exists (do not rebuild)

- **The bicycle** ([bicycle.mjs](bicycle.mjs)): `init` (guides + JOB.md +
  status.json), `render` (local ComfyUI rung via
  [local-render.mjs](local-render.mjs): img2img over each meru guide +
  per-key OpenPose skeleton + IP-Adapter identity; knobs `--only key-N
  --seed --denoise --cn --ip --tags --neg`), `audit` (meru gate,
  auto-normalizes pure scale violations, per-cel RETRY.md, on-twos GIF),
  `status`. Worked examples: k1-nera-wave (Codex), k2-lio-wave (local).
- **Guide emission** ([emit-keys.mjs](emit-keys.mjs)): normalizes every
  key into the canonical spine unit; emits guide.png + skeleton.png +
  nodes.json per key + contact sheet.
- **Local-rung failure modes, already learned (k2)**: the checkpoint's
  `1girl` prior flips male characters — ALWAYS pass
  `--tags "1boy, male, ..." --neg "1girl, female, ..."` for a boy;
  identity drifts on unlucky pose+seed combos — seed-roll individual
  cels with `--only`; the eyes gate (register/facing/identity) is YOURS,
  per cel, every render pass. Scale violations self-heal (audit
  auto-normalize), so don't reroll for size alone.

## Two seams this ride must open

### 1. Motion specs beyond the named vocabulary

`emit-keys.mjs` passes its motion arg straight to `sampleMotionPose`,
which resolves 'walk'/'wave'/'stretch' by name — there is no fist-pump.
The rig already supports custom motions: `resolveMotion` (figure-posing)
accepts `{ keyframes: [pose, …], loop: true }` and blends between poses
(`keyframeMotion`, smooth-stepped, looping). **Extend emit-keys (and
bicycle init's `--motion` flag) to accept a path to a `.json` motion
spec** — if the arg ends in `.json`, load it and pass the object; the
spec file gets copied into the job dir as `motion.json` (provenance).

Starting fist-pump spec (6 keys sampled from a 2-keyframe loop reads as
a metronome — author ~4 keyposes for anticipation/punch/recoil; DOF
reference: poses are `{ shR: {pitch,yaw}, elbowR, spine, crouch, … }`,
same vocabulary as APOSE/sampleMotionPose output):

```json
{ "loop": true, "keyframes": [
  { "shR": { "pitch": 30 },  "elbowR": 100, "shL": { "yaw": 12 }, "elbowL": 20, "crouch": 0.12, "hipL": { "yaw": 8 }, "hipR": { "yaw": -8 } },
  { "shR": { "pitch": 55 },  "elbowR": 120, "shL": { "yaw": 12 }, "elbowL": 20, "crouch": 0.18, "hipL": { "yaw": 8 }, "hipR": { "yaw": -8 } },
  { "shR": { "pitch": 95 },  "elbowR": 55,  "shL": { "yaw": 15 }, "elbowL": 15, "crouch": 0,    "hipL": { "yaw": 8 }, "hipR": { "yaw": -8 } },
  { "shR": { "pitch": 70 },  "elbowR": 85,  "shL": { "yaw": 13 }, "elbowL": 18, "crouch": 0.06, "hipL": { "yaw": 8 }, "hipR": { "yaw": -8 } }
] }
```

Numbers are a STARTING GUESS — the workflow is: emit → LOOK at
`keys/contact-sheet.png` (the mannequin cycle must read as a fist pump
BEFORE any generation is spent — the rig-preview-gates-timing doctrine)
→ tune the spec → re-emit. Sign conventions bite (Addendum 3: DOF signs
are absolute, not mirrored — shR pitch raises the RIGHT arm; verify on
the contact sheet, not by reasoning). `crouch` gives the body bounce
that sells the pump. Also verify the wrist: `fingersR: 30`-ish curls a
fist if the DOF exists (check articulate's hand DOF — `fingersR`).

### 2. Bootstrapping a NEW character's identity on the local rung

`bicycle init --character` requires `renders/front-full.png` (the
IP-Adapter identity anchor) + `renders/DELIVERED.md` (description). A
new character has neither. Bootstrap:

1. Create the character dir
   (`…/animation-cheats/nero-fist-boy/renders/`) and write DELIVERED.md
   with a `## Character Description` section. Design brief for Nero —
   a boy, deliberately distinct from Lio (courier, coral/indigo) and
   Nera (signal runner, gold/charcoal): e.g. *short spiky black hair
   with a red sports headband, sleeveless white training vest with
   black trim, red hand wraps, dark gray athletic shorts, black
   high-top sneakers with red laces, warm light-brown skin, confident
   grin*. Sleeveless = bare arms = the fist reads clearly. Adjust
   freely; what matters: outfit reads at cel scale, colors distinct
   from the other two characters.
2. Generate the identity render: one A-pose generation over the meru
   guide (`…/animation-cheats/meru-guide-apose.png`) with NO identity
   input — run local-render against a throwaway job (or drive the
   compile template directly): base = the guide, pose = an A-pose
   skeleton, `--ip 0.05` (the IP-Adapter slot needs an image — pass the
   guide itself at negligible weight), denoise 0.9,
   `--tags "1boy, male, <description tokens>"`,
   `--neg "1girl, female, mannequin"`. Seed-roll until YOUR EYES accept
   one (front-facing, painted register, on-model to the description);
   save it as `renders/front-full.png`. That render IS Nero now — the
   description in DELIVERED.md should be updated to match what was
   actually accepted (paint outranks brief, the P0 calibration lesson).
3. From here it's the standard ride.

## The ride

```
node lib/graph/image-outcomes/keyframe-spike/bicycle.mjs init \
  <…>/animation-cheats/l1-nero-airfist \
  --character <…>/animation-cheats/nero-fist-boy \
  --motion <…>/fist-pump.json --k 6
# LOOK at keys/contact-sheet.png — tune motion.json until the mannequin pumps
node …/bicycle.mjs render <…>/l1-nero-airfist \
  --tags "1boy, male, short spiky black hair, red headband" \
  --neg "1girl, female, long hair"
# LOOK at every cel (identity/register/facing) — reroll strays with --only/--seed
node …/bicycle.mjs audit <…>/l1-nero-airfist
# fix retries, repeat until status.json done → composite/motion.gif
```

## Success criteria

1. The mannequin contact sheet reads as a fist pump before any
   generation is spent.
2. All six cels pass the meru gate (auto-normalize allowed) AND the
   eyes gate: same boy, same outfit, front-facing, painted register, in
   every cel.
3. `composite/motion.gif` reads as one character pumping his fist —
   with the crouch bounce visible.
4. Total generation count recorded in a DELIVERED.md (identity rolls +
   cel rolls) — the local rung's cost profile for a from-scratch
   character is part of what this ride measures.

## Out of scope

- Face sub-cels (separate plan:
  [face-subcels.plan.md](face-subcels.plan.md)).
- Codex involvement — this ride is deliberately local-only.
- Effects (speed lines, impact flash) on the pump — tempting, but they
  are the cheat-shelf's business; keep L1 a clean keyframe ride.
