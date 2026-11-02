@echo off
rem ============================================================
rem  Champions Dex - start the app
rem  Double-click this file. It opens the app in your browser at
rem  http://localhost:5173 . Keep this window open while you use
rem  the app; close it to stop.
rem ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet.
  echo Download the LTS version from https://nodejs.org , install it, then run this file again.
  pause
  exit /b 1
)

echo Checking that everything is installed. The first time this can take a few minutes...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo Installation failed. Check your internet connection and try again.
  pause
  exit /b 1
)

echo Starting Champions Dex at http://localhost:5173 ...
call npm run start
pause
