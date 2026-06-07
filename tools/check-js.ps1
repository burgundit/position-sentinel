$ErrorActionPreference = "Stop"

$nodeCandidates = @()
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodeCandidates += $nodeCommand.Source
}

$codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (Test-Path $codexNode) {
  $nodeCandidates += $codexNode
}

$nodePath = $null
foreach ($candidate in ($nodeCandidates | Select-Object -Unique)) {
  try {
    & $candidate --version | Out-Null
    $nodePath = $candidate
    break
  } catch {
    continue
  }
}

if (-not $nodePath) {
  throw "Node.js was not found or could not be executed."
}

Get-ChildItem app -Recurse -Include *.js | ForEach-Object {
  & $nodePath --check $_.FullName
}
