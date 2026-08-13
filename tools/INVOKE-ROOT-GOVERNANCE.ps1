<#
.SYNOPSIS
SourceRoot GDS v1.1 governance entry point.

.DESCRIPTION
One command surface over the trust core for the operations a governed stage
performs: read the signed authority, derive the candidate, check paths, check a
lifecycle transition, and ask whether a candidate may be released.

This script DECIDES NOTHING. Every answer below comes from srgds-core, which
this script invokes and whose verdict it reports. It contains no canonical
serialization, no path grammar, no digesting, and no signature handling.

EXECUTION CONTEXT IS NOT READ FROM THE REPOSITORY

Which authorization is current is stated by the operator, either as parameters
or through environment variables set outside the repository:

    SRGDS_STAGE                  stage slug
    SRGDS_AUTHORIZATION_ID       exact authorizationId
    SRGDS_AUTHORIZATION_DIGEST   exact SHA-256 of the signed bytes
    SRGDS_SIGNER_FINGERPRINT     expected Product Authority key
    SRGDS_SIGNER_PRINCIPAL       allowed_signers principal

docs/stages/active/CURRENT-STAGE.md records the same values for humans, but it
is a repository file: the stage it describes may edit it. It is a convenience
pointer and NEVER a source of authority. Nothing here reads it.

.EXAMPLE
  ./tools/INVOKE-ROOT-GOVERNANCE.ps1 -Action status
  ./tools/INVOKE-ROOT-GOVERNANCE.ps1 -Action candidate -OutFile candidate.json
  ./tools/INVOKE-ROOT-GOVERNANCE.ps1 -Action paths -Path tools/x.ps1
  ./tools/INVOKE-ROOT-GOVERNANCE.ps1 -Action lifecycle -From AUDIT_PASSED -To RELEASED

.EXAMPLE
  ./tools/INVOKE-ROOT-GOVERNANCE.ps1 -Action release-state
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("status", "authority", "candidate", "paths", "lifecycle", "release-gate", "release-state")]
    [string]$Action,

    [Parameter()][string]$RepositoryRoot,
    [Parameter()][string]$StageSlug = $env:SRGDS_STAGE,
    [Parameter()][string]$AuthorizationId = $env:SRGDS_AUTHORIZATION_ID,
    [Parameter()][string]$AuthorizationDigest = $env:SRGDS_AUTHORIZATION_DIGEST,
    [Parameter()][string]$SignerFingerprint = $env:SRGDS_SIGNER_FINGERPRINT,
    [Parameter()][string]$SignerPrincipal = $env:SRGDS_SIGNER_PRINCIPAL,

    # The RELEASED predecessor. Kept separate from current authority on purpose:
    # they describe different commits, and every time the two were conflated the
    # result was a released fact behaving like a live permission.
    [Parameter()][string]$ReleasedStageSlug = $env:SRGDS_RELEASED_STAGE,
    [Parameter()][string]$ReleasedAuthorizationId = $env:SRGDS_RELEASED_AUTHORIZATION_ID,
    [Parameter()][string]$ReleasedAuthorizationDigest = $env:SRGDS_RELEASED_AUTHORIZATION_DIGEST,

    [Parameter()][string[]]$Path,
    [Parameter()][string]$OutFile,
    [Parameter()][string]$From,
    [Parameter()][string]$To,
    [Parameter()][string]$AuditDigest = $env:SRGDS_AUDIT_DIGEST,
    [Parameter()][string]$ReleaseDigest = $env:SRGDS_RELEASE_DIGEST,
    [Parameter()][string]$AuditorPrincipal = $env:SRGDS_AUDITOR_PRINCIPAL,
    [Parameter()][string]$AuditorFingerprint = $env:SRGDS_AUDITOR_FINGERPRINT,
    [Parameter()][string]$CommitBindingDigest = $env:SRGDS_COMMIT_BINDING_DIGEST,
    [Parameter()][string]$ControlStoreRoot,
    [Parameter()][string]$CorePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}
Import-Module (Join-Path $PSScriptRoot "SourceRoot.Governance.psm1") -Force

function Write-Section([string]$Title) {
    Write-Output ""
    Write-Output "=== $Title ==="
}

function Assert-Context {
    $Missing = @()
    foreach ($Pair in @(
        @{ Name = "StageSlug"; Value = $StageSlug; Env = "SRGDS_STAGE" },
        @{ Name = "AuthorizationId"; Value = $AuthorizationId; Env = "SRGDS_AUTHORIZATION_ID" },
        @{ Name = "AuthorizationDigest"; Value = $AuthorizationDigest; Env = "SRGDS_AUTHORIZATION_DIGEST" },
        @{ Name = "SignerFingerprint"; Value = $SignerFingerprint; Env = "SRGDS_SIGNER_FINGERPRINT" },
        @{ Name = "SignerPrincipal"; Value = $SignerPrincipal; Env = "SRGDS_SIGNER_PRINCIPAL" }
    )) {
        if ([string]::IsNullOrWhiteSpace($Pair.Value)) { $Missing += "-$($Pair.Name) (or $($Pair.Env))" }
    }
    if ($Missing.Count -gt 0) {
        throw "Execution context is incomplete. Supply: $($Missing -join ', '). " +
              "These are never defaulted: a defaulted trust decision is a decision nobody made."
    }
}

$ReleaseContext = @{
    RepositoryRoot              = $RepositoryRoot
    StageSlug                   = $ReleasedStageSlug
    ExpectedAuthorizationId     = $ReleasedAuthorizationId
    ExpectedAuthorizationDigest = $ReleasedAuthorizationDigest
    ExpectedSignerFingerprint   = $SignerFingerprint
    SignerPrincipal             = $SignerPrincipal
    AuditDigest                 = $AuditDigest
    ReleaseDigest               = $ReleaseDigest
    AuditorPrincipal            = $AuditorPrincipal
    AuditorFingerprint          = $AuditorFingerprint
    CommitBindingDigest         = $CommitBindingDigest
}
if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $ReleaseContext.ControlStoreRoot = $ControlStoreRoot }
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $ReleaseContext.CorePath = $CorePath }
$ReleaseContextComplete = (@(@(
    $ReleasedStageSlug, $ReleasedAuthorizationId, $ReleasedAuthorizationDigest,
    $SignerFingerprint, $SignerPrincipal, $AuditDigest, $ReleaseDigest,
    $AuditorPrincipal, $AuditorFingerprint, $CommitBindingDigest
) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

$Context = @{}
# release-state reads the RELEASED predecessor and nothing else, so demanding
# current-authority context for it would be asking for values it never uses.
if ($Action -ne "lifecycle" -and $Action -ne "release-state") {
    Assert-Context
    $Context = @{
        RepositoryRoot              = $RepositoryRoot
        StageSlug                   = $StageSlug
        ExpectedAuthorizationId     = $AuthorizationId
        ExpectedAuthorizationDigest = $AuthorizationDigest
        ExpectedSignerFingerprint   = $SignerFingerprint
        SignerPrincipal             = $SignerPrincipal
    }
    if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Context.ControlStoreRoot = $ControlStoreRoot }
    if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $Context.CorePath = $CorePath }
}

switch ($Action) {

    "status" {
        Write-Section "TRUST CORE"
        Write-Output "  path    : $(Get-SrgdsCorePath -Path $CorePath)"
        Write-Output "  version : $(Get-SrgdsCoreVersion -CorePath $CorePath)"

        Write-Section "SIGNED AUTHORITY"
        $Auth = Get-GdsStageAuthorization @Context
        Write-Output "  valid            : $($Auth.Valid)"
        Write-Output "  reason           : $($Auth.Reason)"
        Write-Output "  authorizationId  : $($Auth.AuthorizationId)"
        Write-Output "  selection        : $($Auth.Selection)"
        Write-Output "  digest           : $($Auth.Digest)"
        Write-Output "  baseline         : $($Auth.BaselineCommit)"
        Write-Output "  risk tier        : $($Auth.RiskTier)"
        Write-Output "  lifecycle        : $($Auth.LifecycleState)"
        Write-Output "  allowed paths    : $(@($Auth.AllowedPaths).Count)"
        Write-Output "  protected paths  : $(@($Auth.ProtectedPaths).Count)"

        # An invalid current authority is not automatically a problem. After a
        # release commit it is the CORRECT answer, and the repository's real
        # state is terminal rather than ungoverned. Reporting failure here made
        # a completed release look like a broken one.
        if (-not $Auth.Valid) {
            if (-not $ReleaseContextComplete) {
                Write-Output ""
                Write-Output "  No released-stage context was supplied, so terminal release state"
                Write-Output "  could not be checked. This is unknown, not governed."
                exit 3
            }
            Write-Section "TERMINAL RELEASE STATE"
            $Release = Test-GdsReleaseState @ReleaseContext
            Write-Output "  released         : $($Release.Released)"
            Write-Output "  reason           : $($Release.Reason)"
            Write-Output "  commit           : $($Release.Commit)"
            Write-Output "  parent           : $($Release.Parent)"
            Write-Output "  tree             : $($Release.Tree)"
            Write-Output "  candidate digest : $($Release.CandidateDigest)"
            Write-Output "  candidate tree   : $($Release.CandidateTree)"
            Write-Output "  entries          : $($Release.EntryCount)"
            Write-Output "  audit verdict    : $($Release.AuditVerdict) by $($Release.AuditorIdentity)"
            Write-Output "  bound commit     : $($Release.BoundReleaseCommit)"
            Write-Output "  authority at HEAD: $($Release.CurrentAuthorityAtHead)"
            Write-Output ""
            Write-Output "  Terminal state is a historical fact. It authorizes no mutation, and"
            Write-Output "  the authorization that produced it stays consumed."
            exit $(if ($Release.Released) { 0 } else { 3 })
        }

        Write-Section "CANDIDATE"
        $Manifest = Get-GdsCandidateManifest @Context
        Write-Output "  authorized       : $($Manifest.Authorized)"
        Write-Output "  reason           : $($Manifest.Reason)"
        Write-Output "  candidate digest : $($Manifest.CandidateDigest)"
        Write-Output "  baseline tree    : $($Manifest.BaselineTree)"
        Write-Output "  candidate tree   : $($Manifest.CandidateTree)"
        Write-Output "  entries          : $($Manifest.EntryCount)"
        if (@($Manifest.UnauthorizedPaths).Count -gt 0) {
            Write-Output "  UNAUTHORIZED:"
            $Manifest.UnauthorizedPaths | ForEach-Object { Write-Output "    $_" }
        }
        if (-not $Manifest.Authorized) { exit 3 }
        exit 0
    }

    "release-state" {
        if (-not $ReleaseContextComplete) {
            throw "Released-stage context is incomplete. Supply -ReleasedStageSlug, " +
                  "-ReleasedAuthorizationId, -ReleasedAuthorizationDigest, -AuditDigest, " +
                  "-ReleaseDigest, -AuditorPrincipal, -AuditorFingerprint, -CommitBindingDigest (or the matching " +
                  "SRGDS_* variables). None of them is defaulted: a defaulted trust decision " +
                  "is a decision nobody made."
        }
        $Release = Test-GdsReleaseState @ReleaseContext
        Write-Output "released         : $($Release.Released)"
        Write-Output "reason           : $($Release.Reason)"
        Write-Output "commit           : $($Release.Commit)"
        Write-Output "parent           : $($Release.Parent)"
        Write-Output "tree             : $($Release.Tree)"
        Write-Output "candidate digest : $($Release.CandidateDigest)"
        Write-Output "candidate tree   : $($Release.CandidateTree)"
        Write-Output "entries          : $($Release.EntryCount)"
        Write-Output "audit verdict    : $($Release.AuditVerdict)"
        Write-Output "auditor          : $($Release.AuditorIdentity)"
        # Reported separately and never compared. The released binary is what
        # produced the audited verdict; the running binary is whatever is asking
        # now. Requiring them to match would make released history unreadable by
        # every later build, which is how the granting chain was first misused
        # for a reading question.
        Write-Output "released binary  : $($Release.ReleasedBinarySha256)"
        Write-Output "running binary   : $($Release.RunningBinarySha256)"
        Write-Output "commit binding   : $($Release.ReleaseCommitBindingDigest)"
        Write-Output "bound commit     : $($Release.BoundReleaseCommit)"
        Write-Output "authority at HEAD: $($Release.CurrentAuthorityAtHead)"
        exit $(if ($Release.Released) { 0 } else { 3 })
    }

    "authority" {
        $Auth = Get-GdsStageAuthorization @Context
        Write-Output "valid  : $($Auth.Valid)"
        Write-Output "reason : $($Auth.Reason)"
        if ($Auth.Valid) {
            Write-Output "allowed paths:"
            $Auth.AllowedPaths | ForEach-Object { Write-Output "  $_" }
            Write-Output "protected paths:"
            $Auth.ProtectedPaths | ForEach-Object { Write-Output "  $_" }
        }
        exit $(if ($Auth.Valid) { 0 } else { 3 })
    }

    "candidate" {
        if (-not [string]::IsNullOrWhiteSpace($OutFile)) { $Context.OutFile = $OutFile }
        $Manifest = Get-GdsCandidateManifest @Context
        Write-Output "authorized       : $($Manifest.Authorized)"
        Write-Output "reason           : $($Manifest.Reason)"
        Write-Output "candidate digest : $($Manifest.CandidateDigest)"
        Write-Output "entries          : $($Manifest.EntryCount)"
        if ($null -ne $Manifest.Manifest -and $Manifest.EntryCount -gt 0) {
            $Manifest.Manifest.entries | ForEach-Object {
                Write-Output ("  {0,-6} {1,-8} {2}" -f $_.change, $_.mode, $_.path)
            }
        }
        if (@($Manifest.UnauthorizedPaths).Count -gt 0) {
            Write-Output "UNAUTHORIZED:"
            $Manifest.UnauthorizedPaths | ForEach-Object { Write-Output "  $_" }
        }
        if (-not [string]::IsNullOrWhiteSpace($OutFile)) { Write-Output "manifest written: $OutFile" }
        exit $(if ($Manifest.Authorized) { 0 } else { 3 })
    }

    "paths" {
        if ($null -eq $Path -or @($Path).Count -eq 0) { throw "-Path is required at least once." }
        $Result = Test-GdsPathAuthorized @Context -Path $Path
        Write-Output "authorized : $($Result.Authorized)"
        Write-Output "reason     : $($Result.Reason)"
        $Result.Paths | ForEach-Object { Write-Output ("  {0,-5}  {1}" -f $_.authorized, $_.path) }
        exit $(if ($Result.Authorized) { 0 } else { 3 })
    }

    "lifecycle" {
        if ([string]::IsNullOrWhiteSpace($From) -or [string]::IsNullOrWhiteSpace($To)) {
            throw "-From and -To are required."
        }
        $Result = Test-GdsLifecycleTransition -From $From -To $To -CorePath $CorePath
        Write-Output "allowed : $($Result.Allowed)"
        Write-Output "reason  : $($Result.Reason)"
        exit $(if ($Result.Allowed) { 0 } else { 3 })
    }

    "release-gate" {
        foreach ($Pair in @(
            @{ Name = "-AuditDigest"; Value = $AuditDigest },
            @{ Name = "-ReleaseDigest"; Value = $ReleaseDigest },
            @{ Name = "-AuditorPrincipal"; Value = $AuditorPrincipal },
            @{ Name = "-AuditorFingerprint"; Value = $AuditorFingerprint }
        )) {
            if ([string]::IsNullOrWhiteSpace($Pair.Value)) { throw "$($Pair.Name) is required for release-gate." }
        }
        $Arguments = @(
            "release-gate",
            "-repo", $RepositoryRoot,
            "-stage", $StageSlug,
            "-authorization-id", $AuthorizationId,
            "-expected-digest", $AuthorizationDigest,
            "-signer-fingerprint", $SignerFingerprint,
            "-signer-principal", $SignerPrincipal,
            "-audit-digest", $AuditDigest,
            "-release-digest", $ReleaseDigest,
            "-auditor-principal", $AuditorPrincipal,
            "-auditor-fingerprint", $AuditorFingerprint
        )
        if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Arguments += @("-control-store", $ControlStoreRoot) }
        $Result = Invoke-SrgdsCore -Arguments $Arguments -CorePath $CorePath
        Write-Output "release permitted : $($Result.Accepted)"
        Write-Output "reason            : $($Result.Reason)"
        foreach ($Field in @("candidateDigest", "auditBindingDigest", "auditVerdict", "auditorIdentity", "releaseAuthorizationDigest")) {
            if ($Result.Payload.PSObject.Properties.Name -contains $Field) {
                Write-Output ("  {0,-26}: {1}" -f $Field, $Result.Payload.$Field)
            }
        }
        Write-Output ""
        Write-Output "A green gate is EVIDENCE, not approval. It reports that a Product Authority"
        Write-Output "signature exists over this exact candidate and this exact PASS audit. The"
        Write-Output "decision to release remains a human one."
        exit $(if ($Result.Accepted) { 0 } else { 3 })
    }
}
