---
{
  "id": "motion-waypoints",
  "name": "Walk to a place in a world — verify walkability",
  "summary": "Compile a waypoint route into a deterministic run; the walkability audit.",
  "when": "\"walk to the exit\", \"send the character to X then Y\", \"can you reach the platform\", \"verify the world is traversable\", \"audit walkability\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion` TRAVERSAL with `shot.waypoints` (a [x,y] route) instead of hand-authored ticks: each leg is COMPILED into the tick script against the live walk/platform rule (closed-loop steering; no pathfinding — a blocked/void leg reports `{stuck, atTick}` in the recipe's `legs` and the final probe shows where the route died). The compiled ticks are stored, so the recipe replays deterministically like any traversal. Compile entrance→exit + check `legs`/final probe = the walkability audit. This is also how `create_game` level audits are compiled (`audits` / `auto_audit:true`). (Audit-only: builds no world and hosts no session; authoring belongs to `create_game` / `compose_world`.) Full family → `get_creative_toolset({ form: 'motion' })`.
