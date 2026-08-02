# Chunk 14B browser evidence

Date: 2026-08-01 America/Chicago (browser/API timestamps crossed 2026-08-02 UTC)
Frontend: `http://127.0.0.1:5500`
API: `http://127.0.0.1:3000`
Data: local development PostgreSQL, readiness contract 1.4.0, no static fallback

## Live example

- Assertion ID: `cr-assertion-3496d05e1eb202344d35d57e9a176962`
- Subject: `historyroot-plymouth-event-peace-agreement`
- Predicate/family/native type: `causes_or_contributes_to` / `causation` / `cause`
- Object: `historyroot-plymouth-event-tisquantum-mediation`
- Causal role/review/certainty: `condition` / `unreviewed` / `moderate`
- Uncertainty: `Mediation also preceded and shaped the agreement.`
- Source record: `historyroot-plymouth-causal-agreement-cooperation`
- Identity SHA-256: `3496D05E1EB202344D35D57E9A176962FB03CACB25B800E22E6CDC17D0F9CE28`
- Content SHA-256: `8892C93DFAA837D0AB75EC1F111077917756ED4CC2BCA4191E032AAD877B1E86`
- Evidence ID 1: `cr-relationship-evidence-668576f83c05cdf71ff63f81396e05d2`
- Evidence ID 2: `cr-relationship-evidence-d6ea156345114e6b10695aa43d38b44b`
- Source IDs: `historyroot-plymouth-source-bradford-eada`, `historyroot-plymouth-source-nmai-timeline`
- Claim/publication/artifact/source-evidence IDs: not asserted by this released relationship record; the UI displayed `Not asserted` rather than inventing values.
- Exact excerpt: `The diplomatic agreement created a framework within which mediators and exchanges operated.`
- UTF-16 range: `0-91`
- Source record SHA-256: `4998F0671B98CE2E5801D861289EF27FC5E4BFA260680AEAA0D523C52B4D859C`
- Source field SHA-256: `4FD426383B826CC88DDE45F20CFFF533E7B01F6C073FDE46446E6D258C57F1C3`
- Evidence SHA-256 values: `159F8747E90F9C344BF97DBF5FF7DD9DD84BB5C9BD3B1DE64E5A79952472017E`, `D55FFDBDAACD9E3AB72E371599DC5C8B3FFEEA815B45C0C436F9462E7CAC3E23`
- Cited URLs: `https://eada.lib.umd.edu/text-entries/of-plymouth-plantation/`, `https://americanindian.si.edu/nk360/thanksgiving/timeline.html`

## Acceptance evidence

The initial live page displayed 143 assertions and loaded 100 bounded page items. Its first source-backed non-causal `settled_at` relationship exposed two evidence controls and all assertion/provenance fields; the automated DOM contract separately proves that every collapsed evidence panel renders its exact excerpt, offsets, IDs, citations, source URL, dataset version, and hashes. Applying `relationshipFamily=causation&causal=true` returned exactly 22 cards and 22 causal-boundary notices. Expanding the first causal evidence displayed the exact excerpt, IDs, `explanation` field, `utf16_offsets`, range `0-91`, sources, citations, URLs, hashes, and explicit missing-ID states. All production records are qualified by uncertainty; the corpus contains zero disputed records, so no disputed example was manufactured.

Deep-link URL `http://127.0.0.1:5500/cross-root-relationships.html?assertionId=cr-assertion-3496d05e1eb202344d35d57e9a176962` rendered exactly one assertion. Browser Back returned to the 22-card causal filter and Forward restored the one-card detail. HistoryRoot URL `http://127.0.0.1:5500/history-record-v1.html?id=historyroot-plymouth-event-peace-agreement` exposed exactly one `Inspect source-backed relationships` entry point; following it opened the resource-filter URL and returned exactly four qualifying assertions. The entry point is API-gated and the implementation omits it when the bounded query returns zero.

Live HTTP integration exercised registered filters, a zero-item unprovisioned/no-fallback state, invalid family and boolean filters (400), invalid resource (404), and invalid assertion (404); the frontend contract maps no-match, invalid, and unavailable responses to separate visible states. With the API process genuinely stopped, the browser remained in loading until the shared 12-second timeout and then displayed `SourceRoot relationship API unavailable`, `No fallback record was shown`, and exactly one Retry control. After restarting the same API and selecting Retry, the page recovered to four cards and `Evidence ready`.

At 1280x720 the evidence grid remained readable with long identifiers wrapping. At 390x844 the subject/predicate/object stack was readable, the viewport was exactly 390 pixels wide, and `scrollWidth > clientWidth` was false. Native form controls, semantic details/summary, skip navigation, live status, and a focusable resource input were present; focus styling is covered by the frontend contract and no focus trap was observed. Both shared account and Root-switcher controls rendered.

Console inspection returned zero errors and zero unexpected warnings both before and after recovery. The page showed live API records only. Visible text states that exact lexical overlap is discovery evidence only; the deterministic builder does not read Chunk 14A link/evidence files. The planning-only BibleRoot brief added no BibleRoot runtime/interface/branding asset and caused no page change.

## Screenshots

- Desktop evidence, 1280x720: `verification/cross-root-relationships-desktop.png`; 74,290 bytes; SHA-256 `F56307D2E4A35BF5A6D39F31FFBF97101BE1B0948F3D66B392BABF888737C7FF`.
- Mobile evidence, 390x844: `verification/cross-root-relationships-mobile.png`; 41,719 bytes; SHA-256 `FF706D3B541F1F3F0032B609D1C6C7BEF06A4B84F85D87FE91A3243503EB1297`.

Both screenshots are ignored verification artifacts inside the governed allowed-file boundary. The temporary API and `127.0.0.1:5500` static-server processes were stopped; the pre-existing `0.0.0.0:5500` server was preserved.
