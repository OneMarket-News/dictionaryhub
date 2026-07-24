param(
    [ValidateRange(1, 25000)]
    [int]$Limit = 10000,

    [string]$ApiOrigin = "http://localhost:3000",

    [ValidateRange(1, 20)]
    [int]$Runs = 5,

    [ValidateRange(1, 100)]
    [int]$PageSize = 25,

    [string]$SearchQuery = "knowledge"
)

$ErrorActionPreference = "Stop"

$repo = $PSScriptRoot
$bundlePath = Join-Path $repo "data\dictionaryroot\dictionaryroot-oewn-2025-pilot-$Limit.json"
$apiOriginNormalized = $ApiOrigin.TrimEnd('/')
$apiBase = "$apiOriginNormalized/api/v1"

if (-not (Test-Path $bundlePath)) {
    throw "DictionaryRoot pilot bundle was not found at $bundlePath."
}

$bundleDocument = Get-Content -Path $bundlePath -Raw | ConvertFrom-Json
$bundleId = [string]$bundleDocument.bundleId

if ([string]::IsNullOrWhiteSpace($bundleId)) {
    throw "The DictionaryRoot pilot bundle does not contain a bundleId."
}

$encodedBundleId = [Uri]::EscapeDataString($bundleId)
$encodedSearchQuery = [Uri]::EscapeDataString($SearchQuery)

try {
    $health = Invoke-RestMethod -Uri "$apiOriginNormalized/health" -Method Get
}
catch {
    Write-Host "The SourceRoot backend is not reachable at $ApiOrigin."
    throw
}

$nodesProbe = Invoke-RestMethod -Uri "$apiBase/bundles/$encodedBundleId/nodes?page=1&limit=1" -Method Get

if ($nodesProbe.total -ne $Limit) {
    throw "Expected $Limit imported nodes, but SourceRoot currently reports $($nodesProbe.total). Import and verify this scale first."
}

$firstNodeCollection = if ($null -ne $nodesProbe.items) { $nodesProbe.items } else { $nodesProbe.nodes }
$firstNode = $firstNodeCollection | Select-Object -First 1
$firstNodeId = [string]$firstNode.nodeId

if ([string]::IsNullOrWhiteSpace($firstNodeId)) {
    throw "SourceRoot did not return a node ID for benchmark detail requests."
}

$encodedNodeId = [Uri]::EscapeDataString($firstNodeId)
$totalPages = [math]::Ceiling($Limit / $PageSize)
$middlePage = [math]::Max(1, [math]::Ceiling($totalPages / 2))
$lastPage = [math]::Max(1, $totalPages)

Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(120)
$client.DefaultRequestHeaders.Accept.ParseAdd("application/json")

function Invoke-HttpGet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    $response = $client.GetAsync($Url).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if (-not $response.IsSuccessStatusCode) {
        throw "GET $Url returned HTTP $([int]$response.StatusCode): $body"
    }

    return $body
}

function Get-Percentile {
    param(
        [Parameter(Mandatory = $true)]
        [double[]]$Values,

        [Parameter(Mandatory = $true)]
        [double]$Percentile
    )

    $sorted = @($Values | Sort-Object)
    $index = [math]::Ceiling($Percentile * $sorted.Count) - 1
    $index = [math]::Max(0, [math]::Min($index, $sorted.Count - 1))
    return [double]$sorted[$index]
}

function Measure-Endpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $url = "$apiBase$Path"

    # Warm the route, PostgreSQL connection, and query plan before timed runs.
    [void](Invoke-HttpGet -Url $url)

    $times = New-Object 'System.Collections.Generic.List[double]'
    $responseBytes = 0

    for ($run = 1; $run -le $Runs; $run++) {
        $timer = [System.Diagnostics.Stopwatch]::StartNew()
        $body = Invoke-HttpGet -Url $url
        $timer.Stop()

        $times.Add($timer.Elapsed.TotalMilliseconds)
        $responseBytes = [System.Text.Encoding]::UTF8.GetByteCount($body)
    }

    $values = [double[]]$times.ToArray()
    $average = ($values | Measure-Object -Average).Average
    $minimum = ($values | Measure-Object -Minimum).Minimum
    $maximum = ($values | Measure-Object -Maximum).Maximum

    return [PSCustomObject]@{
        Name = $Name
        Path = $Path
        Runs = $Runs
        AverageMs = [math]::Round($average, 1)
        MedianMs = [math]::Round((Get-Percentile -Values $values -Percentile 0.50), 1)
        P95Ms = [math]::Round((Get-Percentile -Values $values -Percentile 0.95), 1)
        MinMs = [math]::Round($minimum, 1)
        MaxMs = [math]::Round($maximum, 1)
        ResponseKb = [math]::Round($responseBytes / 1KB, 2)
    }
}

$endpoints = @(
    @{ Name = "Imported bundle metadata"; Path = "/import?page=1&limit=1&bundleId=$encodedBundleId" },
    @{ Name = "Nodes first page"; Path = "/bundles/$encodedBundleId/nodes?page=1&limit=$PageSize" },
    @{ Name = "Nodes middle page"; Path = "/bundles/$encodedBundleId/nodes?page=$middlePage&limit=$PageSize" },
    @{ Name = "Nodes last page"; Path = "/bundles/$encodedBundleId/nodes?page=$lastPage&limit=$PageSize" },
    @{ Name = "Assertions first page"; Path = "/bundles/$encodedBundleId/assertions?page=1&limit=$PageSize" },
    @{ Name = "Edges first page"; Path = "/bundles/$encodedBundleId/edges?page=1&limit=$PageSize" },
    @{ Name = "Sources first page"; Path = "/bundles/$encodedBundleId/sources?page=1&limit=$PageSize" },
    @{ Name = "Revisions first page"; Path = "/bundles/$encodedBundleId/revisions?page=1&limit=$PageSize" },
    @{ Name = "Search all records"; Path = "/search?q=$encodedSearchQuery&bundleId=$encodedBundleId&page=1&limit=$PageSize" },
    @{ Name = "Search nodes only"; Path = "/search?q=$encodedSearchQuery&type=node&bundleId=$encodedBundleId&page=1&limit=$PageSize" },
    @{ Name = "Node detail"; Path = "/nodes/$encodedNodeId" },
    @{ Name = "Node assertions"; Path = "/nodes/$encodedNodeId/assertions" },
    @{ Name = "Node edges"; Path = "/nodes/$encodedNodeId/edges" }
)

$results = New-Object 'System.Collections.Generic.List[object]'

try {
    Write-Host "SourceRoot DictionaryRoot benchmark"
    Write-Host "Backend: $($health.status)"
    Write-Host "Bundle ID: $bundleId"
    Write-Host "Imported nodes: $($nodesProbe.total)"
    Write-Host "Runs per endpoint: $Runs plus one warmup"
    Write-Host "Page size: $PageSize"
    Write-Host "Search query: $SearchQuery"
    Write-Host ""

    foreach ($endpoint in $endpoints) {
        Write-Host "Measuring $($endpoint.Name)..."
        $result = Measure-Endpoint -Name $endpoint.Name -Path $endpoint.Path
        $results.Add($result)
    }

    Write-Host ""
    $results |
        Select-Object Name, AverageMs, MedianMs, P95Ms, MinMs, MaxMs, ResponseKb |
        Format-Table -AutoSize

    $slowResults = @($results | Where-Object { $_.AverageMs -ge 1000 })

    Write-Host ""
    if ($slowResults.Count -eq 0) {
        Write-Host "No measured endpoint averaged 1,000 ms or more."
    }
    else {
        Write-Warning "$($slowResults.Count) measured endpoint(s) averaged 1,000 ms or more."
        $slowResults | Select-Object Name, AverageMs, P95Ms | Format-Table -AutoSize
    }

    $reportDirectory = Join-Path $env:LOCALAPPDATA "SourceRoot\benchmarks"
    New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $reportPath = Join-Path $reportDirectory "dictionaryroot-oewn-2025-$Limit-$timestamp.json"

    # Windows PowerShell 5.1 can throw "Argument types do not match" when a
    # generic List[object] is embedded directly in an ordered report object.
    # Copy each measurement into a normal PowerShell object array first.
    $reportResults = [object[]]@(
        foreach ($result in $results) {
            [PSCustomObject][ordered]@{
                name = [string]$result.Name
                path = [string]$result.Path
                runs = [int]$result.Runs
                averageMs = [double]$result.AverageMs
                medianMs = [double]$result.MedianMs
                p95Ms = [double]$result.P95Ms
                minMs = [double]$result.MinMs
                maxMs = [double]$result.MaxMs
                responseKb = [double]$result.ResponseKb
            }
        }
    )

    $report = [PSCustomObject][ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        apiOrigin = $apiOriginNormalized
        bundleId = $bundleId
        expectedNodes = $Limit
        importedNodes = [int]$nodesProbe.total
        runsPerEndpoint = $Runs
        pageSize = $PageSize
        searchQuery = $SearchQuery
        firstNodeId = $firstNodeId
        results = $reportResults
    }

    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8

    $csvPath = [System.IO.Path]::ChangeExtension($reportPath, ".csv")
    $reportResults | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

    Write-Host ""
    Write-Host "Benchmark reports saved locally:"
    Write-Host $reportPath
    Write-Host $csvPath
}
finally {
    $client.Dispose()
    $handler.Dispose()
}
