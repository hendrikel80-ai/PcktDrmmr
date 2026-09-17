# Startet Pocket Studio komplett ohne sichtbare Konsolenfenster:
# 1. Vite + Backend (npm run dev:full) im Hintergrund, Ausgabe in logs/
# 2. Wartet, bis der Dev-Server erreichbar ist (prueft IPv4 UND IPv6 -
#    Node/Vite binden "localhost" je nach Umgebung mal auf 127.0.0.1,
#    mal nur auf ::1; nur eine der beiden Adressen zu pruefen kann ewig
#    haengen bleiben, wenn die andere gebunden wird)
# 3. Startet die native App (cargo tauri dev --release), ebenfalls ohne
#    eigenes Konsolenfenster - nur das echte App-Fenster erscheint

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$devFullLog = Join-Path $logDir 'dev-full.log'
$tauriLog = Join-Path $logDir 'tauri.log'

# Aufraeumen von einem vorherigen Lauf, BEVOR neu gestartet wird: "die App
# schliessen" beendet nur das sichtbare Fenster, nicht zuverlaessig den
# ganzen dahinterliegenden npm/vite/Backend-Prozessbaum (mehrfach live
# beobachtet - z.B. ein alter Backend-Prozess mit veraltetem In-Memory-
# Zustand, der weiterlaeuft und Port 3001 blockiert oder still weiter
# antwortet). Jeder Start soll deshalb idempotent von einem sauberen
# Zustand aus beginnen, statt sich auf ein cleanes vorheriges Beenden zu
# verlassen.
function Stop-ProcessOnPort($port) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  } catch { return }
  foreach ($conn in $conns) {
    try {
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    } catch {}
  }
}
Stop-ProcessOnPort 5173
Stop-ProcessOnPort 3001

# Die native App selbst (falls ein Fenster "geschlossen", der Prozess aber
# haengen geblieben ist) - gezielt nur das Release-Binary dieses Projekts,
# nicht irgendein anderes "app.exe" auf dem System.
$releaseExe = Join-Path $root 'src-tauri\target\release\app.exe'
Get-CimInstance Win32_Process -Filter "Name='app.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -eq $releaseExe } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

# npm.cmd direkt aufrufen (nicht "npm") - Start-Process sucht sonst nicht
# zuverlaessig im PATH nach .cmd-Dateien.
Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev:full' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $devFullLog -RedirectStandardError "$devFullLog.err"

function Test-PortOpen($portToCheck) {
  # Node/Vite binds "localhost" to 127.0.0.1 on some runs, ::1 on others -
  # check both. TcpClient's plain constructor defaults to the IPv4 address
  # family, so connecting to an IPv6 address needs its own explicitly
  # IPv6-typed client, or .Connect() fails with a confusing "address
  # incompatible with protocol" error instead of a clean refusal.
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect('127.0.0.1', $portToCheck)
    $client.Close()
    return $true
  } catch {}
  try {
    $client6 = New-Object System.Net.Sockets.TcpClient([System.Net.Sockets.AddressFamily]::InterNetworkV6)
    $client6.Connect([System.Net.IPAddress]::IPv6Loopback, $portToCheck)
    $client6.Close()
    return $true
  } catch {}
  return $false
}

$maxWaitSeconds = 60
$waited = 0
while (-not (Test-PortOpen 5173)) {
  Start-Sleep -Seconds 1
  $waited++
  if ($waited -ge $maxWaitSeconds) {
    # Nicht endlos haengen bleiben - Log liegt fuer die Fehlersuche bereit.
    exit 1
  }
}

Set-Location (Join-Path $root 'src-tauri')
Start-Process -FilePath 'cargo.exe' -ArgumentList 'tauri', 'dev', '--release' `
  -WorkingDirectory (Join-Path $root 'src-tauri') -WindowStyle Hidden `
  -RedirectStandardOutput $tauriLog -RedirectStandardError "$tauriLog.err" -Wait
