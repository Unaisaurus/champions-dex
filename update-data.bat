@echo off
rem ============================================================
rem  Champions Dex - update the game data
rem  Double-click this file after a Pokemon Champions update. It
rem  downloads the latest sources, rebuilds the game data, checks
rem  everything and only then replaces the old data. Your teams
rem  and favourites are never touched.
rem  What changed is written to data\update-report.md
rem ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet.
  echo Download the LTS version from https://nodejs.org , install it, then run this file again.
  pause
  exit /b 1
)

echo Checking that everything is installed...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto failed

echo.
echo Updating the game data. This takes about a minute...
call npm run update-data
if errorlevel 1 goto failed

echo.
echo Done. See data\update-report.md for what changed.
echo Restart the app (start-app.bat) to use the new data.
pause
exit /b 0

:failed
echo.
echo The update stopped. Nothing was changed: the app keeps its current data.
echo Scroll up to see what went wrong.
pause
exit /b 1
