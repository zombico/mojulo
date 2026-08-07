---
{ "id": "blob-pla", "name": "blobPla joinery adapter", "summary": "quiet round-mass joinery between coherent blobs without distorting either mass", "when": "two blobs/round masses need a peg, ball, washer, spacer, stem, socket, or seat — connector or layering help without disturbing the source/receiver forms", "tier": "render-primitive", "marks": ["blobPla"], "phase": "p1" }
---

`blobPla` lowers a quiet round-mass joinery adapter into ordinary marks: a
stem line, socket circle, and joint sphere tagged with
`blobPlaAdapter`/`blobPlaPart` metadata. It is construction joinery, not a
replacement for the source/receiver shapes.

## Shape

```
blobPla{
  role,
  sourceRole?, receiverRole?,
  sourcePoint?, receiverPoint?,
  joint?:  { role?, center?, radius?, fill?, stroke? },
  socket?: { role?, center?, radius?, fill?, stroke? },
  stem?:   { enabled?, role?, radius?, stroke? },
  gravity?:{ lowerUnit? },
  fill?, stroke?, z?
}
```

## What it preserves

- The source and receiver masses, untouched.
- Z / layer / contact relationships, clarified with minimal prompting.
- Gravity or sticky-boots resolution at the adapter, not per part.

## When to reach for it

- Two coherent blobs/round masses that need a peg, ball, washer, spacer,
  optional stem, or circular seat/socket without either mass distorting.
- The BlobPla metaconcept: when round shapes need quiet connector or
  layering help, emit one `blobPla` construction mark for direct joinery
  between `sourceRole` and `receiverRole`.
