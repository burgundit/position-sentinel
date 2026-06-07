$ErrorActionPreference = "Stop"

$files = @(
  "server.py",
  "backend\server.py",
  "backend\symbols.py"
)

$pythonCandidates = @()
$venvPython = ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
  $pythonCandidates += $venvPython
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
  $pythonCandidates += $pythonCommand.Source
}

$pythonPath = $null
foreach ($candidate in ($pythonCandidates | Select-Object -Unique)) {
  try {
    & $candidate --version | Out-Null
    $pythonPath = $candidate
    break
  } catch {
    continue
  }
}

if (-not $pythonPath) {
  throw "Python was not found or could not be executed."
}

& $pythonPath tools\check_python.py @files
