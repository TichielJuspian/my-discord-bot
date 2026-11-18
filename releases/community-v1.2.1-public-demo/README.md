# Community public utilities 1.2.1

This is a deliberately restricted public utility subset, not a runnable community bot and not a full source backup. It can run entirely offline with Node 24 and no third-party dependencies. Run node --test test.cjs.

Included: PNG chunk-order and CRC integrity checking, and a bounded in-memory asynchronous Buffer cache with request deduplication. Cache bounds apply only to retained values, not total process memory, unresolved requests, or caller allocations. Prefer Buffer/string values; other object values are not meaningfully byte-accounted.

PNG checking is structural, not full image decoding: CRC-correct invalid compressed image data may pass. Never treat it as an untrusted-image security boundary.

Excluded: all account and member identifiers; database connections and records; credentials and environment files; attendance, moderation, profile, points, wallet, user-code and persistence handlers; service configuration; runtime state; deployment scripts; repository history; and image/font assets whose redistribution rights were not verified. No personal-data examples or live-service integrations are included.

The version labels this public subset only. It does not change or attest to an operational deployment version. No new license grant or third-party artwork license is asserted by this package.

## Offline anonymous shop demo
Run node demo.cjs for two synthetic six-color pages and cache reuse statistics. The demo models Previous, Next and Close controls without accounts, balances, purchases or persistence. A retired Back action does nothing. Generated PNGs contain only original geometric colors, with no bundled artwork or fonts. The demo has no Discord connection or browser server and does not write image files. Image Buffers are available to a caller through the exported functions. This is a new portable demonstration, not the production shop handler or a replacement for it.
