---
{
  "id": "publication-cook",
  "name": "Publish an outcome from gathered material",
  "summary": "Gather typed items into a stash, then cook them into a self-contained publication.",
  "when": "\"turn this into an essay / picture book / slide deck / flyer / brief / resume / newsletter / field guide / pamphlet / textbook / novel / visual guide / comic\"",
  "entry": "mint_stash"
}
---
→ `mint_stash` → `gather` typed items (text / markdown / image / svg / script / pointer / link / sketch) → optional `recommend_kind` → `cook` (one singular aim, ≥1 stash slice; AGENT authors report_md). Multi-kind preview: `forge_publications` cooks 2–4 candidate kinds at once. Outcomes file at `/outcomes/<cook_ref>/` as self-contained folders; browse from the `/outputs` page. Vibe-to-shape scaffold via `sketch_stash`. Cook stops at cook — `forge_plan({source:{kind:'cook',cook_ref}})` is a plan-side handoff, not a cook outlet.
