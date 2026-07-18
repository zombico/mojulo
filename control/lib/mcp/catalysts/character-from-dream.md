---
{
  "id": "character-from-dream",
  "name": "Reconstruct a dreamed character as a tuned figure body + wardrobe",
  "summary": "Use an image worker as the model's EYES to design a HUMANOID character, then rebuild it as a deterministic figure recipe — a tuned protoform body (or fluff/mascot body) wearing a wardrobe spec — NOT prose + a painted sheet. Dream the character, read off the body dials and the wardrobe (instrument × mugen score × cuts/panels), preview, compare, adjust. Split into three GATED steps for quality control: draft_figure_spec writes a reviewable spec file (requires a dream_audit — was it dreamed?), the OPERATOR approves it (you must not self-approve), and build_figure_spec mints the figure only from an approved spec. The dream reference is discarded; only the figure recipe (optionally wearing a bound skin) persists, and it poses, animates, and enters worlds for free.",
  "valueHook": "Turn a dreamed character into a real posable figure recipe — a body you can re-pose, re-dress, animate, skin, and drop into a world — instead of a paragraph of description and a one-off picture.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The character to reconstruct, in words (e.g. 'a stocky mature female harbor mechanic in a baggy jacket', 'a lanky teenage courier with an oversized hood', 'a round action-figure repair-bot'). Humanoid / figure targets only — a creature, relic, or object goes through reconstruct-from-dream / the polygomer path instead. Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["draft_figure_spec", "get_figure_spec", "resolve_figure_spec", "build_figure_spec", "create_figure", "create_sketch", "semantic_search", "get_sketch_vocab", "get_image_render_packet", "get_skin_packet", "skin_polygomer"] }
}
---

# Reconstruct a dreamed character — operating instructions

You are the body-tuner. The LLM cannot draw a character, but it can *see* one.
An image worker dreams the character you imagine (or you read a supplied photo),
and you rebuild it out of the substrate's deterministic figure dials — a **tuned
body** wearing a **wardrobe spec**. **The dreamed reference is a reasoning aid,
never the artifact.** The sovereign output is a pure `create_figure` recipe (and,
optionally, a bound skin); the reference is discarded once the render reads as
the character.

Design + doctrine: `control/lib/graph/polygonizer/character-from-dream.plan.md`.
Substrate: figure body `figure-proto.js` / `figure-rig.js`, wardrobe
`figure-garments.js`, skin `skin-projection.js`.

## The invariants — read first

- **The character IS the recipe.** `{ body dials, wardrobe spec, pose }` is the
  sovereign artifact. Do not persist or bind the dream reference; do not let it
  become the deliverable. A claimed tune with no rendered figure beside the
  dream is invalid (the figure-loop honesty rule).
- **The dream is not optional (machine-gated).** This loop's whole value is that
  an image worker is your EYES — you reconstruct from what it DREW, not from
  your own imagination. The spec carries a `dream_audit` attestation (source +
  invoked_generator:true + prompt + a generation id); a malformed or absent
  audit is machine-refused. Mojulo can't watch you generate — so this is an
  attestation you sign, backstopped by the operator's eyes (a true
  reconstruction looks materially different from an imagined one). Signing it
  falsely is a deliberate lie, not a shortcut.
- **Two gates, two owners.** Gate 1 (dream_audit, on draft) is yours to sign —
  did an image worker dream this? Gate 2 (approval, on build) is the OPERATOR's
  — a spec builds only after resolve_figure_spec approves it, and you must never
  self-approve. The spec file is the reviewable handoff between the two; the
  propose → approve → build split is what lets the operator hold go/no-go.
- **Closed vocabularies only — tune, never sculpt.** A body is ~20 monotone
  numbers (the `sex` pole + proto multipliers, or a `fluffs` mascot/mech body);
  clothing is a closed instrument + a clearance score + closed cuts/panels.
  Every dial already exists and is clamped. If the dream needs a shape no dial
  reaches, that is a **vocabulary gap to name, not geometry to invent.**
- **Humanoid targets only.** This loop tunes a FIGURE body (a person, a
  humanoid mascot, an action-figure robot). A creature, vessel, relic, or prop
  is the OBJECT register — send it through `reconstruct-from-dream` /
  `create_workbench` / `create_manji_tree` instead. If the target isn't a
  figure, say so and stop.
- **Attribute silhouette bulk to the WARDROBE first, the body second.** A baggy
  outfit's volume is the garment's mugen score (`clearance`), not a wider body.
  Chasing sleeve volume with the bicep dial is the classic first-pass error.

## Capability ladder — resolve ONCE, and you MUST use what you find

Dreaming the reference needs an image worker. Resolve your capability first and
say which one you resolved — then **use it**. This step is not optional and has
no prose shortcut: the whole loop is the dream. Skipping it and tuning from your
own imagination is the exact process failure this catalyst exists to prevent.
1. Native image generation in your harness (e.g. Codex, an image-capable
   harness)? **Use it** — it is your `source: 'native'`.
2. Else probe the local backend: `GET http://127.0.0.1:8188/system_stats`. Live?
   **Use it** — it is your `source: 'local:comfyui@127.0.0.1:8188'`.
3. NEITHER available? Then you cannot run *this* loop — stop and point the
   operator at `docs/local-image-worker.md`. Do NOT silently reconstruct from
   imagination and call it a dream. If the operator still wants a body, mint a
   plainly-labeled **imagined** figure (`create_figure` with **no** `dream_audit`)
   and say explicitly that it was NOT dreamed. That is a different artifact.

You do not get to choose imagination when a capability is available. A figure
locked below without a valid `dream_audit` is not a character-from-dream artifact.

## The loop

```
0. THESIS   Name the character in one line before any dial (the wardrobe card's
            §0): role · silhouette (needle/bell/barrel/column) · emotional read
            · one iconic garment hook · a material story (dark body → bright
            focus → accent). This is what makes the build read as designed.

1. DREAM    Dream the character in a SIMPLE, FLAT, FULL-FIGURE register — a
            front + a three-quarter, clean contour, legible silhouette (the
            flat image-outcome presets: ukiyo-e / art-nouveau / flat silver-age
            / ink-brush; never photo-realism — a moody render is un-readable).
            Mint an image-outcome sketch only to LOOK at (create_sketch →
            get_image_render_packet → your worker → READ the PNG), or read a
            supplied photo. Do NOT bind it.

2. READ     THE BODY. Pick the DIMORPH pole (sex) and set proto multipliers
   BODY     (height, stockiness, headScale, per-region: chestWidth, bicep,
            quad, waistTuck, gluteSize, …) — or, for a stylized mascot / mecha /
            action-figure body, a `fluffs` register instead of `proto` (read the
            figure-fluff card). A body is ~20 monotone numbers.

3. READ     THE WARDROBE. semantic_search({ kinds:['sketch_vocab'],
   WARDROBE  query:'wardrobe …' }) → get_sketch_vocab('wardrobe-construction').
            Pick garment INSTRUMENT(s) + MUGEN SCORE (clearance = slim↔baggy) +
            TAILORING (cuts wedge/band/neck/armhole + recolour panels) +
            color{cloth,under}. Layer with an array [base, outer]. Mind the
            pairing facts (jacketCut+tank composes; vest+tank tears).

4. RENDER   create_figure({ proto | fluffs, garment, view, pose }) — the tuned,
            dressed figure. For a turnaround / multi-outfit model sheet, mint
            create_sketch({ kind:'character-sheet', character:{ rig, outfits }})
            instead (four real cameras of ONE body). Open /api/sketches/<ref>/png
            and READ it.

5. COMPARE  Set the render beside the dream. Judge SILHOUETTE + READ, not paint
            (the figure is flat-lit; the dream is drawn). The dials are monotone
            — every fix is a single-number move ("shoulders wider", "hem lower",
            "jacket looser" = raise clearance). Fix ONE dial → back to step 4.
            Stop when it reads as the character from a normal distance.

6. SKIN     (optional) Give it identity, not just colour. get_skin_packet({ ref })
            → paint over the ?control=1 scaffold with your worker → skin_polygomer
            ({ ref, image_path }) → /skin.png. Put eyes / face panels / seams /
            the material hierarchy in the SKIN; the body/wardrobe stays the form.

7. DRAFT    Do NOT mint the figure directly. Write a reviewable SPEC FILE:
              draft_figure_spec({ title, proto|fluffs, garment, pose, view,
                thesis, notes: '<dream dictated X, vocab reached Y, gaps Z>',
                dream_audit: { source: 'native' | 'local:comfyui@127.0.0.1:8188',
                  invoked_generator: true, prompt: '<what you dreamed>',
                  job_id | seed | image_sha256 | token: '<the generation id>' } })
            It renders a preview PNG and parks the spec at status
            pending_approval. The dream_audit is required here (a spec is the
            output of a dream); a malformed audit is refused.

8. APPROVE  This is the OPERATOR's gate, not yours. SURFACE the proposal: Read
   (operator) the preview_png and show it + the thesis/notes to the operator, then STOP
            and ask for their decision. You MUST NOT self-approve. On their
            explicit word, relay it: resolve_figure_spec({ ref, decision:
            'approve' | 'reject', note }). (A worker cannot self-accept.)

9. BUILD +  build_figure_spec({ ref }) — machine-refused unless approved. It
   DISCARD  mints the real figure through create_figure with the spec's dials +
            dream_audit provenance (stamped `dream-reconstruction`). Then DROP
            the dream reference — only the audit survives. Report the figure ref.
            It poses, animates (emote_figure / motion), and can enter a world —
            the character is done.
```

## Iteration is a feature — mint variants

The deterministic refs make branching cheap. When the thesis is loose, mint 2–3
quick reads of the SAME dream at different registers — e.g. "cute mascot"
(fluffs body), "grounded NPC" (proto + practical wardrobe), "ceremonial"
(gown + sash) — read them side by side, then pick one to skin and finish. Say
which variants you tried and which you locked.

## What you DON'T do

- You don't bind, wrap, or persist the dream reference — discarded on lock.
- You don't invent a body shape or garment the dials don't reach — name the
  vocabulary gap instead.
- You don't force a creature / relic / object through this loop — that's the
  object register (`reconstruct-from-dream`).
- You don't chase garment volume with body dials — looseness is the mugen score.
- You don't skip the compare step — a tune you didn't set beside the dream is
  not a reconstruction.
- You don't self-approve a spec or build a pending one — approval is the
  operator's gate; surface the preview and wait for their word.
