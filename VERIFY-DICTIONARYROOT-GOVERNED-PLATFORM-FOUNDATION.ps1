[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [switch]$SkipBrowser,
    [switch]$RequireBrowser,
    [switch]$RequireDependencies,
    [switch]$RequireDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Result {
    param([string]$Name, [bool]$Okay, [string]$Detail = "")
    if ($Okay) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    } else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }
    if ($Detail) { Write-Host "       $Detail" }
}

function Warning {
    param([string]$Name, [string]$Detail = "")
    $script:Warnings++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" }
}

function Invoke-NativeCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = ""
    )

    $PreviousErrorActionPreference = $ErrorActionPreference
    $PushedLocation = $false
    try {
        if ($WorkingDirectory) {
            Push-Location -LiteralPath $WorkingDirectory
            $PushedLocation = $true
        }

        # Windows PowerShell 5.1 promotes native stderr to NativeCommandError
        # when the verifier uses ErrorActionPreference=Stop. Capture stderr and
        # the process exit code without allowing a warning line to abort the run.
        $ErrorActionPreference = "Continue"
        $Output = @(& $FilePath @ArgumentList 2>&1)
        $ExitCode = $LASTEXITCODE
        return [pscustomobject]@{
            ExitCode = [int]$ExitCode
            Output = @($Output)
        }
    } catch {
        return [pscustomobject]@{
            ExitCode = 1
            Output = @($_.Exception.Message)
        }
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
        if ($PushedLocation) { Pop-Location }
    }
}

function Read-Text([string]$RelativePath) {
    return Get-Content -LiteralPath (Join-Path $script:Root $RelativePath) -Raw
}

function Contains-All {
    param([string]$RelativePath, [string[]]$Needles, [string]$Name)
    $Content = Read-Text $RelativePath
    $Missing = @($Needles | Where-Object { $Content.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0 })
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "" })
}

function In-Order {
    param([string]$RelativePath, [string[]]$Needles, [string]$Name)
    $Content = Read-Text $RelativePath
    $Last = -1
    $Missing = @()
    foreach ($Needle in $Needles) {
        $Found = $Content.IndexOf($Needle, [System.StringComparison]::Ordinal)
        if ($Found -lt 0) { $Missing += $Needle; continue }
        if ($Found -le $Last) { $Missing += "$Needle (out of order)"; continue }
        $Last = $Found
    }
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing/out of order: $($Missing -join ', ')" } else { "" })
}

if ($RequireBrowser -and $SkipBrowser) {
    Write-Host "-RequireBrowser and -SkipBrowser cannot be used together." -ForegroundColor Red
    exit 2
}
if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Governed Platform Foundation v1 verifier (hotfix 1.0.4)" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    ".gitignore",
    "index.html", "concept-v2.html", "graph-v2.html", "sources-v2.html", "coverage-v2.html", "editorial-v2.html", "history-v2.html",
    "account-v1.html", "workflow-v1.html", "admin-v1.html",
    "privacy.html", "terms.html", "acceptable-use.html", "corrections-policy.html",
    "assets\css\dictionaryroot-governance.css",
    "assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-auth.js", "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-account.js", "assets\js\dictionaryroot-workflow.js", "assets\js\dictionaryroot-admin.js",
    "backend\.env.example", "backend\config\staging.env.example", "backend\config\production.env.example",
    "backend\package.json", "backend\package-lock.json", "backend\Dockerfile", "docker-compose.local.yml",
    "backend\db\migrations\005_create_auth_identity_governance.sql",
    "backend\db\migrations\006_create_governed_editorial_workflow.sql",
    "backend\db\migrations\007_create_moderation_operations.sql",
    "backend\db\migrations\008_strengthen_session_identity.sql",
    "backend\src\lib\security.ts", "backend\src\lib\runtime-config.ts", "backend\src\middleware\auth.ts",
    "backend\src\routes\auth.ts", "backend\src\routes\account.ts", "backend\src\routes\workflow.ts", "backend\src\routes\admin.ts", "backend\src\routes\moderation.ts",
    "backend\src\services\auth-store.ts", "backend\src\services\auth-providers.ts", "backend\src\services\workflow-store.ts", "backend\src\services\admin-store.ts", "backend\src\services\audit-store.ts",
    "backend\test\governance-surface.test.ts", "backend\docs\openapi-governance.yaml",
    "VERIFY-DICTIONARYROOT-TYPESCRIPT-SYNTAX.mjs", "VERIFY-DICTIONARYROOT-GOVERNANCE-RESPONSIVE.mjs",
    "SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1", "START-DICTIONARYROOT-GOVERNED-PLATFORM.ps1",
    "BACKUP-DICTIONARYROOT-DATABASE.ps1", "RESTORE-DICTIONARYROOT-DATABASE.ps1",
    "docs\customers\dictionaryroot\governed-platform-foundation-v1.md",
    "docs\customers\dictionaryroot\authentication-provider-setup.md",
    "docs\customers\dictionaryroot\security-and-governance.md",
    "docs\customers\dictionaryroot\deployment-readiness.md",
    "docs\customers\dictionaryroot\pilot-readiness-checklist.md"
)
$MissingFiles = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required governed-platform files exist" ($MissingFiles.Count -eq 0) $(if ($MissingFiles.Count) { "Missing: $($MissingFiles -join ', ')" } else { "$($Required.Count) files found." })
if ($MissingFiles.Count) { exit 1 }

$Pages = @(
    @{ File = "index.html"; Script = "assets/js/dictionaryroot-home.js" },
    @{ File = "concept-v2.html"; Script = "assets/js/dictionaryroot-concept.js" },
    @{ File = "graph-v2.html"; Script = "assets/js/dictionaryroot-graph.js" },
    @{ File = "sources-v2.html"; Script = "assets/js/dictionaryroot-sources.js" },
    @{ File = "coverage-v2.html"; Script = "assets/js/dictionaryroot-coverage.js" },
    @{ File = "editorial-v2.html"; Script = "assets/js/dictionaryroot-editorial.js" },
    @{ File = "history-v2.html"; Script = "assets/js/dictionaryroot-history.js" },
    @{ File = "account-v1.html"; Script = "assets/js/dictionaryroot-account.js" },
    @{ File = "workflow-v1.html"; Script = "assets/js/dictionaryroot-workflow.js" },
    @{ File = "admin-v1.html"; Script = "assets/js/dictionaryroot-admin.js" }
)
foreach ($Page in $Pages) {
    Contains-All $Page.File @(
        "assets/css/dictionaryroot-brand.css",
        "assets/css/dictionaryroot-navigation.css",
        "assets/css/dictionaryroot-governance.css",
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-auth.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        $Page.Script
    ) "$($Page.File) keeps live product behavior and adds governed identity"
    In-Order $Page.File @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-auth.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        $Page.Script
    ) "$($Page.File) preserves shared initialization order"
    $Html = Read-Text $Page.File
    $IdMatches = [regex]::Matches($Html, '\bid\s*=\s*["'']([^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $DuplicateIds = @($IdMatches | ForEach-Object { $_.Groups[1].Value } | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    Result "$($Page.File) has unique element IDs" ($DuplicateIds.Count -eq 0) $(if ($DuplicateIds.Count) { "Duplicate IDs: $($DuplicateIds -join ', ')" } else { "" })
}

Contains-All "backend\db\migrations\005_create_auth_identity_governance.sql" @(
    "dr_users", "dr_auth_identities", "dr_auth_sessions", "identity_id UUID REFERENCES dr_auth_identities",
    "dr_organizations", "dr_organization_memberships", "dr_permissions", "dr_roles", "dr_role_assignments", "dr_invitations", "dr_audit_events",
    "revision.create", "revision.review", "revision.publish", "organization.manage", "moderation.manage", "system.admin"
) "Identity, organization, role, permission, invitation, and audit schema is present"

Contains-All "backend\db\migrations\006_create_governed_editorial_workflow.sql" @(
    "dr_change_proposals", "dr_proposal_evidence", "dr_proposal_comments", "dr_proposal_events", "dr_publications", "dr_published_overlays",
    "changes_requested", "superseded"
) "Governed proposal, evidence, review, publication, and overlay schema is present"

Contains-All "backend\db\migrations\007_create_moderation_operations.sql" @(
    "dr_moderation_reports", "dr_account_actions", "dr_record_locks"
) "Moderation, account action, and record lock schema is present"

Contains-All "backend\src\routes\auth.ts" @(
    "/email/start", "/email/verify", "/google/start", "/google/callback", "/apple/start", "/apple/callback",
    "requireCsrf", "prepareOauth", "POST_REQUIRED", "identity.linked", "session.created"
) "Google, Apple, email, development, linking, session, and CSRF auth routes are wired"

Contains-All "backend\src\services\auth-providers.ts" @(
    "code_challenge_method", "verifyProviderJwt", "GOOGLE_JWKS_URL", "APPLE_JWKS_URL", "createAppleClientSecret", "EMAIL_DELIVERY_MODE", "RESEND_API_KEY"
) "Provider adapters use PKCE, nonce/JWT validation, and configurable email delivery"

Contains-All "backend\src\services\auth-store.ts" @(
    "identity_id, token_hash", "s.identity_id AS active_identity_id", "BOOTSTRAP_ADMIN_EMAILS",
    "exportAccountData", "requestAccountDeletion", "completeAccountDeletion", "acceptInvitation"
) "Sessions preserve exact identity provenance and account lifecycle functions are present"

Contains-All "backend\src\middleware\auth.ts" @(
    "httpOnly", "SESSION_COOKIE_SECURE", "requireCsrf", "requirePermission", "hasSystemPermission", "hasOrganizationPermission", "authorizedOrganizationIds"
) "Session, CSRF, global permission, and organization-scope enforcement is present"

Contains-All "backend\src\routes\workflow.ts" @(
    "ORGANIZATION_PERMISSION_REQUIRED", "hasOrganizationPermission", "authorizedOrganizationIds", "revision.create", "revision.review", "revision.publish"
) "Workflow routes enforce organization-scoped permissions"

Contains-All "backend\src\services\workflow-store.ts" @(
    "ALLOW_SELF_APPROVAL", "SELF_APPROVAL_BLOCKED", "dr_record_locks", "TARGET_RECORD_LOCKED", "published_revision_id", "rolled_back_at"
) "Independent review, publication locks, durable revisions, and rollback are enforced"

Contains-All "backend\src\routes\import.ts" @(
    "IMPORT_SERVICE_TOKEN", "x-sourceroot-import-token", "ALLOW_UNAUTHENTICATED_IMPORT", "source.import", "requireCsrf"
) "SourceRoot imports require a service token or authenticated import permission"

Contains-All "backend\src\app.ts" @(
    "credentials: true", "x-content-type-options", "x-frame-options", "cache-control", "explicitStatus", "INTERNAL_SERVER_ERROR"
) "API security headers, credentialed CORS, no-store, and safe error handling are present"

Contains-All "assets\js\dictionaryroot-auth.js" @(
    'credentials: "include"', "X-CSRF-Token", "startProvider", "hasSystemPermission", "hasOrganizationPermission", "authorizedOrganizations"
) "Frontend auth client sends sessions and CSRF tokens and understands scoped permissions"

Contains-All "account-v1.html" @(
    "Continue with Google", "Continue with Apple", "Email me a sign-in link", "Linked sign-in methods", "Active browser sessions", "Download account export", "Delete account and revoke sessions"
) "Account experience covers providers, linked identities, sessions, export, and deletion"

Contains-All "workflow-v1.html" @(
    "Governed proposal queue", "Governance organization", "Base snapshot JSON", "Proposed overlay JSON", "Interpretation disclosure", "Decision and publication history"
) "Editorial workflow exposes scope, evidence, interpretation, decisions, and publication history"

Contains-All "admin-v1.html" @(
    "Users and roles", "Scoped membership", "Organization members and roles", "Open reports", "Active record locks", "Recent audit events"
) "Administration experience covers accounts, scoped organization roles, moderation, locks, and audit"

Contains-All "backend\src\routes\admin.ts" @(
    "/organizations/:organizationId/members", "assignOrganizationRole", "removeOrganizationRole", "ORGANIZATION_PERMISSION_REQUIRED"
) "Organization administrators can inspect members and manage organization-scoped roles"

Contains-All "backend\src\services\admin-store.ts" @(
    "listOrganizationMembers", "ROLE_SCOPE_MISMATCH", "MEMBERSHIP_NOT_ACTIVE", "LAST_ORGANIZATION_ADMIN"
) "Organization role storage validates scope, membership, and final-administrator safety"

Contains-All "backend\src\lib\runtime-config.ts" @(
    "readyForPublicTraffic", "frontend_https", "backend_https", "secure_cookie", "development_auth_disabled", "email_delivery", "cors_origin"
) "Deployment-readiness endpoint checks public safety requirements without exposing secrets"

$ProductionEnv = Read-Text "backend\config\production.env.example"
$ProductionSafe = $ProductionEnv.Contains("NODE_ENV=production") -and $ProductionEnv.Contains("SESSION_COOKIE_SECURE=true") -and $ProductionEnv.Contains("ALLOW_DEVELOPMENT_AUTH=false") -and $ProductionEnv.Contains("EXPOSE_DEVELOPMENT_AUTH_LINK=false") -and $ProductionEnv.Contains("ALLOW_SELF_APPROVAL=false")
Result "Production environment example uses safe authentication defaults" $ProductionSafe

$Package = Get-Content -LiteralPath (Join-Path $script:Root "backend\package.json") -Raw | ConvertFrom-Json
$LockPath = Join-Path $script:Root "backend\package-lock.json"
$NodeForLock = Get-Command node -ErrorAction SilentlyContinue
if ($NodeForLock) {
    # Windows PowerShell 5.1 can strip or reinterpret quotes when a multiline
    # JavaScript program is passed directly to node.exe with -e. Write the
    # probe to a temporary .cjs file so Node receives the script unchanged.
    $LockProbeScript = @'
const fs = require("fs");
const lockPath = process.argv[2];
if (!lockPath) {
  throw new Error("The package-lock path argument was not provided.");
}
const criticalEntries = [
  "node_modules/@types/body-parser",
  "node_modules/@types/http-errors",
  "node_modules/@types/qs",
  "node_modules/@types/range-parser",
  "node_modules/@types/send",
  "node_modules/pg-protocol"
];
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const rootPackage = lock.packages && lock.packages[""] ? lock.packages[""] : {};
const incomplete = criticalEntries.filter((key) => {
  const entry = lock.packages && lock.packages[key];
  return !entry || !entry.version || !entry.resolved || !entry.integrity;
});
process.stdout.write(JSON.stringify({
  version: lock.version || null,
  rootVersion: rootPackage.version || null,
  incomplete
}));
'@
    $LockProbeFile = Join-Path ([System.IO.Path]::GetTempPath()) ("dictionaryroot-lock-probe-{0}.cjs" -f [Guid]::NewGuid().ToString("N"))
    $LockProbeOutput = @()
    $LockProbeExitCode = 1
    $PreviousErrorActionPreference = $ErrorActionPreference
    try {
        $Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($LockProbeFile, $LockProbeScript, $Utf8WithoutBom)

        # Native stderr should be captured as verifier output rather than
        # terminating the whole verifier under $ErrorActionPreference = Stop.
        $ErrorActionPreference = "Continue"
        $LockProbeOutput = @(& $NodeForLock.Source $LockProbeFile $LockPath 2>&1)
        $LockProbeExitCode = $LASTEXITCODE
    } catch {
        $LockProbeOutput = @($_.Exception.Message)
        $LockProbeExitCode = 1
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
        Remove-Item -LiteralPath $LockProbeFile -Force -ErrorAction SilentlyContinue
    }

    if ($LockProbeExitCode -ne 0) {
        $LockProbeDetail = $LockProbeOutput -join [Environment]::NewLine
        Result "Backend package lock parses with Node.js" $false $LockProbeDetail
        Result "Backend package and lock versions agree" $false "The lock file could not be parsed."
        Result "Backend package lock contains complete dependency records" $false "The lock file could not be parsed."
    } else {
        try {
            $LockProbe = ($LockProbeOutput -join "") | ConvertFrom-Json
            Result "Backend package lock parses with Node.js" $true
            Result "Backend package and lock versions agree" ($Package.version -eq $LockProbe.version -and $Package.version -eq $LockProbe.rootVersion) "Version $($Package.version)"
            $IncompleteLockEntries = @($LockProbe.incomplete)
            Result "Backend package lock contains complete dependency records" ($IncompleteLockEntries.Count -eq 0) $(if ($IncompleteLockEntries.Count) { "Incomplete: $($IncompleteLockEntries -join ', ')" } else { "" })
        } catch {
            Result "Backend package lock parses with Node.js" $false "Node returned invalid verifier JSON: $($_.Exception.Message)"
            Result "Backend package and lock versions agree" $false "The lock probe result could not be interpreted."
            Result "Backend package lock contains complete dependency records" $false "The lock probe result could not be interpreted."
        }
    }
} else {
    Warning "Backend package-lock structural verification skipped" "Node.js was not found."
    Result "Backend package and lock versions agree" $false "Node.js is required to safely inspect npm lockfile v3 under Windows PowerShell 5.1."
    Result "Backend package lock contains complete dependency records" $false "Node.js is required to safely inspect npm lockfile v3 under Windows PowerShell 5.1."
}

$SecretFiles = Get-ChildItem -LiteralPath (Join-Path $script:Root "backend\src") -Recurse -File -Include *.ts,*.js,*.mjs
$SecretPatterns = @(
    'AIza[0-9A-Za-z_-]{25,}',
    're_[0-9A-Za-z]{20,}',
    '-----BEGIN (RSA |EC )?PRIVATE KEY-----',
    'GOOGLE_CLIENT_SECRET\s*=\s*["''][^"'']+["'']',
    'RESEND_API_KEY\s*=\s*["''][^"'']+["'']'
)
$SecretHits = @()
foreach ($File in $SecretFiles) {
    $Content = Get-Content -LiteralPath $File.FullName -Raw
    foreach ($Pattern in $SecretPatterns) {
        if ($Content -match $Pattern) { $SecretHits += "$($File.FullName):$Pattern" }
    }
}
Result "No provider private keys or obvious live credentials are committed in source" ($SecretHits.Count -eq 0) $(if ($SecretHits.Count) { $SecretHits -join "; " } else { "" })

$LegacyFiles = @("index.html", "concept-v2.html", "graph-v2.html", "sources-v2.html", "coverage-v2.html", "editorial-v2.html", "history-v2.html")
$LegacyMatches = @()
foreach ($Relative in $LegacyFiles) {
    $LegacyMatches += @(Select-String -LiteralPath (Join-Path $script:Root $Relative) -SimpleMatch -Pattern "data/nodes.json", "fallbackData", "fallbackNodes" -ErrorAction SilentlyContinue)
}
Result "Primary customer experiences retain live SourceRoot behavior without legacy fallback data" ($LegacyMatches.Count -eq 0) $(if ($LegacyMatches.Count) { ($LegacyMatches | ForEach-Object { "$($_.Path):$($_.LineNumber)" }) -join "; " } else { "" })

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    $JavaScriptFiles = @(
        "assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-auth.js", "assets\js\dictionaryroot-navigation.js",
        "assets\js\dictionaryroot-account.js", "assets\js\dictionaryroot-workflow.js", "assets\js\dictionaryroot-admin.js", "assets\js\dictionaryroot-editorial.js",
        "VERIFY-DICTIONARYROOT-TYPESCRIPT-SYNTAX.mjs", "VERIFY-DICTIONARYROOT-GOVERNANCE-RESPONSIVE.mjs", "VERIFY-DICTIONARYROOT-RESPONSIVE.mjs"
    )
    foreach ($File in $JavaScriptFiles) {
        $SyntaxCheck = Invoke-NativeCapture -FilePath $Node.Source -ArgumentList @("--check", (Join-Path $script:Root $File))
        $SyntaxDetail = @($SyntaxCheck.Output) -join " "
        Result "JavaScript syntax: $File" ($SyntaxCheck.ExitCode -eq 0) $(if ($SyntaxCheck.ExitCode -ne 0) { $SyntaxDetail } else { "" })
    }

    $NodeModules = Join-Path $script:Root "backend\node_modules"
    if (Test-Path -LiteralPath $NodeModules -PathType Container) {
        $Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($Npm) {
            $BackendDirectory = Join-Path $script:Root "backend"

            # With installed dependencies, the package's own compiler is the
            # authoritative syntax and semantic check. This also supports
            # compiler versions that do not expose the legacy JavaScript API.
            $Typecheck = Invoke-NativeCapture -FilePath $Npm.Source -ArgumentList @("run", "typecheck") -WorkingDirectory $BackendDirectory
            $TypecheckText = @($Typecheck.Output) -join [Environment]::NewLine
            Result "Backend semantic TypeScript typecheck" ($Typecheck.ExitCode -eq 0) $(if ($Typecheck.ExitCode -ne 0) { $TypecheckText } else { "" })

            $GovernanceTests = Invoke-NativeCapture -FilePath $Node.Source -ArgumentList @(
                "--import", "tsx", "--test", "test/governance-surface.test.ts"
            ) -WorkingDirectory $BackendDirectory
            $GovernanceTestText = @($GovernanceTests.Output) -join [Environment]::NewLine
            Result "Governance API surface tests" ($GovernanceTests.ExitCode -eq 0) $(if ($GovernanceTests.ExitCode -ne 0) { $GovernanceTestText } else { "" })
        } else {
            Warning "Dependency-backed verification skipped" "npm.cmd was not found."
            if ($RequireDependencies) { Result "Dependency-backed verification required" $false "npm.cmd was not found." }
        }
    } else {
        # Dependency-free fallback for source-only package inspection. It may
        # be unavailable for compiler distributions without a JavaScript API.
        $TypeScriptCheck = Invoke-NativeCapture -FilePath $Node.Source -ArgumentList @(
            (Join-Path $script:Root "VERIFY-DICTIONARYROOT-TYPESCRIPT-SYNTAX.mjs"),
            "--root",
            $script:Root
        )
        $TypeScriptText = @($TypeScriptCheck.Output) -join [Environment]::NewLine
        if ($TypeScriptText.Contains("TYPESCRIPT SKIP:")) {
            Warning "TypeScript parser unavailable" $TypeScriptText
        } else {
            Result "TypeScript source syntax" ($TypeScriptCheck.ExitCode -eq 0) $TypeScriptText
        }

        Warning "Dependency-backed verification skipped" "Run SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1 or npm.cmd ci in backend."
        if ($RequireDependencies) { Result "Dependency-backed verification required" $false "backend\node_modules was not found." }
    }

    if ($SkipBrowser) {
        Warning "Responsive browser verification skipped" "Rerun without -SkipBrowser to test ten customer pages at desktop, tablet, and mobile viewports."
    } else {
        $ResponsiveCheck = Invoke-NativeCapture -FilePath $Node.Source -ArgumentList @(
            (Join-Path $script:Root "VERIFY-DICTIONARYROOT-GOVERNANCE-RESPONSIVE.mjs"),
            "--root",
            $script:Root,
            "--no-screenshots"
        )
        $ResponsiveText = @($ResponsiveCheck.Output) -join [Environment]::NewLine
        $ResponsiveSkipped = $ResponsiveText.Contains("RESPONSIVE SKIP:")
        if ($ResponsiveSkipped -and $RequireBrowser) { Result "Responsive browser verification" $false $ResponsiveText }
        elseif ($ResponsiveSkipped) { Warning "Responsive browser verification unavailable" $ResponsiveText }
        else { Result "Responsive browser verification" ($ResponsiveCheck.ExitCode -eq 0) $ResponsiveText }
    }
} else {
    Warning "Node-based source verification skipped" "Node.js was not found."
    if ($RequireBrowser -or $RequireDependencies) { Result "Required Node verification" $false "Node.js was not found." }
}

try {
    $Health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 4
    $DatabaseConfigured = [bool]$Health.database.configured
    $DatabaseReachable = (-not $DatabaseConfigured) -or [bool]$Health.database.reachable
    Result "Running SourceRoot health endpoint responds" ($Health.service -eq "sourceroot-backend") "Status: $($Health.status); stage: $($Health.productStage)"
    if ($RequireDatabase) {
        Result "Persistent database is configured and reachable" ($DatabaseConfigured -and [bool]$Health.database.reachable) $(if (-not $DatabaseConfigured) { "DATABASE_URL is not configured." } elseif (-not $Health.database.reachable) { "Configured database is unreachable." } else { "" })
    } elseif (-not $DatabaseConfigured) {
        Warning "Database-backed authentication not active" "The public SourceRoot API can remain available, but accounts and workflow require DATABASE_URL and migrations."
    } elseif (-not $DatabaseReachable) {
        Warning "Configured database is unreachable" "Check PostgreSQL and DATABASE_URL before testing accounts."
    }
} catch {
    Warning "Live backend verification unavailable" "Start SourceRoot with npm.cmd start to verify health and database readiness."
    if ($RequireDatabase) { Result "Live database verification required" $false $_.Exception.Message }
}

Write-Host ""
Write-Host "Summary: $script:Passed passed, $script:Failed failed, $script:Warnings warning(s)." -ForegroundColor Cyan
if ($script:Failed -gt 0) { exit 1 }
exit 0
