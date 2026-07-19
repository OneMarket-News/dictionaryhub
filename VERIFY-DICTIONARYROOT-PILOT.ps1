param(
    [ValidateRange(1, 25000)]
    [int]$Limit = 500,

    [string]$ApiOrigin = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

$bundleId = "dictionaryroot-oewn-2025-pilot-$Limit"
$encodedBundleId = [Uri]::EscapeDataString($bundleId)
$apiBase = "$($ApiOrigin.TrimEnd('/'))/api/v1"

Write-Host "Verifying $bundleId"
Write-Host ""

$bundle = Invoke-RestMethod -Uri "$apiBase/import/$encodedBundleId" -Method Get
$nodes = Invoke-RestMethod -Uri "$apiBase/bundles/$encodedBundleId/nodes?page=1&limit=1" -Method Get
$assertions = Invoke-RestMethod -Uri "$apiBase/bundles/$encodedBundleId/assertions?page=1&limit=1" -Method Get
$edges = Invoke-RestMethod -Uri "$apiBase/bundles/$encodedBundleId/edges?page=1&limit=1" -Method Get
$sources = Invoke-RestMethod -Uri "$apiBase/bundles/$encodedBundleId/sources?page=1&limit=1" -Method Get
$revisions = Invoke-RestMethod -Uri "$apiBase/bundles/$encodedBundleId/revisions?page=1&limit=1" -Method Get
$search = Invoke-RestMethod -Uri "$apiBase/search?q=knowledge&bundleId=$encodedBundleId&page=1&limit=5" -Method Get

Write-Host "Bundle retrieved: $($bundle.bundleId)"
Write-Host "Nodes: $($nodes.total)"
Write-Host "Assertions: $($assertions.total)"
Write-Host "Edges: $($edges.total)"
Write-Host "Sources: $($sources.total)"
Write-Host "Revisions: $($revisions.total)"
Write-Host "Search results for 'knowledge': $($search.total)"
Write-Host ""

if ($nodes.total -ne $Limit) {
    throw "Expected $Limit nodes but the API returned $($nodes.total)."
}

if ($assertions.total -lt $Limit) {
    throw "Expected at least $Limit assertions but the API returned $($assertions.total)."
}

if ($sources.total -lt 1) {
    throw "Expected at least one source record."
}

if ($revisions.total -lt 1) {
    throw "Expected at least one revision record."
}

Write-Host "DictionaryRoot pilot verification passed."
Write-Host ""
Write-Host "Browser pages to inspect:"
Write-Host "sourceroot-import-bundle-registry.html"
Write-Host "sourceroot-inspector.html"
Write-Host "sourceroot-assertion-registry.html"
Write-Host "sourceroot-edge-registry.html"
Write-Host "sourceroot-source-registry.html"
