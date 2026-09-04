<#
.SYNOPSIS
  Brings up the real local dev stack for Umer AI OS: NATS (Message Fabric),
  control-api, agent-worker, and the web dashboard - all as durable
  background processes that keep running after this script exits.

.DESCRIPTION
  No Docker required (falls back to a standalone nats-server.exe, downloaded
  once to %USERPROFILE%\.umer-ai-os-tools\nats - never committed to the repo).
  If you later get Docker Desktop running, see the "Switching to Docker"
  note at the bottom of this file.

  Idempotent: safe to re-run. Skips anything already listening on its port.

.PARAMETER Status
  Only print current status of each service, do not start anything.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
  powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -Status
#>
param(
  [switch]$Status
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ToolsDir = Join-Path $env:USERPROFILE '.umer-ai-os-tools'
$NatsDir = Join-Path $ToolsDir 'nats'
$NatsExe = Join-Path $NatsDir 'nats-server.exe'
$LogDir = Join-Path $ToolsDir 'logs'
$NatsVersion = '2.10.22'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-PortOpen {
  param([int]$Port)
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$conn
}

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "    OK  $Message" -ForegroundColor Green
}

function Write-Skip {
  param([string]$Message)
  Write-Host "    --  $Message (already running)" -ForegroundColor DarkYellow
}

if ($Status) {
  Write-Host "Umer AI OS - dev stack status" -ForegroundColor White
  $rows = @(
    @{ Name = 'NATS (Message Fabric)'; Port = 4222 },
    @{ Name = 'control-api';           Port = 4000 },
    @{ Name = 'agent-worker (health)'; Port = 8080 },
    @{ Name = 'web dashboard';         Port = 3001 }
  )
  foreach ($row in $rows) {
    $up = Test-PortOpen -Port $row.Port
    $mark = if ($up) { 'UP  ' } else { 'DOWN' }
    $color = if ($up) { 'Green' } else { 'Red' }
    Write-Host ("  [{0}] {1,-24} :{2}" -f $mark, $row.Name, $row.Port) -ForegroundColor $color
  }
  exit 0
}

# --- 1. NATS (Message Fabric) -------------------------------------------
Write-Step 'NATS (Message Fabric)'
if (Test-PortOpen -Port 4222) {
  Write-Skip 'nats://localhost:4222'
} else {
  if (-not (Test-Path $NatsExe)) {
    Write-Host "    downloading nats-server v$NatsVersion (one-time, ~6MB)..." -ForegroundColor DarkGray
    New-Item -ItemType Directory -Force -Path $NatsDir | Out-Null
    $zipPath = Join-Path $NatsDir 'nats-server.zip'
    $url = "https://github.com/nats-io/nats-server/releases/download/v$NatsVersion/nats-server-v$NatsVersion-windows-amd64.zip"
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $NatsDir -Force
    Remove-Item $zipPath
    $extracted = Join-Path $NatsDir "nats-server-v$NatsVersion-windows-amd64\nats-server.exe"
    Move-Item -Path $extracted -Destination $NatsExe -Force
    Remove-Item -Recurse -Force (Join-Path $NatsDir "nats-server-v$NatsVersion-windows-amd64")
  }
  $natsLog = Join-Path $LogDir 'nats-server.log'
  $natsErrLog = Join-Path $LogDir 'nats-server.err.log'
  Start-Process -FilePath $NatsExe -ArgumentList '-js', '-m', '8222' `
    -RedirectStandardOutput $natsLog -RedirectStandardError $natsErrLog -WindowStyle Hidden
  Start-Sleep -Seconds 2
  if (Test-PortOpen -Port 4222) { Write-Ok "started - log: $natsLog" }
  else { Write-Host "    FAILED to start - check $natsLog" -ForegroundColor Red }
}

# --- 2. control-api --------------------------------------------------------
Write-Step 'control-api'
if (Test-PortOpen -Port 4000) {
  Write-Skip 'http://127.0.0.1:4000'
} else {
  $capiLog = Join-Path $LogDir 'control-api.log'
  $capiErrLog = Join-Path $LogDir 'control-api.err.log'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'pnpm --filter @umer/app-control-api run dev' `
    -WorkingDirectory $RepoRoot -RedirectStandardOutput $capiLog -RedirectStandardError $capiErrLog -WindowStyle Hidden
  Start-Sleep -Seconds 6
  if (Test-PortOpen -Port 4000) { Write-Ok "started - log: $capiLog" }
  else { Write-Host "    still starting - check $capiLog in a few seconds" -ForegroundColor Yellow }
}

# --- 3. agent-worker ---------------------------------------------------------
Write-Step 'agent-worker'
if (Test-PortOpen -Port 8080) {
  Write-Skip 'health on 8080'
} else {
  $workerLog = Join-Path $LogDir 'agent-worker.log'
  $workerErrLog = Join-Path $LogDir 'agent-worker.err.log'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'pnpm --filter @umer/app-agent-worker run dev' `
    -WorkingDirectory $RepoRoot -RedirectStandardOutput $workerLog -RedirectStandardError $workerErrLog -WindowStyle Hidden
  Start-Sleep -Seconds 4
  Write-Ok "starting - log: $workerLog (needs NATS + LM Studio at http://localhost:1234 to fully come up)"
}

# --- 4. web dashboard ---------------------------------------------------------
Write-Step 'web dashboard'
if (Test-PortOpen -Port 3001) {
  Write-Skip 'http://127.0.0.1:3001'
} else {
  $webLog = Join-Path $LogDir 'web.log'
  $webErrLog = Join-Path $LogDir 'web.err.log'
  Remove-Item -Recurse -Force (Join-Path $RepoRoot 'apps\web\.next') -ErrorAction SilentlyContinue
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'pnpm --filter @umer/app-web run dev' `
    -WorkingDirectory $RepoRoot -RedirectStandardOutput $webLog -RedirectStandardError $webErrLog -WindowStyle Hidden
  Start-Sleep -Seconds 8
  if (Test-PortOpen -Port 3001) { Write-Ok "started - log: $webLog" }
  else { Write-Host "    still starting - check $webLog in a few seconds" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "Dashboard:   http://localhost:3001/command-center" -ForegroundColor White
Write-Host "control-api: http://localhost:4000/health" -ForegroundColor White
Write-Host "Logs:        $LogDir" -ForegroundColor DarkGray
Write-Host "Stop everything with: scripts\dev-down.ps1" -ForegroundColor DarkGray

<#
Switching to Docker later
-------------------------
Once Docker Desktop is actually installed and running (`docker info` succeeds),
you can run the fuller infra stack (Postgres, MySQL, Redis, MinIO, NATS,
otel-collector) instead of just NATS:

    docker compose -f infra/docker/docker-compose.yml up -d nats mysql redis minio

Then skip step 1 above (NATS) - it'll already be up on the same port - and
just start control-api / agent-worker / web as usual (or add the `apps`
Docker Compose profile once you're comfortable with it).
#>
