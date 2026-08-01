# Acquisition notes

- Retrieval occurred once, explicitly, on 2026-08-01 from the exact CrossWire URLs in `source-metadata.json`.
- Raw archives and captured source pages are immutable `-text` artifacts. Normal preparation, import, tests, provisioning, API use, and verification make no network requests.
- CrossWire module pages and each archive's internal `.conf` file identify the title, module revision, provider source, and public-domain distribution declaration.
- Exact byte lengths, SHA-256 checksums, and no-filter Git blob identities are pinned in `source-metadata.json` and regenerated into `hashes.json`.
- Inclusion records source identity and rights metadata; it is not a quality, comprehensiveness, balance, representativeness, or theological-authority judgment.
