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
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("status", "authority", "candidate", "paths", "lifecycle", "release-gate")]
    [string]$Action,

    [Parameter()][string]$RepositoryRoot,
    [Parameter()][string]$StageSlug = $env:SRGDS_STAGE,
    [Parameter()][string]$AuthorizationId = $env:SRGDS_AUTHORIZATION_ID,
    [Parameter()][string]$AuthorizationDigest = $env:SRGDS_AUTHORIZATION_DIGEST,
    [Parameter()][string]$SignerFingerprint = $env:SRGDS_SIGNER_FINGERPRINT,
    [Parameter()][string]$SignerPrincipal = $env:SRGDS_SIGNER_PRINCIPAL,

    [Parameter()][string[]]$Path,
    [Parameter()][string]$OutFile,
    [Parameter()][string]$From,
    [Parameter()][string]$To,
    [Parameter()][string]$AuditDigest,
    [Parameter()][string]$ReleaseDigest,
    [Parameter()][string]$AuditorPrincipal,
    [Parameter()][string]$AuditorFingerprint,
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

$Context = @{}
if ($Action -ne "lifecycle") {
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
        if (-not $Auth.Valid) { exit 3 }

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
