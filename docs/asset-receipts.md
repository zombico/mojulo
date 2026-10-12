# Asset receipts

An optional way to show that an exported file is yours: you sign it with a key on your machine, and anyone you give
the file to can check the signature. The intended use is licensing. You grant someone a licence to an asset you made
in mojulo, and you send the receipt with it. **No lawyer has reviewed this yet.** Nothing here is legal advice.

The tools are in [asset-receipts.js](../control/lib/mcp/tools/asset-receipts.js), and the signing is in
[receipt.js](../control/lib/provenance/receipt.js).

## How it works

```
sign_asset({ path: '/…/data/outcomes/sk_ab12cd34ef/model.glb' })
  → /…/model.glb.proof.json      the receipt, beside the file
  → ~/.mojulo/receipts/<sha256>.json   your kept copy
verify_asset({ path: '/…/model.glb' })
  → { valid, checks: { file_matches, signature_valid, creator_id_matches_key }, asset, signed_at, creator_id, yours }
```

- **Opt-in by use.** Nothing signs unless `sign_asset` is called. Exports, test runs and sweeps never make receipts on
  their own.
- **The file is not changed.** The receipt sits beside it, so every export stays byte-identical. Metadata embedded in a
  file is stripped by the first re-save in Blender, an image editor or a slicer, so embedding would add little.
- **The creator key** is an Ed25519 key at `$MOJULO_HOME/creator.key` (mode 0600), made the first time you sign.
  There is no account. Your creator id is the key's fingerprint (`mjc_…`), pseudonymous until you say whose it is.
  Back the key up: without it you cannot show that an id is yours, and a lost key cannot be recovered.
- **What a receipt names:** the file's sha256 and size, the ref it came from, a canonical sha256 of the recipe
  (sorted keys, so key order does not change it), the mint date, the signing time, the mojulo version, and the
  creator's id and public key. The signature covers all of it.
- **Verifying** needs the file and its receipt: the `.proof.json` beside it, a receipt you pass in, or your own kept
  copy when this install signed it. Each check is reported on its own, so a failure says whether the bytes changed, a
  field was edited, or the creator id does not belong to the key. `yours` is true when this install's key signed it.

## What a receipt proves, and what it does not

- It proves that whoever holds the creator key signed these exact bytes.
- It does not prove when. `minted_at` and `signed_at` come from the signer's clock, which can be set to anything. To
  pin a date, take a trusted timestamp of the file or the receipt yourself, for example `ots stamp model.glb`
  (OpenTimestamps) or an RFC 3161 authority. mojulo makes no network calls for you.
- It does not prove that you made the asset first. Recipes are deterministic, so the same recipe gives the same bytes
  to anyone. A recipe close to a default can be minted by many people independently.
- It does not prove ownership. Whether AI-assisted output can be owned depends on the law where you are, and on how
  much of the work is yours. The maintainer's position is in [TERMS.md §6a](../TERMS.md).

Your strongest evidence is the recipe itself. Holding the recipe that regenerates an asset byte for byte is hard to
fake from the file alone. Keep your database (`$MOJULO_HOME`) with the key.

## Proving a creator id is yours

A creator id is the key's fingerprint, so proving it is yours means showing you hold the key. Sign a file the other
party chooses, such as a short note with today's date, and they verify it against your id. Anyone who copies
`creator.key` can do the same, so keep it private.
