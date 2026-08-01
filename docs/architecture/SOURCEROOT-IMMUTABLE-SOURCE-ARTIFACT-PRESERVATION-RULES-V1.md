# SourceRoot Immutable Source Artifact Preservation Rules v1

## Purpose

SourceRoot stores some files as immutable copies of accepted upstream
artifacts. Git normally treats many XML, CSV, TXT, HTML, and Markdown files as
text, which permits checkout, add, or renormalization to convert line endings.
For an immutable source copy, even a semantically harmless CRLF/LF conversion
changes its byte length, SHA-256, and Git blob identity. The repository must
therefore opt only these copies out of Git text conversion.

The committed root `.gitattributes` protects exactly:

- `backend/data/**/raw/**`
- `backend/data/**/source-docs/**`

Both patterns use `-text`. This disables Git text normalization and text-based
line-ending conversion for matching paths. It also prevents a future
renormalization from treating those bytes as ordinary text. No clean filter is
declared, and the verifier proves that filtered and no-filter object hashes
agree for every currently protected file.

## Source artifacts and project files

Files below `raw` are accepted upstream data artifacts. Files below
`source-docs` are documentation pinned with those upstream sources. They are
evidence: spelling, whitespace, encoding, Unicode representation, and line
endings are part of the accepted bytes and must not be edited or formatted.

Normalized datasets are different. JSON datasets, manifests, application
TypeScript and JavaScript, SQL migrations, project-authored Markdown, HTML,
CSS, PowerShell, and other ordinary repository files are authored or generated
by this project. They remain normal text. The policy deliberately does not use
`* -text`, `* text=auto`, global EOL rules, language rules, filters, merge or
diff drivers, or any rule for normalized output.

## Chunk 13A release incident

The BibleRoot Chunk 13A release exposed that local Git configuration or
checkout-only `.git/info/attributes` can make source bytes appear stable on one
machine without making the policy portable. It also exposed the historical
Chunk 12 verifier's dependence on an earlier working-tree representation of
the Gutenberg artifact. The released maintenance baseline must not be repaired
silently: this checkpoint does not copy, rewrite, stage, or renormalize any
protected source. It freezes every protected path at its tagged HEAD blob,
filesystem byte length, and SHA-256 while adding the portable rule that was
missing.

`.git/info/attributes` belongs only to one checkout and is not committed.
Likewise, `core.autocrlf` and `core.eol` are local policy. Neither can prove
that another clone will preserve these paths. A root `.gitattributes` is
versioned with the data, applies in every checkout, and is verified in a
separate temporary repository with an empty `.git/info/attributes` under both
`core.autocrlf=true` and `core.autocrlf=false`.

## Adding a future immutable source copy

Place a verbatim accepted artifact only under a dataset's `raw` directory, or
place its verbatim pinned documentation under that dataset's `source-docs`
directory. Record the upstream immutable reference, byte length, and SHA-256
in project-authored metadata outside the protected copy. Before staging:

1. compute the filesystem byte length and SHA-256;
2. run `git hash-object --no-filters -- <path>`;
3. stage the exact path normally, never with `git add --renormalize`;
4. compare `git rev-parse :<path>` with the no-filter object hash;
5. confirm `git check-attr text -- <path>` reports `text: unset`.

Do not format, trim, re-encode, normalize Unicode, or clean upstream
whitespace. `git diff --check` may report trailing whitespace inherited from
an upstream artifact; that output identifies upstream bytes, not permission to
rewrite them. Run whitespace checks against project-authored changes or review
protected-path findings without changing the source copy.

If a future immutable family does not fit either protected path, add a separate
narrow rule and verifier change in its own approved stage. Do not broaden the
current patterns or classify generated/project-authored files as binary.
