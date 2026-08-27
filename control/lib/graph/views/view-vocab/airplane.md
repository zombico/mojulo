---
{
  "id": "airplane",
  "name": "Airplane flight",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a FIXED-WING FLIGHT depictor — a complete airline hop (takeoff roll, climb, cruise, 3° approach, flare, touchdown) or an engines-out glide, integrated on the four real forces and flown by the airport primitive's own plane in the 3D World.",
  "when": "Reach for this on framing like 'show me how planes fly / a takeoff and landing simulation / how wings make lift / what happens when the engines quit / the four forces of flight / angle of attack and stall / why planes flare before touchdown'."
}
---

Mint a FIXED-WING FLIGHT depictor — a science/education viewer where an airliner flies a WHOLE FLIGHT in the traversable three.js World on the FOUR FORCES: lift (a real C_L(α) curve — linear to the stall, then the droop; flap configurations shift it), drag (parasite + INDUCED, C_D0 + C_L²/πARe, with gear and speedbrake penalties), thrust (jet static thrust with altitude lapse), and weight. Two missions: 'hop' — brake release, takeoff roll, rotation at Vr, climb, a held cruise, the standard 3° descent aimed at a runway downrange, gear-and-flaps approach, a sink-proportional FLARE to a soft touchdown, and the braked rollout to a stop; 'glide' — the engines QUIT at cruise and the ship rides best-L/D down to a deadstick landing, the published ~15-17:1 narrowbody glide ratio made visible (the Gimli-glider / Hudson lesson: an airliner without engines is a heavy, fast, perfectly flyable glider). The honesty line is stated on the artifact: the FORCES are real (integrated every step against the US Standard Atmosphere), the PILOT is scripted — rate-limited pitch commands from simple hold-a-speed / hold-a-path laws, not an FMS; 2-D planar (no turns — the hop flies straight to a runway downrange), constant mass, no wind. The `a320` aircraft preset carries public A320-class constants (Airbus wing geometry, CFM thrust, published aero reconstructions) pinned by a performance test band (rotation speed, ground roll, approach geometry, touchdown sink, glide ratio); a CUSTOM spec is the operator's own dial. The AIRCRAFT BODY is the airport primitive's own plane — the fixed-wing vehicle net from the meta-fabricator registry ('airliner' by default; 'widebody' / 'regional' / 'bizjet' selectable) — walked and pitched by a pose mover along the true-scale, honestly FLAT flight path, with equal-time strobe ghosts spreading as the takeoff roll accelerates. A flight-deck HUD narrates phase, clock, altitude, airspeed, ANGLE OF ATTACK, C_L, live L/D, thrust and the flap/gear configuration. CLICK the plane or either runway for facts. Served as a live World at `/api/sketches/<ref>/world`; the stored manifest is ONLY the recipe (`manifest.kind === 'airplane-view'`) and the flight re-integrates on render. Honest SI read-back via `measure_view` ({ t, pos, speed, accel, alpha, cl, lift, drag, thrust, phase } + the event table: rotate, liftoff, engines-out, touchdown, glide ratio). ORBIT-ONLY object study: no CSS-3D `/scene` form. (A thrown BALL in real air is mechanics' `flight` scenario; the multirotor force-balance is mechanics' `drone`; the launch vehicle is the `rocket` kind; this is the fixed WING.)

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `mission` (string) — Flight profile (default 'hop'): 'hop' = the complete airline flight, takeoff to full stop at a runway downrange; 'glide' = engines out at cruise, best-L/D deadstick landing (steeper-than-3° honest glide, high flare, speed traded for a survivable touchdown).
- `plane` (string) — Which airport-primitive body flies it (default 'airliner'): 'airliner', 'widebody', 'regional', 'bizjet'. Cosmetic — the physics is the `aircraft` spec.
- `aircraft` (string | object) — 'a320' (default) or a custom spec { mass?, S?, AR?, e?, thrustStatic?, cd0?, a?, alphaStall?, configs?, … } — missing fields inherit a320's; the operator owns custom constants.
- `guidance` (object) — Advanced: override any scripted-pilot knob (cruiseAlt, cruiseSpeed, glideslope, flareAlt, pitchRate, rotateFactor, appFactor, …). The physics underneath does not move.
- `playback` (number) — Playback seconds for the whole flight (default 70; 20–240). The HUD clock shows REAL flight time.
- `trace` (boolean) — Draw the persistent flight-path ribbon (default true).
- `strobe` (boolean) — Drop faint equal-time afterimages; their spreading spacing IS the takeoff acceleration (default true).
- `strobeEvery` (number) — Sample interval between strobe afterimages (default 16; lower = denser).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
