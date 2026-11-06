param(
  [ValidateSet("start", "stop")]
  [string]$Action = "start"
)

$ErrorActionPreference = "Stop"
$postgresBin = Split-Path -Parent (Get-Command initdb -ErrorAction Stop).Source
$initdb = Join-Path $postgresBin "initdb.exe"
$pgCtl = Join-Path $postgresBin "pg_ctl.exe"
$psql = Join-Path $postgresBin "psql.exe"
$createdb = Join-Path $postgresBin "createdb.exe"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dataDir = Join-Path $repoRoot ".local-postgres"
$port = 5433

if ($Action -eq "stop") {
  if (Test-Path (Join-Path $dataDir "PG_VERSION")) {
    & $pgCtl -D $dataDir -m fast stop
    if ($LASTEXITCODE -ne 0) { throw "Could not stop the Lynora demo database." }
  }
  else {
    Write-Output "Lynora demo database is not initialized."
  }
  exit 0
}

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  & $initdb -D $dataDir -U lynora --encoding=UTF8 --auth-local=trust --auth-host=trust --no-instructions
  if ($LASTEXITCODE -ne 0) { throw "Could not initialize the Lynora demo database." }
}

& $pgCtl -D $dataDir status *> $null
if ($LASTEXITCODE -ne 0) {
  $logFile = Join-Path $dataDir "server.log"
  & $pgCtl -D $dataDir -l $logFile -o "-p $port -h 127.0.0.1" start
  if ($LASTEXITCODE -ne 0) { throw "Could not start PostgreSQL on port $port. Check $logFile." }
}

$databaseExists = & $psql -h 127.0.0.1 -p $port -U lynora -d postgres -tA -c "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'lynora')"
if ($LASTEXITCODE -ne 0) { throw "Could not connect to the Lynora demo database server." }
if ($databaseExists -ne "t") {
  & $createdb -h 127.0.0.1 -p $port -U lynora -O lynora lynora
  if ($LASTEXITCODE -ne 0) { throw "Could not create the Lynora demo database." }
}

Write-Output "Lynora demo PostgreSQL is ready at 127.0.0.1:$port."