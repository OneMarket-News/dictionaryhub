# Active Stage

> **THIS FILE IS NOT AUTHORITY.**
>
> It is a repository file, which means the stage it describes may edit it. It
> records execution context so a human can find it; nothing in the governed
> development system reads it to decide anything.
>
> Authority lives outside the candidate, in the ACL-protected control store at
> `C:\ProgramData\SourceRoot\GDS\<repository-id>\`, signed by the Product
> Authority. The trust core is given the values below through parameters or
> environment variables set **outside** the repository, and it verifies the
> signed bytes it finds against them. If this file were edited to name a
> different issuance, the core would still verify whatever was actually
> requested — and a request naming an object that does not match is refused.

## Stage

| Field | Value |
|---|---|
| Stage name | SourceRoot GDS Authority / Lifecycle / Descendant Hardening |
| Stage slug | `SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING-V1` |
| Risk tier | 3 |
| Lifecycle state at issuance | `DEFINED` |
| Baseline commit | `3febc64dcf956edb14aa84917557128e39927ac5` |

## Current signed authorization

| Field | Value |
|---|---|
| `authorizationId` | `a8f6cf37-225b-42f6-a4ea-a333935825d4` |
| SHA-256 of signed bytes | `14890DDA6BFA967E825ED5B9BDDB58C9724CBEDE8853C0869660F8D5B55FD595` |
| Allowed paths | 38 |
| Protected paths | 18 |
| Signer principal | `joshua-product-authority` |
| Key fingerprint | `SHA256:MHHB00WXsjj5eovi+1DRYg6NiknT4ZiLXjKaCT1b+Oo` |
| Signature namespace | `sourceroot-gds-v1` |
| File | `SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING-V1.a8f6cf37-225b-42f6-a4ea-a333935825d4.authorization.json` |

### Superseded issuance

| Field | Value |
|---|---|
| `authorizationId` | `b7a1c3e2-5d94-4f8a-9c16-3e0a72d5f481` |
| SHA-256 | `D09C272F2163E0A13FFC7B072B1C2BA5C870A2587D8835060F6D9C0D7A4763BC` |
| Allowed paths | 21 |
| File | `SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING-V1.authorization.json` (historical unversioned name) |

This issuance remains **valid historical evidence** and still verifies. It is
**not current**: execution context selects `a8f6cf37…`, and the loader can never
answer a request for one issuance with another. Retiring the unversioned
filename is future governance cleanup, ruled out of scope for this stage.

## Execution context

Set outside the repository:

```bash
export SRGDS_STAGE=SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING-V1
```

```bash
export SRGDS_AUTHORIZATION_ID=a8f6cf37-225b-42f6-a4ea-a333935825d4
```

```bash
export SRGDS_AUTHORIZATION_DIGEST=14890DDA6BFA967E825ED5B9BDDB58C9724CBEDE8853C0869660F8D5B55FD595
```

```bash
export SRGDS_SIGNER_FINGERPRINT=SHA256:MHHB00WXsjj5eovi+1DRYg6NiknT4ZiLXjKaCT1b+Oo
```

```bash
export SRGDS_SIGNER_PRINCIPAL=joshua-product-authority
```

## Operating the stage

Install and prove the trust core:

```bash
pwsh ./INSTALL-SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING.ps1 -Action all
```

Read the signed authority and the current candidate:

```bash
pwsh ./tools/INVOKE-ROOT-GOVERNANCE.ps1 -Action status
```

Prove the refusals are real:

```bash
pwsh ./tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1
```

## Standing constraints

- No path outside the signed 38 may be modified.
- No `go.sum`; it is not an authorized path.
- The trust-core binary is never committed.
- No commit, tag, push, primary integration, 15A release, or 15B.
