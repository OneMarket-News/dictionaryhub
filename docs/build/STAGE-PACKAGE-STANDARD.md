# SourceRoot Codex Stage Package Standard

## Standard Identity

- Standard: SourceRoot Codex Stage Package Standard
- Version: v1
- Applies to: every SourceRoot Codex stage after and including Chunk 0

## Standard Package Layout

Every distributable stage uses this layout:

```text
<Stage-Name>\
  payload\
    <complete repository-relative files>
  docs\
    <stage documentation>
  manifest\
    stage-manifest.json
  INSTALL-<STAGE-NAME>.ps1
  VERIFY-<STAGE-NAME>.ps1
  README-FIRST.md
```

`payload` contains complete files rooted at their destination path in the repository. `docs` contains the package-facing stage record. `manifest/stage-manifest.json` describes the package. The root installer and verifier are complete runnable scripts, not snippets or links.

## Stage Manifest Schema

`stage-manifest.json` must be valid UTF-8 JSON with the following shape:

```json
{
  "schemaVersion": "1.0",
  "stageName": "SourceRoot-Example-Stage",
  "stageVersion": "v1",
  "createdDate": "YYYY-MM-DD",
  "targetRepository": "dictionaryhub",
  "requiredPreviousStage": "SourceRoot Previous Stage v1",
  "filesAdded": ["path/from/repository/root"],
  "filesReplaced": ["path/from/repository/root"],
  "filesIntentionallyUntouched": ["path or described protected area"],
  "migrations": [],
  "apisChanged": [],
  "frontendPagesChanged": [],
  "documentationChanged": ["docs/build/example.md"],
  "installerFilename": "INSTALL-SOURCEROOT-EXAMPLE-STAGE.ps1",
  "verifierFilename": "VERIFY-SOURCEROOT-EXAMPLE-STAGE.ps1",
  "rollbackInstructions": ["ordered rollback instruction"],
  "knownLimitations": ["honest limitation"],
  "explicitExclusions": ["out-of-scope capability"],
  "acceptanceChecks": [
    {
      "id": "static-example",
      "description": "Required files exist.",
      "required": true,
      "kind": "static"
    }
  ]
}
```

### Required Manifest Fields

The manifest must contain:

- Stage name.
- Stage version.
- Created date.
- Target repository.
- Required previous stage.
- Files added.
- Files replaced.
- Files intentionally untouched.
- Migrations.
- APIs changed.
- Frontend pages changed.
- Documentation changed.
- Installer filename.
- Verifier filename.
- Rollback instructions.
- Known limitations.
- Explicit exclusions.
- Acceptance checks.

Arrays must be present even when empty. An empty array means the stage intentionally made no change in that category. It must not mean “not investigated.”

Each acceptance check must identify whether it is static, backend, PostgreSQL, browser, or live API work. A package may add more structured fields without removing the required fields.

## Naming Conventions

### Stage Folders

Use a stable product-stage name with a version suffix:

```text
SourceRoot-<Stage-Description>-v1
```

Use Pascal-style words separated by hyphens. Avoid spaces.

### ZIP Files

The ZIP filename must exactly match the stage folder:

```text
SourceRoot-<Stage-Description>-v1.zip
```

The archive must contain one top-level stage folder and no unrelated files.

### Installers

Use:

```text
INSTALL-SOURCEROOT-<STAGE-DESCRIPTION>.ps1
```

The installer filename is uppercase for the verb and product identifier. The version belongs in the stage folder and manifest unless the approved stage name explicitly includes it.

### Verifiers

Use:

```text
VERIFY-SOURCEROOT-<STAGE-DESCRIPTION>.ps1
```

Baseline or customer-specific verifiers may use the corresponding stable product identifier, such as `VERIFY-DICTIONARYROOT-...`.

### Backups

Use a unique target-repository directory:

```text
backups\<normalized-stage-name>-YYYYMMDD-HHMMSS-fff\
```

The backup must preserve repository-relative paths. Include an installation record that distinguishes added and replaced files.

### Documentation

Permanent build documents belong under:

```text
docs\build\
```

Use uppercase filenames for permanent policies and lowercase hyphenated filenames for stage records.

### Manifests

The distributable manifest is always:

```text
manifest\stage-manifest.json
```

Repository baseline manifests use an explicit uppercase product-and-purpose name.

## Versioning

Use semantic stage versions:

```text
v1
v2
v3
```

Increase the version when the delivered contract or stage package is revised. Do not silently replace a previously accepted package with different contents under the same name.

## Payload Rules

- Include complete repository-relative files.
- Do not include secrets, local environment files, database dumps, dependency directories, Git metadata, or prior backups.
- Do not include a patch as a substitute for a complete file.
- Do not include future-phase placeholders.
- Keep the payload limited to the named stage.
- Record every payload path in either `filesAdded` or `filesReplaced`.

## Installer and Backup Rules

The installer must validate the package, resolve and confirm the repository, create the backup before replacement, copy complete files, and run the stage verifier. It must report additions, replacements, the backup path, and the verifier exit result. It must never remove unrelated files.

Rollback instructions must restore every replaced file from the timestamped backup and remove only the added files explicitly identified by the installation record.

## Verification Rules

The root verifier must be runnable independently of the installer. Package validation must confirm:

- Required layout and payload paths.
- Manifest validity and agreement with the payload.
- Script parseability.
- Required static checks.
- Nested regression checks.
- Honest reporting of unavailable backend, PostgreSQL, browser, or live API checks.

## Current-State Update Rule

Future stages must update:

```text
docs\build\CURRENT-SOURCEROOT-STATE.md
```

only after the stage is installed and verified. The updated current-state document must describe the installed repository, not a planned or packaged state.

## README-FIRST Requirements

`README-FIRST.md` must state:

1. The stage identity and prerequisite.
2. The target repository.
3. The exact installer command.
4. The exact verifier command.
5. What the installer backs up.
6. What checks are static.
7. What checks still require PostgreSQL, a backend, live API access, or a browser.
8. The rollback entry point.
