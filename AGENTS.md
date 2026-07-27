# DictionaryRoot Repository Instructions

## Repository purpose

This repository contains DictionaryRoot customer experiences built on the
SourceRoot provenance, evidence, identity, and knowledge infrastructure.
DictionaryRoot provides customer-facing exact-meaning, concept, Knowledge
Sphere, source, history, coverage, editorial, account, and governance
experiences. SourceRoot supplies the live API and governed records behind
those experiences.

## Source of truth

The checked-out repository is canonical. Work directly from its current
files and Git state.

Do not rebuild or restore work from old ZIP files, backups, archived stages,
generated packages, historical copies, completed-stage output, or another
repository snapshot. Those locations may be inspected only when a task
explicitly requires an exclusion, compatibility, installer, or replay check.
Never silently replace current files with older artifacts.

## Required reading and normal workflow

For repository changes:

1. Read this file.
2. Read `ROOT-MANIFEST.json`.
3. Read the active stage specification named by the manifest.
4. Inspect only files relevant to that stage.
5. Confirm and respect the active stage's `allowed_files`.
6. Preserve pre-existing changes recorded by the stage or observed in
   preflight.
7. Make the smallest complete change using shared implementations.
8. Run every verifier required by the active stage.
9. Run `VERIFY-ROOT-REPOSITORY.ps1`.
10. Report changed files, verification evidence, warnings, and unresolved
    manual checks.
11. Do not commit, push, create or switch branches, tag, merge, rebase, or
    open a pull request unless the user explicitly requests it.

When no active stage exists, create or select one before implementation.
If requirements conflict with protected behavior or allowed scope, stop and
report the conflict rather than weakening the contract.

## Protected functionality

Preserve at minimum:

- DictionaryRoot customer branding, logo, visual identity, and attribution
- shared responsive navigation, global search, context preservation, and
  account-aware behavior
- the live SourceRoot API layer and DictionaryRoot API client
- exact-meaning matching and meaning-ranking compatibility
- links among Concept, Source, History, Editorial, Coverage, and Knowledge
  Sphere experiences
- URL query state, browser history, deep links, and back/forward behavior
- loading, empty, retry, API-offline, and error states
- current script initialization order
- source identity, licensing, attribution, and provenance behavior
- on-demand Knowledge Sphere expansion, readable/map modes, and keyboard
  interaction
- unique HTML element IDs
- current responsive and accessibility behavior, including skip links,
  labels, live regions, focusable controls, and reduced-motion behavior
- current authentication and authorization boundaries
- existing installer prerequisite checks, backup behavior, hash validation,
  and rollback records
- existing verifier coverage, failure semantics, and exit codes
- the prohibition on static fallback product, concept, source, or graph data

`ROOT-PROTECTED-FUNCTIONALITY.md` is the human-readable protection contract.

## Change rules

- Preserve public interfaces and current repository-relative paths.
- Prefer a shared implementation over duplicated page-specific logic.
- Do not add hidden fallback knowledge data.
- Do not replace the live SourceRoot API integration with static files.
- Do not silently weaken or bypass verification.
- Do not perform unrelated formatting, renaming, or dependency sweeps.
- Do not make undocumented architecture changes.
- Do not claim a test, browser check, or live API check passed without
  evidence from the current work.
- Keep Windows PowerShell scripts compatible with Windows PowerShell 5.1
  unless a stage explicitly changes that support boundary.
- Keep secrets, tokens, credentials, API keys, database URLs, and
  confidential values out of generated context and documentation.
- Preserve user changes and report unexpected repository conditions.

## Excluded paths

Avoid recursive discovery or context export from:

- `.git/`
- `.root-context/`
- `backups/`
- `backend/node_modules/`
- `backend/dist/`
- `verification/responsive/`
- `SourceRoot-Codex-Stage-Contract-v1/`
- `SourceRoot-Registry-API-Contract-v1/`
- `backend/.env`
- `backend/.env.test`

The manifest is the machine-readable exclusion list. A task may inspect a
specific excluded artifact only when the user explicitly places it in scope;
never treat it as the current source of truth.
