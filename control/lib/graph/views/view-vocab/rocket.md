---
{
  "id": "rocket",
  "name": "Rocket mission",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a Falcon-9-class LAUNCH + RETURN depictor — a full booster mission (liftoff, gravity turn, Max-Q, MECO, separation, boostback, entry burn, hoverslam landing) integrated with real forces and flown live in the 3D World.",
  "when": "Reach for this on framing like 'show me a rocket launch / the Falcon 9 landing / how boosters come back / a launch and re-entry simulation / why the landing is a suicide burn / teach me the rocket equation in motion'."
}
---

Mint a Falcon-9-class LAUNCH + RETURN depictor — a science/education viewer where a booster flies its WHOLE MISSION in the traversable three.js World: liftoff, the pitch-over kick into a true gravity turn, the Max-Q throttle bucket, MECO on the propellant return-reserve, stage separation (stage 2 pulls away toward orbit on its own mover), the 180° flip, (RTLS) the boostback burn that reverses the downrange velocity, the threshold-triggered entry burn, the tail-first grid-fin descent, and the HOVERSLAM landing burn — one engine, ignited low, timed to hit v ≈ 0 exactly at the pad, because minimum thrust exceeds the near-dry booster's weight and it cannot hover. Every acceleration comes from a REAL force, integrated by the physics/rocket.js primitive: altitude-compensated thrust with mass flow ṁ = T/(Isp·g₀), Mach-dependent drag against a US Standard Atmosphere 1976 fit (transonic C_d rise on ascent, blunt tail-first C_d on descent), and inverse-square gravity. The honesty line is stated on the artifact: the FORCES are real, the GUIDANCE is scripted (open-loop pitch program + threshold-triggered burns + the deterministic hoverslam law a = v²/2h + g), not the closed-loop convex optimization a real F9 flies; 2-D planar, kinematic attitude. The `falcon9` vehicle preset carries SpaceX-published constants (plus source-commented public estimates) and is pinned by a webcast-telemetry test band; a CUSTOM vehicle spec is the operator's own dial. The trajectory is TRUE-SCALE and resampled at equal TIME steps, so the booster's visible speed IS its acceleration — the strobe ghosts bunch at liftoff (TWR ≈ 1.5) and stretch toward MECO as 400 t of propellant burns off: the rocket equation, visible. A live mission HUD narrates phase, real clock, altitude, speed/Mach, the DRAINING mass, thrust, TWR, dynamic pressure, and a propellant bar. CLICK the booster / stage 2 / pad for facts. Served as a live World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); the stored manifest is ONLY the recipe (`manifest.kind === 'rocket-view'`) and the mission re-integrates on render — same recipe, same flight. Honest SI read-back via `measure_view` ({ t, pos, speed, accel, mass, thrust, drag, q, phase } + the event table: Max-Q, MECO, apogee, landing ignition, touchdown). ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. (Gravity-as-ORBIT — bodies circling a planet — is the `orbit` kind; a single thrown ball in real air is mechanics' `flight` scenario; this is the multi-phase launch vehicle.)

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `scenario` (string) — Mission profile (default 'rtls'): 'rtls' = return to launch site — steep ascent, boostback burn, the booster lands back at the pad (the classic loop trajectory); 'asds' = droneship landing — flatter, faster ascent with no boostback, the booster lands on a deck hundreds of km downrange (the long arc).
- `payload` (number) — Payload mass in kg (default 10000 rtls / 13000 asds). Heavier payloads stage later and faster; the return budget is unchanged, so the reserve does more work.
- `vehicle` (string | object) — 'falcon9' (default) or a custom vehicle spec { diameter?, stage1?: { dry, prop, thrustSL, thrustVac, ispSL, ispVac, nEngines, minThrottle, cdDescent }, stage2?, fairing?, aeroAscent? } — missing fields inherit falcon9's; the operator owns custom constants.
- `guidance` (object) — Advanced: override any scripted-guidance knob (kickDeg, reserveFrac, entryAlt, entryDv, landMargin, aMaxG, …). The physics underneath does not move; only the flown profile does.
- `playback` (number) — Playback seconds for the whole mission (default 75; 20–240). The HUD clock always shows REAL mission time.
- `trace` (boolean) — Draw the persistent trajectory ribbon (default true).
- `strobe` (boolean) — Drop faint equal-time afterimages of the booster; their spacing visualizes the acceleration growing as propellant burns (default true).
- `strobeEvery` (number) — Sample interval between strobe afterimages (default 18; lower = denser).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
