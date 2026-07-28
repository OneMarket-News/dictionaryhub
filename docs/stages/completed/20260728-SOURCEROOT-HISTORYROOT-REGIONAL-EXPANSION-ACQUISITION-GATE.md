# SourceRoot Chunk 9 â€” HistoryRoot Regional Expansion Acquisition Gate

## Stage boundary

- Slug: `SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE`
- Status: active
- Starting commit: `fefbe6fdded9c53fe27996cbaeb7980bca248f4c`
- Branch: `release/historyroot-alpha-integration-v1`
- Remote: `origin/release/historyroot-alpha-integration-v1` at the starting commit
- Starting tag: `sourceroot-historyroot-corpus-expansion-quality-v1`
- Work type: feasibility analysis and source-acquisition planning only
- Preflight changed files: none
- Preflight staged files: none

The allowed-file list is recorded in `ROOT-MANIFEST.json`. No historical
objects, corpus bundle, import, database mutation, API change, frontend
change, importer change, migration, package, or Git-history operation is
permitted by this stage.

## Starting gates

- Chunk 8 external ZIP: verified at SHA-256
  `B159BAD009FF65C500BE6B57889619E576A1C2729E4469C101E494A4D318784F`
- Repository package folder and ZIP: absent
- Test database boundary: `sourceroot_test`
- Migration boundary: numeric migrations `001` through `012` present;
  migration `013` absent
- Accepted HistoryRoot dataset: `1.2.0`
- Starting root verifier: 51 passes, 0 warnings, 0 failures

## Work record

### Recommended scope

- Title: Wampanoag Homelands and Intercommunity Networks, 1614â€“1676
- Geography: Cape Cod and Noepe through Manomet and Nemasket to Pokanoket,
  Mount Hope, Pocasset, and Sakonnet; the immediate Narragansett Bay conflict
  edge is included only for direct relationships
- Core dates: 1614â€“1676
- Context rule: earlier archaeology and later aftermath/continuity remain
  explicitly attributed context, not core event claims

### Source decisions

Accepted candidate IDs:

- `hr9-src-aquinnah-history`
- `hr9-src-aquinnah-thpo`
- `hr9-src-beranek-great-island`
- `hr9-src-brooks-beloved-kin`
- `hr9-src-chappaquiddick-history`
- `hr9-src-delucia-memory-lands`
- `hr9-src-easton-relation`
- `hr9-src-herring-pond-timeline`
- `hr9-src-hubbard-map`
- `hr9-src-hubbard-narrative`
- `hr9-src-mashpee-archives`
- `hr9-src-mashpee-timeline`
- `hr9-src-mather-brief-history`
- `hr9-src-mhc-cape-islands`
- `hr9-src-mittark-petition`
- `hr9-src-nara-yale-indian-papers`
- `hr9-src-nps-carns`
- `hr9-src-silverman-faith-boundaries`
- `hr9-src-thomas-creating-new-england`
- `hr9-src-watson-ams-dates`

Rejected candidate IDs and decisions:

- `hr9-reject-cipolla-authenticity`: regional methodology only; it does not
  independently support a selected record or claim
- `hr9-reject-loc-church-1860`: duplicate edition of an already represented
  Church reporting lineage; edition cross-check only
- `hr9-reject-nps-wellfleet-tavern`: principal 1690â€“1740 occupation is
  outside the bounded period and closes no core gap

The deterministic registry contains every candidate's complete metadata,
category flags, rights/access decision, locator strategy, proposed role,
coverage, limitations, candidate subjects, status, and rejection reason.

### Source and rights counts

- Accepted: 20
- Rejected: 3
- Indigenous-led or Indigenous-institution: 8
- Primary or archival: 7
- Museum, library, government, or university: 14
- Archaeological or peer-reviewed scholarly: 12
- Rights: 19 `metadata_and_link_only`; 1 `public_domain`
- Every accepted source begins with `metadata_only` content use
- Every accepted source has a bounded locator strategy

Locator-strategy counts:

- call number and IIIF canvas: 1
- chapter and page: 3
- chapter DOI and page: 1
- DOI and page: 1
- DOI, page, and section: 1
- DOI, page, and table: 1
- edition page: 1
- edition page and note: 1
- edition page and text mode: 1
- heading and dated entry: 3
- portal document ID and image: 1
- report page and section: 1
- repository accession and item: 1
- section and report reference: 1
- section heading: 2

### Projected corpus feasibility

- Records: 54
- Claims: 28
- Sources: 20
- Reporting accounts: 14
- Date expressions: 32
- Relationships: 48
- Structured locators: 28
- Field-provenance records: 32
- Evidence links with explicit roles: 18
- Qualifying or conflicting-account structures: 8
- Contextual families: claim attributions, interpretations, perspectives,
  perspective links, causal links, and cultural memories all covered
- Projected orphan reduction: 8 records and 1 account

### Findings and limitations

- Blockers: 0
- Review findings: 6
  - keep the Narragansett conflict edge bounded
  - obtain tribal archive access and item identifiers
  - separate work, edition, transcription, and digital-surrogate identity
  - prohibit archaeological identity inference
  - mark post-1676 content as context
  - control source concentration and edition-lineage duplication
- Observations: 4
  - Indigenous representation exceeds the minimum without creating a
    universal Indigenous voice
  - conflicting primary perspectives are preserved
  - accepted sources have rights and locator plans
  - all six contextual families are feasible without creating objects here
- Unresolved questions: 3 identity, 3 geographic, and 3 chronology questions
- Known retained limits: the orphan Mourt's Relation account and
  transatlantic orphan places are outside the selected scope
- Source-concentration plan: no source may report more than 4 of the 28
  projected claims without an exception and an independent lineage

### Determinism

- `candidate-sources.json`: 47,565 bytes; SHA-256
  `7651FB9363AEF1A0431DA76347F881F0B5EC0E5CC8A99F45B2376BCAAC755947`
- `feasibility-report.json`: 10,452 bytes; SHA-256
  `9143C907A27E299B69391937CCEACC17AFD751EE01AA3B9F65CA98E800659D2B`
- Two independent clean-directory generations: equal lengths, equal hashes,
  and byte-for-byte equal
- Committed artifacts versus independent regeneration: byte-for-byte equal
- Runtime timestamps and machine paths: absent

### Verification

- TypeScript typecheck: PASS
- Focused acquisition-gate suite: 40/40
- Bounded final verifier: 28 passes, 0 warnings, 0 failures
- Root repository verifier: 51 passes, 0 warnings, 0 failures
- `git diff --check`: exit 0 with zero check output
- Git index: empty
- Changed-file scope: 10 allowed files; 0 unauthorized

Corrected validation attempts retained for transparency:

- The first focused run's setup hook used a Windows absolute path where Node
  required a `file://` ESM preload URL; it reported 0 passes and 40 hook
  failures. The path was corrected without changing artifact bytes.
- The next focused run passed 39/40; its scope check used `git diff` and
  therefore omitted untracked allowed files. It was corrected to use
  porcelain status, and the final run passed 40/40.
- Early bounded-verifier runs exposed a Windows PowerShell 5.1 non-ASCII
  parser issue, scalar `Compare-Object` handling, an overly narrow safe
  database-name regex, and an inappropriate line-ending override. Each
  verifier-only issue was corrected; the final result is 28/0/0.
- The first root-verifier run passed 50 checks and failed only because the new
  verifier had not yet been declared in `known_verifiers`. The declaration
  was added; the final result is 51/0/0.

### Final recommendation and mutation boundary

**GO** for a later, separately staged source acquisition and corpus-build
phase. This gate created no historical object and no corpus bundle. It ran no
database import and changed no database data. It changed no frontend, API,
importer, source-preparation implementation, or migration. It created no
package and performed no Git staging, commit, tag, push, pull, checkout,
reset, merge, rebase, branch change, or history mutation.

## Completion record

- Completion date: 2026-07-28T14:20:46.3102477-05:00
- Verification skipped: False

### Verifier results

- VERIFY-SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `backend/data/historyroot-regional-expansion-acquisition-v1/candidate-sources.json`
- `backend/data/historyroot-regional-expansion-acquisition-v1/feasibility-report.json`
- `backend/src/historyroot/regional-expansion-acquisition.ts`
- `backend/src/scripts/generate-historyroot-regional-expansion-acquisition.ts`
- `backend/test/historyroot-regional-expansion-acquisition.test.ts`
- `docs/build/HISTORYROOT-REGIONAL-EXPANSION-SCOPE.md`
- `docs/build/HISTORYROOT-REGIONAL-SOURCE-ACQUISITION-PLAN.md`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 9 regional-expansion acquisition gate completed with a GO recommendation, 20 accepted and 3 rejected candidate sources, deterministic planning artifacts, focused tests 40/40, final verifier 28/0/0, root verifier 51/0/0, and no corpus, database, frontend, API, importer, migration, package, or Git-history operation.
