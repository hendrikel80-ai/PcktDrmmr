@echo off
REM Pocket Studio starten - doppelklicken statt CMD von Hand oeffnen.
REM Startet Vite + Backend in einem eigenen Fenster, wartet bis der
REM Dev-Server erreichbar ist, und startet dann die native App.

cd /d "%~dp0"

echo ============================================
echo   Pocket Studio wird gestartet...
echo ============================================
echo.

echo Raeume alte Prozesse auf (Port 5173/3001, altes app.exe)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173,3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; $exe = Join-Path '%~dp0' 'src-tauri\target\release\app.exe'; Get-CimInstance Win32_Process -Filter \"Name='app.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -eq $exe } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

start "Pocket Studio - Web/Backend" cmd /k npm run dev:full

echo Warte auf den Dev-Server (Port 5173)...
:waitloop
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 5173); $c.Close(); exit 0 } catch {}; try { $c6 = New-Object Net.Sockets.TcpClient([Net.Sockets.AddressFamily]::InterNetworkV6); $c6.Connect([Net.IPAddress]::IPv6Loopback, 5173); $c6.Close(); exit 0 } catch {}; exit 1"
if errorlevel 1 goto waitloop

echo Dev-Server bereit - starte die App...
echo (Dieses Fenster kannst du nach dem Start der App minimieren.)
echo.

cd src-tauri
call cargo tauri dev --release

echo.
echo App wurde geschlossen. Das Web/Backend-Fenster laeuft noch
echo und kann bei Bedarf manuell geschlossen werden.
pause
