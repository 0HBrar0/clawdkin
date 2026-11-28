# Measures what Clawdkin costs: CPU (main, GPU and page processes) and memory, per state.
# Runs a separate test copy with its own data folder, so a Clawdkin you already have running is untouched.
#   pwsh dev/bench.ps1                 (idle, working, waiting; 20 s each)
#   pwsh dev/bench.ps1 -Seconds 30 -States working
param([int]$Seconds = 20, [string[]]$States = @('idle', 'working', 'waiting'))
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$home_ = Join-Path ([IO.Path]::GetTempPath()) "clawdkin-bench-$PID"
$stateDir = Join-Path $home_ 'state'
New-Item -ItemType Directory -Force $stateDir | Out-Null
$env:CLAWDKIN_HOME = $home_
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
$app = Start-Process $electron -ArgumentList "`"$root`"" -PassThru -WindowStyle Hidden
$session = Join-Path $stateDir 'bench.json'
$cores = [Environment]::ProcessorCount

function Get-Tree {
  # every process of this copy: the main one plus children carrying its profile folder
  $all = Get-CimInstance Win32_Process -Filter "Name='electron.exe'"
  $all | Where-Object { $_.ProcessId -eq $app.Id -or $_.CommandLine -like "*$home_*" }
}
function Write-Session($state) {
  $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  if ($state -eq 'idle') { Remove-Item $session -ErrorAction SilentlyContinue; return }
  $s = @{ state = $state; detail = 'Edit'; project = 'bench'; ts = $now; turnStart = $now - 60000; edits = 2; task = 'benchmark'; target = 'bench.js'; failTs = 0; failKind = '' }
  [IO.File]::WriteAllText($session, ($s | ConvertTo-Json -Compress))
}

try {
  Start-Sleep 6 # start-up
  $rows = foreach ($st in $States) {
    Write-Session $st; Start-Sleep 4 # settle into the state
    $procs = Get-Tree
    $a = @{}; foreach ($p in $procs) { $a[$p.ProcessId] = (Get-Process -Id $p.ProcessId).TotalProcessorTime.TotalMilliseconds }
    $t0 = Get-Date
    for ($i = 0; $i -lt $Seconds; $i += 2) { Write-Session $st; Start-Sleep 2 } # keep the session fresh
    $el = ((Get-Date) - $t0).TotalMilliseconds
    $cpu = @{}; $mem = 0
    foreach ($p in $procs) {
      $g = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue; if (-not $g) { continue }
      $type = if ($p.CommandLine -match '--type=([\w-]+)') { $Matches[1] } else { 'main' }
      $cpu[$type] = $cpu[$type] + 100 * ($g.TotalProcessorTime.TotalMilliseconds - $a[$p.ProcessId]) / $el
      $mem += $g.PrivateMemorySize64
    }
    [pscustomobject]@{ State = $st; 'Main %' = [math]::Round($cpu['main'], 1); 'GPU %' = [math]::Round($cpu['gpu-process'], 1); 'Page %' = [math]::Round($cpu['renderer'], 1)
      'Total % of a core' = [math]::Round(($cpu.Values | Measure-Object -Sum).Sum, 1); 'Private MB' = [math]::Round($mem / 1MB) }
  }
  $rows | Format-Table -AutoSize | Out-String -Width 200
  "($cores logical cores; 100% = one core fully busy)"
} finally {
  Get-Tree | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep 1; Remove-Item -Recurse -Force $home_ -ErrorAction SilentlyContinue
}
