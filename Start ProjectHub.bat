@echo off
rem ProjectHub — simple on-demand launcher (no auto-start, no background service).
rem Double-click to start the app; close this window to stop it.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found. Install Node 18 or newer, then run this again.
  echo.
  pause
  exit /b 1
)

set "PH_DATA_DIR=%~dp0data"
set "PH_BACKUP_DIR=%~dp0data\backups"

if not exist "node_modules" (
  echo   First run: installing dependencies...
  call npm install
)
if not exist "dist\index.html" (
  echo   First run: building the app...
  call npm run build
)

echo.
echo   Starting ProjectHub...
echo   Keep this window open while you use the app. Close it to stop.
echo.

rem Open the app in a clean Edge app-window a few seconds after the server starts.
start "" cmd /c "timeout /t 4 >nul & start msedge --app=http://localhost:4317/"

call npm run serve

echo.
echo   ProjectHub has stopped. You can close this window.
pause
