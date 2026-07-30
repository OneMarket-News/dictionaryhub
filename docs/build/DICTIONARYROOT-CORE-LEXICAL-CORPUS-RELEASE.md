# SourceRoot DictionaryRoot Core Lexical Corpus v1 release

## Release identity

- Package: `SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1`
- Dataset: `dictionaryroot-core-lexical-corpus-v1`
- Version: `1.0.0`
- Recommended Git tag after human checkpointing:
  `sourceroot-dictionaryroot-core-lexical-corpus-v1`

No Git tag or Git mutation is part of this release run.

## Installation

From the authoritative external package directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\INSTALL-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1 `
  -RepositoryPath C:\Users\Josh\Documents\GitHub\dictionaryhub
```

The installer verifies every package hash, requires `sourceroot_test`,
requires migrations 013 and 014, rejects migration 015 assumptions, records a
pre-install database snapshot, performs replacement-safe import and duplicate
reimport, confirms fixture exclusion and empty legacy tables, runs the package
verifier, and writes its own installation record.

## Rights and redistribution

The package contains only accepted public-domain/open-license source wording.
It does not contain the bounded 28.9 MB Webster acquisition file, restricted
modern dictionary wording, credentials, environment files, caches,
`node_modules`, browser logs, Git metadata, or unrelated HistoryRoot data.
The source-rights ledger and prepared-source accounting preserve the required
attribution and reproduction trail.

