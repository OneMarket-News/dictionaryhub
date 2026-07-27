# DictionaryRoot Protected Functionality

This contract identifies behavior that future stages must preserve unless a
stage explicitly authorizes and verifies a change.

| Capability | Relevant files | Required behavior | Prohibited regression | Suggested verification |
|---|---|---|---|---|
| Home experience | `index.html`, `dictionaryroot-home.js`, home/live CSS | Live exact-meaning discovery, coverage summaries, and experience links | Static result data, broken search, or misleading live counts | Home verifier plus browser/API smoke |
| Knowledge Sphere | `graph-v2.html`, `dictionaryroot-graph.js`, sphere/map CSS | Live center concept, bounded expansion, readable/map modes, relationship details | Static graph data, lost controls, hidden exact senses, or unusable keyboard interaction | Knowledge Sphere verifiers plus browser/API smoke |
| Concept Experience | `concept-v2.html`, `dictionaryroot-concept.js` | Search, exact-sense choice, definitions, relations, sources, and provenance | Collapsed senses, ranking drift, missing source links, or fallback records | Concept verifier plus browser/API smoke |
| Source Experience | `sources-v2.html`, `dictionaryroot-sources.js` | Live source list, filters, detail, attribution, linked assertions and concepts | Fabricated sources, lost attribution, incorrect pagination, or broken retry | Source verifier plus browser/API smoke |
| Shared navigation | `dictionaryroot-navigation.js`, navigation CSS | Responsive navigation, global search, current-page state, preserved context, account chip | Duplicate per-page nav, lost query state, overlap, or inaccessible mobile menu | Navigation verifiers and viewport checks |
| Customer branding | brand config, customer config, SVG, brand JS/CSS | DictionaryRoot name, mark, identity, SourceRoot relationship, and OEWN attribution | Rebranding, missing logo, inaccurate attribution, or SourceRoot identity leakage | Static markers and browser check |
| Live SourceRoot API client | `sourceroot-api.js`, `dictionaryroot-api.js`, customer config | Live request flow, normalized failures, configured API base, request cancellation | Static knowledge fallback, swallowed errors, or incompatible public methods | Node syntax, existing API verifier, live API check |
| Source attribution | concept/source scripts and page footers | Source identity, publisher, license, URLs, and support paths remain visible | Unattributed definitions or misleading license/public-domain claims | Source/Concept verifiers and record inspection |
| Exact-meaning compatibility | `dictionaryroot-api.js` and search callers | All exact senses remain distinguishable and preferred over related results | Selecting one sense as the word or dropping valid exact senses | Meaning-ranking and coverage verifiers |
| Meaning-ranking compatibility | `dictionaryroot-api.js`, home/nav/concept/graph scripts | Shared deterministic rank helpers drive ordering consistently | Page-specific divergent ranking or unstable ordering | API meaning-ranking verifier |
| URL state | navigation and canonical page scripts | Query, node, source, filters, view, and back/forward state round-trip | Broken deep links, stale state, or context loss between pages | Static markers plus browser history test |
| Loading state | canonical HTML and page scripts | Honest busy/loading content while live requests are pending | Blank UI or false successful content | Browser test with throttled requests |
| Empty state | canonical page scripts | Explicit no-match/no-record state without fabricated data | Empty container or sample records presented as live | Browser/API no-result test |
| API-offline state | API layer and canonical page scripts | Clear unavailable/retry messaging; user data remains unchanged | False PASS/live indicator, crash, or hidden fallback | Browser test with backend stopped |
| Cross-page links | navigation, concept, graph, source scripts | Concept, Sources, History, Editorial, Coverage, and Sphere retain relevant context | Dead links or incorrect meaning/source association | Link inspection and browser navigation |
| Responsive behavior | shared and page CSS | Existing desktop, tablet, and mobile usability | Navigation overlap, clipped content, or unusable controls | Responsive verifiers and viewport browser checks |
| Accessibility behavior | canonical HTML, brand/navigation/page JS | Unique labels, skip link, landmarks, live regions, keyboard controls, reduced motion | Duplicate IDs, inaccessible controls, focus loss, or status not announced | Root verifier plus keyboard/browser audit |
| Unique HTML IDs | canonical HTML | Every static `id` is unique per document | Duplicate IDs that break lookup or labels | Root repository verifier |
| JavaScript initialization order | canonical HTML | SourceRoot API -> DictionaryRoot API -> auth -> brand -> navigation -> page script | Page code running before required globals | Root repository verifier |
| Authentication boundary | `dictionaryroot-auth.js`, navigation, governed pages | Current session and capability checks remain authoritative | Silent privilege escalation or client-only authorization claims | Identity/governance verifiers |
| Installer backup behavior | root `INSTALL-*.ps1` | Prerequisites, safe destinations, backups, hashes, records, and rollback guidance | Overwrite without backup, unsafe path, or unverified bytes | Installer-specific verifier in safe test scope |
| PowerShell verifier behavior | root `VERIFY-*.ps1`, `tools/VERIFY-ROOT-REPOSITORY.ps1` | Deterministic levels, honest warnings, failure counts, and nonzero exits | Silent weakening, false PASS, recursion, or swallowed child exit | Positive and intentional negative tests |
| No static fallback knowledge | canonical HTML/JS and API layer | Product, concept, source, and graph records come from the live API | `data/nodes.json`, `fallbackSourceData`, `staticSourceRecords`, or equivalents in runtime | Root forbidden-pattern scan and code review |

Static checks are necessary but do not prove visual layout, browser history,
network integration, authentication, accessibility, or live data behavior.
