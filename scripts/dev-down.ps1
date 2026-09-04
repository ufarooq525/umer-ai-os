<#
.SYNOPSIS
  Stops the local dev stack started by scripts\dev-up.ps1 (NATS, control-api,
  agent-worker, web) by finding whatever is listening on each known port and
  stopping it. Safe to run even if some/all services aren't running.
#>

$ports = @(
  @{ Name = 'web dashboard'; Port = 3001 },
  @{ Name = 'agent-worker health'; Port = 8080 },
  @{ Name = 'control-api'; Port = 4000 },
  @{ Name = 'NATS'; Port = 4222 },
  @{ Name = 'NATS monitoring'; Port = 8222 }
)

foreach ($item in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $item.Port -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) {
    Write-Host ("    --  {0,-20} :{1} not running" -f $item.Name, $item.Port) -ForegroundColor DarkGray
    continue
  }
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
  Write-Host ("    OK  {0,-20} :{1} stopped" -f $item.Name, $item.Port) -ForegroundColor Green
}

Write-Host ""
Write-Host "Stack stopped. Bring it back with: scripts\dev-up.ps1" -ForegroundColor DarkGray
